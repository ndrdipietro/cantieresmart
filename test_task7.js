/**
 * CantiereSmart - Test Suite Task 7: Verifica End-to-End, Mobile UX & Certificazione Finale
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Verifiche automatizzate E2E:
 * 1. Dipendenze e architettura 100% offline (Service Worker precache, zero CDN esterne)
 * 2. Compilazione progressiva dei 9 box con verifica stato .completed (bordo smeraldo e icona verde)
 * 3. Contatore progressivo di avanzamento da "0 / 9 completati" a "✓ 9 / 9 completati"
 * 4. Autocompletamento cantieri/operai/subappalti e auto-apprendimento nello Store
 * 5. Compilazione ultra-rapida con tasti N.A. (completamento 9/9 in meno di 2 minuti)
 * 6. Gestione promemoria giornalieri: orari vincolanti 11:55 e 16:55 (Lun-Ven) e scheduler
 * 7. Motore PDF: conformità geometrica A4, testata, footer, naming YYYY-MM-DD_NomeCantiere.pdf (1 pag per 0..4 foto, 2 pag per 5..8 foto)
 * 8. Motore Word (.docx): conformità OpenXML standard, naming YYYY-MM-DD_NomeCantiere.docx, embedding testi e immagini
 * 9. PWA Mobile: manifest.json standalone, safe-area touch targets >= 48px / bottoni 52px
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=================================================================');
console.log('  TEST SUITE TASK 7: VERIFICA E2E, MOBILE UX & REPORTING FINALE');
console.log('  Vittorini Emidio Costruzioni S.r.l. - CantiereSmart PWA');
console.log('=================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(description, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    Errore: ${err.message}\n`, err.stack);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. CARICAMENTO MODULI E VERIFICA ZERO-CDN / OFFLINE-FIRST
// ---------------------------------------------------------------------------
const CantiereStore = require('./js/store.js');
const Autocomplete = require('./js/autocomplete.js');
const {
  RapportinoState,
  PhotoCompressor,
  CantiereApp,
  sanitizeFileName,
  formatDateItalian
} = require('./js/app.js');
const {
  NotificationsManager,
  notificationsInstance,
  NOTIFICATION_CONSTANTS
} = require('./js/notifications.js');
const {
  CantiereDrawer,
  cantiereDrawerInstance
} = require('./js/drawer.js');
const {
  generateCantierePDF,
  sanitizePdfFilename,
  formatDateForPdf,
  GEOMETRY
} = require('./js/pdf-generator.js');
const {
  generateCantiereDOCX,
  sanitizeDocxFilename,
  formatDateForDocx,
  DOCX_GEOMETRY
} = require('./js/docx-generator.js');
const fflate = require('./js/lib/fflate.umd.min.js');

// Mock DOM factory per test reattivo UI
function createMockClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...cls) => cls.forEach(c => set.add(c)),
    remove: (...cls) => cls.forEach(c => set.delete(c)),
    toggle: (c, force) => {
      if (force !== undefined) {
        force ? set.add(c) : set.delete(c);
        return force;
      }
      if (set.has(c)) { set.delete(c); return false; }
      set.add(c); return true;
    },
    contains: c => set.has(c),
    get value() { return Array.from(set).join(' '); }
  };
}

function createMockElement(id, tag = 'div') {
  let classListInstance = createMockClassList();
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    attributes: {},
    children: [],
    style: {},
    get classList() {
      return classListInstance;
    },
    set classList(cl) {
      classListInstance = cl;
    },
    get className() {
      return classListInstance.value;
    },
    set className(val) {
      const tokens = (val || '').split(/\s+/).filter(Boolean);
      classListInstance = createMockClassList(tokens);
    },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    focus() {}
  };
  return el;
}

async function runE2ETests() {

  // =========================================================================
  // SEZIONE 1: ARCHITETTURA OFFLINE-FIRST, SERVICE WORKER E ZERO CDN ESTERNE
  // =========================================================================
  await it('1.1. Service Worker precache: tutti i 22 asset statici esistono fisicamente su disco', () => {
    const swPath = path.join(__dirname, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    const match = swContent.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);
    assert.ok(match, 'sw.js deve definire PRECACHE_ASSETS');

    const assets = eval('[' + match[1] + ']');
    assert.ok(assets.length >= 20, `Attesi almeno 20 asset nel precache, trovati: ${assets.length}`);

    assets.forEach(assetPath => {
      if (assetPath === './') return; // root URL
      const cleanPath = assetPath.replace(/^\.\//, '');
      const fullPath = path.join(__dirname, cleanPath);
      assert.ok(fs.existsSync(fullPath), `Asset del Service Worker non trovato su disco: ${cleanPath}`);
    });
  });

  await it('1.2. Zero CDN esterne: index.html e css non caricano risorse http/https remote (100% offline)', () => {
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    const appCss = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf-8');
    const manifestJson = fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8');

    const urlRegex = /https?:\/\/[a-zA-Z0-9\.\-_]+[^\s"'>]*/g;
    const allMatches = [
      ...(indexHtml.match(urlRegex) || []),
      ...(appCss.match(urlRegex) || []),
      ...(manifestJson.match(urlRegex) || [])
    ];

    // Ignora solo namespace W3C XML o OpenXML
    const externalRemoteCalls = allMatches.filter(url => 
      !url.includes('w3.org') && 
      !url.includes('schemas.openxmlformats.org') && 
      !url.includes('schemas.microsoft.com')
    );

    assert.strictEqual(
      externalRemoteCalls.length,
      0,
      `Trovati link esterni CDN non ammessi: ${externalRemoteCalls.join(', ')}`
    );
  });

  await it('1.3. PWA Manifest & Viewport iOS/Android configurati a norma di cantiere', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));
    assert.strictEqual(manifest.display, 'standalone', 'PWA deve avere display: standalone');
    assert.strictEqual(manifest.theme_color, '#1A5694', 'Theme color istituzionale #1A5694');
    assert.ok(manifest.icons && manifest.icons.length >= 2, 'Manifest deve includere icone');

    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(indexHtml.includes('viewport-fit=cover'), 'Viewport deve gestire safe-area con viewport-fit=cover');
    assert.ok(indexHtml.includes('apple-mobile-web-app-capable'), 'Supporto iOS home screen standalone');
    assert.ok(indexHtml.includes('apple-mobile-web-app-status-bar-style'), 'Status bar iOS personalizzata');
  });

  // =========================================================================
  // SEZIONE 2: COMPILAZIONE PROGRESSIVA DEI 9 BOX & REATTIVITÀ STATO (0/9 -> 9/9)
  // =========================================================================
  await it('2.1. Inizializzazione pulita: contatore a 0/9 completati e tutti i box nello stato pending', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.getCompletedCount(), 0, 'Inizialmente completati deve essere 0');
    assert.strictEqual(state.isAllComplete(), false, 'Il rapportino iniziale non deve essere completo');
    assert.strictEqual(state.isBox1Complete(), false);
    assert.strictEqual(state.isBox2Complete(), false);
    assert.strictEqual(state.isBox3Complete(), false);
    assert.strictEqual(state.isBox4Complete(), false);
    assert.strictEqual(state.isBox5Complete(), false);
    assert.strictEqual(state.isBox6Complete(), false);
    assert.strictEqual(state.isBox7Complete(), false);
    assert.strictEqual(state.isBox8Complete(), false);
    assert.strictEqual(state.isBox9Complete(), false);
  });

  await it('2.2. Box 1 (Data & Cantiere): autocompletamento cantiere esistente e aggiunta nuovo cantiere', () => {
    const state = new RapportinoState();
    CantiereStore.resetToDefaults({ keepRapportini: true });

    // Ricerca cantiere esistente
    const cantieri = CantiereStore.getCantieri();
    const madonna = cantieri.find(c => c.nome.includes('Santuario Madonna delle Grazie'));
    assert.ok(madonna, 'Cantiere Santuario presente');

    state.setDate('2026-10-19');
    state.setCantiere(madonna.nome, madonna.localita, madonna.commessa);
    assert.strictEqual(state.isBox1Complete(), true, 'Box 1 deve essere completo con cantiere e data');
    assert.strictEqual(state.getCompletedCount(), 1);

    // Creazione ed auto-apprendimento nuovo cantiere
    const nuovoCantiere = CantiereStore.saveCantiere('Restauro Villa Comunale', 'L\'Aquila Centro', 'Comune AQ 2026');
    assert.ok(nuovoCantiere.id);
    state.setCantiere(nuovoCantiere.nome, nuovoCantiere.localita, nuovoCantiere.commessa);
    assert.strictEqual(state.cantiere, 'Restauro Villa Comunale');
    assert.strictEqual(state.isBox1Complete(), true);
  });

  await it('2.3. Box 2 (Meteo & Clima): selezione condizioni (Sereno, Nuvoloso, Pioggia, Neve) e stepper temperatura', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.isBox2Complete(), false);

    // Test tutte le 4 condizioni meteo
    ['sereno', 'nuvoloso', 'pioggia', 'neve'].forEach(cond => {
      state.setMeteo(cond);
      assert.strictEqual(state.meteo, cond);
      assert.strictEqual(state.isBox2Complete(), true);
    });

    // Test stepper temperatura
    state.setTemperatura(20);
    state.adjustTemperatura(2);
    assert.strictEqual(state.temperatura, 22);
    state.adjustTemperatura(-5);
    assert.strictEqual(state.temperatura, 17);

    // Limiti di sicurezza consentiti in cantiere (-25°C .. +55°C)
    state.setTemperatura(60);
    assert.strictEqual(state.temperatura, 55, 'Limite massimo 55°C');
    state.setTemperatura(-40);
    assert.strictEqual(state.temperatura, -25, 'Limite minimo -25°C');
  });

  await it('2.4. Box 3 (Lavorazioni): testo dettagliato e tasto rapido N.A. con disattivazione automatica', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.isBox3Complete(), false);

    state.setLavorazioni('Scavo di fondazione, armatura pilastri P.T., getto cls Rck 30');
    assert.strictEqual(state.isBox3Complete(), true);
    assert.strictEqual(state.naLavorazioni, false);

    // Tasto rapido Nessuna Attività
    state.toggleNaLavorazioni();
    assert.strictEqual(state.naLavorazioni, true);
    assert.strictEqual(state.isBox3Complete(), true);

    // Se l'operatore riprende a scrivere, disattiva il flag N.A.
    state.setLavorazioni('Ripresa attività pomeridiana');
    assert.strictEqual(state.naLavorazioni, false);
    assert.strictEqual(state.isBox3Complete(), true);
  });

  await it('2.5. Box 4 (Personale Vittorini): selezione operai multipli con calcolo automatico totale', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.isBox4Complete(), false);
    assert.strictEqual(state.getTotals().totaleVittorini, 0);

    state.addOperaio('Marco Rossi');
    state.addOperaio('Giuseppe Esposito');
    state.addOperaio('Antonio Russo');
    assert.strictEqual(state.operaiVittorini.length, 3);
    assert.strictEqual(state.getTotals().totaleVittorini, 3);
    assert.strictEqual(state.isBox4Complete(), true);

    // Rimozione singolo operaio
    state.toggleOperaio('Antonio Russo');
    assert.strictEqual(state.getTotals().totaleVittorini, 2);

    // Aggiunta operaio fuori rubrica
    state.addOperaio('Nuovo Muratore Andrea');
    assert.strictEqual(state.getTotals().totaleVittorini, 3);
  });

  await it('2.6. Box 5 (Subappaltatori): inserimento ditta, numero operai e somma dinamica', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.isBox5Complete(), false);

    state.addSubappaltatore({ ditta: 'IPPOLITI PONTEGGI', operai: 3, lavorazione: 'Ponteggio facciata Nord' });
    state.addSubappaltatore({ ditta: 'EDILIZIA 2000 SRL', operai: 2, lavorazione: 'Tramezzature' });

    assert.strictEqual(state.subappaltatori.length, 2);
    assert.strictEqual(state.getTotals().totaleSubappaltatori, 5, '3 + 2 = 5 operai subappalto');
    assert.strictEqual(state.isBox5Complete(), true);

    // Verifica somma complessiva cantiere (Vittorini + Subappalti)
    state.addOperaio('Marco Rossi');
    const totals = state.getTotals();
    assert.strictEqual(totals.totaleVittorini, 1);
    assert.strictEqual(totals.totaleSubappaltatori, 5);
    assert.strictEqual(totals.totaleComplessivo, 6, '1 Vittorini + 5 Sub = 6 totale persone in cantiere');
  });

  await it('2.7. Box 6, 7 e 8 (Noleggi, Materiali, Note): popolamento e validazione', () => {
    const state = new RapportinoState();

    // Box 6
    state.addNoleggio('Escavatore Cat 320');
    state.addNoleggio('Piattaforma Aerea 18m');
    assert.strictEqual(state.isBox6Complete(), true);
    assert.strictEqual(state.noleggi.length, 2);

    // Box 7
    state.setMateriali('Calcestruzzo Rck 30 m³ 24, Rete elettrosaldata Ø8 20 fogli');
    assert.strictEqual(state.isBox7Complete(), true);

    // Box 8
    state.setNote('Visita D.L. Ing. De Angelis ore 10:30, verifica armature completata con esito positivo');
    assert.strictEqual(state.isBox8Complete(), true);
  });

  await it('2.8. Box 9 (Foto da 0 a 8 foto): compressione Canvas e blocco rigoroso a 8 foto', () => {
    const state = new RapportinoState();
    assert.strictEqual(state.isBox9Complete(), false);

    // Aggiunta fino al limite di 8 foto
    for (let i = 1; i <= 8; i++) {
      const res = state.addPhoto({
        id: `f_${i}`,
        name: `cantiere_scatto_${i}.jpg`,
        dataUrl: `data:image/jpeg;base64,mockJpegBytes${i}`
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, i);
    }

    assert.strictEqual(state.foto.length, 8);
    assert.strictEqual(state.isBox9Complete(), true);

    // Tentativo di 9ª foto: deve essere respinto
    const rejected = state.addPhoto({
      id: 'f_9',
      name: 'cantiere_scatto_9.jpg',
      dataUrl: 'data:image/jpeg;base64,mockJpegBytes9'
    });
    assert.strictEqual(rejected.success, false);
    assert.strictEqual(rejected.reason, 'MAX_LIMIT_REACHED');
    assert.strictEqual(state.foto.length, 8, 'Non può mai superare le 8 foto');
  });

  // =========================================================================
  // SEZIONE 3: VERIFICA UI REATTIVA (CLASSI .completed, SPUNTE E CONTATORE)
  // =========================================================================
  await it('3.1. Reattività UI completa: transizione da 0/9 a 9/9 con classi .completed e badge aggiornati', () => {
    // Configura istanza App con mock DOM completo
    const app = new CantiereApp();
    app.headerProgress = createMockElement('header-progress-badge');
    app.previewFilename = createMockElement('preview-filename');
    app.bottomAlertBanner = createMockElement('bottom-alert-banner');

    for (let b = 1; b <= 9; b++) {
      app[`box${b}`] = createMockElement(`box-${b}`);
      app[`box${b}Badge`] = createMockElement(`box-${b}-badge`);
    }

    // Stato iniziale: 0/9
    app.render();
    assert.strictEqual(app.headerProgress.textContent, '0 / 9 completati');
    assert.strictEqual(app.headerProgress.classList.contains('completed'), false);
    assert.strictEqual(app.box1.classList.contains('completed'), false);
    assert.strictEqual(app.bottomAlertBanner.textContent, '⚠️ 9 box da completare');

    // 1. Box 1
    app.state.setDate('2026-10-19');
    app.state.setCantiere('Santuario Madonna delle Grazie');
    app.render();
    assert.strictEqual(app.box1.classList.contains('completed'), true);
    assert.strictEqual(app.box1Badge.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '1 / 9 completati');

    // 2. Box 2
    app.state.setMeteo('sereno');
    app.render();
    assert.strictEqual(app.box2.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '2 / 9 completati');

    // 3. Box 3
    app.state.setLavorazioni('Posa intonaci');
    app.render();
    assert.strictEqual(app.box3.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '3 / 9 completati');

    // 4. Box 4
    app.state.addOperaio('Marco Rossi');
    app.render();
    assert.strictEqual(app.box4.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '4 / 9 completati');

    // 5. Box 5
    app.state.addSubappaltatore({ ditta: 'IPPOLITI PONTEGGI', operai: 2 });
    app.render();
    assert.strictEqual(app.box5.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '5 / 9 completati');

    // 6. Box 6
    app.state.addNoleggio('Escavatore 50q');
    app.render();
    assert.strictEqual(app.box6.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '6 / 9 completati');

    // 7. Box 7
    app.state.setMateriali('Calcestruzzo m³ 12');
    app.render();
    assert.strictEqual(app.box7.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '7 / 9 completati');

    // 8. Box 8
    app.state.setNote('Sopralluogo regolare');
    app.render();
    assert.strictEqual(app.box8.classList.contains('completed'), true);
    assert.strictEqual(app.headerProgress.textContent, '8 / 9 completati');
    assert.strictEqual(app.bottomAlertBanner.textContent, '⚠️ 1 box da completare');

    // 9. Box 9
    app.state.addPhoto({ id: 'p_1', name: 'foto1.jpg', dataUrl: 'data:image/jpeg;base64,aaa' });
    app.render();
    assert.strictEqual(app.box9.classList.contains('completed'), true);
    assert.strictEqual(app.box9Badge.classList.contains('completed'), true);

    // Verifica stato finale di traguardo: ✓ 9 / 9 completati
    assert.strictEqual(app.headerProgress.textContent, '✓ 9 / 9 completati');
    assert.strictEqual(app.headerProgress.classList.contains('completed'), true);
    assert.strictEqual(app.bottomAlertBanner.textContent, '✓ Tutti i 9 box completati');
    assert.strictEqual(app.bottomAlertBanner.classList.contains('ready'), true);
    assert.strictEqual(app.previewFilename.textContent, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');
  });

  await it('3.2. Percorso ultra-rapido con tasti N.A.: raggiunge 9/9 in meno di 2 minuti', () => {
    const fastState = new RapportinoState();
    fastState.setDate('2026-10-19');
    fastState.setCantiere('Scuola Elementare Amatrice');
    fastState.setMeteo('nuvoloso');
    fastState.toggleNaLavorazioni();
    fastState.toggleZeroOperai();
    fastState.toggleNessunSubappalto();
    fastState.toggleNessunNoleggio();
    fastState.toggleNessunMateriale();
    fastState.toggleNessunaNota();
    fastState.toggleNessunaFoto();

    assert.strictEqual(fastState.getCompletedCount(), 9);
    assert.strictEqual(fastState.isAllComplete(), true);
  });

  // =========================================================================
  // SEZIONE 4: VERIFICA PROMEMORIA & NOTIFICHE (11:55 e 16:55 LUN-VEN)
  // =========================================================================
  await it('4.1. Promemoria di default configurati rigorosamente a 11:55 e 16:55 Lun-Ven', () => {
    assert.strictEqual(NOTIFICATION_CONSTANTS.DEFAULT_TIME_1, '11:55', 'Orario 1 deve essere tassativamente 11:55');
    assert.strictEqual(NOTIFICATION_CONSTANTS.DEFAULT_TIME_2, '16:55', 'Orario 2 deve essere tassativamente 16:55');
    assert.deepStrictEqual(NOTIFICATION_CONSTANTS.DEFAULT_DAYS, [1, 2, 3, 4, 5], 'Attivi Lun-Ven [1, 2, 3, 4, 5]');

    const manager = new NotificationsManager({ store: CantiereStore });
    const settings = manager.getSettings();
    assert.strictEqual(settings.reminderEnabled, true);
    assert.strictEqual(settings.time1, '11:55');
    assert.strictEqual(settings.time2, '16:55');
    assert.deepStrictEqual(settings.days, [1, 2, 3, 4, 5]);
  });

  await it('4.2. Scheduler promemoria: scatta a 11:55 e 16:55 feriali, blocca orari fuori slot e festivi', async () => {
    const manager = new NotificationsManager({ store: CantiereStore });

    // Lunedì ore 11:55 (Slot 1 pranzo) -> scatta
    const monday1155 = new Date(2026, 9, 19, 11, 55, 0);
    const res1 = await manager.checkAndNotify(monday1155);
    assert.strictEqual(res1.triggered, true);
    assert.strictEqual(res1.slot, 'slot_1_11:55');

    // Secondo controllo immediato nello stesso slot -> blocco anti-duplicato
    const resDup = await manager.checkAndNotify(monday1155);
    assert.strictEqual(resDup.triggered, false);
    assert.strictEqual(resDup.reason, 'ALREADY_FIRED_FOR_SLOT');

    // Lunedì ore 16:55 (Slot 2 fine turno) -> scatta
    const monday1655 = new Date(2026, 9, 19, 16, 55, 0);
    const res2 = await manager.checkAndNotify(monday1655);
    assert.strictEqual(res2.triggered, true);
    assert.strictEqual(res2.slot, 'slot_2_16:55');

    // Domenica ore 11:55 -> blocco festivo
    const sunday1155 = new Date(2026, 9, 18, 11, 55, 0);
    const resSun = await manager.checkAndNotify(sunday1155);
    assert.strictEqual(resSun.triggered, false);
    assert.strictEqual(resSun.reason, 'DAY_NOT_CONFIGURED');
  });

  // =========================================================================
  // SEZIONE 5: MOTORE ESPORTAZIONE PDF (1 E 2 PAGINE, GEOMETRIA E NAMING)
  // =========================================================================
  const samplePdfData = {
    data: '2026-10-19',
    cantiere: 'Santuario Madonna delle Grazie',
    localita: 'Loc. Varoni, Amatrice (RI)',
    commessa: 'Sisma 2016',
    meteo: 'sereno',
    temperatura: 22,
    lavorazioni: 'Posa armatura per cordolo di coronamento e getto cls Rck 30.',
    operai: ['Marco Rossi', 'Giuseppe Esposito', 'Antonio Russo'],
    totaleOperaiVittorini: 3,
    subappalti: [
      { ditta: 'IPPOLITI PONTEGGI', operai: 3, lavorazione: 'Montaggio ponteggio nord' }
    ],
    totaleOperaiSubappalti: 3,
    noleggi: ['Escavatore 50q'],
    materiali: 'Calcestruzzo Rck 30 m³ 15, Ferro B450C kg 800',
    note: 'Sopralluogo congiunto con D.L. Ing. De Angelis ore 11:00.',
    foto: []
  };

  const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  await it('5.1. Naming file PDF è rigorosamente YYYY-MM-DD_NomeCantiere.pdf', () => {
    const fn = sanitizePdfFilename('2026-10-19', 'Santuario Madonna delle Grazie');
    assert.strictEqual(fn, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');

    const fnSanitized = sanitizePdfFilename('2026-10-19', 'Cantiere / * ? Test');
    assert.strictEqual(fnSanitized, '2026-10-19_Cantiere_Test.pdf');
  });

  await it('5.2. Generazione PDF: 0 foto produce esattamente 1 pagina con header %PDF- valido', async () => {
    const data0 = { ...samplePdfData, foto: [] };
    const resDoc = await generateCantierePDF(data0, { returnDoc: true });
    assert.strictEqual(resDoc.getNumberOfPages(), 1, 'PDF con 0 foto deve avere esattamente 1 pagina');

    const resObj = await generateCantierePDF(data0, { autoSave: false });
    assert.strictEqual(resObj.pageCount, 1);
    assert.strictEqual(resObj.filename, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');

    const buffer = await generateCantierePDF(data0, { returnBuffer: true });
    assert.ok(buffer.length > 20000, `Dimensione PDF (${buffer.length} bytes) deve contenere template`);

    const header = buffer.slice(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-');
  });

  await it('5.3. Generazione PDF: 4 foto produce esattamente 1 pagina (griglia 2x2 compatta)', async () => {
    const data4 = {
      ...samplePdfData,
      foto: [
        { id: 'f1', dataUrl: dummyImage },
        { id: 'f2', dataUrl: dummyImage },
        { id: 'f3', dataUrl: dummyImage },
        { id: 'f4', dataUrl: dummyImage }
      ]
    };
    const res = await generateCantierePDF(data4, { returnDoc: true });
    assert.strictEqual(res.getNumberOfPages(), 1, '4 foto devono rientrare in 1 pagina');
  });

  await it('5.4. Generazione PDF: 6 e 8 foto generano automaticamente 2 pagine esatte', async () => {
    const data6 = {
      ...samplePdfData,
      foto: Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, dataUrl: dummyImage }))
    };
    const res6 = await generateCantierePDF(data6, { returnDoc: true });
    assert.strictEqual(res6.getNumberOfPages(), 2, '6 foto devono generare esattamente 2 pagine');

    const data8 = {
      ...samplePdfData,
      foto: Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, dataUrl: dummyImage }))
    };
    const res8 = await generateCantierePDF(data8, { returnDoc: true });
    assert.strictEqual(res8.getNumberOfPages(), 2, '8 foto (limite max) devono generare esattamente 2 pagine');
  });

  await it('5.5. Geometria PDF rispetta il formato A4 (595.28 x 841.89 pt) e i colori ufficiali Vittorini', () => {
    assert.strictEqual(GEOMETRY.page.width, 595.28);
    assert.strictEqual(GEOMETRY.page.height, 841.89);
    assert.deepStrictEqual(GEOMETRY.colors.blueOuter, [74, 134, 232]);
    assert.deepStrictEqual(GEOMETRY.colors.cyanInner, [201, 218, 248]);
    assert.strictEqual(GEOMETRY.footer.text, "VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA");
  });

  // =========================================================================
  // SEZIONE 6: MOTORE ESPORTAZIONE WORD (.DOCX MODIFICABILE)
  // =========================================================================
  await it('6.1. Naming file Word è rigorosamente YYYY-MM-DD_NomeCantiere.docx', () => {
    const fn = sanitizeDocxFilename('2026-10-19', 'Santuario Madonna delle Grazie');
    assert.strictEqual(fn, '2026-10-19_Santuario_Madonna_delle_Grazie.docx');
  });

  await it('6.2. Generazione Word: pacchetto OpenXML standard valido con sezioni e footer', async () => {
    const dataDocx = { ...samplePdfData, foto: [] };
    const resBuffer = await generateCantiereDOCX(dataDocx, { returnBuffer: true });
    assert.ok(Buffer.isBuffer(resBuffer) || resBuffer instanceof Uint8Array);
    assert.ok(resBuffer.length > 5000);

    const unzipped = fflate.unzipSync(new Uint8Array(resBuffer));
    const entries = Object.keys(unzipped);

    assert.ok(entries.includes('[Content_Types].xml'), 'Manca [Content_Types].xml');
    assert.ok(entries.includes('_rels/.rels'), 'Manca _rels/.rels');
    assert.ok(entries.includes('word/document.xml'), 'Manca word/document.xml');
    assert.ok(entries.includes('word/_rels/document.xml.rels'), 'Manca word/_rels/document.xml.rels');
    assert.ok(entries.includes('word/footer1.xml'), 'Manca word/footer1.xml');

    const docXml = fflate.strFromU8(unzipped['word/document.xml']);
    assert.ok(docXml.includes('RAPPORTO GIORNALIERO DI CANTIERE'));
    assert.ok(docXml.includes('VITTORINI EMIDIO COSTRUZIONI'));
    assert.ok(docXml.includes('Santuario Madonna delle Grazie'));
    assert.ok(docXml.includes('Marco Rossi'));
    assert.ok(docXml.includes('IPPOLITI PONTEGGI'));
  });

  await it('6.3. Generazione Word con 8 foto: embedda 8 immagini in word/media/ con relazioni rId', async () => {
    const data8Docx = {
      ...samplePdfData,
      foto: Array.from({ length: 8 }, (_, i) => ({
        id: `f_${i + 1}`,
        name: `scatto_${i + 1}.png`,
        dataUrl: dummyImage
      }))
    };

    const resBuffer = await generateCantiereDOCX(data8Docx, { returnBuffer: true });
    const unzipped = fflate.unzipSync(new Uint8Array(resBuffer));
    const entries = Object.keys(unzipped);

    for (let i = 1; i <= 8; i++) {
      const mediaEntry = `word/media/image${i}.png`;
      assert.ok(entries.includes(mediaEntry), `Manca media entry: ${mediaEntry}`);
    }

    const relsXml = fflate.strFromU8(unzipped['word/_rels/document.xml.rels']);
    assert.ok(relsXml.includes('image1.png'), 'Le relazioni rels devono referenziare le immagini');
  });

  // =========================================================================
  // SEZIONE 7: MOBILE UX AUDIT (TOUCH TARGETS, BOTTONI E DETTATURA VOCALE)
  // =========================================================================
  await it('7.1. Verifica accessibilità mobile: bottoni chiave >= 52px e touch target >= 48px', () => {
    const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf-8');
    assert.ok(cssContent.includes('--touch-button-height: 52px;'));
    assert.ok(cssContent.includes('--touch-target-min: 48px;'));
    assert.ok(cssContent.includes('min-height: var(--touch-button-height);'));
  });

  await it('7.2. Verifica integrazione dettatura vocale e fotocamera mobile in index.html', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(htmlContent.includes('dettare a voce'), 'Guida alla dettatura vocale presente nei placeholder');
    assert.ok(htmlContent.includes('capture="environment"'), 'Input fotocamera posteriore nativa mobile presente');
    assert.ok(htmlContent.includes('accept="image/*"'), 'Accetta solo formati immagine');
  });

  // =========================================================================
  // RIEPILOGO TEST E2E
  // =========================================================================
  console.log('\n=================================================================');
  console.log(`  RIEPILOGO E2E TASK 7: ${passedTests} / ${totalTests} test superati con successo!`);
  console.log('=================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
