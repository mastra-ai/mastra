/**
 * Onboarding "packs" — predefined model configurations for each mode.
 *
 * Each pack assigns a default model to the build, plan, and fast modes,
 * plus an OM (observational memory) model.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModePack {
  id: string;
  name: string;
  description: string;
  models: {
    build: string;
    plan: string;
    fast: string;
  };
}

export interface OMPack {
  id: string;
  name: string;
  description: string;
  modelId: string;
}

/** How a provider is accessed: OAuth subscription, API key, or not at all. */
export type ProviderAccessLevel = 'oauth' | 'apikey' | false;

/** Which providers the user has access to and how. */
export interface ProviderAccess {
  anthropic: ProviderAccessLevel;
  openai: ProviderAccessLevel;
  cerebras: ProviderAccessLevel;
  google: ProviderAccessLevel;
  deepseek: ProviderAccessLevel;
  [provider: string]: ProviderAccessLevel;
}

// ---------------------------------------------------------------------------
// Mode Packs
// ---------------------------------------------------------------------------

/**
 * Build the list of available mode packs based on which providers the user
 * can actually reach (API key or OAuth login).
 *
 * @param savedCustomPacks  Previously saved custom packs from settings.json.
 *                          These are inserted before the "New Custom" option.
 */
export function getAvailableModePacks(
  access: ProviderAccess,
  savedCustomPacks: Array<{ name: string; models: Record<string, string> }> = [],
): ModePack[] {
  const packs: ModePack[] = [];

  const openaiCodex = 'openai/gpt-5.3-codex';
  const anthropicBuild = access.anthropic === 'oauth' ? 'anthropic/claude-opus-4-6' : 'anthropic/claude-sonnet-4-5';

  if (access.anthropic) {
    packs.push({
      id: 'anthropic',
      name: 'Anthropic',
      description:
        access.anthropic === 'oauth' ? 'All Anthropic models via Max subscription' : 'All Anthropic models via API key',
      models: {
        build: anthropicBuild,
        plan: anthropicBuild,
        fast: 'anthropic/claude-haiku-4-5',
      },
    });
  }

  if (access.openai) {
    packs.push({
      id: 'openai',
      name: 'OpenAI',
      description:
        access.openai === 'oauth' ? 'All OpenAI models via Codex subscription' : 'All OpenAI models via API key',
      models: {
        build: openaiCodex,
        plan: openaiCodex,
        fast: 'openai/gpt-5.1-codex-mini',
      },
    });
  }

  // Saved custom packs — inserted before the "New Custom" option
  for (const cp of savedCustomPacks) {
    packs.push({
      id: `custom:${cp.name}`,
      name: cp.name,
      description: 'Saved custom pack',
      models: {
        build: cp.models.build ?? '',
        plan: cp.models.plan ?? '',
        fast: cp.models.fast ?? '',
      },
    });
  }

  // New Custom — always available; user picks each model individually
  const hasCustom = savedCustomPacks.length > 0;
  packs.push({
    id: 'custom',
    name: hasCustom ? 'New Custom' : 'Custom',
    description: 'Choose a model for each mode',
    models: { build: '', plan: '', fast: '' },
  });

  return packs;
}

// ---------------------------------------------------------------------------
// OM Packs
// ---------------------------------------------------------------------------

export function getAvailableOmPacks(access: ProviderAccess): OMPack[] {
  const packs: OMPack[] = [];

  if (access.google) {
    packs.push({
      id: 'gemini',
      name: 'Gemini Flash',
      description: access.google === 'oauth' ? 'Via Google OAuth' : 'Via Google API key',
      modelId: 'google/gemini-2.5-flash',
    });
  }

  if (access.anthropic) {
    packs.push({
      id: 'anthropic',
      name: 'Claude Haiku',
      description: access.anthropic === 'oauth' ? 'Via Max subscription' : 'Via Anthropic API key',
      modelId: 'anthropic/claude-haiku-4-5',
    });
  }

  if (access.openai) {
    packs.push({
      id: 'openai',
      name: 'Codex Mini',
      description: access.openai === 'oauth' ? 'Via Codex subscription' : 'Via OpenAI API key',
      modelId: 'openai/gpt-5.1-codex-mini',
    });
  }

  if (access.deepseek) {
    packs.push({
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'Via DeepSeek API key',
      modelId: 'deepseek/deepseek-chat',
    });
  }

  // Custom — always available; user picks any model
  packs.push({
    id: 'custom',
    name: 'Custom',
    description: 'Choose any available model',
    modelId: '',
  });

  return packs;
}

// ---------------------------------------------------------------------------
// Current onboarding version — bump when adding new steps
// ---------------------------------------------------------------------------

export const ONBOARDING_VERSION = 1;
