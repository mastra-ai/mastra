/**
 * Onboarding "packs" — predefined model configurations for each mode.
 *
 * Each pack assigns a default model to the build, plan, and fast modes,
 * plus an OM (observational memory) model.
 */
import { DEFAULT_OM_MODEL_ID } from '../constants.js';

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

interface BuiltinOMPack {
  id: string;
  providerId: string;
  name: string;
  modelId: string;
  description: (access: Exclude<ProviderAccessLevel, false>) => string;
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
  'github-copilot': ProviderAccessLevel;
  [provider: string]: ProviderAccessLevel;
}

// ---------------------------------------------------------------------------
// Mode Packs
// ---------------------------------------------------------------------------

interface BuiltinModePack extends Omit<ModePack, 'description'> {
  providerId: string;
  description: (access: Exclude<ProviderAccessLevel, false>) => string;
}

const BUILTIN_MODE_PACKS: BuiltinModePack[] = [
  {
    id: 'anthropic',
    providerId: 'anthropic',
    name: 'Anthropic',
    description: access =>
      access === 'oauth' ? 'All Anthropic models via Max subscription' : 'All Anthropic models via API key',
    models: {
      build: 'anthropic/claude-fable-5',
      plan: 'anthropic/claude-fable-5',
      fast: 'anthropic/claude-haiku-4-5',
    },
  },
  {
    id: 'openai',
    providerId: 'openai',
    name: 'OpenAI',
    description: access =>
      access === 'oauth' ? 'All OpenAI models via Codex subscription' : 'All OpenAI models via API key',
    models: {
      build: 'openai/gpt-5.6-sol',
      plan: 'openai/gpt-5.6-sol',
      fast: 'openai/gpt-5.4-mini',
    },
  },
  {
    id: 'github-copilot',
    providerId: 'github-copilot',
    name: 'GitHub Copilot',
    description: () => 'GitHub Copilot subscription',
    models: {
      build: 'github-copilot/gpt-4.1',
      plan: 'github-copilot/gemini-2.5-pro',
      fast: 'github-copilot/grok-code-fast-1',
    },
  },
];

export function getBuiltinModePack(packId: string): (ModePack & { providerId: string }) | undefined {
  const pack = BUILTIN_MODE_PACKS.find(item => item.id === packId);
  if (!pack) return undefined;
  return {
    id: pack.id,
    providerId: pack.providerId,
    name: pack.name,
    description: pack.description('apikey'),
    models: { ...pack.models },
  };
}

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
  const packs: ModePack[] = BUILTIN_MODE_PACKS.flatMap(pack => {
    const providerAccess = access[pack.providerId];
    if (!providerAccess) return [];
    return [
      {
        id: pack.id,
        name: pack.name,
        description: pack.description(providerAccess),
        models: { ...pack.models },
      },
    ];
  });

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

const BUILTIN_OM_PACKS: BuiltinOMPack[] = [
  {
    id: 'gemini',
    providerId: 'google',
    name: 'Gemini Flash',
    modelId: 'google/gemini-3.5-flash',
    description: access => (access === 'oauth' ? 'Via Google OAuth' : 'Via Google API key'),
  },
  {
    id: 'anthropic',
    providerId: 'anthropic',
    name: 'Claude Haiku',
    modelId: 'anthropic/claude-haiku-4-5',
    description: access => (access === 'oauth' ? 'Via Max subscription' : 'Via Anthropic API key'),
  },
  {
    id: 'openai',
    providerId: 'openai',
    name: 'OpenAI Mini',
    modelId: 'openai/gpt-5.4-mini',
    description: access => (access === 'oauth' ? 'Via Codex subscription' : 'Via OpenAI API key'),
  },
  {
    id: 'deepseek',
    providerId: 'deepseek',
    name: 'DeepSeek',
    modelId: 'deepseek/deepseek-v4-flash',
    description: () => 'Via DeepSeek API key',
  },
];

function normalizeOMProviderId(providerId: string): string {
  return providerId === 'openai-codex' ? 'openai' : providerId;
}

/** A provider's low-cost OM pack, or a custom pack on `fallbackModelId` when it has none. */
export function resolveProviderOMDefault(providerId: string, fallbackModelId = DEFAULT_OM_MODEL_ID): OMPack {
  const normalizedProviderId = normalizeOMProviderId(providerId);
  const builtin = BUILTIN_OM_PACKS.find(pack => pack.providerId === normalizedProviderId);
  if (builtin) {
    return {
      id: builtin.id,
      name: builtin.name,
      description: builtin.description('apikey'),
      modelId: builtin.modelId,
    };
  }

  return {
    id: 'custom',
    name: 'Custom',
    description: 'Uses the selected provider model',
    modelId: fallbackModelId || DEFAULT_OM_MODEL_ID,
  };
}

export function getAvailableOmPacks(access: ProviderAccess): OMPack[] {
  const packs = BUILTIN_OM_PACKS.flatMap(pack => {
    const providerAccess = access[pack.providerId];
    if (!providerAccess) return [];
    return [
      {
        id: pack.id,
        name: pack.name,
        description: pack.description(providerAccess),
        modelId: pack.modelId,
      },
    ];
  });

  // Custom — always available; user picks any model
  packs.push({
    id: 'custom',
    name: 'Custom',
    description: 'Choose any available model',
    modelId: '',
  });

  return packs;
}

/** Best reachable built-in OM pack: preferred provider, then OAuth, then built-in order. */
export function selectPreferredOMPack(access: ProviderAccess, preferredProviderId?: string): OMPack | undefined {
  const available = getAvailableOmPacks(access).filter(pack => pack.id !== 'custom');

  if (preferredProviderId) {
    const preferredPackId = resolveProviderOMDefault(preferredProviderId).id;
    const preferred = available.find(pack => pack.id === preferredPackId);
    if (preferred) return preferred;
  }

  const oauth = available.find(pack => {
    const definition = BUILTIN_OM_PACKS.find(candidate => candidate.id === pack.id);
    return definition ? access[definition.providerId] === 'oauth' : false;
  });
  return oauth ?? available[0];
}

// ---------------------------------------------------------------------------
// Current onboarding version — bump when adding new steps
// ---------------------------------------------------------------------------

export const ONBOARDING_VERSION = 1;
