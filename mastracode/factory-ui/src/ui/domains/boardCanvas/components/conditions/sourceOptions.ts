import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import type { Limit } from '@mastra/playground-ui/domains/factory';
import { limitedProviders } from '@mastra/playground-ui/domains/factory';

/** A value `source.repository` can take, and the provider whose items carry it. */
export type SourceOption = FilterBarOption & { provider: string };

const hasProvider = (option: FilterBarOption): option is SourceOption =>
  'provider' in option && typeof option.provider === 'string';

/**
 * A field with its suggestions cut to the providers the conditions beside it allow, each value once:
 * the rule compares values regardless of provider or case, so Linear's ENG and Jira's ENG are one.
 */
export function narrowSuggestions(field: FilterBarField, limits: readonly Limit[]): FilterBarField {
  if (!Array.isArray(field.suggestions)) return field;
  const providers = limitedProviders(limits);
  const seen = new Set<string>();
  return {
    ...field,
    suggestions: field.suggestions.filter(option => {
      if (providers && hasProvider(option) && !providers.has(option.provider)) return false;
      const key = option.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}
