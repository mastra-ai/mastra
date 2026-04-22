export type AgentFixture = {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  systemPrompt: string;
  modelProviderId: string;
  modelId: string;
};

export const defaultAgentFixture: AgentFixture = {
  id: 'placeholder',
  name: 'Untitled agent',
  description: 'An assistant you are shaping together with the Agent Builder.',
  systemPrompt: `You are a helpful, concise assistant.

Follow these rules:
- Always answer in the user's language.
- Prefer clear, step-by-step reasoning when the task is complex.
- Ask for clarification when the request is ambiguous.
- Never invent facts. If you are not sure, say so.

Tone:
- Friendly, professional, and to the point.`,
  modelProviderId: 'openai',
  modelId: 'gpt-4o-mini',
};
