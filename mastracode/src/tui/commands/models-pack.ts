import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem } from '@mariozechner/pi-tui';
import chalk from 'chalk';

import { setClipboardText } from '../../clipboard/index.js';
import type { ModePack, ProviderAccess, ProviderAccessLevel } from '../../onboarding/packs.js';
import { getAvailableModePacks } from '../../onboarding/packs.js';
import {
  loadSettings,
  resolveThreadActiveModelPackId,
  saveSettings,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
} from '../../onboarding/settings.js';
import type { GlobalSettings } from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import { updateStatusLine } from '../status-line.js';
import { getSelectListTheme, mastra, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

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
  const availableModels = await ctx.state.harness.listAvailableModels();
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
        await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
        resolve(model.id);
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(undefined);
      },
    });

    ctx.state.ui.showOverlay(selector, {
      width: '80%',
      maxHeight: '60%',
      anchor: 'center',
    });
    selector.focused = true;
  });
}

async function askCustomPackName(ctx: SlashCommandContext, defaultName?: string): Promise<string | null> {
  return new Promise(resolve => {
    const question = new AskQuestionInlineComponent(
      {
        question: 'Name this custom pack',
        formatResult: answer => `Custom pack: ${answer}`,
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

    if (defaultName) {
      (question as any).input?.setValue?.(defaultName);
    }

    ctx.state.activeInlineQuestion = question;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(question);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
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
    const container = new Box(1, 1);
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

    selectList.onSelectionChange = item => {
      detailText.setText(detailById[item.value] ?? '');
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = item => {
      ctx.state.activeInlineQuestion = undefined;
      container.clear();
      container.addChild(
        new Text(theme.fg('text', `${theme.fg('success', '✓')} ${pack.name} → ${theme.bold(item.value)}`), 0, 0),
      );
      ctx.state.ui.requestRender();
      resolve(item.value as 'activate' | 'edit' | 'share' | 'delete');
    };

    selectList.onCancel = () => {
      ctx.state.activeInlineQuestion = undefined;
      container.clear();
      container.addChild(new Text(theme.fg('dim', `${theme.fg('error', '✗')} ${pack.name} (cancelled)`), 0, 0));
      ctx.state.ui.requestRender();
      resolve(null);
    };

    detailText.setText(detailById['activate']!);
    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(detailText);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    const inputShim = { handleInput: (data: string) => selectList.handleInput(data) } as any;
    ctx.state.activeInlineQuestion = inputShim;
    ctx.state.chatContainer.addChild(container);
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

async function askCustomPackEditTarget(
  ctx: SlashCommandContext,
  pack: ModePack,
): Promise<'rename' | 'plan' | 'build' | 'fast' | 'save' | null> {
  return new Promise(resolve => {
    const container = new Box(1, 1);
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

    const cleanup = () => {
      if (ctx.state.chatContainer.children.includes(container as any)) {
        ctx.state.chatContainer.removeChild(container as any);
      }
      ctx.state.ui.requestRender();
      ctx.state.chatContainer.invalidate();
    };

    selectList.onSelect = item => {
      ctx.state.activeInlineQuestion = undefined;
      cleanup();
      resolve(item.value as 'rename' | 'plan' | 'build' | 'fast' | 'save');
    };

    selectList.onCancel = () => {
      ctx.state.activeInlineQuestion = undefined;
      cleanup();
      resolve(null);
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    const inputShim = { handleInput: (data: string) => selectList.handleInput(data) } as any;
    ctx.state.activeInlineQuestion = inputShim;
    ctx.state.chatContainer.addChild(container);
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

async function runCustomFlow(
  ctx: SlashCommandContext,
  options?: { name?: string; models?: ModePack['models']; skipNamePrompt?: boolean },
): Promise<ModePack | null> {
  const modes: Array<{ id: 'plan' | 'build' | 'fast'; label: string; color: string }> = [
    { id: 'plan', label: 'plan', color: mastra.purple },
    { id: 'build', label: 'build', color: mastra.green },
    { id: 'fast', label: 'fast', color: mastra.orange },
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
      mode.color,
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

export function removeCustomPackFromSettings(settings: GlobalSettings, packId: string): void {
  if (!packId.startsWith('custom:')) return;
  const packName = packId.slice('custom:'.length);
  const removedPack = settings.customModelPacks.find(p => p.name === packName);
  settings.customModelPacks = settings.customModelPacks.filter(p => p.name !== packName);

  const modeDefaultsMatchRemovedPack =
    !!removedPack &&
    settings.models.modeDefaults.plan === removedPack.models.plan &&
    settings.models.modeDefaults.build === removedPack.models.build &&
    settings.models.modeDefaults.fast === removedPack.models.fast;

  if (settings.models.activeModelPackId === packId) {
    settings.models.activeModelPackId = null;
    settings.models.modeDefaults = {};
  } else if (modeDefaultsMatchRemovedPack) {
    settings.models.modeDefaults = {};
  }

  if (settings.onboarding.modePackId === packId) {
    settings.onboarding.modePackId = null;
  }
}

async function applyPack(ctx: SlashCommandContext, pack: ModePack, previousPackId?: string): Promise<void> {
  const harness = ctx.state.harness;
  const modes = harness.listModes();

  for (const mode of modes) {
    const modelId = (pack.models as Record<string, string>)[mode.id];
    if (modelId) {
      (mode as any).defaultModelId = modelId;
      await harness.setThreadSetting({ key: `modeModelId_${mode.id}`, value: modelId });
    }
  }

  const currentModeId = harness.getCurrentModeId();
  const currentModeModel = (pack.models as Record<string, string>)[currentModeId];
  if (currentModeModel) {
    await harness.switchModel({ modelId: currentModeModel });
  }

  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
    const saModelId = (pack.models as Record<string, string>)[modeId];
    if (saModelId) {
      await harness.setSubagentModelId({ modelId: saModelId, agentType });
    }
  }

  await harness.setThreadSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pack.id });

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

  const hasOpenAI = Object.values(pack.models).some(m => m.startsWith('openai/'));
  const currentThinking = ((harness.getState() as any)?.thinkingLevel ?? 'off') as string;
  if (hasOpenAI && currentThinking === 'off') {
    await harness.setState({ thinkingLevel: 'low' } as any);
    s.preferences.thinkingLevel = 'low';
  }

  saveSettings(s);
  updateStatusLine(ctx.state);
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
    const harness = ctx.state.harness;
    const threadId = harness.getCurrentThreadId();
    const thread = threadId ? (await harness.listThreads()).find(t => t.id === threadId) : undefined;
    const threadPackId = (thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY] as string | undefined) ?? null;
    if (threadPackId === previousPackId) {
      await harness.setThreadSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pack.id });
    }
  }
}

async function deleteCustomPack(ctx: SlashCommandContext, pack: ModePack): Promise<void> {
  if (!pack.id.startsWith('custom:')) return;

  const harness = ctx.state.harness;
  const threadId = harness.getCurrentThreadId();
  const thread = threadId ? (await harness.listThreads()).find(t => t.id === threadId) : undefined;
  const threadPackId = (thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY] as string | undefined) ?? null;

  const settings = loadSettings();
  removeCustomPackFromSettings(settings, pack.id);
  saveSettings(settings);

  if (threadPackId === pack.id) {
    await harness.setThreadSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: null });
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
    const question = new AskQuestionInlineComponent(
      {
        question: 'Paste the shared model pack string',
        formatResult: answer => `Import: ${answer.slice(0, 40)}${answer.length > 40 ? '…' : ''}`,
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

    ctx.state.activeInlineQuestion = question;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(question);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
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
    const container = new Box(1, 1);
    container.addChild(new Text(theme.bold(theme.fg('accent', `A pack named "${existingName}" already exists`)), 0, 0));
    container.addChild(new Spacer(1));

    const items: SelectItem[] = actions.map(a => ({
      value: a.id,
      label: `  ${a.label}  ${theme.fg('dim', a.description)}`,
    }));

    const selectList = new SelectList(items, items.length, getSelectListTheme());

    selectList.onSelect = (selected: SelectItem) => {
      ctx.state.activeInlineQuestion = undefined;
      container.clear();
      container.addChild(new Text(theme.fg('dim', `${existingName}: ${selected.value}`), 0, 0));
      ctx.state.ui.requestRender();
      resolve(selected.value as 'overwrite' | 'rename' | 'cancel');
    };

    selectList.onCancel = () => {
      ctx.state.activeInlineQuestion = undefined;
      container.clear();
      container.addChild(new Text(theme.fg('dim', `${existingName}: cancelled`), 0, 0));
      ctx.state.ui.requestRender();
      resolve('cancel');
    };

    container.addChild(selectList);

    const inputShim = { handleInput: (data: string) => selectList.handleInput(data) } as any;
    ctx.state.activeInlineQuestion = inputShim;
    ctx.state.chatContainer.addChild(container);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

export async function handleModelsPackCommand(ctx: SlashCommandContext): Promise<void> {
  const harness = ctx.state.harness;
  const models = await harness.listAvailableModels();

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
  const packs = getAvailableModePacks(access, settings.customModelPacks);
  if (packs.length === 0) {
    ctx.showInfo('No model packs available. Configure provider auth first.');
    return;
  }

  const threadId = harness.getCurrentThreadId();
  const thread = threadId ? (await harness.listThreads()).find(t => t.id === threadId) : undefined;
  const currentPackId = resolveThreadActiveModelPackId(
    settings,
    packs,
    thread?.metadata as Record<string, unknown> | undefined,
  );

  const items: SelectItem[] = packs.map(p => ({
    value: p.id,
    label: `  ${p.name}  ${theme.fg('dim', p.description)}${p.id === currentPackId ? theme.fg('dim', ' (current)') : ''}`,
  }));
  items.push({
    value: '__import__',
    label: `  Import Pack  ${theme.fg('dim', 'Paste a shared pack config')}`,
  });

  return new Promise<void>(resolve => {
    const container = new Box(1, 1);
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Switch model pack')), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, items.length, getSelectListTheme());
    const detailText = new Text('', 0, 0);

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

    const collapseResult = (result: string | null) => {
      container.clear();
      if (result === 'cancelled') {
        container.addChild(new Text(theme.fg('dim', `${theme.fg('error', '✗')} Model pack (cancelled)`), 0, 0));
      } else if (result) {
        container.addChild(new Text(theme.fg('text', `${theme.fg('success', '✓')} ${result}`), 0, 0));
      }
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = async (item: SelectItem) => {
      ctx.state.activeInlineQuestion = undefined;

      if (item.value === '__import__') {
        collapseResult(null);
        const importStr = await askImportPackString(ctx);
        if (!importStr) {
          collapseResult('cancelled');
          resolve();
          return;
        }
        const imported = deserializePack(importStr);
        if (!imported) {
          collapseResult('cancelled');
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
          collapseResult('cancelled');
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
            collapseResult('cancelled');
            resolve();
            return;
          }
          if (collision === 'rename') {
            const newName = await askCustomPackName(ctx, imported.name);
            if (!newName) {
              collapseResult('cancelled');
              resolve();
              return;
            }
            if (s.customModelPacks.some(p => p.name === newName)) {
              collapseResult('cancelled');
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
        collapseResult(`Imported pack → ${theme.bold(imported.name)}`);
        ctx.showInfo(`Imported and activated ${imported.name} pack`);
        resolve();
        return;
      }

      let pack: ModePack | null | undefined = packs.find(p => p.id === item.value);
      let previousPackId: string | undefined;
      if (!pack) {
        collapseResult('cancelled');
        resolve();
        return;
      }

      if (pack.id === 'custom') {
        collapseResult(null);
        pack = await runCustomFlow(ctx);
      } else if (pack.id.startsWith('custom:')) {
        while (true) {
          const action = await askCustomPackAction(ctx, pack);
          if (action === null) {
            collapseResult('cancelled');
            resolve();
            return;
          }

          if (action === 'delete') {
            await deleteCustomPack(ctx, pack);
            collapseResult(`Deleted custom pack → ${theme.bold(pack.name)}`);
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
        collapseResult('cancelled');
        resolve();
        return;
      }

      await applyPack(ctx, pack, previousPackId);
      collapseResult(`Model pack → ${theme.bold(pack.name)}`);
      ctx.showInfo(`Switched to ${pack.name} pack`);
      resolve();
    };

    selectList.onCancel = () => {
      ctx.state.activeInlineQuestion = undefined;
      collapseResult('cancelled');
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

    const inputShim = { handleInput: (data: string) => selectList.handleInput(data) } as any;
    ctx.state.activeInlineQuestion = inputShim;

    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(container);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
