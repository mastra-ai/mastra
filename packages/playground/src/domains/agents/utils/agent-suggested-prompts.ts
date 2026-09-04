const MAX_SUGGESTED_PROMPTS = 3;

/**
 * Reads the suggested-prompt convention from free-form agent metadata.
 * Invalid, blank, and duplicate entries are ignored so the chat always receives
 * a small list that is safe to render with the prompt text as its React key.
 */
export function getAgentSuggestedPrompts(metadata: Record<string, unknown> | undefined): string[] {
  const configuredPrompts = metadata?.suggestedPrompts;
  if (!Array.isArray(configuredPrompts)) return [];

  const prompts: string[] = [];
  const seenPrompts = new Set<string>();

  for (const configuredPrompt of configuredPrompts) {
    if (typeof configuredPrompt !== 'string') continue;

    const prompt = configuredPrompt.trim();
    if (!prompt || seenPrompts.has(prompt)) continue;

    prompts.push(prompt);
    seenPrompts.add(prompt);

    if (prompts.length === MAX_SUGGESTED_PROMPTS) break;
  }

  return prompts;
}
