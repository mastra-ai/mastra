import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pi-tui — the real Input/Box components touch the terminal at construction.
// We keep the real WrappingSelectList (imported below) so the multi-select path
// is exercised end-to-end through the component.
vi.mock('@earendil-works/pi-tui', async importOriginal => {
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

  it('freezes the option list with a ✓ on every selected option after answering', () => {
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

    const lines = (component as any).borderedBox.render(60).map((l: string) => l.replace(/\x1b\[[0-9;]*m/g, ''));
    // Question, then the options in place: ✓ on the selected ones, the rest dimmed.
    expect(lines).toEqual(['▎ Which apply?', '▎', '▎ ✓ React', '▎ ✓ Vue', '▎   Svelte']);
  });
});

describe('AskQuestionInlineComponent answered height', () => {
  const opts = [{ label: 'React' }, { label: 'Vue' }, { label: 'Svelte' }];
  const strip = (lines: string[]) => lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
  const create = (overrides: Record<string, unknown> = {}) =>
    new AskQuestionInlineComponent({
      question: 'Which apply?',
      options: opts,
      onSubmit: () => {},
      onSubmitMulti: () => {},
      onCancel: () => {},
      ...overrides,
    });
  const box = (component: AskQuestionInlineComponent) => (component as any).borderedBox;

  // The prompt sits right under the card, so a shorter answered card would pull it up.
  it.each([
    ['single-select answer', {}, ['__tui.select.down__', '__tui.select.confirm__']],
    ['multi-select answer', { selectionMode: 'multi_select' }, [' ', '__tui.select.confirm__']],
    ['cancel', {}, ['__tui.select.cancel__']],
    ['free-text answer', { options: undefined }, []],
  ] as const)('keeps the height it had while waiting after a %s', (_name, overrides, keys) => {
    const component = create(overrides);
    const waiting = box(component).render(60);
    for (const key of keys) component.handleInput(key);
    if (keys.length === 0) component.answer('Svelte');

    const settled = strip(box(component).render(60));
    expect(settled).toHaveLength(waiting.length);
    expect(settled.slice(0, 2)).toEqual(['▎ Which apply?', '▎']);
    expect(settled.join('\n')).toMatch(
      keys[0] === '__tui.select.cancel__' ? /✗ \(cancelled\)/ : /✓ (Vue|React|Svelte)/,
    );
  });

  it('stays compact when it was never shown waiting, as when replayed from history', () => {
    const component = create();
    component.answer('Vue');
    expect(strip(box(component).render(60))).toEqual(['▎ Which apply?', '▎', '▎   React', '▎ ✓ Vue', '▎   Svelte']);
  });
});
