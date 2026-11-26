import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { modelPickerProviders } from '@mastra/playground-ui/domains/llm';
import type { ModelPickerProvider } from '@mastra/playground-ui/domains/llm';

import type { AvailableModelOption } from '../../hooks/useAvailableModels';

/** The catalog grouped for the model picker, with Factory's provider names, providers A to Z. */
export function factoryModelPickerProviders(catalog: readonly AvailableModelOption[]): ModelPickerProvider[] {
  return modelPickerProviders(catalog, { providerName: providerDisplayName }).sort((a, b) => a.id.localeCompare(b.id));
}
