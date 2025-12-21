// api/analytics.js - VERSIÓN CORREGIDA
import crypto from "crypto";

// Clave secreta (DEBE COINCIDIR con la del script)
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";

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

// Función de hash SIMPLE Y COMPATIBLE
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + byte;
        hash = hash & hash; // Convertir a 32-bit
    }
    return Math.abs(hash);
}

// Generar firma COMPATIBLE
function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    const hash = simpleHash(toSign);
    return hash.toString(16).padStart(8, '0');
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
    console.log("🔐 Coinciden?", receivedSignature === expectedSignature);
    
    if (receivedSignature === expectedSignature) {
        usedNonces.set(nonce, Date.now());
        return true;
    }
    
    return false;
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
    console.log("\n" + "=".repeat(80));
    console.log("🔐 Petición recibida");
    console.log("=".repeat(80));
    
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Obtener body
        let rawBody = req.body;
        
        if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
            rawBody = JSON.stringify(rawBody);
        }
        
        console.log("📦 Body recibido (primeros 500 chars):", 
                   String(rawBody).substring(0, Math.min(500, String(rawBody).length)));
        
        // Parsear JSON
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch {
            console.log("⚠️ Body no es JSON válido, usando raw");
            body = { raw: rawBody };
        }
        
        console.log("📊 Body parseado:", body);
        
        // Verificar campos
        if (!body || !body.p || !body.s || !body.n || !body.t || !body.v || !body.c) {
            console.log("❌ Campos faltantes");
            return res.status(400).json({ 
                error: 'Campos requeridos faltantes',
                required: ['p', 's', 'n', 't', 'v', 'c']
            });
        }
        
        // Verificar versión y cliente
        if (body.v !== "2.0") {
            return res.status(400).json({ error: 'Versión incorrecta' });
        }
        
        if (body.c !== "ice_scanner_pro") {
            return res.status(401).json({ error: 'Cliente no autorizado' });
        }
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ error: 'Firma inválida' });
        }
        
        console.log("✅ Firma válida");
        
        // Decodificar payload
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        console.log("📊 Payload decodificado:", decoded);
        
        // Extraer datos
        let brainrotData;
        if (decoded.data) {
            brainrotData = decoded.data;
        } else if (decoded.d && decoded.d.brainrot_data) {
            brainrotData = decoded.d.brainrot_data;
        } else {
            brainrotData = decoded;
        }
        
        console.log("🎯 Brainrot data:", brainrotData);
        
        // Crear embed de Discord
        const embed = {
            title: brainrotData.title || "Brainrot encontrado",
            description: `**${brainrotData.animal || "Desconocido"}** - ${brainrotData.rarity || "Desconocido"}`,
            color: (brainrotData.value || 0) >= 300 ? 16711680 : 16763904,
            fields: [
                { name: '🧬 Generación', value: `\`\`\`${brainrotData.generation || "?"}\`\`\``, inline: true },
                { name: '📊 Valor', value: `\`\`\`${Number(brainrotData.value || 0).toLocaleString()}\`\`\``, inline: true },
                { name: '👥 Jugadores', value: `\`\`\`${brainrotData.players || 0}/8\`\`\``, inline: true },
                { name: '📍 Plot', value: brainrotData.plot || "Desconocido", inline: false }
            ],
            footer: { text: `zl an • ${new Date().toLocaleDateString()}` },
            timestamp: new Date().toISOString()
        };
        
        if (brainrotData.server_id) {
            embed.fields.push({ name: '🆔 Server ID', value: `\`\`\`${brainrotData.server_id}\`\`\``, inline: false });
        }
        
        if (brainrotData.image_url) {
            embed.thumbnail = { url: brainrotData.image_url };
        }
        
        // Enviar a Discord
        const webhook = process.env.DISCORD_WEBHOOK_URL;
        if (webhook) {
            try {
                await fetch(webhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
            message: "Procesado",
            animal: brainrotData.animal,
            value: brainrotData.value
        });
        
    } catch (error) {
        console.error("🔥 Error:", error);
        return res.status(500).json({ error: "Error interno" });
    }
}
