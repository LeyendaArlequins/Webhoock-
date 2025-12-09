// api/analytics.js - API SECRETA
import crypto from "crypto";

const SECRET_KEY = process.env.SECRET_KEY || "TU_CLAVE_SECRETA";

// Función para decodificar datos ofuscados
function decodeRobloxData(encoded) {
    try {
        // Decodificar el formato numérico
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
    console.log("🔐 Petición secreta recibida");
    
    try {
        // Solo POST
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        // Verificar que viene de formulario (para parecer legítimo)
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/x-www-form-urlencoded')) {
            console.log("⚠️ Content-Type inusual:", contentType);
        }

        // Obtener datos del cuerpo
        const bodyData = req.body;
        const encryptedData = bodyData.data;
        
        if (!encryptedData) {
            return res.status(400).json({ error: "No data" });
        }

        // Decodificar datos
        const decodedData = decodeRobloxData(encryptedData);
        if (!decodedData) {
            return res.status(400).json({ error: "Invalid data format" });
        }

        console.log("📦 Datos decodificados:", JSON.stringify(decodedData, null, 2));

        // Verificar que es de nuestro script
        if (decodedData.action !== "log_event" || 
            decodedData.event_data.type !== "zl_finder") {
            console.log("❌ Estructura inválida");
            return res.status(400).json({ error: "Invalid structure" });
        }

        // Extraer datos del embed
        const eventData = decodedData.event_data.data;
        const serverId = decodedData.event_data.server_id;
        const playerCount = decodedData.event_data.players;

        // Crear embed de Discord
        const embedColor = eventData.value >= 3000000 ? 16711680 : 16763904;
        
        const discordEmbed = {
            title: eventData.title,
            description: `**${eventData.animal}** - ${eventData.rarity}`,
            color: embedColor,
            fields: [
                {
                    name: '🧬 Generación',
                    value: `\`\`\`${eventData.generation}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Valor',
                    value: `\`\`\`${eventData.value.toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${playerCount}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Plot',
                    value: eventData.plot,
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${serverId}\`\`\``,
                    inline: false
                },
                {
                    name: '🔗 Unirse',
                    value: `[Click aquí](${eventData.join_link})`,
                    inline: false
                }
            ],
            footer: {
                text: `ZL Finder • ${new Date().toLocaleTimeString()}`
            },
            timestamp: new Date().toISOString()
        };

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

        console.log("🎉 Mensaje enviado exitosamente");
        
        // Responder éxito (sin datos sensibles)
        return res.status(200).json({ 
            success: true, 
            message: "Event logged",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("🔥 Error en analytics:", error);
        return res.status(500).json({ 
            error: "Internal error",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}
