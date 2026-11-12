/**
 * When a project's cards were created and completed since an instant: what the draft page's
 * activity band plots, so the page never downloads the board to count them.
 */

import type { z } from 'zod';

import type { BoardRegistry } from '../boards/index.js';
import { boardFlow, boardForWorkItem } from '../boards/index.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { workItemActivityResponseSchema } from './contracts.js';

export type WorkItemActivity = z.infer<typeof workItemActivityResponseSchema>;

/** When the card last entered its board's completed phase, if it sits there now. */
function doneAt(card: Card, boards: BoardRegistry): string | undefined {
  const completed = boardFlow(boards.get(boardForWorkItem(card))).completed?.phase;
  if (completed === undefined || !card.stages.includes(completed)) return undefined;
  return card.stageHistory.findLast(entry => entry.stage === completed)?.enteredAt;
}

export function workItemActivity(cards: readonly Card[], boards: BoardRegistry, since: number): WorkItemActivity {
  const activity: WorkItemActivity = { total: cards.length, createdAt: [], doneAt: [] };
  for (const card of cards) {
    if (card.createdAt.getTime() >= since) activity.createdAt.push(card.createdAt.toISOString());
    const done = doneAt(card, boards);
    if (done !== undefined && Date.parse(done) >= since) activity.doneAt.push(done);
  }
  return activity;
}
