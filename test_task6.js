/**
 * CantiereSmart - Test Suite Task 6: Motore di Esportazione Word (.docx Modificabile)
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Verifiche automatizzate:
 * 1. Dipendenze e moduli 100% offline (fflate.umd.min.js, docx.umd.js, docx-generator.js)
 * 2. Convenzione di naming rigorosa YYYY-MM-DD_NomeCantiere.docx e formattazione data GG/MM/AAAA
 * 3. Generazione OpenXML standard con 0 foto (struttura zip, XML entries, sezioni 1-4, footer)
 * 4. Presenza di tutti i testi e valori (cantiere, meteo, lavorazioni, operai Vittorini, subappalti, note)
 * 5. Generazione con 4 foto (relazioni word/_rels/document.xml.rels, word/media/, didascalie Foto 1..4)
 * 6. Generazione con 8 foto (limite massimo, griglia 2 per riga, 8 immagini embeddate)
 * 7. Apertura e validazione nativa tramite Microsoft Word (se disponibile su sistema Windows)
 * 8. Integrazione completa in index.html, sw.js e app.js (#btn-download-docx con toast verde)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=================================================================');
console.log('  TEST SUITE TASK 6: MOTORE DI ESPORTAZIONE WORD (.DOCX)');
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

// Caricamento fflate e generatori
const fflate = require('./js/lib/fflate.umd.min.js');
const docxLib = require('./js/lib/docx.umd.js');
const {
  generateCantiereDOCX,
  sanitizeDocxFilename,
  formatDateForDocx,
  DOCX_GEOMETRY
} = require('./js/docx-generator.js');

async function runTests() {

  // ---------------------------------------------------------------------------
  // 1. CARICAMENTO MODULI E DIPENDENZE OFFLINE
  // ---------------------------------------------------------------------------
  await it('1.1. Libreria fflate standalone esiste in js/lib/fflate.umd.min.js per uso 100% offline', () => {
    const fflatePath = path.join(__dirname, 'js', 'lib', 'fflate.umd.min.js');
    assert.ok(fs.existsSync(fflatePath), 'fflate.umd.min.js deve esistere nella cartella js/lib');
    const stats = fs.statSync(fflatePath);
    assert.ok(stats.size > 20000, `Dimensione fflate (${stats.size} bytes) deve essere completa`);

    assert.strictEqual(typeof fflate.zipSync, 'function', 'fflate.zipSync deve essere una funzione');
    assert.strictEqual(typeof fflate.unzipSync, 'function', 'fflate.unzipSync deve essere una funzione');
    assert.strictEqual(typeof fflate.strToU8, 'function', 'fflate.strToU8 deve essere una funzione');
  });

  await it('1.2. Libreria docx standalone UMD esiste in js/lib/docx.umd.js', () => {
    const docxPath = path.join(__dirname, 'js', 'lib', 'docx.umd.js');
    assert.ok(fs.existsSync(docxPath), 'docx.umd.js deve esistere nella cartella js/lib');
    assert.ok(docxLib, 'docx.umd.js deve essere caricabile');
    assert.strictEqual(typeof docxLib.createPackage, 'function', 'docxLib.createPackage deve essere esportata');
    assert.strictEqual(typeof docxLib.parseBase64Image, 'function', 'docxLib.parseBase64Image deve essere esportata');
  });

  await it('1.3. Modulo docx-generator.js esporta le funzioni e costanti richieste', () => {
    assert.strictEqual(typeof generateCantiereDOCX, 'function', 'generateCantiereDOCX deve essere esportata');
    assert.strictEqual(typeof sanitizeDocxFilename, 'function', 'sanitizeDocxFilename deve essere esportata');
    assert.strictEqual(typeof formatDateForDocx, 'function', 'formatDateForDocx deve essere esportata');
    assert.strictEqual(typeof DOCX_GEOMETRY, 'object', 'DOCX_GEOMETRY deve essere esportata');
    assert.strictEqual(DOCX_GEOMETRY.colors.primaryBlue, '1A5694', 'Colore primario deve essere 1A5694');
  });

  // ---------------------------------------------------------------------------
  // 2. CONVENZIONE NAMING RIGOROSA E FORMATTAZIONE DATA
  // ---------------------------------------------------------------------------
  await it('2.1. Naming file è rigorosamente YYYY-MM-DD_NomeCantiere.docx con sanificazione caratteri', () => {
    const name1 = sanitizeDocxFilename('2026-10-19', 'Santuario Madonna delle Grazie');
    assert.strictEqual(name1, '2026-10-19_Santuario_Madonna_delle_Grazie.docx');

    const name2 = sanitizeDocxFilename('2026-05-26', 'Palazzo / Cantiere * Speciale ?');
    assert.strictEqual(name2, '2026-05-26_Palazzo_Cantiere_Speciale.docx');

    const name3 = sanitizeDocxFilename('data_invalida', 'Cantiere Test');
    assert.ok(/^\d{4}-\d{2}-\d{2}_Cantiere_Test\.docx$/.test(name3), 'Data non valida deve ripiegare sulla data odierna ISO');

    const name4 = sanitizeDocxFilename('2026-07-15', '');
    assert.strictEqual(name4, '2026-07-15_Rapportino.docx', 'Cantiere vuoto deve ripiegare su Rapportino');
  });

  await it('2.2. Formattazione data GG/MM/AAAA converte correttamente la data per il box DATA', () => {
    assert.strictEqual(formatDateForDocx('2026-10-19'), '19/10/2026');
    assert.strictEqual(formatDateForDocx('2026-05-26'), '26/05/2026');
  });

  // ---------------------------------------------------------------------------
  // 3. GENERAZIONE DOCX: CASO 0 FOTO (VERIFICA STRUTTURA OPENXML & SEZIONI 1-4)
  // ---------------------------------------------------------------------------
  await it('3.1. Rapportino con 0 foto genera un file .docx valido con struttura OpenXML completa', async () => {
    const sample0 = {
      data: '2026-10-19',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016',
      meteo: 'sereno',
      temperatura: 22,
      lavorazioni: 'Posa in opera intonaci interni ed esterni al piano terra.',
      operai: ['Mario Rossi', 'Luigi Bianchi', 'Giovanni Verdi'],
      totaleOperaiVittorini: 3,
      subappalti: [
        { ditta: 'IPPOLITI PONTEGGI', operai: 3, lavorazione: 'Smontaggio ponteggio' }
      ],
      totaleOperaiSubappalti: 3,
      noleggi: ['Escavatore Cat 320', 'Gru a torre'],
      materiali: 'Calcestruzzo Rck 30, malta premiscelata',
      note: 'Sopralluogo con Direttore dei Lavori effettuato alle 11:30.',
      foto: []
    };

    const res = await generateCantiereDOCX(sample0, { returnBuffer: true });
    assert.ok(Buffer.isBuffer(res) || res instanceof Uint8Array, 'Deve restituire un buffer');
    assert.ok(res.length > 5000, `Dimensione file (${res.length} bytes) deve contenere il pacchetto OpenXML`);

    // Decompressione zip tramite fflate per verificare i file interni
    const unzipped = fflate.unzipSync(new Uint8Array(res));
    const entries = Object.keys(unzipped);

    assert.ok(entries.includes('[Content_Types].xml'), 'Deve contenere [Content_Types].xml');
    assert.ok(entries.includes('_rels/.rels'), 'Deve contenere _rels/.rels');
    assert.ok(entries.includes('word/document.xml'), 'Deve contenere word/document.xml');
    assert.ok(entries.includes('word/_rels/document.xml.rels'), 'Deve contenere word/_rels/document.xml.rels');
    assert.ok(entries.includes('word/styles.xml'), 'Deve contenere word/styles.xml');
    assert.ok(entries.includes('word/footer1.xml'), 'Deve contenere word/footer1.xml');
  });

  // ---------------------------------------------------------------------------
  // 4. VERIFICA PRESENZA TESTI E LAYOUT VITTORINI IN WORD/DOCUMENT.XML
  // ---------------------------------------------------------------------------
  await it('4.1. word/document.xml contiene tutti i testi obbligatori, tabelle e sezioni Vittorini', async () => {
    const sample = {
      data: '2026-10-19',
      cantiere: 'Santuario Madonna delle Grazie',
      localita: 'Loc. Varoni, Amatrice (RI)',
      commessa: 'Sisma 2016 - Ricostruzione',
      meteo: 'nuvoloso',
      temperatura: 24,
      lavorazioni: 'Posa in opera intonaci e finiture di facciata.',
      operai: ['Antonio De Santis', 'Paolo Moretti', 'Marco Ferri'],
      totaleOperaiVittorini: 3,
      subappalti: [
        { ditta: 'TERMOIDRAULICA AQUILANA', operai: 2, lavorazione: 'Impianto radiante' }
      ],
      totaleOperaiSubappalti: 2,
      noleggi: ['Piattaforma aerea 18m'],
      materiali: 'Tubazioni multistrato 26mm',
      note: 'Collaudo idraulico positivo eseguito in mattinata.',
      foto: []
    };

    const res = await generateCantiereDOCX(sample, { returnBuffer: true });
    const unzipped = fflate.unzipSync(new Uint8Array(res));
    const docXml = fflate.strFromU8(unzipped['word/document.xml']);
    const footerXml = fflate.strFromU8(unzipped['word/footer1.xml']);

    // Intestazione
    assert.ok(docXml.includes('RAPPORTO GIORNALIERO DI CANTIERE'), 'Deve contenere il titolo RAPPORTO GIORNALIERO DI CANTIERE');
    assert.ok(docXml.includes('VITTORINI EMIDIO COSTRUZIONI S.r.l. - L&#39;AQUILA') || docXml.includes('VITTORINI EMIDIO COSTRUZIONI S.r.l.'), 'Deve contenere la dicitura societaria Vittorini');
    assert.ok(docXml.includes('1A5694'), 'Deve applicare il colore blu istituzionale #1A5694');
    assert.ok(docXml.includes('Santuario Madonna delle Grazie'), 'Deve contenere il nome del cantiere');
    assert.ok(docXml.includes('Loc. Varoni, Amatrice (RI)'), 'Deve contenere la località');
    assert.ok(docXml.includes('Sisma 2016 - Ricostruzione'), 'Deve contenere la commessa');

    // Tabella Condizioni Generali
    assert.ok(docXml.includes('19/10/2026'), 'Deve contenere la data formattata GG/MM/AAAA');
    assert.ok(docXml.includes('NUVOLOSO'), 'Deve contenere le condizioni meteo');
    assert.ok(docXml.includes('24 °C'), 'Deve contenere la temperatura');

    // Sezione 1: Lavorazioni
    assert.ok(docXml.includes('1. LAVORAZIONI ESEGUITE'), 'Deve contenere il banner Sezione 1');
    assert.ok(docXml.includes('Posa in opera intonaci e finiture di facciata.'), 'Deve contenere il testo delle lavorazioni');

    // Sezione 2: Personale
    assert.ok(docXml.includes('2. PERSONALE PRESENTE'), 'Deve contenere il banner Sezione 2');
    assert.ok(docXml.includes('Personale Vittorini Costruzioni'), 'Deve contenere la testata tabella Personale Vittorini');
    assert.ok(docXml.includes('Antonio De Santis'), 'Deve contenere l\'operaio Vittorini 1');
    assert.ok(docXml.includes('Paolo Moretti'), 'Deve contenere l\'operaio Vittorini 2');
    assert.ok(docXml.includes('Totale personale Vittorini Costruzioni:'), 'Deve contenere la riga totale Vittorini');
    assert.ok(docXml.includes('Subappaltatori'), 'Deve contenere la testata tabella Subappaltatori');
    assert.ok(docXml.includes('TERMOIDRAULICA AQUILANA'), 'Deve contenere la ditta subappaltatrice');
    assert.ok(docXml.includes('Totale personale Subappaltatori:'), 'Deve contenere la riga totale Subappaltatori');

    // Sezione 3: Note
    assert.ok(docXml.includes('3. NOTE GENERALI &amp; D.L.'), 'Deve contenere il banner Sezione 3');
    assert.ok(docXml.includes('Collaudo idraulico positivo'), 'Deve contenere la nota generale');
    assert.ok(docXml.includes('Piattaforma aerea 18m'), 'Deve contenere il noleggio presente');
    assert.ok(docXml.includes('Tubazioni multistrato 26mm'), 'Deve contenere il materiale arrivato');

    // Sezione 4: Fotografie (0 foto)
    assert.ok(docXml.includes('4. FOTOGRAFIE DI CANTIERE'), 'Deve contenere il banner Sezione 4');
    assert.ok(docXml.includes('Nessuna fotografia allegata per la giornata odierna.'), 'Deve segnalare assenza di foto se foto vuota');

    // Piè di pagina
    assert.ok(footerXml.includes("VITTORINI EMIDIO COSTRUZIONI S.r.l. - L&#39;AQUILA") || footerXml.includes("VITTORINI EMIDIO COSTRUZIONI S.r.l."), 'Il footer deve contenere la dicitura ufficiale centrata');
  });

  // ---------------------------------------------------------------------------
  // 5. GENERAZIONE CON 4 FOTO (MEDIA, RELAZIONI, DIDASCALIE)
  // ---------------------------------------------------------------------------
  await it('5.1. Rapportino con 4 foto include media files, relazioni rId e tabella a griglia 2x2', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sample4 = {
      data: '2026-10-19',
      cantiere: 'Nuovo Ospedale dei Bambini',
      localita: 'L\'Aquila (AQ)',
      commessa: 'Opere Edili',
      meteo: 'sereno',
      temperatura: 25,
      lavorazioni: 'Tramezzature in cartongesso e allacci impiantistici.',
      operai: ['Operaio 1', 'Operaio 2'],
      subappalti: [],
      note: 'Tutto regolare.',
      foto: [
        { id: 'f1', dataUrl: dummyPhoto, name: 'foto1.png' },
        { id: 'f2', dataUrl: dummyPhoto, name: 'foto2.png' },
        { id: 'f3', dataUrl: dummyPhoto, name: 'foto3.png' },
        { id: 'f4', dataUrl: dummyPhoto, name: 'foto4.png' }
      ]
    };

    const res = await generateCantiereDOCX(sample4, { returnBuffer: true });
    const unzipped = fflate.unzipSync(new Uint8Array(res));
    const entries = Object.keys(unzipped);

    // Verifica presenza immagini in word/media/
    assert.ok(entries.includes('word/media/image1.png'), 'word/media/image1.png deve essere presente');
    assert.ok(entries.includes('word/media/image2.png'), 'word/media/image2.png deve essere presente');
    assert.ok(entries.includes('word/media/image3.png'), 'word/media/image3.png deve essere presente');
    assert.ok(entries.includes('word/media/image4.png'), 'word/media/image4.png deve essere presente');

    // Verifica relazioni
    const relsXml = fflate.strFromU8(unzipped['word/_rels/document.xml.rels']);
    assert.ok(relsXml.includes('Target="media/image1.png"'), 'Relazione per image1.png deve essere presente');
    assert.ok(relsXml.includes('Target="media/image4.png"'), 'Relazione per image4.png deve essere presente');

    // Verifica didascalie nel documento
    const docXml = fflate.strFromU8(unzipped['word/document.xml']);
    assert.ok(docXml.includes('Foto 1'), 'Didascalia Foto 1 deve essere presente');
    assert.ok(docXml.includes('Foto 2'), 'Didascalia Foto 2 deve essere presente');
    assert.ok(docXml.includes('Foto 3'), 'Didascalia Foto 3 deve essere presente');
    assert.ok(docXml.includes('Foto 4'), 'Didascalia Foto 4 deve essere presente');
    assert.ok(docXml.includes('<w:drawing>'), 'Documento deve contenere elementi <w:drawing>');
  });

  // ---------------------------------------------------------------------------
  // 6. GENERAZIONE CON 8 FOTO (LIMITE MASSIMO CANTIERE)
  // ---------------------------------------------------------------------------
  await it('6.1. Rapportino con 8 foto (limite massimo) include tutte le 8 immagini embeddate', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sample8 = {
      data: '2026-10-19',
      cantiere: 'Cantiere Complesso 8 Foto',
      localita: 'Teramo',
      commessa: 'PNRR 2026',
      meteo: 'pioggia',
      temperatura: 16,
      lavorazioni: 'Opere di fondazione e getto travi.',
      operai: Array.from({ length: 8 }, (_, i) => `Operaio ${i + 1}`),
      subappalti: [
        { ditta: 'SUB 1', operai: 4, lavorazione: 'Carpenteria' },
        { ditta: 'SUB 2', operai: 2, lavorazione: 'Ferro' }
      ],
      note: 'Collaudi strutturali positivi.',
      foto: Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, dataUrl: dummyPhoto, name: `p${i + 1}.png` }))
    };

    const resultObj = await generateCantiereDOCX(sample8, { autoSave: false });
    assert.strictEqual(resultObj.success, true, 'Deve completare con successo');
    assert.strictEqual(resultObj.photoCount, 8, 'photoCount deve essere 8');
    assert.strictEqual(resultObj.filename, '2026-10-19_Cantiere_Complesso_8_Foto.docx');

    const unzipped = fflate.unzipSync(new Uint8Array(resultObj.buffer));
    for (let i = 1; i <= 8; i++) {
      assert.ok(unzipped[`word/media/image${i}.png`], `word/media/image${i}.png deve essere presente`);
    }

    const docXml = fflate.strFromU8(unzipped['word/document.xml']);
    assert.ok(docXml.includes('Foto 8'), 'Didascalia Foto 8 deve essere presente');
  });

  // ---------------------------------------------------------------------------
  // 7. VERIFICA APERTURA NATIVA CON MICROSOFT WORD COM (WINDOWS)
  // ---------------------------------------------------------------------------
  await it('7.1. Microsoft Word COM apre il file .docx generato senza errori di sintassi XML o corruzione', async () => {
    const dummyPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sampleFull = {
      data: '2026-10-19',
      cantiere: 'Verifica Microsoft Word COM',
      localita: 'L\'Aquila Centro',
      commessa: 'Appalto Integrato',
      meteo: 'sereno',
      temperatura: 23,
      lavorazioni: 'Posa pavimentazione in gres e montaggio porte interne.',
      operai: ['Marco Rossi', 'Luca Neri', 'Franco Grigi'],
      totaleOperaiVittorini: 3,
      subappalti: [{ ditta: 'EDIL TEST S.R.L.', operai: 2, lavorazione: 'Pittura' }],
      totaleOperaiSubappalti: 2,
      noleggi: ['Muletto elevatore'],
      materiali: 'Pittura traspirante bianca',
      note: 'Tutto conforme alle specifiche di progetto.',
      foto: [
        { id: 'f1', dataUrl: dummyPhoto, name: 'foto1.png' },
        { id: 'f2', dataUrl: dummyPhoto, name: 'foto2.png' }
      ]
    };

    const buffer = await generateCantiereDOCX(sampleFull, { returnBuffer: true });
    const tempDocxPath = path.join(__dirname, 'test_word_com_check.docx');
    fs.writeFileSync(tempDocxPath, buffer);

    const tempPs1Path = path.join(__dirname, 'temp_word_com_check.ps1');
    const psScript = [
      '$word = New-Object -ComObject Word.Application',
      '$word.Visible = $false',
      'try {',
      `  $doc = $word.Documents.Open('${tempDocxPath.replace(/\\/g, '\\\\')}')`,
      '  Write-Host "WORD PARSED SUCCESSFULLY! Tables:" $doc.Tables.Count "Paragraphs:" $doc.Paragraphs.Count',
      '  $doc.Close()',
      '} catch {',
      '  Write-Host "WORD PARSE FAILED: $_"',
      '  exit 1',
      '} finally {',
      '  $word.Quit()',
      '}'
    ].join('\r\n');
    fs.writeFileSync(tempPs1Path, psScript);

    try {
      const psOut = execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs1Path}"`, { encoding: 'utf8' });
      assert.ok(psOut.includes('WORD PARSED SUCCESSFULLY'), 'Microsoft Word deve aprire il documento senza errori');
    } finally {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      if (fs.existsSync(tempPs1Path)) fs.unlinkSync(tempPs1Path);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. INTEGRAZIONE UI, INDEX.HTML, APP.JS E SERVICE WORKER
  // ---------------------------------------------------------------------------
  await it('8.1. index.html include fflate.umd.min.js, docx.umd.js e docx-generator.js prima di app.js', () => {
    const htmlPath = path.join(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes('src="js/lib/fflate.umd.min.js"'), 'index.html deve includere fflate.umd.min.js');
    assert.ok(htmlContent.includes('src="js/lib/docx.umd.js"'), 'index.html deve includere docx.umd.js');
    assert.ok(htmlContent.includes('src="js/docx-generator.js"'), 'index.html deve includere docx-generator.js');

    const posFflate = htmlContent.indexOf('src="js/lib/fflate.umd.min.js"');
    const posDocxLib = htmlContent.indexOf('src="js/lib/docx.umd.js"');
    const posDocxGen = htmlContent.indexOf('src="js/docx-generator.js"');
    const posApp = htmlContent.indexOf('src="js/app.js"');

    assert.ok(posFflate < posApp, 'fflate.umd.min.js deve essere prima di app.js');
    assert.ok(posDocxLib < posApp, 'docx.umd.js deve essere prima di app.js');
    assert.ok(posDocxGen < posApp, 'docx-generator.js deve essere prima di app.js');
  });

  await it('8.2. sw.js include fflate.umd.min.js, docx.umd.js e docx-generator.js nel PRECACHE_ASSETS per offline', () => {
    const swPath = path.join(__dirname, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    assert.ok(swContent.includes("'./js/lib/fflate.umd.min.js'"), 'sw.js deve precachare fflate.umd.min.js');
    assert.ok(swContent.includes("'./js/lib/docx.umd.js'"), 'sw.js deve precachare docx.umd.js');
    assert.ok(swContent.includes("'./js/docx-generator.js'"), 'sw.js deve precachare docx-generator.js');
  });

  await it('8.3. app.js collega #btn-download-docx con generateCantiereDOCX e notifica toast verde', () => {
    const appPath = path.join(__dirname, 'js', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert.ok(appContent.includes('this.btnDownloadDocx'), 'app.js deve memorizzare btnDownloadDocx');
    assert.ok(appContent.includes('generateCantiereDOCX(reportData)'), 'app.js deve invocare generateCantiereDOCX');
    assert.ok(appContent.includes("showToast('📄 Word (.docx) scaricato"), 'app.js deve mostrare toast verde con nome file');
  });

  console.log('\n-----------------------------------------------------------------');
  console.log(`  Riepilogo Test Task 6: ${passedTests}/${totalTests} superati con successo.`);
  console.log('-----------------------------------------------------------------\n');
}

runTests().catch(err => {
  console.error('Errore fatale test suite Task 6:', err);
  process.exitCode = 1;
});
