import type { RequestContext } from '../request-context';
import type { InstructionsOption } from './types';

/**
 * Resolve an instructions override against auto-generated instructions.
 *
 * - `undefined` → return auto-generated
 * - `string` → return the string as-is
 * - `function` → call with { auto, requestContext }
 */
export function resolveInstructions(
  override: InstructionsOption | undefined,
  getAuto: () => string,
  requestContext?: RequestContext,
): string {
  if (typeof override === 'string') return override;
  const auto = getAuto();
  if (override === undefined) return auto;
  return override({ auto, requestContext });
}
