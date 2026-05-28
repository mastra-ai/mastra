import { isProviderRegistered } from '../../llm/model/provider-registry.js';
import { ModelNotAllowedError } from './errors.js';
import { isModelAllowedByPolicy } from './model-policy.js';
import type { ModelMatchCandidate } from './model-policy.js';
import { toModelCandidates } from './normalize-candidate.js';
import type { ModelCandidate, ModelCandidateInput } from './normalize-candidate.js';
import type { ProviderModelEntry } from './types.js';

export { matchesProvider, type ModelMatchCandidate } from './model-policy.js';

/**
 * Returns `true` if the candidate is allowed under the given allowlist.
 *
 * Rules:
 * - `undefined` allowlist ⇒ unrestricted (always `true`).
 * - `[]` empty allowlist ⇒ unrestricted (always `true`).
 * - Non-empty allowlist where **every** entry's provider is unknown to the
 *   runtime registry AND not tagged `kind: 'custom'` ⇒ deny everything. This
 *   prevents typos (e.g. `openaii`) from acting as an unintended deny-all that
 *   silently allows anything else; it is the documented "deny vs ignore" rule.
 */
export function isModelAllowed(allowed: ProviderModelEntry[] | undefined, candidate: ModelMatchCandidate): boolean {
  return isModelAllowedByPolicy(allowed, candidate, { isProviderRegistered });
}

/**
 * Result of an allowlist enforcement check.
 *
 * `attempted` is the candidate (or list of candidates) that triggered the
 * decision; `offendingLabel` (when set) names the specific failing entry so
 * callers can surface it in error messages — particularly useful for
 * conditional model variants.
 */
export type EnforceModelAllowlistResult =
  | { ok: true }
  | {
      ok: false;
      attempted: ModelCandidate;
      offendingLabel: string;
    };

/**
 * Apply an allowlist to any supported model expression. Normalizes via
 * `toModelCandidates`, then runs `isModelAllowed` per candidate. Returns the
 * **first** failing candidate so error messages can pinpoint which variant of
 * a conditional / fallback list violated the policy.
 *
 * If `toModelCandidates` returns no candidates (dynamic function, unparsable
 * shape) this passes — runtime defense (Phase 7) handles those cases.
 */
export function enforceModelAllowlist(
  allowed: ProviderModelEntry[] | undefined,
  input: ModelCandidateInput,
): EnforceModelAllowlistResult {
  const candidates = toModelCandidates(input);
  for (const candidate of candidates) {
    if (!isModelAllowed(allowed, candidate)) {
      return {
        ok: false,
        attempted: candidate,
        offendingLabel: candidate.label ?? candidate.origin,
      };
    }
  }
  return { ok: true };
}

/**
 * Convenience wrapper around `enforceModelAllowlist` that throws
 * `ModelNotAllowedError` on rejection. Use at write call sites so the server
 * adapter can translate into HTTP 422 + structured body.
 */
export function assertModelAllowed(allowed: ProviderModelEntry[] | undefined, input: ModelCandidateInput): void {
  const result = enforceModelAllowlist(allowed, input);
  if (result.ok) return;
  throw new ModelNotAllowedError({
    allowed,
    attempted: result.attempted,
    offendingLabel: result.offendingLabel,
  });
}
