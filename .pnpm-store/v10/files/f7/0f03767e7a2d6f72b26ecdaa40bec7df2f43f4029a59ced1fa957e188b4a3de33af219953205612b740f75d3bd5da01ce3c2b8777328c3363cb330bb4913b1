import {
  isValidBrowser
} from "./chunk-JKSAJ6AV.mjs";
import "./chunk-IEP6GGEX.mjs";

// src/webauthn.ts
function isWebAuthnSupported() {
  return isValidBrowser() && // Check if `PublicKeyCredential` is a constructor
  typeof window.PublicKeyCredential === "function";
}
async function isWebAuthnAutofillSupported() {
  try {
    return isWebAuthnSupported() && await window.PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}
async function isWebAuthnPlatformAuthenticatorSupported() {
  try {
    return typeof window !== "undefined" && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
export {
  isWebAuthnAutofillSupported,
  isWebAuthnPlatformAuthenticatorSupported,
  isWebAuthnSupported
};
//# sourceMappingURL=webauthn.mjs.map