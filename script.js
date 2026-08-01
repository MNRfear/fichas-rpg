/* ==========================================================================
   CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDmO4b4K_5K9UjMA7sOM99hHlj5kxuYbis",
  authDomain: "meu-rpg-fichas-86b00.firebaseapp.com",
  databaseURL: "https://meu-rpg-fichas-86b00-default-rtdb.firebaseio.com",
  projectId: "meu-rpg-fichas-86b00",
  storageBucket: "meu-rpg-fichas-86b00.firebasestorage.app",
  messagingSenderId: "869128398165",
  appId: "1:869128398165:web:ba35bbd104b6cb4733fbdc"
};

// Inicializa o Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

const SENHA_MESTRE = "2510"; // Altere para a senha desejada

// Estado Global da Aplicação
let fichaAtualId = null;
let fichaAtualData = null;
let modoAcessoAtual = 'player';
let buffsItemTemp = [];
let buffsGmEffectTemp = [];
let escutandoMestreRef = null;
let escutandoFichaRef = null;

// Perícias do sistema e seus atributos de base
const LISTA_PERICIAS = [
  { nome: "Acrobacia", attr: "agilidade" },
  { nome: "Adestramento", attr: "carisma" },
  { nome: "Artes", attr: "presenca" },
  { nome: "Atletismo", attr: "forca" },
  { nome: "Atualidades", attr: "inteligencia" },
  { nome: "Ciência", attr: "inteligencia" },
  { nome: "Crime", attr: "agilidade" },
  { nome: "Diplomacia", attr: "carisma" },
  { nome: "Enganação", attr: "carisma" },
  { nome: "Fortitude", attr: "vigor" },
  { nome: "Furtividade", attr: "agilidade" },
  { nome: "Intimidação", attr: "presenca" },
  { nome: "Intuição", attr: "presenca" },
  { nome: "Investigação", attr: "inteligencia" },
  { nome: "Luta", attr: "forca" },
  { nome: "Medicina", attr: "inteligencia" },
  { nome: "Ocultismo", attr: "inteligencia" },
  { nome: "Percepção", attr: "presenca" },
  { nome: "Pilotagem", attr: "agilidade" },
  { nome: "Pontaria", attr: "agilidade" },
  { nome: "Reflexos", attr: "agilidade" },
  { nome: "Religião", attr: "presenca" },
  { nome: "Sobrevivência", attr: "inteligencia" },
  { nome: "Vontade", attr: "presenca" }
];

/* ==========================================================================
   INICIALIZAÇÃO & GERENCIAMENTO DE TELAS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  preencherSelectsDeBuffs();
  gerarGridPericias();
  verificarSessaoSalva();
  escutarEfeitosGlobaisMestre();
});

function setModoAcesso(modo) {
  modoAcessoAtual = modo;
  const btnPlayer = document.getElementById("btn-mode-player");
  const btnGm = document.getElementById("btn-mode-gm");
  const panelPlayer = document.getElementById("panel-player");
  const panelGm = document.getElementById("panel-gm");

  if (modo === 'player') {
    btnPlayer.classList.add("active");
    btnGm.classList.remove("active");
    panelPlayer.classList.add("active");
    panelGm.classList.remove("active");
  } else {
    btnGm.classList.add("active");
    btnPlayer.classList.remove("active");
    panelGm.classList.add("active");
    panelPlayer.classList.remove("active");
  }
}

function trocarTela(idTela) {
  document.querySelectorAll(".screen-container").forEach(el => el.classList.remove("active"));
  const telaDestino = document.getElementById(idTela);
  if (telaDestino) telaDestino.classList.add("active");
}

function verificarSessaoSalva() {
  const fichaSalva = localStorage.getItem("rpg_ficha_id");
  const modoMestre = localStorage.getItem("rpg_modo_mestre");

  if (modoMestre === "true") {
    entrarComoMestre(true);
  } else if (fichaSalva) {
    document.getElementById("input-player-id").value = fichaSalva;
    entrarComoJogador();
  } else {
    trocarTela("screen-select");
  }
}

function voltarParaSelecao() {
  if (escutandoFichaRef && fichaAtualId) {
    database.ref('fichas/' + fichaAtualId).off('value', escutandoFichaRef);
    escutandoFichaRef = null;
  }
  fichaAtualId = null;
  fichaAtualData = null;
  localStorage.removeItem("rpg_ficha_id");
  localStorage.removeItem("rpg_modo_mestre");
  document.getElementById("badge-gm-view").style.display = "none";
  trocarTela("screen-select");
}

/* ==========================================================================
   AUTENTICAÇÃO & CONEXÃO (JOGADOR E MESTRE)
   ========================================================================== */
function entrarComoJogador() {
  const inputId = document.getElementById("input-player-id");
  const id = inputId.value.trim();

  if (!id) {
    alert("Digite o nome ou ID do personagem!");
    return;
  }

  fichaAtualId = id;
  localStorage.setItem("rpg_ficha_id", id);
  localStorage.removeItem("rpg_modo_mestre");

  document.getElementById("label-ficha-ativa").innerText = `Editando Ficha: ${id}`;
  document.getElementById("badge-gm-view").style.display = "none";

  conectarFicha(id);
  trocarTela("screen-sheet");
}

function entrarComoMestre(autoLogin = false) {
  if (!autoLogin) {
    const pass = document.getElementById("input-gm-pass").value;
    if (pass !== SENHA_MESTRE) {
      alert("Senha de Mestre incorreta!");
      return;
    }
  }

  localStorage.setItem("rpg_modo_mestre", "true");
  localStorage.removeItem("rpg_ficha_id");

  carregarDashboardMestre();
  trocarTela("screen-gm-dashboard");
}

function abrirFichaComoMestre(idFicha) {
  fichaAtualId = idFicha;
  document.getElementById("label-ficha-ativa").innerText = `Inspecionando: ${idFicha}`;
  document.getElementById("badge-gm-view").style.display = "inline-block";

  conectarFicha(idFicha);
  trocarTela("screen-sheet");
}

/* ==========================================================================
   BANCO DE DADOS EM TEMPO REAL (FIREBASE)
   ========================================================================== */
function conectarFicha(id) {
  const ref = database.ref('fichas/' + id);

  if (escutandoFichaRef) ref.off('value', escutandoFichaRef);

  escutandoFichaRef = ref.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      fichaAtualData = data;
      carregarDadosFichaNaTela(data);
    } else {
      // Cria uma ficha inicial por padrão
      const fichaInicial = getEstruturaFichaPadrao(id);
      ref.set(fichaInicial);
    }
  });
}

function getEstruturaFichaPadrao(nome) {
  return {
    nome: nome,
    classeBase: "Combatente",
    nivel: 1,
    nex: "20%",
    idade: 18,
    origem: "Nenhuma",
    raca: "Humano",
    genero: "Outro",
    sexualidade: "Outro",
    classeAdd: "",
    traco: "",
    traumas: "",
    expAtual: 0,
    pvAtual: 20,
    sanAtual: 15,
    peAtual: 10,
    maAtual: 0,
    tpVal: 0,
    defesasEspecificas: {},
    atributos: { forca: 10, agilidade: 10, vigor: 10, inteligencia: 10, presenca: 10, carisma: 10, sorte: 10 },
    pericias: {},
    raridades: {},
    skillsTexto: "",
    feiticosTexto: "",
    rituaisTexto: "",
    slotsMagia: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    inventario: [],
    equipados: [],
    efeitosAtivos: [],
    anotacoes: []
  };
}

function salvarDados() {
  if (!fichaAtualId) return;

  const dataAtualizada = {
    ...fichaAtualData,
    classeBase: document.getElementById("classe-base").value,
    nivel: parseInt(document.getElementById("nivel").value) || 1,
    nex: document.getElementById("nex").value,
    idade: parseInt(document.getElementById("idade").value) || 0,
    nome: document.getElementById("nome").value,
    origem: document.getElementById("origem").value,
    raca: document.getElementById("raca").value,
    genero: document.getElementById("genero").value,
    sexualidade: document.getElementById("sexualidade").value,
    classeAdd: document.getElementById("classe-add").value,
    traco: document.getElementById("traco").value,
    traumas: document.getElementById("traumas").value,
    pvAtual: parseInt(document.getElementById("pv-atual").value) || 0,
    sanAtual: parseInt(document.getElementById("san-atual").value) || 0,
    peAtual: parseInt(document.getElementById("pe-atual").value) || 0,
    maAtual: parseInt(document.getElementById("ma-atual").value) || 0,
    tpVal: parseInt(document.getElementById("tp-val").value) || 0,
    
    defesasEspecificas: {
      perfuracao: parseInt(document.getElementById("def-perfuracao").value) || 0,
      queimadura: parseInt(document.getElementById("def-queimadura").value) || 0,
      corte: parseInt(document.getElementById("def-corte").value) || 0,
      impacto: parseInt(document.getElementById("def-impacto").value) || 0,
      balistico: parseInt(document.getElementById("def-balistico").value) || 0,
      eletricidade: parseInt(document.getElementById("def-eletricidade").value) || 0,
      fogo: parseInt(document.getElementById("def-fogo").value) || 0,
      frio: parseInt(document.getElementById("def-frio").value) || 0,
      acido: parseInt(document.getElementById("def-acido").value) || 0,
      veneno: parseInt(document.getElementById("def-veneno").value) || 0,
      magico: parseInt(document.getElementById("def-magico").value) || 0,
    },
    atributos: {
      forca: parseInt(document.getElementById("attr-forca").value) || 0,
      agilidade: parseInt(document.getElementById("attr-agilidade").value) || 0,
      vigor: parseInt(document.getElementById("attr-vigor").value) || 0,
      inteligencia: parseInt(document.getElementById("attr-inteligencia").value) || 0,
      presenca: parseInt(document.getElementById("attr-presenca").value) || 0,
      carisma: parseInt(document.getElementById("attr-carisma").value) || 0,
      sorte: parseInt(document.getElementById("attr-sorte").value) || 0,
    },
    raridades: {
      unicas: document.getElementById("hab-unicas").value,
      lendarias: document.getElementById("hab-lendarias").value,
      epicas: document.getElementById("hab-epicas").value,
      raras: document.getElementById("hab-raras").value,
      incomuns: document.getElementById("hab-incomuns").value,
      comuns: document.getElementById("hab-comuns").value,
    },
    skillsTexto: document.getElementById("skills-texto").value,
    feiticosTexto: document.getElementById("feiticos-texto").value,
    rituaisTexto: document.getElementById("rituais-texto").value
  };

  // Coleta valores das perícias
  LISTA_PERICIAS.forEach(p => {
    const input = document.getElementById(`pericia-val-${p.nome}`);
    if (input) {
      if (!dataAtualizada.pericias) dataAtualizada.pericias = {};
      dataAtualizada.pericias[p.nome] = parseInt(input.value) || 0;
    }
  });

  database.ref('fichas/' + fichaAtualId).set(dataAtualizada);
}

function carregarDadosFichaNaTela(d) {
  setInputValue("classe-base", d.classeBase || "Combatente");
  setInputValue("nivel", d.nivel || 1);
  setInputValue("nex", d.nex || "20%");
  setInputValue("idade", d.idade || 18);
  setInputValue("nome", d.nome || "");
  setInputValue("origem", d.origem || "");
  setInputValue("raca", d.raca || "");
  setInputValue("genero", d.genero || "");
  setInputValue("sexualidade", d.sexualidade || "");
  setInputValue("classe-add", d.classeAdd || "");
  setInputValue("traco", d.traco || "");
  setInputValue("traumas", d.traumas || "");

  setInputValue("pv-atual", d.pvAtual || 0);
  setInputValue("san-atual", d.sanAtual || 0);
  setInputValue("pe-atual", d.peAtual || 0);
  setInputValue("ma-atual", d.maAtual || 0);
  setInputValue("tp-val", d.tpVal || 0);

  if (d.defesasEspecificas) {
    setInputValue("def-perfuracao", d.defesasEspecificas.perfuracao || 0);
    setInputValue("def-queimadura", d.defesasEspecificas.queimadura || 0);
    setInputValue("def-corte", d.defesasEspecificas.corte || 0);
    setInputValue("def-impacto", d.defesasEspecificas.impacto || 0);
    setInputValue("def-balistico", d.defesasEspecificas.balistico || 0);
    setInputValue("def-eletricidade", d.defesasEspecificas.eletricidade || 0);
    setInputValue("def-fogo", d.defesasEspecificas.fogo || 0);
    setInputValue("def-frio", d.defesasEspecificas.frio || 0);
    setInputValue("def-acido", d.defesasEspecificas.acido || 0);
    setInputValue("def-veneno", d.defesasEspecificas.veneno || 0);
    setInputValue("def-magico", d.defesasEspecificas.magico || 0);
  }

  if (d.atributos) {
    setInputValue("attr-forca", d.atributos.forca || 10);
    setInputValue("attr-agilidade", d.atributos.agilidade || 10);
    setInputValue("attr-vigor", d.atributos.vigor || 10);
    setInputValue("attr-inteligencia", d.atributos.inteligencia || 10);
    setInputValue("attr-presenca", d.atributos.presenca || 10);
    setInputValue("attr-carisma", d.atributos.carisma || 10);
    setInputValue("attr-sorte", d.atributos.sorte || 10);
  }

  if (d.pericias) {
    LISTA_PERICIAS.forEach(p => {
      setInputValue(`pericia-val-${p.nome}`, d.pericias[p.nome] || 0);
    });
  }

  if (d.raridades) {
    setInputValue("hab-unicas", d.raridades.unicas || "");
    setInputValue("hab-lendarias", d.raridades.lendarias || "");
    setInputValue("hab-epicas", d.raridades.epicas || "");
    setInputValue("hab-raras", d.raridades.raras || "");
    setInputValue("hab-incomuns", d.raridades.incomuns || "");
    setInputValue("hab-comuns", d.raridades.comuns || "");
  }

  setInputValue("skills-texto", d.skillsTexto || "");
  setInputValue("feiticos-texto", d.feiticosTexto || "");
  setInputValue("rituais-texto", d.rituaisTexto || "");

  // Atualizações dinâmicas na interface
  renderExpDisplay(d.expAtual || 0, d.nivel || 1);
  recalcularTudo(false);
  renderInventarioEEquipamentos(d.inventario || [], d.equipados || []);
  renderEfeitosFicha(d.efeitosAtivos || []);
  renderAnotacoesFicha(d.anotacoes || []);
  renderSlotsMagia(d.slotsMagia || [0,0,0,0,0,0,0,0,0]);
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* ==========================================================================
   CÁLCULOS E REGRA DE NEGÓCIO DA FICHA
   ========================================================================== */
function recalcularTudo(salvar = true) {
  const niv = parseInt(document.getElementById("nivel").value) || 1;
  const vigor = parseInt(document.getElementById("attr-vigor").value) || 10;
  const presenca = parseInt(document.getElementById("attr-presenca").value) || 10;
  const agilidade = parseInt(document.getElementById("attr-agilidade").value) || 10;
  const classe = document.getElementById("classe-base").value;

  let basePV = 10, pvPorNivel = 2;
  let basePE = 5, pePorNivel = 1;
  let baseSAN = 10, sanPorNivel = 2;
  let baseMA = 0, maPorNivel = 0;

  if (classe === "Combatente") {
    basePV = 20; pvPorNivel = 4;
    basePE = 6; pePorNivel = 2;
    baseSAN = 12; sanPorNivel = 2;
  } else if (classe === "Especialista") {
    basePV = 16; pvPorNivel = 3;
    basePE = 10; pePorNivel = 3;
    baseSAN = 16; sanPorNivel = 3;
  } else if (classe === "Místico") {
    basePV = 12; pvPorNivel = 2;
    basePE = 12; pePorNivel = 4;
    baseSAN = 20; sanPorNivel = 4;
    baseMA = 10; maPorNivel = 5;
  }

  // Cálculos de Máximos
  const maxPV = basePV + (vigor - 10) + ((niv - 1) * pvPorNivel);
  const maxSAN = baseSAN + ((niv - 1) * sanPorNivel);
  const maxPE = basePE + (presenca - 10) + ((niv - 1) * pePorNivel);
  const maxMA = baseMA + ((niv - 1) * maPorNivel);

  document.getElementById("pv-max").value = Math.max(1, maxPV);
  document.getElementById("san-max").value = Math.max(1, maxSAN);
  document.getElementById("pe-max").value = Math.max(1, maxPE);
  document.getElementById("ma-max").value = Math.max(0, maxMA);

  // Defesa e Evasão
  const defesaBase = 10 + Math.floor((agilidade - 10) / 2);
  document.getElementById("def-val").value = defesaBase;
  document.getElementById("eva-val").value = defesaBase + 5;

  // Deslocamento
  document.getElementById("deslocamento-val").value = `${9 + Math.floor((agilidade - 10) / 2)}m`;

  atualizarCargaEBonus();

  if (salvar) salvarDados();
}

function formatarNEX(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (!val) val = "0";
  el.value = val + "%";
  salvarDados();
}

/* ==========================================================================
   PERÍCIAS & NAVEGAÇÃO ENTRE ABAS
   ========================================================================== */
function gerarGridPericias() {
  const grid = document.getElementById("grid-pericias");
  if (!grid) return;
  grid.innerHTML = "";

  LISTA_PERICIAS.forEach(p => {
    const card = document.createElement("div");
    card.className = "card-pericia";
    card.innerHTML = `
      <label>${p.nome} <small>(${p.attr.substring(0,3).toUpperCase()})</small></label>
      <div class="card-pericia-inputs">
        <input type="number" id="pericia-val-${p.nome}" value="0" onchange="salvarDados()">
        <span class="bonus-tag" id="pericia-tag-${p.nome}">+0</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openTab(tabId, event) {
  const container = event.target.closest(".screen-container");
  container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  container.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(`tab-${tabId}`).classList.add("active");
}

function openSubTab(subTabId, event) {
  const parent = event.target.closest(".tab-content");
  parent.querySelectorAll(".sub-tab-btn").forEach(b => b.classList.remove("active"));
  parent.querySelectorAll(".sub-tab-content").forEach(c => c.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(`subtab-${subTabId}`).classList.add("active");
}

function toggleDefesaTooltip(e) {
  e.stopPropagation();
  const box = document.getElementById("defensa-tooltip-box");
  box.classList.toggle("active");
}

/* ==========================================================================
   SISTEMA DE XP & MODAL
   ========================================================================== */
function renderExpDisplay(exp, niv) {
  const expNec = niv * 100;
  document.getElementById("exp-display").value = `${exp} / ${expNec}`;
}

function abrirModalXP() {
  document.getElementById("modal-xp").classList.add("active");
}

function fecharModalXP() {
  document.getElementById("modal-xp").classList.remove("active");
}

function somarXPInput(val) {
  const inp = document.getElementById("xp-input-val");
  inp.value = (parseInt(inp.value) || 0) + val;
}

function confirmarGanhoXP() {
  const val = parseInt(document.getElementById("xp-input-val").value) || 0;
  if (!fichaAtualData) return;

  let novoExp = (fichaAtualData.expAtual || 0) + val;
  let nivelAtual = fichaAtualData.nivel || 1;
  let expNecessario = nivelAtual * 100;

  while (novoExp >= expNecessario) {
    novoExp -= expNecessario;
    nivelAtual++;
    expNecessario = nivelAtual * 100;
  }

  fichaAtualData.expAtual = novoExp;
  fichaAtualData.nivel = nivelAtual;
  document.getElementById("nivel").value = nivelAtual;

  salvarDados();
  fecharModalXP();
  document.getElementById("xp-input-val").value = "";
}

/* ==========================================================================
   SISTEMA DE SLOTS DE MAGIA
   ========================================================================== */
function recalcularSlotsMagia() {
  renderSlotsMagia(fichaAtualData ? fichaAtualData.slotsMagia : [0,0,0,0,0,0,0,0,0]);
}

function renderSlotsMagia(slotsArr) {
  const grid = document.getElementById("circulos-grid");
  if (!grid) return;
  grid.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const qtd = slotsArr[i] || 0;
    const card = document.createElement("div");
    card.className = "circulo-card";
    card.innerHTML = `
      <div class="circulo-info">${i + 1}º Círculo: <strong>${qtd} Slots</strong></div>
      <div class="circulo-controles">
        <button type="button" class="btn-slot" onclick="alterarSlotMagia(${i}, -1)">-</button>
        <button type="button" class="btn-slot" onclick="alterarSlotMagia(${i}, 1)">+</button>
      </div>
    `;
    grid.appendChild(card);
  }
}

function alterarSlotMagia(index, delta) {
  let slots = fichaAtualData && fichaAtualData.slotsMagia ? [...fichaAtualData.slotsMagia] : [0,0,0,0,0,0,0,0,0];
  slots[index] = Math.max(0, (slots[index] || 0) + delta);
  fichaAtualData.slotsMagia = slots;
  database.ref(`fichas/${fichaAtualId}/slotsMagia`).set(slots);
}

function restaurarSlotsDescanso() {
  const slots = [4, 3, 3, 2, 1, 0, 0, 0, 0]; // Exemplo de recuperação total
  database.ref(`fichas/${fichaAtualId}/slotsMagia`).set(slots);
}

function zerarTodosSlots() {
  const slots = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  database.ref(`fichas/${fichaAtualId}/slotsMagia`).set(slots);
}

/* ==========================================================================
   INVENTÁRIO & BUFFS
   ========================================================================== */
function preencherSelectsDeBuffs() {
  const selectItem = document.getElementById("buff-alvo");
  const selectGm = document.getElementById("gm-effect-buff-alvo");
  if (!selectItem || !selectGm) return;

  const opcoes = ["Força", "Agilidade", "Vigor", "Inteligência", "Presença", "Carisma", "Sorte", ...LISTA_PERICIAS.map(p => p.nome)];
  
  const htmlStr = opcoes.map(o => `<option value="${o}">${o}</option>`).join('');
  selectItem.innerHTML = htmlStr;
  selectGm.innerHTML = htmlStr;
}

function adicionarBuffItemTemp() {
  const alvo = document.getElementById("buff-alvo").value;
  const val = parseInt(document.getElementById("buff-valor").value) || 0;

  buffsItemTemp.push({ alvo, valor: val });
  renderBuffsTagsTemp("lista-buffs-temp", buffsItemTemp);
}

function renderBuffsTagsTemp(containerId, arrayBuffs) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  arrayBuffs.forEach((b, idx) => {
    const tag = document.createElement("div");
    tag.className = "buff-tag";
    tag.innerHTML = `${b.alvo}: ${b.valor > 0 ? '+' : ''}${b.valor} <span onclick="removerBuffTemp('${containerId}', ${idx})">&times;</span>`;
    container.appendChild(tag);
  });
}

function removerBuffTemp(containerId, idx) {
  if (containerId === "lista-buffs-temp") {
    buffsItemTemp.splice(idx, 1);
    renderBuffsTagsTemp(containerId, buffsItemTemp);
  } else {
    buffsGmEffectTemp.splice(idx, 1);
    renderBuffsTagsTemp(containerId, buffsGmEffectTemp);
  }
}

function criarItem() {
  const nome = document.getElementById("item-nome").value.trim();
  const qtd = parseInt(document.getElementById("item-qtd").value) || 1;
  const carga = parseFloat(document.getElementById("item-carga").value) || 0;
  const isMochila = document.getElementById("item-is-mochila").checked;
  const bonusCarga = parseFloat(document.getElementById("item-bonus-carga").value) || 0;
  const desc = document.getElementById("item-desc").value;
  const imgInput = document.getElementById("item-img-input");

  if (!nome) {
    alert("Insira o nome do item!");
    return;
  }

  const salvarItemObjeto = (imgBase64 = null) => {
    const novoItem = {
      id: Date.now().toString(),
      nome, qtd, carga, isMochila, bonusCarga, desc,
      buffs: [...buffsItemTemp],
      img: imgBase64
    };

    let inventario = fichaAtualData && fichaAtualData.inventario ? [...fichaAtualData.inventario] : [];
    inventario.push(novoItem);

    database.ref(`fichas/${fichaAtualId}/inventario`).set(inventario);

    // Reset formulário
    document.getElementById("item-nome").value = "";
    document.getElementById("item-desc").value = "";
    buffsItemTemp = [];
    renderBuffsTagsTemp("lista-buffs-temp", buffsItemTemp);
  };

  if (imgInput.files && imgInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => salvarItemObjeto(e.target.result);
    reader.readAsDataURL(imgInput.files[0]);
  } else {
    salvarItemObjeto();
  }
}

function renderInventarioEEquipamentos(inventario, equipados) {
  const listInv = document.getElementById("lista-inventario");
  const listEqp = document.getElementById("lista-equipamentos");
  if (!listInv || !listEqp) return;

  listInv.innerHTML = "";
  listEqp.innerHTML = "";

  inventario.forEach((item, index) => {
    listInv.appendChild(gerarCardItemHTML(item, index, false));
  });

  equipados.forEach((item, index) => {
    listEqp.appendChild(gerarCardItemHTML(item, index, true));
  });

  atualizarCargaEBonus();
}

function gerarCardItemHTML(item, index, isEquipado) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.innerHTML = `
    <div class="item-card-header">
      <span>${item.nome} (${item.carga} Kg)</span>
      <div class="item-inputs">
        <label>Qtd: ${item.qtd}</label>
        ${isEquipado ? 
          `<button type="button" class="btn-sub" onclick="desequiparItem(${index})">Desequipar</button>` :
          `<button type="button" class="btn-success" onclick="equiparItem(${index})">Equipar</button>`
        }
        <button type="button" class="btn-danger" onclick="removerItem(${index}, ${isEquipado})">&times;</button>
      </div>
    </div>
    <div class="item-card-body">
      ${item.img ? `<img src="${item.img}" class="item-img-preview">` : ''}
      <p style="font-size:0.85rem; color:#a8a8b3;">${item.desc || 'Sem descrição.'}</p>
    </div>
  `;
  return card;
}

function equiparItem(index) {
  let inv = [...(fichaAtualData.inventario || [])];
  let eqp = [...(fichaAtualData.equipados || [])];

  const item = inv.splice(index, 1)[0];
  eqp.push(item);

  database.ref(`fichas/${fichaAtualId}`).update({ inventario: inv, equipados: eqp });
}

function desequiparItem(index) {
  let inv = [...(fichaAtualData.inventario || [])];
  let eqp = [...(fichaAtualData.equipados || [])];

  const item = eqp.splice(index, 1)[0];
  inv.push(item);

  database.ref(`fichas/${fichaAtualId}`).update({ inventario: inv, equipados: eqp });
}

function removerItem(index, isEquipado) {
  if (isEquipado) {
    let eqp = [...(fichaAtualData.equipados || [])];
    eqp.splice(index, 1);
    database.ref(`fichas/${fichaAtualId}/equipados`).set(eqp);
  } else {
    let inv = [...(fichaAtualData.inventario || [])];
    inv.splice(index, 1);
    database.ref(`fichas/${fichaAtualId}/inventario`).set(inv);
  }
}

function atualizarCargaEBonus() {
  const forca = parseInt(document.getElementById("attr-forca").value) || 10;
  const cargaBaseMax = forca * 2;

  let cargaAtual = 0;
  let cargaExtraTot = 0;

  const todosItens = [...(fichaAtualData?.inventario || []), ...(fichaAtualData?.equipados || [])];
  const equipados = fichaAtualData?.equipados || [];

  todosItens.forEach(item => {
    cargaAtual += (item.carga || 0) * (item.qtd || 1);
  });

  equipados.forEach(item => {
    if (item.isMochila) cargaExtraTot += (item.bonusCarga || 0);
  });

  document.getElementById("carga-atual").innerText = cargaAtual.toFixed(1);
  document.getElementById("carga-base-max").innerText = cargaBaseMax;
  document.getElementById("carga-extra-display").innerText = `+ ${cargaExtraTot} Kg`;

  const bar = document.getElementById("carga-bar-container");
  if (cargaAtual > (cargaBaseMax + cargaExtraTot)) {
    bar.classList.add("carga-excedida");
  } else {
    bar.classList.remove("carga-excedida");
  }
}

/* ==========================================================================
   EFEITOS DE STATUS & CONDIÇÕES
   ========================================================================== */
function passarTurnoJogador() {
  if (!fichaAtualData) return;
  let efeitos = fichaAtualData.efeitosAtivos || [];

  let novosEfeitos = efeitos.map(e => {
    if (e.duracao && e.duracao > 0) e.duracao -= 1;
    return e;
  }).filter(e => e.duracao === undefined || e.duracao > 0);

  database.ref(`fichas/${fichaAtualId}/efeitosAtivos`).set(novosEfeitos);
  alert("Turno finalizado. Efeitos de duração foram reduzidos!");
}

function renderEfeitosFicha(efeitos) {
  const lista = document.getElementById("lista-efeitos");
  if (!lista) return;
  lista.innerHTML = "";

  efeitos.forEach((ef, idx) => {
    const li = document.createElement("li");
    li.className = "effect-item";
    li.innerHTML = `
      <div class="effect-item-header">
        <strong>[${ef.cat}] ${ef.nome}</strong>
        <button type="button" class="btn-danger" onclick="removerEfeitoFicha(${idx})">&times;</button>
      </div>
      <div class="effect-item-details">
        <span>Turnos Restantes: ${ef.duracao === 0 ? "Infinito" : ef.duracao}</span>
        <span>Recurso: ${ef.recurso} (${ef.valorTurno})</span>
      </div>
    `;
    lista.appendChild(li);
  });
}

function removerEfeitoFicha(index) {
  let efeitos = [...(fichaAtualData.efeitosAtivos || [])];
  efeitos.splice(index, 1);
  database.ref(`fichas/${fichaAtualId}/efeitosAtivos`).set(efeitos);
}

function escutarEfeitosGlobaisMestre() {
  database.ref('efeitosGlobais').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const select = document.getElementById("select-efeitos-globais");
    const listaGm = document.getElementById("lista-efeitos-globais-mestre");

    if (select) select.innerHTML = '<option value="">Selecione um efeito...</option>';
    if (listaGm) listaGm.innerHTML = '';

    Object.keys(data).forEach(key => {
      const ef = data[key];

      if (select) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.innerText = `${ef.nome} (${ef.cat})`;
        select.appendChild(opt);
      }

      if (listaGm) {
        const li = document.createElement("li");
        li.className = "effect-item";
        li.innerHTML = `<strong>${ef.nome}</strong> - ${ef.cat} (Recurso: ${ef.recurso})`;
        listaGm.appendChild(li);
      }
    });
  });
}

function adicionarEfeitoGlobalNaFicha() {
  const key = document.getElementById("select-efeitos-globais").value;
  if (!key) return;

  database.ref('efeitosGlobais/' + key).once('value', (snapshot) => {
    const efeito = snapshot.val();
    if (!efeito) return;

    let ativos = [...(fichaAtualData.efeitosAtivos || [])];
    ativos.push(efeito);
    database.ref(`fichas/${fichaAtualId}/efeitosAtivos`).set(ativos);
  });
}

function adicionarBuffEfeitoGmMtemp() {
  const alvo = document.getElementById("gm-effect-buff-alvo").value;
  const val = parseInt(document.getElementById("gm-effect-buff-valor").value) || 0;

  buffsGmEffectTemp.push({ alvo, valor: val });
  renderBuffsTagsTemp("lista-gm-effect-buffs-temp", buffsGmEffectTemp);
}

function salvarEfeitoGlobalMestre() {
  const nome = document.getElementById("gm-effect-nome").value.trim();
  if (!nome) {
    alert("Digite o nome do efeito!");
    return;
  }

  const novoEfeito = {
    nome,
    cat: document.getElementById("gm-effect-cat").value,
    isContinuous: document.getElementById("gm-effect-is-continuous").value,
    recurso: document.getElementById("gm-effect-recurso").value,
    valorTurno: parseInt(document.getElementById("gm-effect-valor-turno").value) || 0,
    duracao: parseInt(document.getElementById("gm-effect-duracao").value) || 0,
    turnosEvoluir: parseInt(document.getElementById("gm-effect-turnos-evoluir").value) || 0,
    tipoEscala: document.getElementById("gm-effect-tipo-escala").value,
    fatorEscala: parseFloat(document.getElementById("gm-effect-fator-escala").value) || 0,
    buffs: [...buffsGmEffectTemp]
  };

  database.ref('efeitosGlobais').push(novoEfeito);
  alert("Efeito registrado com sucesso no Banco de Dados!");

  document.getElementById("gm-effect-nome").value = "";
  buffsGmEffectTemp = [];
  renderBuffsTagsTemp("lista-gm-effect-buffs-temp", buffsGmEffectTemp);
}

/* ==========================================================================
   BLOCO DE ANOTAÇÕES
   ========================================================================== */
function criarBlocoAnotacao() {
  let anotacoes = [...(fichaAtualData?.anotacoes || [])];
  anotacoes.push({ titulo: "Nova Anotação", texto: "" });
  database.ref(`fichas/${fichaAtualId}/anotacoes`).set(anotacoes);
}

function renderAnotacoesFicha(blocos) {
  const container = document.getElementById("container-anotacoes");
  if (!container) return;
  container.innerHTML = "";

  blocos.forEach((b, idx) => {
    const card = document.createElement("div");
    card.className = "bloco-card";
    card.innerHTML = `
      <input type="text" value="${b.titulo || ''}" onchange="atualizarAnotacao(${idx}, 'titulo', this.value)">
      <textarea rows="4" onchange="atualizarAnotacao(${idx}, 'texto', this.value)">${b.texto || ''}</textarea>
      <button type="button" class="btn-danger" onclick="removerAnotacao(${idx})">Excluir Bloco</button>
    `;
    container.appendChild(card);
  });
}

function atualizarAnotacao(idx, campo, valor) {
  let anotacoes = [...(fichaAtualData.anotacoes || [])];
  if (anotacoes[idx]) {
    anotacoes[idx][campo] = valor;
    database.ref(`fichas/${fichaAtualId}/anotacoes`).set(anotacoes);
  }
}

function removerAnotacao(idx) {
  let anotacoes = [...(fichaAtualData.anotacoes || [])];
  anotacoes.splice(idx, 1);
  database.ref(`fichas/${fichaAtualId}/anotacoes`).set(anotacoes);
}

/* ==========================================================================
   DASHBOARD DO MESTRE (LISTAGEM DE FICHAS EM TEMPO REAL)
   ========================================================================== */
function carregarDashboardMestre() {
  const grid = document.getElementById("gm-cards-list");
  if (!grid) return;

  database.ref('fichas').on('value', (snapshot) => {
    grid.innerHTML = "";
    const data = snapshot.val() || {};

    Object.keys(data).forEach(id => {
      const f = data[id];
      const card = document.createElement("div");
      card.className = "gm-card";
      card.innerHTML = `
        <div class="gm-card-header">
          <h3>${f.nome || id}</h3>
          <button type="button" class="btn-sub" onclick="abrirFichaComoMestre('${id}')">Inspecionar</button>
        </div>
        <div class="gm-card-stats">
          <span>PV: <strong>${f.pvAtual || 0} / ${f.pvMax || 0}</strong></span>
          <span>PE: <strong>${f.peAtual || 0} / ${f.peMax || 0}</strong></span>
          <span>SAN: <strong>${f.sanAtual || 0} / ${f.sanMax || 0}</strong></span>
          <span>DEF: <strong>${f.defensa || 10}</strong></span>
        </div>
      `;
      grid.appendChild(card);
    });
  });
}

function mestrePassarTurnoGeral() {
  if (!confirm("Avançar o turno de todas as fichas ativas?")) return;

  database.ref('fichas').once('value', (snapshot) => {
    const fichas = snapshot.val() || {};
    Object.keys(fichas).forEach(id => {
      let efeitos = fichas[id].efeitosAtivos || [];
      let novosEfeitos = efeitos.map(e => {
        if (e.duracao && e.duracao > 0) e.duracao -= 1;
        return e;
      }).filter(e => e.duracao === undefined || e.duracao > 0);

      database.ref(`fichas/${id}/efeitosAtivos`).set(novosEfeitos);
    });
    alert("Turno global executado com sucesso!");
  });
}
