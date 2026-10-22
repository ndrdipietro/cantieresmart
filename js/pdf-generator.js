/**
 * CantiereSmart - Motore di Generazione PDF (Fedele al Template Vittorini)
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Replicazione geometrica ad alta fedeltà di Template.pdf:
 * - Formato A4 Verticale (595.28 x 841.89 pt)
 * - Doppia cornice perimetrale istituzionale (#4A86E8 e #C9DAF8)
 * - Testata con Logo Vittorini e testi centrate (Titolo, Cantiere, Località, Commessa)
 * - Barra Meteo grafica con icone ufficiali e casella evidenziata
 * - Sezione 1: Lavorazioni Eseguite con righe guida tratteggiate
 * - Sezione 2: Personale Presente (Vittorini 1..16 a 2 colonne + Subappaltatori + Totali)
 * - Sezione 3: Note Generali (Note, Noleggi, Materiali)
 * - Sezione 4: Griglia Foto 2x2 per Foto 1..4 (e pagina 2 dinamica per Foto 5..8)
 * - Piè di pagina aziendale ufficiale con barra celeste
 * - Naming rigoroso YYYY-MM-DD_NomeCantiere.pdf
 * 
 * Funziona 100% offline sia su Browser che in ambiente Node.js per test.
 */

(function (global) {
  'use strict';

  // Coordinate e Dimensioni Geometriche estratte da Template.pdf (in punti tipografici pt)
  const GEOMETRY = {
    page: { width: 595.28, height: 841.89 },
    // Doppia cornice
    borderOuter: { x: 34.54, y: 28.65, w: 541.73, h: 743.24, lineWidth: 2.2, color: [74, 134, 232] }, // #4A86E8
    borderInner: { x: 50.83, y: 40.45, w: 509.15, h: 719.64, lineWidth: 1.0, color: [201, 218, 248] }, // #C9DAF8

    // Testata
    headerBox: { x: 50.83, y: 40.45, w: 509.15, h: 84.27, dividerX: 254.15 },
    logo: { x: 80.56, y: 42.13, w: 144.43, h: 80.90 },
    headerText: { centerX: 407.06, titleY: 62.0, cantiereY: 79.0, localitaY: 94.0, commessaY: 108.0 },

    // Barra Meteo & Condizioni Generali
    weatherBar: {
      x: 50.83, y: 129.77, w: 509.15, h: 60.68,
      divider1X: 152.49,
      divider2X: 457.48,
      headerLineY: 142.41
    },

    // Sezione 1: Lavorazioni Eseguite
    sec1: {
      headerY: 196.06, headerH: 12.36,
      contentX: 50.83, contentY: 208.42, contentW: 509.15, contentH: 83.14
    },

    // Sezione 2: Personale Presente
    sec2: {
      headerY: 297.18, headerH: 12.36,
      contentX: 50.83, contentY: 309.54, contentW: 509.15, contentH: 118.54,
      vittorini: { x: 51.67, w: 202.77, num1W: 16.0, name1W: 66.82, hours1W: 18.0, num2W: 16.0, name2W: 67.95, hours2W: 18.0 },
      subappalti: { x: 355.54, w: 202.76, numW: 24.99, dittaW: 76.95, countW: 24.71, labelW: 76.11 },
      rowH: 11.80,
      totalRowY: 415.44, totalRowH: 10.95
    },

    // Sezione 3: Note Generali
    sec3: {
      headerY: 433.70, headerH: 12.36,
      contentX: 50.83, contentY: 446.06, contentW: 509.15, contentH: 35.95
    },

    // Sezione 4: Foto Pagina 1 (Griglia 2x2 per Foto 1..4)
    sec4: {
      headerY: 487.63, headerH: 12.36,
      grid: {
        col1X: 51.67, col1W: 202.77,
        col2X: 355.54, col2W: 202.76,
        row1ImgY: 499.70, row1ImgH: 106.18,
        row1CapY: 605.88, row1CapH: 11.80,
        row2ImgY: 617.68, row2ImgH: 106.17,
        row2CapY: 723.85, row2CapH: 10.96
      }
    },

    // Sezione Foto Pagina 2 (Griglia 2x2 espansa per Foto 5..8)
    sec4Page2: {
      headerY: 131.0, headerH: 12.36,
      col1X: 51.67, col1W: 240.0,
      col2X: 320.0, col2W: 240.0,
      row1ImgY: 145.0, row1ImgH: 268.0,
      row1CapY: 413.0, row1CapH: 12.5,
      row2ImgY: 435.0, row2ImgH: 268.0,
      row2CapY: 703.0, row2CapH: 12.5
    },

    // Piè di Pagina
    footer: {
      x: 50.83, y: 735.37, w: 509.15, h: 24.16,
      text: "VITTORINI EMIDIO COSTRUZIONI S.r.l. - L'AQUILA",
      textY: 751.5
    },

    // Colori istituzionali
    colors: {
      blueOuter: [74, 134, 232],       // #4A86E8
      blueHeader: [43, 87, 154],       // #2B579A
      cyanInner: [201, 218, 248],      // #C9DAF8
      borderLight: [201, 218, 248],    // #C9DAF8
      tableBorder: [201, 218, 248],    // #C9DAF8
      highlightWeather: [217, 217, 217],// #D9D9D9
      textDark: [20, 20, 20],
      textWhite: [255, 255, 255]
    }
  };

  /**
   * Risolve la libreria jsPDF
   */
  function resolveJsPDF() {
    if (typeof global.jspdf !== 'undefined' && global.jspdf.jsPDF) {
      return global.jspdf.jsPDF;
    }
    if (typeof global.jsPDF === 'function') {
      return global.jsPDF;
    }
    if (typeof window !== 'undefined') {
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
      if (typeof window.jsPDF === 'function') return window.jsPDF;
    }
    if (typeof require === 'function') {
      try {
        const local = require('./lib/jspdf.umd.min.js');
        if (local && local.jsPDF) return local.jsPDF;
        if (typeof local === 'function') return local;
      } catch (e) {
        try {
          const mod = require('jspdf');
          if (mod && mod.jsPDF) return mod.jsPDF;
          if (typeof mod === 'function') return mod;
        } catch (e2) {
          // not found
        }
      }
    }
    return null;
  }

  /**
   * Risolve gli asset grafici ufficiali (logo, icone meteo, calendario, termometro)
   */
  function resolveAssets() {
    if (typeof global.TEMPLATE_ASSETS === 'object' && global.TEMPLATE_ASSETS !== null) {
      return global.TEMPLATE_ASSETS;
    }
    if (typeof window !== 'undefined' && window.TEMPLATE_ASSETS) {
      return window.TEMPLATE_ASSETS;
    }
    if (typeof require === 'function') {
      try {
        const assets = require('../assets/template-assets.js');
        if (assets) return assets;
      } catch (e) {
        // fallback
      }
    }
    // Fallback logo da logo-vittorini.js se disponibile
    const fallbackLogo = (typeof global.VITTORINI_LOGO_BASE64 === 'string')
      ? global.VITTORINI_LOGO_BASE64
      : (typeof window !== 'undefined' && window.VITTORINI_LOGO_BASE64)
        ? window.VITTORINI_LOGO_BASE64
        : null;

    return {
      logo: fallbackLogo,
      sun: null,
      cloud: null,
      rain: null,
      snow: null,
      calendar: null,
      thermometer: null
    };
  }

  /**
   * Sanifica e genera il nome file YYYY-MM-DD_NomeCantiere.pdf
   */
  function sanitizePdfFilename(dateStr, cantiereStr) {
    const d = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim()))
      ? String(dateStr).trim()
      : new Date().toISOString().slice(0, 10);

    let cleanCantiere = (typeof cantiereStr === 'string' ? cantiereStr : (cantiereStr && cantiereStr.nome ? cantiereStr.nome : '')) || 'Rapportino';
    cleanCantiere = cleanCantiere
      .trim()
      .replace(/[\/\?<>\\:\*\|":]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!cleanCantiere) cleanCantiere = 'Rapportino';
    return `${d}_${cleanCantiere}.pdf`;
  }

  /**
   * Converte data ISO AAAA-MM-GG in GG/MM/AAAA per la visualizzazione nel box
   */
  function formatDateForPdf(isoStr) {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoStr).trim())) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    const [yyyy, mm, dd] = String(isoStr).trim().split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Disegna le doppie cornici perimetrali su una pagina
   */
  function drawPageBorders(doc) {
    // Bordo Esterno Blu (#4A86E8)
    doc.setDrawColor(...GEOMETRY.colors.blueOuter);
    doc.setLineWidth(GEOMETRY.borderOuter.lineWidth);
    doc.rect(
      GEOMETRY.borderOuter.x,
      GEOMETRY.borderOuter.y,
      GEOMETRY.borderOuter.w,
      GEOMETRY.borderOuter.h,
      'S'
    );

    // Bordo Interno Celeste (#C9DAF8)
    doc.setDrawColor(...GEOMETRY.colors.cyanInner);
    doc.setLineWidth(GEOMETRY.borderInner.lineWidth);
    doc.rect(
      GEOMETRY.borderInner.x,
      GEOMETRY.borderInner.y,
      GEOMETRY.borderInner.w,
      GEOMETRY.borderInner.h,
      'S'
    );
  }

  /**
   * Disegna la testata istituzionale (Logo + Titolo + Dettagli Cantiere)
   */
  function drawHeader(doc, reportData, assets, isPage2 = false) {
    const hb = GEOMETRY.headerBox;

    // Riquadro perimetrale testata
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);
    doc.rect(hb.x, hb.y, hb.w, hb.h, 'S');

    // Linea divisoria verticale tra Logo e Testo
    doc.line(hb.dividerX, hb.y, hb.dividerX, hb.y + hb.h);

    // Disegno Logo Vittorini a sinistra
    if (assets && assets.logo) {
      try {
        const logoFormat = assets.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(
          assets.logo,
          logoFormat,
          GEOMETRY.logo.x,
          GEOMETRY.logo.y,
          GEOMETRY.logo.w,
          GEOMETRY.logo.h
        );
      } catch (e) {
        console.warn('[PDF] Errore inserimento logo testata:', e.message);
      }
    }

    // Testi a destra
    const ht = GEOMETRY.headerText;
    const cantiereNome = (typeof reportData.cantiere === 'string' ? reportData.cantiere : (reportData.cantiere && reportData.cantiere.nome ? reportData.cantiere.nome : '')) || 'Santuario Madonna delle Grazie';
    const localita = reportData.localita || (reportData.cantiere && reportData.cantiere.localita ? reportData.cantiere.localita : '') || 'Loc. Varoni, Amatrice (RI)';
    const commessa = reportData.commessa || (reportData.cantiere && reportData.cantiere.commessa ? reportData.cantiere.commessa : '') || 'Sisma 2016';

    // Titolo RAPPORTO GIORNALIERO DI CANTIERE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(...GEOMETRY.colors.blueHeader);
    const mainTitle = isPage2 ? 'RAPPORTO GIORNALIERO DI CANTIERE - FOTO' : 'RAPPORTO GIORNALIERO DI CANTIERE';
    doc.text(mainTitle, ht.centerX, ht.titleY, { align: 'center' });

    // Nome Cantiere
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GEOMETRY.colors.textDark);
    const cantiereLabel = cantiereNome.toLowerCase().startsWith('cantiere') ? cantiereNome : `Cantiere: ${cantiereNome}`;
    doc.text(cantiereLabel, ht.centerX, ht.cantiereY, { align: 'center' });

    // Località
    doc.setFontSize(10);
    doc.text(localita, ht.centerX, ht.localitaY, { align: 'center' });

    // Commessa / CUP / CIG
    let commessaLine = commessa;
    if (reportData.cup || reportData.cig) {
      const parts = [];
      if (reportData.cup && reportData.cup !== 'N/A') parts.push('CUP: ' + reportData.cup);
      if (reportData.cig && reportData.cig !== 'N/A') parts.push('CIG: ' + reportData.cig);
      if (parts.length > 0) commessaLine = parts.join(' • ');
    }
    doc.text(commessaLine, ht.centerX, ht.commessaY, { align: 'center' });
  }

  /**
   * Disegna la barra delle condizioni meteo (senza temperatura, con le 5 condizioni: Sereno, Nuvoloso, Pioggia, Neve/Gelo, Caldo Estremo)
   */
  function drawWeatherBar(doc, reportData, assets) {
    const wb = GEOMETRY.weatherBar;

    // Riquadro esterno
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);
    doc.rect(wb.x, wb.y, wb.w, wb.h, 'S');

    // Linea orizzontale separatrice header caselle
    doc.line(wb.x, wb.headerLineY, wb.x + wb.w, wb.headerLineY);

    // Divisorio verticale tra DATA e METEO
    doc.line(wb.divider1X, wb.y, wb.divider1X, wb.y + wb.h);

    // Etichette intestazione in blu bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GEOMETRY.colors.blueHeader);
    doc.text('DATA:', wb.x + 4.5, wb.y + 9.5);
    doc.text('CONDIZIONI METEO DELLA GIORNATA:', wb.divider1X + 6.0, wb.y + 9.5);

    // 1. DATA Box
    const dateFormatted = formatDateForPdf(reportData.data);
    if (assets && assets.calendar) {
      try {
        const calFormat = assets.calendar.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(assets.calendar, calFormat, wb.x + 8, wb.y + 24, 15, 15);
      } catch (e) {}
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...GEOMETRY.colors.textDark);
    doc.text(dateFormatted, wb.x + 28, wb.y + 35);

    // 2. METEO Box a 5 caselle orizzontali (Sereno, Nuvoloso, Pioggia, Neve/Gelo, Caldo Estremo)
    const selectedMeteo = String(reportData.meteo || '').toLowerCase().trim();
    const totalMeteoW = (wb.x + wb.w) - wb.divider1X; // 407.49 pt
    const colW = totalMeteoW / 5;

    const meteoOptions = [
      { key: 'sereno', label: 'SERENO', icon: assets && assets.sun, iconFormat: 'JPEG' },
      { key: 'nuvoloso', label: 'NUVOLOSO', icon: assets && assets.cloud, iconFormat: 'PNG' },
      { key: 'pioggia', label: 'PIOGGIA', icon: assets && assets.rain, iconFormat: 'JPEG' },
      { key: 'neve', label: 'NEVE / GELO', icon: assets && assets.snow, iconFormat: 'PNG' },
      { key: 'caldo', label: 'CALDO ESTREMO', icon: assets && assets.sun, iconFormat: 'JPEG' }
    ];

    meteoOptions.forEach((opt, idx) => {
      const colX = wb.divider1X + (idx * colW);
      const colY = wb.headerLineY;
      const colH = (wb.y + wb.h) - wb.headerLineY;

      // Divisore verticale tra le colonne meteo
      if (idx > 0) {
        doc.setDrawColor(...GEOMETRY.colors.borderLight);
        doc.setLineWidth(0.8);
        doc.line(colX, colY, colX, colY + colH);
      }

      // Se selezionata, evidenzia l'intera casella
      if (selectedMeteo === opt.key) {
        doc.setFillColor(...GEOMETRY.colors.highlightWeather);
        doc.rect(colX + 0.5, colY + 0.5, colW - 1, colH - 1, 'F');
      }

      // Icona grafica centrata
      if (opt.icon) {
        try {
          doc.addImage(opt.icon, opt.iconFormat, colX + (colW / 2) - 6.5, colY + 6, 13, 13);
        } catch (e) {}
      }

      // Testo etichetta centrato sotto l'icona
      doc.setFont('helvetica', selectedMeteo === opt.key ? 'bold' : 'normal');
      doc.setFontSize(selectedMeteo === opt.key ? 7.5 : 7.0);
      doc.setTextColor(...GEOMETRY.colors.textDark);
      doc.text(opt.label, colX + (colW / 2), colY + 34, { align: 'center' });
    });
  }

  /**
   * Disegna una barra di intestazione sezione (fondo celeste chiaro, numero bold e titolo)
   */
  function drawSectionBar(doc, num, title, y, customWidth = null, customX = null) {
    const x = customX !== null ? customX : GEOMETRY.borderInner.x;
    const w = customWidth !== null ? customWidth : GEOMETRY.borderInner.w;
    const h = 12.36;

    doc.setFillColor(...GEOMETRY.colors.cyanInner);
    doc.rect(x, y, w, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GEOMETRY.colors.textDark);
    doc.text(String(num), x + 11.5, y + 9.5);
    doc.text(title, x + 26.5, y + 9.5);
  }

  /**
   * Disegna la Sezione 1: LAVORAZIONI ESEGUITE
   */
  function drawSection1(doc, reportData) {
    const s1 = GEOMETRY.sec1;
    drawSectionBar(doc, 1, 'LAVORAZIONI ESEGUITE', s1.headerY);

    // Box contenitore
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);
    doc.rect(s1.contentX, s1.contentY, s1.contentW, s1.contentH, 'S');

    // Linee tratteggiate guida (come da Template.pdf)
    const lineYs = [219.66, 231.45, 243.25, 255.05, 266.85, 278.65];
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.5, 2], 0);
    lineYs.forEach(ly => {
      doc.line(s1.contentX + 1, ly, s1.contentX + s1.contentW - 1, ly);
    });
    doc.setLineDashPattern([], 0); // Ripristina linea continua

    // Testo lavorazioni inserite
    const rawText = reportData.lavorazioni || '';
    if (rawText && rawText.trim() && rawText.trim() !== 'Nessuna attività oggi') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...GEOMETRY.colors.textDark);

      // Suddivisione in righe per non sforare la larghezza
      const lines = doc.splitTextToSize(rawText.trim(), s1.contentW - 10);
      let textY = s1.contentY + 8.5;
      lines.slice(0, 6).forEach((line) => {
        doc.text(line, s1.contentX + 4, textY);
        textY += 11.8;
      });
    }
  }

  /**
   * Disegna la Sezione 2: PERSONALE PRESENTE
   */
  function drawSection2(doc, reportData) {
    const s2 = GEOMETRY.sec2;
    drawSectionBar(doc, 2, 'PERSONALE PRESENTE', s2.headerY);

    // Box perimetrale esterno della sezione personale
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);
    doc.rect(s2.contentX, s2.contentY, s2.contentW, s2.contentH, 'S');

    // -----------------------------------------------------------------------
    // A. TABELLA SINISTRA: Personale Vittorini Costruzioni (2 colonne da 8)
    // -----------------------------------------------------------------------
    const vit = s2.vittorini;
    // Riquadro tabella Vittorini
    doc.rect(vit.x, s2.contentY, vit.w, s2.contentH - s2.totalRowH, 'S');

    // Intestazione tabella
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.0);
    doc.setTextColor(...GEOMETRY.colors.textDark);
    doc.text('Personale Vittorini Costruzioni', vit.x + (vit.w / 2), s2.contentY + 8.5, { align: 'center' });

    // Linea orizzontale sotto intestazione
    doc.line(vit.x, s2.contentY + 11.52, vit.x + vit.w, s2.contentY + 11.52);

    // Divisorio verticale tra sub-colonna 1..8 e sub-colonna 9..16
    const vitMidX = vit.x + vit.num1W + vit.name1W + vit.hours1W;
    doc.line(vitMidX, s2.contentY + 11.52, vitMidX, s2.contentY + s2.contentH - s2.totalRowH);

    // Divisori verticali interni: N°, Nominativo, Ore
    const vitNum1DivX = vit.x + vit.num1W;
    const vitHours1DivX = vitNum1DivX + vit.name1W;
    const vitNum2DivX = vitMidX + vit.num2W;
    const vitHours2DivX = vitNum2DivX + vit.name2W;

    doc.line(vitNum1DivX, s2.contentY + 11.52, vitNum1DivX, s2.contentY + s2.contentH - s2.totalRowH);
    doc.line(vitHours1DivX, s2.contentY + 11.52, vitHours1DivX, s2.contentY + s2.contentH - s2.totalRowH);
    doc.line(vitNum2DivX, s2.contentY + 11.52, vitNum2DivX, s2.contentY + s2.contentH - s2.totalRowH);
    doc.line(vitHours2DivX, s2.contentY + 11.52, vitHours2DivX, s2.contentY + s2.contentH - s2.totalRowH);

    // Estrazione nominativi operai Vittorini
    const operaiList = Array.isArray(reportData.operai) ? reportData.operai : [];

    // Righe da 1 a 8
    let curRowY = s2.contentY + 11.52;
    for (let i = 0; i < 8; i++) {
      const nextRowY = curRowY + s2.rowH;
      if (i < 7) {
        doc.line(vit.x, nextRowY, vit.x + vit.w, nextRowY);
      }

      // Numeri
      const numLeft = i + 1;
      const numRight = i + 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.text(String(numLeft), vit.x + (vit.num1W / 2), curRowY + 8.5, { align: 'center' });
      doc.text(String(numRight), vitMidX + (vit.num2W / 2), curRowY + 8.5, { align: 'center' });

      // Nomi operai e ore in colonna separata
      const opLeft = operaiList[i];
      const opRight = operaiList[i + 8];

      const nameLeft = typeof opLeft === 'string' ? opLeft : (opLeft && opLeft.nome ? opLeft.nome : '');
      const hoursLeft = (opLeft && typeof opLeft === 'object' && opLeft.ore) ? opLeft.ore : null;

      const nameRight = typeof opRight === 'string' ? opRight : (opRight && opRight.nome ? opRight.nome : '');
      const hoursRight = (opRight && typeof opRight === 'object' && opRight.ore) ? opRight.ore : null;

      if (nameLeft) {
        doc.setFontSize(7.0);
        doc.text(String(nameLeft).slice(0, 16), vitNum1DivX + 2.0, curRowY + 8.5);
      }
      if (hoursLeft) {
        doc.setFontSize(7.0);
        doc.text(String(hoursLeft) + 'h', vitHours1DivX + (vit.hours1W / 2), curRowY + 8.5, { align: 'center' });
      }

      if (nameRight) {
        doc.setFontSize(7.0);
        doc.text(String(nameRight).slice(0, 16), vitNum2DivX + 2.0, curRowY + 8.5);
      }
      if (hoursRight) {
        doc.setFontSize(7.0);
        doc.text(String(hoursRight) + 'h', vitHours2DivX + (vit.hours2W / 2), curRowY + 8.5, { align: 'center' });
      }

      curRowY = nextRowY;
    }

    // Riga Totale Personale Vittorini
    const vitTotal = (reportData.totaleOperaiVittorini !== undefined && reportData.totaleOperaiVittorini !== null)
      ? reportData.totaleOperaiVittorini
      : operaiList.length;
    const vitHours = (reportData.totaleOreVittorini !== undefined && reportData.totaleOreVittorini !== null)
      ? ' (' + reportData.totaleOreVittorini + 'h)'
      : '';

    doc.line(vit.x, s2.totalRowY, vit.x + vit.w, s2.totalRowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Totale personale Vittorini Costruzioni', vit.x + 3, s2.totalRowY + 8.5);
    doc.text(String(vitTotal) + vitHours, vit.x + vit.w - 5, s2.totalRowY + 8.5, { align: 'right' });

    // -----------------------------------------------------------------------
    // B. TABELLA DESTRA: Subappaltatori (8 righe)
    // -----------------------------------------------------------------------
    const sub = s2.subappalti;
    // Riquadro tabella Subappaltatori
    doc.rect(sub.x, s2.contentY, sub.w, s2.contentH - s2.totalRowH, 'S');

    // Intestazione tabella
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.0);
    doc.text('Subappaltatori', sub.x + (sub.w / 2), s2.contentY + 8.5, { align: 'center' });

    // Linea orizzontale sotto intestazione
    doc.line(sub.x, s2.contentY + 11.52, sub.x + sub.w, s2.contentY + 11.52);

    // Divisori verticali interni Subappaltatori
    const subDiv1X = sub.x + sub.numW;
    const subDiv2X = subDiv1X + sub.dittaW;
    const subDiv3X = subDiv2X + sub.countW;

    doc.line(subDiv1X, s2.contentY + 11.52, subDiv1X, s2.contentY + s2.contentH - s2.totalRowH);
    doc.line(subDiv2X, s2.contentY + 11.52, subDiv2X, s2.contentY + s2.contentH - s2.totalRowH);
    doc.line(subDiv3X, s2.contentY + 11.52, subDiv3X, s2.contentY + s2.contentH - s2.totalRowH);

    // Estrazione dati subappalti
    const subList = Array.isArray(reportData.subappalti) ? reportData.subappalti : [];

    curRowY = s2.contentY + 11.52;
    for (let i = 0; i < 8; i++) {
      const nextRowY = curRowY + s2.rowH;
      if (i < 7) {
        doc.line(sub.x, nextRowY, sub.x + sub.w, nextRowY);
      }

      // Numero riga
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.text(String(i + 1), sub.x + (sub.numW / 2), curRowY + 8.5, { align: 'center' });

      // Dati subappalto
      const item = subList[i];
      if (item) {
        const dittaStr = (item.ditta || item.nome || '').toUpperCase();
        const opCount = item.operai !== undefined ? item.operai : '';

        doc.setFontSize(7.0);
        // Troncamento ditta pulito per non invadere la colonna conteggio
        doc.text(dittaStr.slice(0, 16), subDiv1X + 2.5, curRowY + 8.5);

        if (opCount !== '') {
          doc.text(String(opCount), subDiv2X + (sub.countW / 2), curRowY + 8.5, { align: 'center' });
        }
      }

      // Dicitura fissa 'Operai' a destra (come da Template.pdf)
      doc.setFontSize(7.5);
      doc.text('Operai', subDiv3X + 4.0, curRowY + 8.5);

      curRowY = nextRowY;
    }

    // Riga Totale Personale Subappaltatori
    let subTotal = 0;
    if (reportData.totaleOperaiSubappalti !== undefined && reportData.totaleOperaiSubappalti !== null) {
      subTotal = reportData.totaleOperaiSubappalti;
    } else {
      subTotal = subList.reduce((sum, s) => sum + (Number(s.operai) || 0), 0);
    }

    doc.line(sub.x, s2.totalRowY, sub.x + sub.w, s2.totalRowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Totale personale Subappaltatori', sub.x + 3, s2.totalRowY + 8.5);
    doc.text(String(subTotal), sub.x + sub.w - 5, s2.totalRowY + 8.5, { align: 'right' });
  }

  /**
   * Disegna la Sezione 3: NOTE GENERALI (compresi noleggi e forniture se indicati)
   */
  function drawSection3(doc, reportData) {
    const s3 = GEOMETRY.sec3;
    drawSectionBar(doc, 3, 'NOTE GENERALI', s3.headerY);

    // Box contenitore
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);
    doc.rect(s3.contentX, s3.contentY, s3.contentW, s3.contentH, 'S');

    // Linee guida tratteggiate
    const lineYs = [458.0, 470.0];
    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.5, 2], 0);
    lineYs.forEach(ly => {
      doc.line(s3.contentX + 1, ly, s3.contentX + s3.contentW - 1, ly);
    });
    doc.setLineDashPattern([], 0);

    // Costruzione testo note unificate (Note + Noleggi + Materiali)
    const notePieces = [];
    if (reportData.note && reportData.note.trim() && reportData.note.trim() !== 'Nessuna nota') {
      notePieces.push(reportData.note.trim());
    }

    if (Array.isArray(reportData.noleggi) && reportData.noleggi.length > 0 && !reportData.nessunNoleggio) {
      const noleggiStr = reportData.noleggi.map(n => {
        if (typeof n === 'string') return n;
        const mezzo = n.mezzo || n.nome || '';
        const ore = n.ore ? ' (' + n.ore + 'h)' : '';
        return mezzo + ore;
      }).filter(Boolean).join(', ');
      if (noleggiStr) {
        notePieces.push(`Noleggi/Mezzi presenti: ${noleggiStr}`);
      }
    }

    if (reportData.materiali && reportData.materiali.trim() && reportData.materiali.trim() !== 'Nessun materiale oggi') {
      notePieces.push(`Forniture/Materiali: ${reportData.materiali.trim()}`);
    }

    const fullNoteText = notePieces.join(' | ');
    if (fullNoteText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.setTextColor(...GEOMETRY.colors.textDark);
      const lines = doc.splitTextToSize(fullNoteText, s3.contentW - 10);
      let textY = s3.contentY + 8.5;
      lines.slice(0, 3).forEach(line => {
        doc.text(line, s3.contentX + 4, textY);
        textY += 11.5;
      });
    }
  }

  /**
   * Helper per inserire un'immagine preservando le proporzioni dentro un rettangolo limite
   */
  function fitAndDrawImage(doc, imgData, boxX, boxY, boxW, boxH) {
    if (!imgData) return;
    try {
      let imgRatio = 1.0;
      let format = 'JPEG';

      if (typeof doc.getImageProperties === 'function') {
        try {
          const props = doc.getImageProperties(imgData);
          if (props && props.width && props.height) {
            imgRatio = props.width / props.height;
            format = props.fileType || (imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG');
          }
        } catch (eProps) {
          format = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        }
      } else {
        format = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      }

      const pad = 1.5;
      const availW = boxW - (pad * 2);
      const availH = boxH - (pad * 2);
      const boxRatio = availW / availH;

      let targetW, targetH;
      if (imgRatio > boxRatio) {
        targetW = availW;
        targetH = availW / imgRatio;
      } else {
        targetH = availH;
        targetW = availH * imgRatio;
      }

      const targetX = boxX + pad + (availW - targetW) / 2;
      const targetY = boxY + pad + (availH - targetH) / 2;

      doc.addImage(imgData, format, targetX, targetY, targetW, targetH);
    } catch (e) {
      console.warn('[PDF] Errore inserimento foto:', e.message);
    }
  }

  /**
   * Disegna la Sezione 4: FOTO Pagina 1 (Griglia 2x2 per Foto 1..4)
   */
  function drawPhotoGridPage1(doc, photos) {
    const g = GEOMETRY.sec4.grid;
    drawSectionBar(doc, 4, 'FOTO', GEOMETRY.sec4.headerY);

    const items = [
      {
        num: 1,
        imgX: g.col1X, imgY: g.row1ImgY, imgW: g.col1W, imgH: g.row1ImgH,
        capX: g.col1X, capY: g.row1CapY, capW: g.col1W, capH: g.row1CapH
      },
      {
        num: 2,
        imgX: g.col2X, imgY: g.row1ImgY, imgW: g.col2W, imgH: g.row1ImgH,
        capX: g.col2X, capY: g.row1CapY, capW: g.col2W, capH: g.row1CapH
      },
      {
        num: 3,
        imgX: g.col1X, imgY: g.row2ImgY, imgW: g.col1W, imgH: g.row2ImgH,
        capX: g.col1X, capY: g.row2CapY, capW: g.col1W, capH: g.row2CapH
      },
      {
        num: 4,
        imgX: g.col2X, imgY: g.row2ImgY, imgW: g.col2W, imgH: g.row2ImgH,
        capX: g.col2X, capY: g.row2CapY, capW: g.col2W, capH: g.row2CapH
      }
    ];

    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);

    items.forEach((slot, idx) => {
      // 1. Riquadro Immagine
      doc.rect(slot.imgX, slot.imgY, slot.imgW, slot.imgH, 'S');

      // 2. Riquadro Barra Didascalia
      doc.rect(slot.capX, slot.capY, slot.capW, slot.capH, 'S');

      // 3. Testo Didascalia 'Foto X' con didascalia personalizzata
      const photoObj = photos[idx];
      const rawCap = (photoObj && (photoObj.caption || photoObj.didascalia)) ? (photoObj.caption || photoObj.didascalia).trim() : '';
      const capText = rawCap ? 'Foto ' + slot.num + ': ' + rawCap : 'Foto ' + slot.num;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GEOMETRY.colors.textDark);
      doc.text(capText.slice(0, 36), slot.capX + 4.0, slot.capY + 8.5);

      // 4. Inserimento Immagine se presente
      if (photoObj) {
        const dataUrl = photoObj.dataUrl || photoObj.url || (typeof photoObj === 'string' ? photoObj : null);
        if (dataUrl) {
          fitAndDrawImage(doc, dataUrl, slot.imgX, slot.imgY, slot.imgW, slot.imgH);
        }
      }
    });
  }

  /**
   * Disegna la Sezione Foto su Pagina 2 (Foto 5..8)
   */
  function drawPhotoGridPage2(doc, photos) {
    const p2 = GEOMETRY.sec4Page2;
    drawSectionBar(doc, 4, 'FOTO (CONTINUAZIONE - FOTO 5 - 8)', p2.headerY);

    const items = [
      {
        num: 5,
        imgX: p2.col1X, imgY: p2.row1ImgY, imgW: p2.col1W, imgH: p2.row1ImgH,
        capX: p2.col1X, capY: p2.row1CapY, capW: p2.col1W, capH: p2.row1CapH
      },
      {
        num: 6,
        imgX: p2.col2X, imgY: p2.row1ImgY, imgW: p2.col2W, imgH: p2.row1ImgH,
        capX: p2.col2X, capY: p2.row1CapY, capW: p2.col2W, capH: p2.row1CapH
      },
      {
        num: 7,
        imgX: p2.col1X, imgY: p2.row2ImgY, imgW: p2.col1W, imgH: p2.row2ImgH,
        capX: p2.col1X, capY: p2.row2CapY, capW: p2.col1W, capH: p2.row2CapH
      },
      {
        num: 8,
        imgX: p2.col2X, imgY: p2.row2ImgY, imgW: p2.col2W, imgH: p2.row2ImgH,
        capX: p2.col2X, capY: p2.row2CapY, capW: p2.col2W, capH: p2.row2CapH
      }
    ];

    doc.setDrawColor(...GEOMETRY.colors.borderLight);
    doc.setLineWidth(1.0);

    items.forEach((slot, idx) => {
      // 1. Riquadro Immagine
      doc.rect(slot.imgX, slot.imgY, slot.imgW, slot.imgH, 'S');

      // 2. Riquadro Barra Didascalia
      doc.rect(slot.capX, slot.capY, slot.capW, slot.capH, 'S');

      // 3. Testo Didascalia 'Foto X' con didascalia personalizzata
      const photoObj = photos[4 + idx];
      const rawCap = (photoObj && (photoObj.caption || photoObj.didascalia)) ? (photoObj.caption || photoObj.didascalia).trim() : '';
      const capText = rawCap ? 'Foto ' + slot.num + ': ' + rawCap : 'Foto ' + slot.num;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.setTextColor(...GEOMETRY.colors.textDark);
      doc.text(capText.slice(0, 42), slot.capX + 5.0, slot.capY + 9.0);

      // 4. Inserimento Immagine se presente
      if (photoObj) {
        const dataUrl = photoObj.dataUrl || photoObj.url || (typeof photoObj === 'string' ? photoObj : null);
        if (dataUrl) {
          fitAndDrawImage(doc, dataUrl, slot.imgX, slot.imgY, slot.imgW, slot.imgH);
        }
      }
    });
  }

  /**
   * Disegna il piè di pagina istituzionale
   */
  function drawFooter(doc) {
    const f = GEOMETRY.footer;
    // Barra azzurra con dicitura ufficiale
    doc.setFillColor(...GEOMETRY.colors.cyanInner);
    doc.rect(f.x, f.y, f.w, f.h, 'F');

    // Testo centrato bianco bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...GEOMETRY.colors.textWhite);
    doc.text(f.text, f.x + (f.w / 2), f.textY, { align: 'center' });
  }

  /**
   * Funzione Principale di Generazione del PDF Rapportino
   * 
   * @param {Object} reportData - Oggetto contenente tutti i dati del rapportino
   * @param {Object} [options] - Opzioni opzionali:
   *   - autoSave: boolean (default true se in browser)
   *   - returnBlob: boolean (restituisce Blob)
   *   - returnBuffer: boolean (restituisce Buffer in Node.js)
   *   - returnDoc: boolean (restituisce istanza jsPDF)
   *   - filename: string (override nome file)
   * @returns {Promise<Blob|Buffer|Object>}
   */
  async function generateCantierePDF(reportData, options = {}) {
    const jsPDFClass = resolveJsPDF();
    if (!jsPDFClass) {
      throw new Error('Libreria jsPDF non trovata. Verificare jspdf.umd.min.js.');
    }

    const assets = resolveAssets();
    const data = reportData || {};

    // Inizializzazione documento A4 in pt (595.28 x 841.89 pt)
    const doc = new jsPDFClass({
      orientation: 'portrait',
      unit: 'pt',
      format: [GEOMETRY.page.width, GEOMETRY.page.height]
    });

    // -------------------------------------------------------------------------
    // PAGINA 1
    // -------------------------------------------------------------------------
    drawPageBorders(doc);
    drawHeader(doc, data, assets, false);
    drawWeatherBar(doc, data, assets);
    drawSection1(doc, data);
    drawSection2(doc, data);
    drawSection3(doc, data);

    const photos = Array.isArray(data.foto) ? data.foto : [];
    drawPhotoGridPage1(doc, photos);
    drawFooter(doc);

    // -------------------------------------------------------------------------
    // PAGINA 2 (Dinamica solo se presenti da 5 a 8 foto)
    // -------------------------------------------------------------------------
    if (photos.length > 4) {
      doc.addPage([GEOMETRY.page.width, GEOMETRY.page.height], 'portrait');
      drawPageBorders(doc);
      drawHeader(doc, data, assets, true);
      drawPhotoGridPage2(doc, photos);
      drawFooter(doc);
    }

    // Determinazione del nome file ufficiale: YYYY-MM-DD_NomeCantiere.pdf
    const finalFilename = options.filename || sanitizePdfFilename(data.data, data.cantiere);

    // Restituzione in base all'ambiente e alle opzioni
    if (options.returnDoc) {
      return doc;
    }

    if (options.returnBuffer) {
      const arrayBuffer = doc.output('arraybuffer');
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(arrayBuffer);
      }
      return arrayBuffer;
    }

    if (options.returnBlob) {
      return doc.output('blob');
    }

    // Comportamento default in ambiente Browser: download immediato
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    const autoSave = options.autoSave !== false;

    if (isBrowser && autoSave) {
      doc.save(finalFilename);
    }

    const blob = isBrowser ? doc.output('blob') : null;
    return {
      success: true,
      filename: finalFilename,
      blob: blob,
      doc: doc,
      pageCount: doc.getNumberOfPages()
    };
  }

  // Esportazione sia per Browser (window.generateCantierePDF) che per Node.js
  if (typeof window !== 'undefined') {
    window.generateCantierePDF = generateCantierePDF;
    window.sanitizePdfFilename = sanitizePdfFilename;
    window.formatDateForPdf = formatDateForPdf;
    window.PDF_GEOMETRY = GEOMETRY;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateCantierePDF,
      sanitizePdfFilename,
      formatDateForPdf,
      GEOMETRY
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
