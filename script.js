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
const auth = firebase.auth();

// SENHA PARA O MESTRE
const SENHA_MESTRE = "2510";

let idFichaAtual = null;
let éMestre = false;
let escutandoFirebaseRef = null;

// --- CATEGORIAS DE FICHAS (PAINEL DO MESTRE) ---
const CATEGORIAS_FICHA = [
  { id: 'player',  nome: 'Players',             icone: '🧙', cor: '#00e1ff' },
  { id: 'aliado',  nome: 'Aliados dos Players', icone: '🤝', cor: '#00ff88' },
  { id: 'npc',     nome: 'NPCs',                icone: '💬', cor: '#ffcc00' },
  { id: 'inimigo', nome: 'Inimigos',            icone: '⚔️', cor: '#ff4655' },
  { id: 'monstro', nome: 'Monstros',            icone: '👹', cor: '#c77dff' }
];
const CATEGORIA_PADRAO = 'player'; // fichas antigas, sem categoria, aparecem como Players

let refPainelMestre = null;
let fichasPainel = {};
let renderPainelPendente = false;
let categoriasRecolhidas = new Set();
try {
  categoriasRecolhidas = new Set(JSON.parse(localStorage.getItem('categoriasRecolhidas') || '[]'));
} catch (e) { /* sem localStorage: tudo bem, só não lembra */ }

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
let buffsTempEditItem = [];
let buffsTempGmEffect = [];
let efeitosGlobaisSalvos = {};
let defesasEspecificas = { perfuracao:0, queimadura:0, corte:0, impacto:0, balistico:0, eletricidade:0, fogo:0, frio:0, acido:0, veneno:0, magico:0 };
let expAtual = 0;

// REQUISITO 2: Modificadores permanentes do Mestre para todos os status
let modPermMestre = { pv: 0, san: 0, pe: 0, ma: 0 };

// VARIÁVEL DE APOIO PARA EDITAR ITEM
let itemEditando = null;

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
let debouncePendente = false;

window.onload = () => {
  popularOpcoesBuff();
  renderPericias();
  renderizarSlots();
  escutarEfeitosGlobais();

  popularCategoriasNovaFicha();
  iniciarEventosPainelMestre();

  const telaFicha = document.getElementById('screen-sheet');

  telaFicha.addEventListener('change', (e) => {
    if (e.target.closest('#modal-xp') || e.target.closest('#modal-edit-item')) return;
    if (e.target.tagName !== 'TEXTAREA') {
      recalcularTudo(true);
    }
  });

  telaFicha.addEventListener('input', (e) => {
    if (e.target.closest('#modal-xp') || e.target.closest('#modal-edit-item')) return;
    clearTimeout(timerDebounce);
    debouncePendente = true;
    timerDebounce = setTimeout(() => {
      debouncePendente = false;
      recalcularTudo(true);
    }, 600); 
  });
};

// --- SINCRONIZAÇÃO DE EFEITOS GLOBAIS (BANCO DE DADOS) ---
function escutarEfeitosGlobais() {
  database.ref('efeitosGlobais').on('value', (snapshot) => {
    efeitosGlobaisSalvos = snapshot.val() || {};
    renderEfeitosGlobaisNoMestre();
    popularSelectEfeitosGlobais();
  });
}

// --- NAVEGAÇÃO DE MODO E TELAS ---
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

// Salva a última edição caso o usuário saia da ficha antes do salvamento automático (600ms)
function salvarPendenteAntesDeSair() {
  if (debouncePendente) {
    clearTimeout(timerDebounce);
    debouncePendente = false;
    recalcularTudo(true);
  }
}

function voltarParaSelecao() {
  salvarPendenteAntesDeSair();
  if (escutandoFirebaseRef) { escutandoFirebaseRef.off(); escutandoFirebaseRef = null; }
  if (refPainelMestre) { refPainelMestre.off(); refPainelMestre = null; }
  idFichaAtual = null;
  éMestre = false;
  mostrarTela('screen-select');
}

// Botão "voltar" dentro da ficha: o mestre volta pro Painel do Mestre (sem pedir senha de novo);
// o jogador volta pra tela inicial.
function sairDaFicha() {
  if (!éMestre) return voltarParaSelecao();

  salvarPendenteAntesDeSair();
  if (escutandoFirebaseRef) { escutandoFirebaseRef.off(); escutandoFirebaseRef = null; }
  idFichaAtual = null;
  mostrarTela('screen-gm-dashboard');
  renderPainelMestre();
}

// --- ACESSO DO JOGADOR ---
function entrarComoJogador() {
  const inputID = document.getElementById('input-player-id').value.trim().toLowerCase();
  if (!inputID) return alert("Por favor, digite o nome/ID do seu personagem!");

  idFichaAtual = inputID;
  éMestre = false;
  document.getElementById('badge-gm-view').style.display = 'none';
  document.querySelectorAll('.gm-status-control').forEach(el => el.style.display = 'none');
  document.getElementById('label-ficha-ativa').innerText = `Ficha: ${idFichaAtual}`;
  document.getElementById('btn-sair-ficha').innerText = '← Trocar Ficha / Sair';

  carregarFichaEConectar();
  mostrarTela('screen-sheet');
}

// --- ACESSO DO MESTRE ---
function entrarComoMestre() {
  const senhaInput = document.getElementById('input-gm-pass').value;
  if (senhaInput !== SENHA_MESTRE) return alert("Senha do Mestre incorreta!");

  éMestre = true;
  mostrarTela('screen-gm-dashboard'); // antes de carregar, pois o painel só se desenha quando está visível
  carregarPainelMestre();
}

function carregarPainelMestre() {
  const container = document.getElementById('gm-cards-list');
  container.innerHTML = "<p>Carregando fichas...</p>";

  if (refPainelMestre) refPainelMestre.off();
  refPainelMestre = database.ref('fichas');
  refPainelMestre.on('value', (snapshot) => {
    fichasPainel = snapshot.val() || {};
    renderPainelMestre();
  });
}

function popularCategoriasNovaFicha() {
  const sel = document.getElementById('gm-nova-ficha-categoria');
  if (!sel) return;
  sel.innerHTML = CATEGORIAS_FICHA.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
  sel.value = 'monstro';
}

function htmlCardFicha(id, f, categoriaAtual) {
  const foto = (typeof f.foto === 'string' && f.foto.startsWith('data:image/')) ? f.foto : '';
  const avatar = foto
    ? `<img class="gm-card-foto" src="${escaparHtml(foto)}" alt="">`
    : `<div class="gm-card-foto gm-card-foto-vazia">👤</div>`;
  const opcoes = CATEGORIAS_FICHA.map(c =>
    `<option value="${c.id}" ${c.id === categoriaAtual ? 'selected' : ''}>${c.icone} ${c.nome}</option>`
  ).join('');
  const idSeguro = escaparHtml(id);

  return `
    <div class="gm-card">
      <div class="gm-card-topo">
        ${avatar}
        <div class="gm-card-header">
          <h3>${escaparHtml(f.nome || id)}</h3>
          <small>ID: ${idSeguro}</small>
        </div>
      </div>
      <div class="gm-card-stats">
        <span>Nível: <strong>${escaparHtml(f.nivel || 1)}</strong></span>
        <span>Classe: <strong>${escaparHtml(f.classeBase || '-')}</strong></span>
        <span>PV: <strong>${escaparHtml(f.pvAtual || 0)} / ${escaparHtml(f.pvMax || 0)}</strong></span>
        <span>PE: <strong>${escaparHtml(f.peAtual || 0)} / ${escaparHtml(f.peMax || 0)}</strong></span>
        <span>SAN: <strong>${escaparHtml(f.sanAtual || 0)} / ${escaparHtml(f.sanMax || 0)}</strong></span>
        <span>MA: <strong>${escaparHtml(f.maAtual || 0)} / ${escaparHtml(f.maMax || 0)}</strong></span>
      </div>
      <label class="gm-card-categoria">Categoria:
        <select class="gm-select-categoria" data-id="${idSeguro}">${opcoes}</select>
      </label>
      <button type="button" class="btn-primary gm-btn-abrir" data-id="${idSeguro}">👁️ Abrir / Editar Ficha</button>
    </div>`;
}

function renderPainelMestre() {
  const container = document.getElementById('gm-cards-list');
  const tela = document.getElementById('screen-gm-dashboard');
  if (!container || !tela) return;

  // Não redesenha com o painel escondido, nem enquanto o mestre está com um menu de categoria aberto
  const ativo = document.activeElement;
  const selectAberto = ativo && ativo.tagName === 'SELECT' && container.contains(ativo);
  if (!tela.classList.contains('active') || selectAberto) {
    renderPainelPendente = true;
    return;
  }
  renderPainelPendente = false;

  const ids = Object.keys(fichasPainel);
  if (ids.length === 0) {
    container.innerHTML = "<p>Nenhuma ficha cadastrada ainda no sistema.</p>";
    return;
  }

  const porCategoria = {};
  CATEGORIAS_FICHA.forEach(c => porCategoria[c.id] = []);
  ids.forEach(id => {
    const f = fichasPainel[id] || {};
    const cat = porCategoria[f.categoria] ? f.categoria : CATEGORIA_PADRAO;
    porCategoria[cat].push(id);
  });

  let html = '';
  CATEGORIAS_FICHA.forEach(cat => {
    const lista = porCategoria[cat.id];
    if (lista.length === 0) return;

    lista.sort((a, b) =>
      String((fichasPainel[a] || {}).nome || a).localeCompare(String((fichasPainel[b] || {}).nome || b), 'pt-BR')
    );

    html += `
      <section class="gm-categoria ${categoriasRecolhidas.has(cat.id) ? 'recolhida' : ''}" style="--cor-cat:${cat.cor}">
        <div class="gm-categoria-titulo" data-cat="${cat.id}">
          <span>${cat.icone} ${cat.nome}</span>
          <span class="gm-categoria-contagem">${lista.length}</span>
          <span class="gm-categoria-seta">▾</span>
        </div>
        <div class="gm-cards-grid">
          ${lista.map(id => htmlCardFicha(id, fichasPainel[id] || {}, cat.id)).join('')}
        </div>
      </section>`;
  });

  container.innerHTML = html;
}

function iniciarEventosPainelMestre() {
  const container = document.getElementById('gm-cards-list');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.gm-btn-abrir');
    if (btn) return mestreAbrirFicha(btn.dataset.id);

    const titulo = e.target.closest('.gm-categoria-titulo');
    if (titulo) {
      const cat = titulo.dataset.cat;
      if (categoriasRecolhidas.has(cat)) categoriasRecolhidas.delete(cat);
      else categoriasRecolhidas.add(cat);
      titulo.closest('.gm-categoria').classList.toggle('recolhida', categoriasRecolhidas.has(cat));
      try { localStorage.setItem('categoriasRecolhidas', JSON.stringify([...categoriasRecolhidas])); } catch (err) {}
    }
  });

  container.addEventListener('change', (e) => {
    const sel = e.target.closest('.gm-select-categoria');
    if (!sel) return;
    sel.blur(); // fecha o foco pra o painel poder se reorganizar na hora
    mestreMudarCategoria(sel.dataset.id, sel.value);
  });

  container.addEventListener('focusout', () => {
    if (renderPainelPendente) setTimeout(renderPainelMestre, 0);
  });
}

function mestreMudarCategoria(id, categoria) {
  database.ref('fichas/' + id + '/categoria').set(categoria);
}

function mestreCriarFicha() {
  const nomeOriginal = document.getElementById('gm-nova-ficha-nome').value.trim();
  const categoria = document.getElementById('gm-nova-ficha-categoria').value;
  if (!nomeOriginal) return alert("Digite um nome para a nova ficha!");

  // O ID segue o mesmo padrão dos jogadores (minúsculo), sem caracteres que o Firebase não aceita em chaves
  const id = nomeOriginal.toLowerCase().replace(/[.#$\[\]\/]/g, '-');

  database.ref('fichas/' + id).once('value')
    .then(snap => {
      if (snap.exists()) return alert(`Já existe uma ficha com o ID "${id}". Escolha outro nome.`);
      return database.ref('fichas/' + id).set({ nome: nomeOriginal, categoria }).then(() => {
        document.getElementById('gm-nova-ficha-nome').value = '';
        mestreAbrirFicha(id);
      });
    })
    .catch(err => alert("Não foi possível criar a ficha: " + err.message));
}

function mestreAbrirFicha(idFicha) {
  idFichaAtual = idFicha;
  éMestre = true;
  document.getElementById('badge-gm-view').style.display = 'inline-block';
  document.querySelectorAll('.gm-status-control').forEach(el => el.style.display = 'flex');
  document.getElementById('label-ficha-ativa').innerText = `Editando Ficha: ${idFichaAtual}`;
  document.getElementById('btn-sair-ficha').innerText = '← Voltar ao Painel do Mestre';

  carregarFichaEConectar();
  mostrarTela('screen-sheet');
}

// --- SINCRONIZAÇÃO EM TEMPO REAL COM FIREBASE ---
function carregarFichaEConectar() {
  if (escutandoFirebaseRef) escutandoFirebaseRef.off();
  atualizarFotoFicha(null); // limpa a foto da ficha anterior até a nova carregar

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
  atualizarFotoFicha(data.foto);
  atualizarCampoSeInativo('nome', data.nome || idFichaAtual);
  atualizarCampoSeInativo('nivel', data.nivel || 1);
  expAtual = data.expAtual || 0;
  
  // REQUISITO 2: Carrega modificadores permanentes do Mestre para os 4 status
  modPermMestre = data.modPermMestre || { pv: 0, san: (data.modPermSanMestre || 0), pe: 0, ma: 0 };
  atualizarCampoSeInativo('pv-perm-mod', modPermMestre.pv || 0);
  atualizarCampoSeInativo('san-perm-mod', modPermMestre.san || 0);
  atualizarCampoSeInativo('pe-perm-mod', modPermMestre.pe || 0);
  atualizarCampoSeInativo('ma-perm-mod', modPermMestre.ma || 0);
  
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

function salvarDados() {
  if (!idFichaAtual) return;

  const estadoFicha = {
    nome: document.getElementById('nome').value,
    nivel: document.getElementById('nivel').value,
    expAtual,
    modPermMestre,
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

// --- CONTROLE DE DEFESA ESPECÍFICA POPUP ---
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

// --- CONTROLE DE ABAS ---
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

// --- MODAL DE XP ---
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

// --- BUFFS DE ITENS & EFEITOS ---
function popularOpcoesBuff() {
  const selects = [
    document.getElementById('buff-alvo'), 
    document.getElementById('edit-buff-alvo'), 
    document.getElementById('gm-effect-buff-alvo')
  ];
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
  const isPorTurno = document.getElementById('buff-is-turno').checked;

  if (val === 0) return;
  buffsTempItem.push({ alvoId, alvoNome, val, isPorTurno });
  renderBuffsTemp();
}

function renderBuffsTemp() {
  const container = document.getElementById('lista-buffs-temp');
  if (!container) return;
  container.innerHTML = buffsTempItem.map((b, idx) => `
    <span class="buff-tag">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val} ${b.isPorTurno ? '/Turno' : ''} <span onclick="removerBuffTemp(${idx})">×</span></span>
  `).join('');
}

function removerBuffTemp(idx) {
  buffsTempItem.splice(idx, 1);
  renderBuffsTemp();
}

// --- PERÍCIAS ---
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

// --- LÓGICA DE SLOTS DE MAGIA ---
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

// --- CÁLCULO DE VALOR ESCALADO DE EFEITOS ---
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
  }
  return vBase;
}

// REQUISITO 2: Alterar os modificadores permanentes de qualquer status pelo Mestre
function atualizarStatusPermMestre(recurso, val) {
  modPermMestre[recurso] = parseInt(val) || 0;
  recalcularTudo();
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

  // ACUMULAR BUFFS DOS EQUIPAMENTOS (Apenas estáticos)
  equipamentos.forEach(item => {
    let mult = parseInt(item.qtd) || 1;
    if (item.buffs) {
      item.buffs.forEach(b => {
        if (!b.isPorTurno) {
          buffsAcumulados[b.alvoId] = (buffsAcumulados[b.alvoId] || 0) + (b.val * mult);
        }
      });
    }
  });

  // ACUMULAR BUFFS DOS EFEITOS DE STATUS ATIVOS
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

  // REQUISITO 1: Atualização dos badges visuais permitindo dados negativos progressivos (-1d, -2d, -3d, etc.)
  // Usa os valores finais (já com os buffs de equipamentos/efeitos somados), não os valores base
  const listaAtributosFinais = [
    { id: 'forca', val: forca },
    { id: 'agilidade', val: agilidade },
    { id: 'vigor', val: vigor },
    { id: 'inteligencia', val: inteligencia },
    { id: 'presenca', val: presenca },
    { id: 'carisma', val: carisma },
    { id: 'sorte', val: sorte }
  ];

  listaAtributosFinais.forEach(item => {
    let badge = document.getElementById(`dice-tag-${item.id}`);
    if (badge) {
      if (item.val >= 10) {
        let dadosCount = 1 + Math.floor((item.val - 10) / 2);
        badge.innerText = `${dadosCount}d`;
        badge.className = "dice-badge positive";
      } else {
        let dadosNegativos = -1 - Math.floor((9 - item.val) / 2);
        badge.innerText = `${dadosNegativos}d`;
        badge.className = "dice-badge negative";
      }
    }
  });

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

  // REQUISITO 2: Cálculo dos Status Máximos descontando as reduções permanentes do Mestre
  let pvMaxCalc = 10 + vigor + bonusClasse.pv + (buffsAcumulados['status-pv'] || 0) - (modPermMestre.pv || 0);
  document.getElementById('pv-max').value = Math.max(0, pvMaxCalc);
  
  let sanMaxCalc = 4 + presenca + bonusClasse.san + (buffsAcumulados['status-san'] || 0) - (modPermMestre.san || 0);
  document.getElementById('san-max').value = Math.max(0, sanMaxCalc);

  let peMaxCalc = 5 + agilidade + vigor + bonusClasse.pe + (buffsAcumulados['status-pe'] || 0) - (modPermMestre.pe || 0);
  document.getElementById('pe-max').value = Math.max(0, peMaxCalc);

  let maMaxCalc = vigor + presenca + sorte + inteligencia + bonusClasse.ma + (buffsAcumulados['status-ma'] || 0) - (modPermMestre.ma || 0);
  document.getElementById('ma-max').value = Math.max(0, maMaxCalc);

  document.getElementById('eva-val').value = agilidade + bonusClasse.eva + (buffsAcumulados['status-eva'] || 0);
  document.getElementById('def-val').value = Math.floor(vigor / 2) + bonusClasse.def + (buffsAcumulados['status-def'] || 0);

  // ATUALIZAR DEFESAS ESPECÍFICAS
  const defsLista = ['perfuracao','queimadura','corte','impacto','balistico','eletricidade','fogo','frio','acido','veneno','magico'];
  defsLista.forEach(d => {
    let el = document.getElementById(`def-${d}`);
    if (el) {
      if (document.activeElement === el) {
        let buffVal = buffsAcumulados[`def-${d}`] || 0;
        defesasEspecificas[d] = (parseInt(el.value) || 0) - buffVal;
      } else {
        let baseVal = defesasEspecificas[d] || 0;
        let buffVal = buffsAcumulados[`def-${d}`] || 0;
        el.value = baseVal + buffVal;
      }
    }
  });

  let deslocamentoFinal = Math.floor(agilidade / 2) + (buffsAcumulados['status-deslocamento'] || 0);
  document.getElementById('deslocamento-val').value = `${Math.max(0, deslocamentoFinal)}m`;

  // Perícias = Inteligência + Bônus de Classe + Level - 1
  let ptsLivresTotais = inteligencia + bonusClasse.ptsLivre + (nivel - 1);
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
  let cargaTotalMaxPermitida = cargaBaseMax + cargaExtraMochilas;

  document.getElementById('carga-atual').innerText = cargaAtualTotal.toFixed(1).replace('.0', '');
  document.getElementById('carga-base-max').innerText = cargaBaseMax;
  document.getElementById('carga-extra-display').innerText = `+ ${cargaExtraMochilas} Kg`;

  const containerCarga = document.getElementById('carga-bar-container');
  const alertaMochila = document.getElementById('alerta-mochila-excesso');

  if (cargaAtualTotal > cargaTotalMaxPermitida || pesoProprioMochilasEquipadas > cargaBaseMax) {
    containerCarga.classList.add('carga-excedida');
    if (alertaMochila) alertaMochila.style.display = 'block';
  } else {
    containerCarga.classList.remove('carga-excedida');
    if (alertaMochila) alertaMochila.style.display = 'none';
  }

  renderizarSlots();

  if (deveSalvar) salvarDados();
}

// --- GERENCIAMENTO DE ITENS ---
function criarItem() {
  let nome = document.getElementById('item-nome').value;
  let qtd = parseInt(document.getElementById('item-qtd').value) || 1;
  let carga = parseFloat(document.getElementById('item-carga').value) || 0;
  let mochila = document.getElementById('item-is-mochila').checked;
  let bonusCarga = parseFloat(document.getElementById('item-bonus-carga').value) || 0;
  let desc = document.getElementById('item-desc').value;
  let fileInput = document.getElementById('item-img-input');

  if (!nome) return alert("Por favor, digite o nome do item!");

  const processarItem = (imagemBase64) => {
    inventario.push({ 
      id: Date.now(), 
      nome, qtd, carga, mochila, bonusCarga, desc, 
      imagem: imagemBase64, 
      buffs: [...buffsTempItem]
    });
    document.getElementById('item-nome').value = '';
    document.getElementById('item-qtd').value = '1';
    document.getElementById('item-carga').value = '1';
    document.getElementById('item-desc').value = '';
    document.getElementById('item-is-mochila').checked = false;
    document.getElementById('item-bonus-carga').value = '0';
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
    let tagsBuffs = item.buffs ? item.buffs.map(b => `<span class="buff-tag">${b.alvoNome}: ${b.val>0?'+':''}${b.val}${b.isPorTurno ? '/turno' : ''}</span>`).join('') : '';
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
          <button class="btn-primary" onclick="abrirModalEditItem(${item.id}, 'inv')">✏️ Editar</button>
          <button class="btn-danger" onclick="removerItem(${item.id}, 'inv')">Deletar</button>
        </div>
      </div>
    `;
  });

  equipamentos.forEach(item => {
    let tagsBuffs = item.buffs ? item.buffs.map(b => `<span class="buff-tag">${b.alvoNome}: ${b.val>0?'+':''}${b.val}${b.isPorTurno ? '/turno' : ''}</span>`).join('') : '';
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
          <button class="btn-primary" onclick="abrirModalEditItem(${item.id}, 'eqp')">✏️ Editar</button>
          <button class="btn-danger" onclick="removerItem(${item.id}, 'eqp')">Deletar</button>
        </div>
      </div>
    `;
  });
}

// REQUISITO 3: Modal de Edição de Itens
function abrirModalEditItem(id, local) {
  let lista = local === 'inv' ? inventario : equipamentos;
  let item = lista.find(i => i.id === id);
  if (!item) return;

  itemEditando = { id, local };

  document.getElementById('edit-item-nome').value = item.nome || '';
  document.getElementById('edit-item-qtd').value = item.qtd || 1;
  document.getElementById('edit-item-carga').value = item.carga || 0;
  document.getElementById('edit-item-is-mochila').checked = !!item.mochila;
  document.getElementById('edit-item-bonus-carga').value = item.bonusCarga || 0;
  document.getElementById('edit-item-desc').value = item.desc || '';
  document.getElementById('edit-item-img-input').value = '';

  buffsTempEditItem = item.buffs ? JSON.parse(JSON.stringify(item.buffs)) : [];
  renderBuffsEditTemp();

  document.getElementById('modal-edit-item').classList.add('active');
}

function fecharModalEditItem() {
  document.getElementById('modal-edit-item').classList.remove('active');
  itemEditando = null;
}

function adicionarBuffItemEditTemp() {
  const select = document.getElementById('edit-buff-alvo');
  const alvoId = select.value;
  const alvoNome = select.options[select.selectedIndex].text;
  const val = parseInt(document.getElementById('edit-buff-valor').value) || 0;
  const isPorTurno = document.getElementById('edit-buff-is-turno').checked;

  if (val === 0) return;
  buffsTempEditItem.push({ alvoId, alvoNome, val, isPorTurno });
  renderBuffsEditTemp();
}

function renderBuffsEditTemp() {
  const container = document.getElementById('lista-edit-buffs-temp');
  if (!container) return;
  container.innerHTML = buffsTempEditItem.map((b, idx) => `
    <span class="buff-tag">${b.alvoNome}: ${b.val > 0 ? '+' : ''}${b.val} ${b.isPorTurno ? '/Turno' : ''} <span onclick="removerBuffEditTemp(${idx})">×</span></span>
  `).join('');
}

function removerBuffEditTemp(idx) {
  buffsTempEditItem.splice(idx, 1);
  renderBuffsEditTemp();
}

function salvarEdicaoItem() {
  if (!itemEditando) return;

  let lista = itemEditando.local === 'inv' ? inventario : equipamentos;
  let item = lista.find(i => i.id === itemEditando.id);

  if (!item) return fecharModalEditItem();

  let nome = document.getElementById('edit-item-nome').value.trim();
  if (!nome) return alert("O nome do item não pode ser vazio!");

  item.nome = nome;
  item.qtd = Math.max(1, parseInt(document.getElementById('edit-item-qtd').value) || 1);
  item.carga = Math.max(0, parseFloat(document.getElementById('edit-item-carga').value) || 0);
  item.mochila = document.getElementById('edit-item-is-mochila').checked;
  item.bonusCarga = Math.max(0, parseFloat(document.getElementById('edit-item-bonus-carga').value) || 0);
  item.desc = document.getElementById('edit-item-desc').value;
  item.buffs = [...buffsTempEditItem];

  let fileInput = document.getElementById('edit-item-img-input');

  const concluirSalvamento = () => {
    fecharModalEditItem();
    renderItens();
    recalcularTudo();
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      item.imagem = e.target.result;
      concluirSalvamento();
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    concluirSalvamento();
  }
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

// --- EFEITOS DE STATUS (PAINEL DO MESTRE & BANCO DE DADOS) ---
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
  let continuo = document.getElementById('gm-effect-is-continuous').value === 'sim';
  let recurso = document.getElementById('gm-effect-recurso').value;
  let valorTurno = parseInt(document.getElementById('gm-effect-valor-turno').value) || 0;
  let duracao = parseInt(document.getElementById('gm-effect-duracao').value) || 0;
  let turnosEvoluir = parseInt(document.getElementById('gm-effect-turnos-evoluir').value) || 0;
  let tipoEscala = document.getElementById('gm-effect-tipo-escala').value;
  let fatorEscala = parseFloat(document.getElementById('gm-effect-fator-escala').value) || 0;

  let id = Date.now();
  let novoEfeito = {
    id, nome, cat, continuo, recurso, valorTurno, duracao, turnosEvoluir, tipoEscala, fatorEscala,
    buffs: [...buffsTempGmEffect]
  };

  database.ref('efeitosGlobais/' + id).set(novoEfeito, (err) => {
    if (!err) {
      alert("Efeito de status salvo com sucesso no Banco de Dados!");
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
          <span>Turno: ${e.continuo ? `${e.valorTurno > 0 ? '+' : ''}${e.valorTurno} ${e.recurso.toUpperCase()}` : 'Nenhum'}</span>
          <span>Duração: ${e.duracao > 0 ? `${e.duracao} Turnos` : 'Infinita'}</span>
          <span>Escalabilidade: ${e.tipoEscala} (${e.fatorEscala})</span>
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

  efeitos.forEach(e => {
    let lvl = e.nivelAtual || 1;
    let vTurnoEscalado = calcularEfeitoValorEscalado(e.valorTurno || 0, e.tipoEscala, e.fatorEscala, lvl);

    let detalheTurno = e.continuo && e.recurso !== 'none' ? `${vTurnoEscalado > 0 ? '+' : ''}${vTurnoEscalado} ${e.recurso.toUpperCase()}/turno` : 'Sem dano contínuo';
    let detalheDuracao = e.duracao > 0 ? `Turnos: ${e.turnosPassados || 0}/${e.duracao}` : 'Duração Infinita';

    container.innerHTML += `
      <li class="effect-item">
        <div class="effect-item-header">
          <span><strong>[${e.cat}]</strong> ${e.nome}</span>
          <div class="effect-item-controls">
            <label>Nível:</label>
            <input type="number" value="${lvl}" min="1" onchange="alterarNivelEfeito(${e.idInstancia}, this.value)">
            <button class="btn-danger" onclick="removerEfeitoInstancia(${e.idInstancia})">Remover</button>
          </div>
        </div>
        <div class="effect-item-details">
          <span>${detalheTurno}</span>
          <span>${detalheDuracao}</span>
          <span>Escala (${e.tipoEscala}): Nv.${lvl}</span>
        </div>
      </li>
    `;
  });
}

function alterarNivelEfeito(idInstancia, novoNivel) {
  let ef = efeitos.find(e => e.idInstancia === idInstancia);
  if (ef) {
    ef.nivelAtual = Math.max(1, parseInt(novoNivel) || 1);
    renderEfeitos();
    recalcularTudo();
  }
}

function removerEfeitoInstancia(idInstancia) {
  efeitos = efeitos.filter(e => e.idInstancia !== idInstancia);
  renderEfeitos();
  recalcularTudo();
}

// --- PASSAR TURNO & AUTOMAÇÕES ---
function passarTurnoJogador() {
  processarPassagemDeTurnoLocal();
  salvarDados();
  alert("Seu turno foi concluído e os efeitos/recursos foram atualizados!");
}

function mestrePassarTurnoGeral() {
  if (!confirm("Deseja passar o turno de TODOS os jogadores salvos no banco?")) return;

  database.ref('fichas').once('value', (snapshot) => {
    const fichas = snapshot.val();
    if (!fichas) return alert("Nenhuma ficha encontrada.");

    Object.keys(fichas).forEach(id => {
      let f = fichas[id];
      f = processarTurnoFichaObjeto(f);
      delete f.foto;      // não reenvia a imagem (já está no banco)
      delete f.categoria; // nem a categoria
      database.ref('fichas/' + id).update(f);
    });

    alert("Turno de todas as fichas foi processado com sucesso!");
  });
}

function processarPassagemDeTurnoLocal() {
  equipamentos.forEach(item => {
    let mult = parseInt(item.qtd) || 1;
    if (item.buffs) {
      item.buffs.forEach(b => {
        if (b.isPorTurno) {
          if (b.alvoId.startsWith('status-')) {
            let rec = b.alvoId.replace('status-', '');
            aplicarRecursoNoCampo(rec, b.val * mult);
          }
        }
      });
    }
  });

  let novosEfeitos = [];
  efeitos.forEach(e => {
    let lvl = e.nivelAtual || 1;
    let vTurnoEscalado = calcularEfeitoValorEscalado(e.valorTurno || 0, e.tipoEscala, e.fatorEscala, lvl);

    if (e.continuo && e.recurso !== 'none' && vTurnoEscalado !== 0) {
      aplicarRecursoNoCampo(e.recurso, vTurnoEscalado);
    }

    e.turnosPassados = (e.turnosPassados || 0) + 1;

    if (e.turnosEvoluir > 0 && e.turnosPassados % e.turnosEvoluir === 0) {
      e.nivelAtual = lvl + 1;
    }

    if (e.duracao === 0 || e.turnosPassados < e.duracao) {
      novosEfeitos.push(e);
    }
  });

  efeitos = novosEfeitos;
  renderEfeitos();
  recalcularTudo();
}

function processarTurnoFichaObjeto(f) {
  let eqp = f.equipamentos || [];
  let efts = f.efeitos || [];

  eqp.forEach(item => {
    let mult = parseInt(item.qtd) || 1;
    if (item.buffs) {
      item.buffs.forEach(b => {
        if (b.isPorTurno && b.alvoId.startsWith('status-')) {
          let rec = b.alvoId.replace('status-', '');
          modificarRecursoObjeto(f, rec, b.val * mult);
        }
      });
    }
  });

  let novosEfts = [];
  efts.forEach(e => {
    let lvl = e.nivelAtual || 1;
    let vTurnoEscalado = calcularEfeitoValorEscalado(e.valorTurno || 0, e.tipoEscala, e.fatorEscala, lvl);

    if (e.continuo && e.recurso !== 'none' && vTurnoEscalado !== 0) {
      modificarRecursoObjeto(f, e.recurso, vTurnoEscalado);
    }

    e.turnosPassados = (e.turnosPassados || 0) + 1;

    if (e.turnosEvoluir > 0 && e.turnosPassados % e.turnosEvoluir === 0) {
      e.nivelAtual = lvl + 1;
    }

    if (e.duracao === 0 || e.turnosPassados < e.duracao) {
      novosEfts.push(e);
    }
  });

  f.efeitos = novosEfts;
  return f;
}

function aplicarRecursoNoCampo(recurso, delta) {
  let idCampo = `${recurso}-atual`;
  let idMax = `${recurso}-max`;
  let elAtual = document.getElementById(idCampo);
  let elMax = document.getElementById(idMax);

  if (elAtual) {
    let valAtual = parseInt(elAtual.value) || 0; // Lê corretamente valores negativos como -20
    let valMax = elMax ? (parseInt(elMax.value) || 9999) : 9999;
    
    // Permite que suba ou desça a partir do valor atual (inclusive negativo) respeitando o teto máximo, sem traviar em 0 no piso se o personagem já estiver com saldo negativo
    let novoVal = Math.min(valMax, valAtual + delta); 
    elAtual.value = novoVal;
    salvarDados();
  }
}

function modificarRecursoObjeto(f, recurso, delta) {
  let chaveAtual = `${recurso}Atual`;
  let chaveMax = `${recurso}Max`;

  let valAtual = parseInt(f[chaveAtual]) || 0;
  let valMax = parseInt(f[chaveMax]) || 9999;
  f[chaveAtual] = Math.min(valMax, Math.max(0, valAtual + delta));
}

// --- BLOCOS DE ANOTAÇÕES ---
function criarBlocoAnotacao() {
  blocosAnotacoes.push({ id: Date.now(), titulo: "Nova Anotação", texto: "" });
  renderBlocosAnotacoes();
  salvarDados();
}

function renderBlocosAnotacoes() {
  const container = document.getElementById('container-anotacoes');
  if (!container) return;

  // Remove do DOM apenas os cards de blocos que não existem mais (não apaga tudo)
  const idsAtuais = new Set(blocosAnotacoes.map(b => String(b.id)));
  Array.from(container.children).forEach(card => {
    if (!idsAtuais.has(card.dataset.id)) card.remove();
  });

  blocosAnotacoes.forEach((b, idx) => {
    let card = container.querySelector(`.bloco-card[data-id="${b.id}"]`);

    if (!card) {
      // Cria o card apenas se ele ainda não existir no DOM
      card = document.createElement('div');
      card.className = 'bloco-card';
      card.dataset.id = b.id;
      card.innerHTML = `
        <input type="text" class="bloco-titulo">
        <textarea rows="6" class="bloco-texto"></textarea>
        <button type="button" class="btn-danger">Excluir Bloco</button>
      `;

      const inputTitulo = card.querySelector('.bloco-titulo');
      const textareaTexto = card.querySelector('.bloco-texto');
      const btnExcluir = card.querySelector('.btn-danger');

      // 'input' atualiza a cada tecla digitada (não perde nada se você clicar em outro lugar antes do blur)
      inputTitulo.addEventListener('input', () => atualizarTituloAnotacao(b.id, inputTitulo.value));
      textareaTexto.addEventListener('input', () => atualizarTextoAnotacao(b.id, textareaTexto.value));
      btnExcluir.addEventListener('click', () => removerBlocoAnotacao(b.id));

      container.appendChild(card);
    }

    // Garante a ordem correta no grid sem recriar os cards que não mudaram de posição
    const posAtual = Array.from(container.children).indexOf(card);
    if (posAtual !== idx) {
      container.insertBefore(card, container.children[idx] || null);
    }

    // Só sobrescreve o valor se o campo não for o que está em edição no momento
    // (evita apagar o que a pessoa está digitando quando o Firebase sincroniza)
    const inputTitulo = card.querySelector('.bloco-titulo');
    const textareaTexto = card.querySelector('.bloco-texto');
    if (document.activeElement !== inputTitulo) inputTitulo.value = b.titulo;
    if (document.activeElement !== textareaTexto) textareaTexto.value = b.texto;
  });
}

let timeoutSalvarAnotacoes = null;
function salvarAnotacoesComDebounce() {
  clearTimeout(timeoutSalvarAnotacoes);
  timeoutSalvarAnotacoes = setTimeout(salvarDados, 500);
}

function atualizarTituloAnotacao(id, novoTitulo) {
  const bloco = blocosAnotacoes.find(b => b.id === id);
  if (bloco) { bloco.titulo = novoTitulo; salvarAnotacoesComDebounce(); }
}

function atualizarTextoAnotacao(id, novoTexto) {
  const bloco = blocosAnotacoes.find(b => b.id === id);
  if (bloco) { bloco.texto = novoTexto; salvarAnotacoesComDebounce(); }
}

function removerBlocoAnotacao(id) {
  blocosAnotacoes = blocosAnotacoes.filter(b => b.id !== id);
  renderBlocosAnotacoes();
  salvarDados();
}

// ==========================================================================
// FOTO DO PERSONAGEM
// A imagem é reduzida no navegador (máx. 400px) e guardada como texto dentro da
// própria ficha no Realtime Database, então não precisa de Firebase Storage.
// ==========================================================================
const FOTO_MAX_LADO = 400;
const FOTO_MAX_BYTES = 150 * 1024;

function atualizarFotoFicha(foto) {
  const img = document.getElementById('ficha-foto-img');
  const placeholder = document.getElementById('ficha-foto-placeholder');
  const btnRemover = document.getElementById('ficha-foto-remover');
  if (!img || !placeholder || !btnRemover) return;

  const valida = typeof foto === 'string' && foto.startsWith('data:image/');
  if (valida) {
    img.src = foto;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    btnRemover.style.display = 'inline-block';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    placeholder.style.display = 'flex';
    btnRemover.style.display = 'none';
  }
}

function escolherFotoFicha(input) {
  const arquivo = input.files && input.files[0];
  input.value = ''; // permite escolher o mesmo arquivo de novo depois
  if (!arquivo) return;
  if (!idFichaAtual) return alert("Abra uma ficha antes de adicionar a foto.");
  if (!arquivo.type.startsWith('image/')) return alert("Escolha um arquivo de imagem (JPG, PNG, WEBP...).");

  const leitor = new FileReader();
  leitor.onerror = () => alert("Não consegui ler esse arquivo.");
  leitor.onload = () => {
    const img = new Image();
    img.onerror = () => alert("Não consegui abrir essa imagem. Tente outro arquivo.");
    img.onload = () => {
      const escala = Math.min(1, FOTO_MAX_LADO / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#121214'; // PNG transparente vira JPEG com fundo escuro
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Base64 ocupa ~37% a mais que os bytes reais; vai baixando a qualidade até caber
      let qualidade = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', qualidade);
      while (dataUrl.length > FOTO_MAX_BYTES * 1.37 && qualidade > 0.35) {
        qualidade -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', qualidade);
      }
      salvarFotoFicha(dataUrl);
    };
    img.src = leitor.result;
  };
  leitor.readAsDataURL(arquivo);
}

function salvarFotoFicha(dataUrl) {
  if (!idFichaAtual) return;
  salvarDados(); // garante que a ficha exista com o que está na tela antes de anexar a foto
  database.ref('fichas/' + idFichaAtual).update({ foto: dataUrl })
    .catch(err => alert("Não foi possível salvar a foto: " + err.message));
}

function removerFotoFicha() {
  if (!idFichaAtual) return;
  if (!confirm("Remover a foto deste personagem?")) return;
  database.ref('fichas/' + idFichaAtual + '/foto').remove();
}

// ==========================================================================
// AGENDAMENTO DE SESSÕES
// ==========================================================================

// --- CONFIGURAÇÃO DA GRADE ---
const AGENDA_HORA_INICIO = 10;   // grade começa às 10:00
const AGENDA_HORA_FIM = 24;      // grade termina às 23:30 (exclusivo)
const AGENDA_INTERVALO_MIN = 30; // blocos de 30 em 30 minutos
const AGENDA_CORES_JOGADORES = ['#ff4655', '#00e1ff', '#00ff88', '#ffcc00', '#c77dff', '#ff8f40', '#4dd0e1', '#f06292'];

let usuarioAgenda = null;        // { uid, nome, role }
let mesAnoAtual = null;          // "2026-09"
let refAgendamentoAtual = null;
let agendamentoAtual = null;
let modoGradeView = 'editar';
let jogadoresDestacados = new Set();
let pendenciasSlots = {};

// --- LOGIN / CADASTRO ---
function alternarAuthTab(tipo) {
  document.getElementById('agenda-form-login').classList.toggle('active', tipo === 'login');
  document.getElementById('agenda-form-cadastro').classList.toggle('active', tipo === 'cadastro');
  document.getElementById('agenda-auth-btn-login').classList.toggle('active', tipo === 'login');
  document.getElementById('agenda-auth-btn-cadastro').classList.toggle('active', tipo === 'cadastro');
}

function criarContaAgenda() {
  const nome = document.getElementById('agenda-cadastro-nome').value.trim();
  const email = document.getElementById('agenda-cadastro-email').value.trim();
  const senha = document.getElementById('agenda-cadastro-senha').value;
  if (!nome || !email || !senha) return alert('Preencha nome, email e senha!');

  auth.createUserWithEmailAndPassword(email, senha)
    .then(cred => database.ref('usuarios/' + cred.user.uid).set({ nome, role: 'jogador' }))
    .catch(err => alert('Erro ao criar conta: ' + traduzirErroFirebaseAuth(err.code)));
}

function loginAgenda() {
  const email = document.getElementById('agenda-login-email').value.trim();
  const senha = document.getElementById('agenda-login-senha').value;
  if (!email || !senha) return alert('Preencha email e senha!');

  auth.signInWithEmailAndPassword(email, senha)
    .catch(err => alert('Erro ao entrar: ' + traduzirErroFirebaseAuth(err.code)));
}

function logoutAgenda() {
  auth.signOut();
}

function traduzirErroFirebaseAuth(code) {
  const mapa = {
    'auth/email-already-in-use': 'Este email já está cadastrado.',
    'auth/invalid-email': 'Email inválido.',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'Email ou senha incorretos.'
  };
  return mapa[code] || 'Tente novamente. (' + code + ')';
}

auth.onAuthStateChanged(user => {
  if (user) {
    database.ref('usuarios/' + user.uid).once('value').then(snap => {
      const perfil = snap.val() || { nome: user.email, role: 'jogador' };
      usuarioAgenda = { uid: user.uid, nome: perfil.nome, role: perfil.role || 'jogador' };
      atualizarUIAuthAgenda();
      iniciarMesAgenda();
    });
  } else {
    usuarioAgenda = null;
    if (refAgendamentoAtual) { refAgendamentoAtual.off(); refAgendamentoAtual = null; }
    atualizarUIAuthAgenda();
  }
});

function atualizarUIAuthAgenda() {
  const logado = !!usuarioAgenda;
  document.getElementById('agenda-auth').style.display = logado ? 'none' : 'flex';
  document.getElementById('agenda-app').style.display = logado ? 'block' : 'none';
  if (logado) {
    document.getElementById('agenda-user-nome').innerText = usuarioAgenda.nome;
    const éMestreAgenda = usuarioAgenda.role === 'mestre';
    document.getElementById('agenda-gm-panel').style.display = éMestreAgenda ? 'flex' : 'none';
  }
}

// --- NAVEGAÇÃO DE MÊS ---
function iniciarMesAgenda() {
  if (!mesAnoAtual) {
    const hoje = new Date();
    mesAnoAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  }
  carregarMesAgenda();
}

function mudarMesAgenda(delta) {
  let [ano, mes] = mesAnoAtual.split('-').map(Number);
  mes += delta;
  if (mes < 1) { mes = 12; ano--; }
  if (mes > 12) { mes = 1; ano++; }
  mesAnoAtual = `${ano}-${String(mes).padStart(2, '0')}`;
  jogadoresDestacados.clear();
  carregarMesAgenda();
}

function carregarMesAgenda() {
  if (refAgendamentoAtual) refAgendamentoAtual.off();
  document.getElementById('agenda-mes-label').innerText = formatarMesAno(mesAnoAtual);

  refAgendamentoAtual = database.ref('agendamentos/' + mesAnoAtual);
  refAgendamentoAtual.on('value', snap => {
    agendamentoAtual = snap.val();
    renderAgendaMes();
  });
}

function formatarMesAno(mesAno) {
  const [ano, mes] = mesAno.split('-').map(Number);
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[mes - 1]} de ${ano}`;
}

function diasNoMesAgenda(mesAno) {
  const [ano, mes] = mesAno.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
}

function gerarSlotsHorarioAgenda() {
  const slots = [];
  for (let h = AGENDA_HORA_INICIO; h < AGENDA_HORA_FIM; h++) {
    for (let m = 0; m < 60; m += AGENDA_INTERVALO_MIN) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

// --- RENDER PRINCIPAL (decide qual seção mostrar) ---
function renderAgendaMes() {
  if (!usuarioAgenda) return;
  const status = agendamentoAtual ? agendamentoAtual.status : null;
  const éMestreAgenda = usuarioAgenda.role === 'mestre';

  document.getElementById('agenda-sem-ciclo').style.display = !agendamentoAtual ? 'block' : 'none';
  document.getElementById('agenda-grade-wrap').style.display = (status === 'coletando') ? 'block' : 'none';
  document.getElementById('agenda-confirmacao-wrap').style.display = (status === 'definido' || status === 'confirmado') ? 'block' : 'none';

  document.getElementById('agenda-btn-abrir-votacao').style.display = (!agendamentoAtual && éMestreAgenda) ? 'inline-block' : 'none';
  document.getElementById('agenda-btn-cancelar-ciclo').style.display = (agendamentoAtual && éMestreAgenda && status === 'coletando') ? 'inline-block' : 'none';
  document.getElementById('agenda-btn-cancelar-ciclo-2').style.display = (agendamentoAtual && éMestreAgenda && (status === 'definido' || status === 'confirmado')) ? 'inline-block' : 'none';

  document.getElementById('agenda-definir-painel').style.display = (status === 'coletando' && éMestreAgenda) ? 'block' : 'none';

  if (status === 'coletando') {
    renderGradeAgenda();
  } else if (status === 'definido' || status === 'confirmado') {
    renderConfirmacaoAgenda();
  }
}

// --- CICLO DO MESTRE ---
function abrirVotacaoAgenda() {
  if (agendamentoAtual) return;
  database.ref('agendamentos/' + mesAnoAtual).set({
    status: 'coletando',
    criadoPor: usuarioAgenda.uid
  });
}

function cancelarCicloAgenda() {
  if (!confirm('Isso vai apagar toda a disponibilidade e confirmações registradas para este mês. Continuar?')) return;
  database.ref('agendamentos/' + mesAnoAtual).remove();
}

// --- GRADE DE DISPONIBILIDADE ---
function alternarModoGrade(modo) {
  modoGradeView = modo;
  document.getElementById('agenda-btn-modo-editar').classList.toggle('active', modo === 'editar');
  document.getElementById('agenda-btn-modo-heatmap').classList.toggle('active', modo === 'heatmap');
  document.getElementById('agenda-legenda-jogadores').style.display = modo === 'heatmap' ? 'flex' : 'none';
  renderGradeAgenda();
}

function renderGradeAgenda() {
  const theadRow = document.getElementById('agenda-grade-thead');
  const tbody = document.getElementById('agenda-grade-tbody');
  const totalDias = diasNoMesAgenda(mesAnoAtual);
  const horarios = gerarSlotsHorarioAgenda();
  const disponibilidades = (agendamentoAtual && agendamentoAtual.disponibilidades) || {};

  let headHtml = '<th class="grade-canto"></th>';
  for (let d = 1; d <= totalDias; d++) {
    headHtml += `<th class="grade-dia-col">${d}</th>`;
  }
  theadRow.innerHTML = headHtml;

  const meuId = usuarioAgenda.uid;
  const meusSlots = (disponibilidades[meuId] && disponibilidades[meuId].slots) || {};
  const totalComDados = Object.keys(disponibilidades).length || 1;

  let bodyHtml = '';
  horarios.forEach(hora => {
    bodyHtml += `<tr><td class="grade-hora-col">${hora}</td>`;
    for (let d = 1; d <= totalDias; d++) {
      const chave = `${d}-${hora.replace(':', '')}`;

      if (modoGradeView === 'editar') {
        const ativo = !!meusSlots[chave];
        bodyHtml += `<td class="grade-cel ${ativo ? 'cel-livre' : ''}" data-dia="${d}" data-hora="${hora}"></td>`;
      } else {
        const livres = Object.values(disponibilidades).filter(u => u.slots && u.slots[chave]);
        const cor = corIntensidadeAgenda(livres.length, totalComDados);
        const destacados = livres.filter(u => jogadoresDestacados.has(u.nome));
        let dots = '';
        destacados.forEach(u => {
          dots += `<span class="cel-dot" style="background:${corParaJogadorAgenda(u.nome, disponibilidades)}"></span>`;
        });
        const tituloTexto = livres.length ? livres.map(u => u.nome).join(', ') : 'Ninguém livre';
        bodyHtml += `<td class="grade-cel grade-cel-heat" data-dia="${d}" data-hora="${hora}" style="background:${cor}" title="${tituloTexto}">${dots ? `<div class="cel-dots">${dots}</div>` : ''}</td>`;
      }
    }
    bodyHtml += '</tr>';
  });
  tbody.innerHTML = bodyHtml;

  if (modoGradeView === 'heatmap') {
    renderLegendaJogadoresAgenda(disponibilidades);
  }
}

function corIntensidadeAgenda(livres, total) {
  if (livres === 0) return 'transparent';
  const alpha = Math.min(0.15 + (livres / total) * 0.75, 0.9);
  return `rgba(0, 225, 255, ${alpha.toFixed(2)})`;
}

function corParaJogadorAgenda(nome, disponibilidades) {
  const nomesOrdenados = Object.values(disponibilidades).map(u => u.nome).sort();
  const idx = nomesOrdenados.indexOf(nome);
  return AGENDA_CORES_JOGADORES[idx % AGENDA_CORES_JOGADORES.length];
}

function renderLegendaJogadoresAgenda(disponibilidades) {
  const container = document.getElementById('agenda-legenda-jogadores');
  const nomes = [...new Set(Object.values(disponibilidades).map(u => u.nome))].sort();

  container.innerHTML = nomes.map(nome => {
    const cor = corParaJogadorAgenda(nome, disponibilidades);
    const ativo = jogadoresDestacados.has(nome);
    return `<span class="legenda-chip ${ativo ? 'ativo' : ''}" style="border-color:${cor}" data-nome="${nome}">
      <span class="legenda-dot" style="background:${cor}"></span>${nome}
    </span>`;
  }).join('');

  container.querySelectorAll('.legenda-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const nome = chip.dataset.nome;
      if (jogadoresDestacados.has(nome)) jogadoresDestacados.delete(nome);
      else jogadoresDestacados.add(nome);
      renderGradeAgenda();
    });
  });
}

// --- INTERAÇÃO DE PINTURA (arrastar pra marcar disponibilidade) ---
function inicializarInteracaoGradeAgenda() {
  const tbody = document.getElementById('agenda-grade-tbody');
  if (!tbody) return;
  let pintando = false;
  let modoMarcar = true;

  function alvoCelula(el) {
    return (el && el.classList && el.classList.contains('grade-cel')) ? el : null;
  }

  function alternarCelula(td, marcar) {
    td.classList.toggle('cel-livre', marcar);
    const chave = `${td.dataset.dia}-${td.dataset.hora.replace(':', '')}`;
    pendenciasSlots[chave] = marcar;
  }

  tbody.addEventListener('mousedown', (e) => {
    if (modoGradeView !== 'editar') return;
    const td = alvoCelula(e.target);
    if (!td) return;
    e.preventDefault();
    pintando = true;
    modoMarcar = !td.classList.contains('cel-livre');
    alternarCelula(td, modoMarcar);
  });

  tbody.addEventListener('mouseover', (e) => {
    if (!pintando || modoGradeView !== 'editar') return;
    const td = alvoCelula(e.target);
    if (td) alternarCelula(td, modoMarcar);
  });

  tbody.addEventListener('touchstart', (e) => {
    if (modoGradeView !== 'editar') return;
    const td = alvoCelula(e.target);
    if (!td) return;
    pintando = true;
    modoMarcar = !td.classList.contains('cel-livre');
    alternarCelula(td, modoMarcar);
  }, { passive: true });

  tbody.addEventListener('touchmove', (e) => {
    if (!pintando || modoGradeView !== 'editar') return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const td = alvoCelula(el);
    if (td) alternarCelula(td, modoMarcar);
  }, { passive: false });

  // Mestre clicando numa célula do mapa de calor pra pré-preencher o painel "Definir Data"
  tbody.addEventListener('click', (e) => {
    if (modoGradeView !== 'heatmap' || !usuarioAgenda || usuarioAgenda.role !== 'mestre') return;
    const td = alvoCelula2Heat(e.target);
    if (!td) return;
    document.getElementById('agenda-definir-dia').value = td.dataset.dia;
    document.getElementById('agenda-definir-hora').value = td.dataset.hora;
    document.getElementById('agenda-definir-info').innerText = `Livres neste horário: ${td.title || 'ninguém ainda'}`;
  });

  function alvoCelula2Heat(el) {
    return el && el.closest ? el.closest('.grade-cel-heat') : null;
  }

  function finalizarPintura() {
    if (!pintando) return;
    pintando = false;
    salvarDisponibilidadeAgenda();
  }

  document.addEventListener('mouseup', finalizarPintura);
  document.addEventListener('touchend', finalizarPintura);
}
inicializarInteracaoGradeAgenda();

function salvarDisponibilidadeAgenda() {
  if (Object.keys(pendenciasSlots).length === 0) return;
  const atualizacoes = {};
  Object.keys(pendenciasSlots).forEach(chave => {
    atualizacoes[`agendamentos/${mesAnoAtual}/disponibilidades/${usuarioAgenda.uid}/slots/${chave}`] = pendenciasSlots[chave] ? true : null;
  });
  atualizacoes[`agendamentos/${mesAnoAtual}/disponibilidades/${usuarioAgenda.uid}/nome`] = usuarioAgenda.nome;
  database.ref().update(atualizacoes);
  pendenciasSlots = {};
}

// --- DEFINIR DATA (MESTRE) ---
function confirmarDefinicaoData() {
  const dia = parseInt(document.getElementById('agenda-definir-dia').value);
  const hora = document.getElementById('agenda-definir-hora').value;
  if (!dia || !hora) return alert('Escolha o dia e o horário!');

  const [ano, mes] = mesAnoAtual.split('-');
  const dataEscolhida = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;

  const confirmacoesIniciais = {};
  Object.keys((agendamentoAtual && agendamentoAtual.disponibilidades) || {}).forEach(uid => {
    confirmacoesIniciais[uid] = 'pendente';
  });

  database.ref('agendamentos/' + mesAnoAtual).update({
    status: 'definido',
    dataEscolhida,
    horario: hora,
    confirmacoes: confirmacoesIniciais
  });
}

// --- CONFIRMAÇÃO DE PRESENÇA ---
function renderConfirmacaoAgenda() {
  const dataFmt = formatarDataBRAgenda(agendamentoAtual.dataEscolhida);
  document.getElementById('agenda-data-escolhida').innerText = `${dataFmt} às ${agendamentoAtual.horario}`;

  const confirmacoes = agendamentoAtual.confirmacoes || {};
  const disponibilidades = agendamentoAtual.disponibilidades || {};
  const meuStatus = confirmacoes[usuarioAgenda.uid] || 'pendente';

  document.getElementById('agenda-btn-confirmar-sim').classList.toggle('active', meuStatus === 'sim');
  document.getElementById('agenda-btn-confirmar-nao').classList.toggle('active', meuStatus === 'nao');

  const lista = document.getElementById('agenda-lista-confirmacoes');
  const uids = Object.keys(confirmacoes);
  lista.innerHTML = uids.map(uid => {
    const nome = (disponibilidades[uid] && disponibilidades[uid].nome) || 'Jogador';
    const status = confirmacoes[uid];
    const rotulo = status === 'sim' ? '✅ Confirmado' : status === 'nao' ? '❌ Não vai' : '⏳ Pendente';
    const classe = status === 'sim' ? 'sim' : status === 'nao' ? 'nao' : 'pendente';
    return `<li class="confirmacao-item ${classe}"><span>${nome}</span><span>${rotulo}</span></li>`;
  }).join('');
}

function responderConfirmacaoAgenda(resposta) {
  database.ref(`agendamentos/${mesAnoAtual}/confirmacoes/${usuarioAgenda.uid}`).set(resposta);
}

function formatarDataBRAgenda(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}
