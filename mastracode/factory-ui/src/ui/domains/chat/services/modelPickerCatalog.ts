import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ModelPickerProvider, ModelPickerValue } from '@mastra/playground-ui/domains/llm';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';

/** The shared picker keys models within their provider, so drop the provider prefix. */
const withinProvider = (provider: string, modelId: string) =>
  modelId.startsWith(`${provider}/`) ? modelId.slice(provider.length + 1) : modelId;

/**
 * Groups a model catalog by provider for the shared model picker, providers sorted by id. `extraModelId`, when the
 * catalog lacks it (e.g. a saved default no connected credential can run), is listed under its provider so it still
 * shows as selected; a provider that only holds it is marked not connected.
 */
export function toPickerProviders(models: AvailableModelOption[], extraModelId?: string): ModelPickerProvider[] {
  const groups = new Map<string, ModelPickerProvider>();
  const groupFor = (provider: string, connected?: false) => {
    let group = groups.get(provider);
    if (!group) {
      group = {
        id: provider,
        name: providerDisplayName(provider),
        models: [],
        ...(connected === false && { connected }),
      };
      groups.set(provider, group);
    }
    return group;
  };
  for (const model of models) {
    groupFor(model.provider).models.push({
      id: withinProvider(model.provider, model.id),
      releaseDate: model.releaseDate,
    });
  }
  if (extraModelId && !models.some(model => model.id === extraModelId)) {
    const value = toPickerValue(models, extraModelId);
    if (value) groupFor(value.provider, false).models.push({ id: value.model });
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The picker value for a catalog model id; ids outside the catalog take their provider from the id prefix. */
export function toPickerValue(
  models: AvailableModelOption[],
  modelId: string | null | undefined,
): ModelPickerValue | undefined {
  if (!modelId) return undefined;
  const provider = models.find(option => option.id === modelId)?.provider ?? modelId.split('/')[0];
  if (!provider) return undefined;
  return { provider, model: withinProvider(provider, modelId) };
}

/** The catalog model id the picker value names, or `provider/model` when the catalog does not list it. */
export function fromPickerValue(models: AvailableModelOption[], { provider, model }: ModelPickerValue): string {
  return (
    models.find(option => option.provider === provider && (option.id === `${provider}/${model}` || option.id === model))
      ?.id ?? `${provider}/${model}`
  );
}
