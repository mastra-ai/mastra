/**
 * Custom editor that handles app-level keybindings for Mastra Code.
 */

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor, matchesKey } from '@mariozechner/pi-tui';
import type { EditorTheme, TUI } from '@mariozechner/pi-tui';
import { getClipboardImage, getClipboardText } from '../../clipboard/index.js';
import type { ClipboardImage } from '../../clipboard/index.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const IMAGE_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

export type AppAction =
  | 'clear'
  | 'exit'
  | 'suspend'
  | 'undo'
  | 'toggleThinking'
  | 'expandTools'
  | 'followUp'
  | 'cycleMode'
  | 'toggleYolo';

export class CustomEditor extends Editor {
  private actionHandlers: Map<AppAction, () => unknown> = new Map();

  public onCtrlD?: () => void;
  public escapeEnabled = true;
  public onImagePaste?: (image: ClipboardImage) => void;

  private pendingBracketedPaste: string | null = null;

  constructor(tui: TUI, theme: EditorTheme) {
    super(tui, theme);
    (this as any).getBestAutocompleteMatchIndex = (
      items: Array<{ value: string }>,
      prefix: string,
    ): number => {
      if (!prefix) {
        return -1;
      }

      const normalizeSlashCommandValue = (value: string) => value.replace(/^\/+/, '');
      const shouldNormalizeSlashCommand = prefix.startsWith('/');
      const normalizedPrefix = shouldNormalizeSlashCommand ? normalizeSlashCommandValue(prefix) : prefix;

      let firstPrefixIndex = -1;
      for (let i = 0; i < items.length; i++) {
        const value = items[i]?.value ?? '';
        const comparableValue = shouldNormalizeSlashCommand ? normalizeSlashCommandValue(value) : value;

        if (comparableValue === normalizedPrefix) {
          return i;
        }

        if (firstPrefixIndex === -1 && comparableValue.startsWith(normalizedPrefix)) {
          firstPrefixIndex = i;
        }
      }

      return firstPrefixIndex;
    };
  }

  onAction(action: AppAction, handler: () => unknown): void {
    this.actionHandlers.set(action, handler);
  }

  private maybeHandleBracketedPaste(data: string): boolean {
    const pasteStartIndex = this.pendingBracketedPaste ? -1 : data.indexOf(PASTE_START);
    if (!this.pendingBracketedPaste && pasteStartIndex === -1) {
      return false;
    }

    const beforePaste = this.pendingBracketedPaste ? '' : data.slice(0, pasteStartIndex);
    const pasteChunk = this.pendingBracketedPaste
      ? `${this.pendingBracketedPaste}${data}`
      : data.slice(pasteStartIndex);

    if (beforePaste) {
      super.handleInput(beforePaste);
    }

    const pasteEndIndex = pasteChunk.indexOf(PASTE_END);
    if (pasteEndIndex === -1) {
      this.pendingBracketedPaste = pasteChunk;
      return true;
    }

    this.pendingBracketedPaste = null;

    const pasteContent = pasteChunk.slice(PASTE_START.length, pasteEndIndex);
    const afterPaste = pasteChunk.slice(pasteEndIndex + PASTE_END.length);

    if (this.shouldPasteClipboardImage(pasteContent)) {
      const clipboardImage = getClipboardImage();
      if (clipboardImage) {
        this.onImagePaste?.(clipboardImage);
        if (afterPaste.length > 0) {
          this.handleInput(afterPaste);
        }
        return true;
      }
    }

    const clipboardImageForRemoteUrl = this.getClipboardImageForPastedRemoteImageUrl(pasteContent);
    if (clipboardImageForRemoteUrl) {
      this.onImagePaste?.(clipboardImageForRemoteUrl);
      if (afterPaste.length > 0) {
        this.handleInput(afterPaste);
      }
      return true;
    }

    const pastedImageSource = this.readPastedImageSource(pasteContent);
    if (pastedImageSource) {
      this.onImagePaste?.(pastedImageSource);
      if (afterPaste.length > 0) {
        this.handleInput(afterPaste);
      }
      return true;
    }

    super.handleInput(`${PASTE_START}${pasteContent}${PASTE_END}`);
    if (afterPaste.length > 0) {
      this.handleInput(afterPaste);
    }
    return true;
  }

  private shouldPasteClipboardImage(pasteContent: string): boolean {
    return Boolean(this.onImagePaste) && pasteContent.trim().length === 0;
  }

  private getClipboardImageForPastedRemoteImageUrl(pasteContent: string): ClipboardImage | null {
    if (!this.onImagePaste) {
      return null;
    }

    if (!this.normalizePastedImageUrl(this.normalizePastedPathLike(pasteContent) ?? '')) {
      return null;
    }

    return getClipboardImage();
  }

  private readPastedImageSource(pasteContent: string): ClipboardImage | null {
    if (!this.onImagePaste) {
      return null;
    }

    const normalizedPaste = this.normalizePastedPathLike(pasteContent);
    if (!normalizedPaste) {
      return null;
    }

    const imageUrl = this.normalizePastedImageUrl(normalizedPaste);
    if (imageUrl) {
      const mimeType = this.getImageMimeType(imageUrl);
      return mimeType
        ? {
            data: imageUrl,
            mimeType,
          }
        : null;
    }

    const filePath = this.normalizePastedFilePath(normalizedPaste);
    if (!filePath) {
      return null;
    }

    const mimeType = this.getImageMimeType(filePath);
    if (!mimeType) {
      return null;
    }

    try {
      if (!statSync(filePath).isFile()) {
        return null;
      }

      return {
        data: readFileSync(filePath).toString('base64'),
        mimeType,
      };
    } catch {
      return null;
    }
  }

  private normalizePastedPathLike(pasteContent: string): string | null {
    const trimmed = pasteContent.trim();
    if (!trimmed || trimmed.includes('\n')) {
      return null;
    }

    const unquoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
        ? trimmed.slice(1, -1)
        : trimmed;

    return unquoted.replace(/\\([ !$&'()\[\]{}])/g, '$1');
  }

  private normalizePastedImageUrl(pasteContent: string): string | null {
    if (!/^https?:\/\//i.test(pasteContent)) {
      return null;
    }

    try {
      const url = new URL(pasteContent);
      return this.getImageMimeType(url.toString()) ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private normalizePastedFilePath(pasteContent: string): string | null {
    if (/^https?:\/\//i.test(pasteContent)) {
      return null;
    }

    if (/^file:\/\//i.test(pasteContent)) {
      try {
        return fileURLToPath(pasteContent);
      } catch {
        return null;
      }
    }

    return pasteContent;
  }

  private getImageMimeType(pathOrUrl: string): string | null {
    const extensionSource = /^https?:\/\//i.test(pathOrUrl) ? new URL(pathOrUrl).pathname : pathOrUrl;
    return IMAGE_MIME_TYPES_BY_EXTENSION[extname(extensionSource).toLowerCase()] ?? null;
  }

  private handleExplicitPaste(): boolean {
    if (this.onImagePaste) {
      const clipboardImage = getClipboardImage();
      if (clipboardImage) {
        this.onImagePaste(clipboardImage);
        return true;
      }
    }

    const clipboardText = getClipboardText();
    if (clipboardText) {
      const syntheticPaste = `${PASTE_START}${clipboardText}${PASTE_END}`;
      super.handleInput(syntheticPaste);
      return true;
    }

    return true;
  }

  handleInput(data: string): void {
    if (this.maybeHandleBracketedPaste(data)) {
      return;
    }

    if (matchesKey(data, 'ctrl+v') || matchesKey(data, 'alt+v')) {
      this.handleExplicitPaste();
      return;
    }

    if (matchesKey(data, 'ctrl+c')) {
      const handler = this.actionHandlers.get('clear');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'escape') && this.escapeEnabled) {
      const handler = this.actionHandlers.get('clear');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'ctrl+d')) {
      if (this.getText().length === 0) {
        const handler = this.onCtrlD ?? this.actionHandlers.get('exit');
        if (handler) handler();
      }
      return;
    }

    if (matchesKey(data, 'ctrl+z')) {
      const handler = this.actionHandlers.get('suspend');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'alt+z')) {
      const handler = this.actionHandlers.get('undo');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'ctrl+t')) {
      const handler = this.actionHandlers.get('toggleThinking');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'ctrl+e')) {
      const handler = this.actionHandlers.get('expandTools');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'enter')) {
      const handler = this.actionHandlers.get('followUp');
      if (handler) {
        if (this.isShowingAutocomplete()) {
          super.handleInput('\t');
          if (this.getText().trimStart().startsWith('/') && handler() !== false) {
            return;
          }
          return;
        }
        if (handler() !== false) {
          return;
        }
      }
    }

    if (matchesKey(data, 'shift+tab')) {
      const handler = this.actionHandlers.get('cycleMode');
      if (handler) {
        handler();
        return;
      }
    }

    if (matchesKey(data, 'ctrl+y')) {
      const handler = this.actionHandlers.get('toggleYolo');
      if (handler) {
        handler();
        return;
      }
    }

    super.handleInput(data);
  }
}
