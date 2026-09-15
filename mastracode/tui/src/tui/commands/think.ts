import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';

import { loadSettings, resolveDefaultThinkingLevel } from '@mastra/code-sdk/onboarding/settings';
import { isThinkingLevelSetting, parseThinkCommand } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting, ThinkingLevelSource } from '@mastra/code-sdk/thinking';
import {
  THINKING_LEVELS,
  getThinkingLevelForModel,
  getThinkingLevelsForModel,
} from '../components/thinking-settings.js';
import { showModalOverlay } from '../overlay.js';
import { theme, getSelectListTheme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/** Sentinel value used by the selector for "clear the session override". */
const DEFAULT_ITEM_VALUE = '__default__';

/** Models that support reasoning effort. */
function supportsThinking(modelId: string): boolean {
  return modelId.startsWith('openai/') || modelId.startsWith('anthropic/');
}

function levelLabel(levelId: string): string {
  return THINKING_LEVELS.find(l => l.id === levelId)?.label ?? levelId;
}

function sourceLabel(source: ThinkingLevelSource, modeId: string | null): string {
  return source === 'mode-default' && modeId ? `${modeId} mode default` : 'global default';
}

/** The session override, or undefined when the session inherits the defaults. */
function getSessionOverride(ctx: SlashCommandContext): ThinkingLevelSetting | undefined {
  const level = ctx.state.session.state.get()?.thinkingLevel;
  return isThinkingLevelSetting(level) ? level : undefined;
}

/** Resolve the configured default (mode default → global default) for display. */
function getConfiguredDefault(ctx: SlashCommandContext): {
  level: ThinkingLevelSetting;
  source: ThinkingLevelSource;
  modeId: string | null;
} {
  const modeId = ctx.state.session.mode.get() ?? null;
  const { level, source } = resolveDefaultThinkingLevel(loadSettings(), modeId);
  return { level, source, modeId };
}

function getThinkingStatusLine(ctx: SlashCommandContext): string {
  const override = getSessionOverride(ctx);
  const fallback = getConfiguredDefault(ctx);
  if (override !== undefined) {
    return `Thinking: ${levelLabel(override)} (session override) · default: ${levelLabel(fallback.level)} (${sourceLabel(fallback.source, fallback.modeId)})`;
  }
  return `Thinking: ${levelLabel(fallback.level)} (${sourceLabel(fallback.source, fallback.modeId)})`;
}

function getModelNote(ctx: SlashCommandContext): string | null {
  const modelId = ctx.state.session.model.get() ?? '';
  if (!modelId) return 'No model selected.';
  if (!supportsThinking(modelId)) {
    return `Warning: current model (${modelId}) may not support reasoning effort. Setting will be saved but may not take effect.`;
  }
  return null;
}

export async function handleThinkCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const modelId = ctx.state.session.model.get() ?? '';
  const thinkingLevels = getThinkingLevelsForModel(modelId);
  const override = getSessionOverride(ctx);
  const configuredDefault = getConfiguredDefault(ctx);
  const rawArguments = args.join(' ');

  if (rawArguments) {
    const action = parseThinkCommand(
      rawArguments,
      thinkingLevels.map(level => level.id),
    );
    if (action.kind === 'status') {
      ctx.showInfo(getThinkingStatusLine(ctx));
      return;
    }
    if (action.kind === 'clear') {
      await ctx.state.session.state.set({ thinkingLevel: undefined });
      ctx.showInfo(
        `Thinking → ${levelLabel(configuredDefault.level)} (${sourceLabel(configuredDefault.source, configuredDefault.modeId)})`,
      );
      return;
    }
    if (action.kind === 'invalid') {
      ctx.showInfo(
        `Invalid thinking level: ${action.value}. Use one of: ${action.levels.join(', ')}, 'default', or 'status'.`,
      );
      return;
    }
    const selected = getThinkingLevelForModel(modelId, action.level);
    const note = getModelNote(ctx);
    await ctx.state.session.state.set({ thinkingLevel: action.level });
    ctx.showInfo(`Thinking: ${selected.label} (session override)` + (note ? ` (${note})` : ''));
    return;
  }

  // No argument: show inline selector
  const defaultDescription = `${levelLabel(configuredDefault.level)} · ${sourceLabel(configuredDefault.source, configuredDefault.modeId)}`;
  const items: SelectItem[] = [
    {
      value: DEFAULT_ITEM_VALUE,
      label: `  Default  ${theme.fg('dim', defaultDescription)}${override === undefined ? theme.fg('dim', ' (current)') : ''}`,
    },
    ...thinkingLevels.map(l => ({
      value: l.id,
      label: `  ${l.label}  ${theme.fg('dim', l.description)}${l.id === override ? theme.fg('dim', ' (current)') : ''}`,
    })),
  ];

  const modelNote = getModelNote(ctx);

  return new Promise<void>(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Thinking Level')), 0, 0));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', 'Session override — "Default" inherits mode/global defaults.'), 0, 0));
    container.addChild(new Spacer(1));
    if (modelNote) {
      container.addChild(new Text(theme.fg('warning', modelNote), 0, 0));
      container.addChild(new Spacer(1));
    }

    const selectList = new SelectList(items, items.length, getSelectListTheme());

    selectList.onSelect = async (item: SelectItem) => {
      ctx.state.ui.hideOverlay();
      const selectedValue = item.value;

      try {
        if (selectedValue === DEFAULT_ITEM_VALUE) {
          await ctx.state.session.state.set({ thinkingLevel: undefined });
          ctx.showInfo(
            `Thinking → ${levelLabel(configuredDefault.level)} (${sourceLabel(configuredDefault.source, configuredDefault.modeId)})`,
          );
        } else if (isThinkingLevelSetting(selectedValue)) {
          await ctx.state.session.state.set({ thinkingLevel: selectedValue });
          const selectedLabel = getThinkingLevelForModel(modelId, selectedValue).label;
          ctx.showInfo(
            `Thinking → ${selectedValue === override ? `${selectedLabel} (unchanged)` : `${selectedLabel} (session override)`}`,
          );
        }
      } catch {
        // Keep cancel behavior silent.
      } finally {
        resolve();
      }
    };

    selectList.onCancel = () => {
      ctx.state.ui.hideOverlay();
      resolve();
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    // Pre-select current entry (after adding to container, matching models-pack pattern)
    const currentIdx = override === undefined ? 0 : thinkingLevels.findIndex(l => l.id === override) + 1;
    if (currentIdx > 0) selectList.setSelectedIndex(currentIdx);

    const modal = container as Box & { handleInput: (data: string) => void };
    modal.handleInput = (data: string) => selectList.handleInput(data);
    showModalOverlay(ctx.state.ui, modal, { maxHeight: '60%' });
  });
}
