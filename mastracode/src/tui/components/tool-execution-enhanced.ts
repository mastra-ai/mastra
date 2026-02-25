/**
 * Enhanced tool execution component with better collapsible support.
 * This will replace the existing tool-execution.ts
 */

import * as os from 'node:os';
import { Box, Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import type { TaskItem } from '@mastra/core/harness';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { theme, mastra, getTheme } from '../theme.js';
import { CollapsibleComponent } from './collapsible.js';
import { ErrorDisplayComponent } from './error-display.js';
import type { IToolExecutionComponent, ToolResult } from './tool-execution-interface.js';
import { ToolValidationErrorComponent, parseValidationErrors } from './tool-validation-error.js';

export type { ToolResult };

export interface ToolExecutionOptions {
  showImages?: boolean;
  autoCollapse?: boolean;
  collapsedByDefault?: boolean;
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
  private collapsible?: CollapsibleComponent;
  private startTime = Date.now();
  private streamingOutput = ''; // Buffer for streaming shell output

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

    this.addChild(new Spacer(1));

    // Content box with background
    this.contentBox = new Box(1, 1, (text: string) => theme.bg('toolPendingBg', text));
    this.addChild(this.contentBox);

    this.rebuild();
  }

  updateArgs(args: unknown): void {
    this.args = args;
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
    if (this.toolName !== 'execute_command' && this.toolName !== 'mastra_workspace_execute_command') {
      return;
    }
    this.streamingOutput += output;
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    if (this.collapsible) {
      this.collapsible.setExpanded(expanded);
      this.updateBgColor();
      super.invalidate();
      return;
    }
    // No collapsible — need a full rebuild (e.g. write tool, header-only tools)
    this.rebuild();
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
    // For shell, view, and edit commands, skip background - we use bordered box style instead
    const isShellCommand = this.toolName === 'execute_command' || this.toolName === 'mastra_workspace_execute_command';
    const isViewCommand = this.toolName === 'view' || this.toolName === 'mastra_workspace_read_file';
    const isEditCommand = this.toolName === 'string_replace_lsp' || this.toolName === 'mastra_workspace_edit_file';
    const isWriteCommand = this.toolName === 'write_file' || this.toolName === 'mastra_workspace_write_file';
    const isTaskWrite = this.toolName === 'task_write';

    if (isShellCommand || isViewCommand || isEditCommand || isWriteCommand || isTaskWrite) {
      // No background - let terminal colors show through
      this.contentBox.setBgFn((text: string) => text);
      return;
    }

    const bgColor = this.isPartial ? 'toolPendingBg' : this.result?.isError ? 'toolErrorBg' : 'toolSuccessBg';
    this.contentBox.setBgFn((text: string) => theme.bg(bgColor, text));
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
    this.collapsible = undefined;

    switch (this.toolName) {
      case 'view':
      case 'mastra_workspace_read_file':
        this.renderViewToolEnhanced();
        break;
      case 'execute_command':
      case 'mastra_workspace_execute_command':
        this.renderBashToolEnhanced();
        break;
      case 'string_replace_lsp':
      case 'mastra_workspace_edit_file':
        this.renderEditToolEnhanced();
        break;
      case 'write_file':
      case 'mastra_workspace_write_file':
        this.renderWriteToolEnhanced();
        break;
      case 'find_files':
      case 'mastra_workspace_list_files':
        this.renderListFilesEnhanced();
        break;
      case 'task_write':
        this.renderTaskWriteEnhanced();
        break;
      default:
        this.renderGenericToolEnhanced();
    }
  }

  private renderViewToolEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const viewRange = argsObj?.view_range as [number, number] | undefined;
    // view tool uses view_range[0], workspace read_file uses offset
    const startLine = viewRange?.[0] ?? (argsObj?.offset as number | undefined) ?? 1;
    // Don't show border until we have a result
    if (!this.result || this.isPartial) {
      // Just show pending indicator
      const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
      const rangeDisplay = viewRange ? theme.fg('muted', `:${viewRange[0]},${viewRange[1]}`) : '';
      const status = this.getStatusIndicator();
      const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath, startLine) : theme.fg('accent', path);
      const headerText = `${theme.bold(theme.fg('toolTitle', 'view'))} ${pathDisplay}${rangeDisplay}${status}`;
      this.contentBox.addChild(new Text(headerText, 0, 0));
      return;
    }

    const border = (char: string) => theme.bold(theme.fg('accent', char));
    const status = this.getStatusIndicator();
    const rangeDisplay = viewRange ? theme.fg('muted', `:${viewRange[0]},${viewRange[1]}`) : '';

    // Calculate available width for path and truncate from beginning if needed
    const termWidth = process.stdout.columns || 80;
    const fixedParts = '└── view  ' + (rangeDisplay ? `:XXX,XXX` : '') + ' ✓'; // approximate fixed width
    const availableForPath = termWidth - fixedParts.length - 6; // buffer
    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }

    const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath, startLine) : theme.fg('accent', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'view'))} ${pathDisplay}${rangeDisplay}${status}`;

    // Empty line padding above
    this.contentBox.addChild(new Text('', 0, 0));

    // Top border
    this.contentBox.addChild(new Text(border('┌──'), 0, 0));

    // Syntax-highlighted content with left border, truncated to prevent soft wrap
    const output = this.getFormattedOutput();
    if (output) {
      const termWidth = process.stdout.columns || 80;
      const maxLineWidth = termWidth - 6; // Account for border "│ " (2) + padding (2) + buffer (2)
      const highlighted = highlightCode(output, fullPath, startLine);
      let lines = highlighted.split('\n');

      // Limit lines when collapsed
      const collapsedLines = 20;
      const totalLines = lines.length;
      const hasMore = !this.expanded && totalLines > collapsedLines + 1;

      if (hasMore) {
        lines = lines.slice(0, collapsedLines);
      }

      const borderedLines = lines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + truncated;
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
    this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
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

    // Helper to render shell command with bordered box
    const renderBorderedShell = (status: string, outputLines: string[]) => {
      const border = (char: string) => theme.bold(theme.fg('accent', char));
      const footerText = `${theme.bold(theme.fg('toolTitle', '$'))} ${theme.fg('accent', command)}${cwdSuffix}${timeSuffix}${status}`;

      // Top border
      this.contentBox.addChild(new Text(border('┌──'), 0, 0));

      // Output lines with left border, truncated to prevent soft wrap
      const termWidth = process.stdout.columns || 80;
      const maxLineWidth = termWidth - 6; // Account for border "│ " (2) + buffer (4)
      const borderedLines = outputLines.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + truncated;
      });
      const displayOutput = borderedLines.join('\n');
      if (displayOutput.trim()) {
        this.contentBox.addChild(new Text(displayOutput, 0, 0));
      }

      // Bottom border with command info
      this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
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
      renderBorderedShell(status, lines);
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
      renderBorderedShell(status, prepareOutputLines(output));
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
      renderBorderedShell(status, prepareOutputLines(output));
      return;
    }

    // Success - use bordered box with checkmark
    const status = theme.fg('success', ' ✓');
    const output = this.streamingOutput.trim() || this.getFormattedOutput();
    renderBorderedShell(status, prepareOutputLines(output));
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
        ? fileLink(theme.fg('accent', path), fullPath, startLineNum)
        : theme.fg('accent', path);

      // If both old_str and new_str are available, show a bordered diff preview
      if (argsObj?.old_str && argsObj?.new_str) {
        const border = (char: string) => theme.bold(theme.fg('accent', char));
        const termWidth = process.stdout.columns || 80;
        const maxLineWidth = termWidth - 6;
        const footerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;

        this.contentBox.addChild(new Text('', 0, 0));
        this.contentBox.addChild(new Text(border('┌──'), 0, 0));

        const oldStr = String(argsObj.old_str);
        const newStr = String(argsObj.new_str);
        const { lines: diffLines } = this.generateDiffLines(oldStr, newStr);

        // While streaming, show the tail so new content scrolls in at the bottom
        const collapsedLines = 15;
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
          return border('│') + ' ' + truncated;
        });
        this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

        this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
        return;
      }

      // No diff args yet — just show header
      const headerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;
      this.contentBox.addChild(new Text(headerText, 0, 0));
      return;
    }

    const border = (char: string) => theme.bold(theme.fg('accent', char));
    const status = this.getStatusIndicator();

    // Calculate available width for path and truncate from beginning if needed
    const termWidth = process.stdout.columns || 80;
    const fixedParts = '└── edit  ' + startLine + ' ✓'; // approximate fixed width
    const availableForPath = termWidth - fixedParts.length - 6; // buffer
    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }

    const pathDisplay = fullPath
      ? fileLink(theme.fg('accent', path), fullPath, startLineNum)
      : theme.fg('accent', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'edit'))} ${pathDisplay}${theme.fg('muted', startLine)}${status}`;

    // Empty line padding above
    this.contentBox.addChild(new Text('', 0, 0));

    // Top border
    this.contentBox.addChild(new Text(border('┌──'), 0, 0));

    // For edits, show the diff
    if (argsObj?.old_str && argsObj?.new_str && !this.result.isError) {
      const oldStr = String(argsObj.old_str);
      const newStr = String(argsObj.new_str);
      const { lines: diffLines, firstChangeIndex } = this.generateDiffLines(oldStr, newStr);

      // Limit lines when collapsed, windowed around first change
      const collapsedLines = 15;
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
      const maxLineWidth = termWidth - 6;

      // Show "skipped above" indicator
      if (skippedBefore > 0) {
        this.contentBox.addChild(
          new Text(border('│') + ' ' + theme.fg('muted', `... ${skippedBefore} lines above`), 0, 0),
        );
      }

      const borderedLines = linesToShow.map(line => {
        const truncated = truncateAnsi(line, maxLineWidth);
        return border('│') + ' ' + truncated;
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
        const maxLineWidth = termWidth - 6;
        const lines = output.split('\n').map(line => {
          const truncated = truncateAnsi(line, maxLineWidth);
          return border('│') + ' ' + theme.fg('error', truncated);
        });
        this.contentBox.addChild(new Text(lines.join('\n'), 0, 0));
      }
    }

    // Bottom border with tool info
    this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));

    // LSP diagnostics below the box
    const diagnostics = this.parseLSPDiagnostics();
    if (diagnostics && diagnostics.hasIssues) {
      const COLLAPSED_DIAG_LINES = 3;
      const shouldCollapse = !this.expanded && diagnostics.entries.length > COLLAPSED_DIAG_LINES + 1;
      const maxDiags = shouldCollapse ? COLLAPSED_DIAG_LINES : diagnostics.entries.length;
      const entriesToShow = diagnostics.entries.slice(0, maxDiags);
      for (const diag of entriesToShow) {
        const t = getTheme();
        const color = diag.severity === 'error' ? t.error : diag.severity === 'warning' ? t.warning : t.muted;
        const icon = diag.severity === 'error' ? '✗' : diag.severity === 'warning' ? '⚠' : 'ℹ';
        const location = diag.location ? chalk.hex(color)(diag.location) + ' ' : '';
        const line = `  ${chalk.hex(color)(icon)} ${location}${fg('thinkingText', diag.message)}`;
        this.contentBox.addChild(new Text(line, 0, 0));
      }
      if (shouldCollapse) {
        const remaining = diagnostics.entries.length - COLLAPSED_DIAG_LINES;
        this.contentBox.addChild(
          new Text(
            fg('muted', `  ... ${remaining} more diagnostic${remaining > 1 ? 's' : ''} (ctrl+e to expand)`),
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
    const addedColor = chalk.hex(getTheme().success); // soft green

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
        // No content yet — just show pending header
        const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
        const status = this.getStatusIndicator();
        const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath) : theme.fg('accent', path);
        const headerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;
        this.contentBox.addChild(new Text(headerText, 0, 0));
        return;
      }

      // Content is streaming in — show bordered box with syntax-highlighted preview
      const border = (char: string) => theme.bold(theme.fg('accent', char));
      const status = this.getStatusIndicator();
      const termWidth = process.stdout.columns || 80;
      const maxLineWidth = termWidth - 6;

      let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
      const fixedParts = '└── write   ⋯';
      const availableForPath = termWidth - fixedParts.length - 6;
      if (path.length > availableForPath && availableForPath > 10) {
        path = '…' + path.slice(-(availableForPath - 1));
      }
      const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath) : theme.fg('accent', path);
      const footerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;

      this.contentBox.addChild(new Text('', 0, 0));
      this.contentBox.addChild(new Text(border('┌──'), 0, 0));

      const highlighted = highlightCode(content, fullPath);
      let lines = highlighted.split('\n');

      const collapsedLines = 20;
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
        return border('│') + ' ' + truncated;
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));

      this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
      return;
    }

    // Complete — show final bordered result
    const border = (char: string) => theme.bold(theme.fg('accent', char));
    const status = this.getStatusIndicator();
    const termWidth = process.stdout.columns || 80;
    const maxLineWidth = termWidth - 6;

    let path = argsObj?.path ? shortenPath(String(argsObj.path)) : '...';
    const fixedParts = '└── write   ✓';
    const availableForPath = termWidth - fixedParts.length - 6;
    if (path.length > availableForPath && availableForPath > 10) {
      path = '…' + path.slice(-(availableForPath - 1));
    }
    const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath) : theme.fg('accent', path);
    const footerText = `${theme.bold(theme.fg('toolTitle', 'write'))} ${pathDisplay}${status}`;

    this.contentBox.addChild(new Text('', 0, 0));
    this.contentBox.addChild(new Text(border('┌──'), 0, 0));

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

      const collapsedLines = 20;
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
        return border('│') + ' ' + truncated;
      });
      this.contentBox.addChild(new Text(borderedLines.join('\n'), 0, 0));
    }

    this.contentBox.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
  }
  private renderListFilesEnhanced(): void {
    const argsObj = this.args as Record<string, unknown> | undefined;
    const fullPath = argsObj?.path ? String(argsObj.path) : '';
    const path = argsObj?.path ? shortenPath(String(argsObj.path)) : '/';
    const pattern = argsObj?.pattern ? String(argsObj.pattern) : '';
    const patternDisplay = pattern ? ' ' + theme.fg('muted', pattern) : '';

    if (!this.result || this.isPartial) {
      const status = this.getStatusIndicator();
      const pathDisplay = fullPath ? fileLink(theme.fg('accent', path), fullPath) : theme.fg('accent', path);
      const header = `${theme.bold(theme.fg('toolTitle', 'list'))} ${pathDisplay}${patternDisplay}${status}`;
      this.contentBox.addChild(new Text(header, 0, 0));
      return;
    }

    const output = this.getFormattedOutput();
    if (output) {
      const lines = output.split('\n');
      const fileCount = lines.filter(l => l.trim() && !l.includes('└') && !l.includes('├') && !l.includes('│')).length;
      const listStatus = this.getStatusIndicator();

      this.collapsible = new CollapsibleComponent(
        {
          header: `${theme.bold(theme.fg('toolTitle', 'list'))} ${theme.fg('accent', path)}${patternDisplay}${listStatus}`,
          summary: `${fileCount} items`,
          expanded: this.expanded,
          collapsedLines: 15,
          expandedLines: 100,
          showLineCount: false,
        },
        this.ui,
      );

      this.collapsible.setContent(output);
      this.contentBox.addChild(this.collapsible);
    }
  }

  private renderTaskWriteEnhanced(): void {
    const argsObj = this.args as { tasks?: TaskItem[] } | undefined;
    const tasks = argsObj?.tasks;
    const status = this.getStatusIndicator();

    // Show a compact header — the pinned TaskProgressComponent handles live rendering
    const count = tasks?.length ?? 0;
    const countSuffix = count > 0 ? theme.fg('muted', ` (${count} tasks)`) : '';
    const header = `${theme.bold(theme.fg('toolTitle', 'task_write'))}${countSuffix}${status}`;
    this.contentBox.addChild(new Text(header, 0, 0));

    // Surface error details when the tool call fails
    if (!this.isPartial && this.result?.isError) {
      const output = this.getFormattedOutput();
      if (output) {
        this.contentBox.addChild(new Text(theme.fg('error', output), 0, 0));
      }
    }
  }

  private renderGenericToolEnhanced(): void {
    const status = this.getStatusIndicator();

    let argsSummary = '';
    if (this.args && typeof this.args === 'object') {
      const argsObj = this.args as Record<string, unknown>;
      const keys = Object.keys(argsObj);
      if (keys.length > 0) {
        argsSummary = theme.fg('muted', ` (${keys.length} args)`);
      }
    }

    const header = `${theme.bold(theme.fg('toolTitle', this.toolName))}${argsSummary}${status}`;

    if (!this.result || this.isPartial) {
      this.contentBox.addChild(new Text(header, 0, 0));
      // Show live key=value preview of args as they stream in
      const preview = this.formatArgsPreview();
      if (preview.length > 0) {
        this.contentBox.addChild(new Text(preview.join('\n'), 0, 0));
      }
      return;
    }

    // Use enhanced error display for errors
    if (this.result.isError) {
      this.renderErrorResult(header);
      return;
    }

    const output = this.getFormattedOutput();
    if (output) {
      this.collapsible = new CollapsibleComponent(
        {
          header,
          expanded: this.expanded,
          collapsedLines: 10,
          expandedLines: 200,
          showLineCount: true,
        },
        this.ui,
      );

      this.collapsible.setContent(output);
      this.contentBox.addChild(this.collapsible);
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

    const termWidth = process.stdout.columns || 80;
    const maxLineWidth = termWidth - 4; // small margin
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

  private getStatusIndicator(): string {
    return this.isPartial
      ? theme.fg('muted', ' ⋯')
      : this.result?.isError
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

      // Try to create an Error object with better structure
      const errorMatch = content.match(/^([A-Z][a-zA-Z]*Error):\s*(.+)$/m);
      if (errorMatch) {
        const err = new Error(errorMatch[2]!);
        err.name = errorMatch[1]!;
        // Try to extract stack trace
        const stackMatch = content.match(/\n\s+at\s+.+/g);
        if (stackMatch) {
          err.stack = `${err.name}: ${err.message}\n${stackMatch.join('\n')}`;
        }
        error = err;
      }
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

/** Strip line number formatting (cat -n or workspace →) and apply syntax highlighting */
function highlightCode(content: string, path: string, startLine?: number): string {
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

  // Apply syntax highlighting
  try {
    return highlight(codeLines.join('\n'), {
      language: getLanguageFromPath(path),
      ignoreIllegals: true,
    });
  } catch {
    return codeLines.join('\n');
  }
}
/** Truncate a string with ANSI codes to a visible width.
 *  Handles both SGR sequences (\x1b[...m) and OSC 8 hyperlinks (\x1b]8;...;\x07).
 */
function truncateAnsi(str: string, maxWidth: number): string {
  const ansiRegex = /\x1b\[[0-9;]*m|\x1b\]8;[^\x07]*\x07/g;
  let visibleLength = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(str)) !== null) {
    // Add text before this ANSI code
    const textBefore = str.slice(lastIndex, match.index);
    const remaining = maxWidth - visibleLength;
    if (textBefore.length <= remaining) {
      result += textBefore;
      visibleLength += textBefore.length;
    } else {
      result += textBefore.slice(0, remaining - 1) + '…';
      result += '\x1b]8;;\x07\x1b[0m'; // Close any open hyperlink + reset styles
      return result;
    }
    // Add the ANSI code (doesn't count toward visible length)
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last ANSI code
  const remaining = str.slice(lastIndex);
  const spaceLeft = maxWidth - visibleLength;
  if (remaining.length <= spaceLeft) {
    result += remaining;
  } else {
    result += remaining.slice(0, spaceLeft - 1) + '…';
    result += '\x1b]8;;\x07\x1b[0m'; // Close hyperlink + reset
  }

  return result;
}
