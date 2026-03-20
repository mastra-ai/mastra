import type { TUI } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mariozechner/pi-tui', () => {
  class MockNode {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
      return child;
    }
    clear() {
      this.children = [];
    }
  }

  class Box extends MockNode {
    constructor(..._args: any[]) {
      super();
    }
  }

  class Container extends MockNode {}

  class Input extends MockNode {
    value = '';
    focused = false;
    onSubmit?: (value: string) => void;
    getValue() {
      return this.value;
    }
    handleInput(keyData: string) {
      if (keyData === '\r') {
        this.onSubmit?.(this.value);
        return;
      }
      if (keyData === '\u007f') {
        this.value = this.value.slice(0, -1);
        return;
      }
      if (keyData.length === 1) {
        this.value += keyData;
      }
    }
  }

  class Text {
    constructor(
      public text: string,
      public x = 0,
      public y = 0,
    ) {}
  }

  class Spacer {
    constructor(public size: number) {}
  }

  return {
    Box,
    Container,
    Input,
    Text,
    Spacer,
    fuzzyFilter: (items: any[], query: string, getText: (item: any) => string) =>
      items.filter(item => getText(item).toLowerCase().includes(query.toLowerCase())),
    getKeybindings: () => ({
      matches: (keyData: string, action: string) => {
        if (action === 'tui.select.up') return keyData === 'UP';
        if (action === 'tui.select.down') return keyData === 'DOWN';
        if (action === 'tui.select.confirm') return keyData === '\r';
        if (action === 'tui.select.cancel') return keyData === 'ESC';
        return false;
      },
    }),
  };
});

vi.mock('../../theme.js', () => ({
  theme: {
    bg: (_token: string, text: string) => text,
    bold: (text: string) => text,
    fg: (_token: string, text: string) => text,
    getTheme: () => ({ dim: '#888888', text: '#ffffff' }),
  },
}));

vi.mock('chalk', () => ({
  default: {
    hex: () => (text: string) => text,
    bgHex: () => ({
      white: { bold: (text: string) => text },
    }),
  },
}));

import type { ModelItem } from '../model-selector.js';
import { ModelSelectorComponent } from '../model-selector.js';

function makeModel(id: string, hasApiKey = true): ModelItem {
  const [provider = '', modelName = ''] = id.split('/');
  return { id, provider, modelName, hasApiKey };
}

function createSelector(models: ModelItem[], currentModelId?: string) {
  const onSelect = vi.fn<(model: ModelItem) => void>();
  const onCancel = vi.fn<() => void>();
  const requestRender = vi.fn();
  const tui = { requestRender } as unknown as TUI;

  const selector = new ModelSelectorComponent({
    tui,
    models,
    currentModelId,
    onSelect,
    onCancel,
  });

  return { selector, onSelect, onCancel, requestRender };
}

describe('ModelSelectorComponent keybindings', () => {
  const models = [makeModel('anthropic/claude-sonnet-4'), makeModel('openai/gpt-5'), makeModel('google/gemini-3')];

  it('selects first model on immediate confirm', () => {
    const { selector, onSelect } = createSelector(models);

    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0].id).toBe('anthropic/claude-sonnet-4');
  });

  it('navigates down and selects second model', () => {
    const { selector, onSelect } = createSelector(models);

    selector.handleInput('DOWN');
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0].id).toBe('google/gemini-3');
  });

  it('wraps around when navigating down past last item', () => {
    const { selector, onSelect } = createSelector(models);

    // Navigate past all 3 items — should wrap to first
    selector.handleInput('DOWN');
    selector.handleInput('DOWN');
    selector.handleInput('DOWN');
    selector.handleInput('\r');

    expect(onSelect.mock.calls[0]![0].id).toBe('anthropic/claude-sonnet-4');
  });

  it('wraps around when navigating up from first item', () => {
    const { selector, onSelect } = createSelector(models);

    // Navigate up from first — should wrap to last
    selector.handleInput('UP');
    selector.handleInput('\r');

    expect(onSelect.mock.calls[0]![0].id).toBe('openai/gpt-5');
  });

  it('calls onCancel on escape', () => {
    const { selector, onCancel, onSelect } = createSelector(models);

    selector.handleInput('ESC');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls requestRender on navigation', () => {
    const { selector, requestRender } = createSelector(models);

    selector.handleInput('DOWN');

    expect(requestRender).toHaveBeenCalled();
  });

  it('calls requestRender on search input', () => {
    const { selector, requestRender } = createSelector(models);

    selector.handleInput('g');

    expect(requestRender).toHaveBeenCalled();
  });
});
