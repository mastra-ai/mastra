import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub pi-tui so component construction doesn't touch a real terminal.
vi.mock('@mariozechner/pi-tui', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  class StubBox {
    children: unknown[] = [];
    constructor(..._args: unknown[]) {}
    addChild(c: unknown): void {
      this.children.push(c);
    }
    removeChild(_c: unknown): void {}
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
  class StubInput {
    onSubmit?: (value: string) => void;
    focused = false;
    handleInput(_data: string): void {}
    render(): string[] {
      return [''];
    }
  }
  class StubSelectList {
    onSelect?: (item: unknown) => void;
    onCancel?: () => void;
    constructor(
      public items: unknown[],
      _h: number,
      _theme: unknown,
    ) {}
    handleInput(_data: string): void {}
    render(): string[] {
      return [''];
    }
  }
  return {
    ...actual,
    Box: StubBox,
    Container: StubContainer,
    Text: StubText,
    Spacer: StubSpacer,
    Input: StubInput,
    SelectList: StubSelectList,
    getKeybindings: () => ({ matches: () => false }),
  };
});

vi.mock('../multiline-input.js', () => {
  class StubMultilineInput {
    onSubmit?: (value: string) => void;
    onEscape?: () => void;
    allowEmptySubmit = false;
    focused = false;
    constructor(_tui: unknown, _theme: unknown) {}
    handleInput(_data: string): void {}
    render(): string[] {
      return [''];
    }
  }
  return { MultilineInput: StubMultilineInput };
});

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';
import { AskQuestionInlineComponent } from '../ask-question-inline.js';

describe('multi-select onSubmit fallback when onSubmitMulti is omitted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inline: forwards joined values to onSubmit when onSubmitMulti is missing', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const component = new AskQuestionInlineComponent({
      question: 'Pick',
      options: [{ label: 'Alpha' }, { label: 'Beta' }],
      selectionMode: 'multi_select',
      onSubmit,
      onCancel,
    });

    // Reach into the private multi-select primitive and submit two values.
    const multi = (component as unknown as { multiSelectList: { onSubmit?: (v: string[]) => void } }).multiSelectList;
    expect(multi).toBeDefined();
    multi.onSubmit?.(['Alpha', 'Beta']);

    expect(onSubmit).toHaveBeenCalledWith('Alpha, Beta');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('inline: prefers onSubmitMulti when provided and never joins', () => {
    const onSubmit = vi.fn();
    const onSubmitMulti = vi.fn();
    const onCancel = vi.fn();
    const component = new AskQuestionInlineComponent({
      question: 'Pick',
      options: [{ label: 'Alpha' }, { label: 'Beta' }],
      selectionMode: 'multi_select',
      onSubmit,
      onSubmitMulti,
      onCancel,
    });

    const multi = (component as unknown as { multiSelectList: { onSubmit?: (v: string[]) => void } }).multiSelectList;
    multi.onSubmit?.(['Alpha']);

    expect(onSubmitMulti).toHaveBeenCalledWith(['Alpha']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('dialog: forwards joined values to onSubmit when onSubmitMulti is missing', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const component = new AskQuestionDialogComponent({
      question: 'Pick',
      options: [{ label: 'Alpha' }, { label: 'Gamma' }],
      selectionMode: 'multi_select',
      onSubmit,
      onCancel,
    });

    const multi = (component as unknown as { multiSelectList: { onSubmit?: (v: string[]) => void } }).multiSelectList;
    expect(multi).toBeDefined();
    multi.onSubmit?.(['Alpha', 'Gamma']);

    expect(onSubmit).toHaveBeenCalledWith('Alpha, Gamma');
  });

  it('dialog: prefers onSubmitMulti when provided', () => {
    const onSubmit = vi.fn();
    const onSubmitMulti = vi.fn();
    const onCancel = vi.fn();
    const component = new AskQuestionDialogComponent({
      question: 'Pick',
      options: [{ label: 'Alpha' }, { label: 'Gamma' }],
      selectionMode: 'multi_select',
      onSubmit,
      onSubmitMulti,
      onCancel,
    });

    const multi = (component as unknown as { multiSelectList: { onSubmit?: (v: string[]) => void } }).multiSelectList;
    multi.onSubmit?.(['Gamma']);

    expect(onSubmitMulti).toHaveBeenCalledWith(['Gamma']);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
