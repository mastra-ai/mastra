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
import type { DiffEntry } from '@mastra/code-sdk/utils/plan-diff';
import { generatePlanDiff } from '@mastra/code-sdk/utils/plan-diff';
import chalk from 'chalk';
import {
  BOX_INDENT,
  displayModeColor,
  theme,
  getSelectListTheme,
  getMarkdownTheme,
  getThemeGeneration,
  mastra,
} from '../theme.js';
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

/** Exported for tests. */
export class PlanContentBox implements Component {
  private cachedLines?: string[];
  private cachedWidth?: number;
  private cachedThemeGeneration?: number;

  constructor(private plan: string) {}

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.cachedThemeGeneration = undefined;
  }

  render(width: number): string[] {
    // Rendering a large plan lexes markdown and grapheme-wraps every line —
    // expensive enough to dominate a frame. Cache by (width, theme) since the
    // plan text is fixed after construction.
    if (this.cachedLines && this.cachedWidth === width && this.cachedThemeGeneration === getThemeGeneration()) {
      return this.cachedLines;
    }
    // No border: the plan sits inside the prompt's purple left bar (see PlanCard).
    const innerWidth = Math.max(20, width - BOX_INDENT);
    const markdown = new Markdown(this.plan, 0, 0, getMarkdownTheme(), {
      color: (text: string) => theme.fg('text', text),
    });
    const rendered = markdown.render(innerWidth).flatMap(line => (line.length > 0 ? [line] : ['']));
    const body: string[] = [];
    for (const line of rendered) {
      // Paragraphs can come back as one long line; wrap everything to the inner width.
      body.push(...wrapTextWithAnsi(line, innerWidth).map(chunk => chunk.replace(/\s+$/, '')));
    }
    this.cachedLines = body;
    this.cachedWidth = width;
    this.cachedThemeGeneration = getThemeGeneration();
    return this.cachedLines;
  }
}

/**
 * Renders a unified diff between two plan texts inside a bordered box.
 * Long lines are wrapped (not truncated) so the full plan text is visible.
 */
export class PlanDiffBox implements Component {
  private diffEntries: DiffEntry[];
  private cachedLines?: string[];
  private cachedWidth?: number;
  private cachedThemeGeneration?: number;

  constructor(oldPlan: string, newPlan: string) {
    this.diffEntries = generatePlanDiff(oldPlan, newPlan);
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.cachedThemeGeneration = undefined;
  }

  render(width: number): string[] {
    // Same cache rationale as PlanContentBox: diff entries are fixed after
    // construction, so output only varies with width and theme.
    if (this.cachedLines && this.cachedWidth === width && this.cachedThemeGeneration === getThemeGeneration()) {
      return this.cachedLines;
    }
    const innerWidth = Math.max(20, width - BOX_INDENT);

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
        body.push(content);
      }
    }
    this.cachedLines = body;
    this.cachedWidth = width;
    this.cachedThemeGeneration = getThemeGeneration();
    return this.cachedLines;
  }
}

/** Plan prompts sit inside a left bar in the plan-mode color, like the other inline prompts. */
function withPlanBar(lines: string[]): string[] {
  const bar = chalk.hex(displayModeColor(mastra.purple))('▎');
  return lines.map(line => (line.replace(/\x1b\[[0-9;]*m/g, '').trim() === '' ? bar : `${bar} ${line}`));
}

export class PlanApprovalInlineComponent extends Container implements Focusable {
  override render(width: number): string[] {
    return withPlanBar(super.render(Math.max(1, width - 2)));
  }

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
    const partial = args as { path?: unknown };
    // submit_plan streams only the `path` arg; title/plan are read from disk on suspend.
    if (typeof partial.path === 'string' && partial.path) {
      this.planFilename = partial.path;
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
        label: `${theme.fg('text', 'Approve')}          ${theme.fg('dim', 'switch to Build mode and implement')}`,
      },
      {
        value: 'goal',
        label: `${theme.fg('text', 'Use as /goal')}     ${theme.fg('dim', 'switch to Build mode and pursue this plan')}`,
      },
      {
        value: 'changes',
        label: `${theme.fg('text', 'Request changes')}  ${theme.fg('dim', 'reject and give feedback in chat')}`,
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
    this.contentBox.addChild(new Text(theme.fg('dim', '↑↓ select · Enter confirm · Esc reject'), 0, 0));
  }

  private renderStreaming(): void {
    this.contentBox.clear();
    this.selectList = undefined;
    this.renderPlanHeader();
    this.renderPlanContent();
    this.contentBox.addChild(new Text(theme.fg('dim', 'Submitting plan…'), 0, 0));
  }

  private renderPlanHeader(prefix = ''): void {
    const plan = chalk.bold.hex(displayModeColor(mastra.purple));
    this.contentBox.addChild(
      new Text(`${prefix}${plan('Plan:')} ${theme.bold(theme.fg('text', this.planTitle))}`, 0, 0),
    );
    if (this.planFilename) {
      this.contentBox.addChild(new Text(theme.fg('dim', this.planFilename), 0, 0));
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
  override render(width: number): string[] {
    return withPlanBar(super.render(Math.max(1, width - 2)));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'plan';
  }

  constructor(options: PlanResultOptions) {
    super();

    const contentBox = new Box(BOX_INDENT, 0, (text: string) => text);
    this.addChild(contentBox);

    const icon = options.isApproved ? theme.fg('success', '✓') : theme.fg('error', '✗');
    const status = options.isApproved ? 'Approved' : options.feedback ? 'Changes requested' : 'Rejected';

    contentBox.addChild(
      new Text(
        `${chalk.bold.hex(displayModeColor(mastra.purple))('Plan:')} ${theme.bold(theme.fg('text', options.title))}`,
        0,
        0,
      ),
    );
    if (options.planFilename) {
      contentBox.addChild(new Text(theme.fg('dim', options.planFilename), 0, 0));
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
