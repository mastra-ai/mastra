/**
 * TUI component for rendering OM observation/reflection output in a bordered box.
 * Uses observer (amber) color for observations and reflector (red) color for reflections.
 * Collapsed to COLLAPSED_LINES by default, expandable with ctrl+e.
 * Includes marker info (emoji, compression stats) in the footer.
 */

import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { mastra } from '../theme.js';

const OBSERVER_COLOR = mastra.orange;
const REFLECTOR_COLOR = mastra.red;
const COLLAPSED_LINES = 10;

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  const k = tokens / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
}

/** Truncate a string with ANSI codes to a visible width */
function truncateAnsi(str: string, maxWidth: number): string {
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  let visibleLength = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(str)) !== null) {
    const textBefore = str.slice(lastIndex, match.index);
    for (const char of textBefore) {
      if (visibleLength >= maxWidth) break;
      result += char;
      visibleLength++;
    }
    if (visibleLength >= maxWidth) break;
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  const remaining = str.slice(lastIndex);
  for (const char of remaining) {
    if (visibleLength >= maxWidth) break;
    result += char;
    visibleLength++;
  }

  if (visibleLength >= maxWidth) {
    result += '\x1b[0m';
  }
  return result;
}

/**
 * Soft-wrap an array of lines to fit within maxWidth, preserving words where possible.
 * Returns groups where each group corresponds to one original line split into wrapped segments.
 */
function softWrapLines(lines: string[], maxWidth: number): { groups: string[][]; flat: string[] } {
  const groups: string[][] = [];
  const flat: string[] = [];
  for (const line of lines) {
    if (line.length <= maxWidth) {
      groups.push([line]);
      flat.push(line);
      continue;
    }
    // Word-wrap: break at spaces when possible
    const group: string[] = [];
    let remaining = line;
    while (remaining.length > maxWidth) {
      let breakAt = remaining.lastIndexOf(' ', maxWidth);
      if (breakAt <= 0) {
        breakAt = maxWidth;
      }
      const segment = remaining.slice(0, breakAt);
      group.push(segment);
      flat.push(segment);
      remaining = remaining.slice(breakAt).replace(/^ /, '');
    }
    if (remaining.length > 0) {
      group.push(remaining);
      flat.push(remaining);
    }
    groups.push(group);
  }
  return { groups, flat };
}

export type OMOutputType = 'observation' | 'reflection';

export interface OMOutputData {
  type: OMOutputType;
  observations: string;
  currentTask?: string;
  suggestedResponse?: string;
  durationMs?: number;
  tokensObserved?: number;
  observationTokens?: number;
  compressedTokens?: number;
}

export class OMOutputComponent extends Container {
  private data: OMOutputData;
  private expanded: boolean = false;

  constructor(data: OMOutputData) {
    super();
    this.data = data;
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  toggleExpanded(): void {
    this.setExpanded(!this.expanded);
  }
  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));

    const isReflection = this.data.type === 'reflection';
    const color = isReflection ? REFLECTOR_COLOR : OBSERVER_COLOR;
    const border = (char: string) => chalk.bold.hex(color)(char);

    const termWidth = process.stdout.columns || 80;
    const maxLineWidth = termWidth - 6; // "│ " prefix + buffer
    // Soft-wrap all original lines to terminal width
    const originalLines = this.data.observations.split('\n');
    const { groups, flat: wrappedLines } = softWrapLines(originalLines, maxLineWidth);
    const originalLineCount = originalLines.length;
    const wrappedLineCount = wrappedLines.length;

    // Build footer text with marker info (emoji + compression stats)
    const footerText = this.buildFooterText(color);

    // Top border
    this.addChild(new Text(border('┌──'), 0, 0));

    // Content lines with left border
    let truncated = false;
    const borderedLines: string[] = [];
    if (!this.expanded && wrappedLineCount > COLLAPSED_LINES + 1) {
      // Collect head groups until we hit ~half the budget
      const headBudget = Math.ceil(COLLAPSED_LINES / 2);
      const headLines: string[] = [];
      let headGroupCount = 0;
      for (const group of groups) {
        if (headLines.length + group.length > headBudget && headLines.length > 0) break;
        headLines.push(...group);
        headGroupCount++;
      }

      // Collect tail groups from the end until we hit the other half
      const tailBudget = COLLAPSED_LINES - headLines.length;
      const tailLines: string[] = [];
      let tailGroupStart = groups.length;
      for (let i = groups.length - 1; i >= headGroupCount; i--) {
        if (tailLines.length + groups[i]!.length > tailBudget && tailLines.length > 0) break;
        tailLines.unshift(...groups[i]!);
        tailGroupStart = i;
      }

      const hiddenGroups = tailGroupStart - headGroupCount;
      truncated = hiddenGroups > 0;

      if (truncated) {
        for (const line of headLines) {
          borderedLines.push(border('│') + ' ' + chalk.hex(mastra.specialGray)(line));
        }
        borderedLines.push(
          border('│') + ' ' + chalk.hex(mastra.mainGray)(`... ${originalLineCount} lines total (ctrl+e to expand)`),
        );
        for (const line of tailLines) {
          borderedLines.push(border('│') + ' ' + chalk.hex(mastra.specialGray)(line));
        }
      } else {
        // Edge case: all groups fit when snapped to boundaries
        for (const line of wrappedLines) {
          borderedLines.push(border('│') + ' ' + chalk.hex(mastra.specialGray)(line));
        }
      }
    } else {
      for (const line of wrappedLines) {
        borderedLines.push(border('│') + ' ' + chalk.hex(mastra.specialGray)(line));
      }
    }

    const displayOutput = borderedLines.join('\n');
    if (displayOutput.trim()) {
      this.addChild(new Text(displayOutput, 0, 0));
    }

    // Current task / suggested response sections
    if (this.data.currentTask && (this.expanded || !truncated)) {
      const taskLine =
        border('│') +
        ' ' +
        chalk.hex(color).bold('Current task: ') +
        chalk.hex(mastra.specialGray)(this.data.currentTask);
      this.addChild(new Text(truncateAnsi(taskLine, termWidth - 2), 0, 0));
    }

    if (this.data.suggestedResponse && (this.expanded || !truncated)) {
      const sugLine =
        border('│') +
        ' ' +
        chalk.hex(color).bold('Suggested response: ') +
        chalk.hex(mastra.specialGray)(this.data.suggestedResponse);
      this.addChild(new Text(truncateAnsi(sugLine, termWidth - 2), 0, 0));
    }

    // Bottom border with footer
    this.addChild(new Text(`${border('└──')} ${footerText}`, 0, 0));
  }

  private buildFooterText(color: string): string {
    const isReflection = this.data.type === 'reflection';
    const emoji = '🧠';

    if (isReflection) {
      // Reflection: "🧠 Reflected: Xk → Yk tokens (Zx compression) in Ns ✓"
      const observed = formatTokens(this.data.tokensObserved ?? 0);
      const compressed = formatTokens(this.data.compressedTokens ?? this.data.observationTokens ?? 0);
      const ratio =
        (this.data.tokensObserved ?? 0) > 0 && (this.data.compressedTokens ?? this.data.observationTokens ?? 0) > 0
          ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.compressedTokens ?? this.data.observationTokens ?? 1))}x`
          : '';
      const durationStr = this.data.durationMs ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s` : '';
      const ratioStr = ratio ? ` (${ratio} compression)` : '';
      return `${emoji} ${chalk.hex(color)(`Reflected: ${observed} → ${compressed} tokens${ratioStr}${durationStr}`)} ${chalk.hex(mastra.green)('✓')}`;
    } else {
      // Observation: "🧠 Observed: Xk → Yk tokens (Zx compression) in Ns ✓"
      const observed = formatTokens(this.data.tokensObserved ?? 0);
      const compressed = formatTokens(this.data.observationTokens ?? 0);
      const ratio =
        (this.data.tokensObserved ?? 0) > 0 && (this.data.observationTokens ?? 0) > 0
          ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.observationTokens ?? 1))}x`
          : '';
      const durationStr = this.data.durationMs ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s` : '';
      const ratioStr = ratio ? ` (${ratio} compression)` : '';
      return `${emoji} ${chalk.hex(color)(`Observed: ${observed} → ${compressed} tokens${ratioStr}${durationStr}`)} ${chalk.hex(mastra.green)('✓')}`;
    }
  }
}
