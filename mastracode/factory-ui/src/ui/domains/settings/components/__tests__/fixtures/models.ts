import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';

export const datedModels: AvailableModelOption[] = [
  { id: 'openai/gpt-4.1', provider: 'openai', modelName: 'gpt-4.1', hasApiKey: true, releaseDate: '2025-04-14' },
  { id: 'openai/gpt-4o', provider: 'openai', modelName: 'gpt-4o', hasApiKey: true, releaseDate: '2024-05-13' },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true, releaseDate: '2025-08-07' },
];
