// api/analytics.js - API SECRETA MEJORADA
import crypto from "crypto";

const SECRET_KEY = process.env.SECRET_KEY || "TU_CLAVE_SECRETA_CRIPT";

// Función para verificar firma
function verifySignature(data, signature) {
    try {
        // Calcular hash HMAC (debe coincidir con el del cliente)
        const hash = crypto.createHmac('sha256', SECRET_KEY)
            .update(data)
            .digest('hex');
        
        // Comparar con firma recibida (adaptado a nuestro sistema simple)
        const calculatedHash = calculateSimpleHash(data);
        return signature === calculatedHash;
    } catch (error) {
        console.log("❌ Error verificando firma:", error.message);
        return false;
    }
}

// Función para calcular hash simple (como en el cliente)
function calculateSimpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const byte = data.charCodeAt(i);
        hash = (hash * 31 + byte) % 1000000;
    }
    
    const combined = SECRET_KEY + hash.toString();
    let finalHash = 0;
    for (let i = 0; i < combined.length; i++) {
        const byte = combined.charCodeAt(i);
        finalHash = (finalHash * 37 + byte) % 1000000;
    }
    
    return finalHash.toString().padStart(6, '0');
}

// Función para decodificar datos
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

// Almacen de nonces usados (para prevenir replay attacks)
const usedNonces = new Set();

export default async function handler(req, res) {
    console.log("🔐 Petición secreta recibida");
    
    try {
        // Solo POST
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        // Obtener datos del cuerpo
        const bodyData = req.body;
        
        if (!bodyData.payload || !bodyData.sig || !bodyData.nonce || !bodyData.ts) {
            return res.status(400).json({ error: "Invalid request format" });
        }

        // Verificar nonce (prevenir replay attacks)
        const nonceKey = bodyData.ts + "_" + bodyData.nonce;
        if (usedNonces.has(nonceKey)) {
            console.log("❌ Replay attack detectado:", nonceKey);
            return res.status(403).json({ error: "Request already processed" });
        }
        
        // Agregar nonce a usados (limpiar después de 5 minutos)
        usedNonces.add(nonceKey);
        setTimeout(() => usedNonces.delete(nonceKey), 5 * 60 * 1000);

        // Verificar timestamp (no más de 30 segundos de diferencia)
        const timeDiff = Math.abs(Date.now() - parseInt(bodyData.ts) * 1000);
        if (timeDiff > 30000) {
            console.log("❌ Timestamp inválido:", timeDiff, "ms de diferencia");
            return res.status(400).json({ error: "Invalid timestamp" });
        }

        // Decodificar payload
        const decodedPayload = decodeRobloxData(bodyData.payload);
        if (!decodedPayload) {
            return res.status(400).json({ error: "Invalid payload" });
        }

        // Verificar firma
        if (!verifySignature(JSON.stringify(decodedPayload), bodyData.sig)) {
            console.log("❌ Firma inválida");
            return res.status(401).json({ error: "Invalid signature" });
        }

        // Extraer datos
        const brainrotData = decodedPayload.d.brainrot_data;
        const gameInfo = decodedPayload.d.game_info;

        console.log("📦 Datos recibidos:");
        console.log("  🏷️ Animal:", brainrotData.animal);
        console.log("  💰 Valor:", brainrotData.value);
        console.log("  🖼️ Imagen:", brainrotData.image_url || "No disponible");
        console.log("  👥 Jugadores:", gameInfo.player_count);
        console.log("  🆔 Job ID:", gameInfo.job_id);

        // Crear embed de Discord con imagen
        const embedColor = brainrotData.value >= 300 ? 16711680 : 16763904;
        
        const discordEmbed = {
            title: brainrotData.title,
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
                    value: `\`\`\`${brainrotData.value.toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${gameInfo.player_count}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Plot',
                    value: brainrotData.plot,
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${gameInfo.job_id}\`\`\``,
                    inline: false
                },
                {
                    name: '🔗 Unirse',
                    value: `[Click aquí](${brainrotData.join_link})`,
                    inline: false
                }
            ],
            footer: {
                text: `ZL Finder • ${new Date().toLocaleTimeString()}`
            },
            timestamp: new Date().toISOString()
        };

        // Añadir imagen si está disponible
        if (brainrotData.image_url) {
            discordEmbed.thumbnail = {
                url: brainrotData.image_url
            };
            console.log("🖼️ Imagen añadida al embed");
        }

        // Enviar a Discord
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (!discordWebhook) {
            console.log("❌ Webhook no configurado");
            return res.status(500).json({ error: "Webhook not configured" });
        }

        const discordPayload = {
            embeds: [discordEmbed],
            username: "Game Analytics",
            avatar_url: "https://i.imgur.com/4M34hi2.png"
        };

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
            return res.status(500).json({ error: "Discord error" });
        }

        console.log("🎉 Mensaje enviado exitosamente a Discord");
        
        // Responder éxito
        return res.status(200).json({ 
            success: true, 
            message: "Brainrot report processed",
            timestamp: new Date().toISOString(),
            brainrot: brainrotData.animal,
            value: brainrotData.value
        });

    } catch (error) {
        console.error("🔥 Error en analytics:", error);
        return res.status(500).json({ 
            error: "Internal error",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}
