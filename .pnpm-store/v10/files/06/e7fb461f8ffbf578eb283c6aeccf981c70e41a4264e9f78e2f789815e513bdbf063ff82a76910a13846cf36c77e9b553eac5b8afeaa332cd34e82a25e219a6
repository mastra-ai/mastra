import { getWebcryptoSubtle } from './index.mjs';

const ecdsa = {
  generateKeyPair: async (curve = "P-256") => {
    const subtle = getWebcryptoSubtle();
    const keyPair = await subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: curve
      },
      true,
      ["sign", "verify"]
    );
    const privateKey = await subtle.exportKey("pkcs8", keyPair.privateKey);
    const publicKey = await subtle.exportKey("spki", keyPair.publicKey);
    return { privateKey, publicKey };
  },
  importPrivateKey: async (privateKey, curve, extractable = false) => {
    if (typeof privateKey === "string") {
      privateKey = new TextEncoder().encode(privateKey);
    }
    return await getWebcryptoSubtle().importKey(
      "pkcs8",
      privateKey,
      {
        name: "ECDSA",
        namedCurve: curve
      },
      extractable,
      ["sign"]
    );
  },
  importPublicKey: async (publicKey, curve, extractable = false) => {
    if (typeof publicKey === "string") {
      publicKey = new TextEncoder().encode(publicKey);
    }
    return await getWebcryptoSubtle().importKey(
      "spki",
      publicKey,
      {
        name: "ECDSA",
        namedCurve: curve
      },
      extractable,
      ["verify"]
    );
  },
  sign: async (privateKey, data, hash = "SHA-256") => {
    if (typeof data === "string") {
      data = new TextEncoder().encode(data);
    }
    const signature = await getWebcryptoSubtle().sign(
      {
        name: "ECDSA",
        hash: { name: hash }
      },
      privateKey,
      data
    );
    return signature;
  },
  verify: async (publicKey, {
    signature,
    data,
    hash = "SHA-256"
  }) => {
    if (typeof signature === "string") {
      signature = new TextEncoder().encode(signature);
    }
    if (typeof data === "string") {
      data = new TextEncoder().encode(data);
    }
    return await getWebcryptoSubtle().verify(
      {
        name: "ECDSA",
        hash: { name: hash }
      },
      publicKey,
      signature,
      data
    );
  },
  exportKey: async (key, format) => {
    return await getWebcryptoSubtle().exportKey(format, key);
  }
};

export { ecdsa };
