/**
 * CantiereSmart - Modulo di Sicurezza, Verifica Dispositivo Una Tantum & Vault Crittografato
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 *
 * Architettura di Sicurezza Serverless (100% Offline-First):
 * 1. Verifica Dispositivo Una Tantum (Convalida Amministratore vincolata all'ID Dispositivo).
 * 2. Sblocco quotidiano con PIN Aziendale a 4 cifre protetto da PBKDF2-HMAC-SHA256 (150.000 iterazioni).
 * 3. Archivio Aziendale Cifrato (SHA256-CTR + Encrypt-then-HMAC-SHA256 a 256 bit):
 *    Cantieri, CUP/CIG e Subappaltatori sono indecifrabili senza Convalida Dispositivo + PIN.
 * 4. Protezione Anti-Brute-Force con blocco esponenziale e revoca automatica dopo 15 tentativi errati.
 * 5. Scadenza sessione lavorativa automatica (12 ore).
 */

(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    DEVICE_ID: 'cantieresmart_device_id_v2',
    DEVICE_AUTH: 'cantieresmart_device_auth_v2',
    SESSION: 'cantieresmart_session_v3',
    SESSION_EPH_KEY: 'cantieresmart_eph_key_v3',
    USERDATA_ENC: 'cantieresmart_userdata_enc_v3',
    ATTEMPTS: 'cantieresmart_auth_attempts_v2',
    LEGACY_SESSION_V2: 'cantieresmart_session_v2',
    LEGACY_UNLOCKED: 'cantieresmart_unlocked_v1'
  };

  const PBKDF2_ITERATIONS = 150000;
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ore (turno lavorativo)
  const MAX_TOTAL_ATTEMPTS = 15;
  const B32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // Archivio Aziendale Crittografato (PBKDF2-HMAC-SHA256 150.000 iterazioni + SHA256-CTR + HMAC-SHA256)
  const ENCRYPTED_COMPANY_VAULT = {
    "salt": "7c9e2a41b8d053f6e1a94c827d3b60e5",
    "iv": "3f8b12d49a6c05e7b24189c3d05a7e1f",
    "mac": "8f1fa3e60d9bed4775a025bd442c9391ac3d9d5d63b9ea3e96e07e1f7e88ad86",
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

  function deriveUserDataKey(vBytes, deviceId) {
    if (!vBytes || vBytes.length !== 13) return null;
    const normDev = normalizeDeviceId(deviceId);
    return hmacSha256Bytes(vBytes, 'USERDATA-STORE-KEY:v3:' + normDev);
  }

  // =========================================================================
  // MOTORE DI CRITTOGRAFIA DEL VAULT E CODICI DI CONVALIDA UNA TANTUM
  // =========================================================================

  /**
   * Decifra il Vault aziendale usando il segreto V (13 byte) e il PIN aziendale (4 cifre)
   */
  async function decryptCompanyVault(vBytes, pinStr) {
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
      return JSON.parse(bytesToUtf8(ptBytes));
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

  const AuthManager = {
    currentPin: '',
    _activeVaultSecret: null, // In memoria solo a sessione sbloccata
    _activeSessionPin: null,  // In memoria solo a sessione sbloccata
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
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.wrappedSecret === 'string' && parsed.wrappedSecret.length === 26) {
          return parsed;
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
        localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSION_V2);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_UNLOCKED);
      } catch (e) {}
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(STORAGE_KEYS.SESSION_EPH_KEY);
        }
      } catch (e) {}
    },

    loadEncryptedUserData: function (vBytes, devId) {
      try {
        const key32 = deriveUserDataKey(vBytes, devId);
        if (!key32) return null;
        const raw = localStorage.getItem(STORAGE_KEYS.USERDATA_ENC);
        if (!raw) return null;
        const env = JSON.parse(raw);
        return decryptJsonWithKey(env, key32);
      } catch (e) {
        return null;
      }
    },

    saveEncryptedUserData: function (vBytes, devId, storeSnapshot) {
      try {
        const key32 = deriveUserDataKey(vBytes, devId);
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
     * Gestione tentativi falliti e lockout anti-brute-force
     */
    getAttemptState: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
        if (!raw) return { count: 0, lockedUntil: 0 };
        const parsed = JSON.parse(raw);
        return {
          count: Number(parsed.count) || 0,
          lockedUntil: Number(parsed.lockedUntil) || 0
        };
      } catch (e) {
        return { count: 0, lockedUntil: 0 };
      }
    },

    recordFailedAttempt: function () {
      const state = this.getAttemptState();
      state.count += 1;

      if (state.count >= MAX_TOTAL_ATTEMPTS) {
        // Revoca automatica dell'attivazione del dispositivo dopo 15 tentativi errati
        this.clearDeviceAuthorization();
        try {
          localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify({ count: 0, lockedUntil: Date.now() + 15 * 60 * 1000 }));
        } catch (e) {}
        return { revoked: true, count: state.count, lockedUntil: Date.now() + 15 * 60 * 1000 };
      }

      let lockMs = 0;
      if (state.count >= 12) lockMs = 15 * 60 * 1000;      // 15 minuti
      else if (state.count >= 8) lockMs = 5 * 60 * 1000;   // 5 minuti
      else if (state.count >= 5) lockMs = 60 * 1000;       // 60 secondi

      if (lockMs > 0) {
        state.lockedUntil = Date.now() + lockMs;
      }

      try {
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(state));
      } catch (e) {}
      return { revoked: false, count: state.count, lockedUntil: state.lockedUntil };
    },

    resetAttempts: function () {
      try {
        localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
      } catch (e) {}
    },

    clearDeviceAuthorization: function () {
      this._activeVaultSecret = null;
      this._activeSessionPin = null;
      this.clearSessionStorage();
      if (global.CantiereStore && typeof global.CantiereStore.lockVaultData === 'function') {
        global.CantiereStore.lockVaultData();
      }
      try {
        localStorage.removeItem(STORAGE_KEYS.DEVICE_AUTH);
        localStorage.removeItem(STORAGE_KEYS.USERDATA_ENC);
      } catch (e) {}
    },

    lock: function () {
      this._activeVaultSecret = null;
      this._activeSessionPin = null;
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

      // Se c'è una sessione valida cifrata attiva e il dispositivo è convalidato
      const validSession = this.getValidSession();
      if (validSession && this.isDeviceActivated() && !this._pendingActivationCode) {
        const devId = this.getDeviceId();
        if (validSession.vHex) {
          this._activeVaultSecret = hexToBytes(validSession.vHex);
        }
        if (validSession.sessionPin) {
          this._activeSessionPin = validSession.sessionPin;
        }
        if (validSession.vaultCache && global.CantiereStore && typeof global.CantiereStore.unlockVaultData === 'function') {
          const vBytes = this._activeVaultSecret;
          const decryptedUserStore = vBytes ? this.loadEncryptedUserData(vBytes, devId) : null;
          global.CantiereStore.unlockVaultData(
            validSession.vaultCache,
            decryptedUserStore,
            vBytes ? (snap) => this.saveEncryptedUserData(vBytes, devId, snap) : null
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
            ? 'Codice di convalida caricato! Ora digita il PIN aziendale a 4 cifre per sbloccare:'
            : 'Incolla il Codice di Convalida ricevuto da Andrea e digita il PIN aziendale:';
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
          pinInstructions.textContent = 'Inserisci il PIN aziendale a 4 cifre per sbloccare la sessione:';
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
      if (this.currentPin.length >= 4) return;
      this.currentPin += String(digit);
      this.updatePinDots();

      if (this.currentPin.length === 4) {
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
          vBytes = unwrapSecretFromStorage(rec.wrappedSecret, devId, enteredPin);
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
      const rawVault = await decryptCompanyVault(candidateV, enteredPin);
      const decryptedVault = (tagValid && vBytes) ? rawVault : null;

      if (decryptedVault) {
        // SUCCESSO: PIN e Convalida Dispositivo autentici!
        this.resetAttempts();
        this._activeVaultSecret = vBytes;
        this._activeSessionPin = enteredPin;
        this._pendingActivationCode = null;

        // Salva il record di attivazione dispositivo Una Tantum (con segreto avvolto dal PIN)
        const wrappedHex = wrapSecretForStorage(vBytes, devId, enteredPin);
        const operatorNameInput = document.getElementById('input-operator-name');
        const existingRec = this.getDeviceAuthRecord();
        const operatorName = (operatorNameInput && operatorNameInput.value.trim())
          ? operatorNameInput.value.trim().slice(0, 80)
          : (existingRec && existingRec.operatorName ? existingRec.operatorName : '');

        try {
          localStorage.setItem(STORAGE_KEYS.DEVICE_AUTH, JSON.stringify({
            deviceId: devId,
            role: role,
            operatorName: operatorName,
            wrappedSecret: wrappedHex,
            activatedAt: (existingRec && existingRec.activatedAt) || new Date().toISOString()
          }));

          // Cifra la sessione lavorativa con una chiave effimera a 256 bit custodita in sessionStorage
          const ephKey = getRandomBytes(32);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEYS.SESSION_EPH_KEY, bytesToHex(ephKey));
          }
          const sessionEnvelope = encryptJsonWithKey({
            role: role,
            vHex: bytesToHex(vBytes),
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

        // Inietta in RAM i 36 cantieri, i 60 subappaltatori e lo storico utente decifrato
        if (global.CantiereStore && typeof global.CantiereStore.unlockVaultData === 'function') {
          const decryptedUserStore = this.loadEncryptedUserData(vBytes, devId);
          global.CantiereStore.unlockVaultData(
            decryptedVault,
            decryptedUserStore,
            (snap) => this.saveEncryptedUserData(vBytes, devId, snap)
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
     * Se Andrea ha aperto un link #approva=CS-XXXX-XXXX da WhatsApp, apre subito il pannello Admin precompilato
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
      if (targetInput) targetInput.value = req.deviceId;
      if (userInput) userInput.value = req.userName || '';

      this.handleAdminGenerateCode(false);
    },

    /**
     * Genera il codice di sblocco per un collaboratore (solo su dispositivo Admin di Andrea).
     * Usa URL Fragment (#attiva=...) così il codice non viene mai inviato nei log HTTP dei server.
     */
    handleAdminGenerateCode: function (sendViaWhatsApp) {
      if (!this.isAdminDevice() || !this._activeVaultSecret || !this._activeSessionPin) {
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

      const code = this.generateCodeForDevice(targetDevId, this._activeSessionPin);
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
      if (!this._activeVaultSecret) return null;
      return generateDeviceActivationCode(this._activeVaultSecret, targetDeviceId, pinStr);
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
      this._activeVaultSecret = parsed.vBytes;
      this._activeSessionPin = pinStr;
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
