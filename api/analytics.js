// api/analytics.js - API COMPLETA Y SEGURA
import crypto from "crypto";

// Configuración de seguridad
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";
const CLIENT_ID = "ice_scanner_pro";
const PROTOCOL_VERSION = "2.0";

// Almacén de nonces
const usedNonces = new Map();
const NONCE_TIMEOUT = 5 * 60 * 1000;

// Limpiar nonces antiguos
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

// Generar firma esperada
function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    const hash = compatibleHash(toSign);
    return hash.toString(16).padStart(8, '0');
}

// Verificar firma
function verifySignature(data, receivedSignature, timestamp, nonce) {
    cleanupOldNonces();
    
    // Verificar timestamp (30 segundos máximo)
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp) * 1000);
    if (timeDiff > 30000) {
        console.log("❌ Timestamp inválido:", timeDiff, "ms");
        return false;
    }
    
    // Verificar nonce (prevenir replay)
    if (usedNonces.has(nonce)) {
        console.log("❌ Nonce ya usado:", nonce);
        return false;
    }
    
    // Generar firma esperada
    const expectedSignature = generateExpectedSignature(data, timestamp, nonce);
    const isValid = receivedSignature === expectedSignature;
    
    if (isValid) {
        usedNonces.set(nonce, Date.now());
    }
    
    return isValid;
}

// Decodificar datos
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

// Handler principal
export default async function handler(req, res) {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 Petición recibida");
    console.log("=".repeat(60));
    
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, X-Protocol-Version');
    
    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Parsear body
        let body = req.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
        
        console.log("📦 Campos recibidos:", Object.keys(body));
        
        // Verificar campos requeridos
        const required = ['p', 's', 'n', 't', 'v', 'c'];
        const missing = required.filter(field => !body[field]);
        
        if (missing.length > 0) {
            console.log("❌ Campos faltantes:", missing);
            return res.status(400).json({ 
                error: 'Campos requeridos faltantes',
                missing: missing
            });
        }
        
        // Verificar versión y cliente
        if (body.v !== PROTOCOL_VERSION) {
            console.log("❌ Versión incorrecta:", body.v);
            return res.status(400).json({ 
                error: 'Versión de protocolo no compatible',
                expected: PROTOCOL_VERSION,
                received: body.v
            });
        }
        
        if (body.c !== CLIENT_ID) {
            console.log("❌ Cliente no autorizado:", body.c);
            return res.status(401).json({ 
                error: 'Cliente no autorizado' 
            });
        }
        
        console.log("🔐 Verificando firma...");
        console.log("  Nonce:", body.n);
        console.log("  Timestamp:", body.t);
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            console.log("❌ Firma inválida");
            return res.status(401).json({ 
                error: 'Firma inválida' 
            });
        }
        
        console.log("✅ Firma válida");
        
        // Decodificar payload
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        // Extraer datos del brainrot
        let brainrotData;
        if (decoded.d && decoded.d.brainrot_data) {
            brainrotData = decoded.d.brainrot_data;
        } else {
            brainrotData = decoded.data || decoded;
        }
        
        console.log("\n🎯 BRAINROT ENCONTRADO:");
        console.log("  🏷️  Animal:", brainrotData.animal);
        console.log("  💰 Valor:", brainrotData.value);
        console.log("  🧬 Generación:", brainrotData.generation);
        console.log("  ⭐ Rareza:", brainrotData.rarity);
        console.log("  👥 Jugadores:", brainrotData.players);
        console.log("  🆔 Server ID:", brainrotData.server_id);
        console.log("  🖼️  Imagen:", brainrotData.image_url || "No disponible");
        
        // Crear embed de Discord
        const embedColor = brainrotData.value >= 300 ? 16711680 : 16763904;
        const isHighValue = brainrotData.value >= 1000;
        
        const discordEmbed = {
            title: brainrotData.title || (isHighValue ? "🚨 HIGH VALUE BRAINROT" : "⚠️ Brainrot encontrado"),
            description: `**${brainrotData.animal}** - ${brainrotData.rarity}`,
            color: embedColor,
            fields: [
                {
                    name: '🧬 Generación',
                    value: `\`\`\`${brainrotData.generation}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Valor',
                    value: `\`\`\`${Number(brainrotData.value).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${brainrotData.players}/8\`\`\``,
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
            console.log("🖼️ Imagen añadida al embed");
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
                
                // Mención para valores altos
                if (isHighValue) {
                    discordPayload.content = "@here 🚨 **HIGH VALUE DETECTED!** 🚨";
                }
                
                console.log("📤 Enviando a Discord...");
                const discordResponse = await fetch(discordWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(discordPayload)
                });
                
                console.log("✅ Discord status:", discordResponse.status);
                
                if (!discordResponse.ok) {
                    const errorText = await discordResponse.text();
                    console.log("❌ Discord error:", errorText);
                }
                
            } catch (discordError) {
                console.log("⚠️ Error enviando a Discord:", discordError.message);
            }
        } else {
            console.log("⚠️ DISCORD_WEBHOOK_URL no configurada");
        }
        
        // Responder éxito
        const responseData = { 
            success: true,
            message: "Brainrot report procesado exitosamente",
            data: {
                animal: brainrotData.animal,
                value: brainrotData.value,
                server_id: brainrotData.server_id,
                discord_sent: !!discordWebhook
            },
            timestamp: new Date().toISOString()
        };
        
        console.log("\n✅ Respondiendo:", responseData);
        console.log("=".repeat(60));
        
        return res.status(200).json(responseData);
        
    } catch (error) {
        console.error("🔥 Error:", error);
        return res.status(500).json({ 
            success: false,
            error: "Error interno del servidor",
            message: error.message
        });
    }
}
