import pc from 'picocolors';

/**
 * Formats platform deploy log lines for the terminal, mirroring the
 * platform dashboard's log viewer:
 *
 *   - a leading `[ISO timestamp]` becomes a gray local `HH:mm:ss.SSS`
 *   - `[info]` / `[warn]` / `[error]` style prefixes lose their brackets and
 *     get a level colour
 *   - pino-pretty style `INFO [2026-03-20 12:00:00 Z]` prefixes are folded
 *     into the same timestamp + level shape
 *   - anything else (Docker build output, raw application output) is passed
 *     through unchanged, indented to the message column
 *
 * A rolling tail writer keeps only the last N lines on screen when stdout is
 * a TTY so long build logs do not flood the terminal.
 */

const ANSI_SGR_SOURCE = String.raw`\x1b\[[0-9;]*m`;
const ANSI_CSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
/** CSI sequences other than colour/style (cursor moves, erases) that would shift the layout. */
const ANSI_NON_SGR_CSI_RE = /\x1b\[[0-9;?]*[A-LN-Za-ln-z]/g;
/** C0 control characters except tab (expanded separately) and escape (needed for colour). */
const CONTROL_CHARS_RE = /[\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]/g;
const LINE_BREAK_RE = /\r\n|\r|\n/;
const ANSI_SGR_AT_START_RE = new RegExp(`^${ANSI_SGR_SOURCE}`);
const ANSI_RESET = '\x1b[0m';

const ISO_TIMESTAMP_PREFIX_RE = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\]\s?/;
const ISO_TIMESTAMP_SHAPE_RE = /^\d{4}-\d{2}-\d{2}T/;
const LOG_METADATA_PREFIX_RE = /^\[([A-Za-z0-9][A-Za-z0-9_./:-]{0,31})\]\s*/;
const APPLICATION_LOG_PREFIX_RE = new RegExp(
  String.raw`^(?:${ANSI_SGR_SOURCE})*(INFO|DEBUG|TRACE|WARN(?:ING)?|ERROR|ERR|FATAL|SUCCESS|READY)(?:${ANSI_SGR_SOURCE})*\s+\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(Z|[+-]\d{2}:?\d{2})\](?:${ANSI_SGR_SOURCE})*\s*`,
  'i',
);

const LEVEL_LABELS = new Set([
  'info',
  'debug',
  'trace',
  'warn',
  'warning',
  'error',
  'err',
  'fatal',
  'success',
  'ready',
]);

/** Width of the `HH:mm:ss.SSS` timestamp column. */
export const TIMESTAMP_COLUMN_WIDTH = 12;
/** Minimum width reserved for a level label so messages line up. */
const LABEL_MIN_WIDTH = 5;
/** Default number of lines kept on screen while a deploy streams logs. */
export const DEFAULT_DEPLOY_LOG_TAIL_LINES = 20;
/** Width assumed when a TTY does not report its size; wrapping would break the redraw. */
const FALLBACK_TTY_COLUMNS = 80;

export interface ParsedDeployLogLine {
  /** Timestamp parsed from the line, when it carried one. */
  timestamp?: Date;
  /** Bracketed metadata labels (`info`, `warn`, `stderr`, ...) in order. */
  labels: string[];
  /** The remaining message, ANSI escapes preserved. */
  message: string;
}

function parseIsoTimestamp(iso: string): Date | undefined {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

/** Local `HH:mm:ss.SSS`, the same shape the platform log viewer shows. */
export function formatLogTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function parseDeployLogLine(raw: string): ParsedDeployLogLine {
  let remaining = raw;
  let timestamp: Date | undefined;
  const labels: string[] = [];

  const isoMatch = remaining.match(ISO_TIMESTAMP_PREFIX_RE);
  if (isoMatch?.[1]) {
    const parsed = parseIsoTimestamp(isoMatch[1]);
    if (parsed) {
      timestamp = parsed;
      remaining = remaining.slice(isoMatch[0].length);
    }
  }

  while (true) {
    const match = remaining.match(LOG_METADATA_PREFIX_RE);
    const label = match?.[1];
    if (!match || !label || ISO_TIMESTAMP_SHAPE_RE.test(label)) break;
    labels.push(label);
    remaining = remaining.slice(match[0].length);
  }

  const appMatch = remaining.match(APPLICATION_LOG_PREFIX_RE);
  if (appMatch) {
    const [, level, date, time, zone] = appMatch;
    if (level && date && time && zone) {
      const normalizedZone = zone === 'Z' || zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
      const parsed = parseIsoTimestamp(`${date}T${time}${normalizedZone}`);
      if (parsed) {
        timestamp ??= parsed;
        const normalizedLevel = level.toLowerCase();
        if (!labels.some(existing => existing.toLowerCase() === normalizedLevel)) {
          labels.push(normalizedLevel);
        }
        remaining = remaining.slice(appMatch[0].length);
      }
    }
  }

  return { timestamp, labels, message: remaining };
}

function colorLabel(label: string): string {
  switch (label.toLowerCase()) {
    case 'info':
    case 'debug':
    case 'trace':
      return pc.blue(label);
    case 'warn':
    case 'warning':
      return pc.yellow(label);
    case 'error':
    case 'err':
    case 'fatal':
      return pc.red(label);
    case 'success':
    case 'ready':
      return pc.green(label);
    default:
      return pc.gray(label);
  }
}

function formatLabel(label: string): string {
  const display = LEVEL_LABELS.has(label.toLowerCase()) ? label.toLowerCase() : label;
  const padding = ' '.repeat(Math.max(0, LABEL_MIN_WIDTH - display.length));
  return `${colorLabel(display)}${padding}`;
}

/**
 * Make a raw line safe to draw on exactly one terminal row: tabs become
 * spaces so width is predictable, and control characters or cursor-moving
 * escape sequences are dropped while colour codes are kept.
 */
export function sanitizeLogLine(raw: string): string {
  return raw.replace(/\t/g, '    ').replace(ANSI_NON_SGR_CSI_RE, '').replace(CONTROL_CHARS_RE, '');
}

/**
 * Split raw log entries on embedded line breaks so each result is one row.
 * Blank rows are kept as separators, except the one a trailing line break
 * would add after a multi-row entry.
 */
export function splitLogEntries(entries: string[]): string[] {
  return entries.flatMap(entry => {
    const pieces = entry.split(LINE_BREAK_RE);
    if (pieces.length > 1 && pieces[pieces.length - 1]!.trim() === '') pieces.pop();
    return pieces;
  });
}

/**
 * SGR (colour and style) state carried from one row to the next, so an entry
 * whose colour opens on its first line and resets on its last keeps that
 * colour on the rows in between once the entry is split.
 */
interface SgrState {
  foreground?: string;
  background?: string;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

const EMPTY_SGR_STATE: SgrState = { bold: false, dim: false, italic: false, underline: false };

/** Apply the SGR sequences found in `text` to `state` and return the result. */
export function advanceSgrState(state: SgrState, text: string): SgrState {
  let next = { ...state };
  for (const match of text.matchAll(/\x1b\[([0-9;]*)m/g)) {
    const codes = match[1] ? match[1].split(';').map(code => Number.parseInt(code, 10)) : [0];
    for (let i = 0; i < codes.length; i += 1) {
      const code = codes[i]!;
      if (Number.isNaN(code) || code === 0) next = { ...EMPTY_SGR_STATE };
      else if (code === 1) next.bold = true;
      else if (code === 2) next.dim = true;
      else if (code === 3) next.italic = true;
      else if (code === 4) next.underline = true;
      else if (code === 22) next.bold = next.dim = false;
      else if (code === 23) next.italic = false;
      else if (code === 24) next.underline = false;
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) next.foreground = String(code);
      else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) next.background = String(code);
      else if (code === 39) next.foreground = undefined;
      else if (code === 49) next.background = undefined;
      else if (code === 38 || code === 48) {
        const length = codes[i + 1] === 5 ? 3 : codes[i + 1] === 2 ? 5 : 1;
        const value = codes.slice(i, i + length).join(';');
        if (code === 38) next.foreground = value;
        else next.background = value;
        i += length - 1;
      }
    }
  }
  return next;
}

/** The escape sequence that restores `state` at the start of a new row. */
export function sgrOpenSequence(state: SgrState): string {
  const codes: string[] = [];
  if (state.bold) codes.push('1');
  if (state.dim) codes.push('2');
  if (state.italic) codes.push('3');
  if (state.underline) codes.push('4');
  if (state.foreground) codes.push(state.foreground);
  if (state.background) codes.push(state.background);
  return codes.length > 0 ? `\x1b[${codes.join(';')}m` : '';
}

/** Timestamp and level part of a row, ready to print. */
interface RenderedHead {
  text: string;
  /** Visible column where the message starts after this head. */
  messageColumn: number;
}

function renderHead(timestamp: Date | undefined, labels: string[]): RenderedHead {
  const time = timestamp ? pc.gray(formatLogTimestamp(timestamp)) : ' '.repeat(TIMESTAMP_COLUMN_WIDTH);
  const text = [time, ...labels.map(formatLabel)].join(' ');
  return { text, messageColumn: stripAnsi(text).length + 1 };
}

/**
 * Turns raw entries into printable rows, one at a time, keeping just enough
 * state to lay out multi-row entries the way the platform emits them:
 *
 *   - a row with no timestamp or level is a continuation of the previous
 *     entry and is indented to that entry's message column
 *   - a timestamp/level row with no text of its own is held back and
 *     attached to the next continuation row, so a banner that starts with a
 *     line break still shows its metadata on its first visible line
 *   - a held-back head followed by anything else becomes a blank separator
 *     row, as do blank entries
 *   - colour opened on one row and not reset carries on to the next rows
 */
export class DeployLogRowRenderer {
  private continuationColumn = TIMESTAMP_COLUMN_WIDTH + 1;
  private pendingHead: RenderedHead | undefined;
  private style: SgrState = { ...EMPTY_SGR_STATE };

  /** Prefix `text` with the carried style, then advance the style past it. */
  private styled(text: string): string {
    const opened = `${sgrOpenSequence(this.style)}${text}`;
    this.style = advanceSgrState(this.style, text);
    return closeStyling(opened);
  }

  /** Rows to print for one raw entry: none, one, or a separator plus one. */
  render(raw: string): string[] {
    const { timestamp, labels, message } = parseDeployLogLine(sanitizeLogLine(raw));
    const hasHead = Boolean(timestamp) || labels.length > 0;
    const isBlank = stripAnsi(message).trim() === '';

    if (hasHead) {
      const head = renderHead(timestamp, labels);
      const rows = this.releasePending();
      this.continuationColumn = head.messageColumn;
      if (isBlank) {
        // Escapes on a text-less line still change the carried style.
        this.style = advanceSgrState(this.style, message);
        this.pendingHead = head;
        return rows;
      }
      rows.push(`${head.text} ${this.styled(message)}`);
      return rows;
    }

    if (isBlank) {
      // A blank row absorbs a held-back head: one separator, not two.
      this.style = advanceSgrState(this.style, message);
      this.pendingHead = undefined;
      return [''];
    }

    if (this.pendingHead) {
      const head = this.pendingHead;
      this.pendingHead = undefined;
      return [`${head.text} ${this.styled(message)}`];
    }

    return [`${' '.repeat(this.continuationColumn)}${this.styled(message)}`];
  }

  /** A head still waiting for text becomes a separator row. */
  private releasePending(): string[] {
    if (!this.pendingHead) return [];
    this.pendingHead = undefined;
    return [''];
  }
}

/** Render one raw platform log line on its own, with no surrounding context. */
export function formatDeployLogLine(raw: string): string {
  return new DeployLogRowRenderer().render(raw).join('\n');
}

/**
 * A line whose own escapes never reset would bleed styling into the next
 * line; the tail writer re-renders lines, so close every styled line.
 */
function closeStyling(line: string): string {
  return line.includes('\x1b') && !line.endsWith(ANSI_RESET) ? `${line}${ANSI_RESET}` : line;
}

/** Remove ANSI control sequences (styling and cursor movement). */
export function stripAnsi(value: string): string {
  return value.replace(ANSI_CSI_RE, '');
}

/**
 * Cut a string to `width` visible characters, skipping ANSI escapes when
 * counting. Truncated lines end in an ellipsis and a style reset.
 */
export function truncateToWidth(value: string, width: number): string {
  if (width <= 0 || stripAnsi(value).length <= width) return value;

  let visible = 0;
  let out = '';
  let index = 0;
  while (index < value.length) {
    const escape = value.slice(index).match(ANSI_SGR_AT_START_RE);
    if (escape) {
      out += escape[0];
      index += escape[0].length;
      continue;
    }
    if (visible >= width - 1) break;
    out += value[index];
    visible += 1;
    index += 1;
  }
  return `${out}…${ANSI_RESET}`;
}

export interface DeployLogStream {
  write(chunk: string): unknown;
  isTTY?: boolean;
  columns?: number;
  rows?: number;
}

export interface DeployLogWriterOptions {
  /** Lines kept on screen. Ignored when the stream is not a TTY. */
  maxLines?: number;
  /** Print every line instead of a rolling window (for `--debug`). */
  showAll?: boolean;
  /**
   * Commit queued lines in timed steps so the window scrolls instead of
   * jumping when a poll returns many lines at once. Defaults to on; only
   * meaningful for the windowed (TTY) mode.
   */
  scroll?: boolean;
  /** Text placed before each line, e.g. the clack bar. */
  prefix?: string;
  stream?: DeployLogStream;
}

export interface DeployLogWriter {
  /** Format raw log entries and queue them for display. */
  write(...rawEntries: string[]): void;
  /** Draw every queued line now. Call before printing anything after the logs. */
  flush(): void;
}

/**
 * Queued lines land in discrete steps at this cadence. Each step commits one
 * line, or several when the queue is deep enough that single lines would
 * take longer than the drain target to clear.
 */
const SCROLL_STEP_INTERVAL_MS = 100;
const SCROLL_DRAIN_TARGET_MS = 2000;

/**
 * Create a writer that formats raw platform log lines and, on a TTY, keeps
 * only the most recent `maxLines` on screen by redrawing them in place.
 * Off a TTY (CI, piped output) every line is printed so nothing is lost.
 */
export function createDeployLogWriter(options: DeployLogWriterOptions = {}): DeployLogWriter {
  const stream = options.stream ?? process.stdout;
  const requestedLines = options.maxLines ?? DEFAULT_DEPLOY_LOG_TAIL_LINES;
  const prefix = options.prefix ?? '';
  const windowed = !options.showAll && Boolean(stream.isTTY) && requestedLines > 0;
  const scroll = windowed && (options.scroll ?? true);

  // The window plus the cursor row must fit on screen. If it does not, the
  // cursor-up before a redraw stops at the top row and stale rows leak.
  const fitWindow = (): number => {
    const rows = stream.rows ?? 0;
    return rows > 1 ? Math.min(requestedLines, rows - 1) : requestedLines;
  };

  const window: string[] = [];
  let rendered = 0;
  const pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Lines committed per step. Chosen when a burst arrives and held until the
  // queue empties, so a burst drains at a steady pace instead of tailing off.
  let stepSize = 1;

  const rows = new DeployLogRowRenderer();
  const blankRow = prefix.trimEnd();
  const render = (raw: string): string[] =>
    rows.render(raw).map(row => {
      if (row === '') return blankRow;
      const line = `${prefix}${row}`;
      // Leave one column spare: a line that exactly fills the row makes some
      // terminals wrap onto a blank line, which would break the redraw math.
      const columns = (stream.columns || FALLBACK_TTY_COLUMNS) - 1;
      return windowed ? truncateToWidth(line, columns) : line;
    });

  /** Draw rendered lines into the window, redrawing only once it is full. */
  const commit = (incoming: string[]): void => {
    if (incoming.length === 0) return;
    const maxLines = fitWindow();
    const overflow = window.length + incoming.length - maxLines;

    if (overflow <= 0) {
      // Window not full yet: append without redrawing what is already shown.
      window.push(...incoming);
      rendered = window.length;
      stream.write(incoming.map(line => `${line}\n`).join(''));
      return;
    }

    window.push(...incoming);
    window.splice(0, window.length - maxLines);

    // Move to the first drawn line, clear to the end of the screen, redraw.
    const cursorUp = rendered > 0 ? `\x1b[${rendered}A\x1b[0J` : '';
    stream.write(`${cursorUp}${window.map(line => `${line}\n`).join('')}`);
    rendered = window.length;
  };

  const step = (): void => {
    timer = undefined;
    if (pending.length === 0) return;
    commit(pending.splice(0, stepSize));
    if (pending.length > 0) {
      schedule();
    } else {
      stepSize = 1;
    }
  };

  const schedule = (): void => {
    if (timer !== undefined) return;
    timer = setTimeout(step, SCROLL_STEP_INTERVAL_MS);
    // A queued redraw must not keep the process alive on its own.
    timer.unref?.();
  };

  return {
    write(...rawEntries: string[]) {
      const incoming = splitLogEntries(rawEntries).flatMap(render);
      if (incoming.length === 0) return;

      if (!windowed) {
        stream.write(incoming.map(line => `${line}\n`).join(''));
        return;
      }

      if (!scroll) {
        commit(incoming);
        return;
      }
      pending.push(...incoming);
      stepSize = Math.max(stepSize, Math.ceil((pending.length * SCROLL_STEP_INTERVAL_MS) / SCROLL_DRAIN_TARGET_MS));
      schedule();
    },
    flush() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      commit(pending.splice(0));
    },
  };
}
