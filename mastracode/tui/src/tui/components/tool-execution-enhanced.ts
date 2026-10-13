/**
 * Enhanced tool execution component with better collapsible support.
 * This will replace the existing tool-execution.ts
 */

import * as os from 'node:os';
import {
  isAbsolute as isAbsolutePath,
  join as joinPath,
  relative as relativePath,
  resolve as resolvePath,
} from 'node:path';
import { Box, Spacer, Text, visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import { MC_TOOLS } from '@mastra/code-sdk/tool-names';
import type { TaskItemInput } from '@mastra/core/signals';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import type { Theme as HighlightTheme } from 'cli-highlight';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { formatStatusDuration } from '../status-duration.js';
import { BOX_INDENT, theme, mastra, tintHex, ensureTerminalGlyphContrast, getThemeMode } from '../theme.js';
import { truncateAnsi } from './ansi.js';
import { PENDING_SHELL_GROUP_KEY } from './chat-spacing.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { ErrorDisplayComponent } from './error-display.js';
import { statusDot, toolBlock } from './surface.js';
import type {
  CommandExitRecord,
  CompactToolLabelColor,
  IToolExecutionComponent,
  ToolResult,
} from './tool-execution-interface.js';
import { ToolValidationErrorComponent, parseValidationErrors } from './tool-validation-error.js';
import { WidthAwareContainer } from './width-aware-container.js';

export type { ToolResult };

/** CSI, OSC, and DCS/SOS/PM/APC sequences (terminated or not), and other two-byte ESC sequences. */
const TERMINAL_SEQUENCE_RE =
  /\x1b\[[\x20-\x3f]*[\x40-\x7e]?|\x1b[\]PX^_][^\x07\x1b]*(?:\x07|\x1b\\)?|\x9b[\x20-\x3f]*[\x40-\x7e]?|\x1b[\x20-\x7e]?/g;

const COMPACT_TOOL_COLOR = mastra.orange;
const COMPACT_TOOL_ARGS_BG = '#141414';
const TOOL_RAIL = tintHex(COMPACT_TOOL_COLOR, 0.35);
const CODE_PREVIEW_MAX_CHARS = 2_000;
const SHELL_COMMAND_HIGHLIGHT_MAX_CHARS = 2_000;

function normalizeHexColor(color: string | undefined): string | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  return color;
}

const CODE_HIGHLIGHT_THEME: HighlightTheme = {
  default: chalk.hex('#b4b4bd'),
  keyword: chalk.hex('#c4b5fd'),
  built_in: chalk.hex('#93c5fd'),
  type: chalk.hex('#93c5fd'),
  literal: chalk.hex('#fca5a5'),
  number: chalk.hex('#fbbf24'),
  string: chalk.hex('#9ecfa9'),
  regexp: chalk.hex('#fca5a5'),
  title: chalk.hex('#93c5fd'),
  function: chalk.hex('#7dd3fc'),
  params: chalk.hex('#b4b4bd'),
  comment: chalk.hex('#71717a'),
  meta: chalk.hex('#71717a'),
  attr: chalk.hex('#fbbf24'),
  variable: chalk.hex('#d4d4d8'),
  tag: chalk.hex('#c4b5fd'),
  name: chalk.hex('#c4b5fd'),
};

/** The same roles in darker tones that read on light backgrounds. */
const LIGHT_CODE_HIGHLIGHT_THEME: HighlightTheme = {
  default: text => theme.fg('toolArgs', text),
  keyword: chalk.hex('#7e22ce'),
  built_in: chalk.hex('#1d4ed8'),
  type: chalk.hex('#1d4ed8'),
  literal: chalk.hex('#b91c1c'),
  number: chalk.hex('#b45309'),
  string: chalk.hex('#15803d'),
  regexp: chalk.hex('#b91c1c'),
  title: chalk.hex('#1d4ed8'),
  function: chalk.hex('#1d4ed8'),
  params: chalk.hex('#3f3f46'),
  comment: chalk.hex('#71717a'),
  meta: chalk.hex('#52525b'),
  attr: chalk.hex('#b45309'),
  variable: chalk.hex('#3f3f46'),
  tag: chalk.hex('#7e22ce'),
  name: chalk.hex('#7e22ce'),
};

const codeHighlightTheme = (): HighlightTheme =>
  getThemeMode() === 'light' ? LIGHT_CODE_HIGHLIGHT_THEME : CODE_HIGHLIGHT_THEME;

const SHELL_CONTROL_WORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'for',
  'while',
  'until',
  'do',
  'done',
  'case',
  'esac',
  'in',
  'function',
]);

export interface ToolExecutionOptions {
  showImages?: boolean;
  autoCollapse?: boolean;
  collapsedByDefault?: boolean;
  /** Render the full bordered box instead of a compact row. Only live task-mutation tools use this. */
  fullRender?: boolean;
  previewLineLimit?: number;
  compactToolModeColor?: string;
  /** Where shell commands run (the git root, not necessarily where the TUI was launched). */
  projectRoot?: string;
}
/**
 * Convert absolute path to tilde notation if it's in home directory
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/** Grouped compact shell boxes start this narrow and widen, up to the full width, for longer rows. */
const SHELL_MIN_CONTENT_WIDTH = 76;

/** First line of `message` when a failed result is a JSON error object, e.g. a rejected tool input. */
function parseErrorMessage(output: string): string | undefined {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const message = (JSON.parse(trimmed) as { message?: unknown }).message;
    return typeof message === 'string'
      ? message
          .split('\n')
          .find(line => line.trim())
          ?.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Room kept for the right-aligned time so a ticking counter never changes the box width. */
const SHELL_TIME_WIDTH = 'started'.length;

function shortenPath(path: string): string {
  const home = os.homedir();
  if (path.startsWith(home)) {
    return `~${path.slice(home.length)}`;
  }
  return path;
}

/** Check if a tool name is a web search provider tool (e.g. web_search, web_search_20250305) */
function isWebSearchTool(name: string): boolean {
  return name === 'web_search' || /^web_search_\d+$/.test(name);
}

function isBrowserTool(name: string): boolean {
  return name.startsWith('browser_');
}

function isSkillTool(name: string): boolean {
  return name === 'skill' || name === 'skill_search' || name === 'skill_read';
}

/**
 * Extract the actual content from tool result text.
 */
function extractContent(text: string): { content: string; isError: boolean } {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      if ('content' in parsed) {
        const content = parsed.content;
        let contentStr: string;

        if (typeof content === 'string') {
          contentStr = content;
        } else if (Array.isArray(content)) {
          contentStr = content
            .filter(
              (part: unknown) =>
                typeof part === 'object' && part !== null && (part as Record<string, unknown>).type === 'text',
            )
            .map((part: unknown) => (part as Record<string, unknown>).text || '')
            .join('');
        } else {
          contentStr = JSON.stringify(content, null, 2);
        }

        return {
          content: contentStr,
          isError: Boolean(parsed.isError),
        };
      }
      return { content: JSON.stringify(parsed, null, 2), isError: false };
    }
  } catch {
    // Not JSON, use as-is
  }
  return { content: text, isError: false };
}

/**
 * Enhanced tool execution component with collapsible sections
 */
/** Shell output lines shown before the rest is folded behind ctrl+e. */

export class ToolExecutionComponentEnhanced extends WidthAwareContainer implements IToolExecutionComponent {
  private contentBox: Box;
  private toolName: string;
  private args: unknown;
  private expanded = false;
  private isPartial = true;
  private ui: TUI;
  private result?: ToolResult;
  private backgroundTaskId?: string;
  private backgroundCancelled = false;
  private options: ToolExecutionOptions;
  private startTime = Date.now();
  private streamingOutput = ''; // Buffer for streaming shell output
  private argsStreaming = false;
  private endTime?: number;
  /** Set for history entries whose run time could not be recovered, so no fake `0ms` is shown. */
  private durationUnknown = false;
  /** The sandbox's exit record for a shell call; more reliable than parsing the result text. */
  private commandExit?: CommandExitRecord;
  private liveUpdatesStopped = false;
  private shellTicker?: ReturnType<typeof setInterval>;
  private shellGroupWidth?: number;
  private shellGroupPreview?: string[];
  private shellHeld = false;
  /** Rows the shell box preview has used so far; it never shrinks, so rows below don't jump. */
  private shellPreviewRowFloor = 0;
  private readonly fullRender: boolean;
  private previewLineLimit: number;
  private previewRowFloor = 0;
  private compactToolContinuation = false;
  private compactToolHasFollowingContinuation = false;
  private compactToolPreviousSummary: string | undefined;
  private compactToolGroupLabelColor: CompactToolLabelColor | undefined;
  private compactToolModeColor: string | undefined;

  constructor(toolName: string, args: unknown, options: ToolExecutionOptions = {}, ui: TUI) {
    super();
    this.toolName = toolName;
    this.args = args;
    this.ui = ui;
    this.options = {
      autoCollapse: true,
      collapsedByDefault: true,
      ...options,
    };
    this.expanded = !this.options.collapsedByDefault;
    this.fullRender = this.options.fullRender ?? false;
    this.previewLineLimit = this.options.previewLineLimit ?? 2;
    this.compactToolModeColor = normalizeHexColor(this.options.compactToolModeColor);

    // Content box - left indent for chat history alignment, no background
    this.contentBox = new Box(BOX_INDENT, 0, (text: string) => text);
    this.addChild(this.contentBox);
    this.updateTrailingSpacer();

    this.rebuild();
  }

  updateArgs(args: unknown, rebuild = true): void {
    this.args = args;
    if (rebuild) this.rebuild();
  }

  setArgsStreaming(streaming: boolean): void {
    if (this.argsStreaming === streaming) return;
    this.argsStreaming = streaming;
    this.rebuild();
  }

  refresh(): void {
    this.rebuild();
  }

  updateResult(result: ToolResult, isPartial = false): void {
    this.result = result;
    this.isPartial = isPartial;
    if (!isPartial) this.endTime ??= Date.now();
    // Keep streaming output for colored display in final result
    this.rebuild();
  }

  /** Restores the run time of a tool call rendered from history. */
  setRecordedTiming(startedAt: number | undefined, endedAt: number | undefined): void {
    if (startedAt === undefined || endedAt === undefined) {
      this.durationUnknown = true;
    } else {
      this.durationUnknown = false;
      this.startTime = startedAt;
      this.endTime = endedAt;
    }
    this.rebuild();
  }

  setCommandExit(exit: CommandExitRecord): void {
    this.commandExit = exit;
    this.rebuild();
  }

  setBackgroundTaskId(taskId: string): void {
    this.backgroundTaskId = taskId;
    this.rebuild();
  }

  getBackgroundTaskId(): string | undefined {
    return this.backgroundTaskId;
  }

  cancelBackground(): void {
    this.backgroundCancelled = true;
    this.isPartial = false;
    this.rebuild();
  }

  /**
   * Append streaming shell output.
   * Only for execute_command tool - shows live output while command runs.
   */
  appendStreamingOutput(output: string): void {
    if (
      this.toolName !== MC_TOOLS.EXECUTE_COMMAND &&
      this.toolName !== MC_TOOLS.GET_PROCESS_OUTPUT &&
      this.toolName !== MC_TOOLS.KILL_PROCESS
    ) {
      return;
    }
    this.streamingOutput += sanitizeAnsiForRendering(output);
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  setPreviewLineLimit(limit: number): void {
    const normalizedLimit = Number.isFinite(limit) ? limit : 2;
    this.previewLineLimit = Math.min(8, Math.max(0, Math.floor(normalizedLimit)));
    this.previewRowFloor = Math.min(this.previewRowFloor, this.previewLineLimit);
    this.shellPreviewRowFloor = Math.min(this.shellPreviewRowFloor, this.previewLineLimit);
    this.rebuild();
  }

  getToolCall(): { toolName: string; args: unknown } {
    return { toolName: this.toolName, args: this.args };
  }

  setCompactToolModeColor(color: string | undefined): void {
    const nextColor = normalizeHexColor(color);
    if (this.compactToolModeColor === nextColor) return;
    this.compactToolModeColor = nextColor;
    if (!this.fullRender) this.rebuild();
  }

  getChatSpacingKind(): ChatSpacingKind | undefined {
    if (this.fullRender) return 'full-tool';
    if (this.toolName !== MC_TOOLS.EXECUTE_COMMAND) return 'compact-tool';
    if (this.isCompactShell()) return this.shellHeld ? undefined : 'compact-tool';
    return 'shell-tool';
  }

  getCompactToolGroupKey(): string | undefined {
    // Shell calls only share a box when they run in the same directory, so each box has one header.
    if (this.toolName === MC_TOOLS.EXECUTE_COMMAND && this.isCompactShell()) {
      return this.isShellDirectoryPending() ? PENDING_SHELL_GROUP_KEY : `$ ${this.getShellHeaderPath()}`;
    }
    if (this.getChatSpacingKind() !== 'compact-tool') return undefined;
    return this.getCompactToolLabel();
  }

  getCompactToolGroupSummary(): string | undefined {
    if (this.getChatSpacingKind() !== 'compact-tool') return undefined;
    if (this.toolName === MC_TOOLS.EXECUTE_COMMAND) return undefined;
    return this.getCompactToolSummary();
  }

  /**
   * Split a leading "cd <path>" off the command, since the path is shown separately. Callers bake
   * this prefix into the command instead of passing `cwd`, and separate it with "&&", ";", or a
   * bare newline — with quoted paths and leading whitespace also showing up.
   */
  private parseShellCommand(): { command: string; cdPath: string } {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const command = argsObj?.command ? String(argsObj.command) : '...';
    const cdMatch = command.match(/^\s*cd\s+(?:"([^"]*)"|'([^']*)'|([^\s;]+))\s*(?:&&|;|\n)\s*(?=\S)/);
    if (!cdMatch) return { command, cdPath: '' };
    return { command: command.slice(cdMatch[0].length), cdPath: cdMatch[1] ?? cdMatch[2] ?? cdMatch[3] ?? '' };
  }

  /**
   * The directory the command runs in, as written: the shell starts in `cwd`, then a leading `cd`
   * moves it, relative to `cwd` unless the `cd` path is absolute or starts at home.
   */
  private getShellDirectory(): string {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const cwd = argsObj?.cwd ? String(argsObj.cwd) : '';
    const { cdPath } = this.parseShellCommand();
    if (!cwd || !cdPath) return cwd || cdPath;
    if (cdPath.startsWith('/') || cdPath === '~' || cdPath.startsWith('~/')) return cdPath;
    // Expand home first: joining `~` with `..` would otherwise cancel out to `.`.
    const expandedCwd = cwd === '~' || cwd.startsWith('~/') ? os.homedir() + cwd.slice(1) : cwd;
    return joinPath(expandedCwd, cdPath);
  }

  /** The directory a compact shell group shows in its `$ <path>` header, resolved the way the sandbox resolves it. */
  private getShellHeaderPath(): string {
    const raw = this.getShellDirectory();
    const expanded = raw === '~' || raw.startsWith('~/') ? os.homedir() + raw.slice(1) : raw;
    const projectRoot = this.options.projectRoot ?? process.cwd();
    const resolved = resolvePath(projectRoot, expanded || '.');
    // The project root shows in full so tabs stay distinguishable; paths inside it stay short.
    const relative = relativePath(projectRoot, resolved);
    if (relative && !relative.startsWith('..') && !isAbsolutePath(relative)) return `./${relative}`;
    return shortenPath(resolved);
  }

  /**
   * While args stream, the directory is unknown until a complete `cd <dir> &&` prefix arrives. A
   * streaming `cwd` may still be partial, and without either the call may yet get one.
   */
  private isShellDirectoryPending(): boolean {
    if (!this.argsStreaming || this.result) return false;
    const argsObj = this.args as Record<string, unknown> | undefined;
    // A string `cwd` may still be partial; a streamed `null` is complete and means "no cwd".
    if (typeof argsObj?.cwd === 'string') return true;
    if (typeof argsObj?.command !== 'string') return true;
    if (this.parseShellCommand().cdPath) return false;
    // Still undecided while the command could be the start of a `cd <dir> &&` prefix.
    return /^\s*(?:c|cd|cd\s[\s\S]*)?$/.test(argsObj.command);
  }

  /**
   * Held while its directory is unknown and a shell box sits right above it: drawing the row in
   * that box, then moving it to its own directory's box, would make the chat jump. Rendered once
   * the directory is known, the row only ever adds lines.
   */
  setShellHeld(held: boolean): void {
    if (this.shellHeld === held) return;
    this.shellHeld = held;
    if (this.isCompactShell()) this.rebuild();
  }

  private getShellDescription(): string {
    const description = (this.args as Record<string, unknown> | undefined)?.description;
    return typeof description === 'string' ? description.replace(/\s+/g, ' ').trim() : '';
  }

  /**
   * Consecutive shell calls in one directory share a box: an optional preview of the
   * latest output, a `$ <path>` header, then one status row per call. Expanding shows the full box.
   */
  private isCompactShell(): boolean {
    return !this.fullRender && this.toolName === MC_TOOLS.EXECUTE_COMMAND && !this.expanded;
  }

  /**
   * The last `previewLineLimit` lines this call printed, for its box's shared preview; `[]` when
   * it printed nothing and `undefined` when previews are off.
   */
  getShellPreviewLines(): string[] | undefined {
    if (!this.isCompactShell() || this.shellHeld || this.previewLineLimit <= 0) return undefined;
    const output = this.streamingOutput.trim() ? this.streamingOutput : this.getFormattedOutput();
    const lines = output.split('\n').filter(line => !/^(?:stdout:|stderr:|Exit code: -?\d+)$/.test(line.trim()));
    while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
    return lines.slice(-this.previewLineLimit);
  }

  /** Set on the first call of a shell box, which draws the box's preview above its header. */
  setShellGroupPreview(lines: string[] | undefined): void {
    const current = this.shellGroupPreview;
    if (current === lines || (current && lines && current.join('\n') === lines.join('\n'))) return;
    this.shellGroupPreview = lines;
    if (this.isCompactShell()) this.rebuild();
  }

  /**
   * Text for a grouped compact shell row: the description; while it may still stream in, `...` or how
   * much of the command has arrived (some models write a long command first); or the command's
   * first line when the call has none (e.g. it was rejected for a missing description).
   * Muted text is not the description, and truncates rather than widening the box.
   */
  private getShellRowText(): { text: string; muted: boolean } {
    const description = this.getShellDescription();
    if (description) return { text: description, muted: false };
    const command = (this.args as Record<string, unknown> | undefined)?.command;
    if (this.argsStreaming && !this.result) {
      if (typeof command !== 'string' || !command) return { text: '...', muted: false };
      const size = command.length < 1000 ? `${command.length}` : `${(command.length / 1000).toFixed(1)}k`;
      return { text: `writing command (${size} chars)`, muted: true };
    }
    const firstLine =
      this.parseShellCommand()
        .command.split('\n')
        .find(line => line.trim()) ?? '...';
    return { text: firstLine.trim(), muted: true };
  }

  hasStreamingPreview(): boolean {
    return (
      !this.fullRender &&
      this.toolName !== MC_TOOLS.EXECUTE_COMMAND &&
      this.previewLineLimit > 0 &&
      (this.previewRowFloor > 0 || this.getActivePreview() !== '')
    );
  }

  setCompactToolContinuation(continuation: boolean, previousSummary?: string): void {
    if (this.compactToolContinuation === continuation && this.compactToolPreviousSummary === previousSummary) return;
    this.compactToolContinuation = continuation;
    this.compactToolPreviousSummary = previousSummary;
    this.rebuild();
  }

  setCompactToolHasFollowingContinuation(hasFollowingContinuation: boolean): void {
    if (this.compactToolHasFollowingContinuation === hasFollowingContinuation) return;
    this.compactToolHasFollowingContinuation = hasFollowingContinuation;
    this.rebuild();
  }

  isComplete(): boolean {
    return !this.isPartial;
  }

  toggleExpanded(): void {
    this.setExpanded(!this.expanded);
  }

  override invalidate(): void {
    super.invalidate();
    // invalidate is called by the layout system — only update bg, don't rebuild
    this.updateBgColor();
  }

  private updateBgColor(): void {
    // No background for any tools - use bordered box style instead
    this.contentBox.setBgFn((text: string) => text);
  }

  private updateTrailingSpacer(): void {
    const trailingSpacerHeight = 0;
    const desiredChildren = trailingSpacerHeight > 0 ? 2 : 1;
    while (this.children.length > desiredChildren) {
      this.children.pop();
    }
    if (this.children.length < desiredChildren) {
      this.addChild(new Spacer(trailingSpacerHeight));
    }
  }

  private getCollapsedLineLimit(defaultLimit: number): number {
    return defaultLimit;
  }

  /**
   * Full clear-and-rebuild. Called when:
   * - args change (updateArgs)
   * - result arrives or changes (updateResult)
   * - expand/collapse on a tool with no collapsible child
   * - initial construction
   */
  protected rebuildForWidth(_width: number): void {
    this.updateBgColor();
    this.contentBox.clear();
    if (!this.isCompactShell()) this.syncShellTicker(false);

    if (this.fullRender) {
      if (this.toolName === 'task_write') this.renderTaskWriteEnhanced();
      else this.renderGenericToolEnhanced();
      return;
    }

    if (this.toolName === MC_TOOLS.EXECUTE_COMMAND) {
      this.renderBashToolEnhanced();
      return;
    }

    this.renderCompactTool();
  }

  private renderCompactTool(): void {
    const termWidth = this.renderWidth;
    const maxLineWidth = termWidth - BOX_INDENT * 2 - 2;
    const lines = this.getCompactToolSummaryLines();

    for (const line of lines) {
      this.contentBox.addChild(new Text(truncateAnsi(line, maxLineWidth), 0, 0));
    }
  }

  private getPreviewLines(maxLineWidth: number): string[] {
    if (this.fullRender || this.toolName === MC_TOOLS.EXECUTE_COMMAND || this.previewLineLimit <= 0) return [];

    const preview = this.getActivePreview();
    let lines: string[] = [];

    if (preview) {
      if (this.isCodePreviewTool()) {
        lines = this.getCodePreviewLines(preview, maxLineWidth);
      } else {
        const firstLineWidth = Math.max(10, maxLineWidth - 4);
        const continuationWidth = Math.max(10, maxLineWidth - 4);
        // Signal messages lead with the request, so show their opening lines instead of the latest output.
        const wrapped =
          this.toolName === MC_TOOLS.AGENT_SIGNAL_SEND
            ? this.wrapAgentSignalMessageLines(preview, Math.max(1, firstLineWidth - 2)).slice(0, this.previewLineLimit)
            : this.wrapPreviewLines(preview, firstLineWidth, continuationWidth).slice(-this.previewLineLimit);

        lines = wrapped.map(line => {
          const linePrefix = `  ${chalk.hex(this.getToolRailColor())('│')} `;
          return truncateAnsi(`${linePrefix}${this.formatActivePreview(line)}`, maxLineWidth);
        });
      }
    }

    this.previewRowFloor = Math.min(this.previewLineLimit, Math.max(this.previewRowFloor, lines.length));
    const padding = Array.from({ length: this.previewRowFloor - lines.length }, () => {
      const linePrefix = `  ${chalk.hex(this.getToolRailColor())('│')} `;
      return truncateAnsi(linePrefix, maxLineWidth);
    });
    return [...padding, ...lines];
  }

  private getCodePreviewLines(preview: string, maxLineWidth: number): string[] {
    const linePrefix = `  ${chalk.hex(this.getToolRailColor())('│')} `;
    return this.highlightCodePreview(preview)
      .split('\n')
      .slice(-this.previewLineLimit)
      .map(line => truncateAnsi(`${linePrefix}${line}`, maxLineWidth));
  }

  private isCodePreviewTool(): boolean {
    return (
      this.toolName === MC_TOOLS.VIEW ||
      this.toolName === MC_TOOLS.WRITE_FILE ||
      this.toolName === MC_TOOLS.STRING_REPLACE_LSP
    );
  }

  private getPreviewCapLine(): string {
    return `  ${chalk.hex(this.getToolRailColor())('╰──')}`;
  }

  private getPreviewSpacerLine(): string {
    return `  ${chalk.hex(this.getToolRailColor())('│')}`;
  }

  private shouldClosePreview(): boolean {
    return !this.compactToolHasFollowingContinuation;
  }

  private formatActivePreview(preview: string): string {
    if (this.toolName === MC_TOOLS.FIND_FILES || this.toolName === MC_TOOLS.SEARCH_CONTENT) {
      return theme.fg('toolOutput', preview);
    }

    return theme.fg('text', preview);
  }

  private highlightCodePreview(preview: string): string {
    const path = this.getFirstStringArg('path');
    try {
      return highlight(preview, {
        language: getLanguageFromPath(path),
        ignoreIllegals: true,
        theme: codeHighlightTheme(),
      });
    } catch {
      return theme.fg('toolArgs', preview);
    }
  }

  private highlightShellCommandToken(token: string): string {
    if (token === '&&' || token === '||' || token === '|' || token === ';' || token === '&') {
      return theme.fg('muted', token);
    }
    if (token === '(' || token === ')' || token === '<' || token === '>') {
      return theme.fg('muted', token);
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) return chalk.white(token);
    if (SHELL_CONTROL_WORDS.has(token)) return chalk.blue(token);
    return theme.fg('toolArgs', token);
  }

  private highlightShellCommandLine(
    line: string,
    quote: 'single' | 'double' | undefined,
  ): { line: string; quote: 'single' | 'double' | undefined } {
    let highlighted = '';
    let plain = '';
    let quoted = '';
    let activeQuote = quote;

    const flushPlain = () => {
      if (!plain) return;
      highlighted += plain.replace(
        /&&|\|\||[|;&()<>]|-{1,2}[a-zA-Z0-9_.=/-]+|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
        token => this.highlightShellCommandToken(token),
      );
      plain = '';
    };
    const flushQuoted = () => {
      if (!quoted) return;
      highlighted += chalk.white(quoted);
      quoted = '';
    };

    for (let index = 0; index < line.length; index++) {
      const char = line[index]!;

      if (activeQuote) {
        quoted += char;
        let precedingBackslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor--) {
          precedingBackslashes++;
        }
        const closesQuote =
          (activeQuote === 'single' && char === "'") ||
          (activeQuote === 'double' && char === '"' && precedingBackslashes % 2 === 0);
        if (closesQuote) {
          flushQuoted();
          activeQuote = undefined;
        }
        continue;
      }

      if (char === "'" || char === '"') {
        flushPlain();
        activeQuote = char === "'" ? 'single' : 'double';
        quoted += char;
        continue;
      }

      plain += char;
    }

    flushPlain();
    flushQuoted();
    return { line: highlighted, quote: activeQuote };
  }

  private wrapShellCommand(command: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    let currentWidth = 0;
    let highlightedChars = 0;
    let quote: 'single' | 'double' | undefined;

    const pushCurrent = () => {
      const highlightLength = Math.min(current.length, SHELL_COMMAND_HIGHLIGHT_MAX_CHARS - highlightedChars);
      const highlighted = this.highlightShellCommandLine(current.slice(0, highlightLength), quote);
      lines.push(highlighted.line + current.slice(highlightLength));
      highlightedChars += highlightLength;
      quote = highlighted.quote;
      current = '';
      currentWidth = 0;
    };

    for (const char of command) {
      if (char === '\n') {
        pushCurrent();
        continue;
      }

      const charWidth = visibleWidth(char);
      if (current && currentWidth + charWidth > width) {
        pushCurrent();
      }
      if (!current && /^\s$/.test(char)) continue;

      current += char;
      currentWidth += charWidth;
    }

    if (current || lines.length === 0) pushCurrent();
    return lines;
  }

  private wrapPreviewLines(preview: string, firstLineWidth: number, continuationWidth: number): string[] {
    const lines: string[] = [];
    let width = firstLineWidth;

    for (const sourceLine of preview.split('\n')) {
      if (sourceLine.length === 0) {
        if (lines.length > 0) width = continuationWidth;
        continue;
      }

      let remaining = sourceLine;
      while (remaining.length > width) {
        lines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
        width = continuationWidth;
      }

      lines.push(remaining);
      width = continuationWidth;
    }

    return lines;
  }

  private wrapAgentSignalMessageLines(message: string, width: number): string[] {
    return message.split('\n').flatMap(line => (line.length === 0 ? [''] : wrapTextWithAnsi(line, width)));
  }

  private getCompactToolSummaryLines(): string[] {
    const status = this.getCompactStatusIndicator();
    const toolLabel = this.getCompactToolLabel();
    const toolLabelColor = this.getCompactToolLabelColor();
    const summary = this.compactToolContinuation ? this.getCompactContinuationSummary() : this.getCompactToolSummary();
    const detailLines = this.getPreviewLines(this.renderWidth - BOX_INDENT * 2 - 2);
    const firstLine = this.compactToolContinuation
      ? summary
        ? `${this.getCompactContinuationIndent()}${this.formatCompactContinuationLine(summary)}${status}`
        : this.compactToolPreviousSummary
          ? `${this.getCompactContinuationIndent()}${this.formatEmptyCompactContinuationLine()}${status}`
          : `${this.getCompactContinuationIndent()}${this.formatCompactToolHeader(toolLabel, toolLabelColor, '')}${status}`
      : `${this.formatCompactToolHeader(toolLabel, toolLabelColor, summary)}${status}`;

    if (detailLines.length === 0) return [firstLine];
    const previewLines = this.shouldClosePreview() ? [...detailLines, this.getPreviewCapLine()] : detailLines;
    if (this.compactToolHasFollowingContinuation) previewLines.push(this.getPreviewSpacerLine());
    return [firstLine, ...previewLines];
  }

  private getCompactStatusIndicator(): string {
    const backgroundStatus = this.getBackgroundStatusIndicator();
    if (backgroundStatus) return backgroundStatus;
    return this.isErrorResult() ? theme.fg('error', ' ✗') : '';
  }

  private formatCompactToolHeader(toolLabel: string, toolLabelColor: CompactToolLabelColor, summary: string): string {
    const color = this.getCompactToolAccentColor(toolLabelColor);
    const argsBg = this.getCompactToolArgsBg(toolLabelColor);
    const argsColor = this.getCompactToolArgsColor(toolLabelColor);
    const leftHalf = chalk.hex(color)('▐');
    const rightHalf = summary ? chalk.hex(color).bgHex(argsBg)('▌') : chalk.hex(color)('▌');
    const label = `${leftHalf}${chalk.bgHex(color).hex('#000000').bold(toolLabel)}${rightHalf}`;
    const args = summary ? this.formatCompactSummaryBadge(summary, argsBg, argsColor) : '';
    const trail = summary ? chalk.hex(argsBg)('▌') : '';
    return `${label}${args}${trail}`;
  }

  private getCompactToolAccentColor(toolLabelColor: CompactToolLabelColor): string {
    if (this.isErrorResult() || toolLabelColor === 'error') return mastra.red;
    return this.compactToolModeColor ?? COMPACT_TOOL_COLOR;
  }

  private getCompactToolArgsBg(toolLabelColor: CompactToolLabelColor): string {
    if (this.isErrorResult() || toolLabelColor === 'error') return tintHex(mastra.red, 0.15);
    return COMPACT_TOOL_ARGS_BG;
  }

  private getCompactToolArgsColor(toolLabelColor: CompactToolLabelColor): string | undefined {
    if (this.isErrorResult() || toolLabelColor === 'error') return undefined;
    return this.compactToolModeColor ?? COMPACT_TOOL_COLOR;
  }

  private getToolRailColor(): string {
    const color = this.isErrorResult()
      ? tintHex(mastra.red, 0.35)
      : this.compactToolModeColor
        ? tintHex(this.compactToolModeColor, 0.35)
        : TOOL_RAIL;
    return ensureTerminalGlyphContrast(color);
  }

  private getToolCircleColor(color: string): string {
    return ensureTerminalGlyphContrast(color);
  }

  getCompactToolLabelColor(): CompactToolLabelColor {
    if (this.compactToolGroupLabelColor) return this.compactToolGroupLabelColor;
    return this.getOwnCompactToolLabelColor();
  }

  setCompactToolGroupLabelColor(color: CompactToolLabelColor | undefined): void {
    if (this.compactToolGroupLabelColor === color) return;
    this.compactToolGroupLabelColor = color;
    this.rebuild();
  }

  getOwnCompactToolLabelColor(): CompactToolLabelColor {
    return this.isErrorResult() ? 'error' : 'toolTitle';
  }

  private isErrorResult(): boolean {
    if (this.result?.isError) return true;
    if (!this.result) return false;

    const output = this.getFormattedOutput();
    if (this.toolName === MC_TOOLS.STRING_REPLACE_LSP && /specified text was not found/i.test(output)) return true;
    return false;
  }

  private getActivePreview(): string {
    if (this.isErrorResult()) return this.formatErrorPreview();
    if (isWebSearchTool(this.toolName)) return this.formatWebSearchPreview();
    if (isBrowserTool(this.toolName)) return this.formatBrowserPreview();
    if (isSkillTool(this.toolName)) return this.formatSkillPreview();
    if (this.toolName === MC_TOOLS.GET_PROCESS_OUTPUT) return this.formatProcessOutputPreview();
    if (this.toolName === MC_TOOLS.FILE_STAT) return this.formatFileStatPreview();

    switch (this.toolName) {
      case MC_TOOLS.VIEW:
        return this.formatViewPreview();
      case MC_TOOLS.FIND_FILES:
        return this.formatListPreview();
      case 'skill':
        return '';
      case MC_TOOLS.STRING_REPLACE_LSP:
        return this.formatEditPreview();
      case MC_TOOLS.WRITE_FILE:
        return this.getLatestCodePreview('content');
      case MC_TOOLS.SEARCH_CONTENT:
        return this.formatSearchDetail();
      case MC_TOOLS.LSP_INSPECT:
        return this.getFirstLineArg('match', 80);
      case MC_TOOLS.AGENT_SIGNAL_SEND:
        return this.formatAgentSignalSendPreview();
      default:
        return this.formatGenericResultPreview();
    }
  }

  private formatEditPreview(): string {
    return (
      this.getLatestCodePreview('new_str') ||
      this.getLatestCodePreview('new_string') ||
      this.getLatestCodePreview('old_str') ||
      this.getLatestCodePreview('old_string')
    );
  }

  private getLatestCodePreview(key: string): string {
    const value = this.getFirstStringArg(key);
    if (!value) return '';
    const normalized = value.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
    if (!normalized) return '';
    const lines = normalized.split('\n');
    const latestLines = lines.slice(-Math.max(1, this.previewLineLimit)).join('\n');
    if (this.isPartial && (this.toolName === MC_TOOLS.WRITE_FILE || this.toolName === MC_TOOLS.STRING_REPLACE_LSP)) {
      return latestLines;
    }
    if (latestLines.length <= CODE_PREVIEW_MAX_CHARS) return latestLines;
    return latestLines.slice(-CODE_PREVIEW_MAX_CHARS);
  }

  private formatErrorPreview(): string {
    const outputLines = this.stripAnsi(this.getFormattedOutput())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (outputLines.some(line => line.startsWith('Validation error:') || line.startsWith('Parameter:'))) {
      return outputLines.join(' — ');
    }
    return outputLines.slice(0, 2).join('\n');
  }

  private formatViewPreview(): string {
    if (!this.result) return '';

    const output = this.getFormattedOutput();
    if (!output || !this.looksLikeViewOutput(output)) return '';

    const argsObj = this.args as Record<string, unknown> | undefined;
    const viewRange = argsObj?.view_range as [number, number] | undefined;
    const startLine = viewRange?.[0] ?? (argsObj?.offset as number | undefined) ?? 1;
    return getPlainCodeFromViewOutput(output, startLine);
  }

  private formatListPreview(): string {
    if (!this.result) return '';

    const entries = this.getListResultEntries();
    if (entries.length === 0) return '';

    return entries.slice(0, 2).join('\n');
  }

  private formatWebSearchPreview(): string {
    if (!this.result) return '';

    return this.stripAnsi(this.formatWebSearchResults())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');
  }

  private formatBrowserPreview(): string {
    if (!this.result || !['browser_snapshot', 'browser_evaluate'].includes(this.toolName)) return '';
    const output = this.unwrapBrowserToolOutput(this.getFormattedOutput());
    return this.stripAnsi(output)
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');
  }

  private unwrapBrowserToolOutput(output: string): string {
    try {
      const parsed = JSON.parse(output) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return output;
      const record = parsed as Record<string, unknown>;
      if (this.toolName === 'browser_evaluate' && record.result !== undefined) {
        return this.formatBrowserEvaluateResult(record.result);
      }
      if (this.toolName === 'browser_snapshot' && typeof record.snapshot === 'string') return record.snapshot;
      if (typeof record.error === 'string') return record.error;
      return '';
    } catch {
      return output;
    }
  }

  private formatBrowserEvaluateResult(result: unknown): string {
    if (typeof result === 'string') return result;
    if (typeof result !== 'object' || result === null) return String(result);
    if (Array.isArray(result)) return `[${result.length} items]`;

    return Object.entries(result as Record<string, unknown>)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${this.formatCompactBrowserValue(value)}`)
      .join('\n');
  }

  private formatCompactBrowserValue(value: unknown): string {
    if (typeof value === 'string') return value === '' ? '""' : value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{…}';
    return String(value);
  }

  private formatProcessOutputPreview(): string {
    if (!this.result) return '';
    return this.stripAnsi(this.getFormattedOutput())
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .slice(0, 3)
      .join('\n');
  }

  private formatFileStatPreview(): string {
    if (!this.result) return '';
    const output = this.stripAnsi(this.getFormattedOutput()).trim();
    return output.replace(/^\S+\s+/, '').replace(/\s+/g, ' ');
  }

  private formatGenericResultPreview(): string {
    if (!this.result) return '';
    const output = this.stripAnsi(this.getFormattedOutput()).trim();
    if (!output) return '';

    const compactJson = this.formatCompactJsonResult(output);
    const preview = compactJson || output;
    const argsSummary = this.stripAnsi(this.formatArgsSummary()).trim();
    if (argsSummary && preview === argsSummary) return '';

    const lines = preview
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean);

    return (this.isPartial ? lines : lines.slice(0, this.previewLineLimit)).join('\n');
  }

  private formatCompactJsonResult(output: string): string {
    try {
      const parsed = JSON.parse(output) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return String(parsed);
      if (Array.isArray(parsed)) return `[${parsed.length} items]`;
      return Object.entries(parsed as Record<string, unknown>)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${this.formatCompactBrowserValue(value)}`)
        .join('\n');
    } catch {
      return '';
    }
  }

  private formatSkillPreview(): string {
    if (!this.result || this.toolName !== 'skill_search') return '';
    return this.stripAnsi(this.getFormattedOutput())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');
  }

  private getListResultEntries(): string[] {
    return this.getFormattedOutput()
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.trim() !== '' && line.trim() !== '.');
  }

  private looksLikeViewOutput(output: string): boolean {
    return output.split('\n').some(line => /^\s*\d+[\t→]/.test(line));
  }

  private stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private getCompactContinuationIndent(): string {
    return '  ';
  }

  private formatEmptyCompactContinuationLine(): string {
    const railColor = this.getToolRailColor();
    const isStreamingContinuation = !this.isComplete() && this.previewLineLimit > 0;
    if (isStreamingContinuation) {
      const circleColor = this.getToolCircleColor(this.getCompactToolAccentColor(this.getCompactToolLabelColor()));
      return `${chalk.hex(circleColor)('●')}${chalk.hex(railColor)('─')}`;
    }
    return chalk.hex(railColor)(this.compactToolHasFollowingContinuation ? '├─' : '╰─');
  }

  private formatCompactContinuationLine(summary: string): string {
    const lineMatch = summary.match(/^─+/);
    const linePrefix = lineMatch?.[0] ?? '';
    const separator = linePrefix ? '' : ' ';
    const hasFollowing = this.compactToolHasFollowingContinuation || this.hasStreamingPreview();
    const hasPreview = this.hasStreamingPreview();
    const toolLabelColor = this.getCompactToolLabelColor();
    const color = this.getCompactToolAccentColor(toolLabelColor);
    const argsBg = this.getCompactToolArgsBg(toolLabelColor);
    const argsColor = this.getCompactToolArgsColor(toolLabelColor);
    const railColor = this.getToolRailColor();
    const circleColor = this.getToolCircleColor(color);
    const isStreamingContinuation = this.compactToolContinuation && !this.isComplete() && this.previewLineLimit > 0;
    const branch =
      hasFollowing || isStreamingContinuation
        ? `${hasPreview || isStreamingContinuation ? chalk.hex(circleColor)('●') : chalk.hex(railColor)('├')}${chalk.hex(railColor)(`─${separator}${linePrefix}`)}`
        : chalk.hex(railColor)(`╰─${separator}${linePrefix}`);
    const continuationSummary = ` ${summary.slice(linePrefix.length)}`;
    const trail = continuationSummary ? chalk.hex(argsBg)('▌') : '';
    return `${branch}${this.formatCompactSummaryBadge(continuationSummary, argsBg, argsColor)}${trail}`;
  }

  private formatCompactSummaryBadge(summary: string, argsBg: string, argsColor?: string): string {
    const styleText = (text: string) => (argsColor ? chalk.hex(argsColor)(text) : theme.fg('text', text));
    const rangeMatch = summary.match(/(:\d+(?:-\d+)?)$/);
    if (!rangeMatch?.[1]) return chalk.bgHex(argsBg)(styleText(summary));

    const rangeStart = summary.length - rangeMatch[1].length;
    return `${chalk.bgHex(argsBg)(styleText(summary.slice(0, rangeStart)))}${chalk.bgHex(argsBg)(theme.fg('dim', rangeMatch[1]))}`;
  }

  private getCompactContinuationSummary(): string {
    const summary = this.getCompactToolSummary();
    const previousSummary = this.compactToolPreviousSummary;
    if (!summary) return '';
    if (!previousSummary) return this.isComplete() ? summary : '';

    if (previousSummary.startsWith(`${summary}:`)) {
      const dirnameStart = this.getImmediateDirnameStart(summary);
      if (dirnameStart !== undefined) {
        return `${this.formatSharedPrefixPlaceholder(summary, dirnameStart)}${summary.slice(dirnameStart)}`;
      }
    }

    const sharedPrefixLength = this.getSharedPrefixLength(previousSummary, summary);
    if (sharedPrefixLength === 0) return summary;

    const visibleRemainder = summary.slice(sharedPrefixLength);
    if (!visibleRemainder && this.hasCompletePathSegment(summary)) {
      const dirnameStart = this.getImmediateDirnameStart(summary);
      if (dirnameStart !== undefined) {
        return `${this.formatSharedPrefixPlaceholder(summary, dirnameStart)}${summary.slice(dirnameStart)}`;
      }
    }
    return `${this.formatSharedPrefixPlaceholder(summary, sharedPrefixLength)}${visibleRemainder}`;
  }

  private getImmediateDirnameStart(summary: string): number | undefined {
    const pathEnd = summary.indexOf(':');
    const path = pathEnd >= 0 ? summary.slice(0, pathEnd) : summary;
    const filenameSlashIndex = path.lastIndexOf('/');
    if (filenameSlashIndex < 0) return undefined;
    const dirnameSlashIndex = path.lastIndexOf('/', filenameSlashIndex - 1);
    return dirnameSlashIndex >= 0 ? dirnameSlashIndex : filenameSlashIndex;
  }

  private hasCompletePathSegment(summary: string): boolean {
    const pathEnd = summary.indexOf(':');
    const path = pathEnd >= 0 ? summary.slice(0, pathEnd) : summary;
    const lastSegment = path.slice(path.lastIndexOf('/') + 1);
    return lastSegment.length > 0 && (pathEnd >= 0 || lastSegment.includes('.'));
  }

  private formatSharedPrefixPlaceholder(summary: string, sharedPrefixLength: number): string {
    if (sharedPrefixLength <= 0) return '';
    if (summary[sharedPrefixLength - 1] === '/') {
      return `${'─'.repeat(sharedPrefixLength)}/`;
    }
    return '─'.repeat(sharedPrefixLength + 1);
  }

  private getSharedPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }

    const pathEnd = b.indexOf(':');
    const path = pathEnd >= 0 ? b.slice(0, pathEnd) : b;
    const sharedPathLength = Math.min(i, path.length);
    if (sharedPathLength === 0) return 0;

    const matchingSegmentBoundary = path.lastIndexOf('/', sharedPathLength - 1);
    const currentSegmentStart = path.lastIndexOf('/', Math.max(0, sharedPathLength - 1));

    if (i === b.length && i === a.length) {
      return this.getImmediateDirnameStart(b) ?? b.length;
    }

    if (i === b.length || i === a.length) {
      return b.length;
    }

    if (i < b.length && i < a.length) {
      const visiblePathStart = this.getImmediateDirnameStart(b) ?? currentSegmentStart;
      if (currentSegmentStart < 0) return 0;
      return Math.min(currentSegmentStart, visiblePathStart);
    }

    return matchingSegmentBoundary >= 0 ? matchingSegmentBoundary + 1 : 0;
  }

  private getCompactToolSummary(): string {
    if (isWebSearchTool(this.toolName)) return this.formatWebSearchSummary();
    if (isBrowserTool(this.toolName)) return this.formatBrowserSummary();
    if (isSkillTool(this.toolName)) return this.formatSkillSummary();

    switch (this.toolName) {
      case MC_TOOLS.VIEW:
        return this.formatPathWithRange();
      case MC_TOOLS.STRING_REPLACE_LSP:
        return this.formatEditSummary();
      case MC_TOOLS.WRITE_FILE:
        return this.getFirstStringArg('path');
      case MC_TOOLS.FIND_FILES:
        return this.formatListSummary();
      case MC_TOOLS.DELETE_FILE:
      case MC_TOOLS.FILE_STAT:
      case MC_TOOLS.MKDIR:
        return this.getFirstStringArg('path');
      case MC_TOOLS.AST_SMART_EDIT:
        return this.getFirstStringArg('path') || this.getFirstStringArg('targetName');
      case MC_TOOLS.SEARCH_CONTENT:
        return this.formatSearchSummary();
      case MC_TOOLS.LSP_INSPECT:
        return this.formatPathWithRange();
      case MC_TOOLS.GET_PROCESS_OUTPUT:
      case MC_TOOLS.KILL_PROCESS:
        return this.getFirstStringArg('pid');
      case MC_TOOLS.AGENT_SIGNAL_SEND:
        return this.formatAgentSignalSendSummary();
      case 'skill':
        return this.getFirstStringArg('name');
      case 'subagent':
        return this.formatSubagentSummary();
      default:
        return this.formatPlainArgsSummary().trim();
    }
  }

  private getCompactToolLabel(): string {
    if (isWebSearchTool(this.toolName)) return 'web';

    switch (this.toolName) {
      case MC_TOOLS.EXECUTE_COMMAND:
        return '$';
      case MC_TOOLS.STRING_REPLACE_LSP:
        return 'edit';
      case MC_TOOLS.WRITE_FILE:
        return 'write';
      case MC_TOOLS.FIND_FILES:
        return 'list';
      case MC_TOOLS.SEARCH_CONTENT:
        return 'grep';
      case MC_TOOLS.DELETE_FILE:
        return 'delete';
      case MC_TOOLS.FILE_STAT:
        return 'stat';
      case MC_TOOLS.MKDIR:
        return 'mkdir';
      case MC_TOOLS.GET_PROCESS_OUTPUT:
        return 'process';
      case MC_TOOLS.KILL_PROCESS:
        return 'kill';
      case MC_TOOLS.AST_SMART_EDIT:
        return 'ast_edit';
      case MC_TOOLS.AGENT_SIGNAL_SEND:
        return 'send';
      default:
        return this.toolName;
    }
  }

  private formatPathWithRange(): string {
    const rawPath = this.getFirstStringArg('path');
    if (!rawPath) return '';

    const argsObj = this.args as Record<string, unknown> | undefined;
    const viewRange = argsObj?.view_range as [number, number] | undefined;
    const offset = typeof argsObj?.offset === 'number' ? argsObj.offset : undefined;
    const limit = typeof argsObj?.limit === 'number' ? argsObj.limit : undefined;
    const line = typeof argsObj?.line === 'number' ? argsObj.line : undefined;
    const start = viewRange?.[0] ?? offset ?? line;
    const end = viewRange?.[1] ?? (offset !== undefined && limit !== undefined ? offset + limit - 1 : line);
    const path = rawPath;

    if (start === undefined) return path;
    return end !== undefined && end !== start ? `${path}:${start}-${end}` : `${path}:${start}`;
  }

  private formatEditSummary(): string {
    const path = this.getFirstStringArg('path');
    if (!path) return '';

    const output = this.getFormattedOutput();
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`Replaced \\d+ occurrences? in ${escapedPath} \\(lines ([^)]+)\\)`));
    return match?.[1] ? `${path}:${match[1]}` : path;
  }

  private formatListSummary(): string {
    const target = this.getFirstStringArg('path') || this.getFirstStringArg('pattern');
    const resultCount = this.result ? this.getListResultEntries().length : undefined;
    if (resultCount === undefined) return target;
    return `${target} (${resultCount} ${resultCount === 1 ? 'result' : 'results'})`;
  }

  private formatSearchSummary(): string {
    return this.getFirstStringArg('path');
  }

  private formatWebSearchSummary(): string {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const action = argsObj?.action as Record<string, unknown> | undefined;
    const query = argsObj?.query ? String(argsObj.query) : action?.query ? String(action.query) : '';
    return query ? `"${query}"` : '';
  }

  private formatBrowserSummary(): string {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const first = (...keys: string[]) =>
      keys.map(key => argsObj?.[key]).find(value => value !== undefined && value !== null);
    const quote = (value: unknown) => (typeof value === 'string' ? `"${value}"` : String(value));

    switch (this.toolName) {
      case 'browser_goto':
        return this.getFirstStringArg('url');
      case 'browser_snapshot': {
        const interactiveOnly = first('interactiveOnly');
        const maxDepth = first('maxDepth');
        return [
          interactiveOnly !== undefined ? `interactive=${interactiveOnly}` : '',
          maxDepth !== undefined ? `depth=${maxDepth}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      }
      case 'browser_click':
        return [
          this.getFirstStringArg('ref'),
          first('button') ? `button=${first('button')}` : '',
          first('clickCount') ? `x${first('clickCount')}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      case 'browser_type':
        return [
          this.getFirstStringArg('ref'),
          this.getFirstStringArg('text') ? quote(this.getFirstStringArg('text')) : '',
        ]
          .filter(Boolean)
          .join(' ');
      case 'browser_press':
        return this.getFirstStringArg('key');
      case 'browser_select':
        return [
          this.getFirstStringArg('ref'),
          first('value', 'label', 'index') !== undefined ? quote(first('value', 'label', 'index')) : '',
        ]
          .filter(Boolean)
          .join(' ');
      case 'browser_scroll':
        return [
          this.getFirstStringArg('direction'),
          first('amount') !== undefined ? `${first('amount')}px` : '',
          this.getFirstStringArg('ref'),
        ]
          .filter(Boolean)
          .join(' ');
      case 'browser_wait':
        return [this.getFirstStringArg('ref'), this.getFirstStringArg('state')].filter(Boolean).join(' ');
      case 'browser_tabs':
        return [this.getFirstStringArg('action'), this.getFirstStringArg('url')].filter(Boolean).join(' ');
      case 'browser_evaluate':
        return this.getFirstLineArg('script', 80);
      default:
        return this.formatPlainArgsSummary().trim();
    }
  }

  private formatSubagentSummary(): string {
    const agentType = this.getFirstStringArg('agentType');
    const task = this.getFirstLineArg('task', 80);
    return [agentType, task].filter(Boolean).join(' ');
  }

  private formatSkillSummary(): string {
    switch (this.toolName) {
      case 'skill':
        return this.getFirstStringArg('name');
      case 'skill_search':
        return this.getFirstStringArg('query');
      case 'skill_read':
        return [this.getFirstStringArg('skillName'), this.getFirstStringArg('path')].filter(Boolean).join(' ');
      default:
        return '';
    }
  }

  private formatSearchDetail(): string {
    const pattern = this.getFirstStringArg('pattern');
    if (!pattern) return '';

    const resultCount = this.getSearchResultCount();
    return resultCount === undefined ? pattern : `${pattern} (${resultCount} results)`;
  }

  private getSearchResultCount(): number | undefined {
    if (!this.result) return undefined;

    const output = this.getFormattedOutput();
    const explicitMatch = output.match(/(\d+)\s+(?:matches|results)/i);
    if (explicitMatch?.[1]) return Number(explicitMatch[1]);

    const matchLines = output
      .split('\n')
      .filter(line => /:\d+:/.test(line) || /^\s*(?:\.|\/|[\w.-]+\/).+:\d+/.test(line));
    return matchLines.length > 0 ? matchLines.length : undefined;
  }

  private getFirstStringArg(key: string): string {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const value = argsObj?.[key];
    return typeof value === 'string' ? value : '';
  }

  private getFirstLineArg(key: string, maxLength: number): string {
    const value = this.getFirstStringArg(key);
    if (!value) return '';
    const firstLine = value.split('\n')[0] ?? '';
    return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength)}…` : firstLine;
  }

  private renderBashToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const { command } = this.parseShellCommand();
    const timeout = argsObj?.timeout as number | undefined;

    if (this.isCompactShell()) {
      if (this.shellHeld) this.syncShellTicker(false);
      else this.renderShellGroupRow();
      return;
    }

    const directory = this.getShellDirectory();
    const cwd = directory ? shortenPath(directory) : '';

    // Extract tail value from command (e.g., "| tail -5" or "| tail -n 5")
    let maxStreamLines: number | undefined;
    const tailMatch = command.match(/\|\s*tail\s+(?:-n\s+)?(-?\d+)\s*$/);
    if (tailMatch) {
      maxStreamLines = Math.abs(parseInt(tailMatch[1]!, 10));
    }

    const timeoutSuffix = timeout ? theme.fg('muted', ` (timeout ${timeout}s)`) : '';
    const cwdSuffix = cwd ? theme.fg('muted', ` in ${cwd}`) : '';
    const timeSuffix = this.isPartial ? timeoutSuffix : this.getDurationSuffix();

    // Title row "$ command in cwd  duration", then the output on a shaded panel below it.
    const renderShellBlock = (status: string, outputLines: string[], failed?: boolean) => {
      const prompt = `${theme.bold(theme.fg('toolTitle', '$'))} `;
      const suffix = `${cwdSuffix}${timeSuffix}${status}`;
      const titleWidth = Math.max(1, this.renderWidth - BOX_INDENT * 2 - 2 - visibleWidth(prompt));
      const commandLines = this.wrapShellCommand(command, titleWidth);
      const title = commandLines.map((line, i) => (i === 0 ? prompt : ' '.repeat(visibleWidth(prompt))) + line);
      const last = title.length - 1;
      if (visibleWidth(commandLines[last] ?? '') + visibleWidth(suffix) <= titleWidth) title[last] += suffix;
      else title.push(' '.repeat(visibleWidth(prompt)) + suffix);
      // Only reached when expanded (collapsed shells use the compact group row), so all output shows.
      this.startBlock();
      this.blockLines(outputLines.map(line => theme.fg('toolOutput', line)));
      this.endBlock(title, failed);
    };

    if (!this.result || this.isPartial) {
      const status = this.getStatusIndicator();
      let lines = this.streamingOutput ? this.streamingOutput.split('\n') : [];
      // Remove leading empty lines during streaming
      while (lines.length > 0 && lines[0] === '') {
        lines.shift();
      }
      // Remove trailing empty lines during streaming (from trailing newline)
      while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      // Apply tail limit to streaming output to match final result
      if (maxStreamLines && lines.length > maxStreamLines) {
        lines = lines.slice(-maxStreamLines);
      }
      renderShellBlock(status, lines);
      return;
    }

    // Helper to apply tail limit and clean up lines
    const prepareOutputLines = (output: string): string[] => {
      let lines = output.split('\n');
      // Remove leading/trailing empty lines
      while (lines.length > 0 && lines[0] === '') {
        lines.shift();
      }
      while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      // Apply tail limit to match streaming display
      if (maxStreamLines && lines.length > maxStreamLines) {
        lines = lines.slice(-maxStreamLines);
      }
      return lines;
    };

    const failed = this.getShellFailureLine() !== undefined;
    const output = this.streamingOutput.trim() || this.getFormattedOutput();
    renderShellBlock(this.getStatusIndicator(failed), prepareOutputLines(output), failed);
  }

  /**
   * One call's slice of a shared compact shell box. The first call in a run opens the box with a
   * `$ <path>` header, a call in a new directory adds another header, and the last call closes it.
   */
  private renderShellGroupRow(): void {
    const fullWidth = Math.max(20, this.renderWidth - BOX_INDENT * 2 - 4); // Account for "│ " + " │"
    const naturalWidth = this.shellGroupWidth ?? this.getShellNaturalWidth() ?? 0;
    const contentWidth = Math.min(fullWidth, Math.max(SHELL_MIN_CONTENT_WIDTH, naturalWidth));
    // A bordered box rather than a shaded panel: the frame keeps grouped calls readable at a glance.
    const border = (char: string) =>
      theme.bold(chalk.hex(ensureTerminalGlyphContrast(theme.getTheme().toolBorderSuccess))(char));
    const rule = (left: string, right: string) =>
      `${border(left)}${border('─'.repeat(contentWidth + 2))}${border(right)}`;
    // Every row must stay on one terminal line: a row that wraps adds a line that disappears again
    // on the next update, jumping everything below it. Tabs and other control characters would make
    // the measured width disagree with what the terminal draws, so they become plain spaces.
    // Descriptions come from the model and output from the command, so neither may reach the
    // terminal as escape sequences (colors, cursor moves, hyperlinks, clipboard writes).
    const singleLine = (text: string) =>
      text
        .replace(TERMINAL_SEQUENCE_RE, '')
        .replace(/[\t\n\r\v\f]/g, ' ')
        .replace(/[\x00-\x08\x0e-\x1f\x7f-\x9f]/g, '');
    const row = (left: string, right = '') => {
      const rightWidth = visibleWidth(right);
      const leftText = truncateAnsi(left, Math.max(1, contentWidth - (rightWidth ? rightWidth + 1 : 0)));
      const padding = ' '.repeat(Math.max(rightWidth ? 1 : 0, contentWidth - visibleWidth(leftText) - rightWidth));
      return `${border('│')} ${leftText}${padding}${right} ${border('│')}`;
    };

    const headerPath = singleLine(this.getShellHeaderPath());
    const header = row(`${theme.bold(theme.fg('toolTitle', '$'))} ${theme.fg('muted', headerPath)}`);
    const lines: string[] = [];
    if (!this.compactToolContinuation) {
      lines.push(rule('╭', '╮'));
      const preview = this.shellGroupPreview ?? [];
      this.shellPreviewRowFloor = Math.min(this.previewLineLimit, Math.max(this.shellPreviewRowFloor, preview.length));
      if (this.shellPreviewRowFloor > 0) {
        for (let i = 0; i < this.shellPreviewRowFloor; i++) {
          lines.push(row(theme.fg('toolOutput', singleLine(preview[i] ?? ''))));
        }
        lines.push(rule('├', '┤'));
      }
      lines.push(header, rule('├', '┤'));
    }

    const rowText = this.getShellRowText();
    const description = rowText.muted ? theme.fg('muted', singleLine(rowText.text)) : singleLine(rowText.text);
    const isBackground =
      !!this.backgroundTaskId || (this.args as Record<string, unknown> | undefined)?.background === true;
    const running = !this.result || this.isPartial;
    let mark: string;
    let time: string;
    let errorLine: string | undefined;
    if (isBackground && (this.backgroundTaskId || !running)) {
      // Background results arrive later as their own chat entry, so this row never updates again.
      mark = theme.fg('accent', '◷');
      time = 'started';
    } else if (running && this.liveUpdatesStopped) {
      mark = theme.fg('muted', '■');
      time = 'stopped';
    } else if (running) {
      mark = theme.fg('warning', SPINNER_FRAMES[Math.floor(Date.now() / 100) % SPINNER_FRAMES.length]!);
      const elapsed = Date.now() - this.startTime;
      time =
        elapsed < 60_000 ? `${Math.floor(elapsed / 1000)}s` : formatStatusDuration(elapsed, { includeSeconds: true });
    } else {
      errorLine = this.getShellFailureLine();
      mark = errorLine !== undefined ? theme.fg('error', '✗') : theme.fg('success', '✓');
      time = this.formatDuration();
    }
    lines.push(row(`${mark} ${description}`, theme.fg('muted', time)));
    if (errorLine) lines.push(row(theme.fg('error', `  └▸ ${singleLine(errorLine)}`)));
    if (!this.compactToolHasFollowingContinuation) lines.push(rule('╰', '╯'));

    // Last guard for terminals too narrow for the minimum box: clip rather than wrap.
    const maxLineWidth = Math.max(1, this.renderWidth - BOX_INDENT * 2);
    this.contentBox.addChild(new Text(lines.map(line => truncateAnsi(line, maxLineWidth)).join('\n'), 0, 0));
    this.syncShellTicker(running && !isBackground && !this.liveUpdatesStopped);
  }

  /**
   * Returns the line explaining a failed shell call, or `undefined` when it succeeded. Failure comes
   * from the sandbox's exit record, an error result, or ordinary output ending in a nonzero
   * "Exit code: N" — never from the output text, which routinely contains words like "error:" on success.
   */
  private getShellFailureLine(): string | undefined {
    const resultLines = this.getFormattedOutput().split('\n');
    const exitCode =
      resultLines
        .findLast(line => line.trim() !== '')
        ?.trim()
        .match(/^Exit code: (-?\d+)$/)?.[1] ??
      (this.commandExit && this.commandExit.exitCode >= 0 ? String(this.commandExit.exitCode) : undefined);
    const failed =
      this.result?.isError || this.commandExit?.success === false || (exitCode !== undefined && exitCode !== '0');
    if (!failed) return undefined;
    const message = parseErrorMessage(resultLines.join('\n'));
    if (message) return message;
    const contentLines = (text: string) =>
      text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/^(?:stdout:|stderr:|Exit code: -?\d+)$/.test(line));
    const errorPattern =
      /Error:|TypeError:|SyntaxError:|ReferenceError:|command not found|fatal:|error:|No such file or directory|Permission denied/i;
    // Prefer what the command wrote to stderr. Without an error-looking line, the last line of
    // output is often unrelated (a divider, the last match of a search), so show the exit code
    // rather than guess.
    const stderrLines = contentLines(resultLines.join('\n').match(/^stderr:\n([\s\S]*)$/m)?.[1] ?? '');
    const lines = contentLines(this.streamingOutput.trim() || resultLines.join('\n'));
    return (
      stderrLines.find(line => errorPattern.test(line)) ??
      stderrLines.at(-1) ??
      lines.find(line => errorPattern.test(line)) ??
      (exitCode !== undefined ? `exit code ${exitCode}` : (lines.at(-1) ?? ''))
    );
  }

  /** Keeps a running grouped row's spinner and seconds counter moving between output events. */
  private syncShellTicker(active: boolean): void {
    if (!active) {
      if (this.shellTicker) clearInterval(this.shellTicker);
      this.shellTicker = undefined;
      return;
    }
    if (this.shellTicker) return;
    this.shellTicker = setInterval(() => {
      this.rebuild();
      this.ui.requestRender();
    }, 100);
    this.shellTicker.unref?.();
  }

  /** Content width this call's rows need; reconciliation gives the whole group the widest one. */
  getShellNaturalWidth(): number | undefined {
    if (!this.isCompactShell() || this.shellHeld) return undefined;
    const header = 2 + visibleWidth(this.getShellHeaderPath());
    const rowText = this.getShellRowText();
    const textWidth = rowText.muted ? 0 : visibleWidth(rowText.text);
    const row = 2 + textWidth + 1 + SHELL_TIME_WIDTH;
    return Math.max(header, row);
  }

  setShellGroupWidth(width: number | undefined): void {
    if (this.shellGroupWidth === width) return;
    this.shellGroupWidth = width;
    if (this.isCompactShell()) this.rebuild();
  }

  /** Called when the agent run ends without this tool finishing, so nothing keeps animating. */
  stopLiveUpdates(): void {
    if (this.liveUpdatesStopped) return;
    this.liveUpdatesStopped = true;
    this.syncShellTicker(false);
    this.rebuild();
  }

  private renderTaskWriteEnhanced(): void {
    const argsObj = this.args as { tasks?: TaskItemInput[] } | undefined;
    const tasks = argsObj?.tasks;
    const status = this.getStatusIndicator();

    // Show a compact bordered header — the pinned TaskProgressComponent handles live rendering
    const count = tasks?.length ?? 0;
    const countSuffix = count > 0 ? theme.fg('muted', ` (${count} tasks)`) : '';
    const footerText = `${theme.bold(theme.fg('toolTitle', 'task_write'))}${countSuffix}${status}`;

    this.startBlock();

    // Surface error details when the tool call fails
    if (!this.isPartial && this.result?.isError) {
      const output = this.getFormattedOutput();
      if (output) {
        this.blockLine(theme.fg('error', output));
      }
    }

    this.endBlock(footerText);
  }

  /**
   * Format web search results as a clean list of titles + URLs.
   * Handles both Anthropic provider results (JSON array with encryptedContent)
   * and Tavily results (markdown-formatted text).
   */
  private formatWebSearchResults(): string {
    const raw = this.getFormattedOutput();
    if (!raw) return '';

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(raw);

      // Anthropic provider format: JSON array of { url, title, pageAge, ... }
      if (Array.isArray(parsed)) {
        const lines: string[] = [];
        for (const item of parsed) {
          if (typeof item !== 'object' || item === null) continue;
          const url = typeof item.url === 'string' ? item.url : '';
          if (!url) continue;
          const title = typeof item.title === 'string' && item.title ? item.title : '';
          const age = typeof item.pageAge === 'string' && item.pageAge ? theme.fg('muted', ` (${item.pageAge})`) : '';
          if (title) {
            lines.push(`  ${theme.fg('toolOutput', title)}${age}`);
            lines.push(`  ${theme.fg('muted', url)}`);
          } else {
            lines.push(`  ${theme.fg('toolOutput', url)}${age}`);
          }
        }
        if (lines.length > 0) return lines.join('\n');

        // Parsed as JSON array but couldn't extract results — strip encryptedContent
        // before falling through, so we never dump huge base64 blobs to the terminal
        const stripped = parsed.map((item: unknown) => {
          if (typeof item !== 'object' || item === null) return item;
          const { encryptedContent, ...rest } = item as Record<string, unknown>;
          return rest;
        });
        return JSON.stringify(stripped, null, 2);
      }

      // OpenAI provider format: { action: { query }, sources: [{ url, title }, ...] }
      if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.sources)) {
        const lines: string[] = [];
        for (const source of parsed.sources) {
          if (typeof source !== 'object' || source === null) continue;
          const url = typeof source.url === 'string' ? source.url : '';
          if (!url) continue;
          const title = typeof source.title === 'string' && source.title ? source.title : '';
          if (title) {
            lines.push(`  ${theme.fg('toolOutput', title)}`);
            lines.push(`  ${theme.fg('muted', url)}`);
          } else {
            lines.push(`  ${theme.fg('toolOutput', url)}`);
          }
        }
        if (lines.length > 0) return lines.join('\n');
      }
    } catch {
      // Not JSON — fall through to raw text (Tavily format)
    }

    // Not JSON (e.g. Tavily format) — already readable text, return as-is
    return raw;
  }

  private formatAgentSignalSendSummary(): string {
    const args = this.args as Record<string, unknown> | undefined;
    const target = sanitizeAnsiForRendering(typeof args?.targetId === 'string' ? args.targetId : 'unknown peer');
    const priority = sanitizeAnsiForRendering(typeof args?.priority === 'string' ? args.priority : 'medium');
    const reply = args?.expectsReply === true ? 'reply expected' : 'no reply expected';
    return `${target} · ${priority} · ${reply}`;
  }

  private formatAgentSignalSendPreview(): string {
    const message = sanitizeAnsiForRendering(this.getFirstStringArg('message'));
    if (message) return message;

    const outcome = sanitizeAnsiForRendering(this.getFormattedOutput());
    return outcome ? `Outcome: ${outcome}` : '';
  }

  private renderGenericToolEnhanced(): void {
    const status = this.getStatusIndicator();

    const argsSummary = this.formatArgsSummary();

    const footerText = `${theme.bold(theme.fg('toolTitle', this.toolName))}${argsSummary}${status}`;

    if (!this.result || this.isPartial) {
      const partialOutput = this.result ? this.getFormattedOutput() : '';
      const preview = partialOutput ? partialOutput.split('\n') : this.formatArgsPreview();
      this.startBlock();
      if (preview.length > 0) {
        const previewLines = preview.map(line => theme.fg('toolOutput', line));
        this.blockLines(previewLines);
      }
      this.endBlock(footerText);
      return;
    }

    // Use enhanced error display for errors
    if (this.result.isError) {
      this.renderErrorResult(footerText);
      return;
    }

    const output = this.getFormattedOutput();
    if (output) {
      const termWidth = this.renderWidth;
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

      // Empty line padding above
      this.contentBox.addChild(new Text('', 0, 0));

      // Top border
      this.startBlock();

      let lines = output.split('\n');
      const collapsedLines = this.getCollapsedLineLimit(10);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      if (hasMore) {
        lines = lines.slice(0, collapsedLines);
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return theme.fg('toolOutput', truncated);
      });
      this.blockLines(borderedLines);

      if (hasMore) {
        const remaining = totalLines - collapsedLines;
        this.blockLine(theme.fg('muted', `... ${remaining} more lines (ctrl+e to expand)`));
      }

      // Bottom border with tool info
      this.endBlock(footerText);
    } else {
      // No output - just the title row
      this.startBlock();
      this.endBlock(footerText);
    }
  }

  /**
   * Format a compact args preview as key="value" pairs.
   * Long values are truncated, multiline values show first line + count.
   * Returns an array of formatted lines.
   */
  private formatArgsPreview(maxLines = 4, maxValueLen = 60): string[] {
    if (!this.args || typeof this.args !== 'object') return [];
    const argsObj = this.args as Record<string, unknown>;
    const keys = Object.keys(argsObj);
    if (keys.length === 0) return [];

    const termWidth = this.renderWidth;
    const maxLineWidth = termWidth - 4 - BOX_INDENT * 2 - 2; // -2 for "│ " border prefix
    const lines: string[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      if (lines.length >= maxLines) {
        const remaining = keys.length - i;
        lines.push(theme.fg('muted', `  ... ${remaining} more`));
        break;
      }
      const raw = argsObj[key];
      let val: string;
      if (typeof raw === 'string') {
        const strLines = raw.split('\n');
        if (strLines.length > 1) {
          val = strLines[0]!.slice(0, maxValueLen) + theme.fg('muted', ` (${strLines.length} lines)`);
        } else {
          val = raw.length > maxValueLen ? raw.slice(0, maxValueLen) + '…' : raw;
        }
        val = `"${val}"`;
      } else if (raw === undefined) {
        continue;
      } else if (Array.isArray(raw)) {
        val = `[${raw.length} items]`;
      } else if (typeof raw === 'object' && raw !== null) {
        const objKeys = Object.keys(raw as Record<string, unknown>);
        val = `{${objKeys.slice(0, 3).join(', ')}${objKeys.length > 3 ? ', …' : ''}}`;
      } else {
        val = String(raw);
      }
      const line = truncateAnsi(`  ${theme.fg('muted', key + '=')}${val}`, maxLineWidth);
      lines.push(line);
    }
    return lines;
  }

  private formatPlainArgsSummary(): string {
    return this.stripAnsi(this.formatArgsSummary());
  }

  /**
   * Compact inline args summary for the footer line.
   * Shows key=value pairs truncated to fit on one line.
   */
  private formatArgsSummary(): string {
    if (!this.args || typeof this.args !== 'object') return '';
    const argsObj = this.args as Record<string, unknown>;
    const entries = Object.entries(argsObj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';

    const termWidth = this.renderWidth;
    // Leave room for tool name, status indicator, borders
    const maxLen = Math.max(20, termWidth - this.toolName.length - 15 - BOX_INDENT * 2);
    const parts: string[] = [];
    let currentLen = 0;

    for (const [key, raw] of entries) {
      let val: string;
      if (typeof raw === 'string') {
        const firstLine = raw.split('\n')[0]!;
        val = firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine;
        val = `"${val}"`;
      } else if (Array.isArray(raw)) {
        val = `[${raw.length}]`;
      } else if (typeof raw === 'object' && raw !== null) {
        val = '{…}';
      } else {
        val = String(raw);
      }
      const part = `${key}=${val}`;
      if (currentLen + part.length + 2 > maxLen && parts.length > 0) {
        parts.push('…');
        break;
      }
      parts.push(part);
      currentLen += part.length + 2;
    }

    return ' ' + theme.fg('toolArgs', parts.join(', '));
  }

  private getBackgroundStatusIndicator(isError = this.isErrorResult()): string {
    if (!this.backgroundTaskId) return '';
    if (this.backgroundCancelled) return theme.fg('muted', ` ■ background · ${this.backgroundTaskId}`);
    if (this.isPartial) return theme.fg('warning', ` ◌ background · ${this.backgroundTaskId}`);
    return isError
      ? theme.fg('error', ` ✗ background · ${this.backgroundTaskId}`)
      : theme.fg('success', ` ✓ background · ${this.backgroundTaskId}`);
  }

  /** Output lines of the block being built (see startBlock / endBlock). */
  private pendingBlock: string[] | null = null;

  /** Start a tool block: collect output lines until endBlock prints the title and the panel. */
  private startBlock(): void {
    this.pendingBlock = [];
  }

  private blockLine(line: string): void {
    (this.pendingBlock ??= []).push(line);
  }

  private blockLines(lines: string[]): void {
    for (const line of lines) this.blockLine(line);
  }

  /**
   * Finish the block: a "● title" row (the dot carries the status: green done, red failed, grey
   * running), then any collected output on a shaded half-block panel, indented under the title.
   */
  private endBlock(title: string | string[], isError = this.isErrorResult()): void {
    const output = this.pendingBlock ?? [];
    this.pendingBlock = null;
    const width = Math.max(1, this.renderWidth - BOX_INDENT * 2);
    this.contentBox.addChild(new Text(toolBlock(this.getStatusDot(isError), title, output, width).join('\n'), 0, 0));
  }

  private getStatusDot(isError = this.isErrorResult()): string {
    return statusDot(this.isPartial ? 'running' : isError ? 'error' : 'done');
  }

  private getStatusIndicator(isError = this.isErrorResult()): string {
    const backgroundStatus = this.getBackgroundStatusIndicator(isError);
    if (backgroundStatus) return backgroundStatus;
    // The title's ● dot shows done / running; a failure also gets ✗ so it never relies on color alone.
    return !this.isPartial && isError ? theme.fg('error', ' ✗') : '';
  }

  private getDurationSuffix(): string {
    const duration = this.formatDuration();
    if (this.isPartial || !duration) return '';
    return theme.fg('muted', ` ${duration}`);
  }

  private formatDuration(): string {
    if (this.durationUnknown) return '';
    const ms = (this.endTime ?? Date.now()) - this.startTime;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return formatStatusDuration(ms, { includeSeconds: true });
  }

  private getFormattedOutput(): string {
    if (!this.result) return '';

    const textContent = this.result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('\n');

    if (!textContent) return '';

    const { content } = extractContent(textContent);
    // Remove excessive blank lines while preserving intentional formatting
    return content.trim().replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  /**
   * Render an error result using the enhanced error display component
   */
  private renderErrorResult(header: string): void {
    if (!this.result) return;

    // First add the header
    this.contentBox.addChild(new Text(header, 0, 0));

    // Extract error text from result
    const errorText = this.result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('\n');

    if (!errorText) return;

    // Check if this is a validation error
    const isValidationError =
      errorText.toLowerCase().includes('validation') ||
      errorText.toLowerCase().includes('required parameter') ||
      errorText.toLowerCase().includes('missing required') ||
      errorText.match(/at "\w+"/i) || // Zod-style errors
      (errorText.includes('Expected') && errorText.includes('Received'));

    if (isValidationError) {
      // Use specialized validation error component
      const validationErrors = parseValidationErrors(errorText);
      const validationDisplay = new ToolValidationErrorComponent(
        {
          toolName: this.toolName,
          errors: validationErrors,
          args: this.args,
        },
        this.ui,
      );
      this.contentBox.addChild(validationDisplay);
      return;
    }

    // Try to parse as an error object
    let error: Error | string = errorText;
    try {
      const { content } = extractContent(errorText);
      error = content;
      const parsed = parseErrorFromContent(content);
      if (parsed) error = parsed;
    } catch {
      // Keep as string
    }

    // Create error display component
    const errorDisplay = new ErrorDisplayComponent(
      error,
      {
        showStack: true,
        showContext: true,
        expanded: this.expanded,
      },
      this.ui,
    );

    this.contentBox.addChild(errorDisplay);
  }
}

/** Map file extensions to highlight.js language names */
function getLanguageFromPath(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    xml: 'xml',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    vue: 'vue',
    svelte: 'xml',
  };
  return ext ? langMap[ext] : undefined;
}

/** Strip line number formatting (cat -n or workspace →) from view-style output */
function getPlainCodeFromViewOutput(content: string, startLine?: number): string {
  let lines = content.split('\n').map(line => line.trimEnd());
  // Remove known headers:
  // - "[Truncated N tokens]" from token truncation
  // - "Here's the result of running `cat -n`..." from view tool
  // - "/path/to/file (NNN bytes)" or "/path/to/file (lines N-M of T, NNN bytes)" from workspace read_file
  while (
    lines.length > 0 &&
    (lines[0]!.includes("Here's the result of running") ||
      lines[0]!.match(/^\[Truncated \d+ tokens\]$/) ||
      lines[0]!.match(/^.*\(\d+ bytes\)$/) ||
      lines[0]!.match(/^.*\(lines \d+-\d+ of \d+, \d+ bytes\)$/))
  ) {
    lines = lines.slice(1);
  }

  // Strip line numbers - we know they're sequential starting from startLine
  // Supports two formats:
  //   view tool:           "   123\tcode" (tab separator)
  //   workspace read_file: "     123→code" (arrow separator)
  // Separator is optional because trimEnd() strips trailing tabs on blank lines
  let expectedLineNum = startLine ?? 1;
  const codeLines = lines.map(line => {
    const numStr = String(expectedLineNum);
    const match = line.match(/^(\s*)(\d+)[\t→]?(.*)$/);
    if (match && match[2] === numStr) {
      expectedLineNum++;
      return match[3]; // Return just the code part after the separator
    }
    return line;
  });

  // Remove trailing empty lines
  while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') {
    codeLines.pop();
  }

  return codeLines.join('\n');
}

/** Parse a `Name: message\n  at ...` error string into an Error object.
 *  Returns null if the content does not look like a JavaScript Error.
 *  Preserves the behaviour of the original `/^([A-Z][a-zA-Z]*Error):\s*(.+)$/m`
 *  pattern (same captures for well-formed inputs) while using bounded
 *  quantifiers and `[ \t]` separators to avoid the polynomial backtracking
 *  CodeQL flagged on pathological inputs.
 *  Exported for unit testing.
 */
export function parseErrorFromContent(content: string): Error | null {
  const errorMatch = content.match(/^([A-Z][A-Za-z]{0,64}Error):[ \t]*(.{1,8192})$/m);
  if (!errorMatch) return null;
  const err = new Error(errorMatch[2]!);
  err.name = errorMatch[1]!;
  // Stack frames are always space/tab-indented — never vertical whitespace.
  const stackMatch = content.match(/\n[ \t]+at[ \t]+.+/g);
  if (stackMatch) {
    err.stack = `${err.name}: ${err.message}\n${stackMatch.join('\n')}`;
  }
  return err;
}
