// api/ozi.js
import crypto from "crypto";

const SECRET = "clave_ultra_secreta";

// ===============================
// 🔧 FUNCIONES INTERNAS
// ===============================

function limpiarExpirados() {
    const now = Date.now();
    global.brainrotHistory = (global.brainrotHistory || []).filter(
        item => (now - item.timestamp) < 30000 // 30s
    );
}

function generarToken(jobid) {
    const expires = Date.now() + 10000; // 10s

    const data = `${jobid}:${expires}`;

    const signature = crypto
        .createHmac("sha256", SECRET)
        .update(data)
        .digest("hex");

    return `${data}:${signature}`;
}

function validarToken(token) {
    try {
        const [jobid, expires, signature] = token.split(":");

        if (Date.now() > Number(expires)) return null;

        const data = `${jobid}:${expires}`;

        const validSig = crypto
            .createHmac("sha256", SECRET)
            .update(data)
            .digest("hex");

        if (signature !== validSig) return null;

        return jobid;
    } catch {
        return null;
    }
}

// ===============================
// 🚀 HANDLER PRINCIPAL
// ===============================

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!global.brainrotHistory) global.brainrotHistory = [];

    limpiarExpirados();

    const url = req.url || "";

    // ===============================
    // 📥 POST /api/ozi → GUARDAR
    // ===============================
    if (req.method === "POST" && url.includes("/api/ozi")) {
        try {
            const body = req.body;

            if (!body?.name || !body?.jobid) {
                return res.status(400).json({ error: "Faltan datos" });
            }

            const brainrot = {
                id: crypto.randomUUID(),
                jobid: body.jobid, // 🔴 SOLO servidor lo ve
                name: body.name,
                generation: body.generation,
                rarity: body.rarity,
                value: body.value || 0,
                timestamp: Date.now()
            };

            global.brainrotHistory.unshift(brainrot);

            // limitar tamaño
            if (global.brainrotHistory.length > 50) {
                global.brainrotHistory.pop();
            }

            return res.status(200).json({ success: true });

        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ===============================
    // 📤 GET /api/ozi → LISTA SEGURA
    // ===============================
    if (req.method === "GET" && url.includes("/api/ozi")) {
        const safe = global.brainrotHistory.map(item => ({
            id: item.id,
            name: item.name,
            generation: item.generation,
            rarity: item.rarity,
            value: item.value
        }));

        return res.status(200).json(safe);
    }

    // ===============================
    // 🔐 POST /api/join → TOKEN
    // ===============================
    if (req.method === "POST" && url.includes("/api/join")) {
        try {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ error: "Falta id" });
            }

            const now = Date.now();

            const item = global.brainrotHistory.find(
                x => x.id === id && (now - x.timestamp) < 30000
            );

            if (!item) {
                return res.status(404).json({ error: "No encontrado" });
            }

            const token = generarToken(item.jobid);

            return res.status(200).json({ token });

        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ===============================
    // 🧪 (OPCIONAL) VALIDAR TOKEN
    // ===============================
    if (req.method === "POST" && url.includes("/api/validate")) {
        const { token } = req.body;

        const jobid = validarToken(token);

        if (!jobid) {
            return res.status(401).json({ error: "Token inválido" });
        }

        return res.status(200).json({ jobid });
    }

    return res.status(405).json({ error: "Ruta no válida" });
}
