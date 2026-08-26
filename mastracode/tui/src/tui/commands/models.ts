import {
  loadSettings,
  saveSettings,
  stripMastraCodeCustomProviderPrefix,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { showModalOverlay } from '../overlay.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import type { SlashCommandContext } from './types.js';

async function switchCurrentModeModel(ctx: SlashCommandContext, selectedModelId: string): Promise<void> {
  const modeId = ctx.state.session.mode.get();
  const modeSettingKey = `modeModelId_${modeId}`;
  const settings = loadSettings();
  const nextSettings = structuredClone(settings);
  const modelId = stripMastraCodeCustomProviderPrefix(selectedModelId, settings.customProviders);
  const previousModelId = ctx.state.session.model.get();

  const modes = ctx.state.controller.listModes();
  const mode = modes.find(item => item.id === modeId);
  const previousDefaultModelId = mode?.defaultModelId;

  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
  const previousModeSetting = thread?.metadata?.[modeSettingKey];
  const previousPackSetting = thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY];
  const activePackId =
    typeof previousPackSetting === 'string' ? previousPackSetting : nextSettings.models.activeModelPackId;

  const modeModels: Record<string, string> = {};
  for (const item of modes) {
    if (item.defaultModelId) modeModels[item.id] = item.defaultModelId;
  }
  modeModels[modeId] = modelId;

  const customPackId = activePackId?.startsWith('custom:') ? activePackId : 'custom:Custom';
  const customName = customPackId.slice('custom:'.length);
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
  nextSettings.models.activeModelPackId = customPackId;
  nextSettings.models.modeDefaults = modeModels;

  let modeSettingSaved = false;
  let packSettingSaved = false;
  let globalSettingsWriteStarted = false;
  try {
    await ctx.state.session.thread.setSetting({ key: modeSettingKey, value: modelId });
    modeSettingSaved = true;
    const savedModeSetting = await ctx.state.session.thread.getSetting({ key: modeSettingKey });
    if (savedModeSetting !== modelId) throw new Error(`Could not save the ${modeId} mode model`);

    await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: customPackId });
    packSettingSaved = true;
    const savedPackSetting = await ctx.state.session.thread.getSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY });
    if (savedPackSetting !== customPackId) throw new Error('Could not save the active model pack');
    globalSettingsWriteStarted = true;
    saveSettings(nextSettings);
    await ctx.state.session.model.switch({ modelId, scope: 'global' });
    if (mode) (mode as { defaultModelId?: string }).defaultModelId = modelId;
  } catch (error) {
    if (globalSettingsWriteStarted) {
      try {
        saveSettings(settings);
      } catch {
        // Keep the original failure. The thread and active model still roll back below.
      }
    }

    const rollbacks: Array<Promise<unknown>> = [];
    if (packSettingSaved) {
      rollbacks.push(
        ctx.state.session.thread.setSetting({
          key: THREAD_ACTIVE_MODEL_PACK_ID_KEY,
          value: previousPackSetting,
        }),
      );
    }
    if (modeSettingSaved) {
      rollbacks.push(ctx.state.session.thread.setSetting({ key: modeSettingKey, value: previousModeSetting }));
    }
    if (ctx.state.session.model.get() !== previousModelId) {
      rollbacks.push(ctx.state.session.model.switch({ modelId: previousModelId, scope: 'global' }));
    }
    await Promise.allSettled(rollbacks);
    if (mode) (mode as { defaultModelId?: string }).defaultModelId = previousDefaultModelId;
    throw error;
  }

  ctx.updateStatusLine();
  ctx.showInfo(`Switched ${modeId} mode to ${modelId}`);
}

export async function handleModelCommand(ctx: SlashCommandContext): Promise<void> {
  const models = await ctx.state.controller.listAvailableModels();
  const currentModelId = ctx.state.session.model.get();
  const connected = models.filter(model => model.hasApiKey || model.id === currentModelId);
  if (connected.length === 0) {
    ctx.showInfo('No connected models. Use /login or /api-keys to add a provider.');
    return;
  }

  return new Promise<void>(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: connected,
      currentModelId,
      onSelect: async (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
        try {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
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
}
