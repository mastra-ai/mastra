import { z } from 'zod';
import type { ProviderCategories } from '../domain/case-contracts.js';
import { IntakeError } from '../domain/operation-errors.js';

const registrationSchema = z.object({
  id: z.string().min(1).describe('Stable identifier of this persisted entity.'),
  category: z
    .enum(['input', 'draftOutput', 'reportOutput', 'correctionOutput'])
    .describe('Provider category selecting input capture, draft output, approved report or correction output.'),
  capabilities: z
    .array(z.string().min(1))
    .min(1)
    .describe('Supported capabilities required when resolving this provider registration.'),
});

export type Registrations = { [C in keyof ProviderCategories]: readonly ProviderCategories[C][] };
export type Selections = Partial<{ [C in keyof ProviderCategories]: string }>;
/** Validate provider categories and defaults before exposing stage-specific provider selection. */
export function createRegistry(registrations: Registrations, defaults: Selections) {
  const maps = new Map<string, Map<string, ProviderCategories[keyof ProviderCategories]>>();
  for (const category of ['input', 'draftOutput', 'reportOutput', 'correctionOutput'] as const) {
    const items = new Map<string, ProviderCategories[keyof ProviderCategories]>();
    for (const provider of registrations[category]) {
      if (
        !registrationSchema.safeParse(provider).success ||
        provider.category !== category ||
        items.has(provider.id) ||
        (category === 'input'
          ? typeof (provider as ProviderCategories['input']).capture !== 'function' ||
            typeof (provider as ProviderCategories['input']).requestSchema?.parse !== 'function'
          : typeof (provider as ProviderCategories['draftOutput']).materialize !== 'function' ||
            typeof (provider as ProviderCategories['draftOutput']).retrieve !== 'function')
      )
        throw new IntakeError(
          'PROVIDER_CONFIGURATION',
          `Invalid or duplicate ${category} provider registration.`,
          'Use unique IDs, matching categories, capabilities and the required provider methods.',
        );
      items.set(provider.id, provider);
    }
    maps.set(category, items);
    if (defaults[category] && !items.has(defaults[category]!))
      throw new IntakeError(
        'PROVIDER_CONFIGURATION',
        `The default ${category} provider is not registered.`,
        'Correct the default selection in src/mastra/provider-config.ts.',
      );
  }
  return {
    resolve<C extends keyof ProviderCategories>(
      category: C,
      selection?: string,
      capability?: string,
    ): ProviderCategories[C] {
      const id = selection ?? defaults[category];
      const provider = id ? maps.get(category)?.get(id) : undefined;
      if (!provider || (capability && !provider.capabilities.includes(capability)))
        throw new IntakeError(
          'PROVIDER_CONFIGURATION',
          `No compatible ${category} provider is selected.`,
          'Register the selected provider and its required capability in src/mastra/provider-config.ts.',
        );
      return provider as ProviderCategories[C];
    },
  };
}
