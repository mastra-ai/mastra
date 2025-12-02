'use strict';

const hex = require('./hex.cjs');
const base64 = require('./base64.cjs');
const index = require('./index.cjs');

const createHMAC = (algorithm = "SHA-256", encoding = "none") => {
  const hmac = {
    importKey: async (key, keyUsage) => {
      return index.getWebcryptoSubtle().importKey(
        "raw",
        typeof key === "string" ? new TextEncoder().encode(key) : key,
        { name: "HMAC", hash: { name: algorithm } },
        false,
        [keyUsage]
      );
    },
    sign: async (hmacKey, data) => {
      if (typeof hmacKey === "string") {
        hmacKey = await hmac.importKey(hmacKey, "sign");
      }
      const signature = await index.getWebcryptoSubtle().sign(
        "HMAC",
        hmacKey,
        typeof data === "string" ? new TextEncoder().encode(data) : data
      );
      if (encoding === "hex") {
        return hex.hex.encode(signature);
      }
      if (encoding === "base64" || encoding === "base64url" || encoding === "base64urlnopad") {
        return base64.base64Url.encode(signature, {
          padding: encoding !== "base64urlnopad"
        });
      }
      return signature;
    },
    verify: async (hmacKey, data, signature) => {
      if (typeof hmacKey === "string") {
        hmacKey = await hmac.importKey(hmacKey, "verify");
      }
      if (encoding === "hex") {
        signature = hex.hex.decode(signature);
      }
      if (encoding === "base64" || encoding === "base64url" || encoding === "base64urlnopad") {
        signature = await base64.base64.decode(signature);
      }
      return index.getWebcryptoSubtle().verify(
        "HMAC",
        hmacKey,
        typeof signature === "string" ? new TextEncoder().encode(signature) : signature,
        typeof data === "string" ? new TextEncoder().encode(data) : data
      );
    }
  };
  return hmac;
};

exports.createHMAC = createHMAC;
