/**
 * Component coverage for the Factory queue-health chart.
 *
 * Drives the real component through the shared provider stack; no network is
 * involved (the chart is fed a `QueueHealth` aggregate directly), so these
 * specs focus on proportional rendering, empty/active states, selection, and
 * cross-highlighting. The `.msw` suffix routes this file into the
 * component-test harness (the default vitest config only collects `.test.ts`).
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../e2e/ui/render';
import type { QueueHealth, QueueHealthStage } from '../queue-health';
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

function makeHealth(stages: QueueHealthStage[]): QueueHealth {
  return { stages, entries: [] };
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
      <output data-testid="selection">{selected ? `${selected.stage ?? 'all'}:${selected.bucket}` : 'cleared'}</output>
    </div>
  );
}

describe('QueueHealthChart', () => {
  it('renders one bar per stage with segment labels carrying bucket + count', () => {
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 2, amber: 1, orange: 0, red: 3 }, total: 6 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    // One labeled segment per non-zero bucket, not color-alone.
    expect(screen.getByRole('button', { name: 'Intake Fresh: 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intake Aging: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intake Critical: 3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Intake Stale/ })).not.toBeInTheDocument();
  });

  it('totals every stage into the headline bar', () => {
    const health = makeHealth(
      defaultStages({
        triage: { buckets: { green: 2, amber: 0, orange: 0, red: 0 }, total: 2 },
        execute: { buckets: { green: 3, amber: 1, orange: 0, red: 0 }, total: 4 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    expect(screen.getByRole('button', { name: 'Fresh: 5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aging: 1' })).toBeInTheDocument();
  });

  it('pairs every legend bucket with its threshold window, count and share', () => {
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 3, amber: 0, orange: 0, red: 1 }, total: 4 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    const legend = screen.getByTestId('queue-health-legend');
    expect(within(legend).getByText('Fresh (< 4h)')).toBeInTheDocument();
    expect(within(legend).getByText('Critical (≥ 3d)')).toBeInTheDocument();
    expect(within(legend).getByText('75%')).toBeInTheDocument();
    expect(within(legend).getByText('25%')).toBeInTheDocument();
    // Empty buckets stay listed (thresholds are part of the reading) but are not selectable.
    expect(within(legend).getByRole('button', { name: /Stale/ })).toBeDisabled();
  });

  it('sizes segments proportionally to their counts via flex-grow', () => {
    const health = makeHealth(
      defaultStages({
        execute: { buckets: { green: 1, amber: 0, orange: 0, red: 4 }, total: 5 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    const green = screen.getByRole('button', { name: 'Building Fresh: 1' });
    const red = screen.getByRole('button', { name: 'Building Critical: 4' });
    expect(green).toHaveStyle({ flexGrow: '1' });
    expect(red).toHaveStyle({ flexGrow: '4' });
  });

  it('shows an empty state when nothing is in flight', () => {
    renderWithProviders(<Harness health={makeHealth(defaultStages())} />);

    expect(screen.getByText(/Nothing in flight/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fresh|Aging|Stale|Critical/ })).not.toBeInTheDocument();
  });

  it('keeps a row for stages with zero items once the queue is non-empty', () => {
    const health = makeHealth(
      defaultStages({
        review: { buckets: { green: 1, amber: 0, orange: 0, red: 0 }, total: 1 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    for (const label of ['Intake', 'Triage', 'Planning', 'Building', 'Review']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
  });

  it('marks only stages with active work, and never animates under reduced motion', () => {
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 2, amber: 0, orange: 0, red: 0 }, total: 2, activeCount: 0 },
        execute: { buckets: { green: 4, amber: 0, orange: 0, red: 0 }, total: 4, activeCount: 2 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    const pulse = screen.getByRole('img', { name: 'Building: 2 active' });
    expect(pulse).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Intake: .* active/ })).not.toBeInTheDocument();
    // The pulse animation is opt-in via `motion-safe`, so reduced motion drops it.
    expect(pulse.querySelector('.motion-safe\\:animate-ping')).not.toBeNull();
  });

  it('selects a stage cohort on click and clears it on clicking the same segment again', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        review: { buckets: { green: 0, amber: 3, orange: 0, red: 0 }, total: 3 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    const segment = screen.getByRole('button', { name: 'Review Aging: 3' });
    await user.click(segment);
    expect(screen.getByTestId('selection')).toHaveTextContent('review:amber');
    expect(segment).toHaveAttribute('aria-pressed', 'true');

    await user.click(segment);
    expect(screen.getByTestId('selection')).toHaveTextContent('cleared');
  });

  it('selects a bucket across every stage from the legend', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        triage: { buckets: { green: 1, amber: 0, orange: 0, red: 2 }, total: 3 },
        execute: { buckets: { green: 0, amber: 0, orange: 0, red: 1 }, total: 1 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    const legend = screen.getByTestId('queue-health-legend');
    await user.click(within(legend).getByRole('button', { name: /Critical/ }));
    expect(screen.getByTestId('selection')).toHaveTextContent('all:red');
  });

  it('clears the selection on Escape', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        triage: { buckets: { green: 1, amber: 0, orange: 0, red: 0 }, total: 1 },
      }),
    );
    const { container } = renderWithProviders(<Harness health={health} />);

    await user.click(screen.getByRole('button', { name: 'Triage Fresh: 1' }));
    expect(screen.getByTestId('selection')).toHaveTextContent('triage:green');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('selection')).toHaveTextContent('cleared');
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it('dims the other cohorts while one is hovered', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        triage: { buckets: { green: 2, amber: 0, orange: 0, red: 1 }, total: 3 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    await user.hover(screen.getByRole('button', { name: 'Fresh: 2' }));
    expect(screen.getByRole('button', { name: 'Triage Fresh: 2' }).className).toContain('opacity-100');
    expect(screen.getByRole('button', { name: 'Triage Critical: 1' }).className).toContain('opacity-25');
  });
});
