// api/ozi.js - Versión ultra simple con expiración
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET - Devolver todos los brainrots activos (no expirados)
    if (req.method === 'GET') {
        // Limpiar expirados antes de devolver
        if (global.brainrotHistory) {
            const now = Date.now();
            global.brainrotHistory = global.brainrotHistory.filter(item => {
                return (now - item.timestamp) < 30000; // 30 segundos
            });
        }
        
        return res.status(200).json(global.brainrotHistory || []);
    }

    // POST - Recibir nuevo brainrot
    if (req.method === 'POST') {
        try {
            const body = req.body;
            
            // Validación mínima
            if (!body?.name || !body?.jobid || !body?.generation || !body?.rarity) {
                return res.status(400).json({ error: 'Faltan datos' });
            }

            const brainrot = {
                name: body.name,
                jobid: body.jobid,
                generation: body.generation,
                rarity: body.rarity,
                value: body.value || 0,
                timestamp: Date.now() // Guardamos timestamp en milisegundos
            };

            // Inicializar si no existe
            if (!global.brainrotHistory) global.brainrotHistory = [];
            
            // Limpiar expirados antes de agregar nuevo
            const now = Date.now();
            global.brainrotHistory = global.brainrotHistory.filter(item => {
                return (now - item.timestamp) < 30000; // 30 segundos
            });
            
            // Agregar nuevo y mantener últimos 50
            global.brainrotHistory.unshift(brainrot);
            if (global.brainrotHistory.length > 50) global.brainrotHistory.pop();

            return res.status(200).json({ success: true, data: brainrot });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
