/**
 * BDD coverage for the channel-origin indicator on transcript user messages.
 *
 * `agent-channels` stamps inbound messages with
 * `content.providerMetadata.mastra.channels.<platform>`; the transcript reads
 * that provenance to show "via Slack · author" under the bubble.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MessageEntry } from '../../services/transcript';
import { channelOrigin, ChannelOriginBadge } from '../Transcript';

function userEntry(providerMetadata?: Record<string, unknown>): MessageEntry {
  return {
    kind: 'message',
    id: 'm1',
    message: {
      id: 'm1',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Hi' }],
        ...(providerMetadata ? { providerMetadata } : {}),
      },
    } as MessageEntry['message'],
  };
}

describe('channelOrigin', () => {
  it('given a Slack-stamped message, when parsed, then it yields the platform and author name', () => {
    const entry = userEntry({
      mastra: {
        channels: {
          slack: { messageId: '1784830644.821249', author: { userId: 'U095PUH0FKL', fullName: 'Caleb Barnes' } },
        },
      },
    });

    expect(channelOrigin(entry)).toEqual({ platform: 'slack', authorName: 'Caleb Barnes' });
  });

  it('given a message without channel provenance, when parsed, then there is no origin', () => {
    expect(channelOrigin(userEntry())).toBeUndefined();
    expect(channelOrigin(userEntry({ anthropic: { cache: true } }))).toBeUndefined();
  });

  it('falls back to userName when no fullName is stamped', () => {
    const entry = userEntry({
      mastra: { channels: { slack: { author: { userId: 'U1', userName: 'caleb' } } } },
    });

    expect(channelOrigin(entry)).toEqual({ platform: 'slack', authorName: 'caleb' });
  });
});

describe('ChannelOriginBadge', () => {
  it('renders the Slack label with the author', () => {
    render(<ChannelOriginBadge origin={{ platform: 'slack', authorName: 'Caleb Barnes' }} />);

    expect(screen.getByLabelText('Sent from Slack')).toHaveTextContent('via Slack · Caleb Barnes');
  });

  it('renders an unknown platform by its raw name without an icon', () => {
    render(<ChannelOriginBadge origin={{ platform: 'discord' }} />);

    expect(screen.getByLabelText('Sent from discord')).toHaveTextContent('via discord');
  });
});
