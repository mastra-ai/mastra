import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ModelPickerProvider, ModelPickerValue } from '@mastra/playground-ui/domains/llm';

import type { AvailableModelOption } from '../../hooks/useAvailableModels';

export function catalogModelPickerValue({
  id,
  provider,
}: Pick<AvailableModelOption, 'id' | 'provider'>): ModelPickerValue {
  const prefix = `${provider}/`;
  return { provider, model: id.startsWith(prefix) ? id.slice(prefix.length) : id };
}

export function modelPickerProviders(catalog: readonly AvailableModelOption[]): ModelPickerProvider[] {
  const providers = new Map<string, ModelPickerProvider>();
  for (const option of catalog) {
    const { provider, model } = catalogModelPickerValue(option);
    const choice = { id: model, releaseDate: option.releaseDate };
    const group = providers.get(provider);
    if (group) group.models.push(choice);
    else providers.set(provider, { id: provider, name: providerDisplayName(provider), models: [choice] });
  }
  return [...providers.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function findPickerModel(catalog: readonly AvailableModelOption[], { provider, model }: ModelPickerValue) {
  const fullId = `${provider}/${model}`;
  return catalog.find(option => option.provider === provider && (option.id === fullId || option.id === model));
}
