/**
 * CantiereSmart - Componente Touch-Friendly di Autocompletamento & Auto-apprendimento
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Filtra suggerimenti in tempo reale, garantisce touch target >= 48px per uso outdoor/mobile,
 * e fornisce l'azione immediata "+ Aggiungi [nuovo]" per memorizzare nuovi cantieri o nominativi.
 */

(function (global) {
  'use strict';

  /**
   * Pulisce e normalizza stringhe per confronti
   */
  function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.trim().toLowerCase();
  }

  /**
   * Escape HTML per prevenire XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Evidenzia la sottostringa corrispondente nel testo
   */
  function highlightMatch(text, query) {
    const raw = text || '';
    if (!query) return escapeHtml(raw);
    const qLower = query.toLowerCase();
    const tLower = raw.toLowerCase();
    const idx = tLower.indexOf(qLower);
    if (idx === -1) return escapeHtml(raw);

    const before = raw.substring(0, idx);
    const match = raw.substring(idx, idx + query.length);
    const after = raw.substring(idx + query.length);

    return escapeHtml(before) +
      '<strong class="autocomplete-match">' + escapeHtml(match) + '</strong>' +
      escapeHtml(after);
  }

  class Autocomplete {
    constructor(inputElement, options) {
      this.input = typeof inputElement === 'string' ? (global.document ? global.document.querySelector(inputElement) : null) : inputElement;
      this.options = Object.assign({
        getItems: () => [],
        getItemLabel: (item) => (typeof item === 'string' ? item : (item.nome || item.name || '')),
        getItemSublabel: (item) => (item && item.localita ? `${item.localita}${item.commessa ? ' • ' + item.commessa : ''}` : ''),
        onSelect: null,
        onAddNew: null,
        storeCollection: null, // 'cantieri' | 'operai' | 'subappalti' | 'noleggi'
        minChars: 1,
        maxResults: 8,
        placeholderAdd: '+ Aggiungi "{query}"',
        containerClass: 'autocomplete-container',
        dropdownClass: 'autocomplete-dropdown',
        highlight: true
      }, options || {});

      this.isOpen = false;
      this.selectedIndex = -1;
      this.currentFiltered = [];
      this.currentQuery = '';
      this.hasExactMatch = false;

      // Bound handlers per rimozione pulita
      this._onInput = this.handleInput.bind(this);
      this._onFocus = this.handleFocus.bind(this);
      this._onBlur = this.handleBlur.bind(this);
      this._onKeyDown = this.handleKeyDown.bind(this);
      this._onDocClick = this.handleDocClick.bind(this);

      if (this.input && global.document) {
        this.initDOM();
      }
    }

    /**
     * Inizializza il DOM e registra gli eventi
     */
    initDOM() {
      // Assicura contenitore relativo
      let container = this.input.parentElement;
      if (!container || !container.classList.contains(this.options.containerClass)) {
        container = document.createElement('div');
        container.className = this.options.containerClass;
        this.input.parentNode.insertBefore(container, this.input);
        container.appendChild(this.input);
      }
      this.container = container;

      // Crea dropdown se non esistente
      this.dropdown = document.createElement('div');
      this.dropdown.className = this.options.dropdownClass;
      this.dropdown.style.display = 'none';
      this.dropdown.setAttribute('role', 'listbox');
      this.dropdown.setAttribute('aria-label', 'Suggerimenti di autocompletamento');
      this.container.appendChild(this.dropdown);

      // Eventi dell'input
      this.input.setAttribute('autocomplete', 'off');
      this.input.setAttribute('autocapitalize', 'words');
      this.input.setAttribute('spellcheck', 'false');

      this.input.addEventListener('input', this._onInput);
      this.input.addEventListener('focus', this._onFocus);
      this.input.addEventListener('blur', this._onBlur);
      this.input.addEventListener('keydown', this._onKeyDown);

      document.addEventListener('click', this._onDocClick);
    }

    /**
     * Recupera l'elenco attuale di elementi (funzione o array)
     */
    fetchItems() {
      if (typeof this.options.getItems === 'function') {
        try {
          return this.options.getItems() || [];
        } catch (e) {
          console.warn('[Autocomplete] Errore getItems:', e);
          return [];
        }
      }
      if (Array.isArray(this.options.getItems)) {
        return this.options.getItems;
      }
      // Se è specificata una collezione di CantiereStore
      if (this.options.storeCollection && global.CantiereStore) {
        switch (this.options.storeCollection) {
          case 'cantieri': return global.CantiereStore.getCantieri();
          case 'operai': return global.CantiereStore.getOperai();
          case 'subappalti': return global.CantiereStore.getSubappalti();
          case 'noleggi': return global.CantiereStore.getNoleggi();
        }
      }
      return [];
    }

    /**
     * Helper per estrarre il testo di ricerca (nome + localita + commessa)
     */
    getSearchableText(item) {
      if (typeof this.options.getItemSearchText === 'function') {
        return this.options.getItemSearchText(item);
      }
      if (typeof item === 'string') return item;
      if (!item) return '';
      return [item.nome || item.name || '', item.localita || '', item.commessa || ''].filter(Boolean).join(' ');
    }

    /**
     * Filtra elementi secondo la query
     */
    filter(query) {
      const items = this.fetchItems();
      const qNorm = normalizeText(query);
      const getLabel = this.options.getItemLabel;

      let exact = false;
      const filtered = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = getLabel(item);
        const lNorm = normalizeText(label);
        const sNorm = normalizeText(this.getSearchableText(item));

        if (lNorm === qNorm) {
          exact = true;
        }

        if (!qNorm || sNorm.includes(qNorm)) {
          filtered.push(item);
          if (this.options.maxResults && filtered.length >= this.options.maxResults) {
            if (exact) break;
          }
        }
      }

      this.hasExactMatch = exact;
      this.currentFiltered = filtered;
      this.currentQuery = query;
      return filtered;
    }

    /**
     * Renderizza il dropdown dei risultati
     */
    render() {
      if (!this.dropdown) return;

      const query = this.input.value || '';
      const trimmed = query.trim();

      if (trimmed.length < this.options.minChars) {
        this.close();
        return;
      }

      const items = this.filter(trimmed);
      this.dropdown.innerHTML = '';
      this.selectedIndex = -1;

      // 1. Azione "+ Aggiungi [nuovo]" in cima se non c'è match esatto
      const shouldShowAdd = trimmed.length > 0 && !this.hasExactMatch;
      if (shouldShowAdd) {
        const addBtn = document.createElement('div');
        addBtn.className = 'autocomplete-item autocomplete-add-action';
        addBtn.setAttribute('data-action', 'add');
        addBtn.setAttribute('role', 'option');
        addBtn.style.minHeight = '48px'; // Garanzia esplicita inline >= 48px

        const addLabel = this.options.placeholderAdd.replace('{query}', escapeHtml(trimmed));
        addBtn.innerHTML = `
          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>${addLabel}</span>
        `;

        // Mobile touch safe: usa pointerdown per evitare perdita di fuoco prima del tap
        addBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.executeAddNew(trimmed);
        });

        this.dropdown.appendChild(addBtn);
      }

      // 2. Elementi suggeriti esistenti
      if (items.length > 0) {
        items.forEach((item, index) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'autocomplete-item';
          itemEl.setAttribute('data-index', index);
          itemEl.setAttribute('role', 'option');
          itemEl.style.minHeight = '48px'; // Garanzia esplicita inline >= 48px

          const label = this.options.getItemLabel(item);
          const sublabel = this.options.getItemSublabel(item);
          const highlightedLabel = this.options.highlight ? highlightMatch(label, trimmed) : escapeHtml(label);

          let html = `<div class="autocomplete-item-main"><span>${highlightedLabel}</span></div>`;
          if (sublabel) {
            html += `<div class="autocomplete-sublabel">${escapeHtml(sublabel)}</div>`;
          }

          itemEl.innerHTML = html;

          itemEl.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.selectItem(item);
          });

          this.dropdown.appendChild(itemEl);
        });
      } else if (!shouldShowAdd) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'autocomplete-empty';
        emptyEl.textContent = 'Nessun risultato trovato';
        this.dropdown.appendChild(emptyEl);
      }

      this.open();
    }

    /**
     * Esegue l'azione di aggiunta rapida "+ Aggiungi"
     */
    executeAddNew(newQuery) {
      const cleanText = (newQuery || '').trim();
      if (!cleanText) return;

      let addedItem = cleanText;

      // 1. Auto-apprendimento nello Store Vittorini se configurato
      if (this.options.storeCollection && global.CantiereStore) {
        try {
          switch (this.options.storeCollection) {
            case 'cantieri':
              addedItem = global.CantiereStore.saveCantiere({ nome: cleanText });
              break;
            case 'operai':
              addedItem = global.CantiereStore.saveOperaio(cleanText);
              break;
            case 'subappalti':
              addedItem = global.CantiereStore.saveSubappalto(cleanText);
              break;
            case 'noleggi':
              addedItem = global.CantiereStore.saveNoleggio(cleanText);
              break;
          }
        } catch (e) {
          console.warn('[Autocomplete] Errore salvataggio automatico store:', e);
        }
      }

      // 2. Callback personalizzata onAddNew
      if (typeof this.options.onAddNew === 'function') {
        try {
          const customResult = this.options.onAddNew(cleanText, this.input);
          if (customResult !== undefined) {
            addedItem = customResult;
          }
        } catch (e) {
          console.error('[Autocomplete] Errore in onAddNew callback:', e);
        }
      }

      // 3. Imposta valore nell'input e notifica
      const label = this.options.getItemLabel(addedItem) || cleanText;
      this._isSelecting = true;
      this.input.value = label;
      this.close();

      this.triggerChangeEvent();
      this._isSelecting = false;

      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect(addedItem, this.input);
      }
      this.close();
    }

    /**
     * Seleziona un elemento esistente
     */
    selectItem(item) {
      if (!item) return;
      const label = this.options.getItemLabel(item);
      this._isSelecting = true;
      this.input.value = label;
      this.close();

      this.triggerChangeEvent();
      this._isSelecting = false;

      if (typeof this.options.onSelect === 'function') {
        this.options.onSelect(item, this.input);
      }
      this.close();
    }

    /**
     * Dispatta eventi input e change per sincronizzazione UI esterna
     */
    triggerChangeEvent() {
      try {
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        this.input.dispatchEvent(inputEvent);
        this.input.dispatchEvent(changeEvent);
      } catch (e) {
        // Fallback per ambienti legacy
      }
    }

    open() {
      if (!this.dropdown) return;
      this.dropdown.style.display = 'block';
      this.isOpen = true;
    }

    close() {
      if (!this.dropdown) return;
      this.dropdown.style.display = 'none';
      this.isOpen = false;
      this.selectedIndex = -1;
    }

    handleInput() {
      if (this._isSelecting) return;
      this.render();
    }

    handleFocus() {
      if (this.options.minChars === 0 || (this.input.value && this.input.value.trim().length >= this.options.minChars)) {
        this.render();
      }
    }

    handleBlur() {
      // Chiudi con breve timeout per consentire la cattura di pointerdown/click
      setTimeout(() => {
        this.close();
      }, 200);
    }

    handleKeyDown(e) {
      if (!this.isOpen || !this.dropdown) return;

      const items = this.dropdown.querySelectorAll('.autocomplete-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % items.length;
        this.updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
        this.updateActiveItem(items);
      } else if (e.key === 'Enter') {
        if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
          e.preventDefault();
          const target = items[this.selectedIndex];
          if (target.getAttribute('data-action') === 'add') {
            this.executeAddNew(this.input.value.trim());
          } else {
            const idx = parseInt(target.getAttribute('data-index'), 10);
            this.selectItem(this.currentFiltered[idx]);
          }
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    }

    updateActiveItem(items) {
      items.forEach((el, i) => {
        if (i === this.selectedIndex) {
          el.classList.add('active');
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('active');
        }
      });
    }

    handleDocClick(e) {
      if (this.container && !this.container.contains(e.target)) {
        this.close();
      }
    }

    destroy() {
      if (this.input) {
        this.input.removeEventListener('input', this._onInput);
        this.input.removeEventListener('focus', this._onFocus);
        this.input.removeEventListener('blur', this._onBlur);
        this.input.removeEventListener('keydown', this._onKeyDown);
      }
      if (global.document) {
        document.removeEventListener('click', this._onDocClick);
      }
      if (this.dropdown && this.dropdown.parentNode) {
        this.dropdown.parentNode.removeChild(this.dropdown);
      }
    }

    // =========================================================================
    // METODI STATICI PER TESTING E UTILITÀ UNIVERSALE
    // =========================================================================
    static attach(inputElement, options) {
      return new Autocomplete(inputElement, options);
    }

    /**
     * Funzione pura di filtraggio (utilizzabile per test o logica headless)
     */
    static filterItems(items, query, getItemLabel, getItemSearchText) {
      if (!Array.isArray(items)) return [];
      const qNorm = normalizeText(query);
      const getLabel = getItemLabel || ((item) => (typeof item === 'string' ? item : (item.nome || item.name || '')));
      const getSearchText = getItemSearchText || ((item) => {
        if (typeof item === 'string') return item;
        if (!item) return '';
        return [getLabel(item), item.localita || '', item.commessa || ''].filter(Boolean).join(' ');
      });

      return items.filter(item => {
        const sNorm = normalizeText(getSearchText(item));
        return !qNorm || sNorm.includes(qNorm);
      });
    }

    /**
     * Verifica corrispondenza esatta
     */
    static hasExactMatch(items, query, getItemLabel) {
      if (!Array.isArray(items)) return false;
      const qNorm = normalizeText(query);
      if (!qNorm) return false;
      const getLabel = getItemLabel || ((item) => (typeof item === 'string' ? item : (item.nome || item.name || '')));

      return items.some(item => normalizeText(getLabel(item)) === qNorm);
    }

    static highlight(text, query) {
      return highlightMatch(text, query);
    }
  }

  // Export universale: Window + CommonJS
  if (typeof window !== 'undefined') {
    window.Autocomplete = Autocomplete;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Autocomplete;
  }

})(typeof window !== 'undefined' ? window : globalThis);
