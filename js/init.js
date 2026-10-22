/**
 * CantiereSmart - Inizializzazione Loghi, Icone SVG, Sicurezza e Service Worker
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Inserimento Logo Vittorini
    if (window.VITTORINI_LOGO_BASE64) {
      const headerLogo = document.getElementById('header-logo');
      if (headerLogo) {
        headerLogo.src = window.VITTORINI_LOGO_BASE64;
        headerLogo.style.display = 'block';
      }
      const drawerLogo = document.getElementById('drawer-logo');
      if (drawerLogo) {
        drawerLogo.src = window.VITTORINI_LOGO_BASE64;
        drawerLogo.style.display = 'block';
      }
      const pinLogo = document.getElementById('pin-lock-logo');
      if (pinLogo) {
        pinLogo.src = window.VITTORINI_LOGO_BASE64;
        pinLogo.style.display = 'block';
      }
    }

    // 2. Gestione Blocco App da menu
    const btnLockApp = document.getElementById('btn-lock-app');
    if (btnLockApp && window.AuthManager) {
      btnLockApp.addEventListener('click', () => {
        if (confirm('Vuoi bloccare l\'applicazione su questo dispositivo? Per riaccedere servirà il PIN aziendale.')) {
          window.AuthManager.lock();
        }
      });
    }

    // 3. Render icone SVG ad alta definizione
    if (typeof window.renderIcon === 'function') {
      const setIcon = (id, iconName, cls = '', size = 20) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = window.renderIcon(iconName, cls, size);
      };

      setIcon('menu-icon-placeholder', 'menu', 'text-white', 24);
      setIcon('box-1-icon', 'building', 'text-primary', 22);
      setIcon('box-2-icon', 'sun', 'text-primary', 22);
      setIcon('box-3-icon', 'hammer', 'text-primary', 22);
      setIcon('box-4-icon', 'users', 'text-primary', 22);
      setIcon('box-5-icon', 'briefcase', 'text-primary', 22);
      setIcon('box-6-icon', 'truck', 'text-primary', 22);
      setIcon('box-7-icon', 'package', 'text-primary', 22);
      setIcon('box-8-icon', 'fileText', 'text-primary', 22);
      setIcon('box-9-icon', 'camera', 'text-primary', 22);

      // Icone Meteo
      setIcon('weather-icon-sereno', 'sun', '', 26);
      setIcon('weather-icon-nuvoloso', 'cloud', '', 26);
      setIcon('weather-icon-pioggia', 'rain', '', 26);
      setIcon('weather-icon-neve', 'snow', '', 26);

      // Icone Azioni
      setIcon('camera-icon-ph', 'camera', '', 20);
      setIcon('complete-icon-ph', 'checkCircle', 'text-white', 20);
      setIcon('pdf-icon-ph', 'filePdf', '', 20);
      setIcon('docx-icon-ph', 'fileWord', '', 20);
      setIcon('modal-pdf-icon-ph', 'filePdf', '', 20);
      setIcon('modal-docx-icon-ph', 'fileWord', '', 20);
      setIcon('save-icon-ph', 'checkCircle', '', 16);

      // Icone Schede Drawer
      setIcon('tab-icon-promemoria', 'bell', '', 18);
      setIcon('tab-icon-rubrica', 'book', '', 18);
      setIcon('tab-icon-storico', 'history', '', 18);
      setIcon('tab-icon-backup', 'database', '', 18);

      setIcon('icon-ph-promemoria-head', 'bell', 'text-primary', 20);
      setIcon('icon-ph-rubrica-head', 'book', 'text-primary', 20);
      setIcon('icon-ph-storico-head', 'history', 'text-primary', 20);
      setIcon('icon-ph-backup-head', 'database', 'text-primary', 20);
      setIcon('icon-ph-download-backup', 'download', 'text-primary', 20);
      setIcon('icon-ph-upload-backup', 'upload', 'text-primary', 20);
    }

    // 4. Inizializzazione AuthManager (Verifica Dispositivo Una Tantum + Vault Crittografato)
    if (window.AuthManager && typeof window.AuthManager.init === 'function') {
      window.AuthManager.init();
    }

    // 5. Avvio scheduler notifiche promemoria
    if (window.notificationsManager && typeof window.notificationsManager.startScheduler === 'function') {
      window.notificationsManager.startScheduler();
    }
  });

  // Registrazione Service Worker Offline-First
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrato con successo. Scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Errore registrazione Service Worker:', err);
        });
    });
  }
})();

