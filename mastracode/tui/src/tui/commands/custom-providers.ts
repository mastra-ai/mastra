import { customProviderHeaderProblem } from '@mastra/code-sdk/onboarding/custom-provider-headers';
import {
  removeCustomProviderFromSettings,
  upsertCustomProviderInSettings,
} from '@mastra/code-sdk/onboarding/custom-providers';
import {
  getCustomProviderId,
  loadSettings,
  saveSettings,
  toCustomProviderModelId,
} from '@mastra/code-sdk/onboarding/settings';
import type {
  CustomProviderAuthScheme,
  CustomProviderHeader,
  GlobalSettings,
} from '@mastra/code-sdk/onboarding/settings';
import { askModalQuestion } from '../modal-question.js';
import type { SlashCommandContext } from './types.js';

// Re-exported for existing importers/tests; the implementations live in
// onboarding/custom-providers.ts so non-TUI surfaces (web routes) can share them.
export { removeCustomProviderFromSettings, upsertCustomProviderInSettings };

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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

/**
 * Add several model ids to a provider at once and return how many were new.
 * Ids already configured and blank ids are skipped.
 */
export function addModelsToCustomProviderInSettings(
  settings: GlobalSettings,
  providerId: string,
  modelNames: readonly string[],
): number {
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) return 0;
  const before = provider.models.length;
  provider.models = [...new Set([...provider.models, ...modelNames.map(model => model.trim()).filter(Boolean)])];
  return provider.models.length - before;
}

/**
 * Change how a provider sends its API key. Returns why the change is refused,
 * or undefined once it is applied. A saved custom header may already use the
 * header the new scheme writes, so the headers are checked against it first.
 */
export function setCustomProviderAuthSchemeInSettings(
  settings: GlobalSettings,
  providerId: string,
  authScheme: CustomProviderAuthScheme,
): string | undefined {
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) return 'Provider not found.';
  const problem = customProviderHeaderProblem(provider.headers ?? [], authScheme);
  if (problem) return problem;
  provider.authScheme = authScheme;
  return undefined;
}

/**
 * Add a custom header to a provider. Returns why the header is refused, or
 * undefined once it is added.
 */
export function addHeaderToCustomProviderInSettings(
  settings: GlobalSettings,
  providerId: string,
  header: CustomProviderHeader,
): string | undefined {
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) return 'Provider not found.';
  const next = { name: header.name.trim(), value: header.value.trim(), secret: header.secret ?? true };
  const headers = [...(provider.headers ?? []), next];
  const problem = customProviderHeaderProblem(headers, provider.authScheme);
  if (problem) return problem;
  provider.headers = headers;
  return undefined;
}

/** Remove a custom header from a provider by name, ignoring case. Returns whether one was removed. */
export function removeHeaderFromCustomProviderInSettings(
  settings: GlobalSettings,
  providerId: string,
  headerName: string,
): boolean {
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider?.headers) return false;
  const before = provider.headers.length;
  provider.headers = provider.headers.filter(header => header.name.toLowerCase() !== headerName.toLowerCase());
  return provider.headers.length < before;
}

/** The origin of a URL, or the URL itself when it does not parse. */
function urlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Split a provider's headers for an edit that moves it from `previousUrl` to
 * `nextUrl`. A saved secret is never sent to a new origin unless the user
 * types it again, so secret headers are dropped when the origin changes.
 * A header saved without a `secret` flag counts as secret.
 */
export function headersForCustomProviderUrlChange(
  headers: readonly CustomProviderHeader[],
  previousUrl: string,
  nextUrl: string,
): { kept: CustomProviderHeader[]; removed: CustomProviderHeader[] } {
  if (urlOrigin(previousUrl) === urlOrigin(nextUrl)) return { kept: [...headers], removed: [] };
  return {
    kept: headers.filter(header => header.secret === false),
    removed: headers.filter(header => header.secret !== false),
  };
}

async function askText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
  allowEmptyInput = false,
): Promise<string | null> {
  const answer = await askModalQuestion(ctx.state.ui, { question, defaultValue, allowEmptyInput });
  const trimmed = answer?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

async function askOptionalText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
): Promise<string | undefined> {
  const answer = await askText(ctx, `${question} (leave blank to skip)`, defaultValue, true);
  return answer?.trim() || undefined;
}

async function askSelect(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; value: string; description?: string }>,
): Promise<string | null> {
  const answer = await askModalQuestion(ctx.state.ui, {
    question,
    options: options.map(option => ({ label: option.label, description: option.description })),
  });
  const selected = options.find(option => option.label === answer);
  return selected?.value ?? null;
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
