import type { AvailableModelOption } from './model-packs';

import type { ModelPickerProvider, ModelPickerValue } from '@/domains/llm';

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

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'github-copilot': 'GitHub Copilot',
  'kimi-code-plan-cn': 'Kimi',
  mastra: 'Mastra Gateway',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI',
  xai: 'xAI',
};

export function providerDisplayName(provider: string): string {
  return (
    PROVIDER_DISPLAY_NAMES[provider] ??
    provider
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
