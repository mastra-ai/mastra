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
 * Sends Chat Completions requests with exactly one leading system message.
 *
 * Whether a server accepts several system messages depends on the host's chat template, not the
 * model or provider: the same Qwen3.5 weights are accepted by some hosts and rejected with
 * `System message must be at the beginning` by others. One leading system message is valid
 * everywhere, so leading system messages are merged in order and any system message after
 * conversation content becomes a user message wrapped in `<system-reminder>`.
 *
 * @see https://github.com/mastra-ai/mastra/issues/25435
 */
export function toSingleSystemMessage<T extends PromptMessage>(provider: string, prompt: T[]): T[] {
  if (!usesChatCompletions(provider)) return prompt;

  let leading = 0;
  while (leading < prompt.length && prompt[leading]!.role === 'system') leading++;
  const needsMerge = leading > 1;
  const hasLateSystem = prompt.slice(leading).some(m => m.role === 'system');
  if (!needsMerge && !hasLateSystem) return prompt;

  const result: T[] = [];
  if (needsMerge) {
    const leadingMessages = prompt.slice(0, leading);
    const content = leadingMessages
      .map(m => m.content as string)
      .filter(text => text.length > 0)
      .join('\n\n');
    // Keep the last cache breakpoint so it still covers the whole merged prefix.
    const providerOptions = leadingMessages.findLast(m => m.providerOptions)?.providerOptions;
    result.push({ role: 'system', content, ...(providerOptions ? { providerOptions } : {}) } as T);
  } else if (leading === 1) {
    result.push(prompt[0]!);
  }
  for (const message of prompt.slice(leading)) {
    if (message.role !== 'system') {
      result.push(message);
      continue;
    }
    result.push({
      role: 'user',
      content: [{ type: 'text', text: `<system-reminder>${message.content as string}</system-reminder>` }],
      ...(message.providerOptions ? { providerOptions: message.providerOptions } : {}),
    } as T);
  }
  return result;
}
