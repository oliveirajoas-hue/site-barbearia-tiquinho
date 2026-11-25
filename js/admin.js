import {
  auth,
  db,
  ADMIN_EMAIL,
  HORARIOS_PADRAO,
  hojeLocal,
  formatarData,
  esc,
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos conforme administrador.html
const loginSection = document.getElementById("admin-login-section");
const dashboard = document.getElementById("admin-dashboard");
const btnLogout = document.getElementById("btn-logout");
const formLogin = document.getElementById("form-admin-login");
const inputSenha = document.getElementById("admin-senha");

const statHoje = document.getElementById("stat-hoje");
const statFaturamento = document.getElementById("stat-faturamento");
const statClientes = document.getElementById("stat-clientes");

const bloquearSelect = document.getElementById("bloquear-horario-select");
const bloquearMotivo = document.getElementById("bloquear-motivo");
const btnBloquear = document.getElementById("btn-bloquear-horario");

const filtroData = document.getElementById("filtro-data");
const btnLimpar = document.getElementById("btn-limpar-filtro");
const lista = document.getElementById("lista-agendamentos-admin");

let todosItens = [];
let unsubscribeAgendamentos = null;
let painelIniciado = false;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function mostrarPainel(autenticadoAdmin) {
  if (autenticadoAdmin) {
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    loginSection.classList.remove("hidden");
    dashboard.classList.add("hidden");
    btnLogout.classList.add("hidden");
  }
}

function popularSelectBloqueio() {
  if (!bloquearSelect) return;
  bloquearSelect.innerHTML = HORARIOS_PADRAO
    .map((h) => `<option value="${esc(h)}">${esc(h)}</option>`)
    .join("");
}

function iniciarPainel() {
  if (painelIniciado) return;
  painelIniciado = true;

  if (filtroData && !filtroData.value) {
    filtroData.value = hojeLocal();
  }
  popularSelectBloqueio();
  escutarAgendamentos();
}

// ---------- Login / Logout ----------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = (inputSenha ? inputSenha.value : "").trim();

  if (!senha) {
    alert("Digite a chave/palavra-passe administrativa.");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, senha);
    if (cred.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      alert("Esta conta não tem permissão de administrador.");
      return;
    }
    if (inputSenha) inputSenha.value = "";
  } catch (err) {
    console.error("Erro no login do admin:", err);
    alert("Palavra-passe inválida ou falha na autenticação.");
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// ---------- Estatísticas ----------
function atualizarEstatisticas(itens) {
  const hoje = hojeLocal();
  const dataRef = (filtroData && filtroData.value) || hoje;
  const mesRef = dataRef.slice(0, 7); // "YYYY-MM"

  const agendamentosAtivosHoje = itens.filter(
    (item) =>
      item.status !== "bloqueado" &&
      item.status !== "cancelado" &&
      item.data === hoje
  ).length;

  const concluidosMes = itens.filter(
    (item) =>
      item.status === "concluido" &&
      String(item.data || "").startsWith(mesRef)
  );

  const faturamentoMes = concluidosMes.reduce(
    (acc, item) => acc + Number(item.preco || 0),
    0
  );

  const clientesUnicos = new Set(
    itens
      .filter((item) => item.status !== "bloqueado" && item.status !== "cancelado")
      .map((item) => item.clienteUid || item.clienteTelefone || item.clienteNome)
      .filter(Boolean)
  ).size;

  if (statHoje) statHoje.textContent = String(agendamentosAtivosHoje);
  if (statFaturamento) statFaturamento.textContent = formatarMoeda(faturamentoMes);
  if (statClientes) statClientes.textContent = String(clientesUnicos);
}

// ---------- Lista de Agendamentos e Bloqueios ----------
function renderizarLista() {
  const dataFiltro = filtroData ? filtroData.value : "";

  const filtrados = todosItens
    .filter((item) => !dataFiltro || item.data === dataFiltro)
    .sort((a, b) =>
      `${a.data || ""} ${a.horario || ""}`.localeCompare(`${b.data || ""} ${b.horario || ""}`)
    );

  if (!filtrados.length) {
    lista.innerHTML = `<p class="text-muted">Nenhum registo encontrado para o filtro selecionado.</p>`;
    return;
  }

  lista.innerHTML = filtrados
    .map((item) => {
      const dataTxt = dataFiltro ? "" : `${esc(formatarData(item.data || ""))} · `;
      const status = item.status || "confirmado";

      if (status === "bloqueado") {
        return `
          <div class="booking-item">
            <div>
              <strong style="font-size: 1.05rem; color: var(--text-muted);">${dataTxt}${esc(item.horario || "")}</strong> —
              <strong>Horário Bloqueado</strong><br />
              <span style="color: var(--text-muted); font-size: 0.9rem;">
                ${item.motivo ? `Motivo: ${esc(item.motivo)}` : "Bloqueio manual do barbeiro"}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-bloqueado">bloqueado</span>
              <button class="btn btn-outline" style="padding: 0.4rem 0.7rem; font-size: 0.85rem;" data-acao="desbloquear" data-id="${esc(item.id)}">
                Liberar
              </button>
            </div>
          </div>
        `;
      }

      const foneLimpo = String(item.clienteTelefone || "").replace(/\D/g, "");
      const zapUrl = foneLimpo
        ? `https://wa.me/${foneLimpo.startsWith("55") ? foneLimpo : `55${foneLimpo}`}`
        : "";

      return `
        <div class="booking-item">
          <div>
            <strong style="font-size: 1.1rem; color: var(--gold);">${dataTxt}${esc(item.horario || "")}</strong> —
            <strong>${esc(item.clienteNome || "Cliente")}</strong><br />
            <span style="color: var(--text-muted); font-size: 0.9rem;">
              ${esc(item.servicoNome || item.servicoId || "Serviço")} (${formatarMoeda(item.preco)})
              ${item.clienteTelefone ? ` | Tel: ${esc(item.clienteTelefone)}` : ""}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge badge-${esc(status)}">${esc(status)}</span>
            ${
              status === "confirmado"
                ? `
              ${
                zapUrl
                  ? `<a href="${zapUrl}" target="_blank" rel="noopener" class="btn btn-outline" style="padding: 0.4rem 0.7rem; font-size: 0.85rem;">WhatsApp</a>`
                  : ""
              }
              <button class="btn btn-success" data-acao="concluir" data-id="${esc(item.id)}">Concluir</button>
              <button class="btn btn-danger" data-acao="cancelar" data-id="${esc(item.id)}">Cancelar</button>
            `
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function escutarAgendamentos() {
  if (unsubscribeAgendamentos) {
    unsubscribeAgendamentos();
    unsubscribeAgendamentos = null;
  }

  unsubscribeAgendamentos = onSnapshot(
    collection(db, "agendamentos"),
    (snapshot) => {
      todosItens = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      atualizarEstatisticas(todosItens);
      renderizarLista();
    },
    (err) => {
      console.error("Erro ao ouvir agendamentos no admin:", err);
      lista.innerHTML = `<p class="text-muted">Erro ao carregar agendamentos do Firestore.</p>`;
    }
  );
}

// ---------- Ações (concluir / cancelar / liberar bloqueio) ----------
lista.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-acao]");
  if (!btn) return;

  const { acao, id } = btn.dataset;
  if (!id) return;

  try {
    if (acao === "concluir") {
      await updateDoc(doc(db, "agendamentos", id), {
        status: "concluido",
        concluidoEm: serverTimestamp(),
      });
    } else if (acao === "cancelar") {
      if (!confirm("Cancelar este agendamento?")) return;
      await updateDoc(doc(db, "agendamentos", id), {
        status: "cancelado",
        canceladoEm: serverTimestamp(),
      });
    } else if (acao === "desbloquear") {
      await updateDoc(doc(db, "agendamentos", id), {
        status: "cancelado",
        desbloqueadoEm: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("Erro ao atualizar registo:", err);
    alert("Não foi possível atualizar o status no Firestore.");
  }
});

// ---------- Bloquear Horário ----------
if (btnBloquear) {
  btnBloquear.addEventListener("click", async () => {
    const data = filtroData ? filtroData.value : "";
    if (!data) {
      alert("Escolha uma data no filtro antes de bloquear um horário.");
      return;
    }

    const horario = bloquearSelect ? bloquearSelect.value : "";
    const motivo = bloquearMotivo ? bloquearMotivo.value.trim() : "";

    const jaOcupado = todosItens.some(
      (item) => item.data === data && item.horario === horario && item.status !== "cancelado"
    );
    if (jaOcupado) {
      alert("Já existe um agendamento ou bloqueio ativo nesse dia e horário.");
      return;
    }

    try {
      await addDoc(collection(db, "agendamentos"), {
        data,
        horario,
        motivo,
        clienteNome: "Bloqueio de Agenda",
        servicoNome: "Bloqueado pelo barbeiro",
        preco: 0,
        status: "bloqueado",
        criadoEm: serverTimestamp(),
      });
      if (bloquearMotivo) bloquearMotivo.value = "";
      alert(`Horário ${horario} bloqueado para ${formatarData(data)}.`);
    } catch (err) {
      console.error("Erro ao bloquear horário:", err);
      alert("Erro ao salvar bloqueio no Firestore.");
    }
  });
}

// ---------- Filtros ----------
if (filtroData) {
  filtroData.addEventListener("change", () => {
    atualizarEstatisticas(todosItens);
    renderizarLista();
  });
}

if (btnLimpar) {
  btnLimpar.addEventListener("click", () => {
    if (filtroData) filtroData.value = "";
    atualizarEstatisticas(todosItens);
    renderizarLista();
  });
}

// ---------- Sessão do Administrador ----------
onAuthStateChanged(auth, async (user) => {
  if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    mostrarPainel(true);
    iniciarPainel();
  } else {
    if (user) {
      await signOut(auth);
      alert("Apenas o e-mail administrativo tem acesso a este painel.");
    }
    painelIniciado = false;
    if (unsubscribeAgendamentos) {
      unsubscribeAgendamentos();
      unsubscribeAgendamentos = null;
    }
    mostrarPainel(false);
  }
});