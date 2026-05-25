import type { TUI } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';
import type { ModelItem } from '../model-selector.js';
import { ModelSelectorComponent } from '../model-selector.js';

const WIDTH = 100;

function renderPlain(component: ModelSelectorComponent): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

function kittyPrintable(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error('Expected a printable character');
  return `\x1b[${cp};1u`;
}

function makeModels(): ModelItem[] {
  return [
    { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
    { id: 'openai/gpt-5-mini', provider: 'openai', modelName: 'gpt-5-mini', hasApiKey: true },
    { id: 'openai/gpt-5-codex', provider: 'openai', modelName: 'gpt-5-codex', hasApiKey: true },
  ];
}

describe('OM model picker (ModelSelectorComponent)', () => {
  it('filters models when typing search text and selects filtered result on enter', () => {
    const requestRender = vi.fn();
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const selector = new ModelSelectorComponent({
      tui: { requestRender } as unknown as TUI,
      models: makeModels(),
      currentModelId: 'anthropic/claude-sonnet-4-6',
      title: 'Observer Model',
      onSelect,
      onCancel,
    });

    for (const ch of 'codex') {
      selector.handleInput(ch);
    }

    const lines = renderPlain(selector).join('\n');

    expect(lines).toContain('openai/gpt-5-codex');
    expect(lines).not.toContain('openai/gpt-5-mini');
    expect(lines).not.toContain('anthropic/claude-sonnet-4-6');

    // First entry is the "Use: codex" custom option; arrow down to the match.
    selector.handleInput('\x1b[B');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'openai/gpt-5-codex' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();
  });

  it('filters models when receiving kitty CSI-u printable key sequences', () => {
    const requestRender = vi.fn();
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const selector = new ModelSelectorComponent({
      tui: { requestRender } as unknown as TUI,
      models: makeModels(),
      currentModelId: 'anthropic/claude-sonnet-4-6',
      title: 'Observer Model',
      onSelect,
      onCancel,
    });

    for (const ch of 'codex') {
      selector.handleInput(kittyPrintable(ch));
    }

    const lines = renderPlain(selector).join('\n');

    expect(lines).toContain('openai/gpt-5-codex');
    expect(lines).not.toContain('openai/gpt-5-mini');
    expect(lines).not.toContain('anthropic/claude-sonnet-4-6');

    // First entry is the "Use: codex" custom option; arrow down to the match.
    selector.handleInput('\x1b[B');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'openai/gpt-5-codex' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();
  });

  it('accepts a custom model string that is not in the list', () => {
    const requestRender = vi.fn();
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const selector = new ModelSelectorComponent({
      tui: { requestRender } as unknown as TUI,
      models: makeModels(),
      currentModelId: 'anthropic/claude-sonnet-4-6',
      title: 'Observer Model',
      onSelect,
      onCancel,
    });

    for (const ch of 'deepseek/deepseek-v4-flash') {
      selector.handleInput(ch);
    }

    const lines = renderPlain(selector).join('\n');
    expect(lines).toContain('Use: deepseek/deepseek-v4-flash');

    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'deepseek/deepseek-v4-flash', provider: 'deepseek' }),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });
});
