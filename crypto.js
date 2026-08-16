import crypto from "crypto";

// Criptografia de campos em repouso (AES-256-GCM), no mesmo esquema dos outros
// projetos: prefixo "enc:1:", IV aleatório por valor, tag de autenticação.
// - SEM a env DATA_ENC_KEY → no-op: grava e lê em claro (nada quebra).
// - COM a chave → grava cifrado e lê os dois formatos (retrocompatível, sem migração).
// NUNCA cifrar campo usado em WHERE/UNIQUE/ORDER no SQL (e-mail de login, datas, horários).

const PREFIX = "enc:1:";
const KEY_HEX = (process.env.DATA_ENC_KEY || "").trim();
let KEY = null;
if (KEY_HEX) {
  try {
    const buf = Buffer.from(KEY_HEX, "hex");
    if (buf.length === 32) KEY = buf;
    else console.warn("[crypto] DATA_ENC_KEY deve ter 32 bytes (64 hex). Ignorando — dados ficarão em claro.");
  } catch {
    console.warn("[crypto] DATA_ENC_KEY inválida. Ignorando.");
  }
}

export function encryptionEnabled() { return !!KEY; }

export function encField(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  if (!KEY) return str;                     // sem chave → claro
  if (str.startsWith(PREFIX)) return str;   // já cifrado
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(str, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decField(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  if (!str.startsWith(PREFIX)) return str;  // claro (legado ou sem chave)
  if (!KEY) return str;                      // sem chave não dá pra decifrar
  try {
    const raw = Buffer.from(str.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return str; // se falhar, devolve como está (não derruba a resposta)
  }
}
