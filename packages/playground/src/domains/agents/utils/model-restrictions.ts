import { cleanProviderId } from '../components/agent-metadata/utils';

/**
 * Check if the model is a newer Claude model (4.5+) that doesn't allow
 * both temperature and top_p to be specified simultaneously.
 * See: https://github.com/mastra-ai/mastra/issues/11760
 */
export function isAnthropicModelWithSamplingRestriction(provider?: string, modelId?: string): boolean {
  if (!provider) return false;
  const cleanProvider = cleanProviderId(provider).toLowerCase();
  if (cleanProvider !== 'anthropic') return false;

  // Claude 4.5+ models have the restriction
  // Model IDs like: claude-sonnet-4-5, claude-haiku-4-5, claude-4-5-sonnet, etc.
  if (!modelId) return true; // Default to restricted for anthropic if no modelId
  const lowerModelId = modelId.toLowerCase();

  // Check for version 4.5+ patterns specifically
  // Must match version 4.5 or higher (4-5, 4.5, 5-0, 5.0, etc.)
  // But NOT match 3-5 or 3.5 (Claude 3.5 Sonnet, etc.)
  // Patterns: claude-*-4-5, claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-5
  // Also future versions: 5-0, 5-5, 6-0, etc.
  const is45OrNewer =
    /[^0-9]4[.-]5/.test(lowerModelId) || // Matches 4-5 or 4.5 but not 34-5
    /[^0-9][5-9][.-]\d/.test(lowerModelId); // Matches 5-0, 6-0, etc. for future versions

  return is45OrNewer;
}
