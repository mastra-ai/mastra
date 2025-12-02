import { hex } from './hex.mjs';
import { base64Url, base64 } from './base64.mjs';
import { getWebcryptoSubtle } from './index.mjs';

const createHMAC = (algorithm = "SHA-256", encoding = "none") => {
  const hmac = {
    importKey: async (key, keyUsage) => {
      return getWebcryptoSubtle().importKey(
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
      const signature = await getWebcryptoSubtle().sign(
        "HMAC",
        hmacKey,
        typeof data === "string" ? new TextEncoder().encode(data) : data
      );
      if (encoding === "hex") {
        return hex.encode(signature);
      }
      if (encoding === "base64" || encoding === "base64url" || encoding === "base64urlnopad") {
        return base64Url.encode(signature, {
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
        signature = hex.decode(signature);
      }
      if (encoding === "base64" || encoding === "base64url" || encoding === "base64urlnopad") {
        signature = await base64.decode(signature);
      }
      return getWebcryptoSubtle().verify(
        "HMAC",
        hmacKey,
        typeof signature === "string" ? new TextEncoder().encode(signature) : signature,
        typeof data === "string" ? new TextEncoder().encode(data) : data
      );
    }
  };
  return hmac;
};

export { createHMAC };
