import { E as EncodingFormat, S as SHAFamily, T as TypedArray } from './shared/utils.0ddb0a7a.js';

declare const createHMAC: <E extends EncodingFormat = "none">(algorithm?: SHAFamily, encoding?: E) => {
    importKey: (key: string | ArrayBuffer | TypedArray, keyUsage: "sign" | "verify") => Promise<CryptoKey>;
    sign: (hmacKey: string | CryptoKey, data: string | ArrayBuffer | TypedArray) => Promise<E extends "none" ? ArrayBuffer : string>;
    verify: (hmacKey: CryptoKey | string, data: string | ArrayBuffer | TypedArray, signature: string | ArrayBuffer | TypedArray) => Promise<boolean>;
};

export { createHMAC };
