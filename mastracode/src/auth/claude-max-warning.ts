/**
 * Claude Max OAuth warning constants.
 *
 * Shared between the TUI startup check, the /login command, and onboarding so
 * the provider ID and user-facing message stay in sync.
 */

export const ANTHROPIC_OAUTH_PROVIDER_ID = 'anthropic';

export const CLAUDE_MAX_OAUTH_WARNING_MESSAGE =
  'OAuth with a Claude Max plan is a grey area and may violate your Terms of Service with Anthropic. Proceed at your own risk.';
