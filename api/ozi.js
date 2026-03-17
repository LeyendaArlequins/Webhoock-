import crypto from "crypto";

const SECRET = "super_secret_key_123"; // 🔴 cambia esto

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action;

    if (!global.store) global.store = [];
    if (!global.usedTokens) global.usedTokens = new Set();

    const now = Date.now();

    // limpiar expirados
    global.store = global.store.filter(x => (now - x.timestamp) < 30000);

    // =====================
    // ADD
    // =====================
    if (req.method === "POST" && action === "add") {
        const b = req.body;

        const item = {
            id: crypto.randomUUID(),
            jobid: b.jobid,
            name: b.name,
            value: b.value || 0,
            timestamp: now
        };

        global.store.unshift(item);
        return res.json({ success: true });
    }

    // =====================
    // LIST
    // =====================
    if (req.method === "GET" && action === "list") {
        return res.json(global.store.map(x => ({
            id: x.id,
            name: x.name,
            value: x.value
        })));
    }

    // =====================
    // TICKET
    // =====================
    if (req.method === "POST" && action === "ticket") {
        const { id } = req.body;

        const item = global.store.find(x => x.id === id);
        if (!item) return res.status(404).json({ error: "No encontrado" });

        const exp = now + 5000;

        const payload = `${id}:${exp}`;
        const sig = crypto
            .createHmac("sha256", SECRET)
            .update(payload)
            .digest("hex");

        const token = `${payload}:${sig}`;

        return res.json({ token });
    }

    // =====================
    // JOIN
    // =====================
    if (req.method === "POST" && action === "join") {
        const { token } = req.body;

        if (!token) return res.status(400).json({ error: "No token" });

        if (global.usedTokens.has(token)) {
            return res.status(403).json({ error: "Token usado" });
        }

        const parts = token.split(":");
        if (parts.length !== 3) {
            return res.status(400).json({ error: "Token inválido" });
        }

        const [id, exp, sig] = parts;

        if (Date.now() > parseInt(exp)) {
            return res.status(403).json({ error: "Expirado" });
        }

        const payload = `${id}:${exp}`;
        const validSig = crypto
            .createHmac("sha256", SECRET)
            .update(payload)
            .digest("hex");

        if (sig !== validSig) {
            return res.status(403).json({ error: "Firma inválida" });
        }

        const item = global.store.find(x => x.id === id);
        if (!item) return res.status(404).json({ error: "No encontrado" });

        global.usedTokens.add(token); // 🔥 1 solo uso

        return res.json({ jobid: item.jobid });
    }

    return res.status(400).json({ error: "Ruta inválida" });
}
