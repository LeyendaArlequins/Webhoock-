// api/analytics.js - API SIMPLIFICADA
const CLIENT_ID = "ice_scanner_v3";
const VERSION = "3.0";

// Almacén de nonces usados
const usedNonces = new Map();
const NONCE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

function cleanupOldNonces() {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (now - timestamp > NONCE_TIMEOUT) {
            usedNonces.delete(nonce);
        }
    }
}

export default async function handler(req, res) {
    console.log("\n" + "=".repeat(60));
    console.log("📦 Petición recibida");
    console.log("=".repeat(60));
    
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, X-Protocol-Version');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        console.log("❌ Método no permitido:", req.method);
        return res.status(405).json({ error: 'Método no permitido' });
    }
    
    try {
        // Parsear body
        let body = req.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
        
        console.log("✅ Body parseado, tipo:", typeof body);
        
        // Verificar campos básicos
        if (!body || !body.version || !body.client_id || !body.timestamp || !body.nonce || !body.brainrot) {
            console.log("❌ Campos faltantes");
            console.log("Campos recibidos:", Object.keys(body || {}));
            return res.status(400).json({ 
                error: 'Campos requeridos faltantes',
                required: ['version', 'client_id', 'timestamp', 'nonce', 'brainrot']
            });
        }
        
        console.log("📋 Campos recibidos:", {
            version: body.version,
            client_id: body.client_id,
            timestamp: body.timestamp,
            nonce: body.nonce,
            has_brainrot: !!body.brainrot
        });
        
        // Verificar versión y cliente
        if (body.version !== VERSION) {
            console.log("❌ Versión incorrecta:", body.version, "esperada:", VERSION);
            return res.status(400).json({ 
                error: 'Versión incorrecta',
                expected: VERSION,
                received: body.version
            });
        }
        
        if (body.client_id !== CLIENT_ID) {
            console.log("❌ Cliente no autorizado:", body.client_id);
            return res.status(401).json({ 
                error: 'Cliente no autorizado',
                expected: CLIENT_ID,
                received: body.client_id
            });
        }
        
        // Verificar timestamp (no más de 30 segundos)
        const timeDiff = Math.abs(Date.now() - parseInt(body.timestamp) * 1000);
        if (timeDiff > 30000) {
            console.log("❌ Timestamp inválido:", timeDiff, "ms de diferencia");
            return res.status(400).json({ 
                error: 'Timestamp inválido',
                max_difference: 30000,
                received_difference: timeDiff
            });
        }
        
        // Verificar nonce (prevenir replay attacks)
        cleanupOldNonces();
        
        if (usedNonces.has(body.nonce)) {
            console.log("❌ Nonce ya usado:", body.nonce);
            return res.status(400).json({ 
                error: 'Nonce ya usado (replay attack)' 
            });
        }
        
        // Registrar nonce como usado
        usedNonces.set(body.nonce, Date.now());
        console.log("✅ Nonce registrado:", body.nonce);
        
        // Extraer datos del brainrot
        const brainrot = body.brainrot;
        console.log("\n🎯 BRAINROT ENCONTRADO:");
        console.log("  🏷️  Animal:", brainrot.animal);
        console.log("  💰 Valor:", brainrot.value);
        console.log("  🧬 Generación:", brainrot.generation);
        console.log("  ⭐ Rareza:", brainrot.rarity);
        console.log("  📍 Plot:", brainrot.plot);
        console.log("  👥 Jugadores:", brainrot.players);
        console.log("  🆔 Server ID:", brainrot.server_id);
        console.log("  🖼️  Imagen:", brainrot.image_url || "No disponible");
        
        // Verificar datos mínimos
        if (!brainrot.animal || brainrot.value === undefined) {
            console.log("❌ Datos de brainrot incompletos");
            return res.status(400).json({ 
                error: 'Datos de brainrot incompletos',
                required: ['animal', 'value']
            });
        }
        
        // Crear embed de Discord
        const embedColor = brainrot.value >= 3000000 ? 16711680 : 16763904;
        const isHighValue = brainrot.value >= 80000000;
        
        const discordEmbed = {
            title: brainrot.title || (isHighValue ? "🚨 HIGH VALUE BRAINROT" : "⚠️ Brainrot encontrado"),
            description: `**${brainrot.animal}** - ${brainrot.rarity || "Desconocido"}`,
            color: embedColor,
            fields: [
                {
                    name: '🧬 Generación',
                    value: `\`\`\`${brainrot.generation || "?"}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Valor',
                    value: `\`\`\`${Number(brainrot.value).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '👥 Jugadores',
                    value: `\`\`\`${brainrot.players || 0}/8\`\`\``,
                    inline: true
                },
                {
                    name: '📍 Ubicación',
                    value: brainrot.plot || "Debris (Suelo)",
                    inline: false
                },
                {
                    name: '🆔 Server ID',
                    value: `\`\`\`${brainrot.server_id}\`\`\``,
                    inline: false
                }
            ],
            footer: {
                text: `Z L | P V P • ${new Date().toLocaleDateString('es-ES')}`
            },
            timestamp: new Date().toISOString()
        };
        
        // Añadir imagen si está disponible
        if (brainrot.image_url) {
            discordEmbed.thumbnail = { url: brainrot.image_url };
            console.log("🖼️ Imagen añadida al embed");
        }
        
        // ================ AÑADIR ENLACES COMO QUIERES ================
        const placeId = "109983668079237";
        const gameInstanceId = brainrot.game_instance_id || brainrot.server_id;
        
        if (gameInstanceId) {
            // Construir los enlaces
            const androidLink = `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${gameInstanceId}`;
            const iosLink = `https://chillihub1.github.io/chillihub-joiner/?placeId=${placeId}&gameInstanceId=${gameInstanceId}`;
            
            console.log("🔗 Enlaces generados:");
            console.log("  Android/PC:", androidLink);
            console.log("  iOS:", iosLink);
            
            // Añadir los dos campos EXACTAMENTE como quieres
            discordEmbed.fields.push(
                {
                    name: '🔗 Unirse al servidor',
                    value: `[Click aquí](${androidLink})`,
                    inline: false
                },
                {
                    name: '🔗 Unirse al servidor iOS',
                    value: `[Click aquí](${iosLink})`,
                    inline: false
                }
            );
        } else if (brainrot.join_link_android && brainrot.join_link_ios) {
            // Para compatibilidad con versiones anteriores que ya envían los enlaces
            discordEmbed.fields.push(
                {
                    name: '🔗 Unirse al servidor',
                    value: `[Click aquí](${brainrot.join_link_android})`,
                    inline: false
                },
                {
                    name: '🔗 Unirse al servidor iOS',
                    value: `[Click aquí](${brainrot.join_link_ios})`,
                    inline: false
                }
            );
        } else if (brainrot.join_link) {
            // Para compatibilidad con versiones muy anteriores
            discordEmbed.fields.push({
                name: '🔗 Unirse al servidor',
                value: `[Click aquí](${brainrot.join_link})`,
                inline: false
            });
        }
        // ================ FIN DE LA SECCIÓN DE ENLACES ================
        
        // Enviar a Discord
        // Enviar a Discord (DOS WEBHOOKS)
const discordWebhooks = [
    process.env.DISCORD_WEBHOOK_URL,
    process.env.DISCORD_WEBHOOK_URL_2
].filter(Boolean);

if (discordWebhooks.length > 0) {
    try {
        const discordPayload = {
            embeds: [discordEmbed],
            username: "Z L | Finter",
            avatar_url: "https://i.imgur.com/4M34hi2.png"
        };

        // Mención para valores altos
        if (isHighValue) {
            discordPayload.content = "@here 🚨 **HIGH VALUE DETECTED!** 🚨";
        }

        console.log("📤 Enviando a Discord (2 webhooks)...");

        await Promise.all(
            discordWebhooks.map(webhook =>
                fetch(webhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(discordPayload)
                })
            )
        );

        console.log("✅ Enviado a todos los webhooks");

    } catch (discordError) {
        console.log("⚠️ Error enviando a Discord:", discordError.message);
    }
} else {
    console.log("⚠️ No hay webhooks configurados");
}
        
        // Responder éxito
        const responseData = { 
            success: true,
            message: "Brainrot report procesado exitosamente",
            data: {
                animal: brainrot.animal,
                value: brainrot.value,
                server_id: brainrot.server_id,
                discord_sent: discordWebhooks.length > 0
            }
        };
        
        console.log("\n✅ Respondiendo éxito:", responseData);
        
        return res.status(200).json(responseData);
        
    } catch (error) {
        console.error("🔥 ERROR:", error.message);
        console.error("Stack:", error.stack);
        
        return res.status(500).json({ 
            success: false,
            error: "Error interno del servidor",
            message: error.message
        });
    }
}
