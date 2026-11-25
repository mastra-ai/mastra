import type { ProviderMetadata } from '../../../../stream/types';

/**
 * The part of a step's provider metadata that says what the call cost. The rest, such as search
 * grounding, can be large, and the loop state that carries this is saved with the run.
 */
export function reportedCost(metadata: ProviderMetadata | undefined): ProviderMetadata | undefined {
  const cost = metadata?.gateway?.cost;
  const usage = metadata?.openrouter?.usage;
  if (cost === undefined && usage === undefined) return undefined;
  return {
    ...(cost === undefined ? {} : { gateway: { cost } }),
    ...(usage === undefined ? {} : { openrouter: { usage } }),
  };
}
