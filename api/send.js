export default async function handler(req, res) {
  const token = req.headers.authorization;
  const EXPECTED = `Bearer ${process.env.API_TOKEN}`;

  // Si no trae el token → fuera
  if (!token || token !== EXPECTED) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Solo permitir POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Aquí procesas el embed
  const payload = {
    embeds: [req.body.embed]
  };

  // Mandar al webhook de discord
  const r = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    return res.status(500).json({ ok: false, error: "Webhook error" });
  }

  return res.status(200).json({ ok: true });
}
