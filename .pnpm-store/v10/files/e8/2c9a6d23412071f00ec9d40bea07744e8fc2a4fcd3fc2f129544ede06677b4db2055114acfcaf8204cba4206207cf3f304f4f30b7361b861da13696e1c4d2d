//#region src/crypto/buffer.d.ts
/**
 * Compare two buffers in constant time.
 */
declare function constantTimeEqual(a: ArrayBuffer | Uint8Array | string, b: ArrayBuffer | Uint8Array | string): boolean;
//#endregion
//#region src/crypto/jwt.d.ts
declare function signJWT(payload: any, secret: string, expiresIn?: number): Promise<string>;
declare function verifyJWT<T = any>(token: string, secret: string): Promise<T | null>;
declare function symmetricEncodeJWT<T extends Record<string, any>>(payload: T, secret: string, salt: string, expiresIn?: number): Promise<string>;
declare function symmetricDecodeJWT<T = any>(token: string, secret: string, salt: string): Promise<T | null>;
//#endregion
//#region src/crypto/password.d.ts
declare const hashPassword: (password: string) => Promise<string>;
declare const verifyPassword: ({
  hash,
  password
}: {
  hash: string;
  password: string;
}) => Promise<boolean>;
//#endregion
//#region src/crypto/random.d.ts
declare const generateRandomString: <SubA extends "a-z" | "A-Z" | "0-9" | "-_">(length: number, ...alphabets: SubA[]) => string;
//#endregion
//#region src/crypto/index.d.ts
type SymmetricEncryptOptions = {
  key: string;
  data: string;
};
declare const symmetricEncrypt: ({
  key,
  data
}: SymmetricEncryptOptions) => Promise<string>;
type SymmetricDecryptOptions = {
  key: string;
  data: string;
};
declare const symmetricDecrypt: ({
  key,
  data
}: SymmetricDecryptOptions) => Promise<string>;
//#endregion
export { SymmetricDecryptOptions, SymmetricEncryptOptions, constantTimeEqual, generateRandomString, hashPassword, signJWT, symmetricDecodeJWT, symmetricDecrypt, symmetricEncodeJWT, symmetricEncrypt, verifyJWT, verifyPassword };