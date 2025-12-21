// api/analytics.js - API DE DEBUG
export default async function handler(req, res) {
    console.log("\n" + "=".repeat(80));
    console.log("🔍 DEBUG - Petición recibida");
    console.log("=".repeat(80));
    
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log("📋 METHOD:", req.method);
    console.log("📋 URL:", req.url);
    
    // HEADERS
    console.log("\n📋 HEADERS:");
    for (const [key, value] of Object.entries(req.headers)) {
        console.log(`  ${key}: ${value}`);
    }
    
    // BODY
    console.log("\n📦 BODY RAW (tipo):", typeof req.body);
    
    if (typeof req.body === 'string') {
        console.log("📦 BODY como string (primeros 1000 chars):");
        console.log(req.body.substring(0, Math.min(1000, req.body.length)));
        
        // Intentar parsear como JSON
        try {
            const parsed = JSON.parse(req.body);
            console.log("\n✅ JSON PARSEADO CORRECTAMENTE:");
            console.log(JSON.stringify(parsed, null, 2));
            
            // Verificar campos
            console.log("\n🔍 CAMPOS ENCONTRADOS:");
            const campos = ['p', 's', 'n', 't', 'v', 'c'];
            for (const campo of campos) {
                console.log(`  ${campo}: ${parsed[campo] ? "✅ PRESENTE" : "❌ AUSENTE"}`);
                if (parsed[campo]) {
                    if (campo === 'p') {
                        console.log(`    Valor (primeros 100 chars): ${String(parsed[campo]).substring(0, 100)}...`);
                    } else {
                        console.log(`    Valor: ${parsed[campo]}`);
                    }
                }
            }
            
        } catch (e) {
            console.log("❌ No es JSON válido:", e.message);
            
            // Intentar como URL encoded
            try {
                const params = new URLSearchParams(req.body);
                console.log("\n🔍 PARAMS (URL encoded):");
                for (const [key, value] of params.entries()) {
                    console.log(`  ${key}: ${value.substring(0, 100)}...`);
                }
            } catch (e2) {
                console.log("❌ Tampoco es URL encoded");
            }
        }
    } else if (typeof req.body === 'object' && req.body !== null) {
        console.log("📦 BODY como objeto:");
        console.log(JSON.stringify(req.body, null, 2));
        
        console.log("\n🔍 CAMPOS ENCONTRADOS:");
        const campos = ['p', 's', 'n', 't', 'v', 'c'];
        for (const campo of campos) {
            console.log(`  ${campo}: ${req.body[campo] ? "✅ PRESENTE" : "❌ AUSENTE"}`);
            if (req.body[campo]) {
                console.log(`    Valor: ${req.body[campo]}`);
            }
        }
    }
    
    console.log("\n" + "=".repeat(80));
    
    // Responder algo simple
    res.status(200).json({ 
        debug: true, 
        message: "Logs en consola",
        timestamp: new Date().toISOString()
    });
}
