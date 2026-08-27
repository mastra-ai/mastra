import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';

import { setClipboardText } from '@mastra/code-sdk/clipboard/index';
import { removeCustomPackFromSettings } from '@mastra/code-sdk/onboarding/custom-packs';
import type { ModePack, ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import { getAvailableModePacks, getBuiltinModePack } from '@mastra/code-sdk/onboarding/packs';
import {
  loadSettings,
  resolveDefaultThinkingLevel,
  resolveModePackModels,
  resolveThreadActiveModelPackId,
  saveSettings,
  stripMastraCodeCustomProviderPrefix,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import type { GlobalSettings } from '@mastra/code-sdk/onboarding/settings';
import chalk from 'chalk';
import { AskQuestionDialogComponent } from '../components/ask-question-dialog.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { showModalOverlay } from '../overlay.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import { updateStatusLine } from '../status-line.js';
import { getSelectListTheme, mastra, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

// Re-exported for existing importers/tests; the implementation lives in
// onboarding/custom-packs.ts so non-TUI surfaces (web routes) can share it.
export { removeCustomPackFromSettings };

// ---------------------------------------------------------------------------
// Pack sharing — serialize/deserialize
// ---------------------------------------------------------------------------

const SHARE_PREFIX = 'mastra-pack:';

interface SharedPackPayload {
  name: string;
  models: { build: string; plan: string; fast: string };
}

export function serializePack(pack: ModePack): string {
  const payload: SharedPackPayload = {
    name: pack.name,
    models: { build: pack.models.build, plan: pack.models.plan, fast: pack.models.fast },
  };
  return SHARE_PREFIX + Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

export function deserializePack(input: string): ModePack | null {
  try {
    const trimmed = input.trim();
    if (!trimmed.startsWith(SHARE_PREFIX)) return null;
    const json = Buffer.from(trimmed.slice(SHARE_PREFIX.length), 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as Record<string, unknown>;

    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!name) return null;

    const models = parsed.models as Record<string, unknown> | undefined;
    if (!models || typeof models !== 'object') return null;

    const build = typeof models.build === 'string' ? models.build : '';
    const plan = typeof models.plan === 'string' ? models.plan : '';
    const fast = typeof models.fast === 'string' ? models.fast : '';
    if (!build || !plan || !fast) return null;

    return {
      id: `custom:${name}`,
      name,
      description: 'Imported custom pack',
      models: { build, plan, fast },
    };
  } catch {
    return null;
  }
}

async function selectModel(
  ctx: SlashCommandContext,
  title: string,
  modeColor?: string,
  currentModelId?: string,
): Promise<string | undefined> {
  const availableModels = await ctx.state.controller.listAvailableModels();
  if (availableModels.length === 0) return undefined;

  return new Promise<string | undefined>(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: availableModels,
      currentModelId,
      title,
      titleColor: modeColor,
      onSelect: async (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
        const apiKeyResult = await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
        if (apiKeyResult === 'cancelled') {
          resolve(undefined);
          return;
        }
        ctx.state.controller.invalidateAvailableModelsCache();
        const { customProviders } = loadSettings();
        resolve(stripMastraCodeCustomProviderPrefix(model.id, customProviders));
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(undefined);
      },
    });

    showModalOverlay(ctx.state.ui, selector, { maxHeight: '75%' });
    selector.focused = true;
  });
}

async function askCustomPackName(ctx: SlashCommandContext, defaultName?: string): Promise<string | null> {
  return new Promise(resolve => {
    const question = new AskQuestionDialogComponent({
      question: 'Name this custom pack',
      tui: ctx.state.ui,
      onSubmit: answer => {
        ctx.state.ui.hideOverlay();
        const trimmed = answer.trim();
        resolve(trimmed.length > 0 ? trimmed : null);
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(null);
      },
    });

    if (defaultName) {
      (question as any).input?.setValue?.(defaultName);
    }

    showModalOverlay(ctx.state.ui, question, { maxHeight: '50%' });
    question.focused = true;
  });
}

async function askCustomPackAction(
  ctx: SlashCommandContext,
  pack: ModePack,
): Promise<'activate' | 'edit' | 'share' | 'delete' | null> {
  const actions = [
    { id: 'activate', label: 'Activate', description: 'Use this pack as-is' },
    { id: 'edit', label: 'Edit', description: 'Update this pack' },
    { id: 'share', label: 'Share', description: 'Copy to clipboard' },
    { id: 'delete', label: 'Delete', description: 'Remove this custom pack' },
  ] as const;

  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', `Custom pack: ${pack.name}`)), 0, 0));
    container.addChild(new Spacer(1));

    const items: SelectItem[] = actions.map(action => ({
      value: action.id,
      label: `  ${action.label}  ${theme.fg('dim', action.description)}`,
    }));

    const selectList = new SelectList(items, items.length, getSelectListTheme());
    const detailText = new Text('', 0, 0);
    const detailById: Record<string, string> = {
      activate: getPackDetail(pack),
      edit: theme.fg('dim', '  Edit one setting at a time (Rename, plan, build, fast).'),
      share: theme.fg('dim', '  Copy shareable config to clipboard. Paste it to import elsewhere.'),
      delete: theme.fg('error', '  Permanently removes this custom pack from settings.'),
    };

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    selectList.onSelectionChange = item => {
      detailText.setText(detailById[item.value] ?? '');
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = item => {
      closeOverlay();
      resolve(item.value as 'activate' | 'edit' | 'share' | 'delete');
    };

    selectList.onCancel = () => {
      closeOverlay();
      resolve(null);
    };

    detailText.setText(detailById['activate']!);
    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(detailText);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '75%' });
  });
}

async function askModifiedBuiltinPackAction(
  ctx: SlashCommandContext,
  pack: ModePack,
  builtinPack: ModePack,
): Promise<'activate' | 'reset' | null> {
  const actions = [
    { id: 'activate', label: 'Activate', description: 'Use the modified models' },
    { id: 'reset', label: 'Reset to built-in models', description: 'Remove all overrides' },
  ] as const;

  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('warning', `Modified built-in pack: ${pack.name}`)), 0, 0));
    container.addChild(new Spacer(1));

    const items: SelectItem[] = actions.map(action => ({
      value: action.id,
      label: `  ${action.label}  ${theme.fg('dim', action.description)}`,
    }));
    const selectList = new SelectList(items, items.length, getSelectListTheme());
    const detailText = new Text('', 0, 0);
    const detailById: Record<string, string> = {
      activate: `${theme.fg('warning', '  This built-in pack has model overrides.')}\n${getModifiedPackDetail(pack, builtinPack)}`,
      reset: `${theme.fg('dim', '  Restore the original built-in models:')}\n${getPackDetail(builtinPack)}`,
    };

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    selectList.onSelectionChange = item => {
      detailText.setText(detailById[item.value] ?? '');
      ctx.state.ui.requestRender();
    };
    selectList.onSelect = item => {
      closeOverlay();
      resolve(item.value as 'activate' | 'reset');
    };
    selectList.onCancel = () => {
      closeOverlay();
      resolve(null);
    };

    detailText.setText(detailById.activate!);
    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(detailText);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '75%' });
  });
}

async function askCustomPackEditTarget(
  ctx: SlashCommandContext,
  pack: ModePack,
): Promise<'rename' | 'plan' | 'build' | 'fast' | 'save' | null> {
  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', `Edit custom pack: ${pack.name}`)), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(
      [
        { value: 'rename', label: `  Rename → ${theme.fg('text', pack.name)}` },
        { value: 'plan', label: `  ${chalk.hex(mastra.purple)('plan')} → ${theme.fg('text', pack.models.plan)}` },
        { value: 'build', label: `  ${chalk.hex(mastra.green)('build')} → ${theme.fg('text', pack.models.build)}` },
        { value: 'fast', label: `  ${chalk.hex(mastra.orange)('fast')} → ${theme.fg('text', pack.models.fast)}` },
        { value: 'save', label: `  ${theme.fg('success', 'Save')}` },
      ],
      5,
      getSelectListTheme(),
    );

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = item => {
      closeOverlay();
      resolve(item.value as 'rename' | 'plan' | 'build' | 'fast' | 'save');
    };

    selectList.onCancel = () => {
      closeOverlay();
      resolve(null);
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '75%' });
  });
}

async function runCustomFlow(
  ctx: SlashCommandContext,
  options?: { name?: string; models?: ModePack['models']; skipNamePrompt?: boolean },
): Promise<ModePack | null> {
  const modes: Array<{ id: 'plan' | 'build' | 'fast'; label: string; metadata: { color: string } }> = [
    { id: 'plan', label: 'plan', metadata: { color: mastra.purple } },
    { id: 'build', label: 'build', metadata: { color: mastra.green } },
    { id: 'fast', label: 'fast', metadata: { color: mastra.orange } },
  ];

  const name = options?.skipNamePrompt
    ? options?.name
    : await askCustomPackName(ctx, options?.name && options.name !== 'Custom' ? options.name : undefined);
  if (!name) return null;

  const existing = options?.models ?? { build: '', plan: '', fast: '' };
  const models: Record<string, string> = {
    build: existing.build ?? '',
    plan: existing.plan ?? '',
    fast: existing.fast ?? '',
  };

  for (const mode of modes) {
    const modelId = await selectModel(
      ctx,
      `Select model for ${mode.label} mode`,
      mode.metadata.color,
      models[mode.id] || undefined,
    );
    if (!modelId) return null;
    models[mode.id] = modelId;
  }

  return {
    id: `custom:${name}`,
    name,
    description: 'Saved custom pack',
    models: models as ModePack['models'],
  };
}

async function runCustomPackEditFlow(
  ctx: SlashCommandContext,
  pack: ModePack,
): Promise<{ pack: ModePack; previousPackId?: string } | null> {
  let workingPack: ModePack = { ...pack, models: { ...pack.models } };
  let previousPackId: string | undefined;

  while (true) {
    const editTarget = await askCustomPackEditTarget(ctx, workingPack);
    if (!editTarget) return null;
    if (editTarget === 'save') return { pack: workingPack, previousPackId };

    if (editTarget === 'rename') {
      const renamed = await askCustomPackName(ctx, workingPack.name);
      if (!renamed) continue;
      const renamedPack: ModePack = {
        ...workingPack,
        id: `custom:${renamed}`,
        name: renamed,
      };
      if (renamedPack.id !== pack.id && !previousPackId) previousPackId = pack.id;
      workingPack = renamedPack;
      continue;
    }

    const modeColors: Record<'plan' | 'build' | 'fast', string> = {
      plan: mastra.purple,
      build: mastra.green,
      fast: mastra.orange,
    };

    const modelId = await selectModel(
      ctx,
      `Select model for ${editTarget} mode`,
      modeColors[editTarget],
      workingPack.models[editTarget],
    );
    if (!modelId) continue;

    workingPack = {
      ...workingPack,
      models: {
        ...workingPack.models,
        [editTarget]: modelId,
      },
    };
  }
}

export function resetBuiltinPackOverrides(settings: GlobalSettings, packId: string): void {
  delete settings.models.modePackOverrides?.[packId];
  if (settings.models.activeModelPackId === packId) {
    settings.models.modeDefaults = {};
  }
}

export function upsertCustomPackInSettings(
  settings: GlobalSettings,
  pack: ModePack,
  modeDefaults: Record<string, string>,
  previousPackId?: string,
  setActive = true,
): void {
  if (!pack.id.startsWith('custom:')) return;

  if (previousPackId && previousPackId.startsWith('custom:') && previousPackId !== pack.id) {
    removeCustomPackFromSettings(settings, previousPackId);
  }

  const customName = pack.id.slice('custom:'.length);
  const entry = { name: customName, models: modeDefaults, createdAt: new Date().toISOString() };
  const idx = settings.customModelPacks.findIndex(p => p.name === customName);
  if (idx >= 0) {
    settings.customModelPacks[idx] = entry;
  } else {
    settings.customModelPacks.push(entry);
  }
  if (setActive) {
    settings.models.activeModelPackId = pack.id;
    settings.models.modeDefaults = modeDefaults;
  }
}

async function applyPack(ctx: SlashCommandContext, pack: ModePack, previousPackId?: string): Promise<void> {
  const controller = ctx.state.controller;
  const modes = controller.listModes();

  for (const mode of modes) {
    const modelId = (pack.models as Record<string, string>)[mode.id];
    if (modelId) {
      (mode as any).defaultModelId = modelId;
      await ctx.state.session.thread.setSetting({ key: `modeModelId_${mode.id}`, value: modelId });
    }
  }

  const currentModeId = ctx.state.session.mode.get();
  const currentModeModel = (pack.models as Record<string, string>)[currentModeId];
  if (currentModeModel) {
    await ctx.state.session.model.switch({ modelId: currentModeModel });
  }

  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
    const saModelId = (pack.models as Record<string, string>)[modeId];
    if (saModelId) {
      await ctx.state.session.subagents.model.set({ modelId: saModelId, agentType });
    }
  }

  await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pack.id });

  const s = loadSettings();
  const modeDefaults: Record<string, string> = {};
  for (const mode of modes) {
    const modelId = (pack.models as Record<string, string>)[mode.id];
    if (modelId) modeDefaults[mode.id] = modelId;
  }

  if (pack.id.startsWith('custom:')) {
    upsertCustomPackInSettings(s, pack, modeDefaults, previousPackId);
  } else {
    s.models.activeModelPackId = pack.id;
    s.models.modeDefaults = {};
  }

  s.models.subagentModels = {};

  const hasOpenAI = Object.values(pack.models).some(modelId => modelId.startsWith('openai/'));
  const sessionOverride = (ctx.state.session.state.get() as any)?.thinkingLevel as string | undefined;
  const defaultThinking = resolveDefaultThinkingLevel(s, currentModeId);
  const effectiveThinking = sessionOverride ?? defaultThinking.level;
  if (
    hasOpenAI &&
    sessionOverride === undefined &&
    defaultThinking.source === 'global' &&
    defaultThinking.level === 'off'
  ) {
    // Bump the active global fallback so OpenAI models don't silently run
    // without reasoning, while preserving explicit session and mode defaults.
    s.preferences.thinkingLevel = 'low';
  } else if (currentModeModel?.startsWith('openai/') && effectiveThinking === 'max') {
    // OpenAI API-key models do not accept the Codex-only `max` effort.
    await ctx.state.session.state.set({ thinkingLevel: 'xhigh' });
  }

  saveSettings(s);
  updateStatusLine(ctx.state);
}

export function getOverriddenPackModes(pack: ModePack, builtinPack: ModePack): Array<'plan' | 'build' | 'fast'> {
  return (['plan', 'build', 'fast'] as const).filter(mode => pack.models[mode] !== builtinPack.models[mode]);
}

function getModifiedPackDetail(pack: ModePack, builtinPack: ModePack): string {
  const overriddenModes = new Set(getOverriddenPackModes(pack, builtinPack));
  const modelText = (mode: 'plan' | 'build' | 'fast') =>
    overriddenModes.has(mode)
      ? theme.fg('warning', `${pack.models[mode]} (overridden)`)
      : theme.fg('text', pack.models[mode]);

  return [
    `  ${chalk.hex(mastra.purple)('plan')}  → ${modelText('plan')}`,
    `  ${chalk.hex(mastra.green)('build')} → ${modelText('build')}`,
    `  ${chalk.hex(mastra.orange)('fast')}  → ${modelText('fast')}`,
  ].join('\n');
}

function getPackDetail(pack: ModePack): string {
  if (pack.id === 'custom') {
    return theme.fg('dim', '  Create a named custom pack and pick a model for each mode.');
  }
  return [
    `  ${chalk.hex(mastra.purple)('plan')}  → ${theme.fg('text', pack.models.plan)}`,
    `  ${chalk.hex(mastra.green)('build')} → ${theme.fg('text', pack.models.build)}`,
    `  ${chalk.hex(mastra.orange)('fast')}  → ${theme.fg('text', pack.models.fast)}`,
  ].join('\n');
}

async function saveCustomPackEdits(ctx: SlashCommandContext, pack: ModePack, previousPackId?: string): Promise<void> {
  const settings = loadSettings();
  const wasActive = previousPackId
    ? settings.models.activeModelPackId === previousPackId
    : settings.models.activeModelPackId === pack.id;
  const wasOnboarding = previousPackId
    ? settings.onboarding.modePackId === previousPackId
    : settings.onboarding.modePackId === pack.id;

  const modeDefaults: Record<string, string> = {
    plan: pack.models.plan,
    build: pack.models.build,
    fast: pack.models.fast,
  };

  upsertCustomPackInSettings(settings, pack, modeDefaults, previousPackId, false);

  if (wasActive) {
    settings.models.activeModelPackId = pack.id;
  }
  if (wasOnboarding) {
    settings.onboarding.modePackId = pack.id;
  }

  saveSettings(settings);

  if (previousPackId && previousPackId !== pack.id) {
    const threadId = ctx.state.session.thread.getId();
    const thread = threadId ? (await ctx.state.session.thread.list()).find(t => t.id === threadId) : undefined;
    const threadPackId = (thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY] as string | undefined) ?? null;
    if (threadPackId === previousPackId) {
      await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pack.id });
    }
  }
}

async function deleteCustomPack(ctx: SlashCommandContext, pack: ModePack): Promise<void> {
  if (!pack.id.startsWith('custom:')) return;

  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(t => t.id === threadId) : undefined;
  const threadPackId = (thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY] as string | undefined) ?? null;

  const settings = loadSettings();
  removeCustomPackFromSettings(settings, pack.id);
  saveSettings(settings);

  if (threadPackId === pack.id) {
    await ctx.state.session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: null });
  }
}

function sharePack(ctx: SlashCommandContext, pack: ModePack): void {
  const serialized = serializePack(pack);
  const copied = setClipboardText(serialized);
  if (copied) {
    ctx.showInfo(`Copied ${pack.name} pack to clipboard`);
  } else {
    ctx.showInfo(`Share string for ${pack.name}:\n${serialized}`);
  }
}

async function askImportPackString(ctx: SlashCommandContext): Promise<string | null> {
  return new Promise(resolve => {
    const question = new AskQuestionDialogComponent({
      question: 'Paste the shared model pack string',
      tui: ctx.state.ui,
      onSubmit: answer => {
        ctx.state.ui.hideOverlay();
        const trimmed = answer.trim();
        resolve(trimmed.length > 0 ? trimmed : null);
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(null);
      },
    });

    showModalOverlay(ctx.state.ui, question, { maxHeight: '50%' });
    question.focused = true;
  });
}

async function askImportCollision(
  ctx: SlashCommandContext,
  existingName: string,
): Promise<'overwrite' | 'rename' | 'cancel'> {
  const actions = [
    { id: 'overwrite', label: 'Overwrite', description: `Replace the existing "${existingName}" pack` },
    { id: 'rename', label: 'Rename', description: 'Choose a different name for the imported pack' },
    { id: 'cancel', label: 'Cancel', description: 'Abort import' },
  ] as const;

  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', `A pack named "${existingName}" already exists`)), 0, 0));
    container.addChild(new Spacer(1));

    const items: SelectItem[] = actions.map(a => ({
      value: a.id,
      label: `  ${a.label}  ${theme.fg('dim', a.description)}`,
    }));

    const selectList = new SelectList(items, items.length, getSelectListTheme());

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = (selected: SelectItem) => {
      closeOverlay();
      resolve(selected.value as 'overwrite' | 'rename' | 'cancel');
    };

    selectList.onCancel = () => {
      closeOverlay();
      resolve('cancel');
    };

    container.addChild(selectList);
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '75%' });
  });
}

export async function handleModelsPackCommand(ctx: SlashCommandContext): Promise<void> {
  if (ctx.state.pendingNewThread) {
    await ctx.state.session.thread.create();
    ctx.state.pendingNewThread = false;
  }

  const controller = ctx.state.controller;
  const models = await controller.listAvailableModels();

  const hasEnv = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (storageProviderId: string): ProviderAccessLevel => {
    const cred = ctx.authStorage?.get(storageProviderId);
    if (cred?.type === 'oauth') return 'oauth';
    if (cred?.type === 'api_key' && cred.key.trim().length > 0) return 'apikey';
    return false;
  };
  const access: ProviderAccess = {
    anthropic: accessLevel('anthropic'),
    openai: accessLevel('openai-codex'),
    cerebras: hasEnv('cerebras') ? ('apikey' as const) : false,
    google: hasEnv('google') ? ('apikey' as const) : false,
    deepseek: hasEnv('deepseek') ? ('apikey' as const) : false,
    'github-copilot': accessLevel('github-copilot'),
  };
  // Include all other providers that have API keys configured
  const seen = new Set(Object.keys(access));
  for (const m of models) {
    if (!seen.has(m.provider) && m.hasApiKey) {
      access[m.provider] = 'apikey';
      seen.add(m.provider);
    }
  }

  const settings = loadSettings();
  const modifiedPackIds = new Set(
    Object.entries(settings.models.modePackOverrides ?? {})
      .filter(([, overrides]) => Object.keys(overrides).length > 0)
      .map(([packId]) => packId),
  );
  const packs = getAvailableModePacks(access, settings.customModelPacks).map(pack =>
    modifiedPackIds.has(pack.id)
      ? { ...pack, models: resolveModePackModels(settings, pack) as ModePack['models'] }
      : pack,
  );
  if (packs.length === 0) {
    ctx.showInfo('No model packs available. Configure provider auth first.');
    return;
  }

  const threadId = ctx.state.session.thread.getId();
  const thread = threadId ? (await ctx.state.session.thread.list()).find(t => t.id === threadId) : undefined;
  const currentPackId = resolveThreadActiveModelPackId(
    settings,
    packs,
    thread?.metadata as Record<string, unknown> | undefined,
  );

  const items: SelectItem[] = packs.map(p => ({
    value: p.id,
    label: `  ${p.name}${modifiedPackIds.has(p.id) ? theme.fg('warning', ' (modified)') : ''}  ${theme.fg('dim', p.description)}${p.id === currentPackId ? theme.fg('dim', ' (current)') : ''}`,
  }));
  items.push({
    value: '__import__',
    label: `  Import Pack  ${theme.fg('dim', 'Paste a shared pack config')}`,
  });

  return new Promise<void>(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Switch model pack')), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, items.length, getSelectListTheme());
    const detailText = new Text('', 0, 0);

    const closeOverlay = () => {
      ctx.state.ui.hideOverlay();
      ctx.state.ui.requestRender();
    };

    const updateDetail = (packId: string) => {
      if (packId === '__import__') {
        detailText.setText(theme.fg('dim', '  Paste a mastra-pack:... string from someone else to import their pack.'));
        ctx.state.ui.requestRender();
        return;
      }
      const pack = packs.find(p => p.id === packId);
      if (!pack) return;
      detailText.setText(getPackDetail(pack));
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = async (item: SelectItem) => {
      closeOverlay();

      if (item.value === '__import__') {
        const importStr = await askImportPackString(ctx);
        if (!importStr) {
          resolve();
          return;
        }
        const imported = deserializePack(importStr);
        if (!imported) {
          ctx.showInfo('Invalid pack string. Expected a mastra-pack:... value.');
          resolve();
          return;
        }

        // Validate that the imported model IDs are available in this environment
        const availableModelIds = new Set(models.map(m => m.id));
        const unavailable = Object.entries(imported.models)
          .filter(([, modelId]) => !availableModelIds.has(modelId))
          .map(([mode, modelId]) => `${mode}: ${modelId}`);
        if (unavailable.length > 0) {
          ctx.showInfo(`Can't import — these models aren't available:\n${unavailable.join('\n')}`);
          resolve();
          return;
        }

        // Handle name collision with existing custom pack
        const s = loadSettings();
        const existing = s.customModelPacks.find(p => p.name === imported.name);
        if (existing) {
          const collision = await askImportCollision(ctx, imported.name);
          if (collision === 'cancel') {
            resolve();
            return;
          }
          if (collision === 'rename') {
            const newName = await askCustomPackName(ctx, imported.name);
            if (!newName) {
              resolve();
              return;
            }
            if (s.customModelPacks.some(p => p.name === newName)) {
              ctx.showInfo(`A custom pack named "${newName}" already exists. Rename or delete it first.`);
              resolve();
              return;
            }
            imported.name = newName;
            imported.id = `custom:${newName}`;
          }
          // collision === 'overwrite' falls through
        }

        await applyPack(ctx, imported);
        ctx.showInfo(`Imported and activated ${imported.name} pack`);
        resolve();
        return;
      }

      let pack: ModePack | null | undefined = packs.find(p => p.id === item.value);
      let previousPackId: string | undefined;
      let resetBuiltinPack = false;
      if (!pack) {
        resolve();
        return;
      }

      if (pack.id === 'custom') {
        pack = await runCustomFlow(ctx);
      } else if (modifiedPackIds.has(pack.id)) {
        const builtinPack = getBuiltinModePack(pack.id);
        if (!builtinPack) {
          resolve();
          return;
        }
        const action = await askModifiedBuiltinPackAction(ctx, pack, builtinPack);
        if (action === null) {
          await handleModelsPackCommand(ctx);
          resolve();
          return;
        }
        if (action === 'reset') {
          const nextSettings = loadSettings();
          resetBuiltinPackOverrides(nextSettings, pack.id);
          saveSettings(nextSettings);
          pack = builtinPack;
          resetBuiltinPack = true;
        }
      } else if (pack.id.startsWith('custom:')) {
        while (true) {
          const action = await askCustomPackAction(ctx, pack);
          if (action === null) {
            await handleModelsPackCommand(ctx);
            resolve();
            return;
          }

          if (action === 'delete') {
            await deleteCustomPack(ctx, pack);
            ctx.showInfo(`Deleted custom pack: ${pack.name}`);
            resolve();
            return;
          }

          if (action === 'share') {
            sharePack(ctx, pack);
            continue;
          }

          if (action === 'activate') {
            break;
          }

          const edited = await runCustomPackEditFlow(ctx, pack);
          if (!edited) {
            continue;
          }

          previousPackId = edited.previousPackId;
          pack = edited.pack;
          await saveCustomPackEdits(ctx, pack, previousPackId);
          previousPackId = undefined;
          ctx.showInfo(`Updated custom pack: ${pack.name}`);
        }
      }

      if (!pack) {
        resolve();
        return;
      }

      await applyPack(ctx, pack, previousPackId);
      ctx.showInfo(resetBuiltinPack ? `Reset and switched to ${pack.name} pack` : `Switched to ${pack.name} pack`);
      resolve();
    };

    selectList.onCancel = () => {
      closeOverlay();
      resolve();
    };

    selectList.onSelectionChange = (item: SelectItem) => {
      updateDetail(item.value);
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(detailText);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    const currentIdx = packs.findIndex(p => p.id === currentPackId);
    const initialIdx = currentIdx >= 0 ? currentIdx : 0;
    if (initialIdx > 0) selectList.setSelectedIndex(initialIdx);
    updateDetail(packs[initialIdx]!.id);
    (container as Box & { handleInput: (data: string) => void }).handleInput = (data: string) =>
      selectList.handleInput(data);

    showModalOverlay(ctx.state.ui, container, { maxHeight: '80%' });
  });
}
