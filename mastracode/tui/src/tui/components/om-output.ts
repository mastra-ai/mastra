/**
 * TUI component for rendering OM observation/reflection output as a tool-style block.
 * Uses observer (amber) color for observations and reflector (red) color for reflections.
 * Collapsed to COLLAPSED_LINES by default, expandable with ctrl+e.
 * The title row carries the compression stats; the observations sit on a panel below.
 */

import { Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { TOOL_DOT, toolBlock } from './surface.js';
import { WidthAwareContainer } from './width-aware-container.js';

// Read from proxy at render time so they pick up contrast adaptation
const getObserverColor = () => mastra.orange;
const getReflectorColor = () => mastra.red;
const COLLAPSED_LINES = 10;

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  const k = tokens / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
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

export class OMOutputComponent extends WidthAwareContainer {
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
  protected rebuildForWidth(termWidth: number): void {
    this.clear();

    const isReflection = this.data.type === 'reflection';
    const color = isReflection ? getReflectorColor() : getObserverColor();
    const width = Math.max(1, termWidth - BOX_INDENT * 2);
    const maxLineWidth = width - 4; // panel indent + buffer
    // Soft-wrap all original lines to terminal width
    const originalLines = this.data.observations.split('\n');
    const { groups, flat: wrappedLines } = softWrapLines(originalLines, maxLineWidth);
    const originalLineCount = originalLines.length;
    const wrappedLineCount = wrappedLines.length;

    // Title with compression stats
    const footerText = this.buildFooterText(color);

    // Content lines, shown on the panel under the title
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
          borderedLines.push(chalk.hex(mastra.specialGray)(line));
        }
        borderedLines.push(chalk.hex(mastra.mainGray)(`... ${originalLineCount} lines total (ctrl+e to expand)`));
        for (const line of tailLines) {
          borderedLines.push(chalk.hex(mastra.specialGray)(line));
        }
      } else {
        // Edge case: all groups fit when snapped to boundaries
        for (const line of wrappedLines) {
          borderedLines.push(chalk.hex(mastra.specialGray)(line));
        }
      }
    } else {
      for (const line of wrappedLines) {
        borderedLines.push(chalk.hex(mastra.specialGray)(line));
      }
    }

    // Current task / suggested response sections
    if (this.data.currentTask && (this.expanded || !truncated)) {
      borderedLines.push(
        chalk.hex(color).bold('Current task: ') + chalk.hex(mastra.specialGray)(this.data.currentTask),
      );
    }

    if (this.data.suggestedResponse && (this.expanded || !truncated)) {
      borderedLines.push(
        chalk.hex(color).bold('Suggested response: ') + chalk.hex(mastra.specialGray)(this.data.suggestedResponse),
      );
    }

    // "● Observed: …" title in the observer / reflector color, the observations on a panel below
    const output = borderedLines.some(line => line.trim()) ? borderedLines : [];
    this.addChild(new Text(toolBlock(chalk.hex(color)(TOOL_DOT), footerText, output, width).join('\n'), BOX_INDENT, 0));
  }

  private buildFooterText(color: string): string {
    const isReflection = this.data.type === 'reflection';

    if (isReflection) {
      // Reflection: "Reflected: Xk → Yk tokens (Zx compression) in Ns"
      const observed = formatTokens(this.data.tokensObserved ?? 0);
      const compressed = formatTokens(this.data.compressedTokens ?? this.data.observationTokens ?? 0);
      const ratio =
        (this.data.tokensObserved ?? 0) > 0 && (this.data.compressedTokens ?? this.data.observationTokens ?? 0) > 0
          ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.compressedTokens ?? this.data.observationTokens ?? 1))}x`
          : '';
      const durationStr = this.data.durationMs ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s` : '';
      const ratioStr = ratio ? ` (${ratio} compression)` : '';
      return `${chalk.hex(color)(`Reflected: ${observed} → ${compressed} tokens${ratioStr}${durationStr}`)}`;
    } else {
      // Observation: "Observed: Xk → Yk tokens (Zx compression) in Ns"
      const observed = formatTokens(this.data.tokensObserved ?? 0);
      const compressed = formatTokens(this.data.observationTokens ?? 0);
      const ratio =
        (this.data.tokensObserved ?? 0) > 0 && (this.data.observationTokens ?? 0) > 0
          ? `${Math.round((this.data.tokensObserved ?? 0) / (this.data.observationTokens ?? 1))}x`
          : '';
      const durationStr = this.data.durationMs ? ` in ${(this.data.durationMs / 1000).toFixed(1)}s` : '';
      const ratioStr = ratio ? ` (${ratio} compression)` : '';
      return `${chalk.hex(color)(`Observed: ${observed} → ${compressed} tokens${ratioStr}${durationStr}`)}`;
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}
