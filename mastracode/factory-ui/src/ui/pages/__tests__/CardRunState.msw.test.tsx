import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../e2e/ui/render';
import { queryKeys } from '../../../api/keys';
import type { CardRunState } from '../../../api/types';
import { CARD_ID, renderAt, stubCard, stubPageWidth } from './fixtures/cardDraft';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function stubRunState(runState: CardRunState | undefined) {
  const reads = { count: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${CARD_ID}/run-state`, () => {
      reads.count += 1;
      return HttpResponse.json(runState ? { runState } : {});
    }),
  );
  return reads;
}

async function openCard() {
  stubPageWidth(1200);
  stubDraftRoute();
  stubCard();
  const { client } = renderAt(`/factories/${FACTORY_ID}/cards/${CARD_ID}/new/${DRAFT_SESSION_ID}`);
  const panel = await screen.findByRole('complementary', { name: 'Session panel' });
  await within(panel).findByRole('region', { name: 'Card' });
  return { panel, client };
}

describe("a card's board run state in its details", () => {
  it.each<[CardRunState, [label: string, phase: string], string, string[]]>([
    [
      { state: 'resting', phase: 'intake', probes: 0 },
      ['Resting', 'Intake'],
      'Waits for a person or a rule to move it on.',
      [],
    ],
    [
      { state: 'awaiting_start', phase: 'triage', probes: 0 },
      ['Waiting to start', 'Triage'],
      'Waits for someone to start its phase.',
      [],
    ],
    [
      { state: 'running', phase: 'execute', probes: 0, attempts: 2, deadlineAt: Date.now() + 60_000 },
      ['Running', 'Building'],
      "An agent is working the card's phase.",
      ['2 failed attempts at this phase'],
    ],
    [
      { state: 'probing', phase: 'execute', probes: 1, deadlineAt: Date.now() + 60_000 },
      ['Checking in', 'Building'],
      "The agent's run ended without reporting how the phase ended, so it runs once more to say.",
      ['1 run ended without an outcome'],
    ],
    [
      { state: 'awaiting_approval', phase: 'triage', probes: 0 },
      ['Waiting for approval', 'Triage'],
      "Waits for a person to answer the agent's request.",
      [],
    ],
    [
      {
        state: 'needs_attention',
        phase: 'execute',
        probes: 0,
        attempts: 5,
        failure: 'run_failed',
        reason: 'Agent run ended in error',
      },
      ['Needs attention', 'Building'],
      'Agent run ended in error',
      ['5 failed attempts at this phase'],
    ],
    [
      { state: 'terminal', phase: 'done', probes: 0, lastOutcome: 'done' },
      ['Finished', 'Done'],
      'Nothing more runs on the card.',
      ['Last outcome: done'],
    ],
  ])('shows a %j card as %j', async (runState, [label, phase], detail, facts) => {
    stubRunState(runState);
    const { panel } = await openCard();

    const automation = await within(panel).findByRole('region', { name: 'Automation' });
    expect(within(automation).getByText(label)).toBeInTheDocument();
    expect(within(automation).getByText(phase)).toBeInTheDocument();
    expect(within(automation).getByText(detail)).toBeInTheDocument();
    for (const fact of facts) expect(within(automation).getByText(fact)).toBeInTheDocument();
  });

  it('shows no automation for a card its board engine recorded nothing about', async () => {
    const reads = stubRunState(undefined);
    const { panel, client } = await openCard();
    await waitFor(() => expect(reads.count).toBeGreaterThan(0));
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.workItemRunState(FACTORY_ID, CARD_ID))?.status).toBe('success'),
    );

    expect(within(panel).queryByRole('region', { name: 'Automation' })).not.toBeInTheDocument();
  });
});
