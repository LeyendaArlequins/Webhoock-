import crypto from "crypto";

export default async function handler(req, res) {
    // =========================
    // CORS
    // =========================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action;

    // memoria (funciona porque todo pasa por ESTE endpoint)
    if (!global.brainrotHistory) global.brainrotHistory = [];

    const now = Date.now();

    // limpiar expirados
    global.brainrotHistory = global.brainrotHistory.filter(
        x => (now - x.timestamp) < 30000
    );

    // =========================
    // 📥 AGREGAR (POST ?action=add)
    // =========================
    if (req.method === "POST" && action === "add") {
        try {
            const body = req.body;

            if (!body?.name || !body?.jobid) {
                return res.status(400).json({ error: "Faltan datos" });
            }

            const item = {
                id: crypto.randomUUID(), // ID público
                jobid: body.jobid,       // 🔴 privado
                name: body.name,
                generation: body.generation,
                rarity: body.rarity,
                value: body.value || 0,
                timestamp: now
            };

            global.brainrotHistory.unshift(item);

            // limitar a 50
            if (global.brainrotHistory.length > 50) {
                global.brainrotHistory.pop();
            }

            return res.status(200).json({ success: true });

        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // =========================
    // 📤 LISTA (GET ?action=list)
    // =========================
    if (req.method === "GET" && action === "list") {
        const safe = global.brainrotHistory.map(x => ({
            id: x.id,
            name: x.name,
            generation: x.generation,
            rarity: x.rarity,
            value: x.value
        }));

        return res.status(200).json(safe);
    }

    // =========================
    // 🔐 JOIN (POST ?action=join)
    // =========================
    if (req.method === "POST" && action === "join") {
        try {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ error: "Falta id" });
            }

            const item = global.brainrotHistory.find(x => x.id === id);

            if (!item) {
                return res.status(404).json({ error: "No encontrado" });
            }

            // 🔥 devolvemos directo el jobid (rápido)
            return res.status(200).json({
                jobid: item.jobid
            });

        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(400).json({ error: "Ruta inválida" });
}
