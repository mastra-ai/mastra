// `.msw` suffix routes this file to the component harness — the default vitest config only collects `.test.ts`
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../e2e/ui/render';
import { attentionRows } from '../attention';
import { AttentionList } from '../components/AttentionList';
import type { AgeBucket, QueueHealth, QueueHealthEntry } from '../queue-health';

function entry(title: string, overrides: Partial<QueueHealthEntry> = {}): QueueHealthEntry {
  return {
    itemId: title,
    title,
    url: null,
    stage: 'execute',
    ageSeconds: 90_000,
    bucket: 'orange' as AgeBucket,
    active: false,
    sentBack: false,
    ...overrides,
  };
}

function health(entries: QueueHealthEntry[]): QueueHealth {
  return { stages: [], entries, waiting: 0, inFlight: entries.length };
}

describe('AttentionList', () => {
  it('puts the cards a person has to unblock above the ones an agent is still on', () => {
    renderWithProviders(
      <AttentionList
        rows={attentionRows(
          health([
            entry('Agent grinding', { active: true }),
            entry('Nobody took it'),
            entry('Reviewer owes an answer', { stage: 'review' }),
            entry('Rejected in review', { sentBack: true }),
          ]),
        )}
      />,
    );

    expect(screen.getAllByRole('listitem').map(row => row.textContent)).toEqual([
      expect.stringMatching(/^Rejected in review.*Came back for another pass/),
      expect.stringMatching(/^Reviewer owes an answer.*Waiting on a reviewer/),
      expect.stringMatching(/^Nobody took it.*Nobody picked it up/),
      expect.stringMatching(/^Agent grinding.*Run still going/),
    ]);
  });

  it('leaves out cards still inside their first age threshold — waiting is only news once it lasts', () => {
    renderWithProviders(
      <AttentionList rows={attentionRows(health([entry('Just landed', { bucket: 'green', ageSeconds: 60 })]))} />,
    );

    expect(screen.queryByText('Just landed')).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting on a person/)).toBeInTheDocument();
  });
});
