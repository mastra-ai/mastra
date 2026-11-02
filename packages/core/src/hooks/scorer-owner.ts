import type { ScoringHookInput } from '../evals';
import type { MastraScorerEntry } from '../evals/base';
import type { Mastra } from '../mastra';
import { unwrapMastraTracingProxy } from '../observability/context';

const scorerHookOwnerTokens = new WeakMap<ScoringHookInput, object>();
const mastraScorerHookTokens = new WeakMap<Mastra, object>();

function getScorerHookToken(mastra: Mastra): object {
  // A tracing proxy is the same emitting Mastra as its target, so ownership is
  // keyed on the underlying instance. Without this, durable scorer dispatch —
  // which receives the step-context proxy — mints a token the real instance's
  // hook never matches, and every live score is silently dropped (#23465).
  const key = unwrapMastraTracingProxy(mastra);
  let token = mastraScorerHookTokens.get(key);
  if (!token) {
    token = {};
    mastraScorerHookTokens.set(key, token);
  }
  return token;
}

/**
 * Associate a scorer hook with its emitting Mastra through an opaque token.
 * This keeps the public payload serializable without making a retained hook
 * payload retain the Mastra instance itself.
 */
export function setScorerHookOwner(data: ScoringHookInput, owner?: Mastra): void {
  if (owner) {
    scorerHookOwnerTokens.set(data, getScorerHookToken(owner));
  } else {
    scorerHookOwnerTokens.delete(data);
  }
}

/**
 * Hooks dispatched through the public executeHook API have no owner and retain
 * their existing broadcast behavior.
 */
export function isScorerHookForMastra(data: ScoringHookInput, mastra: Mastra): boolean {
  const ownerToken = scorerHookOwnerTokens.get(data);
  return !ownerToken || ownerToken === getScorerHookToken(mastra);
}

const scorerHookEntries = new WeakMap<ScoringHookInput, MastraScorerEntry>();

/**
 * Attach the scorer entry a run was configured with to its hook payload.
 * A scorer supplied at call time or through `defaultOptions.scorers` is
 * registered nowhere, so the hook cannot find it again by id (#27579).
 */
export function setScorerHookEntry(data: ScoringHookInput, entry: MastraScorerEntry): void {
  scorerHookEntries.set(data, entry);
}

export function getScorerHookEntry(data: ScoringHookInput): MastraScorerEntry | undefined {
  return scorerHookEntries.get(data);
}
