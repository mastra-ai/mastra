/**
 * Component coverage for the Factory queue-health chart.
 *
 * Drives the real component through the shared provider stack; no network is
 * involved (the chart is fed a `QueueHealth` aggregate directly), so these
 * specs focus on proportional rendering, progressive hover/focus details,
 * empty and active states, stage summaries, and cohort selection.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/web-ui/render';
import type { QueueHealth, QueueHealthEntry, QueueHealthStage } from '../queue-health';
import type { QueueHealthSelection } from '../components/QueueHealthChart';
import { QueueHealthChart } from '../components/QueueHealthChart';

const THRESHOLDS = [14400, 86400, 259200]; // 4h / 24h / 72h

function stageAgg(overrides: Partial<QueueHealthStage> & { stage: string }): QueueHealthStage {
  return {
    total: 0,
    buckets: { green: 0, amber: 0, orange: 0, red: 0 },
    activeCount: 0,
    ...overrides,
  };
}

function makeHealth(stages: QueueHealthStage[], entries: QueueHealthEntry[] = []): QueueHealth {
  return { stages, entries };
}

function healthEntry(overrides: Partial<QueueHealthEntry> = {}): QueueHealthEntry {
  return {
    itemId: 'item-1',
    title: 'Example task',
    url: null,
    stage: 'execute',
    ageSeconds: 3600,
    bucket: 'green',
    active: false,
    ...overrides,
  };
}

/** The five non-done board stages, overridable per stage. */
function defaultStages(overrides: Partial<Record<string, Partial<QueueHealthStage>>> = {}): QueueHealthStage[] {
  return ['intake', 'triage', 'planning', 'execute', 'review'].map(stage =>
    stageAgg({ stage, ...(overrides[stage] ?? {}) }),
  );
}

function Harness({ health }: { health: QueueHealth }) {
  const [selected, setSelected] = useState<QueueHealthSelection | null>(null);
  return (
    <div>
      <QueueHealthChart health={health} thresholdsSeconds={THRESHOLDS} selected={selected} onSelect={setSelected} />
      <output data-testid="selection">{selected?.bucket ?? 'cleared'}</output>
    </div>
  );
}

const INTAKE_ENTRIES = [
  healthEntry({ itemId: 'fresh-1', stage: 'intake' }),
  healthEntry({ itemId: 'fresh-2', stage: 'intake' }),
  healthEntry({ itemId: 'aging-1', stage: 'intake', bucket: 'amber' }),
  healthEntry({ itemId: 'critical-1', stage: 'intake', bucket: 'red' }),
  healthEntry({ itemId: 'critical-2', stage: 'intake', bucket: 'red' }),
  healthEntry({ itemId: 'critical-3', stage: 'intake', bucket: 'red' }),
];

describe('QueueHealthChart', () => {
  it('summarizes unique tasks by age and reveals range and counts on hover', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 2, amber: 1, orange: 0, red: 3 }, total: 6 },
      }),
      INTAKE_ENTRIES,
    );
    renderWithProviders(<Harness health={health} />);

    const fresh = screen.getByRole('button', { name: 'Fresh: 2 tasks, under 4h, 0 active' });
    expect(screen.getByRole('button', { name: 'Aging: 1 task, 4h–1d, 0 active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Critical: 3 tasks, 3d or more, 0 active' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stale/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-health-legend')).not.toBeInTheDocument();

    await user.hover(fresh);
    const range = await screen.findByText('Under 4h');
    const hoverCard = range.parentElement;
    expect(hoverCard).not.toBeNull();
    expect(within(hoverCard!).getByText('Tasks')).toBeInTheDocument();
    expect(within(hoverCard!).getByText('2')).toBeInTheDocument();
  });

  it('sizes aggregate segments proportionally to unique task counts', () => {
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 2, amber: 0, orange: 0, red: 3 }, total: 5 },
      }),
      INTAKE_ENTRIES.filter(entry => entry.bucket === 'green' || entry.bucket === 'red'),
    );
    renderWithProviders(<Harness health={health} />);

    expect(screen.getByRole('button', { name: 'Fresh: 2 tasks, under 4h, 0 active' })).toHaveStyle({ flexGrow: '2' });
    expect(screen.getByRole('button', { name: 'Critical: 3 tasks, 3d or more, 0 active' })).toHaveStyle({
      flexGrow: '3',
    });
  });

  it('renders a clean empty distribution while retaining stage totals', () => {
    renderWithProviders(<Harness health={makeHealth(defaultStages())} />);

    expect(screen.getByText('No work in queue')).toBeInTheDocument();
    for (const label of ['Intake', 'Triage', 'Planning', 'Building', 'Review']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('0 tasks')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Fresh|Aging|Stale|Critical/ })).not.toBeInTheDocument();
  });

  it('reveals active work in the corresponding age segment', async () => {
    const user = userEvent.setup();
    const entries = [
      healthEntry({ itemId: 'item-1', active: true }),
      healthEntry({ itemId: 'item-2', active: true }),
      healthEntry({ itemId: 'item-3' }),
      healthEntry({ itemId: 'item-4' }),
    ];
    const health = makeHealth(
      defaultStages({
        execute: { buckets: { green: 4, amber: 0, orange: 0, red: 0 }, total: 4, activeCount: 2 },
      }),
      entries,
    );
    renderWithProviders(<Harness health={health} />);

    await user.hover(screen.getByRole('button', { name: 'Fresh: 4 tasks, under 4h, 2 active' }));
    const range = await screen.findByText('Under 4h');
    const hoverCard = range.parentElement;
    expect(hoverCard).not.toBeNull();
    expect(within(hoverCard!).getByText('Active')).toBeInTheDocument();
    expect(within(hoverCard!).getByText('2')).toBeInTheDocument();
  });

  it('selects an age cohort and clears it when selected again', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        review: { buckets: { green: 0, amber: 3, orange: 0, red: 0 }, total: 3 },
      }),
      [
        healthEntry({ itemId: 'item-1', stage: 'review', bucket: 'amber' }),
        healthEntry({ itemId: 'item-2', stage: 'review', bucket: 'amber' }),
        healthEntry({ itemId: 'item-3', stage: 'review', bucket: 'amber' }),
      ],
    );
    renderWithProviders(<Harness health={health} />);

    const segment = screen.getByRole('button', { name: 'Aging: 3 tasks, 4h–1d, 0 active' });
    await user.click(segment);
    expect(screen.getByTestId('selection')).toHaveTextContent('amber');
    expect(segment).toHaveAttribute('aria-pressed', 'true');

    await user.click(segment);
    expect(screen.getByTestId('selection')).toHaveTextContent('cleared');
  });

  it('reveals each stage age breakdown on hover', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        execute: { buckets: { green: 2, amber: 0, orange: 0, red: 1 }, total: 3, activeCount: 1 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    await user.hover(
      screen.getByRole('group', { name: 'Building: 3 tasks. Oldest work: Critical, 3d or more' }),
    );
    const active = await screen.findByText('Active');
    const hoverCard = active.closest('dl');
    expect(hoverCard).not.toBeNull();
    expect(within(hoverCard!).getByText('Fresh')).toBeInTheDocument();
    expect(within(hoverCard!).getByText('Critical')).toBeInTheDocument();
  });

  it('opens aggregate details from keyboard focus', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        execute: { buckets: { green: 2, amber: 0, orange: 0, red: 0 }, total: 2 },
      }),
      [healthEntry({ itemId: 'item-1' }), healthEntry({ itemId: 'item-2' })],
    );
    renderWithProviders(<Harness health={health} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Fresh: 2 tasks, under 4h, 0 active' })).toHaveFocus();
    expect(await screen.findByText('Under 4h')).toBeInTheDocument();
  });
});
