export type ModelOption = {
  providerId: string;
  providerName: string;
  modelId: string;
  label: string;
};

export const modelOptionsFixture: ModelOption[] = [
  { providerId: 'openai', providerName: 'OpenAI', modelId: 'gpt-4o', label: 'GPT-4o' },
  { providerId: 'openai', providerName: 'OpenAI', modelId: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { providerId: 'openai', providerName: 'OpenAI', modelId: 'o3-mini', label: 'o3-mini' },
  { providerId: 'anthropic', providerName: 'Anthropic', modelId: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { providerId: 'anthropic', providerName: 'Anthropic', modelId: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
  { providerId: 'anthropic', providerName: 'Anthropic', modelId: 'claude-haiku-4', label: 'Claude Haiku 4' },
  { providerId: 'google', providerName: 'Google', modelId: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { providerId: 'google', providerName: 'Google', modelId: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { providerId: 'mistral', providerName: 'Mistral', modelId: 'mistral-large-latest', label: 'Mistral Large' },
];

export const getModelOptionKey = (option: ModelOption) => `${option.providerId}:${option.modelId}`;

export const findModelOption = (key: string) =>
  modelOptionsFixture.find(option => getModelOptionKey(option) === key);
