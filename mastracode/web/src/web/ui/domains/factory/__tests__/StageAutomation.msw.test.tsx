/**
 * Component coverage for the Metrics page's automation-coverage section.
 *
 * Drives the real component through the shared provider stack; no network is
 * involved (it is fed a `FactoryMetrics` aggregate directly). Specs cover the
 * empty state, per-stage rates, hover details, and the select-a-stage
 * drill-down into the automated passes' items.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/web-ui/render';
import { StageAutomation } from '../components/StageAutomation';
import type { FactoryMetrics } from '../services/metrics';

type StageAutomationRow = FactoryMetrics['stageAutomation'][number];

function automationRow(overrides: Partial<StageAutomationRow> & { stage: string }): StageAutomationRow {
  return {
    exits: 0,
    automated: 0,
    outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 },
    automatedItems: [],
    ...overrides,
  };
}

/** Metrics stub — only `stageAutomation` is read by the component. */
function makeMetrics(stageAutomation: StageAutomationRow[]): FactoryMetrics {
  return {
    windowDays: 30,
    earliestItemAt: null,
    throughput: [],
    cycleTime: { medianMs: null, p90Ms: null, samples: 0 },
    stageDurations: [],
    wip: [],
    wipTotal: 0,
    agingWip: [],
    sourceMix: [],
    transitions: { human: 0, total: 0 },
    stageAutomation,
  };
}

describe('StageAutomation', () => {
  it('renders the empty state when no stage had a completed pass', () => {
    renderWithProviders(<StageAutomation metrics={makeMetrics([])} />);

    expect(screen.getByText('No completed stage passes in this window yet.')).toBeInTheDocument();
  });

  it('shows per-stage automation rates and reveals pass counts on hover', async () => {
    const user = userEvent.setup();
    const metrics = makeMetrics([
      automationRow({
        stage: 'triage',
        exits: 4,
        automated: 3,
        outcomes: { done: 2, canceled: 0, reworked: 1, inFlight: 0 },
        automatedItems: [
          { id: 'item-1', title: 'Fix login', url: null, outcome: 'done' },
          { id: 'item-2', title: 'Update docs', url: null, outcome: 'done' },
          { id: 'item-3', title: 'Refactor auth', url: null, outcome: 'reworked' },
        ],
      }),
    ]);
    renderWithProviders(<StageAutomation metrics={metrics} />);

    const bar = screen.getByRole('button', { name: 'Triage: 3 of 4 completed passes automated' });
    expect(screen.getByText('75%')).toBeInTheDocument();
    // Stages with no data render with an em-dash and stay unselectable.
    expect(screen.getByRole('button', { name: 'Planning: no completed passes' })).not.toHaveAttribute('aria-pressed');

    await user.hover(bar);
    const passes = await screen.findByText('Completed passes');
    const hoverCard = passes.closest('dl');
    expect(hoverCard).not.toBeNull();
    expect(within(hoverCard!).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2 done, 1 reworked — select to inspect')).toBeInTheDocument();
  });

  it('selects a stage to list its automated items, failures first, and clears on reselect', async () => {
    const user = userEvent.setup();
    const metrics = makeMetrics([
      automationRow({
        stage: 'triage',
        exits: 3,
        automated: 3,
        outcomes: { done: 1, canceled: 0, reworked: 1, inFlight: 1 },
        automatedItems: [
          { id: 'item-1', title: 'Fix login', url: 'https://github.com/acme/app/issues/1', outcome: 'done' },
          { id: 'item-2', title: 'Update docs', url: null, outcome: 'inFlight' },
          { id: 'item-3', title: 'Refactor auth', url: null, outcome: 'reworked' },
        ],
      }),
    ]);
    renderWithProviders(<StageAutomation metrics={metrics} />);

    const bar = screen.getByRole('button', { name: 'Triage: 3 of 3 completed passes automated' });
    await user.click(bar);
    expect(bar).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByText('Automated through triage — 3 items')).toBeInTheDocument();
    const rows = screen
      .getAllByRole('listitem')
      .filter(row => within(row).queryByText(/Fix login|Update docs|Refactor auth/));
    expect(rows.map(row => within(row).getByText(/Fix login|Update docs|Refactor auth/).textContent)).toEqual([
      'Refactor auth',
      'Update docs',
      'Fix login',
    ]);
    expect(screen.getByText('Reworked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix login' })).toHaveAttribute(
      'href',
      'https://github.com/acme/app/issues/1',
    );

    await user.click(bar);
    expect(bar).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Automated through triage — 3 items')).not.toBeInTheDocument();
  });

  it('does not toggle a drill-down for stages without automated passes', async () => {
    const user = userEvent.setup();
    const metrics = makeMetrics([automationRow({ stage: 'triage', exits: 2, automated: 0 })]);
    renderWithProviders(<StageAutomation metrics={metrics} />);

    const bar = screen.getByRole('button', { name: 'Triage: 0 of 2 completed passes automated' });
    await user.click(bar);

    expect(bar).not.toHaveAttribute('aria-pressed');
    expect(screen.queryByText(/Automated through/)).not.toBeInTheDocument();
  });
});
