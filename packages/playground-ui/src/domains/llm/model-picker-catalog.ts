import type { ModelPickerProvider, ModelPickerValue } from './model-picker-types';
import { formatProviderName } from '@/utils/model';

/** A model from a flat catalog: an id like `openai/gpt-5`, with its provider when the id doesn't carry it. */
export interface ModelPickerCatalogModel {
  id: string;
  /** Defaults to the id's prefix before the first `/`. */
  provider?: string;
  releaseDate?: string;
}

/** The picker value of a catalog model: `openai/gpt-5` reads `{ provider: 'openai', model: 'gpt-5' }`. */
export function catalogModelPickerValue(model: ModelPickerCatalogModel & { provider: string }): ModelPickerValue;
export function catalogModelPickerValue(model: ModelPickerCatalogModel): ModelPickerValue | undefined;
export function catalogModelPickerValue({ id, provider }: ModelPickerCatalogModel): ModelPickerValue | undefined {
  if (provider) {
    const prefix = `${provider}/`;
    return { provider, model: id.startsWith(prefix) ? id.slice(prefix.length) : id };
  }
  const slash = id.indexOf('/');
  return slash > 0 ? { provider: id.slice(0, slash), model: id.slice(slash + 1) } : undefined;
}

/**
 * Groups a flat catalog by provider for `ModelPicker`, in catalog order. Models without a provider (no `provider`
 * and no `/` in the id) are left out.
 */
export function modelPickerProviders(
  catalog: readonly ModelPickerCatalogModel[],
  { providerName = formatProviderName }: { providerName?: (provider: string) => string } = {},
): ModelPickerProvider[] {
  const providers = new Map<string, ModelPickerProvider>();
  for (const option of catalog) {
    const value = catalogModelPickerValue(option);
    if (!value) continue;
    const choice = { id: value.model, releaseDate: option.releaseDate };
    const group = providers.get(value.provider);
    if (group) group.models.push(choice);
    else providers.set(value.provider, { id: value.provider, name: providerName(value.provider), models: [choice] });
  }
  return [...providers.values()];
}

/** The catalog model a picker value stands for. */
export function findCatalogModel<T extends ModelPickerCatalogModel>(
  catalog: readonly T[],
  { provider, model }: ModelPickerValue,
): T | undefined {
  const fullId = `${provider}/${model}`;
  return catalog.find(option => {
    const value = catalogModelPickerValue(option);
    return value?.provider === provider && (option.id === fullId || option.id === model);
  });
}
