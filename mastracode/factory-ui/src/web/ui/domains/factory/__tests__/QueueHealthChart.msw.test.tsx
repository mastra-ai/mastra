/**
 * Component coverage for the Factory queue-health chart.
 *
 * Drives the real component through the shared provider stack; no network is
 * involved (the chart is fed a `QueueHealth` aggregate directly), so these
 * specs focus on proportional rendering, empty/active states, selection, and
 * reduced-motion. The `.msw` suffix routes this file into the component-test
 * harness (the default vitest config only collects `.test.ts`).
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/web-ui/render';
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
      <output data-testid="selection">{selected ? `${selected.stage}:${selected.bucket ?? 'none'}` : 'cleared'}</output>
    </div>
  );
}

describe('QueueHealthChart', () => {
  it('renders one bar per non-done stage with segment labels carrying bucket + count', () => {
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
    // Legend pairs every bucket label with its threshold window.
    const legend = screen.getByTestId('queue-health-legend');
    expect(within(legend).getByText(/Fresh/)).toBeInTheDocument();
    expect(within(legend).getByText(/\(< 4h\)/)).toBeInTheDocument();
    expect(within(legend).getByText(/Critical/)).toBeInTheDocument();
    expect(within(legend).getByText(/\(≥ 3d\)/)).toBeInTheDocument();
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

  it('renders an empty-state bar for a stage with zero items and no NaN widths', () => {
    const health = makeHealth(defaultStages()); // all zero
    renderWithProviders(<Harness health={health} />);

    for (const label of ['Intake', 'Triage', 'Planning', 'Building', 'Review']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Empty stages show the "0" empty-state, never a NaN-proportioned segment.
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole('button', { name: /Fresh|Aging|Stale|Critical/ })).not.toBeInTheDocument();
  });

  it('shows the active-stripe overlay only when the stage has active work', () => {
    const health = makeHealth(
      defaultStages({
        intake: { buckets: { green: 2, amber: 0, orange: 0, red: 0 }, total: 2, activeCount: 0 },
        execute: { buckets: { green: 4, amber: 0, orange: 0, red: 0 }, total: 4, activeCount: 2 },
      }),
    );
    renderWithProviders(<Harness health={health} />);

    expect(screen.getByRole('img', { name: 'Building: 2 active' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Intake: .* active/ })).not.toBeInTheDocument();
    // The summary text carries the active count too (not pattern-alone).
    expect(screen.getByText(/2 active/)).toBeInTheDocument();
  });

  it('selects a cohort on click and clears it on clicking the selected segment again', async () => {
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

  it('clears the selection when the bar background is clicked', async () => {
    const user = userEvent.setup();
    const health = makeHealth(
      defaultStages({
        triage: { buckets: { green: 1, amber: 0, orange: 0, red: 0 }, total: 1 },
      }),
    );
    const { container } = renderWithProviders(<Harness health={health} />);

    await user.click(screen.getByRole('button', { name: 'Triage Fresh: 1' }));
    expect(screen.getByTestId('selection')).toHaveTextContent('triage:green');

    // The bar background is the segment's parent container.
    const background = screen.getByRole('button', { name: 'Triage Fresh: 1' }).parentElement!;
    await user.click(background);
    expect(screen.getByTestId('selection')).toHaveTextContent('cleared');
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it('omits the stripe animation class under prefers-reduced-motion', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    try {
      const health = makeHealth(
        defaultStages({
          execute: { buckets: { green: 2, amber: 0, orange: 0, red: 0 }, total: 2, activeCount: 1 },
        }),
      );
      renderWithProviders(<Harness health={health} />);
      const overlay = screen.getByRole('img', { name: 'Building: 1 active' });
      // With `prefers-reduced-motion` matched, the animation class is omitted.
      expect(overlay.className).not.toContain('animate-queue-health-stripes');
    } finally {
      matchMediaSpy.mockRestore();
    }
  });
});
