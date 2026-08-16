import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import { encField, decField } from "./crypto.js";
import pg from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import cron from "node-cron";
import webpush from "web-push";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "nayara-agenda-secret-2024");
const COOKIE = "nayara_session";

// ── Banco ─────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

async function setupDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      owner_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'work',
      start_time TEXT,
      end_time TEXT,
      hours INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(owner_id, date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      subscription TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6d28d9',
      emoji TEXT DEFAULT '🏷️',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS shift_tags (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(owner_id, date, tag_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      notify_midnight BOOLEAN DEFAULT true,
      notify_hours_before INTEGER DEFAULT 0,
      notify_tags BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migração aditiva: responsável por um lembrete num dia.
  await query(`ALTER TABLE shift_tags ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER`);

  // Cor personalizada por turno (opcional; se null, usa a cor do tipo).
  await query(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS color TEXT`);

  // Flag "tem agenda própria" (é dono). Migra os antigos role='owner'.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false`);
  await query(`UPDATE users SET is_owner = true WHERE role = 'owner'`);

  // Acessos de agenda (quem vê a agenda de quem) — N:N.
  await query(`
    CREATE TABLE IF NOT EXISTS agenda_access (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      viewer_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(owner_id, viewer_id)
    )
  `);
  // Migra vínculos antigos (users.owner_id) para agenda_access.
  await query(`
    INSERT INTO agenda_access (owner_id, viewer_id)
    SELECT owner_id, id FROM users WHERE owner_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  // Convites por link.
  await query(`
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      used_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Horários padrões (presets) com cor, por dono.
  await query(`
    CREATE TABLE IF NOT EXISTS shift_presets (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'work',
      start_time TEXT,
      end_time TEXT,
      hours INTEGER,
      color TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Emoji personalizado por turno / horário padrão (opcional).
  await query(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS emoji TEXT`);
  await query(`ALTER TABLE shift_presets ADD COLUMN IF NOT EXISTS emoji TEXT`);

  // Backfill: dias já lançados (sem cor/emoji) que batem com um horário padrão herdam dele.
  // (a) turnos com horário → casa por início/fim.
  await query(`
    UPDATE shifts s
    SET color = COALESCE(NULLIF(s.color, ''), p.color),
        emoji = COALESCE(NULLIF(s.emoji, ''), p.emoji)
    FROM shift_presets p
    WHERE s.owner_id = p.owner_id AND p.type <> 'off'
      AND s.start_time = p.start_time AND s.end_time IS NOT DISTINCT FROM p.end_time
      AND (p.color IS NOT NULL OR p.emoji IS NOT NULL)
      AND (s.color IS NULL OR s.color = '' OR s.emoji IS NULL OR s.emoji = '')
  `);
  // (b) folgas → casa por tipo 'off'.
  await query(`
    UPDATE shifts s
    SET color = COALESCE(NULLIF(s.color, ''), p.color),
        emoji = COALESCE(NULLIF(s.emoji, ''), p.emoji)
    FROM shift_presets p
    WHERE s.owner_id = p.owner_id AND p.type = 'off' AND s.type = 'off'
      AND (p.color IS NOT NULL OR p.emoji IS NOT NULL)
      AND (s.color IS NULL OR s.color = '' OR s.emoji IS NULL OR s.emoji = '')
  `);

  // Admin padrão (dona da 1ª agenda).
  const existing = await query("SELECT id FROM users WHERE email = $1", ["nayara.hummel@icloud.com"]);
  if (existing.rows.length === 0) {
    const hash = bcrypt.hashSync("26092000Nay.", 10);
    await query("INSERT INTO users (name, email, password_hash, role, is_owner) VALUES ($1,$2,$3,'owner',true)",
      [encField("Nayara"), "nayara.hummel@icloud.com", hash]);
    console.log("✅ Usuário Nayara criado!");
  }
  console.log("✅ Banco configurado!");
}

// ── Helpers de agenda/acesso ─────────────────────────────────────────────────
// Data de hoje (YYYY-MM-DD) no fuso de Brasília.
function ymdBrasilia(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

async function canViewAgenda(userId, ownerId) {
  if (userId === ownerId) return true;
  const r = await query("SELECT 1 FROM agenda_access WHERE owner_id=$1 AND viewer_id=$2", [ownerId, userId]);
  return r.rows.length > 0;
}

// Agendas que o usuário pode abrir: a própria (se dono) + as que foi convidado.
async function listAgendas(userId) {
  const r = await query(`
    SELECT u.id AS owner_id, u.name, (u.id = $1) AS is_mine
    FROM users u
    WHERE (u.id = $1 AND u.is_owner = true)
       OR u.id IN (SELECT owner_id FROM agenda_access WHERE viewer_id = $1)
    ORDER BY is_mine DESC, u.name
  `, [userId]);
  return r.rows.map((x) => ({ ownerId: x.owner_id, name: decField(x.name), isMine: x.is_mine }));
}

// Decifra os campos exibidos das linhas do banco (no-op se estiverem em claro).
function outShift(s) { if (s) s.notes = decField(s.notes); return s; }
function outTagRow(t) {
  if (t) {
    t.tag_name = decField(t.tag_name);
    t.notes = decField(t.notes);
    t.assignee_name = decField(t.assignee_name);
  }
  return t;
}

// Destinatários das notificações da agenda de um dono: ele + quem tem acesso.
async function agendaRecipients(ownerId) {
  const r = await query(`
    SELECT u.id, ns.notify_midnight, ns.notify_tags, ns.notify_hours_before
    FROM users u
    LEFT JOIN notification_settings ns ON ns.user_id = u.id
    WHERE u.id = $1 OR u.id IN (SELECT viewer_id FROM agenda_access WHERE owner_id = $1)
  `, [ownerId]);
  return r.rows;
}

// ── Web Push ──────────────────────────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BAmHwEDX2z4sXxHRhDIqgHNhPMiExlb6OgmKiikYfYeUl9uYfJ85hOnZMkTQXxqwwTBkgEPL9ylc5T5stGnzTtA";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "7DvvdX-i5QOH41TkofiEECK33v1n7KZgxr1tnv000UA";
webpush.setVapidDetails("mailto:nayara.hummel@icloud.com", VAPID_PUBLIC, VAPID_PRIVATE);

async function sendPushToUser(userId, title, body) {
  const subR = await query("SELECT subscription FROM push_subscriptions WHERE user_id=$1", [userId]);
  if (!subR.rows[0]) return false;
  try {
    await webpush.sendNotification(
      JSON.parse(subR.rows[0].subscription),
      JSON.stringify({ title, body, icon: "/icon-192.png", badge: "/icon-192.png" })
    );
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      await query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
    } else {
      console.warn("[push] erro ao enviar p/ user", userId, e?.statusCode, e?.message);
    }
    return false;
  }
}

// ── Mensagem do turno ────────────────────────────────────────────────────────
async function buildShiftMessage(ownerId, dateStr) {
  const shift = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [ownerId, dateStr]);
  const s = shift.rows[0];
  let body;
  if (!s) {
    body = "Nenhum turno registrado.";
  } else if (s.type === "off") {
    body = "🌙 FOLGA! Descanse bem 😴";
  } else {
    const tipo = s.type === "plantao" ? "🏥 Plantão" : "💼 Trabalho";
    body = `${tipo}${s.start_time ? ` das ${s.start_time}` : ""}${s.end_time ? ` às ${s.end_time}` : ""}${s.hours ? ` · ${s.hours}h` : ""}`;
  }
  return { body, hasShift: !!s, shift: s };
}

// Resumo do dia (00:00) — turno + lembretes — para o dono e quem tem acesso.
async function sendNotificationsForDate(dateStr) {
  const owners = await query("SELECT id FROM users WHERE is_owner = true");
  for (const owner of owners.rows) {
    const { body, shift } = await buildShiftMessage(owner.id, dateStr);

    const tagsR = await query(`
      SELECT t.name, t.emoji, st.start_time FROM shift_tags st
      JOIN tags t ON t.id = st.tag_id WHERE st.owner_id=$1 AND st.date=$2
      ORDER BY st.start_time NULLS LAST
    `, [owner.id, dateStr]);
    const hasTags = tagsR.rows.length > 0;
    const tagsLine = hasTags
      ? tagsR.rows.map(t => `${t.emoji} ${decField(t.name)}${t.start_time ? ` às ${t.start_time}` : ""}`).join(" · ")
      : "";

    if (!shift && !hasTags) continue; // dia vazio → não incomoda

    const title = `📅 Agenda — ${new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}`;

    const recips = await agendaRecipients(owner.id);
    for (const u of recips) {
      if (u.notify_midnight === false) continue;
      let fullBody = shift ? body : "";
      if (u.notify_tags !== false && tagsLine) fullBody += (fullBody ? "\n" : "") + tagsLine;
      if (!fullBody) fullBody = body;
      await sendPushToUser(u.id, title, fullBody);
    }
  }
}

// ── Cron: 00:00 — resumo do dia ───────────────────────────────────────────────
cron.schedule("0 0 * * *", async () => {
  console.log("[CRON 00:00] Resumo do dia...");
  await sendNotificationsForDate(ymdBrasilia());
}, { timezone: "America/Sao_Paulo" });

// ── Cron: a cada minuto — avisos por horário do próprio evento ────────────────
// (a) "X horas antes" do INÍCIO do turno (ex.: turno 18:00 + "1h antes" → 17:00 do MESMO dia).
// (b) lembrete de tag com responsável, 2h antes do horário da tag.
cron.schedule("* * * * *", async () => {
  const nowB = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const nowMin = nowB.getHours() * 60 + nowB.getMinutes();
  const todayStr = ymdBrasilia();

  try {
    // (a) turno: início − notify_hours_before de cada destinatário
    const owners = await query("SELECT id FROM users WHERE is_owner = true");
    for (const owner of owners.rows) {
      const sR = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [owner.id, todayStr]);
      const s = sR.rows[0];
      if (!s || s.type === "off" || !s.start_time) continue;
      const [sh, sm] = s.start_time.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const recips = await agendaRecipients(owner.id);
      for (const u of recips) {
        const hb = u.notify_hours_before || 0;
        if (!hb) continue;
        const targetMin = startMin - hb * 60;
        if (targetMin < 0) continue; // cruzaria a meia-noite → já coberto pelo aviso das 00:00
        if (targetMin === nowMin) {
          const tipo = s.type === "plantao" ? "🏥 Plantão" : "💼 Trabalho";
          const quando = hb === 1 ? "Falta 1 hora" : `Faltam ${hb} horas`;
          await sendPushToUser(u.id, `⏰ ${quando}`, `${tipo} às ${s.start_time}${s.end_time ? ` – ${s.end_time}` : ""}`);
        }
      }
    }

    // (b) tag com responsável: 2h antes do horário da tag
    const target = new Date(nowB.getTime() + 2 * 60 * 60 * 1000);
    const hh = String(target.getHours()).padStart(2, "0");
    const mm = String(target.getMinutes()).padStart(2, "0");
    const tagRows = await query(`
      SELECT st.assigned_user_id, st.start_time, t.name, t.emoji
      FROM shift_tags st JOIN tags t ON t.id = st.tag_id
      WHERE st.date=$1 AND st.assigned_user_id IS NOT NULL AND st.start_time=$2
    `, [todayStr, `${hh}:${mm}`]);
    for (const r of tagRows.rows) {
      await sendPushToUser(r.assigned_user_id, "⏰ Faltam 2 horas", `${r.emoji || "🏷️"} ${decField(r.name)} às ${r.start_time}`);
    }
  } catch (e) { console.warn("[cron minuto]", e?.message); }
}, { timezone: "America/Sao_Paulo" });

// ── Auth ──────────────────────────────────────────────────────────────────────
function secondsUntilBrasiliaMidnight() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hourCycle: "h23",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const secs = 24 * 3600 - (get("hour") * 3600 + get("minute") * 60 + get("second"));
  return secs <= 0 ? 24 * 3600 : secs;
}

async function signToken(userId, remember) {
  const jwt = new SignJWT({ sub: String(userId) }).setProtectedHeader({ alg: "HS256" });
  if (remember) jwt.setExpirationTime("30d");
  else jwt.setExpirationTime(Math.floor(Date.now() / 1000) + secondsUntilBrasiliaMidnight());
  return jwt.sign(SECRET);
}
async function verifyToken(token) {
  try { const { payload } = await jwtVerify(token, SECRET); return Number(payload.sub); }
  catch { return null; }
}
async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  const userId = await verifyToken(token);
  if (!userId) return res.status(401).json({ error: "Sessão inválida" });
  const r = await query("SELECT * FROM users WHERE id=$1", [userId]);
  if (!r.rows[0]) return res.status(401).json({ error: "Usuário não encontrado" });
  req.user = r.rows[0];
  next();
}

function setSessionCookie(res, token, remember) {
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: (remember ? 30 * 24 * 60 * 60 : secondsUntilBrasiliaMidnight()) * 1000,
  });
}

async function publicUser(u) {
  return {
    id: u.id, name: decField(u.name), email: u.email, role: u.role,
    ownerId: u.owner_id ?? null, isOwner: !!u.is_owner,
    agendas: await listAgendas(u.id),
  };
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1);
const distPath = join(__dirname, "dist");
if (fs.existsSync(distPath)) app.use(express.static(distPath));

app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth
app.post("/api/login", async (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha obrigatórios" });
  const r = await query("SELECT * FROM users WHERE email=$1", [email.trim().toLowerCase()]);
  const user = r.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Credenciais inválidas" });
  setSessionCookie(res, await signToken(user.id, !!remember), !!remember);
  res.json({ success: true, user: await publicUser(user) });
});
app.post("/api/logout", (req, res) => { res.clearCookie(COOKIE); res.json({ success: true }); });
app.get("/api/me", requireAuth, async (req, res) => {
  res.json(await publicUser(req.user));
});

// Convite: dados públicos p/ a tela de cadastro
app.get("/api/invite/:token", async (req, res) => {
  const r = await query(
    "SELECT i.name, i.used_by, u.name AS owner_name FROM invites i JOIN users u ON u.id=i.owner_id WHERE i.token=$1",
    [req.params.token]
  );
  const inv = r.rows[0];
  if (!inv) return res.status(404).json({ error: "Convite inválido" });
  if (inv.used_by) return res.status(410).json({ error: "Este convite já foi usado" });
  res.json({ name: decField(inv.name), ownerName: decField(inv.owner_name) });
});

// Cadastro via convite: cria a conta e já libera o acesso à agenda de quem convidou.
app.post("/api/register", async (req, res) => {
  const { token, email, password, name } = req.body;
  if (!token || !email || !password) return res.status(400).json({ error: "Preencha e-mail e senha" });
  if (String(password).length < 6) return res.status(400).json({ error: "Senha de no mínimo 6 caracteres" });
  const invR = await query("SELECT * FROM invites WHERE token=$1", [token]);
  const inv = invR.rows[0];
  if (!inv) return res.status(404).json({ error: "Convite inválido" });
  if (inv.used_by) return res.status(410).json({ error: "Este convite já foi usado" });
  const emailN = email.trim().toLowerCase();
  const ex = await query("SELECT id FROM users WHERE email=$1", [emailN]);
  if (ex.rows.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
  const hash = bcrypt.hashSync(password, 10);
  const finalName = (name && name.trim()) ? name.trim() : decField(inv.name);
  const uR = await query(
    "INSERT INTO users (name,email,password_hash,role,is_owner) VALUES ($1,$2,$3,'viewer',false) RETURNING *",
    [encField(finalName), emailN, hash]
  );
  const newUser = uR.rows[0];
  await query("INSERT INTO agenda_access (owner_id, viewer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [inv.owner_id, newUser.id]);
  await query("UPDATE invites SET used_by=$1 WHERE id=$2", [newUser.id, inv.id]);
  setSessionCookie(res, await signToken(newUser.id, false), false);
  res.json({ success: true, user: await publicUser(newUser) });
});

// "Criar minha agenda": um convidado vira dono da própria agenda (mantém os acessos que já tem).
app.post("/api/agenda/activate", requireAuth, async (req, res) => {
  await query("UPDATE users SET is_owner=true WHERE id=$1", [req.user.id]);
  const fresh = await query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  res.json({ success: true, user: await publicUser(fresh.rows[0]) });
});

// ── Convites (dono da agenda) ─────────────────────────────────────────────────
app.post("/api/invites", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Ative sua agenda primeiro" });
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Informe um nome" });
  const token = randomBytes(16).toString("hex");
  await query("INSERT INTO invites (owner_id,name,token) VALUES ($1,$2,$3)", [req.user.id, encField(name.trim()), token]);
  res.json({ token });
});
app.get("/api/invites", requireAuth, async (req, res) => {
  const r = await query(
    `SELECT i.id, i.name, i.token, u.name AS used_by_name
     FROM invites i LEFT JOIN users u ON u.id = i.used_by
     WHERE i.owner_id=$1 ORDER BY i.created_at DESC`,
    [req.user.id]
  );
  res.json(r.rows.map(x => ({ id: x.id, name: decField(x.name), token: x.token, used: !!x.used_by_name, usedByName: decField(x.used_by_name) })));
});
app.delete("/api/invites/:id", requireAuth, async (req, res) => {
  await query("DELETE FROM invites WHERE id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// ── Pessoas com acesso à MINHA agenda ─────────────────────────────────────────
app.get("/api/users", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.json([]);
  const r = await query(
    `SELECT u.id, u.name, u.email FROM agenda_access a JOIN users u ON u.id = a.viewer_id
     WHERE a.owner_id=$1`,
    [req.user.id]
  );
  const list = r.rows.map(u => ({ id: u.id, name: decField(u.name), email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(list);
});
// Remove o ACESSO de alguém (não apaga a conta da pessoa).
app.delete("/api/users/:id", requireAuth, async (req, res) => {
  await query("DELETE FROM agenda_access WHERE owner_id=$1 AND viewer_id=$2", [req.user.id, Number(req.params.id)]);
  res.json({ success: true });
});

// ── Horários padrões (presets) ────────────────────────────────────────────────
app.get("/api/presets", requireAuth, async (req, res) => {
  const r = await query("SELECT * FROM shift_presets WHERE owner_id=$1 ORDER BY start_time NULLS LAST, id", [req.user.id]);
  res.json(r.rows.map(p => ({ ...p, label: decField(p.label) })));
});
// Aplica cor/emoji de um horário padrão nos dias já lançados (sem cor/emoji) que batem com ele.
async function applyPresetToShifts(ownerId, { type, startTime, endTime, color, emoji }) {
  if (!color && !emoji) return;
  if (type === "off") {
    await query(`
      UPDATE shifts SET color=COALESCE(NULLIF(color,''),$1), emoji=COALESCE(NULLIF(emoji,''),$2)
      WHERE owner_id=$3 AND type='off' AND (color IS NULL OR color='' OR emoji IS NULL OR emoji='')
    `, [color || null, emoji || null, ownerId]);
  } else if (startTime) {
    await query(`
      UPDATE shifts SET color=COALESCE(NULLIF(color,''),$1), emoji=COALESCE(NULLIF(emoji,''),$2)
      WHERE owner_id=$3 AND start_time=$4 AND end_time IS NOT DISTINCT FROM $5
        AND (color IS NULL OR color='' OR emoji IS NULL OR emoji='')
    `, [color || null, emoji || null, ownerId, startTime, endTime || null]);
  }
}

app.post("/api/presets", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Ative sua agenda primeiro" });
  const { label, type, startTime, endTime, hours, color, emoji } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: "Informe um nome" });
  const r = await query(
    "INSERT INTO shift_presets (owner_id,label,type,start_time,end_time,hours,color,emoji) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [req.user.id, encField(label.trim()), type || "work", startTime || null, endTime || null, hours || null, color || null, emoji || null]
  );
  await applyPresetToShifts(req.user.id, { type: type || "work", startTime, endTime, color, emoji });
  res.json({ ...r.rows[0], label: decField(r.rows[0].label) });
});

app.put("/api/presets/:id", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  const { label, type, startTime, endTime, hours, color, emoji } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: "Informe um nome" });
  const r = await query(
    `UPDATE shift_presets SET label=$1,type=$2,start_time=$3,end_time=$4,hours=$5,color=$6,emoji=$7
     WHERE id=$8 AND owner_id=$9 RETURNING *`,
    [encField(label.trim()), type || "work", startTime || null, endTime || null, hours || null, color || null, emoji || null,
     Number(req.params.id), req.user.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Horário não encontrado" });
  await applyPresetToShifts(req.user.id, { type: type || "work", startTime, endTime, color, emoji });
  res.json({ ...r.rows[0], label: decField(r.rows[0].label) });
});

app.delete("/api/presets/:id", requireAuth, async (req, res) => {
  await query("DELETE FROM shift_presets WHERE id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// ── Shifts ────────────────────────────────────────────────────────────────────
// Detalhe do dia (rota específica ANTES da genérica :year/:month).
app.get("/api/shifts/:date/detail", requireAuth, async (req, res) => {
  try {
    const ownerId = Number(req.query.owner) || req.user.id;
    if (!(await canViewAgenda(req.user.id, ownerId))) return res.status(403).json({ error: "Sem acesso" });
    const { date } = req.params;
    const [shiftR, tagsR] = await Promise.all([
      query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [ownerId, date]),
      query(`
        SELECT st.*, t.name as tag_name, t.color as tag_color, t.emoji as tag_emoji,
               au.name as assignee_name
        FROM shift_tags st JOIN tags t ON t.id=st.tag_id
        LEFT JOIN users au ON au.id=st.assigned_user_id
        WHERE st.owner_id=$1 AND st.date=$2
        ORDER BY st.start_time
      `, [ownerId, date]),
    ]);
    res.json({ shift: outShift(shiftR.rows[0] || null), tags: tagsR.rows.map(outTagRow) });
  } catch (e) {
    console.error("[detail]", e?.message);
    res.status(500).json({ error: "Erro ao carregar o dia" });
  }
});

app.get("/api/shifts/:year/:month", requireAuth, async (req, res) => {
  const ownerId = Number(req.query.owner) || req.user.id;
  if (!(await canViewAgenda(req.user.id, ownerId))) return res.status(403).json({ error: "Sem acesso" });
  const prefix = `${req.params.year}-${String(req.params.month).padStart(2, "0")}`;
  const [shiftsR, tagsR] = await Promise.all([
    query("SELECT * FROM shifts WHERE owner_id=$1 AND date LIKE $2", [ownerId, `${prefix}%`]),
    query(`
      SELECT st.*, t.name as tag_name, t.color as tag_color, t.emoji as tag_emoji,
             au.name as assignee_name
      FROM shift_tags st JOIN tags t ON t.id=st.tag_id
      LEFT JOIN users au ON au.id=st.assigned_user_id
      WHERE st.owner_id=$1 AND st.date LIKE $2
    `, [ownerId, `${prefix}%`]),
  ]);
  const tagsByDate = {};
  tagsR.rows.forEach(t => {
    outTagRow(t);
    if (!tagsByDate[t.date]) tagsByDate[t.date] = [];
    tagsByDate[t.date].push(t);
  });
  res.json({ shifts: shiftsR.rows.map(outShift), tagsByDate });
});

// Edição sempre na PRÓPRIA agenda (owner_id = usuário logado).
app.put("/api/shifts/:date", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  const { date } = req.params;
  const { type, startTime, endTime, hours, notes, color, emoji } = req.body;

  // Sem cor/emoji escolhidos? Herda de um horário padrão que bata (por horário; folga por tipo).
  let finalColor = color || null;
  let finalEmoji = emoji || null;
  if (!finalColor || !finalEmoji) {
    let pr = null;
    if (type === "off") {
      pr = await query("SELECT color, emoji FROM shift_presets WHERE owner_id=$1 AND type='off' ORDER BY id LIMIT 1", [req.user.id]);
    } else if (startTime) {
      pr = await query(
        `SELECT color, emoji FROM shift_presets
         WHERE owner_id=$1 AND start_time=$2 AND end_time IS NOT DISTINCT FROM $3 ORDER BY id LIMIT 1`,
        [req.user.id, startTime, endTime || null]
      );
    }
    if (pr && pr.rows[0]) {
      if (!finalColor) finalColor = pr.rows[0].color || null;
      if (!finalEmoji) finalEmoji = pr.rows[0].emoji || null;
    }
  }

  await query(`
    INSERT INTO shifts (owner_id,date,type,start_time,end_time,hours,notes,color,emoji)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (owner_id,date) DO UPDATE SET
      type=$3,start_time=$4,end_time=$5,hours=$6,notes=$7,color=$8,emoji=$9,updated_at=NOW()
  `, [req.user.id, date, type, startTime || null, endTime || null, hours || null, encField(notes || null), finalColor, finalEmoji]);
  const r = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, date]);
  res.json(outShift(r.rows[0]));
});

app.delete("/api/shifts/:date", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, req.params.date]);
  res.json({ success: true });
});

// ── Tags ──────────────────────────────────────────────────────────────────────
app.get("/api/tags", requireAuth, async (req, res) => {
  const ownerId = Number(req.query.owner) || req.user.id;
  if (!(await canViewAgenda(req.user.id, ownerId))) return res.status(403).json({ error: "Sem acesso" });
  const r = await query("SELECT * FROM tags WHERE owner_id=$1", [ownerId]);
  const list = r.rows.map(t => ({ ...t, name: decField(t.name) })).sort((a, b) => a.name.localeCompare(b.name));
  res.json(list);
});
app.post("/api/tags", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  const { name, color, emoji } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });
  const r = await query(
    "INSERT INTO tags (owner_id,name,color,emoji) VALUES ($1,$2,$3,$4) RETURNING *",
    [req.user.id, encField(name), color || "#6d28d9", emoji || "🏷️"]
  );
  res.json({ ...r.rows[0], name: decField(r.rows[0].name) });
});
app.delete("/api/tags/:id", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shift_tags WHERE tag_id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  await query("DELETE FROM tags WHERE id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// ── Shift Tags (tag num dia específico) ───────────────────────────────────────
app.put("/api/shift-tags/:date/:tagId", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  const { date, tagId } = req.params;
  const { startTime, endTime, notes, assignedUserId } = req.body;

  // Responsável precisa ser alguém com acesso à MINHA agenda.
  let assigned = null;
  if (assignedUserId) {
    const v = await query(
      "SELECT u.id, u.name FROM agenda_access a JOIN users u ON u.id=a.viewer_id WHERE a.owner_id=$1 AND u.id=$2",
      [req.user.id, Number(assignedUserId)]
    );
    if (v.rows[0]) assigned = v.rows[0];
  }

  const prev = await query("SELECT assigned_user_id FROM shift_tags WHERE owner_id=$1 AND date=$2 AND tag_id=$3",
    [req.user.id, date, Number(tagId)]);

  await query(`
    INSERT INTO shift_tags (owner_id,date,tag_id,start_time,end_time,notes,assigned_user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (owner_id,date,tag_id) DO UPDATE SET
      start_time=$4,end_time=$5,notes=$6,assigned_user_id=$7
  `, [req.user.id, date, Number(tagId), startTime || null, endTime || null, encField(notes || null), assigned?.id || null]);

  if (assigned && prev.rows[0]?.assigned_user_id !== assigned.id) {
    const tagR = await query("SELECT name, emoji FROM tags WHERE id=$1", [Number(tagId)]);
    const t = tagR.rows[0] || {};
    const dLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    await sendPushToUser(assigned.id, `🏷️ ${decField(req.user.name)} marcou você`,
      `${t.emoji || "🏷️"} ${decField(t.name)}${startTime ? ` às ${startTime}` : ""} — ${dLabel}`);
  }
  res.json({ success: true });
});
app.delete("/api/shift-tags/:date/:tagId", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shift_tags WHERE owner_id=$1 AND date=$2 AND tag_id=$3",
    [req.user.id, req.params.date, Number(req.params.tagId)]);
  res.json({ success: true });
});

// ── Push ──────────────────────────────────────────────────────────────────────
app.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const sub = JSON.stringify(req.body);
  await query(`
    INSERT INTO push_subscriptions (user_id,subscription) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET subscription=$2
  `, [req.user.id, sub]);
  res.json({ success: true });
});
app.get("/api/push/vapid-key", (_, res) => res.json({ publicKey: VAPID_PUBLIC }));

app.post("/api/push/test", requireAuth, async (req, res) => {
  const ok = await sendPushToUser(req.user.id, "🔔 Teste — Agenda",
    "Deu certo! As notificações estão funcionando 🎉");
  if (!ok) return res.status(400).json({
    error: "Nenhuma inscrição de notificação neste aparelho. Toque em 'Ativar notificações' e, no iPhone, adicione o app à Tela de Início antes."
  });
  res.json({ success: true });
});

app.post("/api/push/send-today", requireAuth, async (req, res) => {
  if (!req.user.is_owner) return res.status(403).json({ error: "Sem permissão" });
  await sendNotificationsForDate(ymdBrasilia());
  res.json({ success: true });
});

// ── Notification settings (do próprio usuário) ───────────────────────────────
app.get("/api/notification-settings", requireAuth, async (req, res) => {
  const r = await query("SELECT * FROM notification_settings WHERE user_id=$1", [req.user.id]);
  res.json(r.rows[0] || { notify_midnight: true, notify_hours_before: 0, notify_tags: true });
});
app.put("/api/notification-settings", requireAuth, async (req, res) => {
  const { notify_midnight, notify_hours_before, notify_tags } = req.body;
  await query(`
    INSERT INTO notification_settings (user_id, notify_midnight, notify_hours_before, notify_tags)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET
      notify_midnight=$2, notify_hours_before=$3, notify_tags=$4
  `, [req.user.id, notify_midnight ?? true, notify_hours_before ?? 0, notify_tags ?? true]);
  res.json({ success: true });
});

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
  const indexPath = join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send("Building...");
});

setupDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Nayara Agenda na porta ${PORT}`));
}).catch(err => { console.error("❌ Erro:", err); process.exit(1); });
