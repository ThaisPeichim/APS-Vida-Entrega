/**
 * Proxy seguro da OpenAI via Firebase Functions v2.
 * Lê a chave de API do Secret "OPENAI_API_KEY".
 * Corrigido para suportar 'content' e CORS completo.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL_NAME = "gpt-4o-mini"; // use "gpt-4o" se tiver cota disponível
const MAX_TOKENS = 800;

exports.openaiProxy = onRequest(
    { secrets: [OPENAI_API_KEY], region: "us-central1" },
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        if (req.method === "OPTIONS") return res.status(204).send("");

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Use apenas o método POST." });
        }

        const { history, systemPrompt } = req.body || {};
        if (!history || !systemPrompt) {
            return res.status(400).json({
                error: "Envie 'history' e 'systemPrompt' no corpo da requisição.",
            });
        }

        // Monta mensagens aceitando content/text
        const messages = [{ role: "system", content: systemPrompt }];
        for (const msg of history) {
            const content = msg?.content || msg?.text;
            if (content) {
                messages.push({
                    role: msg.role === "assistant" ? "assistant" : "user",
                    content,
                });
            }
        }

        try {
            const r = await axios.post(
                OPENAI_ENDPOINT,
                {
                    model: MODEL_NAME,
                    messages,
                    temperature: 0.7,
                    max_tokens: MAX_TOKENS,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const text = r.data.choices?.[0]?.message?.content?.trim() || "";
            return res.status(200).json({ response: text });
        } catch (err) {
            console.error("Erro OpenAI:", err.response?.data || err.message);
            const msg = err.response?.data?.error?.message || "Erro interno da IA.";
            return res.status(500).json({ error: msg });
        }
    }
);
