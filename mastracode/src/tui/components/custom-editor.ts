/**
 * Custom editor that handles app-level keybindings for Mastra Code.
 */

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Editor, matchesKey } from '@earendil-works/pi-tui';
import type { EditorTheme, SelectItem, TUI } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { getClipboardImage, getClipboardText } from '../../clipboard/index.js';
import type { ClipboardImage } from '../../clipboard/index.js';
import { mastra, theme } from '../theme.js';
import type { GradientAnimator } from './obi-loader.js';
import { WrappingAutocompleteList } from './wrapping-autocomplete-list.js';

// Mirrors pi-tui's SLASH_COMMAND_SELECT_LIST_LAYOUT so slash-command rows keep
// the same primary-column sizing as the upstream SelectList.
const SLASH_COMMAND_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32,
};

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

/**
 * Push-to-talk voice input interface the editor drives. Implemented by
 * VoiceController. Terminals do not emit key-up events, so a held space is
 * inferred from auto-repeat: a burst of rapid repeated spaces means the key is
 * held (start recording); recording stops once those repeats stop arriving.
 */
export interface VoiceInputHook {
  isEnabled(): boolean;
  isRecording(): boolean;
  startRecording(): void;
  stopRecording(): void | Promise<void>;
}

// A held key repeats only after the OS key-repeat delay (~500ms on macOS),
// then steadily (~80ms cadence). A space tap counts toward "held" only when it
// follows the previous space within this window.
const SPACE_REPEAT_MAX_GAP_MS = 180;
// Number of rapid consecutive spaces that confirm the key is held rather than
// being tapped. The literal spaces typed before this point are removed.
const SPACE_HOLD_REPEAT_THRESHOLD = 3;
// While recording, the space is considered released once no repeat arrives for
// this long (comfortably above the ~80ms repeat cadence).
const SPACE_RELEASE_IDLE_MS = 250;

export type AppAction =
  | 'clear'
  | 'exit'
  | 'suspend'
  | 'undo'
  | 'toggleThinking'
  | 'expandTools'
  | 'followUp'
  | 'queueFollowUp'
  | 'cycleMode'
  | 'toggleYolo';

// Pre-compiled constants (avoid re-creation per render)
const ANSI_STRIP_RE = /\x1b\[[0-9;]*m/g;
const SLASH_CURSOR_RE = /\x1b\[7m\/\x1b\[0m/;
const AT_CURSOR_RE = /\x1b\[7m@\x1b\[0m/;
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Vertical bar glyphs ordered low→high; cycled to animate a soundwave cell.
const VOICE_WAVE_BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

const DEFAULT_PROMPT_ICON = '•';
const PROMPT_ICON_CHOICES = [
  '☯',
  '✺',
  '☻',
  '✿',
  '◒',
  '◓',
  '♞',
  '☘',
  '☸',
  '❂',
  '❁',
  '✽',
  '❉',
  '✹',
  '❨',
  '❩',
  '✚',
  '⚉',
  '❣',
  '❥',
  '♫',
  '❤',
] as const;

function getRandomPromptIcon(currentIcon: string): string {
  if (Math.random() < 0.99) {
    return DEFAULT_PROMPT_ICON;
  }

  const nextChoices = PROMPT_ICON_CHOICES.filter(icon => icon !== currentIcon);
  const choices = nextChoices.length > 0 ? nextChoices : PROMPT_ICON_CHOICES;
  return choices[Math.floor(Math.random() * choices.length)]!;
}

export class CustomEditor extends Editor {
  private actionHandlers: Map<AppAction, () => unknown> = new Map();

  public onCtrlD?: () => void;
  public escapeEnabled = true;
  public onImagePaste?: (image: ClipboardImage) => void;
  public getModeColor?: () => string | undefined;
  public getPromptAnimator?: () => GradientAnimator | undefined;
  private pendingBracketedPaste: string | null = null;

  /**
   * Push-to-talk voice hook. When set and enabled, holding the space bar starts
   * recording; releasing it (auto-repeat stops) transcribes and inserts at the
   * cursor.
   */
  public voiceInput?: VoiceInputHook;
  // Timestamp of the previous space key event, used to measure repeat cadence.
  private lastSpaceAt = 0;
  // Count of consecutive rapid spaces seen so far (the current repeat burst).
  private spaceRepeatCount = 0;
  // Whether a held-space recording session is currently active.
  private voiceRecordingActive = false;
  // Fires when space auto-repeat stops, signalling the key was released.
  private spaceReleaseTimer: ReturnType<typeof setTimeout> | null = null;

  // Whether the "listening" prompt animation is active (recording in progress).
  private voiceListening = false;
  // Drives the listening pulse so the prompt indicator animates while recording.
  private voiceListenTimer: ReturnType<typeof setInterval> | null = null;
  private voiceListenPhase = 0;
  // The dictated run currently rendered greyed-out. Cleared once the user edits,
  // so dictated text reads as "not written by us" until accepted.
  private voiceTranscriptText = '';
  // Text surrounding the dictated run, captured at the cursor position where
  // dictation began. Lets live replacements rebuild the input in place instead
  // of always appending to the end.
  private voicePrefix = '';
  private voiceSuffix = '';
  // True while a dictation session owns the trailing run. Set when listening
  // starts, cleared on a real user keystroke so late async transcripts that
  // arrive after the user resumed typing are ignored rather than re-appended.
  private voiceDictationActive = false;

  private _cachedModeColorHex?: string;
  private _cachedColorFn?: (s: string) => string;
  private promptIcon = DEFAULT_PROMPT_ICON;
  private lastPromptWasInvisible = false;

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

    // Override pi-tui's private `createAutocompleteList` so the slash-command /
    // autocomplete dropdown uses WrappingAutocompleteList. This wraps long
    // command/skill descriptions across multiple rows instead of truncating
    // them on a single line. Wired here (rather than as a class method) because
    // the base declares it `private`, so a normal override would be a type clash.
    (this as any).createAutocompleteList = (prefix: string, items: SelectItem[]) => {
      const layout = prefix.startsWith('/') ? SLASH_COMMAND_LIST_LAYOUT : undefined;
      const internals = this as unknown as { autocompleteMaxVisible: number; theme: EditorTheme };
      return new WrappingAutocompleteList(items, internals.autocompleteMaxVisible, internals.theme.selectList, layout);
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
    const promptAnimator = this.getPromptAnimator?.();
    const shouldAnimatePrompt = !isSlash && !isAt;
    const isPromptAnimated = shouldAnimatePrompt && Boolean(promptAnimator?.isRunning());
    const fadeProgress = isPromptAnimated ? promptAnimator!.getFadeProgress() : 1;
    const isTransitioningIn = isPromptAnimated && promptAnimator!.isFadingIn();
    const isTransitioningOut = isPromptAnimated && promptAnimator!.isFadingOut();
    const promptOffset = isPromptAnimated ? promptAnimator!.getOffset() : 0;
    const pulseWave = isPromptAnimated ? (Math.sin(promptOffset * Math.PI * 2) + 1) / 2 : 0;
    const transitionPhase = isTransitioningIn || isTransitioningOut ? 1 - fadeProgress : 1;
    const chevronBrightness = isPromptAnimated
      ? isTransitioningIn
        ? transitionPhase < 0.5
          ? Math.max(0, 1 - transitionPhase * 2)
          : 0
        : isTransitioningOut
          ? transitionPhase <= 0.5
            ? Math.max(0, 1 - transitionPhase * 2)
            : 0
          : 0
      : 1;
    const dotBrightness = isPromptAnimated
      ? isTransitioningIn
        ? transitionPhase <= 0.5
          ? 0
          : Math.max(0, (transitionPhase - 0.5) * 2)
        : isTransitioningOut
          ? transitionPhase < 0.5
            ? 0
            : Math.max(0, (transitionPhase - 0.5) * 2)
          : pulseWave
      : 0;

    const isSteadyPulse = isPromptAnimated && !isTransitioningIn && !isTransitioningOut;
    if (!isPromptAnimated) {
      this.promptIcon = DEFAULT_PROMPT_ICON;
      this.lastPromptWasInvisible = false;
    } else if (!isSteadyPulse) {
      this.lastPromptWasInvisible = false;
    }

    const promptIsInvisible = isSteadyPulse && dotBrightness <= 0.05;
    if (promptIsInvisible && !this.lastPromptWasInvisible) {
      this.promptIcon = getRandomPromptIcon(this.promptIcon);
    }
    this.lastPromptWasInvisible = promptIsInvisible;

    const promptChar = isSlash
      ? '/'
      : isAt
        ? '@'
        : chevronBrightness > 0.05
          ? '›'
          : dotBrightness > 0.05
            ? this.promptIcon
            : ' ';
    const promptBrightness = isPromptAnimated ? Math.max(chevronBrightness, dotBrightness) : 1;

    // Cache colorFn and prompt — only recreate when color changes
    if (this._cachedModeColorHex !== color) {
      this._cachedModeColorHex = color;
      this._cachedColorFn = chalk.hex(color);
    }
    const colorFn = this._cachedColorFn!;
    const b = colorFn;
    const [r, g, bValue] = parseHex(color);
    let prompt: string;
    if (this.voiceListening) {
      // Animated single-cell soundwave: a vertical bar that rises and falls like
      // an equalizer, so the prompt reads as a live waveform while recording.
      const wave = (Math.sin(this.voiceListenPhase * 0.6) + 1) / 2; // 0..1
      const bar = VOICE_WAVE_BARS[Math.round(wave * (VOICE_WAVE_BARS.length - 1))]!;
      // Pulse the wave using the current mode color so it matches the prompt.
      const brightness = 0.5 + wave * 0.5;
      prompt = chalk.bold.rgb(
        Math.round(r * brightness),
        Math.round(g * brightness),
        Math.round(bValue * brightness),
      )(bar);
    } else {
      prompt = chalk.bold.rgb(
        Math.round(r * promptBrightness),
        Math.round(g * promptBrightness),
        Math.round(bValue * promptBrightness),
      )(promptChar);
    }

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
        if (isTop) {
          isTop = false;
          continue;
        }
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

    // Solid mode-color border
    const top = b('╭') + b('─').repeat(hBarLen) + b('╮');
    const leftBorder = b('│');
    const rightBorder = b('│');
    const bottom = b('╰') + b('─').repeat(hBarLen) + b('╯');

    // Assemble box
    const textColorOpen = `\x1b[38;2;${parseHex(theme.getTheme().text).join(';')}m`;
    const textColorClose = '\x1b[39m';
    result.push(top);

    // How many trailing characters are dictated and should render greyed-out.
    const fullText = this.getText();
    let greyRemaining =
      this.voiceTranscriptText.length > 0 && fullText.endsWith(this.voiceTranscriptText)
        ? this.voiceTranscriptText.length
        : 0;
    const greyOpen = `\x1b[38;2;${parseHex(theme.getTheme().muted).join(';')}m`;

    for (let i = contentLines.length - 1; i >= 0; i--) {
      if (greyRemaining > 0) {
        const { line, consumed } = this.greyifyTrailing(contentLines[i]!, greyRemaining, greyOpen, textColorOpen);
        contentLines[i] = line;
        greyRemaining -= consumed;
      }
    }

    for (let i = 0; i < contentLines.length; i++) {
      const line = `${textColorOpen}${contentLines[i]!}${textColorClose}`;
      if (i === 0) {
        result.push(`${leftBorder} ${prompt} ${line} ${rightBorder}`);
      } else {
        result.push(`${leftBorder}${' '.repeat(promptWidth - 1)}${line} ${rightBorder}`);
      }
    }

    result.push(bottom);

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

  private completeAutocompleteSelection(): boolean {
    if (!this.isShowingAutocomplete()) {
      return false;
    }

    const wasSlashCommand = this.getText().trimStart().startsWith('/');
    super.handleInput('\t');
    const completedText = this.getText();
    if (wasSlashCommand && !completedText.trimStart().startsWith('/')) {
      this.setText(`/${completedText.trimStart()}`);
    }
    return wasSlashCommand;
  }

  /**
   * Capture the cursor position where dictation begins so the dictated run can be
   * inserted (and later replaced) in place, even when the cursor sits in the
   * middle of existing input.
   */
  private beginDictation(): void {
    const offset = this.getCursorOffset();
    const full = this.getText();
    this.voicePrefix = full.slice(0, offset);
    this.voiceSuffix = full.slice(offset);
    this.voiceTranscriptText = '';
    this.voiceDictationActive = true;
  }

  /**
   * Flatten the editor's {line, col} cursor into a single string offset over the
   * newline-joined text.
   */
  private getCursorOffset(): number {
    const lines = this.getText().split('\n');
    const { line, col } = (this as any).getCursor?.() ?? {
      line: lines.length - 1,
      col: lines[lines.length - 1]?.length ?? 0,
    };
    const clampedLine = Math.min(Math.max(line, 0), lines.length - 1);
    let offset = 0;
    for (let i = 0; i < clampedLine; i++) offset += (lines[i]?.length ?? 0) + 1; // +1 for the '\n'
    return offset + Math.min(Math.max(col, 0), lines[clampedLine]?.length ?? 0);
  }

  /**
   * Restore the cursor to a flat string offset over the newline-joined text.
   * Uses the editor's internal state directly since pi-tui exposes no public
   * cursor setter.
   */
  private setCursorOffset(offset: number): void {
    const lines = this.getText().split('\n');
    let remaining = Math.max(offset, 0);
    let lineIdx = 0;
    while (lineIdx < lines.length - 1 && remaining > (lines[lineIdx]?.length ?? 0)) {
      remaining -= (lines[lineIdx]?.length ?? 0) + 1;
      lineIdx += 1;
    }
    const col = Math.min(remaining, lines[lineIdx]?.length ?? 0);
    const state = (this as any).state;
    const setCursorCol = (this as any).setCursorCol;
    if (state && typeof setCursorCol === 'function') {
      state.cursorLine = lineIdx;
      setCursorCol.call(this, col);
    }
  }

  /**
   * Insert dictated text at the captured dictation anchor. Used for the final
   * (non-live) transcript path.
   */
  public insertVoiceTranscript(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.applyDictation(trimmed);
  }

  /**
   * Replace the current dictated run with a new transcript. Used for live
   * transcription, where each partial result supersedes the previous one as the
   * user keeps speaking.
   */
  public replaceVoiceTranscript(text: string): void {
    // The user resumed typing before this async result arrived; honor their edit
    // rather than clobbering it with a stale partial.
    if (!this.voiceDictationActive) return;
    this.applyDictation(text.trim());
  }

  /**
   * Rebuild the input as prefix + dictated payload + suffix, keeping the dictated
   * run anchored at the cursor position where dictation began and leaving the
   * cursor just after the dictated text.
   */
  private applyDictation(trimmed: string): void {
    const needsLeadingSpace = this.voicePrefix.length > 0 && !/\s$/.test(this.voicePrefix);
    const payload = trimmed ? (needsLeadingSpace ? ` ${trimmed}` : trimmed) : '';
    this.voiceTranscriptText = payload;
    this.setText(this.voicePrefix + payload + this.voiceSuffix);
    this.setCursorOffset(this.voicePrefix.length + payload.length);
    // Programmatic insertion mutates editor state but does not repaint on its
    // own, so force a render to show the transcript immediately.
    this.tui.requestRender();
  }

  /**
   * Wrap up to `count` trailing dictated characters of a rendered content line in
   * the grey (muted) color. The underlying pi-tui editor produces plain text plus
   * a few artifacts that must be skipped: an APC hardware-cursor marker
   * (`\x1b_pi:c\x07`), a reverse-video cursor highlight (`\x1b[7m…\x1b[0m`), and
   * trailing padding spaces. We isolate the real content region (everything
   * before the cursor highlight / padding) and grey only its trailing characters,
   * leaving the cursor and padding untouched.
   *
   * Returns the recolored line and how many content characters were greyed.
   */
  private greyifyTrailing(
    line: string,
    count: number,
    greyOpen: string,
    textColorOpen: string,
  ): { line: string; consumed: number } {
    // Split the content region (real text) from the trailing artifacts: the
    // hardware-cursor marker, the cursor highlight, and any padding after it.
    const CURSOR_MARKER = '\x1b_pi:c\x07';
    const cursorHighlight = /\x1b\[7m[\s\S]*?\x1b\[0m/;
    let head = line;
    let tail = '';

    const markerIdx = line.indexOf(CURSOR_MARKER);
    if (markerIdx !== -1) {
      head = line.slice(0, markerIdx);
      tail = line.slice(markerIdx);
    } else {
      const hl = cursorHighlight.exec(line);
      if (hl) {
        head = line.slice(0, hl.index);
        tail = line.slice(hl.index);
      } else {
        // No cursor on this line: trailing run is padding spaces. Strip them so
        // we grey real characters, not the box padding.
        const trimmed = line.replace(/ +$/, '');
        head = trimmed;
        tail = line.slice(trimmed.length);
      }
    }

    // Within `head`, tokenize into SGR escapes and visible characters and grey
    // the trailing `count` visible characters.
    const tokens: Array<{ ansi: boolean; text: string }> = [];
    const re = /\x1b\[[0-9;]*m/g;
    let last = 0;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(head)) !== null) {
      if (mt.index > last) {
        for (const ch of head.slice(last, mt.index)) tokens.push({ ansi: false, text: ch });
      }
      tokens.push({ ansi: true, text: mt[0] });
      last = re.lastIndex;
    }
    for (const ch of head.slice(last)) tokens.push({ ansi: false, text: ch });

    let consumed = 0;
    let firstGreyIdx = -1;
    for (let i = tokens.length - 1; i >= 0 && consumed < count; i--) {
      if (!tokens[i]!.ansi) {
        firstGreyIdx = i;
        consumed += 1;
      }
    }
    if (firstGreyIdx === -1) return { line, consumed: 0 };

    const before = tokens
      .slice(0, firstGreyIdx)
      .map(t => t.text)
      .join('');
    const grey = tokens
      .slice(firstGreyIdx)
      .map(t => t.text)
      .join('');
    // Re-open the normal text color before the cursor/padding tail so only the
    // dictated run is grey.
    return { line: `${before}${greyOpen}${grey}${textColorOpen}${tail}`, consumed };
  }

  /**
   * Start or stop the "listening" prompt animation. While listening, the prompt
   * indicator pulses on its own timer so the user gets clear visual feedback
   * that the mic is recording.
   */
  public setVoiceListening(listening: boolean): void {
    if (listening === this.voiceListening) return;
    this.voiceListening = listening;
    if (listening) {
      this.beginDictation();
      this.voiceListenPhase = 0;
      this.voiceListenTimer ??= setInterval(() => {
        this.voiceListenPhase += 1;
        this.tui.requestRender();
      }, 120);
    } else if (this.voiceListenTimer) {
      clearInterval(this.voiceListenTimer);
      this.voiceListenTimer = null;
    }
    this.tui.requestRender();
  }

  /**
   * Push-to-talk space handling. Returns true when the space was consumed by
   * voice handling and must not be processed further.
   *
   * Normal spaces are typed instantly (no deferral, no lag). A held space is
   * detected from terminal auto-repeat: once SPACE_HOLD_REPEAT_THRESHOLD rapid
   * spaces arrive, the literal spaces already typed are deleted and recording
   * begins. While recording, repeats are swallowed and reset a release timer;
   * when repeats stop (key released) recording stops and transcribes.
   */
  private maybeHandleVoiceSpace(data: string): boolean {
    if (data !== ' ' || !this.voiceInput?.isEnabled()) {
      if (data !== ' ') {
        // Any non-space key ends a potential repeat burst.
        this.spaceRepeatCount = 0;
      }
      return false;
    }

    const now = Date.now();
    const gap = this.lastSpaceAt ? now - this.lastSpaceAt : Infinity;
    this.lastSpaceAt = now;

    // Already recording: swallow the repeat and keep the release timer alive.
    if (this.voiceRecordingActive) {
      this.armSpaceReleaseTimer();
      return true;
    }

    if (gap <= SPACE_REPEAT_MAX_GAP_MS) {
      this.spaceRepeatCount += 1;
    } else {
      this.spaceRepeatCount = 1;
    }

    // Threshold reached: this is a held key. Remove the literal spaces already
    // typed during the burst and start recording.
    if (this.spaceRepeatCount >= SPACE_HOLD_REPEAT_THRESHOLD) {
      const typedSpaces = SPACE_HOLD_REPEAT_THRESHOLD - 1;
      for (let i = 0; i < typedSpaces; i++) {
        // Backspace removes one previously inserted literal space.
        super.handleInput('\x7f');
      }
      this.spaceRepeatCount = 0;
      this.voiceRecordingActive = true;
      this.voiceInput.startRecording();
      this.armSpaceReleaseTimer();
      return true;
    }

    // Not yet confirmed as a hold: type the space normally (instant, no lag).
    return false;
  }

  private armSpaceReleaseTimer(): void {
    if (this.spaceReleaseTimer) {
      clearTimeout(this.spaceReleaseTimer);
    }
    this.spaceReleaseTimer = setTimeout(() => {
      this.spaceReleaseTimer = null;
      this.voiceRecordingActive = false;
      this.lastSpaceAt = 0;
      this.spaceRepeatCount = 0;
      void this.voiceInput?.stopRecording();
    }, SPACE_RELEASE_IDLE_MS);
  }

  handleInput(data: string): void {
    if (this.maybeHandleBracketedPaste(data)) {
      return;
    }

    if (this.maybeHandleVoiceSpace(data)) {
      return;
    }

    // Any genuine keystroke means the user is editing — stop greying the
    // dictated text so it now reads as their own input, and end the dictation
    // session so any late async transcript that arrives after this edit is
    // ignored instead of clobbering the user's input.
    this.voiceTranscriptText = '';
    this.voiceDictationActive = false;

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

    if (matchesKey(data, 'ctrl+f')) {
      const handler = this.actionHandlers.get('queueFollowUp');
      if (handler) {
        this.completeAutocompleteSelection();
        handler();
        return;
      }
    }

    if (matchesKey(data, 'enter')) {
      // Let pi-tui handle \+Enter newline workaround
      const lines = (this as any).state?.lines;
      const cursorCol = (this as any).state?.cursorCol;
      const currentLine = lines?.[(this as any).state?.cursorLine] || '';
      if (cursorCol > 0 && currentLine[cursorCol - 1] === '\\') {
        super.handleInput(data);
        return;
      }
      const handler = this.actionHandlers.get('followUp');
      if (handler) {
        if (this.isShowingAutocomplete()) {
          if (this.completeAutocompleteSelection() && handler() !== false) {
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
