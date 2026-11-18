import { createServer, get } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Mastra } from '@mastra/core';
import { AgentControllerChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createSlackAdapter } from '@mastra/slack';
import type { Chat } from 'chat';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SlackIntegration } from './integration.js';
import type { SlackToolSettings } from './tool-settings.js';

const TEAM = 'T1';

/**
 * A small Slack workspace served over real HTTP, so the Slack adapter, the
 * Chat SDK and the tools all run unmodified and the test sees what actually
 * went over the wire. The app is in #factory (C1, where the session lives)
 * and #eng (C2), but not in #finance (C3).
 */
const workspace = {
  channels: [
    { id: 'C1', name: 'factory', is_member: true },
    { id: 'C2', name: 'eng', is_member: true },
    { id: 'C3', name: 'finance', is_private: true, is_member: false },
    { id: 'C4', name: 'eng-oncall', is_member: false },
  ],
  users: [
    { id: 'UALEX', name: 'alex', profile: { real_name: 'Alex Rivera', display_name: 'alex' } },
    { id: 'UALEXBOT', name: 'alexbot', is_bot: true, profile: { real_name: 'Alex Bot' } },
    { id: 'UALEXOLD', name: 'alex.old', deleted: true, profile: { real_name: 'Alex Old' } },
    { id: 'USAM', name: 'sam', profile: { real_name: 'Sam Lee', display_name: 'sam' } },
    { id: 'UBOT', name: 'mastra-factory', is_bot: true, profile: { real_name: 'Mastra Factory' } },
  ],
  history: {
    C1: [{ ts: '1700000300.000300', user: 'USAM', text: 'Can someone look at the deploy?' }],
    C2: [
      { ts: '1700000200.000200', user: 'UALEX', text: 'Deploy is green again' },
      { ts: '1700000100.000100', user: 'USAM', text: 'The staging deploy is failing on migrations' },
      { ts: '1700000050.000050', user: 'UALEX', text: 'Older: the STAGING deploy needs a rerun' },
    ],
  } as Record<string, Array<Record<string, unknown>>>,
};

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AZn//2Q==', 'base64');
let fileBytes = jpeg;
let calls: Array<{ method: string; args: Record<string, string> }> = [];
let server: ReturnType<typeof createServer>;
let apiUrl = '';

/** Slack paginates with opaque cursors; one item per page shows the tools follow them. */
function page<T>(items: T[], cursor: string | undefined) {
  const index = Number(cursor || 0);
  const next = index + 1 < items.length ? String(index + 1) : '';
  return { items: items.slice(index, index + 1), response_metadata: { next_cursor: next } };
}

function answer(method: string, args: Record<string, string>): Record<string, unknown> {
  switch (method) {
    case 'auth.test':
      return { team_id: TEAM, user_id: 'UBOT', bot_id: 'BBOT', url: 'https://mastra.slack.com/' };
    case 'conversations.replies': {
      const messages = workspace.history[args.channel!] ?? [];
      if (!args.ts || !messages.some(message => message.ts === args.ts)) return { messages: [] };
      return { messages: messages.filter(message => message.ts === args.oldest && args.inclusive === 'true') };
    }
    case 'conversations.history': {
      const channel = workspace.channels.find(c => c.id === args.channel);
      if (!channel?.is_member && args.channel !== 'D1') return { ok: false, error: 'not_in_channel' };
      // Newest first, at most 2 per page (Slack may return fewer than asked), so reads have to follow cursors.
      const all = workspace.history[args.channel!] ?? [];
      const start = Number(args.cursor || 0);
      const end = start + Math.min(Number(args.limit || all.length), 2);
      return {
        messages: all.slice(start, end),
        has_more: end < all.length,
        response_metadata: { next_cursor: end < all.length ? String(end) : '' },
      };
    }
    case 'chat.postMessage':
      return { channel: args.channel, ts: '1800000000.000001', message: { text: args.text } };
    case 'conversations.open':
      return { channel: { id: `D-${args.users}` } };
    case 'conversations.list': {
      const { items, response_metadata } = page(workspace.channels, args.cursor);
      return { channels: items, response_metadata };
    }
    case 'users.info': {
      const user = workspace.users.find(u => u.id === args.user);
      return user ? { user } : { ok: false, error: 'user_not_found' };
    }
    case 'users.list': {
      const { items, response_metadata } = page(workspace.users, args.cursor);
      return { members: items, response_metadata };
    }
    default:
      return { ok: false, error: 'unknown_method' };
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/api/files/wallpaper') {
      calls.push({ method: 'file.download', args: { authorization: req.headers.authorization ?? '' } });
      res.setHeader('content-type', 'image/jpeg');
      res.end(fileBytes);
      return;
    }
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const method = req.url!.replace(/^\/api\//, '').split('?')[0]!;
      const args = Object.fromEntries(new URLSearchParams(body));
      calls.push({ method, args });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, ...answer(method, args) }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/`;
});

afterAll(() => server.close());

beforeEach(() => {
  calls = [];
  fileBytes = jpeg;
});

type Tool = { execute: (input: Record<string, unknown>, options: Record<string, unknown>) => Promise<any>; toModelOutput?: (output: any) => unknown };

/**
 * A session linked to the Slack thread C1/171.1 and woken without a Slack
 * message (as web prompts, GitHub events and schedules are), so the tools find
 * their thread through the session's stored channel coordinates.
 */
async function slackSession(settings?: Partial<SlackToolSettings>, externalThreadId = 'slack:C1:171.1') {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const memory = await storage.getStore('memory');
  await memory!.saveThread({
    thread: {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'session',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { channel_platform: 'slack', channel_externalThreadId: externalThreadId },
    },
  });
  const adapter = createSlackAdapter({
    botToken: 'xoxb-test', signingSecret: 'secret', apiUrl,
    fileTransport: (url, _signal, headers) => {
      if (String(url) !== 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg') {
        throw new Error(`Unexpected attachment URL: ${url}`);
      }
      return new Promise((resolve, reject) => {
        get(`${apiUrl}files/wallpaper`, { headers }, resolve).on('error', reject);
      });
    },
  });
  const channels = new AgentControllerChannels({ adapters: { slack: { adapter } } });
  channels.__setController({ id: 'mastra-code', getMastra: () => mastra } as any);
  await channels.initialize(mastra);

  const slack = new SlackIntegration({ signingSecret: 'secret', tools: settings });
  slack.initialize({ channels: () => channels });

  const requestContext = new RequestContext();
  requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
  const tools = await slack.agentTools({ requestContext });
  calls = [];
  const tool = (name: string) => tools[name] as unknown as Tool | undefined;
  const run = (name: string, input: Record<string, unknown>) => tool(name)!.execute(input, {});
  return { run, tool, chat: channels.sdk! };
}

/**
 * Runs `fn` while the Chat SDK handles a Slack event in the session's thread,
 * the way tools run when a Slack message starts or continues a session.
 */
function duringSlackEvent<T>(chat: Chat, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    chat.onReaction(async () => fn().then(resolve, reject));
    void chat.processReaction({
      adapter: chat.getAdapter('slack'),
      threadId: 'slack:C1:171.1',
      messageId: '171.1',
      emoji: { name: 'eyes' },
      rawEmoji: 'eyes',
      added: true,
      user: { userId: 'USAM', userName: 'sam', fullName: 'Sam Lee', isBot: false, isMe: false },
      raw: {},
    } as never);
  });
}

const sent = (method: string) => calls.filter(c => c.method === method).map(c => c.args);

/** What a deployment grants to let sessions work across Slack. */
const wide = { channels: 'all', directMessages: 'anyone' } as const;

describe('Slack tools on a Factory session, by default', () => {
  it('downloads the original bytes of a private image in its channel without exposing the bot token', async () => {
    workspace.history.C1![0]!.files = [{
      id: 'F1', name: 'midnight-9.jpg', mimetype: 'image/jpeg', size: jpeg.length,
      url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
    }];
    try {
      const { run, tool } = await slackSession();
      const result = await run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      });
      expect(Buffer.from(result.base64, 'base64')).toEqual(jpeg);
      expect(tool('downloadSlackAttachment')!.toModelOutput?.(result)).toEqual({
        type: 'content', value: [{ type: 'image-data', data: result.base64, mediaType: 'image/jpeg' }],
      });
      expect(result).toMatchObject({ name: 'midnight-9.jpg', mimeType: 'image/jpeg' });
      expect(sent('file.download')).toEqual([{ authorization: 'Bearer xoxb-test' }]);
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C2:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('outside the channels');
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:DOTHER:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow("someone else's direct message");
      (workspace.history.C1![0]!.files as Array<{ size: number }>)[0]!.size = 9 * 1024 * 1024;
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('exceeds 8 MiB');
      expect(sent('file.download')).toHaveLength(1);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('rejects mislabeled image bytes before sending them to the model', async () => {
    fileBytes = Buffer.from('not an image');
    workspace.history.C1![0]!.files = [{
      id: 'F1', name: 'midnight-9.jpg', mimetype: 'image/jpeg', size: fileBytes.length,
      url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
    }];
    try {
      const { run } = await slackSession();
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('Attachment bytes do not match the declared image format.');
      expect(sent('file.download')).toHaveLength(1);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('rejects truncated PNG and altered WebP headers before model output', async () => {
    const images = [
      { mimeType: 'image/png', bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) },
      { mimeType: 'image/webp', bytes: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=', 'base64') },
    ];
    images[1]!.bytes[0] |= 0x80;
    try {
      const { run } = await slackSession();
      for (const image of images) {
        fileBytes = image.bytes;
        workspace.history.C1![0]!.files = [{
          id: 'F1', name: 'image', mimetype: image.mimeType, size: fileBytes.length,
          url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
        }];
        await expect(run('downloadSlackAttachment', {
          threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
        })).rejects.toThrow('Attachment bytes do not match the declared image format.');
      }
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('rejects understated downloaded image size before model output', async () => {
    fileBytes = Buffer.concat([jpeg.subarray(0, -2), Buffer.alloc(3_750_001 - jpeg.length), jpeg.subarray(-2)]);
    workspace.history.C1![0]!.files = [{
      id: 'F1', name: 'large.jpg', mimetype: 'image/jpeg', size: jpeg.length,
      url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
    }];
    try {
      const { run } = await slackSession();
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('5 MB encoded model input limit');
      expect(sent('file.download')).toHaveLength(1);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('accepts PNG and WebP bytes matching their declared formats', async () => {
    const images = [
      { mimeType: 'image/png', name: 'pixel.png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVQI12NoAAAAggCB3UNq9AAAAABJRU5ErkJggg==' },
      { mimeType: 'image/webp', name: 'pixel.webp', base64: 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=' },
    ];
    try {
      const { run, tool } = await slackSession();
      for (const image of images) {
        fileBytes = Buffer.from(image.base64, 'base64');
        workspace.history.C1![0]!.files = [{
          id: 'F1', name: image.name, mimetype: image.mimeType, size: fileBytes.length,
          url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
        }];
        const result = await run('downloadSlackAttachment', {
          threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
        });
        expect(Buffer.from(result.base64, 'base64')).toEqual(fileBytes);
        expect(tool('downloadSlackAttachment')!.toModelOutput?.(result)).toEqual({
          type: 'content', value: [{ type: 'image-data', data: image.base64, mediaType: image.mimeType }],
        });
      }
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('inspects images from its own top-level DM without leaking access to another DM', async () => {
    workspace.history.D1 = [{
      ts: '1700000400.000400', user: 'USAM', text: 'Look at this', files: [{
        id: 'F1', name: 'midnight-9.jpg', mimetype: 'image/jpeg', size: jpeg.length,
        url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
      }],
    }];
    try {
      const { run } = await slackSession(undefined, 'slack:D1:');
      const history = await run('fetchChannelMessages', { channelId: 'slack:D1', limit: 5, direction: 'backward' });
      expect(history.messages[0].id).toBe('1700000400.000400');
      const result = await run('downloadSlackAttachment', {
        threadId: 'slack:D1:', messageId: '1700000400.000400', attachmentIndex: 0,
      });
      expect(Buffer.from(result.base64, 'base64')).toEqual(jpeg);
      expect(sent('conversations.replies')[0]).toMatchObject({ channel: 'D1', ts: '1700000400.000400' });
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:DOTHER:', messageId: '1700000400.000400', attachmentIndex: 0,
      })).rejects.toThrow("someone else's direct message");
    } finally {
      delete workspace.history.D1;
    }
  });

  it('rejects images without a reported size before downloading', async () => {
    workspace.history.C1![0]!.files = [{
      id: 'F1', name: 'midnight-9.jpg', mimetype: 'image/jpeg',
      url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
    }];
    try {
      const { run } = await slackSession();
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('Attachment size is unavailable');
      expect(sent('file.download')).toHaveLength(0);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('rejects image formats the model cannot inspect and oversized encoded images before downloading', async () => {
    workspace.history.C1![0]!.files = [{
      id: 'F1', name: 'diagram.svg', mimetype: 'image/svg+xml', size: 20,
      url_private: 'https://files.slack.com/files-pri/T1-F1/diagram.svg',
    }];
    try {
      const { run } = await slackSession();
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('Unsupported image format');
      expect(sent('file.download')).toHaveLength(0);

      workspace.history.C1![0]!.files = [{
        id: 'F1', name: 'animated.gif', mimetype: 'image/gif', size: 20,
        url_private: 'https://files.slack.com/files-pri/T1-F1/animated.gif',
      }];
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('Unsupported image format');
      expect(sent('file.download')).toHaveLength(0);

      workspace.history.C1![0]!.files = [{
        id: 'F1', name: 'midnight-9.jpg', mimetype: 'image/jpeg', size: 3_750_001,
        url_private: 'https://files.slack.com/files-pri/T1-F1/midnight-9.jpg',
      }];
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('5 MB encoded model input limit');
      expect(sent('file.download')).toHaveLength(0);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('refuses non-image attachments before downloading or putting bytes in model context', async () => {
    workspace.history.C1![0]!.files = [{
      id: 'F2', name: 'report.pdf', mimetype: 'application/pdf', size: 20,
      url_private: 'https://files.slack.com/files-pri/T1-F2/report.pdf',
    }];
    try {
      const { run } = await slackSession();
      await expect(run('downloadSlackAttachment', {
        threadId: 'slack:C1:1700000300.000300', messageId: '1700000300.000300', attachmentIndex: 0,
      })).rejects.toThrow('Only image attachments can be inspected');
      expect(sent('file.download')).toHaveLength(0);
    } finally {
      delete workspace.history.C1![0]!.files;
    }
  });

  it('reads and posts in its own channel', async () => {
    const { run } = await slackSession();

    const read = await run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toEqual(['Can someone look at the deploy?']);

    await run('postMessage', { threadId: 'slack:C1:171.1', message: 'Looking now.' });
    await run('postChannelMessage', { channelId: 'slack:C1', message: 'Deploy is fixed.' });
    expect(sent('chat.postMessage').map(m => m.channel)).toEqual(['C1', 'C1']);
  });

  it("refuses any other channel, even one the app is in, without asking Slack", async () => {
    const { run } = await slackSession();

    await expect(run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' })).rejects.toThrow(
      'outside the channels this session can use: slack:C1',
    );
    await expect(run('fetchThread', { threadId: 'slack:C2:1700000200.000200' })).rejects.toThrow('outside the channels');
    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'Hi' })).rejects.toThrow('outside the channels');
    const search = await run('searchMessages', { query: 'deploy', channelIds: ['slack:C2'] });
    expect(search.matches).toEqual([]);
    expect(search.errors).toEqual([{ channelId: 'slack:C2', error: expect.stringContaining('outside the channels') }]);

    expect(calls.map(c => c.method)).not.toContain('conversations.history');
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it('stays in its own channel while handling a Slack message too', async () => {
    const { run, chat } = await slackSession();

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' }),
    );
    expect(read.messages).toHaveLength(1);
    await expect(
      duringSlackEvent(chat, () => run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' })),
    ).rejects.toThrow('outside the channels this session can use');
  });

  it("can't send DMs, but can still look people up to mention them", async () => {
    const { tool } = await slackSession();

    expect(tool('sendDirectMessage')).toBeUndefined();
    expect(tool('findUser')).toBeDefined();
  });
});

describe('Slack tools on a Factory session, with access granted', () => {
  it('reaches the channels a deployment grants, and only those', async () => {
    const { run, chat } = await slackSession({ channels: 'selected', channelIds: ['C2'] });

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' }),
    );
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');
    await run('postChannelMessage', { channelId: 'slack:C2', message: 'On it.' });
    expect(sent('chat.postMessage')).toEqual([expect.objectContaining({ channel: 'C2', text: 'On it.' })]);

    await expect(run('fetchChannelMessages', { channelId: 'slack:C4', limit: 5, direction: 'backward' })).rejects.toThrow(
      'outside the channels this session can use: slack:C1, slack:C2',
    );
  });

  it('reads other channels but posts only in its own channel when access is read only', async () => {
    const { run } = await slackSession({ channels: 'all', channelAccess: 'read' });

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');

    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'Hi' })).rejects.toThrow(
      '"slack:C2" is read only for this session: it can only post in its own channel, slack:C1.',
    );
    await expect(run('postMessage', { threadId: 'slack:C2:1700000200.000200', message: 'Hi' })).rejects.toThrow(
      'is read only for this session',
    );
    await run('postMessage', { threadId: 'slack:C1:171.1', message: 'Read #eng, all green.' });
    await run('postChannelMessage', { channelId: 'slack:C1', message: 'Summary of #eng: all green.' });
    expect(sent('chat.postMessage').map(m => [m.channel, m.text])).toEqual([
      ['C1', 'Read #eng, all green.'],
      ['C1', 'Summary of #eng: all green.'],
    ]);
  });

  it('treats a setting passed as undefined as left at its default', async () => {
    const { tool } = await slackSession({ channels: undefined, directMessages: 'anyone' });

    expect(tool('sendDirectMessage')).toBeDefined();
    expect(String((tool('fetchChannelMessages') as { description?: unknown }).description)).toContain(
      'Channels this session can use: slack:C1.',
    );
  });

  it('rejects a channel grant that is not a Slack channel id when the integration is set up', () => {
    expect(() => new SlackIntegration({ signingSecret: 'secret', tools: { channels: 'selected', channelIds: ['#eng'] } })).toThrow();
  });
});

describe('Slack tools on a Factory session, with every channel and DMs granted', () => {
  it('reads the channel the session was started in', async () => {
    const { run } = await slackSession(wide);

    const result = await run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' });

    expect(result.messages.map((m: { text: string }) => m.text)).toEqual(['Can someone look at the deploy?']);
  });

  it('reads and posts in any other channel the app is in, without asking anyone to approve the post', async () => {
    const { run, tool } = await slackSession(wide);

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');

    // A woken run has nobody around to approve, so posting must not wait for one.
    expect((tool('postChannelMessage') as { needsApproval?: unknown }).needsApproval).toBe(false);
    await run('postChannelMessage', { channelId: 'slack:C2', message: 'Thanks, closing this out.' });
    expect(sent('chat.postMessage')).toEqual([
      expect.objectContaining({ channel: 'C2', text: 'Thanks, closing this out.' }),
    ]);
  });

  it("won't read or post in someone else's DM with the app", async () => {
    const { run } = await slackSession(wide);

    await expect(run('fetchChannelMessages', { channelId: 'slack:D-USAM', limit: 5 })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('postChannelMessage', { channelId: 'slack:D-USAM', message: 'hi' })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('fetchChannelMessages', { channelId: 'D-USAM', limit: 5 })).rejects.toThrow(
      "someone else's direct message",
    );
    // Bare ids and thread ids must be checked as the channel actually read.
    const search = await run('searchMessages', {
      query: 'deploy',
      channelIds: ['slack:D-USAM', 'D-USAM', 'slack:D-USAM:1700000000.000100'],
    });
    expect(search.errors).toHaveLength(3);
    expect(sent('conversations.history')).toEqual([]);
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it('reaches other channels while handling a Slack message, not just that conversation', async () => {
    const { run, chat } = await slackSession(wide);

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' }),
    );
    await duringSlackEvent(chat, () => run('postChannelMessage', { channelId: 'slack:C2', message: 'On it.' }));

    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');
    expect(sent('chat.postMessage')).toEqual([expect.objectContaining({ channel: 'C2', text: 'On it.' })]);
  });

  it("won't turn a thread reply into a new top-level post", async () => {
    const { run } = await slackSession(wide);

    await expect(
      run('postChannelMessage', { channelId: 'slack:C2:1700000000.000100', message: 'Replying here' }),
    ).rejects.toThrow('Use postMessage to reply in a thread');
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it("can't read a channel the app isn't in: Slack refuses it", async () => {
    const { run } = await slackSession(wide);

    await expect(
      run('fetchChannelMessages', { channelId: 'slack:C3', limit: 5, direction: 'backward' }),
    ).rejects.toThrow(/not_in_channel/);
  });

  it('finds channels and people by name across every page Slack returns', async () => {
    const { run } = await slackSession(wide);

    const channels = await run('findChannel', { name: '#eng' });
    expect(channels.channels).toEqual([
      { id: 'slack:C2', name: 'eng', isPrivate: false, isMember: true },
      { id: 'slack:C4', name: 'eng-oncall', isPrivate: false, isMember: false },
    ]);

    // Bots and deactivated accounts aren't people to message.
    const people = await run('findUser', { name: '@Alex' });
    expect(people.users).toEqual([{ id: 'UALEX', name: 'Alex Rivera', displayName: 'alex' }]);
  });

  it('says when a lookup stopped before reaching everyone, instead of implying nobody matched', async () => {
    const { run } = await slackSession(wide);
    // The fake returns one person per page, so a dozen extras push Sam past the page cap.
    const extras = Array.from({ length: 12 }, (_, i) => ({ id: `UEXTRA${i}`, name: `extra${i}`, profile: {} }));
    const users = workspace.users;
    workspace.users = [...extras, ...users];
    try {
      expect(await run('findUser', { name: 'Sam' })).toEqual({ users: [], incomplete: true });
    } finally {
      workspace.users = users;
    }

    expect(await run('findUser', { name: 'Sam' })).toEqual({ users: [{ id: 'USAM', name: 'Sam Lee', displayName: 'sam' }] });
  });

  it('searches messages for every word, ignoring case, in the channels asked for', async () => {
    const { run } = await slackSession(wide);

    const result = await run('searchMessages', { query: 'staging DEPLOY', channelIds: ['slack:C2', 'slack:C1'] });

    expect(result.matches).toEqual([
      {
        channelId: 'slack:C2',
        ts: '1700000100.000100',
        userId: 'USAM',
        text: 'The staging deploy is failing on migrations',
      },
      { channelId: 'slack:C2', ts: '1700000050.000050', userId: 'UALEX', text: 'Older: the STAGING deploy needs a rerun' },
    ]);
    expect(result.scanned).toBe(4);
  });

  it("searches the session's own channel by default and reads only the newest `scan` messages", async () => {
    const { run } = await slackSession(wide);

    expect((await run('searchMessages', { query: 'deploy' })).matches.map((m: { channelId: string }) => m.channelId)).toEqual(
      ['slack:C1'],
    );

    calls = [];
    const shallow = await run('searchMessages', { query: 'staging', channelIds: ['slack:C2'], scan: 2 });
    expect(shallow.matches.map((m: { ts: string }) => m.ts)).toEqual(['1700000100.000100']);
    expect(shallow.scanned).toBe(2);
    expect(sent('conversations.history')).toEqual([expect.objectContaining({ channel: 'C2', limit: '2' })]);
  });

  it("reports a channel it can't search without dropping matches from the others", async () => {
    const { run } = await slackSession(wide);

    const result = await run('searchMessages', { query: 'deploy', channelIds: ['slack:C3', 'slack:C1'] });

    expect(result.matches.map((m: { channelId: string }) => m.channelId)).toEqual(['slack:C1']);
    expect(result.errors).toEqual([{ channelId: 'slack:C3', error: 'not_in_channel' }]);
  });

  it('DMs anyone in the workspace', async () => {
    const { run } = await slackSession(wide);

    await run('sendDirectMessage', { userId: 'USAM', text: 'Your deploy is green.' });

    expect(sent('conversations.open')).toEqual([expect.objectContaining({ users: 'USAM' })]);
    expect(sent('chat.postMessage')).toEqual([
      expect.objectContaining({ channel: 'D-USAM', markdown_text: 'Your deploy is green.' }),
    ]);
  });
});
