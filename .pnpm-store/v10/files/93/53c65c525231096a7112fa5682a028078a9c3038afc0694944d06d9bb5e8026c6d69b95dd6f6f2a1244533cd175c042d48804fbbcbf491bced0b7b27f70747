type ExportFormat = "jwk" | "spki" | "pkcs8";
declare const rsa: {
    generateKeyPair: (modulusLength?: 2048 | 4096, hash?: "SHA-256" | "SHA-384" | "SHA-512") => Promise<CryptoKeyPair>;
    exportKey: <E extends ExportFormat>(key: CryptoKey, format: E) => Promise<E extends "jwk" ? JsonWebKey : ArrayBuffer>;
    importKey: (key: JsonWebKey, usage?: "encrypt" | "decrypt", hash?: "SHA-256" | "SHA-384" | "SHA-512") => Promise<CryptoKey>;
    encrypt: (key: CryptoKey, data: string | ArrayBuffer | ArrayBufferView) => Promise<ArrayBuffer>;
    decrypt: (key: CryptoKey, data: ArrayBuffer | ArrayBufferView) => Promise<ArrayBuffer>;
    sign: (key: CryptoKey, data: string | ArrayBuffer | ArrayBufferView, saltLength?: number) => Promise<ArrayBuffer>;
    verify: (key: CryptoKey, { signature, data, saltLength, }: {
        signature: ArrayBuffer | ArrayBufferView | string;
        data: string | ArrayBuffer | ArrayBufferView | string;
        saltLength?: number;
    }) => Promise<boolean>;
};

export { rsa };
