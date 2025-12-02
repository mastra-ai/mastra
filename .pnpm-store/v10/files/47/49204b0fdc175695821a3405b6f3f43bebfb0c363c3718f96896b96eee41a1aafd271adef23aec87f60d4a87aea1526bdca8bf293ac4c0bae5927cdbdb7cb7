function getAlphabet(hex) {
  return hex ? "0123456789ABCDEFGHIJKLMNOPQRSTUV" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
}
function createDecodeMap(alphabet) {
  const decodeMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < alphabet.length; i++) {
    decodeMap.set(alphabet[i], i);
  }
  return decodeMap;
}
function base32Encode(data, alphabet, padding) {
  let result = "";
  let buffer = 0;
  let shift = 0;
  for (const byte of data) {
    buffer = buffer << 8 | byte;
    shift += 8;
    while (shift >= 5) {
      shift -= 5;
      result += alphabet[buffer >> shift & 31];
    }
  }
  if (shift > 0) {
    result += alphabet[buffer << 5 - shift & 31];
  }
  if (padding) {
    const padCount = (8 - result.length % 8) % 8;
    result += "=".repeat(padCount);
  }
  return result;
}
function base32Decode(data, alphabet) {
  const decodeMap = createDecodeMap(alphabet);
  const result = [];
  let buffer = 0;
  let bitsCollected = 0;
  for (const char of data) {
    if (char === "=")
      break;
    const value = decodeMap.get(char);
    if (value === void 0) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    buffer = buffer << 5 | value;
    bitsCollected += 5;
    while (bitsCollected >= 8) {
      bitsCollected -= 8;
      result.push(buffer >> bitsCollected & 255);
    }
  }
  return Uint8Array.from(result);
}
const base32 = {
  /**
   * Encodes data into a Base32 string.
   * @param data - The data to encode (ArrayBuffer, TypedArray, or string).
   * @param options - Encoding options.
   * @returns The Base32 encoded string.
   */
  encode(data, options = {}) {
    const alphabet = getAlphabet(false);
    const buffer = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    return base32Encode(buffer, alphabet, options.padding ?? true);
  },
  /**
   * Decodes a Base32 string into a Uint8Array.
   * @param data - The Base32 encoded string or ArrayBuffer/TypedArray.
   * @returns The decoded Uint8Array.
   */
  decode(data) {
    if (typeof data !== "string") {
      data = new TextDecoder().decode(data);
    }
    const alphabet = getAlphabet(false);
    return base32Decode(data, alphabet);
  }
};
const base32hex = {
  /**
   * Encodes data into a Base32hex string.
   * @param data - The data to encode (ArrayBuffer, TypedArray, or string).
   * @param options - Encoding options.
   * @returns The Base32hex encoded string.
   */
  encode(data, options = {}) {
    const alphabet = getAlphabet(true);
    const buffer = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    return base32Encode(buffer, alphabet, options.padding ?? true);
  },
  /**
   * Decodes a Base32hex string into a Uint8Array.
   * @param data - The Base32hex encoded string.
   * @returns The decoded Uint8Array.
   */
  decode(data) {
    const alphabet = getAlphabet(true);
    return base32Decode(data, alphabet);
  }
};

export { base32, base32hex };
