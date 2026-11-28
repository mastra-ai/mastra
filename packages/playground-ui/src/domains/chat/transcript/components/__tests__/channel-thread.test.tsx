// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChannelThreadStart } from '../ChannelThreadStart';
import { TranscriptSlotsProvider } from '../slots';
import { ToolFactory } from '../ToolFactory';

afterEach(cleanup);

const reply = (posted: boolean) => (
  <ToolFactory
    toolName="reply_in_thread"
    toolCallId="call-1"
    input={{ text: 'Lee, the pilot results are in.' }}
    output={{ posted }}
    status="done"
    fallback={() => null}
  />
);

describe('ChannelThreadStart', () => {
  it('says where the thread started and who started it', () => {
    render(<ChannelThreadStart platform="slack" channelName="sales" authorName="Charlie" />);

    expect(screen.getByRole('note').textContent).toBe('Started in sales by Charlie');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links the channel name to the channel', () => {
    render(
      <ChannelThreadStart
        platform="slack"
        channelName="sales"
        channelUrl="https://acme.slack.com/archives/C123"
        authorName="Charlie"
      />,
    );

    const link = screen.getByRole('link', { name: 'sales' });
    expect(link.getAttribute('href')).toBe('https://acme.slack.com/archives/C123');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('names the platform when the channel is unknown', () => {
    render(<ChannelThreadStart platform="slack" />);

    expect(screen.getByRole('note').textContent).toBe('Started in Slack');
  });
});

describe('a Slack reply that failed to post', () => {
  it('draws the host’s recovery actions under it', () => {
    render(
      <TranscriptSlotsProvider
        slots={{ ChannelReplyError: ({ text }) => <button type="button">Try again: {text}</button> }}
      >
        {reply(false)}
      </TranscriptSlotsProvider>,
    );

    expect(screen.getByText('Error sending to Slack')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again: Lee, the pilot results are in.' })).toBeTruthy();
  });

  it('shows no recovery actions once the reply posted', () => {
    render(
      <TranscriptSlotsProvider slots={{ ChannelReplyError: () => <button type="button">Try again</button> }}>
        {reply(true)}
      </TranscriptSlotsProvider>,
    );

    expect(screen.getByText('Sent to Slack')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
