/**
 * Shared model-pack resolution and activation helpers.
 *
 * Used by both the interactive TUI (`--pack`, /models → Activate) and the
 * headless CLI (`--pack`) so a pack id from the command line behaves exactly
 * like activating the pack in the picker: the global default pack changes and
 * the session it starts gets the pack's models for every mode, its subagent
 * models, its fallback route, and the thread's `activeModelPackId`.
 */
import { listBuiltinModePacks, resolveModePackFallbackChain, type ModePack } from './packs.js';
import { resolveModePackModels, type GlobalSettings } from './settings.js';

/** Every pack id that can be activated: built-ins plus saved custom packs (`custom:<name>`). */
export function listResolvableModePacks(settings: GlobalSettings): ModePack[] {
  return [
    ...listBuiltinModePacks(),
    ...settings.customModelPacks.map(pack => ({
      id: `custom:${pack.name}`,
      name: pack.name,
      description: 'Saved custom pack',
      models: {
        build: pack.models.build ?? '',
        plan: pack.models.plan ?? '',
        fast: pack.models.fast ?? '',
        ...(pack.models.memory ? { memory: pack.models.memory } : {}),
      },
    })),
  ];
}

/** The valid `--pack` values, in display order. */
export function listValidModePackIds(settings: GlobalSettings): string[] {
  return listResolvableModePacks(settings).map(pack => pack.id);
}

/**
 * Resolve a `--pack` argument to a canonical pack id.
 *
 * Accepts a built-in pack id (`anthropic`), a fully qualified custom pack id
 * (`custom:Kimi`), or a bare custom pack name (`Kimi`) — the `custom:` prefix
 * is a storage detail users never see in the picker. On a collision between a
 * built-in id and a custom pack name, the built-in wins; `custom:<name>`
 * always reaches the custom pack.
 */
export function resolveModePackArg(settings: GlobalSettings, raw: string): { packId: string } | { error: string } {
  const input = raw.trim();
  const valid = listValidModePackIds(settings);
  if (input && valid.includes(input)) return { packId: input };
  if (input && !input.startsWith('custom:')) {
    const asCustom = `custom:${input}`;
    if (valid.includes(asCustom)) return { packId: asCustom };
  }
  return {
    error: `Unknown model pack: "${raw}". Valid packs: ${valid.join(', ')} (a custom pack also accepts its bare name, e.g. "Kimi" for "custom:Kimi")`,
  };
}

export interface PackSelection {
  modelId: string;
  subagentModels: Record<string, string>;
  modelRoute: {
    entries: Array<{
      id: string;
      label: string;
      modelId: string;
      accountId?: string;
      memoryModelId?: string;
    }>;
  };
}

/** Resolve what activating `packId` in `modeId` applies to the session. */
export function resolvePackSelection(
  settings: GlobalSettings,
  packId: string,
  modeId: string,
): PackSelection | undefined {
  const packs = listResolvableModePacks(settings);
  const packsById = new Map(packs.map(pack => [pack.id, pack]));
  const pack = packsById.get(packId);
  if (!pack) return undefined;

  const packModels = resolveModePackModels(settings, pack);
  const modelId = packModels[modeId];
  if (!modelId) return undefined;

  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  const subagentModels = Object.fromEntries(
    Object.entries(subagentModeMap).flatMap(([agentType, subagentModeId]) => {
      const subagentModelId = packModels[subagentModeId];
      return subagentModelId ? [[agentType, subagentModelId]] : [];
    }),
  );

  const routeIds = resolveModePackFallbackChain(settings.models.packFallbacks, packId, settings.customModelPacks);
  const entries = routeIds.flatMap(routeId => {
    const routePack = packsById.get(routeId);
    if (!routePack) return [];
    const routeModels = resolveModePackModels(settings, routePack);
    const routeModelId = routeModels[modeId];
    if (!routeModelId) return [];
    const accountId = settings.models.packAccountPreferences?.[routeId]?.[routeModelId];
    return [
      {
        id: routeId,
        label: routePack.name,
        modelId: routeModelId,
        ...(accountId ? { accountId } : {}),
        ...(routeModels.memory ? { memoryModelId: routeModels.memory } : {}),
      },
    ];
  });

  // The pack's memory model rides on the route rather than pinning the OM
  // roles, so it applies only while the pack is active and `/om` choices return
  // when it is not.
  return { modelId, subagentModels, modelRoute: { entries } };
}

/**
 * Mutate global settings the way /models → Activate does: point the global
 * default pack at `packId` and clear the per-agent subagent model overrides
 * so the pack's subagent models apply. The caller persists with
 * `saveSettings`.
 */
export function activateModePackInSettings(settings: GlobalSettings, packId: string): void {
  settings.models.activeModelPackId = packId;
  if (packId.startsWith('custom:')) {
    const pack = listResolvableModePacks(settings).find(candidate => candidate.id === packId);
    if (pack) {
      settings.models.modeDefaults = {
        build: pack.models.build,
        plan: pack.models.plan,
        fast: pack.models.fast,
        ...(pack.models.memory ? { memory: pack.models.memory } : {}),
      };
    }
  } else {
    settings.models.modeDefaults = {};
  }
  settings.models.subagentModels = {};
}
