/**
 * CantiereSmart - Test Suite Task 4: Menu Sandwich (Promemoria 11:55 / 16:55, Rubrica e Storico)
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=================================================================');
console.log('  TEST SUITE TASK 4: MENU SANDWICH, PROMEMORIA, RUBRICA & STORICO');
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
// 1. CARICAMENTO MODULI
// ---------------------------------------------------------------------------
const CantiereStore = require('./js/store.js');
const { RapportinoState, CantiereApp, cantiereAppInstance } = require('./js/app.js');
const { NotificationsManager, notificationsInstance, NOTIFICATION_CONSTANTS } = require('./js/notifications.js');
const { CantiereDrawer, cantiereDrawerInstance } = require('./js/drawer.js');

async function runTests() {
  await it('I moduli notifications.js e drawer.js sono esportati correttamente', () => {
    assert.strictEqual(typeof NotificationsManager, 'function', 'NotificationsManager deve essere una classe/funzione');
    assert.strictEqual(typeof notificationsInstance, 'object', 'notificationsInstance deve essere un oggetto');
    assert.strictEqual(typeof NOTIFICATION_CONSTANTS, 'object', 'NOTIFICATION_CONSTANTS deve essere un oggetto');
    assert.strictEqual(typeof CantiereDrawer, 'function', 'CantiereDrawer deve essere una classe/funzione');
    assert.strictEqual(typeof cantiereDrawerInstance, 'object', 'cantiereDrawerInstance deve essere un oggetto');
  });

  // ---------------------------------------------------------------------------
  // 2. PROMEMORIA: ORARI RIGOROSI 11:55 / 16:55 E GIORNI LUN-VEN
  // ---------------------------------------------------------------------------
  await it('Costanti e orari di default vincolanti sono 11:55 e 16:55 per Lunedì-Venerdì', () => {
    assert.strictEqual(NOTIFICATION_CONSTANTS.DEFAULT_TIME_1, '11:55', 'Orario 1 deve essere tassativamente 11:55');
    assert.strictEqual(NOTIFICATION_CONSTANTS.DEFAULT_TIME_2, '16:55', 'Orario 2 deve essere tassativamente 16:55');
    assert.deepStrictEqual(NOTIFICATION_CONSTANTS.DEFAULT_DAYS, [1, 2, 3, 4, 5], 'Giorni di default devono essere Lun-Ven [1, 2, 3, 4, 5]');
    assert.ok(
      NOTIFICATION_CONSTANTS.DEFAULT_BODY.includes('Promemoria Cantiere Vittorini: Ricordati di compilare il rapportino di oggi!'),
      'Testo promemoria deve contenere il messaggio vincolante per il cantiere'
    );

    const manager = new NotificationsManager({ store: CantiereStore });
    const settings = manager.getSettings();
    assert.strictEqual(settings.reminderEnabled, true, 'Promemoria deve essere abilitato di default');
    assert.strictEqual(settings.time1, '11:55');
    assert.strictEqual(settings.time2, '16:55');
    assert.deepStrictEqual(settings.days, [1, 2, 3, 4, 5]);
  });

  // ---------------------------------------------------------------------------
  // 3. SCHEDULER NOTIFICHE & LOGICA CONTROLLO ORARIO
  // ---------------------------------------------------------------------------
  await it('Scheduler notifiche: riconosce slot 11:55 e 16:55 nei giorni lavorativi e blocca orari non schedulati', async () => {
    const manager = new NotificationsManager({ store: CantiereStore });

    // 1. Data fuori orario: Lunedì alle 14:30
    const mondayOffTime = new Date(2026, 9, 19, 14, 30, 0); // 19 Ottobre 2026 è Lunedì (giorno 1)
    const resOff = await manager.checkAndNotify(mondayOffTime);
    assert.strictEqual(resOff.triggered, false);
    assert.strictEqual(resOff.reason, 'NOT_REMINDER_TIME');

    // 2. Data in orario ma giorno festivo non schedulato: Domenica alle 11:55
    const sundaySlot1 = new Date(2026, 9, 18, 11, 55, 0); // 18 Ottobre 2026 è Domenica (giorno 0)
    const resSunday = await manager.checkAndNotify(sundaySlot1);
    assert.strictEqual(resSunday.triggered, false);
    assert.strictEqual(resSunday.reason, 'DAY_NOT_CONFIGURED');

    // 3. Data e orario validi: Lunedì alle 11:55 (Slot 1)
    const mondaySlot1 = new Date(2026, 9, 19, 11, 55, 0);
    const resSlot1 = await manager.checkAndNotify(mondaySlot1);
    assert.strictEqual(resSlot1.triggered, true);
    assert.strictEqual(resSlot1.slot, 'slot_1_11:55');

    // 4. Secondo controllo immediato nello stesso slot: anti-duplicato
    const resDuplicate = await manager.checkAndNotify(mondaySlot1);
    assert.strictEqual(resDuplicate.triggered, false);
    assert.strictEqual(resDuplicate.reason, 'ALREADY_FIRED_FOR_SLOT');

    // 5. Data e orario validi: Lunedì alle 16:55 (Slot 2)
    const mondaySlot2 = new Date(2026, 9, 19, 16, 55, 0);
    const resSlot2 = await manager.checkAndNotify(mondaySlot2);
    assert.strictEqual(resSlot2.triggered, true);
    assert.strictEqual(resSlot2.slot, 'slot_2_16:55');

    // 6. Con promemoria disabilitato nelle impostazioni
    manager.saveSettings({ reminderEnabled: false });
    const resDisabled = await manager.checkAndNotify(mondaySlot1);
    assert.strictEqual(resDisabled.triggered, false);
    assert.strictEqual(resDisabled.reason, 'REMINDERS_DISABLED');

    // Ripristina
    manager.saveSettings({ reminderEnabled: true, time1: '11:55', time2: '16:55', days: [1, 2, 3, 4, 5] });
  });

  // ---------------------------------------------------------------------------
  // 4. NOTIFICA DI TEST SUBITO
  // ---------------------------------------------------------------------------
  await it('Pulsante test notifica: invia notifica immediata con payload formattato', async () => {
    const manager = new NotificationsManager({ store: CantiereStore });
    const result = await manager.sendTestNotification();
    assert.ok(result, 'Il risultato deve essere definito');
    assert.ok('success' in result);
  });

  // ---------------------------------------------------------------------------
  // 5. APERTURA / CHIUSURA DRAWER, OVERLAY & ACCESSIBILITÀ
  // ---------------------------------------------------------------------------
  await it('Apertura e chiusura drawer gestisce classi CSS .open, body lock e attributi aria', () => {
    const classListFactory = () => {
      const classes = new Set();
      return {
        add: (cls) => classes.add(cls),
        remove: (cls) => classes.delete(cls),
        contains: (cls) => classes.has(cls),
        toggle: (cls, force) => {
          if (force === undefined) {
            classes.has(cls) ? classes.delete(cls) : classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
        }
      };
    };

    const mockBackdrop = { classList: classListFactory() };
    const mockPanel = {
      classList: classListFactory(),
      attributes: {},
      setAttribute: function (k, v) { this.attributes[k] = v; },
      getAttribute: function (k) { return this.attributes[k]; },
      querySelectorAll: () => []
    };
    const mockBody = { classList: classListFactory() };

    const drawer = new CantiereDrawer();
    drawer.backdrop = mockBackdrop;
    drawer.panel = mockPanel;
    drawer.store = CantiereStore;

    const originalBody = global.document ? global.document.body : null;
    global.document = global.document || {};
    global.document.body = mockBody;

    // Apertura
    drawer.open();
    assert.strictEqual(drawer.isOpen, true, 'Il drawer deve risultare aperto');
    assert.strictEqual(mockBackdrop.classList.contains('open'), true, 'Backdrop deve avere la classe .open');
    assert.strictEqual(mockPanel.classList.contains('open'), true, 'Panel deve avere la classe .open');
    assert.strictEqual(mockPanel.getAttribute('aria-hidden'), 'false');
    assert.strictEqual(mockBody.classList.contains('drawer-open'), true, 'Il body deve avere la classe .drawer-open per il blocco dello scroll');

    // Chiusura
    drawer.close();
    assert.strictEqual(drawer.isOpen, false, 'Il drawer deve risultare chiuso');
    assert.strictEqual(mockBackdrop.classList.contains('open'), false, 'Backdrop non deve avere la classe .open');
    assert.strictEqual(mockPanel.classList.contains('open'), false, 'Panel non deve avere la classe .open');
    assert.strictEqual(mockPanel.getAttribute('aria-hidden'), 'true');
    assert.strictEqual(mockBody.classList.contains('drawer-open'), false, 'Il body non deve avere la classe .drawer-open');

    if (originalBody) global.document.body = originalBody;
  });

  // ---------------------------------------------------------------------------
  // 6. CAMBIO SCHEDE DRAWER (PROMEMORIA, RUBRICA, STORICO, BACKUP)
  // ---------------------------------------------------------------------------
  await it('Cambio schede all\'interno del drawer commuta correttamente le sezioni visibili', () => {
    const drawer = new CantiereDrawer();
    drawer.store = CantiereStore;
    drawer.sections = {
      promemoria: { classList: { toggle: (cls, force) => { drawer.sections.promemoria.active = force; } } },
      rubrica: { classList: { toggle: (cls, force) => { drawer.sections.rubrica.active = force; } } },
      storico: { classList: { toggle: (cls, force) => { drawer.sections.storico.active = force; } } },
      backup: { classList: { toggle: (cls, force) => { drawer.sections.backup.active = force; } } }
    };
    drawer.tabButtons = [];

    drawer.switchTab('rubrica');
    assert.strictEqual(drawer.activeTab, 'rubrica');
    assert.strictEqual(drawer.sections.rubrica.active, true);
    assert.strictEqual(drawer.sections.promemoria.active, false);

    drawer.switchTab('storico');
    assert.strictEqual(drawer.activeTab, 'storico');
    assert.strictEqual(drawer.sections.storico.active, true);
    assert.strictEqual(drawer.sections.rubrica.active, false);

    drawer.switchTab('backup');
    assert.strictEqual(drawer.activeTab, 'backup');
    assert.strictEqual(drawer.sections.backup.active, true);

    drawer.switchTab('promemoria');
    assert.strictEqual(drawer.activeTab, 'promemoria');
    assert.strictEqual(drawer.sections.promemoria.active, true);
  });

  // ---------------------------------------------------------------------------
  // 7. GESTIONE RUBRICA: AGGIUNTA ED ELIMINAZIONE CANTIERI ED OPERAI
  // ---------------------------------------------------------------------------
  await it('Gestione Rubrica: aggiunta ed eliminazione cantieri e operai con aggiornamento store', () => {
    CantiereStore.resetToDefaults({ keepRapportini: true });

    const initialCantieriCount = CantiereStore.getCantieri().length;
    const initialOperaiCount = CantiereStore.getOperai().length;

    // 1. Aggiunta nuovo cantiere
    const newCantiere = CantiereStore.saveCantiere('Restauro Chiesa San Francesco', 'Accumoli (RI)', 'Opere Pubbliche 2026');
    assert.ok(newCantiere.id, 'Il cantiere deve ricevere un ID');
    assert.strictEqual(CantiereStore.getCantieri().length, initialCantieriCount + 1);

    const foundCantiere = CantiereStore.getCantiere(newCantiere.id);
    assert.strictEqual(foundCantiere.nome, 'Restauro Chiesa San Francesco');
    assert.strictEqual(foundCantiere.localita, 'Accumoli (RI)');

    // 2. Eliminazione cantiere
    const deletedC = CantiereStore.deleteCantiere(newCantiere.id);
    assert.strictEqual(deletedC, true, 'La cancellazione del cantiere deve restituire true');
    assert.strictEqual(CantiereStore.getCantieri().length, initialCantieriCount);
    assert.strictEqual(CantiereStore.getCantiere(newCantiere.id), null);

    // 3. Aggiunta nuovo operaio
    const newOp = CantiereStore.saveOperaio('Simone D\'Agostino');
    assert.ok(newOp.id, 'L\'operaio deve ricevere un ID');
    assert.strictEqual(CantiereStore.getOperai().length, initialOperaiCount + 1);

    // 4. Eliminazione operaio
    const deletedOp = CantiereStore.deleteOperaio(newOp.id);
    assert.strictEqual(deletedOp, true);
    assert.strictEqual(CantiereStore.getOperai().length, initialOperaiCount);

    // 5. Aggiunta e rimozione Subappalto e Noleggio
    const initialSubCount = CantiereStore.getSubappalti().length;
    const newSub = CantiereStore.saveSubappalto('SCAVI & DEMOLIZIONI LAZIO');
    assert.strictEqual(CantiereStore.getSubappalti().length, initialSubCount + 1);
    CantiereStore.deleteSubappalto(newSub.id);
    assert.strictEqual(CantiereStore.getSubappalti().length, initialSubCount);

    const initialNolCount = CantiereStore.getNoleggi().length;
    const newNol = CantiereStore.saveNoleggio('Rullo Compattatore Dynapac');
    assert.strictEqual(CantiereStore.getNoleggi().length, initialNolCount + 1);
    CantiereStore.deleteNoleggio(newNol.id);
    assert.strictEqual(CantiereStore.getNoleggi().length, initialNolCount);
  });

  // ---------------------------------------------------------------------------
  // 8. SINCRONIZZAZIONE LIVE CON L'APP PRINCIPALE
  // ---------------------------------------------------------------------------
  await it('Modifiche in rubrica notificano l\'app principale per sincronizzare chip e autocomplete', () => {
    let syncCalled = false;
    const mockApp = {
      refreshFromStore: () => {
        syncCalled = true;
      }
    };

    const drawer = new CantiereDrawer();
    drawer.app = mockApp;
    drawer.notifyAppSync();

    assert.strictEqual(syncCalled, true, 'notifyAppSync() deve chiamare refreshFromStore() sull\'app principale');
  });

  // ---------------------------------------------------------------------------
  // 9. RICARICAMENTO DI UN RAPPORTINO DALLO STORICO NELL'APP (TUTTI I 9 BOX)
  // ---------------------------------------------------------------------------
  await it('Ricaricamento di un rapportino dallo storico popola tutti i campi dei 9 box', () => {
    const app = new CantiereApp();

    const testReport = {
      id: 'rap_2026-10-15_test01',
      data: '2026-10-15',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016',
      meteo: 'sereno',
      temperatura: 24,
      lavorazioni: 'Posa cordoli in travertino e intonaco armato con rete in fibra.',
      naLavorazioni: false,
      operai: ['Marco Rossi', 'Giuseppe Esposito', 'Antonio Russo'],
      zeroOperai: false,
      subappalti: [
        { ditta: 'IPPOLITI PONTEGGI', operai: 2, lavorazione: 'Smontaggio secondo ordine ponteggio' }
      ],
      nessunSubappalto: false,
      noleggi: ['Escavatore 50q'],
      nessunNoleggio: false,
      materiali: '3 bancali di malta strutturale M15 e rete d\'armatura.',
      nessunMateriale: false,
      note: 'Visita del Direttore dei Lavori Ing. Mariani alle ore 11:30. Nulla osta.',
      nessunaNota: false,
      foto: [
        { id: 'f1', dataUrl: 'data:image/jpeg;base64,mockphoto1', timestamp: 123456789 }
      ],
      nessunaFoto: false
    };

    // Caricamento del rapportino nell'app
    const loaded = app.loadReport(testReport);
    assert.strictEqual(loaded, true, 'loadReport deve restituire true');

    // Verifica stato caricato nei 9 box
    assert.strictEqual(app.state.data, '2026-10-15');
    assert.strictEqual(app.state.cantiere, 'Santuario Madonna delle Grazie');
    assert.strictEqual(app.state.localita, 'Loc. Varoni, Amatrice (RI)');
    assert.strictEqual(app.state.commessa, 'Sisma 2016');
    assert.strictEqual(app.state.meteo, 'sereno');
    assert.strictEqual(app.state.temperatura, 24);
    assert.strictEqual(app.state.lavorazioni, 'Posa cordoli in travertino e intonaco armato con rete in fibra.');
    assert.strictEqual(app.state.operaiVittorini.length, 3);
    assert.ok(app.state.operaiVittorini.includes('Marco Rossi'));
    assert.strictEqual(app.state.subappaltatori.length, 1);
    assert.strictEqual(app.state.subappaltatori[0].ditta, 'IPPOLITI PONTEGGI');
    assert.strictEqual(app.state.noleggi.length, 1);
    assert.strictEqual(app.state.materiali, '3 bancali di malta strutturale M15 e rete d\'armatura.');
    assert.strictEqual(app.state.note, 'Visita del Direttore dei Lavori Ing. Mariani alle ore 11:30. Nulla osta.');
    assert.strictEqual(app.state.foto.length, 1);

    // Tutti i 9 box devono risultare completati (spunta verde)
    assert.strictEqual(app.state.isAllComplete(), true, 'Tutti i 9 box devono risultare completati');
    assert.strictEqual(app.state.getCompletedCount(), 9, 'Conteggio box completati deve essere 9');
  });

  // ---------------------------------------------------------------------------
  // 10. ELIMINAZIONE RAPPORTINO DALLO STORICO
  // ---------------------------------------------------------------------------
  await it('Eliminazione rapportino dal registro locale', () => {
    const rap = CantiereStore.saveRapportino({
      data: '2026-10-16',
      cantiere: 'Cantiere Test Eliminazione',
      meteo: 'pioggia'
    });

    assert.ok(CantiereStore.getRapportino(rap.id), 'Il rapportino deve esistere prima della cancellazione');
    const deleted = CantiereStore.deleteRapportino(rap.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(CantiereStore.getRapportino(rap.id), null, 'Il rapportino eliminato non deve più esistere');
  });

  // ---------------------------------------------------------------------------
  // 11. BACKUP & RIPRISTINO JSON
  // ---------------------------------------------------------------------------
  await it('Esportazione Backup genera JSON valido e Ripristino sincronizza tutti i dati', () => {
    const backup = CantiereStore.exportAllData();
    assert.strictEqual(backup.company, 'Vittorini Emidio Costruzioni S.r.l.');
    assert.ok(backup.exportedAt);
    assert.ok(Array.isArray(backup.cantieri));
    assert.ok(Array.isArray(backup.operai));
    assert.ok(Array.isArray(backup.subappalti));
    assert.ok(Array.isArray(backup.noleggi));
    assert.ok(backup.settings);
    assert.ok(Array.isArray(backup.rapportini));

    // Salvataggio temporaneo
    CantiereStore.saveOperaio('Operaio Da Sovrascrivere');
    assert.ok(CantiereStore.getOperai().some(o => o.nome === 'Operaio Da Sovrascrivere'));

    // Ripristino dal backup
    const importRes = CantiereStore.importAllData(backup);
    assert.strictEqual(importRes.success, true);
    assert.strictEqual(CantiereStore.getOperai().some(o => o.nome === 'Operaio Da Sovrascrivere'), false);
  });

  // ---------------------------------------------------------------------------
  // 12. VERIFICA STRUTTURA HTML E IDENTIFICATORI CHIAVE TASK 4
  // ---------------------------------------------------------------------------
  await it('Verifica integrità index.html: drawer laterale, pulsanti, tab e sottomoduli', () => {
    const htmlPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Pulsante apertura drawer
    assert.ok(html.includes('id="btn-open-drawer"'), 'Deve esistere #btn-open-drawer per aprire il drawer');
    assert.ok(html.includes('id="btn-close-drawer"'), 'Deve esistere #btn-close-drawer per chiudere il drawer');
    assert.ok(html.includes('id="drawer-backdrop"'), 'Deve esistere #drawer-backdrop per overlay scuro');
    assert.ok(html.includes('id="drawer-panel"'), 'Deve esistere #drawer-panel');

    // Schede Drawer
    assert.ok(html.includes('id="tab-btn-promemoria"'), 'Manca bottone scheda promemoria');
    assert.ok(html.includes('id="tab-btn-rubrica"'), 'Manca bottone scheda rubrica');
    assert.ok(html.includes('id="tab-btn-storico"'), 'Manca bottone scheda storico');
    assert.ok(html.includes('id="tab-btn-backup"'), 'Manca bottone scheda backup');

    // Sezione 1: Promemoria
    assert.ok(html.includes('id="toggle-reminder-enabled"'), 'Manca #toggle-reminder-enabled');
    assert.ok(html.includes('id="reminder-time-1"'), 'Manca #reminder-time-1');
    assert.ok(html.includes('value="11:55"'), 'Orario 1 deve essere preimpostato su 11:55');
    assert.ok(html.includes('id="reminder-time-2"'), 'Manca #reminder-time-2');
    assert.ok(html.includes('value="16:55"'), 'Orario 2 deve essere preimpostato su 16:55');
    assert.ok(html.includes('id="reminder-days-grid"'), 'Manca #reminder-days-grid');
    assert.ok(html.includes('id="btn-test-notification"'), 'Manca #btn-test-notification');

    // Sezione 2: Rubrica
    assert.ok(html.includes('id="rubrica-sub-cantieri"'), 'Manca pill cantieri');
    assert.ok(html.includes('id="rubrica-sub-operai"'), 'Manca pill operai');
    assert.ok(html.includes('id="rubrica-sub-subappalti"'), 'Manca pill subappalti');
    assert.ok(html.includes('id="rubrica-sub-noleggi"'), 'Manca pill noleggi');
    assert.ok(html.includes('id="rubrica-list-container"'), 'Manca #rubrica-list-container');
    assert.ok(html.includes('id="rubrica-add-box"'), 'Manca #rubrica-add-box');

    // Sezione 3: Storico
    assert.ok(html.includes('id="history-list-container"'), 'Manca #history-list-container');

    // Sezione 4: Backup
    assert.ok(html.includes('id="btn-export-backup"'), 'Manca #btn-export-backup');
    assert.ok(html.includes('id="btn-import-backup"'), 'Manca #btn-import-backup');
    assert.ok(html.includes('id="input-backup-file"'), 'Manca #input-backup-file');

    // Inclusione Script
    assert.ok(html.includes('src="js/notifications.js"'), 'index.html deve includere notifications.js');
    assert.ok(html.includes('src="js/drawer.js"'), 'index.html deve includere drawer.js');
  });

  // ---------------------------------------------------------------------------
  // 13. VERIFICA CSS DEL DRAWER E DESIGN SYSTEM MOBILE
  // ---------------------------------------------------------------------------
  await it('Verifica css/app.css: transizioni drawer, body lock e controlli touch', () => {
    const cssPath = path.join(__dirname, 'css', 'app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('body.drawer-open'), 'Deve contenere la classe body.drawer-open per il blocco dello scrolling');
    assert.ok(css.includes('.drawer-backdrop'), 'Deve definire .drawer-backdrop');
    assert.ok(css.includes('.drawer-panel'), 'Deve definire .drawer-panel');
    assert.ok(css.includes('transform: translateX(-100%)'), 'Il drawer a riposo deve essere posizionato a sinistra (-100%)');
    assert.ok(css.includes('transform: translateX(0)'), 'Il drawer aperto deve traslare a 0');
    assert.ok(css.includes('.switch'), 'Deve definire il toggle switch iOS-style');
    assert.ok(css.includes('.day-chip'), 'Deve definire i chip per i giorni lavorativi');
    assert.ok(css.includes('.rubrica-card'), 'Deve definire la card per la rubrica');
    assert.ok(css.includes('.history-card'), 'Deve definire la card per lo storico');
  });

  console.log('\n=================================================================');
  console.log(`  RISULTATO: ${passedTests} / ${totalTests} test superati con successo!`);
  console.log('=================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
