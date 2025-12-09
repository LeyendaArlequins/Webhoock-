// api/send.js - API SEGURA COMPLETA
import crypto from "crypto";

// Configuración (debes poner estos en Vercel Environment Variables)
const CONFIG = {
    API_TOKEN: process.env.API_TOKEN || "ZL2025_SECRET_DEFAULT",
    API_SECRET: process.env.API_SECRET || "SECRET_KEY_DEFAULT_CHANGE_ME",
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK_URL,
    MAX_AGE_MS: 1000 * 60 * 5 // 5 minutos
};

// Verificar configuración
if (!CONFIG.DISCORD_WEBHOOK) {
    console.error("❌ ERROR: DISCORD_WEBHOOK_URL no configurado en Vercel");
}

export default async function handler(req, res) {
    console.log("🔐 Nueva petición a API");
    
    try {
        // 1. Solo POST
        if (req.method !== "POST") {
            console.log("❌ Método no permitido:", req.method);
            return res.status(405).json({ error: "Solo POST permitido" });
        }

        // 2. Verificar Authorization header
        const authHeader = req.headers.authorization || "";
        console.log("🔑 Auth header recibido:", authHeader.substring(0, 30) + "...");
        
        if (!authHeader.startsWith("Bearer ")) {
            console.log("❌ Formato de token incorrecto");
            return res.status(401).json({ error: "Token requerido" });
        }
        
        const token = authHeader.substring(7); // Remover "Bearer "
        if (token !== CONFIG.API_TOKEN) {
            console.log("❌ Token inválido");
            return res.status(401).json({ error: "Token inválido" });
        }
        
        console.log("✅ Token válido");

        // 3. Verificar timestamp
        const timestamp = req.headers["x-timestamp"];
        if (!timestamp) {
            console.log("❌ Timestamp faltante");
            return res.status(400).json({ error: "Timestamp requerido" });
        }
        
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        
        if (isNaN(requestTime)) {
            console.log("❌ Timestamp inválido:", timestamp);
            return res.status(400).json({ error: "Timestamp inválido" });
        }
        
        const age = Math.abs(now - requestTime);
        console.log("⏰ Timestamp recibido:", new Date(requestTime).toISOString());
        console.log("⏰ Diferencia:", age, "ms");
        
        if (age > CONFIG.MAX_AGE_MS) {
            console.log("❌ Petición expirada");
            return res.status(400).json({ error: "Petición expirada" });
        }

        // 4. Verificar firma HMAC
        const signature = req.headers["x-signature"];
        if (!signature) {
            console.log("❌ Firma faltante");
            return res.status(400).json({ error: "Firma requerida" });
        }
        
        // Calcular HMAC correcto
        const rawBody = JSON.stringify(req.body || {});
        const message = timestamp + "." + rawBody;
        
        const hmac = crypto.createHmac("sha256", CONFIG.API_SECRET);
        hmac.update(message);
        const expectedSignature = hmac.digest("hex");
        
        console.log("✍️ Firma recibida:", signature.substring(0, 20) + "...");
        console.log("✍️ Firma esperada:", expectedSignature.substring(0, 20) + "...");
        
        // Comparación segura
        if (signature !== expectedSignature) {
            console.log("❌ Firma HMAC inválida");
            return res.status(401).json({ error: "Firma inválida" });
        }
        
        console.log("✅ Firma válida");

        // 5. Verificar estructura del cuerpo
        if (!req.body || !req.body.embed) {
            console.log("❌ Estructura inválida");
            return res.status(400).json({ error: "Estructura inválida" });
        }
        
        console.log("📦 Embed recibido correctamente");

        // 6. Enviar a Discord
        if (!CONFIG.DISCORD_WEBHOOK) {
            console.log("❌ Webhook no configurado");
            return res.status(500).json({ error: "Webhook no configurado" });
        }
        
        const discordPayload = {
            embeds: [req.body.embed],
            username: "ZL Finder Bot",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            allowed_mentions: { parse: ["users", "roles"] }
        };
        
        console.log("📤 Enviando a Discord...");
        const discordResponse = await fetch(CONFIG.DISCORD_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(discordPayload)
        });
        
        console.log("✅ Discord status:", discordResponse.status);
        
        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            console.log("❌ Error de Discord:", errorText);
            return res.status(500).json({ error: "Error enviando a Discord" });
        }
        
        console.log("🎉 Mensaje enviado exitosamente");
        return res.status(200).json({ 
            success: true, 
            message: "Mensaje enviado a Discord",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("🔥 Error en API:", error);
        return res.status(500).json({ 
            error: "Error interno del servidor",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}
