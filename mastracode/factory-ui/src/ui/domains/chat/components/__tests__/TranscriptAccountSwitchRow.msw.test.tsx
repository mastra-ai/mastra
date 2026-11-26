import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { TranscriptEntries } from '../Transcript';

const replyWith = (data: unknown): MastraDBMessage => ({
  id: 'reply-1',
  role: 'assistant',
  createdAt: new Date('2026-11-26T10:00:00.000Z'),
  content: {
    format: 2,
    parts: [
      { type: 'data-mastracode-account-switch', data },
      { type: 'text', text: 'Answered on the other subscription' },
    ],
  },
});

const renderReply = (reply: MastraDBMessage) =>
  renderWithProviders(
    <TranscriptEntries
      entries={[{ kind: 'message', id: reply.id, message: reply }]}
      onApprove={() => {}}
      onRespond={() => {}}
    />,
  );

describe('a reply that switched to another subscription of the same provider', () => {
  it('names both subscriptions and why it switched', () => {
    renderReply(
      replyWith({
        provider: 'anthropic',
        from: { id: 'acc-work', label: 'work@example.com' },
        to: { id: 'acc-home', label: 'home@example.com' },
        reason: 'rate-limit',
        at: '2026-11-26T10:00:00.000Z',
      }),
    );

    expect(
      screen.getByRole('group', {
        name: 'Switched Anthropic account: work@example.com → home@example.com (rate limit)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Answered on the other subscription')).toBeVisible();
  });

  it('says every subscription was spent when none was left', () => {
    renderReply(
      replyWith({
        provider: 'anthropic',
        from: { id: 'acc-home', label: 'home@example.com' },
        to: null,
        reason: 'rate-limit',
        at: '2026-11-26T10:00:00.000Z',
      }),
    );

    expect(screen.getByRole('group', { name: 'All Anthropic accounts unavailable (rate limit)' })).toBeInTheDocument();
  });
});
