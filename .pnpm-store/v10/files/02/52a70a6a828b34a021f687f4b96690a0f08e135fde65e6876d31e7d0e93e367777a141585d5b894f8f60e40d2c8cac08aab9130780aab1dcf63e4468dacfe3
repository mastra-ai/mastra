function getWebcryptoSubtle() {
  const cr = typeof globalThis !== "undefined" && globalThis.crypto;
  if (cr && typeof cr.subtle === "object" && cr.subtle != null)
    return cr.subtle;
  throw new Error("crypto.subtle must be defined");
}

export { getWebcryptoSubtle };
