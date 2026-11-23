import type { Agent } from '../agent';
import { isDurableAgentLike } from '../types';
import type { DurableAgentLike } from '../types';

/** Native engine selection or the released structural adapter contract (including Inngest). */
export function hasDurableExecution(obj: unknown): obj is Agent<any, any, any> | DurableAgentLike {
  if (isDurableAgentLike(obj)) return true;
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '__hasDurableExecution' in obj &&
    typeof obj.__hasDurableExecution === 'function' &&
    obj.__hasDurableExecution() === true
  );
}
