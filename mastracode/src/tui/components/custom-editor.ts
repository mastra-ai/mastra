/**
 * Custom editor that handles app-level keybindings for Mastra Code.
 */

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor, matchesKey } from '@mariozechner/pi-tui';
import type { EditorTheme, TUI } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { mastra, theme } from '../theme.js';
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

// Pre-compiled constants (avoid re-creation per render)
const ANSI_STRIP_RE = /\x1b\[[0-9;]*m/g;
const SLASH_CURSOR_RE = /\x1b\[7m\/\x1b\[0m/;
const AT_CURSOR_RE = /\x1b\[7m@\x1b\[0m/;
const APPLE_COLORS: [number, number, number][] = [
  [94, 158, 255],   // soft blue
  [167, 139, 250],  // violet
  [232, 121, 168],  // rose pink
  [244, 162, 97],   // warm peach
];

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}



export class CustomEditor extends Editor {
  private actionHandlers: Map<AppAction, () => unknown> = new Map();

  public onCtrlD?: () => void;
  public escapeEnabled = true;
  public onImagePaste?: (image: ClipboardImage) => void;
  public getModeColor?: () => string | undefined;
  public getGradientInfo?: () => { offset: number; fade: number; running: boolean } | undefined;

  private pendingBracketedPaste: string | null = null;

  // Render caches
  private _cachedModeColorHex?: string;
  private _cachedModeColorRgb?: [number, number, number];
  // Border cache — keyed on (offset, fade, width, contentLineCount, color)
  private _borderCacheKey = '';
  private _cachedTopBorder = '';
  private _cachedBottomBorder = '';
  private _cachedLeftBorders: string[] = [];
  private _cachedRightBorders: string[] = [];
  private _cachedColorFn?: (s: string) => string;

  constructor(tui: TUI, theme: EditorTheme) {
    super(tui, theme);
    (this as any).getBestAutocompleteMatchIndex = (items: Array<{ value: string }>, prefix: string): number => {
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

  render(width: number): string[] {
    const text = this.getText().trimStart();
    const isSlash = text.startsWith('/');
    const isAt = text.startsWith('@');
    const color = this.getModeColor?.() || mastra.green;
    const promptChar = isSlash ? '/' : isAt ? '@' : '›';

    // Cache colorFn and prompt — only recreate when color changes
    if (this._cachedModeColorHex !== color) {
      this._cachedModeColorHex = color;
      this._cachedModeColorRgb = parseHex(color);
      this._cachedColorFn = chalk.hex(color);
      this._borderCacheKey = ''; // invalidate border cache on color change
    }
    const colorFn = this._cachedColorFn!;
    const b = colorFn;
    // Prompt changes with slash/at mode, so rebuild each time (cheap)
    const prompt = chalk.bold.hex(color)(promptChar);

    // Box structure: "│ > content │" or "│   content │"
    // Left: "│ > " (4) or "│   " (4), Right: " │" (2) = 6 chars total
    const promptWidth = 4; // "│ > " or "│   "
    const contentWidth = width - 6;
    // Editor renders at content width (prompt char space is separate)
    const editorLines = super.render(contentWidth);

    // Extract content lines (skip editor's invisible borders)
    const contentLines: string[] = [];
    const scrollIndicators: string[] = [];
    let isTop = true;
    for (const line of editorLines) {
      const stripped = line.replace(ANSI_STRIP_RE, '');
      if (stripped.length > 0 && stripped[0] === '─') {
        if (isTop) { isTop = false; continue; }
        if (stripped.includes('↑') || stripped.includes('↓')) {
          scrollIndicators.push(b(stripped));
          continue;
        }
        continue;
      }
      contentLines.push(line);
    }

    // Strip leading "/" or "@" from first content line when shown in prompt
    if ((isSlash || isAt) && contentLines.length > 0) {
      let l = contentLines[0]!;
      const char = isSlash ? '/' : '@';
      // Handle cursor-highlighted char (reverse video)
      l = l.replace(isSlash ? SLASH_CURSOR_RE : AT_CURSOR_RE, '');
      // Remove the first plain occurrence
      const idx = l.indexOf(char);
      if (idx !== -1) {
        l = l.slice(0, idx) + l.slice(idx + 1);
      }
      contentLines[0] = l;
    }

    // Build rounded box
    const result: string[] = [];
    const hBarLen = width - 2;

    // Gradient animation for border
    const gradInfo = this.getGradientInfo?.();
    const animating = gradInfo?.running;
    const modeColorRgb = this._cachedModeColorRgb!;

    // Build a cache key from animation state + dimensions
    // Borders only change when animation params or box dimensions change
    const cacheKey = animating
      ? `${gradInfo!.offset.toFixed(4)}:${gradInfo!.fade.toFixed(3)}:${width}:${contentLines.length}:${color}`
      : `static:${width}:${contentLines.length}:${color}`;

    if (cacheKey !== this._borderCacheKey) {
      // Recompute all border strings
      this._borderCacheKey = cacheKey;
      const perimeterLen = width * 2 + contentLines.length * 2;

      // Pre-compute shared animation values (constant for all chars in this frame)
      let breath = 0;
      let inhaleBright = 0;
      let inhaleR = 0, inhaleG = 0, inhaleB = 0;
      let exhaleBright = 0;
      let easedFade = 0;
      let offsetVal = 0;

      if (animating) {
        const { offset, fade } = gradInfo!;
        offsetVal = offset;
        const breathPhase = offset * 0.6 * Math.PI * 2;
        const breathRaw = (Math.sin(breathPhase - Math.PI / 2) + 1) / 2;
        breath = breathRaw * breathRaw * (3 - 2 * breathRaw); // smoothstep
        inhaleBright = 0.4 + 0.5 * breath;
        inhaleR = modeColorRgb[0] * inhaleBright;
        inhaleG = modeColorRgb[1] * inhaleBright;
        inhaleB = modeColorRgb[2] * inhaleBright;
        exhaleBright = 0.55 + 0.25 * (1 - breath);
        easedFade = fade * fade * (3 - 2 * fade);
      }

      const borderChar = (ch: string, perimPos: number): string => {
        if (!animating) return b(ch);

        // Exhale: apple colors spinning radially (per-char computation)
        const norm = perimPos / perimeterLen;
        const radialPos = (norm + offsetVal * 0.15) % 1;
        const stopCount = APPLE_COLORS.length;
        const scaledPos = radialPos * stopCount;
        const si = Math.floor(scaledPos) % stopCount;
        const frac = scaledPos - Math.floor(scaledPos);
        const ni = (si + 1) % stopCount;
        const eA = APPLE_COLORS[si]!, eB = APPLE_COLORS[ni]!;
        const exR = (eA[0] + (eB[0] - eA[0]) * frac) * exhaleBright;
        const exG = (eA[1] + (eB[1] - eA[1]) * frac) * exhaleBright;
        const exB = (eA[2] + (eB[2] - eA[2]) * frac) * exhaleBright;

        // Crossfade exhale → inhale based on breath
        const bR = exR + (inhaleR - exR) * breath;
        const bG = exG + (inhaleG - exG) * breath;
        const bB = exB + (inhaleB - exB) * breath;

        // Fade toward static mode color
        const fR = bR + (modeColorRgb[0] - bR) * easedFade;
        const fG = bG + (modeColorRgb[1] - bG) * easedFade;
        const fB = bB + (modeColorRgb[2] - bB) * easedFade;

        return chalk.rgb(Math.round(fR), Math.round(fG), Math.round(fB))(ch);
      };

      // Top border
      let top = borderChar('╭', 0);
      for (let i = 0; i < hBarLen; i++) top += borderChar('─', i + 1);
      top += borderChar('╮', width - 1);
      this._cachedTopBorder = top;

      // Side borders
      this._cachedLeftBorders = [];
      this._cachedRightBorders = [];
      for (let i = 0; i < contentLines.length; i++) {
        const leftPerim = perimeterLen - 1 - i;
        const rightPerim = width + i;
        this._cachedLeftBorders.push(borderChar('│', leftPerim));
        this._cachedRightBorders.push(borderChar('│', rightPerim));
      }

      // Bottom border
      const bottomStart = width + contentLines.length;
      let bottom = borderChar('╰', bottomStart + width - 1);
      for (let i = 0; i < hBarLen; i++) bottom += borderChar('─', bottomStart + width - 2 - i);
      bottom += borderChar('╯', bottomStart);
      this._cachedBottomBorder = bottom;
    }

    // Assemble box from cached borders + fresh content
    // Wrap editor content with explicit text color so it adapts to light/dark mode
    const textColorOpen = `\x1b[38;2;${parseHex(theme.getTheme().text).join(';')}m`;
    const textColorClose = '\x1b[39m';
    result.push(this._cachedTopBorder);

    for (let i = 0; i < contentLines.length; i++) {
      const line = `${textColorOpen}${contentLines[i]!}${textColorClose}`;
      const leftBorder = this._cachedLeftBorders[i] ?? b('│');
      const rightBorder = this._cachedRightBorders[i] ?? b('│');
      if (i === 0) {
        result.push(`${leftBorder} ${prompt} ${line} ${rightBorder}`);
      } else {
        result.push(`${leftBorder}${' '.repeat(promptWidth - 1)}${line} ${rightBorder}`);
      }
    }

    result.push(this._cachedBottomBorder);

    // Scroll indicators below the box
    for (const ind of scrollIndicators) {
      result.push(ind);
    }

    return result;
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
      // Let pi-tui handle \+Enter newline workaround
      const lines = (this as any).state?.lines;
      const cursorCol = (this as any).state?.cursorCol;
      const currentLine = lines?.[((this as any).state?.cursorLine)] || '';
      if (cursorCol > 0 && currentLine[cursorCol - 1] === '\\') {
        super.handleInput(data);
        return;
      }
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
