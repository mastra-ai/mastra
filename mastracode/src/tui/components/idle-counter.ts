/**
 * Live idle-time indicator shown above the user input after an agent run completes.
 */

import { Container, Text } from '@earendil-works/pi-tui';
import { BOX_INDENT, theme } from '../theme.js';

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = HOUR_MINUTES * 24;
const MONTH_MINUTES = DAY_MINUTES * 30;
const YEAR_MINUTES = DAY_MINUTES * 365;

export class IdleCounterComponent extends Container {
  private idleStartedAt?: number;
  private textChild: Text;

  constructor() {
    super();
    this.textChild = new Text('', BOX_INDENT, 0);
    this.addChild(this.textChild);
  }

  setIdleStartedAt(idleStartedAt: number | undefined, now = Date.now()): void {
    this.idleStartedAt = idleStartedAt;
    this.update(now);
  }

  update(now = Date.now()): void {
    if (this.idleStartedAt === undefined) {
      this.textChild.setText('');
      return;
    }

    const idleMinutes = Math.floor((now - this.idleStartedAt) / MINUTE_MS);
    if (idleMinutes < 1) {
      this.textChild.setText('');
      return;
    }

    this.textChild.setText(theme.fg('dim', `  ${formatIdleDuration(idleMinutes)} idle`));
  }

  render(width: number): string[] {
    const rendered = super.render(width);
    return rendered.length > 0 ? rendered : [''];
  }
}

export function formatIdleDuration(totalMinutes: number): string {
  const minutes = Math.max(1, Math.floor(totalMinutes));
  const units = [
    { name: 'year', minutes: YEAR_MINUTES },
    { name: 'month', minutes: MONTH_MINUTES },
    { name: 'day', minutes: DAY_MINUTES },
    { name: 'hour', minutes: HOUR_MINUTES },
    { name: 'minute', minutes: 1 },
  ];

  let remaining = minutes;
  const parts: string[] = [];

  for (const unit of units) {
    const value = Math.floor(remaining / unit.minutes);
    if (value === 0) continue;

    parts.push(formatUnit(value, unit.name));
    remaining %= unit.minutes;

    if (parts.length === 2) break;
  }

  return parts.join(' ');
}

function formatUnit(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}
