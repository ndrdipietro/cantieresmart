/**
 * CantiereSmart - Modulo di Sicurezza, Verifica Dispositivo Una Tantum & Vault Crittografato
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 *
 * Architettura di Sicurezza Serverless (100% Offline-First):
 * 1. Verifica Dispositivo Una Tantum (Convalida Amministratore vincolata all'ID Dispositivo).
 * 2. Sblocco quotidiano con PIN Aziendale a 6 cifre protetto da PBKDF2-HMAC-SHA256 (150.000 iterazioni).
 * 3. Archivio Aziendale Cifrato (SHA256-CTR + Encrypt-then-HMAC-SHA256 a 256 bit):
 *    Cantieri, CUP/CIG e Subappaltatori sono indecifrabili senza Convalida Dispositivo + PIN.
 * 4. Blocco progressivo dei tentativi e revoca automatica dopo 15 tentativi errati.
 * 5. Scadenza sessione lavorativa automatica (12 ore).
 */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    DEVICE_ID: 'cantieresmart_device_id_v2',
    DEVICE_AUTH: 'cantieresmart_device_auth_v3',
    SESSION: 'cantieresmart_session_v4',
    SESSION_EPH_KEY: 'cantieresmart_eph_key_v4',
    USERDATA_ENC: 'cantieresmart_userdata_enc_v3',
    ATTEMPTS: 'cantieresmart_auth_attempts_v2',
    LEGACY_DEVICE_AUTH_V2: 'cantieresmart_device_auth_v2',
    LEGACY_SESSION_V3: 'cantieresmart_session_v3',
    LEGACY_SESSION_V2: 'cantieresmart_session_v2',
    LEGACY_UNLOCKED: 'cantieresmart_unlocked_v1'
  };

  const PBKDF2_ITERATIONS = 150000;
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ore (turno lavorativo)
  const MAX_TOTAL_ATTEMPTS = 15;
  const B32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // Archivio Aziendale Crittografato (PBKDF2-HMAC-SHA256 150.000 iterazioni + SHA256-CTR + HMAC-SHA256)
  const ENCRYPTED_COMPANY_VAULT = {
    "salt": "21c02fa0f27620066cb593ffb1a7b2d2",
    "iv": "1bbe6e4ab8aa067957b71a206bcbcaca",
    "mac": "244f4628b0be68cda86ec249551eb560f17f25e9c216a3ee0edf03e9c7e80853",
    "ct": "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"
  };

  // =========================================================================
  // PRIMITIVE CRITTOGRAFICHE (WebCrypto + Node.js + Pure-JS Fallback per LAN)
  // =========================================================================

  const SHA256_K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);

  function utf8ToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(String(str));
    }
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(String(str), 'utf8'));
    }
    const s = unescape(encodeURIComponent(String(str)));
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
    return arr;
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('utf8');
    }
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function hexToBytes(hex) {
    const clean = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function base64ToBytes(b64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function concatBytes(...arrays) {
    const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  }

  function sha256Bytes(input) {
    const msgBytes = typeof input === 'string' ? utf8ToBytes(input) : input;
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const len = msgBytes.length;
    const bitLenHi = Math.floor((len * 8) / 0x100000000);
    const bitLenLo = (len * 8) >>> 0;
    const padLen = ((len + 9 + 63) & ~63);
    const padded = new Uint8Array(padLen);
    padded.set(msgBytes);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padLen - 8, bitLenHi, false);
    dv.setUint32(padLen - 4, bitLenLo, false);
    const w = new Uint32Array(64);
    for (let i = 0; i < padLen; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
      for (let j = 16; j < 64; j++) {
        const v0 = w[j - 15], v1 = w[j - 2];
        const s0 = ((v0 >>> 7) | (v0 << 25)) ^ ((v0 >>> 18) | (v0 << 14)) ^ (v0 >>> 3);
        const s1 = ((v1 >>> 17) | (v1 << 15)) ^ ((v1 >>> 19) | (v1 << 13)) ^ (v1 >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let j = 0; j < 64; j++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v, idx) => odv.setUint32(idx * 4, v, false));
    return out;
  }

  function hmacSha256Bytes(keyInput, msgInput) {
    let key = typeof keyInput === 'string' ? utf8ToBytes(keyInput) : keyInput;
    const msg = typeof msgInput === 'string' ? utf8ToBytes(msgInput) : msgInput;
    if (key.length > 64) key = sha256Bytes(key);
    const kPad = new Uint8Array(64);
    kPad.set(key);
    const oKeyPad = new Uint8Array(64);
    const iKeyPad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      oKeyPad[i] = kPad[i] ^ 0x5c;
      iKeyPad[i] = kPad[i] ^ 0x36;
    }
    const inner = sha256Bytes(concatBytes(iKeyPad, msg));
    return sha256Bytes(concatBytes(oKeyPad, inner));
  }

  async function pbkdf2Sha256(passwordStr, saltBytes, iterations, keyLenBytes) {
    // 1. Web Crypto API nativa (veloce su HTTPS e localhost)
    if (global.crypto && global.crypto.subtle && typeof global.crypto.subtle.importKey === 'function') {
      try {
        const pwBytes = utf8ToBytes(passwordStr);
        const baseKey = await global.crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveBits']);
        const derivedBits = await global.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' },
          baseKey,
          keyLenBytes * 8
        );
        return new Uint8Array(derivedBits);
      } catch (e) {}
    }
    // 2. Node.js crypto nativo
    if (typeof require === 'function') {
      try {
        const nodeCrypto = require('crypto');
        const buf = nodeCrypto.pbkdf2Sync(passwordStr, Buffer.from(saltBytes), iterations, keyLenBytes, 'sha256');
        return new Uint8Array(buf);
      } catch (e) {}
    }
    // 3. Fallback Pure-JS (per contesti HTTP LAN non-secure)
    const pwBytes = utf8ToBytes(passwordStr);
    const blocksNeeded = Math.ceil(keyLenBytes / 32);
    const out = new Uint8Array(blocksNeeded * 32);
    for (let block = 1; block <= blocksNeeded; block++) {
      const blockCounter = new Uint8Array(4);
      new DataView(blockCounter.buffer).setUint32(0, block, false);
      let u = hmacSha256Bytes(pwBytes, concatBytes(saltBytes, blockCounter));
      const t = new Uint8Array(u);
      for (let i = 1; i < iterations; i++) {
        u = hmacSha256Bytes(pwBytes, u);
        for (let j = 0; j < 32; j++) t[j] ^= u[j];
      }
      out.set(t, (block - 1) * 32);
    }
    return out.slice(0, keyLenBytes);
  }

  function constantTimeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  function bytesToBase32(bytes) {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += B32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  function base32ToBytes(str) {
    const clean = String(str || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
    let bits = 0, value = 0;
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = B32_ALPHABET.indexOf(clean[i]);
      if (idx === -1) return null;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }

  function formatGroupedCode(prefix, b32) {
    const groups = String(b32).match(/.{1,4}/g) || [];
    return prefix + '-' + groups.join('-');
  }

  function normalizeDeviceId(deviceId) {
    return String(deviceId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function getRandomBytes(len) {
    const out = new Uint8Array(len);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      global.crypto.getRandomValues(out);
      return out;
    }
    if (typeof require === 'function') {
      try {
        const nodeCrypto = require('crypto');
        const buf = nodeCrypto.randomBytes(len);
        return new Uint8Array(buf);
      } catch (e) {}
    }
    for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /**
   * Cifratura autenticata (SHA256-CTR + Encrypt-then-HMAC-SHA256) per dati di sessione e storage locale
   */
  function encryptJsonWithKey(obj, key32Bytes) {
    if (!key32Bytes || key32Bytes.length !== 32) return null;
    const ptBytes = utf8ToBytes(JSON.stringify(obj));
    const iv = getRandomBytes(16);
    const kEnc = hmacSha256Bytes(key32Bytes, 'ENC-SUBKEY:v3');
    const kMac = hmacSha256Bytes(key32Bytes, 'MAC-SUBKEY:v3');

    const ctBytes = new Uint8Array(ptBytes.length);
    const totalBlocks = Math.ceil(ptBytes.length / 32);
    for (let counter = 0; counter < totalBlocks; counter++) {
      const ctrBuf = new Uint8Array(4);
      new DataView(ctrBuf.buffer).setUint32(0, counter, false);
      const blockKey = sha256Bytes(concatBytes(kEnc, iv, ctrBuf));
      const offset = counter * 32;
      const len = Math.min(32, ptBytes.length - offset);
      for (let j = 0; j < len; j++) {
        ctBytes[offset + j] = ptBytes[offset + j] ^ blockKey[j];
      }
    }

    const mac = bytesToHex(hmacSha256Bytes(kMac, concatBytes(iv, ctBytes)));
    return {
      iv: bytesToHex(iv),
      mac: mac,
      ct: bytesToBase64(ctBytes)
    };
  }

  function decryptJsonWithKey(envelope, key32Bytes) {
    if (!envelope || typeof envelope !== 'object' || !key32Bytes || key32Bytes.length !== 32) return null;
    try {
      const iv = hexToBytes(envelope.iv);
      const ctBytes = base64ToBytes(envelope.ct);
      if (iv.length !== 16 || !ctBytes.length) return null;

      const kEnc = hmacSha256Bytes(key32Bytes, 'ENC-SUBKEY:v3');
      const kMac = hmacSha256Bytes(key32Bytes, 'MAC-SUBKEY:v3');

      const computedMac = bytesToHex(hmacSha256Bytes(kMac, concatBytes(iv, ctBytes)));
      if (!constantTimeEqualHex(computedMac, String(envelope.mac || ''))) {
        return null;
      }

      const ptBytes = new Uint8Array(ctBytes.length);
      const totalBlocks = Math.ceil(ctBytes.length / 32);
      for (let counter = 0; counter < totalBlocks; counter++) {
        const ctrBuf = new Uint8Array(4);
        new DataView(ctrBuf.buffer).setUint32(0, counter, false);
        const blockKey = sha256Bytes(concatBytes(kEnc, iv, ctrBuf));
        const offset = counter * 32;
        const len = Math.min(32, ctBytes.length - offset);
        for (let j = 0; j < len; j++) {
          ptBytes[offset + j] = ctBytes[offset + j] ^ blockKey[j];
        }
      }
      return JSON.parse(bytesToUtf8(ptBytes));
    } catch (e) {
      return null;
    }
  }

  function deriveUserDataKey(kMacOrVBytes, deviceId) {
    if (!kMacOrVBytes || (kMacOrVBytes.length !== 32 && kMacOrVBytes.length !== 13)) return null;
    const normDev = normalizeDeviceId(deviceId);
    const domain = kMacOrVBytes.length === 32 ? 'USERDATA-STORE-KEY:v4:' : 'USERDATA-STORE-KEY:v3:';
    return hmacSha256Bytes(kMacOrVBytes, domain + normDev);
  }

  function computeRoleTag(kMacBytes, deviceId, role) {
    if (!kMacBytes || kMacBytes.length !== 32) return '';
    const normDev = normalizeDeviceId(deviceId);
    return bytesToHex(hmacSha256Bytes(kMacBytes, 'ROLE-BIND:v3:' + normDev + ':' + String(role || 'operator')).slice(0, 8));
  }

  // =========================================================================
  // MOTORE DI CRITTOGRAFIA DEL VAULT E CODICI DI CONVALIDA UNA TANTUM
  // =========================================================================

  /**
   * Decifra il Vault aziendale usando il segreto V (13 byte) e il PIN aziendale.
   * Se options.withKeys === true, restituisce { vault, kMac } per derivare chiavi storage PBKDF2-bound.
   */
  async function decryptCompanyVault(vBytes, pinStr, options) {
    if (!vBytes || vBytes.length !== 13 || !pinStr) return null;
    const vHex = bytesToHex(vBytes);
    const salt = hexToBytes(ENCRYPTED_COMPANY_VAULT.salt);
    const iv = hexToBytes(ENCRYPTED_COMPANY_VAULT.iv);
    const ctBytes = base64ToBytes(ENCRYPTED_COMPANY_VAULT.ct);

    const derived = await pbkdf2Sha256(vHex + ':' + String(pinStr).trim(), salt, PBKDF2_ITERATIONS, 64);
    const kEnc = derived.slice(0, 32);
    const kMac = derived.slice(32, 64);

    // Verifica autenticità Encrypt-then-MAC in tempo costante
    const computedMac = bytesToHex(hmacSha256Bytes(kMac, concatBytes(iv, ctBytes)));
    if (!constantTimeEqualHex(computedMac, ENCRYPTED_COMPANY_VAULT.mac)) {
      return null;
    }

    // Decifratura SHA256-CTR
    const ptBytes = new Uint8Array(ctBytes.length);
    const totalBlocks = Math.ceil(ctBytes.length / 32);
    for (let counter = 0; counter < totalBlocks; counter++) {
      const ctrBuf = new Uint8Array(4);
      new DataView(ctrBuf.buffer).setUint32(0, counter, false);
      const blockKey = sha256Bytes(concatBytes(kEnc, iv, ctrBuf));
      const offset = counter * 32;
      const len = Math.min(32, ctBytes.length - offset);
      for (let j = 0; j < len; j++) {
        ptBytes[offset + j] = ctBytes[offset + j] ^ blockKey[j];
      }
    }

    try {
      const parsedVault = JSON.parse(bytesToUtf8(ptBytes));
      if (options && options.withKeys) {
        return { vault: parsedVault, kMac: kMac };
      }
      return parsedVault;
    } catch (e) {
      return null;
    }
  }

  /**
   * Genera un Codice di Convalida Una Tantum specifico per un ID Dispositivo (solo Admin).
   * Schema Zero-Oracle v3: usa un salt casuale CSPRNG a 16 bit (salt2) senza tag veloce SHA-256,
   * rendendo matematicamente impossibile testare il PIN offline senza eseguire 150.000 iterazioni PBKDF2.
   */
  function generateDeviceActivationCode(vBytes, targetDeviceId, pinStr) {
    if (!vBytes || vBytes.length !== 13 || !pinStr) throw new Error('Chiave Admin o PIN non disponibile.');
    const normDev = normalizeDeviceId(targetDeviceId);
    if (normDev.length < 4) throw new Error('ID Dispositivo non valido.');

    const salt2 = getRandomBytes(2);
    const mask = sha256Bytes('DEV-MASK:v3:' + normDev + ':' + String(pinStr).trim() + ':' + bytesToHex(salt2)).slice(0, 13);
    const wrappedV = new Uint8Array(13);
    for (let i = 0; i < 13; i++) wrappedV[i] = vBytes[i] ^ mask[i];

    const payload = concatBytes(wrappedV, salt2);
    return formatGroupedCode('ATTIVA', bytesToBase32(payload));
  }

  /**
   * Estrae i byte candidati del segreto V da un codice ADMIN-... o ATTIVA-...
   * Non esegue alcun controllo di tag veloce pre-PBKDF2 per eliminare qualsiasi oracolo veloce o side-channel.
   */
  function parseActivationCode(codeStr, currentDeviceId, pinStr) {
    if (!codeStr || typeof codeStr !== 'string') return null;
    const trimmed = codeStr.trim().toUpperCase();
    let role = 'operator';
    let body = trimmed;

    if (trimmed.startsWith('ADMIN-')) {
      role = 'admin';
      body = trimmed.slice(6);
    } else if (trimmed.startsWith('ATTIVA-')) {
      role = 'operator';
      body = trimmed.slice(7);
    } else {
      return null;
    }

    const raw = base32ToBytes(body);
    if (!raw || raw.length < 15) return null;
    const payload13 = raw.slice(0, 13);
    const tail2 = raw.slice(13, 15);

    if (role === 'admin') {
      const vHex = bytesToHex(payload13);
      const expectedTag = sha256Bytes('ADMIN-CHECK:v2:' + vHex).slice(0, 2);
      const adminTagValid = (tail2[0] === expectedTag[0] && tail2[1] === expectedTag[1]);
      return { vBytes: payload13, role: 'admin', tagValid: adminTagValid };
    } else {
      const normDev = normalizeDeviceId(currentDeviceId);
      const mask = sha256Bytes('DEV-MASK:v3:' + normDev + ':' + String(pinStr).trim() + ':' + bytesToHex(tail2)).slice(0, 13);
      const vBytes = new Uint8Array(13);
      for (let i = 0; i < 13; i++) vBytes[i] = payload13[i] ^ mask[i];
      return { vBytes, role: 'operator', tagValid: true };
    }
  }

  /**
   * Avvolge V con il PIN e l'ID dispositivo per il salvataggio sicuro nel localStorage
   */
  function wrapSecretForStorage(vBytes, deviceId, pinStr) {
    const normDev = normalizeDeviceId(deviceId);
    const mask = sha256Bytes('STORAGE-WRAP:v2:' + normDev + ':' + String(pinStr).trim()).slice(0, 13);
    const wrapped = new Uint8Array(13);
    for (let i = 0; i < 13; i++) wrapped[i] = vBytes[i] ^ mask[i];
    return bytesToHex(wrapped);
  }

  function unwrapSecretFromStorage(wrappedHex, deviceId, pinStr) {
    const wrapped = hexToBytes(wrappedHex);
    if (wrapped.length !== 13) return null;
    const normDev = normalizeDeviceId(deviceId);
    const mask = sha256Bytes('STORAGE-WRAP:v2:' + normDev + ':' + String(pinStr).trim()).slice(0, 13);
    const vBytes = new Uint8Array(13);
    for (let i = 0; i < 13; i++) vBytes[i] = wrapped[i] ^ mask[i];
    return vBytes;
  }

  // =========================================================================
  // AUTH MANAGER & INTERFACCIA DI SBLOCCO
  // =========================================================================

  // Variabili private nella closure (non esposte su window.AuthManager)
  let _privateVaultSecret = null;
  let _privateSessionPin = null;
  let _privateUserDataKey = null;
  let _memoryAttemptState = { count: 0, lockedUntil: 0 };

  const AuthManager = {
    currentPin: '',
    _pendingApproveRequest: null,
    _eventsBound: false,
    _lockoutTimer: null,

    /**
     * Restituisce o genera l'ID univoco del dispositivo (es. CS-7F4A-92B1)
     */
    getDeviceId: function () {
      try {
        let existing = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
        if (existing && /^CS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(existing)) {
          return existing;
        }
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let part1 = '', part2 = '';
        const randBytes = new Uint8Array(8);
        if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
          global.crypto.getRandomValues(randBytes);
        } else {
          for (let i = 0; i < 8; i++) randBytes[i] = Math.floor(Math.random() * 256);
        }
        for (let i = 0; i < 4; i++) part1 += chars[randBytes[i] % chars.length];
        for (let i = 4; i < 8; i++) part2 += chars[randBytes[i] % chars.length];
        existing = 'CS-' + part1 + '-' + part2;
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, existing);
        return existing;
      } catch (e) {
        return 'CS-LOCAL-TEST';
      }
    },

    /**
     * Verifica se il dispositivo ha completato la Verifica Una Tantum
     */
    getDeviceAuthRecord: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.DEVICE_AUTH);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.wrappedSecret === 'string' && parsed.wrappedSecret.length === 26) {
            return parsed;
          }
        }
        const rawV2 = localStorage.getItem(STORAGE_KEYS.LEGACY_DEVICE_AUTH_V2);
        if (rawV2) {
          const parsedV2 = JSON.parse(rawV2);
          if (parsedV2 && typeof parsedV2.wrappedSecret === 'string' && parsedV2.wrappedSecret.length === 26) {
            parsedV2._legacyV2 = true;
            return parsedV2;
          }
        }
      } catch (e) {}
      return null;
    },

    isDeviceActivated: function () {
      return Boolean(this.getDeviceAuthRecord());
    },

    isAdminDevice: function () {
      const rec = this.getDeviceAuthRecord();
      return Boolean(rec && rec.role === 'admin');
    },

    /**
     * Controlla se c'è una sessione lavorativa valida (entro le 12 ore) e ne decifra il payload
     * usando la chiave effimera a 256 bit custodita in sessionStorage.
     */
    getValidSession: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!raw) return null;
        const sess = JSON.parse(raw);
        if (!sess || !sess.expiresAt || Date.now() > sess.expiresAt || !sess.envelope) {
          this.clearSessionStorage();
          return null;
        }
        const ephHex = (typeof sessionStorage !== 'undefined')
          ? sessionStorage.getItem(STORAGE_KEYS.SESSION_EPH_KEY)
          : null;
        if (!ephHex || ephHex.length !== 64) {
          this.clearSessionStorage();
          return null;
        }
        const ephKey = hexToBytes(ephHex);
        const decryptedPayload = decryptJsonWithKey(sess.envelope, ephKey);
        if (!decryptedPayload) {
          this.clearSessionStorage();
          return null;
        }
        return {
          unlockedAt: sess.unlockedAt,
          expiresAt: sess.expiresAt,
          role: decryptedPayload.role || sess.role || 'operator',
          vHex: decryptedPayload.vHex,
          uKeyHex: decryptedPayload.uKeyHex,
          sessionPin: decryptedPayload.sessionPin,
          vaultCache: decryptedPayload.vaultCache
        };
      } catch (e) {
        return null;
      }
    },

    clearSessionStorage: function () {
      try {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_V3);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_V2);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_UNLOCKED);
      } catch (e) {}
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(STORAGE_KEYS.SESSION_EPH_KEY);
          sessionStorage.removeItem('cantieresmart_eph_key_v3');
        }
      } catch (e) {}
    },

    loadEncryptedUserData: function (keySourceBytes, devId, fallbackVBytes) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.USERDATA_ENC);
        if (!raw) return null;
        const env = JSON.parse(raw);
        const key32 = (keySourceBytes && keySourceBytes.length === 32)
          ? deriveUserDataKey(keySourceBytes, devId)
          : null;
        if (key32) {
          const dec = decryptJsonWithKey(env, key32);
          if (dec) return dec;
        }
        if (fallbackVBytes && fallbackVBytes.length === 13) {
          const legacyKey = deriveUserDataKey(fallbackVBytes, devId);
          if (legacyKey) return decryptJsonWithKey(env, legacyKey);
        }
        return null;
      } catch (e) {
        return null;
      }
    },

    saveEncryptedUserData: function (keySourceBytes, devId, storeSnapshot) {
      try {
        const key32 = deriveUserDataKey(keySourceBytes, devId);
        if (!key32 || !storeSnapshot) return false;
        const env = encryptJsonWithKey(storeSnapshot, key32);
        if (env) {
          localStorage.setItem(STORAGE_KEYS.USERDATA_ENC, JSON.stringify(env));
          return true;
        }
      } catch (e) {}
      return false;
    },

    setProtectedDomVisibility: function (isUnlocked) {
      if (typeof document === 'undefined') return;
      const selectors = ['.app-header', '.app-main', '.app-bottom-bar', '#drawer-panel', '#drawer-backdrop'];
      selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
          if (isUnlocked) {
            el.removeAttribute('hidden');
            if (el.style.display === 'none') el.style.display = '';
          } else {
            el.setAttribute('hidden', 'hidden');
          }
        }
      });
    },

    isUnlocked: function () {
      return Boolean(this.getValidSession() && this.isDeviceActivated());
    },

    /**
     * Gestione tentativi falliti e lockout sincronizzato su più livelli di storage
     */
    getAttemptState: function () {
      let lsCount = 0, lsLocked = 0;
      let ssCount = 0, ssLocked = 0;
      try {
        const rawLs = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
        if (rawLs) {
          const p = JSON.parse(rawLs);
          lsCount = Number(p.count) || 0;
          lsLocked = Number(p.lockedUntil) || 0;
        }
      } catch (e) {}
      try {
        if (typeof sessionStorage !== 'undefined') {
          const rawSs = sessionStorage.getItem(STORAGE_KEYS.ATTEMPTS);
          if (rawSs) {
            const p = JSON.parse(rawSs);
            ssCount = Number(p.count) || 0;
            ssLocked = Number(p.lockedUntil) || 0;
          }
        }
      } catch (e) {}
      return {
        count: Math.max(lsCount, ssCount, _memoryAttemptState.count || 0),
        lockedUntil: Math.max(lsLocked, ssLocked, _memoryAttemptState.lockedUntil || 0)
      };
    },

    recordFailedAttempt: function () {
      const state = this.getAttemptState();
      state.count += 1;

      if (state.count >= MAX_TOTAL_ATTEMPTS) {
        // Revoca automatica dell'attivazione del dispositivo dopo 15 tentativi errati
        const lockUntilRevoke = Date.now() + 15 * 60 * 1000;
        this.clearDeviceAuthorization();
        _memoryAttemptState = { count: 0, lockedUntil: lockUntilRevoke };
        try {
          localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(_memoryAttemptState));
        } catch (e) {}
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(_memoryAttemptState));
          }
        } catch (e) {}
        return { revoked: true, count: state.count, lockedUntil: lockUntilRevoke };
      }

      let lockMs = 0;
      if (state.count >= 12) lockMs = 15 * 60 * 1000;      // 15 minuti
      else if (state.count >= 8) lockMs = 5 * 60 * 1000;   // 5 minuti
      else if (state.count >= 5) lockMs = 60 * 1000;       // 60 secondi

      if (lockMs > 0) {
        state.lockedUntil = Date.now() + lockMs;
      }

      _memoryAttemptState = { count: state.count, lockedUntil: state.lockedUntil };
      try {
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(state));
      } catch (e) {}
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(state));
        }
      } catch (e) {}
      return { revoked: false, count: state.count, lockedUntil: state.lockedUntil };
    },

    resetAttempts: function () {
      _memoryAttemptState = { count: 0, lockedUntil: 0 };
      try {
        localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
      } catch (e) {}
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
        }
      } catch (e) {}
    },

    clearDeviceAuthorization: function () {
      _privateVaultSecret = null;
      _privateSessionPin = null;
      _privateUserDataKey = null;
      this.clearSessionStorage();
      if (global.CantiereStore && typeof global.CantiereStore.lockVaultData === 'function') {
        global.CantiereStore.lockVaultData();
      }
      try {
        localStorage.removeItem(STORAGE_KEYS.DEVICE_AUTH);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_DEVICE_AUTH_V2);
        localStorage.removeItem(STORAGE_KEYS.USERDATA_ENC);
      } catch (e) {}
    },

    lock: function () {
      _privateVaultSecret = null;
      _privateSessionPin = null;
      _privateUserDataKey = null;
      this.clearSessionStorage();
      if (global.CantiereStore && typeof global.CantiereStore.lockVaultData === 'function') {
        global.CantiereStore.lockVaultData();
      }
      this.setProtectedDomVisibility(false);
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    },

    /**
     * Inizializzazione principale all'avvio della pagina
     */
    init: async function () {
      if (typeof document === 'undefined') return;

      // Rimuovi eventuali chiavi legacy insicure v1/v2 dal localStorage
      try {
        localStorage.removeItem(STORAGE_KEYS.LEGACY_UNLOCKED);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_V2);
      } catch (e) {}

      // Controlla parametri da URL Fragment (#attiva=... / #approva=...) o query string e pulisci subito
      this.consumeUrlParameters();

      const lockScreen = document.getElementById('pin-lock-screen');
      if (!lockScreen) return;

      this.bindEvents();

      // Se il dispositivo è già Admin attivo, ignora codici operatore esterni (#attiva=ATTIVA-...) per evitare downgrade
      if (this._pendingActivationCode && this.isAdminDevice() && !this._pendingActivationCode.startsWith('ADMIN-')) {
        this._pendingActivationCode = null;
      }

      // Se c'è una sessione valida cifrata attiva e il dispositivo è convalidato
      const validSession = this.getValidSession();
      if (validSession && this.isDeviceActivated() && !this._pendingActivationCode) {
        const devId = this.getDeviceId();
        if (validSession.role === 'admin' && validSession.vHex) {
          _privateVaultSecret = hexToBytes(validSession.vHex);
        }
        if (validSession.role === 'admin' && validSession.sessionPin) {
          _privateSessionPin = validSession.sessionPin;
        }
        if (validSession.uKeyHex && validSession.uKeyHex.length === 64) {
          _privateUserDataKey = hexToBytes(validSession.uKeyHex);
        } else if (validSession.vHex) {
          _privateUserDataKey = hexToBytes(validSession.vHex);
        }
        if (validSession.vaultCache && global.CantiereStore && typeof global.CantiereStore.unlockVaultData === 'function') {
          const keySrc = _privateUserDataKey;
          const decryptedUserStore = keySrc ? this.loadEncryptedUserData(keySrc, devId, _privateVaultSecret) : null;
          global.CantiereStore.unlockVaultData(
            validSession.vaultCache,
            decryptedUserStore,
            keySrc ? (snap) => this.saveEncryptedUserData(keySrc, devId, snap) : null
          );
        }
        this.setProtectedDomVisibility(true);
        document.body.classList.remove('app-locked');
        lockScreen.style.display = 'none';
        this.syncAppAndAdminUI();
        this.checkPendingApproveModal();
        return;
      }

      // Altrimenti azzera la RAM dello Store, nascondi il DOM protetto e mostra la schermata di blocco
      if (global.CantiereStore && typeof global.CantiereStore.lockVaultData === 'function') {
        global.CantiereStore.lockVaultData();
      }
      this.setProtectedDomVisibility(false);
      document.body.classList.add('app-locked');
      lockScreen.style.display = 'flex';
      this.currentPin = '';
      this.updatePinDots();
      this.renderLockScreenMode();
      this.checkLockoutTimer();
    },

    /**
     * Legge e rimuove immediatamente dalla URL eventuali link di attivazione o approvazione WhatsApp.
     * Privilegia l'URL Fragment (#attiva=... / #approva=...) che non viene mai trasmesso sulla rete HTTP.
     */
    consumeUrlParameters: function () {
      if (typeof window === 'undefined' || !window.location) return;
      try {
        const rawHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : '';
        const rawSearch = window.location.search ? window.location.search.replace(/^\?/, '') : '';
        if (!rawHash && !rawSearch) return;

        const hashParams = new URLSearchParams(rawHash);
        const searchParams = new URLSearchParams(rawSearch);

        const attivaCode = hashParams.get('attiva') || hashParams.get('codice') ||
          searchParams.get('attiva') || searchParams.get('codice');
        const approvaDev = hashParams.get('approva') || hashParams.get('richiesta') ||
          searchParams.get('approva') || searchParams.get('richiesta');
        const utenteName = hashParams.get('utente') || hashParams.get('nome') ||
          searchParams.get('utente') || searchParams.get('nome') || '';

        if (attivaCode) {
          this._pendingActivationCode = attivaCode.trim().toUpperCase();
        }
        if (approvaDev) {
          this._pendingApproveRequest = {
            deviceId: approvaDev.trim().toUpperCase(),
            userName: utenteName.trim().slice(0, 80)
          };
        }

        if (attivaCode || approvaDev) {
          const cleanUrl = window.location.pathname;
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      } catch (e) {}
    },

    /**
     * Aggiorna la UI della schermata di blocco distinguendo tra:
     * - Dispositivo NON ancora convalidato (mostra box Verifica Una Tantum + Tastierino PIN)
     * - Dispositivo GIÀ convalidato (mostra solo Tastierino PIN quotidiano)
     */
    renderLockScreenMode: function () {
      const deviceBox = document.getElementById('device-verification-box');
      const deviceIdBadge = document.getElementById('display-device-id');
      const inputActivationCode = document.getElementById('input-activation-code');
      const pinInstructions = document.getElementById('pin-instructions-text');
      const statusBadge = document.getElementById('pin-security-badge');
      const toggleLinkWrapper = document.getElementById('pin-toggle-activation-wrapper');

      const devId = this.getDeviceId();
      if (deviceIdBadge) deviceIdBadge.textContent = devId;

      const isActivated = this.isDeviceActivated();

      if (this._pendingActivationCode && inputActivationCode) {
        inputActivationCode.value = this._pendingActivationCode;
      }

      if (!isActivated || this._pendingActivationCode) {
        if (deviceBox) deviceBox.style.display = 'block';
        if (toggleLinkWrapper) toggleLinkWrapper.style.display = 'none';
        if (statusBadge) {
          statusBadge.textContent = this._pendingActivationCode
            ? '✓ Codice Ricevuto — Inserisci il PIN per Attivare'
            : '🛡️ Verifica Dispositivo Una Tantum';
        }
        if (pinInstructions) {
          pinInstructions.textContent = this._pendingActivationCode
            ? 'Codice di convalida caricato! Ora digita il PIN aziendale a 6 cifre per sbloccare:'
            : 'Incolla il Codice di Convalida ricevuto da Andrea e digita il PIN aziendale a 6 cifre:';
        }
      } else {
        if (deviceBox) deviceBox.style.display = 'none';
        if (toggleLinkWrapper) toggleLinkWrapper.style.display = 'block';
        const rec = this.getDeviceAuthRecord();
        if (statusBadge) {
          statusBadge.textContent = rec && rec.role === 'admin'
            ? '🔒 Dispositivo Admin Convalidato'
            : '🔒 Dispositivo Autorizzato (' + devId + ')';
        }
        if (pinInstructions) {
          pinInstructions.textContent = 'Inserisci il PIN aziendale a 6 cifre per sbloccare la sessione:';
        }
      }
    },

    bindEvents: function () {
      if (this._eventsBound) return;
      this._eventsBound = true;

      const numKeys = document.querySelectorAll('.pin-key[data-num]');
      numKeys.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const num = btn.getAttribute('data-num');
          this.appendDigit(num);
        });
      });

      const btnDelete = document.getElementById('btn-pin-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.preventDefault();
          this.deleteDigit();
        });
      }

      // Supporto tastiera fisica (solo se l'utente non sta scrivendo negli input testuali di attivazione)
      window.addEventListener('keydown', (e) => {
        const lockScreen = document.getElementById('pin-lock-screen');
        if (!lockScreen || lockScreen.style.display === 'none') return;
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

        if (e.key >= '0' && e.key <= '9') {
          this.appendDigit(e.key);
        } else if (e.key === 'Backspace') {
          this.deleteDigit();
        }
      });

      // Pulsante Richiedi Convalida su WhatsApp
      const btnReqWhatsapp = document.getElementById('btn-request-whatsapp');
      if (btnReqWhatsapp) {
        btnReqWhatsapp.addEventListener('click', () => this.sendActivationRequestWhatsApp());
      }

      // Pulsante Copia Richiesta
      const btnCopyReq = document.getElementById('btn-copy-request');
      if (btnCopyReq) {
        btnCopyReq.addEventListener('click', () => this.copyActivationRequestText());
      }

      // Link per riaprire il modulo di attivazione se già attivato (es. cambio ruolo a Admin)
      const btnShowActivation = document.getElementById('btn-show-activation-box');
      if (btnShowActivation) {
        btnShowActivation.addEventListener('click', (e) => {
          e.preventDefault();
          const deviceBox = document.getElementById('device-verification-box');
          if (deviceBox) {
            deviceBox.style.display = deviceBox.style.display === 'none' ? 'block' : 'none';
          }
        });
      }

      // Eventi Pannello Admin nel Drawer
      const btnGenerateCode = document.getElementById('btn-admin-generate-code');
      if (btnGenerateCode) {
        btnGenerateCode.addEventListener('click', () => this.handleAdminGenerateCode(false));
      }
      const btnSendWhatsappCode = document.getElementById('btn-admin-whatsapp-code');
      if (btnSendWhatsappCode) {
        btnSendWhatsappCode.addEventListener('click', () => this.handleAdminGenerateCode(true));
      }
    },

    /**
     * Compone e apre WhatsApp con la richiesta di convalida Una Tantum per Andrea.
     * Usa URL Fragment (#approva=...) così i parametri non transitano mai nei log HTTP.
     */
    getActivationRequestMessage: function () {
      const devId = this.getDeviceId();
      const nameInput = document.getElementById('input-operator-name');
      const operatorName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Operatore di Cantiere';
      const baseUrl = (typeof window !== 'undefined' && window.location)
        ? (window.location.origin + window.location.pathname)
        : 'https://ndrdipietro.github.io/cantieresmart/';
      const approveUrl = baseUrl + '#approva=' + encodeURIComponent(devId) + '&utente=' + encodeURIComponent(operatorName);

      return (
        '🔒 *Richiesta Convalida CantiereSmart*\n' +
        '👤 Operatore: *' + operatorName + '*\n' +
        '📱 ID Dispositivo: *' + devId + '*\n\n' +
        '👉 Tocca qui per generare lo sblocco:\n' + approveUrl
      );
    },

    sendActivationRequestWhatsApp: function () {
      const msg = this.getActivationRequestMessage();
      const waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    },

    copyActivationRequestText: function () {
      const msg = this.getActivationRequestMessage();
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(msg).then(() => {
          this.showLockStatus('✓ Richiesta copiata! Incollala su WhatsApp o SMS ad Andrea.', 'success');
        }).catch(() => {});
      }
    },

    appendDigit: function (digit) {
      if (this.isCurrentlyLockedOut()) return;
      if (this.currentPin.length >= 6) return;
      this.currentPin += String(digit);
      this.updatePinDots();

      if (this.currentPin.length === 6) {
        this.verifyPin();
      }
    },

    deleteDigit: function () {
      if (this.currentPin.length > 0) {
        this.currentPin = this.currentPin.slice(0, -1);
        this.updatePinDots();
      }
      this.clearError();
    },

    updatePinDots: function () {
      const dots = document.querySelectorAll('.pin-dot');
      dots.forEach((dot, index) => {
        if (index < this.currentPin.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      });
    },

    showLockStatus: function (text, type) {
      const errorMsg = document.getElementById('pin-error-msg');
      if (!errorMsg) return;
      errorMsg.textContent = text;
      errorMsg.className = 'pin-status-msg ' + (type === 'success' ? 'text-success' : 'text-danger');
      errorMsg.style.display = 'block';
    },

    clearError: function () {
      const errorMsg = document.getElementById('pin-error-msg');
      if (errorMsg) {
        errorMsg.textContent = '';
        errorMsg.style.display = 'none';
      }
      const dotsContainer = document.getElementById('pin-dots-container');
      if (dotsContainer) {
        dotsContainer.classList.remove('shake');
      }
    },

    isCurrentlyLockedOut: function () {
      const state = this.getAttemptState();
      if (state.lockedUntil && Date.now() < state.lockedUntil) {
        this.checkLockoutTimer();
        return true;
      }
      return false;
    },

    checkLockoutTimer: function () {
      if (this._lockoutTimer) {
        clearInterval(this._lockoutTimer);
        this._lockoutTimer = null;
      }
      const updateLockoutUI = () => {
        const state = this.getAttemptState();
        const remainingSec = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        if (remainingSec > 0) {
          this.showLockStatus('⏳ Troppi tentativi errati. Attendi ' + remainingSec + 's.', 'danger');
          return true;
        }
        return false;
      };
      if (updateLockoutUI()) {
        this._lockoutTimer = setInterval(() => {
          if (!updateLockoutUI()) {
            clearInterval(this._lockoutTimer);
            this._lockoutTimer = null;
            this.clearError();
          }
        }, 1000);
      }
    },

    /**
     * Verifica PIN + Convalida Dispositivo e decifra il Vault aziendale in tempo costante
     */
    verifyPin: async function () {
      if (this.isCurrentlyLockedOut()) {
        this.currentPin = '';
        this.updatePinDots();
        return false;
      }

      const dotsContainer = document.getElementById('pin-dots-container');
      const lockScreen = document.getElementById('pin-lock-screen');
      const inputActivationCode = document.getElementById('input-activation-code');
      const enteredPin = this.currentPin;
      const devId = this.getDeviceId();

      this.showLockStatus('🔐 Verifica crittografica PBKDF2 in corso...', 'success');

      let vBytes = null;
      let tagValid = true;
      let role = 'operator';
      const typedCode = (inputActivationCode && inputActivationCode.value.trim())
        ? inputActivationCode.value.trim()
        : (this._pendingActivationCode || '');

      if (typedCode) {
        const parsed = parseActivationCode(typedCode, devId, enteredPin);
        if (parsed) {
          vBytes = parsed.vBytes;
          role = parsed.role;
          tagValid = parsed.tagValid !== false;
        } else {
          tagValid = false;
        }
      } else {
        const rec = this.getDeviceAuthRecord();
        if (rec) {
          const unwrapPin = rec._legacyV2 ? enteredPin.slice(0, 4) : enteredPin;
          vBytes = unwrapSecretFromStorage(rec.wrappedSecret, devId, unwrapPin);
          role = rec.role || 'operator';
        } else {
          this.showLockStatus('⚠️ Dispositivo non convalidato. Inserisci prima il Codice di Convalida di Andrea.', 'danger');
          this.currentPin = '';
          this.updatePinDots();
          return false;
        }
      }

      // Esegue SEMPRE le 150.000 iterazioni PBKDF2 anche se il formato codice è errato (zero timing side-channel)
      const candidateV = (vBytes && vBytes.length === 13) ? vBytes : new Uint8Array(13);
      const vaultResult = await decryptCompanyVault(candidateV, enteredPin, { withKeys: true });
      const decryptedVault = (tagValid && vBytes && vaultResult) ? vaultResult.vault : null;
      const kMacBytes = (tagValid && vBytes && vaultResult) ? vaultResult.kMac : null;

      if (decryptedVault && kMacBytes) {
        // Verifica anti-manomissione del ruolo salvato in localStorage
        const existingRec = this.getDeviceAuthRecord();
        if (!typedCode && existingRec && !existingRec._legacyV2 && existingRec.roleTag) {
          const expectedRoleTag = computeRoleTag(kMacBytes, devId, role);
          if (!constantTimeEqualHex(existingRec.roleTag, expectedRoleTag)) {
            role = 'operator';
          }
        }

        // SUCCESSO: PIN e Convalida Dispositivo autentici!
        this.resetAttempts();
        _privateVaultSecret = role === 'admin' ? vBytes : null;
        _privateSessionPin = role === 'admin' ? enteredPin : null;
        _privateUserDataKey = kMacBytes;
        this._pendingActivationCode = null;

        // Salva il record di attivazione dispositivo Una Tantum (con segreto avvolto dal PIN e roleTag PBKDF2-bound)
        const wrappedHex = wrapSecretForStorage(vBytes, devId, enteredPin);
        const roleTagHex = computeRoleTag(kMacBytes, devId, role);
        const operatorNameInput = document.getElementById('input-operator-name');
        const operatorName = (operatorNameInput && operatorNameInput.value.trim())
          ? operatorNameInput.value.trim().slice(0, 80)
          : (existingRec && existingRec.operatorName ? existingRec.operatorName : '');

        try {
          localStorage.setItem(STORAGE_KEYS.DEVICE_AUTH, JSON.stringify({
            deviceId: devId,
            role: role,
            roleTag: roleTagHex,
            operatorName: operatorName,
            wrappedSecret: wrappedHex,
            activatedAt: (existingRec && existingRec.activatedAt) || new Date().toISOString()
          }));
          localStorage.removeItem(STORAGE_KEYS.LEGACY_DEVICE_AUTH_V2);
          localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_V3);

          // Cifra la sessione lavorativa con una chiave effimera a 256 bit custodita in sessionStorage
          const ephKey = getRandomBytes(32);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEYS.SESSION_EPH_KEY, bytesToHex(ephKey));
          }
          const sessionEnvelope = encryptJsonWithKey({
            role: role,
            vHex: role === 'admin' ? bytesToHex(vBytes) : undefined,
            uKeyHex: bytesToHex(kMacBytes),
            sessionPin: role === 'admin' ? enteredPin : undefined,
            vaultCache: decryptedVault
          }, ephKey);

          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
            unlockedAt: Date.now(),
            expiresAt: Date.now() + SESSION_TTL_MS,
            role: role,
            envelope: sessionEnvelope
          }));
        } catch (e) {}

        // Inietta in RAM i 36 cantieri, i 60 subappaltatori e lo storico utente decifrato (con chiave PBKDF2-bound)
        if (global.CantiereStore && typeof global.CantiereStore.unlockVaultData === 'function') {
          const decryptedUserStore = this.loadEncryptedUserData(kMacBytes, devId, vBytes);
          global.CantiereStore.unlockVaultData(
            decryptedVault,
            decryptedUserStore,
            (snap) => this.saveEncryptedUserData(kMacBytes, devId, snap)
          );
        }

        if (dotsContainer) dotsContainer.classList.add('success');
        this.showLockStatus('✓ Dispositivo verificato e archivio decifrato!', 'success');

        setTimeout(() => {
          this.setProtectedDomVisibility(true);
          document.body.classList.remove('app-locked');
          if (lockScreen) {
            lockScreen.classList.add('fade-out');
            setTimeout(() => {
              lockScreen.style.display = 'none';
              lockScreen.classList.remove('fade-out');
            }, 280);
          }
          this.syncAppAndAdminUI();
          this.checkPendingApproveModal();
        }, 300);

        return true;
      } else {
        // ERRORE: PIN o Codice di Convalida errato
        const failInfo = this.recordFailedAttempt();
        if (dotsContainer) dotsContainer.classList.add('shake');

        if (failInfo.revoked) {
          this.renderLockScreenMode();
          this.showLockStatus('🚨 Superati 15 tentativi errati: autorizzazione dispositivo revocata.', 'danger');
        } else if (failInfo.lockedUntil > Date.now()) {
          this.checkLockoutTimer();
        } else {
          const remainingBeforeLock = Math.max(1, 5 - (failInfo.count % 5));
          this.showLockStatus(
            typedCode
              ? 'Codice di Convalida o PIN non valido per questo dispositivo (' + devId + ').'
              : 'PIN errato. Tentativi rimasti prima del blocco: ' + remainingBeforeLock,
            'danger'
          );
        }

        setTimeout(() => {
          this.currentPin = '';
          this.updatePinDots();
          if (dotsContainer) dotsContainer.classList.remove('shake');
        }, 600);
        return false;
      }
    },

    /**
     * Aggiorna i componenti dell'app dopo la decifratura del Vault e mostra il pannello Admin se autorizzato
     */
    syncAppAndAdminUI: function () {
      if (global.CantiereApp && typeof global.CantiereApp.refreshFromStore === 'function') {
        global.CantiereApp.refreshFromStore();
      }
      if (global.cantiereDrawer && typeof global.cantiereDrawer.refreshAll === 'function') {
        global.cantiereDrawer.refreshAll();
      }

      const adminCard = document.getElementById('admin-approval-card');
      if (adminCard) {
        adminCard.style.display = this.isAdminDevice() ? 'block' : 'none';
      }

      const authInfoEl = document.getElementById('security-device-status');
      if (authInfoEl) {
        const devId = this.getDeviceId();
        const roleLabel = this.isAdminDevice() ? 'Amministratore (Andrea)' : 'Operatore Autorizzato';
        authInfoEl.textContent = 'Dispositivo: ' + devId + ' • Ruolo: ' + roleLabel;
      }
    },

    /**
     * Se Andrea ha aperto un link #approva=CS-XXXX-XXXX da WhatsApp, apre il pannello Admin precompilato
     * attendendo il click esplicito dell'amministratore prima di generare o copiare il codice.
     */
    checkPendingApproveModal: function () {
      if (!this._pendingApproveRequest || !this.isAdminDevice()) return;
      const req = this._pendingApproveRequest;
      this._pendingApproveRequest = null;

      if (global.cantiereDrawer && typeof global.cantiereDrawer.open === 'function') {
        global.cantiereDrawer.open();
        global.cantiereDrawer.switchTab('backup');
      }

      const targetInput = document.getElementById('admin-target-device-id');
      const userInput = document.getElementById('admin-target-user-name');
      if (targetInput) {
        targetInput.value = req.deviceId;
        targetInput.focus();
      }
      if (userInput) userInput.value = req.userName || '';

      if (global.showToast) {
        global.showToast('Richiesta di ' + (req.userName || req.deviceId) + ' caricata: premi "Genera Codice" o "Invia WhatsApp" per confermare.', 'info', 4500);
      }
    },

    /**
     * Genera il codice di sblocco per un collaboratore (solo su dispositivo Admin di Andrea).
     * Usa URL Fragment (#attiva=...) così il codice non viene mai inviato nei log HTTP dei server.
     */
    handleAdminGenerateCode: function (sendViaWhatsApp) {
      if (!this.isAdminDevice() || !_privateVaultSecret || !_privateSessionPin) {
        if (global.showToast) global.showToast('Sblocca nuovamente l\'app con il PIN per generare codici.', 'danger');
        return null;
      }

      const targetInput = document.getElementById('admin-target-device-id');
      const userInput = document.getElementById('admin-target-user-name');
      const outputBox = document.getElementById('admin-generated-code-box');
      const outputCodeEl = document.getElementById('admin-generated-code-text');

      const targetDevId = targetInput ? targetInput.value.trim().toUpperCase() : '';
      const userName = userInput ? userInput.value.trim() : 'Operatore';

      if (!targetDevId || normalizeDeviceId(targetDevId).length < 6) {
        if (global.showToast) global.showToast('Inserisci un ID Dispositivo valido (es. CS-7B4E-91A2).', 'danger');
        return null;
      }

      const code = this.generateCodeForDevice(targetDevId, _privateSessionPin);
      if (!code) return null;

      if (outputBox) outputBox.style.display = 'block';
      if (outputCodeEl) outputCodeEl.textContent = code;

      const baseUrl = (typeof window !== 'undefined' && window.location)
        ? (window.location.origin + window.location.pathname)
        : 'https://ndrdipietro.github.io/cantieresmart/';
      const directActivateUrl = baseUrl + '#attiva=' + encodeURIComponent(code);

      if (sendViaWhatsApp && typeof window !== 'undefined') {
        const waMsg = (
          '✅ *Convalida CantiereSmart Approvata*\n' +
          '👤 Operatore: *' + (userName || 'Autorizzato') + '*\n' +
          '📱 ID Dispositivo: *' + targetDevId + '*\n\n' +
          '🔑 Codice Una Tantum:\n*' + code + '*\n\n' +
          '👉 *Tocca questo link per attivare subito l\'app:*\n' + directActivateUrl
        );
        window.open('https://wa.me/?text=' + encodeURIComponent(waMsg), '_blank', 'noopener,noreferrer');
      } else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(code).catch(() => {});
        if (global.showToast) global.showToast('✓ Codice generato e copiato negli appunti!', 'success');
      }

      return { code, directActivateUrl };
    },

    /**
     * API pubblica/test per generare un codice dispositivo avendo il segreto Admin sbloccato
     */
    generateCodeForDevice: function (targetDeviceId, pinStr) {
      if (!_privateVaultSecret) return null;
      return generateDeviceActivationCode(_privateVaultSecret, targetDeviceId, pinStr);
    },

    /**
     * Metodo di utilità per test automatizzati e verifica programmatica
     */
    verifyActivationAndPin: async function (activationCode, deviceId, pinStr) {
      const parsed = parseActivationCode(activationCode, deviceId, pinStr);
      const candidateV = (parsed && parsed.vBytes && parsed.vBytes.length === 13) ? parsed.vBytes : new Uint8Array(13);
      const rawVault = await decryptCompanyVault(candidateV, pinStr);
      if (!parsed || parsed.tagValid === false) return { success: false, reason: 'INVALID_CODE' };
      if (!rawVault) return { success: false, reason: 'INVALID_PIN_OR_VAULT' };
      if (parsed.role === 'admin') {
        _privateVaultSecret = parsed.vBytes;
        _privateSessionPin = pinStr;
      }
      return {
        success: true,
        role: parsed.role,
        cantieriCount: rawVault.cantieri ? rawVault.cantieri.length : 0,
        subappaltiCount: rawVault.subappalti ? rawVault.subappalti.length : 0,
        vault: rawVault
      };
    }
  };

  // Esporta globalmente
  global.AuthManager = AuthManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
  }

})(typeof window !== 'undefined' ? window : globalThis);
