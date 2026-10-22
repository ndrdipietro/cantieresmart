/**
 * CantiereSmart - Test Suite Task 5: Motore di Generazione PDF (Fedele al Template Vittorini)
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Verifiche automatizzate:
 * 1. Moduli e dipendenze offline (jspdf.umd.min.js locale, template-assets.js)
 * 2. Naming rigoroso YYYY-MM-DD_NomeCantiere.pdf
 * 3. Formattazione data GG/MM/AAAA
 * 4. Generazione rapportino con 0 foto (1 pagina esatta)
 * 5. Generazione rapportino con 4 foto (1 pagina esatta)
 * 6. Generazione rapportino con 6 foto (2 pagine esatte)
 * 7. Generazione rapportino con 8 foto (2 pagine esatte)
 * 8. Verifica geometrica: bordi, testata, meteo, lavorazioni, personale, note, griglia foto, footer
 * 9. Integrazione app.js, index.html e Service Worker per funzionamento 100% offline
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=================================================================');
console.log('  TEST SUITE TASK 5: MOTORE DI GENERAZIONE PDF VITTORINI');
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
// 1. CARICAMENTO MODULI E DIPENDENZE OFFLINE
// ---------------------------------------------------------------------------
const templateAssets = require('./assets/template-assets.js');
const {
  generateCantierePDF,
  sanitizePdfFilename,
  formatDateForPdf,
  GEOMETRY
} = require('./js/pdf-generator.js');

async function runTests() {

  await it('1.1. Libreria jsPDF standalone esiste in cantieresmart/js/lib/jspdf.umd.min.js per uso 100% offline', () => {
    const jspdfPath = path.join(__dirname, 'js', 'lib', 'jspdf.umd.min.js');
    assert.ok(fs.existsSync(jspdfPath), 'Il file jspdf.umd.min.js deve esistere nella cartella js/lib');
    const stats = fs.statSync(jspdfPath);
    assert.ok(stats.size > 200000, `Dimensione file jsPDF (${stats.size} bytes) deve essere completa`);

    const localJsPdf = require('./js/lib/jspdf.umd.min.js');
    assert.ok(localJsPdf && (localJsPdf.jsPDF || typeof localJsPdf === 'function'), 'jsPDF deve essere istanziabile da bundle locale');
  });

  await it('1.2. Asset ufficiali estratti da Template.pdf sono tutti presenti in template-assets.js', () => {
    assert.ok(templateAssets, 'templateAssets deve essere esportato');
    assert.ok(templateAssets.logo, 'Logo Vittorini deve essere presente');
    assert.ok(templateAssets.sun, 'Icona sole/sereno deve essere presente');
    assert.ok(templateAssets.cloud, 'Icona nuvoloso deve essere presente');
    assert.ok(templateAssets.rain, 'Icona pioggia deve essere presente');
    assert.ok(templateAssets.snow, 'Icona neve deve essere presente');
    assert.ok(templateAssets.calendar, 'Icona calendario deve essere presente');
    assert.ok(templateAssets.thermometer, 'Icona termometro deve essere presente');

    assert.ok(templateAssets.logo.startsWith('data:image/'), 'Logo deve essere un Data URI Base64 valido');
    assert.ok(templateAssets.sun.startsWith('data:image/'), 'Icona sun deve essere un Data URI Base64');
  });

  await it('1.3. Modulo pdf-generator.js esporta le funzioni e costanti richieste', () => {
    assert.strictEqual(typeof generateCantierePDF, 'function', 'generateCantierePDF deve essere una funzione');
    assert.strictEqual(typeof sanitizePdfFilename, 'function', 'sanitizePdfFilename deve essere una funzione');
    assert.strictEqual(typeof formatDateForPdf, 'function', 'formatDateForPdf deve essere una funzione');
    assert.strictEqual(typeof GEOMETRY, 'object', 'GEOMETRY deve essere esportato');
  });

  // ---------------------------------------------------------------------------
  // 2. CONVENZIONE NAMING FILE RIGOROSA: YYYY-MM-DD_NomeCantiere.pdf
  // ---------------------------------------------------------------------------
  await it('2.1. Naming file è rigorosamente YYYY-MM-DD_NomeCantiere.pdf con sanificazione caratteri', () => {
    const name1 = sanitizePdfFilename('2026-10-19', 'Santuario Madonna delle Grazie');
    assert.strictEqual(name1, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');

    const name2 = sanitizePdfFilename('2026-05-26', 'Palazzo / Cantiere * Speciale ?');
    assert.strictEqual(name2, '2026-05-26_Palazzo_Cantiere_Speciale.pdf');

    const name3 = sanitizePdfFilename('data_invalida', 'Cantiere Test');
    assert.ok(/^\d{4}-\d{2}-\d{2}_Cantiere_Test\.pdf$/.test(name3), 'Data non valida deve ripiegare sulla data odierna ISO');

    const name4 = sanitizePdfFilename('2026-07-15', '');
    assert.strictEqual(name4, '2026-07-15_Rapportino.pdf', 'Cantiere vuoto deve ripiegare su Rapportino');
  });

  await it('2.2. Formattazione data GG/MM/AAAA converte correttamente la data per il box DATA', () => {
    assert.strictEqual(formatDateForPdf('2026-10-19'), '19/10/2026');
    assert.strictEqual(formatDateForPdf('2026-05-26'), '26/05/2026');
  });

  // ---------------------------------------------------------------------------
  // 3. GENERAZIONE PDF: CASO 0 FOTO (1 PAGINA ESATTA)
  // ---------------------------------------------------------------------------
  await it('3.1. Rapportino con 0 foto genera un PDF con esattamente 1 pagina', async () => {
    const sample0Foto = {
      data: '2026-10-19',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016',
      meteo: 'sereno',
      temperatura: 22,
      lavorazioni: 'Posa in opera pavimentazione e intonaci.',
      operai: ['Mario Rossi', 'Luigi Bianchi'],
      totaleOperaiVittorini: 2,
      subappalti: [
        { ditta: 'IPPOLITI PONTEGGI', operai: 3, lavorazione: 'Ponteggi' }
      ],
      totaleOperaiSubappalti: 3,
      note: 'Nessun problema riscontrato.',
      foto: []
    };

    const res = await generateCantierePDF(sample0Foto, { returnDoc: true });
    assert.strictEqual(res.getNumberOfPages(), 1, 'PDF con 0 foto deve avere esattamente 1 pagina');

    const buffer = await generateCantierePDF(sample0Foto, { returnBuffer: true });
    assert.ok(Buffer.isBuffer(buffer), 'Deve restituire un Buffer valido');
    assert.ok(buffer.length > 25000, `Dimensione file PDF (${buffer.length} bytes) deve contenere asset e layout`);

    // Verifica header PDF valido
    const headerStr = buffer.slice(0, 5).toString('ascii');
    assert.strictEqual(headerStr, '%PDF-', 'Header file deve iniziare con %PDF-');
  });

  // ---------------------------------------------------------------------------
  // 4. GENERAZIONE PDF: CASO 4 FOTO (1 PAGINA ESATTA)
  // ---------------------------------------------------------------------------
  await it('4.1. Rapportino con 4 foto genera un PDF con esattamente 1 pagina (griglia 2x2 Foto 1..4)', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sample4Foto = {
      data: '2026-10-19',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016',
      meteo: 'nuvoloso',
      temperatura: 24,
      lavorazioni: 'Armatura solaio piano terra.',
      operai: ['Mario Rossi', 'Luigi Bianchi', 'Giovanni Verdi'],
      totaleOperaiVittorini: 3,
      subappalti: [],
      totaleOperaiSubappalti: 0,
      note: 'Verifiche strutturali in corso.',
      foto: [
        { id: 'f1', dataUrl: dummyPhoto },
        { id: 'f2', dataUrl: dummyPhoto },
        { id: 'f3', dataUrl: dummyPhoto },
        { id: 'f4', dataUrl: dummyPhoto }
      ]
    };

    const res = await generateCantierePDF(sample4Foto, { returnDoc: true });
    assert.strictEqual(res.getNumberOfPages(), 1, 'PDF con 4 foto deve avere esattamente 1 pagina');

    const resultObj = await generateCantierePDF(sample4Foto, { autoSave: false });
    assert.strictEqual(resultObj.pageCount, 1, 'pageCount deve essere 1');
    assert.strictEqual(resultObj.filename, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');
  });

  // ---------------------------------------------------------------------------
  // 5. GENERAZIONE PDF: CASO 6 FOTO (2 PAGINE ESATTE)
  // ---------------------------------------------------------------------------
  await it('5.1. Rapportino con 6 foto genera automaticamente Pagina 2 (2 pagine esatte)', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sample6Foto = {
      data: '2026-10-19',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016',
      meteo: 'pioggia',
      temperatura: 18,
      lavorazioni: 'Getto calcestruzzo travi di fondazione.',
      operai: ['Mario Rossi', 'Luigi Bianchi', 'Giovanni Verdi', 'Antonio Russo'],
      totaleOperaiVittorini: 4,
      subappalti: [
        { ditta: 'CALCESTRUZZI RIETI', operai: 2, lavorazione: 'Pompaggio cls' }
      ],
      totaleOperaiSubappalti: 2,
      note: 'Verbali di prova prelevati da laboratorio.',
      foto: [
        { id: 'f1', dataUrl: dummyPhoto },
        { id: 'f2', dataUrl: dummyPhoto },
        { id: 'f3', dataUrl: dummyPhoto },
        { id: 'f4', dataUrl: dummyPhoto },
        { id: 'f5', dataUrl: dummyPhoto },
        { id: 'f6', dataUrl: dummyPhoto }
      ]
    };

    const res = await generateCantierePDF(sample6Foto, { returnDoc: true });
    assert.strictEqual(res.getNumberOfPages(), 2, 'PDF con 6 foto deve avere esattamente 2 pagine');

    const resultObj = await generateCantierePDF(sample6Foto, { autoSave: false });
    assert.strictEqual(resultObj.pageCount, 2, 'pageCount deve essere 2');
    assert.strictEqual(resultObj.filename, '2026-10-19_Santuario_Madonna_delle_Grazie.pdf');
  });

  // ---------------------------------------------------------------------------
  // 6. GENERAZIONE PDF: CASO 8 FOTO (2 PAGINE ESATTE)
  // ---------------------------------------------------------------------------
  await it('6.1. Rapportino con 8 foto (limite massimo) genera esattamente 2 pagine', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sample8Foto = {
      data: '2026-10-19',
      cantiere: 'Nuovo Complesso Scolastico',
      localita: 'L\'Aquila',
      commessa: 'Ricostruzione 2009',
      meteo: 'sereno',
      temperatura: 26,
      lavorazioni: 'Tramezzature interne e montaggio infissi.',
      operai: Array.from({ length: 16 }, (_, i) => `Operaio ${i + 1}`),
      totaleOperaiVittorini: 16,
      subappalti: Array.from({ length: 8 }, (_, i) => ({
        ditta: `SUB ${i + 1}`,
        operai: 2,
        lavorazione: 'Impianti'
      })),
      totaleOperaiSubappalti: 16,
      note: 'Collaudo impianti effettuato.',
      foto: Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, dataUrl: dummyPhoto }))
    };

    const res = await generateCantierePDF(sample8Foto, { returnDoc: true });
    assert.strictEqual(res.getNumberOfPages(), 2, 'PDF con 8 foto deve avere esattamente 2 pagine');
  });

  // ---------------------------------------------------------------------------
  // 7. VERIFICA GEOMETRICA E CONTENUTI
  // ---------------------------------------------------------------------------
  await it('7.1. Geometria del foglio corrisponde al formato A4 verticale (595.28 x 841.89 pt)', () => {
    assert.strictEqual(GEOMETRY.page.width, 595.28, 'Larghezza A4 deve essere 595.28 pt');
    assert.strictEqual(GEOMETRY.page.height, 841.89, 'Altezza A4 deve essere 841.89 pt');
  });

  await it('7.2. Doppia cornice rispetta i colori ufficiali #4A86E8 e #C9DAF8', () => {
    assert.deepStrictEqual(GEOMETRY.colors.blueOuter, [74, 134, 232], 'Colore bordo esterno deve essere #4A86E8 (74, 134, 232)');
    assert.deepStrictEqual(GEOMETRY.colors.cyanInner, [201, 218, 248], 'Colore bordo interno deve essere #C9DAF8 (201, 218, 248)');
  });

  await it('7.3. Piè di pagina contiene la dicitura ufficiale Vittorini', () => {
    assert.strictEqual(GEOMETRY.footer.text, "VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA");
  });

  // ---------------------------------------------------------------------------
  // 8. INTEGRAZIONE APP.JS, INDEX.HTML E SERVICE WORKER
  // ---------------------------------------------------------------------------
  await it('8.1. index.html include template-assets.js, jspdf.umd.min.js e pdf-generator.js prima di app.js', () => {
    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes('src="assets/template-assets.js"'), 'index.html deve includere template-assets.js');
    assert.ok(htmlContent.includes('src="js/lib/jspdf.umd.min.js"'), 'index.html deve includere jspdf.umd.min.js');
    assert.ok(htmlContent.includes('src="js/pdf-generator.js"'), 'index.html deve includere pdf-generator.js');

    const posAssets = htmlContent.indexOf('src="assets/template-assets.js"');
    const posJsPdf = htmlContent.indexOf('src="js/lib/jspdf.umd.min.js"');
    const posPdfGen = htmlContent.indexOf('src="js/pdf-generator.js"');
    const posApp = htmlContent.indexOf('src="js/app.js"');

    assert.ok(posAssets < posApp, 'template-assets.js deve trovarsi prima di app.js');
    assert.ok(posJsPdf < posApp, 'jspdf.umd.min.js deve trovarsi prima di app.js');
    assert.ok(posPdfGen < posApp, 'pdf-generator.js deve trovarsi prima di app.js');
  });

  await it('8.2. sw.js include template-assets.js, jspdf.umd.min.js e pdf-generator.js nel PRECACHE_ASSETS', () => {
    const swPath = path.join(__dirname, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    assert.ok(swContent.includes("'./assets/template-assets.js'"), 'sw.js deve precachare template-assets.js');
    assert.ok(swContent.includes("'./js/lib/jspdf.umd.min.js'"), 'sw.js deve precachare jspdf.umd.min.js');
    assert.ok(swContent.includes("'./js/pdf-generator.js'"), 'sw.js deve precachare pdf-generator.js');
  });

  await it('8.3. app.js collega il click di #btn-download-pdf a generateCantierePDF', () => {
    const appPath = path.join(__dirname, 'js', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert.ok(appContent.includes('this.btnDownloadPdf'), 'app.js deve memorizzare il riferimento al bottone download PDF');
    assert.ok(appContent.includes('generateCantierePDF(reportData)'), 'app.js deve chiamare generateCantierePDF');
  });

  console.log('\n-----------------------------------------------------------------');
  console.log(`  Riepilogo Test Task 5: ${passedTests}/${totalTests} superati con successo.`);
  console.log('-----------------------------------------------------------------\n');
}

runTests().catch(err => {
  console.error('Errore fatale test suite:', err);
  process.exitCode = 1;
});
