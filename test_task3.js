/**
 * CantiereSmart - Test Suite Task 3: I 9 Box a Spunta Verde & Gestione Foto
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 */

const assert = require('assert');
const path = require('path');

console.log('=================================================================');
console.log('  TEST SUITE TASK 3: I 9 BOX A SPUNTA VERDE & GESTIONE FOTO');
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

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
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
const { RapportinoState, PhotoCompressor, sanitizeFileName, formatDateItalian } = require('./js/app.js');

it('I moduli app.js e store.js sono esportati correttamente', () => {
  assert.strictEqual(typeof RapportinoState, 'function', 'RapportinoState deve essere una classe/funzione');
  assert.strictEqual(typeof PhotoCompressor, 'object', 'PhotoCompressor deve essere un oggetto');
  assert.strictEqual(typeof sanitizeFileName, 'function', 'sanitizeFileName deve essere una funzione');
  assert.strictEqual(typeof formatDateItalian, 'function', 'formatDateItalian deve essere una funzione');
});

// ---------------------------------------------------------------------------
// 2. STATO INIZIALE & DEFAULT
// ---------------------------------------------------------------------------
it('RapportinoState inizializza i valori predefiniti corretti (Data odierna, 22°C, 0 completati)', () => {
  const state = new RapportinoState();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(state.data), 'La data deve essere in formato YYYY-MM-DD');
  assert.strictEqual(state.temperatura, 22, 'La temperatura predefinita deve essere 22 °C');
  assert.strictEqual(state.cantiere, '');
  assert.strictEqual(state.meteo, '');
  assert.strictEqual(state.getCompletedCount(), 0, 'Inizialmente 0 box devono essere completati');
  assert.strictEqual(state.isAllComplete(), false);
});

// ---------------------------------------------------------------------------
// 3. BOX 1: DATA & CANTIERE
// ---------------------------------------------------------------------------
it('Box 1 (Data & Cantiere): diventa verde solo quando sia Data che Cantiere sono valorizzati', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox1Complete(), false);

  state.setCantiere('Santuario Madonna delle Grazie', 'Loc. Varoni, Amatrice', 'Sisma 2016');
  assert.strictEqual(state.isBox1Complete(), true, 'Con data odierna e cantiere valorizzato deve essere completo');
  assert.strictEqual(state.localita, 'Loc. Varoni, Amatrice');
  assert.strictEqual(state.commessa, 'Sisma 2016');

  state.setDate('');
  assert.strictEqual(state.isBox1Complete(), false, 'Senza data non deve essere completo');

  state.setDate('2026-10-19');
  state.setCantiere('   ');
  assert.strictEqual(state.isBox1Complete(), false, 'Con cantiere di soli spazi non deve essere completo');
});

// ---------------------------------------------------------------------------
// 4. BOX 2: METEO & TEMPERATURA
// ---------------------------------------------------------------------------
it('Box 2 (Meteo & Temperatura): diventa verde con una condizione meteo e gestisce lo stepper', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox2Complete(), false);

  state.setMeteo('sereno');
  assert.strictEqual(state.isBox2Complete(), true);
  assert.strictEqual(state.meteo, 'sereno');

  // Toggle meteo
  state.setMeteo('nuvoloso');
  assert.strictEqual(state.meteo, 'nuvoloso');

  // Stepper temperatura
  state.adjustTemperatura(3);
  assert.strictEqual(state.temperatura, 25);
  state.adjustTemperatura(-5);
  assert.strictEqual(state.temperatura, 20);

  // Boundary check
  state.setTemperatura(100);
  assert.strictEqual(state.temperatura, 55, 'Max consentito 55°C');
  state.setTemperatura(-50);
  assert.strictEqual(state.temperatura, -25, 'Min consentito -25°C');
});

// ---------------------------------------------------------------------------
// 5. BOX 3: LAVORAZIONI ESEGUITE & RAPIDO N.A.
// ---------------------------------------------------------------------------
it('Box 3 (Lavorazioni Eseguite): verde con descrizione o con toggle rapido "Nessuna attività"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox3Complete(), false);

  state.setLavorazioni('Scavo di sbancamento e posa ferro per platea di fondazione');
  assert.strictEqual(state.isBox3Complete(), true);
  assert.strictEqual(state.naLavorazioni, false);

  // Reset e toggle NA
  state.setLavorazioni('');
  assert.strictEqual(state.isBox3Complete(), false);

  state.toggleNaLavorazioni();
  assert.strictEqual(state.naLavorazioni, true);
  assert.strictEqual(state.isBox3Complete(), true, 'Deve diventare verde con Nessuna attività attiva');

  // Se l\'utente torna a digitare, disattiva NA
  state.setLavorazioni('Arrivo betoniera');
  assert.strictEqual(state.naLavorazioni, false);
  assert.strictEqual(state.isBox3Complete(), true);
});

// ---------------------------------------------------------------------------
// 6. BOX 4: PERSONALE VITTORINI & 0 OPERAI
// ---------------------------------------------------------------------------
it('Box 4 (Personale Vittorini): conteggio dinamico, chip toggle e tasto "0 Operai"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox4Complete(), false);
  assert.strictEqual(state.getTotals().totaleVittorini, 0);

  // Selezione chip operai
  state.toggleOperaio('Marco Rossi');
  state.toggleOperaio('Giuseppe Esposito');
  assert.strictEqual(state.isBox4Complete(), true);
  assert.strictEqual(state.getTotals().totaleVittorini, 2);

  // Deselezione chip
  state.toggleOperaio('Marco Rossi');
  assert.strictEqual(state.getTotals().totaleVittorini, 1);
  state.toggleOperaio('Giuseppe Esposito');
  assert.strictEqual(state.isBox4Complete(), false);
  assert.strictEqual(state.getTotals().totaleVittorini, 0);

  // Tasto rapido "0 Operai Vittorini"
  state.toggleZeroOperai();
  assert.strictEqual(state.zeroOperai, true);
  assert.strictEqual(state.isBox4Complete(), true, 'Verde anche con 0 operai Vittorini se confermato');
  assert.strictEqual(state.getTotals().totaleVittorini, 0);

  // Se si aggiunge un operaio, si disattiva "0 Operai"
  state.addOperaio('Antonio Russo');
  assert.strictEqual(state.zeroOperai, false);
  assert.strictEqual(state.getTotals().totaleVittorini, 1);
});

// ---------------------------------------------------------------------------
// 7. BOX 5: SUBAPPALTATORI & NESSUN SUBAPPALTO
// ---------------------------------------------------------------------------
it('Box 5 (Subappaltatori): lista righe dinamiche, somma automatica operai e tasto "Nessuno"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox5Complete(), false);

  state.addSubappaltatore({ ditta: 'IPPOLITI PONTEGGI', operai: 3, lavorazione: 'Montaggio ponteggio nord' });
  state.addSubappaltatore({ ditta: 'EDILIZIA 2000 SRL', operai: 2, lavorazione: 'Tramezzature interne' });

  assert.strictEqual(state.isBox5Complete(), true);
  assert.strictEqual(state.subappaltatori.length, 2);
  assert.strictEqual(state.getTotals().totaleSubappaltatori, 5, '3 + 2 = 5 operai subappalto');

  // Rimozione riga
  state.removeSubappaltatore(0);
  assert.strictEqual(state.subappaltatori.length, 1);
  assert.strictEqual(state.getTotals().totaleSubappaltatori, 2);

  state.removeSubappaltatore(0);
  assert.strictEqual(state.isBox5Complete(), false);

  // Tasto "Nessun subappaltatore"
  state.toggleNessunSubappalto();
  assert.strictEqual(state.nessunSubappalto, true);
  assert.strictEqual(state.isBox5Complete(), true);
  assert.strictEqual(state.getTotals().totaleSubappaltatori, 0);
});

// ---------------------------------------------------------------------------
// 8. BOX 6: NOLEGGI & MEZZI
// ---------------------------------------------------------------------------
it('Box 6 (Noleggi): selezione mezzi, inserimento personalizzato e tasto "Nessun noleggio"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox6Complete(), false);

  state.toggleNoleggio('Escavatore 50q');
  assert.strictEqual(state.isBox6Complete(), true);
  assert.strictEqual(state.noleggi.length, 1);

  state.addNoleggio('Piattaforma aerea 18m');
  assert.strictEqual(state.noleggi.length, 2);

  state.removeNoleggio('Escavatore 50q');
  assert.strictEqual(state.noleggi.length, 1);
  state.removeNoleggio('Piattaforma aerea 18m');
  assert.strictEqual(state.isBox6Complete(), false);

  state.toggleNessunNoleggio();
  assert.strictEqual(state.nessunNoleggio, true);
  assert.strictEqual(state.isBox6Complete(), true);
});

// ---------------------------------------------------------------------------
// 9. BOX 7: FORNITURE & MATERIALI
// ---------------------------------------------------------------------------
it('Box 7 (Materiali): testo forniture o tasto rapido "Nessun materiale oggi"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox7Complete(), false);

  state.setMateriali('Calcestruzzo Rck 30 m³ 15, Rete elettrosaldata fogli 10');
  assert.strictEqual(state.isBox7Complete(), true);

  state.setMateriali('');
  assert.strictEqual(state.isBox7Complete(), false);

  state.toggleNessunMateriale();
  assert.strictEqual(state.nessunMateriale, true);
  assert.strictEqual(state.isBox7Complete(), true);
});

// ---------------------------------------------------------------------------
// 10. BOX 8: NOTE GENERALI & D.L.
// ---------------------------------------------------------------------------
it('Box 8 (Note Generali): note, visite D.L., sicurezza o tasto rapido "Nessuna nota"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox8Complete(), false);

  state.setNote('Visita D.L. Ing. Rossi ore 11:30. Nulla osta al getto fondazione.');
  assert.strictEqual(state.isBox8Complete(), true);

  state.setNote('');
  assert.strictEqual(state.isBox8Complete(), false);

  state.toggleNessunaNota();
  assert.strictEqual(state.nessunaNota, true);
  assert.strictEqual(state.isBox8Complete(), true);
});

// ---------------------------------------------------------------------------
// 11. BOX 9: FOTO DI CANTIERE (0..8) & COMPRESSIONE
// ---------------------------------------------------------------------------
it('Box 9 (Foto di Cantiere): supporta da 0 a 8 foto con limite massimo tassativo e tasto "Nessuna foto"', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.isBox9Complete(), false);

  // Inserimento fino al limite di 8 foto
  for (let i = 1; i <= 8; i++) {
    const res = state.addPhoto({
      id: 'foto_' + i,
      name: `cantiere_${i}.jpg`,
      dataUrl: 'data:image/jpeg;base64,sample' + i
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.count, i);
  }

  assert.strictEqual(state.foto.length, 8);
  assert.strictEqual(state.isBox9Complete(), true);

  // Tentativo di 9ª foto: deve fallire con MAX_LIMIT_REACHED
  const overLimit = state.addPhoto({
    id: 'foto_9',
    name: 'cantiere_9.jpg',
    dataUrl: 'data:image/jpeg;base64,sample9'
  });
  assert.strictEqual(overLimit.success, false);
  assert.strictEqual(overLimit.reason, 'MAX_LIMIT_REACHED');
  assert.strictEqual(state.foto.length, 8, 'Non deve mai superare le 8 foto');

  // Rimozione foto
  state.removePhoto(0);
  assert.strictEqual(state.foto.length, 7);

  // Svuotamento e toggle "Nessuna foto"
  state.foto = [];
  assert.strictEqual(state.isBox9Complete(), false);

  state.toggleNessunaFoto();
  assert.strictEqual(state.nessunaFoto, true);
  assert.strictEqual(state.isBox9Complete(), true, 'Verde con Nessuna foto oggi');
});

it('PhotoCompressor: ridimensiona proporzionalmente garantendo maxDimension <= 1280px', () => {
  const dimsLandscape = PhotoCompressor._calculateDimensions(4000, 3000, 1280);
  assert.strictEqual(dimsLandscape.width, 1280);
  assert.strictEqual(dimsLandscape.height, 960);

  const dimsPortrait = PhotoCompressor._calculateDimensions(3000, 4000, 1280);
  assert.strictEqual(dimsPortrait.width, 960);
  assert.strictEqual(dimsPortrait.height, 1280);

  const dimsSmall = PhotoCompressor._calculateDimensions(800, 600, 1280);
  assert.strictEqual(dimsSmall.width, 800);
  assert.strictEqual(dimsSmall.height, 600);
});

// ---------------------------------------------------------------------------
// 12. PROGRESSO COMPLESSIVO 0/9 -> 9/9 & NOMENCLATURA FILE
// ---------------------------------------------------------------------------
it('Reattività progresso: passa fluidamente da 0/9 a 9/9 con spunte verdi complete', () => {
  const state = new RapportinoState();
  assert.strictEqual(state.getCompletedCount(), 0);

  // 1. Cantiere
  state.setDate('2026-10-19');
  state.setCantiere('Santuario Madonna delle Grazie', 'Loc. Varoni, Amatrice', 'Sisma 2016');
  assert.strictEqual(state.getCompletedCount(), 1);

  // 2. Meteo
  state.setMeteo('sereno');
  assert.strictEqual(state.getCompletedCount(), 2);

  // 3. Lavorazioni
  state.setLavorazioni('Getto pilastri');
  assert.strictEqual(state.getCompletedCount(), 3);

  // 4. Operai
  state.addOperaio('Marco Rossi');
  assert.strictEqual(state.getCompletedCount(), 4);

  // 5. Subappalti
  state.addSubappaltatore({ ditta: 'IPPOLITI PONTEGGI', operai: 2 });
  assert.strictEqual(state.getCompletedCount(), 5);

  // 6. Noleggi
  state.addNoleggio('Escavatore 50q');
  assert.strictEqual(state.getCompletedCount(), 6);

  // 7. Materiali
  state.setMateriali('Calcestruzzo m³ 12');
  assert.strictEqual(state.getCompletedCount(), 7);

  // 8. Note
  state.setNote('Nessun intoppo, verifiche OK');
  assert.strictEqual(state.getCompletedCount(), 8);

  // 9. Foto
  state.addPhoto({ id: 'p1', dataUrl: 'data:image/jpeg;base64,abc' });
  assert.strictEqual(state.getCompletedCount(), 9);
  assert.strictEqual(state.isAllComplete(), true, 'Tutti i 9 box sono completati');

  // Nomenclatura File Dinamico
  const pdfName = state.getPreviewFileName('pdf');
  assert.strictEqual(pdfName, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');

  const docxName = state.getPreviewFileName('docx');
  assert.strictEqual(docxName, '2026-10-19_Santuario_Madonna_delle_Grazie.docx');
});

it('Reattività rapida con tutti i tasti "Nessuno/N.A.": raggiunge comunque 9/9', () => {
  const state = new RapportinoState();
  state.setDate('2026-10-19');
  state.setCantiere('Scuola Elementare Amatrice');
  state.setMeteo('pioggia');
  state.toggleNaLavorazioni();
  state.toggleZeroOperai();
  state.toggleNessunSubappalto();
  state.toggleNessunNoleggio();
  state.toggleNessunMateriale();
  state.toggleNessunaNota();
  state.toggleNessunaFoto();

  assert.strictEqual(state.getCompletedCount(), 9);
  assert.strictEqual(state.isAllComplete(), true);
});

// ---------------------------------------------------------------------------
// 13. SERIALIZZAZIONE E SALVATAGGIO IN CantiereStore
// ---------------------------------------------------------------------------
it('Serializzazione toReportData() e integrazione perfetta con CantiereStore.saveRapportino()', () => {
  const state = new RapportinoState();
  state.setDate('2026-10-19');
  state.setCantiere('Nuovo Cantiere Pescara', 'Pescara Porto', 'Appalto 2026');
  state.setMeteo('nuvoloso');
  state.setLavorazioni('Posa guaina impermeabilizzante');
  state.addOperaio('Nuovo Operaio Mario');
  state.addSubappaltatore({ ditta: 'NUOVA DITTA IMPIANTI', operai: 4, lavorazione: 'Canaline elettriche' });
  state.addNoleggio('Nuovo Mezzo Gru');
  state.setMateriali('Rotoli guaina 50pz');
  state.setNote('Ispezione sicurezza superata');
  state.addPhoto({ id: 'f1', dataUrl: 'data:image/jpeg;base64,test' });

  const reportPayload = state.toReportData();
  assert.strictEqual(reportPayload.completedCount, 9);
  assert.strictEqual(reportPayload.isComplete, true);
  assert.strictEqual(reportPayload.totaleOperaiVittorini, 1);
  assert.strictEqual(reportPayload.totaleOperaiSubappalti, 4);
  assert.strictEqual(reportPayload.totaleComplessivoPersonale, 5);

  // Salvataggio nello store con auto-apprendimento
  const saved = CantiereStore.saveRapportino(reportPayload);
  assert.ok(saved.id, 'Il rapportino salvato deve avere un ID generato');

  // Verifica auto-apprendimento cantiere, operaio, subappalto e noleggio
  const cantieri = CantiereStore.getCantieri();
  assert.ok(cantieri.some(c => c.nome === 'Nuovo Cantiere Pescara'), 'Cantiere auto-appreso');

  const operai = CantiereStore.getOperai();
  assert.ok(operai.some(op => op.nome === 'Nuovo Operaio Mario'), 'Operaio auto-appreso');

  const subs = CantiereStore.getSubappalti();
  assert.ok(subs.some(s => s.nome === 'NUOVA DITTA IMPIANTI'), 'Subappalto auto-appreso');

  const rentals = CantiereStore.getNoleggi();
  assert.ok(rentals.some(n => n.nome === 'Nuovo Mezzo Gru'), 'Noleggio auto-appreso');

  // Ripristino stato tramite loadFromReportData
  const restoredState = new RapportinoState();
  restoredState.loadFromReportData(saved);
  assert.strictEqual(restoredState.cantiere, 'Nuovo Cantiere Pescara');
  assert.strictEqual(restoredState.getCompletedCount(), 9);
  assert.strictEqual(restoredState.isAllComplete(), true);
});

// ---------------------------------------------------------------------------
// 14. FORMATTAZIONE DATA ITALIANA
// ---------------------------------------------------------------------------
it('formatDateItalian formatta correttamente la data per le viste italiane (DD/MM/YYYY)', () => {
  assert.strictEqual(formatDateItalian('2026-10-19'), '19/10/2026');
  assert.strictEqual(formatDateItalian('2026-01-05'), '05/01/2026');
  assert.strictEqual(formatDateItalian('invalida'), 'invalida');
});

// ---------------------------------------------------------------------------
// 15. VERIFICA INTEGRITÀ HTML (Tutti i 9 Box e ID presenti nel markup)
// ---------------------------------------------------------------------------
it('Verifica integrità HTML: tutti i 9 box, pulsanti rapidi e header badge esistono in index.html', () => {
  const fs = require('fs');
  const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  // I 9 box
  for (let b = 1; b <= 9; b++) {
    assert.ok(htmlContent.includes(`id="box-${b}"`), `Manca il contenitore id="box-${b}"`);
    assert.ok(htmlContent.includes(`id="box-${b}-badge"`), `Manca il badge id="box-${b}-badge"`);
  }

  // Header & Bottom Bar
  assert.ok(htmlContent.includes('id="header-progress-badge"'), 'Manca #header-progress-badge');
  assert.ok(htmlContent.includes('id="preview-filename"'), 'Manca #preview-filename');
  assert.ok(htmlContent.includes('id="btn-download-pdf"'), 'Manca #btn-download-pdf');
  assert.ok(htmlContent.includes('id="btn-download-docx"'), 'Manca #btn-download-docx');

  // Pulsanti Rapidi N.A.
  const quickButtons = [
    'btn-na-lavorazioni',
    'btn-zero-operai',
    'btn-nessun-sub',
    'btn-nessun-noleggio',
    'btn-nessun-materiale',
    'btn-nessuna-nota',
    'btn-nessuna-foto'
  ];

  for (const qb of quickButtons) {
    assert.ok(htmlContent.includes(`id="${qb}"`), `Manca il pulsante rapido id="${qb}"`);
  }

  // Input foto da smartphone con capture="environment"
  assert.ok(htmlContent.includes('capture="environment"'), 'L\'input file deve contenere capture="environment" per fotocamera mobile');
  assert.ok(htmlContent.includes('accept="image/*"'), 'L\'input file deve avere accept="image/*"');
});

// ---------------------------------------------------------------------------
// 16. VERIFICA CSS TOUCH TARGETS E STILE SPUNTA VERDE
// ---------------------------------------------------------------------------
it('Verifica CSS: touch target >= 48dp, 52px bottoni chiave e stile smeraldo .box-card.completed', () => {
  const fs = require('fs');
  const cssContent = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf-8');

  assert.ok(cssContent.includes('.box-card.completed'), 'Deve definire la classe .box-card.completed');
  assert.ok(cssContent.includes('--color-success'), 'Deve definire i token colore success (#10B981)');
  assert.ok(cssContent.includes('--touch-button-height: 52px;'), 'Altezza pulsanti chiave deve essere almeno 52px');
  assert.ok(cssContent.includes('--touch-target-min: 48px;'), 'Target touch minimo deve essere >= 48px');
  assert.ok(cssContent.includes('.chip-btn'), 'Deve definire lo stile per chip touch-friendly');
  assert.ok(cssContent.includes('.app-bottom-bar'), 'Deve definire la barra fissa inferiore');
});

// ---------------------------------------------------------------------------
// RIEPILOGO TEST
// ---------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`  RISULTATO: ${passedTests} / ${totalTests} test superati con successo!`);
console.log('=================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

