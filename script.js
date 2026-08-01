// CONFIGURAÇÃO DO FIREBASE
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// SENHA PARA O MESTRE
const SENHA_MESTRE = "2510";

let idFichaAtual = null;
let éMestre = false;
let escutandoFirebaseRef = null;

const periciasLista = [
  "Acrobacia", "Arcanismo", "Adestramento", "Artes", "Atletismo", "Atualidades", "Ciência",
  "Diplomacia", "Enganação", "Furto", "Fortitude", "Furtividade", "Historia", "Iniciativa",
  "Intimidação", "Intuição", "Investigação", "Luta", "Medicina", "Magia", "Natureza",
  "Ocultismo", "Percepção", "Produção", "Pilotagem", "Pontaria", "Reflexos", "Religião",
  "Sobrevivência", "Tática", "Tolerancia", "Tecnologia", "Vontade"
];

let dadosPericias = {};
let inventario = [];
let equipamentos = [];
let efeitos = [];
let blocosAnotacoes = [];
let buffsTempItem = [];
let buffsTempGmEffect = [];
let efeitosGlobaisSalvos = {};
let defesasEspecificas = { perfuracao:0, queimadura:0, corte:0, impacto:0, balistico:0, eletricidade:0, fogo:0, frio:0, acido:0, veneno:0, magico:0 };
let expAtual = 0;

// --- DADOS DOS SLOTS DE MAGIA ---
let slotsAtuais = [0, 0, 0, 0, 0, 0, 0, 0, 0];

const tabelaDND = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

const tabelaClassePadrao = {
  Combatente:  [1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5],
  Especialista:[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10],
  Místico:     [3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12]
};

let timerDebounce = null;

window.onload = () => {
  popularOpcoesBuff();
  renderPericias();
  renderizarSlots();
  escutarEfeitosGlobais();

  const telaFicha = document.getElementById('screen-sheet');

  telaFicha.addEventListener('change', (e) => {
    if (e.target.closest('#modal-xp')) return;
    if (e.target.tagName !== 'TEXTAREA') {
      recalcularTudo(true);
    }
  });

  telaFicha.addEventListener('input', (e) => {
    if (e.target.closest('#modal-xp')) return;
    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(() => {
      recalcularTudo(true);
    }, 600); 
  });
};

function escutarEfeitosGlobais() {
  database.ref('efeitosGlobais').on('value', (snapshot) => {
    efeitosGlobaisSalvos = snapshot.val() || {};
    renderEfeitosGlobaisNoMestre();
    popularSelectEfeitosGlobais();
  });
}

function setModoAcesso(modo) {
  document.getElementById('btn-mode-player').classList.toggle('active', modo === 'player');
  document.getElementById('btn-mode-gm').classList.toggle('active', modo === 'gm');
  document.getElementById('panel-player').classList.toggle('active', modo === 'player');
  document.getElementById('panel-gm').classList.toggle('active', modo === 'gm');
}

function mostrarTela(screenId) {
  document.querySelectorAll('.screen-container').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function voltarParaSelecao() {
  if (escutandoFirebaseRef) escutandoFirebaseRef.off();
  idFichaAtual = null;
  éMestre = false;
  mostrarTela('screen-select');
}

function entrarComoJogador() {
  const inputID = document.getElementById('input-player-id').value.trim().toLowerCase();
  if (!inputID) return alert("Por favor, digite o nome/ID do seu personagem!");

  idFichaAtual = inputID;
  éMestre = false;
  document.getElementById('badge-gm-view').style.display = 'none';
  document.getElementById('label-ficha-ativa').innerText = `Ficha: ${idFichaAtual}`;

  carregarFichaEConectar();
  mostrarTela('screen-sheet');
}

function entrarComoMestre() {
  const senhaInput = document.getElementById('input-gm-pass').value;
  if (senhaInput !== SENHA_MESTRE) return alert("Senha do Mestre incorreta!");

  éMestre = true;
  carregarPainelMestre();
  mostrarTela('screen-gm-dashboard');
}

function carregarPainelMestre() {
  const container = document.getElementById('gm-cards-list');
  container.innerHTML = "<p>Carregando fichas...</p>";

  database.ref('fichas').on('value', (snapshot) => {
    container.innerHTML = '';
    const fichas = snapshot.val();

    if (!fichas) {
      container.innerHTML = "<p>Nenhuma ficha cadastrada ainda no sistema.</p>";
      return;
    }

    Object.keys(fichas).forEach(id => {
      const f = fichas[id];
      container.innerHTML += `
        <div class="gm-card">
          <div class="gm-card-header">
            <h3>${f.nome || id}</h3>
            <small>ID: ${id}</small>
          </div>
          <div class="gm-card-stats">
            <span>Nível: <strong>${f.nivel || 1}</strong></span>
            <span>Classe: <strong>${f.classeBase || '-'}</strong></span>
            <span>PV: <strong>${f.pvAtual || 0} / ${f.pvMax || 0}</strong></span>
            <span>PE: <strong>${f.peAtual || 0} / ${f.peMax || 0}</strong></span>
            <span>SAN: <strong>${f.sanAtual || 0} / ${f.sanMax || 0}</strong></span>
            <span>MA: <strong>${f.maAtual || 0} / ${f.maMax || 0}</strong></span>
          </div>
          <button class="btn-primary" onclick="mestreAbrirFicha('${id}')">👁️ Abrir / Editar Ficha</button>
        </div>
      `;
    });
  });
}

function mestreAbrirFicha(idFicha) {
  idFichaAtual = idFicha;
  document.getElementById('badge-gm-view').style.display = 'inline-block';
  document.getElementById('label-ficha-ativa').innerText = `Editando Ficha: ${idFichaAtual}`;

  carregarFichaEConectar();
  mostrarTela('screen-sheet');
}

function carregarFichaEConectar() {
  if (escutandoFirebaseRef) escutandoFirebaseRef.off();

  escutandoFirebaseRef = database.ref('fichas/' + idFichaAtual);
  escutandoFirebaseRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      aplicarDadosFicha(data);
    } else {
      recalcularTudo(false);
    }
  });
}

function atualizarCampoSeInativo(idElemento, valorNovo) {
  const el = document.getElementById(idElemento);
  if (el && document.activeElement !== el) {
    if (el.type === 'checkbox') {
      el.checked = !!valorNovo;
    } else {
      el.value = valorNovo !== undefined ? valorNovo : '';
    }
  }
}

function aplicarDadosFicha(data) {
  atualizarCampoSeInativo('nome', data.nome || idFichaAtual);
  atualizarCampoSeInativo('nivel', data.nivel || 1);
  expAtual = data.expAtual || 0;
  atualizarCampoSeInativo('nex', data.nex || '20%');
  atualizarCampoSeInativo('idade', data.idade || '');
  atualizarCampoSeInativo('traco', data.traco || '');
  atualizarCampoSeInativo('classe-base', data.classeBase || 'Místico');
  atualizarCampoSeInativo('classe-add', data.classeAdd || '');
  atualizarCampoSeInativo('origem', data.origem || '');
  atualizarCampoSeInativo('raca', data.raca || '');
  atualizarCampoSeInativo('sexualidade', data.sexualidade || '');
  atualizarCampoSeInativo('genero', data.genero || '');
  atualizarCampoSeInativo('traumas', data.traumas || '');

  atualizarCampoSeInativo('pv-atual', data.pvAtual || 0);
  atualizarCampoSeInativo('san-atual', data.sanAtual || 0);
  atualizarCampoSeInativo('pe-atual', data.peAtual || 0);
  atualizarCampoSeInativo('ma-atual', data.maAtual || 0);
  atualizarCampoSeInativo('tp-val', data.tpVal || 0);

  atualizarCampoSeInativo('attr-forca', data.attrForca || 10);
  atualizarCampoSeInativo('attr-agilidade', data.attrAgilidade || 10);
  atualizarCampoSeInativo('attr-vigor', data.attrVigor || 10);
  atualizarCampoSeInativo('attr-inteligencia', data.attrInteligencia || 10);
  atualizarCampoSeInativo('attr-presenca', data.attrPresenca || 10);
  atualizarCampoSeInativo('attr-carisma', data.attrCarisma || 10);
  atualizarCampoSeInativo('attr-sorte', data.attrSorte || 10);

  defesasEspecificas = data.defesasEspecificas || { perfuracao:0, queimadura:0, corte:0, impacto:0, balistico:0, eletricidade:0, fogo:0, frio:0, acido:0, veneno:0, magico:0 };

  atualizarCampoSeInativo('hab-unicas', data.habUnicas || '');
  atualizarCampoSeInativo('hab-lendarias', data.habLendarias || '');
  atualizarCampoSeInativo('hab-epicas', data.habEpicas || '');
  atualizarCampoSeInativo('hab-raras', data.habRaras || '');
  atualizarCampoSeInativo('hab-incomuns', data.habIncomuns || '');
  atualizarCampoSeInativo('hab-comuns', data.habComuns || '');

  atualizarCampoSeInativo('skills-texto', data.skillsTexto || '');
  atualizarCampoSeInativo('feiticos-texto', data.feiticosTexto || '');
  atualizarCampoSeInativo('rituais-texto', data.rituaisTexto || '');

  if (data.slotsMagia) {
    slotsAtuais = data.slotsMagia.atuais || [0, 0, 0, 0, 0, 0, 0, 0, 0];
    atualizarCampoSeInativo('classe-magica-1', data.slotsMagia.magica1);
    atualizarCampoSeInativo('nv-classe-magica-1', data.slotsMagia.nvMagica1 || 0);
    atualizarCampoSeInativo('classe-magica-2', data.slotsMagia.magica2);
    atualizarCampoSeInativo('nv-classe-magica-2', data.slotsMagia.nvMagica2 || 0);
  }

  dadosPericias = data.dadosPericias || {};
  inventario = data.inventario || [];
  equipamentos = data.equipamentos || [];
  efeitos = data.efeitos || [];
  blocosAnotacoes = data.blocosAnotacoes || [];

  renderItens();
  renderEfeitos();
  renderBlocosAnotacoes();
  renderizarSlots();
  recalcularTudo(false);
}

function atualizarDefesaBase(tipo, valor) {
  defesasEspecificas[tipo] = parseInt(valor) || 0;
  salvarDados();
}

function salvarDados() {
  if (!idFichaAtual) return;

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

    attrForca: document.getElementById('attr-forca').value,
    attrAgilidade: document.getElementById('attr-agilidade').value,
    attrVigor: document.getElementById('attr-vigor').value,
    attrInteligencia: document.getElementById('attr-inteligencia').value,
    attrPresenca: document.getElementById('attr-presenca').value,
    attrCarisma: document.getElementById('attr-carisma').value,
    attrSorte: document.getElementById('attr-sorte').value,

    defesasEspecificas: defesasEspecificas,

    habUnicas: document.getElementById('hab-unicas').value,
    habLendarias: document.getElementById('hab-lendarias').value,
    habEpicas: document.getElementById('hab-epicas').value,
    habRaras: document.getElementById('hab-raras').value,
    habIncomuns: document.getElementById('hab-incomuns').value,
    habComuns: document.getElementById('hab-comuns').value,

    skillsTexto: document.getElementById('skills-texto').value,
    feiticosTexto: document.getElementById('feiticos-texto').value,
    rituaisTexto: document.getElementById('rituais-texto').value,

    slotsMagia: {
      atuais: slotsAtuais,
      magica1: document.getElementById('classe-magica-1')?.checked || false,
      nvMagica1: document.getElementById('nv-classe-magica-1')?.value || 0,
      magica2: document.getElementById('classe-magica-2')?.checked || false,
      nvMagica2: document.getElementById('nv-classe-magica-2')?.value || 0
    },

    dadosPericias, inventario, equipamentos, efeitos, blocosAnotacoes
  };

  database.ref('fichas/' + idFichaAtual).update(estadoFicha);
}

function toggleDefesaTooltip(e) {
  e.stopPropagation();
  const box = document.getElementById('defensa-tooltip-box');
  if (box) box.classList.toggle('active');
}

document.addEventListener('click', (e) => {
  const box = document.getElementById('defensa-tooltip-box');
  if (box && !box.contains(e.target) && !e.target.classList.contains('btn-def-asterisk')) {
    box.classList.remove('active');
  }
});

function openTab(tabName, evt) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  if (evt) evt.currentTarget.classList.add('active');
}

function openSubTab(subTabName, evt) {
  document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`subtab-${subTabName}`).classList.add('active');
  if (evt) evt.currentTarget.classList.add('active');
}

function formatarNEX(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val !== '') {
    if (parseInt(val) > 100) val = '100';
    input.value = `${val}%`;
  } else { input.value = '0%'; }
  recalcularTudo();
}

function abrirModalXP() {
  document.getElementById('modal-xp').classList.add('active');
  document.getElementById('xp-input-val').value = '0';
}

function fecharModalXP() {
  document.getElementById('modal-xp').classList.remove('active');
}

function somarXPInput(val) {
  let campo = document.getElementById('xp-input-val');
  let atual = parseInt(campo.value) || 0;
  campo.value = atual + val;
}

function confirmarGanhoXP() {
  let ganho = parseInt(document.getElementById('xp-input-val').value) || 0;
  if (ganho <= 0) return fecharModalXP();

  let nivelAtual = parseInt(document.getElementById('nivel').value) || 1;
  expAtual += ganho;
  let expNecessario = nivelAtual * 100;

  while (expAtual >= expNecessario) {
    expAtual -= expNecessario;
    nivelAtual++;
    expNecessario = nivelAtual * 100;
  }

  document.getElementById('nivel').value = nivelAtual;
  fecharModalXP();
  recalcularTudo();
}

function popularOpcoesBuff() {
  const selects = [document.getElementById('buff-alvo'), document.getElementById('gm-effect-buff-alvo')];
  const htmlOptions = `
    <optgroup label="Atributos">
      <option value="attr-forca">Força</option>
      <option value="attr-agilidade">Agilidade</option>
      <option value="attr-vigor">Vigor</option>
      <option value="attr-inteligencia">Inteligência</option>
      <option value="attr-presenca">Presença</option>
      <option value="attr-carisma">Carisma</option>
      <option value="attr-sorte">Sorte</option>
    </optgroup>
    <optgroup label="Status & Estatísticas">
      <option value="status-pv">Vida (PV)</option>
      <option value="status-san">Sanidade (SAN)</option>
      <option value="status-pe">Esforço (PE)</option>
      <option value="status-ma">Mana (MA)</option>
      <option value="status-def">Defesa (DEF)</option>
      <option value="status-eva">Evasão (EVA)</option>
      <option value="status-deslocamento">Deslocamento (m)</option>
    </optgroup>
    <optgroup label="Defesas Específicas">
      <option value="def-perfuracao">Perfuração</option>
      <option value="def-queimadura">Queimadura</option>
      <option value="def-corte">Corte</option>
      <option value="def-impacto">Impacto</option>
      <option value="def-balistico">Balístico</option>
      <option value="def-eletricidade">Eletricidade</option>
      <option value="def-fogo">Fogo</option>
      <option value="def-frio">Frio</option>
      <option value="def-acido">Ácido</option>
      <option value="def-veneno">Veneno</option>
      <option value="def-magico">Mágico</option>
    </optgroup>
    <optgroup label="Perícias">
      ${periciasLista.map(p => `<option value="pericia-${p}">${p}</option>`).join('')}
    </optgroup>
  `;

  selects.forEach(s => { if (s) s.innerHTML = htmlOptions; });
}

function adicionarBuffItemTemp() {
  const select = document.getElementById('buff-alvo');
  const alvoId = select.value;
  const alvoNome = select.options[select.selectedIndex].text;
  const val = parseInt(document.getElementById('buff-valor').value) || 0;
  if (val === 0) return;
  buffsTempItem.push({ alvoId, alvoNome, val });
  renderBuffsTemp();
}

function renderBuffsTemp() {
  const container = document.getElementById('lista-buffs-temp');
  if (!container) return;
  container.innerHTML = buffsTempItem.map((b, idx) => `
    <span class="buff-tag">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val} <span onclick="removerBuffTemp(${idx})">×</span></span>
  `).join('');
}

function removerBuffTemp(idx) {
  buffsTempItem.splice(idx, 1);
  renderBuffsTemp();
}

function renderPericias() {
  const container = document.getElementById('grid-pericias');
  if (!container) return;
  container.innerHTML = '';
  periciasLista.forEach(p => {
    let val = dadosPericias[p] !== undefined ? dadosPericias[p] : 0;
    container.innerHTML += `
      <div class="card-pericia" id="card-pericia-${p}">
        <label>${p}</label>
        <div class="card-pericia-inputs">
          <input type="number" id="pericia-${p}" value="${val}" min="0" onchange="alterarPontosPericia('${p}', this.value)">
          <span class="bonus-tag" id="bonus-pericia-${p}">+${val * 2}</span>
        </div>
      </div>
    `;
  });
}

function alterarPontosPericia(pericia, valor) {
  dadosPericias[pericia] = Math.max(0, parseInt(valor) || 0);
  recalcularTudo();
}

function calcularSlotsMaximos() {
  let maximos = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  let nexTexto = document.getElementById('nex')?.value || '0%';
  let nexNum = parseInt(nexTexto.replace(/[^0-9]/g, '')) || 0;
  maximos[0] += Math.floor(nexNum / 5);

  let nivelPersonagem = parseInt(document.getElementById('nivel')?.value) || 1;
  nivelPersonagem = Math.min(Math.max(nivelPersonagem, 1), 20);
  
  let classeBase = document.getElementById('classe-base')?.value || 'Combatente';
  if (tabelaClassePadrao[classeBase]) {
    maximos[0] += tabelaClassePadrao[classeBase][nivelPersonagem - 1];
  }

  if (document.getElementById('classe-magica-1')?.checked) {
    let nv1 = parseInt(document.getElementById('nv-classe-magica-1')?.value) || 0;
    if (nv1 > 0) {
      let idx1 = Math.min(Math.max(nv1, 1), 20) - 1;
      let slotsClasse1 = tabelaDND[idx1];
      for (let i = 0; i < 9; i++) {
        maximos[i] += slotsClasse1[i];
      }
    }
  }

  if (document.getElementById('classe-magica-2')?.checked) {
    let nv2 = parseInt(document.getElementById('nv-classe-magica-2')?.value) || 0;
    if (nv2 > 0) {
      let idx2 = Math.min(Math.max(nv2, 1), 20) - 1;
      let slotsClasse2 = tabelaDND[idx2];
      for (let i = 0; i < 9; i++) {
        maximos[i] += slotsClasse2[i];
      }
    }
  }

  return maximos;
}

function renderizarSlots() {
  const container = document.getElementById('circulos-grid');
  if (!container) return;

  const maximos = calcularSlotsMaximos();
  container.innerHTML = '';

  for (let i = 0; i < 9; i++) {
    let circulo = i + 1;
    let atual = slotsAtuais[i] || 0;
    let max = maximos[i];

    let card = document.createElement('div');
    card.className = 'circulo-card';
    card.innerHTML = `
      <div class="circulo-info">${circulo}º Círculo</div>
      <div class="circulo-controles">
        <button type="button" class="btn-slot" onclick="alterarSlot(${i}, -1)">-</button>
        <span><strong>${atual}</strong> / ${max}</span>
        <button type="button" class="btn-slot" onclick="alterarSlot(${i}, 1)">+</button>
        ${i < 8 ? `<button type="button" class="btn-fundir" ${atual < 2 ? 'disabled' : ''} onclick="fundirSlots(${i})">Fundir (2x ➔ 1x Nv.${circulo + 1})</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  }
}

function alterarSlot(index, delta) {
  slotsAtuais[index] = Math.max(0, (slotsAtuais[index] || 0) + delta);
  renderizarSlots();
  salvarDados();
}

function fundirSlots(index) {
  if (slotsAtuais[index] >= 2 && index < 8) {
    slotsAtuais[index] -= 2;
    slotsAtuais[index + 1] = (slotsAtuais[index + 1] || 0) + 1;
    renderizarSlots();
    salvarDados();
  }
}

function restaurarSlotsDescanso() {
  const maximos = calcularSlotsMaximos();
  for (let i = 0; i < 9; i++) {
    if (slotsAtuais[i] < maximos[i]) {
      slotsAtuais[i] = maximos[i];
    }
  }
  renderizarSlots();
  salvarDados();
}

function zerarTodosSlots() {
  slotsAtuais = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  renderizarSlots();
  salvarDados();
}

function recalcularSlotsMagia() {
  renderizarSlots();
  salvarDados();
}

// --- CÁLCULO DE VALOR ESCALADO DE EFEITOS (INCLUI SUPORTE A EXPONENCIAL) ---
function calcularEfeitoValorEscalado(valorBase, tipoEscala, fator, nivel) {
  let vBase = parseFloat(valorBase) || 0;
  let lvl = Math.max(1, parseInt(nivel) || 1);
  let fat = parseFloat(fator) || 0;

  if (tipoEscala === 'multiplicativo') {
    return vBase * lvl;
  } else if (tipoEscala === 'percentual') {
    return vBase * (1 + ((fat / 100) * (lvl - 1)));
  } else if (tipoEscala === 'adicao') {
    return vBase + (fat * (lvl - 1));
  } else if (tipoEscala === 'exponencial') {
    return vBase * Math.pow(fat || 1.5, lvl - 1);
  }
  return vBase;
}

// --- RECALCULAR TUDO ---
function recalcularTudo(deveSalvar = true) {
  let nivel = parseInt(document.getElementById('nivel').value) || 1;
  let expNecessario = nivel * 100;
  document.getElementById('exp-display').value = `${expAtual} / ${expNecessario}`;

  let forcaBase = parseFloat(document.getElementById('attr-forca').value) || 0;
  let agilidadeBase = parseFloat(document.getElementById('attr-agilidade').value) || 0;
  let vigorBase = parseFloat(document.getElementById('attr-vigor').value) || 0;
  let inteligenciaBase = parseFloat(document.getElementById('attr-inteligencia').value) || 0;
  let presencaBase = parseFloat(document.getElementById('attr-presenca').value) || 0;
  let carismaBase = parseFloat(document.getElementById('attr-carisma').value) || 0;
  let sorteBase = parseFloat(document.getElementById('attr-sorte').value) || 0;

  const classeBase = document.getElementById('classe-base').value;
  let bonusClasse = { pv: 0, pe: 0, san: 0, ma: 0, def: 0, eva: 0, ptsLivre: 0 };

  if (classeBase === 'Combatente') {
    bonusClasse.pv = 10; bonusClasse.pe = 5; bonusClasse.def = 1; bonusClasse.eva = 1;
  } else if (classeBase === 'Especialista') {
    bonusClasse.pe = 4; bonusClasse.ptsLivre = 5;
  } else if (classeBase === 'Místico') {
    bonusClasse.pv = 4; bonusClasse.san = 5; bonusClasse.ma = 10;
  }

  let buffsAcumulados = {};

  equipamentos.forEach(item => {
    let mult = parseInt(item.qtd) || 1;
    if (item.buffs) {
      item.buffs.forEach(b => {
        buffsAcumulados[b.alvoId] = (buffsAcumulados[b.alvoId] || 0) + (b.val * mult);
      });
    }
  });

  efeitos.forEach(ef => {
    let lvl = ef.nivelAtual || 1;
    if (ef.buffs) {
      ef.buffs.forEach(b => {
        let valEscalado = calcularEfeitoValorEscalado(b.val, ef.tipoEscala, ef.fatorEscala, lvl);
        buffsAcumulados[b.alvoId] = (buffsAcumulados[b.alvoId] || 0) + valEscalado;
      });
    }
  });

  let forca = forcaBase + (buffsAcumulados['attr-forca'] || 0);
  let agilidade = agilidadeBase + (buffsAcumulados['attr-agilidade'] || 0);
  let vigor = vigorBase + (buffsAcumulados['attr-vigor'] || 0);
  let inteligencia = inteligenciaBase + (buffsAcumulados['attr-inteligencia'] || 0);
  let presenca = presencaBase + (buffsAcumulados['attr-presenca'] || 0);
  let carisma = carismaBase + (buffsAcumulados['attr-carisma'] || 0);
  let sorte = sorteBase + (buffsAcumulados['attr-sorte'] || 0);

  const listaAtributos = ['forca', 'agilidade', 'vigor', 'inteligencia', 'presenca', 'carisma', 'sorte'];
  listaAtributos.forEach(attr => {
    let inputEl = document.getElementById(`attr-${attr}`);
    let buffVal = buffsAcumulados[`attr-${attr}`] || 0;
    
    let tagAntiga = document.getElementById(`tag-buff-${attr}`);
    if (tagAntiga) tagAntiga.remove();

    if (buffVal !== 0 && inputEl && inputEl.parentNode) {
      let novaTag = document.createElement('span');
      novaTag.id = `tag-buff-${attr}`;
      novaTag.className = 'bonus-tag ativo';
      novaTag.style.marginLeft = '8px';
      novaTag.innerText = buffVal > 0 ? `+${buffVal} Buff` : `${buffVal} Debuff`;
      
      inputEl.parentNode.insertBefore(novaTag, inputEl.nextSibling);
    }
  });

  document.getElementById('pv-max').value = 10 + vigor + bonusClasse.pv + (buffsAcumulados['status-pv'] || 0);
  document.getElementById('san-max').value = 4 + presenca + bonusClasse.san + (buffsAcumulados['status-san'] || 0);
  document.getElementById('pe-max').value = 5 + agilidade + vigor + bonusClasse.pe + (buffsAcumulados['status-pe'] || 0);
  document.getElementById('ma-max').value = vigor + presenca + sorte + inteligencia + bonusClasse.ma + (buffsAcumulados['status-ma'] || 0);
  document.getElementById('eva-val').value = agilidade + bonusClasse.eva + (buffsAcumulados['status-eva'] || 0);
  document.getElementById('def-val').value = Math.floor(vigor / 2) + bonusClasse.def + (buffsAcumulados['status-def'] || 0);

  // EXIBE AS DEFESAS ESPECÍFICAS CALCULADAS SEM SUBSCREVER A BASE (CORREÇÃO DO BUG)
  const defsLista = ['perfuracao','queimadura','corte','impacto','balistico','eletricidade','fogo','frio','acido','veneno','magico'];
  defsLista.forEach(d => {
    let el = document.getElementById(`def-${d}`);
    if (el) {
      let baseVal = defesasEspecificas[d] || 0;
      let buffVal = buffsAcumulados[`def-${d}`] || 0;
      el.value = baseVal + buffVal;
      el.onchange = (e) => atualizarDefesaBase(d, e.target.value);
    }
  });

  let deslocamentoFinal = Math.floor(agilidade / 2) + (buffsAcumulados['status-deslocamento'] || 0);
  document.getElementById('deslocamento-val').value = `${Math.max(0, deslocamentoFinal)}m`;

  let ptsLivresTotais = inteligencia + bonusClasse.ptsLivre;
  let ptsLivresGastos = 0;
  let ptsClasseTotais = 0;
  let ptsClasseGastos = 0;
  let listaRestritas = [];

  if (classeBase === 'Místico') {
    listaRestritas = ["Arcanismo", "Ocultismo", "Magia"];
    ptsClasseTotais = 1;
  } else if (classeBase === 'Combatente') {
    listaRestritas = ["Luta", "Pontaria", "Reflexos", "Fortitude"];
    ptsClasseTotais = 2;
  }

  periciasLista.forEach(p => {
    let pontosColocados = dadosPericias[p] !== undefined ? dadosPericias[p] : 0;
    if (listaRestritas.includes(p)) {
      let paraClasse = Math.min(pontosColocados, ptsClasseTotais - ptsClasseGastos);
      ptsClasseGastos += paraClasse;
      ptsLivresGastos += (pontosColocados - paraClasse);
    } else {
      ptsLivresGastos += pontosColocados;
    }
  });

  let classePontosRestantes = ptsClasseTotais - ptsClasseGastos;

  periciasLista.forEach(p => {
    let input = document.getElementById(`pericia-${p}`);
    let tagBonus = document.getElementById(`bonus-pericia-${p}`);
    let cardEl = document.getElementById(`card-pericia-${p}`);
    let bonusItem = buffsAcumulados[`pericia-${p}`] || 0;
    
    let bonusMisticoVontade = (classeBase === 'Místico' && p === 'Vontade') ? 1 : 0;
    let pontosColocados = dadosPericias[p] !== undefined ? dadosPericias[p] : 0;

    if (input && document.activeElement !== input) input.value = pontosColocados;

    if (cardEl) {
      if (listaRestritas.includes(p) && classePontosRestantes > 0) {
        cardEl.classList.add('pericia-restrita');
      } else {
        cardEl.classList.remove('pericia-restrita');
      }
    }

    let totalPontosEfetivos = pontosColocados + bonusMisticoVontade;
    let valorTotalRole = (totalPontosEfetivos * 2) + bonusItem;
    
    if (tagBonus) {
      tagBonus.innerText = valorTotalRole >= 0 ? `+${valorTotalRole}` : `${valorTotalRole}`;
      if (totalPontosEfetivos > 0 || bonusItem !== 0) tagBonus.classList.add('ativo');
      else tagBonus.classList.remove('ativo');
    }
  });

  document.getElementById('pts-livres-totais').innerText = ptsLivresTotais;
  let livresRestantes = ptsLivresTotais - ptsLivresGastos;
  document.getElementById('pts-livres-restantes').innerText = livresRestantes;
  document.getElementById('pts-livres-restantes').style.color = livresRestantes < 0 ? '#ff4655' : '#00ff88';

  const containerClasse = document.getElementById('tracker-classe-container');
  if (ptsClasseTotais > 0) {
    containerClasse.style.display = 'block';
    let labelText = classeBase === 'Místico' ? 'Pontos Místicos (Arcanismo, Ocultismo, Magia):' : 'Pontos Combatente (Luta, Pontaria, Reflexos, Fortitude):';
    document.getElementById('label-pts-classe').innerText = labelText;
    document.getElementById('pts-classe-totais').innerText = ptsClasseTotais;
    document.getElementById('pts-classe-restantes').innerText = classePontosRestantes;
    document.getElementById('pts-classe-restantes').style.color = classePontosRestantes < 0 ? '#ff4655' : '#00ff88';
  } else {
    containerClasse.style.display = 'none';
  }

  let cargaBaseMax = forca;
  let cargaExtraMochilas = 0;
  let pesoProprioMochilasEquipadas = 0;

  equipamentos.forEach(item => {
    let qtd = parseFloat(item.qtd) || 1;
    let pesoUnitario = parseFloat(item.carga) || 0;
    if (item.mochila) {
      cargaExtraMochilas += (parseFloat(item.bonusCarga) || 0) * qtd;
      pesoProprioMochilasEquipadas += pesoUnitario * qtd;
    }
  });

  let pesoInventario = inventario.reduce((acc, item) => acc + ((parseFloat(item.carga) || 0) * (parseFloat(item.qtd) || 1)), 0);
  let cargaAtualTotal = pesoInventario + pesoProprioMochilasEquipadas;

  document.getElementById('carga-atual').innerText = cargaAtualTotal.toFixed(1).replace('.0', '');
  document.getElementById('carga-base-max').innerText = cargaBaseMax;
  document.getElementById('carga-extra-display').innerText = `+ ${cargaExtraMochilas} Kg`;

  const containerCarga = document.getElementById('carga-bar-container');
  const alertaMochila = document.getElementById('alerta-mochila-excesso');

  if (pesoProprioMochilasEquipadas > cargaBaseMax) {
    containerCarga.classList.add('carga-excedida');
    if (alertaMochila) alertaMochila.style.display = 'block';
  } else {
    containerCarga.classList.remove('carga-excedida');
    if (alertaMochila) alertaMochila.style.display = 'none';
  }

  renderizarSlots();

  if (deveSalvar) salvarDados();
}

function criarItem() {
  let nome = document.getElementById('item-nome').value;
  let qtd = parseInt(document.getElementById('item-qtd').value) || 1;
  let carga = parseFloat(document.getElementById('item-carga').value) || 0;
  let mochila = document.getElementById('item-is-mochila').checked;
  let bonusCarga = parseFloat(document.getElementById('item-bonus-carga').value) || 0;
  let desc = document.getElementById('item-desc').value;
  let fileInput = document.getElementById('item-img-input');

  let efeitoTurnoRecurso = document.getElementById('item-turno-recurso').value;
  let efeitoTurnoValor = parseInt(document.getElementById('item-turno-valor').value) || 0;

  if (!nome) return alert("Por favor, digite o nome do item!");

  const processarItem = (imagemBase64) => {
    inventario.push({ 
      id: Date.now(), 
      nome, qtd, carga, mochila, bonusCarga, desc, 
      imagem: imagemBase64, 
      buffs: [...buffsTempItem],
      efeitoTurno: { recurso: efeitoTurnoRecurso, valor: efeitoTurnoValor }
    });
    document.getElementById('item-nome').value = '';
    document.getElementById('item-qtd').value = '1';
    document.getElementById('item-carga').value = '1';
    document.getElementById('item-desc').value = '';
    document.getElementById('item-is-mochila').checked = false;
    document.getElementById('item-bonus-carga').value = '0';
    document.getElementById('item-turno-recurso').value = 'none';
    document.getElementById('item-turno-valor').value = '0';
    if (fileInput) fileInput.value = '';
    buffsTempItem = [];
    renderBuffsTemp();
    renderItens();
    recalcularTudo();
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => processarItem(e.target.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else { processarItem(null); }
}

function renderItens() {
  const invContainer = document.getElementById('lista-inventario');
  const eqpContainer = document.getElementById('lista-equipamentos');
  if (!invContainer || !eqpContainer) return;

  invContainer.innerHTML = ''; eqpContainer.innerHTML = '';

  inventario.forEach(item => {
    let pesoTotal = (item.carga * item.qtd).toFixed(1).replace('.0', '');
    let tagsBuffs = item.buffs ? item.buffs.map(b => `<span class="buff-tag">${b.alvoNome}: ${b.val>0?'+':''}${b.val}</span>`).join('') : '';
    if (item.efeitoTurno && item.efeitoTurno.recurso !== 'none' && item.efeitoTurno.valor !== 0) {
      tagsBuffs += `<span class="buff-tag" style="background:#00d2ff; color:#000;">${item.efeitoTurno.valor>0?'+':''}${item.efeitoTurno.valor} ${item.efeitoTurno.recurso.toUpperCase()}/turno</span>`;
    }
    let imgHTML = item.imagem ? `<img src="${item.imagem}" class="item-img-preview" alt="item">` : '';

    invContainer.innerHTML += `
      <div class="item-card">
        <div class="item-card-header">
          <span>${item.nome} ${item.mochila ? `[Mochila]` : ''}</span>
          <div class="item-inputs">
            <label>Qtd:</label>
            <input type="number" value="${item.qtd}" min="1" onchange="alterarQtdItem(${item.id}, 'inv', this.value)">
            <small>(${pesoTotal} Kg)</small>
          </div>
        </div>
        <div class="buffs-tags">${tagsBuffs}</div>
        <div class="item-card-body">
          ${imgHTML}
          <textarea rows="3" onchange="atualizarDescItem(${item.id}, 'inv', this.value)">${item.desc}</textarea>
        </div>
        <div class="item-card-actions">
          <button class="btn-sub" onclick="equiparItem(${item.id})">Equipar ➔</button>
          <button class="btn-danger" onclick="removerItem(${item.id}, 'inv')">Deletar</button>
        </div>
      </div>
    `;
  });

  equipamentos.forEach(item => {
    let tagsBuffs = item.buffs ? item.buffs.map(b => `<span class="buff-tag">${b.alvoNome}: ${b.val>0?'+':''}${b.val}</span>`).join('') : '';
    if (item.efeitoTurno && item.efeitoTurno.recurso !== 'none' && item.efeitoTurno.valor !== 0) {
      tagsBuffs += `<span class="buff-tag" style="background:#00d2ff; color:#000;">${item.efeitoTurno.valor>0?'+':''}${item.efeitoTurno.valor} ${item.efeitoTurno.recurso.toUpperCase()}/turno</span>`;
    }
    let imgHTML = item.imagem ? `<img src="${item.imagem}" class="item-img-preview" alt="item">` : '';

    eqpContainer.innerHTML += `
      <div class="item-card">
        <div class="item-card-header">
          <span>${item.nome} ${item.mochila ? `[+${item.bonusCarga * item.qtd} Carga Extra]` : ''}</span>
          <div class="item-inputs">
            <label>Qtd:</label>
            <input type="number" value="${item.qtd}" min="1" onchange="alterarQtdItem(${item.id}, 'eqp', this.value)">
          </div>
        </div>
        <div class="buffs-tags">${tagsBuffs}</div>
        <div class="item-card-body">
          ${imgHTML}
          <textarea rows="3" onchange="atualizarDescItem(${item.id}, 'eqp', this.value)">${item.desc}</textarea>
        </div>
        <div class="item-card-actions">
          <button class="btn-sub" onclick="desequiparItem(${item.id})">⬅ Desequipar</button>
          <button class="btn-danger" onclick="removerItem(${item.id}, 'eqp')">Deletar</button>
        </div>
      </div>
    `;
  });
}

function alterarQtdItem(id, local, novaQtd) {
  let lista = local === 'inv' ? inventario : equipamentos;
  let item = lista.find(i => i.id === id);
  if (item) {
    item.qtd = Math.max(1, parseInt(novaQtd) || 1);
    renderItens();
    recalcularTudo();
  }
}

function atualizarDescItem(id, local, novaDesc) {
  let lista = local === 'inv' ? inventario : equipamentos;
  let item = lista.find(i => i.id === id);
  if (item) { item.desc = novaDesc; salvarDados(); }
}

function equiparItem(id) {
  let idx = inventario.findIndex(i => i.id === id);
  if (idx !== -1) {
    equipamentos.push(inventario.splice(idx, 1)[0]);
    renderItens();
    recalcularTudo();
  }
}

function desequiparItem(id) {
  let idx = equipamentos.findIndex(i => i.id === id);
  if (idx !== -1) {
    inventario.push(equipamentos.splice(idx, 1)[0]);
    renderItens();
    recalcularTudo();
  }
}

function removerItem(id, local) {
  if (local === 'inv') inventario = inventario.filter(i => i.id !== id);
  if (local === 'eqp') equipamentos = equipamentos.filter(i => i.id !== id);
  renderItens();
  recalcularTudo();
}

function adicionarBuffEfeitoGmMtemp() {
  const select = document.getElementById('gm-effect-buff-alvo');
  const alvoId = select.value;
  const alvoNome = select.options[select.selectedIndex].text;
  const val = parseInt(document.getElementById('gm-effect-buff-valor').value) || 0;
  if (val === 0) return;
  buffsTempGmEffect.push({ alvoId, alvoNome, val });
  renderBuffsGmEffectTemp();
}

function renderBuffsGmEffectTemp() {
  const container = document.getElementById('lista-gm-effect-buffs-temp');
  if (!container) return;
  container.innerHTML = buffsTempGmEffect.map((b, idx) => `
    <span class="buff-tag">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val} <span onclick="removerBuffGmEffectTemp(${idx})">×</span></span>
  `).join('');
}

function removerBuffGmEffectTemp(idx) {
  buffsTempGmEffect.splice(idx, 1);
  renderBuffsGmEffectTemp();
}

function salvarEfeitoGlobalMestre() {
  let nome = document.getElementById('gm-effect-nome').value.trim();
  if (!nome) return alert("Digite o nome do efeito!");

  let cat = document.getElementById('gm-effect-cat').value;
  let recurso = document.getElementById('gm-effect-recurso').value;
  let valorTurno = parseInt(document.getElementById('gm-effect-valor-turno').value) || 0;
  let duracao = parseInt(document.getElementById('gm-effect-duracao').value) || 0;
  let turnosEvoluir = parseInt(document.getElementById('gm-effect-turnos-evoluir').value) || 0;
  let tipoEscala = document.getElementById('gm-effect-tipo-escala').value;
  let fatorEscala = parseFloat(document.getElementById('gm-effect-fator-escala').value) || 0;

  let id = Date.now();
  let novoEfeito = {
    id, nome, cat, recurso, valorTurno, duracao, turnosEvoluir, tipoEscala, fatorEscala,
    buffs: [...buffsTempGmEffect]
  };

  database.ref('efeitosGlobais/' + id).set(novoEfeito, (err) => {
    if (!err) {
      alert("Efeito de status salvo com sucesso!");
      document.getElementById('gm-effect-nome').value = '';
      buffsTempGmEffect = [];
      renderBuffsGmEffectTemp();
    }
  });
}

function renderEfeitosGlobaisNoMestre() {
  const container = document.getElementById('lista-efeitos-globais-mestre');
  if (!container) return;
  container.innerHTML = '';

  Object.keys(efeitosGlobaisSalvos).forEach(id => {
    let e = efeitosGlobaisSalvos[id];
    container.innerHTML += `
      <li class="effect-item">
        <div class="effect-item-header">
          <span><strong>[${e.cat}]</strong> ${e.nome}</span>
          <button class="btn-danger" onclick="excluirEfeitoGlobalMestre('${e.id}')">Excluir do Banco</button>
        </div>
        <div class="effect-item-details">
          <span>Efeito por Turno: ${e.valorTurno !== 0 ? `${e.valorTurno > 0 ? '+' : ''}${e.valorTurno} ${e.recurso.toUpperCase()}` : 'Nenhum'}</span>
          <span>Duração: ${e.duracao > 0 ? `${e.duracao} Turnos` : 'Infinita'}</span>
          <span>Escalamento: ${e.tipoEscala} (${e.fatorEscala})</span>
        </div>
      </li>
    `;
  });
}

function excluirEfeitoGlobalMestre(id) {
  if (confirm("Deseja excluir este efeito do banco de dados?")) {
    database.ref('efeitosGlobais/' + id).remove();
  }
}

function popularSelectEfeitosGlobais() {
  const select = document.getElementById('select-efeitos-globais');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione um efeito...</option>';
  Object.keys(efeitosGlobaisSalvos).forEach(id => {
    let e = efeitosGlobaisSalvos[id];
    select.innerHTML += `<option value="${e.id}">[${e.cat}] ${e.nome}</option>`;
  });
}

function adicionarEfeitoGlobalNaFicha() {
  const select = document.getElementById('select-efeitos-globais');
  let id = select.value;
  if (!id || !efeitosGlobaisSalvos[id]) return alert("Selecione um efeito válido!");

  let efeitoBase = efeitosGlobaisSalvos[id];
  efeitos.push({
    ...efeitoBase,
    idInstancia: Date.now(),
    nivelAtual: 1,
    turnosPassados: 0
  });

  renderEfeitos();
  recalcularTudo();
}

function renderEfeitos() {
  const container = document.getElementById('lista-efeitos');
  if (!container) return;
  container.innerHTML = '';

  efeitos.forEach((e, idx) => {
    let tagsBuffs = e.buffs ? e.buffs.map(b => `<span class="buff-tag">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val}</span>`).join('') : '';
    container.innerHTML += `
      <li class="effect-item">
        <div class="effect-item-header">
          <span><strong>[${e.cat}]</strong> ${e.nome} (Nv. ${e.nivelAtual || 1})</span>
          <button class="btn-danger" onclick="removerEfeitoFicha(${idx})">Remover</button>
        </div>
        <div class="buffs-tags">${tagsBuffs}</div>
        <div class="effect-item-details">
          <span>Restante: ${e.duracao > 0 ? `${e.duracao - e.turnosPassados} turnos` : 'Infinito'}</span>
          <span>Efeito de Turno: ${e.valorTurno ? `${e.valorTurno > 0 ? '+' : ''}${e.valorTurno} ${e.recurso.toUpperCase()}` : 'Nenhum'}</span>
        </div>
      </li>
    `;
  });
}

function removerEfeitoFicha(idx) {
  efeitos.splice(idx, 1);
  renderEfeitos();
  recalcularTudo();
}

// --- PASSAGEM DE TURNO CORRIGIDA ---
function passarTurnoJogador() {
  processarTurnoIndividual();
  recalcularTudo();
  alert("Seu turno foi concluído!");
}

function mestrePassarTurnoGeral() {
  database.ref('fichas').once('value', (snapshot) => {
    const fichas = snapshot.val();
    if (!fichas) return;

    Object.keys(fichas).forEach(id => {
      let f = fichas[id];
      if (f.efeitos && Array.isArray(f.efeitos)) {
        f.efeitos = f.efeitos.filter(e => {
          e.turnosPassados = (e.turnosPassados || 0) + 1;
          
          if (e.turnosEvoluir > 0 && e.turnosPassados % e.turnosEvoluir === 0) {
            e.nivelAtual = (e.nivelAtual || 1) + 1;
          }

          if (e.recurso && e.recurso !== 'none' && e.valorTurno) {
            let campoId = `${e.recurso.toLowerCase()}-atual`;
            let valAtual = parseInt(f[campoId]) || 0;
            f[campoId] = valAtual + e.valorTurno;
          }

          return e.duracao === 0 || e.turnosPassados < e.duracao;
        });
      }

      // Aplica efeitos de itens equipados por turno
      if (f.equipamentos && Array.isArray(f.equipamentos)) {
        f.equipamentos.forEach(item => {
          if (item.efeitoTurno && item.efeitoTurno.recurso !== 'none' && item.efeitoTurno.valor) {
            let campoId = `${item.efeitoTurno.recurso.toLowerCase()}-atual`;
            let valAtual = parseInt(f[campoId]) || 0;
            f[campoId] = valAtual + item.efeitoTurno.valor;
          }
        });
      }

      database.ref('fichas/' + id).update(f);
    });
  });
}

function processarTurnoIndividual() {
  efeitos = efeitos.filter(e => {
    e.turnosPassados = (e.turnosPassados || 0) + 1;

    if (e.turnosEvoluir > 0 && e.turnosPassados % e.turnosEvoluir === 0) {
      e.nivelAtual = (e.nivelAtual || 1) + 1;
    }

    if (e.recurso && e.recurso !== 'none' && e.valorTurno) {
      let campoEl = document.getElementById(`${e.recurso.toLowerCase()}-atual`);
      if (campoEl) {
        let valAtual = parseInt(campoEl.value) || 0;
        campoEl.value = valAtual + e.valorTurno;
      }
    }

    return e.duracao === 0 || e.turnosPassados < e.duracao;
  });

  equipamentos.forEach(item => {
    if (item.efeitoTurno && item.efeitoTurno.recurso !== 'none' && item.efeitoTurno.valor) {
      let campoEl = document.getElementById(`${item.efeitoTurno.recurso.toLowerCase()}-atual`);
      if (campoEl) {
        let valAtual = parseInt(campoEl.value) || 0;
        campoEl.value = valAtual + item.efeitoTurno.valor;
      }
    }
  });

  renderEfeitos();
}

function criarBlocoAnotacao() {
  blocosAnotacoes.push({ id: Date.now(), titulo: "Nova Anotação", texto: "" });
  renderBlocosAnotacoes();
  salvarDados();
}

function renderBlocosAnotacoes() {
  const container = document.getElementById('container-anotacoes');
  if (!container) return;
  container.innerHTML = '';

  blocosAnotacoes.forEach((b, idx) => {
    container.innerHTML += `
      <div class="bloco-card">
        <input type="text" value="${b.titulo}" onchange="atualizarBloco(${idx}, 'titulo', this.value)">
        <textarea rows="6" onchange="atualizarBloco(${idx}, 'texto', this.value)">${b.texto}</textarea>
        <button class="btn-danger" onclick="removerBloco(${idx})">Deletar Bloco</button>
      </div>
    `;
  });
}

function atualizarBloco(idx, campo, valor) {
  if (blocosAnotacoes[idx]) {
    blocosAnotacoes[idx][campo] = valor;
    salvarDados();
  }
}

function removerBloco(idx) {
  blocosAnotacoes.splice(idx, 1);
  renderBlocosAnotacoes();
  salvarDados();
}
