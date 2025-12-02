import {
  withLegacyReturn,
  withLegacySyncReturn
} from "../chunk-P263NW7Z.mjs";
import {
  base64url,
  decodeJwt,
  getCryptoAlgorithm,
  hasValidSignature,
  importKey,
  runtime,
  verifyJwt
} from "../chunk-2Z4IRG2E.mjs";
import {
  SignJWTError
} from "../chunk-5JS2VYLU.mjs";

// src/jwt/signJwt.ts
function encodeJwtData(value) {
  const stringified = JSON.stringify(value);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(stringified);
  return base64url.stringify(encoded, { pad: false });
}
async function signJwt(payload, key, options) {
  if (!options.algorithm) {
    throw new Error("No algorithm specified");
  }
  const encoder = new TextEncoder();
  const algorithm = getCryptoAlgorithm(options.algorithm);
  if (!algorithm) {
    return {
      errors: [new SignJWTError(`Unsupported algorithm ${options.algorithm}`)]
    };
  }
  const cryptoKey = await importKey(key, algorithm, "sign");
  const header = options.header || { typ: "JWT" };
  header.alg = options.algorithm;
  payload.iat = Math.floor(Date.now() / 1e3);
  const encodedHeader = encodeJwtData(header);
  const encodedPayload = encodeJwtData(payload);
  const firstPart = `${encodedHeader}.${encodedPayload}`;
  try {
    const signature = await runtime.crypto.subtle.sign(algorithm, cryptoKey, encoder.encode(firstPart));
    const encodedSignature = `${firstPart}.${base64url.stringify(new Uint8Array(signature), { pad: false })}`;
    return { data: encodedSignature };
  } catch (error) {
    return { errors: [new SignJWTError(error?.message)] };
  }
}

// src/jwt/index.ts
var verifyJwt2 = withLegacyReturn(verifyJwt);
var decodeJwt2 = withLegacySyncReturn(decodeJwt);
var signJwt2 = withLegacyReturn(signJwt);
var hasValidSignature2 = withLegacyReturn(hasValidSignature);
export {
  decodeJwt2 as decodeJwt,
  hasValidSignature2 as hasValidSignature,
  signJwt2 as signJwt,
  verifyJwt2 as verifyJwt
};
//# sourceMappingURL=index.mjs.map