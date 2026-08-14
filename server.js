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

// ── Banco PostgreSQL ──────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

// ── Setup banco ───────────────────────────────────────────────────────────────
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

  // Criar usuário admin padrão
  const existing = await query("SELECT id FROM users WHERE email = $1", ["nayara.hummel@icloud.com"]);
  if (existing.rows.length === 0) {
    const hash = bcrypt.hashSync("26092000Nay.", 10);
    await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
      ["Nayara", "nayara.hummel@icloud.com", hash, "owner"]
    );
    console.log("✅ Usuário Nayara criado!");
  }

  console.log("✅ Banco configurado!");
}

// ── Web Push ──────────────────────────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJkbLQQ4X0j7xt1WvkUHU2l26uM";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "UUxI4O8-HoUAitoVgEHe9UmklZ7kFSLBIBEd7iEFEqI";
webpush.setVapidDetails("mailto:nayara.hummel@icloud.com", VAPID_PUBLIC, VAPID_PRIVATE);

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function signToken(userId) {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return Number(payload.sub);
  } catch { return null; }
}

async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  const userId = await verifyToken(token);
  if (!userId) return res.status(401).json({ error: "Sessão inválida" });
  const result = await query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!result.rows[0]) return res.status(401).json({ error: "Usuário não encontrado" });
  req.user = result.rows[0];
  next();
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1);

const distPath = join(__dirname, "dist");
if (fs.existsSync(distPath)) app.use(express.static(distPath));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ ok: true }));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha obrigatórios" });
  const result = await query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
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

// ── Users ─────────────────────────────────────────────────────────────────────
app.get("/api/users", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const r = await query("SELECT id, name, email, role, created_at FROM users WHERE owner_id = $1", [req.user.id]);
  res.json(r.rows);
});

app.post("/api/users", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  const existing = await query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (existing.rows.length > 0) return res.status(400).json({ error: "E-mail já cadastrado" });
  const hash = bcrypt.hashSync(password, 10);
  const r = await query(
    "INSERT INTO users (name, email, password_hash, role, owner_id) VALUES ($1,$2,$3,'viewer',$4) RETURNING id",
    [name, email.trim().toLowerCase(), hash, req.user.id]
  );
  res.json({ success: true, id: r.rows[0].id });
});

app.delete("/api/users/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM users WHERE id = $1 AND owner_id = $2", [Number(req.params.id), req.user.id]);
  res.json({ success: true });
});

// ── Shifts ────────────────────────────────────────────────────────────────────
function getOwnerId(user) { return user.role === "owner" ? user.id : user.owner_id; }

app.get("/api/shifts/:year/:month", requireAuth, async (req, res) => {
  const ownerId = getOwnerId(req.user);
  const { year, month } = req.params;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const r = await query("SELECT * FROM shifts WHERE owner_id = $1 AND date LIKE $2", [ownerId, `${prefix}%`]);
  res.json(r.rows);
});

app.put("/api/shifts/:date", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão para editar" });
  const { date } = req.params;
  const { type, startTime, endTime, hours, notes } = req.body;
  await query(`
    INSERT INTO shifts (owner_id, date, type, start_time, end_time, hours, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (owner_id, date) DO UPDATE SET
      type=$3, start_time=$4, end_time=$5, hours=$6, notes=$7, updated_at=NOW()
  `, [req.user.id, date, type, startTime||null, endTime||null, hours||null, notes||null]);
  const r = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, date]);
  res.json(r.rows[0]);
});

app.delete("/api/shifts/:date", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Sem permissão" });
  await query("DELETE FROM shifts WHERE owner_id=$1 AND date=$2", [req.user.id, req.params.date]);
  res.json({ success: true });
});

// ── Push ──────────────────────────────────────────────────────────────────────
app.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const sub = JSON.stringify(req.body);
  await query(`
    INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET subscription=$2
  `, [req.user.id, sub]);
  res.json({ success: true });
});

app.get("/api/push/vapid-key", (_, res) => res.json({ publicKey: VAPID_PUBLIC }));

// ── Cron: notificação às 20h ──────────────────────────────────────────────────
cron.schedule("0 20 * * *", async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const owners = await query("SELECT id FROM users WHERE role='owner'");
  for (const owner of owners.rows) {
    const shift = await query("SELECT * FROM shifts WHERE owner_id=$1 AND date=$2", [owner.id, tomorrowStr]);
    const s = shift.rows[0];
    const title = "📅 Agenda de Amanhã";
    const body = s
      ? s.type === "off" ? "🌙 Amanhã você está de FOLGA! Aproveite 😴"
        : `${s.type === "plantao" ? "🏥" : "💼"} Amanhã você trabalha${s.start_time ? ` das ${s.start_time}` : ""}${s.end_time ? ` às ${s.end_time}` : ""}${s.hours ? ` (${s.hours}h)` : ""}`
      : "📋 Amanhã ainda não tem turno definido";

    const viewers = await query("SELECT id FROM users WHERE owner_id=$1", [owner.id]);
    const allIds = [owner.id, ...viewers.rows.map(u => u.id)];
    for (const userId of allIds) {
      const subR = await query("SELECT subscription FROM push_subscriptions WHERE user_id=$1", [userId]);
      if (!subR.rows[0]) continue;
      try {
        await webpush.sendNotification(JSON.parse(subR.rows[0].subscription), JSON.stringify({ title, body }));
      } catch (e) {
        if (e.statusCode === 410) await query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
      }
    }
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
  const indexPath = join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send("OK - building...");
});

// ── Start ─────────────────────────────────────────────────────────────────────
setupDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Nayara Agenda na porta ${PORT}`));
}).catch(err => {
  console.error("❌ Erro ao iniciar:", err);
  process.exit(1);
});
