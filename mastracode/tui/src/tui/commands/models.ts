import { MODEL_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import { getBuiltinModePack } from '@mastra/code-sdk/onboarding/packs';
import {
  loadSettings,
  parseThreadSettings,
  resolveModePackModels,
  saveSettings,
  stripMastraCodeCustomProviderPrefix,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
  THREAD_FALLBACK_STATUS_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { applyPackToSession } from '../model-packs/apply.js';
import { showModalOverlay } from '../overlay.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import type { SlashCommandContext } from './types.js';

async function switchCurrentModeModel(ctx: SlashCommandContext, selectedModelId: string): Promise<void> {
  const modeId = ctx.state.session.mode.get();
  const settings = loadSettings();
  const nextSettings = structuredClone(settings);
  nextSettings.models.modePackOverrides ??= {};
  const modelId = stripMastraCodeCustomProviderPrefix(selectedModelId, settings.customProviders);
  const previousModelId = ctx.state.session.model.get();

  const modes = ctx.state.controller.listModes();
  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
  const threadSettings = parseThreadSettings(thread?.metadata);
  const previousPackSetting = thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY];
  const previousFallbackStatus = thread?.metadata?.[THREAD_FALLBACK_STATUS_KEY];
  const previousPendingFallback = thread?.metadata?.[MODEL_FALLBACK_STATE_KEY];
  const previousSessionState = ctx.state.session.state.get() as Record<string, unknown>;
  const previousFallbackUi = ctx.state.fallbackStatus;
  const activePackId = threadSettings.activeModelPackId ?? nextSettings.models.activeModelPackId;
  const builtinPack = activePackId ? getBuiltinModePack(activePackId) : undefined;
  const customPack = activePackId?.startsWith('custom:')
    ? nextSettings.customModelPacks.find(item => `custom:${item.name}` === activePackId)
    : undefined;
  const activePack = builtinPack ?? (customPack ? { id: activePackId!, models: customPack.models } : undefined);
  const effectivePackModels = activePack ? resolveModePackModels(nextSettings, activePack) : {};
  const modeModels: Record<string, string> = {};
  for (const item of modes) {
    const fallbackModelId =
      effectivePackModels[item.id] ?? nextSettings.models.modeDefaults[item.id] ?? item.defaultModelId;
    if (fallbackModelId) modeModels[item.id] = fallbackModelId;
  }
  modeModels[modeId] = modelId;

  let nextPackId: string;
  if (builtinPack) {
    const packOverrides = { ...(nextSettings.models.modePackOverrides[builtinPack.id] ?? {}) };
    if (modelId === builtinPack.models[modeId as 'build' | 'plan' | 'fast']) {
      delete packOverrides[modeId];
    } else {
      packOverrides[modeId] = modelId;
    }
    if (Object.keys(packOverrides).length > 0) {
      nextSettings.models.modePackOverrides[builtinPack.id] = packOverrides;
    } else {
      delete nextSettings.models.modePackOverrides[builtinPack.id];
    }
    nextPackId = builtinPack.id;
    nextSettings.models.activeModelPackId = builtinPack.id;
    nextSettings.models.modeDefaults = {};
  } else {
    nextPackId = activePackId?.startsWith('custom:') ? activePackId : 'custom:Custom';
    const customName = nextPackId.slice('custom:'.length);
    const existingPack = nextSettings.customModelPacks.find(item => item.name === customName);
    if (existingPack) {
      existingPack.models = { ...existingPack.models, ...modeModels };
    } else {
      nextSettings.customModelPacks.push({
        name: customName,
        models: modeModels,
        createdAt: new Date().toISOString(),
      });
    }
    nextSettings.models.activeModelPackId = nextPackId;
    nextSettings.models.modeDefaults = modeModels;
  }

  await applyPackToSession(ctx, nextPackId, {
    modeId,
    settings: nextSettings,
    expectedThreadId: threadId,
    afterApply: async () => {
      saveSettings(nextSettings);
      const savedPackSetting = await ctx.state.session.thread.getSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY });
      if (savedPackSetting !== nextPackId) throw new Error('Could not save the active model pack');
      await ctx.state.session.thread.setSetting({ key: THREAD_FALLBACK_STATUS_KEY, value: undefined });
      ctx.state.fallbackStatus = undefined;
      ctx.updateStatusLine();
      ctx.showInfo(`Switched ${modeId} mode to ${modelId}`);
    },
    onError: async () => {
      try {
        saveSettings(settings);
      } catch {
        // Keep the original failure while restoring the live thread below.
      }
      await Promise.allSettled([
        ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: previousPackSetting }),
        ctx.state.session.thread.setSetting({ key: THREAD_FALLBACK_STATUS_KEY, value: previousFallbackStatus }),
        ctx.state.session.thread.setSetting({ key: MODEL_FALLBACK_STATE_KEY, value: previousPendingFallback }),
        ctx.state.session.thread.setSetting({
          key: 'subagentModelId_explore',
          value: previousSessionState.subagentModelId_explore,
        }),
        ctx.state.session.thread.setSetting({
          key: 'subagentModelId_plan',
          value: previousSessionState.subagentModelId_plan,
        }),
        ctx.state.session.thread.setSetting({
          key: 'subagentModelId_execute',
          value: previousSessionState.subagentModelId_execute,
        }),
        ctx.state.session.thread.setSetting({ key: 'observerModelId', value: previousSessionState.observerModelId }),
        ctx.state.session.thread.setSetting({ key: 'reflectorModelId', value: previousSessionState.reflectorModelId }),
        ctx.state.session.model.switch({ modelId: previousModelId }),
        ctx.state.session.state.set({
          modelRoute: previousSessionState.modelRoute,
          [MODEL_FALLBACK_STATE_KEY]: previousSessionState[MODEL_FALLBACK_STATE_KEY] ?? null,
          subagentModelId_explore: previousSessionState.subagentModelId_explore,
          subagentModelId_plan: previousSessionState.subagentModelId_plan,
          subagentModelId_execute: previousSessionState.subagentModelId_execute,
          observerModelId: previousSessionState.observerModelId,
          reflectorModelId: previousSessionState.reflectorModelId,
        }),
      ]);
      ctx.state.fallbackStatus = previousFallbackUi;
      ctx.updateStatusLine();
    },
  });
}

export async function handleModelCommand(ctx: SlashCommandContext): Promise<void> {
  try {
    if (ctx.state.pendingNewThread) {
      await ctx.state.session.thread.create();
      ctx.state.pendingNewThread = false;
    }

    const models = await ctx.state.controller.listAvailableModels();
    const currentModelId = ctx.state.session.model.get();
    const connected = models.filter(model => model.hasApiKey || model.id === currentModelId);
    if (connected.length === 0) {
      ctx.showInfo('No connected models. Use /connect to add a provider account or API key.');
      return;
    }

    const settings = loadSettings();
    const threadId = ctx.state.session.thread.getId?.();
    const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
    const activePackId = parseThreadSettings(thread?.metadata).activeModelPackId ?? settings.models.activeModelPackId;
    const builtinPack = activePackId ? getBuiltinModePack(activePackId) : undefined;
    const selectableModels = builtinPack
      ? connected.filter(model => model.provider === builtinPack.providerId)
      : connected;
    if (selectableModels.length === 0) {
      ctx.showInfo(`No connected ${builtinPack?.name ?? ''} models are available.`.replace('  ', ' '));
      return;
    }

    return new Promise<void>(resolve => {
      const selector = new ModelSelectorComponent({
        tui: ctx.state.ui,
        models: selectableModels,
        currentModelId,
        title: builtinPack ? `Select ${builtinPack.name} Model` : undefined,
        onSelect: async (model: ModelItem) => {
          ctx.state.ui.hideOverlay();
          try {
            if (builtinPack && model.provider !== builtinPack.providerId) {
              ctx.showInfo(
                `The ${builtinPack.name} pack only accepts ${builtinPack.name} models. Create a custom pack with /models to mix providers.`,
              );
              return;
            }
            const apiKeyResult = await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
            if (apiKeyResult === 'cancelled') return;
            ctx.state.controller.invalidateAvailableModelsCache();
            await switchCurrentModeModel(ctx, model.id);
          } catch (error) {
            ctx.showError(`Failed to switch model: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            resolve();
          }
        },
        onCancel: () => {
          ctx.state.ui.hideOverlay();
          resolve();
        },
      });

      showModalOverlay(ctx.state.ui, selector, { maxHeight: '75%' });
      selector.focused = true;
    });
  } catch (error) {
    ctx.showError(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
  }
}
