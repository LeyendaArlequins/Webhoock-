// api/analytics.js - API COMPATIBLE con tu script actual
import crypto from "crypto";

const SECRET_KEY = process.env.SECRET_KEY || "TU_CLAVE_SECRETA";

// Función para decodificar datos ofuscados (COMPATIBLE con tu script)
function decodeRobloxData(encoded) {
    try {
        console.log("🔍 Decodificando datos...");
        console.log("📏 Longitud de datos:", encoded.length);
        
        let decoded = "";
        for (let i = 0; i < encoded.length; i += 3) {
            const charCode = parseInt(encoded.substr(i, 3));
            if (!isNaN(charCode)) {
                decoded += String.fromCharCode(charCode);
            }
        }
        
        console.log("📄 Datos decodificados (primeros 500 chars):");
        console.log(decoded.substring(0, 500) + "...");
        
        const parsedData = JSON.parse(decoded);
        console.log("✅ Datos parseados correctamente");
        return parsedData;
    } catch (error) {
        console.log("❌ Error decodificando:", error.message);
        console.log("🔍 Stack trace:", error.stack);
        return null;
    }
}

// Almacen temporal para evitar duplicados
const recentRequests = new Set();
const REQUEST_TIMEOUT = 30000; // 30 segundos

export default async function handler(req, res) {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 Petición recibida en /api/analytics");
    console.log("=".repeat(60));
    
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    // Manejar preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Solo POST
        if (req.method !== "POST") {
            console.log("❌ Método no permitido:", req.method);
            return res.status(405).json({ 
                success: false, 
                error: "Method not allowed",
                allowed: ["POST"]
            });
        }

        console.log("📦 Headers recibidos:", JSON.stringify(req.headers, null, 2));
        console.log("📦 Content-Type:", req.headers['content-type']);

        // Obtener datos del cuerpo según Content-Type
        let bodyData;
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
            // Parsear form-urlencoded
            const params = new URLSearchParams(req.body);
            bodyData = Object.fromEntries(params);
            console.log("📊 Body como form-urlencoded:", bodyData);
        } else {
            // Intentar como JSON o texto plano
            bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            console.log("📊 Body recibido:", typeof req.body === 'string' ? req.body.substring(0, 500) + "..." : JSON.stringify(req.body).substring(0, 500) + "...");
        }

        // Verificar que tenemos datos
        if (!bodyData || !bodyData.data) {
            console.log("❌ No hay datos en el body");
            return res.status(400).json({ 
                success: false, 
                error: "No data provided",
                received: bodyData
            });
        }

        console.log("🔍 Datos recibidos (data field):", bodyData.data.substring(0, 100) + "...");

        // Decodificar datos
        const decodedData = decodeRobloxData(bodyData.data);
        if (!decodedData) {
            console.log("❌ No se pudieron decodificar los datos");
            return res.status(400).json({ 
                success: false, 
                error: "Invalid data format - cannot decode"
            });
        }

        console.log("📦 Estructura completa de datos decodificados:");
        console.log(JSON.stringify(decodedData, null, 2));

        // Verificar estructura básica (COMPATIBLE con tu script)
        if (!decodedData.action || !decodedData.event_data) {
            console.log("❌ Estructura de datos inválida");
            return res.status(400).json({ 
                success: false, 
                error: "Invalid data structure",
                required_fields: ["action", "event_data"],
                received: Object.keys(decodedData)
            });
        }

        // Verificar que sea del tipo correcto
        if (decodedData.action !== "log_event" || decodedData.event_data.type !== "zl_finder") {
            console.log("❌ Tipo de acción incorrecto");
            console.log("📋 Action recibida:", decodedData.action);
            console.log("📋 Type recibido:", decodedData.event_data?.type);
            return res.status(400).json({ 
                success: false, 
                error: "Invalid action type",
                expected: { action: "log_event", type: "zl_finder" },
                received: { 
                    action: decodedData.action, 
                    type: decodedData.event_data?.type 
                }
            });
        }

        // Extraer datos del brainrot (COMPATIBLE)
        const eventData = decodedData.event_data.data;
        const serverId = decodedData.event_data.server_id || "N/A";
        const playerCount = decodedData.event_data.players || 0;
        const timestamp = decodedData.event_data.timestamp || Date.now();

        console.log("\n🎯 DATOS DEL BRAINROT EXTRAÍDOS:");
        console.log("  🏷️  Animal:", eventData.animal);
        console.log("  ⭐ Rareza:", eventData.rarity);
        console.log("  🧬 Generación:", eventData.generation);
        console.log("  💰 Valor:", eventData.value);
        console.log("  📍 Plot:", eventData.plot);
        console.log("  👥 Jugadores:", playerCount);
        console.log("  🆔 Server ID:", serverId);
        console.log("  🖼️  Imagen:", eventData.image_url || "No disponible");
        console.log("  📅 Timestamp:", new Date(timestamp * 1000).toISOString());

        // Verificar si es un duplicado reciente
        const requestKey = `${serverId}_${eventData.animal}_${eventData.value}_${timestamp}`;
        if (recentRequests.has(requestKey)) {
            console.log("⚠️ Petición duplicada detectada, ignorando...");
            return res.status(200).json({ 
                success: true, 
                message: "Duplicate request ignored",
                timestamp: new Date().toISOString()
            });
        }

        // Agregar a recientes y limpiar después de 30 segundos
        recentRequests.add(requestKey);
        setTimeout(() => recentRequests.delete(requestKey), REQUEST_TIMEOUT);

        // Crear embed de Discord (MEJORADO)
        const embedColor = eventData.value >= 300 ? 16711680 : 16763904; // Rojo para alto valor, naranja para medio
        
        const discordEmbed = {
            title: eventData.title || `Brainrot encontrado! (${eventData.value >= 10000000 ? '10M+' : '1M-10M'})`,
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
                    value: `\`\`\`${Number(eventData.value).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${playerCount}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Ubicación',
                    value: eventData.plot,
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${serverId}\`\`\``,
                    inline: false
                },
                {
                    name: '🔗 Unirse al servidor',
                    value: `[Click aquí](${eventData.join_link || `https://www.roblox.com/games/start?placeId=109983668079237&gameInstanceId=${serverId}`})`,
                    inline: false
                }
            ],
            footer: {
                text: `ZL Finder • ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`
            },
            timestamp: new Date().toISOString()
        };

        // Añadir imagen si está disponible
        if (eventData.image_url) {
            discordEmbed.thumbnail = {
                url: eventData.image_url
            };
            console.log("🖼️ Imagen añadida al embed de Discord");
        } else {
            console.log("⚠️ No hay imagen disponible para este brainrot");
        }

        // Enviar a Discord
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        if (!discordWebhook) {
            console.log("❌ ERROR: DISCORD_WEBHOOK_URL no configurada");
            console.log("ℹ️ Configura la variable de entorno DISCORD_WEBHOOK_URL en Vercel");
            
            // Responder con éxito pero sin enviar a Discord (para pruebas)
            return res.status(200).json({ 
                success: true, 
                message: "Brainrot processed but Discord webhook not configured",
                data: eventData,
                discord_sent: false,
                timestamp: new Date().toISOString()
            });
        }

        console.log("📤 Enviando a Discord webhook...");
        
        const discordPayload = {
            embeds: [discordEmbed],
            username: "Brainrot Notifier",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            content: eventData.value >= 10000000 ? "@here 🚨 **HIGH VALUE BRAINROT DETECTED!** 🚨" : null
        };

        console.log("📦 Payload para Discord:", JSON.stringify(discordPayload, null, 2));

        try {
            const discordResponse = await fetch(discordWebhook, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "User-Agent": "ZL-Finder-API/1.0"
                },
                body: JSON.stringify(discordPayload),
                timeout: 10000 // 10 segundos timeout
            });

            console.log("✅ Respuesta de Discord recibida");
            console.log("📊 Status Code:", discordResponse.status);
            
            const responseText = await discordResponse.text();
            console.log("📄 Body respuesta Discord:", responseText.substring(0, 500));

            if (!discordResponse.ok) {
                console.log("❌ Error de Discord:", discordResponse.status, responseText);
                // Pero seguimos respondiendo éxito al cliente
            } else {
                console.log("🎉 Mensaje enviado exitosamente a Discord");
            }

            // Responder éxito al cliente de Roblox
            return res.status(200).json({ 
                success: true, 
                message: "Brainrot report processed successfully",
                discord_sent: discordResponse.ok,
                discord_status: discordResponse.status,
                data: {
                    animal: eventData.animal,
                    value: eventData.value,
                    server_id: serverId,
                    players: playerCount
                },
                timestamp: new Date().toISOString()
            });

        } catch (discordError) {
            console.error("❌ Error enviando a Discord:", discordError.message);
            // Aún respondemos éxito al cliente
            return res.status(200).json({ 
                success: true, 
                message: "Brainrot processed but Discord error",
                discord_sent: false,
                error: discordError.message,
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error("🔥 ERROR CRÍTICO en handler:");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("Request body:", req.body);
        
        return res.status(500).json({ 
            success: false, 
            error: "Internal server error",
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
