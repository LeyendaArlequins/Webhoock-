const REQUIRED_KEY = "MI_CLAVE_SECRETA";

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 🔐 Validar header
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== REQUIRED_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    // === GET ===
    if (req.method === 'GET') {
        if (global.brainrotHistory) {
            const now = Date.now();
            global.brainrotHistory = global.brainrotHistory.filter(item => {
                return (now - item.timestamp) < 30000;
            });
        }

        return res.status(200).json(global.brainrotHistory || []);
    }

    // === POST ===
    if (req.method === 'POST') {
        try {
            const body = req.body;

            if (!body?.name || !body?.jobid || !body?.generation || !body?.rarity) {
                return res.status(400).json({ error: 'Faltan datos' });
            }

            const brainrot = {
                name: body.name,
                jobid: body.jobid,
                generation: body.generation,
                rarity: body.rarity,
                value: body.value || 0,
                timestamp: Date.now()
            };

            if (!global.brainrotHistory) global.brainrotHistory = [];

            const now = Date.now();
            global.brainrotHistory = global.brainrotHistory.filter(item => {
                return (now - item.timestamp) < 30000;
            });

            global.brainrotHistory.unshift(brainrot);
            if (global.brainrotHistory.length > 50) {
                global.brainrotHistory.pop();
            }

            return res.status(200).json({ success: true, data: brainrot });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
