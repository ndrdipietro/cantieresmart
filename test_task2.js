/**
 * CantiereSmart - Test Suite Task 2: Store, Rubrica & Autocompletamento
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 */

const assert = require('assert');
const path = require('path');

console.log('=================================================================');
console.log('  TEST SUITE TASK 2: STORE, RUBRICA & AUTOCOMPLETAMENTO');
console.log('=================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
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
const Autocomplete = require('./js/autocomplete.js');

it('I moduli store.js e autocomplete.js sono esportati correttamente', () => {
  assert.strictEqual(typeof CantiereStore, 'object', 'CantiereStore deve essere un oggetto');
  assert.strictEqual(typeof Autocomplete, 'function', 'Autocomplete deve essere una classe/funzione');
});

// ---------------------------------------------------------------------------
// 2. DATI DI DEFAULT VITTORINI
// ---------------------------------------------------------------------------
CantiereStore.resetToDefaults({ keepRapportini: false });

it('Cantieri precaricati rispettano i requisiti Vittorini (minimo 3 cantieri specifici)', () => {
  const cantieri = CantiereStore.getCantieri();
  assert.ok(Array.isArray(cantieri), 'I cantieri devono essere un array');
  assert.ok(cantieri.length >= 3, `Attesi almeno 3 cantieri, trovati: ${cantieri.length}`);

  const madonna = cantieri.find(c => c.nome.includes('Santuario Madonna delle Grazie'));
  assert.ok(madonna, 'Manca cantiere "Santuario Madonna delle Grazie"');
  assert.strictEqual(madonna.localita, 'Loc. Varoni, Amatrice (RI)');
  assert.strictEqual(madonna.commessa, 'Sisma 2016');

  const scuola = cantieri.find(c => c.nome.includes('Scuola Elementare Amatrice'));
  assert.ok(scuola, 'Manca cantiere "Scuola Elementare Amatrice"');
  assert.strictEqual(scuola.commessa, 'Ricostruzione Pubblica');

  const palazzo = cantieri.find(c => c.nome.includes('Palazzo Storico Centro'));
  assert.ok(palazzo, 'Manca cantiere "Palazzo Storico Centro"');
  assert.strictEqual(palazzo.commessa, 'Restauro Conservativo');
});

it('Operai Vittorini precaricati contengono gli 8 nominativi realistici richiesti', () => {
  const operai = CantiereStore.getOperai();
  assert.ok(operai.length >= 8, `Attesi almeno 8 operai, trovati: ${operai.length}`);

  const expectedNames = [
    'Marco Rossi',
    'Giuseppe Esposito',
    'Antonio Russo',
    'Giovanni Bianchi',
    'Francesco Romano',
    'Roberto Ferrari',
    'Alessandro Moretti',
    'Davide Conti'
  ];

  for (const name of expectedNames) {
    const found = operai.find(op => op.nome === name);
    assert.ok(found, `Manca operaio obbligatorio: "${name}"`);
    assert.ok(found.id, `L'operaio "${name}" deve avere un id`);
  }
});

it('Subappaltatori abituali precaricati contengono le 4 ditte richieste', () => {
  const subs = CantiereStore.getSubappalti();
  assert.ok(subs.length >= 4, `Attesi almeno 4 subappalti, trovati: ${subs.length}`);

  const expectedSubs = [
    'IPPOLITI PONTEGGI',
    'EDILIZIA 2000 SRL',
    'IMPIANTI ELETTRICI G.M.',
    'TERMOIDRAULICA ABRUZZESE'
  ];

  for (const subName of expectedSubs) {
    const found = subs.find(s => s.nome === subName);
    assert.ok(found, `Manca subappaltatore obbligatorio: "${subName}"`);
  }
});

it('Noleggi/Mezzi frequenti precaricati contengono i 4 mezzi richiesti', () => {
  const noleggi = CantiereStore.getNoleggi();
  assert.ok(noleggi.length >= 4, `Attesi almeno 4 noleggi, trovati: ${noleggi.length}`);

  const expectedNol = [
    'Escavatore 50q',
    'Piattaforma aerea 18m',
    'Gru a torre',
    'Dumper 25q'
  ];

  for (const nolName of expectedNol) {
    const found = noleggi.find(n => n.nome === nolName);
    assert.ok(found, `Manca noleggio/mezzo obbligatorio: "${nolName}"`);
  }
});

it('Impostazioni promemoria rispettano rigorosamente orari e vincoli (11:55, 16:55, Lun-Ven)', () => {
  const settings = CantiereStore.getSettings();
  assert.strictEqual(settings.reminderEnabled, true, 'reminderEnabled deve essere true di default');
  assert.strictEqual(settings.time1, '11:55', 'time1 deve essere "11:55"');
  assert.strictEqual(settings.time2, '16:55', 'time2 deve essere "16:55"');
  assert.deepStrictEqual(settings.days, [1, 2, 3, 4, 5], 'days deve essere [1, 2, 3, 4, 5]');
});

// ---------------------------------------------------------------------------
// 3. OPERAZIONI CRUD SULLE RUBRICHE
// ---------------------------------------------------------------------------
it('CRUD Cantieri: inserimento, aggiornamento, recupero e cancellazione', () => {
  // Inserimento con oggetto
  const saved1 = CantiereStore.saveCantiere({
    nome: 'Nuovo Ospedale dei Monti',
    localita: 'Rieti (RI)',
    commessa: 'Sanità Pubblica'
  });
  assert.ok(saved1.id, 'Il cantiere deve ricevere un ID');
  assert.strictEqual(saved1.nome, 'Nuovo Ospedale dei Monti');

  // Recupero per ID
  const retrieved = CantiereStore.getCantiere(saved1.id);
  assert.strictEqual(retrieved.nome, 'Nuovo Ospedale dei Monti');

  // Prevenzione duplicati e aggiornamento
  const updated = CantiereStore.saveCantiere({
    nome: 'Nuovo Ospedale dei Monti',
    localita: 'Rieti Centro (RI)',
    commessa: 'Sanità Pubblica Lotto 2'
  });
  assert.strictEqual(updated.id, saved1.id, 'Non deve creare un duplicato se il nome coincide');
  assert.strictEqual(updated.localita, 'Rieti Centro (RI)');

  // Cancellazione
  const deleted = CantiereStore.deleteCantiere(saved1.id);
  assert.strictEqual(deleted, true);
  assert.strictEqual(CantiereStore.getCantiere(saved1.id), null);
});

it('CRUD Operai: inserimento tramite stringa/oggetto, duplicati e cancellazione', () => {
  const op = CantiereStore.saveOperaio('Luca Santoro');
  assert.ok(op.id, 'Operaio deve avere id');
  assert.strictEqual(op.nome, 'Luca Santoro');

  // Test case-insensitive duplicato
  const dup = CantiereStore.saveOperaio('luca santoro');
  assert.strictEqual(dup.id, op.id, 'Non deve duplicare operaio');

  const deleted = CantiereStore.deleteOperaio(op.id);
  assert.strictEqual(deleted, true);
  assert.ok(!CantiereStore.getOperai().some(o => o.id === op.id));
});

it('CRUD Subappalti e Noleggi', () => {
  const sub = CantiereStore.saveSubappalto('SCAVI E DEMOLIZIONI LAZIO SRL');
  assert.ok(sub.id);
  assert.strictEqual(sub.nome, 'SCAVI E DEMOLIZIONI LAZIO SRL');
  assert.strictEqual(CantiereStore.deleteSubappalto(sub.id), true);

  const nol = CantiereStore.saveNoleggio('Generatore 100kVA');
  assert.ok(nol.id);
  assert.strictEqual(nol.nome, 'Generatore 100kVA');
  assert.strictEqual(CantiereStore.deleteNoleggio(nol.id), true);
});

it('Gestione Settings: salvataggio parziale e validazione', () => {
  const updated = CantiereStore.saveSettings({
    time1: '12:00',
    reminderEnabled: false
  });
  assert.strictEqual(updated.time1, '12:00');
  assert.strictEqual(updated.time2, '16:55', 'time2 deve rimanere inalterato');
  assert.strictEqual(updated.reminderEnabled, false);

  // Ripristino
  CantiereStore.saveSettings({
    time1: '11:55',
    reminderEnabled: true
  });
  const res = CantiereStore.getSettings();
  assert.strictEqual(res.time1, '11:55');
  assert.strictEqual(res.reminderEnabled, true);
});

// ---------------------------------------------------------------------------
// 4. RAPPORTINI GIORNALIERI & AUTO-APPRENDIMENTO RUBRICHE
// ---------------------------------------------------------------------------
it('Salvataggio Rapportino e Auto-apprendimento di Cantieri, Operai, Subappalti e Mezzi', () => {
  const initialCantieriCount = CantiereStore.getCantieri().length;
  const initialOperaiCount = CantiereStore.getOperai().length;

  const rapData = {
    data: '2026-10-19',
    cantiere: {
      nome: 'Complesso Residenziale Colleatterrato',
      localita: 'Teramo (TE)',
      commessa: 'Superbonus 110'
    },
    meteo: 'sereno',
    temperatura: 18,
    operai: [
      'Marco Rossi',
      'Valerio De Angelis' // Nuovo! Deve essere auto-appreso
    ],
    subappaltatori: [
      'COSTRUZIONI GENERALI ABRUZZO' // Nuovo! Deve essere auto-appreso
    ],
    noleggi: [
      'Miniescavatore Yanmar 18q' // Nuovo! Deve essere auto-appreso
    ],
    lavorazioni: 'Posa massetto alleggerito e tracciamento partizioni interne.',
    note: 'Nessun intoppo segnalato.'
  };

  const savedRap = CantiereStore.saveRapportino(rapData);
  assert.ok(savedRap.id, 'Il rapportino deve avere un ID generato');
  assert.ok(savedRap.createdAt, 'Il rapportino deve avere createdAt');
  assert.ok(savedRap.updatedAt, 'Il rapportino deve avere updatedAt');

  // Verifica persistenza rapportino
  const listRap = CantiereStore.getRapportini();
  assert.ok(listRap.some(r => r.id === savedRap.id), 'Il rapportino deve comparire nell\'elenco');

  // Verifica Auto-apprendimento Cantiere
  const newCantiere = CantiereStore.getCantiere('Complesso Residenziale Colleatterrato');
  assert.ok(newCantiere, 'Il cantiere deve essere stato auto-appreso nello store');
  assert.strictEqual(newCantiere.localita, 'Teramo (TE)');

  // Verifica Auto-apprendimento Operaio
  const newOp = CantiereStore.getOperai().find(o => o.nome === 'Valerio De Angelis');
  assert.ok(newOp, 'Il nuovo operaio deve essere stato auto-appreso nella rubrica');

  // Verifica Auto-apprendimento Subappalto
  const newSub = CantiereStore.getSubappalti().find(s => s.nome === 'COSTRUZIONI GENERALI ABRUZZO');
  assert.ok(newSub, 'Il nuovo subappalto deve essere stato auto-appreso nella rubrica');

  // Verifica Auto-apprendimento Noleggio
  const newNol = CantiereStore.getNoleggi().find(n => n.nome === 'Miniescavatore Yanmar 18q');
  assert.ok(newNol, 'Il nuovo mezzo a noleggio deve essere stato auto-appreso nella rubrica');

  // Cancellazione rapportino
  assert.strictEqual(CantiereStore.deleteRapportino(savedRap.id), true);
  assert.strictEqual(CantiereStore.getRapportino(savedRap.id), null);
});

// ---------------------------------------------------------------------------
// 5. EXPORT & IMPORT (BACKUP & RESTORE JSON)
// ---------------------------------------------------------------------------
it('Esportazione completa dei dati e importazione corretta (Backup/Restore)', () => {
  const exportPayload = CantiereStore.exportAllData();
  assert.strictEqual(exportPayload.appName, 'CantiereSmart');
  assert.strictEqual(exportPayload.company, 'Vittorini Emidio Costruzioni S.r.l.');
  assert.ok(Array.isArray(exportPayload.cantieri));
  assert.ok(Array.isArray(exportPayload.operai));
  assert.ok(exportPayload.settings);

  // Modifichiamo lo store
  CantiereStore.saveOperaio('Operaio Temporaneo Test');
  assert.ok(CantiereStore.getOperai().some(o => o.nome === 'Operaio Temporaneo Test'));

  // Re-importiamo il backup precedente
  const result = CantiereStore.importAllData(exportPayload);
  assert.strictEqual(result.success, true);
  assert.ok(result.countCantieri >= 3);
  assert.ok(!CantiereStore.getOperai().some(o => o.nome === 'Operaio Temporaneo Test'));
});

// ---------------------------------------------------------------------------
// 6. AUTOCOMPLETE: FILTRAGGIO, TOUCH TARGET & AUTO-ADD "+ AGGIUNGI"
// ---------------------------------------------------------------------------
it('Autocomplete.filterItems filtra correttamente per sottostringa case-insensitive', () => {
  const cantieri = CantiereStore.getCantieri();

  const results1 = Autocomplete.filterItems(cantieri, 'amatrice');
  assert.ok(results1.length >= 2, 'Dovrebbe trovare i cantieri di Amatrice');

  const results2 = Autocomplete.filterItems(cantieri, 'Palazzo');
  assert.ok(results2.length >= 1);
  assert.ok(results2.some(c => c.nome === 'Palazzo Storico Centro'));

  const resultsEmpty = Autocomplete.filterItems(cantieri, 'NonEsistoProprio');
  assert.strictEqual(resultsEmpty.length, 0);
});

it('Autocomplete.hasExactMatch rileva correttamente se un termine esiste o meno', () => {
  const operai = CantiereStore.getOperai();

  assert.strictEqual(Autocomplete.hasExactMatch(operai, 'marco rossi'), true);
  assert.strictEqual(Autocomplete.hasExactMatch(operai, 'MARCO ROSSI '), true);
  assert.strictEqual(Autocomplete.hasExactMatch(operai, 'Marco R'), false);
  assert.strictEqual(Autocomplete.hasExactMatch(operai, 'Nuovo Operaio Fantasma'), false);
});

it('Autocomplete.highlight genera markup ad alto contrasto per le corrispondenze', () => {
  const highlighted = Autocomplete.highlight('Santuario Madonna', 'madonna');
  assert.ok(highlighted.includes('<strong class="autocomplete-match">Madonna</strong>'));
});

it('Simulazione Autocomplete UI: tap touch target >= 48px e azione "+ Aggiungi"', () => {
  // Simuliamo un ambiente DOM minimale
  const mockInput = {
    value: 'Nuovo Cantiere Faraone',
    parentElement: null,
    parentNode: null,
    setAttribute: () => {},
    addEventListener: () => {},
    dispatchEvent: () => {}
  };

  const containerMock = {
    className: '',
    appendChild: () => {},
    classList: { contains: () => false }
  };
  const parentMock = {
    insertBefore: () => {}
  };
  mockInput.parentNode = parentMock;

  let addedQuery = null;
  let selectedItem = null;

  const auto = new Autocomplete(mockInput, {
    getItems: () => CantiereStore.getCantieri(),
    onAddNew: (query) => {
      addedQuery = query;
      return CantiereStore.saveCantiere({ nome: query, localita: 'Amatrice Est' });
    },
    onSelect: (item) => {
      selectedItem = item;
    },
    minChars: 1
  });

  // Verifichiamo il filtraggio interno con query non esistente
  const filtered = auto.filter('Nuovo Cantiere Faraone');
  assert.strictEqual(filtered.length, 0, 'Nessun cantiere corrisponde');
  assert.strictEqual(auto.hasExactMatch, false, 'Non deve esserci match esatto');

  // Eseguiamo l'azione di aggiunta rapida
  auto.executeAddNew('Nuovo Cantiere Faraone');

  assert.strictEqual(addedQuery, 'Nuovo Cantiere Faraone');
  assert.ok(selectedItem, 'onSelect deve essere stato invocato');
  assert.strictEqual(selectedItem.nome, 'Nuovo Cantiere Faraone');
  assert.strictEqual(mockInput.value, 'Nuovo Cantiere Faraone');

  // Verifichiamo che il cantiere sia ora presente nello Store
  const foundInStore = CantiereStore.getCantiere('Nuovo Cantiere Faraone');
  assert.ok(foundInStore, 'Il nuovo cantiere deve trovarsi nello store!');

  // Pulizia
  CantiereStore.deleteCantiere(foundInStore.id);
});

// ---------------------------------------------------------------------------
// 7. VERIFICA DESIGN SYSTEM & TOUCH TARGET NEL CSS
// ---------------------------------------------------------------------------
it('Il file css/app.css definisce le classi touch target per Autocomplete con min-height >= 48px', () => {
  const fs = require('fs');
  const cssPath = path.join(__dirname, 'css', 'app.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(cssContent.includes('.autocomplete-dropdown'), 'Deve contenere .autocomplete-dropdown');
  assert.ok(cssContent.includes('.autocomplete-item'), 'Deve contenere .autocomplete-item');
  assert.ok(cssContent.includes('.autocomplete-add-action'), 'Deve contenere .autocomplete-add-action');
  assert.ok(cssContent.includes('min-height: 48px'), 'Deve imporre min-height: 48px per touch targets cantiere');
});

console.log('\n=================================================================');
console.log(`  RISULTATO: ${passedTests} / ${totalTests} test superati con successo!`);
console.log('=================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
