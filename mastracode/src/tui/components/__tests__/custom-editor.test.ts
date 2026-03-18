import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  superHandleInput: vi.fn(),
  superRender: vi.fn(() => ['────', 'hello', '────']),
  getClipboardImage: vi.fn(),
  getClipboardText: vi.fn(),
  matchesKey: vi.fn((_data: string, _key: string) => false),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  chalkHex: vi.fn((_color: string) => (value: string) => value),
  chalkBoldHex: vi.fn((_color: string) => (value: string) => `[hex:${_color}]${value}`),
  chalkBoldRgb: vi.fn((r: number, g: number, b: number) => (value: string) => `[rgb:${r},${g},${b}]${value}`),
}));

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync,
  statSync: mocks.statSync,
}));

vi.mock('@mariozechner/pi-tui', () => {
  class MockEditor {
    constructor(_tui: unknown, _theme: unknown) {}

    handleInput(data: string): void {
      mocks.superHandleInput(data);
    }

    render(_width: number): string[] {
      return mocks.superRender();
    }

    getText(): string {
      return '';
    }

    isShowingAutocomplete(): boolean {
      return false;
    }
  }

  return {
    Editor: MockEditor,
    matchesKey: mocks.matchesKey,
  };
});

vi.mock('../../../clipboard/index.js', () => ({
  getClipboardImage: mocks.getClipboardImage,
  getClipboardText: mocks.getClipboardText,
}));

vi.mock('chalk', () => ({
  default: {
    hex: mocks.chalkHex,
    bold: {
      hex: mocks.chalkBoldHex,
      rgb: mocks.chalkBoldRgb,
    },
  },
}));

import { CustomEditor } from '../custom-editor.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

describe('CustomEditor image paste handling', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.superRender.mockReturnValue(['────', 'hello', '────']);
    mocks.chalkHex.mockImplementation((_color: string) => (value: string) => value);
    mocks.chalkBoldHex.mockImplementation((color: string) => (value: string) => `[hex:${color}]${value}`);
    mocks.chalkBoldRgb.mockImplementation(
      (r: number, g: number, b: number) => (value: string) => `[rgb:${r},${g},${b}]${value}`,
    );
    mocks.matchesKey.mockImplementation((_data: string, _key: string) => false);
    mocks.statSync.mockReturnValue({ isFile: () => true });
    mocks.readFileSync.mockReturnValue(Buffer.from('dragged-image-binary'));
  });

  it('highlights the first visible slash-command match when autocomplete opens', () => {
    const editor = new CustomEditor({} as any, {} as any);

    const items = [{ value: 'new' }, { value: 'diff' }, { value: '/deploy' }];

    expect((editor as any).getBestAutocompleteMatchIndex(items, '/')).toBe(0);
    expect((editor as any).getBestAutocompleteMatchIndex(items, '/d')).toBe(1);
  });

  it('submits a selected slash command on Enter after autocomplete inserts it', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');

    const editor = new CustomEditor({} as any, {} as any);
    const followUp = vi.fn(() => true);
    editor.onAction('followUp', followUp);
    editor.getText = vi.fn(() => '/help ');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\r');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(followUp).toHaveBeenCalledTimes(1);
  });

  it('does not submit non-slash autocomplete selections on Enter', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');

    const editor = new CustomEditor({} as any, {} as any);
    const followUp = vi.fn(() => true);
    editor.onAction('followUp', followUp);
    editor.getText = vi.fn(() => '@package/file.ts');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\r');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(followUp).not.toHaveBeenCalled();
  });

  it('renders a chevron prompt when no animator is active', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => 'hello');
    editor.getModeColor = vi.fn(() => '#16c858');

    const output = editor.render(20).join('\n');

    expect(output).toContain('[rgb:22,200,88]›');
  });

  it('fades the chevron out, fades the pulsing bullet in, then fades back to the chevron on exit', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => 'hello');
    editor.getModeColor = vi.fn(() => '#16c858');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.8,
          getOffset: () => 0,
        }) as any,
    );
    expect(editor.render(20).join('\n')).toContain('[rgb:13,120,53]›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.5,
          getOffset: () => 0,
        }) as any,
    );
    const invisibleOutput = editor.render(20).join('\n');
    expect(invisibleOutput).not.toContain('›');
    expect(invisibleOutput).not.toContain('•');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.2,
          getOffset: () => 0,
        }) as any,
    );
    const transitionedOutput = editor.render(20).join('\n');
    expect(transitionedOutput).toContain('[rgb:13,120,53]•');
    expect(transitionedOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => false,
          getFadeProgress: () => 0,
          getOffset: () => 0.5,
        }) as any,
    );
    const pulsingOutput = editor.render(20).join('\n');
    expect(pulsingOutput).toContain('[rgb:11,100,44]•');
    expect(pulsingOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.2,
          getOffset: () => 0,
        }) as any,
    );
    const fadingOutDotOutput = editor.render(20).join('\n');
    expect(fadingOutDotOutput).toContain('[rgb:13,120,53]•');
    expect(fadingOutDotOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.5,
          getOffset: () => 0,
        }) as any,
    );
    const fadingOutGapOutput = editor.render(20).join('\n');
    expect(fadingOutGapOutput).not.toContain('›');
    expect(fadingOutGapOutput).not.toContain('•');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.8,
          getOffset: () => 0,
        }) as any,
    );
    const returnedChevronOutput = editor.render(20).join('\n');
    expect(returnedChevronOutput).toContain('[rgb:13,120,53]›');
    expect(returnedChevronOutput).not.toContain('•');
  });

  it('keeps slash prompts unanimated while showing the slash character', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => '/help');
    editor.getModeColor = vi.fn(() => '#16c858');
    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          getOffset: () => 0.75,
        }) as any,
    );

    const output = editor.render(20).join('\n');

    expect(output).toContain('[rgb:22,200,88]/');
  });

  it('converts a pasted local image path into an image attachment', () => {
    mocks.getClipboardImage.mockReturnValue({ data: 'clipboard-image', mimeType: 'image/png' });

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}/tmp/dragged-image.jpeg${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: Buffer.from('dragged-image-binary').toString('base64'),
      mimeType: 'image/jpeg',
    });
    expect(mocks.getClipboardImage).not.toHaveBeenCalled();
    expect(mocks.statSync).toHaveBeenCalledWith('/tmp/dragged-image.jpeg');
    expect(mocks.readFileSync).toHaveBeenCalledWith('/tmp/dragged-image.jpeg');
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('supports quoted file urls for pasted local images', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}"file:///tmp/dragged%20image.png"${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: Buffer.from('dragged-image-binary').toString('base64'),
      mimeType: 'image/png',
    });
    expect(mocks.statSync).toHaveBeenCalledWith('/tmp/dragged image.png');
    expect(mocks.readFileSync).toHaveBeenCalledWith('/tmp/dragged image.png');
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('prefers clipboard image data when a pasted remote image url came from copy-image', () => {
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}https://example.com/dragged-image.webp?size=large${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.getClipboardImage).toHaveBeenCalledTimes(1);
    expect(mocks.statSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('falls back to a remote image attachment when clipboard image data is unavailable', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}https://example.com/dragged-image.webp?size=large${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: 'https://example.com/dragged-image.webp?size=large',
      mimeType: 'image/webp',
    });
    expect(mocks.getClipboardImage).toHaveBeenCalledTimes(1);
    expect(mocks.statSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('passes through non-image file paths as text', () => {
    mocks.getClipboardImage.mockReturnValue({ data: 'clipboard-image', mimeType: 'image/png' });

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    const pastedPath = '/tmp/notes.txt';
    editor.handleInput(`${PASTE_START}${pastedPath}${PASTE_END}`);

    expect(onImagePaste).not.toHaveBeenCalled();
    expect(mocks.getClipboardImage).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).toHaveBeenCalledWith(`${PASTE_START}${pastedPath}${PASTE_END}`);
  });

  it('still uses the clipboard image for empty bracketed paste payloads', () => {
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('supports alt+v as an explicit clipboard paste shortcut', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'alt+v');
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput('ignored');

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.getClipboardText).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });
});
