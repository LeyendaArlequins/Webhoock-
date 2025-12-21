// api/analytics.js - API CORREGIDA para Vercel
import crypto from "crypto";

// Clave secreta (DEBE COINCIDIR con la del script)
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";

// Almacén de nonces usados
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

// Función FNV hash SIMPLIFICADA y COMPATIBLE
function fnv32aHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        hash = hash ^ byte;
        hash = Math.imul(hash, 16777619); // Multiplicación de 32-bit
    }
    return hash >>> 0; // Convertir a unsigned
}

// Generar firma esperada
function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    let hash = fnv32aHash(toSign);
    let hex = hash.toString(16).padStart(8, '0');
    
    const toSign2 = hex + ":" + SECRET_KEY;
    let hash2 = fnv32aHash(toSign2);
    
    return hash2.toString(16).padStart(8, '0');
}

// Verificar firma
function verifySignature(data, receivedSignature, timestamp, nonce) {
    cleanupOldNonces();
    
    // Verificar timestamp
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp) * 1000);
    if (timeDiff > 30000) {
        console.log("❌ Timestamp inválido:", timeDiff, "ms");
        return false;
    }
    
    // Verificar nonce
    if (usedNonces.has(nonce)) {
        console.log("❌ Nonce ya usado:", nonce);
        return false;
    }
    
    // Generar firma esperada
    const expectedSignature = generateExpectedSignature(data, timestamp, nonce);
    console.log("🔐 Firma recibida:", receivedSignature);
    console.log("🔐 Firma esperada:", expectedSignature);
    
    // Comparar
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
        console.log("📄 Encoded (primeros 300 chars):", encoded.substring(0, 300));
        return null;
    }
}

// Handler principal
export default async function handler(req, res) {
    console.log("\n" + "=".repeat(80));
    console.log("🔐 Petición recibida - DEBUG MODE");
    console.log("=".repeat(80));
    
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-ID, X-Protocol-Version');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        console.log("✅ Preflight request handled");
        return res.status(200).end();
    }
    
    // Solo POST
    if (req.method !== 'POST') {
        console.log("❌ Método no permitido:", req.method);
        return res.status(405).json({ 
            success: false, 
            error: 'Método no permitido' 
        });
    }
    
    try {
        // LOG DETALLADO
        console.log("📋 Headers recibidos:");
        console.log("  Content-Type:", req.headers['content-type']);
        console.log("  User-Agent:", req.headers['user-agent']);
        console.log("  X-Client-ID:", req.headers['x-client-id']);
        console.log("  X-Protocol-Version:", req.headers['x-protocol-version']);
        
        // Obtener body como string (Vercel puede darlo como objeto o string)
        let rawBody = '';
        
        if (typeof req.body === 'string') {
            rawBody = req.body;
            console.log("📦 Body es string, longitud:", rawBody.length);
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
            console.log("📦 Body es Buffer, convertido a string");
        } else if (typeof req.body === 'object' && req.body !== null) {
            rawBody = JSON.stringify(req.body);
            console.log("📦 Body es objeto, convertido a JSON string");
        } else {
            console.log("📦 Body es de tipo:", typeof req.body);
            rawBody = String(req.body || '');
        }
        
        console.log("📄 Body raw (primeros 1000 chars):");
        console.log(rawBody.substring(0, Math.min(1000, rawBody.length)));
        
        // Intentar parsear como JSON
        let body;
        try {
            body = JSON.parse(rawBody);
            console.log("✅ JSON parseado correctamente");
        } catch (parseError) {
            console.log("❌ Error parseando JSON:", parseError.message);
            console.log("📄 Raw body que falló:", rawBody.substring(0, 500));
            
            // Intentar como texto plano
            body = { raw: rawBody };
            console.log("⚠️ Tratando body como texto plano");
        }
        
        // Verificar campos requeridos
        if (!body || (!body.p && !body.payload)) {
            console.log("❌ No hay datos válidos en el body");
            console.log("📊 Body recibido:", body);
            return res.status(400).json({ 
                success: false, 
                error: 'Datos inválidos',
                received: body
            });
        }
        
        // Normalizar nombres de campos (aceptar 'payload' o 'p')
        const payload = body.p || body.payload;
        const signature = body.s || body.signature;
        const nonce = body.n || body.nonce;
        const timestamp = body.t || body.timestamp;
        const version = body.v || body.version;
        const clientId = body.c || body.client_id || body.cid;
        
        console.log("\n🔍 Campos normalizados:");
        console.log("  Payload (p):", payload ? payload.substring(0, 100) + "..." : "NO");
        console.log("  Signature (s):", signature);
        console.log("  Nonce (n):", nonce);
        console.log("  Timestamp (t):", timestamp);
        console.log("  Version (v):", version);
        console.log("  Client ID (c):", clientId);
        
        // Verificar campos requeridos
        if (!payload || !signature || !nonce || !timestamp || !version || !clientId) {
            const missing = [];
            if (!payload) missing.push('payload');
            if (!signature) missing.push('signature');
            if (!nonce) missing.push('nonce');
            if (!timestamp) missing.push('timestamp');
            if (!version) missing.push('version');
            if (!clientId) missing.push('clientId');
            
            console.log("❌ Campos faltantes:", missing);
            return res.status(400).json({ 
                success: false, 
                error: 'Campos requeridos faltantes',
                missing: missing
            });
        }
        
        // Verificar versión
        if (version !== "2.0") {
            console.log("❌ Versión incorrecta:", version);
            return res.status(400).json({ 
                success: false, 
                error: 'Versión de protocolo no compatible',
                expected: "2.0",
                received: version
            });
        }
        
        // Verificar cliente
        if (clientId !== "ice_scanner_pro") {
            console.log("❌ Cliente no autorizado:", clientId);
            return res.status(401).json({ 
                success: false, 
                error: 'Cliente no autorizado' 
            });
        }
        
        console.log("\n🔐 Verificando firma...");
        const isValid = verifySignature(payload, signature, timestamp, nonce);
        
        if (!isValid) {
            console.log("❌ Firma inválida");
            return res.status(401).json({ 
                success: false, 
                error: 'Firma inválida' 
            });
        }
        
        console.log("✅ Firma verificada correctamente");
        
        // Decodificar payload
        console.log("\n🔍 Decodificando payload...");
        const decodedPayload = decodeRobloxData(payload);
        
        if (!decodedPayload) {
            console.log("❌ No se pudo decodificar el payload");
            return res.status(400).json({ 
                success: false, 
                error: 'Payload inválido' 
            });
        }
        
        console.log("📊 Payload decodificado:");
        console.log(JSON.stringify(decodedPayload, null, 2));
        
        // Extraer datos (con estructura flexible)
        let brainrotData;
        
        if (decodedPayload.d && decodedPayload.d.brainrot_data) {
            brainrotData = decodedPayload.d.brainrot_data;
            console.log("✅ Datos extraídos de brainrot_data");
        } else if (decodedPayload.data) {
            brainrotData = decodedPayload.data;
            console.log("✅ Datos extraídos de data");
        } else if (decodedPayload.brainrot_data) {
            brainrotData = decodedPayload.brainrot_data;
            console.log("✅ Datos extraídos directamente");
        } else {
            console.log("❌ No se encontraron datos del brainrot");
            console.log("📊 Estructura disponible:", Object.keys(decodedPayload));
            return res.status(400).json({ 
                success: false, 
                error: 'Estructura de datos inválida' 
            });
        }
        
        console.log("\n🎯 BRAINROT DETECTADO:");
        console.log("  🏷️  Animal:", brainrotData.animal || "No disponible");
        console.log("  💰 Valor:", brainrotData.value || 0);
        console.log("  🧬 Generación:", brainrotData.generation || "No disponible");
        console.log("  ⭐ Rareza:", brainrotData.rarity || "No disponible");
        console.log("  📍 Plot:", brainrotData.plot || "No disponible");
        console.log("  👥 Jugadores:", brainrotData.players || 0);
        console.log("  🆔 Server ID:", brainrotData.server_id || "No disponible");
        console.log("  🖼️  Imagen:", brainrotData.image_url || "No disponible");
        console.log("  📅 Timestamp:", brainrotData.timestamp || "No disponible");
        
        // Crear embed de Discord (con valores por defecto)
        const embedColor = (brainrotData.value || 0) >= 300 ? 16711680 : 16763904;
        
        const discordEmbed = {
            title: brainrotData.title || `Brainrot encontrado! (${brainrotData.value || 0})`,
            description: `**${brainrotData.animal || "Desconocido"}** - ${brainrotData.rarity || "Desconocido"}`,
            color: embedColor,
            fields: [
                {
                    name: '🧬 Generación',
                    value: `\`\`\`${brainrotData.generation || "Desconocido"}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Valor',
                    value: `\`\`\`${Number(brainrotData.value || 0).toLocaleString()}\`\`\``,
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
                }
            ],
            footer: {
                text: `zl an • ${new Date().toLocaleDateString()}`
            },
            timestamp: new Date().toISOString()
        };
        
        // Añadir server ID si está disponible
        if (brainrotData.server_id) {
            discordEmbed.fields.push({
                name: '🆔 Server ID',
                value: `\`\`\`${brainrotData.server_id}\`\`\``,
                inline: false
            });
        }
        
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
                
                if ((brainrotData.value || 0) >= 1000) {
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
            message: "Reporte procesado exitosamente",
            processed: {
                animal: brainrotData.animal || "Desconocido",
                value: brainrotData.value || 0,
                server_id: brainrotData.server_id || "No disponible",
                timestamp: new Date().toISOString()
            }
        };
        
        console.log("\n✅ Respondiendo éxito:", JSON.stringify(responseData, null, 2));
        console.log("=".repeat(80));
        
        return res.status(200).json(responseData);
        
    } catch (error) {
        console.error("🔥 ERROR CRÍTICO:");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("=".repeat(80));
        
        return res.status(500).json({ 
            success: false,
            error: "Error interno del servidor",
            message: error.message
        });
    }
}
