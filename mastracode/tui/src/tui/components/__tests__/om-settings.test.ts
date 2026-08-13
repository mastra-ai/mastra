import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';
import type { ModelItem } from '../model-selector.js';
import { ModelSelectorComponent } from '../model-selector.js';
import { OMSettingsComponent, ThresholdSubmenu } from '../om-settings.js';

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

describe('OM settings auto selection', () => {
  it('shows auto intent with the effective concrete model for each role', () => {
    const component = new OMSettingsComponent(
      {
        observerSelection: { mode: 'auto' },
        observerModelId: 'anthropic/claude-haiku-4-5',
        observerAutoModelId: 'anthropic/claude-haiku-4-5',
        reflectorSelection: { mode: 'auto' },
        reflectorModelId: 'anthropic/claude-haiku-4-5',
        reflectorAutoModelId: 'anthropic/claude-haiku-4-5',
        observationThreshold: 30_000,
        reflectionThreshold: 40_000,
        cavemanObservations: false,
        observeAttachments: 'auto',
      },
      {
        onObserverModelChange: vi.fn(),
        onObserverAuto: vi.fn(),
        onReflectorModelChange: vi.fn(),
        onReflectorAuto: vi.fn(),
        onObservationThresholdChange: vi.fn(),
        onReflectionThresholdChange: vi.fn(),
        onCavemanObservationsChange: vi.fn(),
        onObserveAttachmentsChange: vi.fn(),
        onClose: vi.fn(),
      },
      makeModels(),
      { requestRender: vi.fn() } as unknown as TUI,
    );

    const rendered = component
      .render(WIDTH)
      .map(line => stripAnsi(line))
      .join('\n');
    expect(rendered).toContain('Observer model');
    expect(rendered).toContain('Reflector model');
    expect(rendered.match(/Auto \(claude-haiku-4-5\)/g)).toHaveLength(2);
  });
});

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

describe('ThresholdSubmenu', () => {
  function make() {
    const onDone = vi.fn();
    const onBack = vi.fn();
    const menu = new ThresholdSubmenu('Messages before observation', 30000, [10000, 30000, 50000], onDone, onBack);
    return { menu, onDone, onBack };
  }

  it.each([
    ['legacy', '\x1b'],
    ['kitty', '\x1b[27u'],
  ])('goes back on %s Escape from the input box', (_, esc) => {
    const { menu, onDone, onBack } = make();
    menu.handleInput(esc);
    expect(onBack).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
  });

  it.each([
    ['legacy', '\x1b[B'],
    ['kitty', '\x1b[1;1B'],
  ])('moves to the preset list on %s Down from the input box', (_, down) => {
    const { menu, onDone } = make();
    menu.handleInput(down);
    // In preset mode, Enter picks the highlighted preset instead of parsing the (empty) input.
    menu.handleInput('\r');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('submits a typed value on Enter', () => {
    const { menu, onDone } = make();
    menu.handleInput('4');
    menu.handleInput('0');
    menu.handleInput('\r');
    expect(onDone).toHaveBeenCalledWith(40000);
  });
});
