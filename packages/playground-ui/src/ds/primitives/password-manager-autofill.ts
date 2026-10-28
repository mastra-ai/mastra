// Password managers decide which fields to decorate from heuristics, not from intent: a
// field labelled "Name" reads as the user's name, so a dataset or agent name field gets an
// identity popup that covers the rest of the form. Most of them also ignore
// `autocomplete="off"`, so every DS text field opts out by default with each manager's own
// ignore attribute, and a credential form opts back in by passing a real autofill token
// (`email`, `username`, `current-password`, `new-password`, `one-time-code`, ...).
//
// Each manager reads its own attribute by presence, except LastPass which wants "true".
export const passwordManagerIgnoreAttributes = {
  // 1Password: https://www.1password.dev/web/compatible-website-design/
  'data-1p-ignore': 'true',
  // LastPass: https://support.lastpass.com (Prevent fields from being filled automatically)
  'data-lpignore': 'true',
  // Bitwarden: apps/browser/src/autofill/services/collect-autofill-content.service.ts in
  // bitwarden/clients. Since browser v2026.9.3 it is only honoured when the user enables
  // "Allow websites to exclude fields to autofill", which is off by default.
  'data-bwignore': 'true',
  // Dashlane: field-level `other` in the SAWF spec, https://dashlane.github.io/SAWF/
  'data-form-type': 'other',
  // Proton Pass: `attrIgnored` in utils/flags of @protontech/autofill, the detector the
  // extension ships. Proton's own apps set it on fields they don't want filled.
  'data-protonpass-ignore': 'true',
} as const;

/**
 * Props that keep browser autofill and the common password managers off a field. Spread
 * them on a text field that never takes a credential (a search box, a rename input).
 */
export const passwordManagerOptOutProps = {
  autoComplete: 'off',
  ...passwordManagerIgnoreAttributes,
} as const;

export type TextFieldAutofillProps = typeof passwordManagerOptOutProps | { autoComplete: string };

/**
 * Autofill props for a DS text field. With no `autoComplete` (or `"off"`), the field opts
 * out of browser autofill and of the common password managers. Any other value is an
 * explicit autofill token and is passed through untouched, with no ignore hints.
 * Spread it after the caller's props so the opt-out reaches the DOM.
 */
export function textFieldAutofillProps(autoComplete: string | undefined): TextFieldAutofillProps {
  if (autoComplete === undefined) return passwordManagerOptOutProps;
  const token = autoComplete.trim().toLowerCase();
  if (token === '' || token === 'off') return passwordManagerOptOutProps;
  return { autoComplete };
}
