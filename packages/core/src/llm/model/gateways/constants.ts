// anything in this list will use the corresponding ai sdk package instead of using openai-compat endpoints
export const PROVIDERS_WITH_INSTALLED_PACKAGES = ['anthropic', 'google', 'openai', 'xai'];

// anything here doesn't show up in model router
// github-copilot: requires a special oauth flow
// openrouter: handled by dedicated OpenRouterGateway with dynamic model discovery from OpenRouter API
export const EXCLUDED_PROVIDERS = ['github-copilot', 'openrouter'];
