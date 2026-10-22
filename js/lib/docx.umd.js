/**
 * CantiereSmart - Standalone OpenXML Docx Library (UMD)
 * Impresa: Vittorini Emidio Costruzioni S.r.l.
 * 
 * Modulo autonomo client-side per la creazione e manipolazione di file
 * OpenXML Word (.docx) 100% offline, conforme agli standard ECMA-376 / ISO/IEC 29500.
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(['fflate'], factory);
  } else if (typeof module === 'object' && module.exports) {
    let fflateMod;
    try {
      fflateMod = require('./fflate.umd.min.js');
    } catch (e) {
      try {
        fflateMod = require('fflate');
      } catch (e2) {
        fflateMod = null;
      }
    }
    module.exports = factory(fflateMod);
  } else {
    root.DocxLib = factory(root.fflate);
    // Alias globale per compatibilità
    if (!root.docx) {
      root.docx = root.DocxLib;
    }
  }
})(typeof self !== 'undefined' ? self : this, function (fflate) {
  'use strict';

  function resolveFflate() {
    if (fflate && typeof fflate.zipSync === 'function') return fflate;
    if (typeof window !== 'undefined' && window.fflate && typeof window.fflate.zipSync === 'function') {
      return window.fflate;
    }
    if (typeof globalThis !== 'undefined' && globalThis.fflate && typeof globalThis.fflate.zipSync === 'function') {
      return globalThis.fflate;
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./fflate.umd.min.js');
        if (mod && typeof mod.zipSync === 'function') return mod;
      } catch (e) {
        try {
          const mod = require('fflate');
          if (mod && typeof mod.zipSync === 'function') return mod;
        } catch (e2) {}
      }
    }
    return null;
  }

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function parseBase64Image(dataUriOrObj) {
    let rawUri = '';
    let origName = '';

    if (typeof dataUriOrObj === 'string') {
      rawUri = dataUriOrObj;
    } else if (dataUriOrObj && typeof dataUriOrObj === 'object') {
      rawUri = dataUriOrObj.dataUrl || dataUriOrObj.url || dataUriOrObj.src || '';
      origName = dataUriOrObj.name || '';
    }

    if (!rawUri || typeof rawUri !== 'string') return null;

    let mime = 'image/jpeg';
    let ext = 'jpeg';
    let base64 = rawUri;

    const match = rawUri.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      base64 = match[2];
      if (mime.includes('png')) ext = 'png';
      else ext = 'jpeg';
    } else {
      // Se è già solo stringa base64
      base64 = rawUri.trim();
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
      console.warn('[DocxLib] Errore decodifica base64 immagine:', e.message);
      return null;
    }

    return { bytes, ext, mime, name: origName };
  }

  function createPackage(files) {
    const zipEngine = resolveFflate();
    if (!zipEngine) {
      throw new Error('[DocxLib] Motore ZIP (fflate) non disponibile.');
    }

    const zipInput = {};
    for (const [filePath, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        zipInput[filePath] = zipEngine.strToU8(content);
      } else if (content instanceof Uint8Array) {
        zipInput[filePath] = content;
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
        zipInput[filePath] = new Uint8Array(content);
      } else {
        zipInput[filePath] = zipEngine.strToU8(String(content));
      }
    }

    return zipEngine.zipSync(zipInput);
  }

  return {
    version: '1.0.0',
    escapeXml,
    parseBase64Image,
    createPackage,
    resolveFflate
  };
});
