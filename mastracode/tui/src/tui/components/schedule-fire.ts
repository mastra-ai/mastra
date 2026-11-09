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
import { WidthAwareContainer } from './width-aware-container.js';

const BODY_INDENT = BOX_INDENT + 2;

export interface ScheduleFireOptions {
  prompt: string;
  attributes: Record<string, unknown>;
  previewLineLimit?: number;
}

function attr(attributes: Record<string, unknown>, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === 'string' && value ? value : undefined;
}

function normalizePreviewLineLimit(limit: number | undefined): number {
  const normalized = Number.isFinite(limit) ? (limit as number) : 2;
  return Math.min(8, Math.max(0, Math.floor(normalized)));
}

export class ScheduleFireComponent extends WidthAwareContainer {
  private readonly promptLines: string[];
  private readonly attributes: Record<string, unknown>;
  private previewLineLimit: number;
  private expanded = false;

  constructor(options: ScheduleFireOptions) {
    super();
    this.promptLines = options.prompt.trim().split('\n');
    this.attributes = options.attributes;
    this.previewLineLimit = normalizePreviewLineLimit(options.previewLineLimit);
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  setPreviewLineLimit(limit: number): void {
    const normalized = normalizePreviewLineLimit(limit);
    if (this.previewLineLimit === normalized) return;
    this.previewLineLimit = normalized;
    this.rebuild();
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }

  protected rebuildForWidth(): void {
    this.clear();
    this.addChild(new Text(this.header(), BOX_INDENT, 0));

    const collapsedLimit = this.previewLineLimit;
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
