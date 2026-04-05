import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// PASSO A PASSO PARA CONFIGURAR:
//
// 1. Acesse https://console.firebase.google.com
// 2. Clique em "Adicionar projeto" → dê um nome (ex: painel-gov-sc)
// 3. No menu lateral, clique em "Authentication" → "Começar" → ative "E-mail/senha"
// 4. No menu lateral, clique em "Firestore Database" → "Criar banco de dados"
//    → selecione "Iniciar no modo de teste" por agora
// 5. No menu lateral, clique na engrenagem ⚙️ → "Configurações do projeto"
// 6. Em "Seus aplicativos", clique em "</>" (Web), registre o app
// 7. Copie os valores abaixo de firebaseConfig e cole aqui
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyDQT7ZmhyyzLZEvmXLMoQAJk7uS7w012Fs",
  authDomain:        "projetoterceirizadosgov.firebaseapp.com",
  projectId:         "projetoterceirizadosgov",
  storageBucket:     "projetoterceirizadosgov.firebasestorage.app",
  messagingSenderId: "701589622900",
  appId:             "1:701589622900:web:a012bf6740049daa10c121",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
