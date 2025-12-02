'use strict';

function getAlphabet(urlSafe) {
  return urlSafe ? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
}
function base64Encode(data, alphabet, padding) {
  let result = "";
  let buffer = 0;
  let shift = 0;
  for (const byte of data) {
    buffer = buffer << 8 | byte;
    shift += 8;
    while (shift >= 6) {
      shift -= 6;
      result += alphabet[buffer >> shift & 63];
    }
  }
  if (shift > 0) {
    result += alphabet[buffer << 6 - shift & 63];
  }
  if (padding) {
    const padCount = (4 - result.length % 4) % 4;
    result += "=".repeat(padCount);
  }
  return result;
}
function base64Decode(data, alphabet) {
  const decodeMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < alphabet.length; i++) {
    decodeMap.set(alphabet[i], i);
  }
  const result = [];
  let buffer = 0;
  let bitsCollected = 0;
  for (const char of data) {
    if (char === "=")
      break;
    const value = decodeMap.get(char);
    if (value === void 0) {
      throw new Error(`Invalid Base64 character: ${char}`);
    }
    buffer = buffer << 6 | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      result.push(buffer >> bitsCollected & 255);
    }
  }
  return Uint8Array.from(result);
}
const base64 = {
  encode(data, options = {}) {
    const alphabet = getAlphabet(false);
    const buffer = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    return base64Encode(buffer, alphabet, options.padding ?? true);
  },
  decode(data) {
    if (typeof data !== "string") {
      data = new TextDecoder().decode(data);
    }
    const urlSafe = data.includes("-") || data.includes("_");
    const alphabet = getAlphabet(urlSafe);
    return base64Decode(data, alphabet);
  }
};
const base64Url = {
  encode(data, options = {}) {
    const alphabet = getAlphabet(true);
    const buffer = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    return base64Encode(buffer, alphabet, options.padding ?? true);
  },
  decode(data) {
    const urlSafe = data.includes("-") || data.includes("_");
    const alphabet = getAlphabet(urlSafe);
    return base64Decode(data, alphabet);
  }
};

exports.base64 = base64;
exports.base64Url = base64Url;
