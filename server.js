import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
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

  // Admin padrão
  const existing = await query("SELECT id FROM users WHERE email = $1", ["nayara.hummel@icloud.com"]);
  if (existing.rows.length === 0) {
    const hash = bcrypt.hashSync("26092000Nay.", 10);
    await query("INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)",
      ["Nayara", "nayara.hummel@icloud.com", hash, "owner"]);
    console.log("✅ Usuário Nayara criado!");
  }
  console.log("✅ Banco configurado!");
}

// ── Web Push ──────────────────────────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJkbLQQ4X0j7xt1WvkUHU2l26uM";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "UUxI4O8-HoUAitoVgEHe9UmklZ7kFSLBIBEd7iEFEqI";
webpush.setVapidDetails("mailto:nayara.hummel@icloud.com", VAPID_PUBLIC, VAPID_PRIVATE);

async function sendPushToAll(ownerId, title, body) {
  const viewers = await query("SELECT id FROM users WHERE owner_id=$1", [ownerId]);
  const allIds = [ownerId, ...viewers.rows.map(u => u.id)];
  for (const userId of allIds) {
    const subR = await query("SELECT subscription FROM push_subscriptions WHERE user_id=$1", [userId]);
    if (!subR.rows[0]) continue;
    try {
      await webpush.sendNotification(
        JSON.parse(subR.rows[0].subscription),
        JSON.stringify({ title, body, icon: "/icon.svg", badge: "/icon.svg" })
      );
    } catch (e) {
      if (e.statusCode === 410) await query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
    }
  }
}

// ── Helpers de notificação ───────────────────────────────────────────────────
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

async function sendNotificationsForDate(dateStr) {
  const owners = await query("SELECT id, name FROM users WHERE role='owner'");
  for (const owner of owners.rows) {
    const { body, shift } = await buildShiftMessage(owner.id, dateStr);
    const settings = await query("SELECT * FROM notification_settings WHERE user_id=$1", [owner.id]);
    const s = settings.rows[0] || { notify_midnight: true, notify_tags: true };

    let fullBody = body;
    if (s.notify_tags && shift) {
      const tagsR = await query(`
        SELECT t.name, t.emoji, st.start_time FROM shift_tags st
        JOIN tags t ON t.id = st.tag_id WHERE st.owner_id=$1 AND st.date=$2
      `, [owner.id, dateStr]);
      if (tagsR.rows.length > 0) {
        fullBody += "\n" + tagsR.rows.map(t => `${t.emoji} ${t.name}${t.start_time ? ` às ${t.start_time}` : ""}`).join(" · ");
      }
    }

    const title = `📅 Agenda — ${new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}`;

    // Busca todos os usuários que devem receber (owner + viewers com configuração ativa)
    const viewers = await query("SELECT u.id, ns.notify_midnight, ns.notify_tags FROM users u LEFT JOIN notification_settings ns ON ns.user_id = u.id WHERE u.owner_id=$1", [owner.id]);
    const allUsers = [{ id: owner.id, notify: true }, ...viewers.rows.map(v => ({ id: v.id, notify: v.notify_midnight !== false }))];

    for (const u of allUsers) {
      if (!u.notify) continue;
      const subR = await query("SELECT subscription FROM push_subscriptions WHERE user_id=$1", [u.id]);
      if (!subR.rows[0]) continue;
      try {
        await webpush.sendNotification(JSON.parse(subR.rows[0].subscription), JSON.stringify({ title, body: fullBody, icon: "/icon.svg" }));
      } catch (e) {
        if (e.statusCode === 410) await query("DELETE FROM push_subscriptions WHERE user_id=$1", [u.id]);
      }
    }
  }
}

// ── Cron: todo dia à meia-noite (agenda do dia) ───────────────────────────────
cron.schedule("0 0 * * *", async () => {
  console.log("[CRON 00:00] Notificações do dia...");
  const todayStr = new Date().toISOString().slice(0, 10);
  await sendNotificationsForDate(todayStr);
}, { timezone: "America/Sao_Paulo" });

// ── Cron: a cada hora — verifica notificações antecipadas ────────────────────
// Roda a cada hora cheia. Para cada owner, olha o horário local dele (Brasília)
// e dispara o aviso do dia seguinte quando faltar exatamente X horas para 00:00.
cron.schedule("0 * * * *", async () => {
  // Hora atual em Brasília, independente do timezone do servidor
  const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentHour = nowBrasilia.getHours();

  const owners = await query("SELECT id FROM users WHERE role='owner'");
  for (const owner of owners.rows) {
    const settings = await query("SELECT notify_hours_before FROM notification_settings WHERE user_id=$1", [owner.id]);
    const hoursB = settings.rows[0]?.notify_hours_before || 0;
    if (!hoursB) continue;

    // Se "3 horas antes" está configurado, dispara às 21h (24-3) avisando sobre AMANHÃ
    const triggerHour = (24 - hoursB) % 24;
    if (currentHour !== triggerHour) continue;

    const tomorrow = new Date(nowBrasilia);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    await sendNotificationsForDate(`${y}-${m}-${d}`);
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function signToken(userId) {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
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
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha obrigatórios" });
  const r = await query("SELECT * FROM users WHERE email=$1", [email.trim().toLowerCase()]);
  const user = r.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Credenciais inválidas" });
  const token = await signToken(user.id);
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, ownerId: user.owner_id } });
});
app.post("/api/logout", (req, res) => { res.clearCookie(COOKIE); res.json({ success: true }); });
app.get("/api/me", requireAuth, (req, res) => {
  const { id, name, email, role, owner_id } = req.user;
  res.json({ id, name, email, role, ownerId: owner_id });
});

// Users
app.get("/api/users", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const r = await query("SELECT id,name,email,role,created_at FROM users WHERE owner_id=$1", [req.user.id]);
  res.json(r.rows);
});
app.post("/api/users", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  const ex = await query("SELECT id FROM users WHERE email=$1", [email.trim().toLowerCase()]);
  if (ex.rows.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
  const hash = bcrypt.hashSync(password, 10);
  const r = await query(
    "INSERT INTO users (name,email,password_hash,role,owner_id) VALUES ($1,$2,$3,'viewer',$4) RETURNING id",
    [name, email.trim().toLowerCase(), hash, req.user.id]
  );
  res.json({ success: true, id: r.rows[0].id });
});
app.delete("/api/users/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM users WHERE id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// Shifts
function getOwnerId(user) { return user.role === "owner" ? user.id : user.owner_id; }

app.get("/api/shifts/:year/:month", requireAuth, async (req, res) => {
  const ownerId = getOwnerId(req.user);
  const prefix = `${req.params.year}-${String(req.params.month).padStart(2,"0")}`;
  const [shiftsR, tagsR] = await Promise.all([
    query("SELECT * FROM shifts WHERE owner_id=$1 AND date LIKE $2", [ownerId, `${prefix}%`]),
    query(`
      SELECT st.*, t.name as tag_name, t.color as tag_color, t.emoji as tag_emoji
      FROM shift_tags st JOIN tags t ON t.id=st.tag_id
      WHERE st.owner_id=$1 AND st.date LIKE $2
    `, [ownerId, `${prefix}%`]),
  ]);
  // Group tags by date
  const tagsByDate = {};
  tagsR.rows.forEach(t => {
    if (!tagsByDate[t.date]) tagsByDate[t.date] = [];
    tagsByDate[t.date].push(t);
  });
  res.json({ shifts: shiftsR.rows, tagsByDate });
});

app.get("/api/shifts/:date/detail", requireAuth, async (req, res) => {
  const ownerId = getOwnerId(req.user);
  const { date } = req.params;
  const [shiftR, tagsR] = await Promise.all([
    query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [ownerId, date]),
    query(`
      SELECT st.*, t.name as tag_name, t.color as tag_color, t.emoji as tag_emoji
      FROM shift_tags st JOIN tags t ON t.id=st.tag_id
      WHERE st.owner_id=$1 AND st.date=$2
      ORDER BY st.start_time
    `, [ownerId, date]),
  ]);
  res.json({ shift: shiftR.rows[0] || null, tags: tagsR.rows });
});

app.put("/api/shifts/:date", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const { date } = req.params;
  const { type, startTime, endTime, hours, notes } = req.body;
  await query(`
    INSERT INTO shifts (owner_id,date,type,start_time,end_time,hours,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (owner_id,date) DO UPDATE SET
      type=$3,start_time=$4,end_time=$5,hours=$6,notes=$7,updated_at=NOW()
  `, [req.user.id, date, type, startTime||null, endTime||null, hours||null, notes||null]);
  const r = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, date]);
  res.json(r.rows[0]);
});

app.delete("/api/shifts/:date", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, req.params.date]);
  res.json({ success: true });
});

// Tags
app.get("/api/tags", requireAuth, async (req, res) => {
  const ownerId = getOwnerId(req.user);
  const r = await query("SELECT * FROM tags WHERE owner_id=$1 ORDER BY name", [ownerId]);
  res.json(r.rows);
});
app.post("/api/tags", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const { name, color, emoji } = req.body;
  if (!name) return res.status(400).json({ error: "Nome obrigatório" });
  const r = await query(
    "INSERT INTO tags (owner_id,name,color,emoji) VALUES ($1,$2,$3,$4) RETURNING *",
    [req.user.id, name, color||"#6d28d9", emoji||"🏷️"]
  );
  res.json(r.rows[0]);
});
app.delete("/api/tags/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shift_tags WHERE tag_id=$1", [Number(req.params.id)]);
  await query("DELETE FROM tags WHERE id=$1 AND owner_id=$2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// Shift Tags (tag in a specific date)
app.put("/api/shift-tags/:date/:tagId", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const { date, tagId } = req.params;
  const { startTime, endTime, notes } = req.body;
  await query(`
    INSERT INTO shift_tags (owner_id,date,tag_id,start_time,end_time,notes)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (owner_id,date,tag_id) DO UPDATE SET
      start_time=$4,end_time=$5,notes=$6
  `, [req.user.id, date, Number(tagId), startTime||null, endTime||null, notes||null]);
  res.json({ success: true });
});
app.delete("/api/shift-tags/:date/:tagId", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shift_tags WHERE owner_id=$1 AND date=$2 AND tag_id=$3",
    [req.user.id, req.params.date, Number(req.params.tagId)]);
  res.json({ success: true });
});

// Push
app.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const sub = JSON.stringify(req.body);
  await query(`
    INSERT INTO push_subscriptions (user_id,subscription) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET subscription=$2
  `, [req.user.id, sub]);
  res.json({ success: true });
});
app.get("/api/push/vapid-key", (_, res) => res.json({ publicKey: VAPID_PUBLIC }));

// Notification settings — do próprio usuário logado
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

// Owner: ver e controlar notificações de um viewer específico (usuário que ela criou)
app.get("/api/users/:id/notification-settings", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const viewerId = Number(req.params.id);
  const owns = await query("SELECT id FROM users WHERE id=$1 AND owner_id=$2", [viewerId, req.user.id]);
  if (!owns.rows[0]) return res.status(403).json({ error: "Este usuário não é seu" });
  const r = await query("SELECT * FROM notification_settings WHERE user_id=$1", [viewerId]);
  res.json(r.rows[0] || { notify_midnight: true, notify_hours_before: 0, notify_tags: true });
});

app.put("/api/users/:id/notification-settings", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const viewerId = Number(req.params.id);
  const owns = await query("SELECT id FROM users WHERE id=$1 AND owner_id=$2", [viewerId, req.user.id]);
  if (!owns.rows[0]) return res.status(403).json({ error: "Este usuário não é seu" });
  const { notify_midnight, notify_hours_before, notify_tags } = req.body;
  await query(`
    INSERT INTO notification_settings (user_id, notify_midnight, notify_hours_before, notify_tags)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET
      notify_midnight=$2, notify_hours_before=$3, notify_tags=$4
  `, [viewerId, notify_midnight ?? true, notify_hours_before ?? 0, notify_tags ?? true]);
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
