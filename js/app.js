/**
 * CantiereSmart - Core App Logic & 9 Interactive Green-Check Boxes
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Gestisce lo stato reattivo del rapportino di cantiere, la validazione a spunta
 * verde per ciascuno dei 9 box, i pulsanti rapidi "Nessuno/N.A.", la compressione
 * canvas delle foto da smartphone (max 8) e le azioni di esportazione/salvataggio.
 */

(function (global) {
  'use strict';

  // =========================================================================
  // UTILITY HELPER
  // =========================================================================

  function getTodayIso() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function sanitizeFileName(dateStr, cantiereStr, ext) {
    const extension = ext ? (ext.startsWith('.') ? ext.slice(1) : ext) : 'pdf';
    const dateClean = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) 
      ? dateStr.trim() 
      : getTodayIso();
    
    let cantiereClean = (cantiereStr || 'Rapportino')
      .trim()
      .replace(/[\/\?<>\\:\*\|":]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!cantiereClean) cantiereClean = 'Rapportino';
    return `${dateClean}_${cantiereClean}.${extension}`;
  }

  function formatDateItalian(isoStr) {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || '';
    const [yyyy, mm, dd] = isoStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isSafeImageDataUrl(url) {
    if (typeof url !== 'string') return false;
    return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(url.trim());
  }

  // =========================================================================
  // FOTO COMPRESSOR (HTML5 Canvas Mobile Optimization)
  // =========================================================================

  const PhotoCompressor = {
    /**
     * Comprime una foto su Canvas ridimensionando a max 1280px con qualità JPEG 0.75
     * @param {File|Blob|string} fileOrData 
     * @param {number} [maxDimension=1920] 
     * @param {number} [quality=0.88] 
     * @returns {Promise<{id: string, name: string, dataUrl: string, width: number, height: number, timestamp: number}>}
     */
    compress: function (fileOrData, maxDimension = 1920, quality = 0.88) {
      return new Promise((resolve, reject) => {
        const id = 'photo_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
        const name = (fileOrData && fileOrData.name) ? fileOrData.name : 'foto_cantiere.jpg';
        const timestamp = Date.now();

        // Se siamo in ambiente Node o senza browser/canvas
        if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof FileReader === 'undefined') {
          return resolve({
            id,
            name,
            dataUrl: typeof fileOrData === 'string' ? fileOrData : 'data:image/jpeg;base64,/9j/mockedNodePhoto==',
            width: 800,
            height: 600,
            timestamp
          });
        }

        // Se è già una dataUrl string
        if (typeof fileOrData === 'string') {
          const img = new Image();
          img.onload = () => {
            const { width, height } = PhotoCompressor._calculateDimensions(img.width, img.height, maxDimension);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({ id, name, dataUrl, width, height, timestamp });
          };
          img.onerror = () => reject(new Error('Errore nel caricamento della stringa immagine.'));
          img.src = fileOrData;
          return;
        }

        // È un File o Blob
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Errore lettura file fotocamera/galleria.'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Errore decodifica immagine per compressione.'));
          img.onload = () => {
            const { width, height } = PhotoCompressor._calculateDimensions(img.width, img.height, maxDimension);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            try {
              const dataUrl = canvas.toDataURL('image/jpeg', quality);
              resolve({
                id,
                name: fileOrData.name || 'foto_cantiere.jpg',
                dataUrl,
                width,
                height,
                timestamp
              });
            } catch (err) {
              reject(err);
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(fileOrData);
      });
    },

    _calculateDimensions: function (w, h, max) {
      let width = w || max;
      let height = h || max;
      if (width > max || height > max) {
        if (width > height) {
          height = Math.round((height * max) / width);
          width = max;
        } else {
          width = Math.round((width * max) / height);
          height = max;
        }
      }
      return { width, height };
    }
  };

  // =========================================================================
  // SMART ARRAY: Array esteso per compatibilità controlli .includes('Nome')
  // =========================================================================

  class SmartArray extends Array {
    includes(target, fromIndex) {
      if (typeof target === 'string') {
        const t = target.trim().toLowerCase();
        return this.some(item => {
          if (typeof item === 'string') return item.trim().toLowerCase() === t;
          if (item && typeof item === 'object') {
            const val = (item.nome || item.mezzo || item.ditta || '').trim().toLowerCase();
            return val === t;
          }
          return false;
        });
      }
      return super.includes(target, fromIndex);
    }
  }

  // =========================================================================
  // RAPPORTINO STATE: Modello dati reattivo e regole dei 9 Box
  // =========================================================================

  class RapportinoState {
    constructor(initialData) {
      this.reset();
      if (initialData && typeof initialData === 'object') {
        this.loadFromReportData(initialData);
      }
    }

    /**
     * Ripristina lo stato pulito iniziale
     */
    reset() {
      this.id = null;
      // Box 1: Data & Cantiere
      this.data = getTodayIso();
      this.cantiere = '';
      this.localita = '';
      this.commessa = '';
      this.cup = '';
      this.cig = '';

      // Box 2: Meteo (senza temperatura)
      this.meteo = ''; // 'sereno' | 'nuvoloso' | 'pioggia' | 'neve' | 'caldo'
      this.temperatura = 22; // default retrocompatibile

      // Box 3: Lavorazioni Eseguite
      this.lavorazioni = '';
      this.naLavorazioni = false;

      // Box 4: Personale Vittorini con Ore
      this.operaiVittorini = new SmartArray(); // Array di { nome: string, ore: number }
      this.zeroOperai = false;

      // Box 5: Subappaltatori
      this.subappaltatori = new SmartArray(); // Array di { ditta: string, operai: number, lavorazione: string }
      this.nessunSubappalto = false;

      // Box 6: Noleggi & Mezzi con Ore
      this.noleggi = new SmartArray(); // Array di { mezzo: string, ore: number }
      this.nessunNoleggio = false;

      // Box 7: Materiali
      this.materiali = '';
      this.nessunMateriale = false;

      // Box 8: Note Generali & D.L.
      this.note = '';
      this.nessunaNota = false;

      // Box 9: Foto di Cantiere (0..8) con Didascalia
      this.foto = []; // Array di { id, name, dataUrl, width, height, timestamp, caption }
      this.nessunaFoto = false;

      return this;
    }

    // -----------------------------------------------------------------------
    // REGOLE DI COMPLETAMENTO DEI 9 BOX (Spunta Verde)
    // -----------------------------------------------------------------------

    /**
     * Box 1: Data & Cantiere
     * Verde se Data e Cantiere sono entrambi valorizzati.
     */
    isBox1Complete() {
      return Boolean(this.data && this.data.trim() && this.cantiere && this.cantiere.trim());
    }

    /**
     * Box 2: Meteo & Temperatura
     * Verde appena è selezionata una condizione meteo valida.
     */
    isBox2Complete() {
      const valid = ['sereno', 'nuvoloso', 'pioggia', 'neve', 'caldo'];
      return Boolean(this.meteo && valid.includes(this.meteo.toLowerCase()));
    }

    /**
     * Box 3: Lavorazioni Eseguite
     * Verde se presente testo oppure se segnato "Nessuna attività oggi".
     */
    isBox3Complete() {
      return Boolean(this.naLavorazioni || (this.lavorazioni && this.lavorazioni.trim().length > 0));
    }

    /**
     * Box 4: Personale Vittorini
     * Verde se selezionato almeno 1 operaio OPPURE se premuto "0 Operai Vittorini".
     */
    isBox4Complete() {
      return Boolean(this.zeroOperai || (Array.isArray(this.operaiVittorini) && this.operaiVittorini.length > 0));
    }

    /**
     * Box 5: Subappaltatori
     * Verde se presente almeno 1 subappalto OPPURE se segnato "Nessun subappaltatore".
     */
    isBox5Complete() {
      return Boolean(this.nessunSubappalto || (Array.isArray(this.subappaltatori) && this.subappaltatori.length > 0));
    }

    /**
     * Box 6: Noleggi & Mezzi
     * Verde se presente almeno 1 noleggio OPPURE se segnato "Nessun noleggio".
     */
    isBox6Complete() {
      return Boolean(this.nessunNoleggio || (Array.isArray(this.noleggi) && this.noleggi.length > 0));
    }

    /**
     * Box 7: Materiali & Forniture
     * Verde se inserito testo materiali OPPURE se segnato "Nessun materiale oggi".
     */
    isBox7Complete() {
      return Boolean(this.nessunMateriale || (this.materiali && this.materiali.trim().length > 0));
    }

    /**
     * Box 8: Note Generali & D.L.
     * Verde se inserito testo note OPPURE se segnato "Nessuna nota".
     */
    isBox8Complete() {
      return Boolean(this.nessunaNota || (this.note && this.note.trim().length > 0));
    }

    /**
     * Box 9: Foto di Cantiere
     * Verde se sono caricate da 1 a 8 foto OPPURE se segnato "Nessuna foto oggi".
     */
    isBox9Complete() {
      return Boolean(this.nessunaFoto || (Array.isArray(this.foto) && this.foto.length > 0));
    }

    /**
     * Verifica completamento per indice box (1..9)
     */
    isBoxComplete(boxIndex) {
      switch (boxIndex) {
        case 1: return this.isBox1Complete();
        case 2: return this.isBox2Complete();
        case 3: return this.isBox3Complete();
        case 4: return this.isBox4Complete();
        case 5: return this.isBox5Complete();
        case 6: return this.isBox6Complete();
        case 7: return this.isBox7Complete();
        case 8: return this.isBox8Complete();
        case 9: return this.isBox9Complete();
        default: return false;
      }
    }

    /**
     * Restituisce array di 9 booleani corrispondenti ai 9 box
     */
    getBoxStates() {
      return [
        this.isBox1Complete(),
        this.isBox2Complete(),
        this.isBox3Complete(),
        this.isBox4Complete(),
        this.isBox5Complete(),
        this.isBox6Complete(),
        this.isBox7Complete(),
        this.isBox8Complete(),
        this.isBox9Complete()
      ];
    }

    /**
     * Conteggio box completati (0..9)
     */
    getCompletedCount() {
      return this.getBoxStates().filter(Boolean).length;
    }

    /**
     * True se tutti i 9 box sono completati
     */
    isAllComplete() {
      return this.getCompletedCount() === 9;
    }

    // -----------------------------------------------------------------------
    // MUTATORI DELLO STATO CON REATTIVITÀ
    // -----------------------------------------------------------------------

    // Box 1
    setDate(dateStr) {
      this.data = (dateStr || '').trim();
      return this;
    }

    setCantiere(nome, localita, commessa, cup, cig) {
      this.cantiere = (nome || '').trim();
      if (typeof localita === 'string') this.localita = localita.trim();
      if (typeof commessa === 'string') this.commessa = commessa.trim();
      if (typeof cup === 'string') this.cup = cup.trim();
      if (typeof cig === 'string') this.cig = cig.trim();
      return this;
    }

    setLocalita(loc) {
      this.localita = (loc || '').trim();
      return this;
    }

    setCommessa(comm) {
      this.commessa = (comm || '').trim();
      return this;
    }

    setCup(cup) {
      this.cup = (cup || '').trim();
      return this;
    }

    setCig(cig) {
      this.cig = (cig || '').trim();
      return this;
    }

    // Box 2
    setMeteo(condizione) {
      const c = (condizione || '').trim().toLowerCase();
      this.meteo = (this.meteo === c) ? '' : c; // toggle se già selezionato
      return this;
    }

    setTemperatura(gradi) {
      const num = Number(gradi);
      if (!isNaN(num)) {
        this.temperatura = Math.max(-25, Math.min(55, Math.round(num)));
      }
      return this;
    }

    adjustTemperatura(delta) {
      const current = typeof this.temperatura === 'number' ? this.temperatura : 22;
      return this.setTemperatura(current + delta);
    }

    // Box 3
    setLavorazioni(testo) {
      this.lavorazioni = testo || '';
      if (this.lavorazioni.trim().length > 0) {
        this.naLavorazioni = false;
      }
      return this;
    }

    toggleNaLavorazioni() {
      this.naLavorazioni = !this.naLavorazioni;
      if (this.naLavorazioni) {
        this.lavorazioni = '';
      }
      return this;
    }

    // Helper per estrazione nome/ore operaio
    _getOpName(op) {
      if (!op) return '';
      return typeof op === 'string' ? op.trim() : (op.nome || '').trim();
    }

    _getOpHours(op) {
      if (!op || typeof op === 'string') return 8;
      return Number(op.ore) || 8;
    }

    // Box 4: Personale Vittorini con Ore
    toggleOperaio(nome, ore = 8) {
      if (!nome) return this;
      const clean = nome.trim();
      const idx = this.operaiVittorini.findIndex(op => this._getOpName(op).toLowerCase() === clean.toLowerCase());
      if (idx !== -1) {
        this.operaiVittorini.splice(idx, 1);
      } else {
        this.operaiVittorini.push({ nome: clean, ore: Math.max(1, Math.min(24, Number(ore) || 8)) });
        this.zeroOperai = false;
      }
      return this;
    }

    addOperaio(nome, ore = 8) {
      if (!nome) return this;
      const clean = nome.trim();
      const existing = this.operaiVittorini.find(op => this._getOpName(op).toLowerCase() === clean.toLowerCase());
      if (!existing) {
        this.operaiVittorini.push({ nome: clean, ore: Math.max(1, Math.min(24, Number(ore) || 8)) });
        this.zeroOperai = false;
      } else if (ore !== undefined) {
        existing.ore = Math.max(1, Math.min(24, Number(ore) || 8));
      }
      return this;
    }

    updateOperaioOre(nome, ore) {
      if (!nome) return this;
      const clean = nome.trim();
      const existing = this.operaiVittorini.find(op => this._getOpName(op).toLowerCase() === clean.toLowerCase());
      if (existing) {
        existing.ore = Math.max(1, Math.min(24, Number(ore) || 8));
      }
      return this;
    }

    removeOperaio(nome) {
      if (!nome) return this;
      const clean = nome.trim();
      this.operaiVittorini = this.operaiVittorini.filter(op => this._getOpName(op).toLowerCase() !== clean.toLowerCase());
      return this;
    }

    toggleZeroOperai() {
      this.zeroOperai = !this.zeroOperai;
      if (this.zeroOperai) {
        this.operaiVittorini = [];
      }
      return this;
    }

    // Box 5: Subappaltatori
    addSubappaltatore(item) {
      if (!item || !item.ditta) return this;
      const ditta = item.ditta.trim();
      const operai = Math.max(1, parseInt(item.operai, 10) || 1);
      const lavorazione = (item.lavorazione || '').trim();

      this.subappaltatori.push({ ditta, operai, lavorazione });
      this.nessunSubappalto = false;
      return this;
    }

    removeSubappaltatore(index) {
      if (index >= 0 && index < this.subappaltatori.length) {
        this.subappaltatori.splice(index, 1);
      }
      return this;
    }

    toggleNessunSubappalto() {
      this.nessunSubappalto = !this.nessunSubappalto;
      if (this.nessunSubappalto) {
        this.subappaltatori = [];
      }
      return this;
    }

    // Helper per estrazione mezzo/ore noleggio
    _getNolName(n) {
      if (!n) return '';
      return typeof n === 'string' ? n.trim() : (n.mezzo || n.nome || '').trim();
    }

    _getNolHours(n) {
      if (!n || typeof n === 'string') return 8;
      return Number(n.ore) || 8;
    }

    // Box 6: Noleggi con Ore
    toggleNoleggio(mezzo, ore = 8) {
      if (!mezzo) return this;
      const clean = mezzo.trim();
      const idx = this.noleggi.findIndex(n => this._getNolName(n).toLowerCase() === clean.toLowerCase());
      if (idx !== -1) {
        this.noleggi.splice(idx, 1);
      } else {
        this.noleggi.push({ mezzo: clean, ore: Math.max(1, Math.min(24, Number(ore) || 8)) });
        this.nessunNoleggio = false;
      }
      return this;
    }

    addNoleggio(mezzo, ore = 8) {
      if (!mezzo) return this;
      const clean = mezzo.trim();
      const existing = this.noleggi.find(n => this._getNolName(n).toLowerCase() === clean.toLowerCase());
      if (!existing) {
        this.noleggi.push({ mezzo: clean, ore: Math.max(1, Math.min(24, Number(ore) || 8)) });
        this.nessunNoleggio = false;
      } else if (ore !== undefined) {
        existing.ore = Math.max(1, Math.min(24, Number(ore) || 8));
      }
      return this;
    }

    updateNoleggioOre(mezzo, ore) {
      if (!mezzo) return this;
      const clean = mezzo.trim();
      const existing = this.noleggi.find(n => this._getNolName(n).toLowerCase() === clean.toLowerCase());
      if (existing) {
        existing.ore = Math.max(1, Math.min(24, Number(ore) || 8));
      }
      return this;
    }

    removeNoleggio(mezzoOrIndex) {
      if (typeof mezzoOrIndex === 'number') {
        if (mezzoOrIndex >= 0 && mezzoOrIndex < this.noleggi.length) {
          this.noleggi.splice(mezzoOrIndex, 1);
        }
      } else if (typeof mezzoOrIndex === 'string') {
        const clean = mezzoOrIndex.trim().toLowerCase();
        this.noleggi = this.noleggi.filter(n => this._getNolName(n).toLowerCase() !== clean);
      }
      return this;
    }

    toggleNessunNoleggio() {
      this.nessunNoleggio = !this.nessunNoleggio;
      if (this.nessunNoleggio) {
        this.noleggi = [];
      }
      return this;
    }

    // Box 7
    setMateriali(testo) {
      this.materiali = testo || '';
      if (this.materiali.trim().length > 0) {
        this.nessunMateriale = false;
      }
      return this;
    }

    toggleNessunMateriale() {
      this.nessunMateriale = !this.nessunMateriale;
      if (this.nessunMateriale) {
        this.materiali = '';
      }
      return this;
    }

    // Box 8
    setNote(testo) {
      this.note = testo || '';
      if (this.note.trim().length > 0) {
        this.nessunaNota = false;
      }
      return this;
    }

    toggleNessunaNota() {
      this.nessunaNota = !this.nessunaNota;
      if (this.nessunaNota) {
        this.note = '';
      }
      return this;
    }

    // Box 9: Foto (Max 8)
    addPhoto(photoObj) {
      if (!photoObj || (!photoObj.dataUrl && !photoObj.url)) {
        return { success: false, reason: 'INVALID_PHOTO' };
      }
      if (this.foto.length >= 8) {
        return { success: false, reason: 'MAX_LIMIT_REACHED', max: 8 };
      }

      const clone = Object.assign({ caption: '' }, photoObj);
      this.foto.push(clone);
      this.nessunaFoto = false;
      return { success: true, count: this.foto.length };
    }

    setPhotoCaption(idOrIndex, caption) {
      let target = null;
      if (typeof idOrIndex === 'number') {
        target = this.foto[idOrIndex];
      } else if (typeof idOrIndex === 'string') {
        target = this.foto.find(f => f.id === idOrIndex);
      }
      if (target) {
        target.caption = caption || '';
      }
      return this;
    }

    removePhoto(idOrIndex) {
      if (typeof idOrIndex === 'number') {
        if (idOrIndex >= 0 && idOrIndex < this.foto.length) {
          this.foto.splice(idOrIndex, 1);
        }
      } else if (typeof idOrIndex === 'string') {
        this.foto = this.foto.filter(f => f.id !== idOrIndex);
      }
      return this;
    }

    toggleNessunaFoto() {
      this.nessunaFoto = !this.nessunaFoto;
      if (this.nessunaFoto) {
        this.foto = [];
      }
      return this;
    }

    // -----------------------------------------------------------------------
    // CONTEGGI & AGGREGAZIONI
    // -----------------------------------------------------------------------

    getTotals() {
      const totaleVittorini = this.zeroOperai ? 0 : this.operaiVittorini.length;
      const totaleOreVittorini = this.zeroOperai ? 0 : this.operaiVittorini.reduce((sum, op) => sum + this._getOpHours(op), 0);
      const totaleSubappaltatori = this.nessunSubappalto ? 0 : this.subappaltatori.reduce((sum, s) => sum + (Number(s.operai) || 0), 0);
      const totaleComplessivo = totaleVittorini + totaleSubappaltatori;
      const totaleFoto = this.nessunaFoto ? 0 : this.foto.length;

      return {
        totaleVittorini,
        totaleOreVittorini,
        totaleSubappaltatori,
        totaleComplessivo,
        totaleFoto
      };
    }

    getPreviewFileName(ext = 'pdf') {
      return sanitizeFileName(this.data, this.cantiere, ext);
    }

    // -----------------------------------------------------------------------
    // SERIALIZZAZIONE & CARICAMENTO
    // -----------------------------------------------------------------------

    toReportData() {
      const totals = this.getTotals();
      return {
        id: this.id || undefined,
        data: this.data,
        cantiere: this.cantiere,
        localita: this.localita,
        commessa: this.commessa,
        cup: this.cup || '',
        cig: this.cig || '',
        meteo: this.meteo,
        temperatura: this.temperatura,
        lavorazioni: this.naLavorazioni ? 'Nessuna attività oggi' : this.lavorazioni,
        naLavorazioni: this.naLavorazioni,
        operai: this.zeroOperai ? [] : this.operaiVittorini.map(op => ({
          nome: this._getOpName(op),
          ore: this._getOpHours(op)
        })),
        totaleOperaiVittorini: totals.totaleVittorini,
        totaleOreVittorini: totals.totaleOreVittorini,
        zeroOperai: this.zeroOperai,
        subappalti: this.nessunSubappalto ? [] : this.subappaltatori.map(s => ({ ...s })),
        totaleOperaiSubappalti: totals.totaleSubappaltatori,
        nessunSubappalto: this.nessunSubappalto,
        noleggi: this.nessunNoleggio ? [] : this.noleggi.map(n => ({
          mezzo: this._getNolName(n),
          ore: this._getNolHours(n)
        })),
        nessunNoleggio: this.nessunNoleggio,
        materiali: this.nessunMateriale ? 'Nessun materiale oggi' : this.materiali,
        nessunMateriale: this.nessunMateriale,
        note: this.nessunaNota ? 'Nessuna nota' : this.note,
        nessunaNota: this.nessunaNota,
        foto: this.nessunaFoto ? [] : this.foto.map(f => ({ ...f, caption: f.caption || '' })),
        totaleFoto: totals.totaleFoto,
        nessunaFoto: this.nessunaFoto,
        totaleComplessivoPersonale: totals.totaleComplessivo,
        completedCount: this.getCompletedCount(),
        isComplete: this.isAllComplete(),
        updatedAt: new Date().toISOString()
      };
    }

    loadFromReportData(data) {
      if (!data || typeof data !== 'object') return this;
      this.id = data.id || null;
      this.data = data.data || getTodayIso();
      this.cantiere = (typeof data.cantiere === 'string' ? data.cantiere : (data.cantiere && data.cantiere.nome ? data.cantiere.nome : '')) || '';
      this.localita = data.localita || (data.cantiere && data.cantiere.localita ? data.cantiere.localita : '') || '';
      this.commessa = data.commessa || (data.cantiere && data.cantiere.commessa ? data.cantiere.commessa : '') || '';
      this.cup = data.cup || (data.cantiere && data.cantiere.cup ? data.cantiere.cup : '') || '';
      this.cig = data.cig || (data.cantiere && data.cantiere.cig ? data.cantiere.cig : '') || '';

      this.meteo = (data.meteo || '').toLowerCase();
      this.temperatura = typeof data.temperatura === 'number' ? data.temperatura : 22;

      this.naLavorazioni = Boolean(data.naLavorazioni);
      this.lavorazioni = this.naLavorazioni ? '' : (data.lavorazioni || '');

      this.zeroOperai = Boolean(data.zeroOperai);
      this.operaiVittorini = new SmartArray();
      if (Array.isArray(data.operai)) {
        data.operai.forEach(op => {
          if (typeof op === 'string') this.operaiVittorini.push({ nome: op, ore: 8 });
          else this.operaiVittorini.push({ nome: op.nome || '', ore: Number(op.ore) || 8 });
        });
      }

      this.nessunSubappalto = Boolean(data.nessunSubappalto);
      const rawSubs = data.subappalti || data.subappaltatori || [];
      this.subappaltatori = new SmartArray();
      if (Array.isArray(rawSubs)) {
        rawSubs.forEach(s => {
          this.subappaltatori.push({
            ditta: typeof s === 'string' ? s : (s.ditta || s.nome || ''),
            operai: typeof s === 'object' && s.operai ? Number(s.operai) || 1 : 1,
            lavorazione: typeof s === 'object' && s.lavorazione ? s.lavorazione : ''
          });
        });
      }

      this.nessunNoleggio = Boolean(data.nessunNoleggio);
      this.noleggi = new SmartArray();
      if (Array.isArray(data.noleggi)) {
        data.noleggi.forEach(n => {
          if (typeof n === 'string') this.noleggi.push({ mezzo: n, ore: 8 });
          else this.noleggi.push({ mezzo: n.mezzo || n.nome || '', ore: Number(n.ore) || 8 });
        });
      }

      this.nessunMateriale = Boolean(data.nessunMateriale);
      this.materiali = this.nessunMateriale ? '' : (data.materiali || '');

      this.nessunaNota = Boolean(data.nessunaNota);
      this.note = this.nessunaNota ? '' : (data.note || '');

      this.nessunaFoto = Boolean(data.nessunaFoto);
      this.foto = Array.isArray(data.foto) ? data.foto.slice(0, 8).map(f => ({
        ...f,
        caption: f.caption || f.didascalia || ''
      })) : [];

      return this;
    }
  }

  // =========================================================================
  // TOAST NOTIFICATION CONTROLLER (Feedback rapido su mobile)
  // =========================================================================

  function showToast(message, type = 'info', duration = 3000) {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'bg-danger text-white' : (type === 'success' ? 'bg-success text-white' : '')}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  // =========================================================================
  // APP UI CONTROLLER: Binding DOM, Eventi e Render Reattivo dei 9 Box
  // =========================================================================

  class CantiereApp {
    constructor() {
      this.state = new RapportinoState();
      this.autocompletes = {};
      this.isInitialized = false;
    }

    init() {
      if (typeof document === 'undefined') return;
      if (this.isInitialized) return;

      this.bindElements();
      this.initAutocompletes();
      this.initDefaultChips();
      this.initEventListeners();
      this.render();

      this.isInitialized = true;
      console.log('[CantiereApp] Inizializzazione completata con successo.');
    }

    bindElements() {
      // Header
      this.headerProgress = document.getElementById('header-progress-badge');

      // Box 1
      this.box1 = document.getElementById('box-1');
      this.box1Badge = document.getElementById('box-1-badge');
      this.inputData = document.getElementById('input-data');
      this.inputCantiere = document.getElementById('input-cantiere');
      this.inputLocalita = document.getElementById('input-localita');
      this.inputCup = document.getElementById('input-cup');
      this.inputCig = document.getElementById('input-cig');
      this.inputCommessa = document.getElementById('input-commessa');

      // Box 2
      this.box2 = document.getElementById('box-2');
      this.box2Badge = document.getElementById('box-2-badge');
      this.weatherBtns = document.querySelectorAll('.weather-btn');
      this.inputTemperatura = document.getElementById('input-temperatura');
      this.btnTempMinus = document.getElementById('btn-temp-minus');
      this.btnTempPlus = document.getElementById('btn-temp-plus');

      // Box 3
      this.box3 = document.getElementById('box-3');
      this.box3Badge = document.getElementById('box-3-badge');
      this.btnNaLavorazioni = document.getElementById('btn-na-lavorazioni');
      this.inputLavorazioni = document.getElementById('input-lavorazioni');

      // Box 4
      this.box4 = document.getElementById('box-4');
      this.box4Badge = document.getElementById('box-4-badge');
      this.box4CountBadge = document.getElementById('box4-count-badge');
      this.btnZeroOperai = document.getElementById('btn-zero-operai');
      this.operaiChipsContainer = document.getElementById('box4-chips-container');
      this.inputAddOperaio = document.getElementById('input-add-operaio');
      this.inputOperaioOre = document.getElementById('input-operaio-ore');
      this.btnAddOperaio = document.getElementById('btn-add-operaio');
      this.selectedOperaiContainer = document.getElementById('box4-selected-operai');

      // Box 5
      this.box5 = document.getElementById('box-5');
      this.box5Badge = document.getElementById('box-5-badge');
      this.box5CountBadge = document.getElementById('box5-count-badge');
      this.btnNessunSub = document.getElementById('btn-nessun-sub');
      this.inputSubDitta = document.getElementById('input-sub-ditta');
      this.inputSubOperai = document.getElementById('input-sub-operai');
      this.inputSubLavorazione = document.getElementById('input-sub-lavorazione');
      this.btnAddSub = document.getElementById('btn-add-sub');
      this.subListContainer = document.getElementById('box5-sub-list');

      // Box 6
      this.box6 = document.getElementById('box-6');
      this.box6Badge = document.getElementById('box-6-badge');
      this.box6CountBadge = document.getElementById('box6-count-badge');
      this.btnNessunNoleggio = document.getElementById('btn-nessun-noleggio');
      this.noleggiChipsContainer = document.getElementById('box6-noleggi-chips');
      this.inputAddNoleggio = document.getElementById('input-add-noleggio');
      this.inputNoleggioOre = document.getElementById('input-noleggio-ore');
      this.btnAddNoleggio = document.getElementById('btn-add-noleggio');
      this.noleggiListContainer = document.getElementById('box6-noleggi-list');

      // Box 7
      this.box7 = document.getElementById('box-7');
      this.box7Badge = document.getElementById('box-7-badge');
      this.btnNessunMateriale = document.getElementById('btn-nessun-materiale');
      this.inputMateriali = document.getElementById('input-materiali');

      // Box 8
      this.box8 = document.getElementById('box-8');
      this.box8Badge = document.getElementById('box-8-badge');
      this.btnNessunaNota = document.getElementById('btn-nessuna-nota');
      this.inputNote = document.getElementById('input-note');

      // Box 9
      this.box9 = document.getElementById('box-9');
      this.box9Badge = document.getElementById('box-9-badge');
      this.box9PhotoCounter = document.getElementById('box9-photo-counter');
      this.btnNessunaFoto = document.getElementById('btn-nessuna-foto');
      this.photoFileInput = document.getElementById('photo-file-input');
      this.labelAddPhoto = document.getElementById('label-add-photo');
      this.photoGrid = document.getElementById('box9-photo-grid');

      // Bottom Bar
      this.previewFilename = document.getElementById('preview-filename');
      this.bottomAlertBanner = document.getElementById('bottom-alert-banner');
      this.btnCompleteRapportino = document.getElementById('btn-complete-rapportino');
      this.btnDownloadPdf = document.getElementById('btn-download-pdf');
      this.btnDownloadDocx = document.getElementById('btn-download-docx');
      this.btnSaveDraft = document.getElementById('btn-save-draft');
      this.btnResetReport = document.getElementById('btn-reset-report');

      // Modale Completamento Rapportino
      this.modalCompletionBackdrop = document.getElementById('modal-completion-backdrop');
      this.modalCompletion = document.getElementById('modal-completion');
      this.modalCompletionSummary = document.getElementById('modal-completion-summary');
      this.btnCloseModalCompletion = document.getElementById('btn-close-modal-completion');
      this.btnModalDownloadPdf = document.getElementById('btn-modal-download-pdf');
      this.btnModalDownloadDocx = document.getElementById('btn-modal-download-docx');
      this.btnModalNewReport = document.getElementById('btn-modal-new-report');
      this.btnModalCloseBtn = document.getElementById('btn-modal-close-btn');
    }

    initAutocompletes() {
      if (typeof global.Autocomplete !== 'function' || !global.CantiereStore) return;

      // Autocomplete Cantiere
      if (this.inputCantiere) {
        this.autocompletes.cantiere = new global.Autocomplete(this.inputCantiere, {
          getItems: () => global.CantiereStore.getCantieri(),
          getItemLabel: item => (typeof item === 'string' ? item : item.nome),
          getItemSublabel: item => (item && item.localita ? `${item.localita}${item.commessa ? ' • ' + item.commessa : ''}` : ''),
          onSelect: item => {
            if (typeof item === 'object') {
              this.state.setCantiere(item.nome, item.localita || '', item.commessa || '', item.cup || '', item.cig || '');
              if (this.inputLocalita) this.inputLocalita.value = item.localita || '';
              if (this.inputCommessa) this.inputCommessa.value = item.commessa || '';
              if (this.inputCup) this.inputCup.value = item.cup || '';
              if (this.inputCig) this.inputCig.value = item.cig || '';
            } else {
              this.state.setCantiere(item);
            }
            this.render();
          },
          onAddNew: query => {
            this.state.setCantiere(query, this.inputLocalita ? this.inputLocalita.value : '', this.inputCommessa ? this.inputCommessa.value : '', this.inputCup ? this.inputCup.value : '', this.inputCig ? this.inputCig.value : '');
            this.render();
          }
        });
      }

      // Autocomplete Operaio
      if (this.inputAddOperaio) {
        this.autocompletes.operaio = new global.Autocomplete(this.inputAddOperaio, {
          getItems: () => global.CantiereStore.getOperai(),
          getItemLabel: item => (typeof item === 'string' ? item : item.nome),
          onSelect: item => {
            const nome = typeof item === 'string' ? item : item.nome;
            this.inputAddOperaio.value = nome;
            if (!this.inputOperaioOre.value) this.inputOperaioOre.value = '8';
            if (this.autocompletes.operaio) this.autocompletes.operaio.close();
            if (this.inputOperaioOre) this.inputOperaioOre.focus();
          },
          onAddNew: query => {
            this.inputAddOperaio.value = query;
            if (!this.inputOperaioOre.value) this.inputOperaioOre.value = '8';
            if (this.autocompletes.operaio) this.autocompletes.operaio.close();
            if (this.inputOperaioOre) this.inputOperaioOre.focus();
          }
        });
      }

      // Autocomplete Subappalti
      if (this.inputSubDitta) {
        this.autocompletes.subappalto = new global.Autocomplete(this.inputSubDitta, {
          getItems: () => global.CantiereStore.getSubappalti(),
          getItemLabel: item => (typeof item === 'string' ? item : item.nome),
          onSelect: item => {
            this.inputSubDitta.value = typeof item === 'string' ? item : item.nome;
            if (this.autocompletes.subappalto) this.autocompletes.subappalto.close();
          },
          onAddNew: query => {
            this.inputSubDitta.value = query;
            if (this.autocompletes.subappalto) this.autocompletes.subappalto.close();
          }
        });
      }

      // Autocomplete Noleggi
      if (this.inputAddNoleggio) {
        this.autocompletes.noleggio = new global.Autocomplete(this.inputAddNoleggio, {
          getItems: () => global.CantiereStore.getNoleggi(),
          getItemLabel: item => (typeof item === 'string' ? item : item.nome),
          onSelect: item => {
            const mezzo = typeof item === 'string' ? item : item.nome;
            this.inputAddNoleggio.value = mezzo;
            if (!this.inputNoleggioOre.value) this.inputNoleggioOre.value = '8';
            if (this.autocompletes.noleggio) this.autocompletes.noleggio.close();
            if (this.inputNoleggioOre) this.inputNoleggioOre.focus();
          },
          onAddNew: query => {
            this.inputAddNoleggio.value = query;
            if (!this.inputNoleggioOre.value) this.inputNoleggioOre.value = '8';
            if (this.autocompletes.noleggio) this.autocompletes.noleggio.close();
            if (this.inputNoleggioOre) this.inputNoleggioOre.focus();
          }
        });
      }
    }

    initDefaultChips() {
      // Inizializza i valori dei form dallo stato iniziale
      if (this.inputData) this.inputData.value = this.state.data;
      if (this.inputTemperatura) this.inputTemperatura.value = this.state.temperatura;
      // Inietta le icone nei pulsanti meteo
      if (typeof global.renderIcon === 'function') {
        const icons = {
          'sereno': 'sun',
          'nuvoloso': 'cloud',
          'pioggia': 'rain',
          'neve': 'snow',
          'caldo': 'caldo'
        };
        for (const [key, iconName] of Object.entries(icons)) {
          const el = document.getElementById('weather-icon-' + key);
          if (el) el.innerHTML = global.renderIcon(iconName, '', 28);
        }
      }
    }

    initEventListeners() {
      // Box 1
      if (this.inputData) {
        this.inputData.addEventListener('change', e => {
          this.state.setDate(e.target.value);
          this.render();
        });
      }
      if (this.inputCantiere) {
        this.inputCantiere.addEventListener('input', e => {
          this.state.setCantiere(e.target.value);
          this.render();
        });
      }
      if (this.inputLocalita) {
        this.inputLocalita.addEventListener('input', e => {
          this.state.setLocalita(e.target.value);
          this.render();
        });
      }
      if (this.inputCommessa) {
        this.inputCommessa.addEventListener('input', e => {
          this.state.setCommessa(e.target.value);
          this.render();
        });
      }

      // Box 2: Meteo & Stepper
      if (this.weatherBtns) {
        this.weatherBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const condition = btn.getAttribute('data-weather');
            this.state.setMeteo(condition);
            this.render();
          });
        });
      }
      if (this.btnTempMinus) {
        this.btnTempMinus.addEventListener('click', () => {
          this.state.adjustTemperatura(-1);
          if (this.inputTemperatura) this.inputTemperatura.value = this.state.temperatura;
          this.render();
        });
      }
      if (this.btnTempPlus) {
        this.btnTempPlus.addEventListener('click', () => {
          this.state.adjustTemperatura(1);
          if (this.inputTemperatura) this.inputTemperatura.value = this.state.temperatura;
          this.render();
        });
      }
      if (this.inputTemperatura) {
        this.inputTemperatura.addEventListener('change', e => {
          this.state.setTemperatura(e.target.value);
          this.render();
        });
      }

      // Box 3: Lavorazioni
      if (this.btnNaLavorazioni) {
        this.btnNaLavorazioni.addEventListener('click', () => {
          this.state.toggleNaLavorazioni();
          if (this.inputLavorazioni) {
            this.inputLavorazioni.value = this.state.naLavorazioni ? '' : this.state.lavorazioni;
          }
          this.render();
        });
      }
      if (this.inputLavorazioni) {
        this.inputLavorazioni.addEventListener('input', e => {
          this.state.setLavorazioni(e.target.value);
          this.render();
        });
      }

      // Box 4: Operai Vittorini
      if (this.btnZeroOperai) {
        this.btnZeroOperai.addEventListener('click', () => {
          this.state.toggleZeroOperai();
          this.render();
        });
      }
      if (this.inputCup) {
        this.inputCup.addEventListener('input', e => {
          this.state.setCup(e.target.value);
        });
      }
      if (this.inputCig) {
        this.inputCig.addEventListener('input', e => {
          this.state.setCig(e.target.value);
        });
      }
      if (this.btnAddOperaio) {
        this.btnAddOperaio.addEventListener('click', () => {
          if (this.inputAddOperaio && this.inputAddOperaio.value.trim()) {
            const ore = this.inputOperaioOre ? Number(this.inputOperaioOre.value) || 8 : 8;
            this.state.addOperaio(this.inputAddOperaio.value.trim(), ore);
            this.inputAddOperaio.value = '';
            if (this.inputOperaioOre) this.inputOperaioOre.value = '8';
            this.render();
          }
        });
      }
      if (this.inputAddOperaio) {
        this.inputAddOperaio.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.btnAddOperaio) this.btnAddOperaio.click();
          }
        });
      }
      if (this.inputOperaioOre) {
        this.inputOperaioOre.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.btnAddOperaio) this.btnAddOperaio.click();
          }
        });
      }

      // Box 5: Subappaltatori
      if (this.btnNessunSub) {
        this.btnNessunSub.addEventListener('click', () => {
          this.state.toggleNessunSubappalto();
          this.render();
        });
      }
      if (this.btnAddSub) {
        this.btnAddSub.addEventListener('click', () => {
          const ditta = this.inputSubDitta ? this.inputSubDitta.value.trim() : '';
          const operai = this.inputSubOperai ? parseInt(this.inputSubOperai.value, 10) || 1 : 1;
          const lavorazione = this.inputSubLavorazione ? this.inputSubLavorazione.value.trim() : '';

          if (!ditta) {
            showToast('Inserire il nome della ditta subappaltatrice', 'danger');
            if (this.inputSubDitta) this.inputSubDitta.focus();
            return;
          }

          this.state.addSubappaltatore({ ditta, operai, lavorazione });
          if (this.inputSubDitta) this.inputSubDitta.value = '';
          if (this.inputSubLavorazione) this.inputSubLavorazione.value = '';
          if (this.inputSubOperai) this.inputSubOperai.value = '2';
          this.render();
        });
      }

      // Box 6: Noleggi
      if (this.btnNessunNoleggio) {
        this.btnNessunNoleggio.addEventListener('click', () => {
          this.state.toggleNessunNoleggio();
          this.render();
        });
      }
      if (this.btnAddNoleggio) {
        this.btnAddNoleggio.addEventListener('click', () => {
          if (this.inputAddNoleggio && this.inputAddNoleggio.value.trim()) {
            const ore = this.inputNoleggioOre ? Number(this.inputNoleggioOre.value) || 8 : 8;
            this.state.addNoleggio(this.inputAddNoleggio.value.trim(), ore);
            this.inputAddNoleggio.value = '';
            if (this.inputNoleggioOre) this.inputNoleggioOre.value = '8';
            this.render();
          }
        });
      }
      if (this.inputAddNoleggio) {
        this.inputAddNoleggio.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.btnAddNoleggio) this.btnAddNoleggio.click();
          }
        });
      }
      if (this.inputNoleggioOre) {
        this.inputNoleggioOre.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.btnAddNoleggio) this.btnAddNoleggio.click();
          }
        });
      }

      // Box 7: Materiali
      if (this.btnNessunMateriale) {
        this.btnNessunMateriale.addEventListener('click', () => {
          this.state.toggleNessunMateriale();
          if (this.inputMateriali) {
            this.inputMateriali.value = this.state.nessunMateriale ? '' : this.state.materiali;
          }
          this.render();
        });
      }
      if (this.inputMateriali) {
        this.inputMateriali.addEventListener('input', e => {
          this.state.setMateriali(e.target.value);
          this.render();
        });
      }

      // Box 8: Note
      if (this.btnNessunaNota) {
        this.btnNessunaNota.addEventListener('click', () => {
          this.state.toggleNessunaNota();
          if (this.inputNote) {
            this.inputNote.value = this.state.nessunaNota ? '' : this.state.note;
          }
          this.render();
        });
      }
      if (this.inputNote) {
        this.inputNote.addEventListener('input', e => {
          this.state.setNote(e.target.value);
          this.render();
        });
      }

      // Box 9: Foto e Fotocamera Smartphone
      if (this.btnNessunaFoto) {
        this.btnNessunaFoto.addEventListener('click', () => {
          this.state.toggleNessunaFoto();
          this.render();
        });
      }
      if (this.photoFileInput) {
        this.photoFileInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;

          const currentCount = this.state.foto.length;
          const slotsAvailable = 8 - currentCount;

          if (slotsAvailable <= 0) {
            showToast('Limite massimo di 8 foto già raggiunto.', 'danger');
            this.photoFileInput.value = '';
            return;
          }

          const filesToProcess = files.slice(0, slotsAvailable);
          if (files.length > slotsAvailable) {
            showToast(`Caricate solo ${slotsAvailable} foto su ${files.length} (limite max 8).`, 'info');
          }

          showToast('Compressione foto in corso...', 'info', 1500);

          for (const file of filesToProcess) {
            try {
              const compressed = await PhotoCompressor.compress(file, 1920, 0.88);
              this.state.addPhoto(compressed);
            } catch (err) {
              console.error('Errore compressione foto:', err);
              showToast('Errore durante la compressione della foto.', 'danger');
            }
          }

          this.photoFileInput.value = '';
          this.render();
        });
      }

      // Bottom Bar Azioni
      if (this.btnSaveDraft) {
        this.btnSaveDraft.addEventListener('click', () => {
          this.saveToStore();
          showToast('✓ Bozza rapportino salvata nel registro locale', 'success');
        });
      }

      if (this.btnResetReport) {
        this.btnResetReport.addEventListener('click', () => {
          if (confirm('Sei sicuro di voler resettare il rapportino corrente e iniziare da capo?')) {
            this.state.reset();
            if (this.inputData) this.inputData.value = this.state.data;
            if (this.inputCantiere) this.inputCantiere.value = '';
            if (this.inputLocalita) this.inputLocalita.value = '';
            if (this.inputCup) this.inputCup.value = '';
            if (this.inputCig) this.inputCig.value = '';
            if (this.inputCommessa) this.inputCommessa.value = '';
            if (this.inputTemperatura) this.inputTemperatura.value = this.state.temperatura;
            if (this.inputLavorazioni) this.inputLavorazioni.value = '';
            if (this.inputMateriali) this.inputMateriali.value = '';
            if (this.inputNote) this.inputNote.value = '';
            this.render();
            showToast('Nuovo rapportino inizializzato', 'info');
          }
        });
      }

      if (this.btnDownloadPdf) {
        this.btnDownloadPdf.addEventListener('click', async () => {
          this.saveToStore();
          const reportData = this.state.toReportData();
          if (typeof global.generateCantierePDF === 'function') {
            try {
              const res = await global.generateCantierePDF(reportData);
              const filename = (res && res.filename) ? res.filename : this.state.getPreviewFileName('pdf');
              showToast('📄 PDF scaricato: ' + filename, 'success');
            } catch (err) {
              console.error('[PDF Export] Errore generazione PDF:', err);
              showToast('❌ Errore durante la generazione del PDF: ' + err.message, 'danger');
            }
          } else {
            console.log('[PDF Export] Dati pronti per il generatore PDF:', reportData);
            showToast('📄 Dati pronti: ' + this.state.getPreviewFileName('pdf'), 'success');
          }
        });
      }

      if (this.btnDownloadDocx) {
        this.btnDownloadDocx.addEventListener('click', async () => {
          this.saveToStore();
          const reportData = this.state.toReportData();
          if (typeof global.generateCantiereDOCX === 'function') {
            try {
              const res = await global.generateCantiereDOCX(reportData);
              const filename = (res && res.filename) ? res.filename : this.state.getPreviewFileName('docx');
              showToast('📄 Word (.docx) scaricato con successo: ' + filename, 'success');
            } catch (err) {
              console.error('[DOCX Export] Errore generazione Word:', err);
              showToast('❌ Errore durante la generazione del file Word: ' + err.message, 'danger');
            }
          } else {
            console.log('[DOCX Export] Dati pronti per il generatore Word:', reportData);
            showToast('📄 Dati pronti: ' + this.state.getPreviewFileName('docx'), 'success');
          }
        });
      }

      // Azione di Conclusione / Chiusura Rapportino
      const openCompletionModal = () => {
        this.saveToStore();
        const totals = this.state.getTotals();
        const cantiereName = this.state.cantiere ? this.state.cantiere.trim() : 'Cantiere non specificato';
        const dataIso = this.state.data || getTodayIso();
        const operaiStr = totals.totaleVittorini > 0
          ? `${totals.totaleVittorini} operai (${totals.totaleOreVittorini}h complessive)`
          : (this.state.zeroOperai ? '0 operai (nessuno oggi)' : 'Nessun nominativo');
        const subStr = totals.totaleSubappaltatori > 0
          ? `${totals.totaleSubappaltatori} operai ditte terze`
          : (this.state.nessunSubappalto ? 'Nessun subappalto' : 'Nessuno');
        const noliStr = this.state.noleggi.length > 0
          ? this.state.noleggi.map(n => `${this.state._getNolName(n)} (${this.state._getNolHours(n)}h)`).join(', ')
          : (this.state.nessunNoleggio ? 'Nessun noleggio' : 'Nessuno');
        const fotoCount = this.state.foto.length;
        const fotoStr = fotoCount > 0 ? `${fotoCount} foto allegate` : 'Nessuna foto allegata';

        if (this.modalCompletionSummary) {
          this.modalCompletionSummary.innerHTML = `
            <p><strong>Cantiere:</strong> ${escapeHtml(cantiereName)}</p>
            <p><strong>Data:</strong> ${escapeHtml(dataIso)}</p>
            <p><strong>Personale Vittorini:</strong> ${escapeHtml(operaiStr)}</p>
            <p><strong>Subappaltatori:</strong> ${escapeHtml(subStr)}</p>
            <p><strong>Noleggi & Mezzi:</strong> ${escapeHtml(noliStr)}</p>
            <p><strong>Fotografie:</strong> ${escapeHtml(fotoStr)}</p>
          `;
        }

        if (this.modalCompletionBackdrop) this.modalCompletionBackdrop.style.display = 'block';
        if (this.modalCompletion) this.modalCompletion.style.display = 'block';
        showToast('✓ Rapportino concluso e salvato nello storico!', 'success');
      };

      const closeCompletionModal = () => {
        if (this.modalCompletionBackdrop) this.modalCompletionBackdrop.style.display = 'none';
        if (this.modalCompletion) this.modalCompletion.style.display = 'none';
      };

      if (this.btnCompleteRapportino) {
        this.btnCompleteRapportino.addEventListener('click', openCompletionModal);
      }
      if (this.btnCloseModalCompletion) {
        this.btnCloseModalCompletion.addEventListener('click', closeCompletionModal);
      }
      if (this.btnModalCloseBtn) {
        this.btnModalCloseBtn.addEventListener('click', closeCompletionModal);
      }
      if (this.modalCompletionBackdrop) {
        this.modalCompletionBackdrop.addEventListener('click', closeCompletionModal);
      }
      if (this.btnModalDownloadPdf) {
        this.btnModalDownloadPdf.addEventListener('click', () => {
          if (this.btnDownloadPdf) this.btnDownloadPdf.click();
        });
      }
      if (this.btnModalDownloadDocx) {
        this.btnModalDownloadDocx.addEventListener('click', () => {
          if (this.btnDownloadDocx) this.btnDownloadDocx.click();
        });
      }
      if (this.btnModalNewReport) {
        this.btnModalNewReport.addEventListener('click', () => {
          closeCompletionModal();
          if (this.btnResetReport) this.btnResetReport.click();
        });
      }
    }

    saveToStore() {
      if (global.CantiereStore) {
        const reportData = this.state.toReportData();
        const saved = global.CantiereStore.saveRapportino(reportData);
        if (saved && saved.id) {
          this.state.id = saved.id;
        }
        return saved;
      }
      return null;
    }

    /**
     * Carica un rapportino passato o bozza dallo storico nei 9 box
     * @param {Object} reportData 
     * @returns {boolean}
     */
    loadReport(reportData) {
      if (!reportData || typeof reportData !== 'object') return false;
      this.state.loadFromReportData(reportData);

      if (this.inputData) this.inputData.value = this.state.data || '';
      if (this.inputCantiere) this.inputCantiere.value = this.state.cantiere || '';
      if (this.inputLocalita) this.inputLocalita.value = this.state.localita || '';
      if (this.inputCommessa) this.inputCommessa.value = this.state.commessa || '';
      if (this.inputCup) this.inputCup.value = this.state.cup || '';
      if (this.inputCig) this.inputCig.value = this.state.cig || '';
      if (this.inputTemperatura) this.inputTemperatura.value = this.state.temperatura !== undefined ? this.state.temperatura : 22;
      if (this.inputLavorazioni) this.inputLavorazioni.value = this.state.lavorazioni || '';
      if (this.inputMateriali) this.inputMateriali.value = this.state.materiali || '';
      if (this.inputNote) this.inputNote.value = this.state.note || '';

      this.render();
      return true;
    }

    /**
     * Ricarica chips e autocomplete quando la rubrica viene aggiornata nel drawer
     */
    refreshFromStore() {
      this.initAutocompletes();
      this.renderOperaiChips();
      this.renderNoleggiChips();
      this.render();
    }

    // =========================================================================
    // RENDERING REATTIVO DELLA UI E DEI 9 BOX
    // =========================================================================

    render() {
      this.renderBoxStatus();
      this.renderWeather();
      this.renderOperaiChips();
      this.renderSubappaltiList();
      this.renderNoleggiChips();
      this.renderPhotoGallery();
      this.renderBottomBar();
      this.renderHeader();
    }

    renderBoxStatus() {
      const checkIconSvg = (typeof global.renderIcon === 'function') 
        ? global.renderIcon('check', 'text-success', 16) 
        : '✓ ';

      const boxes = [
        { el: this.box1, badge: this.box1Badge, isDone: this.state.isBox1Complete() },
        { el: this.box2, badge: this.box2Badge, isDone: this.state.isBox2Complete() },
        { el: this.box3, badge: this.box3Badge, isDone: this.state.isBox3Complete() },
        { el: this.box4, badge: this.box4Badge, isDone: this.state.isBox4Complete() },
        { el: this.box5, badge: this.box5Badge, isDone: this.state.isBox5Complete() },
        { el: this.box6, badge: this.box6Badge, isDone: this.state.isBox6Complete() },
        { el: this.box7, badge: this.box7Badge, isDone: this.state.isBox7Complete() },
        { el: this.box8, badge: this.box8Badge, isDone: this.state.isBox8Complete() },
        { el: this.box9, badge: this.box9Badge, isDone: this.state.isBox9Complete() }
      ];

      boxes.forEach(item => {
        if (!item.el) return;
        if (item.isDone) {
          item.el.classList.add('completed');
          if (item.badge) {
            item.badge.className = 'box-status-badge completed';
            item.badge.innerHTML = `${checkIconSvg}<span>Completato</span>`;
          }
        } else {
          item.el.classList.remove('completed');
          if (item.badge) {
            item.badge.className = 'box-status-badge pending';
            item.badge.textContent = 'Da compilare';
          }
        }
      });

      // Stato pulsanti rapidi N.A.
      if (this.btnNaLavorazioni) {
        this.btnNaLavorazioni.classList.toggle('active', this.state.naLavorazioni);
      }
      if (this.btnZeroOperai) {
        this.btnZeroOperai.classList.toggle('active', this.state.zeroOperai);
      }
      if (this.btnNessunSub) {
        this.btnNessunSub.classList.toggle('active', this.state.nessunSubappalto);
      }
      if (this.btnNessunNoleggio) {
        this.btnNessunNoleggio.classList.toggle('active', this.state.nessunNoleggio);
      }
      if (this.btnNessunMateriale) {
        this.btnNessunMateriale.classList.toggle('active', this.state.nessunMateriale);
      }
      if (this.btnNessunaNota) {
        this.btnNessunaNota.classList.toggle('active', this.state.nessunaNota);
      }
      if (this.btnNessunaFoto) {
        this.btnNessunaFoto.classList.toggle('active', this.state.nessunaFoto);
      }
    }

    renderWeather() {
      if (!this.weatherBtns) return;
      this.weatherBtns.forEach(btn => {
        const condition = btn.getAttribute('data-weather');
        const isActive = this.state.meteo === condition;
        btn.classList.toggle('active', isActive);
      });
    }

    renderOperaiChips() {
      if (!this.operaiChipsContainer) return;
      this.operaiChipsContainer.innerHTML = '';

      // Lista completa da Store + eventuali aggiunti
      const allOperai = (global.CantiereStore ? global.CantiereStore.getOperai() : []).map(o => (typeof o === 'string' ? o : o.nome));
      const currentNames = this.state.operaiVittorini.map(o => this.state._getOpName(o));
      const union = Array.from(new Set([...allOperai, ...currentNames]));

      union.forEach(nome => {
        const isSelected = currentNames.some(n => n.toLowerCase() === nome.toLowerCase());
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `chip-btn ${isSelected ? 'active' : ''}`;
        chip.textContent = `${isSelected ? '✓ ' : ''}${nome}`;
        chip.addEventListener('click', () => {
          if (isSelected) {
            this.state.removeOperaio(nome);
            this.render();
          } else {
            if (this.inputAddOperaio) {
              this.inputAddOperaio.value = nome;
              if (this.inputOperaioOre && !this.inputOperaioOre.value) this.inputOperaioOre.value = '8';
              if (this.inputOperaioOre) this.inputOperaioOre.focus();
            }
          }
        });
        this.operaiChipsContainer.appendChild(chip);
      });

      // Render lista dettagliata operai selezionati con ore
      if (this.selectedOperaiContainer) {
        this.selectedOperaiContainer.innerHTML = '';
        const trashIcon = (typeof global.renderIcon === 'function') ? global.renderIcon('trash', 'text-danger', 18) : '🗑️';

        this.state.operaiVittorini.forEach(op => {
          const name = this.state._getOpName(op);
          const safeName = escapeHtml(name);
          const hours = Number(this.state._getOpHours(op)) || 8;
          const item = document.createElement('div');
          item.className = 'entry-item';
          item.innerHTML = `
            <div class="entry-text"><strong>${safeName}</strong></div>
            <div class="operaio-hours-stepper">
              <span class="text-xs text-neutral">Ore:</span>
              <input type="number" class="hours-input-sm" value="${hours}" min="1" max="24" data-op="${safeName}">
            </div>
            <button type="button" class="entry-delete-btn" aria-label="Rimuovi ${safeName}">${trashIcon}</button>
          `;

          const inputOre = item.querySelector('.hours-input-sm');
          inputOre.addEventListener('change', (e) => {
            const h = Number(e.target.value) || 8;
            this.state.updateOperaioOre(name, h);
            this.renderBoxStatus();
            if (this.box4CountBadge) {
              const totals = this.state.getTotals();
              this.box4CountBadge.textContent = `Totale personale Vittorini: ${totals.totaleVittorini} (${totals.totaleOreVittorini}h)`;
            }
          });

          const delBtn = item.querySelector('.entry-delete-btn');
          delBtn.addEventListener('click', () => {
            this.state.removeOperaio(name);
            this.render();
          });

          this.selectedOperaiContainer.appendChild(item);
        });
      }

      if (this.box4CountBadge) {
        const totals = this.state.getTotals();
        this.box4CountBadge.textContent = totals.totaleVittorini > 0
          ? `Totale personale Vittorini: ${totals.totaleVittorini} (${totals.totaleOreVittorini}h)`
          : `Totale personale Vittorini: 0`;
      }
    }

    renderSubappaltiList() {
      if (!this.subListContainer) return;
      this.subListContainer.innerHTML = '';

      const trashIcon = (typeof global.renderIcon === 'function')
        ? global.renderIcon('trash', 'text-danger', 20)
        : '🗑️';

      this.state.subappaltatori.forEach((sub, idx) => {
        const safeDitta = escapeHtml(sub.ditta);
        const safeLav = escapeHtml(sub.lavorazione);
        const numOp = Number(sub.operai) || 1;
        const row = document.createElement('div');
        row.className = 'entry-item';
        row.innerHTML = `
          <div class="entry-text">
            <strong>${safeDitta}</strong>
            <span class="text-neutral text-sm ml-2">(${numOp} ${numOp === 1 ? 'operaio' : 'operai'})</span>
            ${safeLav ? `<div class="text-xs text-neutral">${safeLav}</div>` : ''}
          </div>
          <button type="button" class="entry-delete-btn" aria-label="Rimuovi ${safeDitta}">
            ${trashIcon}
          </button>
        `;

        const deleteBtn = row.querySelector('.entry-delete-btn');
        deleteBtn.addEventListener('click', () => {
          this.state.removeSubappaltatore(idx);
          this.render();
        });

        this.subListContainer.appendChild(row);
      });

      if (this.box5CountBadge) {
        const totals = this.state.getTotals();
        this.box5CountBadge.textContent = `Totale personale Subappaltatori: ${totals.totaleSubappaltatori}`;
      }
    }

    renderNoleggiChips() {
      this.renderNoleggiList();
    }

    renderNoleggiList() {
      if (!this.noleggiListContainer) return;
      this.noleggiListContainer.innerHTML = '';

      const trashIcon = (typeof global.renderIcon === 'function') ? global.renderIcon('trash', 'text-danger', 18) : '🗑️';

      this.state.noleggi.forEach((nol, idx) => {
        const name = this.state._getNolName(nol);
        const safeName = escapeHtml(name);
        const hours = Number(this.state._getNolHours(nol)) || 8;
        const item = document.createElement('div');
        item.className = 'entry-item';
        item.innerHTML = `
          <div class="entry-text"><strong>${safeName}</strong></div>
          <div class="noleggio-hours-stepper">
            <span class="text-xs text-neutral">Ore:</span>
            <input type="number" class="hours-input-sm" value="${hours}" min="1" max="24" data-idx="${idx}">
          </div>
          <button type="button" class="entry-delete-btn" aria-label="Rimuovi ${safeName}">${trashIcon}</button>
        `;

        const inputOre = item.querySelector('.hours-input-sm');
        inputOre.addEventListener('change', (e) => {
          const h = Number(e.target.value) || 8;
          this.state.updateNoleggioOre(name, h);
          this.renderBoxStatus();
        });

        const delBtn = item.querySelector('.entry-delete-btn');
        delBtn.addEventListener('click', () => {
          this.state.removeNoleggio(idx);
          this.render();
        });

        this.noleggiListContainer.appendChild(item);
      });

      if (this.box6CountBadge) {
        this.box6CountBadge.textContent = this.state.noleggi.length > 0
          ? `Macchinari presenti a nolo: ${this.state.noleggi.length}`
          : `Nessun macchinario a nolo`;
      }
    }

    renderPhotoGallery() {
      if (!this.photoGrid) return;
      this.photoGrid.innerHTML = '';

      const count = this.state.foto.length;
      if (this.box9PhotoCounter) {
        this.box9PhotoCounter.textContent = `${count} / 8 foto caricate`;
      }

      // Se raggiunte 8 foto, disabilita il pulsante di aggiunta
      if (this.labelAddPhoto && this.photoFileInput) {
        if (count >= 8) {
          this.labelAddPhoto.classList.add('opacity-50', 'pointer-events-none');
          this.photoFileInput.disabled = true;
        } else {
          this.labelAddPhoto.classList.remove('opacity-50', 'pointer-events-none');
          this.photoFileInput.disabled = false;
        }
      }

      const trashIcon = (typeof global.renderIcon === 'function')
        ? global.renderIcon('trash', 'text-white', 16)
        : '🗑️';

      this.state.foto.forEach((photo, idx) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        const safeSrc = isSafeImageDataUrl(photo.dataUrl) ? photo.dataUrl.trim() : '';
        const safeCap = escapeHtml(photo.caption || '');
        card.innerHTML = `
          <div class="photo-thumb-wrapper">
            <img src="${safeSrc}" class="photo-thumb" alt="Foto cantiere ${idx + 1}">
            <div class="photo-number-badge">#${idx + 1}</div>
            <button type="button" class="photo-remove-btn" aria-label="Elimina foto ${idx + 1}">
              ${trashIcon}
            </button>
          </div>
          <input type="text" class="photo-caption-input" placeholder="Didascalia foto ${idx + 1}..." value="${safeCap}" data-idx="${idx}">
        `;

        const removeBtn = card.querySelector('.photo-remove-btn');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.removePhoto(idx);
          this.render();
        });

        const captionInput = card.querySelector('.photo-caption-input');
        captionInput.addEventListener('input', (e) => {
          this.state.setPhotoCaption(idx, e.target.value);
        });

        this.photoGrid.appendChild(card);
      });
    }

    renderBottomBar() {
      const fileName = this.state.getPreviewFileName('pdf');
      if (this.previewFilename) {
        this.previewFilename.textContent = fileName;
      }

      const completedCount = this.state.getCompletedCount();
      if (this.bottomAlertBanner) {
        if (completedCount === 9) {
          this.bottomAlertBanner.className = 'bottom-alert ready';
          this.bottomAlertBanner.textContent = '✓ Tutti i 9 box completati';
          this.bottomAlertBanner.classList.remove('hidden');
        } else {
          this.bottomAlertBanner.className = 'bottom-alert';
          const missing = 9 - completedCount;
          this.bottomAlertBanner.textContent = `⚠️ ${missing} ${missing === 1 ? 'box da completare' : 'box da completare'}`;
          this.bottomAlertBanner.classList.remove('hidden');
        }
      }
    }

    renderHeader() {
      if (!this.headerProgress) return;
      const count = this.state.getCompletedCount();
      if (count === 9) {
        this.headerProgress.className = 'box-status-badge completed';
        this.headerProgress.textContent = '✓ 9 / 9 completati';
      } else {
        this.headerProgress.className = 'box-status-badge pending';
        this.headerProgress.textContent = `${count} / 9 completati`;
      }
    }
  }

  // =========================================================================
  // EXPORTS
  // =========================================================================

  const cantiereAppInstance = new CantiereApp();

  if (typeof window !== 'undefined') {
    window.RapportinoState = RapportinoState;
    window.PhotoCompressor = PhotoCompressor;
    window.CantiereApp = cantiereAppInstance;
    window.sanitizeFileName = sanitizeFileName;
    window.formatDateItalian = formatDateItalian;
    window.showToast = showToast;

    // Avvio automatico al caricamento del DOM
    document.addEventListener('DOMContentLoaded', () => {
      cantiereAppInstance.init();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      RapportinoState,
      PhotoCompressor,
      CantiereApp,
      cantiereAppInstance,
      sanitizeFileName,
      formatDateItalian
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
