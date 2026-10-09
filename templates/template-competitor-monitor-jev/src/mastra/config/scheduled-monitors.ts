import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { SCHEDULE_DEFAULTS } from './model-defaults-config';
import type { MonitorInput } from '../schemas';
import { validateMonitorInput } from '../schemas';

/** Read operator-supplied URLs only when the scheduler is explicitly enabled. */
export function scheduledMonitorInputs(
  schedule: { enabled: boolean; file: string },
  maxSources: number,
): MonitorInput[] {
  if (!schedule.enabled) return [];
  let raw: string;
  try {
    raw = readFileSync(schedule.file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Missing scheduled-monitors.json');
    throw error;
  }
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values) || values.length === 0) throw new Error('EXPECTED_NONEMPTY_ARRAY');
    const inputs = values.map(value => validateMonitorInput(value));
    if (inputs.some(input => input.sources.length > maxSources)) throw new Error('SOURCE_LIMIT_EXCEEDED');
    if (new Set(inputs.map(input => input.monitorId)).size !== inputs.length) throw new Error('DUPLICATE_MONITOR_ID');
    return inputs;
  } catch {
    throw new Error('Invalid scheduled-monitors.json');
  }
}

/** Declarative schedules are reconciled by Mastra when the registered workflow boots. */
export function dailyMonitorSchedules(inputs: MonitorInput[]) {
  return inputs.map(input => ({
    id: createHash('sha256').update(input.monitorId).digest('hex'),
    cron: SCHEDULE_DEFAULTS.cron,
    timezone: SCHEDULE_DEFAULTS.timezone,
    inputData: { ...input, runMode: 'scheduled' as const },
    metadata: { monitorId: input.monitorId },
  }));
}
