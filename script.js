// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
// Substitua pelas credenciais do seu projeto Firebase Console
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Inicializa o Firebase se ainda não foi inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
let modoAcesso = 'player'; // 'player' ou 'gm'
let fichaAtualId = null;
let escutadorFirebase = null;
let ehMestre = false;
let buffsTempItem = [];
let turnosTempGm = [];
let buffsTempGm = [];

// Lista Padrão de Perícias do Sistema
const LISTA_PERICIAS_PADRAO = [
  "Acrobacia", "Adestramento", "Artes", "Atletismo", "Atualidades", 
  "Ciência", "Diplomacia", "Enganação", "Fortitude", "Furtividade", 
  "Intimidação", "Intuição", "Investigação", "Luta", "Medicina", 
  "Ocultismo", "Percepção", "Pilotagem", "Pontaria", "Reflexos", 
  "Religião", "Sobrevivência", "Tática", "Tecnologia", "Vontade"
];

// Lista de Atributos/Recursos para Puxar nos Selects de Buff
const OPCOES_BUFF_ALVO = [
  "Força", "Agilidade", "Vigor", "Inteligência", "Presença", "Carisma", "Sorte",
  "Defesa", "Evasão", "PV Max", "PE Max", "SAN Max", "MA Max",
  ...LISTA_PERICIAS_PADRAO
];

// ==========================================
// INICIALIZAÇÃO DA PÁGINA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  preencherSelectsBuffs();
  renderizarPericiasBase();
  carregarEfeitosGlobaisMestre();
});

// Preenche os selects de Buff/Debuff com atributos e perícias
function preencherSelectsBuffs() {
  const selectItem = document.getElementById('buff-alvo');
  const selectGm = document.getElementById('gm-effect-buff-alvo');
  
  if (!selectItem || !selectGm) return;

  selectItem.innerHTML = '';
  selectGm.innerHTML = '';

  OPCOES_BUFF_ALVO.forEach(opcao => {
    const opt1 = document.createElement('option');
    opt1.value = opcao;
    opt1.textContent = opcao;
    selectItem.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = opcao;
    opt2.textContent = opcao;
    selectGm.appendChild(opt2);
  });
}

// Renderiza a grade de perícias na interface
function renderizarPericiasBase() {
  const container = document.getElementById('grid-pericias');
  if (!container) return;
  container.innerHTML = '';

  LISTA_PERICIAS_PADRAO.forEach(pericia => {
    const idKey = 'pericia-' + pericia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    const div = document.createElement('div');
    div.className = 'card-pericia';
    div.innerHTML = `
      <label>${pericia}</label>
      <input type="number" id="${idKey}" value="0" onchange="recalcularTudo()">
    `;
    container.appendChild(div);
  });
}

// ==========================================
// MODO DE ACESSO E NAVEGAÇÃO ENTRE TELAS
// ==========================================
function setModoAcesso(modo) {
  modoAcesso = modo;
  document.getElementById('btn-mode-player').classList.toggle('active', modo === 'player');
  document.getElementById('btn-mode-gm').classList.toggle('active', modo === 'gm');
  document.getElementById('panel-player').classList.toggle('active', modo === 'player');
  document.getElementById('panel-gm').classList.toggle('active', modo === 'gm');
}

function alternarTelas(idTelaAtiva) {
  document.querySelectorAll('.screen-container').forEach(el => el.classList.remove('active'));
  const telaTarget = document.getElementById(idTelaAtiva);
  if (telaTarget) telaTarget.classList.add('active');
}

function entrarComoJogador() {
  const idInput = document.getElementById('input-player-id').value.trim();
  if (!idInput) {
    alert("Por favor, digite o nome ou ID do seu personagem!");
    return;
  }
  fichaAtualId = idInput;
  ehMestre = false;
  document.getElementById('badge-gm-view').style.display = 'none';
  document.getElementById('label-ficha-ativa').textContent = `Ficha: ${fichaAtualId}`;
  
  alternarTelas('screen-sheet');
  iniciarSincronizacaoFicha(fichaAtualId);
}

function entrarComoMestre() {
  const senha = document.getElementById('input-gm-pass').value;
  // Defina sua senha de mestre aqui se quiser validação simples
  if (senha === "2510" || senha === "mestre") {
    ehMestre = true;
    alternarTelas('screen-gm-dashboard');
    carregarPainelMestre();
  } else {
    alert("Senha do Mestre incorreta!");
  }
}

function abrirFichaPeloMestre(idFicha) {
  fichaAtualId = idFicha;
  ehMestre = true;
  document.getElementById('badge-gm-view').style.display = 'inline-block';
  document.getElementById('label-ficha-ativa').textContent = `[MESTRE] Editando: ${fichaAtualId}`;
  alternarTelas('screen-sheet');
  iniciarSincronizacaoFicha(fichaAtualId);
}

function voltarParaSelecao() {
  if (escutadorFirebase && fichaAtualId) {
    db.ref('fichas/' + fichaAtualId).off('value', escutadorFirebase);
  }
  fichaAtualId = null;
  alternarTelas('screen-select');
}

// ==========================================
// BANCO DE DADOS & SINCRONIZAÇÃO DA FICHA
// ==========================================
function iniciarSincronizacaoFicha(idFicha) {
  const refFicha = db.ref('fichas/' + idFicha);
  
  if (escutadorFirebase) refFicha.off();

  escutadorFirebase = refFicha.on('value', snapshot => {
    const dados = snapshot.val();
    if (dados) {
      preencherFormularioFicha(dados);
    } else {
      // Se a ficha não existir no banco, cria uma padrão
      salvarDados();
    }
  });
}

function obterDadosFormulario() {
  const dados = {
    info: {
      classeBase: document.getElementById('classe-base')?.value || 'Místico',
      nivel: parseInt(document.getElementById('nivel')?.value) || 1,
      nex: document.getElementById('nex')?.value || '20%',
      idade: parseInt(document.getElementById('idade')?.value) || 18,
      nome: document.getElementById('nome')?.value || '',
      exp: document.getElementById('exp-display')?.value || '0 / 100',
      origem: document.getElementById('origem')?.value || '',
      raca: document.getElementById('raca')?.value || '',
      genero: document.getElementById('genero')?.value || '',
      sexualidade: document.getElementById('sexualidade')?.value || '',
      classeAdd: document.getElementById('classe-add')?.value || '',
      traco: document.getElementById('traco')?.value || '',
      traumas: document.getElementById('traumas')?.value || '',
    },
    recursosAtuais: {
      pv: parseInt(document.getElementById('pv-atual')?.value) || 0,
      san: parseInt(document.getElementById('san-atual')?.value) || 0,
      pe: parseInt(document.getElementById('pe-atual')?.value) || 0,
      ma: parseInt(document.getElementById('ma-atual')?.value) || 0,
      tp: parseInt(document.getElementById('tp-val')?.value) || 0,
    },
    defesasEspecificas: {
      perfuracao: parseInt(document.getElementById('def-perfuracao')?.value) || 0,
      queimadura: parseInt(document.getElementById('def-queimadura')?.value) || 0,
      corte: parseInt(document.getElementById('def-corte')?.value) || 0,
      impacto: parseInt(document.getElementById('def-impacto')?.value) || 0,
      balistico: parseInt(document.getElementById('def-balistico')?.value) || 0,
      eletricidade: parseInt(document.getElementById('def-eletricidade')?.value) || 0,
      fogo: parseInt(document.getElementById('def-fogo')?.value) || 0,
      frio: parseInt(document.getElementById('def-frio')?.value) || 0,
      acido: parseInt(document.getElementById('def-acido')?.value) || 0,
      veneno: parseInt(document.getElementById('def-veneno')?.value) || 0,
      magico: parseInt(document.getElementById('def-magico')?.value) || 0,
    },
    atributos: {
      forca: parseInt(document.getElementById('attr-forca')?.value) || 10,
      agilidade: parseInt(document.getElementById('attr-agilidade')?.value) || 10,
      vigor: parseInt(document.getElementById('attr-vigor')?.value) || 10,
      inteligencia: parseInt(document.getElementById('attr-inteligencia')?.value) || 10,
      presenca: parseInt(document.getElementById('attr-presenca')?.value) || 10,
      carisma: parseInt(document.getElementById('attr-carisma')?.value) || 10,
      sorte: parseInt(document.getElementById('attr-sorte')?.value) || 10,
    },
    habilidadesRaridade: {
      unicas: document.getElementById('hab-unicas')?.value || '',
      lendarias: document.getElementById('hab-lendarias')?.value || '',
      epicas: document.getElementById('hab-epicas')?.value || '',
      raras: document.getElementById('hab-raras')?.value || '',
      incomuns: document.getElementById('hab-incomuns')?.value || '',
      comuns: document.getElementById('hab-comuns')?.value || '',
    },
    textosSkills: {
      skills: document.getElementById('skills-texto')?.value || '',
      feiticos: document.getElementById('feiticos-texto')?.value || '',
      rituais: document.getElementById('rituais-texto')?.value || '',
    },
    slotsMagia: {
      c1Ativa: document.getElementById('classe-magica-1')?.checked || false,
      c1Nv: parseInt(document.getElementById('nv-classe-magica-1')?.value) || 0,
      c2Ativa: document.getElementById('classe-magica-2')?.checked || false,
      c2Nv: parseInt(document.getElementById('nv-classe-magica-2')?.value) || 0,
    }
  };

  // Coleta Perícias Dinamicamente
  dados.pericias = {};
  LISTA_PERICIAS_PADRAO.forEach(pericia => {
    const idKey = 'pericia-' + pericia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    dados.pericias[pericia] = parseInt(document.getElementById(idKey)?.value) || 0;
  });

  return dados;
}

function salvarDados() {
  if (!fichaAtualId) return;
  const dados = obterDadosFormulario();
  db.ref('fichas/' + fichaAtualId).update(dados);
}

function preencherFormularioFicha(dados) {
  if (dados.info) {
    if (document.getElementById('classe-base')) document.getElementById('classe-base').value = dados.info.classeBase || 'Místico';
    if (document.getElementById('nivel')) document.getElementById('nivel').value = dados.info.nivel || 1;
    if (document.getElementById('nex')) document.getElementById('nex').value = dados.info.nex || '20%';
    if (document.getElementById('idade')) document.getElementById('idade').value = dados.info.idade || 18;
    if (document.getElementById('nome')) document.getElementById('nome').value = dados.info.nome || '';
    if (document.getElementById('exp-display')) document.getElementById('exp-display').value = dados.info.exp || '0 / 100';
    if (document.getElementById('origem')) document.getElementById('origem').value = dados.info.origem || '';
    if (document.getElementById('raca')) document.getElementById('raca').value = dados.info.raca || '';
    if (document.getElementById('genero')) document.getElementById('genero').value = dados.info.genero || '';
    if (document.getElementById('sexualidade')) document.getElementById('sexualidade').value = dados.info.sexualidade || '';
    if (document.getElementById('classe-add')) document.getElementById('classe-add').value = dados.info.classeAdd || '';
    if (document.getElementById('traco')) document.getElementById('traco').value = dados.info.traco || '';
    if (document.getElementById('traumas')) document.getElementById('traumas').value = dados.info.traumas || '';
  }

  if (dados.recursosAtuais) {
    if (document.getElementById('pv-atual')) document.getElementById('pv-atual').value = dados.recursosAtuais.pv ?? 22;
    if (document.getElementById('san-atual')) document.getElementById('san-atual').value = dados.recursosAtuais.san ?? 18;
    if (document.getElementById('pe-atual')) document.getElementById('pe-atual').value = dados.recursosAtuais.pe ?? 27;
    if (document.getElementById('ma-atual')) document.getElementById('ma-atual').value = dados.recursosAtuais.ma ?? 49;
    if (document.getElementById('tp-val')) document.getElementById('tp-val').value = dados.recursosAtuais.tp ?? 0;
  }

  if (dados.defesasEspecificas) {
    Object.keys(dados.defesasEspecificas).forEach(k => {
      const el = document.getElementById('def-' + k);
      if (el) el.value = dados.defesasEspecificas[k];
    });
  }

  if (dados.atributos) {
    Object.keys(dados.atributos).forEach(k => {
      const el = document.getElementById('attr-' + k);
      if (el) el.value = dados.atributos[k];
    });
  }

  if (dados.pericias) {
    Object.keys(dados.pericias).forEach(p => {
      const idKey = 'pericia-' + p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
      const el = document.getElementById(idKey);
      if (el) el.value = dados.pericias[p];
    });
  }

  if (dados.habilidadesRaridade) {
    if (document.getElementById('hab-unicas')) document.getElementById('hab-unicas').value = dados.habilidadesRaridade.unicas || '';
    if (document.getElementById('hab-lendarias')) document.getElementById('hab-lendarias').value = dados.habilidadesRaridade.lendarias || '';
    if (document.getElementById('hab-epicas')) document.getElementById('hab-epicas').value = dados.habilidadesRaridade.epicas || '';
    if (document.getElementById('hab-raras')) document.getElementById('hab-raras').value = dados.habilidadesRaridade.raras || '';
    if (document.getElementById('hab-incomuns')) document.getElementById('hab-incomuns').value = dados.habilidadesRaridade.incomuns || '';
    if (document.getElementById('hab-comuns')) document.getElementById('hab-comuns').value = dados.habilidadesRaridade.comuns || '';
  }

  if (dados.textosSkills) {
    if (document.getElementById('skills-texto')) document.getElementById('skills-texto').value = dados.textosSkills.skills || '';
    if (document.getElementById('feiticos-texto')) document.getElementById('feiticos-texto').value = dados.textosSkills.feiticos || '';
    if (document.getElementById('rituais-texto')) document.getElementById('rituais-texto').value = dados.textosSkills.rituais || '';
  }

  if (dados.slotsMagia) {
    if (document.getElementById('classe-magica-1')) document.getElementById('classe-magica-1').checked = dados.slotsMagia.c1Ativa || false;
    if (document.getElementById('nv-classe-magica-1')) document.getElementById('nv-classe-magica-1').value = dados.slotsMagia.c1Nv || 0;
    if (document.getElementById('classe-magica-2')) document.getElementById('classe-magica-2').checked = dados.slotsMagia.c2Ativa || false;
    if (document.getElementById('nv-classe-magica-2')) document.getElementById('nv-classe-magica-2').value = dados.slotsMagia.c2Nv || 0;
  }

  recalcularTudo();
  renderizarInventario(dados.inventario || []);
  renderizarEfeitosFicha(dados.efeitosAtivos || []);
  renderizarAnotacoes(dados.anotacoes || []);
}

// ==========================================
// RECALCULO AUTOMÁTICO DE ATRIBUTOS E STATUS
// ==========================================
function recalcularTudo() {
  const vigor = parseInt(document.getElementById('attr-vigor')?.value) || 10;
  const int = parseInt(document.getElementById('attr-inteligencia')?.value) || 10;
  const pres = parseInt(document.getElementById('attr-presenca')?.value) || 10;
  const agi = parseInt(document.getElementById('attr-agilidade')?.value) || 10;
  const nivel = parseInt(document.getElementById('nivel')?.value) || 1;
  const classe = document.getElementById('classe-base')?.value || 'Místico';

  // Cálculos Automáticos de PV, PE, SAN, MA
  let pvMax = 10 + vigor + (nivel * 2);
  let peMax = 10 + pres + nivel;
  let sanMax = 10 + int + nivel;
  let maMax = 20 + (int * 2) + (nivel * 3);

  if (classe === 'Combatente') pvMax += 10;
  if (classe === 'Especialista') peMax += 5;
  if (classe === 'Místico') maMax += 15;

  document.getElementById('pv-max').value = pvMax;
  document.getElementById('pe-max').value = peMax;
  document.getElementById('san-max').value = sanMax;
  document.getElementById('ma-max').value = maMax;

  // Defesa e Evasão
  const defVal = 10 + Math.floor((agi - 10) / 2);
  const evaVal = 10 + agi;
  document.getElementById('def-val').value = defVal;
  document.getElementById('eva-val').value = evaVal;

  recalcularSlotsMagia();
  salvarDados();
}

function formatarNEX(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  input.value = val ? val + '%' : '0%';
  salvarDados();
}

// Tooltip Pop-up de Defesas Específicas
function toggleDefesaTooltip(event) {
  event.stopPropagation();
  const box = document.getElementById('defensa-tooltip-box');
  if (box) box.classList.toggle('active');
}

document.addEventListener('click', (e) => {
  const box = document.getElementById('defensa-tooltip-box');
  if (box && !box.contains(e.target) && !e.target.classList.contains('btn-def-asterisk')) {
    box.classList.remove('active');
  }
});

// ==========================================
// NAVEGAÇÃO DE ABAS & SUB-ABAS
// ==========================================
function openTab(tabId, event) {
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(tb => tb.classList.remove('active'));
  
  const el = document.getElementById('tab-' + tabId);
  if (el) el.classList.add('active');
  if (event?.currentTarget) event.currentTarget.classList.add('active');
}

function openSubTab(subTabId, event) {
  document.querySelectorAll('.sub-tab-content').forEach(stc => stc.classList.remove('active'));
  document.querySelectorAll('.sub-tab-btn').forEach(stb => stb.classList.remove('active'));

  const el = document.getElementById('subtab-' + subTabId);
  if (el) el.classList.add('active');
  if (event?.currentTarget) event.currentTarget.classList.add('active');
}

// ==========================================
// MODAL DE EXPERIÊNCIA (XP)
// ==========================================
function abrirModalXP() {
  document.getElementById('modal-xp').classList.add('active');
}

function fecharModalXP() {
  document.getElementById('modal-xp').classList.remove('active');
}

function somarXPInput(val) {
  const input = document.getElementById('xp-input-val');
  input.value = (parseInt(input.value) || 0) + val;
}

function confirmarGanhoXP() {
  const ganho = parseInt(document.getElementById('xp-input-val').value) || 0;
  const expDisplay = document.getElementById('exp-display');
  
  let partes = expDisplay.value.split('/');
  let atual = parseInt(partes[0]) || 0;
  let max = parseInt(partes[1]) || 100;

  atual += ganho;
  while (atual >= max) {
    atual -= max;
    max = Math.floor(max * 1.5);
    const nivelEl = document.getElementById('nivel');
    nivelEl.value = (parseInt(nivelEl.value) || 1) + 1;
  }

  expDisplay.value = `${atual} / ${max}`;
  fecharModalXP();
  recalcularTudo();
}

// ==========================================
// GERENCIAMENTO DE SLOTS DE MAGIA
// ==========================================
function recalcularSlotsMagia() {
  const container = document.getElementById('circulos-grid');
  if (!container) return;
  container.innerHTML = '';

  const c1Ativa = document.getElementById('classe-magica-1')?.checked;
  const c1Nv = parseInt(document.getElementById('nv-classe-magica-1')?.value) || 0;

  if (!c1Ativa || c1Nv <= 0) {
    container.innerHTML = '<p style="color:#aaa;">Nenhuma classe mágica ativa ou nível insuficiente.</p>';
    return;
  }

  // Tabela simplificada de slots por nível
  const qtdSlots = Math.min(c1Nv, 5); 

  for (let circulo = 1; circulo <= qtdSlots; circulo++) {
    const card = document.createElement('div');
    card.className = 'circulo-card';
    card.innerHTML = `
      <h4>${circulo}º Círculo</h4>
      <div class="slots-checks">
        <label><input type="checkbox"> Slot 1</label>
        <label><input type="checkbox"> Slot 2</label>
      </div>
    `;
    container.appendChild(card);
  }
}

function restaurarSlotsDescanso() {
  document.querySelectorAll('#circulos-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function zerarTodosSlots() {
  document.querySelectorAll('#circulos-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
}

// ==========================================
// INVENTÁRIO, ITENS E CARGA
// ==========================================
function adicionarBuffItemTemp() {
  const alvo = document.getElementById('buff-alvo').value;
  const valor = parseInt(document.getElementById('buff-valor').value) || 0;

  buffsTempItem.push({ alvo, valor });
  renderizarBuffsTempItem();
}

function renderizarBuffsTempItem() {
  const container = document.getElementById('lista-buffs-temp');
  if (!container) return;
  container.innerHTML = buffsTempItem.map((b, idx) => `
    <span class="tag-buff">${b.alvo}: ${b.valor > 0 ? '+' : ''}${b.valor} <button type="button" onclick="removerBuffTempItem(${idx})">x</button></span>
  `).join('');
}

function removerBuffTempItem(idx) {
  buffsTempItem.splice(idx, 1);
  renderizarBuffsTempItem();
}

function criarItem() {
  if (!fichaAtualId) return;

  const nome = document.getElementById('item-nome').value.trim();
  if (!nome) {
    alert("Digite o nome do item!");
    return;
  }

  const qtd = parseInt(document.getElementById('item-qtd').value) || 1;
  const carga = parseFloat(document.getElementById('item-carga').value) || 0;
  const isMochila = document.getElementById('item-is-mochila').checked;
  const bonusCarga = parseFloat(document.getElementById('item-bonus-carga').value) || 0;
  const desc = document.getElementById('item-desc').value;

  const novoItem = {
    id: Date.now().toString(),
    nome,
    qtd,
    carga,
    isMochila,
    bonusCarga,
    desc,
    equipado: false,
    buffs: [...buffsTempItem]
  };

  db.ref(`fichas/${fichaAtualId}/inventario/${novoItem.id}`).set(novoItem, () => {
    // Limpa os campos
    document.getElementById('item-nome').value = '';
    document.getElementById('item-desc').value = '';
    buffsTempItem = [];
    renderizarBuffsTempItem();
  });
}

function renderizarInventario(inventarioObj) {
  const containerInv = document.getElementById('lista-inventario');
  const containerEqp = document.getElementById('lista-equipamentos');
  if (!containerInv || !containerEqp) return;

  containerInv.innerHTML = '';
  containerEqp.innerHTML = '';

  const lista = Array.isArray(inventarioObj) ? inventarioObj : Object.values(inventarioObj || {});
  
  let cargaAtual = 0;
  let cargaExtraTot = 0;

  lista.forEach(item => {
    cargaAtual += (item.carga * item.qtd);
    if (item.isMochila && item.equipado) cargaExtraTot += item.bonusCarga;

    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
      <div class="item-header">
        <strong>${item.nome} (x${item.qtd})</strong> - ${item.carga * item.qtd} Kg
      </div>
      <p>${item.desc || ''}</p>
      <div class="item-actions">
        <button type="button" class="btn-sub" onclick="toggleEquiparItem('${item.id}', ${!item.equipado})">
          ${item.equipado ? 'Desequipar' : 'Equipar'}
        </button>
        <button type="button" class="btn-danger" onclick="deletarItem('${item.id}')">Excluir</button>
      </div>
    `;

    if (item.equipado) {
      containerEqp.appendChild(div);
    } else {
      containerInv.appendChild(div);
    }
  });

  // Atualiza Barra de Carga
  const forca = parseInt(document.getElementById('attr-forca')?.value) || 10;
  document.getElementById('carga-atual').textContent = cargaAtual;
  document.getElementById('carga-base-max').textContent = forca;
  document.getElementById('carga-extra-display').textContent = `+ ${cargaExtraTot} Kg`;
}

function toggleEquiparItem(itemId, estado) {
  db.ref(`fichas/${fichaAtualId}/inventario/${itemId}`).update({ equipado: estado });
}

function deletarItem(itemId) {
  db.ref(`fichas/${fichaAtualId}/inventario/${itemId}`).remove();
}

// ==========================================
// EFEITOS DE STATUS E TURNO DO JOGADOR
// ==========================================
function passarTurnoJogador() {
  if (!fichaAtualId) return;

  db.ref(`fichas/${fichaAtualId}`).once('value', snapshot => {
    const ficha = snapshot.val() || {};
    const efeitos = ficha.efeitosAtivos || {};
    const recursos = ficha.recursosAtuais || { pv: 0, pe: 0, san: 0, ma: 0, tp: 0 };
    const atualizados = {};

    let alterouRecursos = false;

    Object.keys(efeitos).forEach(key => {
      const ef = efeitos[key];

      // 1. Processa alterações de recursos por turno (ex: -2 PV, +1 PE)
      const alteracoes = ef.turnosTemp || ef.efeitosTurno || [];
      alteracoes.forEach(alt => {
        const rec = alt.recurso || alt.alvo;
        const val = parseInt(alt.valor) || 0;

        if (rec && val !== 0) {
          if (recursos[rec] !== undefined) {
            recursos[rec] += val;
            alterouRecursos = true;
          }
        }
      });

      // 2. Decrementa a duração do efeito (se não for infinito / 0)
      if (ef.duracao > 0) {
        ef.duracao -= 1;
      }

      // Mantém o efeito se a duração for infinita (0) ou se ainda resta pelo menos 1 turno
      if (ef.duracao !== 0) {
        atualizados[key] = ef;
      }
    });

    // Atualiza os recursos na tela se tiverem mudado
    if (alterouRecursos) {
      if (document.getElementById('pv-atual')) document.getElementById('pv-atual').value = recursos.pv;
      if (document.getElementById('pe-atual')) document.getElementById('pe-atual').value = recursos.pe;
      if (document.getElementById('san-atual')) document.getElementById('san-atual').value = recursos.san;
      if (document.getElementById('ma-atual')) document.getElementById('ma-atual').value = recursos.ma;
    }

    // Salva no Firebase os novos recursos e a lista de efeitos atualizada
    db.ref(`fichas/${fichaAtualId}`).update({
      recursosAtuais: recursos,
      efeitosAtivos: atualizados
    });
  });
}

function renderizarEfeitosFicha(efeitosObj) {
  const container = document.getElementById('lista-efeitos');
  if (!container) return;
  container.innerHTML = '';

  const lista = Array.isArray(efeitosObj) ? efeitosObj : Object.values(efeitosObj || {});

  lista.forEach(ef => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${ef.nome}</strong> (${ef.categoria}) - Duracao: ${ef.duracao === 0 ? 'Infinita' : ef.duracao + ' turnos'}
      <button type="button" class="btn-danger" onclick="removerEfeitoFicha('${ef.id}')">Remover</button>
    `;
    container.appendChild(li);
  });
}

function removerEfeitoFicha(efId) {
  db.ref(`fichas/${fichaAtualId}/efeitosAtivos/${efId}`).remove();
}

// ==========================================
// PAINEL DO MESTRE & GERENCIADOR GLOBAL
// ==========================================
function carregarPainelMestre() {
  db.ref('fichas').on('value', snapshot => {
    const fichas = snapshot.val() || {};
    const container = document.getElementById('gm-cards-list');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(fichas).forEach(id => {
      const f = fichas[id];
      const card = document.createElement('div');
      card.className = 'gm-card';
      card.innerHTML = `
        <h3>${f.info?.nome || id}</h3>
        <p><strong>Nível:</strong> ${f.info?.nivel || 1} | <strong>Classe:</strong> ${f.info?.classeBase || '-'}</p>
        <p><strong>PV:</strong> ${f.recursosAtuais?.pv || 0} / ${document.getElementById('pv-max')?.value || 0}</p>
        <button type="button" class="btn-primary" onclick="abrirFichaPeloMestre('${id}')">Abrir / Editar Ficha</button>
      `;
      container.appendChild(card);
    });
  });
}

function mestrePassarTurnoGeral() {
  db.ref('fichas').once('value', snapshot => {
    const fichas = snapshot.val() || {};
    
    Object.keys(fichas).forEach(id => {
      const f = fichas[id];
      const efAtivos = f.efeitosAtivos || {};
      const recursos = f.recursosAtuais || { pv: 0, pe: 0, san: 0, ma: 0, tp: 0 };
      const novosEfeitos = {};

      Object.keys(efAtivos).forEach(k => {
        const ef = efAtivos[k];
        
        // Aplica o dano/cura do turno
        const alteracoes = ef.turnosTemp || ef.efeitosTurno || [];
        alteracoes.forEach(alt => {
          const rec = alt.recurso || alt.alvo;
          const val = parseInt(alt.valor) || 0;
          if (rec && recursos[rec] !== undefined) {
            recursos[rec] += val;
          }
        });

        // Reduz turno
        if (ef.duracao > 0) ef.duracao -= 1;
        if (ef.duracao !== 0) novosEfeitos[k] = ef;
      });

      db.ref(`fichas/${id}`).update({
        recursosAtuais: recursos,
        efeitosAtivos: novosEfeitos
      });
    });

    alert("Turno de todas as fichas avançado e efeitos aplicados!");
  });
}

function adicionarEfeitoTurnoTemp() {
  const recurso = document.getElementById('gm-effect-recurso-alvo').value;
  const valor = parseInt(document.getElementById('gm-effect-recurso-valor').value) || 0;
  turnosTempGm.push({ recurso, valor });
  
  document.getElementById('lista-gm-effect-turnos-temp').innerHTML = turnosTempGm.map(t => 
    `<span class="tag-buff">${t.recurso.toUpperCase()}: ${t.valor}</span>`
  ).join('');
}

function adicionarBuffEfeitoGmMtemp() {
  const alvo = document.getElementById('gm-effect-buff-alvo').value;
  const valor = parseInt(document.getElementById('gm-effect-buff-valor').value) || 0;
  buffsTempGm.push({ alvo, valor });

  document.getElementById('lista-gm-effect-buffs-temp').innerHTML = buffsTempGm.map(b => 
    `<span class="tag-buff">${b.alvo}: ${b.valor}</span>`
  ).join('');
}

function salvarEfeitoGlobalMestre() {
  const nome = document.getElementById('gm-effect-nome').value.trim();
  if (!nome) return alert("Digite o nome do efeito!");

  const efeito = {
    id: Date.now().toString(),
    nome,
    categoria: document.getElementById('gm-effect-cat').value,
    duracao: parseInt(document.getElementById('gm-effect-duracao').value) || 0,
    turnosTemp: [...turnosTempGm],
    buffsTemp: [...buffsTempGm]
  };

  db.ref(`efeitosGlobais/${efeito.id}`).set(efeito, () => {
    alert("Efeito salvo no Banco de Dados!");
    turnosTempGm = [];
    buffsTempGm = [];
    document.getElementById('gm-effect-nome').value = '';
    document.getElementById('lista-gm-effect-turnos-temp').innerHTML = '';
    document.getElementById('lista-gm-effect-buffs-temp').innerHTML = '';
  });
}

function carregarEfeitosGlobaisMestre() {
  db.ref('efeitosGlobais').on('value', snapshot => {
    const efeitos = snapshot.val() || {};
    const selectFicha = document.getElementById('select-efeitos-globais');
    const listaGm = document.getElementById('lista-efeitos-globais-mestre');

    if (selectFicha) selectFicha.innerHTML = '';
    if (listaGm) listaGm.innerHTML = '';

    Object.values(efeitos).forEach(ef => {
      if (selectFicha) {
        const opt = document.createElement('option');
        opt.value = ef.id;
        opt.textContent = `${ef.nome} (${ef.categoria})`;
        selectFicha.appendChild(opt);
      }

      if (listaGm) {
        const li = document.createElement('li');
        li.textContent = `${ef.nome} - Duração: ${ef.duracao} turnos`;
        listaGm.appendChild(li);
      }
    });
  });
}

function adicionarEfeitoGlobalNaFicha() {
  const select = document.getElementById('select-efeitos-globais');
  const efId = select.value;
  if (!efId || !fichaAtualId) return;

  db.ref(`efeitosGlobais/${efId}`).once('value', snapshot => {
    const ef = snapshot.val();
    if (ef) {
      db.ref(`fichas/${fichaAtualId}/efeitosAtivos/${ef.id}`).set(ef);
    }
  });
}

// ==========================================
// BLOCOS DE ANOTAÇÕES DINÂMICOS
// ==========================================
function criarBlocoAnotacao() {
  if (!fichaAtualId) return;
  const blocoId = Date.now().toString();
  const novoBloco = { id: blocoId, titulo: 'Nova Anotação', texto: '' };
  db.ref(`fichas/${fichaAtualId}/anotacoes/${blocoId}`).set(novoBloco);
}

function renderizarAnotacoes(anotacoesObj) {
  const container = document.getElementById('container-anotacoes');
  if (!container) return;
  container.innerHTML = '';

  const lista = Array.isArray(anotacoesObj) ? anotacoesObj : Object.values(anotacoesObj || {});

  lista.forEach(bloco => {
    const div = document.createElement('div');
    div.className = 'bloco-card';
    div.innerHTML = `
      <input type="text" value="${bloco.titulo || ''}" onchange="atualizarAnotacao('${bloco.id}', this.value, null)">
      <textarea rows="4" onchange="atualizarAnotacao('${bloco.id}', null, this.value)">${bloco.texto || ''}</textarea>
      <button type="button" class="btn-danger" onclick="deletarAnotacao('${bloco.id}')">Excluir</button>
    `;
    container.appendChild(div);
  });
}

function atualizarAnotacao(blocoId, titulo, texto) {
  const ref = db.ref(`fichas/${fichaAtualId}/anotacoes/${blocoId}`);
  if (titulo !== null) ref.update({ titulo });
  if (texto !== null) ref.update({ texto });
}

function deletarAnotacao(blocoId) {
  db.ref(`fichas/${fichaAtualId}/anotacoes/${blocoId}`).remove();
}
