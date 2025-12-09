// api/send.js - VERSIÓN SEGURA
import crypto from "crypto";

// Configuración de seguridad
const API_TOKEN = process.env.API_TOKEN; // Token secreto
const API_SIGNATURE_KEY = process.env.API_SIGNATURE_KEY; // Clave para firma HMAC
const MAX_AGE_MS = 1000 * 60 * 5; // 5 minutos máximo

export default async function handler(req, res) {
  console.log("🔐 Nueva petición recibida");
  
  try {
    // 1. Solo métodos POST
    if (req.method !== "POST") {
      console.log("❌ Método no permitido:", req.method);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 2. Verificar token de autorización (Obligatorio)
    const authHeader = req.headers.authorization || "";
    const expectedToken = `Bearer ${API_TOKEN}`;
    
    console.log("🔑 Token recibido:", authHeader.substring(0, 20) + "...");
    console.log("🔑 Token esperado:", expectedToken.substring(0, 20) + "...");
    
    if (authHeader !== expectedToken) {
      console.log("❌ Token incorrecto o faltante");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 3. Verificar timestamp para prevenir replay attacks
    const timestamp = req.headers["x-timestamp"];
    if (!timestamp) {
      console.log("❌ Falta timestamp");
      return res.status(400).json({ error: "Missing timestamp" });
    }

    const now = Date.now();
    const requestTime = parseInt(timestamp);
    
    console.log("⏰ Timestamp recibido:", timestamp);
    console.log("⏰ Tiempo actual:", now);
    console.log("⏰ Diferencia:", Math.abs(now - requestTime), "ms");
    
    if (Math.abs(now - requestTime) > MAX_AGE_MS) {
      console.log("❌ Timestamp muy viejo o futuro");
      return res.status(400).json({ error: "Stale request" });
    }

    // 4. Verificar firma HMAC (Protección contra manipulación)
    const signature = req.headers["x-signature"];
    if (!signature) {
      console.log("❌ Falta firma HMAC");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Crear string para firmar: timestamp + cuerpo
    const rawBody = JSON.stringify(req.body || {});
    const message = timestamp + "." + rawBody;
    
    // Calcular HMAC SHA256
    const hmac = crypto.createHmac("sha256", API_SIGNATURE_KEY);
    hmac.update(message);
    const expectedSignature = hmac.digest("hex");
    
    console.log("✍️ Firma recibida:", signature.substring(0, 20) + "...");
    console.log("✍️ Firma esperada:", expectedSignature.substring(0, 20) + "...");
    
    // Comparación segura contra timing attacks
    const signatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!signatureValid) {
      console.log("❌ Firma HMAC inválida");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 5. Verificar que el cuerpo tenga la estructura esperada
    if (!req.body || !req.body.embed) {
      console.log("❌ Estructura del cuerpo inválida");
      return res.status(400).json({ error: "Invalid body structure" });
    }

    // 6. Verificar que viene de Roblox (User-Agent opcional)
    const userAgent = req.headers["user-agent"] || "";
    const isRobloxRequest = userAgent.toLowerCase().includes("roblox") || 
                           userAgent.toLowerCase().includes("syn") ||
                           userAgent === "";
    
    if (!isRobloxRequest) {
      console.log("⚠️ User-Agent inusual:", userAgent);
      // No rechazamos, solo registramos (la seguridad ya está en HMAC)
    }

    console.log("✅ Todas las verificaciones pasadas");
    console.log("📦 Embed recibido:", JSON.stringify(req.body.embed, null, 2));

    // 7. Enviar a Discord
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (!discordWebhook) {
      console.log("❌ Webhook de Discord no configurado");
      return res.status(500).json({ error: "Discord webhook not configured" });
    }

    const discordPayload = {
      embeds: [req.body.embed],
      username: "ZL Finder", // Nombre fijo en Discord
      avatar_url: "https://i.imgur.com/4M34hi2.png" // Avatar fijo
    };

    console.log("📤 Enviando a Discord...");
    const discordResponse = await fetch(discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload)
    });

    console.log("✅ Discord response:", discordResponse.status);
    
    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.log("❌ Error de Discord:", errorText);
      return res.status(500).json({ error: "Discord webhook error" });
    }

    console.log("🎉 Mensaje enviado exitosamente a Discord");
    return res.status(200).json({ 
      success: true, 
      message: "Sent to Discord",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("🔥 Error crítico en la API:", error.message);
    return res.status(500).json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}
