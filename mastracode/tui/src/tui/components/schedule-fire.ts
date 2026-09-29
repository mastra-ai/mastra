/**
 * ScheduleFireComponent - renders a prompt sent by `/schedules` (or the agent's
 * schedule tools) as a system entry rather than a user bubble: a compact header
 * with the schedule's id, cadence, source, and script outcome, and the prompt
 * collapsed behind ctrl+e. Everything comes from the signal's attributes, so
 * reloaded history renders the same way after the session that owned the
 * schedule has exited.
 */

import { Text } from '@earendil-works/pi-tui';
import { BOX_INDENT, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import type { QuietToolDisplayMode } from './tool-execution-interface.js';
import { WidthAwareContainer } from './width-aware-container.js';

const COLLAPSED_PROMPT_LINES = 4;
const BODY_INDENT = BOX_INDENT + 2;

export interface ScheduleFireOptions {
  prompt: string;
  attributes: Record<string, unknown>;
  quietDisplayMode?: QuietToolDisplayMode;
  quietPreviewLineLimit?: number;
}

function attr(attributes: Record<string, unknown>, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeQuietPreviewLineLimit(limit: number | undefined): number {
  const normalized = Number.isFinite(limit) ? (limit as number) : 2;
  return Math.min(8, Math.max(0, Math.floor(normalized)));
}

export class ScheduleFireComponent extends WidthAwareContainer {
  private readonly promptLines: string[];
  private readonly attributes: Record<string, unknown>;
  private quietDisplayMode: QuietToolDisplayMode;
  private quietPreviewLineLimit: number;
  private expanded = false;

  constructor(options: ScheduleFireOptions) {
    super();
    this.promptLines = options.prompt.trim().split('\n');
    this.attributes = options.attributes;
    this.quietDisplayMode = options.quietDisplayMode ?? 'normal';
    this.quietPreviewLineLimit = normalizeQuietPreviewLineLimit(options.quietPreviewLineLimit);
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  setQuietModeDisplay(mode: QuietToolDisplayMode): void {
    if (this.quietDisplayMode === mode) return;
    this.quietDisplayMode = mode;
    this.rebuild();
  }

  setQuietPreviewLineLimit(limit: number): void {
    const normalized = normalizeQuietPreviewLineLimit(limit);
    if (this.quietPreviewLineLimit === normalized) return;
    this.quietPreviewLineLimit = normalized;
    this.rebuild();
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }

  protected rebuildForWidth(): void {
    this.clear();
    this.addChild(new Text(this.header(), BOX_INDENT, 0));

    const collapsedLimit = this.quietDisplayMode === 'quiet' ? this.quietPreviewLineLimit : COLLAPSED_PROMPT_LINES;
    // Hiding a single line would cost the same space as the "1 more line" hint, so show it instead.
    const limit =
      this.expanded || this.promptLines.length <= collapsedLimit + 1 ? this.promptLines.length : collapsedLimit;
    for (const line of this.promptLines.slice(0, limit)) {
      this.addChild(new Text(theme.fg('muted', line), BODY_INDENT, 0));
    }
    const hidden = this.promptLines.length - limit;
    if (hidden > 0) {
      this.addChild(
        new Text(theme.fg('dim', `… ${hidden} more line${hidden === 1 ? '' : 's'} (ctrl+e to expand)`), BODY_INDENT, 0),
      );
    }
  }

  private header(): string {
    const id = attr(this.attributes, 'scheduleId')?.slice(0, 8);
    const cadence = attr(this.attributes, 'scheduleCadence');
    const source = attr(this.attributes, 'scheduleSource');
    const outcome = attr(this.attributes, 'scheduleOutcome');
    const byAgent = attr(this.attributes, 'scheduleCreatedBy') === 'agent';

    const parts = [theme.bold(theme.fg('toolTitle', `⏱ schedule${id ? ` ${id}` : ''}`))];
    if (cadence) parts.push(theme.fg('muted', `every ${cadence}`));
    if (source) parts.push(theme.fg('muted', source));
    if (outcome) parts.push(theme.fg(outcome === 'exit 0' ? 'success' : 'error', outcome));
    if (byAgent) parts.push(theme.fg('dim', 'created by agent'));
    return parts.join(theme.fg('dim', ' · '));
  }
}
