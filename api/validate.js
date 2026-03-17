import crypto from "crypto";

const SECRET = "clave_ultra_secreta";

export default function handler(req, res) {
    const { token } = req.body;

    try {
        const [jobid, expires, signature] = token.split(":");

        if (Date.now() > Number(expires)) {
            return res.status(401).json({ error: "Expirado" });
        }

        const data = `${jobid}:${expires}`;

        const validSig = crypto
            .createHmac("sha256", SECRET)
            .update(data)
            .digest("hex");

        if (signature !== validSig) {
            return res.status(401).json({ error: "Inválido" });
        }

        return res.status(200).json({ jobid });

    } catch {
        return res.status(400).json({ error: "Error" });
    }
}
