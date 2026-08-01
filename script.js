/* script.js - Sistema RPG de Fichas (Versão Corrigida) */

const SENHA_MESTRE = "2510";

// Estado global da aplicação
let fichaAtualId = null;
let fichaAtualData = null;
let slotsAtuais = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let escutandoMestreRef = null;
let escutandoFichaRef = null;

// ==========================================
// INICIALIZAÇÃO E NAVEGAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    inicializarAbas();
    inicializarNavegacaoGeral();
    verificarSessaoSalva();
});

function inicializarAbas() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const tabGroup = button.closest(".tab-container, .card") || document;
            const targetTab = button.getAttribute("data-tab");
            
            tabGroup.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            tabGroup.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            
            button.classList.add("active");
            const targetElement = document.getElementById(targetTab);
            if (targetElement) {
                targetElement.classList.add("active");
            }
        });
    });
}

function inicializarNavegacaoGeral() {
    const btnEntrarJogador = document.getElementById("btn-entrar-jogador");
    const btnEntrarMestre = document.getElementById("btn-entrar-mestre");
    const btnSair = document.getElementById("btn-sair");

    if (btnEntrarJogador) {
        btnEntrarJogador.addEventListener("click", entrarComoJogador);
    }
    if (btnEntrarMestre) {
        btnEntrarMestre.addEventListener("click", entrarComoMestre);
    }
    if (btnSair) {
        btnSair.addEventListener("click", sairDaSessao);
    }
}

function verificarSessaoSalva() {
    const fichaIdSalva = localStorage.getItem("rpg_ficha_id");
    const modoMestre = localStorage.getItem("rpg_modo_mestre");

    if (modoMestre === "true") {
        abrirPainelMestre();
    } else if (fichaIdSalva) {
        carregarFichaEConectar(fichaIdSalva);
    }
}

function entrarComoJogador() {
    const inputId = document.getElementById("input-codigo-ficha");
    const codigo = inputId ? inputId.value.trim() : "";
    if (!codigo) {
        alert("Por favor, insira o código ou ID da ficha.");
        return;
    }
    localStorage.setItem("rpg_ficha_id", codigo);
    localStorage.removeItem("rpg_modo_mestre");
    carregarFichaEConectar(codigo);
}

function entrarComoMestre() {
    const inputSenha = document.getElementById("input-senha-mestre");
    const senha = inputSenha ? inputSenha.value : "";
    
    if (senha === SENHA_MESTRE) {
        localStorage.setItem("rpg_modo_mestre", "true");
        localStorage.removeItem("rpg_ficha_id");
        abrirPainelMestre();
    } else {
        alert("Senha de Mestre incorreta!");
    }
}

function sairDaSessao() {
    localStorage.removeItem("rpg_ficha_id");
    localStorage.removeItem("rpg_modo_mestre");
    
    if (escutandoFichaRef) {
        database.ref('fichas/' + fichaAtualId).off('value', escutandoFichaRef);
        escutandoFichaRef = null;
    }
    if (escutandoMestreRef) {
        database.ref('fichas').off('value', escutandoMestreRef);
        escutandoMestreRef = null;
    }

    fichaAtualId = null;
    fichaAtualData = null;

    document.getElementById("tela-login").classList.remove("hidden");
    document.getElementById("tela-ficha").classList.add("hidden");
    document.getElementById("tela-mestre").classList.add("hidden");
}

// ==========================================
// PAINEL DO MESTRE
// ==========================================

function abrirPainelMestre() {
    document.getElementById("tela-login").classList.add("hidden");
    document.getElementById("tela-ficha").classList.add("hidden");
    document.getElementById("tela-mestre").classList.remove("hidden");
    carregarPainelMestre();
}

function carregarPainelMestre() {
    const fichasRef = database.ref('fichas');
    
    // Evita acumulação de listeners (Memory Leak fix)
    if (escutandoMestreRef) {
        fichasRef.off('value', escutandoMestreRef);
    }

    escutandoMestreRef = fichasRef.on('value', (snapshot) => {
        const container = document.getElementById("lista-fichas-mestre");
        if (!container) return;
        container.innerHTML = "";
        
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = "<p>Nenhuma ficha encontrada.</p>";
            return;
        }

        Object.keys(data).forEach(id => {
            const f = data[id];
            const card = document.createElement("div");
            card.className = "mestre-card-ficha";
            card.innerHTML = `
                <h3>${f.nome || "Sem Nome"} (ID: ${id})</h3>
                <p><strong>Classe/Nível:</strong> ${f.classe || "-"} | Nv. ${f.nivel || 1}</p>
                <p><strong>PV:</strong> ${f.pvAtual || 0} / ${f.pvMax || 0} | <strong>PE:</strong> ${f.peAtual || 0} / ${f.peMax || 0}</p>
                <button onclick="carregarFichaEConectar('${id}')">Abrir Ficha</button>
            `;
            container.appendChild(card);
        });
    });
}

function mestrePassarTurnoGeral() {
    if (!confirm("Deseja passar o turno de todas as fichas no servidor?")) return;
    
    database.ref('fichas').once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(id => {
            let ficha = data[id];
            if (ficha.efeitos && Array.isArray(ficha.efeitos)) {
                let novosEfeitos = ficha.efeitos.map(e => {
                    if (e.duracao && e.duracao > 0) {
                        e.duracao -= 1;
                    }
                    return e;
                }).filter(e => e.duracao === undefined || e.duracao > 0);

                database.ref(`fichas/${id}/efeitos`).set(novosEfeitos);
            }
        });
        alert("Turno global avançado com sucesso!");
    });
}

// ==========================================
// CARREGAMENTO E SINCRONIZAÇÃO DA FICHA
// ==========================================

function carregarFichaEConectar(id) {
    fichaAtualId = id;

    if (escutandoFichaRef) {
        database.ref('fichas/' + fichaAtualId).off('value', escutandoFichaRef);
    }

    document.getElementById("tela-login").classList.add("hidden");
    document.getElementById("tela-mestre").classList.add("hidden");
    document.getElementById("tela-ficha").classList.remove("hidden");

    const ref = database.ref('fichas/' + id);
    escutandoFichaRef = ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            fichaAtualData = data;
            aplicarDadosFicha(data);
        } else {
            alert("Ficha não encontrada. Criando nova entrada...");
            const novaFicha = { nome: "Novo Personagem", nivel: 1, pvAtual: 10, pvMax: 10, peAtual: 5, peMax: 5 };
            ref.set(novaFicha);
        }
    });
}

function aplicarDadosFicha(data) {
    // Atualização de campos genéricos
    const campos = ["nome", "classe", "raca", "nivel", "pvAtual", "pvMax", "peAtual", "peMax", "defesa", "deslocamento"];
    campos.forEach(campo => {
        const el = document.getElementById(`input-${campo}`);
        if (el && data[campo] !== undefined) {
            el.value = data[campo];
        }
    });

    // Reset seguro dos Slots de Magia
    if (data.slotsMagia && Array.isArray(data.slotsMagia)) {
        slotsAtuais = [...data.slotsMagia];
    } else {
        slotsAtuais = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    renderSlotsMagia();

    // Renderizar sub-elementos
    renderEfeitos(data.efeitos || []);
    renderInventario(data.inventario || []);
    renderAnotacoes(data.anotacoes || []);
}

function salvarCampoFicha(campo, valor) {
    if (!fichaAtualId) return;
    database.ref(`fichas/${fichaAtualId}/${campo}`).set(valor);
}

function passarTurnoJogador() {
    if (!fichaAtualData) return;
    let efeitos = fichaAtualData.efeitos || [];
    
    let novosEfeitos = efeitos.map(e => {
        if (e.duracao && e.duracao > 0) {
            e.duracao -= 1;
        }
        return e;
    }).filter(e => e.duracao === undefined || e.duracao > 0);

    salvarCampoFicha("efeitos", novosEfeitos);
    alert("Seu turno foi encerrado. Efeitos temporários foram atualizados.");
}

// ==========================================
// SISTEMA DE EFEITOS E CONDIÇÕES
// ==========================================

function renderEfeitos(efeitos) {
    const container = document.getElementById("lista-efeitos");
    if (!container) return;
    container.innerHTML = "";

    efeitos.forEach((e, index) => {
        const item = document.createElement("li");
        item.className = "effect-item";
        item.innerHTML = `
            <div class="effect-item-header">
                <span><strong>[${e.cat || 'Geral'}]</strong> ${e.nome}</span>
                <div class="effect-item-controls">
                    <label>Nível: 
                        <input type="number" value="${e.nivel || 1}" min="1" style="width: 45px;" onchange="alterarNivelEfeito(${index}, this.value)">
                    </label>
                    <button onclick="removerEfeito(${index})">&times;</button>
                </div>
            </div>
            ${e.duracao !== undefined ? `<small>Duração restante: ${e.duracao} turnos</small>` : ''}
        `;
        container.appendChild(item);
    });
}

function adicionarEfeito() {
    const nomeEl = document.getElementById("novo-efeito-nome");
    const catEl = document.getElementById("novo-efeito-cat");
    const durEl = document.getElementById("novo-efeito-duracao");

    if (!nomeEl || !nomeEl.value.trim()) return;

    const novoEfeito = {
        nome: nomeEl.value.trim(),
        cat: catEl ? catEl.value : "Condição",
        nivel: 1,
        duracao: durEl && durEl.value ? parseInt(durEl.value) : undefined
    };

    let efeitos = fichaAtualData && fichaAtualData.efeitos ? [...fichaAtualData.efeitos] : [];
    efeitos.push(novoEfeito);
    salvarCampoFicha("efeitos", efeitos);

    nomeEl.value = "";
    if (durEl) durEl.value = "";
}

function alterarNivelEfeito(index, novoNivel) {
    if (!fichaAtualData || !fichaAtualData.efeitos) return;
    let efeitos = [...fichaAtualData.efeitos];
    if (efeitos[index]) {
        efeitos[index].nivel = parseInt(novoNivel) || 1;
        salvarCampoFicha("efeitos", efeitos);
    }
}

function removerEfeito(index) {
    if (!fichaAtualData || !fichaAtualData.efeitos) return;
    let efeitos = [...fichaAtualData.efeitos];
    efeitos.splice(index, 1);
    salvarCampoFicha("efeitos", efeitos);
}

// ==========================================
// SISTEMA DE MAGIA & SLOTS
// ==========================================

function renderSlotsMagia() {
    const container = document.getElementById("slots-magia-container");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < 9; i++) {
        const slotDiv = document.createElement("div");
        slotDiv.className = "slot-magia-item";
        slotDiv.innerHTML = `
            <span>Circulo ${i + 1}: </span>
            <input type="number" min="0" value="${slotsAtuais[i] || 0}" onchange="atualizarSlotMagia(${i}, this.value)">
        `;
        container.appendChild(slotDiv);
    }
}

function atualizarSlotMagia(circuloIndex, valor) {
    slotsAtuais[circuloIndex] = parseInt(valor) || 0;
    salvarCampoFicha("slotsMagia", slotsAtuais);
}

// ==========================================
// INVENTÁRIO & ITENS
// ==========================================

function renderInventario(itens) {
    const container = document.getElementById("lista-inventario");
    if (!container) return;
    container.innerHTML = "";

    itens.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "item-inventario-card";
        div.innerHTML = `
            <h4>${item.nome} (${item.qtd || 1}x)</h4>
            <p>${item.descricao || ''}</p>
            ${item.imagem ? `<img src="${item.imagem}" style="max-width:100px; display:block; margin: 5px 0;">` : ''}
            <button onclick="removerItemInventario(${index})">Remover</button>
        `;
        container.appendChild(div);
    });
}

function criarItem() {
    const nomeEl = document.getElementById("item-nome");
    const qtdEl = document.getElementById("item-qtd");
    const descEl = document.getElementById("item-desc");
    const imgEl = document.getElementById("item-img");

    if (!nomeEl || !nomeEl.value.trim()) {
        alert("Preencha o nome do item!");
        return;
    }

    const processarEnvio = (imagemBase64 = null) => {
        const novoItem = {
            nome: nomeEl.value.trim(),
            qtd: parseInt(qtdEl.value) || 1,
            descricao: descEl ? descEl.value : "",
            imagem: imagemBase64
        };

        let inventario = fichaAtualData && fichaAtualData.inventario ? [...fichaAtualData.inventario] : [];
        inventario.push(novoItem);
        salvarCampoFicha("inventario", inventario);

        nomeEl.value = "";
        if (qtdEl) qtdEl.value = "1";
        if (descEl) descEl.value = "";
        if (imgEl) imgEl.value = "";
    };

    if (imgEl && imgEl.files && imgEl.files[0]) {
        const file = imgEl.files[0];
        if (file.size > 500000) { // Limitador de tamanho ~500kb
            alert("Imagem muito grande! Selecione uma imagem de até 500KB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            processarEnvio(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        processarEnvio();
    }
}

function removerItemInventario(index) {
    if (!fichaAtualData || !fichaAtualData.inventario) return;
    let inventario = [...fichaAtualData.inventario];
    inventario.splice(index, 1);
    salvarCampoFicha("inventario", inventario);
}

// ==========================================
// BLOCO DE ANOTAÇÕES
// ==========================================

function renderAnotacoes(blocos) {
    const container = document.getElementById("container-anotacoes");
    if (!container) return;
    container.innerHTML = "";

    blocos.forEach((bloco, index) => {
        const div = document.createElement("div");
        div.className = "bloco-anotacao-card";
        div.innerHTML = `
            <input type="text" value="${bloco.titulo || ''}" placeholder="Título" onchange="atualizarAnotacao(${index}, 'titulo', this.value)">
            <textarea placeholder="Anotações..." onchange="atualizarAnotacao(${index}, 'texto', this.value)">${bloco.texto || ''}</textarea>
            <button onclick="removerBlocoAnotacao(${index})">Excluir Bloco</button>
        `;
        container.appendChild(div);
    });
}

function criarBlocoAnotacao() {
    let anotacoes = fichaAtualData && fichaAtualData.anotacoes ? [...fichaAtualData.anotacoes] : [];
    anotacoes.push({ titulo: "Nova Anotação", texto: "" });
    salvarCampoFicha("anotacoes", anotacoes);
}

function atualizarAnotacao(index, campo, valor) {
    if (!fichaAtualData || !fichaAtualData.anotacoes) return;
    let anotacoes = [...fichaAtualData.anotacoes];
    if (anotacoes[index]) {
        anotacoes[index][campo] = valor;
        salvarCampoFicha("anotacoes", anotacoes);
    }
}

function removerBlocoAnotacao(index) {
    if (!fichaAtualData || !fichaAtualData.anotacoes) return;
    let anotacoes = [...fichaAtualData.anotacoes];
    anotacoes.splice(index, 1);
    salvarCampoFicha("anotacoes", anotacoes);
}
