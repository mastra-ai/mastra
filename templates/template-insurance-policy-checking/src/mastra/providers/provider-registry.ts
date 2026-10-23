import type { ProviderCategories } from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import { z } from 'zod';

const registrationSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['input', 'draftOutput', 'reportOutput', 'correctionOutput']),
  capabilities: z.array(z.string().min(1)).min(1),
});

export type Registrations = { [C in keyof ProviderCategories]: readonly ProviderCategories[C][] };
export type Selections = Partial<{ [C in keyof ProviderCategories]: string }>;
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
          : typeof (provider as ProviderCategories['draftOutput']).materialize !== 'function')
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
        'Correct the default selection in src/mastra/providers.ts.',
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
          'Register the selected provider and its required capability in src/mastra/providers.ts.',
        );
      return provider as ProviderCategories[C];
    },
  };
}
