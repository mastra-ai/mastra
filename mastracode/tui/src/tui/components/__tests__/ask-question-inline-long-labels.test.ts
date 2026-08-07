import { visibleWidth } from '@earendil-works/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pi-tui — the real components touch the terminal at construction time.
// Width/wrap helpers (visibleWidth, wrapTextWithAnsi) come from `actual` so the
// wrap path under test executes the real logic.
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
    Input: StubInput,
    Box: StubBox,
    Container: StubContainer,
    Text: StubText,
    Spacer: StubSpacer,
    SelectList: StubSelectList,
    getKeybindings: () => ({ matches: () => false }),
    matchesKey: (_data: string, _key: string) => false,
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
    getText(): string {
      return '';
    }
    setText(_text: string): void {}
  }
  return { MultilineInput: StubMultilineInput };
});

import { AskQuestionInlineComponent } from '../ask-question-inline.js';

const TERMINAL_WIDTH = 80;
const LONG_LABEL =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';

function maxLineWidth(lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, visibleWidth(line)), 0);
}

describe('AskQuestionInlineComponent long-label wrapping (issue #17002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps long option labels in streaming state without overflowing the bordered box', () => {
    const component = AskQuestionInlineComponent.createStreaming();
    component.updateArgs({
      question: 'Pick one',
      options: [{ label: LONG_LABEL }],
    });
    const box = (component as any).borderedBox;
    const lines = box.render(TERMINAL_WIDTH) as string[];
    expect(maxLineWidth(lines)).toBeLessThanOrEqual(TERMINAL_WIDTH);
  });

  it('wraps long answered selected/unselected labels without overflowing', () => {
    const component = AskQuestionInlineComponent.fromHistory(
      'Pick one',
      [{ label: LONG_LABEL }, { label: 'Short' }],
      LONG_LABEL,
      false,
    );
    const box = (component as any).borderedBox;
    const lines = box.render(TERMINAL_WIDTH) as string[];
    expect(maxLineWidth(lines)).toBeLessThanOrEqual(TERMINAL_WIDTH);
  });

  it('wraps long labels in answered cancelled state without overflowing', () => {
    const component = AskQuestionInlineComponent.fromHistory('Pick one', [{ label: LONG_LABEL }], '', true);
    const box = (component as any).borderedBox;
    const lines = box.render(TERMINAL_WIDTH) as string[];
    expect(maxLineWidth(lines)).toBeLessThanOrEqual(TERMINAL_WIDTH);
  });
});
