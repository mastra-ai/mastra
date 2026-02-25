import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem } from '@mariozechner/pi-tui';
import chalk from 'chalk';

import type { ModePack, ProviderAccess, ProviderAccessLevel } from '../../onboarding/packs.js';
import { getAvailableModePacks } from '../../onboarding/packs.js';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { updateStatusLine } from '../status-line.js';
import { getSelectListTheme, theme, mastra } from '../theme.js';
import type { SlashCommandContext } from './types.js';

async function selectModel(ctx: SlashCommandContext, title: string, modeColor?: string): Promise<string | undefined> {
  const availableModels = await ctx.state.harness.listAvailableModels();
  if (availableModels.length === 0) return undefined;

  return new Promise<string | undefined>(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: availableModels,
      currentModelId: undefined,
      title,
      titleColor: modeColor,
      onSelect: (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
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

async function runCustomFlow(ctx: SlashCommandContext): Promise<ModePack | null> {
  const modes: Array<{ id: 'plan' | 'build' | 'fast'; label: string; color: string }> = [
    { id: 'plan', label: 'plan', color: mastra.blue },
    { id: 'build', label: 'build', color: mastra.purple },
    { id: 'fast', label: 'fast', color: mastra.green },
  ];

  const models: Record<string, string> = { build: '', plan: '', fast: '' };
  for (const mode of modes) {
    const modelId = await selectModel(ctx, `Select model for ${mode.label} mode`, mode.color);
    if (!modelId) return null;
    models[mode.id] = modelId;
  }

  return {
    id: 'custom',
    name: 'Custom',
    description: 'User-selected models',
    models: models as ModePack['models'],
  };
}

function applyPack(ctx: SlashCommandContext, pack: ModePack): void {
  const harness = ctx.state.harness;
  const modes = harness.listModes();

  for (const mode of modes) {
    const modelId = (pack.models as Record<string, string>)[mode.id];
    if (modelId) {
      (mode as any).defaultModelId = modelId;
      harness.setThreadSetting({ key: `modeModelId_${mode.id}`, value: modelId });
    }
  }

  const currentModeId = harness.getCurrentModeId();
  const currentModeModel = (pack.models as Record<string, string>)[currentModeId];
  if (currentModeModel) {
    harness.switchModel({ modelId: currentModeModel });
  }

  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
    const saModelId = (pack.models as Record<string, string>)[modeId];
    if (saModelId) {
      harness.setSubagentModelId({ modelId: saModelId, agentType });
    }
  }

  const s = loadSettings();
  const modeDefaults: Record<string, string> = {};
  for (const mode of modes) {
    const modelId = (pack.models as Record<string, string>)[mode.id];
    if (modelId) modeDefaults[mode.id] = modelId;
  }

  if (pack.id === 'custom') {
    const idx = s.customModelPacks.findIndex(p => p.name === 'Setup');
    const entry = { name: 'Setup', models: modeDefaults, createdAt: new Date().toISOString() };
    if (idx >= 0) {
      s.customModelPacks[idx] = entry;
    } else {
      s.customModelPacks.push(entry);
    }
    s.models.activeModelPackId = 'custom:Setup';
    s.models.modeDefaults = modeDefaults;
  } else if (pack.id.startsWith('custom:')) {
    s.models.activeModelPackId = pack.id;
    s.models.modeDefaults = modeDefaults;
  } else {
    s.models.activeModelPackId = pack.id;
    s.models.modeDefaults = {};
  }
  s.models.subagentModels = {};
  saveSettings(s);

  updateStatusLine(ctx.state);
}

function getPackDetail(pack: ModePack): string {
  if (pack.id === 'custom') {
    return theme.fg('dim', "  You'll pick a model for each mode.");
  }
  return [
    `  ${chalk.hex(mastra.blue)('plan')}  → ${theme.fg('text', pack.models.plan)}`,
    `  ${chalk.hex(mastra.purple)('build')} → ${theme.fg('text', pack.models.build)}`,
    `  ${chalk.hex(mastra.green)('fast')}  → ${theme.fg('text', pack.models.fast)}`,
  ].join('\n');
}

export async function handleModelsPackCommand(ctx: SlashCommandContext): Promise<void> {
  const harness = ctx.state.harness;
  const models = await harness.listAvailableModels();

  const hasEnv = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (provider: string, oauthId: string): ProviderAccessLevel => {
    if (ctx.authStorage?.isLoggedIn(oauthId)) return 'oauth';
    if (hasEnv(provider)) return 'apikey';
    return false;
  };
  const access: ProviderAccess = {
    anthropic: accessLevel('anthropic', 'anthropic'),
    openai: accessLevel('openai', 'openai-codex'),
    cerebras: hasEnv('cerebras') ? ('apikey' as const) : false,
    google: hasEnv('google') ? ('apikey' as const) : false,
    deepseek: hasEnv('deepseek') ? ('apikey' as const) : false,
  };

  const settings = loadSettings();
  const packs = getAvailableModePacks(access, settings.customModelPacks);

  if (packs.length === 0) {
    ctx.showInfo('No model packs available. Run /setup to configure.');
    return;
  }

  const currentPackId = settings.models.activeModelPackId;

  const items: SelectItem[] = packs.map(p => ({
    value: p.id,
    label: `  ${p.name}  ${theme.fg('dim', p.description)}${p.id === currentPackId ? theme.fg('dim', ' (current)') : ''}`,
  }));

  return new Promise<void>(resolve => {
    const container = new Box(1, 1);
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Switch model pack')), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, items.length, getSelectListTheme());

    const detailText = new Text('', 0, 0);

    const updateDetail = (packId: string) => {
      const pack = packs.find(p => p.id === packId);
      if (!pack) return;
      detailText.setText(getPackDetail(pack));
      ctx.state.ui.requestRender();
    };

    selectList.onSelect = async (item: SelectItem) => {
      // Remove from input routing
      ctx.state.activeInlineQuestion = undefined;

      const pack = packs.find(p => p.id === item.value);
      if (!pack) {
        collapseResult('cancelled');
        resolve();
        return;
      }

      if (pack.id === 'custom') {
        collapseResult(null);
        const customPack = await runCustomFlow(ctx);
        if (customPack) {
          applyPack(ctx, customPack);
          collapseResult(`Model pack → ${theme.bold('Custom')}`);
          ctx.showInfo('Switched to Custom pack');
        } else {
          collapseResult('cancelled');
        }
      } else {
        applyPack(ctx, pack);
        collapseResult(`Model pack → ${theme.bold(pack.name)}`);
        ctx.showInfo(`Switched to ${pack.name} pack`);
      }

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

    // Initialize detail for first item
    const currentIdx = packs.findIndex(p => p.id === currentPackId);
    const initialIdx = currentIdx >= 0 ? currentIdx : 0;
    if (initialIdx > 0) selectList.setSelectedIndex(initialIdx);
    updateDetail(packs[initialIdx]!.id);

    // Route input through activeInlineQuestion by creating a minimal shim
    const inputShim = { handleInput: (data: string) => selectList.handleInput(data) } as any;
    ctx.state.activeInlineQuestion = inputShim;

    const collapseResult = (result: string | null) => {
      container.clear();
      if (result === 'cancelled') {
        container.addChild(new Text(theme.fg('dim', `${theme.fg('error', '✗')} Model pack (cancelled)`), 0, 0));
      } else if (result) {
        container.addChild(new Text(theme.fg('text', `${theme.fg('success', '✓')} ${result}`), 0, 0));
      }
    };

    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(container);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
