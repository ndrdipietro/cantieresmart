/**
 * CantiereSmart - Motore di Esportazione Word (.docx Modificabile)
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Generazione documentale Word (.docx OpenXML puro, 100% offline e client-side).
 * Replicazione fedele del layout ufficiale Vittorini:
 * 1. Intestazione istituzionale (Titolo bold blu #1A5694, Logo, Cantiere, Località, Commessa)
 * 2. Tabella Condizioni Generali (Data GG/MM/AAAA, Meteo, Temperatura °C)
 * 3. Sezione 1: Lavorazioni Eseguite (riquadro interamente editabile)
 * 4. Sezione 2: Personale Presente (Tabella affiancata a 2 colonne Vittorini + Subappalti + Totali)
 * 5. Sezione 3: Note Generali & D.L. (Note, Noleggi, Materiali/Forniture)
 * 6. Sezione 4: Fotografie di Cantiere (Griglia affiancata 2 foto per riga, fino a 8 foto con didascalie)
 * 7. Piè di pagina aziendale ufficiale centrato (VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA)
 * 
 * Naming rigoroso del file generato: YYYY-MM-DD_NomeCantiere.docx
 * Compatibilità garantita: Microsoft Word (PC, Mac, iOS, Android), LibreOffice, Google Docs.
 */

(function (global) {
  'use strict';

  // Costanti geometriche, colori istituzionali e misure OpenXML (in dxa ed EMU)
  const DOCX_GEOMETRY = {
    page: {
      width: 11906,  // A4 = 210 mm = 8.27 in = 11906 dxa
      height: 16838, // A4 = 297 mm = 11.69 in = 16838 dxa
      marginTop: 800,
      marginBottom: 800,
      marginLeft: 800,
      marginRight: 800,
      contentWidth: 10306 // 11906 - 1600
    },
    colors: {
      primaryBlue: '1A5694',   // Blu istituzionale Vittorini (#1A5694)
      accentBlue: '4A86E8',    // Bordo blu (#4A86E8)
      headerCyan: 'C9DAF8',    // Barra celeste per titoli sezioni (#C9DAF8)
      subtleBg: 'F5F8FC',      // Fondo chiaro tabelle (#F5F8FC)
      lightRowBg: 'EBF1F5',    // Fondo sottotitoli tabelle (#EBF1F5)
      borderSubtle: 'C9DAF8',  // Bordo divisorio interno (#C9DAF8)
      textDark: '1E293B',      // Testo scuro primario (#1E293B)
      textMuted: '475569',     // Testo secondario etichette (#475569)
      textWhite: 'FFFFFF'
    },
    fonts: {
      primary: 'Calibri'
    }
  };

  /**
   * Converte data ISO YYYY-MM-DD nel formato italiano GG/MM/AAAA
   * @param {string} isoStr 
   * @returns {string}
   */
  function formatDateForDocx(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    const clean = isoStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [yyyy, mm, dd] = clean.split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
    return clean;
  }

  /**
   * Genera il nome file ufficiale e sanificato: YYYY-MM-DD_NomeCantiere.docx
   * @param {string} dateStr 
   * @param {string} cantiereStr 
   * @returns {string}
   */
  function sanitizeDocxFilename(dateStr, cantiereStr) {
    let datePart = '';
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      datePart = dateStr.trim();
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      datePart = `${yyyy}-${mm}-${dd}`;
    }

    let cantierePart = (cantiereStr || 'Rapportino')
      .trim()
      .replace(/[\/\?<>\\:\*\|":]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!cantierePart) cantierePart = 'Rapportino';

    return `${datePart}_${cantierePart}.docx`;
  }

  /**
   * Escape di caratteri XML riservati
   * @param {string} str 
   * @returns {string}
   */
  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Risolve il motore ZIP (fflate)
   */
  function resolveFflateEngine() {
    if (typeof global.fflate !== 'undefined' && typeof global.fflate.zipSync === 'function') {
      return global.fflate;
    }
    if (typeof window !== 'undefined' && window.fflate && typeof window.fflate.zipSync === 'function') {
      return window.fflate;
    }
    if (typeof require === 'function') {
      try {
        const local = require('./lib/fflate.umd.min.js');
        if (local && typeof local.zipSync === 'function') return local;
      } catch (e1) {
        try {
          const mod = require('fflate');
          if (mod && typeof mod.zipSync === 'function') return mod;
        } catch (e2) {}
      }
    }
    return null;
  }

  /**
   * Risolve gli asset grafici (logo aziendale)
   */
  function resolveAssets() {
    if (typeof global.TEMPLATE_ASSETS === 'object' && global.TEMPLATE_ASSETS !== null) {
      return global.TEMPLATE_ASSETS;
    }
    if (typeof window !== 'undefined' && window.TEMPLATE_ASSETS) {
      return window.TEMPLATE_ASSETS;
    }
    if (typeof global.VITTORINI_LOGO_BASE64 === 'string') {
      return { logo: global.VITTORINI_LOGO_BASE64 };
    }
    if (typeof window !== 'undefined' && window.VITTORINI_LOGO_BASE64) {
      return { logo: window.VITTORINI_LOGO_BASE64 };
    }
    if (typeof require === 'function') {
      try {
        return require('../assets/template-assets.js');
      } catch (e1) {
        try {
          const logoObj = require('../assets/logo-vittorini.js');
          return { logo: logoObj.VITTORINI_LOGO_BASE64 };
        } catch (e2) {}
      }
    }
    return {};
  }

  /**
   * Estrae i byte e l'estensione da stringhe Base64 o Data URI
   * @param {string|Object} photoItem 
   * @returns {{bytes: Uint8Array, ext: string, mime: string}|null}
   */
  function decodeImageItem(photoItem) {
    let dataUri = '';
    if (typeof photoItem === 'string') {
      dataUri = photoItem;
    } else if (photoItem && typeof photoItem === 'object') {
      dataUri = photoItem.dataUrl || photoItem.url || photoItem.src || '';
    }

    if (!dataUri || typeof dataUri !== 'string') return null;

    let mime = 'image/jpeg';
    let ext = 'jpeg';
    let base64 = dataUri;

    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      base64 = match[2];
      if (mime.includes('png')) ext = 'png';
      else ext = 'jpeg';
    } else {
      base64 = dataUri.trim();
    }

    let bytes = null;
    try {
      if (typeof Buffer !== 'undefined') {
        bytes = new Uint8Array(Buffer.from(base64, 'base64'));
      } else if (typeof atob === 'function') {
        const bin = atob(base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
      }
    } catch (e) {
      console.warn('[DOCX Generator] Errore decodifica immagine:', e.message);
      return null;
    }

    if (!bytes || bytes.length === 0) return null;
    return { bytes, ext, mime };
  }

  /**
   * Genera il markup XML di DrawingML per un'immagine nel documento
   */
  function generateDrawingML(rId, docPrId, name, widthEmu, heightEmu) {
    return `<w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${docPrId}" name="${escapeXml(name)}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>`;
  }

  /**
   * Trigger per il download client-side su browser
   */
  function triggerBrowserDownload(blob, filename) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  /**
   * Generatore Documentale Word (.docx) per il Rapportino di Cantiere Vittorini
   * 
   * @param {Object} reportData Dati completi del rapportino
   * @param {Object} [options] Opzioni di generazione
   * @param {string} [options.filename] Override nome file
   * @param {boolean} [options.autoSave] Se salvare automaticamente su browser (default true su browser)
   * @param {boolean} [options.returnBuffer] Se restituire un Buffer Node.js
   * @param {boolean} [options.returnBlob] Se restituire un Blob browser
   * @param {boolean} [options.returnFiles] Se restituire la mappa dei file OpenXML
   * @returns {Promise<Object|Buffer|Blob>}
   */
  async function generateCantiereDOCX(reportData, options = {}) {
    const data = reportData || {};
    const assets = resolveAssets();
    const fflateEngine = resolveFflateEngine();

    if (!fflateEngine) {
      throw new Error('[DOCX Generator] Libreria fflate non trovata in ambiente locale. Verificare cantieresmart/js/lib/fflate.umd.min.js.');
    }

    const finalFilename = options.filename || sanitizeDocxFilename(data.data, data.cantiere);

    // Mappa dei file componenti del pacchetto OpenXML (.docx)
    const packageFiles = {};

    // Raccolta delle relazioni per word/_rels/document.xml.rels
    const docRels = [
      { id: 'rIdStyles', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' },
      { id: 'rIdFooter1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', target: 'footer1.xml' }
    ];

    let relIdCounter = 10;
    let docPrIdCounter = 1;

    // -------------------------------------------------------------------------
    // 1. GESTIONE LOGO VITTORINI
    // -------------------------------------------------------------------------
    let logoRelId = null;
    if (assets && assets.logo) {
      const decodedLogo = decodeImageItem(assets.logo);
      if (decodedLogo) {
        logoRelId = `rIdLogo${++relIdCounter}`;
        const logoTarget = `media/logo.${decodedLogo.ext}`;
        packageFiles[`word/${logoTarget}`] = decodedLogo.bytes;
        docRels.push({
          id: logoRelId,
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          target: logoTarget
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. GESTIONE FOTOGRAFIE DI CANTIERE (0..8 foto)
    // -------------------------------------------------------------------------
    const rawPhotos = Array.isArray(data.foto) ? data.foto.slice(0, 8) : [];
    const photoEntries = [];

    for (let i = 0; i < rawPhotos.length; i++) {
      const decoded = decodeImageItem(rawPhotos[i]);
      if (decoded) {
        const photoRelId = `rIdPhoto${++relIdCounter}`;
        const photoTarget = `media/image${i + 1}.${decoded.ext}`;
        packageFiles[`word/${photoTarget}`] = decoded.bytes;
        docRels.push({
          id: photoRelId,
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          target: photoTarget
        });
        const rawPhoto = rawPhotos[i];
        const rawCap = (rawPhoto && typeof rawPhoto === 'object' && (rawPhoto.caption || rawPhoto.didascalia))
          ? (rawPhoto.caption || rawPhoto.didascalia).trim()
          : '';
        const displayCap = rawCap ? `Foto ${i + 1}: ${rawCap}` : `Foto ${i + 1}`;
        photoEntries.push({
          index: i + 1,
          relId: photoRelId,
          docPrId: ++docPrIdCounter,
          name: `Foto ${i + 1}`,
          caption: displayCap
        });
      }
    }

    // -------------------------------------------------------------------------
    // 3. GENERAZIONE [Content_Types].xml
    // -------------------------------------------------------------------------
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
    packageFiles['[Content_Types].xml'] = contentTypesXml;

    // -------------------------------------------------------------------------
    // 4. GENERAZIONE _rels/.rels
    // -------------------------------------------------------------------------
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    packageFiles['_rels/.rels'] = relsXml;

    // -------------------------------------------------------------------------
    // 5. GENERAZIONE word/_rels/document.xml.rels
    // -------------------------------------------------------------------------
    let docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
    for (const rel of docRels) {
      docRelsXml += `\n  <Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`;
    }
    docRelsXml += `\n</Relationships>`;
    packageFiles['word/_rels/document.xml.rels'] = docRelsXml;

    // -------------------------------------------------------------------------
    // 6. GENERAZIONE word/styles.xml
    // -------------------------------------------------------------------------
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
        <w:color w:val="${DOCX_GEOMETRY.colors.textDark}"/>
        <w:lang w:val="it-IT"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:before="0" w:after="80" w:line="240" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:tblPr>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>`;
    packageFiles['word/styles.xml'] = stylesXml;

    // -------------------------------------------------------------------------
    // 7. GENERAZIONE word/footer1.xml (Piè di Pagina Ufficiale Vittorini)
    // -------------------------------------------------------------------------
    const footer1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:pBdr>
        <w:top w:val="single" w:sz="6" w:space="4" w:color="${DOCX_GEOMETRY.colors.headerCyan}"/>
      </w:pBdr>
      <w:spacing w:before="60" w:after="0"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:b/>
        <w:sz w:val="18"/>
        <w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/>
      </w:rPr>
      <w:t>VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA</w:t>
    </w:r>
  </w:p>
</w:ftr>`;
    packageFiles['word/footer1.xml'] = footer1Xml;

    // -------------------------------------------------------------------------
    // 8. GENERAZIONE word/document.xml (Corpo Principale Modificabile)
    // -------------------------------------------------------------------------
    const docParts = [];

    // Helper: Sezione Banner Barra Celeste
    function buildSectionHeader(num, title) {
      return `<w:tbl>
        <w:tblPr>
          <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
            <w:left w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
            <w:right w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="80" w:type="dxa"/>
            <w:bottom w:w="80" w:type="dxa"/>
            <w:left w:w="120" w:type="dxa"/>
            <w:right w:w="120" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
              <w:r>
                <w:rPr>
                  <w:b/>
                  <w:sz w:val="20"/>
                  <w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/>
                </w:rPr>
                <w:t>${num}. ${escapeXml(title)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>`;
    }

    // =========================================================================
    // INTESTAZIONE DOCUMENTO (Header Box)
    // =========================================================================
    const cantiereVal = data.cantiere || 'Santuario Madonna delle Grazie';
    const localitaVal = data.localita || 'Loc. Varoni, Amatrice (RI)';
    let commessaVal = data.commessa || 'Sisma 2016';
    if (data.cup || data.cig) {
      const parts = [];
      if (data.cup && data.cup !== 'N/A') parts.push(`CUP: ${data.cup}`);
      if (data.cig && data.cig !== 'N/A') parts.push(`CIG: ${data.cig}`);
      if (parts.length > 0) commessaVal = parts.join(' • ');
    }

    let logoCellMarkup = '';
    if (logoRelId) {
      // Dimensioni logo nel box: ~190 pt x 75 pt (2413000 x 952500 EMUs)
      logoCellMarkup = `<w:tc>
        <w:tcPr>
          <w:tcW w:w="2600" w:type="dxa"/>
          <w:vAlign w:val="center"/>
          <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
          <w:r>
            ${generateDrawingML(logoRelId, ++docPrIdCounter, 'Logo Vittorini', 2413000, 952500)}
          </w:r>
        </w:p>
      </w:tc>`;
    } else {
      logoCellMarkup = `<w:tc>
        <w:tcPr>
          <w:tcW w:w="2600" w:type="dxa"/>
          <w:vAlign w:val="center"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr>
            <w:t>VITTORINI EMIDIO</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.accentBlue}"/></w:rPr>
            <w:t>COSTRUZIONI S.r.l.</w:t>
          </w:r>
        </w:p>
      </w:tc>`;
    }

    const headerTableMarkup = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="12" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:left w:val="single" w:sz="12" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:bottom w:val="single" w:sz="12" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:right w:val="single" w:sz="12" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        ${logoCellMarkup}
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${DOCX_GEOMETRY.page.contentWidth - 2600}" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr>
              <w:t>RAPPORTO GIORNALIERO DI CANTIERE</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:i/><w:sz w:val="20"/><w:color w:val="${DOCX_GEOMETRY.colors.accentBlue}"/></w:rPr>
              <w:t>VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr>
              <w:t xml:space="preserve">Cantiere: </w:t>
            </w:r>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="19"/></w:rPr>
              <w:t>${escapeXml(cantiereVal)}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr>
              <w:t xml:space="preserve">Località: </w:t>
            </w:r>
            <w:r>
              <w:rPr><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(localitaVal)}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr>
              <w:t xml:space="preserve">Commessa / Rif.: </w:t>
            </w:r>
            <w:r>
              <w:rPr><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(commessaVal)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;
    docParts.push(headerTableMarkup);

    // Spaziatura
    docParts.push('<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>');

    // =========================================================================
    // TABELLA CONDIZIONI GENERALI (Meteo, Clima & Data)
    // =========================================================================
    const formattedDate = formatDateForDocx(data.data);
    const meteoRaw = (data.meteo || 'sereno').toUpperCase();
    const hasTemp = (data.temperatura !== undefined && data.temperatura !== null);
    const tempVal = hasTemp ? data.temperatura : 22;
    const tempStr = `${tempVal} °C`;

    let weatherHeaderRow = '';
    let weatherValueRow = '';

    if (hasTemp) {
      weatherHeaderRow = `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>DATA</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5106" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>CONDIZIONI METEO</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>TEMPERATURA</w:t></w:r>
          </w:p>
        </w:tc>`;

      weatherValueRow = `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(formattedDate)}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5106" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${escapeXml(meteoRaw)}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(tempStr)}</w:t></w:r>
          </w:p>
        </w:tc>`;
    } else {
      weatherHeaderRow = `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>DATA</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="7706" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.headerCyan}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>CONDIZIONI METEO DELLA GIORNATA</w:t></w:r>
          </w:p>
        </w:tc>`;

      weatherValueRow = `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2600" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(formattedDate)}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="7706" w:type="dxa"/>
            <w:vAlign w:val="center"/>
            <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${escapeXml(meteoRaw)}</w:t></w:r>
          </w:p>
        </w:tc>`;
    }

    const weatherTableMarkup = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <!-- Riga Intestazione -->
        ${weatherHeaderRow}
      </w:tr>
      <w:tr>
        <!-- Riga Valori -->
        ${weatherValueRow}
      </w:tr>
    </w:tbl>`;
    docParts.push(weatherTableMarkup);

    // Spaziatura
    docParts.push('<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>');

    // =========================================================================
    // SEZIONE 1: LAVORAZIONI ESEGUITE (Completamente Editabile)
    // =========================================================================
    docParts.push(buildSectionHeader(1, 'LAVORAZIONI ESEGUITE'));

    const rawLavorazioni = (data.lavorazioni && typeof data.lavorazioni === 'string')
      ? data.lavorazioni.trim()
      : '';
    const isNaLavorazioni = !rawLavorazioni || rawLavorazioni === 'Nessuna attività oggi' || data.naLavorazioni;

    let lavorazioniParagraphsXml = '';
    if (isNaLavorazioni) {
      lavorazioniParagraphsXml = `<w:p>
        <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:i/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>Nessuna attività segnalata per la giornata odierna.</w:t></w:r>
      </w:p>`;
    } else {
      const lines = rawLavorazioni.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        lavorazioniParagraphsXml += `<w:p>
          <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
          <w:r><w:t>${escapeXml(line)}</w:t></w:r>
        </w:p>`;
      }
    }

    const sec1TableMarkup = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
            <w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          ${lavorazioniParagraphsXml}
        </w:tc>
      </w:tr>
    </w:tbl>`;
    docParts.push(sec1TableMarkup);

    // Spaziatura
    docParts.push('<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>');

    // =========================================================================
    // SEZIONE 2: PERSONALE PRESENTE (Tabella Affiancata a 2 Colonne)
    // =========================================================================
    docParts.push(buildSectionHeader(2, 'PERSONALE PRESENTE'));

    const operaiList = Array.isArray(data.operai) ? data.operai : [];
    const vitTotal = (data.totaleOperaiVittorini !== undefined && data.totaleOperaiVittorini !== null)
      ? data.totaleOperaiVittorini
      : operaiList.length;

    // A. Costruzione Tabella Interna Vittorini (Colonna 1..8 e 9..16 a 4 sottocolonne)
    // A. Costruzione Tabella Interna Vittorini (Colonna 1..8 e 9..16 a 6 sottocolonne con colonna Ore dedicata)
    let vitRowsXml = '';
    const vitRowCount = Math.max(8, Math.ceil(operaiList.length / 2));
    for (let r = 0; r < vitRowCount; r++) {
      const idxLeft = r;
      const idxRight = r + vitRowCount;
      const numLeft = idxLeft + 1;
      const numRight = idxRight + 1;
      const opLeft = operaiList[idxLeft];
      const opRight = operaiList[idxRight];

      const rawNameLeft = typeof opLeft === 'string' ? opLeft : (opLeft && opLeft.nome ? opLeft.nome : '');
      const hoursLeft = (opLeft && typeof opLeft === 'object' && opLeft.ore) ? opLeft.ore : null;

      const rawNameRight = typeof opRight === 'string' ? opRight : (opRight && opRight.nome ? opRight.nome : '');
      const hoursRight = (opRight && typeof opRight === 'object' && opRight.ore) ? opRight.ore : null;

      vitRowsXml += `<w:tr>
        <!-- Sub-colonna Sinistra N° -->
        <w:tc>
          <w:tcPr><w:tcW w:w="360" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:right w:w="20" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>${numLeft}</w:t></w:r></w:p>
        </w:tc>
        <!-- Sub-colonna Sinistra Nome -->
        <w:tc>
          <w:tcPr><w:tcW w:w="1540" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${escapeXml(rawNameLeft)}</w:t></w:r></w:p>
        </w:tc>
        <!-- Sub-colonna Sinistra Ore -->
        <w:tc>
          <w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:right w:w="20" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="16"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${hoursLeft ? hoursLeft + 'h' : ''}</w:t></w:r></w:p>
        </w:tc>
        <!-- Sub-colonna Destra N° -->
        <w:tc>
          <w:tcPr><w:tcW w:w="360" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:right w:w="20" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>${numRight}</w:t></w:r></w:p>
        </w:tc>
        <!-- Sub-colonna Destra Nome -->
        <w:tc>
          <w:tcPr><w:tcW w:w="1540" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${escapeXml(rawNameRight)}</w:t></w:r></w:p>
        </w:tc>
        <!-- Sub-colonna Destra Ore -->
        <w:tc>
          <w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:right w:w="20" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="16"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${hoursRight ? hoursRight + 'h' : ''}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    }

    const vitHours = (data.totaleOreVittorini !== undefined && data.totaleOreVittorini !== null)
      ? ` (${data.totaleOreVittorini}h)`
      : '';

    const vitTableXml = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <!-- Intestazione Personale Vittorini -->
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:gridSpan w:val="6"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.lightRowBg}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>Personale Vittorini Costruzioni</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
      ${vitRowsXml}
      <!-- Riga Finale Totale Vittorini -->
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:gridSpan w:val="6"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>Totale personale Vittorini Costruzioni: </w:t></w:r>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${vitTotal}${vitHours}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;

    // B. Costruzione Tabella Interna Subappaltatori
    const subList = Array.isArray(data.subappalti) ? data.subappalti : [];
    let subTotal = 0;
    if (data.totaleOperaiSubappalti !== undefined && data.totaleOperaiSubappalti !== null) {
      subTotal = data.totaleOperaiSubappalti;
    } else {
      subTotal = subList.reduce((sum, s) => sum + (Number(s.operai) || 0), 0);
    }

    let subRowsXml = '';
    const subRowCount = Math.max(8, subList.length);
    for (let i = 0; i < subRowCount; i++) {
      const item = subList[i];
      const dittaStr = item ? (item.ditta || item.nome || '').toUpperCase() : '';
      const opCount = item && item.operai !== undefined ? item.operai : '';
      const lavStr = item ? (item.lavorazione || item.mansione || '') : '';

      subRowsXml += `<w:tr>
        <!-- N° -->
        <w:tc>
          <w:tcPr><w:tcW w:w="450" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>${i + 1}</w:t></w:r></w:p>
        </w:tc>
        <!-- Ditta -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2150" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${escapeXml(dittaStr)}</w:t></w:r></w:p>
        </w:tc>
        <!-- N° Operai -->
        <w:tc>
          <w:tcPr><w:tcW w:w="800" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${opCount !== '' ? opCount + ' op.' : ''}</w:t></w:r></w:p>
        </w:tc>
        <!-- Lavorazione -->
        <w:tc>
          <w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tcMar></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${escapeXml(lavStr)}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    }

    const subTableXml = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.accentBlue}"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <!-- Intestazione Subappaltatori -->
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:gridSpan w:val="4"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.lightRowBg}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>Subappaltatori</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
      ${subRowsXml}
      <!-- Riga Finale Totale Subappaltatori -->
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:gridSpan w:val="4"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/>
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>Totale personale Subappaltatori: </w:t></w:r>
            <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${subTotal}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;

    // C. Tabella Contenitore Affiancata (2 Colonne affiancate di larghezza 5000 + 306 gap)
    const sec2ContainerTable = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <!-- Colonna Sinistra Vittorini -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:vAlign w:val="top"/>
            <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          ${vitTableXml}
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>
        </w:tc>
        <!-- Spaziatore Centrale -->
        <w:tc>
          <w:tcPr><w:tcW w:w="306" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>
        </w:tc>
        <!-- Colonna Destra Subappaltatori -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:vAlign w:val="top"/>
            <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          ${subTableXml}
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;
    docParts.push(sec2ContainerTable);

    // Spaziatura
    docParts.push('<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>');

    // =========================================================================
    // SEZIONE 3: NOTE GENERALI & D.L. (Note, Noleggi, Materiali)
    // =========================================================================
    docParts.push(buildSectionHeader(3, 'NOTE GENERALI & D.L.'));

    const rawNote = (data.note && typeof data.note === 'string') ? data.note.trim() : '';
    const isNaNote = !rawNote || rawNote === 'Nessuna nota' || data.nessunaNota;

    const noleggiList = Array.isArray(data.noleggi)
      ? data.noleggi.map(n => {
          if (typeof n === 'string') return n;
          const mezzo = n.mezzo || n.nome || '';
          const ore = n.ore ? ` (${n.ore}h)` : '';
          return (mezzo + ore).trim();
        }).filter(Boolean)
      : [];
    const rawMateriali = (data.materiali && typeof data.materiali === 'string') ? data.materiali.trim() : '';
    const hasMateriali = rawMateriali && rawMateriali !== 'Nessun materiale oggi' && !data.nessunMateriale;

    let noteParagraphsXml = '';
    if (isNaNote && noleggiList.length === 0 && !hasMateriali) {
      noteParagraphsXml = `<w:p>
        <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:i/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>Nessuna annotazione particolare o ordine della D.L.</w:t></w:r>
      </w:p>`;
    } else {
      if (!isNaNote) {
        noteParagraphsXml += `<w:p>
          <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
          <w:r><w:rPr><w:b/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t xml:space="preserve">Note di cantiere: </w:t></w:r>
          <w:r><w:t>${escapeXml(rawNote)}</w:t></w:r>
        </w:p>`;
      }
      if (noleggiList.length > 0 && !data.nessunNoleggio) {
        noteParagraphsXml += `<w:p>
          <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
          <w:r><w:rPr><w:b/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t xml:space="preserve">Noleggi / Macchinari presenti: </w:t></w:r>
          <w:r><w:t>${escapeXml(noleggiList.join(', '))}</w:t></w:r>
        </w:p>`;
      }
      if (hasMateriali) {
        noteParagraphsXml += `<w:p>
          <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
          <w:r><w:rPr><w:b/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t xml:space="preserve">Forniture / Materiali arrivati: </w:t></w:r>
          <w:r><w:t>${escapeXml(rawMateriali)}</w:t></w:r>
        </w:p>`;
      }
    }

    const sec3TableMarkup = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
            <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          ${noteParagraphsXml}
        </w:tc>
      </w:tr>
    </w:tbl>`;
    docParts.push(sec3TableMarkup);

    // Spaziatura
    docParts.push('<w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>');

    // =========================================================================
    // SEZIONE 4: FOTOGRAFIE DI CANTIERE (0..8 Foto, max 4 per pagina)
    // =========================================================================
    if (photoEntries.length === 0) {
      // 0 Foto: mostrata in calce a Pagina 1
      docParts.push(buildSectionHeader(4, 'FOTOGRAFIE DI CANTIERE'));
      const noPhotosBox = `<w:tbl>
        <w:tblPr>
          <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="${DOCX_GEOMETRY.colors.borderSubtle}"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
              <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r><w:rPr><w:i/><w:color w:val="${DOCX_GEOMETRY.colors.textMuted}"/></w:rPr><w:t>Nessuna fotografia allegata per la giornata odierna.</w:t></w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>`;
      docParts.push(noPhotosBox);
    } else {
      // Se presenti foto: interruzione di pagina per spostarle su pagine dedicate (max 4 per pagina in griglia 2x2)
      const PHOTOS_PER_PAGE = 4;
      const photoColW = 5000;
      const imgWidthEmu = 3111500;
      const imgHeightEmu = 2333625;

      for (let pageStart = 0; pageStart < photoEntries.length; pageStart += PHOTOS_PER_PAGE) {
        // Interruzione di pagina esplicita prima di ogni blocco da 4 foto
        docParts.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>');

        const pagePhotos = photoEntries.slice(pageStart, pageStart + PHOTOS_PER_PAGE);
        const headerTitle = pageStart === 0 ? 'FOTOGRAFIE DI CANTIERE' : 'FOTOGRAFIE DI CANTIERE (CONTINUAZIONE)';
        docParts.push(buildSectionHeader(4, headerTitle));

        let photoGridRowsXml = '';
        for (let i = 0; i < pagePhotos.length; i += 2) {
          const p1 = pagePhotos[i];
          const p2 = pagePhotos[i + 1] || null;

          const cell1Xml = `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${photoColW}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/>
              <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="40"/></w:pPr>
              <w:r>${generateDrawingML(p1.relId, p1.docPrId, p1.name, imgWidthEmu, imgHeightEmu)}</w:r>
            </w:p>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20"/></w:pPr>
              <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${escapeXml(p1.caption)}</w:t></w:r>
            </w:p>
          </w:tc>`;

          let cell2Xml = '';
          if (p2) {
            cell2Xml = `<w:tc>
              <w:tcPr>
                <w:tcW w:w="${photoColW}" w:type="dxa"/>
                <w:shd w:val="clear" w:color="auto" w:fill="${DOCX_GEOMETRY.colors.subtleBg}"/>
                <w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
              </w:tcPr>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="40"/></w:pPr>
                <w:r>${generateDrawingML(p2.relId, p2.docPrId, p2.name, imgWidthEmu, imgHeightEmu)}</w:r>
              </w:p>
              <w:p>
                <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20"/></w:pPr>
                <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="${DOCX_GEOMETRY.colors.primaryBlue}"/></w:rPr><w:t>${escapeXml(p2.caption)}</w:t></w:r>
              </w:p>
            </w:tc>`;
          } else {
            cell2Xml = `<w:tc>
              <w:tcPr><w:tcW w:w="${photoColW}" w:type="dxa"/></w:tcPr>
              <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>
            </w:tc>`;
          }

          photoGridRowsXml += `<w:tr>
            ${cell1Xml}
            <!-- Spaziatore Colonna -->
            <w:tc><w:tcPr><w:tcW w:w="306" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>
            ${cell2Xml}
          </w:tr>`;
        }

        const photoGridTable = `<w:tbl>
          <w:tblPr>
            <w:tblW w:w="${DOCX_GEOMETRY.page.contentWidth}" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            </w:tblBorders>
          </w:tblPr>
          ${photoGridRowsXml}
        </w:tbl>`;
        docParts.push(photoGridTable);
      }
    }

    // =========================================================================
    // SEZIONE DI PAGINA E COLLEGAMENTO FOOTER
    // =========================================================================
    const sectPrXml = `<w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter1"/>
      <w:pgSz w:w="${DOCX_GEOMETRY.page.width}" w:h="${DOCX_GEOMETRY.page.height}"/>
      <w:pgMar w:top="${DOCX_GEOMETRY.page.marginTop}" w:right="${DOCX_GEOMETRY.page.marginRight}" w:bottom="${DOCX_GEOMETRY.page.marginBottom}" w:left="${DOCX_GEOMETRY.page.marginLeft}"/>
    </w:sectPr>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${docParts.join('\n')}
    ${sectPrXml}
  </w:body>
</w:document>`;
    packageFiles['word/document.xml'] = documentXml;

    if (options.returnFiles) {
      return packageFiles;
    }

    // =========================================================================
    // COMPRESSIONE ZIP OpenXML (.docx) TRAMITE FFLATE
    // =========================================================================
    const zipInput = {};
    for (const [filePath, content] of Object.entries(packageFiles)) {
      if (typeof content === 'string') {
        zipInput[filePath] = fflateEngine.strToU8(content);
      } else if (content instanceof Uint8Array) {
        zipInput[filePath] = content;
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
        zipInput[filePath] = new Uint8Array(content);
      } else {
        zipInput[filePath] = fflateEngine.strToU8(String(content));
      }
    }

    const zipBytes = fflateEngine.zipSync(zipInput);

    if (options.returnBuffer) {
      return (typeof Buffer !== 'undefined') ? Buffer.from(zipBytes) : zipBytes;
    }

    // Creazione Blob
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    let blob = null;
    if (typeof Blob !== 'undefined') {
      blob = new Blob([zipBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    }

    if (options.returnBlob) {
      return blob;
    }

    const autoSave = options.autoSave !== false;
    if (isBrowser && autoSave && blob) {
      triggerBrowserDownload(blob, finalFilename);
    }

    return {
      success: true,
      filename: finalFilename,
      blob: blob,
      buffer: (typeof Buffer !== 'undefined') ? Buffer.from(zipBytes) : zipBytes,
      entryCount: Object.keys(packageFiles).length,
      photoCount: photoEntries.length
    };
  }

  // ===========================================================================
  // ESPORTAZIONE AMBIENTE (BROWSER & NODE.JS)
  // ===========================================================================
  if (typeof window !== 'undefined') {
    window.generateCantiereDOCX = generateCantiereDOCX;
    window.sanitizeDocxFilename = sanitizeDocxFilename;
    window.formatDateForDocx = formatDateForDocx;
    window.DOCX_GEOMETRY = DOCX_GEOMETRY;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateCantiereDOCX,
      sanitizeDocxFilename,
      formatDateForDocx,
      DOCX_GEOMETRY
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
