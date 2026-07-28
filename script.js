// Configuração do Firebase
const firebaseConfig = {
  databaseURL: "https://SEU-PROJETO-FIREBASE-default-rtdb.firebaseio.com"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Lista global de perícias
const listaPericiasBase = [
  "Acrobacia", "Adestramento", "Artes", "Atletismo", "Atualidades",
  "Ciência", "Crime", "Diplomacia", "Enganação", "Fortitude",
  "Furtividade", "História", "Iniciativa", "Intimidação", "Intuição",
  "Investigação", "Luta", "Medicina", "Ocultismo", "Percepção",
  "Pilotagem", "Pontaria", "Reflexos", "Religião", "Sobrevivência",
  "Tática", "Tecnologia", "Vontade"
];

let fichaAtualID = "";
let modoMestre = false;
let buffsTempItem = [];
let telaAnteriorWiki = 'screen-select';

// ==========================================================================
// BANCO DE DADOS DA WIKI (6 CATEGORIAS)
// ==========================================================================
const wikiStatusData = {
  "Dano Contínuo (DoT)": [
    {
      nome: "Incineração / Sangramento",
      desc: "Causa dano contínuo todo início de turno.",
      niveis: [
        { lvl: 1, efeito: "1d4 de dano por turno" },
        { lvl: 2, efeito: "1d6 de dano por turno" },
        { lvl: 3, efeito: "1d8 de dano + reduz cura recebida em 20%" },
        { lvl: 5, efeito: "2d8 de dano + reduz cura recebida em 50%" },
        { lvl: 10, efeito: "5d10 de dano por turno (Incurável enquanto ativo)" }
      ]
    }
  ],
  "Restrição de Movimento": [
    {
      nome: "Lentidão / Paralisia",
      desc: "Afeta a capacidade de locomoção do personagem.",
      niveis: [
        { lvl: 1, efeito: "-2m de Deslocamento" },
        { lvl: 2, efeito: "-4m de Deslocamento e -2 na Evasão" },
        { lvl: 5, efeito: "Deslocamento reduzido à metade" },
        { lvl: 10, efeito: "Imobilizado (Deslocamento = 0, Evasão = 0)" }
      ]
    }
  ],
  "Restrição de Ação": [
    {
      nome: "Atordoado / Silenciado",
      desc: "Impede ou limita ações executadas no turno.",
      niveis: [
        { lvl: 1, efeito: "Não pode usar Ações Bônus" },
        { lvl: 3, efeito: "Não pode conjurar feitiços ou rituais" },
        { lvl: 5, efeito: "Perde 1 Ação Padrão no turno" },
        { lvl: 10, efeito: "Incapacitado totalmente por 1 rodada" }
      ]
    }
  ],
  "Degradação Física": [
    {
      nome: "Fraqueza / Vulnerabilidade",
      desc: "Reduz atributos físicos e resistências corporais.",
      niveis: [
        { lvl: 1, efeito: "-2 na Defesa" },
        { lvl: 3, efeito: "-4 na Defesa e -2 em testes de Força/Vigor" },
        { lvl: 5, efeito: "Recebe +50% de dano físico de todas as fontes" },
        { lvl: 10, efeito: "Recebe dobro de dano físico e Defesa zerada" }
      ]
    }
  ],
  "Degradação Mental e Paranormal": [
    {
      nome: "Abalado / Insanidade",
      desc: "Corrompe a mente e a capacidade de concentração.",
      niveis: [
        { lvl: 1, efeito: "-2 em Vontade e Sanidade" },
        { lvl: 3, efeito: "Custo de Mana (MA) para feitiços aumenta em +2" },
        { lvl: 5, efeito: "Desvantagem em testes de Inteligência e Presença" },
        { lvl: 10, efeito: "Perde o controle do personagem temporariamente" }
      ]
    }
  ],
  "Interferência Mágica e Bônus (Buffs)": [
    {
      nome: "Inspirado",
      desc: "Eleva o foco e bônus de dados do alvo.",
      niveis: [
        { lvl: 1, efeito: "+3 em Testes de Ataque/Perícia" },
        { lvl: 2, efeito: "+5 em Testes de Ataque/Perícia" },
        { lvl: 3, efeito: "+5 em Ataque e +2 na Evasão" },
        { lvl: 5, efeito: "+7 em Ataque, +3 Evasão e +3 Vontade" },
        { lvl: 9, efeito: "+11 Ataque, +5 Evasão, +7 Vontade | Especial: 1x por turno rola +1d10 em um teste" }
      ]
    },
    {
      nome: "Armadura Arcana",
      desc: "Cria um escudo mágico protetor sobre o corpo.",
      niveis: [
        { lvl: 1, efeito: "Escudo: +15 PV Temporários" },
        { lvl: 2, efeito: "Escudo: +25 PV Temporários | +2 Defesa" },
        { lvl: 5, efeito: "Escudo: +85 PV Temporários | +5 Defesa | Dano de Retorno: 1d6" }
      ]
    }
  ]
};

// ==========================================================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE TELAS
// ==========================================================================
function setModoAcesso(modo) {
  document.getElementById('btn-mode-player').classList.toggle('active', modo === 'player');
  document.getElementById('btn-mode-gm').classList.toggle('active', modo === 'gm');
  document.getElementById('panel-player').classList.toggle('active', modo === 'player');
  document.getElementById('panel-gm').classList.toggle('active', modo === 'gm');
}

function mostrarTela(screenId) {
  document.querySelectorAll('.screen-container').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }
}

function abrirWikiDireto() {
  document.querySelectorAll('.screen-container').forEach(t => {
    if (t.classList.contains('active')) telaAnteriorWiki = t.id;
  });
  
  renderWikiCategories();
  mostrarTelaWikiMain();
  mostrarTela('screen-wiki');
}

function voltarDaWiki() {
  mostrarTela(telaAnteriorWiki || 'screen-select');
}

function renderWikiCategories() {
  const container = document.getElementById('wiki-categories-list');
  if (!container) return;
  container.innerHTML = '';

  Object.keys(wikiStatusData).forEach((catName, index) => {
    const items = wikiStatusData[catName];
    let itemsHTML = items.map(item => `
      <div class="wiki-status-item" onclick="verDetalhesStatus('${catName}', '${item.nome}')">
        🔹 ${item.nome}
      </div>
    `).join('');

    container.innerHTML += `
      <div class="category-accordion" id="cat-accordion-${index}">
        <div class="category-header" onclick="toggleCategoryAccordion(${index})">
          <span>${catName}</span>
          <span class="arrow">▶</span>
        </div>
        <div class="category-items">
          ${itemsHTML}
        </div>
      </div>
    `;
  });
}

function toggleCategoryAccordion(index) {
  const el = document.getElementById(`cat-accordion-${index}`);
  if (el) el.classList.toggle('open');
}

function mostrarTelaWikiMain() {
  document.getElementById('wiki-main-doc').style.display = 'block';
  document.getElementById('wiki-status-detail').style.display = 'none';
}

function verDetalhesStatus(categoria, statusNome) {
  const statusObj = wikiStatusData[categoria].find(s => s.nome === statusNome);
  if (!statusObj) return;

  document.getElementById('wiki-main-doc').style.display = 'none';
  const detailContainer = document.getElementById('wiki-status-detail');
  detailContainer.style.display = 'block';

  let tabelaNiveisHTML = statusObj.niveis.map(n => `
    <tr>
      <td><strong>Nível ${n.lvl}</strong></td>
      <td>${n.efeito}</td>
    </tr>
  `).join('');

  detailContainer.innerHTML = `
    <button class="wiki-btn-back" onclick="mostrarTelaWikiMain()">← Voltar às Regras Gerais</button>
    <h2>✨ ${statusObj.nome}</h2>
    <p style="color: #a8a8b3; margin-bottom: 15px;"><strong>Categoria:</strong> ${categoria}</p>
    <div class="wiki-card-info">
      <p>${statusObj.desc}</p>
    </div>
    <h3>Escalonamento por Nível</h3>
    <table class="wiki-table">
      <thead>
        <tr>
          <th>Nível</th>
          <th>Efeito Aplicado</th>
        </tr>
      </thead>
      <tbody>
        ${tabelaNiveisHTML}
      </tbody>
    </table>
  `;
}

// ==========================================================================
// FUNÇÕES DE ENTRADA / CONTROLE DE DADOS
// ==========================================================================
function entrarComoJogador() {
  const nomeID = document.getElementById('input-player-id').value.trim();
  if (!nomeID) return alert("Digite o nome ou ID do seu personagem!");
  
  fichaAtualID = nomeID.toLowerCase().replace(/\s+/g, '_');
  modoMestre = false;
  
  mostrarTela('screen-sheet'); // Muda a tela IMEDIATAMENTE
  
  document.getElementById('badge-gm-view').style.display = 'none';
  document.getElementById('label-ficha-ativa').innerText = `Editando Ficha: ${nomeID}`;
  
  carregarOpcoesBuffs();
  renderGridPericias();
  carregarDadosFicha();
}

function entrarComoMestre() {
  const senha = document.getElementById('input-gm-pass').value;
  if (senha !== "123") return alert("Senha incorreta!");
  
  modoMestre = true;
  mostrarTela('screen-gm-dashboard'); // Muda a tela IMEDIATAMENTE
  carregarPainelMestre();
}

function carregarPainelMestre() {
  database.ref('fichas').once('value', snapshot => {
    const data = snapshot.val() || {};
    const list = document.getElementById('gm-cards-list');
    list.innerHTML = '';

    Object.keys(data).forEach(id => {
      const p = data[id];
      list.innerHTML += `
        <div class="gm-card">
          <h3>${p.nome || id}</h3>
          <p><strong>Classe:</strong> ${p.classeBase || '-'} (Lvl ${p.nivel || 1})</p>
          <p><strong>PV:</strong> ${p.pvAtual || 0}/${p.pvMax || 0} | <strong>SAN:</strong> ${p.sanAtual || 0}/${p.sanMax || 0}</p>
          <p><strong>PE:</strong> ${p.peAtual || 0}/${p.peMax || 0} | <strong>MA:</strong> ${p.maAtual || 0}/${p.maMax || 0}</p>
          <br>
          <button class="btn-primary" onclick="abrirFichaComoMestre('${id}')">Abrir Ficha</button>
        </div>
      `;
    });
  });
}

function abrirFichaComoMestre(id) {
  fichaAtualID = id;
  mostrarTela('screen-sheet');
  document.getElementById('badge-gm-view').style.display = 'inline-block';
  document.getElementById('label-ficha-ativa').innerText = `Ficha do Jogador: ${id}`;
  
  carregarOpcoesBuffs();
  renderGridPericias();
  carregarDadosFicha();
}

function voltarParaSelecao() {
  mostrarTela('screen-select');
}

function renderGridPericias() {
  const grid = document.getElementById('grid-pericias');
  if(!grid) return;
  grid.innerHTML = '';
  listaPericiasBase.forEach(p => {
    const key = p.toLowerCase();
    grid.innerHTML += `
      <div class="card-pericia">
        <label>${p}</label>
        <input type="number" id="pericia-${key}" value="0" onchange="recalcularTudo()">
      </div>
    `;
  });
}

function carregarOpcoesBuffs() {
  const select = document.getElementById('buff-alvo');
  if(!select) return;
  select.innerHTML = `
    <option value="forca">Força</option>
    <option value="agilidade">Agilidade</option>
    <option value="vigor">Vigor</option>
    <option value="inteligencia">Inteligência</option>
    <option value="presenca">Presença</option>
    <option value="carisma">Carisma</option>
    <option value="sorte">Sorte</option>
    <option value="defesa">Defesa</option>
    <option value="evasao">Evasão</option>
  `;
}

function openTab(tabName, event) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  if (event) event.currentTarget.classList.add('active');
}

function openSubTab(subTabName, event) {
  document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`subtab-${subTabName}`).classList.add('active');
  if (event) event.currentTarget.classList.add('active');
}

// ==========================================================================
// CÁLCULOS E REGRAS
// ==========================================================================
function recalcularTudo() {
  const vig = parseInt(document.getElementById('attr-vigor').value) || 0;
  const agi = parseInt(document.getElementById('attr-agilidade').value) || 0;
  const pre = parseInt(document.getElementById('attr-presenca').value) || 0;
  const sor = parseInt(document.getElementById('attr-sorte').value) || 0;
  const int = parseInt(document.getElementById('attr-inteligencia').value) || 0;

  const pvMax = 10 + vig;
  const sanMax = 4 + pre;
  const peMax = 5 + agi + vig;
  const maMax = vig + pre + sor + int;
  const defVal = Math.floor(vig / 2);
  const evaVal = agi;

  document.getElementById('pv-max').value = pvMax;
  document.getElementById('san-max').value = sanMax;
  document.getElementById('pe-max').value = peMax;
  document.getElementById('ma-max').value = maMax;
  document.getElementById('def-val').value = defVal;
  document.getElementById('eva-val').value = evaVal;

  salvarDados();
}

function formatarNEX(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val) input.value = val + '%';
  salvarDados();
}

// ==========================================================================
// GERENCIADOR DE EXPERIÊNCIA
// ==========================================================================
function abrirModalXP() {
  document.getElementById('modal-xp').classList.add('active');
}

function fecharModalXP() {
  document.getElementById('modal-xp').classList.remove('active');
}

function somarXPInput(qtd) {
  const input = document.getElementById('xp-input-val');
  input.value = (parseInt(input.value) || 0) + qtd;
}

function confirmarGanhoXP() {
  const val = parseInt(document.getElementById('xp-input-val').value) || 0;
  const display = document.getElementById('exp-display');
  let [atual, max] = display.value.split('/').map(v => parseInt(v.trim()) || 0);

  atual += val;
  display.value = `${atual} / ${max || 100}`;
  
  document.getElementById('xp-input-val').value = '';
  fecharModalXP();
  salvarDados();
}

// ==========================================================================
// BANCO DE DADOS (FIREBASE)
// ==========================================================================
function salvarDados() {
  if (!fichaAtualID) return;

  const periciasObj = {};
  listaPericiasBase.forEach(p => {
    const key = p.toLowerCase();
    const el = document.getElementById(`pericia-${key}`);
    if (el) periciasObj[key] = parseInt(el.value) || 0;
  });

  const data = {
    nome: document.getElementById('nome').value,
    classeBase: document.getElementById('classe-base').value,
    nivel: document.getElementById('nivel').value,
    nex: document.getElementById('nex').value,
    idade: document.getElementById('idade').value,
    origem: document.getElementById('origem').value,
    raca: document.getElementById('raca').value,
    genero: document.getElementById('genero').value,
    sexualidade: document.getElementById('sexualidade').value,
    classeAdd: document.getElementById('classe-add').value,
    traco: document.getElementById('traco').value,
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

    pericias: periciasObj,

    habUnicas: document.getElementById('hab-unicas').value,
    habLendarias: document.getElementById('hab-lendarias').value,
    habEpicas: document.getElementById('hab-epicas').value,
    habRaras: document.getElementById('hab-raras').value,
    habIncomuns: document.getElementById('hab-incomuns').value,
    habComuns: document.getElementById('hab-comuns').value,

    skillsTexto: document.getElementById('skills-texto').value,
    feiticosTexto: document.getElementById('feiticos-texto').value,
    rituaisTexto: document.getElementById('rituais-texto').value
  };

  database.ref(`fichas/${fichaAtualID}`).update(data);
}

function carregarDadosFicha() {
  database.ref(`fichas/${fichaAtualID}`).once('value', snapshot => {
    const data = snapshot.val() || {};

    document.getElementById('nome').value = data.nome || fichaAtualID;
    document.getElementById('classe-base').value = data.classeBase || 'Místico';
    document.getElementById('nivel').value = data.nivel || 1;
    document.getElementById('nex').value = data.nex || '20%';
    document.getElementById('idade').value = data.idade || 18;
    document.getElementById('origem').value = data.origem || '';
    document.getElementById('raca').value = data.raca || '';
    document.getElementById('genero').value = data.genero || '';
    document.getElementById('sexualidade').value = data.sexualidade || '';
    document.getElementById('classe-add').value = data.classeAdd || '';
    document.getElementById('traco').value = data.traco || '';
    document.getElementById('traumas').value = data.traumas || '';

    document.getElementById('pv-atual').value = data.pvAtual || 10;
    document.getElementById('san-atual').value = data.sanAtual || 4;
    document.getElementById('pe-atual').value = data.peAtual || 5;
    document.getElementById('ma-atual').value = data.maAtual || 0;
    document.getElementById('tp-val').value = data.tpVal || 0;

    document.getElementById('attr-forca').value = data.attrForca || 10;
    document.getElementById('attr-agilidade').value = data.attrAgilidade || 10;
    document.getElementById('attr-vigor').value = data.attrVigor || 10;
    document.getElementById('attr-inteligencia').value = data.attrInteligencia || 10;
    document.getElementById('attr-presenca').value = data.attrPresenca || 10;
    document.getElementById('attr-carisma').value = data.attrCarisma || 10;
    document.getElementById('attr-sorte').value = data.attrSorte || 10;

    if (data.pericias) {
      Object.keys(data.pericias).forEach(pKey => {
        const input = document.getElementById(`pericia-${pKey}`);
        if (input) input.value = data.pericias[pKey];
      });
    }

    document.getElementById('hab-unicas').value = data.habUnicas || '';
    document.getElementById('hab-lendarias').value = data.habLendarias || '';
    document.getElementById('hab-epicas').value = data.habEpicas || '';
    document.getElementById('hab-raras').value = data.habRaras || '';
    document.getElementById('hab-incomuns').value = data.habIncomuns || '';
    document.getElementById('hab-comuns').value = data.habComuns || '';

    document.getElementById('skills-texto').value = data.skillsTexto || '';
    document.getElementById('feiticos-texto').value = data.feiticosTexto || '';
    document.getElementById('rituais-texto').value = data.rituaisTexto || '';

    recalcularTudo();
  });
}

function adicionarBuffItemTemp() {
  const alvo = document.getElementById('buff-alvo').value;
  const val = parseInt(document.getElementById('buff-valor').value) || 0;
  
  buffsTempItem.push({ alvo, val });
  renderBuffsTemp();
}

function renderBuffsTemp() {
  const container = document.getElementById('lista-buffs-temp');
  if(!container) return;
  container.innerHTML = buffsTempItem.map(b => `<span class="buff-tag">+${b.val} ${b.alvo}</span>`).join(' ');
}

function criarItem() {
  alert("Item adicionado!");
  buffsTempItem = [];
  renderBuffsTemp();
}

function adicionarEfeito() {
  const nome = document.getElementById('effect-name').value;
  if (!nome) return;
  const list = document.getElementById('lista-efeitos');
  list.innerHTML += `<li class="effect-item"><span>${nome}</span> <button class="btn-danger" onclick="this.parentElement.remove()">X</button></li>`;
  document.getElementById('effect-name').value = '';
}

function criarBlocoAnotacao() {
  const container = document.getElementById('container-anotacoes');
  if(!container) return;
  container.innerHTML += `
    <div class="bloco-anotacao">
      <input type="text" placeholder="Título...">
      <textarea rows="4" placeholder="Anotações..."></textarea>
      <button class="btn-danger" style="margin-top:6px;" onclick="this.parentElement.remove()">Excluir</button>
    </div>
  `;
}
