import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { MessageEntry } from '../../services/transcript';
import { ChannelThreadContext, channelMessageView } from '../ChannelMessage';

const ORIGIN = {
  platform: 'slack',
  authorName: 'Ada Lovelace',
  bot: { userId: 'U0BMHEJ7RLY', userName: 'Mastra Code' },
};

const SLACK_TEXT = [
  '[Thread context — messages in this thread before you joined]',
  '[Ada Lovelace (<@U0B9NEZ90KH>)] (msg:1787155628.734549): once the merges land, remove this',
  '',
  '@U0BMHEJ7RLY your turn, buddy',
].join('\n');

function textParts(text: string): MessageEntry['message']['content']['parts'] {
  return [{ type: 'text', text }];
}

describe('channelMessageView', () => {
  it('given a Slack message carrying thread history, when viewed, then the bubble keeps only what was said', () => {
    const view = channelMessageView(textParts(SLACK_TEXT), ORIGIN);

    expect(view?.parts).toEqual([{ type: 'text', text: '@Mastra Code your turn, buddy' }]);
    expect(view?.context).toHaveLength(1);
  });

  it('drops the text part entirely when the message was nothing but thread history', () => {
    const view = channelMessageView(textParts(SLACK_TEXT.split('\n').slice(0, 2).join('\n')), ORIGIN);

    expect(view?.parts).toEqual([]);
  });
});

describe('ChannelThreadContext', () => {
  it('given thread history, when collapsed, then it is summarized and no platform ids show', async () => {
    const view = channelMessageView(textParts(SLACK_TEXT), ORIGIN);
    render(<ChannelThreadContext platform="slack" messages={view!.context} />);

    expect(screen.getByText('1 earlier message')).toBeInTheDocument();
    expect(screen.queryByText(/U0B9NEZ90KH|msg:/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('once the merges land, remove this')).toBeInTheDocument();
  });
});
