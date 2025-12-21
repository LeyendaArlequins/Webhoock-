// api/analytics.js - API COMPATIBLE Y SEGURA
import crypto from "crypto";

// Clave secreta (DEBE COINCIDIR con la del script)
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";

// Almacén de nonces usados (previene replay attacks)
const usedNonces = new Map();
const NONCE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// Limpiar nonces antiguos
function cleanupOldNonces() {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (now - timestamp > NONCE_TIMEOUT) {
            usedNonces.delete(nonce);
        }
    }
}

// Función FNV hash (debe coincidir con el script)
function fnv32aHash(str) {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        hash ^= byte;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        hash = hash >>> 0; // Convertir a unsigned 32-bit
    }
    return hash;
}

// Generar firma esperada (debe coincidir con el script)
function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    
    // Primer hash FNV
    let hash = fnv32aHash(toSign);
    let hex = hash.toString(16).padStart(8, '0');
    
    // Segundo hash
    const toSign2 = hex + ":" + SECRET_KEY;
    let hash2 = fnv32aHash(toSign2);
    
    return hash2.toString(16).padStart(8, '0');
}

// Verificar firma
function verifySignature(data, receivedSignature, timestamp, nonce) {
    // 1. Verificar timestamp (no más de 30 segundos)
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp) * 1000);
    if (timeDiff > 30000) {
        console.log("❌ Timestamp inválido:", timeDiff, "ms de diferencia");
        return false;
    }
    
    // 2. Verificar nonce (prevenir replay)
    if (usedNonces.has(nonce)) {
        console.log("❌ Nonce ya usado:", nonce);
        return false;
    }
    
    // 3. Generar firma esperada
    const expectedSignature = generateExpectedSignature(data, timestamp, nonce);
    
    // 4. Comparar en tiempo constante (previene timing attacks)
    let match = true;
    if (receivedSignature.length !== expectedSignature.length) {
        match = false;
    } else {
        for (let i = 0; i < receivedSignature.length; i++) {
            if (receivedSignature.charCodeAt(i) !== expectedSignature.charCodeAt(i)) {
                match = false;
            }
        }
    }
    
    if (match) {
        // Marcar nonce como usado
        usedNonces.set(nonce, Date.now());
        cleanupOldNonces();
    }
    
    return match;
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

export default async function handler(req, res) {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 Petición segura recibida");
    console.log("=".repeat(60));
    
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, X-Protocol-Version, X-Request-Time');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Método no permitido' 
        });
    }
    
    try {
        // Verificar Content-Type
        if (!req.headers['content-type']?.includes('application/json')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Content-Type debe ser application/json' 
            });
        }
        
        // Parsear body
        const body = req.body;
        console.log("📦 Body recibido:", JSON.stringify(body).substring(0, 500) + "...");
        
        // Verificar campos requeridos
        if (!body.p || !body.s || !body.n || !body.t || !body.v || !body.c) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campos requeridos faltantes',
                required: ['p', 's', 'n', 't', 'v', 'c']
            });
        }
        
        // Verificar versión del protocolo
        if (body.v !== "2.0") {
            return res.status(400).json({ 
                success: false, 
                error: 'Versión de protocolo no compatible',
                expected: "2.0",
                received: body.v
            });
        }
        
        // Verificar cliente ID
        if (body.c !== "ice_scanner_pro") {
            return res.status(401).json({ 
                success: false, 
                error: 'Cliente no autorizado' 
            });
        }
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ 
                success: false, 
                error: 'Firma inválida' 
            });
        }
        
        console.log("✅ Firma verificada correctamente");
        
        // Decodificar payload
        const decodedPayload = decodeRobloxData(body.p);
        if (!decodedPayload) {
            return res.status(400).json({ 
                success: false, 
                error: 'Payload inválido' 
            });
        }
        
        console.log("📊 Payload decodificado:", JSON.stringify(decodedPayload, null, 2));
        
        // Verificar estructura del payload
        if (!decodedPayload.d || !decodedPayload.d.brainrot_data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Estructura de datos inválida' 
            });
        }
        
        // Extraer datos
        const brainrotData = decodedPayload.d.brainrot_data;
        const gameContext = decodedPayload.d.game_context || {};
        
        console.log("\n🎯 BRAINROT DETECTADO:");
        console.log("  🏷️  Animal:", brainrotData.animal);
        console.log("  💰 Valor:", brainrotData.value);
        console.log("  🧬 Generación:", brainrotData.generation);
        console.log("  🆔 Server ID:", brainrotData.server_id);
        console.log("  🖼️  Imagen:", brainrotData.image_url || "No disponible");
        
        // Crear embed de Discord
        const embedColor = brainrotData.value >= 300 ? 16711680 : 16763904;
        
        const discordEmbed = {
            title: brainrotData.title || `Brainrot encontrado! (${brainrotData.value})`,
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
                    value: `\`\`\`${brainrotData.players || 0}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Ubicación',
                    value: brainrotData.plot || "Desconocido",
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${brainrotData.server_id}\`\`\``,
                    inline: false
                }
            ],
            footer: {
                text: `zl an • ${new Date().toLocaleDateString()}`
            },
            timestamp: new Date().toISOString()
        };
        
        // Añadir imagen si está disponible
        if (brainrotData.image_url) {
            discordEmbed.thumbnail = { url: brainrotData.image_url };
            console.log("🖼️ Imagen añadida al embed");
        }
        
        // Añadir link de unirse si está disponible
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
                
                if (brainrotData.value >= 1000) {
                    discordPayload.content = "@here 🚨 **HIGH VALUE DETECTED!** 🚨";
                }
                
                console.log("📤 Enviando a Discord...");
                const discordResponse = await fetch(discordWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(discordPayload)
                });
                
                console.log("✅ Discord status:", discordResponse.status);
                
            } catch (discordError) {
                console.log("⚠️ Error enviando a Discord:", discordError.message);
            }
        } else {
            console.log("⚠️ DISCORD_WEBHOOK_URL no configurada");
        }
        
        // Responder éxito
        return res.status(200).json({ 
            success: true,
            message: "Reporte procesado exitosamente",
            processed: {
                animal: brainrotData.animal,
                value: brainrotData.value,
                server_id: brainrotData.server_id,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error("🔥 Error crítico:", error);
        return res.status(500).json({ 
            success: false,
            error: "Error interno del servidor",
            message: error.message
        });
    }
}
