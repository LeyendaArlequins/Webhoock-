import crypto from "crypto";

const SECRET = "clave_ultra_secreta";

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end();
    }

    const { id } = req.body;

    const now = Date.now();

    const item = (global.brainrotHistory || []).find(
        x => x.id === id && (now - x.timestamp) < 30000
    );

    if (!item) {
        return res.status(404).json({ error: "No encontrado" });
    }

    const expires = now + 10000;
    const data = `${item.jobid}:${expires}`;

    const signature = crypto
        .createHmac("sha256", SECRET)
        .update(data)
        .digest("hex");

    const token = `${data}:${signature}`;

    return res.status(200).json({ token });
}
