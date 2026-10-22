import assert from 'node:assert';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { layoutSessionTrack, trackMomentLabel, trackStartLabel } from '../../services/sessionTrack';
import { SessionTrack } from '../SessionTrack';

const HOUR = 3_600_000;
const now = Date.parse('2026-10-22T18:00:00.000Z');
const startedAt = now - 10 * HOUR;
const at = (hoursAfterStart: number) => startedAt + hoursAfterStart * HOUR;
const moment = (hoursAfterStart: number) => trackMomentLabel(at(hoursAfterStart), now);
const people = new Map([
  ['user-ada', { id: 'user-ada', name: 'Ada Lovelace' }],
  ['user-grace', { id: 'user-grace', name: 'Grace Hopper' }],
]);

function renderTrack() {
  const layout = layoutSessionTrack({
    startedAt,
    now,
    stageHistory: [
      { stage: 'triage', enteredAt: new Date(at(-1)).toISOString(), by: 'user-ada' },
      { stage: 'execute', enteredAt: new Date(at(0.1)).toISOString(), by: 'user-grace' },
    ],
    runs: [{ startedAt: at(2), endedAt: at(3) }],
    ownerChanges: [{ at: at(8), fromOwnerId: 'user-grace', toOwnerId: 'user-ada' }],
  });
  render(<SessionTrack layout={layout} startedAt={startedAt} now={now} people={people} />);
  const track = screen.getByRole('img', { name: /^Session timeline/ });
  const hitArea = (piece: string) => {
    const hit = track.querySelector<HTMLElement>(`[data-track-hit="${piece}"]`);
    assert(hit, `no hit area for ${piece}`);
    return hit;
  };
  return { user: userEvent.setup(), track, hitArea };
}

describe('Session track hover readout', () => {
  it.each([
    { piece: 'Agent run', readout: ['Agent run', '1h', moment(2), moment(3)] },
    { piece: 'Triage', readout: ['Triage', '6m', moment(0), moment(0.1)] },
    { piece: 'Building', readout: ['Building', '9h 54m', moment(0.1), 'now'] },
    { piece: 'Ada Lovelace took over', readout: ['Ada Lovelace took over', moment(8)] },
  ])('names $piece with its length and its own moments on the axis', async ({ piece, readout }) => {
    const { user, track, hitArea } = renderTrack();

    await user.hover(hitArea(piece));

    for (const text of readout) expect(within(track).getByText(text)).toBeInTheDocument();
  });

  it('marks a moment, not a span, when a person is hovered', async () => {
    const { user, track, hitArea } = renderTrack();

    await user.hover(hitArea('Grace Hopper moved it to Building'));

    expect(within(track).getByText('Grace Hopper moved it to Building')).toBeInTheDocument();
    expect(within(track).queryByText('now')).not.toBeInTheDocument();
  });

  it('goes back to the stage labels and the whole session once the pointer leaves', async () => {
    const { user, track, hitArea } = renderTrack();
    await user.hover(hitArea('Agent run'));

    await user.unhover(hitArea('Agent run'));

    expect(within(track).queryByText('Agent run')).not.toBeInTheDocument();
    expect(within(track).getByText('Building')).toBeInTheDocument();
    expect(within(track).getByText(trackStartLabel(startedAt, now))).toBeInTheDocument();
    expect(within(track).getByText('now')).toBeInTheDocument();
  });
});
