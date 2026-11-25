document.addEventListener("DOMContentLoaded", () => {
    const topo = document.getElementById("topo");
    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    // Abre e fecha o menu no celular
    const setMenu = (aberto) => {
        navLinks.classList.toggle("active", aberto);
        menuToggle.setAttribute("aria-expanded", String(aberto));
        menuToggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
        menuToggle.querySelector("i").className = aberto ? "fas fa-xmark" : "fas fa-bars";
    };

    menuToggle.addEventListener("click", () => {
        setMenu(!navLinks.classList.contains("active"));
    });

    // Fecha o menu ao clicar em um link ou apertar Esc
    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => setMenu(false));
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setMenu(false);
    });

    // Barra de navegação ganha fundo ao rolar a página
    const aoRolar = () => topo.classList.toggle("rolou", window.scrollY > 30);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });

    // Se uma foto não existir na pasta imagens, mostra um bloco no lugar
   document.querySelectorAll(".galeria img, .sobre-foto img").forEach((img) => {
    img.addEventListener("error", () => {
        img.src = "imagens/WhatsApp Image 2026-11-05 at 21.35.58.jpeg";
    }, { once: true });
});

    // Destaca o dia de hoje na tabela de horários
    const hoje = document.querySelector(`.horarios tr[data-dia="${new Date().getDay()}"]`);
    if (hoje) {
        hoje.classList.add("hoje");
        const celulaDia = hoje.querySelector("th");
        const tag = document.createElement("span");
        tag.className = "tag-hoje";
        tag.textContent = "hoje";
        celulaDia.appendChild(tag);
    }

    // Busca e ordenação da lista de serviços
    const lista = document.getElementById("lista-servicos");
    const busca = document.getElementById("busca-servico");
    const ordem = document.getElementById("ordem-servico");
    const vazio = document.getElementById("servicos-vazio");

    if (lista && busca && ordem) {
        const itens = Array.from(lista.querySelectorAll(".preco-item"));
        const normalizar = (t) =>
            t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        const atualizar = () => {
            const termo = normalizar(busca.value);
            const criterios = {
                padrao: (a, b) => a.dataset.ordem - b.dataset.ordem,
                menor: (a, b) => a.dataset.preco - b.dataset.preco || a.dataset.ordem - b.dataset.ordem,
                maior: (a, b) => b.dataset.preco - a.dataset.preco || a.dataset.ordem - b.dataset.ordem,
                nome: (a, b) => a.dataset.nome.localeCompare(b.dataset.nome, "pt-BR"),
            };

            itens.sort(criterios[ordem.value]).forEach((item) => lista.appendChild(item));

            let visiveis = 0;
            itens.forEach((item) => {
                const mostrar = normalizar(item.dataset.nome).includes(termo);
                item.hidden = !mostrar;
                if (mostrar) visiveis++;
            });
            vazio.hidden = visiveis > 0;
        };

        busca.addEventListener("input", atualizar);
        ordem.addEventListener("change", atualizar);
    }

    // Ano atual no rodapé
    document.getElementById("ano").textContent = new Date().getFullYear();
});