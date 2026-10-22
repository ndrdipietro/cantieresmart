/**
 * CantiereSmart - Modulo Gestione Notifiche & Promemoria Orari
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Gestisce l'autorizzazione alle notifiche Web/PWA, la schedulazione dei
 * promemoria giornalieri negli orari rigorosi (11:55 e 16:55) dal lunedì al venerdì,
 * e l'invio di notifiche di test immediate.
 */

(function (global) {
  'use strict';

  const NOTIFICATION_CONSTANTS = {
    DEFAULT_TIME_1: '11:55',
    DEFAULT_TIME_2: '16:55',
    DEFAULT_DAYS: [1, 2, 3, 4, 5], // Lunedì - Venerdì (1=Lun, 5=Ven)
    DEFAULT_TITLE: 'CantiereSmart - Promemoria',
    DEFAULT_BODY: 'Promemoria Cantiere Vittorini: Ricordati di compilare il rapportino di oggi!',
    DEFAULT_ICON: 'assets/icon-192.png',
    STORAGE_KEY_LAST_NOTIFICATION: 'cantieresmart_last_notification_slot'
  };

  class NotificationsManager {
    constructor(options = {}) {
      this.store = options.store || (typeof global.CantiereStore !== 'undefined' ? global.CantiereStore : null);
      this.intervalId = null;
      this.lastFiredSlot = null;
      this.constants = NOTIFICATION_CONSTANTS;
    }

    /**
     * Verifica supporto Notifiche nel browser
     * @returns {boolean}
     */
    isSupported() {
      if (typeof global.Notification !== 'undefined') return true;
      if (typeof global.navigator !== 'undefined' && 'serviceWorker' in global.navigator && 'Notification' in global) return true;
      return false;
    }

    /**
     * Restituisce lo stato corrente dell'autorizzazione notifiche
     * @returns {'granted'|'denied'|'default'|'unsupported'}
     */
    getPermission() {
      if (!this.isSupported()) return 'unsupported';
      return global.Notification.permission;
    }

    /**
     * Richiede autorizzazione all'utente
     * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
     */
    async requestPermission() {
      if (!this.isSupported()) return 'unsupported';
      try {
        const permission = await global.Notification.requestPermission();
        return permission;
      } catch (err) {
        console.warn('[Notifications] Errore richiesta permessi:', err);
        return 'denied';
      }
    }

    /**
     * Recupera le impostazioni promemoria correnti dallo Store
     * @returns {{reminderEnabled: boolean, time1: string, time2: string, days: number[]}}
     */
    getSettings() {
      if (this.store && typeof this.store.getSettings === 'function') {
        return this.store.getSettings();
      }
      return {
        reminderEnabled: true,
        time1: NOTIFICATION_CONSTANTS.DEFAULT_TIME_1,
        time2: NOTIFICATION_CONSTANTS.DEFAULT_TIME_2,
        days: [...NOTIFICATION_CONSTANTS.DEFAULT_DAYS]
      };
    }

    /**
     * Aggiorna e salva le impostazioni promemoria
     * @param {Object} newSettings 
     * @returns {Object}
     */
    saveSettings(newSettings) {
      if (this.store && typeof this.store.saveSettings === 'function') {
        return this.store.saveSettings(newSettings);
      }
      return Object.assign(this.getSettings(), newSettings || {});
    }

    /**
     * Invia una notifica generica via Service Worker o fallback Web Notification
     * @param {string} [title] 
     * @param {string} [body] 
     * @param {Object} [options] 
     * @returns {Promise<{success: boolean, method: string, reason?: string}>}
     */
    async sendNotification(title, body, options = {}) {
      const finalTitle = title || NOTIFICATION_CONSTANTS.DEFAULT_TITLE;
      const finalBody = body || NOTIFICATION_CONSTANTS.DEFAULT_BODY;
      const notifOptions = Object.assign({
        body: finalBody,
        icon: NOTIFICATION_CONSTANTS.DEFAULT_ICON,
        badge: NOTIFICATION_CONSTANTS.DEFAULT_ICON,
        tag: 'vittorini-reminder',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: './', timestamp: Date.now() }
      }, options);

      // Se permessi non concessi
      const perm = this.getPermission();
      if (perm !== 'granted') {
        // Fallback per ambienti non-browser (Node mock) o permessi non attivi
        if (typeof global.Notification === 'undefined') {
          return { success: false, method: 'mock', reason: 'PERMISSION_NOT_GRANTED' };
        }
        return { success: false, method: 'none', reason: 'PERMISSION_NOT_GRANTED' };
      }

      // 1. Tentativo con Service Worker (migliore su mobile / background)
      try {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.showNotification) {
            await reg.showNotification(finalTitle, notifOptions);
            return { success: true, method: 'serviceWorker' };
          }
        }
      } catch (swErr) {
        console.warn('[Notifications] Invio via Service Worker non riuscito, fallback...', swErr);
      }

      // 2. Fallback su Notification API standard del browser
      try {
        if (typeof global.Notification === 'function') {
          const notif = new global.Notification(finalTitle, notifOptions);
          if (notifOptions.data && notifOptions.data.url) {
            notif.onclick = () => {
              if (typeof window !== 'undefined') window.focus();
              notif.close();
            };
          }
          return { success: true, method: 'notificationApi' };
        }
      } catch (notifErr) {
        console.error('[Notifications] Errore invio notifica standard:', notifErr);
      }

      return { success: false, method: 'none', reason: 'DISPATCH_ERROR' };
    }

    /**
     * Invia immediatamente una notifica di test
     * @returns {Promise<{success: boolean, method: string, reason?: string}>}
     */
    async sendTestNotification() {
      return this.sendNotification(
        NOTIFICATION_CONSTANTS.DEFAULT_TITLE,
        NOTIFICATION_CONSTANTS.DEFAULT_BODY,
        { tag: 'vittorini-test-reminder', renotify: true }
      );
    }

    /**
     * Controlla orario corrente e condizioni per inviare promemoria automatico
     * @param {Date} [nowDate=new Date()]
     * @returns {Promise<{triggered: boolean, reason?: string, slot?: string}>}
     */
    async checkAndNotify(nowDate = new Date()) {
      const settings = this.getSettings();

      if (!settings.reminderEnabled) {
        return { triggered: false, reason: 'REMINDERS_DISABLED' };
      }

      const dayOfWeek = nowDate.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
      const configuredDays = Array.isArray(settings.days) ? settings.days : NOTIFICATION_CONSTANTS.DEFAULT_DAYS;

      if (!configuredDays.includes(dayOfWeek)) {
        return { triggered: false, reason: 'DAY_NOT_CONFIGURED', day: dayOfWeek };
      }

      const hours = String(nowDate.getHours()).padStart(2, '0');
      const minutes = String(nowDate.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      const time1 = settings.time1 || NOTIFICATION_CONSTANTS.DEFAULT_TIME_1;
      const time2 = settings.time2 || NOTIFICATION_CONSTANTS.DEFAULT_TIME_2;

      let matchingSlot = null;
      if (currentTime === time1) {
        matchingSlot = `slot_1_${time1}`;
      } else if (currentTime === time2) {
        matchingSlot = `slot_2_${time2}`;
      }

      if (!matchingSlot) {
        return { triggered: false, reason: 'NOT_REMINDER_TIME', currentTime };
      }

      // Verifica anti-duplicato per la data odierna
      const yyyy = nowDate.getFullYear();
      const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nowDate.getDate()).padStart(2, '0');
      const todayKey = `${yyyy}-${mm}-${dd}_${matchingSlot}`;

      if (this.lastFiredSlot === todayKey) {
        return { triggered: false, reason: 'ALREADY_FIRED_FOR_SLOT', slot: matchingSlot };
      }

      // Invia la notifica ufficiale
      this.lastFiredSlot = todayKey;
      const res = await this.sendNotification(
        NOTIFICATION_CONSTANTS.DEFAULT_TITLE,
        NOTIFICATION_CONSTANTS.DEFAULT_BODY,
        { tag: `vittorini-reminder-${matchingSlot}` }
      );

      return {
        triggered: true,
        slot: matchingSlot,
        currentTime,
        result: res
      };
    }

    /**
     * Avvia il timer di polling orario in background (ogni 30 secondi)
     * @param {number} [intervalMs=30000] 
     */
    startScheduler(intervalMs = 30000) {
      this.stopScheduler();
      this.intervalId = setInterval(() => {
        this.checkAndNotify().catch(e => {
          console.warn('[Notifications] Errore scheduler check:', e);
        });
      }, intervalMs);
      return this;
    }

    /**
     * Arresta il timer di polling
     */
    stopScheduler() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      return this;
    }
  }

  // Istanza Singleton condivisa
  const notificationsInstance = new NotificationsManager();

  // Export universale
  if (typeof window !== 'undefined') {
    window.NotificationsManager = NotificationsManager;
    window.notificationsManager = notificationsInstance;
    window.NOTIFICATION_CONSTANTS = NOTIFICATION_CONSTANTS;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      NotificationsManager,
      notificationsInstance,
      NOTIFICATION_CONSTANTS
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
