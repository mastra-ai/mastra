// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalBadge } from '../messages/signal-badge';
import { KnowledgeLinksProvider } from './knowledge-links';
import { pinnedKnowledgeFromSignal } from './pinned-knowledge-data';

afterEach(() => cleanup());

const Anchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
  <a ref={ref} {...props} />
));

const withLinks = (node: ReactNode, pageHref = (id: string) => `/knowledge?page=${id}&view=page`) => (
  <KnowledgeLinksProvider pageHref={pageHref} Link={Anchor}>
    {node}
  </KnowledgeLinksProvider>
);

/** What core's PinnedKnowledgeStateProcessor persists for a first turn. */
const snapshot = {
  type: 'state',
  tagName: 'pinned-knowledge',
  contents: [{ type: 'text', text: '\n  • {id: p-esc} Escalation Process (p-esc): Escalate refunds over $100.\n' }],
  attributes: { count: 2 },
  metadata: {
    state: { id: 'knowledge', mode: 'snapshot', cacheKey: 'k1' },
    value: {
      pins: [
        { id: 'p-esc', text: 'Escalation Process (p-esc): Escalate refunds over $100.' },
        { id: 'overflow', text: 'Also pinned (not shown): Gift Cards (p-gift)' },
      ],
    },
  },
};

const delta = {
  type: 'state',
  tagName: 'pinned-knowledge-update',
  contents: [{ type: 'text', text: '  + added {id: p-refund} …' }],
  metadata: {
    state: { id: 'knowledge', mode: 'delta', cacheKey: 'k2' },
    delta: {
      ops: [
        {
          op: 'add',
          pin: {
            id: 'p-refund',
            text: 'Refund Policy (p-refund): 30 days.',
            name: 'Refund Policy',
            scope: 'policy:acme',
          },
        },
        { op: 'change', pin: { id: 'p-esc', text: 'Escalation Process (p-esc): Escalate refunds over $500.' } },
        { op: 'remove', id: 'p-old' },
        { op: 'remove', id: 'p-price', name: 'Pricing Exceptions' },
      ],
    },
  },
};

describe('pinnedKnowledgeFromSignal', () => {
  it('reads a snapshot, taking page names off the delivered text and keeping the overflow line apart', () => {
    expect(pinnedKnowledgeFromSignal(snapshot)).toEqual({
      mode: 'snapshot',
      rows: [
        { id: 'p-esc', name: 'Escalation Process', text: 'Escalation Process (p-esc): Escalate refunds over $100.' },
      ],
      overflow: 'Also pinned (not shown): Gift Cards (p-gift)',
    });
  });

  it('reads a delta in op order, preferring the name and scope the pin carries', () => {
    const rows = pinnedKnowledgeFromSignal(delta)?.rows;
    expect(rows?.map(row => [row.change, row.id, row.name, row.scope])).toEqual([
      ['add', 'p-refund', 'Refund Policy', 'policy:acme'],
      ['change', 'p-esc', 'Escalation Process', undefined],
      ['remove', 'p-old', undefined, undefined],
      ['remove', 'p-price', 'Pricing Exceptions', undefined],
    ]);
  });

  it('leaves other state signals alone', () => {
    expect(pinnedKnowledgeFromSignal({ metadata: { state: { id: 'git', mode: 'watch' } } })).toBeUndefined();
  });
});

describe('pinned Knowledge in chat', () => {
  it('lists a snapshot as pages linking to the viewer, with the delivered text on demand', () => {
    render(withLinks(<SignalBadge signal={snapshot} defaultOpen />));

    const card = screen.getByTestId('pinned-knowledge');
    expect(within(card).getByText('Pinned knowledge')).not.toBeNull();
    expect(within(card).getByText('1 page')).not.toBeNull();
    expect(within(card).getByRole('link', { name: 'Escalation Process' }).getAttribute('href')).toBe(
      '/knowledge?page=p-esc&view=page',
    );
    expect(within(card).getByText('Also pinned (not shown): Gift Cards (p-gift)')).not.toBeNull();
    expect(within(card).queryByText('Escalation Process (p-esc): Escalate refunds over $100.')).toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: 'Text' }));
    expect(within(card).getByText('Escalation Process (p-esc): Escalate refunds over $100.')).not.toBeNull();
  });

  it('shows a delta as added, changed and removed rows through the host route', () => {
    render(withLinks(<SignalBadge signal={delta} defaultOpen />, id => `/factories/fp-1/knowledge?page=${id}`));

    const card = screen.getByTestId('pinned-knowledge');
    expect(within(card).getByText('Pinned knowledge updated')).not.toBeNull();
    expect(within(card).getByText('+1 ~1 −2')).not.toBeNull();
    const [added, , bare, named] = within(card).getAllByTestId('pinned-knowledge-row') as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    const rows = within(card).getAllByTestId('pinned-knowledge-row');
    expect(rows.map(row => row.getAttribute('data-change'))).toEqual(['add', 'change', 'remove', 'remove']);
    expect(within(added).getByRole('link', { name: 'Refund Policy' }).getAttribute('href')).toBe(
      '/factories/fp-1/knowledge?page=p-refund',
    );
    expect(within(added).getByText('policy:acme')).not.toBeNull();
    expect(within(bare).getByRole('link', { name: 'A pinned page' })).not.toBeNull();
    expect(within(named).getByRole('link', { name: 'Pricing Exceptions' })).not.toBeNull();
    expect(within(named).getByLabelText('Removed')).not.toBeNull();
  });
});
