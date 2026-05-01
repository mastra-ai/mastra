import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pi-tui — the real components touch the terminal at construction time.
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
    getEditorKeybindings: () => ({ matches: () => false }),
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
import { MultilineInput } from '../multiline-input.js';

describe('AskQuestionInlineComponent multiline opt-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses single-line Input by default (no multiline option, no tui)', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Name?',
      onSubmit: () => {},
      onCancel: () => {},
    });
    expect((component as any).input).toBeDefined();
    expect((component as any).input).not.toBeInstanceOf(MultilineInput);
  });

  it('uses single-line Input when tui is provided but multiline is not opted in', () => {
    const fakeTui = {} as any;
    const component = new AskQuestionInlineComponent(
      {
        question: 'Name?',
        onSubmit: () => {},
        onCancel: () => {},
      },
      fakeTui,
    );
    expect((component as any).input).not.toBeInstanceOf(MultilineInput);
  });

  it('uses MultilineInput only when multiline: true AND tui is provided', () => {
    const fakeTui = {} as any;
    const component = new AskQuestionInlineComponent(
      {
        question: 'Describe the bug',
        multiline: true,
        onSubmit: () => {},
        onCancel: () => {},
      },
      fakeTui,
    );
    expect((component as any).input).toBeInstanceOf(MultilineInput);
  });

  it('falls back to single-line Input when multiline: true but no tui (headless)', () => {
    const component = new AskQuestionInlineComponent({
      question: 'Describe the bug',
      multiline: true,
      onSubmit: () => {},
      onCancel: () => {},
    });
    expect((component as any).input).not.toBeInstanceOf(MultilineInput);
  });

  it('renders short-form hint when multiline is off', () => {
    const fakeTui = {} as any;
    const component = new AskQuestionInlineComponent(
      {
        question: 'Path?',
        onSubmit: () => {},
        onCancel: () => {},
      },
      fakeTui,
    );
    const hint = (component as any).borderedBox?.hintText;
    expect(hint).toBe('Enter to submit · Esc to skip');
  });

  it('renders multiline hint when multiline is opted in', () => {
    const fakeTui = {} as any;
    const component = new AskQuestionInlineComponent(
      {
        question: 'Describe the bug',
        multiline: true,
        onSubmit: () => {},
        onCancel: () => {},
      },
      fakeTui,
    );
    const hint = (component as any).borderedBox?.hintText;
    expect(hint).toBe('Enter to submit · Shift+Enter/\\+Enter for new line · Esc to skip');
  });
});
