import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { TimeWindow } from '../../time/timeViewport';
import type { Lane, PlacedRun } from '../layout/laneLayout';
import { LaneFolds } from './LaneFolds';

const WINDOW: TimeWindow = { startMs: 0, endMs: 1_000, endsAtNow: false };

function overflowRun(index: number): PlacedRun {
  const startedAt = 100 + index;
  return {
    run: {
      id: `run-${index}`,
      role: 'work',
      workItemId: undefined,
      card: undefined,
      title: `Run ${index}`,
      startedAt,
      endedAt: 200,
      status: 'complete',
    },
    row: 2,
    fromMs: startedAt,
    toMs: 200,
    startNotInView: false,
  };
}

function busyLane(runCount: number): Lane {
  return {
    role: 'work',
    rowCount: 3,
    runs: [],
    overflowRuns: Array.from({ length: runCount }, (_, index) => overflowRun(index)),
    overflowRow: 2,
    foldable: true,
  };
}

function renderFolds(onExpandLane: (() => void) | undefined) {
  render(
    <MemoryRouter>
      <LaneFolds
        lane={busyLane(25)}
        window={WINDOW}
        widthPx={1_000}
        factoryProjectId="factory-1"
        onExpandLane={onExpandLane}
      />
    </MemoryRouter>,
  );
}

const menuItemNames = async () => (await screen.findAllByRole('menuitem')).map(item => item.textContent);

describe('LaneFolds', () => {
  it('lists the newest folded runs first, up to a cap, then offers to expand the lane', async () => {
    const user = userEvent.setup();
    const onExpandLane = vi.fn();
    renderFolds(onExpandLane);

    await user.click(screen.getByRole('button', { name: '+25 runs, folded' }));
    const names = await menuItemNames();

    expect(names).toHaveLength(21);
    expect(names[0]).toMatch(/^Run 24/);
    expect(names[19]).toMatch(/^Run 5/);
    expect(names[20]).toBe('Show more rows');

    await user.click(screen.getByRole('menuitem', { name: 'Show more rows' }));
    expect(onExpandLane).toHaveBeenCalledOnce();
  });

  it('offers no way to expand a lane that is already expanded', async () => {
    const user = userEvent.setup();
    renderFolds(undefined);

    await user.click(screen.getByRole('button', { name: '+25 runs, folded' }));

    expect(await menuItemNames()).toHaveLength(20);
    expect(screen.queryByRole('menuitem', { name: 'Show more rows' })).not.toBeInTheDocument();
  });
});
