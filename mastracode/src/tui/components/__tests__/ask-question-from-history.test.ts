import { describe, expect, it, vi } from 'vitest';

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

import { AskQuestionInlineComponent } from '../ask-question-inline.js';

function readBoxState(component: AskQuestionInlineComponent): {
  selectedValue: string | undefined;
  selectedValues: Set<string> | undefined;
  cancelled: boolean;
  answered: boolean;
} {
  const box = (component as unknown as { borderedBox: Record<string, unknown> }).borderedBox;
  return {
    selectedValue: box.selectedValue as string | undefined,
    selectedValues: box.selectedValues as Set<string> | undefined,
    cancelled: Boolean(box.cancelled),
    answered: Boolean(box.answered),
  };
}

describe('AskQuestionInlineComponent.fromHistory multi-select restoration', () => {
  it('reconstructs multi-select state from a comma-joined answer', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick all that apply',
      [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
      'Alpha, Gamma',
      false,
      'multi_select',
    );

    const box = readBoxState(component);
    expect(box.answered).toBe(true);
    expect(box.cancelled).toBe(false);
    expect(box.selectedValues).toEqual(new Set(['Alpha', 'Gamma']));
    expect(box.selectedValue).toBeUndefined();
  });

  it('reconstructs a single-element multi-select answer', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick all that apply',
      [{ label: 'Alpha' }, { label: 'Beta' }],
      'Alpha',
      false,
      'multi_select',
    );

    const box = readBoxState(component);
    expect(box.selectedValues).toEqual(new Set(['Alpha']));
  });

  it('preserves item order in the reconstructed set independent of answer-string order', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick all that apply',
      [{ label: 'Alpha' }, { label: 'Beta' }, { label: 'Gamma' }],
      'Gamma, Alpha',
      false,
      'multi_select',
    );

    const box = readBoxState(component);
    expect(box.selectedValues).toEqual(new Set(['Alpha', 'Gamma']));
  });

  it('falls back to single-string render when comma-split matches no option', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick all that apply',
      [{ label: 'Alpha' }, { label: 'Beta' }],
      'something unrelated',
      false,
      'multi_select',
    );

    const box = readBoxState(component);
    expect(box.selectedValues).toBeUndefined();
    expect(box.selectedValue).toBe('something unrelated');
  });

  it('renders single-select answers via setAnswered, not setAnsweredMulti', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick one',
      [{ label: 'Alpha' }, { label: 'Beta' }],
      'Alpha',
      false,
      'single_select',
    );

    const box = readBoxState(component);
    expect(box.selectedValues).toBeUndefined();
    expect(box.selectedValue).toBe('Alpha');
  });

  it('ignores selectionMode when answer is cancelled', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick all that apply',
      [{ label: 'Alpha' }],
      '(skipped)',
      true,
      'multi_select',
    );

    const box = readBoxState(component);
    expect(box.cancelled).toBe(true);
    expect(box.selectedValues).toBeUndefined();
  });

  it('keeps prior single-string behavior when selectionMode is not provided', () => {
    const component = AskQuestionInlineComponent.fromHistory('Free text question', undefined, 'my answer', false);

    const box = readBoxState(component);
    expect(box.selectedValues).toBeUndefined();
    expect(box.selectedValue).toBe('my answer');
  });
});
