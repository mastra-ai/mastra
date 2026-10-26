/**
 * Menus open in place of the prompt (like pi and Codex) instead of as pop-ups over the chat. The prompt
 * slot swaps the editor for the open menu, framed like the prompt (same faded panel): a search row where
 * the prompt was, the menu, and its specific key hints. Menus opened from a menu stack in the slot; the
 * prompt comes back when the last one closes.
 *
 * Every menu still opens with `showModalOverlay` and closes with `tui.hideOverlay()`; `MastraTUI` routes
 * both to the slot.
 */
import { CURSOR_MARKER, decodeKittyPrintable, matchesKey, TUI, truncateToWidth } from '@earendil-works/pi-tui';
import type { Component, Container, Focusable, OverlayHandle } from '@earendil-works/pi-tui';

import { findFilterTarget } from './components/menu-chrome.js';
import type { Filterable, MenuChrome, MenuHint } from './components/menu-chrome.js';
import { fadePanel, keyHint } from './components/surface.js';
import { theme } from './theme.js';

/** How long a menu command may take before the slot shows "loading <menu>…". */
const LOADING_DELAY_MS = 120;
/** The slot's panel shade, the same as the prompt's. */
const PANEL_STEP = 1.5;

export interface PromptSlotChrome {
  /** Shown (lowercased) as the search row's placeholder, e.g. "select thread". */
  title?: string;
  /** Menu-specific keys shown as keycaps under the menu. */
  hints?: readonly MenuHint[];
}

/**
 * Nerd Font's magnifier (md-magnify) when the terminal ships Nerd Font symbols (Ghostty, kitty and
 * WezTerm bundle them), else a plain chevron. MASTRACODE_NERD_FONT=1 or 0 overrides the guess.
 */
function searchGlyph(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MASTRACODE_NERD_FONT;
  const nerdFont =
    override !== undefined
      ? override === '1' || override === 'true'
      : Boolean(env.GHOSTTY_RESOURCES_DIR || env.KITTY_WINDOW_ID || env.WEZTERM_EXECUTABLE) ||
        /^(ghostty|wezterm)$/i.test(env.TERM_PROGRAM ?? '') ||
        env.TERM === 'xterm-kitty';
  return nerdFont ? '\u{f0349}' : '›';
}

let glyph: string | undefined;
function searchIcon(): string {
  glyph ??= searchGlyph();
  return theme.fg('dim', glyph);
}

/** The text cursor as the prompt draws it (an inverse block); Mastra Code hides the terminal cursor. */
function caret(): string {
  return `${CURSOR_MARKER}\x1b[7m \x1b[27m`;
}

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

/**
 * Text typed or pasted into the search: a character (legacy or Kitty keyboard encoding), IME or emoji
 * input, or a bracketed paste flattened to one line. Undefined for keys (arrows, Enter, Esc, …).
 */
function typedText(data: string): string | undefined {
  if (data.startsWith(PASTE_START)) {
    return data.slice(PASTE_START.length).replace(PASTE_END, '').replace(/\s+/g, ' ');
  }
  if (!/[\x00-\x1f\x7f]/.test(data)) return data;
  return decodeKittyPrintable(data);
}

const isBlank = (line: string) => !line.replace(/\x1b\[[0-9;:]*m/g, '').trim();

/** One open menu: in the slot, or in a pop-up while a full-screen view (setup) is open. */
export class MenuFrame implements Component, Focusable {
  private query = '';
  private target: Filterable | undefined;
  /** Each list keeps its own search, so a list you return to (from a submenu) shows its filter again. */
  private readonly queries = new WeakMap<Filterable, string>();

  constructor(
    readonly component: Component,
    private readonly chrome: PromptSlotChrome = {},
  ) {}

  get focused(): boolean {
    return (this.component as Partial<Focusable>).focused ?? false;
  }

  set focused(value: boolean) {
    if ('focused' in this.component) (this.component as Focusable).focused = value;
  }

  get wantsKeyRelease(): boolean | undefined {
    return this.component.wantsKeyRelease;
  }

  /** The list typing filters; switching lists (a submenu opened or closed) switches to that list's search. */
  private filterTarget(): Filterable | undefined {
    const target = findFilterTarget(this.component);
    if (target !== this.target) {
      if (this.target) this.queries.set(this.target, this.query);
      this.target = target;
      this.query = (target && this.queries.get(target)) ?? '';
    }
    return target;
  }

  handleInput(data: string): void {
    const target = this.filterTarget();
    if (target) {
      const backspace = matchesKey(data, 'backspace');
      if (backspace && !this.query) {
        // Backspace on an empty search goes back, like Esc: a submenu returns to its parent.
        if (!(this.component as MenuChrome).menuKeepsBackspace) {
          this.component.handleInput?.('\x1b');
          return;
        }
      } else if (backspace) {
        this.query = [...this.query].slice(0, -1).join('');
        target.setFilter(this.query);
        return;
      } else {
        // A leading space is left to the menu (Space changes a setting); after text it is part of the search.
        const typed = typedText(data);
        if (typed && (this.query || typed.trim())) {
          this.query += this.query ? typed : typed.trimStart();
          target.setFilter(this.query);
          return;
        }
      }
    }
    this.component.handleInput?.(data);
  }

  invalidate(): void {
    this.component.invalidate?.();
  }

  render(width: number): string[] {
    const chrome = this.component as MenuChrome;
    const title = (chrome.menuTitle?.() ?? this.chrome.title)?.replace(/:$/, '').toLowerCase();
    const target = this.filterTarget();
    const head: string[] = [];
    if (target) {
      const field = this.query ? theme.fg('text', this.query) + caret() : caret() + theme.fg('dim', title ?? 'search');
      head.push(` ${searchIcon()} ${field}`, '');
    } else if (title) {
      head.push(` ${theme.fg('dim', title)}`, '');
    }

    const body = this.component.render(Math.max(1, width - 1));
    while (body.length && isBlank(body[0]!)) body.shift();
    while (body.length && isBlank(body[body.length - 1]!)) body.pop();

    const hints = chrome.menuHints?.() ?? this.chrome.hints ?? [];
    const foot = hints.length ? ['', ` ${hints.map(hint => keyHint(hint.key, hint.label)).join('  ')}`] : [];

    // Text without a color of its own uses the secondary grey, like the rest of the menu.
    const secondary = theme.fg('secondary', 'x').split('x')[0]!;
    const rows = [
      ...head,
      ...body.map(line => ` ${secondary}${line.replace(/\x1b\[(?:0|39)?m/g, m => m + secondary)}`),
      ...foot,
    ];
    return fadePanel(
      rows.map(line => truncateToWidth(line, width, '')),
      width,
      PANEL_STEP,
    );
  }
}

/** The slot while a menu is still loading: one row, "loading models…", where the search row will be. */
class LoadingFrame implements Component {
  constructor(
    private readonly name: string,
    /** Any key dismisses the row and goes to the prompt (Esc only dismisses it). */
    private readonly dismiss: (data: string) => void,
  ) {}

  handleInput(data: string): void {
    this.dismiss(data);
  }

  invalidate(): void {}

  render(width: number): string[] {
    return fadePanel([` ${searchIcon()} ${theme.fg('dim', `loading ${this.name}…`)}`], width, PANEL_STEP);
  }
}

export class PromptSlot {
  private readonly stack: Component[] = [];
  private loading: LoadingFrame | undefined;

  constructor(
    private readonly ui: TUI,
    private readonly container: Container,
    private readonly editor: Component,
  ) {}

  isOpen(): boolean {
    return this.stack.length > 0;
  }

  /** Opens a menu in the slot, on top of any menu already there. */
  open(component: Component, chrome: PromptSlotChrome = {}): OverlayHandle {
    if (this.loading) this.remove(this.loading);
    const frame = new MenuFrame(component, chrome);
    const before = this.mounted();
    this.stack.push(frame);
    this.swap(before, frame);
    let hidden = false;
    return {
      // Closing the top menu goes through hideOverlay, which also hands focus to a waiting plan approval.
      hide: () =>
        this.mounted() === frame && !(this.ui as MastraTUI).hasPopup?.() ? this.ui.hideOverlay() : this.remove(frame),
      setHidden: value => {
        hidden = value;
        if (value) this.remove(frame);
      },
      isHidden: () => hidden,
      focus: () => this.ui.setFocus(frame),
      unfocus: () => this.ui.setFocus(this.editor),
      isFocused: () => this.mounted() === frame,
    };
  }

  /** Closes the menu on top; false when nothing is open. */
  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top) return false;
    this.remove(top);
    return true;
  }

  /**
   * Shows "loading <name>…" in the slot when a menu command is still preparing its menu after a moment
   * (e.g. /models fetching the model list); the menu replaces it when it opens.
   */
  showLoadingWhile(name: string, pending: Promise<unknown>): void {
    if (this.isOpen()) return;
    const timer = setTimeout(() => {
      if (this.isOpen()) return;
      this.loading = new LoadingFrame(name, data => {
        if (this.loading) this.remove(this.loading);
        if (!matchesKey(data, 'escape')) this.editor.handleInput?.(data);
      });
      this.stack.push(this.loading);
      this.swap(this.editor, this.loading);
    }, LOADING_DELAY_MS);
    void pending.finally(() => {
      clearTimeout(timer);
      if (this.loading) this.remove(this.loading);
    });
  }

  private mounted(): Component {
    return this.stack[this.stack.length - 1] ?? this.editor;
  }

  private remove(frame: Component): void {
    const at = this.stack.indexOf(frame);
    if (at < 0) return;
    if (frame === this.loading) this.loading = undefined;
    const wasMounted = this.mounted() === frame;
    this.stack.splice(at, 1);
    if (wasMounted) this.swap(frame, this.mounted());
  }

  private swap(from: Component, to: Component): void {
    const children = this.container.children;
    const index = children.indexOf(from);
    if (index >= 0) children.splice(index, 1, to);
    else children.push(to);
    this.ui.setFocus(to);
    this.ui.requestRender();
  }
}

/** The TUI with a prompt slot: `hideOverlay` and `hasOverlay` include the menus open in the slot. */
export class MastraTUI extends TUI {
  promptSlot?: PromptSlot;

  override hideOverlay(): void {
    if (!super.hasOverlay() && this.promptSlot?.closeTop()) return;
    super.hideOverlay();
  }

  /** Whether a pop-up (not a menu in the slot) is open, e.g. the full-screen setup. */
  hasPopup(): boolean {
    return super.hasOverlay();
  }

  override hasOverlay(): boolean {
    return super.hasOverlay() || (this.promptSlot?.isOpen() ?? false);
  }
}
