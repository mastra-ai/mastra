import type { ScoringHookInput } from '../evals';
import type { Mastra } from '../mastra';

const scorerHookOwnerTokens = new WeakMap<ScoringHookInput, object>();
const mastraScorerHookTokens = new WeakMap<Mastra, object>();

function getScorerHookToken(mastra: Mastra): object {
  let token = mastraScorerHookTokens.get(mastra);
  if (!token) {
    token = {};
    mastraScorerHookTokens.set(mastra, token);
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
