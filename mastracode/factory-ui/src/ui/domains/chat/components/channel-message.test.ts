import { describe, expect, it } from 'vitest';

import { parseChannelMessage } from './channel-message';

const BOT = new Map([['U0BMHEJ7RLY', 'Mastra Code']]);

const withContext = [
  '[Thread context — messages in this thread before you joined]',
  '[Ada Lovelace (<@U0B9NEZ90KH>)] (msg:1787155628.734549): once the merges land, remove this',
  '[Grace Hopper (<@U0BNLQLFJAY>)] (msg:1787155677.460559): waiting on <@U0B9NEZ90KH>',
  '',
  '@U0BMHEJ7RLY your turn, buddy',
].join('\n');

describe('parseChannelMessage', () => {
  it('given a message carrying thread history, when parsed, then the body is what was actually said', () => {
    const view = parseChannelMessage(withContext, BOT);

    expect(view.body).toBe('@Mastra Code your turn, buddy');
    expect(view.context).toHaveLength(2);
  });

  it('names the people the history addresses by id', () => {
    const [first, second] = parseChannelMessage(withContext, BOT).context;

    expect(first).toMatchObject({ author: 'Ada Lovelace', text: 'once the merges land, remove this' });
    expect(second).toMatchObject({ author: 'Grace Hopper', text: 'waiting on @Ada Lovelace' });
  });

  it('reads the platform message id as the time it was sent', () => {
    const [first] = parseChannelMessage(withContext, BOT).context;

    expect(first?.at?.toISOString()).toBe(new Date(1787155628 * 1000).toISOString());
  });

  it('keeps history messages that span several lines whole', () => {
    const text = [
      '[Thread context — messages in this thread before you joined]',
      '[Ada Lovelace (<@U0B9NEZ90KH>)] (msg:1787155628.734549): first line',
      '',
      'still Ada',
      '[Grace Hopper (<@U0BNLQLFJAY>)] (msg:1787155677.460559): last word',
      '',
      'so, what now?',
    ].join('\n');

    const view = parseChannelMessage(text, BOT);

    expect(view.context.map(message => message.text)).toEqual(['first line\n\nstill Ada', 'last word']);
    expect(view.body).toBe('so, what now?');
  });

  it('marks bot history and falls back to the raw id for unknown authors', () => {
    const text = [
      '[Thread context — messages in this thread before you joined]',
      '[<@U0BQQQ1ZZZ>] (msg:1787155628.734549): who am I',
      '[Deploybot (<@U0BDEPLOY1>) (bot)] (msg:1787155629.734549): shipped',
      '',
      'ok',
    ].join('\n');

    const [unknown, bot] = parseChannelMessage(text, BOT).context;

    expect(unknown).toMatchObject({ author: '@U0BQQQ1ZZZ', isBot: false });
    expect(bot).toMatchObject({ author: 'Deploybot', isBot: true });
  });

  it('given a plain channel message, when parsed, then only its mentions are named', () => {
    const view = parseChannelMessage('hey <@U0BMHEJ7RLY>, can you look?', BOT);

    expect(view).toEqual({ context: [], body: 'hey @Mastra Code, can you look?' });
  });

  it('leaves ordinary text alone', () => {
    const view = parseChannelMessage('ping @ada about the U0BMHEJ7RLY rollout', BOT);

    expect(view.body).toBe('ping @ada about the U0BMHEJ7RLY rollout');
  });
});
