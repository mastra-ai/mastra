import { MODEL_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import { listBuiltinModePacks, resolveModePackFallbackChain, type ModePack } from '@mastra/code-sdk/onboarding/packs';
import {
  loadSettings,
  resolveModePackModels,
  resolveThreadActiveModelPackId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
  type GlobalSettings,
} from '@mastra/code-sdk/onboarding/settings';
import type { TUIState } from '../state.js';

interface ModelPackContext {
  state: Pick<TUIState, 'controller' | 'session'>;
}

export interface PackSelection {
  modelId: string;
  subagentModels: Record<string, string>;
  observerModelId?: string;
  reflectorModelId?: string;
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

  const memoryModelId = packModels.memory;
  return {
    modelId,
    subagentModels,
    ...(memoryModelId ? { observerModelId: memoryModelId, reflectorModelId: memoryModelId } : {}),
    modelRoute: { entries },
  };
}

export async function applyPackToSession(
  ctx: ModelPackContext,
  packId: string,
  options: { modeId?: string; settings?: GlobalSettings } = {},
): Promise<PackSelection> {
  const settings = options.settings ?? loadSettings();
  const modeId = options.modeId ?? ctx.state.session.mode.get();
  const selection = resolvePackSelection(settings, packId, modeId);
  if (!selection) throw new Error(`Model pack "${packId}" has no model for ${modeId} mode`);

  if (ctx.state.session.thread.getId()) {
    await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: packId });
  }
  await ctx.state.session.model.switch({ modelId: selection.modelId });
  for (const [agentType, modelId] of Object.entries(selection.subagentModels)) {
    await ctx.state.session.subagents.model.set({ modelId, agentType });
  }
  if (selection.observerModelId) {
    await ctx.state.session.om.observer.switchModel({ modelId: selection.observerModelId });
  }
  if (selection.reflectorModelId) {
    await ctx.state.session.om.reflector.switchModel({ modelId: selection.reflectorModelId });
  }
  await ctx.state.session.state.set({ modelRoute: selection.modelRoute });

  return selection;
}

async function resolveActivePackId(ctx: ModelPackContext, settings: GlobalSettings): Promise<string | null> {
  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
  return resolveThreadActiveModelPackId(settings, listResolvableModePacks(settings), thread?.metadata);
}

export async function applyCurrentThreadPack(
  ctx: ModelPackContext,
  options: { modeId?: string; packId?: string | null } = {},
): Promise<PackSelection | undefined> {
  const settings = loadSettings();
  const modeId = options.modeId ?? ctx.state.session.mode.get();
  const packId = options.packId === undefined ? await resolveActivePackId(ctx, settings) : options.packId;
  if (packId) return applyPackToSession(ctx, packId, { modeId });

  const mode = ctx.state.controller.listModes().find(item => item.id === modeId);
  const modelId = settings.models.modeDefaults[modeId] ?? mode?.defaultModelId;
  if (modelId && ctx.state.session.model.get() !== modelId) {
    await ctx.state.session.model.switch({ modelId });
  }
  await ctx.state.session.state.set({ modelRoute: undefined, [MODEL_FALLBACK_STATE_KEY]: null });
  return undefined;
}

export async function switchModeWithPack(ctx: ModelPackContext, modeId: string): Promise<void> {
  await ctx.state.session.mode.switch({ modeId });
  await applyCurrentThreadPack(ctx, { modeId });
}

export async function reconcilePackAfterModeChange(ctx: ModelPackContext, modeId: string): Promise<void> {
  const settings = loadSettings();
  const packId = await resolveActivePackId(ctx, settings);
  if (!packId) return;
  const selection = resolvePackSelection(settings, packId, modeId);
  if (!selection || ctx.state.session.model.get() === selection.modelId) return;
  await applyPackToSession(ctx, packId, { modeId });
}
