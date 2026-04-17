import type { TUI } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';
import { ModelSelectSubmenu } from '../om-settings.js';

const WIDTH = 100;

function renderPlain(component: ModelSelectSubmenu): string[] {
  return component.render(WIDTH).map(line => stripAnsi(line));
}

function kittyPrintable(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error('Expected a printable character');
  return `\x1b[${cp};1u`;
}

describe('ModelSelectSubmenu', () => {
  it('filters models when typing search text and selects filtered result on enter', () => {
    const requestRender = vi.fn();
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const models = [
      { id: 'anthropic/claude-sonnet-4-6', label: 'anthropic/claude-sonnet-4-6' },
      { id: 'openai/gpt-5-mini', label: 'openai/gpt-5-mini' },
      { id: 'openai/gpt-5-codex', label: 'openai/gpt-5-codex' },
    ];

    const submenu = new ModelSelectSubmenu(
      'Observer Model',
      models,
      'anthropic/claude-sonnet-4-6',
      onSelect,
      onCancel,
      { requestRender } as unknown as TUI,
    );

    for (const ch of 'codex') {
      submenu.handleInput(ch);
    }

    const lines = renderPlain(submenu).join('\n');

    expect(lines).toContain('openai/gpt-5-codex');
    expect(lines).not.toContain('openai/gpt-5-mini');
    expect(lines).not.toContain('anthropic/claude-sonnet-4-6');

    submenu.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('openai/gpt-5-codex');
    expect(onCancel).not.toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();
  });

  it('filters models when receiving kitty CSI-u printable key sequences', () => {
    const requestRender = vi.fn();
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const models = [
      { id: 'anthropic/claude-sonnet-4-6', label: 'anthropic/claude-sonnet-4-6' },
      { id: 'openai/gpt-5-mini', label: 'openai/gpt-5-mini' },
      { id: 'openai/gpt-5-codex', label: 'openai/gpt-5-codex' },
    ];

    const submenu = new ModelSelectSubmenu(
      'Observer Model',
      models,
      'anthropic/claude-sonnet-4-6',
      onSelect,
      onCancel,
      { requestRender } as unknown as TUI,
    );

    for (const ch of 'codex') {
      submenu.handleInput(kittyPrintable(ch));
    }

    const lines = renderPlain(submenu).join('\n');

    expect(lines).toContain('openai/gpt-5-codex');
    expect(lines).not.toContain('openai/gpt-5-mini');
    expect(lines).not.toContain('anthropic/claude-sonnet-4-6');

    submenu.handleInput('\r');

    expect(onSelect).toHaveBeenCalledWith('openai/gpt-5-codex');
    expect(onCancel).not.toHaveBeenCalled();
    expect(requestRender).toHaveBeenCalled();
  });
});
