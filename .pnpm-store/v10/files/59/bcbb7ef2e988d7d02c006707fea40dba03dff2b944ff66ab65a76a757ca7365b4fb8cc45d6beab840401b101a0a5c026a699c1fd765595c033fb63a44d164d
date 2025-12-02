// This allows the types to be linked from the main module instead of duplicated
export type { IronSessionOptions, IronSessionData } from "iron-session";

import {
  createGetIronSession,
  createSealData,
  createUnsealData,
} from "../src/core";

const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto?.subtle === "object") return globalThis.crypto;
  // @ts-ignore crypto.webcrypto is not available in dom, but is there in newer node versions
  if (typeof globalThis.crypto?.webcrypto?.subtle === "object")
    // @ts-ignore same as above
    return globalThis.crypto.webcrypto;
  throw new Error(
    "no native implementation of WebCrypto is available in current context",
  );
};

const _crypto = getCrypto();

export const unsealData = createUnsealData(_crypto);
export const sealData = createSealData(_crypto);
export const getIronSession = createGetIronSession(
  _crypto,
  unsealData,
  sealData,
);
