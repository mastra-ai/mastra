/**
 * Enhanced tool execution component with better collapsible support.
 * This will replace the existing tool-execution.ts
 */

import * as os from 'node:os';
import { Box, Container, Spacer, Text, visibleWidth } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import type { TaskItemInput } from '@mastra/core/harness';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import type { Theme as HighlightTheme } from 'cli-highlight';
import { MC_TOOLS } from '../../tool-names.js';
import { BOX_INDENT, getTermWidth, theme, mastra, tintHex, ensureTerminalGlyphContrast } from '../theme.js';
import { truncateAnsi } from './ansi.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { ErrorDisplayComponent } from './error-display.js';
import type {
  CompactToolLabelColor,
  IToolExecutionComponent,
  QuietToolDisplayMode,
  ToolResult,
} from './tool-execution-interface.js';
import { ToolValidationErrorComponent, parseValidationErrors } from './tool-validation-error.js';

export type { ToolResult };

const CODE_HIGHLIGHT_THEME: HighlightTheme = {
  default: text => theme.fg('toolArgs', text),
  keyword: chalk.hex('#c084fc'),
  built_in: chalk.hex('#93c5fd'),
  type: chalk.hex('#93c5fd'),
  literal: chalk.hex('#fca5a5'),
  number: chalk.hex('#fbbf24'),
  string: chalk.hex('#86efac'),
  regexp: chalk.hex('#fca5a5'),
  title: chalk.hex('#93c5fd'),
  function: chalk.hex('#93c5fd'),
  params: chalk.hex('#d4d4d8'),
  comment: chalk.hex('#71717a'),
  meta: chalk.hex('#a1a1aa'),
  attr: chalk.hex('#fbbf24'),
  variable: chalk.hex('#d4d4d8'),
  tag: chalk.hex('#c084fc'),
  name: chalk.hex('#c084fc'),
};

const COMPACT_TOOL_COLOR = mastra.orange;
const COMPACT_TOOL_ARGS_BG = '#141414';
const QUIET_TOOL_RAIL = tintHex(COMPACT_TOOL_COLOR, 0.35);

function normalizeHexColor(color: string | undefined): string | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  return color;
}

const QUIET_CODE_HIGHLIGHT_THEME: HighlightTheme = {
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
  quietDisplayMode?: QuietToolDisplayMode;
  quietPreviewLineLimit?: number;
  compactToolModeColor?: string;
}
/**
 * Convert absolute path to tilde notation if it's in home directory
 */
function shortenPath(path: string): string {
  const home = os.homedir();
  if (path.startsWith(home)) {
    return `~${path.slice(home.length)}`;
  }
  return path;
}

/**
 * Resolve a file path to an absolute path for use in file:// URLs.
 */
function resolveAbsolutePath(filePath: string): string {
  if (filePath.startsWith('/')) return filePath;
  if (filePath.startsWith('~')) {
    return os.homedir() + filePath.slice(1);
  }
  return process.cwd() + '/' + filePath;
}

/**
 * Wrap text in an OSC 8 hyperlink to a file path.
 * Terminals that support OSC 8 (iTerm2, WezTerm, Kitty, etc.) will
 * render the text as a clickable link that opens the file.
 * Other terminals will just show the visible text.
 */
function fileLink(displayText: string, filePath: string, line?: number): string {
  const absPath = resolveAbsolutePath(filePath);
  const lineFragment = line ? `#${line}` : '';
  // OSC 8: \x1b]8;params;URI\x07 ... \x1b]8;;\x07
  return `\x1b]8;;file://${absPath}${lineFragment}\x07${displayText}\x1b]8;;\x07`;
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
export class ToolExecutionComponentEnhanced extends Container implements IToolExecutionComponent {
  private contentBox: Box;
  private toolName: string;
  private args: unknown;
  private expanded = false;
  private isPartial = true;
  private ui: TUI;
  private result?: ToolResult;
  private options: ToolExecutionOptions;
  private startTime = Date.now();
  private streamingOutput = ''; // Buffer for streaming shell output
  private quietDisplayMode: QuietToolDisplayMode;
  private quietPreviewLineLimit: number;
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
    this.quietDisplayMode = this.options.quietDisplayMode ?? 'normal';
    this.quietPreviewLineLimit = this.options.quietPreviewLineLimit ?? 2;
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

  refresh(): void {
    this.rebuild();
  }

  updateResult(result: ToolResult, isPartial = false): void {
    this.result = result;
    this.isPartial = isPartial;
    // Keep streaming output for colored display in final result
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
    this.streamingOutput += output;
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  setQuietModeDisplay(mode: QuietToolDisplayMode): void {
    this.quietDisplayMode = mode;
    this.updateTrailingSpacer();
    this.rebuild();
  }

  setQuietPreviewLineLimit(limit: number): void {
    const normalizedLimit = Number.isFinite(limit) ? limit : 2;
    this.quietPreviewLineLimit = Math.min(8, Math.max(0, Math.floor(normalizedLimit)));
    this.rebuild();
  }

  setCompactToolModeColor(color: string | undefined): void {
    const nextColor = normalizeHexColor(color);
    if (this.compactToolModeColor === nextColor) return;
    this.compactToolModeColor = nextColor;
    if (this.quietDisplayMode === 'quiet') this.rebuild();
  }

  getChatSpacingKind(): ChatSpacingKind {
    if (this.quietDisplayMode === 'quiet') {
      return this.toolName === MC_TOOLS.EXECUTE_COMMAND ? 'quiet-shell-tool' : 'quiet-compact-tool';
    }
    return 'normal-tool';
  }

  getCompactToolGroupKey(): string | undefined {
    if (this.getChatSpacingKind() !== 'quiet-compact-tool') return undefined;
    return this.getCompactToolLabel();
  }

  getCompactToolGroupSummary(): string | undefined {
    if (this.getChatSpacingKind() !== 'quiet-compact-tool') return undefined;
    return this.getCompactToolSummary();
  }

  hasQuietStreamingPreview(): boolean {
    return this.quietDisplayMode === 'quiet' && this.quietPreviewLineLimit > 0 && this.getQuietActivePreview() !== '';
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

  private shouldShowLeadingPadding(): boolean {
    return this.quietDisplayMode === 'normal';
  }

  private addLeadingPadding(): void {
    if (this.shouldShowLeadingPadding()) {
      this.contentBox.addChild(new Text('', 0, 0));
    }
  }

  private limitQuietShellLines(lines: string[]): string[] {
    if (this.quietDisplayMode !== 'quiet' || lines.length <= 15) {
      return lines;
    }
    return lines.slice(-15);
  }

  /**
   * Full clear-and-rebuild. Called when:
   * - args change (updateArgs)
   * - result arrives or changes (updateResult)
   * - expand/collapse on a tool with no collapsible child
   * - initial construction
   */
  private rebuild(): void {
    this.updateBgColor();
    this.contentBox.clear();

    if (this.quietDisplayMode === 'quiet' && this.toolName !== MC_TOOLS.EXECUTE_COMMAND) {
      this.renderCompactTool();
      return;
    }

    switch (this.toolName) {
      case MC_TOOLS.VIEW:
        this.renderViewToolEnhanced();
        break;
      case MC_TOOLS.EXECUTE_COMMAND:
        this.renderBashToolEnhanced();
        break;
      case MC_TOOLS.STRING_REPLACE_LSP:
        this.renderEditToolEnhanced();
        break;
      case MC_TOOLS.WRITE_FILE:
        this.renderWriteToolEnhanced();
        break;
      case MC_TOOLS.FIND_FILES:
        this.renderListFilesEnhanced();
        break;
      case MC_TOOLS.LSP_INSPECT:
        this.renderLspInspectEnhanced();
        break;
      case MC_TOOLS.GET_PROCESS_OUTPUT:
      case MC_TOOLS.KILL_PROCESS:
        this.renderProcessToolEnhanced();
        break;
      case 'task_write':
        this.renderTaskWriteEnhanced();
        break;
      default:
        if (isWebSearchTool(this.toolName)) {
          this.renderWebSearchEnhanced();
        } else {
          this.renderGenericToolEnhanced();
        }
    }
  }

  private renderCompactTool(): void {
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - BOX_INDENT * 2 - 2;
    const lines = this.getCompactToolSummaryLines();

    for (const line of lines) {
      this.contentBox.addChild(new Text(truncateAnsi(line, maxLineWidth), 0, 0));
    }
  }

  private getQuietPreviewLines(maxLineWidth: number): string[] {
    if (
      this.quietDisplayMode !== 'quiet' ||
      this.toolName === MC_TOOLS.EXECUTE_COMMAND ||
      this.quietPreviewLineLimit <= 0
    )
      return [];

    const preview = this.getQuietActivePreview();
    if (!preview) return [];

    if (this.isQuietCodePreviewTool()) {
      return this.getQuietCodePreviewLines(preview, maxLineWidth);
    }

    const firstLineWidth = Math.max(10, maxLineWidth - 4);
    const continuationWidth = Math.max(10, maxLineWidth - 4);
    const wrapped = this.wrapPreviewLines(preview, firstLineWidth, continuationWidth).slice(
      -this.quietPreviewLineLimit,
    );

    return wrapped.map(line => {
      const linePrefix = `  ${chalk.hex(this.getQuietToolRailColor())('│')} `;
      return truncateAnsi(`${linePrefix}${this.formatQuietActivePreview(line)}`, maxLineWidth);
    });
  }

  private getQuietCodePreviewLines(preview: string, maxLineWidth: number): string[] {
    const linePrefix = `  ${chalk.hex(this.getQuietToolRailColor())('│')} `;
    return this.highlightQuietCodePreview(preview)
      .split('\n')
      .slice(-this.quietPreviewLineLimit)
      .map(line => truncateAnsi(`${linePrefix}${line}`, maxLineWidth));
  }

  private isQuietCodePreviewTool(): boolean {
    return (
      this.toolName === MC_TOOLS.VIEW ||
      this.toolName === MC_TOOLS.WRITE_FILE ||
      this.toolName === MC_TOOLS.STRING_REPLACE_LSP
    );
  }

  private getQuietPreviewCapLine(): string {
    return `  ${chalk.hex(this.getQuietToolRailColor())('╰──')}`;
  }

  private getQuietPreviewSpacerLine(): string {
    return `  ${chalk.hex(this.getQuietToolRailColor())('│')}`;
  }

  private shouldCloseQuietPreview(): boolean {
    return !this.compactToolHasFollowingContinuation;
  }

  private formatQuietActivePreview(preview: string): string {
    if (this.toolName === MC_TOOLS.FIND_FILES || this.toolName === MC_TOOLS.SEARCH_CONTENT) {
      return theme.fg('toolOutput', preview);
    }

    return theme.fg('text', preview);
  }

  private highlightQuietCodePreview(preview: string): string {
    const path = this.getFirstStringArg('path');
    try {
      return highlight(preview, {
        language: getLanguageFromPath(path),
        ignoreIllegals: true,
        theme: QUIET_CODE_HIGHLIGHT_THEME,
      });
    } catch {
      return theme.fg('toolArgs', preview);
    }
  }

  private tokenizeQuietShellCommand(command: string): Array<{ text: string; color: (value: string) => string }> {
    const tokens = command.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\s+|&&|\|\||[|;&()<>]|[^\s|;&()<>]+/g) ?? [''];

    return tokens.map(token => {
      if (/^\s+$/.test(token)) return { text: token, color: (value: string) => value };
      if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        return { text: token, color: chalk.white };
      }
      if (token === '&&' || token === '||' || token === '|' || token === ';' || token === '&') {
        return { text: token, color: (value: string) => theme.fg('muted', value) };
      }
      if (token === '(' || token === ')' || token === '<' || token === '>') {
        return { text: token, color: (value: string) => theme.fg('muted', value) };
      }
      if (SHELL_CONTROL_WORDS.has(token)) {
        return { text: token, color: chalk.blue };
      }
      return { text: token, color: (value: string) => theme.fg('toolArgs', value) };
    });
  }

  private wrapQuietShellCommand(command: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';
    let currentWidth = 0;

    const pushCurrent = () => {
      lines.push(current);
      current = '';
      currentWidth = 0;
    };

    const takeVisiblePrefix = (text: string, maxWidth: number): string => {
      let chunk = '';
      let chunkWidth = 0;

      for (const char of text) {
        const charWidth = visibleWidth(char);
        if (chunk && chunkWidth + charWidth > maxWidth) break;
        chunk += char;
        chunkWidth += charWidth;
        if (chunkWidth >= maxWidth) break;
      }

      return chunk;
    };

    const wrapSourceLine = (sourceLine: string) => {
      for (const token of this.tokenizeQuietShellCommand(sourceLine)) {
        let remaining = token.text;

        while (remaining.length > 0) {
          if (currentWidth === 0 && /^\s+$/.test(remaining)) break;

          const available = width - currentWidth;
          if (available <= 0) {
            pushCurrent();
            continue;
          }

          const remainingWidth = visibleWidth(remaining);
          if (remainingWidth <= available) {
            current += token.color(remaining);
            currentWidth += remainingWidth;
            break;
          }

          if (currentWidth > 0 && !/^\s+$/.test(remaining)) {
            pushCurrent();
            continue;
          }

          const chunk = takeVisiblePrefix(remaining, available);
          current += token.color(chunk);
          currentWidth += visibleWidth(chunk);
          remaining = remaining.slice(chunk.length);
          pushCurrent();
        }
      }
    };

    const sourceLines = command.split('\n');
    sourceLines.forEach((sourceLine, index) => {
      wrapSourceLine(sourceLine);
      if (index < sourceLines.length - 1) pushCurrent();
    });

    if (current) lines.push(current);
    return lines.length ? lines : [''];
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

  private getCompactToolSummaryLines(): string[] {
    const status = this.getCompactStatusIndicator();
    const toolLabel = this.getCompactToolLabel();
    const toolLabelColor = this.getCompactToolLabelColor();
    const summary = this.compactToolContinuation ? this.getCompactContinuationSummary() : this.getCompactToolSummary();
    const detailLines = this.getQuietPreviewLines(getTermWidth() - BOX_INDENT * 2 - 2);
    const firstLine = this.compactToolContinuation
      ? summary
        ? `${this.getCompactContinuationIndent()}${this.formatCompactContinuationLine(summary)}${status}`
        : this.compactToolPreviousSummary
          ? `${this.getCompactContinuationIndent()}${this.formatEmptyCompactContinuationLine()}${status}`
          : `${this.getCompactContinuationIndent()}${this.formatCompactToolHeader(toolLabel, toolLabelColor, '')}${status}`
      : `${this.formatCompactToolHeader(toolLabel, toolLabelColor, summary)}${status}`;

    if (detailLines.length === 0) return [firstLine];
    const previewLines = this.shouldCloseQuietPreview() ? [...detailLines, this.getQuietPreviewCapLine()] : detailLines;
    if (this.compactToolHasFollowingContinuation) previewLines.push(this.getQuietPreviewSpacerLine());
    return [firstLine, ...previewLines];
  }

  private getCompactStatusIndicator(): string {
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

  private getQuietToolRailColor(): string {
    const color = this.isErrorResult()
      ? tintHex(mastra.red, 0.35)
      : this.compactToolModeColor
        ? tintHex(this.compactToolModeColor, 0.35)
        : QUIET_TOOL_RAIL;
    return ensureTerminalGlyphContrast(color);
  }

  private getQuietToolCircleColor(color: string): string {
    return ensureTerminalGlyphContrast(color);
  }

  private formatToolBorder(char: string): string {
    return theme.bold(chalk.hex(ensureTerminalGlyphContrast(theme.getTheme().toolBorderSuccess))(char));
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

  private getQuietActivePreview(): string {
    if (this.isErrorResult()) return this.formatQuietErrorPreview();
    if (isWebSearchTool(this.toolName)) return this.formatQuietWebSearchPreview();
    if (isBrowserTool(this.toolName)) return this.formatQuietBrowserPreview();
    if (isSkillTool(this.toolName)) return this.formatQuietSkillPreview();
    if (this.toolName === MC_TOOLS.GET_PROCESS_OUTPUT) return this.formatQuietProcessOutputPreview();
    if (this.toolName === MC_TOOLS.FILE_STAT) return this.formatQuietFileStatPreview();

    switch (this.toolName) {
      case MC_TOOLS.VIEW:
        return this.formatQuietViewPreview();
      case MC_TOOLS.FIND_FILES:
        return this.formatQuietListPreview();
      case 'skill':
        return '';
      case MC_TOOLS.STRING_REPLACE_LSP:
        return this.formatQuietEditPreview();
      case MC_TOOLS.WRITE_FILE:
        return this.getMultilinePreview('content', Number.POSITIVE_INFINITY, false);
      case MC_TOOLS.SEARCH_CONTENT:
        return this.formatSearchDetail();
      case MC_TOOLS.LSP_INSPECT:
        return this.getFirstLineArg('match', 80);
      default:
        return this.formatQuietGenericResultPreview();
    }
  }

  private formatQuietEditPreview(): string {
    return (
      this.getMultilinePreview('new_str', Number.POSITIVE_INFINITY, false) ||
      this.getMultilinePreview('new_string', Number.POSITIVE_INFINITY, false)
    );
  }

  private formatQuietErrorPreview(): string {
    const outputLines = this.stripAnsi(this.getFormattedOutput())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (outputLines.some(line => line.startsWith('Validation error:') || line.startsWith('Parameter:'))) {
      return outputLines.join(' — ');
    }
    return outputLines.slice(0, 2).join('\n');
  }

  private formatQuietViewPreview(): string {
    if (!this.result) return '';

    const output = this.getFormattedOutput();
    if (!output || !this.looksLikeViewOutput(output)) return '';

    const argsObj = this.args as Record<string, unknown> | undefined;
    const viewRange = argsObj?.view_range as [number, number] | undefined;
    const startLine = viewRange?.[0] ?? (argsObj?.offset as number | undefined) ?? 1;
    return getPlainCodeFromViewOutput(output, startLine);
  }

  private formatQuietListPreview(): string {
    if (!this.result) return '';

    const entries = this.getListResultEntries();
    if (entries.length === 0) return '';

    return entries.slice(0, 2).join('\n');
  }

  private formatQuietWebSearchPreview(): string {
    if (!this.result) return '';

    return this.stripAnsi(this.formatWebSearchResults())
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');
  }

  private formatQuietBrowserPreview(): string {
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

  private formatQuietProcessOutputPreview(): string {
    if (!this.result) return '';
    return this.stripAnsi(this.getFormattedOutput())
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .slice(0, 3)
      .join('\n');
  }

  private formatQuietFileStatPreview(): string {
    if (!this.result) return '';
    const output = this.stripAnsi(this.getFormattedOutput()).trim();
    return output.replace(/^\S+\s+/, '').replace(/\s+/g, ' ');
  }

  private formatQuietGenericResultPreview(): string {
    if (!this.result || this.isPartial) return '';
    const output = this.stripAnsi(this.getFormattedOutput()).trim();
    if (!output) return '';

    const compactJson = this.formatCompactJsonResult(output);
    const preview = compactJson || output;
    const argsSummary = this.stripAnsi(this.formatArgsSummary()).trim();
    if (argsSummary && preview === argsSummary) return '';

    return preview
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');
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

  private formatQuietSkillPreview(): string {
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

  private getMultilinePreview(key: string, maxLength = 80, includeLineCount = true): string {
    const value = this.getFirstStringArg(key);
    if (!value) return '';

    const lines = value.split('\n');
    const previewText = includeLineCount ? (lines[0] ?? '') : value.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
    const truncated =
      Number.isFinite(maxLength) && previewText.length > maxLength
        ? `${previewText.slice(0, maxLength)}…`
        : previewText;
    return includeLineCount && lines.length > 1 ? `${truncated} (${lines.length} lines)` : truncated;
  }

  private stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private getCompactContinuationIndent(): string {
    return '  ';
  }

  private formatEmptyCompactContinuationLine(): string {
    const railColor = this.getQuietToolRailColor();
    const isStreamingContinuation = !this.isComplete() && this.quietPreviewLineLimit > 0;
    if (isStreamingContinuation) {
      const circleColor = this.getQuietToolCircleColor(this.getCompactToolAccentColor(this.getCompactToolLabelColor()));
      return `${chalk.hex(circleColor)('●')}${chalk.hex(railColor)('─')}`;
    }
    return chalk.hex(railColor)(this.compactToolHasFollowingContinuation ? '├─' : '╰─');
  }

  private formatCompactContinuationLine(summary: string): string {
    const lineMatch = summary.match(/^─+/);
    const linePrefix = lineMatch?.[0] ?? '';
    const separator = linePrefix ? '' : ' ';
    const hasFollowing = this.compactToolHasFollowingContinuation || this.hasQuietStreamingPreview();
    const hasPreview = this.hasQuietStreamingPreview();
    const toolLabelColor = this.getCompactToolLabelColor();
    const color = this.getCompactToolAccentColor(toolLabelColor);
    const argsBg = this.getCompactToolArgsBg(toolLabelColor);
    const argsColor = this.getCompactToolArgsColor(toolLabelColor);
    const railColor = this.getQuietToolRailColor();
    const circleColor = this.getQuietToolCircleColor(color);
    const isStreamingContinuation =
      this.compactToolContinuation && !this.isComplete() && this.quietPreviewLineLimit > 0;
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

  private renderViewToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const viewRange = argsObj?.view_range as [number, number] | undefined;
    const offset = argsObj?.offset as number | undefined;
    const limit = argsObj?.limit as number | undefined;
    // view tool uses view_range[0], workspace read_file uses offset
    const startLine = viewRange?.[0] ?? offset ?? 1;

    // Build range display from view_range or offset/limit
    let rangeDisplay = '';
    if (viewRange) {
      rangeDisplay = theme.fg('muted', `:${viewRange[0]}-${viewRange[1]}`);
    } else if (offset || limit) {
      const from = offset ?? 1;
      const to = limit ? from + limit - 1 : undefined;
      rangeDisplay = theme.fg('muted', to ? `:${from}-${to}` : `:${from}`);
    }

    const border = (char: string) => this.formatToolBorder(char);

    if (!this.result || this.isPartial) {
      const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
      const status = this.getStatusIndicator();
      const pathDisplay = fullPath
        ? fileLink(theme.fg('toolArgs', path), fullPath, startLine)
        : theme.fg('toolArgs', path);
      const footerText = `${theme.bold(theme.fg('toolTitle', 'view'))} ${pathDisplay}${rangeDisplay}${status}`;
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    const status = this.getStatusIndicator();

    // Calculate available width for path and truncate from beginning if needed
    const termWidth = getTermWidth();
    const fixedParts = '╰── view  ' + (rangeDisplay ? `:XXX,XXX` : '') + ' ✓'; // approximate fixed width
    const availableForPath = termWidth - fixedParts.length - 6 - BOX_INDENT * 2; // buffer
    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }

    const pathDisplay = fullPath
      ? fileLink(theme.fg('toolArgs', path), fullPath, startLine)
      : theme.fg('toolArgs', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'view'))} ${pathDisplay}${rangeDisplay}${status}`;

    // Empty line padding above
    this.addLeadingPadding();

    // Top border
    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    // Syntax-highlighted content with left border, truncated to prevent soft wrap
    const output = this.getFormattedOutput();
    if (output) {
      const termWidth = getTermWidth();
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2; // Account for border "│ " (2) + buffer (2)
      const highlighted = highlightCode(output, fullPath, startLine);
      let lines = highlighted.split('\n');

      // Limit lines when collapsed
      const collapsedLines = this.getCollapsedLineLimit(20);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      if (hasMore) {
        lines = lines.slice(0, collapsedLines);
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      // Show truncation indicator
      if (hasMore) {
        const remaining = totalLines - collapsedLines;
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${remaining} more lines (ctrl+e to expand)`), 0, 0),
        );
      }
    }

    // Bottom border with tool info
    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
  }

  private renderBashToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    let command = argsObj?.command ? String(argsObj.command) : '...';
    const timeout = argsObj?.timeout as number | undefined;
    const cwd = argsObj?.cwd ? shortenPath(String(argsObj.cwd)) : '';

    // Strip "cd $CWD && " from the start since we show cwd in the footer
    const cdPattern = /^cd\s+[^\s]+\s+&&\s+/;
    command = command.replace(cdPattern, '');

    // Extract tail value from command (e.g., "| tail -5" or "| tail -n 5")
    let maxStreamLines: number | undefined;
    const tailMatch = command.match(/\|\s*tail\s+(?:-n\s+)?(-?\d+)\s*$/);
    if (tailMatch) {
      maxStreamLines = Math.abs(parseInt(tailMatch[1]!, 10));
    }

    const timeoutSuffix = timeout ? theme.fg('muted', ` (timeout ${timeout}s)`) : '';
    const cwdSuffix = cwd ? theme.fg('muted', ` in ${cwd}`) : '';
    const timeSuffix = this.isPartial ? timeoutSuffix : this.getDurationSuffix();

    // Helper to render shell command with terminal-like bordered box
    const renderBorderedShell = (status: string, outputLines: string[]) => {
      const border = (char: string) => this.formatToolBorder(char);
      const footerPrompt = `${theme.bold(theme.fg('toolTitle', '$'))} `;
      const footerSuffix = `${cwdSuffix}${timeSuffix}${status}`;
      const termWidth = getTermWidth();
      const contentWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 4); // Account for "│ " + " │"
      const horizontal = '─'.repeat(contentWidth + 2);
      const renderLine = (line: string, color: (value: string) => string = value => theme.fg('toolOutput', value)) => {
        const truncated = truncateAnsi(line, contentWidth);
        const padding = ' '.repeat(Math.max(0, contentWidth - visibleWidth(truncated)));
        return `${border('│')} ${color(truncated)}${padding} ${border('│')}`;
      };
      const displayOutput = outputLines.map(line => renderLine(line)).join('\n');
      const hasOutput = displayOutput.trim() !== '';

      this.contentBox.addChild(new Text(`${border('╭')}${border(horizontal)}${border('╮')}`, 0, 0));
      if (hasOutput) {
        this.contentBox.addChild(new Text(displayOutput, 0, 0));
        this.contentBox.addChild(new Text(`${border('├')}${border(horizontal)}${border('┤')}`, 0, 0));
      }
      const footerWrapWidth = Math.max(1, contentWidth - 4);
      const footerLines = this.wrapQuietShellCommand(command, footerWrapWidth);
      const footerSuffixWidth = visibleWidth(footerSuffix);
      footerLines.forEach((footerLine, index) => {
        const prefix = index === 0 ? footerPrompt : '  ';
        const isLast = index === footerLines.length - 1;
        const suffixFits = isLast && visibleWidth(footerLine) + footerSuffixWidth <= footerWrapWidth;
        const suffix = suffixFits ? footerSuffix : '';
        this.contentBox.addChild(
          new Text(
            renderLine(`${prefix}${footerLine}${suffix}`, value => value),
            0,
            0,
          ),
        );
      });
      const lastFooterLine = footerLines[footerLines.length - 1] ?? '';
      if (visibleWidth(lastFooterLine) + footerSuffixWidth > footerWrapWidth) {
        this.contentBox.addChild(
          new Text(
            renderLine(`  ${footerSuffix}`, value => value),
            0,
            0,
          ),
        );
      }
      this.contentBox.addChild(new Text(`${border('╰')}${border(horizontal)}${border('╯')}`, 0, 0));
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
      renderBorderedShell(status, this.limitQuietShellLines(lines));
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

    // For errors, use bordered box with error status
    if (this.result.isError) {
      const status = theme.fg('error', ' ✗');
      const output = this.streamingOutput.trim() || this.getFormattedOutput();
      renderBorderedShell(status, this.limitQuietShellLines(prepareOutputLines(output)));
      return;
    }

    // Also check if output contains common error patterns
    const outputText = this.getFormattedOutput();
    const looksLikeError = outputText.match(
      /Error:|TypeError:|SyntaxError:|ReferenceError:|command not found|fatal:|error:/i,
    );
    if (looksLikeError) {
      const status = theme.fg('error', ' ✗');
      const output = this.streamingOutput.trim() || this.getFormattedOutput();
      renderBorderedShell(status, this.limitQuietShellLines(prepareOutputLines(output)));
      return;
    }

    // Success - use bordered box with checkmark
    const status = theme.fg('success', ' ✓');
    const output = this.streamingOutput.trim() || this.getFormattedOutput();
    {
      renderBorderedShell(status, this.limitQuietShellLines(prepareOutputLines(output)));
    }
  }

  private renderProcessToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const pid = argsObj?.pid ? Number(argsObj.pid) : 0;
    const isKill = this.toolName === MC_TOOLS.KILL_PROCESS;
    const isWait = !isKill && argsObj?.wait === true;

    const timeSuffix = this.isPartial ? '' : this.getDurationSuffix();
    const label = isKill ? 'kill' : isWait ? 'wait' : 'output';

    const renderBorderedProcess = (status: string, outputLines: string[]) => {
      const border = (char: string) => this.formatToolBorder(char);
      const footerText = `${theme.bold(theme.fg('toolTitle', label))} ${theme.fg('toolArgs', `PID ${pid}`)}${timeSuffix}${status}`;

      this.contentBox.addChild(new Text(border('╭──'), 0, 0));

      const termWidth = getTermWidth();
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;
      const borderedLines = outputLines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      const displayOutput = borderedLines.join('\n');
      if (displayOutput.trim()) {
        this.contentBox.addChild(new Text(displayOutput, 0, 0));
      }

      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
    };

    const prepareOutputLines = (output: string): string[] => {
      let lines = output.split('\n');
      while (lines.length > 0 && lines[0] === '') lines.shift();
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      return lines;
    };

    if (!this.result || this.isPartial) {
      const status = this.getStatusIndicator();
      let lines = this.streamingOutput ? this.streamingOutput.split('\n') : [];
      while (lines.length > 0 && lines[0] === '') lines.shift();
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      renderBorderedProcess(status, lines);
      return;
    }

    const status = this.result.isError ? theme.fg('error', ' ✗') : theme.fg('success', ' ✓');
    const output = this.streamingOutput.trim() || this.getFormattedOutput();
    {
      renderBorderedProcess(status, prepareOutputLines(output));
    }
  }

  private renderEditToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const startLineNum = argsObj?.start_line ? Number(argsObj.start_line) : undefined;
    const startLine = startLineNum ? `:${String(startLineNum)}` : '';

    // While streaming / pending — show diff preview if old_str + new_str available
    if (!this.result || this.isPartial) {
      const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
      const status = this.getStatusIndicator();
      const pathDisplay = fullPath
        ? fileLink(theme.fg('toolArgs', path), fullPath, startLineNum)
        : theme.fg('toolArgs', path);

      // If both old_str/old_string and new_str/new_string are available, show a bordered diff preview
      const oldStr = argsObj?.old_str ?? argsObj?.old_string;
      const newStr = argsObj?.new_str ?? argsObj?.new_string;
      if (oldStr != null && newStr != null) {
        const border = (char: string) => this.formatToolBorder(char);
        const termWidth = getTermWidth();
        const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;
        const footerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;

        this.addLeadingPadding();
        this.contentBox.addChild(new Text(border('╭──'), 0, 0));

        const { lines: diffLines } = this.generateDiffLines(String(oldStr), String(newStr));

        // While streaming, show the tail so new content scrolls in at the bottom
        const collapsedLines = this.getCollapsedLineLimit(15);
        const totalLines = diffLines.length;
        const hasMore = !this.expanded && totalLines > collapsedLines + 1;
        let linesToShow = diffLines;
        let skippedAbove = 0;
        if (hasMore) {
          skippedAbove = totalLines - collapsedLines;
          linesToShow = diffLines.slice(-collapsedLines);
        }

        if (skippedAbove > 0) {
          this.contentBox.addChild(
            new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedAbove} lines above (ctrl+e to expand)`), 0, 0),
          );
        }

        const borderedLines = linesToShow.map(line => {
          const truncated = truncateAnsi(line, maxLineWidth);
          return border('│') + ' ' + theme.fg('toolOutput', truncated);
        });
        this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

        this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
        return;
      }

      // No diff args yet — show bordered header
      const editBorder = (char: string) => this.formatToolBorder(char);
      const headerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;
      this.contentBox.addChild(new Text(editBorder('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${editBorder('╰──')} ${headerText}`, 0, 0));
      return;
    }

    const border = (char: string) => this.formatToolBorder(char);
    const status = this.getStatusIndicator();

    // Calculate available width for path and truncate from beginning if needed
    const termWidth = getTermWidth();
    const fixedParts = '╰── edit  ' + startLine + ' ✓'; // approximate fixed width
    const availableForPath = termWidth - fixedParts.length - 6 - BOX_INDENT * 2; // buffer
    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }

    const pathDisplay = fullPath
      ? fileLink(theme.fg('toolArgs', path), fullPath, startLineNum)
      : theme.fg('toolArgs', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;

    // Empty line padding above
    this.addLeadingPadding();

    // Top border
    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    // For edits, show the diff
    const finalOldStr = argsObj?.old_str ?? argsObj?.old_string;
    const finalNewStr = argsObj?.new_str ?? argsObj?.new_string;
    if (finalOldStr != null && finalNewStr != null && !this.result.isError) {
      const { lines: diffLines, firstChangeIndex } = this.generateDiffLines(String(finalOldStr), String(finalNewStr));

      // Limit lines when collapsed, windowed around first change
      const collapsedLines = this.getCollapsedLineLimit(15);
      const totalLines = diffLines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      let linesToShow = diffLines;
      let skippedBefore = 0;
      if (hasMore) {
        // Show 3 context lines before the first change, rest after
        const contextBefore = 3;
        const start = Math.max(0, firstChangeIndex - contextBefore);
        linesToShow = diffLines.slice(start, start + collapsedLines);
        skippedBefore = start;
      }
      // Render diff lines with border, truncated to prevent wrap
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

      // Show "skipped above" indicator
      if (skippedBefore > 0) {
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedBefore} lines above`), 0, 0),
        );
      }

      const borderedLines = linesToShow.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      // Show truncation indicator
      if (hasMore) {
        const remaining = totalLines - (skippedBefore + linesToShow.length);
        if (remaining > 0) {
          this.contentBox.addChild(
            new Text(border('│') + ' ' + theme.fg('muted', `... ${remaining} more lines (ctrl+e to expand)`), 0, 0),
          );
        }
      }
    } else if (this.result.isError) {
      // Show error output
      const output = this.getFormattedOutput();
      if (output) {
        const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;
        const lines = output.split('\n').map(line => {
          const truncated = truncateAnsi(line, maxLineWidth);
          return border('│') + ' ' + theme.fg('error', truncated);
        });
        this.contentBox.addChild(new Text(lines.join('\n'), 0, 0));
      }
    }

    // Bottom border with tool info
    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));

    // LSP diagnostics below the box
    const diagnostics = this.parseLSPDiagnostics();
    if (diagnostics && !diagnostics.hasIssues) {
      this.contentBox.addChild(new Text(theme.fg('muted', `  ✓ No LSP issues`), 0, 0));
    } else if (diagnostics && diagnostics.hasIssues) {
      const COLLAPSED_DIAG_LINES = 3;
      const shouldCollapse = !this.expanded && diagnostics.entries.length > COLLAPSED_DIAG_LINES + 1;
      const maxDiags = shouldCollapse ? COLLAPSED_DIAG_LINES : diagnostics.entries.length;
      const entriesToShow = diagnostics.entries.slice(0, maxDiags);
      for (const diag of entriesToShow) {
        const t = theme.getTheme();
        const color = diag.severity === 'error' ? t.error : diag.severity === 'warning' ? t.warning : t.muted;
        const icon = diag.severity === 'error' ? '✗' : diag.severity === 'warning' ? '⚠' : 'ℹ';
        const location = diag.location ? chalk.hex(color)(diag.location) + ' ' : '';
        const line = `  ${chalk.hex(color)(icon)} ${location}${theme.fg('thinkingText', diag.message)}`;
        this.contentBox.addChild(new Text(line, 0, 0));
      }
      if (shouldCollapse) {
        const remaining = diagnostics.entries.length - COLLAPSED_DIAG_LINES;
        this.contentBox.addChild(
          new Text(
            theme.fg('muted', `  ... ${remaining} more diagnostic${remaining > 1 ? 's' : ''} (ctrl+e to expand)`),
            0,
            0,
          ),
        );
      }
    }
  }

  private parseLSPDiagnostics(): {
    hasIssues: boolean;
    entries: Array<{
      severity: 'error' | 'warning' | 'info' | 'hint';
      location: string;
      message: string;
    }>;
  } | null {
    const output = this.getFormattedOutput();
    const lspIdx = output.indexOf('LSP Diagnostics:');
    if (lspIdx === -1) return null;

    const lspText = output.slice(lspIdx + 'LSP Diagnostics:'.length);
    if (lspText.includes('No errors or warnings')) {
      return { hasIssues: false, entries: [] };
    }

    const entries: Array<{
      severity: 'error' | 'warning' | 'info' | 'hint';
      location: string;
      message: string;
    }> = [];
    let currentSeverity: 'error' | 'warning' | 'info' | 'hint' = 'error';

    for (const line of lspText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === 'Errors:') {
        currentSeverity = 'error';
      } else if (trimmed === 'Warnings:') {
        currentSeverity = 'warning';
      } else if (trimmed === 'Info:') {
        currentSeverity = 'info';
      } else if (trimmed === 'Hints:') {
        currentSeverity = 'hint';
      } else {
        const match = trimmed.match(/^((?:.*:)?\d+:\d+)\s*-\s*(.+)$/);
        if (match) {
          entries.push({
            severity: currentSeverity,
            location: match[1]!,
            message: match[2]!,
          });
        }
      }
    }

    return { hasIssues: entries.length > 0, entries };
  }
  private generateDiffLines(oldStr: string, newStr: string): { lines: string[]; firstChangeIndex: number } {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const lines: string[] = [];
    let firstChangeIndex = -1;

    // Use soft red for removed, green for added
    const removedColor = chalk.hex(mastra.red); // soft red
    const addedColor = chalk.hex(theme.getTheme().success); // soft green

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      if (i >= oldLines.length) {
        if (firstChangeIndex === -1) firstChangeIndex = lines.length;
        lines.push(addedColor(newLines[i]));
      } else if (i >= newLines.length) {
        if (firstChangeIndex === -1) firstChangeIndex = lines.length;
        lines.push(removedColor(oldLines[i]));
      } else if (oldLines[i] !== newLines[i]) {
        if (firstChangeIndex === -1) firstChangeIndex = lines.length;
        lines.push(removedColor(oldLines[i]!));
        lines.push(addedColor(newLines[i]!));
      } else {
        // Context line
        lines.push(theme.fg('muted', oldLines[i]!));
      }
    }

    return {
      lines,
      firstChangeIndex: firstChangeIndex === -1 ? 0 : firstChangeIndex,
    };
  }
  private renderWriteToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const content = argsObj?.content ? String(argsObj.content) : '';

    // While streaming args (no result yet), show bordered box with content as it arrives
    if (!this.result || this.isPartial) {
      if (!content) {
        // No content yet — show bordered pending header
        const writeBorder = (char: string) => this.formatToolBorder(char);
        const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
        const status = this.getStatusIndicator();
        const pathDisplay = fullPath ? fileLink(theme.fg('toolArgs', path), fullPath) : theme.fg('toolArgs', path);
        const footerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;
        this.contentBox.addChild(new Text(writeBorder('╭──'), 0, 0));
        this.contentBox.addChild(new Text(`${writeBorder('╰──')} ${footerText}`, 0, 0));
        return;
      }

      // Content is streaming in — show bordered box with syntax-highlighted preview
      const border = (char: string) => this.formatToolBorder(char);
      const status = this.getStatusIndicator();
      const termWidth = getTermWidth();
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

      let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
      const fixedParts = '╰── write   ⋯';
      const availableForPath = termWidth - fixedParts.length - 6 - BOX_INDENT * 2;
      if (path.length > availableForPath && availableForPath > 10) {
        path = '…' + path.slice(-(availableForPath - 1));
      }
      const pathDisplay = fullPath ? fileLink(theme.fg('toolArgs', path), fullPath) : theme.fg('toolArgs', path);
      const footerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;

      this.addLeadingPadding();
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));

      const highlighted = highlightCode(content, fullPath);
      let lines = highlighted.split('\n');

      const collapsedLines = this.getCollapsedLineLimit(20);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;
      let skippedAbove = 0;
      if (hasMore) {
        skippedAbove = totalLines - collapsedLines;
        lines = lines.slice(-collapsedLines);
      }

      if (skippedAbove > 0) {
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedAbove} lines above (ctrl+e to expand)`), 0, 0),
        );
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    // Complete — show final bordered result
    const border = (char: string) => this.formatToolBorder(char);
    const status = this.getStatusIndicator();
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    const fixedParts = '╰── write   ✓';
    const availableForPath = termWidth - fixedParts.length - 6 - BOX_INDENT * 2;
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }
    const pathDisplay = fullPath ? fileLink(theme.fg('toolArgs', path), fullPath) : theme.fg('toolArgs', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;

    this.addLeadingPadding();
    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    if (this.result.isError) {
      const output = this.getFormattedOutput();
      if (output) {
        const lines = output.split('\n').map(line => {
          const truncated = truncateAnsi(line, maxLineWidth);
          return border('│') + ' ' + theme.fg('error', truncated);
        });
        this.contentBox.addChild(new Text(lines.join('\n'), 0, 0));
      }
    } else if (content) {
      const highlighted = highlightCode(content, fullPath);
      let lines = highlighted.split('\n');

      const collapsedLines = this.getCollapsedLineLimit(20);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;
      let skippedAbove = 0;
      if (hasMore) {
        skippedAbove = totalLines - collapsedLines;
        lines = lines.slice(-collapsedLines);
      }

      if (skippedAbove > 0) {
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedAbove} lines above (ctrl+e to expand)`), 0, 0),
        );
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));
    }

    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
  }
  private renderListFilesEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '/';
    const pattern = argsObj?.pattern ? String(argsObj.pattern) : '';
    const patternDisplay = pattern ? ' ' + theme.fg('muted', pattern) : '';
    const border = (char: string) => this.formatToolBorder(char);
    const status = this.getStatusIndicator();
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

    if (!this.result || this.isPartial) {
      const pathDisplay = fullPath ? fileLink(theme.fg('toolArgs', path), fullPath) : theme.fg('toolArgs', path);
      const footerText = `${theme.bold(theme.fg('toolTitle', 'list'))} ${pathDisplay}${patternDisplay}${status}`;
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    const output = this.getFormattedOutput();
    if (output) {
      // Extract summary line (e.g. "5 directories, 9 files") from tree output for the footer
      let lines = output.split('\n');
      const lastLine = lines[lines.length - 1]?.trim() || '';
      const summaryMatch = lastLine.match(/^\d+\s+directories?,\s+\d+\s+files?$/);
      const summaryDisplay = summaryMatch ? ' ' + theme.fg('muted', lastLine) : '';
      // Remove the summary line from content if it matched
      if (summaryMatch) {
        lines = lines.slice(0, -1);
      }

      const collapsedLines = this.getCollapsedLineLimit(15);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;
      let skippedAbove = 0;
      if (hasMore) {
        skippedAbove = totalLines - collapsedLines;
        lines = lines.slice(-collapsedLines);
      }

      const pathDisplay = fullPath ? fileLink(theme.fg('toolArgs', path), fullPath) : theme.fg('toolArgs', path);
      const footerText = `${theme.bold(theme.fg('toolTitle', 'list'))} ${pathDisplay}${patternDisplay}${summaryDisplay}${status}`;

      this.contentBox.addChild(new Text(border('╭──'), 0, 0));

      if (skippedAbove > 0) {
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedAbove} lines above (ctrl+e to expand)`), 0, 0),
        );
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
    }
  }

  private renderLspInspectEnhanced(): void {
    const border = (char: string) => this.formatToolBorder(char);
    const status = this.getStatusIndicator();
    const termWidth = getTermWidth();
    const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;
    const argsObj = this.args as { path?: string; line?: number; match?: string } | undefined;
    const path_ = argsObj?.path;
    const line = argsObj?.line;
    const match = argsObj?.match;

    // Build args summary for footer
    const argsSummary = [
      path_ ? shortenPath(path_.replace(process.cwd() + '/', '')) : null,
      line ? `L${line}` : null,
      match ? truncateAnsi(match.replace(/<<</g, '‹‹‹'), 40) : null,
    ]
      .filter(Boolean)
      .join(' ');

    if (!this.result || this.isPartial) {
      const footerText = `${theme.bold(theme.fg('toolTitle', 'lsp_inspect'))}${argsSummary ? ' ' + theme.fg('toolArgs', argsSummary) : ''}${status}`;
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    // Extract raw text from result
    const rawText = this.result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('\n');

    if (this.result.isError || !rawText.trim()) {
      const footerText = `${theme.bold(theme.fg('toolTitle', 'lsp_inspect'))}${argsSummary ? ' ' + theme.fg('toolArgs', argsSummary) : ''}${status}`;
      const output = this.getFormattedOutput();
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      if (output) {
        this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('error', output), 0, 0));
      }
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    // Parse lsp_inspect result
    let parsed: {
      hover?: { value: string; kind: string };
      diagnostics?: Array<{ severity: string; message: string; source: string | null }>;
      definition?: Array<{ location: string; preview: string | null }>;
      implementation?: string[];
      error?: string;
    };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fall back to generic rendering if not valid JSON
      this.renderGenericToolEnhanced();
      return;
    }

    if (parsed.error) {
      const footerText = `${theme.bold(theme.fg('toolTitle', 'lsp_inspect'))}${argsSummary ? ' ' + theme.fg('toolArgs', argsSummary) : ''}${status}`;
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('error', parsed.error), 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    const footerText = `${theme.bold(theme.fg('toolTitle', 'lsp_inspect'))}${argsSummary ? ' ' + theme.fg('toolArgs', argsSummary) : ''}${status}`;

    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    // Render hover content
    if (parsed.hover) {
      const hoverValue = parsed.hover.value || '';
      const hoverLines = hoverValue.split('\n').filter(line => line.trim() !== '');
      if (hoverLines.length > 0) {
        this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('toolArgs', 'hover:'), 0, 0));
      }
      for (const line of hoverLines) {
        const truncated = truncateAnsi(line, maxLineWidth - 2);
        const prefix = border('│') + ' ';
        this.contentBox.addChild(new Text(prefix + theme.fg('text', truncated), 0, 0));
      }
    }

    // Render line diagnostics
    if (parsed.diagnostics && parsed.diagnostics.length > 0) {
      this.contentBox.addChild(new Text(border('│'), 0, 0));
      this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('toolArgs', 'diagnostics:'), 0, 0));

      for (const diagnostic of parsed.diagnostics) {
        const label = diagnostic.source ? `${diagnostic.severity} (${diagnostic.source})` : diagnostic.severity;
        const diagLine = `${label}: ${diagnostic.message}`;
        this.contentBox.addChild(
          new Text(
            border('│') +
              ' ' +
              theme.fg(diagnostic.severity === 'error' ? 'error' : 'text', truncateAnsi(diagLine, maxLineWidth - 2)),
            0,
            0,
          ),
        );
      }
    }

    // Render definition entries
    if (parsed.definition && parsed.definition.length > 0) {
      // Add blank line before definition section for visual separation
      this.contentBox.addChild(new Text(border('│'), 0, 0));
      this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('toolArgs', 'definition:'), 0, 0));

      for (const def of parsed.definition) {
        const location = def.location || '';
        const preview = def.preview || '';
        // Parse location: "$cwd/path:Lline:Cchar" or just "path:Lline:Cchar"
        const parsedLoc = this.parseLspLocation(location);
        const displayLoc = parsedLoc
          ? fileLink(
              theme.fg('toolOutput', parsedLoc.shortPath + ':' + parsedLoc.lineCol),
              parsedLoc.absPath,
              parsedLoc.line,
            )
          : theme.fg('toolOutput', location);

        const defLine = border('│') + ' ' + displayLoc;
        this.contentBox.addChild(new Text(truncateAnsi(defLine, maxLineWidth), 0, 0));

        if (preview) {
          const previewLine = border('│') + '   ' + theme.fg('text', truncateAnsi(preview, maxLineWidth - 3));
          this.contentBox.addChild(new Text(previewLine, 0, 0));
        }
      }
    }

    // Render implementation entries
    if (parsed.implementation && parsed.implementation.length > 0) {
      const implCount = parsed.implementation.length;
      const implLabel = implCount === 1 ? 'implementation:' : `implementations (${implCount}):`;

      // Add blank line before implementation section for visual separation
      this.contentBox.addChild(new Text(border('│'), 0, 0));

      // Show first few implementations inline, collapse rest
      const maxShow = this.expanded ? parsed.implementation.length : 5;
      const shown = parsed.implementation.slice(0, maxShow);
      const remaining = parsed.implementation.length - maxShow;

      this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('toolArgs', implLabel), 0, 0));

      for (const loc of shown) {
        const parsedLoc = this.parseLspLocation(loc);
        const displayLoc = parsedLoc
          ? fileLink(
              theme.fg('toolOutput', parsedLoc.shortPath + ':' + parsedLoc.lineCol),
              parsedLoc.absPath,
              parsedLoc.line,
            )
          : theme.fg('toolOutput', loc);
        const implLine = border('│') + ' ' + displayLoc;
        this.contentBox.addChild(new Text(truncateAnsi(implLine, maxLineWidth), 0, 0));
      }

      if (remaining > 0 && !this.expanded) {
        const moreLine = border('│') + ' ' + theme.fg('toolOutput', `... ${remaining} more (ctrl+e to expand)`);
        this.contentBox.addChild(new Text(moreLine, 0, 0));
      }
    }

    // Show message if no results found
    if (!parsed.hover && !parsed.diagnostics?.length && !parsed.definition?.length && !parsed.implementation?.length) {
      this.contentBox.addChild(
        new Text(
          border('│') + ' ' + theme.fg('muted', 'No hover, diagnostics, definition, or implementation results'),
          0,
          0,
        ),
      );
    }

    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
  }

  /**
   * Parse an LSP location string like "$cwd/path:Lline:Cchar" into components.
   */
  private parseLspLocation(
    location: string,
  ): { absPath: string; shortPath: string; line: number; lineCol: string } | null {
    // Match patterns like:
    // - "$cwd/packages/core/src/foo.ts:L10:C5"
    // - "/absolute/path/to/file.ts:L1:C1"
    // - "path/to/file.ts:L10:C5"
    const match = location.match(/^(.+?):L(\d+):C(\d+)$/);
    if (!match) return null;

    const rawPath = match[1]!;
    const line = parseInt(match[2]!, 10);
    const lineCol = `L${match[2]}:C${match[3]}`;

    // Resolve to absolute path
    let absPath: string;
    let shortPath: string;
    if (rawPath.startsWith('$cwd/')) {
      absPath = process.cwd() + '/' + rawPath.slice(5);
      shortPath = rawPath.slice(5); // Strip $cwd/ prefix
    } else if (rawPath.startsWith('~')) {
      absPath = os.homedir() + rawPath.slice(1);
      shortPath = shortenPath(absPath);
    } else if (rawPath.startsWith('/')) {
      absPath = rawPath;
      shortPath = absPath.startsWith(process.cwd() + '/')
        ? absPath.slice(process.cwd().length + 1)
        : shortenPath(absPath);
    } else {
      absPath = process.cwd() + '/' + rawPath;
      shortPath = rawPath;
    }

    return { absPath, shortPath, line, lineCol };
  }

  private renderTaskWriteEnhanced(): void {
    const argsObj = this.args as { tasks?: TaskItemInput[] } | undefined;
    const tasks = argsObj?.tasks;
    const status = this.getStatusIndicator();
    const border = (char: string) => this.formatToolBorder(char);

    // Show a compact bordered header — the pinned TaskProgressComponent handles live rendering
    const count = tasks?.length ?? 0;
    const countSuffix = count > 0 ? theme.fg('muted', ` (${count} tasks)`) : '';
    const footerText = `${theme.bold(theme.fg('toolTitle', 'task_write'))}${countSuffix}${status}`;

    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    // Surface error details when the tool call fails
    if (!this.isPartial && this.result?.isError) {
      const output = this.getFormattedOutput();
      if (output) {
        this.contentBox.addChild(new Text(border('│') + ' ' + theme.fg('error', output), 0, 0));
      }
    }

    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
  }

  private renderWebSearchEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const action = argsObj?.action as Record<string, unknown> | undefined;
    let query = argsObj?.query ? String(argsObj.query) : action?.query ? String(action.query) : '';
    // Fallback: extract query from result content (OpenAI format: { action: { query } })
    if (!query && this.result) {
      try {
        const raw = this.getFormattedOutput();
        const parsed = JSON.parse(raw);
        if (parsed?.action?.query) query = String(parsed.action.query);
      } catch {
        /* ignore */
      }
    }
    const status = this.getStatusIndicator();

    const queryDisplay = query ? ` ${theme.fg('toolArgs', `"${query}"`)}` : '';
    const footerText = `${theme.bold(theme.fg('toolTitle', 'web_search'))}${queryDisplay}${status}`;
    const border = (char: string) => this.formatToolBorder(char);

    if (!this.result || this.isPartial) {
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    if (this.result.isError) {
      this.renderErrorResult(footerText);
      return;
    }

    // Parse search results and format as a clean list of titles + URLs
    const output = this.formatWebSearchResults();
    if (output) {
      const termWidth = getTermWidth();
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

      // Empty line padding above
      this.addLeadingPadding();

      // Top border
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));

      let lines = output.split('\n');

      // Limit lines when collapsed
      const collapsedLines = this.getCollapsedLineLimit(10);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      if (hasMore) {
        lines = lines.slice(0, collapsedLines);
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      // Show truncation indicator
      if (hasMore) {
        const remaining = totalLines - collapsedLines;
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${remaining} more lines (ctrl+e to expand)`), 0, 0),
        );
      }

      // Bottom border with tool info
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
    } else {
      this.contentBox.addChild(new Text(footerText, 0, 0));
    }
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

  private renderGenericToolEnhanced(): void {
    const border = (char: string) => this.formatToolBorder(char);
    const status = this.getStatusIndicator();

    const argsSummary = this.formatArgsSummary();

    const footerText = `${theme.bold(theme.fg('toolTitle', this.toolName))}${argsSummary}${status}`;

    if (!this.result || this.isPartial) {
      // Pending: show bordered header with args preview
      const preview = this.formatArgsPreview();
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      if (preview.length > 0) {
        const previewLines = preview.map(line => border('│') + ' ' + theme.fg('toolOutput', line));
        this.contentBox.addChild(new Text(previewLines.join('\n'), 0, 0));
      }
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    // Use enhanced error display for errors
    if (this.result.isError) {
      this.renderErrorResult(footerText);
      return;
    }

    const output = this.getFormattedOutput();
    if (output) {
      const termWidth = getTermWidth();
      const maxLineWidth = termWidth - 4 - BOX_INDENT * 2;

      // Empty line padding above
      this.addLeadingPadding();

      // Top border
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));

      let lines = output.split('\n');
      const collapsedLines = this.getCollapsedLineLimit(10);
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      if (hasMore) {
        lines = lines.slice(0, collapsedLines);
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + theme.fg('toolOutput', truncated);
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      if (hasMore) {
        const remaining = totalLines - collapsedLines;
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${remaining} more lines (ctrl+e to expand)`), 0, 0),
        );
      }

      // Bottom border with tool info
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
    } else {
      // No output - just show the footer line
      this.contentBox.addChild(new Text(footerText, 0, 0));
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

    const termWidth = getTermWidth();
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

    const termWidth = getTermWidth();
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

  private getStatusIndicator(): string {
    return this.isPartial
      ? theme.fg('muted', ' ⋯')
      : this.isErrorResult()
        ? theme.fg('error', ' ✗')
        : theme.fg('success', ' ✓');
  }

  private getDurationSuffix(): string {
    if (this.isPartial) return '';
    const ms = Date.now() - this.startTime;
    if (ms < 1000) return theme.fg('muted', ` ${ms}ms`);
    return theme.fg('muted', ` ${(ms / 1000).toFixed(1)}s`);
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

/** Strip line number formatting (cat -n or workspace →) and apply syntax highlighting */
function highlightCode(content: string, path: string, startLine?: number): string {
  const code = getPlainCodeFromViewOutput(content, startLine);
  try {
    return highlight(code, {
      language: getLanguageFromPath(path),
      ignoreIllegals: true,
      theme: CODE_HIGHLIGHT_THEME,
    });
  } catch {
    return code;
  }
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
