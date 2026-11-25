import {
  auth,
  db,
  SERVICOS,
  HORARIOS_PADRAO,
  hojeLocal,
  formatarData,
  esc,
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos de autenticação
const authSection = document.getElementById("auth-section");
const bookingSection = document.getElementById("booking-section");
const btnLogout = document.getElementById("btn-logout");

const tabLogin = document.getElementById("tab-login");
const tabCadastro = document.getElementById("tab-cadastro");
const formLogin = document.getElementById("form-login");
const formCadastro = document.getElementById("form-cadastro");

// Elementos de agendamento
const userNameDisplay = document.getElementById("user-name-display");
const selectServico = document.getElementById("select-servico");
const inputData = document.getElementById("input-data");
const avisoData = document.getElementById("aviso-data");
const horariosGrid = document.getElementById("horarios-grid");
const btnConfirmar = document.getElementById("btn-confirmar-agendamento");
const listaMeusAgendamentos = document.getElementById("lista-meus-agendamentos");

let usuarioAtual = null;
let perfilCliente = { nome: "Cliente", telefone: "" };
let horarioSelecionado = null;
let unsubscribeMeusAgendamentos = null;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterServicoAjustado(servico) {
  if (!servico) return servico;
  const texto = `${servico.id || ""} ${servico.nome || ""}`.toLowerCase();

  if (texto.includes("corte") && (texto.includes("navalhado") || texto.includes("social") || texto.includes("degrad"))) {
    return {
      ...servico,
      valorExibicao: "R$ 30 / R$ 35",
    };
  }

  if (texto.includes("sobrancelha")) {
    return {
      ...servico,
      preco: 5,
      valorExibicao: formatarMoeda(5),
    };
  }

  return {
    ...servico,
    valorExibicao: formatarMoeda(servico.preco),
  };
}

function formatarPrecoServico(servico) {
  const ajustado = obterServicoAjustado(servico);
  return ajustado?.valorExibicao || formatarMoeda(servico?.preco);
}

// ---------- Abas Entrar / Criar Conta ----------
function alternarAba(modo) {
  const isLogin = modo === "login";
  formLogin.classList.toggle("hidden", !isLogin);
  formCadastro.classList.toggle("hidden", isLogin);

  tabLogin.classList.toggle("btn-gold", isLogin);
  tabLogin.classList.toggle("btn-outline", !isLogin);

  tabCadastro.classList.toggle("btn-gold", !isLogin);
  tabCadastro.classList.toggle("btn-outline", isLogin);
}

tabLogin.addEventListener("click", () => alternarAba("login"));
tabCadastro.addEventListener("click", () => alternarAba("cadastro"));

// ---------- Login ----------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    console.error("Erro no login:", err);
    alert("Não foi possível entrar. Verifique o e-mail e a palavra-passe.");
  }
});

// ---------- Cadastro ----------
formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("cad-nome").value.trim();
  const telefone = document.getElementById("cad-telefone").value.trim();
  const email = document.getElementById("cad-email").value.trim();
  const senha = document.getElementById("cad-senha").value;

  if (!nome || !telefone || !email || senha.length < 6) {
    alert("Preencha todos os campos corretamente (palavra-passe com pelo menos 6 caracteres).");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(cred.user, { displayName: nome });

    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nome,
      telefone,
      email,
      criadoEm: serverTimestamp(),
    });
  } catch (err) {
    console.error("Erro no cadastro:", err);
    alert("Erro ao criar conta: " + (err.message || "tente novamente."));
  }
});

// ---------- Logout ----------
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// ---------- Serviços e Data ----------
function popularServicos() {
  selectServico.innerHTML =
    `<option value="">Selecione um serviço...</option>` +
    SERVICOS.map((s) => {
      const servicoAjustado = obterServicoAjustado(s);
      return `<option value="${esc(servicoAjustado.id)}">${esc(servicoAjustado.nome)} — ${esc(servicoAjustado.valorExibicao)} (${esc(servicoAjustado.duracao)})</option>`;
    }).join("");

  // Pré-seleciona serviço caso venha pela URL (?servico=...)
  const params = new URLSearchParams(window.location.search);
  const servicoParam = params.get("servico");
  if (servicoParam) {
    const normalizado = servicoParam.toLowerCase();
    const match = Array.from(selectServico.options).find((opt) =>
      opt.textContent.toLowerCase().includes(normalizado)
    );
    if (match) selectServico.value = match.value;
  }
}

function configurarDataMinima() {
  const hoje = hojeLocal();
  inputData.min = hoje;
  if (!inputData.value) {
    inputData.value = hoje;
  }
}

// ---------- Carregar Horários no Firestore ----------
async function carregarHorarios() {
  horarioSelecionado = null;
  btnConfirmar.disabled = true;
  horariosGrid.innerHTML = "";

  const servicoId = selectServico.value;
  const data = inputData.value;

  if (!servicoId || !data) {
    avisoData.textContent = "Selecione um serviço e uma data para ver os horários.";
    return;
  }

  avisoData.textContent = "A verificar horários disponíveis...";

  try {
    const q = query(collection(db, "agendamentos"), where("data", "==", data));
    const snapshot = await getDocs(q);

    const horariosIndisponiveis = new Set();
    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      if (item.status !== "cancelado" && item.horario) {
        horariosIndisponiveis.add(item.horario);
      }
    });

    avisoData.textContent = `Horários para ${formatarData(data)}:`;

    HORARIOS_PADRAO.forEach((hora) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = hora;

      if (horariosIndisponiveis.has(hora)) {
        btn.disabled = true;
        btn.title = "Horário indisponível";
      } else {
        btn.addEventListener("click", () => {
          horarioSelecionado = hora;
          btnConfirmar.disabled = false;
          horariosGrid
            .querySelectorAll(".slot-btn")
            .forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      }

      horariosGrid.appendChild(btn);
    });
  } catch (err) {
    console.error("Erro ao carregar horários:", err);
    avisoData.textContent = "Erro ao consultar horários no Firestore.";
  }
}

// ---------- Confirmar Agendamento ----------
btnConfirmar.addEventListener("click", async () => {
  if (!usuarioAtual || !selectServico.value || !inputData.value || !horarioSelecionado) {
    return;
  }

  const servicoOriginal = SERVICOS.find((s) => s.id === selectServico.value);
  if (!servicoOriginal) return;
  const servicoObj = obterServicoAjustado(servicoOriginal);

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "A confirmar...";

  try {
    // Revalida conflito imediatamente antes de gravar
    const q = query(
      collection(db, "agendamentos"),
      where("data", "==", inputData.value),
      where("horario", "==", horarioSelecionado)
    );
    const snapConflito = await getDocs(q);
    const jaOcupado = snapConflito.docs.some((d) => d.data().status !== "cancelado");

    if (jaOcupado) {
      alert("Este horário acabou de ser reservado. Escolha outro horário.");
      await carregarHorarios();
      return;
    }

    await addDoc(collection(db, "agendamentos"), {
      clienteUid: usuarioAtual.uid,
      clienteEmail: usuarioAtual.email || "",
      clienteNome: perfilCliente.nome || usuarioAtual.displayName || "Cliente",
      clienteTelefone: perfilCliente.telefone || "",
      servicoId: servicoObj.id,
      servicoNome: servicoObj.nome,
      preco: servicoObj.preco,
      valorExibicao: servicoObj.valorExibicao,
      duracao: servicoObj.duracao,
      data: inputData.value,
      horario: horarioSelecionado,
      status: "confirmado",
      criadoEm: serverTimestamp(),
    });

    alert(`Agendamento confirmado para ${formatarData(inputData.value)} às ${horarioSelecionado}!`);
    await carregarHorarios();
  } catch (err) {
    console.error("Erro ao criar agendamento:", err);
    alert("Erro ao salvar agendamento. Tente novamente.");
  } finally {
    btnConfirmar.textContent = "Confirmar Agendamento";
    btnConfirmar.disabled = !horarioSelecionado;
  }
});

// ---------- Meus Agendamentos em Tempo Real ----------
function escutarMeusAgendamentos(uid) {
  if (unsubscribeMeusAgendamentos) {
    unsubscribeMeusAgendamentos();
    unsubscribeMeusAgendamentos = null;
  }

  const q = query(collection(db, "agendamentos"), where("clienteUid", "==", uid));

  unsubscribeMeusAgendamentos = onSnapshot(
    q,
    (snapshot) => {
      const itens = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      itens.sort((a, b) =>
        `${a.data || ""} ${a.horario || ""}`.localeCompare(`${b.data || ""} ${b.horario || ""}`)
      );

      if (!itens.length) {
        listaMeusAgendamentos.innerHTML = `<p class="text-muted">Ainda não tens agendamentos.</p>`;
        return;
      }

      listaMeusAgendamentos.innerHTML = itens
        .map((item) => {
          const podeCancelar = item.status === "confirmado";
          const precoTexto = item.valorExibicao || formatarPrecoServico(item);
          return `
            <div class="booking-item">
              <div>
                <strong style="color: var(--gold);">${esc(formatarData(item.data || ""))} às ${esc(item.horario || "")}</strong><br />
                <span>${esc(item.servicoNome || item.servicoId || "Serviço")} — ${esc(precoTexto)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="badge badge-${esc(item.status || "confirmado")}">${esc(item.status || "confirmado")}</span>
                ${
                  podeCancelar
                    ? `<button class="btn btn-danger" data-cancelar-id="${esc(item.id)}">Cancelar</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");

      listaMeusAgendamentos.querySelectorAll("[data-cancelar-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Desejas cancelar este agendamento?")) return;
          try {
            await updateDoc(doc(db, "agendamentos", btn.dataset.cancelarId), {
              status: "cancelado",
              canceladoEm: serverTimestamp(),
            });
            await carregarHorarios();
          } catch (err) {
            console.error("Erro ao cancelar:", err);
            alert("Não foi possível cancelar o agendamento.");
          }
        });
      });
    },
    (err) => {
      console.error("Erro ao ouvir agendamentos:", err);
      listaMeusAgendamentos.innerHTML = `<p class="text-muted">Erro ao carregar os teus agendamentos.</p>`;
    }
  );
}

// ---------- Observador de Sessão ----------
onAuthStateChanged(auth, async (user) => {
  usuarioAtual = user;

  if (user) {
    authSection.classList.add("hidden");
    bookingSection.classList.remove("hidden");
    btnLogout.classList.remove("hidden");

    perfilCliente = {
      nome: user.displayName || user.email?.split("@")[0] || "Cliente",
      telefone: "",
    };

    try {
      const snapPerfil = await getDoc(doc(db, "usuarios", user.uid));
      if (snapPerfil.exists()) {
        const dados = snapPerfil.data();
        perfilCliente.nome = dados.nome || perfilCliente.nome;
        perfilCliente.telefone = dados.telefone || "";
      }
    } catch (err) {
      console.warn("Perfil adicional não encontrado em usuarios:", err);
    }

    userNameDisplay.textContent = perfilCliente.nome;
    popularServicos();
    configurarDataMinima();
    escutarMeusAgendamentos(user.uid);
    await carregarHorarios();
  } else {
    if (unsubscribeMeusAgendamentos) {
      unsubscribeMeusAgendamentos();
      unsubscribeMeusAgendamentos = null;
    }
    authSection.classList.remove("hidden");
    bookingSection.classList.add("hidden");
    btnLogout.classList.add("hidden");
    listaMeusAgendamentos.innerHTML = `<p class="text-muted">A carregar os teus horários...</p>`;
  }
});

selectServico.addEventListener("change", carregarHorarios);
inputData.addEventListener("change", carregarHorarios);