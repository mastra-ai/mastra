declare const __MASTRA_VERSION__: string;

export const MASTRA_USER_AGENT = typeof __MASTRA_VERSION__ !== 'undefined' ? `mastra/${__MASTRA_VERSION__}` : 'mastra';

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

// Header used to pass gateway API key when Authorization is occupied by an OAuth token
export const GATEWAY_AUTH_HEADER = 'X-Memory-Gateway-Authorization';
