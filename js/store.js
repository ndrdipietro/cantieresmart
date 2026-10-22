/**
 * CantiereSmart - Store di Persistenza Locale & Rubrica Cantieri/Personale
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Gestisce l'archiviazione locale (LocalStorage con fallback in memoria),
 * l'auto-apprendimento delle anagrafiche, la gestione impostazioni promemoria
 * e il backup/restore completo dei dati.
 */

(function (global) {
  'use strict';

  // Chiavi LocalStorage namespaced
  const STORAGE_KEYS = {
    CANTIERI: 'cantieresmart_cantieri',
    OPERAI: 'cantieresmart_operai',
    SUBAPPALTI: 'cantieresmart_subappalti',
    NOLEGGI: 'cantieresmart_noleggi',
    SETTINGS: 'cantieresmart_settings',
    RAPPORTINI: 'cantieresmart_rapportini',
    INITIALIZED: 'cantieresmart_initialized_v2'
  };

  // Costanti immutabili dimostrative di base (nessun dato reale aziendale)
  const BASE_DEMO_CANTIERI = [
    {
      "id": "c1",
      "nome": "Santuario Madonna delle Grazie",
      "localita": "Loc. Varoni, Amatrice (RI)",
      "commessa": "Sisma 2016",
      "cup": "",
      "cig": ""
    },
    {
      "id": "c_scuola",
      "nome": "Scuola Elementare Amatrice",
      "localita": "Amatrice (RI)",
      "commessa": "Ricostruzione Pubblica",
      "cup": "",
      "cig": ""
    },
    {
      "id": "c_palazzo",
      "nome": "Palazzo Storico Centro",
      "localita": "L'Aquila (AQ)",
      "commessa": "Restauro Conservativo",
      "cup": "",
      "cig": ""
    }
  ];

  const BASE_DEMO_OPERAI = [
    { id: "op1", nome: "Marco Rossi" },
    { id: "op2", nome: "Giuseppe Esposito" },
    { id: "op3", nome: "Antonio Russo" },
    { id: "op4", nome: "Giovanni Bianchi" },
    { id: "op5", nome: "Francesco Romano" },
    { id: "op6", nome: "Roberto Ferrari" },
    { id: "op7", nome: "Alessandro Moretti" },
    { id: "op8", nome: "Davide Conti" }
  ];

  const BASE_DEMO_SUBAPPALTI = [
    { "id": "sub1", "nome": "IPPOLITI PONTEGGI" },
    { "id": "sub2", "nome": "EDILIZIA 2000 SRL" },
    { "id": "sub3", "nome": "IMPIANTI ELETTRICI G.M." },
    { "id": "sub4", "nome": "TERMOIDRAULICA ABRUZZESE" }
  ];

  const BASE_DEMO_NOLEGGI = [
    { id: "nol1", nome: "Escavatore 50q" },
    { id: "nol2", nome: "Piattaforma aerea 18m" },
    { id: "nol3", nome: "Gru a torre" },
    { id: "nol4", nome: "Dumper 25q" }
  ];

  let DEFAULT_CANTIERI = JSON.parse(JSON.stringify(BASE_DEMO_CANTIERI));
  let DEFAULT_OPERAI = JSON.parse(JSON.stringify(BASE_DEMO_OPERAI));
  let DEFAULT_SUBAPPALTI = JSON.parse(JSON.stringify(BASE_DEMO_SUBAPPALTI));
  let DEFAULT_NOLEGGI = JSON.parse(JSON.stringify(BASE_DEMO_NOLEGGI));

  // Impostazioni Promemoria vincolanti
  const DEFAULT_SETTINGS = {
    reminderEnabled: true,
    time1: "11:55",
    time2: "16:55",
    days: [1, 2, 3, 4, 5] // Lunedì - Venerdì
  };

  // Archivio attivo esclusivamente in RAM (nessun dato sensibile viene mai scritto in chiaro in localStorage)
  const _memoryStore = {};
  let _encryptedPersistHook = null;

  const StorageDriver = {
    isAvailable: function () {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const testKey = '__cantiere_test__';
          window.localStorage.setItem(testKey, '1');
          window.localStorage.removeItem(testKey);
          return true;
        }
      } catch (e) {
        // Accesso negato o quota ecceduta
      }
      return false;
    },

    purgePlaintextLocalStorage: function () {
      if (!this.isAvailable()) return;
      try {
        for (const keyName of Object.values(STORAGE_KEYS)) {
          window.localStorage.removeItem(keyName);
        }
      } catch (e) {}
    },

    notifyEncryptedPersist: function () {
      if (typeof _encryptedPersistHook === 'function') {
        try {
          _encryptedPersistHook(JSON.parse(JSON.stringify(_memoryStore)));
        } catch (e) {}
      }
    },

    get: function (key) {
      const memVal = _memoryStore[key];
      return memVal !== undefined ? JSON.parse(JSON.stringify(memVal)) : null;
    },

    set: function (key, value) {
      const serialized = JSON.stringify(value);
      _memoryStore[key] = JSON.parse(serialized);
      this.notifyEncryptedPersist();
      return value;
    },

    remove: function (key) {
      delete _memoryStore[key];
      this.notifyEncryptedPersist();
    },

    clear: function () {
      for (const k in _memoryStore) {
        delete _memoryStore[k];
      }
      this.purgePlaintextLocalStorage();
      this.notifyEncryptedPersist();
    }
  };

  /**
   * Generatore di ID unici con prefisso
   */
  function generateId(prefix) {
    const p = prefix || 'id';
    return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Normalizza stringa per confronti case-insensitive e spazi
   */
  function normalizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().toLowerCase();
  }

  const CantiereStore = {
    // Esponi costanti e chiavi
    KEYS: STORAGE_KEYS,
    DEFAULTS: {
      cantieri: DEFAULT_CANTIERI,
      operai: DEFAULT_OPERAI,
      subappalti: DEFAULT_SUBAPPALTI,
      noleggi: DEFAULT_NOLEGGI,
      settings: DEFAULT_SETTINGS
    },

    /**
     * Inizializza lo store con i dati di default Vittorini se non già presenti
     */
    init: function () {
      const initialized = StorageDriver.get(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        this.resetToDefaults({ keepRapportini: true });
        StorageDriver.set(STORAGE_KEYS.INITIALIZED, true);
      }
      return this;
    },

    // =========================================================================
    // CRUD: CANTIERI
    // =========================================================================
    getCantieri: function () {
      const data = StorageDriver.get(STORAGE_KEYS.CANTIERI);
      if (!data || !Array.isArray(data)) {
        return JSON.parse(JSON.stringify(DEFAULT_CANTIERI));
      }
      return data;
    },

    getCantiere: function (id) {
      if (!id) return null;
      const list = this.getCantieri();
      return list.find(item => item.id === id || normalizeString(item.nome) === normalizeString(id)) || null;
    },

    /**
     * Salva o aggiorna un cantiere.
     * Supporta firma ad oggetto { id, nome, localita, commessa } o parametri singoli (nome, localita, commessa)
     */
    saveCantiere: function (cantiereData, localita, commessa, cup, cig) {
      let obj = {};
      if (typeof cantiereData === 'string') {
        obj = {
          nome: cantiereData,
          localita: localita || '',
          commessa: commessa || '',
          cup: cup || '',
          cig: cig || ''
        };
      } else if (cantiereData && typeof cantiereData === 'object') {
        obj = Object.assign({}, cantiereData);
      }

      if (!obj.nome || typeof obj.nome !== 'string' || !obj.nome.trim()) {
        throw new Error('Il nome del cantiere è obbligatorio.');
      }

      obj.nome = obj.nome.trim();
      obj.localita = (obj.localita || '').trim();
      obj.commessa = (obj.commessa || '').trim();
      obj.cup = (obj.cup || '').trim();
      obj.cig = (obj.cig || '').trim();

      const list = this.getCantieri();
      const normNome = normalizeString(obj.nome);

      // Cerca se esiste già per ID o per Nome
      let existingIndex = -1;
      if (obj.id) {
        existingIndex = list.findIndex(item => item.id === obj.id);
      }
      if (existingIndex === -1) {
        existingIndex = list.findIndex(item => normalizeString(item.nome) === normNome);
      }

      if (existingIndex !== -1) {
        // Aggiornamento preservando ID originale
        const existing = list[existingIndex];
        list[existingIndex] = {
          id: existing.id,
          nome: obj.nome,
          localita: obj.localita || existing.localita || '',
          commessa: obj.commessa || existing.commessa || '',
          cup: obj.cup || existing.cup || '',
          cig: obj.cig || existing.cig || ''
        };
        StorageDriver.set(STORAGE_KEYS.CANTIERI, list);
        return list[existingIndex];
      } else {
        // Nuovo cantiere
        const newCantiere = {
          id: obj.id || generateId('c'),
          nome: obj.nome,
          localita: obj.localita,
          commessa: obj.commessa,
          cup: obj.cup || '',
          cig: obj.cig || ''
        };
        list.push(newCantiere);
        StorageDriver.set(STORAGE_KEYS.CANTIERI, list);
        return newCantiere;
      }
    },

    deleteCantiere: function (id) {
      if (!id) return false;
      const list = this.getCantieri();
      const initialLen = list.length;
      const updated = list.filter(item => item.id !== id && normalizeString(item.nome) !== normalizeString(id));
      if (updated.length !== initialLen) {
        StorageDriver.set(STORAGE_KEYS.CANTIERI, updated);
        return true;
      }
      return false;
    },

    // =========================================================================
    // CRUD: OPERAI VITTORINI
    // =========================================================================
    getOperai: function () {
      const data = StorageDriver.get(STORAGE_KEYS.OPERAI);
      if (!data || !Array.isArray(data)) {
        return JSON.parse(JSON.stringify(DEFAULT_OPERAI));
      }
      return data;
    },

    /**
     * Salva o aggiunge un operaio. Accetta stringa ("Marco Rossi") o oggetto { id, nome }
     */
    saveOperaio: function (operaioData) {
      let nome = '';
      let id = null;

      if (typeof operaioData === 'string') {
        nome = operaioData;
      } else if (operaioData && typeof operaioData === 'object') {
        nome = operaioData.nome || '';
        id = operaioData.id || null;
      }

      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        throw new Error("Il nome dell'operaio è obbligatorio.");
      }

      nome = nome.trim();
      const list = this.getOperai();
      const normNome = normalizeString(nome);

      let existingIndex = -1;
      if (id) {
        existingIndex = list.findIndex(item => item.id === id);
      }
      if (existingIndex === -1) {
        existingIndex = list.findIndex(item => normalizeString(item.nome) === normNome);
      }

      if (existingIndex !== -1) {
        list[existingIndex].nome = nome;
        StorageDriver.set(STORAGE_KEYS.OPERAI, list);
        return list[existingIndex];
      } else {
        const newOperaio = {
          id: id || generateId('op'),
          nome: nome
        };
        list.push(newOperaio);
        StorageDriver.set(STORAGE_KEYS.OPERAI, list);
        return newOperaio;
      }
    },

    deleteOperaio: function (id) {
      if (!id) return false;
      const list = this.getOperai();
      const initialLen = list.length;
      const updated = list.filter(item => item.id !== id && normalizeString(item.nome) !== normalizeString(id));
      if (updated.length !== initialLen) {
        StorageDriver.set(STORAGE_KEYS.OPERAI, updated);
        return true;
      }
      return false;
    },

    // =========================================================================
    // CRUD: SUBAPPALTI
    // =========================================================================
    getSubappalti: function () {
      const data = StorageDriver.get(STORAGE_KEYS.SUBAPPALTI);
      if (!data || !Array.isArray(data)) {
        return JSON.parse(JSON.stringify(DEFAULT_SUBAPPALTI));
      }
      return data;
    },

    saveSubappalto: function (subappaltoData) {
      let nome = '';
      let id = null;

      if (typeof subappaltoData === 'string') {
        nome = subappaltoData;
      } else if (subappaltoData && typeof subappaltoData === 'object') {
        nome = subappaltoData.nome || '';
        id = subappaltoData.id || null;
      }

      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        throw new Error('La denominazione del subappaltatore è obbligatoria.');
      }

      nome = nome.trim();
      const list = this.getSubappalti();
      const normNome = normalizeString(nome);

      let existingIndex = -1;
      if (id) {
        existingIndex = list.findIndex(item => item.id === id);
      }
      if (existingIndex === -1) {
        existingIndex = list.findIndex(item => normalizeString(item.nome) === normNome);
      }

      if (existingIndex !== -1) {
        list[existingIndex].nome = nome;
        StorageDriver.set(STORAGE_KEYS.SUBAPPALTI, list);
        return list[existingIndex];
      } else {
        const newSub = {
          id: id || generateId('sub'),
          nome: nome
        };
        list.push(newSub);
        StorageDriver.set(STORAGE_KEYS.SUBAPPALTI, list);
        return newSub;
      }
    },

    deleteSubappalto: function (id) {
      if (!id) return false;
      const list = this.getSubappalti();
      const initialLen = list.length;
      const updated = list.filter(item => item.id !== id && normalizeString(item.nome) !== normalizeString(id));
      if (updated.length !== initialLen) {
        StorageDriver.set(STORAGE_KEYS.SUBAPPALTI, updated);
        return true;
      }
      return false;
    },

    // =========================================================================
    // CRUD: NOLEGGI / MEZZI
    // =========================================================================
    getNoleggi: function () {
      const data = StorageDriver.get(STORAGE_KEYS.NOLEGGI);
      if (!data || !Array.isArray(data)) {
        return JSON.parse(JSON.stringify(DEFAULT_NOLEGGI));
      }
      return data;
    },

    saveNoleggio: function (noleggioData) {
      let nome = '';
      let id = null;

      if (typeof noleggioData === 'string') {
        nome = noleggioData;
      } else if (noleggioData && typeof noleggioData === 'object') {
        nome = noleggioData.nome || '';
        id = noleggioData.id || null;
      }

      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        throw new Error('La descrizione del noleggio/mezzo è obbligatoria.');
      }

      nome = nome.trim();
      const list = this.getNoleggi();
      const normNome = normalizeString(nome);

      let existingIndex = -1;
      if (id) {
        existingIndex = list.findIndex(item => item.id === id);
      }
      if (existingIndex === -1) {
        existingIndex = list.findIndex(item => normalizeString(item.nome) === normNome);
      }

      if (existingIndex !== -1) {
        list[existingIndex].nome = nome;
        StorageDriver.set(STORAGE_KEYS.NOLEGGI, list);
        return list[existingIndex];
      } else {
        const newNol = {
          id: id || generateId('nol'),
          nome: nome
        };
        list.push(newNol);
        StorageDriver.set(STORAGE_KEYS.NOLEGGI, list);
        return newNol;
      }
    },

    deleteNoleggio: function (id) {
      if (!id) return false;
      const list = this.getNoleggi();
      const initialLen = list.length;
      const updated = list.filter(item => item.id !== id && normalizeString(item.nome) !== normalizeString(id));
      if (updated.length !== initialLen) {
        StorageDriver.set(STORAGE_KEYS.NOLEGGI, updated);
        return true;
      }
      return false;
    },

    // =========================================================================
    // SETTINGS: PROMEMORIA & PREFERENZE
    // =========================================================================
    getSettings: function () {
      const stored = StorageDriver.get(STORAGE_KEYS.SETTINGS);
      if (!stored || typeof stored !== 'object') {
        return Object.assign({}, DEFAULT_SETTINGS);
      }
      // Garanzia che i valori vincolanti abbiano fallback rigorosi
      return {
        reminderEnabled: typeof stored.reminderEnabled === 'boolean' ? stored.reminderEnabled : DEFAULT_SETTINGS.reminderEnabled,
        time1: stored.time1 || DEFAULT_SETTINGS.time1,
        time2: stored.time2 || DEFAULT_SETTINGS.time2,
        days: Array.isArray(stored.days) ? stored.days : DEFAULT_SETTINGS.days
      };
    },

    saveSettings: function (newSettings) {
      if (!newSettings || typeof newSettings !== 'object') {
        throw new Error('Nuove impostazioni non valide.');
      }
      const current = this.getSettings();
      const merged = Object.assign({}, current, newSettings);

      // Validazione orari
      if (merged.time1 && !/^\d{2}:\d{2}$/.test(merged.time1)) {
        merged.time1 = DEFAULT_SETTINGS.time1;
      }
      if (merged.time2 && !/^\d{2}:\d{2}$/.test(merged.time2)) {
        merged.time2 = DEFAULT_SETTINGS.time2;
      }
      if (!Array.isArray(merged.days)) {
        merged.days = DEFAULT_SETTINGS.days;
      }

      StorageDriver.set(STORAGE_KEYS.SETTINGS, merged);
      return merged;
    },

    // =========================================================================
    // CRUD: RAPPORTINI GIORNALIERI
    // =========================================================================
    getRapportini: function () {
      const data = StorageDriver.get(STORAGE_KEYS.RAPPORTINI);
      if (!data || !Array.isArray(data)) {
        return [];
      }
      // Ordina dal più recente al più vecchio (data discendente, poi updatedAt discendente)
      return data.slice().sort((a, b) => {
        const dateA = a.data || '';
        const dateB = b.data || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    },

    getRapportino: function (id) {
      if (!id) return null;
      const list = this.getRapportini();
      return list.find(r => r.id === id) || null;
    },

    /**
     * Salva o aggiorna un rapportino di cantiere.
     * Auto-apprende e arricchisce la rubrica per cantiere, operai, subappalti e noleggi.
     */
    saveRapportino: function (rapportinoData) {
      if (!rapportinoData || typeof rapportinoData !== 'object') {
        throw new Error('Dati rapportino non validi.');
      }

      const clone = JSON.parse(JSON.stringify(rapportinoData));
      const nowIso = new Date().toISOString();

      if (!clone.id) {
        const datePart = clone.data || nowIso.slice(0, 10);
        clone.id = generateId('rap_' + datePart);
        clone.createdAt = nowIso;
      } else {
        clone.createdAt = clone.createdAt || nowIso;
      }
      clone.updatedAt = nowIso;

      // Auto-apprendimento: Cantiere
      if (clone.cantiere) {
        try {
          if (typeof clone.cantiere === 'string' && clone.cantiere.trim()) {
            this.saveCantiere({
              nome: clone.cantiere.trim(),
              localita: clone.localita || '',
              commessa: clone.commessa || ''
            });
          } else if (clone.cantiere.nome) {
            this.saveCantiere(clone.cantiere);
          }
        } catch (e) {
          console.warn('[CantiereStore] Auto-learning cantiere fallito:', e);
        }
      }

      // Auto-apprendimento: Operai
      if (Array.isArray(clone.operai)) {
        clone.operai.forEach(op => {
          try {
            if (typeof op === 'string' && op.trim()) {
              this.saveOperaio(op.trim());
            } else if (op && op.nome) {
              this.saveOperaio(op);
            }
          } catch (e) {
            // Ignora singoli errori
          }
        });
      }

      // Auto-apprendimento: Subappaltatori
      const subList = clone.subappaltatori || clone.subappalti;
      if (Array.isArray(subList)) {
        subList.forEach(sub => {
          try {
            if (typeof sub === 'string' && sub.trim()) {
              this.saveSubappalto(sub.trim());
            } else if (sub && sub.nome) {
              this.saveSubappalto(sub);
            } else if (sub && sub.ditta) {
              this.saveSubappalto(sub.ditta);
            }
          } catch (e) {
            // Ignora
          }
        });
      }

      // Auto-apprendimento: Noleggi
      if (Array.isArray(clone.noleggi)) {
        clone.noleggi.forEach(nol => {
          try {
            if (typeof nol === 'string' && nol.trim()) {
              this.saveNoleggio(nol.trim());
            } else if (nol && nol.nome) {
              this.saveNoleggio(nol);
            } else if (nol && nol.mezzo) {
              this.saveNoleggio(nol.mezzo);
            }
          } catch (e) {
            // Ignora
          }
        });
      }

      // Salvataggio nel registro rapportini
      const list = this.getRapportini();
      const existingIdx = list.findIndex(r => r.id === clone.id);
      if (existingIdx !== -1) {
        list[existingIdx] = clone;
      } else {
        list.unshift(clone);
      }

      StorageDriver.set(STORAGE_KEYS.RAPPORTINI, list);
      return clone;
    },

    deleteRapportino: function (id) {
      if (!id) return false;
      const list = this.getRapportini();
      const initialLen = list.length;
      const updated = list.filter(r => r.id !== id);
      if (updated.length !== initialLen) {
        StorageDriver.set(STORAGE_KEYS.RAPPORTINI, updated);
        return true;
      }
      return false;
    },

    /**
     * Inietta in RAM i dati aziendali decifrati dal Vault crittografato e i dati utente decifrati,
     * registrando l'hook di persistenza cifrata (zero dati in chiaro in localStorage).
     */
    unlockVaultData: function (vaultData, decryptedUserStore, onPersistHook) {
      if (!vaultData || typeof vaultData !== 'object') return false;

      _encryptedPersistHook = null; // Sospendi durante il popolamento iniziale

      // Ripulisci qualsiasi chiave legacy in chiaro rimasta nel localStorage del browser
      StorageDriver.purgePlaintextLocalStorage();

      // Se esistono dati utente decifrati dal disco (rapportini salvati, rubrica personalizzata), ripristinali in RAM
      if (decryptedUserStore && typeof decryptedUserStore === 'object') {
        for (const k of Object.values(STORAGE_KEYS)) {
          if (decryptedUserStore[k] !== undefined) {
            _memoryStore[k] = JSON.parse(JSON.stringify(decryptedUserStore[k]));
          }
        }
      }

      if (Array.isArray(vaultData.cantieri) && vaultData.cantieri.length > 0) {
        DEFAULT_CANTIERI = JSON.parse(JSON.stringify(vaultData.cantieri));
        this.DEFAULTS.cantieri = DEFAULT_CANTIERI;
        const current = this.getCantieri();
        const normSet = new Set(current.map(c => normalizeString(c.nome)));
        vaultData.cantieri.forEach(vc => {
          const idx = current.findIndex(c => c.id === vc.id || normalizeString(c.nome) === normalizeString(vc.nome));
          if (idx === -1) {
            current.push(Object.assign({}, vc));
            normSet.add(normalizeString(vc.nome));
          } else if ((!current[idx].cup && vc.cup) || (!current[idx].cig && vc.cig)) {
            current[idx].cup = current[idx].cup || vc.cup || '';
            current[idx].cig = current[idx].cig || vc.cig || '';
            current[idx].commessa = current[idx].commessa || vc.commessa || '';
            current[idx].localita = current[idx].localita || vc.localita || '';
          }
        });
        _memoryStore[STORAGE_KEYS.CANTIERI] = current;
      }

      if (Array.isArray(vaultData.subappalti) && vaultData.subappalti.length > 0) {
        DEFAULT_SUBAPPALTI = JSON.parse(JSON.stringify(vaultData.subappalti));
        this.DEFAULTS.subappalti = DEFAULT_SUBAPPALTI;
        const current = this.getSubappalti();
        const normSet = new Set(current.map(s => normalizeString(s.nome)));
        vaultData.subappalti.forEach(vs => {
          if (!normSet.has(normalizeString(vs.nome))) {
            current.push(Object.assign({}, vs));
            normSet.add(normalizeString(vs.nome));
          }
        });
        _memoryStore[STORAGE_KEYS.SUBAPPALTI] = current;
      }

      if (Array.isArray(vaultData.operai) && vaultData.operai.length > 0) {
        DEFAULT_OPERAI = JSON.parse(JSON.stringify(vaultData.operai));
        this.DEFAULTS.operai = DEFAULT_OPERAI;
      }

      if (Array.isArray(vaultData.noleggi) && vaultData.noleggi.length > 0) {
        DEFAULT_NOLEGGI = JSON.parse(JSON.stringify(vaultData.noleggi));
        this.DEFAULTS.noleggi = DEFAULT_NOLEGGI;
      }

      if (typeof onPersistHook === 'function') {
        _encryptedPersistHook = onPersistHook;
        StorageDriver.notifyEncryptedPersist();
      }

      return true;
    },

    /**
     * Azzera immediatamente dalla RAM tutti i dati decifrati del Vault e dei rapportini
     * quando l'app è bloccata o la sessione scade.
     */
    lockVaultData: function () {
      _encryptedPersistHook = null;
      DEFAULT_CANTIERI = JSON.parse(JSON.stringify(BASE_DEMO_CANTIERI));
      DEFAULT_OPERAI = JSON.parse(JSON.stringify(BASE_DEMO_OPERAI));
      DEFAULT_SUBAPPALTI = JSON.parse(JSON.stringify(BASE_DEMO_SUBAPPALTI));
      DEFAULT_NOLEGGI = JSON.parse(JSON.stringify(BASE_DEMO_NOLEGGI));
      this.DEFAULTS.cantieri = DEFAULT_CANTIERI;
      this.DEFAULTS.operai = DEFAULT_OPERAI;
      this.DEFAULTS.subappalti = DEFAULT_SUBAPPALTI;
      this.DEFAULTS.noleggi = DEFAULT_NOLEGGI;

      for (const k in _memoryStore) {
        delete _memoryStore[k];
      }
      StorageDriver.purgePlaintextLocalStorage();
      this.resetToDefaults({ keepRapportini: false });
      return true;
    },

    // =========================================================================
    // EXPORT & IMPORT (BACKUP & RESTORE JSON CON VALIDAZIONE DI SICUREZZA)
    // =========================================================================
    exportAllData: function () {
      return {
        schemaVersion: 1,
        appName: 'CantiereSmart',
        company: 'Vittorini Emidio Costruzioni S.r.l.',
        exportedAt: new Date().toISOString(),
        cantieri: this.getCantieri(),
        operai: this.getOperai(),
        subappalti: this.getSubappalti(),
        noleggi: this.getNoleggi(),
        settings: this.getSettings(),
        rapportini: this.getRapportini()
      };
    },

    importAllData: function (jsonData) {
      let data = jsonData;
      if (typeof jsonData === 'string') {
        if (jsonData.length > 50 * 1024 * 1024) {
          throw new Error('Dimensione del file di backup superiore al limite consentito.');
        }
        try {
          data = JSON.parse(jsonData);
        } catch (e) {
          throw new Error('JSON di import non valido: ' + e.message);
        }
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Dati di importazione non validi.');
      }

      const cleanStr = (val, maxLen = 500) => {
        if (typeof val !== 'string') return '';
        return val.trim().slice(0, maxLen);
      };

      let countCantieri = 0;
      let countOperai = 0;
      let countSubappalti = 0;
      let countNoleggi = 0;
      let countRapportini = 0;

      if (Array.isArray(data.cantieri)) {
        const validCantieri = data.cantieri
          .filter(c => c && typeof c === 'object' && cleanStr(c.nome, 200))
          .slice(0, 500)
          .map(c => ({
            id: cleanStr(c.id, 64) || generateId('c'),
            nome: cleanStr(c.nome, 200),
            localita: cleanStr(c.localita, 250),
            commessa: cleanStr(c.commessa, 200),
            cup: cleanStr(c.cup, 64),
            cig: cleanStr(c.cig, 64)
          }));
        StorageDriver.set(STORAGE_KEYS.CANTIERI, validCantieri);
        countCantieri = validCantieri.length;
      }
      if (Array.isArray(data.operai)) {
        const validOperai = data.operai
          .filter(o => (typeof o === 'string' && cleanStr(o, 150)) || (o && typeof o === 'object' && cleanStr(o.nome, 150)))
          .slice(0, 500)
          .map(o => ({
            id: (typeof o === 'object' && cleanStr(o.id, 64)) || generateId('op'),
            nome: typeof o === 'string' ? cleanStr(o, 150) : cleanStr(o.nome, 150)
          }));
        StorageDriver.set(STORAGE_KEYS.OPERAI, validOperai);
        countOperai = validOperai.length;
      }
      if (Array.isArray(data.subappalti)) {
        const validSubs = data.subappalti
          .filter(s => (typeof s === 'string' && cleanStr(s, 200)) || (s && typeof s === 'object' && cleanStr(s.nome, 200)))
          .slice(0, 500)
          .map(s => ({
            id: (typeof s === 'object' && cleanStr(s.id, 64)) || generateId('sub'),
            nome: typeof s === 'string' ? cleanStr(s, 200) : cleanStr(s.nome, 200)
          }));
        StorageDriver.set(STORAGE_KEYS.SUBAPPALTI, validSubs);
        countSubappalti = validSubs.length;
      }
      if (Array.isArray(data.noleggi)) {
        const validNol = data.noleggi
          .filter(n => (typeof n === 'string' && cleanStr(n, 200)) || (n && typeof n === 'object' && cleanStr(n.nome, 200)))
          .slice(0, 500)
          .map(n => ({
            id: (typeof n === 'object' && cleanStr(n.id, 64)) || generateId('nol'),
            nome: typeof n === 'string' ? cleanStr(n, 200) : cleanStr(n.nome, 200)
          }));
        StorageDriver.set(STORAGE_KEYS.NOLEGGI, validNol);
        countNoleggi = validNol.length;
      }
      if (data.settings && typeof data.settings === 'object') {
        this.saveSettings(data.settings);
      }
      if (Array.isArray(data.rapportini)) {
        const validRapportini = data.rapportini
          .filter(r => r && typeof r === 'object')
          .slice(0, 1000)
          .map(r => {
            const safeFoto = Array.isArray(r.foto)
              ? r.foto
                  .filter(f => f && typeof f === 'object' && isSafeImageDataUrl(f.dataUrl || f.url || ''))
                  .slice(0, 8)
                  .map(f => ({
                    id: cleanStr(f.id, 64) || generateId('photo'),
                    name: cleanStr(f.name, 150) || 'foto_cantiere.jpg',
                    dataUrl: (f.dataUrl || f.url || '').trim(),
                    width: Math.max(1, Math.min(4096, Number(f.width) || 800)),
                    height: Math.max(1, Math.min(4096, Number(f.height) || 600)),
                    timestamp: Number(f.timestamp) || Date.now(),
                    caption: cleanStr(f.caption || f.didascalia || '', 300)
                  }))
              : [];
            return Object.assign({}, r, {
              id: cleanStr(r.id, 80) || generateId('rap'),
              data: cleanStr(r.data, 20),
              cantiere: typeof r.cantiere === 'string' ? cleanStr(r.cantiere, 200) : cleanStr(r.cantiere && r.cantiere.nome, 200),
              localita: cleanStr(r.localita, 250),
              commessa: cleanStr(r.commessa, 200),
              cup: cleanStr(r.cup, 64),
              cig: cleanStr(r.cig, 64),
              meteo: cleanStr(r.meteo, 30),
              lavorazioni: cleanStr(r.lavorazioni, 5000),
              materiali: cleanStr(r.materiali, 5000),
              note: cleanStr(r.note, 5000),
              foto: safeFoto
            });
          });
        StorageDriver.set(STORAGE_KEYS.RAPPORTINI, validRapportini);
        countRapportini = validRapportini.length;
      }

      StorageDriver.set(STORAGE_KEYS.INITIALIZED, true);

      return {
        success: true,
        countCantieri,
        countOperai,
        countSubappalti,
        countNoleggi,
        countRapportini
      };
    },

    /**
     * Ripristina i dati di default Vittorini
     */
    resetToDefaults: function (options) {
      const opts = Object.assign({ keepRapportini: true }, options || {});
      StorageDriver.set(STORAGE_KEYS.CANTIERI, JSON.parse(JSON.stringify(DEFAULT_CANTIERI)));
      StorageDriver.set(STORAGE_KEYS.OPERAI, JSON.parse(JSON.stringify(DEFAULT_OPERAI)));
      StorageDriver.set(STORAGE_KEYS.SUBAPPALTI, JSON.parse(JSON.stringify(DEFAULT_SUBAPPALTI)));
      StorageDriver.set(STORAGE_KEYS.NOLEGGI, JSON.parse(JSON.stringify(DEFAULT_NOLEGGI)));
      StorageDriver.set(STORAGE_KEYS.SETTINGS, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));

      if (!opts.keepRapportini) {
        StorageDriver.set(STORAGE_KEYS.RAPPORTINI, []);
      }
      return this;
    },

    /**
     * Cancella completamente lo storage (utile per testing pulito)
     */
    clearAll: function () {
      StorageDriver.clear();
      return this;
    },

    escapeHtml: escapeHtml,
    isSafeImageDataUrl: isSafeImageDataUrl
  };

  /**
   * Sanitizzazione HTML contro DOM XSS
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Verifica rigorosa che una dataUrl immagine sia esclusivamente un base64 image sicuro
   */
  function isSafeImageDataUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed);
  }

  // Inizializza automaticamente lo store all'avvio
  CantiereStore.init();

  // Export universale: Browser global + CommonJS per Node/testing
  if (typeof window !== 'undefined') {
    window.CantiereStore = CantiereStore;
    window.escapeHtml = escapeHtml;
    window.isSafeImageDataUrl = isSafeImageDataUrl;
  }
  if (typeof global !== 'undefined') {
    global.escapeHtml = escapeHtml;
    global.isSafeImageDataUrl = isSafeImageDataUrl;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CantiereStore;
  }

})(typeof window !== 'undefined' ? window : globalThis);
