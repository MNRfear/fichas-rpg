// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  databaseURL: "https://fichas-rpg-default-rtdb.firebaseio.com"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ==========================================
// VARIÁVEIS GLOBAIS DE ESTADO
// ==========================================
let modoAtual = 'jogador'; // 'jogador' ou 'mestre'
let idFichaAtual = null;
let expAtual = 0;

let dadosPericias = {};
let inventario = [];
let equipamentos = [];
let efeitos = [];
let blocosAnotacoes = [];

let itemEditandoIndex = null;
let itemEditandoOrigem = null; // 'inventario' ou 'equipamentos'
let buffsTemporarios = [];

// ==========================================
// LISTA FIXA DE PERÍCIAS (33)
// ==========================================
const LISTA_PERICIAS = [
  { nome: "Acrobacia", attr: "Agilidade", soTreinado: false },
  { nome: "Adestramento", attr: "Carisma", soTreinado: true },
  { nome: "Artes", attr: "Carisma", soTreinado: false },
  { nome: "Arcanismo", attr: "Inteligencia", soTreinado: true },
  { nome: "Atletismo", attr: "Forca", soTreinado: false },
  { nome: "Atualidades", attr: "Inteligencia", soTreinado: false },
  { nome: "Ciência", attr: "Inteligencia", soTreinado: true },
  { nome: "Crime", attr: "Agilidade", soTreinado: true },
  { nome: "Diplomacia", attr: "Carisma", soTreinado: false },
  { nome: "Enganação", attr: "Carisma", soTreinado: false },
  { nome: "Fortitude", attr: "Vigor", soTreinado: false },
  { nome: "Furtividade", attr: "Agilidade", soTreinado: false },
  { nome: "História", attr: "Inteligencia", soTreinado: false },
  { nome: "Iniciativa", attr: "Agilidade", soTreinado: false },
  { nome: "Intimidação", attr: "Carisma", soTreinado: false },
  { nome: "Intuição", attr: "Presenca", soTreinado: false },
  { nome: "Investigação", attr: "Inteligencia", soTreinado: false },
  { nome: "Luta", attr: "Forca", soTreinado: false },
  { nome: "Medicina", attr: "Inteligencia", soTreinado: false },
  { nome: "Ocultismo", attr: "Inteligencia", soTreinado: true },
  { nome: "Ofício", attr: "Inteligencia", soTreinado: false },
  { nome: "Percepção", attr: "Presenca", soTreinado: false },
  { nome: "Pilotagem", attr: "Agilidade", soTreinado: true },
  { nome: "Pontaria", attr: "Agilidade", soTreinado: false },
  { nome: "Prestidigitação", attr: "Agilidade", soTreinado: true },
  { nome: "Profissão", attr: "Inteligencia", soTreinado: true },
  { nome: "Reflexos", attr: "Agilidade", soTreinado: false },
  { nome: "Religião", attr: "Presenca", soTreinado: true },
  { nome: "Sobrevivência", attr: "Inteligencia", soTreinado: false },
  { nome: "Tática", attr: "Inteligencia", soTreinado: true },
  { nome: "Tecnologia", attr: "Inteligencia", soTreinado: true },
  { nome: "Vontade", attr: "Presenca", soTreinado: false },
  { nome: "Sorte pura", attr: "Sorte", soTreinado: false }
];

const PERICIAS_RESTREITAS_CLASSE = {
  'Místico': ["Arcanismo", "Ocultismo", "Religião"],
  'Especialista': ["Crime", "Investigação", "Pilotagem", "Prestidigitação", "Profissão", "Tática", "Tecnologia"],
  'Combatente': ["Atletismo", "Luta", "Pontaria", "Reflexos"]
};

// ==========================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  renderPericias();
  escutarEventosInputs();
  carregarOpcoesAlvoBuff();
});

function selecionarModo(modo) {
  modoAtual = modo;
  document.getElementById('btn-modo-jogador').classList.toggle('active', modo === 'jogador');
  document.getElementById('btn-modo-mestre').classList.toggle('active', modo === 'mestre');
  
  if (modo === 'mestre') {
    document.getElementById('campo-senha-mestre').style.display = 'block';
  } else {
    document.getElementById('campo-senha-mestre').style.display = 'none';
  }
}

function entrarSistema() {
  const nomeInput = document.getElementById('login-nome').value.trim();
  if (!nomeInput) {
    alert('Por favor, digite o nome do personagem.');
    return;
  }

  if (modoAtual === 'mestre') {
    const senha = document.getElementById('login-senha').value;
    // SENHA ATUALIZADA PARA 2510
    if (senha !== '2510') {
      alert('Senha incorreta do Mestre!');
      return;
    }
    iniciarModoMestre();
  } else {
    idFichaAtual = nomeInput;
    iniciarModoJogador();
  }
}

function iniciarModoJogador() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-ficha').style.display = 'block';
  document.getElementById('mestre-dashboard').style.display = 'none';
  
  carregarFichaFirebase(idFichaAtual);
}

function iniciarModoMestre() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('mestre-dashboard').style.display = 'block';
  document.getElementById('tela-ficha').style.display = 'none';
  
  escutarFichasMestre();
}

function voltarLogin() {
  idFichaAtual = null;
  database.off(); // Remove listeners ativos
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('tela-ficha').style.display = 'none';
  document.getElementById('mestre-dashboard').style.display = 'none';
}

// ==========================================
// FIREBASE - SINCRONIZAÇÃO EM TEMPO REAL
// ==========================================
function carregarFichaFirebase(id) {
  const ref = database.ref('fichas/' + id);
  ref.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      aplicarDadosFicha(data);
    } else {
      recalcularTudo(true);
    }
  });
}

function escutarCampoApenasSeInativo(id, valor) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) {
    el.value = valor;
  }
}

function aplicarDadosFicha(data) {
  escutarCampoApenasSeInativo('nome', data.nome || idFichaAtual);
  escutarCampoApenasSeInativo('nivel', data.nivel || 1);
  expAtual = data.expAtual || 0;
  escutarCampoApenasSeInativo('nex', data.nex || '20%');
  escutarCampoApenasSeInativo('idade', data.idade || '');
  escutarCampoApenasSeInativo('traco', data.traco || '');
  escutarCampoApenasSeInativo('classe-base', data.classeBase || 'Místico');
  escutarCampoApenasSeInativo('classe-add', data.classeAdd || '');
  escutarCampoApenasSeInativo('origem', data.origem || '');
  escutarCampoApenasSeInativo('raca', data.raca || '');
  escutarCampoApenasSeInativo('sexualidade', data.sexualidade || '');
  escutarCampoApenasSeInativo('genero', data.genero || '');
  escutarCampoApenasSeInativo('traumas', data.traumas || '');

  escutarCampoApenasSeInativo('pv-atual', data.pvAtual || 0);
  escutarCampoApenasSeInativo('san-atual', data.sanAtual || 0);
  escutarCampoApenasSeInativo('pe-atual', data.peAtual || 0);
  escutarCampoApenasSeInativo('ma-atual', data.maAtual || 0);
  escutarCampoApenasSeInativo('tp-val', data.tpVal || 0);

  // GUARDA OS ATRIBUTOS BASE NOS DATASETS NATIVOS DO HTML
  const carregarBaseAttr = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.dataset.base = val !== undefined ? val : 10;
    }
  };

  carregarBaseAttr('attr-forca', data.attrForca);
  carregarBaseAttr('attr-agilidade', data.attrAgilidade);
  carregarBaseAttr('attr-vigor', data.attrVigor);
  carregarBaseAttr('attr-inteligencia', data.attrInteligencia);
  carregarBaseAttr('attr-presenca', data.attrPresenca);
  carregarBaseAttr('attr-carisma', data.attrCarisma);
  carregarBaseAttr('attr-sorte', data.attrSorte);

  escutarCampoApenasSeInativo('hab-unicas', data.habUnicas || '');
  escutarCampoApenasSeInativo('hab-lendarias', data.habLendarias || '');
  escutarCampoApenasSeInativo('hab-epicas', data.habEpicas || '');
  escutarCampoApenasSeInativo('hab-raras', data.habRaras || '');
  escutarCampoApenasSeInativo('hab-incomuns', data.habIncomuns || '');
  escutarCampoApenasSeInativo('hab-comuns', data.habComuns || '');

  escutarCampoApenasSeInativo('skills-texto', data.skillsTexto || '');
  escutarCampoApenasSeInativo('feiticos-texto', data.feiticosTexto || '');
  escutarCampoApenasSeInativo('rituais-texto', data.rituaisTexto || '');

  dadosPericias = data.dadosPericias || {};
  inventario = data.inventario || [];
  equipamentos = data.equipamentos || [];
  efeitos = data.efeitos || [];
  blocosAnotacoes = data.blocosAnotacoes || [];

  renderItens();
  renderEfeitos();
  renderBlocosAnotacoes();
  recalcularTudo(false);
}

function salvarDados() {
  if (!idFichaAtual) return;

  const getAttrBaseParaSalvar = (id) => {
    const el = document.getElementById(id);
    if (!el) return 10;
    return el.dataset.base !== undefined ? el.dataset.base : el.value;
  };

  const estadoFicha = {
    nome: document.getElementById('nome').value,
    nivel: document.getElementById('nivel').value,
    expAtual,
    nex: document.getElementById('nex').value,
    idade: document.getElementById('idade').value,
    traco: document.getElementById('traco').value,
    classeBase: document.getElementById('classe-base').value,
    classeAdd: document.getElementById('classe-add').value,
    origem: document.getElementById('origem').value,
    raca: document.getElementById('raca').value,
    sexualidade: document.getElementById('sexualidade').value,
    genero: document.getElementById('genero').value,
    traumas: document.getElementById('traumas').value,

    pvAtual: document.getElementById('pv-atual').value,
    pvMax: document.getElementById('pv-max').value,
    sanAtual: document.getElementById('san-atual').value,
    sanMax: document.getElementById('san-max').value,
    peAtual: document.getElementById('pe-atual').value,
    peMax: document.getElementById('pe-max').value,
    maAtual: document.getElementById('ma-atual').value,
    maMax: document.getElementById('ma-max').value,
    tpVal: document.getElementById('tp-val').value,

    // SALVA OS VALORES LIMPOS/BASE NO FIREBASE
    attrForca: getAttrBaseParaSalvar('attr-forca'),
    attrAgilidade: getAttrBaseParaSalvar('attr-agilidade'),
    attrVigor: getAttrBaseParaSalvar('attr-vigor'),
    attrInteligencia: getAttrBaseParaSalvar('attr-inteligencia'),
    attrPresenca: getAttrBaseParaSalvar('attr-presenca'),
    attrCarisma: getAttrBaseParaSalvar('attr-carisma'),
    attrSorte: getAttrBaseParaSalvar('attr-sorte'),

    habUnicas: document.getElementById('hab-unicas').value,
    habLendarias: document.getElementById('hab-lendarias').value,
    habEpicas: document.getElementById('hab-epicas').value,
    habRaras: document.getElementById('hab-raras').value,
    habIncomuns: document.getElementById('hab-incomuns').value,
    habComuns: document.getElementById('hab-comuns').value,

    skillsTexto: document.getElementById('skills-texto').value,
    feiticosTexto: document.getElementById('feiticos-texto').value,
    rituaisTexto: document.getElementById('rituais-texto').value,

    dadosPericias,
    inventario,
    equipamentos,
    efeitos,
    blocosAnotacoes
  };

  database.ref('fichas/' + idFichaAtual).set(estadoFicha);
}

// ==========================================
// CÁLCULOS E REGRAS DE NEGÓCIO
// ==========================================
function escutarEventosInputs() {
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => recalcularTudo(true));
  });
}

function recalcularTudo(deveSalvar = true) {
  let nivel = parseInt(document.getElementById('nivel').value) || 1;
  let expNecessario = nivel * 100;
  document.getElementById('exp-display').value = `${expAtual} / ${expNecessario}`;

  // PEGA O ATRIBUTO BASE DO DATASET OU DO INPUT SE ESTIVER EDITANDO
  const getBaseAttr = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    if (document.activeElement === el) {
      el.dataset.base = el.value;
    }
    return parseFloat(el.dataset.base !== undefined ? el.dataset.base : el.value) || 0;
  };

  let forcaBase = getBaseAttr('attr-forca');
  let agilidadeBase = getBaseAttr('attr-agilidade');
  let vigorBase = getBaseAttr('attr-vigor');
  let inteligenciaBase = getBaseAttr('attr-inteligencia');
  let presencaBase = getBaseAttr('attr-presenca');
  let carismaBase = getBaseAttr('attr-carisma');
  let sorteBase = getBaseAttr('attr-sorte');

  const classeBase = document.getElementById('classe-base').value;
  let bonusClasse = { pv: 0, pe: 0, san: 0, ma: 0, def: 0, eva: 0, ptsLivre: 0 };

  if (classeBase === 'Combatente') {
    bonusClasse.pv = 10; bonusClasse.pe = 5; bonusClasse.def = 1; bonusClasse.eva = 1;
  } else if (classeBase === 'Especialista') {
    bonusClasse.pe = 4; bonusClasse.ptsLivre = 5;
  } else if (classeBase === 'Místico') {
    bonusClasse.pv = 4; bonusClasse.san = 5; bonusClasse.ma = 10;
  }

  // MAPEIA BUFFS DOS ITENS EQUIPADOS
  let buffsAcumulados = {};
  equipamentos.forEach(item => {
    let mult = parseInt(item.qtd) || 1;
    if (item.buffs) {
      item.buffs.forEach(b => {
        buffsAcumulados[b.alvoId] = (buffsAcumulados[b.alvoId] || 0) + (b.val * mult);
      });
    }
  });

  // CALCULA ATRIBUTOS FINAIS COM OS BUFFS APLICADOS
  let forca = forcaBase + (buffsAcumulados['attr-forca'] || 0);
  let agilidade = agilidadeBase + (buffsAcumulados['attr-agilidade'] || 0);
  let vigor = vigorBase + (buffsAcumulados['attr-vigor'] || 0);
  let inteligencia = inteligenciaBase + (buffsAcumulados['attr-inteligencia'] || 0);
  let presenca = presencaBase + (buffsAcumulados['attr-presenca'] || 0);
  let carisma = carismaBase + (buffsAcumulados['attr-carisma'] || 0);
  let sorte = sorteBase + (buffsAcumulados['attr-sorte'] || 0);

  // ATUALIZA VISUALMENTE OS CAMPOS DE ATRIBUTOS SE O JOGADOR NÃO ESTIVER DIGITANDO NELES
  const atualizarCampoVisual = (id, valorFinal) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = valorFinal;
    }
  };

  atualizarCampoVisual('attr-forca', forca);
  atualizarCampoVisual('attr-agilidade', agilidade);
  atualizarCampoVisual('attr-vigor', vigor);
  atualizarCampoVisual('attr-inteligencia', inteligencia);
  atualizarCampoVisual('attr-presenca', presenca);
  atualizarCampoVisual('attr-carisma', carisma);
  atualizarCampoVisual('attr-sorte', sorte);

  // RECALCULA STATUS MÁXIMOS COM OS ATRIBUTOS BUFFADOS
  document.getElementById('pv-max').value = 10 + vigor + bonusClasse.pv + (buffsAcumulados['status-pv'] || 0);
  document.getElementById('san-max').value = 4 + presenca + bonusClasse.san + (buffsAcumulados['status-san'] || 0);
  document.getElementById('pe-max').value = 5 + agilidade + vigor + bonusClasse.pe + (buffsAcumulados['status-pe'] || 0);
  document.getElementById('ma-max').value = vigor + presenca + sorte + inteligencia + bonusClasse.ma + (buffsAcumulados['status-ma'] || 0);
  document.getElementById('eva-val').value = agilidade + bonusClasse.eva + (buffsAcumulados['status-eva'] || 0);
  document.getElementById('def-val').value = Math.floor(vigor / 2) + bonusClasse.def + (buffsAcumulados['status-def'] || 0);

  let deslocamentoFinal = Math.floor(agilidade / 2) + (buffsAcumulados['status-deslocamento'] || 0);
  document.getElementById('deslocamento-val').value = `${Math.max(0, deslocamentoFinal)}m`;

  recalcularCargaEInvetario(forca, buffsAcumulados);
  recalcularPericiasEPontos(inteligencia, bonusClasse.ptsLivre, buffsAcumulados);

  if (deveSalvar) {
    salvarDados();
  }
}

// ==========================================
// CÁLCULO DE CARGA E BOLSAS
// ==========================================
function recalcularCargaEInvetario(forcaBuffada, buffsAcumulados) {
  let pesoBolsasExtra = 0;
  let pesoBolsasProprio = 0;

  let pesoTotalItens = 0;

  const calcularLista = (lista) => {
    lista.forEach(item => {
      let q = parseFloat(item.qtd) || 1;
      let p = parseFloat(item.peso) || 0;
      pesoTotalItens += (q * p);

      if (item.ehBolsa) {
        pesoBolsasExtra += (parseFloat(item.espacoBolsa) || 0) * q;
        pesoBolsasProprio += (p * q);
      }
    });
  };

  calcularLista(inventario);
  calcularLista(equipamentos);

  let limiteBase = forcaBuffada;
  let limiteTotal = limiteBase + pesoBolsasExtra + (buffsAcumulados['status-carga'] || 0);

  const cargaEl = document.getElementById('carga-val');
  cargaEl.value = `${pesoTotalItens.toFixed(1)} / ${limiteTotal} kg`;

  if (pesoBolsasProprio > forcaBuffada) {
    cargaEl.style.color = '#ff4655';
    cargaEl.title = "Sobrecarga! O peso próprio das bolsas supera sua força base!";
  } else {
    cargaEl.style.color = '#00ff88';
    cargaEl.title = "";
  }
}

// ==========================================
// RENDERIZAÇÃO DE PERÍCIAS
// ==========================================
function renderPericias() {
  const container = document.getElementById('grid-pericias');
  if (!container) return;
  container.innerHTML = '';

  LISTA_PERICIAS.forEach(p => {
    const idSafe = p.nome.toLowerCase().replace(/[^a-z0-0]/g, '');
    const div = document.createElement('div');
    div.className = 'pericia-card';
    div.id = `card-pericia-${idSafe}`;

    div.innerHTML = `
      <div class="pericia-header">
        <span class="pericia-nome">${p.nome}</span>
        <span class="pericia-attr">(${p.attr})</span>
      </div>
      <div class="pericia-body">
        <div class="pericia-field">
          <label>Nível</label>
          <select id="peri-nivel-${idSafe}" onchange="recalcularTudo(true)">
            <option value="0">Treinado (0)</option>
            <option value="1">Veterano (+5)</option>
            <option value="2">Expert (+10)</option>
          </select>
        </div>
        <div class="pericia-field">
          <label>Bônus</label>
          <input type="number" id="peri-bonus-${idSafe}" value="0" oninput="recalcularTudo(true)">
        </div>
        <div class="pericia-field">
          <label>Total</label>
          <input type="text" id="peri-total-${idSafe}" readonly class="input-readonly">
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function recalcularPericiasEPontos(inteligenciaBuffada, ptsExtraClasse, buffsAcumulados) {
  let maxPontosLivres = inteligenciaBuffada + ptsExtraClasse;
  let pontosGastos = 0;

  const classeAtual = document.getElementById('classe-base').value;
  const listaRestrita = PERICIAS_RESTREITAS_CLASSE[classeAtual] || [];

  LISTA_PERICIAS.forEach(p => {
    const idSafe = p.nome.toLowerCase().replace(/[^a-z0-0]/g, '');
    const elNivel = document.getElementById(`peri-nivel-${idSafe}`);
    const elBonus = document.getElementById(`peri-bonus-${idSafe}`);
    const elTotal = document.getElementById(`peri-total-${idSafe}`);
    const card = document.getElementById(`card-pericia-${idSafe}`);

    if (dadosPericias[idSafe]) {
      if (document.activeElement !== elNivel) elNivel.value = dadosPericias[idSafe].nivel || 0;
      if (document.activeElement !== elBonus) elBonus.value = dadosPericias[idSafe].bonus || 0;
    }

    let valNivelSelect = parseInt(elNivel.value) || 0;
    let valBonusInput = parseFloat(elBonus.value) || 0;

    let bonusGraduacao = 0;
    if (valNivelSelect === 1) bonusGraduacao = 5;
    if (valNivelSelect === 2) bonusGraduacao = 10;

    if (valNivelSelect > 0) pontosGastos++;

    let attrVal = 0;
    if (p.attr === 'Forca') attrVal = parseFloat(document.getElementById('attr-forca').value) || 0;
    if (p.attr === 'Agilidade') attrVal = parseFloat(document.getElementById('attr-agilidade').value) || 0;
    if (p.attr === 'Vigor') attrVal = parseFloat(document.getElementById('attr-vigor').value) || 0;
    if (p.attr === 'Inteligencia') attrVal = parseFloat(document.getElementById('attr-inteligencia').value) || 0;
    if (p.attr === 'Presenca') attrVal = parseFloat(document.getElementById('attr-presenca').value) || 0;
    if (p.attr === 'Carisma') attrVal = parseFloat(document.getElementById('attr-carisma').value) || 0;
    if (p.attr === 'Sorte') attrVal = parseFloat(document.getElementById('attr-sorte').value) || 0;

    let buffItemPericia = buffsAcumulados[`peri-${idSafe}`] || 0;
    let total = attrVal + bonusGraduacao + valBonusInput + buffItemPericia;

    elTotal.value = (total >= 0 ? `+${total}` : `${total}`);

    dadosPericias[idSafe] = {
      nivel: valNivelSelect,
      bonus: valBonusInput
    };

    if (listaRestrita.includes(p.nome)) {
      card.classList.add('pericia-classe');
    } else {
      card.classList.remove('pericia-classe');
    }
  });

  const displayPts = document.getElementById('pts-pericia-display');
  if (displayPts) {
    displayPts.value = `${pontosGastos} / ${maxPontosLivres}`;
    displayPts.style.color = pontosGastos > maxPontosLivres ? '#ff4655' : '#00ff88';
  }
}

// ==========================================
// GERENCIAMENTO DE INVENTÁRIO E EQUIPAMENTOS
// ==========================================
function carregarOpcoesAlvoBuff() {
  const select = document.getElementById('buff-alvo');
  if (!select) return;
  select.innerHTML = `
    <optgroup label="Atributos">
      <option value="attr-forca">Força</option>
      <option value="attr-agilidade">Agilidade</option>
      <option value="attr-vigor">Vigor</option>
      <option value="attr-inteligencia">Inteligência</option>
      <option value="attr-presenca">Presença</option>
      <option value="attr-carisma">Carisma</option>
      <option value="attr-sorte">Sorte</option>
    </optgroup>
    <optgroup label="Status Vitais">
      <option value="status-pv">Vida Máxima (PV)</option>
      <option value="status-san">Sanidade Máxima (SAN)</option>
      <option value="status-pe">Pontos de Esforço (PE)</option>
      <option value="status-ma">Mana Máxima (MA)</option>
      <option value="status-def">Defesa</option>
      <option value="status-eva">Evasão</option>
      <option value="status-deslocamento">Deslocamento</option>
      <option value="status-carga">Limite de Carga (kg)</option>
    </optgroup>
    <optgroup label="Perícias">
      ${LISTA_PERICIAS.map(p => `<option value="peri-${p.nome.toLowerCase().replace(/[^a-z0-0]/g, '')}">${p.nome}</option>`).join('')}
    </optgroup>
  `;
}

function abrirModalItem(origem, index = null) {
  itemEditandoOrigem = origem;
  itemEditandoIndex = index;
  buffsTemporarios = [];

  document.getElementById('modal-item').style.display = 'flex';
  document.getElementById('chk-eh-bolsa').checked = false;
  document.getElementById('campo-espaco-bolsa').style.display = 'none';

  if (index !== null) {
    const item = origem === 'inventario' ? inventario[index] : equipamentos[index];
    document.getElementById('item-nome').value = item.nome;
    document.getElementById('item-qtd').value = item.qtd;
    document.getElementById('item-peso').value = item.peso;
    document.getElementById('item-desc').value = item.desc || '';
    document.getElementById('item-img').value = item.img || '';

    if (item.ehBolsa) {
      document.getElementById('chk-eh-bolsa').checked = true;
      document.getElementById('campo-espaco-bolsa').style.display = 'block';
      document.getElementById('item-espaco-bolsa').value = item.espacoBolsa || 0;
    }

    buffsTemporarios = item.buffs ? [...item.buffs] : [];
  } else {
    document.getElementById('item-nome').value = '';
    document.getElementById('item-qtd').value = 1;
    document.getElementById('item-peso').value = 0;
    document.getElementById('item-desc').value = '';
    document.getElementById('item-img').value = '';
    document.getElementById('item-espaco-bolsa').value = 0;
  }

  renderBuffsTemporarios();
}

function fecharModalItem() {
  document.getElementById('modal-item').style.display = 'none';
}

function toggleCampoBolsa() {
  const ehBolsa = document.getElementById('chk-eh-bolsa').checked;
  document.getElementById('campo-espaco-bolsa').style.display = ehBolsa ? 'block' : 'none';
}

function adicionarBuffLista() {
  const alvoSelect = document.getElementById('buff-alvo');
  const valInput = document.getElementById('buff-val');

  const alvoId = alvoSelect.value;
  const alvoNome = alvoSelect.options[alvoSelect.selectedIndex].text;
  const val = parseFloat(valInput.value) || 0;

  if (val === 0) return;

  buffsTemporarios.push({ alvoId, alvoNome, val });
  valInput.value = '';
  renderBuffsTemporarios();
}

function removerBuffTemporario(index) {
  buffsTemporarios.splice(index, 1);
  renderBuffsTemporarios();
}

function renderBuffsTemporarios() {
  const container = document.getElementById('lista-buffs-item');
  container.innerHTML = '';
  buffsTemporarios.forEach((b, i) => {
    const tag = document.createElement('span');
    tag.className = 'buff-tag';
    tag.innerHTML = `${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val} <b onclick="removerBuffTemporario(${i})">&times;</b>`;
    container.appendChild(tag);
  });
}

function salvarItemModal() {
  const nome = document.getElementById('item-nome').value.trim();
  if (!nome) {
    alert('O item precisa de um nome!');
    return;
  }

  const itemObj = {
    nome,
    qtd: parseInt(document.getElementById('item-qtd').value) || 1,
    peso: parseFloat(document.getElementById('item-peso').value) || 0,
    desc: document.getElementById('item-desc').value,
    img: document.getElementById('item-img').value,
    ehBolsa: document.getElementById('chk-eh-bolsa').checked,
    espacoBolsa: parseFloat(document.getElementById('item-espaco-bolsa').value) || 0,
    buffs: [...buffsTemporarios]
  };

  const lista = itemEditandoOrigem === 'inventario' ? inventario : equipamentos;

  if (itemEditandoIndex !== null) {
    lista[itemEditandoIndex] = itemObj;
  } else {
    lista.push(itemObj);
  }

  fecharModalItem();
  renderItens();
  recalcularTudo(true);
}

function moverItem(origem, index) {
  if (origem === 'inventario') {
    const item = inventario.splice(index, 1)[0];
    equipamentos.push(item);
  } else {
    const item = equipamentos.splice(index, 1)[0];
    inventario.push(item);
  }
  renderItens();
  recalcularTudo(true);
}

function deletarItem(origem, index) {
  if (confirm('Deseja realmente excluir este item?')) {
    if (origem === 'inventario') inventario.splice(index, 1);
    else equipamentos.splice(index, 1);
    renderItens();
    recalcularTudo(true);
  }
}

function renderItens() {
  const contInv = document.getElementById('container-inventario');
  const contEqp = document.getElementById('container-equipamentos');

  const criarCardHTML = (item, i, origem) => {
    let buffsHTML = (item.buffs || []).map(b => `<span class="mini-buff">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val}</span>`).join('');
    let imgHTML = item.img ? `<img src="${item.img}" class="item-thumb" onclick="abrirImagemFull('${item.img}')">` : '';
    let bolsaHTML = item.ehBolsa ? `<span class="tag-bolsa">+${item.espacoBolsa}kg Carga</span>` : '';

    return `
      <div class="item-card">
        ${imgHTML}
        <div class="item-info">
          <div class="item-title">${item.nome} (x${item.qtd}) ${bolsaHTML}</div>
          <div class="item-meta">Peso: ${item.peso * item.qtd}kg (${item.peso}kg un)</div>
          ${item.desc ? `<div class="item-desc">${item.desc}</div>` : ''}
          <div class="item-buffs-list">${buffsHTML}</div>
        </div>
        <div class="item-actions">
          <button onclick="moverItem('${origem}', ${i})" title="${origem === 'inventario' ? 'Equipar' : 'Desequipar'}">
            ${origem === 'inventario' ? '🛡️' : '📦'}
          </button>
          <button onclick="abrirModalItem('${origem}', ${i})" title="Editar">✏️</button>
          <button onclick="deletarItem('${origem}', ${i})" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  };

  if (contInv) contInv.innerHTML = inventario.map((item, i) => criarCardHTML(item, i, 'inventario')).join('');
  if (contEqp) contEqp.innerHTML = equipamentos.map((item, i) => criarCardHTML(item, i, 'equipamentos')).join('');
}

// ==========================================
// MODAL DE IMAGEM AMPLIADA
// ==========================================
function abrirImagemFull(url) {
  document.getElementById('img-ampliada').src = url;
  document.getElementById('modal-imagem').style.display = 'flex';
}
function fecharModalImagem() {
  document.getElementById('modal-imagem').style.display = 'none';
}

// ==========================================
// OUTROS SISTEMAS (EXP, EFEITOS, BLOCOS)
// ==========================================
function abrirModalExp() { document.getElementById('modal-exp').style.display = 'flex'; }
function fecharModalExp() { document.getElementById('modal-exp').style.display = 'none'; }

function adicionarExpModal(qtd) {
  expAtual += qtd;
  let nivel = parseInt(document.getElementById('nivel').value) || 1;
  let expNecessario = nivel * 100;

  while (expAtual >= expNecessario) {
    expAtual -= expNecessario;
    nivel++;
    expNecessario = nivel * 100;
  }

  document.getElementById('nivel').value = nivel;
  fecharModalExp();
  recalcularTudo(true);
}

function adicionarEfeito() {
  const nome = prompt('Nome da Condição / Buff / Debuff:');
  if (nome) {
    efeitos.push(nome);
    renderEfeitos();
    salvarDados();
  }
}

function removerEfeito(i) {
  efeitos.splice(i, 1);
  renderEfeitos();
  salvarDados();
}

function renderEfeitos() {
  const container = document.getElementById('lista-efeitos');
  if (!container) return;
  container.innerHTML = efeitos.map((ef, i) => `
    <span class="efeito-tag">${ef} <b onclick="removerEfeito(${i})">&times;</b></span>
  `).join('');
}

function criarBlocoAnotacao() {
  blocosAnotacoes.push({ titulo: "Nova Anotação", texto: "" });
  renderBlocosAnotacoes();
  salvarDados();
}

function deletarBloco(i) {
  blocosAnotacoes.splice(i, 1);
  renderBlocosAnotacoes();
  salvarDados();
}

function atualizarBloco(i, campo, val) {
  blocosAnotacoes[i][campo] = val;
  salvarDados();
}

function renderBlocosAnotacoes() {
  const container = document.getElementById('container-blocos-anotacoes');
  if (!container) return;
  container.innerHTML = blocosAnotacoes.map((b, i) => `
    <div class="bloco-card">
      <div class="bloco-header">
        <input type="text" value="${b.titulo}" oninput="atualizarBloco(${i}, 'titulo', this.value)">
        <button onclick="deletarBloco(${i})">🗑️</button>
      </div>
      <textarea oninput="atualizarBloco(${i}, 'texto', this.value)">${b.texto}</textarea>
    </div>
  `).join('');
}

// ==========================================
// NAVEGAÇÃO POR ABAS
// ==========================================
function mudarAba(idAba, btn) {
  const conteudos = document.querySelectorAll('.tab-content');
  const botoes = document.querySelectorAll('.tab-btn');

  conteudos.forEach(c => c.style.display = 'none');
  botoes.forEach(b => b.classList.remove('active'));

  document.getElementById(idAba).style.display = 'block';
  btn.classList.add('active');
}

function mudarSubAba(idSub, btn) {
  const conteudos = btn.parentElement.nextElementSibling.children;
  for (let c of conteudos) c.style.display = 'none';

  const botoes = btn.parentElement.querySelectorAll('.sub-tab-btn');
  botoes.forEach(b => b.classList.remove('active'));

  document.getElementById(idSub).style.display = 'block';
  btn.classList.add('active');
}

// ==========================================
// PAINEL / DASHBOARD DO MESTRE
// ==========================================
function escutarFichasMestre() {
  const ref = database.ref('fichas');
  ref.on('value', (snapshot) => {
    const data = snapshot.val() || {};
    renderMestreDashboard(data);
  });
}

function renderMestreDashboard(fichas) {
  const container = document.getElementById('grid-mestre-cards');
  if (!container) return;
  container.innerHTML = '';

  Object.keys(fichas).forEach(id => {
    const f = fichas[id];
    const card = document.createElement('div');
    card.className = 'mestre-card';
    card.onclick = () => abrirFichaPeloMestre(id);

    card.innerHTML = `
      <div class="mestre-card-title">${f.nome || id}</div>
      <div class="mestre-card-sub">${f.classeBase || 'Sem Classe'} - Nível ${f.nivel || 1}</div>
      <div class="mestre-card-stats">
        <span>PV: ${f.pvAtual || 0}/${f.pvMax || 0}</span>
        <span>SAN: ${f.sanAtual || 0}/${f.sanMax || 0}</span>
        <span>PE: ${f.peAtual || 0}/${f.peMax || 0}</span>
        <span>MA: ${f.maAtual || 0}/${f.maMax || 0}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function abrirFichaPeloMestre(id) {
  idFichaAtual = id;
  document.getElementById('mestre-dashboard').style.display = 'none';
  document.getElementById('tela-ficha').style.display = 'block';
  carregarFichaFirebase(id);
}
