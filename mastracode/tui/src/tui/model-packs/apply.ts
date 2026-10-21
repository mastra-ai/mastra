import { MODEL_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import { listResolvableModePacks, resolvePackSelection } from '@mastra/code-sdk/onboarding/pack-activation';
import type { PackSelection } from '@mastra/code-sdk/onboarding/pack-activation';
import {
  loadSettings,
  resolveThreadActiveModelPackId,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import type { GlobalSettings } from '@mastra/code-sdk/onboarding/settings';
import type { AgentControllerThinkingLevel } from '@mastra/core/agent-controller';
import type { TUIState } from '../state.js';

// Pack listing/selection resolution lives in the SDK (onboarding/pack-activation)
// and is shared with the headless CLI's --pack flag; re-exported for the TUI.
export { listResolvableModePacks };

interface ModelPackContext {
  state: Pick<TUIState, 'controller' | 'session' | 'local'>;
}

const packApplicationVersions = new WeakMap<object, number>();
const packApplicationQueues = new WeakMap<object, Promise<void>>();

function beginPackApplication(
  ctx: ModelPackContext,
  modeId: string,
  expectedThreadId: string | null | undefined,
): { isCurrent: () => boolean; run: <T>(apply: () => Promise<T>) => Promise<T> } {
  const session = ctx.state.session as object;
  const version = (packApplicationVersions.get(session) ?? 0) + 1;
  packApplicationVersions.set(session, version);
  const isCurrent = () =>
    packApplicationVersions.get(session) === version &&
    ctx.state.session.mode.get() === modeId &&
    ctx.state.session.thread.getId() === expectedThreadId;
  const previous = packApplicationQueues.get(session) ?? Promise.resolve();
  return {
    isCurrent,
    run: apply => {
      const result = previous.catch(() => undefined).then(apply);
      packApplicationQueues.set(
        session,
        result.then(
          () => undefined,
          () => undefined,
        ),
      );
      return result;
    },
  };
}

function modelRoutesMatch(current: unknown, expected: PackSelection['modelRoute']): boolean {
  if (!current || typeof current !== 'object') return false;
  const entries = (current as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length !== expected.entries.length) return false;
  return expected.entries.every((entry, index) => {
    const currentEntry = entries[index];
    if (!currentEntry || typeof currentEntry !== 'object') return false;
    const candidate = currentEntry as Record<string, unknown>;
    return (
      candidate.id === entry.id &&
      candidate.label === entry.label &&
      candidate.modelId === entry.modelId &&
      candidate.accountId === entry.accountId &&
      candidate.memoryModelId === entry.memoryModelId
    );
  });
}

export async function applyPackToSession(
  ctx: ModelPackContext,
  packId: string,
  options: {
    modeId?: string;
    thinkingLevel?: AgentControllerThinkingLevel;
    settings?: GlobalSettings;
    clearPendingFallback?: boolean;
    expectedThreadId?: string | null;
    afterApply?: (selection: PackSelection) => Promise<void>;
    onError?: (error: unknown) => Promise<void>;
  } = {},
): Promise<PackSelection & { applied: boolean }> {
  const settings = options.settings ?? loadSettings();
  const modeId = options.modeId ?? ctx.state.session.mode.get();
  const expectedThreadId = 'expectedThreadId' in options ? options.expectedThreadId : ctx.state.session.thread.getId();
  const selection = resolvePackSelection(settings, packId, modeId);
  if (!selection) throw new Error(`Model pack "${packId}" has no model for ${modeId} mode`);
  const application = beginPackApplication(ctx, modeId, expectedThreadId);

  return application.run(async () => {
    const cancelled = () => ({ ...selection, applied: false });
    if (!application.isCurrent()) return cancelled();

    try {
      if (expectedThreadId) {
        await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: packId });
        if (!application.isCurrent()) return cancelled();
        if (options.clearPendingFallback !== false) {
          await ctx.state.session.thread.setSetting({ key: MODEL_FALLBACK_STATE_KEY, value: undefined });
          if (!application.isCurrent()) return cancelled();
        }
      }
      await ctx.state.session.model.switch(selection.modelId, {
        ...(options.thinkingLevel !== undefined ? { thinkingLevel: options.thinkingLevel } : {}),
      });
      if (!application.isCurrent()) return cancelled();
      for (const [agentType, modelId] of Object.entries(selection.subagentModels)) {
        await ctx.state.local?.session.subagents.model.set({ modelId, agentType });
        if (!application.isCurrent()) return cancelled();
      }
      await ctx.state.session.state.set({
        modelRoute: selection.modelRoute,
        ...(options.clearPendingFallback === false ? {} : { [MODEL_FALLBACK_STATE_KEY]: null }),
      });
      if (!application.isCurrent()) return cancelled();
      await options.afterApply?.(selection);

      return { ...selection, applied: application.isCurrent() };
    } catch (error) {
      if (application.isCurrent()) await options.onError?.(error);
      throw error;
    }
  });
}

async function resolveActivePackId(
  ctx: ModelPackContext,
  settings: GlobalSettings,
): Promise<{ packId: string | null; threadId: string | null | undefined } | undefined> {
  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
  if (ctx.state.session.thread.getId() !== threadId) return undefined;
  return {
    packId: resolveThreadActiveModelPackId(settings, listResolvableModePacks(settings), thread?.metadata),
    threadId,
  };
}

export async function applyCurrentThreadPack(
  ctx: ModelPackContext,
  options: { modeId?: string; packId?: string | null; applyModeDefault?: boolean } = {},
): Promise<{ applied: boolean }> {
  // Factory sessions use the Factory's configured model; local packs reference local provider auth.
  if (!ctx.state.local) return { applied: true };
  const settings = loadSettings();
  const modeId = options.modeId ?? ctx.state.session.mode.get();
  const resolution =
    options.packId === undefined
      ? await resolveActivePackId(ctx, settings)
      : { packId: options.packId, threadId: ctx.state.session.thread.getId() };
  if (!resolution) return { applied: false };
  if (resolution.packId && resolvePackSelection(settings, resolution.packId, modeId)) {
    return applyPackToSession(ctx, resolution.packId, {
      modeId,
      settings,
      expectedThreadId: resolution.threadId,
    });
  }

  const application = beginPackApplication(ctx, modeId, resolution.threadId);
  return application.run(async () => {
    if (!application.isCurrent()) return { applied: false };
    if (options.applyModeDefault !== false) {
      const mode = ctx.state.controller.listModes().find(item => item.id === modeId);
      const modelId = settings.models.modeDefaults[modeId] ?? mode?.defaultModelId;
      if (modelId && ctx.state.session.model.get() !== modelId) {
        await ctx.state.session.model.switch(modelId);
        if (!application.isCurrent()) return { applied: false };
      }
    }
    if (resolution.threadId) {
      await ctx.state.session.thread.setSetting({ key: MODEL_FALLBACK_STATE_KEY, value: undefined });
      if (!application.isCurrent()) return { applied: false };
    }
    await ctx.state.session.state.set({ modelRoute: undefined, [MODEL_FALLBACK_STATE_KEY]: null });
    return { applied: application.isCurrent() };
  });
}

export async function switchModeWithPack(ctx: ModelPackContext, modeId: string): Promise<void> {
  await ctx.state.session.mode.switch({ modeId });
  const application = await applyCurrentThreadPack(ctx, { modeId });
  if (!application.applied) {
    throw new Error('Mode switch was superseded before its model selection completed.');
  }
}

export async function reconcilePackAfterModeChange(ctx: ModelPackContext, modeId: string): Promise<void> {
  if (!ctx.state.local) return;
  const settings = loadSettings();
  const resolution = await resolveActivePackId(ctx, settings);
  if (!resolution?.packId || ctx.state.session.mode.get() !== modeId) return;
  const selection = resolvePackSelection(settings, resolution.packId, modeId);
  if (!selection) return;
  const state = ctx.state.session.state.get() as Record<string, unknown>;
  const isAlreadyApplied =
    ctx.state.session.model.get() === selection.modelId &&
    modelRoutesMatch(state.modelRoute, selection.modelRoute) &&
    state[MODEL_FALLBACK_STATE_KEY] == null;
  if (isAlreadyApplied) return;
  await applyPackToSession(ctx, resolution.packId, { modeId, expectedThreadId: resolution.threadId });
}
