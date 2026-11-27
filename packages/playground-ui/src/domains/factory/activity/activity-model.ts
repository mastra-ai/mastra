export type ActivityPeriod = 'today' | 'week' | 'month';
export type ActivityKind = 'cameIn' | 'ran' | 'shipped';
export type ActivityCounts = Record<ActivityKind, number>;

export const ACTIVITY_KIND_ORDER: readonly ActivityKind[] = ['cameIn', 'ran', 'shipped'];

/** The period the activity band opens on. */
export const DEFAULT_ACTIVITY_PERIOD: ActivityPeriod = 'week';

export const ACTIVITY_PERIOD_LABELS: Record<ActivityPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

export const PERIOD_DAYS = { week: 7, month: 30 } as const;

export interface ActivitySlot {
  start: number;
  end: number;
  counts: ActivityCounts;
  ranComplete: boolean;
}

export interface Activity {
  hoursPerSlot: number;
  slots: ActivitySlot[];
  totals: ActivityCounts;
  ranComplete: boolean;
}

export interface RunsState {
  status: 'pending' | 'error' | 'success';
  complete: boolean;
}

export const traySurface = 'bg-surface-panel dark:bg-card rounded-[calc(var(--radius-card)+var(--spacing)*1.5)]';

export const ACTIVITY_RECAPS: Record<ActivityPeriod, { label: string; prompt: string }> = {
  today: { label: 'Recap today', prompt: recapPrompt('today') },
  week: { label: 'Recap the week', prompt: recapPrompt(`in the last ${PERIOD_DAYS.week} days`) },
  month: { label: 'Recap the month', prompt: recapPrompt(`in the last ${PERIOD_DAYS.month} days`) },
};

function recapPrompt(since: string) {
  return `Summarize what reached Done ${since}, grouped by theme. Name anything that is still waiting on someone.`;
}
