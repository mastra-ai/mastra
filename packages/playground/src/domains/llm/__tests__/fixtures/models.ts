import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';

export const datedModels = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      connected: true,
      models: ['custom-z', 'gpt-4.1', 'gpt-4o', 'gpt-5', 'custom-a'],
      modelReleaseDates: {
        'gpt-4.1': '2025-04-14',
        'gpt-4o': '2024-05-13',
        'gpt-5': '2025-08-07',
      },
    },
  ],
} satisfies ListAgentsModelProvidersResponse;
