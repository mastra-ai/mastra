type PromptMessage = {
  role: string;
  content: unknown;
  providerOptions?: unknown;
};

/**
 * AI SDK models that talk to a Chat Completions endpoint report a provider id ending in `.chat`
 * (`openai.chat`, `groq.chat`, `<name>.chat` from `createOpenAICompatible`, ...). Native APIs
 * with a dedicated system field (`anthropic`, `google.generative-ai`, `bedrock`) never do.
 */
function usesChatCompletions(provider: string): boolean {
  return provider.endsWith('.chat');
}

/**
 * Merges the leading system messages of a Chat Completions request into one.
 *
 * Whether a server accepts several system messages depends on the host's chat template, not the
 * model or provider: the same Qwen3.5 weights are accepted by some hosts and rejected with
 * `System message must be at the beginning` by others. One leading system message is valid
 * everywhere.
 *
 * Prompts are left unchanged when any merged message other than the last carries
 * `providerOptions` (e.g. a cache breakpoint), since merging would drop it.
 *
 * @see https://github.com/mastra-ai/mastra/issues/25435
 */
export function toSingleSystemMessage<T extends PromptMessage>(provider: string, prompt: T[]): T[] {
  if (!usesChatCompletions(provider)) return prompt;

  let leading = 0;
  while (leading < prompt.length && prompt[leading]!.role === 'system') leading++;
  if (leading < 2) return prompt;

  const leadingMessages = prompt.slice(0, leading);
  if (leadingMessages.slice(0, -1).some(m => m.providerOptions)) return prompt;

  const content = leadingMessages
    .map(m => m.content as string)
    .filter(text => text.length > 0)
    .join('\n\n');
  const { providerOptions } = leadingMessages[leading - 1]!;
  const merged = { role: 'system', content, ...(providerOptions ? { providerOptions } : {}) } as T;
  return [merged, ...prompt.slice(leading)];
}
