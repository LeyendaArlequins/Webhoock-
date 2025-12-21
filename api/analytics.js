// api/analytics.js - DEBUG EXTREMO DEL HASH
const SECRET_KEY = process.env.SECRET_KEY || "IceScannerV2_S3cr3tK3y_2024_!@#$%^&*()";
const CLIENT_ID = "ice_scanner_pro";
const VERSION = "2.0";

// Hash IDÉNTICO al de Lua
function debugLuaHash(str) {
    console.log("🔍 CALCULANDO HASH para string de longitud:", str.length);
    console.log("📝 Primeros 100 chars:", str.substring(0, 100));
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const byte = str.charCodeAt(i);
        const oldHash = hash;
        hash = (hash * 33) + byte;
        
        // Convertir a 32-bit unsigned (como Lua con % 0x100000000)
        if (hash > 0xFFFFFFFF) {
            hash = hash % 0x100000000;
        }
        
        // Solo mostrar primeros 10 pasos para debug
        if (i < 10) {
            console.log(`  Paso ${i}: byte=${byte} ('${String.fromCharCode(byte)}'), ` +
                       `hash=${hash} (0x${hash.toString(16)})`);
        }
    }
    
    // math.abs como en Lua
    hash = Math.abs(hash);
    console.log("🔢 Hash final:", hash);
    console.log("🔢 Hash final (hex):", hash.toString(16));
    
    return hash;
}

function verifySignatureWithDebug(data, receivedSignature, timestamp, nonce) {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 DEBUG COMPLETO DE FIRMA");
    console.log("=".repeat(60));
    
    console.log("📊 Datos recibidos:");
    console.log("  Timestamp:", timestamp);
    console.log("  Nonce:", nonce);
    console.log("  Data (primeros 100 chars):", data.substring(0, 100));
    console.log("  Firma recibida:", receivedSignature);
    
    // Construir string para hash
    const toSign = SECRET_KEY + ":" + timestamp + ":" + nonce + ":" + data;
    console.log("\n🔑 String para hash:");
    console.log("  Longitud:", toSign.length);
    console.log("  Contenido (primeros 200 chars):");
    console.log(toSign.substring(0, 200));
    
    // Calcular hash paso a paso
    console.log("\n🧮 Calculando hash...");
    const hash = debugLuaHash(toSign);
    const expectedSignature = hash.toString(16).padStart(8, '0');
    
    console.log("\n📋 RESULTADOS:");
    console.log("  Firma recibida:", receivedSignature);
    console.log("  Firma esperada:", expectedSignature);
    console.log("  ¿Coinciden?", receivedSignature === expectedSignature);
    
    if (receivedSignature !== expectedSignature) {
        console.log("\n🔍 INVESTIGANDO DIFERENCIA...");
        
        // Verificar cada parte del string
        console.log("  1. SECRET_KEY:", SECRET_KEY);
        console.log("  2. timestamp:", timestamp, "(tipo:", typeof timestamp, ")");
        console.log("  3. nonce:", nonce, "(tipo:", typeof nonce, ")");
        console.log("  4. data (longitud):", data.length);
        
        // Verificar encoding
        console.log("\n🔍 Verificando encoding de data:");
        console.log("  Primeros 10 caracteres de data como códigos:");
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const char = data[i];
            console.log(`    [${i}] '${char}' = ${char.charCodeAt(0)}`);
        }
    }
    
    console.log("=".repeat(60));
    
    return receivedSignature === expectedSignature;
}

// Resto del código igual que antes...
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
    console.log("🎯 NUEVA PETICIÓN - DEBUG HASH");
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
        if (!body.p || !body.s || !body.n || !body.t || !body.v || !body.c) {
            return res.status(400).json({ error: 'Campos faltantes' });
        }
        
        // Verificar versión y cliente
        if (body.v !== VERSION || body.c !== CLIENT_ID) {
            return res.status(400).json({ error: 'Cliente/versión incorrecta' });
        }
        
        // Verificar firma con debug
        if (!verifySignatureWithDebug(body.p, body.s, body.t, body.n)) {
            return res.status(401).json({ 
                error: 'Firma inválida',
                debug: "Revisa logs para detalles"
            });
        }
        
        console.log("🎉 FIRMA VÁLIDA!");
        
        // Decodificar y procesar...
        const decoded = decodeRobloxData(body.p);
        if (!decoded) {
            return res.status(400).json({ error: 'Payload inválido' });
        }
        
        // Enviar a Discord si hay webhook
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (discordWebhook) {
            const brainrotData = decoded.data || decoded.d?.brainrot_data || decoded;
            
            if (brainrotData.animal && brainrotData.value) {
                const embed = {
                    title: `Brainrot: ${brainrotData.animal}`,
                    description: `Valor: ${brainrotData.value}`,
                    color: 0x00ff00,
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
        }
        
        return res.status(200).json({ 
            success: true,
            message: "Firma válida - Procesado correctamente"
        });
        
    } catch (error) {
        console.error("🔥 ERROR:", error);
        return res.status(500).json({ error: "Error interno" });
    }
}
