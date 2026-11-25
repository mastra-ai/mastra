import { listCustomProviderModels } from '@mastra/code-sdk/agents/custom-provider-check';
import type {
  CustomProviderCheckFailure,
  CustomProviderCheckOptions,
  CustomProviderConnection,
  CustomProviderModelsResult,
} from '@mastra/code-sdk/agents/custom-provider-check';
import {
  CONTROL_CHARACTER_PATTERN,
  customProviderHeaderProblem,
} from '@mastra/code-sdk/onboarding/custom-provider-headers';
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
  CustomProviderSetting,
  GlobalSettings,
} from '@mastra/code-sdk/onboarding/settings';
import { showProgress } from '../display.js';
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
 * The model IDs from an endpoint's list that are worth offering to add.
 *
 * IDs are read the way `parseCustomProviders` reads saved models: trimmed, and
 * with a leading `<providerId>/` removed. Otherwise `acme/foo` would be saved,
 * read back as `foo`, and offered again forever. IDs already configured are
 * left out, and so are IDs equal to a label in `reservedLabels`, because the
 * menu matches picks by label and such an ID would trigger that action.
 */
export function endpointModelsToOffer(
  listed: readonly string[],
  provider: Pick<CustomProviderSetting, 'name' | 'models'>,
  reservedLabels: readonly string[],
): string[] {
  const providerPrefix = `${getCustomProviderId(provider.name)}/`;
  const offered = listed
    .map(model => model.trim())
    .map(model => (model.startsWith(providerPrefix) ? model.slice(providerPrefix.length) : model))
    .filter(model => model.length > 0 && !provider.models.includes(model) && !reservedLabels.includes(model));
  return [...new Set(offered)];
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

/**
 * Ask for one line of text and return it trimmed, or null when it is empty or
 * the user cancels. `masked` hides the typed text, for secrets.
 */
async function askText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
  allowEmptyInput = false,
  masked = false,
): Promise<string | null> {
  const answer = await askModalQuestion(ctx.state.ui, { question, defaultValue, allowEmptyInput, masked });
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

/**
 * Ask the user to pick one option and return its value, or null on Esc.
 * `selectedLabel` starts the cursor on that option instead of the first one.
 */
async function askSelect(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; value: string; description?: string }>,
  selectedLabel?: string,
): Promise<string | null> {
  const answer = await askModalQuestion(ctx.state.ui, {
    question,
    options: options.map(option => ({ label: option.label, description: option.description })),
    selectedOptionLabel: selectedLabel,
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

/**
 * Rename a provider or change its URL or API key. Secret headers are dropped
 * when the new URL has another origin, see {@link headersForCustomProviderUrlChange}.
 * The rule lives here and not in `upsertCustomProviderInSettings`, which other
 * callers use as a plain upsert.
 */
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
  const { kept, removed } = headersForCustomProviderUrlChange(provider.headers ?? [], provider.url, url);
  upsertCustomProviderInSettings(
    settings,
    {
      ...provider,
      name,
      url,
      apiKey,
      headers: kept,
    },
    providerId,
  );
  saveSettings(settings);
  ctx.showInfo(`Updated custom provider: ${name}`);
  if (removed.length > 0) {
    const names = removed.map(header => header.name).join(', ');
    ctx.showInfo(
      removed.length === 1
        ? `Removed secret header ${names} because the base URL moved to another origin. Add it again under Headers.`
        : `Removed secret headers ${names} because the base URL moved to another origin. Add them again under Headers.`,
    );
  }
}

/** Ask for one model ID and add it to the provider. */
async function typeModelIdFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
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

/** The connection a check uses: the provider exactly as saved. */
function savedConnection(provider: CustomProviderSetting): CustomProviderConnection {
  return { url: provider.url, apiKey: provider.apiKey, authScheme: provider.authScheme, headers: provider.headers };
}

const CONTROL_CHARACTERS = new RegExp(`${CONTROL_CHARACTER_PATTERN.source}+`, 'g');

/**
 * Text that came from an endpoint, made safe to print on one line. Escape
 * sequences in it would act on the terminal instead of being shown, and line
 * breaks would split one message across several rows.
 */
function printableText(text: string): string {
  return text.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Show a failed check as the SDK reports it, with the upstream detail on its
 * own line. The SDK already cleans both, and cleaning again here keeps the
 * terminal safe if that ever changes.
 */
function showCheckFailure(ctx: SlashCommandContext, failure: CustomProviderCheckFailure): void {
  const message = printableText(failure.message);
  const detail = failure.detail ? printableText(failure.detail) : '';
  ctx.showError(detail ? `${message}\n${detail}` : message);
}

/** The "Add header" action value, prefixed with NUL so no header name can equal it. */
const ADD_HEADER = '\u0000add-header';

/**
 * Labels of the actions in the "Add model" picker. The picker matches answers
 * by label, so a listed model ID equal to one of them is not offered.
 */
const ADD_ALL_LABEL = 'Add all';
const DONE_LABEL = 'Done';
const RESERVED_MODEL_LABELS = [ADD_ALL_LABEL, DONE_LABEL];

/** `1 model` or `N models`. */
function modelCount(count: number): string {
  return `${count} model${count === 1 ? '' : 's'}`;
}

/** Load the saved provider, or tell the user it is gone and return undefined. */
function loadProvider(
  ctx: SlashCommandContext,
  providerId: string,
): { settings: GlobalSettings; provider: CustomProviderSetting } | undefined {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return undefined;
  }
  return { settings, provider };
}

/** Ask the endpoint for its model list, with a spinner labelled `progressLabel` while the call runs. */
async function listModelsWithProgress(
  ctx: SlashCommandContext,
  provider: CustomProviderSetting,
  progressLabel: string,
  options: CustomProviderCheckOptions = {},
): Promise<CustomProviderModelsResult> {
  const stopProgress = showProgress(ctx.state, progressLabel);
  try {
    return await listCustomProviderModels(savedConnection(provider), options);
  } finally {
    stopProgress();
  }
}

/** Call the endpoint's model list and show the model count and latency, or the failure. */
async function testConnectionFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const loaded = loadProvider(ctx, providerId);
  if (!loaded) return;
  const result = await listModelsWithProgress(ctx, loaded.provider, `Testing connection to ${loaded.provider.url}`);
  if (!result.ok) {
    showCheckFailure(ctx, result.failure);
    return;
  }
  ctx.showInfo(
    `${loaded.provider.name} answered in ${result.latencyMs} ms and lists ${modelCount(result.models.length)}.`,
  );
}

/** How long "Add model" waits for the endpoint's model list before asking for a typed ID. */
const ADD_MODEL_LIST_TIMEOUT_MS = 3_000;

/**
 * Add model IDs to a provider. When the endpoint lists models that are not
 * configured yet, they are offered in a picker, and its "Custom response" row
 * takes a typed ID. Picking one adds it and shows the rest again. When the
 * list call fails, times out or offers nothing new, the user types the ID with
 * no error shown: "Test connection" is where the reason is shown.
 */
async function addProviderModelFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const loaded = loadProvider(ctx, providerId);
  if (!loaded) return;
  const listed = await listModelsWithProgress(ctx, loaded.provider, `Listing models from ${loaded.provider.url}`, {
    timeoutMs: ADD_MODEL_LIST_TIMEOUT_MS,
  });
  const listedModels = listed.ok ? listed.models : [];
  if (endpointModelsToOffer(listedModels, loaded.provider, RESERVED_MODEL_LABELS).length === 0) {
    await typeModelIdFlow(ctx, providerId);
    return;
  }

  let cursorLabel: string | undefined;
  for (;;) {
    // Settings are read again each round, so a model added on the last round is not offered twice.
    const current = loadProvider(ctx, providerId);
    if (!current) return;
    const { provider } = current;
    const available = endpointModelsToOffer(listedModels, provider, RESERVED_MODEL_LABELS);
    if (available.length === 0) return;

    const answer = await askModalQuestion(ctx.state.ui, {
      question: `Add a model to ${provider.name}`,
      options: [
        { label: ADD_ALL_LABEL, description: `Add the ${modelCount(available.length)} below` },
        { label: DONE_LABEL, description: 'Stop adding models' },
        ...available.map(model => ({ label: model })),
      ],
      allowCustomResponse: true,
      selectedOptionLabel: cursorLabel,
    });
    // An answer that matches no option label was typed through the "Custom response" row.
    const choice = answer?.trim();
    if (!choice || choice === DONE_LABEL) return;

    const picked = choice === ADD_ALL_LABEL ? available : [choice];
    // Read settings again: the list stayed open while another process may have
    // renamed or deleted the provider, or added some of these models already.
    const latest = loadProvider(ctx, providerId);
    if (!latest) return;
    const added = addModelsToCustomProviderInSettings(latest.settings, providerId, picked);
    if (added > 0) saveSettings(latest.settings);
    if (choice === ADD_ALL_LABEL) {
      ctx.showInfo(
        added > 0
          ? `Added ${modelCount(added)} to ${provider.name}.`
          : `No models added: ${provider.name} already has every listed model.`,
      );
      return;
    }
    ctx.showInfo(
      added > 0
        ? `Added model: ${toCustomProviderModelId(provider.name, choice)}`
        : `No model added: ${provider.name} already has ${choice}.`,
    );
    // Keep the cursor where the user was: on the model that followed the one just added,
    // or the one before it when the last model was picked. A typed ID leaves it in place.
    const index = available.indexOf(choice);
    if (index >= 0) cursorLabel = available[index + 1] ?? available[index - 1];
  }
}

/** How a header value appears in lists. Secret values are never shown. */
function shownHeaderValue(header: CustomProviderHeader): string {
  return header.secret === false ? header.value : '••••';
}

/**
 * List a provider's headers, add one, or remove one. The list is shown again
 * after each change until the user leaves with Esc.
 */
async function headersFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  for (;;) {
    const loaded = loadProvider(ctx, providerId);
    if (!loaded) return;
    const { provider } = loaded;
    const headers = provider.headers ?? [];

    const choice = await askSelect(ctx, `Headers for ${provider.name}`, [
      { label: 'Add header', value: ADD_HEADER, description: 'Send an extra header on every call' },
      ...headers.map(header => ({ label: header.name, value: header.name, description: shownHeaderValue(header) })),
    ]);
    if (!choice) return;
    if (choice === ADD_HEADER) {
      // The list would open over a refusal message, so leave the list instead to keep it readable.
      if ((await addHeaderFlow(ctx, providerId)) === 'refused') return;
      continue;
    }

    const confirm = await askSelect(ctx, `Remove the ${choice} header?`, [
      { label: 'Remove', value: 'remove', description: `Stop sending ${choice} to ${provider.name}` },
    ]);
    if (confirm !== 'remove') continue;
    const latest = loadSettings();
    if (removeHeaderFromCustomProviderInSettings(latest, providerId, choice)) {
      saveSettings(latest);
      ctx.showInfo(`Removed header: ${choice}`);
    }
  }
}

/**
 * Ask for a header name, secret flag and value, then save the header.
 * The flag comes before the value so a secret value is typed into a masked input.
 * Returns whether the header was added, refused, or the user cancelled.
 */
async function addHeaderFlow(ctx: SlashCommandContext, providerId: string): Promise<'added' | 'refused' | 'cancelled'> {
  const loaded = loadProvider(ctx, providerId);
  if (!loaded) return 'refused';
  const { provider } = loaded;

  const name = await askText(ctx, 'Header name');
  if (!name) return 'cancelled';
  // Check the name before asking for the value, so a refused name does not cost the user a typed secret.
  const nameProblem = customProviderHeaderProblem([...(provider.headers ?? []), { name }], provider.authScheme);
  if (nameProblem) {
    ctx.showError(nameProblem);
    return 'refused';
  }

  const visibility = await askSelect(ctx, `Is ${name} a secret?`, [
    { label: 'Secret', value: 'secret', description: 'Hide the value while typing and in lists' },
    { label: 'Plain', value: 'plain', description: 'Show the value in lists' },
  ]);
  if (!visibility) return 'cancelled';
  const value = await askText(ctx, `Value for ${name}`, undefined, false, visibility === 'secret');
  if (!value) return 'cancelled';

  const settings = loadSettings();
  const problem = addHeaderToCustomProviderInSettings(settings, providerId, {
    name,
    value,
    secret: visibility === 'secret',
  });
  if (problem) {
    ctx.showError(problem);
    return 'refused';
  }
  saveSettings(settings);
  ctx.showInfo(`Added header: ${name}`);
  return 'added';
}

const AUTH_SCHEME_OPTIONS: Array<{
  label: string;
  value: CustomProviderAuthScheme;
  description: string;
  header: string;
}> = [
  {
    label: 'Bearer token',
    value: 'bearer',
    description: 'Send the API key as Authorization: Bearer <key>',
    header: 'Authorization: Bearer <key>',
  },
  {
    label: 'x-api-key header',
    value: 'x-api-key',
    description: 'Send the API key as x-api-key: <key>',
    header: 'x-api-key: <key>',
  },
];

/** Choose how the provider sends its API key. */
async function authSchemeFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const loaded = loadProvider(ctx, providerId);
  if (!loaded) return;
  const { provider } = loaded;
  const current = AUTH_SCHEME_OPTIONS.find(option => option.value === (provider.authScheme ?? 'bearer'));

  const choice = await askSelect(ctx, `Auth scheme for ${provider.name}`, AUTH_SCHEME_OPTIONS, current?.label);
  const option = AUTH_SCHEME_OPTIONS.find(entry => entry.value === choice);
  if (!option) return;

  // Read settings again: the menu stayed open while another process may have saved changes.
  const settings = loadSettings();
  const problem = setCustomProviderAuthSchemeInSettings(settings, providerId, option.value);
  if (problem) {
    ctx.showError(problem);
    return;
  }
  saveSettings(settings);
  ctx.showInfo(`${provider.name} now sends its API key as ${option.header}.`);
}

/**
 * The menu for one saved provider. New items are appended at the end so an
 * existing item keeps its position for anyone who reaches it by arrow count.
 */
async function manageProviderFlow(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const settings = loadSettings();
  const provider = settings.customProviders.find(entry => getCustomProviderId(entry.name) === providerId);
  if (!provider) {
    ctx.showError('Provider not found.');
    return;
  }

  const action = await askSelect(ctx, `Manage provider: ${provider.name}`, [
    { label: 'Add model', value: 'add-model', description: 'Pick a model the endpoint lists or type a model ID' },
    { label: 'Remove model', value: 'remove-model', description: 'Remove a model ID from this provider' },
    { label: 'Edit provider', value: 'edit-provider', description: 'Rename, change URL, or update API key' },
    { label: 'Delete provider', value: 'delete-provider', description: 'Remove provider and all its model IDs' },
    { label: 'Test connection', value: 'test-connection', description: 'Ask the endpoint for its model list' },
    { label: 'Headers', value: 'headers', description: 'Add or remove headers sent on every call' },
    { label: 'Auth scheme', value: 'auth-scheme', description: 'Choose how the API key is sent' },
  ]);

  switch (action) {
    case 'test-connection':
      await testConnectionFlow(ctx, providerId);
      break;
    case 'headers':
      await headersFlow(ctx, providerId);
      break;
    case 'auth-scheme':
      await authSchemeFlow(ctx, providerId);
      break;
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
