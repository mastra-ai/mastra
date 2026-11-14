import { isDurableAgentLike } from '../types';
import type { DurableAgentLike } from '../types';

/** Policy and strategy metadata do not activate native execution in this stage. */
export function hasDurableExecution(obj: unknown): obj is DurableAgentLike {
  // Preserve the released structural-adapter contract, including Inngest. Do not
  // interpret arbitrary adapter properties as a new core capability protocol.
  return isDurableAgentLike(obj);
}
