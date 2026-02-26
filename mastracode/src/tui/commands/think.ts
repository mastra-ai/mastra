import { Box, SelectList, Spacer, Text, isKeyRelease } from '@mariozechner/pi-tui';
import type { SelectItem } from '@mariozechner/pi-tui';

import {
  THINKING_LEVELS,
  getThinkingLevelForModel,
  getThinkingLevelsForModel,
} from '../components/thinking-settings.js';
import { theme, getSelectListTheme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/** Models that support reasoning effort. */
function supportsThinking(modelId: string): boolean {
  return modelId.startsWith('openai/');
}

function getThinkingStatusLine(modelId: string, levelId: string): string {
  const level = getThinkingLevelForModel(modelId, levelId);
  return `Thinking: ${level.label}`;
}

function getModelNote(ctx: SlashCommandContext): string | null {
  const modelId = ctx.state.harness.getCurrentModelId() ?? '';
  if (!modelId) return 'No model selected.';
  if (!supportsThinking(modelId)) {
    return `Warning: current model (${modelId}) may not support reasoning effort. Setting will be saved but may not take effect.`;
  }
  return null;
}

export async function handleThinkCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const currentLevel = ((ctx.harness.getState() as any)?.thinkingLevel ?? 'off') as string;
  const modelId = ctx.state.harness.getCurrentModelId() ?? '';
  const thinkingLevels = getThinkingLevelsForModel(modelId);
  const arg = args[0]?.toLowerCase();

  if (arg === 'status') {
    ctx.showInfo(getThinkingStatusLine(modelId, currentLevel));
    return;
  }

  // Direct level argument: /think high
  if (arg) {
    const selected = thinkingLevels.find(l => l.id === arg);
    if (!selected) {
      ctx.showInfo(
        `Invalid thinking level: ${arg}. Use one of: ${THINKING_LEVELS.map(l => l.id).join(', ')} or 'status'.`,
      );
      return;
    }
    const note = getModelNote(ctx);
    await ctx.harness.setState({ thinkingLevel: selected.id } as any);
    ctx.showInfo(getThinkingStatusLine(modelId, selected.id) + (note ? ` (${note})` : ''));
    return;
  }

  // No argument: show inline selector
  const items: SelectItem[] = thinkingLevels.map(l => ({
    value: l.id,
    label: `  ${l.label}  ${theme.fg('dim', l.description)}${l.id === currentLevel ? theme.fg('dim', ' (current)') : ''}`,
  }));

  const modelNote = getModelNote(ctx);

  return new Promise<void>(resolve => {
    const container = new Box(1, 1);
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Thinking Level')), 0, 0));
    container.addChild(new Spacer(1));
    if (modelNote) {
      container.addChild(new Text(theme.fg('warning', modelNote), 0, 0));
      container.addChild(new Spacer(1));
    }

    const selectList = new SelectList(items, items.length, getSelectListTheme());

    selectList.onSelect = async (item: SelectItem) => {
      ctx.state.activeInlineQuestion = undefined;
      try {
        await ctx.harness.setState({ thinkingLevel: item.value } as any);
        const selectedLabel = getThinkingLevelForModel(modelId, item.value).label;
        collapseResult(
          `Thinking → ${theme.bold(item.value === currentLevel ? `${selectedLabel} (unchanged)` : selectedLabel)}`,
        );
      } catch {
        collapseResult('cancelled');
      } finally {
        ctx.state.ui.requestRender();
        resolve();
      }
    };

    selectList.onCancel = () => {
      ctx.state.activeInlineQuestion = undefined;
      collapseResult('cancelled');
      ctx.state.ui.requestRender();
      resolve();
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    // Pre-select current level (after adding to container, matching models-pack pattern)
    const currentIdx = thinkingLevels.findIndex(l => l.id === currentLevel);
    if (currentIdx > 0) selectList.setSelectedIndex(currentIdx);

    const collapseResult = (result: string) => {
      container.clear();
      if (result === 'cancelled') {
        container.addChild(new Text(theme.fg('dim', `${theme.fg('error', '✗')} Thinking level (cancelled)`), 0, 0));
      } else {
        container.addChild(new Text(theme.fg('text', `${theme.fg('success', '✓')} ${result}`), 0, 0));
      }
    };

    // Route input through activeInlineQuestion (filter key releases from Kitty protocol)
    const inputShim = {
      handleInput: (data: string) => {
        if (isKeyRelease(data)) return;
        selectList.handleInput(data);
      },
    } as any;
    ctx.state.activeInlineQuestion = inputShim;

    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(container);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
