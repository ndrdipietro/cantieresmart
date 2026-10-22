/**
 * CantiereSmart - Word Generator Alias / Compatibility Layer
 * Vittorini Emidio Costruzioni S.r.l.
 * 
 * Re-exports docx-generator functions for backward compatibility.
 */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = require('./docx-generator.js');
}
