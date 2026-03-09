// anything in this list will use the corresponding ai sdk package instead of using openai-compat endpoints
export const PROVIDERS_WITH_INSTALLED_PACKAGES = [
  'anthropic',
  'cerebras',
  'deepinfra',
  'deepseek',
  'google',
  'groq',
  'mistral',
  'openai',
  'openrouter',
  'perplexity',
  'togetherai',
  'vercel',
  'xai',
];

// anything here doesn't show up in model router. for now that's just copilot which requires a special oauth flow
export const EXCLUDED_PROVIDERS = ['github-copilot'];
