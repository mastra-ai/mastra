import { getWebcryptoSubtle } from './index.mjs';

const rsa = {
  generateKeyPair: async (modulusLength = 2048, hash = "SHA-256") => {
    return await getWebcryptoSubtle().generateKey(
      {
        name: "RSA-OAEP",
        modulusLength,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: { name: hash }
      },
      true,
      ["encrypt", "decrypt"]
    );
  },
  exportKey: async (key, format) => {
    return await getWebcryptoSubtle().exportKey(format, key);
  },
  importKey: async (key, usage = "encrypt", hash = "SHA-256") => {
    return await getWebcryptoSubtle().importKey(
      "jwk",
      key,
      {
        name: "RSA-OAEP",
        hash: { name: hash }
      },
      true,
      [usage]
    );
  },
  encrypt: async (key, data) => {
    const encodedData = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return await getWebcryptoSubtle().encrypt(
      { name: "RSA-OAEP" },
      key,
      encodedData
    );
  },
  decrypt: async (key, data) => {
    return await getWebcryptoSubtle().decrypt({ name: "RSA-OAEP" }, key, data);
  },
  sign: async (key, data, saltLength = 32) => {
    const encodedData = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return await getWebcryptoSubtle().sign(
      {
        name: "RSA-PSS",
        saltLength
      },
      key,
      encodedData
    );
  },
  verify: async (key, {
    signature,
    data,
    saltLength = 32
  }) => {
    if (typeof signature === "string") {
      signature = new TextEncoder().encode(signature);
    }
    const encodedData = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return await getWebcryptoSubtle().verify(
      {
        name: "RSA-PSS",
        saltLength
      },
      key,
      signature,
      encodedData
    );
  }
};

export { rsa };
