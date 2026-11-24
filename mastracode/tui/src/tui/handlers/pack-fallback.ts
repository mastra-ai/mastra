import { MODEL_FALLBACK_STATE_KEY, parsePendingModelFallback } from '@mastra/code-sdk/model-fallback';
import {
  loadSettings,
  resolveDefaultThinkingLevel,
  THREAD_FALLBACK_STATUS_KEY,
} from '@mastra/code-sdk/onboarding/settings';

import { applyPackToSession, listResolvableModePacks } from '../model-packs/apply.js';
import type { PackFallbackStatus } from '../state.js';
import type { EventHandlerContext } from './types.js';

/**
 * Keep a thread on the pack selected by a generic model-route hop.
 */
export async function handlePackFallbackState(
  ectx: EventHandlerContext,
  event: { state: Record<string, unknown>; changedKeys: string[] },
): Promise<void> {
  if (!event.changedKeys.includes(MODEL_FALLBACK_STATE_KEY)) return;
  const marker = event.state[MODEL_FALLBACK_STATE_KEY];
  if (marker === null || marker === undefined) return;
  const pending = parsePendingModelFallback(marker);
  const markerThreadId = typeof marker === 'object' && 'threadId' in marker ? marker.threadId : undefined;

  const entryThreadId = ectx.state.session.thread.getId();
  const pendingThreadId = typeof markerThreadId === 'string' && markerThreadId ? markerThreadId : entryThreadId;
  const setOriginThreadSetting = async (setting: { key: string; value: unknown }) => {
    if (pendingThreadId) {
      await ectx.state.session.thread.setSettingOn({ threadId: pendingThreadId, ...setting });
    }
  };
  const isOriginThreadActive = () => !pendingThreadId || ectx.state.session.thread.getId() === pendingThreadId;
  const clearPending = async () => {
    await setOriginThreadSetting({ key: MODEL_FALLBACK_STATE_KEY, value: undefined });
    if (isOriginThreadActive()) {
      await ectx.state.session.state.set({ [MODEL_FALLBACK_STATE_KEY]: null });
    }
  };

  if (!pending) {
    await clearPending();
    return;
  }
  if (!isOriginThreadActive()) return;

  const settings = loadSettings();
  const packs = listResolvableModePacks(settings);
  const pack = packs.find(candidate => candidate.id === pending.toEntryId);
  if (!pack) {
    await clearPending();
    return;
  }
  const failedPack = packs.find(candidate => candidate.id === pending.fromEntryId);
  const fallbackStatus: PackFallbackStatus = {
    usingPack: pack.name,
    failedPack: failedPack?.name ?? pending.fromEntryId,
    ...(failedPack ? { failedPackId: failedPack.id } : {}),
    ...(pending.failure?.retryAt ? { retryAt: pending.failure.retryAt } : {}),
  };

  try {
    await applyPackToSession(ectx, pending.toEntryId, {
      clearPendingFallback: false,
      afterApply: async selection => {
        if (!isOriginThreadActive()) return;
        await setOriginThreadSetting({ key: THREAD_FALLBACK_STATUS_KEY, value: fallbackStatus });
        if (!isOriginThreadActive()) return;

        const sessionOverride = (ectx.state.session.state.get() as Record<string, unknown>)?.thinkingLevel as
          | string
          | undefined;
        const currentModeId = ectx.state.session.mode.get();
        const runtimeSettings = {
          ...settings,
          models: { ...settings.models, activeModelPackId: pending.toEntryId },
        };
        const defaultThinking = resolveDefaultThinkingLevel(runtimeSettings, currentModeId);
        const effectiveThinking = sessionOverride ?? defaultThinking.level;
        const routeUsesOpenAI = selection.modelRoute.entries.some(entry => entry.modelId.startsWith('openai/'));
        if (
          routeUsesOpenAI &&
          sessionOverride === undefined &&
          defaultThinking.source === 'global' &&
          defaultThinking.level === 'off'
        ) {
          await ectx.state.session.state.set({ thinkingLevel: 'low' });
        } else if (selection.modelId.startsWith('openai/') && effectiveThinking === 'max') {
          await ectx.state.session.state.set({ thinkingLevel: 'xhigh' });
        }

        ectx.state.fallbackStatus = fallbackStatus;
        ectx.updateStatusLine();
        await ectx.refreshModelAuthStatus();
        await clearPending();
      },
    });
  } catch (error) {
    await clearPending();
    throw error;
  }
}

export async function leaveExpiredPackFallback(ectx: EventHandlerContext): Promise<void> {
  const status = ectx.state.fallbackStatus;
  const retryAt = Date.parse(status?.retryAt ?? '');
  if (!status?.failedPackId || Number.isNaN(retryAt) || retryAt > Date.now()) return;
  if (ectx.state.session.stream.isActive()) return;

  const clearStatus = async () => {
    await ectx.state.session.thread.setSetting({ key: THREAD_FALLBACK_STATUS_KEY, value: undefined });
    ectx.state.fallbackStatus = undefined;
    ectx.updateStatusLine();
  };
  const settings = loadSettings();
  if (!listResolvableModePacks(settings).some(pack => pack.id === status.failedPackId)) {
    await clearStatus();
    return;
  }
  await applyPackToSession(ectx, status.failedPackId, { settings, afterApply: clearStatus });
  await ectx.refreshModelAuthStatus();
}
