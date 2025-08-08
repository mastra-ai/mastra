const envVars: Record<string, { ok: boolean; data: Record<string, string> }> = {
  openai: {
    ok: true,
    data: {
      BROWSERBASE_PROJECT_ID: '',
      BROWSERBASE_API_KEY: '',
      OPENAI_API_KEY: '',
      MODEL: 'gpt-4.1',
    },
  },

  anthropic: {
    ok: true,
    data: {
      BROWSERBASE_PROJECT_ID: '',
      BROWSERBASE_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      MODEL: 'claude-3-5-sonnet-20240620',
    },
  },
  groq: {
    ok: true,
    data: {
      BROWSERBASE_PROJECT_ID: '',
      BROWSERBASE_API_KEY: '',
      GROQ_API_KEY: '',
      MODEL: 'llama-3.3-70b-versatile',
    },
  },
  google: {
    ok: true,
    data: {
      BROWSERBASE_PROJECT_ID: '',
      BROWSERBASE_API_KEY: '',
      GOOGLE_GENERATIVE_AI_API_KEY: '',
      MODEL: 'gemini-2.5-pro',
    },
  },
};

export const useTemplateEnvVars = (provider: string) => {
  return envVars?.[provider] || {};
};
