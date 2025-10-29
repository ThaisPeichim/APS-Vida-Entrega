// relatorio.js — Lógica exclusiva para carregar e exibir o Relatório

/* ================= IMPORTS FIREBASE ================= */
// Certifique-se de que esses paths do Firebase v11 estão corretos em seu ambiente
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ================= CONFIGURAÇÃO DO FIREBASE ================= */
const firebaseConfig = {
    apiKey: "const API_KEY = ";,
    authDomain: "apssaude-cbbb7.firebaseapp.com",
    projectId: "apssaude-cbbb7",
    storageBucket: "apssaude-cbbb7.firebasestorage.app",
    messagingSenderId: "657282519105",
    appId: "1:657282519105:web:286898c3980cecdecf36c0",
    measurementId: "G-W95JN8MTB4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= FUNÇÃO PRINCIPAL: CARREGAR DADOS ================= */
async function carregarRelatorioDiagnostico(reportId) {
    if (!reportId) return console.error("❌ reportId não fornecido.");

    const docRefRelatorio = doc(db, "relatorios", reportId);

    // Função auxiliar para injetar HTML no chat (usando o #chat-history-list do HTML)
    function appendMessageToChat(role, text) {
        const chatContainer = document.getElementById("chat-history-list");
        if (!chatContainer) {
            console.error("Elemento #chat-history-list não encontrado na página.");
            return;
        }

        // Define as classes para estilizar a mensagem (Tailwind CSS)
        const wrapper = document.createElement("div");
        const align = role === "user" ? "text-right" : "text-left";
        const color = role === "user" ? "bg-blue-100 text-gray-800" : "bg-gray-100 text-gray-700";
        const label = role === "user" ? "Paciente" : "Assistente";

        // Formato da mensagem
        wrapper.innerHTML = `
            <p class="text-xs ${align} font-semibold mb-1">${label}</p>
            <div class="${color} inline-block px-4 py-2 rounded-lg whitespace-pre-wrap max-w-[90%]">${text}</div>
        `;
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Elementos da UI para atualização
    const loadingMessage = document.getElementById("loading-message");
    const reportContent = document.getElementById("report-content");
    const reportIdDisplay = document.getElementById("report-id-display");
    const paymentButton = document.getElementById("payment-button");
    const continueButton = document.getElementById("continue-button");

    try {
        const snap = await getDoc(docRefRelatorio);
        if (!snap.exists()) {
            loadingMessage.textContent = "❌ Erro: Relatório não encontrado ou permissão insuficiente.";
            return;
        }

        const data = snap.data();

        // 🔹 Injeta Dados Pessoais (do HTML que você forneceu)
        document.getElementById("data-name").textContent = data.name || "N/A";
        document.getElementById("data-email").textContent = data.email || "N/A";
        document.getElementById("data-cpf").textContent = data.cpf || "N/A";
        document.getElementById("data-phone").textContent = data.phone || "N/A";
        reportIdDisplay.textContent = `ID: ${reportId}`;


        // 🔹 Injeta Histórico da conversa
        if (data.chatHistory && Array.isArray(data.chatHistory)) {
            data.chatHistory.forEach(msg => appendMessageToChat(msg.role, msg.text));
        } else {
            appendMessageToChat("assistant", "Histórico de conversa não disponível.");
        }

        // 🔹 Lógica do Botão de Pagamento
        // 🔹 Lógica do Botão de Pagamento
        paymentButton.addEventListener("click", async () => {
            paymentButton.disabled = true;
            paymentButton.textContent = "Processando pagamento...";

            try {
                // --- Atualiza status no Firestore (opcional se já usa updateDoc) ---
                // await updateDoc(docRefRelatorio, { 
                //     status: "PAGO",
                //     pagoEm: new Date().toISOString()
                // });

                // --- Simulação do tempo de processamento ---
                await new Promise((resolve) => setTimeout(resolve, 2000));

                alert("✅ Pagamento confirmado com sucesso!");
                paymentButton.textContent = "Pagamento Concluído ✅";

                // --- Redirecionamento automático para o diagnóstico ---
                // O ID do relatório é obtido da URL atual
                const params = new URLSearchParams(window.location.search);
                const reportId = params.get("id");

                if (reportId) {
                    // Redireciona para o chat com o parâmetro return=diagnostico
                    window.location.href = `/index.html?return=diagnostico&id=${reportId}`;
                } else {
                    console.warn("⚠️ ID do relatório não encontrado na URL.");
                    alert("Não foi possível localizar o relatório para gerar o diagnóstico.");
                }

            } catch (err) {
                console.error("❌ Erro ao simular pagamento:", err);
                alert("❌ Erro ao processar pagamento. Tente novamente.");
                paymentButton.disabled = false;
                paymentButton.textContent = "Pagar para Obter Diagnóstico";
            }
        });


        // 🔹 Lógica do Botão Continuar
        continueButton.addEventListener("click", () => {
            // Este link precisa ser verificado em seu projeto, se é o destino correto.
            window.location.href = "/index.html?return=diagnostico";

        });


        // 🔹 Finaliza o carregamento da UI
        loadingMessage.classList.add("hidden");
        reportContent.classList.remove("hidden");
        paymentButton.disabled = false;

    } catch (err) {
        console.error("Erro ao buscar relatório:", err);
        loadingMessage.textContent = "❌ Erro ao carregar relatório. (Verifique as Regras de Segurança do Firestore)";
    }
}

/* ================= DOMCONTENTLOADED (LÓGICA DE EXECUÇÃO) ================= */
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Autenticação Anônima (CRÍTICO para as regras de segurança)
    try {
        await signInAnonymously(auth);
        console.log("✅ Usuário anônimo autenticado para carregar relatório.");
    } catch (error) {
        console.error("❌ ERRO DE AUTENTICAÇÃO ANÔNIMA:", error);
    }

    // 2. Checagem da URL e Início do Carregamento
    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get("id");

    if (reportId) {
        carregarRelatorioDiagnostico(reportId);
    } else {
        const loadingMessage = document.getElementById("loading-message");
        if (loadingMessage) {
            loadingMessage.textContent = "Nenhum ID de relatório encontrado na URL. Impossível carregar dados.";
        }
    }

});
