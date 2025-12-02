import { base64Url, base64 } from './base64.mjs';
import { getWebcryptoSubtle } from './index.mjs';

function createHash(algorithm, encoding) {
  return {
    digest: async (input) => {
      const encoder = new TextEncoder();
      const data = typeof input === "string" ? encoder.encode(input) : input;
      const hashBuffer = await getWebcryptoSubtle().digest(algorithm, data);
      if (encoding === "hex") {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        return hashHex;
      }
      if (encoding === "base64" || encoding === "base64url" || encoding === "base64urlnopad") {
        if (encoding.includes("url")) {
          return base64Url.encode(hashBuffer, {
            padding: encoding !== "base64urlnopad"
          });
        }
        const hashBase64 = base64.encode(hashBuffer);
        return hashBase64;
      }
      return hashBuffer;
    }
  };
}

export { createHash };
