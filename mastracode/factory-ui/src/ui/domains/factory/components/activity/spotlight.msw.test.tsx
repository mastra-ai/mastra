import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ActivityEntry } from '../../activity';
import { SpotlightProvider, useBarSpotlight, useEntriesSpotlight } from './spotlight';
import type { BarsInView } from './spotlight';

const BARS_IN_VIEW: BarsInView = {
  runIds: new Set(['run-a', 'run-b', 'run-c']),
  cardIds: new Set(['card-a', 'card-b', 'card-c']),
};

function runStarted(runId: string, cardId: string): ActivityEntry {
  return {
    kind: 'deed',
    id: `started-${runId}`,
    action: 'factory.run.started',
    title: 'started a run',
    item: { id: cardId, board: 'work' },
    at: 0,
    by: 'user-1',
    detail: '',
    metadata: { kickoffId: runId },
  };
}

function Bar({ runId, cardId }: { runId: string; cardId: string }) {
  const spotlight = useBarSpotlight(runId, cardId, BARS_IN_VIEW);
  return (
    <button type="button" data-state={spotlight.state} {...spotlight.handlers}>
      {runId}
    </button>
  );
}

function Row({ name, entries }: { name: string; entries: ActivityEntry[] }) {
  const spotlight = useEntriesSpotlight(entries);
  return (
    <p data-state={spotlight.state} {...spotlight.handlers}>
      {name}
    </p>
  );
}

function Chart({ runIds, rows }: { runIds: string[]; rows: Record<string, ActivityEntry[]> }) {
  return (
    <SpotlightProvider>
      {runIds.map(runId => (
        <Bar key={runId} runId={runId} cardId={runId.replace('run', 'card')} />
      ))}
      {Object.entries(rows).map(([name, entries]) => (
        <Row key={name} name={name} entries={entries} />
      ))}
    </SpotlightProvider>
  );
}

const ALL_RUNS = ['run-a', 'run-b', 'run-c'];
const stateOf = (name: string) => screen.getByText(name).getAttribute('data-state');

describe('spotlight', () => {
  it('spotlights every run a grouped row is about and dims the other bars in view', async () => {
    const user = userEvent.setup();
    render(
      <Chart
        runIds={ALL_RUNS}
        rows={{ 'started two runs': [runStarted('run-a', 'card-a'), runStarted('run-b', 'card-b')] }}
      />,
    );

    await user.hover(screen.getByText('started two runs'));

    expect(ALL_RUNS.map(stateOf)).toEqual(['spotlit', 'spotlit', 'dimmed']);
  });

  it('leaves the chart alone while a row about runs out of view is hovered', async () => {
    const user = userEvent.setup();
    render(<Chart runIds={ALL_RUNS} rows={{ 'started an old run': [runStarted('run-old', 'card-old')] }} />);

    await user.hover(screen.getByText('started an old run'));

    expect(ALL_RUNS.map(stateOf)).toEqual(['idle', 'idle', 'idle']);
  });

  it('lights the rows of a hovered bar, and lets go once that bar leaves the chart', async () => {
    const user = userEvent.setup();
    const rows = { 'started run a': [runStarted('run-a', 'card-a')], 'started run b': [runStarted('run-b', 'card-b')] };
    const { rerender } = render(<Chart runIds={ALL_RUNS} rows={rows} />);

    await user.hover(screen.getByText('run-a'));
    expect([stateOf('started run a'), stateOf('started run b'), stateOf('run-b')]).toEqual([
      'spotlit',
      'idle',
      'dimmed',
    ]);

    rerender(<Chart runIds={['run-b', 'run-c']} rows={rows} />);
    expect([stateOf('started run a'), stateOf('run-b')]).toEqual(['idle', 'idle']);
  });
});
