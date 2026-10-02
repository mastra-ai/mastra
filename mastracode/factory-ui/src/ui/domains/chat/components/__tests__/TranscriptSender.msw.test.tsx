import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

type MastraOptions = NonNullable<MastraDBMessage['content']['providerMetadata']>[string];

const ADA = { id: 'user_ada', name: 'Ada', avatarUrl: 'https://avatars.example/ada.png' };

function userMessage(id: string, text: string, mastra?: MastraOptions): TimelineEntry {
  const message: MastraDBMessage = {
    id,
    role: 'user',
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text }], ...(mastra ? { providerMetadata: { mastra } } : {}) },
  };
  return { kind: 'message', id, message };
}

function renderAs(viewerId: string | undefined, entries: TimelineEntry[]) {
  return renderWithProviders(
    <TranscriptEntries entries={entries} viewerId={viewerId} onApprove={() => {}} onRespond={() => {}} />,
  );
}

describe('message sender', () => {
  it("puts a teammate's avatar beside their message", () => {
    renderAs('user_me', [userMessage('m1', 'ship it', { author: ADA })]);

    expect(screen.getByLabelText('Sent by Ada')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveAttribute('src', ADA.avatarUrl);
  });

  it("shows nothing beside the viewer's own message", () => {
    renderAs('user_ada', [userMessage('m1', 'ship it', { author: ADA })]);

    expect(screen.queryByLabelText(/^Sent by/)).toBeNull();
  });

  it('shows nothing when messages carry no sender', () => {
    renderAs(undefined, [userMessage('m1', 'ship it')]);

    expect(screen.queryByLabelText(/^Sent by/)).toBeNull();
  });

  it("gives a Slack message its sender's initial and the channel badge", () => {
    renderAs('user_me', [
      userMessage('m1', 'ship it', { channels: { slack: { author: { userId: 'U1', fullName: 'Caleb Barnes' } } } }),
    ]);

    expect(screen.getByLabelText('Sent by Caleb Barnes')).toHaveTextContent('C');
    expect(screen.getByLabelText('Sent from Slack')).toHaveTextContent('via Slack · Caleb Barnes');
  });
});
