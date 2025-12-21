// api/analytics.js - VERSIÓN CORREGIDA
import crypto from "crypto";

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
function compatibleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        hash = ((hash * 33) + byte) >>> 0;
    }
    return Math.abs(hash);
}

function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    const hash = compatibleHash(toSign);
    return hash.toString(16).padStart(8, '0');
}

function verifySignature(data, receivedSignature, timestamp, nonce) {
    cleanupOldNonces();
    
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp) * 1000);
    if (timeDiff > 30000) {
        console.log("❌ Timestamp inválido:", timeDiff, "ms");
        return false;
    }
    
    if (usedNonces.has(nonce)) {
        console.log("❌ Nonce ya usado:", nonce);
        return false;
    }
    
    const expectedSignature = generateExpectedSignature(data, timestamp, nonce);
    console.log("🔐 Firma recibida:", receivedSignature);
    console.log("🔐 Firma esperada:", expectedSignature);
    
    const isValid = receivedSignature === expectedSignature;
    
    if (isValid) {
        usedNonces.set(nonce, Date.now());
    }
    
    return isValid;
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
        console.log("❌ Error decodificando:", error.message);
        return null;
    }
}

// Función para parsear body de diferentes formas
async function parseRequestBody(req) {
    return new Promise((resolve) => {
        let rawData = '';
        
        req.on('data', chunk => {
            rawData += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                // Intentar parsear como JSON
                const parsed = JSON.parse(rawData);
                resolve(parsed);
            } catch {
                // Si no es JSON, intentar como URL encoded
                try {
                    const params = new URLSearchParams(rawData);
                    const result = {};
                    for (const [key, value] of params.entries()) {
                        result[key] = value;
                    }
                    resolve(result);
                } catch {
                    // Devolver raw
                    resolve({ raw: rawData });
                }
            }
        });
    });
}

export default async function handler(req, res) {
    console.log("\n" + "=".repeat(80));
    console.log("🔍 NUEVA PETICIÓN - DEBUG COMPLETO");
    console.log("=".repeat(80));
    
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Obtener body RAW
        const rawBody = await parseRequestBody(req);
        
        console.log("📦 BODY RECIBIDO (tipo):", typeof rawBody);
        console.log("📦 BODY contenido:", rawBody);
        
        // Si es objeto con raw, extraer
        let body = rawBody;
        if (rawBody.raw && typeof rawBody.raw === 'string') {
            try {
                body = JSON.parse(rawBody.raw);
                console.log("✅ Parseado desde raw string");
            } catch (e) {
                console.log("❌ No se pudo parsear como JSON:", e.message);
            }
        }
        
        console.log("\n🔍 CAMPOS DISPONIBLES:", Object.keys(body));
        
        // Verificar si tiene los campos necesarios
        const hasAllFields = ['p', 's', 'n', 't', 'v', 'c'].every(field => body[field] !== undefined);
        
        if (!hasAllFields) {
            console.log("❌ FALTAN CAMPOS:");
            const missing = ['p', 's', 'n', 't', 'v', 'c'].filter(field => !body[field]);
            console.log("   Missing:", missing);
            
            // Verificar nombres alternativos
            console.log("\n🔍 BUSCANDO CAMPOS ALTERNATIVOS:");
            const altNames = {
                'payload': 'p',
                'signature': 's', 
                'nonce': 'n',
                'timestamp': 't',
                'version': 'v',
                'client': 'c',
                'client_id': 'c',
                'cid': 'c'
            };
            
            for (const [altName, stdName] of Object.entries(altNames)) {
                if (body[altName] && !body[stdName]) {
                    console.log(`   ${altName} -> ${stdName}: ${body[altName]}`);
                    body[stdName] = body[altName];
                }
            }
            
            // Verificar nuevamente
            const stillMissing = ['p', 's', 'n', 't', 'v', 'c'].filter(field => !body[field]);
            if (stillMissing.length > 0) {
                return res.status(400).json({ 
                    error: 'Campos faltantes',
                    missing: stillMissing,
                    received: Object.keys(body)
                });
            }
        }
        
        console.log("\n✅ TODOS LOS CAMPOS PRESENTES");
        console.log("   p (payload):", body.p ? body.p.substring(0, 50) + "..." : "NO");
        console.log("   s (signature):", body.s);
        console.log("   n (nonce):", body.n);
        console.log("   t (timestamp):", body.t);
        console.log("   v (version):", body.v);
        console.log("   c (client):", body.c);
        
        // Verificar versión y cliente
        if (body.v !== VERSION) {
            return res.status(400).json({ 
                error: 'Versión incorrecta',
                expected: VERSION,
                received: body.v
            });
        }
        
        if (body.c !== CLIENT_ID) {
            return res.status(401).json({ 
                error: 'Cliente no autorizado',
                expected: CLIENT_ID,
                received: body.c
            });
        }
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ 
                error: 'Firma inválida',
                received: body.s
            });
        }
        
        console.log("✅ FIRMA VÁLIDA");
        
        // Decodificar
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        console.log("📊 Datos decodificados:", decoded);
        
        // Extraer datos del brainrot
        let brainrotData = decoded.d?.brainrot_data || decoded.data || decoded;
        
        if (!brainrotData.animal || !brainrotData.value) {
            return res.status(400).json({ error: 'Datos de brainrot incompletos' });
        }
        
        console.log("\n🎯 BRAINROT:", brainrotData.animal, "- Valor:", brainrotData.value);
        
        // Enviar a Discord si hay webhook
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhook) {
            const embed = {
                title: brainrotData.title || `Brainrot encontrado! (${brainrotData.value})`,
                description: `**${brainrotData.animal}** - ${brainrotData.rarity || "Desconocido"}`,
                color: brainrotData.value >= 300 ? 16711680 : 16763904,
                fields: [
                    { name: '🧬 Generación', value: `\`\`\`${brainrotData.generation || "?"}\`\`\``, inline: true },
                    { name: '📊 Valor', value: `\`\`\`${Number(brainrotData.value).toLocaleString()}\`\`\``, inline: true },
                    { name: '👥 Jugadores', value: `\`\`\`${brainrotData.players || 0}/8\`\`\``, inline: true }
                ],
                footer: { text: `zl an • ${new Date().toLocaleDateString()}` },
                timestamp: new Date().toISOString()
            };
            
            if (brainrotData.image_url) {
                embed.thumbnail = { url: brainrotData.image_url };
            }
            
            try {
                await fetch(discordWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                });
                console.log("✅ Enviado a Discord");
            } catch (err) {
                console.log("⚠️ Error Discord:", err.message);
            }
        }
        
        // Responder éxito
        return res.status(200).json({ 
            success: true,
            message: "Procesado correctamente",
            animal: brainrotData.animal,
            value: brainrotData.value
        });
        
    } catch (error) {
        console.error("🔥 ERROR:", error);
        return res.status(500).json({ 
            error: "Error interno",
            message: error.message
        });
    }
}
