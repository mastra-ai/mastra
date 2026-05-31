import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pi-tui — the real Input/Box components touch the terminal at construction.
// We keep the real WrappingSelectList (imported below) so the multi-select path
// is exercised end-to-end through the component.
vi.mock('@mariozechner/pi-tui', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  class StubInput {
    onSubmit?: (value: string) => void;
    focused = false;
    handleInput(_data: string): void {}
    render(_width: number): string[] {
      return [''];
    }
  }
  class StubBox {
    children: unknown[] = [];
    addChild(c: unknown): void {
      this.children.push(c);
    }
    invalidate(): void {}
  }
  class StubContainer extends StubBox {}
  class StubText {
    constructor(_text: string, _x: number, _y: number) {}
    render(): string[] {
      return [''];
    }
  }
  class StubSpacer {
    constructor(_height: number) {}
    render(): string[] {
      return [''];
    }
  }
  return {
    ...actual,
    Input: StubInput,
    Box: StubBox,
    Container: StubContainer,
    Text: StubText,
    Spacer: StubSpacer,
    // Recognise the sentinel keybinding markers the tests send directly.
    getKeybindings: () => ({
      matches: (data: string, key: string) => data === `__${key}__`,
    }),
  };
});

import { AskQuestionInlineComponent } from '../ask-question-inline.js';

describe('AskQuestionInlineComponent multi-select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const opts = [{ label: 'React' }, { label: 'Vue' }, { label: 'Svelte' }];

  it('renders the multi-select hint when selectionMode is multi_select', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      selectionMode: 'multi_select',
      onSubmit: () => {},
      onCancel: () => {},
    });
    expect((component as any).borderedBox?.hintText).toBe('Space to toggle · Enter to confirm · Esc to skip');
  });

  it('renders the single-select hint by default', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Which one?',
      options: opts,
      onSubmit: () => {},
      onCancel: () => {},
    });
    expect((component as any).borderedBox?.hintText).toBe('↑↓ to navigate · Enter to select · Esc to skip');
  });

  it('omits the "Custom response..." escape hatch in multi-select mode', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      selectionMode: 'multi_select',
      onSubmit: () => {},
      onCancel: () => {},
    });
    const listItems = (component as any).selectList?.items as Array<{ value: string }>;
    expect(listItems.some(i => i.value === '__custom_response__')).toBe(false);
    expect(listItems).toHaveLength(opts.length);
  });

  it('calls onSubmitMulti with the toggled labels on confirm', () => {
    const onSubmitMulti = vi.fn();
    const onSubmit = vi.fn();
    const component = new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      selectionMode: 'multi_select',
      onSubmit,
      onSubmitMulti,
      onCancel: () => {},
    });

    // Toggle React, move to Svelte, toggle it, then confirm.
    component.handleInput(' ');
    component.handleInput('__tui.select.down__');
    component.handleInput('__tui.select.down__');
    component.handleInput(' ');
    component.handleInput('__tui.select.confirm__');

    expect(onSubmitMulti).toHaveBeenCalledWith(['React', 'Svelte']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('falls back to a comma-joined string on onSubmit when onSubmitMulti is omitted', () => {
    const onSubmit = vi.fn();
    const component = new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      selectionMode: 'multi_select',
      onSubmit,
      onCancel: () => {},
    });

    component.handleInput(' '); // React
    component.handleInput('__tui.select.down__');
    component.handleInput(' '); // Vue
    component.handleInput('__tui.select.confirm__');

    expect(onSubmit).toHaveBeenCalledWith('React, Vue');
  });

  it('freezes the box showing every selected option after answering', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      selectionMode: 'multi_select',
      onSubmit: () => {},
      onSubmitMulti: () => {},
      onCancel: () => {},
    });

    component.handleInput(' '); // React
    component.handleInput('__tui.select.down__');
    component.handleInput(' '); // Vue
    component.handleInput('__tui.select.confirm__');

    const lines = (component as any).borderedBox.render(60).join('\n');
    // Selected options get a ✓, the unselected one is dimmed (no ✓).
    expect(lines).toContain('✓');
    expect(lines).toContain('React');
    expect(lines).toContain('Vue');
    expect(lines).toContain('Svelte');
  });
});
