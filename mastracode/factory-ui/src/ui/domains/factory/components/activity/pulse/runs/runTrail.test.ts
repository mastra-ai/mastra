import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../../../services/audit';
import { foldHeadPage, runPage } from './runTrail';
import type { RunPage, RunPages } from './runTrail';

const NOW = Date.parse('2026-10-19T12:00:00.000Z');

function started(kickoffId: string, minutesAgo: number): AuditEvent {
  return {
    id: `${kickoffId}-started`,
    actorId: 'user-1',
    actorType: 'human',
    action: 'factory.run.started',
    targets: [],
    metadata: { kickoffId, role: 'work' },
    occurredAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  };
}

function page(events: AuditEvent[], nextCursor?: string): RunPage {
  return runPage({ events, actors: {}, ...(nextCursor === undefined ? {} : { nextCursor }) });
}

function kickoffsPerPage(pages: RunPages): string[][] {
  return pages.pages.map(({ runEvents }) => runEvents.map(event => event.kickoffId));
}

describe('foldHeadPage', () => {
  const older = page([started('k2', 30), started('k1', 40)]);
  const trail: RunPages = {
    pages: [page([started('k4', 10), started('k3', 20)], 'after-k3'), older],
    pageParams: [undefined, 'after-k3'],
  };

  it('folds runs the head saw since into the first page, leaving older pages and where they continue untouched', () => {
    const folded = foldHeadPage(trail, page([started('k5', 5), started('k4', 10)], 'after-k4'));

    expect(kickoffsPerPage(folded)).toEqual([
      ['k5', 'k4', 'k3'],
      ['k2', 'k1'],
    ]);
    expect(folded.pages[0]?.nextCursor).toBe('after-k3');
    expect(folded.pages[1]).toBe(older);
    expect(folded.pageParams).toEqual(trail.pageParams);
  });

  it('picks up a run recorded late inside the span the head covers', () => {
    const folded = foldHeadPage(trail, page([started('k4', 10), started('late', 15), started('k3', 20)], 'after-k3'));

    expect(kickoffsPerPage(folded)[0]).toEqual(['k4', 'late', 'k3']);
  });

  it('keeps the very same trail when the head holds nothing new', () => {
    expect(foldHeadPage(trail, page([started('k4', 10)], 'after-k4'))).toBe(trail);
  });

  it('starts over from the head once it no longer reaches the loaded pages, rather than leaving a hole', () => {
    const head = page([started('k7', 1), started('k6', 2)], 'after-k6');

    expect(foldHeadPage(trail, head)).toEqual({ pages: [head], pageParams: [undefined] });
  });
});
