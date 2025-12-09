// api/send.js
import crypto from "crypto";

const ALLOWED_AGENTS = ["roblox", "robloxstudio", "sys", "http", "https"];
const MAX_AGE_MS = 1000 * 60 * 5; // 5 minutos

export default async function handler(req, res) {
  try {
    // 1. Solo métodos POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const ua = (req.headers["user-agent"] || "").toLowerCase();

    // 2. Bloqueo total a navegadores (Chrome, Firefox, Safari, etc.)
    if (!ALLOWED_AGENTS.some(agent => ua.includes(agent))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // 3. Verificación de token "Bearer <TOKEN>"
    const auth = req.headers.authorization || "";
    const EXPECTED = `Bearer ${process.env.API_TOKEN}`;
    if (auth !== EXPECTED) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 4. Verificación de firma HMAC Anti-manipulación
    const timestamp = req.headers["x-timestamp"];
    const signature = req.headers["x-signature"];
    const now = Date.now();

    // Checar timestamp válido
    if (!timestamp || Math.abs(now - Number(timestamp)) > MAX_AGE_MS) {
      return res.status(400).json({ error: "Stale request" });
    }

    const rawBody = JSON.stringify(req.body || {});
    const hmac = crypto.createHmac("sha256", process.env.API_SECRET);
    hmac.update(timestamp + "." + rawBody);
    const expectedSig = hmac.digest("hex");

    if (
      !signature ||
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 5. Enviar a Discord (webhook oculto)
    const payload = {
      embeds: [req.body.embed]
    };

    const r = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      return res.status(500).json({ error: "Webhook error" });
    }

    // 6. Sin retorno de información sensible
    return res.status(200).json({ ok: true });

  } catch (err) {
    // Log mínimo
    console.error("Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
