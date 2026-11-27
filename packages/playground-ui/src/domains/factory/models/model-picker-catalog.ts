import type { AvailableModelOption } from './model-packs';

import type { ModelPickerProvider, ModelPickerValue } from '@/domains/llm';
import {
  catalogModelPickerValue as sharedCatalogModelPickerValue,
  findCatalogModel,
  modelPickerProviders as sharedModelPickerProviders,
} from '@/domains/llm/model-picker-catalog';

/** Factory's catalog for the model picker: the shared helpers, with Factory's provider names, providers A to Z. */
export function catalogModelPickerValue(option: Pick<AvailableModelOption, 'id' | 'provider'>): ModelPickerValue {
  return sharedCatalogModelPickerValue(option);
}

export function modelPickerProviders(catalog: readonly AvailableModelOption[]): ModelPickerProvider[] {
  return sharedModelPickerProviders(catalog, { providerName: providerDisplayName }).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function findPickerModel(catalog: readonly AvailableModelOption[], value: ModelPickerValue) {
  return findCatalogModel(catalog, value);
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
