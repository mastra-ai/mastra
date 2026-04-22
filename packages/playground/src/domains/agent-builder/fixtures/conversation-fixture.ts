export type BuilderMessageRole = 'user' | 'assistant';

export type BuilderMessage = {
  id: string;
  role: BuilderMessageRole;
  content: string;
};

export const buildInitialConversation = (userMessage?: string): BuilderMessage[] => {
  const messages: BuilderMessage[] = [];

  if (userMessage && userMessage.trim().length > 0) {
    messages.push({ id: 'user-initial', role: 'user', content: userMessage });
    messages.push({
      id: 'assistant-initial',
      role: 'assistant',
      content:
        "Got it — I've drafted a starting configuration based on that. Take a look at the preview on the right. What should we refine first: the tone, the tools it should use, or the skills it should master?",
    });
  }

  return messages;
};
