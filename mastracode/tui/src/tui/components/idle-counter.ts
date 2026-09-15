/**
 * Live work/idle-time indicator shown above the user input.
 */

import { Container, Text } from '@earendil-works/pi-tui';
import type { TUIState } from '../state.js';
import { formatStatusDuration } from '../status-duration.js';
import { BOX_INDENT, theme } from '../theme.js';

export { formatStatusDuration } from '../status-duration.js';

const MINUTE_MS = 60_000;

export class IdleCounterComponent extends Container {
  private timingState?: Pick<TUIState, 'lastAgentRunDurationMs' | 'lastAgentRunEndedAt' | 'lastAgentRunEndReason'>;
  private textChild: Text;

  constructor() {
    super();
    this.textChild = new Text('', BOX_INDENT, 0);
    this.addChild(this.textChild);
  }

  setTimingState(
    timingState: Pick<TUIState, 'lastAgentRunDurationMs' | 'lastAgentRunEndedAt' | 'lastAgentRunEndReason'> | undefined,
    now = Date.now(),
  ): void {
    this.timingState = timingState;
    this.update(now);
  }

  update(now = Date.now()): void {
    const segments = this.timingState ? formatIdleStatusTimingSegments(this.timingState, now) : null;
    if (!segments) {
      this.textChild.setText('');
      return;
    }

    const idle = segments.idle ? theme.fg('dim', segments.idle) : '';
    this.textChild.setText(idle ? `  ${idle}` : '');
  }

  render(width: number): string[] {
    const rendered = super.render(width);
    return rendered.length > 0 ? rendered : [''];
  }
}

type IdleStatusTimingState = Pick<TUIState, 'lastAgentRunDurationMs' | 'lastAgentRunEndedAt' | 'lastAgentRunEndReason'>;

export function formatIdleStatusTimingSegments(
  state: IdleStatusTimingState,
  now = Date.now(),
): { summary: string; idle: string } | null {
  if (state.lastAgentRunEndedAt === undefined) {
    return null;
  }

  const idleMs = now - state.lastAgentRunEndedAt;
  const idle = idleMs >= MINUTE_MS ? `${formatStatusDuration(idleMs)} idle` : '';
  return idle ? { summary: '', idle } : null;
}

export function formatIdleStatusTiming(state: IdleStatusTimingState, now = Date.now()): string {
  const segments = formatIdleStatusTimingSegments(state, now);
  if (!segments) return '';
  return segments.summary && segments.idle
    ? `${segments.summary} · ${segments.idle}`
    : segments.summary || segments.idle;
}
