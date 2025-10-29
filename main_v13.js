// main_v13.js — Lógica completa do chat APS-Vida (Frontend Integrado)
// 🟢 CORREÇÕES: Sintaxe, escopo, Relatório, prompt, proxy local, salvamento Firestore.

/* ================= PROTEÇÃO DE EXECUÇÃO ÚNICA ================= */
if (window.APS_CHAT_INITIALIZED) {
    console.warn("⚠️ Script já inicializado, ignorando segunda execução.");
} else {
    window.APS_CHAT_INITIALIZED = true;
    console.log("🚀 main_v13.js carregado com sucesso! (Apontando para 127.0.0.1)");
}

/* ================= IMPORTS FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ================= VARIÁVEIS GLOBAIS ================= */
const PROXY_ENDPOINT = "http://127.0.0.1:5001/apssaude-cbbb7/us-central1/openaiProxy";
let app, auth, db;
let messages = [];
let userData = {};
let authReady = false;
let isChatStarted = false; // Controla se a conversa inicial foi feita.

/* ================= FIRESTORE: SALVAR RELATÓRIO ================= */
async function salvarRelatorio(userData, resumoFinal) {
    try {
        console.log("🩺 Salvando relatório no Firestore...");
        const chatHistory = messages.map(m => ({ role: m.role, text: m.text }));

        const relatorio = {
            ...userData,
            resumo: resumoFinal,
            chatHistory,
            status: "PENDENTE",
            data: new Date().toISOString()
        };

        addDoc(collection(db, "relatorios"), relatorio)
            .then((relatorioRef) => {
                console.log("✅ Relatório salvo com ID:", relatorioRef.id);

                // 🧠 Salva histórico e dados localmente para o diagnóstico
                localStorage.setItem("aps_chat_messages", JSON.stringify(messages));
                localStorage.setItem("aps_user_data", JSON.stringify(userData));

                // Redireciona para o relatório
                window.location.href = `/relatorio.html?id=${relatorioRef.id}`;
            })

            .catch((error) => {
                console.error("❌ Erro ao salvar relatório:", error);
                saveLocalMessage("Erro ao gerar relatório. Tente novamente.", "assistant");
            });
    } catch (error) {
        console.error("❌ Erro inesperado ao salvar relatório:", error);
        saveLocalMessage("Erro ao gerar relatório. Tente novamente.", "assistant");
    }
}


/* ================= OBTÉM PROMPT DE OURO ================= */
async function getGoldPrompt() {
    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 100));
            const docRefSystem = doc(db, "config", "system_config");
            const snap = await getDoc(docRefSystem);
            if (snap.exists() && snap.data().systemPrompt) return snap.data().systemPrompt;
        } catch (e) {
            console.warn(`⚠️ Falha na tentativa ${attempt} de leitura do Prompt`, e);
        }
    }
    console.error("❌ Fallback do Prompt acionado.");
    return `
Você é um assistente virtual de saúde responsável por uma triagem humanizada.
Siga estas regras ESTRITAMENTE:
1️⃣ Faça no máximo 6 perguntas para entender os sintomas principais.
2️⃣ Após obter informações suficientes, finalize a conversa com uma mensagem de encerramento e inclua o comando [RELATORIO] no final.
3️⃣ NÃO continue fazendo perguntas após incluir [RELATORIO].
4️⃣ O [RELATORIO] deve conter um resumo do caso em linguagem clara e sugestões gerais (sem diagnóstico definitivo).
5️⃣ Sempre mantenha um tom acolhedor, empático e profissional.
6️⃣ Se o usuário digitar /relatorio, encerre imediatamente e gere o relatório com [RELATORIO].
`;
}

/* ================= DOMCONTENTLOADED ================= */
document.addEventListener("DOMContentLoaded", async () => {
    // 🌟 OBTER ELEMENTOS APENAS UMA VEZ NO ESCOPO 🌟
    const preTriageContainer = document.getElementById("pre-triage-container");
    const preTriageForm = document.getElementById("pre-triage-form");
    const chatInterfaceContainer = document.getElementById("chat-interface-container");
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const messagesArea = document.getElementById("messages-area");
    const loadingIndicator = document.getElementById("loading-indicator");

    // 🌟 CORREÇÃO 1: ISOLA A MANIPULAÇÃO DO LAYOUT 🌟
    // Só manipula as classes se os contêineres existirem (ou seja, se estiver no index.html)
    if (preTriageContainer && chatInterfaceContainer) {
        preTriageContainer.classList.remove("hidden");
        chatInterfaceContainer.classList.add("hidden");
    }


    const firebaseConfig = {
        apiKey: "REMOVIDO_POR_SEGURANCASyCUOoyDI8GJA7WzDV0AQq2PJKNd6XupGxA",
        authDomain: "apssaude-cbbb7.firebaseapp.com",
        projectId: "apssaude-cbbb7",
        storageBucket: "apssaude-cbbb7.firebasestorage.app",
        messagingSenderId: "657282519105",
        appId: "1:657282519105:web:286898c3980cecdecf36c0",
        measurementId: "G-W95JN8MTB4",
    };

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    try {
        await signInAnonymously(auth);
        authReady = true;
        console.log("✅ Firebase inicializado e usuário anônimo autenticado.");
    } catch (error) {
        console.error("❌ ERRO DE AUTENTICAÇÃO:", error);
    }

    /* ================= FUNÇÕES AUXILIARES ================= */
    function sanitize(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
    }

    function renderMessage(text, role = "assistant", isNew = true) {
        const wrapper = document.createElement("div");
        wrapper.className = `mb-3 flex ${role === "user" ? "justify-end" : "justify-start"}`;
        const bubble = document.createElement("div");
        bubble.className =
            role === "user"
                ? "bg-blue-500 text-white rounded-lg px-4 py-2 inline-block max-w-[80%]"
                : "bg-gray-200 text-gray-800 rounded-lg px-4 py-2 inline-block max-w-[80%]";
        const content = document.createElement("div");
        content.className = "markdown-output";
        content.innerHTML = sanitize(text);
        bubble.appendChild(content);
        wrapper.appendChild(bubble);
        messagesArea.appendChild(wrapper);
        if (isNew) messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    function displayFormError(msg) {
        const el = document.getElementById("form-error-message");
        if (el) {
            el.textContent = msg;
            el.classList.remove("hidden");
            setTimeout(() => el.classList.add("hidden"), 5000);
        } else console.error("ERRO DE VALIDAÇÃO (Display não encontrado):", msg);
    }

    function setLoading(isLoading) {
        loadingIndicator.classList.toggle("hidden", !isLoading);
        userInput.disabled = isLoading;
        sendButton.disabled = isLoading || (userInput && userInput.value.trim() === "");
    }

    function saveLocalMessage(text, role = "assistant", isTriageQuestion = false) {
        messages.push({ role, text, isTriageQuestion });
        renderMessage(text, role, true);
    }

    /* ================= ENVIO AO PROXY ================= */
    // =======================================================
    // 🔧 Função corrigida — IA pergunta uma por vez
    // =======================================================
    async function generateContent(chatHistory, systemPrompt) {
        // Formata o histórico no formato aceito pelo proxy
        const formattedHistory = chatHistory.map(m => ({
            role: m.role.toLowerCase(),
            content: m.text,


        }));

        // 🧠 Reforço de instrução — impede múltiplas perguntas e diagnósticos prematuros
        const enhancedPrompt = systemPrompt + `
INSTRUÇÕES ADICIONAIS:
- Faça APENAS UMA pergunta por vez.
- Espere a resposta do usuário antes de continuar.
- NÃO forneça recomendações ou diagnósticos até que o relatório seja finalizado com [RELATORIO].
- Quando considerar a triagem concluída, finalize com um resumo e a tag [RELATORIO].
`;

        // ✅ Corrigido: o prompt enviado agora é o "enhancedPrompt"
        const payload = {
            model: "gpt-4o-mini",
            systemPrompt: enhancedPrompt,
            history: formattedHistory
        };

        setLoading(true);
        try {
            console.log("➡️ Enviando ao proxy:", payload);

            const resp = await fetch(PROXY_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)

            });

            const json = await resp.json();

            if (!resp.ok) {
                throw new Error(json.error || `Erro HTTP ${resp.status}`);
            }

            // ✅ Corrigido: resposta padronizada
            return json.response || json.output || "";
        } catch (err) {
            console.error("❌ Falha na chamada da IA:", err);
            saveLocalMessage("Erro ao se comunicar com o servidor de IA. Tente novamente.", "assistant");
            throw err;
        } finally {
            setLoading(false);
        }
    }

    /* ================= EVENTOS ================= */
    // 🌟 BLOCO CONDICIONAL (garante que só roda no index.html) 🌟
    if (preTriageForm && chatForm && userInput && sendButton) {



        // 🌟 CORREÇÃO 2.1: TORNA O EVENTO ASYNC E FORÇA A CHAMADA DA IA, COM CHECAGEM DE NULL 🌟
        preTriageForm.addEventListener("submit", async (e) => { // Tornou-se ASYNC!
            e.preventDefault();
            const name = document.getElementById("user-name").value.trim();
            const cpf = document.getElementById("user-cpf").value.trim().replace(/\D/g, "");
            const phone = document.getElementById("user-phone").value.trim();
            const email = document.getElementById("user-email").value.trim();

            if (!name || !cpf || !phone || !email)
                return displayFormError("Por favor, preencha todos os campos obrigatórios.");
            if (cpf.length !== 11) return displayFormError("O CPF deve conter 11 dígitos.");
            if (!/\S+@\S+\.\S+/.test(email)) return displayFormError("O e-mail fornecido não é válido.");

            userData = { name, cpf, phone, email };

            // Ação de Transição (AGORA COM CHECAGEM DE NULL)
            if (preTriageContainer) preTriageContainer.classList.add("hidden"); // Checa antes de usar!
            if (chatInterfaceContainer) chatInterfaceContainer.classList.remove("hidden"); // Checa antes de usar!

            userInput.focus();

            // Lógica de apresentação inicial (AGORA CHAMA A IA!)
            if (!isChatStarted) {
                if (!authReady) {
                    saveLocalMessage("⚠️ Sistema de triagem não autenticado. Tente recarregar.", "assistant");
                    return;
                }

                const initialUserMessage = `O usuário ${name} (dados validados) iniciou a triagem. Por favor, comece a conversa com a primeira pergunta de acordo com o Prompt de Ouro.`;

                // Coloca a mensagem inicial do usuário no histórico para a IA ver
                messages.push({ role: 'user', text: initialUserMessage });

                try {
                    const persona = await getGoldPrompt();
                    const aiText = await generateContent(messages, persona);

                    // Renderiza a primeira resposta (saudação + pergunta 1)
                    saveLocalMessage(aiText, "assistant");

                } catch (error) {
                    saveLocalMessage("❌ Erro ao iniciar a triagem. Verifique a conexão com o servidor de IA.", "assistant");
                }

                // Remove a mensagem inicial do histórico do usuário para não poluir o histórico
                messages.shift();

                isChatStarted = true;
            }
        });

        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const text = userInput.value.trim();
            if (!text) return;
            saveLocalMessage(text, "user");
            userInput.value = "";
            sendButton.disabled = true;

            if (!authReady) {
                saveLocalMessage("⚠️ Sistema de triagem não autenticado.", "assistant");
                return;
            }

            let aiText = "";
            try {
                const persona = await getGoldPrompt();
                aiText = await generateContent(messages, persona);
            } catch (error) {
                saveLocalMessage(`❌ Erro: não foi possível obter resposta. ${error.message}`, "assistant");
                return;
            }

            // 🟢 Lógica de Finalização do Chat (com o token [RELATORIO])
            // 🩺 Detecta o final da triagem
            if (/\[relatorio\]|\[relatório\]/i.test(aiText)) {
                console.log("🔍 Detecção de [RELATORIO] confirmada — finalizando triagem.");

                // 🔹 Remove o marcador [RELATORIO] para não aparecer ao usuário
                const finalSummary = aiText.replace(/\[relatorio\]|\[relatório\]/gi, "").trim();

                // 🔹 Mostra apenas o texto limpo na tela
                if (finalSummary) saveLocalMessage(finalSummary, "assistant", true);

                // 🔹 Mensagem adicional amigável
                saveLocalMessage("Triagem concluída! Gerando o relatório final...", "assistant", false);

                // 🔹 Salva o relatório e redireciona
                await salvarRelatorio(userData, finalSummary);

                // Impede execução extra
                return;
            }


            // Se não for [RELATORIO], a mensagem é salva normalmente.
            saveLocalMessage(aiText, "assistant");

            sendButton.disabled = false; // Reabilita após a resposta da IA
            userInput.focus(); // Coloca o foco de volta
        });

        userInput.addEventListener("input", () => {
            sendButton.disabled = userInput.value.trim() === "";
        });
    }

    // FIM DO BLOCO CONDICIONAL (if)

    // =========================================================
    // 🔁 MODO DE RETORNO PÓS-PAGAMENTO (Diagnóstico Final)
    // =========================================================
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const returnMode = urlParams.get("return");

        if (returnMode === "diagnostico") {
            console.log("🩺 Retorno de pagamento detectado — iniciando modo diagnóstico.");

            // 🔁 Recupera o histórico salvo antes do pagamento
            const storedMessages = JSON.parse(localStorage.getItem("aps_chat_messages") || "[]");
            const storedUser = JSON.parse(localStorage.getItem("aps_user_data") || "{}");
            if (storedMessages.length > 0) {
                messages = storedMessages;
                console.log("💾 Histórico restaurado:", messages.length, "mensagens.");
            }
            if (storedUser.name) {
                userData = storedUser;
            }

            // Esconde pré-triagem e mostra chat
            if (preTriageContainer) preTriageContainer.classList.add("hidden");
            if (chatInterfaceContainer) chatInterfaceContainer.classList.remove("hidden");

            // Mensagem inicial do diagnóstico
            saveLocalMessage(`
✅ Pagamento confirmado!
Olá ${userData.name || "paciente"}, vamos analisar sua triagem e gerar um parecer personalizado.
`, "assistant");

            // Obter prompt e gerar diagnóstico
            const persona = await getGoldPrompt();
            const enhancedPrompt = persona + `
INSTRUÇÕES ADICIONAIS PARA DIAGNÓSTICO:
- Analise TODO o histórico da triagem anterior.
- Gere um parecer técnico resumido e empático.
- NÃO repita perguntas da triagem.
- NÃO solicite dados novamente.
- Finalize com recomendações gerais e incentivo para avaliação médica presencial, se necessário.
`;

            const aiResponse = await generateContent(messages, enhancedPrompt);
            saveLocalMessage(aiResponse, "assistant");
        }
    } catch (err) {
        console.error("❌ Erro ao carregar diagnóstico:", err);
        saveLocalMessage("Erro ao gerar diagnóstico. Tente novamente mais tarde.", "assistant");
    }
    /* ===========================================================
       🔁 RETORNO PÓS-PAGAMENTO — GERAÇÃO DE DIAGNÓSTICO FINAL
       =========================================================== */
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const returnMode = urlParams.get("return");
        const relatorioId = urlParams.get("id");

        if (returnMode === "diagnostico" && relatorioId) {
            console.log("🩺 Retorno de pagamento detectado — gerando diagnóstico final.");

            // UI: ocultar pré-triagem e mostrar chat
            if (preTriageContainer) preTriageContainer.classList.add("hidden");
            if (chatInterfaceContainer) chatInterfaceContainer.classList.remove("hidden");

            saveLocalMessage("✅ Pagamento confirmado! Preparando diagnóstico aprofundado com base na sua triagem...", "assistant");

            // 1️⃣ Busca o relatório salvo
            const relatorioRef = doc(db, "relatorios", relatorioId);
            const snap = await getDoc(relatorioRef);

            if (!snap.exists()) {
                saveLocalMessage("❌ Relatório não encontrado. Tente novamente.", "assistant");
                return;
            }

            const relatorio = snap.data();
            const resumo = relatorio.resumo || "Sem resumo registrado.";
            const historico = relatorio.chatHistory || [];

            // 2️⃣ Monta o prompt de diagnóstico aprofundado
            const diagnosticoPrompt = `
Você é um assistente virtual de saúde (APS-Vida) responsável por elaborar diagnósticos e orientações personalizadas.

Contexto da Triagem:
${historico.map(m => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.text}`).join('\n')}

Resumo Clínico:
${resumo}

Tarefa:
Elabore um parecer detalhado com base nas informações da triagem. 
Sua resposta deve conter:
1. Um resumo clínico reescrito de forma médica e compreensiva.
2. Uma análise das possíveis causas prováveis (sem diagnóstico fechado).
3. Orientações práticas e educativas.
4. Um lembrete final para procurar atendimento médico presencial.

Responda de forma humanizada, clara e profissional. 
`;

            // 3️⃣ Chama a IA para gerar o diagnóstico final
            const respostaIA = await generateContent(
                [{ role: "user", text: "Gerar diagnóstico final com base no relatório acima." }],
                diagnosticoPrompt
            );

            // 4️⃣ Salva o diagnóstico no Firestore
            await setDoc(
                doc(db, "relatorios", relatorioId),
                {
                    status: "FINALIZADO",
                    diagnosticoFinal: respostaIA,
                    atualizadoEm: new Date().toISOString()
                },
                { merge: true }
            );

            // 5️⃣ Exibe no chat
            saveLocalMessage("🩺 Diagnóstico final gerado com sucesso!", "assistant");
            saveLocalMessage(respostaIA, "assistant");

            console.log("✅ Diagnóstico salvo e exibido.");
        }
    } catch (err) {
        console.error("❌ Erro ao gerar diagnóstico final:", err);
        saveLocalMessage("Erro ao gerar diagnóstico. Tente novamente mais tarde.", "assistant");
    }

});
// --- Função auxiliar: valida se o e-mail é VIP ---
function isVipUser(email) {
    const vipList = [
        "atendimento@apsvida.com",
        "rodrigotogomed@gmail.com"
    ];
    return vipList.includes(email.toLowerCase());
}

// --- Função: obtém o Prompt de Ouro do Firestore ---
async function getGoldPrompt(userEmail) {
    if (!isVipUser(userEmail)) {
        console.warn("Acesso negado: usuário não é VIP.");
        return null;
    }

    try {
        // ✅ Ajustado para usar config / system_config
        const docRef = firebase.firestore().collection("config").doc("system_config");
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.goldPrompt) {
                console.log("Prompt de ouro carregado com sucesso!");
                await savePromptForGleice(userEmail, data.goldPrompt);
                return data.goldPrompt;
            } else {
                console.warn("O documento existe, mas não contém o campo goldPrompt.");
                return null;
            }
        } else {
            console.error("Documento system_config não encontrado em config.");
            return null;
        }
    } catch (error) {
        console.error("Erro ao obter o prompt de ouro:", error);
        return null;
    }
}

// --- Função: salva o uso do Prompt de Ouro no log ---
async function savePromptForGleice(userEmail, promptText) {
    try {
        await firebase.firestore().collection("logs").add({
            email: userEmail,
            prompt: promptText,
            timestamp: new Date(),
        });
        console.log("Uso do prompt de ouro salvo com sucesso no log.");
    } catch (error) {
        console.error("Erro ao salvar o log de uso do prompt:", error);
    }
}

// --- Função: trata pagamento e redireciona para o painel VIP ---
async function handlePaymentAndRedirect(userEmail) {
    try {
        const goldPrompt = await getGoldPrompt(userEmail);

        if (goldPrompt) {
            // Redireciona para o painel VIP após validar o acesso
            window.location.href = "/admin.html"; // 🔁 
        } else {
            alert("Você não tem acesso VIP ou ocorreu um erro ao carregar o prompt especial.");
        }
    } catch (error) {
        console.error("Erro no redirecionamento VIP:", error);
    }
}
