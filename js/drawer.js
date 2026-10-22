/**
 * CantiereSmart - Modulo Menu Sandwich (Drawer Laterale)
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Gestisce:
 * 1. Apertura e chiusura fluida del drawer con overlay, tasto Escape e blocco scroll del body.
 * 2. Gestione accessibilità e focus trap.
 * 3. Promemoria & Notifiche (Orari rigorosi 11:55 e 16:55, giorni lavorativi Lun-Ven, test notifica).
 * 4. Rubrica & Anagrafiche locali (Cantieri, Operai, Subappaltatori, Noleggi).
 * 5. Registro & Storico Rapportini (Caricamento nei 9 box, eliminazione).
 * 6. Backup & Ripristino (Export/Import JSON, reset impostazioni).
 */

(function (global) {
  'use strict';

  function formatDateItalian(isoStr) {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || '';
    const [yyyy, mm, dd] = isoStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  function getTodayIso() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  class CantiereDrawer {
    constructor() {
      this.isOpen = false;
      this.activeTab = 'promemoria'; // 'promemoria' | 'rubrica' | 'storico' | 'backup'
      this.activeRubricaSub = 'cantieri'; // 'cantieri' | 'operai' | 'subappalti' | 'noleggi'
      this.lastFocusedElement = null;
      this.isInitialized = false;

      // Dipendenze
      this.store = global.CantiereStore || null;
      this.notifications = global.notificationsManager || null;
      this.app = global.CantiereApp || null;
    }

    init() {
      if (typeof document === 'undefined') return this;
      if (this.isInitialized) return this;

      this.bindElements();
      this.bindEvents();
      this.initPromemoriaUI();
      this.renderRubrica();
      this.renderHistory();

      this.isInitialized = true;
      return this;
    }

    bindElements() {
      this.backdrop = document.getElementById('drawer-backdrop');
      this.panel = document.getElementById('drawer-panel');
      this.btnOpen = document.getElementById('btn-open-drawer') || document.getElementById('btn-open-menu');
      this.btnClose = document.getElementById('btn-close-drawer');

      // Schede Principali Drawer
      this.tabButtons = document.querySelectorAll('.drawer-nav-tab');
      this.sections = {
        promemoria: document.getElementById('section-promemoria'),
        rubrica: document.getElementById('section-rubrica'),
        storico: document.getElementById('section-storico'),
        backup: document.getElementById('section-backup')
      };

      // Sezione 1: Promemoria
      this.toggleReminder = document.getElementById('toggle-reminder-enabled');
      this.reminderStatusHint = document.getElementById('reminder-status-hint');
      this.time1Input = document.getElementById('reminder-time-1');
      this.time2Input = document.getElementById('reminder-time-2');
      this.daysGrid = document.getElementById('reminder-days-grid');
      this.btnTestNotification = document.getElementById('btn-test-notification');
      this.permBadge = document.getElementById('notification-perm-badge');

      // Sezione 2: Rubrica
      this.rubricaPills = document.querySelectorAll('.rubrica-pill');
      this.rubricaListContainer = document.getElementById('rubrica-list-container');
      this.rubricaAddBox = document.getElementById('rubrica-add-box');
      this.countCantieri = document.getElementById('count-cantieri');
      this.countOperai = document.getElementById('count-operai');
      this.countSubappalti = document.getElementById('count-subappalti');
      this.countNoleggi = document.getElementById('count-noleggi');

      // Sezione 3: Storico
      this.historyListContainer = document.getElementById('history-list-container');

      // Sezione 4: Backup
      this.btnExportBackup = document.getElementById('btn-export-backup');
      this.btnImportBackup = document.getElementById('btn-import-backup');
      this.inputBackupFile = document.getElementById('input-backup-file');
      this.btnResetDefaults = document.getElementById('btn-reset-defaults');
    }

    bindEvents() {
      // 1. Apertura / Chiusura Drawer
      if (this.btnOpen) {
        this.btnOpen.addEventListener('click', () => this.open());
      }
      // Supporto anche al vecchio id se presente separatamente nel DOM
      const btnOldMenu = document.getElementById('btn-open-menu');
      if (btnOldMenu && btnOldMenu !== this.btnOpen) {
        btnOldMenu.addEventListener('click', () => this.open());
      }

      if (this.btnClose) {
        this.btnClose.addEventListener('click', () => this.close());
      }

      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.close());
      }

      // Tasto Escape e Trap Focus da tastiera
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen) return;

        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          this.close();
          return;
        }

        if (e.key === 'Tab' || e.keyCode === 9) {
          this.handleFocusTrap(e);
        }
      });

      // 2. Cambio Scheda Principale
      if (this.tabButtons) {
        this.tabButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            this.switchTab(tabName);
          });
        });
      }

      // 3. Sezione Promemoria: Eventi
      if (this.toggleReminder) {
        this.toggleReminder.addEventListener('change', () => {
          const isEnabled = this.toggleReminder.checked;
          this.saveReminderSettings({ reminderEnabled: isEnabled });
          if (this.reminderStatusHint) {
            this.reminderStatusHint.textContent = isEnabled ? 'Attive nei giorni feriali' : 'Disattivate';
          }
          this.showToast(isEnabled ? '🔔 Promemoria attivati' : '🔕 Promemoria disattivati', 'info');
        });
      }

      if (this.time1Input) {
        this.time1Input.addEventListener('change', () => {
          const val = this.time1Input.value || '11:55';
          this.saveReminderSettings({ time1: val });
          this.showToast(`Orario pranzo impostato: ${val}`, 'info');
        });
      }

      if (this.time2Input) {
        this.time2Input.addEventListener('change', () => {
          const val = this.time2Input.value || '16:55';
          this.saveReminderSettings({ time2: val });
          this.showToast(`Orario fine turno impostato: ${val}`, 'info');
        });
      }

      if (this.daysGrid) {
        this.daysGrid.querySelectorAll('.day-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const dayNum = parseInt(chip.getAttribute('data-day'), 10);
            const currentSettings = this.getReminderSettings();
            let days = Array.isArray(currentSettings.days) ? [...currentSettings.days] : [1, 2, 3, 4, 5];

            if (days.includes(dayNum)) {
              if (days.length === 1) {
                this.showToast('Attenzione: mantieni selezionato almeno un giorno.', 'danger');
                return;
              }
              days = days.filter(d => d !== dayNum);
              chip.classList.remove('active');
            } else {
              days.push(dayNum);
              days.sort();
              chip.classList.add('active');
            }

            this.saveReminderSettings({ days });
          });
        });
      }

      if (this.btnTestNotification) {
        this.btnTestNotification.addEventListener('click', async () => {
          if (this.notifications && typeof this.notifications.requestPermission === 'function') {
            const perm = await this.notifications.requestPermission();
            this.updatePermissionBadge(perm);

            if (perm === 'granted') {
              const res = await this.notifications.sendTestNotification();
              if (res && res.success) {
                this.showToast('🔔 Notifica di test inviata con successo!', 'success');
              } else {
                this.showToast('Notifica test generata sul dispositivo', 'info');
              }
            } else {
              this.showToast('Permesso notifiche non concesso nel browser.', 'danger');
            }
          } else {
            this.showToast('Notifica test inviata!', 'success');
          }
        });
      }

      // 4. Sezione Rubrica: Sotto-schede
      if (this.rubricaPills) {
        this.rubricaPills.forEach(pill => {
          pill.addEventListener('click', () => {
            const sub = pill.getAttribute('data-sub');
            this.switchRubricaSub(sub);
          });
        });
      }

      // 5. Sezione Backup: Eventi
      if (this.btnExportBackup) {
        this.btnExportBackup.addEventListener('click', () => this.exportBackup());
      }

      if (this.btnImportBackup && this.inputBackupFile) {
        this.btnImportBackup.addEventListener('click', () => {
          this.inputBackupFile.click();
        });

        this.inputBackupFile.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            this.importBackup(file);
          }
          this.inputBackupFile.value = '';
        });
      }

      if (this.btnResetDefaults) {
        this.btnResetDefaults.addEventListener('click', () => {
          if (confirm('Vuoi ripristinare i cantieri, operai, subappalti e noleggi predefiniti Vittorini? Lo storico dei rapportini compilati non verrà cancellato.')) {
            if (this.store) {
              this.store.resetToDefaults({ keepRapportini: true });
              this.refreshAll();
              this.showToast('✓ Dati Vittorini ripristinati con successo', 'success');
            }
          }
        });
      }
    }

    // =========================================================================
    // APERTURA / CHIUSURA & ACCESSIBILITÀ
    // =========================================================================

    open() {
      if (!this.panel || !this.backdrop) return;
      this.isOpen = true;
      this.lastFocusedElement = document.activeElement;

      this.backdrop.classList.add('open');
      this.panel.classList.add('open');
      this.panel.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');

      // Aggiorna contenuti freschi
      this.initPromemoriaUI();
      this.renderRubrica();
      this.renderHistory();

      // Focus accessibility
      setTimeout(() => {
        if (this.btnClose) {
          this.btnClose.focus();
        }
      }, 50);
    }

    close() {
      if (!this.panel || !this.backdrop) return;
      this.isOpen = false;

      this.backdrop.classList.remove('open');
      this.panel.classList.remove('open');
      this.panel.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');

      // Ripristino focus originario
      if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
    }

    handleFocusTrap(e) {
      if (!this.panel) return;
      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusables = Array.from(this.panel.querySelectorAll(focusableSelectors))
        .filter(el => !el.disabled && el.offsetParent !== null);

      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    // =========================================================================
    // CAMBIO SCHEDA DRAWER
    // =========================================================================

    switchTab(tabName) {
      if (!this.sections[tabName]) return;
      this.activeTab = tabName;

      // Aggiorna stato bottoni
      if (this.tabButtons) {
        this.tabButtons.forEach(btn => {
          const isActive = btn.getAttribute('data-tab') === tabName;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      }

      // Aggiorna sezioni visibili
      Object.keys(this.sections).forEach(key => {
        const sec = this.sections[key];
        if (sec) {
          sec.classList.toggle('active', key === tabName);
        }
      });

      // Refresh dati sezione attiva
      if (tabName === 'rubrica') {
        this.renderRubrica();
      } else if (tabName === 'storico') {
        this.renderHistory();
      } else if (tabName === 'promemoria') {
        this.initPromemoriaUI();
      }
    }

    // =========================================================================
    // SEZIONE 1: PROMEMORIA & NOTIFICHE
    // =========================================================================

    getReminderSettings() {
      if (this.notifications && typeof this.notifications.getSettings === 'function') {
        return this.notifications.getSettings();
      }
      if (this.store && typeof this.store.getSettings === 'function') {
        return this.store.getSettings();
      }
      return {
        reminderEnabled: true,
        time1: '11:55',
        time2: '16:55',
        days: [1, 2, 3, 4, 5]
      };
    }

    saveReminderSettings(partialSettings) {
      if (this.notifications && typeof this.notifications.saveSettings === 'function') {
        return this.notifications.saveSettings(partialSettings);
      }
      if (this.store && typeof this.store.saveSettings === 'function') {
        return this.store.saveSettings(partialSettings);
      }
      return partialSettings;
    }

    initPromemoriaUI() {
      const s = this.getReminderSettings();

      if (this.toggleReminder) {
        this.toggleReminder.checked = Boolean(s.reminderEnabled);
      }
      if (this.reminderStatusHint) {
        this.reminderStatusHint.textContent = s.reminderEnabled ? 'Attive nei giorni feriali' : 'Disattivate';
      }

      if (this.time1Input) {
        this.time1Input.value = s.time1 || '11:55';
      }
      if (this.time2Input) {
        this.time2Input.value = s.time2 || '16:55';
      }

      if (this.daysGrid) {
        const days = Array.isArray(s.days) ? s.days : [1, 2, 3, 4, 5];
        this.daysGrid.querySelectorAll('.day-chip').forEach(chip => {
          const d = parseInt(chip.getAttribute('data-day'), 10);
          chip.classList.toggle('active', days.includes(d));
        });
      }

      if (this.notifications) {
        this.updatePermissionBadge(this.notifications.getPermission());
      }
    }

    updatePermissionBadge(perm) {
      if (!this.permBadge) return;
      if (perm === 'granted') {
        this.permBadge.className = 'p-2 text-xs rounded-md bg-success-light text-success font-semibold text-center';
        this.permBadge.textContent = '✓ Permessi notifiche concessi su questo dispositivo';
      } else if (perm === 'denied') {
        this.permBadge.className = 'p-2 text-xs rounded-md bg-danger text-white font-semibold text-center';
        this.permBadge.textContent = '⚠️ Notifiche bloccate nelle impostazioni del browser';
      } else if (perm === 'unsupported') {
        this.permBadge.className = 'p-2 text-xs rounded-md bg-light text-neutral text-center';
        this.permBadge.textContent = 'ℹ️ Notifiche push non supportate da questo browser';
      } else {
        this.permBadge.className = 'p-2 text-xs rounded-md bg-light text-neutral text-center';
        this.permBadge.textContent = 'Stato permessi: In attesa di autorizzazione';
      }
    }

    // =========================================================================
    // SEZIONE 2: RUBRICA & ANAGRAFICHE LOCALI
    // =========================================================================

    switchRubricaSub(subName) {
      this.activeRubricaSub = subName;
      if (this.rubricaPills) {
        this.rubricaPills.forEach(pill => {
          const isActive = pill.getAttribute('data-sub') === subName;
          pill.classList.toggle('active', isActive);
        });
      }
      this.renderRubrica();
    }

    renderRubrica() {
      if (!this.store) return;

      const cantieri = this.store.getCantieri() || [];
      const operai = this.store.getOperai() || [];
      const subappalti = this.store.getSubappalti() || [];
      const noleggi = this.store.getNoleggi() || [];

      // Aggiorna badge contatori
      if (this.countCantieri) this.countCantieri.textContent = cantieri.length;
      if (this.countOperai) this.countOperai.textContent = operai.length;
      if (this.countSubappalti) this.countSubappalti.textContent = subappalti.length;
      if (this.countNoleggi) this.countNoleggi.textContent = noleggi.length;

      if (!this.rubricaListContainer || !this.rubricaAddBox) return;
      this.rubricaListContainer.innerHTML = '';
      this.rubricaAddBox.innerHTML = '';

      const trashIcon = (typeof global.renderIcon === 'function')
        ? global.renderIcon('trash', 'text-danger', 18)
        : '🗑️';

      // 1. Render Lista in base al sotto-tab attivo
      if (this.activeRubricaSub === 'cantieri') {
        cantieri.forEach(c => {
          const safeNome = escapeHtml(c.nome);
          const safeSub = escapeHtml(`${c.localita || 'Nessuna località specifica'}${c.commessa ? ' • ' + c.commessa : ''}`);
          const card = document.createElement('div');
          card.className = 'rubrica-card';
          card.innerHTML = `
            <div class="rubrica-card-info">
              <div class="rubrica-card-title">${safeNome}</div>
              <div class="rubrica-card-sub">${safeSub}</div>
            </div>
            <button type="button" class="btn-icon-danger" aria-label="Elimina cantiere ${safeNome}">
              ${trashIcon}
            </button>
          `;
          card.querySelector('.btn-icon-danger').addEventListener('click', () => {
            if (confirm(`Eliminare il cantiere "${c.nome}" dalla rubrica?`)) {
              this.store.deleteCantiere(c.id);
              this.notifyAppSync();
              this.renderRubrica();
              this.showToast(`Cantiere "${c.nome}" eliminato`, 'info');
            }
          });
          this.rubricaListContainer.appendChild(card);
        });

        // Form aggiunta Cantiere
        this.rubricaAddBox.innerHTML = `
          <div class="text-xs font-bold text-dark mb-1">+ Nuovo Cantiere Vittorini</div>
          <input type="text" id="add-cantiere-nome" class="form-input text-sm" placeholder="Nome cantiere (es. Santuario Madonna)">
          <input type="text" id="add-cantiere-localita" class="form-input text-sm" placeholder="Località (es. Loc. Varoni, Amatrice)">
          <input type="text" id="add-cantiere-commessa" class="form-input text-sm" placeholder="Commessa / Appalto (es. Sisma 2016)">
          <button type="button" id="btn-submit-add-cantiere" class="btn btn-primary btn-block text-sm" style="min-height:44px;">
            <span>Aggiungi Cantiere</span>
          </button>
        `;
        const btnAdd = this.rubricaAddBox.querySelector('#btn-submit-add-cantiere');
        btnAdd.addEventListener('click', () => {
          const nomeInput = this.rubricaAddBox.querySelector('#add-cantiere-nome');
          const locInput = this.rubricaAddBox.querySelector('#add-cantiere-localita');
          const commInput = this.rubricaAddBox.querySelector('#add-cantiere-commessa');

          const nome = (nomeInput.value || '').trim();
          if (!nome) {
            this.showToast('Il nome del cantiere è obbligatorio.', 'danger');
            nomeInput.focus();
            return;
          }

          this.store.saveCantiere(nome, locInput.value, commInput.value);
          this.notifyAppSync();
          this.renderRubrica();
          this.showToast(`Cantiere "${nome}" aggiunto alla rubrica`, 'success');
        });

      } else if (this.activeRubricaSub === 'operai') {
        operai.forEach(op => {
          const safeNome = escapeHtml(op.nome);
          const card = document.createElement('div');
          card.className = 'rubrica-card';
          card.innerHTML = `
            <div class="rubrica-card-info">
              <div class="rubrica-card-title">${safeNome}</div>
              <div class="rubrica-card-sub">Personale Vittorini Emidio Costruzioni</div>
            </div>
            <button type="button" class="btn-icon-danger" aria-label="Elimina operaio ${safeNome}">
              ${trashIcon}
            </button>
          `;
          card.querySelector('.btn-icon-danger').addEventListener('click', () => {
            if (confirm(`Eliminare l'operaio "${op.nome}" dalla rubrica?`)) {
              this.store.deleteOperaio(op.id);
              this.notifyAppSync();
              this.renderRubrica();
              this.showToast(`Operaio "${op.nome}" rimosso`, 'info');
            }
          });
          this.rubricaListContainer.appendChild(card);
        });

        // Form aggiunta Operaio
        this.rubricaAddBox.innerHTML = `
          <div class="text-xs font-bold text-dark mb-1">+ Nuovo Operaio Vittorini</div>
          <input type="text" id="add-operaio-nome" class="form-input text-sm" placeholder="Nome e Cognome operaio">
          <button type="button" id="btn-submit-add-operaio" class="btn btn-primary btn-block text-sm" style="min-height:44px;">
            <span>Aggiungi Operaio</span>
          </button>
        `;
        const btnAdd = this.rubricaAddBox.querySelector('#btn-submit-add-operaio');
        btnAdd.addEventListener('click', () => {
          const nomeInput = this.rubricaAddBox.querySelector('#add-operaio-nome');
          const nome = (nomeInput.value || '').trim();
          if (!nome) {
            this.showToast("Il nome dell'operaio è obbligatorio.", 'danger');
            nomeInput.focus();
            return;
          }

          this.store.saveOperaio(nome);
          this.notifyAppSync();
          this.renderRubrica();
          this.showToast(`Operaio "${nome}" aggiunto alla rubrica`, 'success');
        });

      } else if (this.activeRubricaSub === 'subappalti') {
        subappalti.forEach(sub => {
          const safeNome = escapeHtml(sub.nome);
          const card = document.createElement('div');
          card.className = 'rubrica-card';
          card.innerHTML = `
            <div class="rubrica-card-info">
              <div class="rubrica-card-title">${safeNome}</div>
              <div class="rubrica-card-sub">Ditta Subappaltatrice abituale</div>
            </div>
            <button type="button" class="btn-icon-danger" aria-label="Elimina subappalto ${safeNome}">
              ${trashIcon}
            </button>
          `;
          card.querySelector('.btn-icon-danger').addEventListener('click', () => {
            if (confirm(`Eliminare "${sub.nome}" dai subappalti?`)) {
              this.store.deleteSubappalto(sub.id);
              this.notifyAppSync();
              this.renderRubrica();
              this.showToast(`Ditta "${sub.nome}" rimossa`, 'info');
            }
          });
          this.rubricaListContainer.appendChild(card);
        });

        // Form aggiunta Subappalto
        this.rubricaAddBox.innerHTML = `
          <div class="text-xs font-bold text-dark mb-1">+ Nuova Ditta Subappaltatrice</div>
          <input type="text" id="add-sub-nome" class="form-input text-sm" placeholder="Ragione sociale ditta">
          <button type="button" id="btn-submit-add-sub" class="btn btn-primary btn-block text-sm" style="min-height:44px;">
            <span>Aggiungi Subappalto</span>
          </button>
        `;
        const btnAdd = this.rubricaAddBox.querySelector('#btn-submit-add-sub');
        btnAdd.addEventListener('click', () => {
          const nomeInput = this.rubricaAddBox.querySelector('#add-sub-nome');
          const nome = (nomeInput.value || '').trim();
          if (!nome) {
            this.showToast('La denominazione della ditta è obbligatoria.', 'danger');
            nomeInput.focus();
            return;
          }

          this.store.saveSubappalto(nome);
          this.notifyAppSync();
          this.renderRubrica();
          this.showToast(`Ditta "${nome}" aggiunta`, 'success');
        });

      } else if (this.activeRubricaSub === 'noleggi') {
        noleggi.forEach(nol => {
          const safeNome = escapeHtml(nol.nome);
          const card = document.createElement('div');
          card.className = 'rubrica-card';
          card.innerHTML = `
            <div class="rubrica-card-info">
              <div class="rubrica-card-title">${safeNome}</div>
              <div class="rubrica-card-sub">Macchinario / Mezzo frequente</div>
            </div>
            <button type="button" class="btn-icon-danger" aria-label="Elimina noleggio ${safeNome}">
              ${trashIcon}
            </button>
          `;
          card.querySelector('.btn-icon-danger').addEventListener('click', () => {
            if (confirm(`Eliminare "${nol.nome}" dai noleggi?`)) {
              this.store.deleteNoleggio(nol.id);
              this.notifyAppSync();
              this.renderRubrica();
              this.showToast(`Mezzo "${nol.nome}" rimosso`, 'info');
            }
          });
          this.rubricaListContainer.appendChild(card);
        });

        // Form aggiunta Noleggio
        this.rubricaAddBox.innerHTML = `
          <div class="text-xs font-bold text-dark mb-1">+ Nuovo Macchinario / Mezzo</div>
          <input type="text" id="add-noleggio-nome" class="form-input text-sm" placeholder="Descrizione mezzo (es. Escavatore 50q)">
          <button type="button" id="btn-submit-add-noleggio" class="btn btn-primary btn-block text-sm" style="min-height:44px;">
            <span>Aggiungi Mezzo</span>
          </button>
        `;
        const btnAdd = this.rubricaAddBox.querySelector('#btn-submit-add-noleggio');
        btnAdd.addEventListener('click', () => {
          const nomeInput = this.rubricaAddBox.querySelector('#add-noleggio-nome');
          const nome = (nomeInput.value || '').trim();
          if (!nome) {
            this.showToast('La descrizione del mezzo è obbligatoria.', 'danger');
            nomeInput.focus();
            return;
          }

          this.store.saveNoleggio(nome);
          this.notifyAppSync();
          this.renderRubrica();
          this.showToast(`Mezzo "${nome}" aggiunto`, 'success');
        });
      }
    }

    /**
     * Sincronizza istantaneamente autocomplete e chip nell'app principale
     */
    notifyAppSync() {
      const app = this.app || (typeof window !== 'undefined' ? window.CantiereApp : null);
      if (app && typeof app.refreshFromStore === 'function') {
        app.refreshFromStore();
      }
    }

    // =========================================================================
    // SEZIONE 3: REGISTRO & STORICO RAPPORTINI
    // =========================================================================

    renderHistory() {
      if (!this.historyListContainer) return;
      this.historyListContainer.innerHTML = '';

      if (!this.store) return;
      const list = this.store.getRapportini() || [];

      if (list.length === 0) {
        this.historyListContainer.innerHTML = `
          <div class="text-center p-4 text-neutral">
            <div style="font-size:32px; margin-bottom:8px;">📋</div>
            <div class="font-semibold text-dark mb-1">Nessun rapportino nel registro</div>
            <div class="text-xs">Compila i box e tocca "Salva Bozza nel Registro" dalla barra in basso per visualizzare lo storico qui.</div>
          </div>
        `;
        return;
      }

      list.forEach(report => {
        const card = document.createElement('div');
        card.className = 'history-card';

        const cantiereName = typeof report.cantiere === 'string'
          ? report.cantiere
          : (report.cantiere && report.cantiere.nome ? report.cantiere.nome : 'Cantiere non specificato');

        const dataFormattata = formatDateItalian(report.data || '');
        const totVit = report.totaleOperaiVittorini !== undefined ? report.totaleOperaiVittorini : (Array.isArray(report.operai) ? report.operai.length : 0);
        const totSub = report.totaleOperaiSubappalti !== undefined ? report.totaleOperaiSubappalti : 0;
        const totComplessivo = totVit + totSub;
        const meteoStr = report.meteo ? report.meteo.toUpperCase() : 'Non specificato';
        const tempStr = report.temperatura !== undefined ? `${report.temperatura}°C` : '';
        const fotoCount = Array.isArray(report.foto) ? report.foto.length : 0;
        const completedCount = report.completedCount !== undefined ? report.completedCount : (report.isComplete ? 9 : '-');

        const safeDate = escapeHtml(dataFormattata || 'Data N.D.');
        const safeCantiere = escapeHtml(cantiereName);
        const safeMeteo = escapeHtml(meteoStr + (tempStr ? ' • ' + tempStr : ''));
        const safeCount = escapeHtml(completedCount);

        card.innerHTML = `
          <div class="history-card-header">
            <span class="history-date">📅 ${safeDate}</span>
            <span class="box-status-badge ${completedCount === 9 ? 'completed' : 'pending'}">
              ${completedCount === 9 ? '✓ 9/9' : `${safeCount}/9 completati`}
            </span>
          </div>
          <div class="history-cantiere">${safeCantiere}</div>
          <div class="history-meta-row">
            <span>👷 ${Number(totComplessivo) || 0} operai (${Number(totVit) || 0} Vit. + ${Number(totSub) || 0} Sub)</span>
            <span>🌤️ ${safeMeteo}</span>
            ${fotoCount > 0 ? `<span>📷 ${Number(fotoCount) || 0} foto</span>` : ''}
          </div>
          <div class="history-actions">
            <button type="button" class="btn btn-primary btn-block text-xs btn-load-report" style="min-height:40px;">
              <span>📥 Carica nell'App</span>
            </button>
            <button type="button" class="btn btn-outline-danger btn-delete-report" style="min-height:40px;" aria-label="Elimina rapportino">
              <span>🗑️</span>
            </button>
          </div>
        `;

        // Evento: Carica nell'app
        const btnLoad = card.querySelector('.btn-load-report');
        btnLoad.addEventListener('click', () => {
          this.loadReportIntoApp(report);
        });

        // Evento: Elimina
        const btnDelete = card.querySelector('.btn-delete-report');
        btnDelete.addEventListener('click', () => {
          if (confirm(`Sei sicuro di voler eliminare dal registro il rapportino del ${dataFormattata} (${cantiereName})?`)) {
            this.store.deleteRapportino(report.id);
            this.renderHistory();
            this.showToast('Rapportino eliminato dal registro', 'info');
          }
        });

        this.historyListContainer.appendChild(card);
      });
    }

    /**
     * Carica il rapportino passato o bozza nell'app principale e chiude il drawer
     * @param {Object} report 
     */
    loadReportIntoApp(report) {
      const app = this.app || (typeof window !== 'undefined' ? window.CantiereApp : null);
      if (app && typeof app.loadReport === 'function') {
        app.loadReport(report);
        this.close();
        const dataStr = formatDateItalian(report.data || '');
        this.showToast(`✓ Rapportino del ${dataStr} caricato nei 9 box!`, 'success');
      } else {
        console.warn('[Drawer] Impossibile caricare rapportino: CantiereApp non disponibile.');
      }
    }

    // =========================================================================
    // SEZIONE 4: BACKUP & RIPRISTINO (JSON)
    // =========================================================================

    exportBackup() {
      if (!this.store) return;
      try {
        const data = this.store.exportAllData();
        const jsonStr = JSON.stringify(data, null, 2);
        const todayIso = getTodayIso();
        const fileName = `backup_cantieresmart_${todayIso}.json`;

        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`✓ Backup esportato: ${fileName}`, 'success');
      } catch (err) {
        console.error('[Drawer] Errore esportazione backup:', err);
        this.showToast('Errore durante l\'esportazione del backup.', 'danger');
      }
    }

    importBackup(file) {
      if (!file || !this.store) return;
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const result = this.store.importAllData(parsed);

          this.refreshAll();
          this.showToast(
            `✓ Ripristino completato: ${result.countCantieri} cantieri, ${result.countOperai} operai, ${result.countRapportini} rapportini.`,
            'success',
            4000
          );
        } catch (err) {
          console.error('[Drawer] Errore import backup:', err);
          this.showToast('File backup non valido o danneggiato: ' + err.message, 'danger');
        }
      };

      reader.onerror = () => {
        this.showToast('Errore durante la lettura del file.', 'danger');
      };

      reader.readAsText(file);
    }

    refreshAll() {
      this.initPromemoriaUI();
      this.renderRubrica();
      this.renderHistory();
      this.notifyAppSync();
    }

    showToast(message, type = 'info', duration = 3000) {
      if (typeof global.showToast === 'function') {
        global.showToast(message, type, duration);
      } else if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(message, type, duration);
      } else {
        console.log(`[Toast ${type}]: ${message}`);
      }
    }
  }

  // Istanza Singleton condivisa
  const cantiereDrawerInstance = new CantiereDrawer();

  // Export universale
  if (typeof window !== 'undefined') {
    window.CantiereDrawer = CantiereDrawer;
    window.cantiereDrawer = cantiereDrawerInstance;

    // Avvio al caricamento del DOM
    document.addEventListener('DOMContentLoaded', () => {
      cantiereDrawerInstance.init();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CantiereDrawer,
      cantiereDrawerInstance
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
