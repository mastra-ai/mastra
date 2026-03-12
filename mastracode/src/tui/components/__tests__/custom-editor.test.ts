import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  superHandleInput: vi.fn(),
  getClipboardImage: vi.fn(),
  getClipboardText: vi.fn(),
  matchesKey: vi.fn((_data: string, _key: string) => false),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
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

import { CustomEditor } from '../custom-editor.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

describe('CustomEditor image paste handling', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.matchesKey.mockImplementation((_data: string, _key: string) => false);
    mocks.statSync.mockReturnValue({ isFile: () => true });
    mocks.readFileSync.mockReturnValue(Buffer.from('dragged-image-binary'));
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
