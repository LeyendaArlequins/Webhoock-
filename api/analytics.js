// api/analytics.js - API FINAL COMPLETA
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";
const CLIENT_ID = "ice_scanner_pro";
const VERSION = "2.0";

// Almacén de nonces
const usedNonces = new Map();
const NONCE_TIMEOUT = 5 * 60 * 1000;

function cleanupOldNonces() {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (now - timestamp > NONCE_TIMEOUT) {
            usedNonces.delete(nonce);
        }
    }
}

// Hash compatible con Lua
function luaCompatibleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash * 33) + str.charCodeAt(i)) >>> 0;
    }
    return Math.abs(hash);
}

function verifySignature(data, receivedSignature, timestamp, nonce) {
    cleanupOldNonces();
    
    // Verificar timestamp (30 segundos máximo)
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp) * 1000);
    if (timeDiff > 30000) return false;
    
    // Verificar nonce
    if (usedNonces.has(nonce)) return false;
    
    // Generar firma esperada
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    const hash = luaCompatibleHash(toSign);
    const expectedSignature = hash.toString(16).padStart(8, '0');
    
    // Comparar
    if (receivedSignature === expectedSignature) {
        usedNonces.set(nonce, Date.now());
        return true;
    }
    
    return false;
}

function decodeRobloxData(encoded) {
    try {
        let decoded = "";
        for (let i = 0; i < encoded.length; i += 3) {
            const charCode = parseInt(encoded.substr(i, 3));
            if (!isNaN(charCode)) {
                decoded += String.fromCharCode(charCode);
            }
        }
        return JSON.parse(decoded);
    } catch (error) {
        return null;
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Parsear body
        let body;
        if (typeof req.body === 'string') {
            body = JSON.parse(req.body);
        } else {
            body = req.body;
        }
        
        // Verificar campos requeridos
        if (!body.p || !body.s || !body.n || !body.t || !body.v || !body.c) {
            return res.status(400).json({ error: 'Campos requeridos faltantes' });
        }
        
        // Verificar versión y cliente
        if (body.v !== VERSION || body.c !== CLIENT_ID) {
            return res.status(401).json({ error: 'Cliente/versión no autorizado' });
        }
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ error: 'Firma inválida' });
        }
        
        // Decodificar payload
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        // Extraer datos
        const brainrotData = decoded.d?.brainrot_data || decoded.data || decoded;
        
        if (!brainrotData.animal || !brainrotData.value) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        // Crear embed de Discord
        const embedColor = brainrotData.value >= 300 ? 16711680 : 16763904;
        const isHighValue = brainrotData.value >= 1000;
        
        const discordEmbed = {
            title: brainrotData.title || (isHighValue ? "🚨 HIGH VALUE BRAINROT" : "⚠️ Brainrot encontrado"),
            description: `**${brainrotData.animal}** - ${brainrotData.rarity || "Desconocido"}`,
            color: embedColor,
            fields: [
                {
                    name: '🧬 Generación',
                    value: `\`\`\`${brainrotData.generation || "?"}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Valor',
                    value: `\`\`\`${Number(brainrotData.value).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${brainrotData.players || 0}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Ubicación',
                    value: brainrotData.plot || "Debris (Suelo)",
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${brainrotData.server_id}\`\`\``,
                    inline: false
                }
            ],
            footer: {
                text: `zl an • ${new Date().toLocaleDateString('es-ES')}`
            },
            timestamp: new Date().toISOString()
        };
        
        // Añadir imagen si está disponible
        if (brainrotData.image_url) {
            discordEmbed.thumbnail = { url: brainrotData.image_url };
        }
        
        // Añadir link de unirse
        if (brainrotData.join_link) {
            discordEmbed.fields.push({
                name: '🔗 Unirse al servidor',
                value: `[Click aquí](${brainrotData.join_link})`,
                inline: false
            });
        }
        
        // Enviar a Discord
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhook) {
            try {
                const discordPayload = {
                    embeds: [discordEmbed],
                    username: "Ice Scanner Pro",
                    avatar_url: "https://i.imgur.com/4M34hi2.png"
                };
                
                if (isHighValue) {
                    discordPayload.content = "@here 🚨 **HIGH VALUE DETECTED!** 🚨";
                }
                
                await fetch(discordWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(discordPayload)
                });
                
            } catch (discordError) {
                // Continuar aunque falle Discord
            }
        }
        
        // Responder éxito
        return res.status(200).json({ 
            success: true,
            message: "Brainrot report procesado exitosamente",
            data: {
                animal: brainrotData.animal,
                value: brainrotData.value,
                server_id: brainrotData.server_id,
                discord_sent: !!discordWebhook
            }
        });
        
    } catch (error) {
        return res.status(500).json({ 
            success: false,
            error: "Error interno del servidor"
        });
    }
}
