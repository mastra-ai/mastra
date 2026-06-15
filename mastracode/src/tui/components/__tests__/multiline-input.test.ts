import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editorHandleInput: vi.fn(),
  editorGetText: vi.fn(() => ''),
  editorRender: vi.fn(() => ['────', 'hello', '────']),
  matchesKey: vi.fn((_data: string, _key: string) => false),
}));

vi.mock('@mariozechner/pi-tui', () => {
  class MockEditor {
    constructor(_tui: unknown, _theme: unknown) {}
    handleInput(data: string): void {
      mocks.editorHandleInput(data);
    }
    render(_width: number): string[] {
      return mocks.editorRender();
    }
    getText(): string {
      return mocks.editorGetText();
    }
    setText(_text: string): void {}
    invalidate(): void {}
  }

  return {
    Editor: MockEditor,
    matchesKey: mocks.matchesKey,
  };
});

import { MultilineInput } from '../multiline-input.js';

describe('MultilineInput', () => {
  let input: MultilineInput;

  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.editorGetText.mockReturnValue('');
    mocks.editorRender.mockReturnValue(['────', 'hello', '────']);
    mocks.matchesKey.mockImplementation((_data: string, _key: string) => false);
    input = new MultilineInput({} as any, {} as any);
  });

  it('calls onSubmit with the raw editor text when Enter is pressed', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');
    mocks.editorGetText.mockReturnValue('  my answer  ');
    const onSubmit = vi.fn();
    input.onSubmit = onSubmit;

    input.handleInput('\r');

    // Raw text is forwarded so leading indentation / trailing newlines
    // survive — only the emptiness check is trimmed.
    expect(onSubmit).toHaveBeenCalledWith('  my answer  ');
    expect(mocks.editorHandleInput).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when Enter is pressed with empty text', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');
    mocks.editorGetText.mockReturnValue('   ');
    const onSubmit = vi.fn();
    input.onSubmit = onSubmit;

    input.handleInput('\r');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('forwards raw whitespace text when allowEmptySubmit is true and Enter is pressed', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');
    mocks.editorGetText.mockReturnValue('   ');
    const onSubmit = vi.fn();
    input.allowEmptySubmit = true;
    input.onSubmit = onSubmit;

    input.handleInput('\r');

    expect(onSubmit).toHaveBeenCalledWith('   ');
  });

  it('does not call onSubmit when Enter is pressed with no text', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');
    mocks.editorGetText.mockReturnValue('');
    const onSubmit = vi.fn();
    input.onSubmit = onSubmit;

    input.handleInput('\r');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('inserts a newline via editor when Shift+Enter is pressed', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'shift+enter');

    input.handleInput('\x1b[1;2r');

    expect(mocks.editorHandleInput).toHaveBeenCalledWith('\n');
  });

  it('passes backslash+Enter through to editor for newline (pi-tui convention)', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');
    // Simulate cursor being after a backslash
    (input as any).editor.state = {
      lines: ['hello\\'],
      cursorLine: 0,
      cursorCol: 6,
    };

    input.handleInput('\r');

    expect(mocks.editorHandleInput).toHaveBeenCalledWith('\r');
  });

  it('calls onEscape when Escape is pressed', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'escape');
    const onEscape = vi.fn();
    input.onEscape = onEscape;

    input.handleInput('\x1b');

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(mocks.editorHandleInput).not.toHaveBeenCalled();
  });

  it('passes regular character input through to editor', () => {
    input.handleInput('a');

    expect(mocks.editorHandleInput).toHaveBeenCalledWith('a');
  });

  it('passes regular text input through to editor', () => {
    input.handleInput('hello');

    expect(mocks.editorHandleInput).toHaveBeenCalledWith('hello');
  });

  it('strips editor border chrome from render output', () => {
    mocks.editorRender.mockReturnValue(['────', 'hello world', '────']);

    const lines = input.render(40);

    expect(lines).toEqual(['hello world']);
  });

  it('strips scroll indicator lines from render output', () => {
    mocks.editorRender.mockReturnValue(['────', 'line 1', '── ↑ ──', '────']);

    const lines = input.render(40);

    expect(lines).toEqual(['line 1']);
  });

  it('does not strip user content lines containing arrow characters', () => {
    mocks.editorRender.mockReturnValue(['────', 'use ↑ and ↓ to navigate', '────']);

    const lines = input.render(40);

    expect(lines).toEqual(['use ↑ and ↓ to navigate']);
  });

  it('returns at least one empty line when editor has no content', () => {
    mocks.editorRender.mockReturnValue(['────', '────']);

    const lines = input.render(40);

    expect(lines).toEqual(['']);
  });

  it('returns multiple content lines from editor', () => {
    mocks.editorRender.mockReturnValue(['────', 'line 1', 'line 2', 'line 3', '────']);

    const lines = input.render(40);

    expect(lines).toEqual(['line 1', 'line 2', 'line 3']);
  });

  it('tracks focused state', () => {
    expect(input.focused).toBe(false);
    input.focused = true;
    expect(input.focused).toBe(true);
    input.focused = false;
    expect(input.focused).toBe(false);
  });

  it('delegates getText to the editor', () => {
    mocks.editorGetText.mockReturnValue('some text');
    expect(input.getText()).toBe('some text');
  });
});
