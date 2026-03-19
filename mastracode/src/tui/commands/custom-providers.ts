import { Spacer } from '@mariozechner/pi-tui';
import { getCustomProviderId, loadSettings, saveSettings, toCustomProviderModelId } from '../../onboarding/settings.js';
import type { CustomProviderSetting, GlobalSettings } from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeProvider(input: CustomProviderSetting): CustomProviderSetting {
  return {
    name: input.name.trim(),
    url: input.url.trim(),
    apiKey: input.apiKey?.trim() || undefined,
    models: [...new Set(input.models.map(model => model.trim()).filter(Boolean))],
  };
}

export function upsertCustomProviderInSettings(
  settings: GlobalSettings,
  provider: CustomProviderSetting,
  previousProviderId?: string,
): void {
  const next = normalizeProvider(provider);
  const nextProviderId = getCustomProviderId(next.name);
  const filteredProviders = settings.customProviders.filter(existing => {
    const id = getCustomProviderId(existing.name);
    return id !== nextProviderId && (!previousProviderId || id !== previousProviderId);
  });
  settings.customProviders = [...filteredProviders, next];
}

export function removeCustomProviderFromSettings(settings: GlobalSettings, providerId: string): void {
  settings.customProviders = settings.customProviders.filter(
    provider => getCustomProviderId(provider.name) !== providerId,
  );
}

export function addModelToCustomProviderInSettings(
  settings: GlobalSettings,
  providerId: string,
  modelName: string,
): boolean {
  const trimmed = modelName.trim();
  if (!trimmed) return false;
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) return false;
  provider.models = [...new Set([...provider.models, trimmed])];
  return true;
}

export function removeModelFromCustomProviderInSettings(
  settings: GlobalSettings,
  providerId: string,
  modelName: string,
): boolean {
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) return false;
  const before = provider.models.length;
  provider.models = provider.models.filter(model => model !== modelName);
  return provider.models.length < before;
}

function askText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
  allowEmptyInput = false,
): Promise<string | null> {
  return new Promise(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        allowEmptyInput,
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          const trimmed = answer.trim();
          resolve(trimmed.length > 0 ? trimmed : null);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    if (defaultValue) {
      (component as any).input?.setValue?.(defaultValue);
    }

    ctx.state.activeInlineQuestion = component;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(component);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

async function askOptionalText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
): Promise<string | undefined> {
  const answer = await askText(ctx, `${question} (leave blank to skip)`, defaultValue, true);
  return answer?.trim() || undefined;
}

function askSelect(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; value: string; description?: string }>,
): Promise<string | null> {
  return new Promise(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        options: options.map(option => ({ label: option.label, description: option.description })),
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          const selected = options.find(option => option.label === answer);
          resolve(selected?.value ?? null);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = component;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(component);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

async function createProviderFlow(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const name = await askText(ctx, 'Custom provider name');
  if (!name) return;

  const providerId = getCustomProviderId(name);
  if (settings.customProviders.some(provider => getCustomProviderId(provider.name) === providerId)) {
    ctx.showError(`Provider already exists: ${name}`);
    return;
  }

  const url = await askText(ctx, 'Base URL (OpenAI-compatible endpoint)');
  if (!url) return;
  if (!isValidUrl(url)) {
    ctx.showError('Invalid URL. Use a full http(s) URL.');
    return;
  }

  const apiKey = await askOptionalText(ctx, 'API key');
  upsertCustomProviderInSettings(settings, { name, url, apiKey, models: [] });
  saveSettings(settings);
  ctx.showInfo(`Added custom provider: ${name}`);

  await manageProviderFlow(ctx, providerId);
}

async function editProviderFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return;
  }

  const name = await askText(ctx, 'Provider name', provider.name);
  if (!name) return;
  const nextProviderId = getCustomProviderId(name);
  if (
    nextProviderId !== providerId &&
    settings.customProviders.some(entry => getCustomProviderId(entry.name) === nextProviderId)
  ) {
    ctx.showError(`Provider already exists: ${name}`);
    return;
  }

  const url = await askText(ctx, 'Base URL', provider.url);
  if (!url) return;
  if (!isValidUrl(url)) {
    ctx.showError('Invalid URL. Use a full http(s) URL.');
    return;
  }

  const apiKey = await askOptionalText(ctx, 'API key', provider.apiKey);
  upsertCustomProviderInSettings(
    settings,
    {
      ...provider,
      name,
      url,
      apiKey,
    },
    providerId,
  );
  saveSettings(settings);
  ctx.showInfo(`Updated custom provider: ${name}`);
}

async function addProviderModelFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return;
  }

  const modelName = await askText(ctx, `Model ID for ${provider.name}`);
  if (!modelName) return;
  const added = addModelToCustomProviderInSettings(settings, providerId, modelName);
  if (!added) {
    ctx.showError('Unable to add model to provider.');
    return;
  }

  saveSettings(settings);
  ctx.showInfo(`Added model: ${toCustomProviderModelId(provider.name, modelName)}`);
}

async function removeProviderModelFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return;
  }
  if (provider.models.length === 0) {
    ctx.showInfo(`No custom models configured for ${provider.name}.`);
    return;
  }

  const modelName = await askSelect(
    ctx,
    `Remove model from ${provider.name}`,
    provider.models.map(model => ({
      label: model,
      value: model,
      description: toCustomProviderModelId(provider.name, model),
    })),
  );

  if (!modelName) return;

  const removed = removeModelFromCustomProviderInSettings(settings, providerId, modelName);
  if (!removed) {
    ctx.showError('Unable to remove model from provider.');
    return;
  }

  saveSettings(settings);
  ctx.showInfo(`Removed model: ${toCustomProviderModelId(provider.name, modelName)}`);
}

async function manageProviderFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return;
  }

  const action = await askSelect(ctx, `Manage provider: ${provider.name}`, [
    { label: 'Add model', value: 'add-model', description: 'Attach a model ID to this provider' },
    { label: 'Remove model', value: 'remove-model', description: 'Remove a model ID from this provider' },
    { label: 'Edit provider', value: 'edit-provider', description: 'Rename, change URL, or update API key' },
    { label: 'Delete provider', value: 'delete-provider', description: 'Remove provider and all its model IDs' },
  ]);

  switch (action) {
    case 'add-model':
      await addProviderModelFlow(ctx, providerId);
      break;
    case 'remove-model':
      await removeProviderModelFlow(ctx, providerId);
      break;
    case 'edit-provider':
      await editProviderFlow(ctx, providerId);
      break;
    case 'delete-provider': {
      const confirm = await askSelect(ctx, `Delete ${provider.name}?`, [
        { label: 'Delete', value: 'delete', description: 'This cannot be undone' },
      ]);
      if (confirm !== 'delete') return;
      const latest = loadSettings();
      removeCustomProviderFromSettings(latest, providerId);
      saveSettings(latest);
      ctx.showInfo(`Deleted custom provider: ${provider.name}`);
      break;
    }
    default:
      break;
  }
}

export async function handleCustomProvidersCommand(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const providerOptions = settings.customProviders.map(provider => {
    const providerId = getCustomProviderId(provider.name);
    const modelCount = provider.models.length;
    return {
      label: provider.name,
      value: providerId,
      description: `${provider.url} · ${modelCount} model${modelCount === 1 ? '' : 's'} · ${provider.apiKey ? 'api key set' : 'no api key'}`,
    };
  });

  const action = await askSelect(ctx, 'Custom providers', [
    { label: 'Add provider', value: 'add-provider', description: 'Create an OpenAI-compatible provider' },
    ...providerOptions,
  ]);

  if (!action) return;
  if (action === 'add-provider') {
    await createProviderFlow(ctx);
    return;
  }

  await manageProviderFlow(ctx, action);
}
