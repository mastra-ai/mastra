import type { Message } from 'chat';
import { beforeAll, describe, expect, it } from 'vitest';

import { chatModule, getChatModule } from './chat-lazy';
import { layoutBlockTexts } from './slack-blocks';
import { messageText } from './thread-history';

describe('layoutBlockTexts', () => {
  it('extracts header, section and context text with links as markdown', () => {
    const raw = {
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '❌ Workflow failure' } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Lint* failed on `main`. <https://github.com/acme/web-app/actions/runs/1|View workflow run>',
          },
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Commit: `3f8b55a`' }] },
      ],
    };

    expect(layoutBlockTexts(raw)).toEqual([
      ['❌ Workflow failure'],
      ['*Lint* failed on `main`. [View workflow run](https://github.com/acme/web-app/actions/runs/1)'],
      ['Commit: `3f8b55a`'],
    ]);
  });

  it('lists section fields after the section text', () => {
    const raw = {
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Deploy finished' },
          fields: [
            { type: 'mrkdwn', text: '*Env:* prod' },
            { type: 'plain_text', text: 'Duration: 3m' },
          ],
        },
      ],
    };

    expect(layoutBlockTexts(raw)).toEqual([['Deploy finished', '*Env:* prod', 'Duration: 3m']]);
  });

  it('passes markdown blocks through unconverted', () => {
    const raw = { blocks: [{ type: 'markdown', text: '**Bold** and <https://x.y|not converted>' }] };
    expect(layoutBlockTexts(raw)).toEqual([['**Bold** and <https://x.y|not converted>']]);
  });

  it('joins context text elements and ignores images', () => {
    const raw = {
      blocks: [
        {
          type: 'context',
          elements: [
            { type: 'image', image_url: 'https://x.y/a.png', alt_text: 'avatar' },
            { type: 'plain_text', text: 'by octocat' },
            { type: 'mrkdwn', text: '2 minutes ago' },
          ],
        },
      ],
    };
    expect(layoutBlockTexts(raw)).toEqual([['by octocat 2 minutes ago']]);
  });

  it('ignores non-layout block types', () => {
    const raw = {
      blocks: [
        { type: 'divider' },
        { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Retry' } }] },
        { type: 'rich_text', elements: [] },
        { type: 'image', image_url: 'https://x.y/a.png', alt_text: 'chart' },
      ],
    };
    expect(layoutBlockTexts(raw)).toEqual([]);
  });

  it('leaves mentions and special tokens alone and unwraps bare links', () => {
    const raw = {
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '<!here> <@U123> in <#C456>: see <https://x.y> or <mailto:a@b.c|email us>' },
        },
      ],
    };
    expect(layoutBlockTexts(raw)).toEqual([
      ['<!here> <@U123> in <#C456>: see https://x.y or [email us](mailto:a@b.c)'],
    ]);
  });

  it('keeps link destinations with parentheses intact and escapes label brackets', () => {
    const raw = {
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '<https://en.wikipedia.org/wiki/Mars_(planet)|[wiki] Mars>' },
        },
      ],
    };
    expect(layoutBlockTexts(raw)).toEqual([['[\\[wiki\\] Mars](<https://en.wikipedia.org/wiki/Mars_(planet)>)']]);
  });

  it('does not convert plain_text', () => {
    const raw = { blocks: [{ type: 'header', text: { type: 'plain_text', text: '<https://x.y|literal>' } }] };
    expect(layoutBlockTexts(raw)).toEqual([['<https://x.y|literal>']]);
  });

  it('returns nothing for payloads without layout blocks', () => {
    expect(layoutBlockTexts(undefined)).toEqual([]);
    expect(layoutBlockTexts(null)).toEqual([]);
    expect(layoutBlockTexts({})).toEqual([]);
    expect(layoutBlockTexts({ blocks: 'nope' })).toEqual([]);
    expect(layoutBlockTexts({ blocks: [null, 1, {}, { type: 'section' }, { type: 'header', text: 'x' }] })).toEqual([]);
  });
});

describe('messageText with Slack layout blocks', () => {
  beforeAll(async () => {
    await getChatModule();
  });

  const message = (partial: Partial<Message>): Message =>
    ({ id: 'm1', threadId: 't', text: '', raw: {}, attachments: [], ...partial }) as Message;

  it('is unchanged for messages without layout blocks', () => {
    expect(messageText(message({ text: 'hello' }))).toBe('hello');
    expect(messageText(message({ text: 'hello', raw: { blocks: [{ type: 'divider' }] } }))).toBe('hello');
  });

  it('appends block text after the formatted text', () => {
    const msg = message({
      text: 'Lint failure',
      formatted: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Lint failure' }] }],
      },
      raw: { blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Details: <https://x.y|run>' } }] },
    });
    expect(messageText(msg)).toBe('Lint failure\n\nDetails: [run](https://x.y)');
  });

  it('skips blocks the message text already contains', () => {
    const msg = message({
      text: '❌ Workflow failure — Lint failed on main',
      raw: {
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: '❌  Workflow failure' } },
          { type: 'section', text: { type: 'mrkdwn', text: 'lint failed on MAIN' } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Commit: 3f8b55a' }] },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Commit: 3f8b55a' }] },
        ],
      },
    });
    expect(messageText(msg)).toBe('❌ Workflow failure — Lint failed on main\n\nCommit: 3f8b55a');
  });

  it('uses block text alone when the fallback is empty', () => {
    const msg = message({ raw: { blocks: [{ type: 'header', text: { type: 'plain_text', text: 'Alert' } }] } });
    expect(messageText(msg)).toBe('Alert');
  });

  // Fixtures below mirror @chat-adapter/slack 4.40 output: `raw` is the Slack
  // event (cards via cardToBlockKit + cardToFallbackText), `text` and
  // `formatted` are what SlackAdapter.parseMessage derives from it.
  const parsed = (raw: { text: string; blocks: unknown[] }, text: string, markdown: string): Message =>
    message({ text, formatted: chatModule().parseMarkdown(markdown), raw });

  it('does not repeat a bot section whose mrkdwn matches the fallback', () => {
    const mrkdwn = '*Build failed* on <https://ci.example/1|main>';
    const msg = parsed(
      { text: mrkdwn, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: mrkdwn } }] },
      'Build failed on main',
      '**Build failed** on [main](https://ci.example/1)',
    );
    expect(messageText(msg)).toBe('**Build failed** on [main](https://ci.example/1)');
  });

  it('does not repeat lines of a Mastra tool result card', () => {
    const msg = parsed(
      {
        text: '*search* `q: "hi"` · 1.2s ✓\n```\n{"a":1}\n```',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '*search* `q: "hi"` · 1.2s ✓' } },
          { type: 'section', text: { type: 'mrkdwn', text: '```\n{"a":1}\n```' } },
        ],
      },
      'search q: "hi" · 1.2s ✓\n\n{"a":1}',
      '**search** `q: "hi"` · 1.2s ✓\n\n```\n{"a":1}\n```',
    );
    expect(messageText(msg)).toBe('**search** `q: "hi"` · 1.2s ✓\n\n```\n{"a":1}\n```');
  });

  it('does not repeat lines of a Mastra tool error card', () => {
    const msg = parsed(
      {
        text: '*search* `q: "hi"` · 1.2s ✗\nboom <x>',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '*search* `q: "hi"` · 1.2s ✗' } },
          { type: 'section', text: { type: 'mrkdwn', text: '*boom <x>*' } },
        ],
      },
      'search q: "hi" · 1.2s ✗\nboom <x>',
      '**search** `q: "hi"` · 1.2s ✗\nboom <x>',
    );
    expect(messageText(msg)).toBe('**search** `q: "hi"` · 1.2s ✗\nboom <x>');
  });

  it('does not repeat lines of a Mastra tool approval card', () => {
    const msg = parsed(
      {
        text: '*search* `q: "hi"`\nRequires approval to run.',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '*search* `q: "hi"`' } },
          { type: 'section', text: { type: 'mrkdwn', text: 'Requires approval to run.' } },
          { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Approve' } }] },
        ],
      },
      'search q: "hi"\nRequires approval to run.',
      '**search** `q: "hi"`\nRequires approval to run.',
    );
    expect(messageText(msg)).toBe('**search** `q: "hi"`\nRequires approval to run.');
  });

  it('still appends a block that only shares a partial word with the text', () => {
    const msg = message({
      text: 'maintenance window',
      raw: { blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*main*' } }] },
    });
    expect(messageText(msg)).toBe('maintenance window\n\n*main*');
  });

  it('drops section text the fallback already has but keeps its fields', () => {
    const msg = message({
      text: 'Deploy finished',
      raw: {
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Deploy finished' },
            fields: [{ type: 'mrkdwn', text: '*Env:* prod' }],
          },
        ],
      },
    });
    expect(messageText(msg)).toBe('Deploy finished\n\n*Env:* prod');
  });

  it('dedupes links whose destination contains parentheses', () => {
    const mrkdwn = 'See <https://en.wikipedia.org/wiki/Mars_(planet)|Mars>';
    const msg = parsed(
      { text: mrkdwn, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: mrkdwn } }] },
      'See Mars',
      'See [Mars](<https://en.wikipedia.org/wiki/Mars_(planet)>)',
    );
    expect(messageText(msg)).toBe('See [Mars](https://en.wikipedia.org/wiki/Mars_\\(planet\\))');
  });
});
