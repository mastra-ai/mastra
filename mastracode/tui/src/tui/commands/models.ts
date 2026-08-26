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
  const settings = loadSettings();
  const modelId = stripMastraCodeCustomProviderPrefix(selectedModelId, settings.customProviders);

  await ctx.state.session.model.switch({ modelId });
  await ctx.state.session.thread.setSetting({ key: `modeModelId_${modeId}`, value: modelId });

  const mode = ctx.state.controller.listModes().find(item => item.id === modeId);
  if (mode) (mode as { defaultModelId?: string }).defaultModelId = modelId;

  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(item => item.id === threadId) : undefined;
  const threadPackId = thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY];
  const activePackId = typeof threadPackId === 'string' ? threadPackId : settings.models.activeModelPackId;

  const modeModels: Record<string, string> = {};
  for (const item of ctx.state.controller.listModes()) {
    if (item.defaultModelId) modeModels[item.id] = item.defaultModelId;
  }
  modeModels[modeId] = modelId;

  const customPackId = activePackId?.startsWith('custom:') ? activePackId : 'custom:Custom';
  const customName = customPackId.slice('custom:'.length);
  const existingPack = settings.customModelPacks.find(item => item.name === customName);
  if (existingPack) {
    existingPack.models = { ...existingPack.models, ...modeModels };
  } else {
    settings.customModelPacks.push({ name: customName, models: modeModels, createdAt: new Date().toISOString() });
  }

  settings.models.activeModelPackId = customPackId;
  settings.models.modeDefaults = modeModels;
  await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: customPackId });
  saveSettings(settings);

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
        await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
        ctx.state.controller.invalidateAvailableModelsCache();
        await switchCurrentModeModel(ctx, model.id);
        resolve();
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
