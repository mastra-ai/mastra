/**
 * Inline plan approval component.
 * Shows a submitted plan as rendered markdown with Approve/Use as Goal/Request Changes options
 * directly in the conversation flow. When a previous plan exists, shows a diff of changes.
 *
 * "Request changes" rejects the plan and stops the agent — the user provides
 * revision feedback via a regular chat message rather than inline input.
 */

import {
  Box,
  Container,
  Markdown,
  SelectList,
  Spacer,
  Text,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';
import type { Component, Focusable, SelectItem, TUI } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { getPlanFilename } from '../../utils/plans.js';
import { BOX_INDENT, theme, getSelectListTheme, getMarkdownTheme, mastra } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface PlanApprovalInlineOptions {
  toolCallId: string;
  title: string;
  plan: string;
  /** Filename on disk (e.g. `add-dark-mode.md`). */
  planFilename?: string;
  /** Previous plan content for diff display on resubmission. */
  previousPlan?: string;
  onApprove: () => void;
  onGoal: () => void;
  onReject: () => void;
}

class PlanContentBox implements Component {
  constructor(private plan: string) {}

  invalidate(): void {}

  render(width: number): string[] {
    const availableWidth = Math.max(24, width - BOX_INDENT);
    const innerWidth = Math.max(20, availableWidth - 4);
    const markdown = new Markdown(this.plan, 0, 0, getMarkdownTheme(), {
      color: (text: string) => theme.fg('text', text),
    });
    const rendered = markdown.render(innerWidth).flatMap(line => (line.length > 0 ? [line] : ['']));
    const border = (text: string) => chalk.hex(mastra.purple)(text);
    const top = `${border('╭')}${border('─'.repeat(innerWidth + 2))}${border('╮')}`;
    const bottom = `${border('╰')}${border('─'.repeat(innerWidth + 2))}${border('╯')}`;
    const body: string[] = [];
    for (const line of rendered) {
      // Always wrap every line to innerWidth using the library's ANSI-aware
      // wrapper. This handles paragraphs that the Markdown renderer outputs
      // as single long lines without wrapping.
      const wrapped = wrapTextWithAnsi(line, innerWidth);
      for (const chunk of wrapped) {
        const chunkVis = visibleWidth(chunk);
        const padding = ' '.repeat(Math.max(0, innerWidth - chunkVis));
        body.push(`${border('│')} ${chunk}${padding} ${border('│')}`);
      }
    }
    return [top, ...body, bottom];
  }
}

/**
 * Renders a unified diff between two plan texts inside a bordered box.
 * Long lines are wrapped (not truncated) so the full plan text is visible.
 */
class PlanDiffBox implements Component {
  private diffEntries: DiffEntry[];

  constructor(oldPlan: string, newPlan: string) {
    this.diffEntries = generatePlanDiff(oldPlan, newPlan);
  }

  invalidate(): void {}

  render(width: number): string[] {
    const availableWidth = Math.max(24, width - BOX_INDENT);
    const innerWidth = Math.max(20, availableWidth - 4);
    const border = (text: string) => chalk.hex(mastra.purple)(text);
    const top = `${border('╭')}${border('─'.repeat(innerWidth + 2))}${border('╮')}`;
    const bottom = `${border('╰')}${border('─'.repeat(innerWidth + 2))}${border('╯')}`;

    const removedColor = chalk.hex(mastra.red);
    const addedColor = chalk.hex(theme.getTheme().success);

    const body: string[] = [];
    for (const entry of this.diffEntries) {
      const colorFn =
        entry.type === 'added'
          ? addedColor
          : entry.type === 'removed'
            ? removedColor
            : (t: string) => theme.fg('muted', t);
      const prefix = entry.type === 'added' ? '+ ' : entry.type === 'removed' ? '- ' : '  ';
      const prefixWidth = 2;
      const textWidth = innerWidth - prefixWidth;

      // Use the library's ANSI-aware word-wrap on the raw text first, then
      // colorize each resulting chunk. This guarantees every line fits.
      const wrappedChunks = wrapTextWithAnsi(entry.text, textWidth);
      for (let ci = 0; ci < wrappedChunks.length; ci++) {
        const linePrefix = ci === 0 ? prefix : '  ';
        const content = colorFn(`${linePrefix}${wrappedChunks[ci]}`);
        const contentVis = visibleWidth(content);
        const padding = ' '.repeat(Math.max(0, innerWidth - contentVis));
        body.push(`${border('│')} ${content}${padding} ${border('│')}`);
      }
    }
    return [top, ...body, bottom];
  }
}

interface DiffEntry {
  type: 'added' | 'removed' | 'context';
  text: string;
}

/**
 * Generate structured diff entries between two plan texts.
 */
function generatePlanDiff(oldText: string, newText: string): DiffEntry[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const entries: DiffEntry[] = [];

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    if (i >= oldLines.length) {
      entries.push({ type: 'added', text: newLines[i]! });
    } else if (i >= newLines.length) {
      entries.push({ type: 'removed', text: oldLines[i]! });
    } else if (oldLines[i] !== newLines[i]) {
      entries.push({ type: 'removed', text: oldLines[i]! });
      entries.push({ type: 'added', text: newLines[i]! });
    } else {
      entries.push({ type: 'context', text: oldLines[i]! });
    }
  }

  return entries;
}

export class PlanApprovalInlineComponent extends Container implements Focusable {
  private contentBox: Box;
  private selectList?: SelectList;
  private onApprove?: () => void;
  private onGoal?: () => void;
  private onReject?: () => void;
  private resolved = false;
  private mode: 'streaming' | 'select' = 'select';
  private planTitle: string;
  private planContent: string;
  private planFilename?: string;
  private previousPlan?: string;

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(
    options: PlanApprovalInlineOptions,
    private ui: TUI,
  ) {
    super();
    this.planTitle = options.title;
    this.planContent = options.plan;
    this.planFilename = options.planFilename;
    this.previousPlan = options.previousPlan;
    this.contentBox = new Box(BOX_INDENT, 0, (text: string) => text);
    this.addChild(this.contentBox);
    this.activate(options);
  }

  static createStreaming(ui: TUI): PlanApprovalInlineComponent {
    const component = new PlanApprovalInlineComponent(
      {
        toolCallId: '',
        title: 'Untitled plan',
        plan: '',
        onApprove: () => {},
        onGoal: () => {},
        onReject: () => {},
      },
      ui,
    );
    component.mode = 'streaming';
    component.resolved = false;
    component.renderStreaming();
    return component;
  }

  activate(options: PlanApprovalInlineOptions): void {
    this.onApprove = options.onApprove;
    this.onGoal = options.onGoal;
    this.onReject = options.onReject;
    this.planTitle = options.title;
    this.planContent = options.plan;
    this.planFilename = options.planFilename;
    this.previousPlan = options.previousPlan;
    this.mode = 'select';
    this.resolved = false;
    this.renderSelectable();
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'plan';
  }

  updateArgs(args: unknown): void {
    if (!args || typeof args !== 'object' || this.resolved) return;
    const partial = args as { title?: unknown; plan?: unknown };
    if (typeof partial.title === 'string') {
      this.planTitle = partial.title || 'Untitled plan';
      this.planFilename = getPlanFilename(this.planTitle);
    }
    if (typeof partial.plan === 'string') {
      this.planContent = partial.plan;
    }
    if (this.mode === 'streaming') {
      this.renderStreaming();
    }
  }

  private renderSelectable(): void {
    this.contentBox.clear();
    this.selectList = undefined;
    this.renderPlanHeader();

    // Show diff when this is a resubmission with a previous plan
    if (this.previousPlan) {
      this.contentBox.addChild(new Text(theme.fg('dim', 'Changes from previous plan:'), 0, 0));
      this.contentBox.addChild(new Spacer(1));
      this.contentBox.addChild(new PlanDiffBox(this.previousPlan, this.planContent));
    } else {
      this.renderPlanContent();
    }
    this.contentBox.addChild(new Spacer(1));

    const items: SelectItem[] = [
      {
        value: 'approve',
        label: `  ${theme.fg('success', 'Approve')} ${theme.fg('dim', '— switch to Build mode and implement')}`,
      },
      {
        value: 'goal',
        label: `  ${theme.fg('success', 'Use as /goal')} ${theme.fg('dim', '— switch to Build mode and pursue this plan')}`,
      },
      {
        value: 'changes',
        label: `  ${theme.fg('warning', 'Request changes')} ${theme.fg('dim', '— reject and provide feedback via chat')}`,
      },
    ];

    this.selectList = new SelectList(items, items.length, getSelectListTheme());

    this.selectList.onSelect = (item: SelectItem) => {
      this.handleSelection(item.value);
    };
    this.selectList.onCancel = () => {
      this.handleReject();
    };

    this.contentBox.addChild(this.selectList);
    this.contentBox.addChild(new Spacer(1));
    this.contentBox.addChild(new Text(theme.fg('dim', 'Up/Down navigate  Enter select  Esc reject'), 0, 0));
  }

  private renderStreaming(): void {
    this.contentBox.clear();
    this.selectList = undefined;
    this.renderPlanHeader();
    this.renderPlanContent();
    this.contentBox.addChild(new Text(theme.fg('dim', 'Submitting plan…'), 0, 0));
  }

  private renderPlanHeader(prefix = ''): void {
    this.contentBox.addChild(new Text(`${prefix}${theme.bold(theme.fg('accent', `Plan: ${this.planTitle}`))}`, 0, 0));
    if (this.planFilename) {
      this.contentBox.addChild(new Text(theme.fg('dim', `.mastracode/plans/${this.planFilename}`), 0, 0));
    }
    this.contentBox.addChild(new Spacer(1));
  }

  private renderPlanContent(): void {
    this.contentBox.addChild(new PlanContentBox(this.planContent));
  }

  private handleSelection(value: string): void {
    if (this.resolved) return;

    switch (value) {
      case 'approve':
        this.handleApprove();
        break;
      case 'goal':
        this.handleGoal();
        break;
      case 'changes':
        this.handleReject();
        break;
    }
  }

  private handleApprove(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.showResult('Approved', true);
    this.onApprove?.();
  }

  private handleGoal(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.showResult('Set as goal', true);
    this.onGoal?.();
  }

  private handleReject(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.showResult('Changes requested', false);
    this.onReject?.();
  }

  private showResult(status: string, isApproved: boolean): void {
    this.contentBox.clear();

    const icon = isApproved ? theme.fg('success', '✓') : theme.fg('error', '✗');
    this.renderPlanHeader();
    this.renderPlanContent();
    this.contentBox.addChild(new Spacer(1));
    this.contentBox.addChild(new Text(`${icon} ${theme.fg('dim', status)}`, 0, 0));
    this.contentBox.addChild(new Spacer(1));
    if (!isApproved) {
      this.contentBox.addChild(new Text(theme.fg('dim', 'Send a message with your revision feedback'), 0, 0));
      this.contentBox.addChild(new Spacer(1));
    }
  }

  handleInput(data: string): void {
    if (this.resolved) return;

    if (this.selectList) {
      this.selectList.handleInput(data);
    }
  }
}

/**
 * Static component for rendering a resolved plan in history.
 * Shows the plan content with approval/rejection status.
 */
export interface PlanResultOptions {
  title: string;
  plan: string;
  /** Filename on disk (e.g. `add-dark-mode.md`). */
  planFilename?: string;
  isApproved: boolean;
  feedback?: string;
}

export class PlanResultComponent extends Container {
  getChatSpacingKind(): ChatSpacingKind {
    return 'plan';
  }

  constructor(options: PlanResultOptions) {
    super();

    const contentBox = new Box(BOX_INDENT, 0, (text: string) => text);
    this.addChild(contentBox);

    const icon = options.isApproved ? theme.fg('success', '✓') : theme.fg('error', '✗');
    const status = options.isApproved ? 'Approved' : options.feedback ? 'Changes requested' : 'Rejected';

    contentBox.addChild(new Text(theme.bold(theme.fg('accent', `Plan: ${options.title}`)), 0, 0));
    if (options.planFilename) {
      contentBox.addChild(new Text(theme.fg('dim', `.mastracode/plans/${options.planFilename}`), 0, 0));
    }
    contentBox.addChild(new Spacer(1));
    contentBox.addChild(new PlanContentBox(options.plan));
    contentBox.addChild(new Spacer(1));
    contentBox.addChild(new Text(`${icon} ${theme.fg('dim', status)}`, 0, 0));
    contentBox.addChild(new Spacer(1));

    if (options.feedback && options.feedback !== 'Revision requested') {
      contentBox.addChild(new Text(theme.fg('warning', `Requested changes: ${options.feedback}`), 0, 0));
      contentBox.addChild(new Spacer(1));
    }
  }
}
