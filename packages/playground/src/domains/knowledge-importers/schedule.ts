export interface SchedulePreset {
  id: string;
  label: string;
  cron: string;
}

export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  { id: 'every-15-minutes', label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { id: 'hourly', label: 'Hourly', cron: '0 * * * *' },
  { id: 'daily', label: 'Daily', cron: '0 3 * * *' },
];

const CRON_FIELD = /^[\d*,/-]+$/;
const NUMBER = /^\d+$/;
const STEP = /^\*\/(\d+)$/;

/** Shape check only — the server validates ranges and rejects anything it can't schedule. */
export function isFiveFieldCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every(field => CRON_FIELD.test(field));
}

const plural = (count: string, unit: string) => (count === '1' ? `every ${unit}` : `every ${count} ${unit}s`);
const pad = (value: string) => value.padStart(2, '0');

/** "every 15 minutes", "daily at 03:00", … — falls back to the raw expression for anything unusual. */
export function describeCron(expression: string): string {
  if (!isFiveFieldCron(expression)) return `cron "${expression}"`;
  const [minute = '', hour = '', dayOfMonth, month, dayOfWeek] = expression.trim().split(/\s+/);
  if (dayOfMonth !== '*' || month !== '*' || dayOfWeek !== '*') return `cron "${expression}"`;

  if (minute === '*' && hour === '*') return 'every minute';
  const minuteStep = STEP.exec(minute);
  if (minuteStep?.[1] && hour === '*') return plural(minuteStep[1], 'minute');
  if (!NUMBER.test(minute)) return `cron "${expression}"`;
  if (hour === '*') return minute === '0' ? 'every hour' : `every hour at :${pad(minute)}`;
  const hourStep = STEP.exec(hour);
  if (hourStep?.[1] && minute === '0') return plural(hourStep[1], 'hour');
  if (NUMBER.test(hour)) return `daily at ${pad(hour)}:${pad(minute)}`;
  return `cron "${expression}"`;
}

/** Plain-words effective schedule; the server reports `null` when nothing will fire. */
export function describeEffectiveSchedule(effectiveSchedule: string | null): string {
  return effectiveSchedule === null ? 'paused' : describeCron(effectiveSchedule);
}
