const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'github-copilot': 'GitHub Copilot',
  'kimi-code-plan-cn': 'Kimi',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI',
  xai: 'xAI',
};

export function providerDisplayName(provider: string): string {
  return (
    PROVIDER_DISPLAY_NAMES[provider] ??
    provider
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
