import { cleanProviderId } from './clean-provider-id';

/**
 * A model's name in parts for `SegmentedName`: `['openai', 'gpt-5']`. The lab comes from the id
 * when it names one (`openai/gpt-5`), else from the provider (`openai.chat` reads as `openai`).
 * Without either, just the model.
 */
export function modelNameParts(model: string, provider?: string): string[] {
  const cut = model.indexOf('/');
  if (cut >= 0) return [model.slice(0, cut), model.slice(cut + 1)];
  const lab = provider && cleanProviderId(provider);
  return lab ? [lab, model] : [model];
}
