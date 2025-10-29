// admin.js — lógica do painel admin (Firebase v8)

const firebaseConfig = {
    apiKey: "REMOVIDO_POR_SEGURANCASyCUOoyDI8GJA7WzDV0AQq2PJKNd6XupGxA",
    authDomain: "apssaude-cbbb7.firebaseapp.com",
    projectId: "apssaude-cbbb7",
    storageBucket: "apssaude-cbbb7.firebasestorage.app",
    messagingSenderId: "657282519105",
    appId: "1:657282519105:web:286898c3980cecdecf36c0",
    measurementId: "G-W95JN8MTB4"
};

let auth, db;

document.addEventListener("DOMContentLoaded", () => {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");
    const loginMessage = document.getElementById("loginMessage");

    const loginBox = document.getElementById("login-box");
    const adminPanel = document.getElementById("admin-panel");
    const systemPromptInput = document.getElementById("systemPromptInput");
    const saveConfigButton = document.getElementById("saveConfigButton");
    const reloadConfigButton = document.getElementById("reloadConfigButton");
    const configMessage = document.getElementById("configMessage");

    // Auth state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loginBox.style.display = "none";
            adminPanel.style.display = "block";
            logoutButton.style.display = "inline-block";
            loginMessage.textContent = "";
            await loadConfig();
        } else {
            loginBox.style.display = "block";
            adminPanel.style.display = "none";
            logoutButton.style.display = "none";
        }
    });

    loginButton.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            loginMessage.textContent = "Preencha e-mail e senha.";
            return;
        }
        loginMessage.textContent = "Autenticando...";
        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginMessage.textContent = "";
        } catch (err) {
            console.error("Erro login:", err);
            loginMessage.textContent = err.message || "Erro ao autenticar.";
        }
    });

    logoutButton.addEventListener("click", async () => {
        await auth.signOut();
    });

    // Carrega prompt de ouro
    async function loadConfig() {
        try {
            const doc = await db.collection("config").doc("system_config").get();
            if (doc.exists && doc.data().systemPrompt) {
                systemPromptInput.value = doc.data().systemPrompt;
            } else {
                systemPromptInput.value = "Você é Assistente Virtual de Saúde, uma assistente virtual empática.";
            }
        } catch (e) {
            console.error("Erro carregar config:", e);
        }
    }

    // Salva prompt
    saveConfigButton.addEventListener("click", async () => {
        const newPrompt = systemPromptInput.value.trim();
        if (!newPrompt) {
            alert("Prompt vazio.");
            return;
        }
        try {
            await db.collection("config").doc("system_config").set({
                systemPrompt: newPrompt,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            configMessage.classList.remove("hidden");
            setTimeout(() => configMessage.classList.add("hidden"), 2500);
        } catch (e) {
            console.error("Erro salvar config:", e);
            alert("Erro ao salvar configuração.");
        }
    });

    // Recarregar manualmente
    reloadConfigButton.addEventListener("click", loadConfig);

}); // DOMContentLoaded
