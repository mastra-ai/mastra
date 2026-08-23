import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { AuthCredential, CredentialStore } from '../auth/types.js';
import type { ProviderAccess, ProviderAccessLevel } from './packs.js';

function credentialAccessLevel(credential: AuthCredential | undefined): ProviderAccessLevel {
  if (credential?.type === 'oauth') return 'oauth';
  if (credential?.type === 'api_key' && credential.key.trim().length > 0) return 'apikey';
  return false;
}

function applyRegistryEnvKeys(access: ProviderAccess): void {
  for (const [provider, config] of Object.entries(PROVIDER_REGISTRY)) {
    if (access[provider] !== false || provider === 'anthropic' || provider === 'openai') continue;
    const envVars = config?.apiKeyEnvVar;
    const envVarList = Array.isArray(envVars) ? envVars : envVars ? [envVars] : [];
    if (envVarList.some(envVar => process.env[envVar])) {
      access[provider] = 'apikey';
    }
  }
}

/**
 * Which providers this process can reach and how. Anthropic/OpenAI read the
 * credential store (OAuth or stored key), the Mastra gateway key unlocks both,
 * every other provider comes from its registry-declared env var.
 */
export function computeProviderAccess(credentials: CredentialStore, mastraGatewayApiKey?: string): ProviderAccess {
  const access: ProviderAccess = {
    anthropic: credentialAccessLevel(credentials.get('anthropic')),
    openai: credentialAccessLevel(credentials.get('openai-codex')),
    cerebras: process.env.CEREBRAS_API_KEY ? 'apikey' : false,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'apikey' : false,
    deepseek: process.env.DEEPSEEK_API_KEY ? 'apikey' : false,
    'github-copilot': credentials.get('github-copilot')?.type === 'oauth' ? 'oauth' : false,
  };

  if (mastraGatewayApiKey) {
    if (!access.anthropic) access.anthropic = 'apikey';
    if (!access.openai) access.openai = 'apikey';
  }

  try {
    applyRegistryEnvKeys(access);
  } catch {
    // Registry not loaded yet — the direct checks above still hold.
  }

  return access;
}
