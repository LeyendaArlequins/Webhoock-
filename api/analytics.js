// api/analytics.js - CON HASH CORREGIDO
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

// HASH EXACTO que usa Lua (33 como multiplicador)
function luaCompatibleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        // Exactamente como lo hace Lua: hash = (hash * 33 + byte) % 0x100000000
        hash = (hash * 33 + byte);
        // Mantener en 32-bit unsigned
        hash = hash >>> 0;
    }
    // Lua usa math.abs, pero para números positivos es lo mismo
    return Math.abs(hash);
}

function generateExpectedSignature(data, timestamp, nonce) {
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    console.log("🔐 String para firmar:", toSign.substring(0, 100) + "...");
    
    const hash = luaCompatibleHash(toSign);
    console.log("🔐 Hash calculado:", hash.toString(16));
    
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
        console.log("✅ FIRMA VÁLIDA - Nonce registrado");
    } else {
        console.log("❌ FIRMA NO COINCIDE");
        // Debug: calcular hash paso a paso
        console.log("🔍 DEBUG - Calculando hash manualmente...");
        const testStr = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
        let testHash = 0;
        for (let i = 0; i < Math.min(10, testStr.length); i++) {
            const byte = testStr.charCodeAt(i);
            testHash = (testHash * 33 + byte) >>> 0;
            console.log(`  Paso ${i}: byte=${byte}, hash=${testHash.toString(16)}`);
        }
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

async function parseRequestBody(req) {
    return new Promise((resolve) => {
        let rawData = '';
        req.on('data', chunk => rawData += chunk.toString());
        req.on('end', () => {
            try {
                resolve(JSON.parse(rawData));
            } catch {
                resolve({ raw: rawData });
            }
        });
    });
}

export default async function handler(req, res) {
    console.log("\n" + "=".repeat(80));
    console.log("🔍 PETICIÓN RECIBIDA - HASH CORREGIDO");
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
        const rawBody = await parseRequestBody(req);
        let body = rawBody.raw ? JSON.parse(rawBody.raw) : rawBody;
        
        console.log("✅ Campos recibidos:", Object.keys(body));
        
        // Verificar campos
        const required = ['p', 's', 'n', 't', 'v', 'c'];
        const missing = required.filter(f => !body[f]);
        
        if (missing.length > 0) {
            console.log("❌ Faltan:", missing);
            return res.status(400).json({ error: 'Campos faltantes', missing });
        }
        
        console.log("🔍 Datos recibidos:");
        console.log("  p:", body.p.substring(0, 50) + "...");
        console.log("  s:", body.s);
        console.log("  n:", body.n);
        console.log("  t:", body.t);
        console.log("  v:", body.v);
        console.log("  c:", body.c);
        
        if (body.v !== VERSION) {
            return res.status(400).json({ error: 'Versión incorrecta' });
        }
        
        if (body.c !== CLIENT_ID) {
            return res.status(401).json({ error: 'Cliente no autorizado' });
        }
        
        // Verificar firma
        if (!verifySignature(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ error: 'Firma inválida' });
        }
        
        console.log("🎉 FIRMA VÁLIDA - Procesando...");
        
        // Decodificar
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        const brainrotData = decoded.data || decoded.d?.brainrot_data || decoded;
        console.log("🎯 Brainrot:", brainrotData.animal, "-", brainrotData.value);
        
        // Enviar a Discord
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhook) {
            const embed = {
                title: brainrotData.title || `Brainrot (${brainrotData.value})`,
                description: `**${brainrotData.animal}** - ${brainrotData.rarity}`,
                color: brainrotData.value >= 300 ? 16711680 : 16763904,
                fields: [
                    { name: '🧬 Generación', value: `\`\`\`${brainrotData.generation}\`\`\``, inline: true },
                    { name: '📊 Valor', value: `\`\`\`${Number(brainrotData.value).toLocaleString()}\`\`\``, inline: true },
                    { name: '👥 Jugadores', value: `\`\`\`${brainrotData.players}/8\`\`\``, inline: true }
                ],
                footer: { text: `zl an • ${new Date().toLocaleDateString()}` },
                timestamp: new Date().toISOString()
            };
            
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
        
        return res.status(200).json({ 
            success: true,
            message: "Procesado",
            animal: brainrotData.animal,
            value: brainrotData.value
        });
        
    } catch (error) {
        console.error("🔥 ERROR:", error);
        return res.status(500).json({ error: "Error interno", message: error.message });
    }
}
