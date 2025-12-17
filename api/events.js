import crypto from "crypto";

const SECRET_KEY = process.env.SECRET_KEY || "TU_CLAVE_SECRETA";
const SECONDARY_API_URL = process.env.SECONDARY_API_URL;
const SECONDARY_API_TOKEN = process.env.SECONDARY_API_TOKEN;

// Función para decodificar datos ofuscados (sin cambios)
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

// Función para enviar datos a tu API secundaria
async function sendToSecondaryAPI(data, serverId, playerCount) {
    if (!SECONDARY_API_URL || !SECONDARY_API_TOKEN) {
        console.log("⚠️ Configuración de API secundaria faltante. Omitiendo envío.");
        return { success: false, error: "Configuración no proporcionada" };
    }

    const payload = {
        timestamp: new Date().toISOString(),
        server_id: serverId,
        player_count: playerCount,
        event_data: data
    };

    try {
        console.log("📤 Enviando a API secundaria...");
        const response = await fetch(SECONDARY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SECONDARY_API_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        console.log(`✅ API secundaria status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.log("❌ API secundaria error:", errorText);
            return { success: false, status: response.status, error: errorText };
        }

        const responseData = await response.json();
        console.log("✅ API secundaria respuesta:", responseData);
        return { success: true, data: responseData };

    } catch (error) {
        console.error("🔥 Error enviando a API secundaria:", error);
        return { success: false, error: error.message };
    }
}

// Función para enviar a Discord (CON TU EMBED ORIGINAL COMPLETO)
async function sendToDiscord(eventData, serverId, playerCount) {
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (!discordWebhook) {
        console.log("❌ Webhook de Discord no configurado");
        return { success: false, error: "Webhook not configured" };
    }

    // TU EMBED ORIGINAL - SIN CAMBIOS
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

    const discordPayload = {
        embeds: [discordEmbed],
        username: "Game Analytics",
        avatar_url: "https://i.imgur.com/4M34hi2.png"
    };

    try {
        console.log("📤 Enviando a Discord...");
        const discordResponse = await fetch(discordWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(discordPayload)
        });

        console.log(`✅ Discord status: ${discordResponse.status}`);
        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            console.log("❌ Discord error:", errorText);
            return { success: false, error: errorText };
        }
        return { success: true };
    } catch (error) {
        console.error("🔥 Error enviando a Discord:", error);
        return { success: false, error: error.message };
    }
}

// Handler principal modificado
export default async function handler(req, res) {
    console.log("🔐 Petición secreta recibida");

    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/x-www-form-urlencoded')) {
            console.log("⚠️ Content-Type inusual:", contentType);
        }

        const bodyData = req.body;
        const encryptedData = bodyData.data;
        if (!encryptedData) {
            return res.status(400).json({ error: "No data" });
        }

        const decodedData = decodeRobloxData(encryptedData);
        if (!decodedData) {
            return res.status(400).json({ error: "Invalid data format" });
        }

        console.log("📦 Datos decodificados:", JSON.stringify(decodedData, null, 2));

        if (decodedData.action !== "log_event" ||
            decodedData.event_data.type !== "zl_finder") {
            console.log("❌ Estructura inválida");
            return res.status(400).json({ error: "Invalid structure" });
        }

        const eventData = decodedData.event_data.data;
        const serverId = decodedData.event_data.server_id;
        const playerCount = decodedData.event_data.players;

        // Envío paralelo a Discord y a la API secundaria
        const [discordResult, apiResult] = await Promise.allSettled([
            sendToDiscord(eventData, serverId, playerCount),
            sendToSecondaryAPI(eventData, serverId, playerCount)
        ]);

        // Resultados del envío paralelo
        console.log("📊 Resultado Discord:", discordResult.status);
        console.log("📊 Resultado API secundaria:", apiResult.status);

        // Determina el código de respuesta
        const discordSuccess = discordResult.status === 'fulfilled' && discordResult.value?.success;
        const apiSuccess = apiResult.status === 'fulfilled' && apiResult.value?.success;

        // Éxito si al menos Discord recibió el mensaje
        if (discordSuccess) {
            return res.status(200).json({
                success: true,
                message: "Event logged",
                discord_sent: true,
                api_secondary_sent: apiSuccess,
                timestamp: new Date().toISOString()
            });
        } else {
            // Si Discord falla, es un error grave
            return res.status(500).json({
                success: false,
                error: "Primary notification failed",
                details: {
                    discord_error: discordResult.reason?.message || discordResult.value?.error,
                    api_secondary_error: apiResult.reason?.message || apiResult.value?.error
                }
            });
        }

    } catch (error) {
        console.error("🔥 Error en analytics:", error);
        return res.status(500).json({
            error: "Internal error",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}
