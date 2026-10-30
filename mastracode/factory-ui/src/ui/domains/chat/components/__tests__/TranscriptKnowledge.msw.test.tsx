import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function inFactory(ui: ReactElement, path = '/factories/fp-1/sessions/s-1') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/factories/:factoryId/sessions/:sessionId" element={ui} />
        <Route path="/sessions/:sessionId" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

/** What core's pinned Knowledge state processor persists, on a core whose pins carry name and scope. */
function pinnedEntry(id: string, mode: 'snapshot' | 'delta', extra: Record<string, unknown>): TimelineEntry {
  const signal = {
    id,
    type: 'state',
    tagName: mode === 'snapshot' ? 'pinned-knowledge' : 'pinned-knowledge-update',
    createdAt: CREATED_AT.toISOString(),
    metadata: { state: { id: 'knowledge', mode, cacheKey: id }, ...extra },
  };
  const message: MastraDBMessage = {
    id,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text: '  • {id: p-esc} Escalation Process (p-esc): …' }],
      metadata: { signal },
    },
  };
  return { kind: 'message', id, message };
}

const escalation = {
  id: 'p-esc',
  name: 'Escalation Process',
  scope: 'org:acme',
  text: 'Escalation Process (p-esc): Escalate refunds over $100.',
};
const refunds = {
  id: 'p-refund',
  name: 'Refund Policy',
  scope: 'policy:acme',
  text: 'Refund Policy (p-refund): 30 days.',
};

const toolEntry = (toolName: string, args: Record<string, unknown>, result: unknown): TimelineEntry => ({
  kind: 'message',
  id: `m-${toolName}`,
  message: {
    id: `m-${toolName}`,
    role: 'assistant',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: `call-${toolName}`, toolName, args, result },
        },
      ],
    },
  },
});

const entries = (list: TimelineEntry[]) => (
  <TranscriptEntries entries={list} onApprove={() => {}} onRespond={() => {}} />
);

describe('Knowledge in Factory chat', () => {
  it('lists pinned Knowledge as pages that open in this Factory’s Knowledge page', async () => {
    inFactory(entries([pinnedEntry('pin-1', 'snapshot', { value: { pins: [escalation, refunds] } })]));

    const card = screen.getByRole('group', { name: 'Signal: Pinned knowledge' });
    expect(within(card).getByText('2 pages')).toBeVisible();
    await userEvent.click(within(card).getByRole('button', { name: /Pinned knowledge/ }));
    expect(within(card).getByRole('link', { name: 'Refund Policy' })).toHaveAttribute(
      'href',
      '/factories/fp-1/knowledge?page=p-refund&view=page',
    );
    expect(within(card).getByText('policy:acme')).toBeVisible();
    // The raw `{id: …}` contents no longer show.
    expect(screen.queryByText(/\{id: p-esc\}/)).not.toBeInTheDocument();
  });

  it('shows a pin delta as added, changed and removed pages by name', async () => {
    inFactory(
      entries([
        pinnedEntry('pin-2', 'delta', {
          delta: {
            ops: [
              { op: 'add', pin: refunds },
              { op: 'change', pin: escalation },
              { op: 'remove', id: 'p-price', name: 'Pricing Exceptions', scope: 'policy:acme' },
            ],
          },
        }),
      ]),
    );

    const card = screen.getByRole('group', { name: 'Signal: Pinned knowledge updated' });
    expect(within(card).getByText('+1 ~1 −1')).toBeVisible();
    await userEvent.click(within(card).getByRole('button', { name: /Pinned knowledge updated/ }));
    const rows = within(card).getAllByTestId('pinned-knowledge-row');
    expect(rows.map(row => row.dataset.change)).toEqual(['add', 'change', 'remove']);
    expect(within(rows[2] as HTMLElement).getByRole('link', { name: 'Pricing Exceptions' })).toBeVisible();
  });

  it('names pinned pages without links in a chat outside any Factory', async () => {
    inFactory(entries([pinnedEntry('pin-3', 'snapshot', { value: { pins: [escalation] } })]), '/sessions/s-1');

    const card = screen.getByRole('group', { name: 'Signal: Pinned knowledge' });
    await userEvent.click(within(card).getByRole('button', { name: /Pinned knowledge/ }));
    expect(within(card).getByText('Escalation Process')).toBeVisible();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('draws a Knowledge read as a card whose page opens in the viewer', async () => {
    inFactory(
      entries([
        toolEntry(
          'knowledge_read',
          { page: 'p-refund' },
          {
            page: { id: 'p-refund', name: 'Refund Policy', address: 'policy:acme', body: '## Refunds\n30 days.' },
            notes: [],
          },
        ),
      ]),
    );

    const card = screen.getByRole('group', { name: 'Read page p-refund' });
    await userEvent.click(within(card).getByRole('button', { name: /Read page/ }));
    expect(within(card).getByRole('link', { name: 'Refund Policy' })).toHaveAttribute(
      'href',
      '/factories/fp-1/knowledge?page=p-refund&view=page',
    );
    expect(within(card).queryByText(/"p-refund"/)).not.toBeInTheDocument();
  });

  it('links each Knowledge search hit to its page', async () => {
    inFactory(
      entries([
        toolEntry(
          'knowledge_search',
          { query: 'refund' },
          {
            results: [
              { type: 'page', page: { id: 'p-refund', name: 'Refund Policy', address: 'policy:acme' } },
              { type: 'page', page: { id: 'p-esc', name: 'Escalation Process', address: 'org:acme' } },
            ],
          },
        ),
      ]),
    );

    const card = screen.getByRole('group', { name: 'Searched knowledge refund' });
    await userEvent.click(within(card).getByRole('button', { name: /Searched knowledge/ }));
    expect(within(card).getByRole('link', { name: 'Escalation Process' })).toHaveAttribute(
      'href',
      '/factories/fp-1/knowledge?page=p-esc&view=page',
    );
  });
});
