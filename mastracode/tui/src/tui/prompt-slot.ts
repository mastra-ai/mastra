/**
 * Menus open in place of the prompt (like pi and Codex) instead of as pop-ups over the chat. The prompt
 * slot swaps the editor for the open menu, framed like the prompt (same faded panel): a search row where
 * the prompt was, the menu, and its specific key hints. Menus opened from a menu stack in the slot; the
 * prompt comes back when the last one closes.
 *
 * Every menu still opens with `showModalOverlay` and closes with `tui.hideOverlay()`; `MastraTUI` routes
 * both to the slot.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import {
  CURSOR_MARKER,
  decodeKittyPrintable,
  getKeybindings,
  matchesKey,
  sliceByColumn,
  TUI,
  truncateToWidth,
  visibleWidth,
} from '@earendil-works/pi-tui';
import type { Component, Container, Focusable, OverlayHandle } from '@earendil-works/pi-tui';

import type { ListWindow } from './components/list-window.js';
import { findFilterTarget, findMenuWindow, lowerFirst } from './components/menu-chrome.js';
import type { Filterable, MenuChrome, MenuHint } from './components/menu-chrome.js';
import { fadePanel, keyHint } from './components/surface.js';
import { PASTE_END, PASTE_START, stripControls } from './components/text-input.js';
import { locate } from './mouse/hit-test.js';
import type { MouseAware, MousePoint, MouseTarget } from './mouse/hit-test.js';
import { tuiInternals } from './mouse/pi-tui-internals.js';
import { menuCursor, theme } from './theme.js';

/** How long a menu command may take before the slot shows "loading <menu>…". */
const LOADING_DELAY_MS = 120;
/** The slot's panel shade, the same as the prompt's. */
const PANEL_STEP = 1.5;
/** The panel's ▄ and ▀ edges. */
const PANEL_EDGES = 2;

export interface PromptSlotChrome {
  /** Shown as the search row's placeholder (first letter lowercased), e.g. "select thread". */
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

/**
 * Text typed or pasted into the search: a character (legacy or Kitty keyboard encoding), IME or emoji
 * input, or a bracketed paste flattened to one line without its control characters. Undefined for keys
 * (arrows, Enter, Esc, …).
 */
function typedText(data: string): string | undefined {
  if (data.startsWith(PASTE_START)) {
    return stripControls(data.slice(PASTE_START.length).replace(PASTE_END, '')).replace(/\s+/g, ' ');
  }
  if (!/[\x00-\x1f\x7f-\x9f]/.test(data)) return data;
  return decodeKittyPrintable(data);
}

/** An escape code that isn't complete (cut text): the panel's own codes would end up inside it and widen the row. */
const BROKEN_ESCAPE_RE = /\x1b(?!\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|_[^\x07\x1b]*(?:\x07|\x1b\\)|\\)/g;

const graphemes = new Intl.Segmenter();

function withoutLastGrapheme(text: string): string {
  return [...graphemes.segment(text)]
    .slice(0, -1)
    .map(part => part.segment)
    .join('');
}

/** The end of `text` that fits `width` columns, so the text cursor after it stays visible. */
function tail(text: string, width: number): string {
  const over = visibleWidth(text) - width;
  return over > 0 ? `…${sliceByColumn(text, over + 1, width - 1)}` : text;
}

const isBlank = (line: string) => !line.replace(/\x1b\[[0-9;:]*m/g, '').trim();

/** One open menu: in the slot, or in a pop-up while a full-screen view (setup) is open. */
export class MenuFrame implements Component, Focusable, MouseAware {
  private query = '';
  private target: Filterable | undefined;
  /** Each list keeps its own search, so a list you return to (from a submenu) shows its filter again. */
  private readonly queries = new WeakMap<Filterable, string>();
  /** Rows at the last render, and the size it was drawn for. */
  private height = 0;
  private drawnFor = '';
  /** The list scroll window shrunk to fit. */
  private fitted: ListWindow | undefined;
  /** Where the component's rows ended up: the frame row of the first one, and how many were cut above it. */
  private body = { top: 0, cut: 0, rows: 0 };

  constructor(
    readonly component: Component,
    private readonly chrome: PromptSlotChrome = {},
    /** The rows the terminal has for this menu. */
    private readonly maxRows: () => number = () => Number.POSITIVE_INFINITY,
  ) {}

  /** Rows drawn by the last render. */
  get renderedRows(): number {
    return this.height;
  }

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
        this.search(target, withoutLastGrapheme(this.query));
        return;
      } else if (this.query && getKeybindings().matches(data, 'tui.editor.deleteWordBackward')) {
        this.search(target, this.query.replace(/\s*\S+\s*$/, ''));
        return;
      } else if (this.query && getKeybindings().matches(data, 'tui.editor.deleteToLineStart')) {
        this.search(target, '');
        return;
      } else {
        // A leading space is left to the menu (Space changes a setting); after text it is part of the
        // search, unless the menu uses Space itself (toggling items in a multi-select list).
        const typed = typedText(data);
        const keepsSpace = typed === ' ' && (this.component as MenuChrome).menuKeepsSpace;
        if (typed && !keepsSpace && (this.query || typed.trim())) {
          this.search(target, this.query + (this.query ? typed : typed.trimStart()));
          return;
        }
      }
    }
    this.component.handleInput?.(data);
  }

  private search(target: Filterable, query: string): void {
    this.query = query;
    target.setFilter(query);
  }

  invalidate(): void {
    this.component.invalidate?.();
  }

  render(width: number): string[] {
    const chrome = this.component as MenuChrome;
    const title = (chrome.menuTitle?.() ?? this.chrome.title)?.replace(/:$/, '');
    const target = this.filterTarget();
    const head: string[] = [];
    if (target) {
      // A list: the title is the search field's placeholder.
      const placeholder = theme.fg('dim', lowerFirst(title) ?? 'search');
      // Around the text: a space, the icon, a space, and the text cursor.
      const shown = tail(this.query, Math.max(1, width - 4));
      head.push(` ${searchIcon()} ${shown ? theme.fg('text', shown) + caret() : caret() + placeholder}`, '');
    } else if (title) {
      // A question (a text prompt) or a list without search: the title reads as a heading.
      head.push(` ${theme.fg('text', title)}`, '');
    }

    const hints = chrome.menuHints?.() ?? this.chrome.hints ?? [];
    const foot = hints.length ? ['', ` ${hints.map(hint => keyHint(hint.key, hint.label)).join('  ')}`] : [];

    const maxRows = Math.max(1, this.maxRows());
    const size = `${width}x${maxRows}`;
    if (size !== this.drawnFor) {
      this.drawnFor = size;
      this.height = 0;
      this.fitted?.setLimit(undefined);
      this.fitted = undefined;
    }
    // Too short for everything: the hints go first, then the blank row under the search.
    let available = maxRows - PANEL_EDGES - head.length - foot.length;
    if (available < 3 && foot.length) available += foot.splice(0).length;
    if (available < 2 && head.length) available += head.splice(1).length;

    const body = this.renderBody(Math.max(1, width - 1), Math.max(1, available));
    this.body = { top: 1 + head.length, cut: body.cut, rows: body.lines.length };

    // The menu keeps its tallest height while it is open, so filtering doesn't move the search row.
    const rowsWithoutFill = PANEL_EDGES + head.length + body.lines.length + foot.length;
    this.height = Math.max(this.height, rowsWithoutFill);
    const fill = Array.from({ length: this.height - rowsWithoutFill }, () => '');

    // Text without a color of its own uses the secondary grey, like the rest of the menu.
    const secondary = theme.fg('secondary', 'x').split('x')[0]!;
    const rows = [
      ...head,
      ...body.lines.map(line => ` ${secondary}${line.replace(/\x1b\[(?:0|39)?m/g, m => m + secondary)}`),
      ...fill,
      ...foot,
    ];
    return fadePanel(
      rows.map(line => truncateToWidth(line.replace(BROKEN_ESCAPE_RE, ''), width, '')),
      width,
      PANEL_STEP,
    );
  }

  /**
   * The component's rows without blank rows around them, in at most `available` rows: its list shows fewer
   * items, and whatever still doesn't fit (a long question) is cut around the row in use.
   */
  private renderBody(width: number, available: number): { lines: string[]; cut: number } {
    let cut = 0;
    const draw = () => {
      // A copy: a Box returns its cached rows.
      const lines = [...this.component.render(width)];
      cut = 0;
      for (; lines.length && isBlank(lines[0]!); cut++) lines.shift();
      while (lines.length && isBlank(lines[lines.length - 1]!)) lines.pop();
      return lines;
    };

    let lines = draw();
    const window = findMenuWindow(this.component);
    if (this.fitted && this.fitted !== window) {
      // A submenu opened or closed: its list is fitted on its own.
      this.fitted.setLimit(undefined);
      this.fitted = undefined;
      lines = draw();
    }
    while (window && lines.length > available && window.shownItems > 1) {
      const shown = window.shownItems;
      this.fitted = window;
      window.setLimit(Math.max(1, shown - Math.max(1, Math.floor((lines.length - available) / 2))));
      lines = draw();
      // A window that isn't drawn right now can't make room.
      if (window.shownItems >= shown) break;
    }

    if (lines.length > available) {
      const cursor = menuCursor();
      const marker = lines.findIndex(line => line.includes(CURSOR_MARKER) || line.includes('\x1b[7m'));
      const active = marker >= 0 ? marker : lines.findIndex(line => line.includes(cursor));
      const start = Math.max(0, Math.min(active - available + 1, lines.length - available));
      lines = lines.slice(start, start + available);
      cut += start;
    }
    return { lines, cut };
  }

  mouseTarget(point: MousePoint): MouseTarget | undefined {
    const { top, cut, rows } = this.body;
    const row = point.row - top;
    if (row < 0 || row >= rows) return undefined;
    const target = locate(this.component, { row: row + cut, col: point.col - 1, width: Math.max(1, point.width - 1) });
    return target && { ...target, top: target.top - cut + top };
  }
}

/** The slot while a menu is still loading: one row, "loading models…", where the search row will be. */
class LoadingFrame implements Component {
  /** Keys typed while the menu loads; they go to the menu once it opens. */
  readonly typedAhead: string[] = [];

  constructor(
    private readonly name: string,
    /** Esc or Ctrl+C: stop waiting (the menu is cancelled when it opens). */
    private readonly cancel: (data: string) => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, 'escape') || matchesKey(data, 'ctrl+c')) this.cancel(data);
    else this.typedAhead.push(data);
  }

  invalidate(): void {}

  render(width: number): string[] {
    return fadePanel([` ${searchIcon()} ${theme.fg('dim', `loading ${this.name}…`)}`], width, PANEL_STEP);
  }
}

/** A menu command that is running: what its loading row collected, for the menu it opens. */
interface MenuCommand {
  /** Esc dismissed the loading row: the menu this command opens is cancelled right away. */
  cancelled: boolean;
  /** Whether its menu opened, so it no longer needs a loading row. */
  opened: boolean;
  loading?: LoadingFrame;
}

/** The command a menu opens from; a menu another command opens is never cancelled or typed into by mistake. */
const runningCommand = new AsyncLocalStorage<MenuCommand>();

export class PromptSlot {
  private readonly stack: Component[] = [];

  constructor(
    private readonly ui: TUI,
    private readonly container: Container,
    private readonly editor: Component & { suggestionRows?: number },
  ) {}

  isOpen(): boolean {
    return this.stack.length > 0;
  }

  /** The menu on screen (or its loading row), or undefined when the prompt is. */
  mountedMenu(): Component | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Opens a menu in the slot, on top of any menu already there. */
  open(component: Component, chrome: PromptSlotChrome = {}): OverlayHandle {
    const command = runningCommand.getStore();
    const typedAhead = command?.loading?.typedAhead ?? [];
    if (command?.loading) this.remove(command.loading);
    const frame = new MenuFrame(component, chrome, () => this.maxMenuRows());
    const before = this.mounted();
    this.stack.push(frame);
    this.swap(before, frame);
    if (command) {
      const { cancelled } = command;
      command.opened = true;
      command.cancelled = false;
      command.loading = undefined;
      // Esc while it loaded cancels the menu, once the caller has finished setting it up. Keys typed while
      // it loaded (a search, Enter) apply to it then.
      if (cancelled) queueMicrotask(() => frame.handleInput('\x1b'));
      else if (typedAhead.length) {
        queueMicrotask(() => {
          for (const data of typedAhead) {
            // A key that opened another menu or closed this one ends the replay: the rest wasn't meant for it.
            if (this.mounted() !== frame) break;
            frame.handleInput(data);
          }
        });
      }
    }
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
   * Runs a command that opens a menu, showing "loading <name>…" in the slot when it is still preparing
   * the menu after a moment (e.g. /models fetching the model list); the menu replaces it when it opens.
   */
  runMenuCommand<T>(name: string, run: () => Promise<T>): Promise<T> {
    const command: MenuCommand = { cancelled: false, opened: false };
    const pending = runningCommand.run(command, run);
    if (this.isOpen()) return pending;
    const timer = setTimeout(() => {
      if (command.opened || this.isOpen()) return;
      const frame = new LoadingFrame(name, data => {
        this.remove(frame);
        command.loading = undefined;
        command.cancelled = true;
        if (matchesKey(data, 'ctrl+c')) this.editor.handleInput?.(data);
      });
      command.loading = frame;
      this.stack.push(frame);
      this.swap(this.editor, frame);
    }, LOADING_DELAY_MS);
    // The command reports its own errors; here a failure only ends the wait.
    const done = () => {
      clearTimeout(timer);
      if (command.loading) this.remove(command.loading);
    };
    pending.then(done, done);
    return pending;
  }

  /** The rows a menu may take: the terminal minus what stays on screen under it (the status lines). */
  private maxMenuRows(): number {
    return this.ui.terminal.rows - this.rowsBelow(this.ui.terminal.columns);
  }

  private rowsBelow(width: number): number {
    const inSlot = this.container.children.slice(this.container.children.indexOf(this.mounted()) + 1);
    const { children } = this.ui;
    const at = children.indexOf(this.container);
    const underSlot = at < 0 ? [] : children.slice(at + 1);
    return [...inSlot, ...underSlot].reduce((rows, child) => rows + child.render(width).length, 0);
  }

  /**
   * Takes the chat rows that the open menu, or the prompt's suggestions, push off screen out of `lines` (a
   * rendered frame), and returns the row where the menu starts. The frame keeps the length it has with the
   * prompt alone, so neither scrolls anything into the terminal's scrollback nor leaves blank rows when it
   * closes: the rows at the top of the screen make room for it and come back after.
   */
  fit(lines: string[], width: number): number | undefined {
    const menu = this.mountedMenu();
    const suggestions = this.editor.suggestionRows ?? 0;
    if ((!menu && !suggestions) || !this.ui.children.includes(this.container)) return undefined;
    const prompt = this.editor.render(width).length;
    const height = !menu ? prompt : menu instanceof MenuFrame ? menu.renderedRows : menu.render(width).length;
    const { rows } = this.ui.terminal;
    const { previousViewportTop, previousWidth, previousHeight } = tuiInternals(this.ui);
    const resized = previousWidth !== width || previousHeight !== rows;
    const withPrompt = lines.length - height + prompt - suggestions;
    const total = Math.max(withPrompt, rows + (resized ? 0 : previousViewportTop));
    const screenTop = total - rows;
    const below = this.rowsBelow(width);
    const hidden = Math.min(lines.length - total, lines.length - below - height - screenTop);
    if (hidden > 0) lines.splice(screenTop, hidden);
    return menu && lines.length - below - height;
  }

  private mounted(): Component {
    return this.stack[this.stack.length - 1] ?? this.editor;
  }

  private remove(frame: Component): void {
    const at = this.stack.indexOf(frame);
    if (at < 0) return;
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
  /** Row of the last rendered frame where the menu in the slot starts. */
  promptSlotTop: number | undefined;

  override render(width: number): string[] {
    const lines = super.render(width);
    this.promptSlotTop = this.promptSlot?.fit(lines, width);
    return lines;
  }

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
