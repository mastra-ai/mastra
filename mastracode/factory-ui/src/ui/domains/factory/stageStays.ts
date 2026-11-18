import type { WorkItem, WorkItemStageEntry } from './services/workItems';

export interface StageStay {
  entry: WorkItemStageEntry;
  from: number;
  to: number;
}

export const toMinute = (time: number) => Math.floor(time / 60_000) * 60_000;

export function stageStays(history: readonly WorkItemStageEntry[], now: number): StageStay[] {
  return history
    .map(entry => {
      const from = Date.parse(entry.enteredAt);
      // The clock reads to the minute, so a stay entered since its last tick ends where it starts.
      return { entry, from, to: Math.max(from, entry.exitedAt ? Date.parse(entry.exitedAt) : now) };
    })
    .toSorted((a, b) => a.from - b.from);
}

export function stageMoves(card: Pick<WorkItem, 'stageHistory' | 'createdAt'>): WorkItemStageEntry[] {
  const filedAt = Date.parse(card.createdAt);
  return card.stageHistory.filter(entry => Date.parse(entry.enteredAt) > filedAt);
}
