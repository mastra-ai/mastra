import type { RequestContext } from '../request-context';
import type { InstructionsOption } from './types';

/**
 * Resolve an instructions override against default instructions.
 *
 * - `undefined` → return default
 * - `string` → return the string as-is
 * - `function` → call with { defaultInstructions, requestContext }
 */
export function resolveInstructions(
  override: InstructionsOption | undefined,
  getDefault: () => string,
  requestContext?: RequestContext,
): string {
  if (typeof override === 'string') return override;
  const defaultInstructions = getDefault();
  if (override === undefined) return defaultInstructions;
  return override({ defaultInstructions, requestContext });
}
