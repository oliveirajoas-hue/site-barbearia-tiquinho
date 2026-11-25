// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// CONFIRE ESTES VALORES em: Console do Firebase > Configurações do projeto > Seus apps
const firebaseConfig = {
  apiKey: "AIzaSyCWY5BhDe76SaASL3dWuUo2jkMKz-q-iOE",
  authDomain: "barbearia-f0312.firebaseapp.com",
  projectId: "barbearia-f0312",
  storageBucket: "barbearia-f0312.firebasestorage.app",
  messagingSenderId: "81709794731",
  appId: "1:81709794731:web:4e776c2357110136effeee"
};

// E-mail com acesso ao painel administrativo
export const ADMIN_EMAIL = "tiquinhobarber31@gmail.com";

export const SERVICOS = [
  { id: "corte", nome: "Corte Masculino (Degradê / Social)", preco: 35.0, duracao: "60 min" },
  { id: "barba", nome: "Barba Completa", preco: 15.0, duracao: "60 min" },
  { id: "combo", nome: "Combo Corte + Barba", preco: 45.0, duracao: "60 min" },
  { id: "sobrancelha", nome: "Sobrancelha na Navalha", preco: 10.0, duracao: "60 min" },
  { id: "pezinhos", nome: "Acabamento / Pezinho", preco: 5.0, duracao: "60 min" }
];

// Grade de horários de cada dia (mesma que você já tinha)
export const HORARIOS_PADRAO = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

// Utilitários compartilhados
export function hojeLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatarData(iso) {
  return iso.split("-").reverse().join("/");
}

export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);