import type { CoreUserMessage } from '@mastra/core/llm';

type UserPart = Exclude<CoreUserMessage['content'], string>[number];

const messageParts = (message: CoreUserMessage): UserPart[] => {
  const parts: UserPart[] =
    typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
  const inheritedOptions = message.providerOptions ?? message.experimental_providerMetadata;
  if (!inheritedOptions) return parts;

  return parts.map(part => {
    const providerOptions = { ...inheritedOptions };
    for (const [provider, options] of Object.entries(
      part.providerOptions ?? part.experimental_providerMetadata ?? {},
    )) {
      providerOptions[provider] = { ...providerOptions[provider], ...options };
    }
    return { ...part, providerOptions };
  });
};

/** One send is one user message, with each attachment retained as a content part. */
export const createUserMessage = (text: string, attachments: CoreUserMessage[] = []): CoreUserMessage => ({
  role: 'user',
  content: [
    ...(text || attachments.length === 0 ? [{ type: 'text' as const, text }] : []),
    ...attachments.flatMap(messageParts),
  ],
});
