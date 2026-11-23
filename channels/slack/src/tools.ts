import type { SlackAdapter } from '@chat-adapter/slack';
import { channelToolScopeResolver } from '@mastra/core/channels';
import type { ChannelTools, ChannelToolScope, CreateChannelToolsOptions } from '@mastra/core/channels';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** Pages read per lookup, so one call can't walk a huge workspace. */
const MAX_LOOKUP_PAGES = 10;
/** Most messages searchMessages reads per channel. */
const MAX_SEARCH_SCAN = 1000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** 5 MB once base64-encoded, the most a model accepts inline. */
const MAX_MODEL_ATTACHMENT_BYTES = 3_750_000;

/** Treats a bare Slack id (`C0123`, `D0123`) as `slack:C0123`. */
function withPrefix(id: string): string {
  return id.startsWith('slack:') ? id : `slack:${id}`;
}

/**
 * Reads a paginated Slack list until it runs out of pages or hits the cap.
 * `incomplete` is set when the cap stopped it, so a lookup that found nothing
 * isn't mistaken for "doesn't exist".
 */
async function listAll<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items?: T[]; response_metadata?: { next_cursor?: string } }>,
): Promise<{ items: T[]; incomplete?: true }> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LOOKUP_PAGES; page++) {
    const result = await fetchPage(cursor);
    items.push(...(result.items ?? []));
    cursor = result.response_metadata?.next_cursor || undefined;
    if (!cursor) return { items };
  }
  return { items, incomplete: true };
}

const normalize = (text: string) => text.toLowerCase().replace(/^[#@]/, '').trim();
const searchName = z.string().refine(name => normalize(name) !== '', 'Give a name to search for.');

function matchesImageFormat(mimeType: string, data: Buffer): boolean {
  if (mimeType === 'image/jpeg') {
    return (
      data.length >= 5 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff &&
      data.at(-2) === 0xff &&
      data.at(-1) === 0xd9
    );
  }
  if (mimeType === 'image/png') {
    return (
      data.length >= 57 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.subarray(12, 16).equals(Buffer.from('IHDR')) &&
      data.readUInt32BE(8) === 13 &&
      data.includes(Buffer.from('IDAT'), 33) &&
      data.subarray(-8, -4).equals(Buffer.from('IEND'))
    );
  }
  return (
    data.length >= 12 &&
    data.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    data.subarray(8, 12).equals(Buffer.from('WEBP'))
  );
}

/**
 * Slack-only tools for an agent with Slack channels: findChannel, findUser,
 * searchMessages and downloadSlackAttachment. They take the same options as
 * `createChannelTools` from `@mastra/core/channels`. searchMessages and
 * downloadSlackAttachment only read channels those options allow; findChannel
 * and findUser look up the whole workspace as the app. Nothing is added to the
 * agent for you:
 *
 * ```ts
 * const agent = new Agent({
 *   tools: { ...(await createChannelTools()), ...createSlackTools() },
 *   channels: { adapters: { slack: createSlackAdapter() } },
 * });
 * ```
 */
export function createSlackTools(options: CreateChannelToolsOptions = {}): ChannelTools {
  const { resolve } = channelToolScopeResolver(options);
  const slack = async (context: Parameters<typeof resolve>[0]) => {
    const scope: ChannelToolScope = await resolve(context);
    if (scope.platform !== 'slack') throw new Error('Slack tools only work in a Slack conversation.');
    const adapter = scope.adapter as unknown as SlackAdapter;
    return { scope, adapter, client: adapter.webClient };
  };
  const note = options.scope ? ` ${options.scope.describe()}` : '';

  return {
    findChannel: createTool({
      id: 'findChannel',
      description:
        'Find Slack channels by name, e.g. "eng" or "#eng-proj-factories". Returns full channel ids (slack:C…) to pass to the other Slack tools, and whether the app is a member. `incomplete: true` means the workspace was too large to check every channel.',
      inputSchema: z.object({ name: searchName.describe('All or part of the channel name') }),
      execute: async ({ name }, context) => {
        const { client } = await slack(context);
        const query = normalize(name);
        const { items: found, incomplete } = await listAll(async cursor => {
          const page = await client.conversations.list({
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 1000,
            cursor,
          });
          return { items: page.channels, response_metadata: page.response_metadata };
        });
        const matches = found.filter(c => c.name?.toLowerCase().includes(query));
        return {
          channels: matches.slice(0, 20).map(c => ({
            id: `slack:${c.id}`,
            name: c.name,
            isPrivate: Boolean(c.is_private),
            isMember: Boolean(c.is_member),
          })),
          ...(incomplete && { incomplete }),
        };
      },
    }),

    findUser: createTool({
      id: 'findUser',
      description:
        'Find people in Slack by name, e.g. "Caleb" or "@caleb". Returns their user ids (U…), to mention them as <@U…> in a message or to DM them. `incomplete: true` means the workspace was too large to check everyone.',
      inputSchema: z.object({ name: searchName.describe('All or part of their name or display name') }),
      execute: async ({ name }, context) => {
        const { client } = await slack(context);
        const query = normalize(name);
        const { items: people, incomplete } = await listAll(async cursor => {
          const page = await client.users.list({ limit: 200, cursor });
          return { items: page.members, response_metadata: page.response_metadata };
        });
        const matches = people.filter(
          p =>
            !p.deleted &&
            !p.is_bot &&
            p.id !== 'USLACKBOT' &&
            [p.name, p.profile?.real_name, p.profile?.display_name].some(n => n?.toLowerCase().includes(query)),
        );
        return {
          users: matches.slice(0, 20).map(p => ({
            id: p.id,
            name: p.profile?.real_name || p.name,
            displayName: p.profile?.display_name || undefined,
          })),
          ...(incomplete && { incomplete }),
        };
      },
    }),

    searchMessages: createTool({
      id: 'searchMessages',
      description: `Search recent top-level messages in Slack channels for words. Matches messages containing every word, ignoring case. Reads each channel's newest messages (not thread replies), so older messages are missed. Defaults to this conversation's channel; use findChannel to get other channel ids.${note}`,
      inputSchema: z.object({
        query: z.string().min(1).describe('Words to look for'),
        channelIds: z
          .array(z.string().min(1))
          .max(10)
          .optional()
          .describe("Channels to search, as slack:C… ids. Defaults to this conversation's channel."),
        scan: z
          .number()
          .int()
          .min(1)
          .max(MAX_SEARCH_SCAN)
          .default(200)
          .describe('How many of the newest messages to read in each channel'),
        limit: z.number().int().min(1).max(50).default(20).describe('Most matches to return'),
      }),
      execute: async ({ query, channelIds, scan, limit }, context) => {
        const { scope, client } = await slack(context);
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const channels = channelIds?.length ? channelIds : [scope.channelId];
        const matches: Array<{ channelId: string; ts: string; userId?: string; text: string }> = [];
        const errors: Array<{ channelId: string; error: string }> = [];
        let scanned = 0;
        for (const channelId of channels) {
          // Read the channel the check passed, not whatever string was given.
          const id = withPrefix(channelId);
          const channel = scope.channelOf(id).replace(/^slack:/, '');
          let cursor: string | undefined;
          let read = 0;
          try {
            await scope.assertReadable(id);
            while (read < scan) {
              const page = await client.conversations.history({ channel, limit: Math.min(200, scan - read), cursor });
              for (const message of (page.messages ?? []).slice(0, scan - read)) {
                read++;
                scanned++;
                const text = message.text ?? '';
                if (words.every(word => text.toLowerCase().includes(word))) {
                  matches.push({ channelId: `slack:${channel}`, ts: message.ts ?? '', userId: message.user, text });
                }
              }
              cursor = page.response_metadata?.next_cursor || undefined;
              if (!cursor || (page.messages?.length ?? 0) === 0) break;
            }
          } catch (error) {
            errors.push({
              channelId: `slack:${channel}`,
              error:
                (error as { data?: { error?: string } }).data?.error ??
                (error instanceof Error ? error.message : String(error)),
            });
          }
        }
        return { matches: matches.slice(0, limit), scanned, ...(errors.length ? { errors } : {}) };
      },
    }),

    downloadSlackAttachment: createTool({
      id: 'downloadSlackAttachment',
      description: `Inspect a JPEG, PNG, or WebP attachment from a Slack message in a channel this conversation can read. For top-level messages (including DMs), find the message id with fetchChannelMessages; for threaded replies use fetchMessages. Supply its threadId, messageId, and zero-based attachmentIndex. Images must fit within 5 MB when base64-encoded; they are shown directly to the model.${note}`,
      inputSchema: z.object({
        threadId: z.string().min(1),
        messageId: z.string().regex(/^\d+\.\d+$/),
        attachmentIndex: z.number().int().min(0),
      }),
      outputSchema: z.object({ name: z.string().optional(), mimeType: z.string(), base64: z.string() }),
      execute: async ({ threadId, messageId, attachmentIndex }, context) => {
        const { scope, adapter } = await slack(context);
        const id = withPrefix(threadId);
        await scope.assertReadable(id);
        const lookupThreadId = id.split(':')[2] ? id : `${scope.channelOf(id)}:${messageId}`;
        const message = await adapter.fetchMessage(lookupThreadId, messageId);
        if (!message) throw new Error('Message not found in this thread.');
        const attachment = message.attachments[attachmentIndex];
        if (!attachment) throw new Error('Attachment not found on this message.');
        const mimeType = attachment.mimeType;
        if (!mimeType?.startsWith('image/')) throw new Error('Only image attachments can be inspected.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          throw new Error('Unsupported image format; use JPEG, PNG, or WebP.');
        }
        if (!attachment.fetchData) throw new Error('This attachment cannot be downloaded.');
        if (attachment.size === undefined)
          throw new Error('Attachment size is unavailable; cannot verify the 8 MiB limit.');
        if (attachment.size > MAX_ATTACHMENT_BYTES) throw new Error('Attachment exceeds 8 MiB.');
        if (attachment.size > MAX_MODEL_ATTACHMENT_BYTES) {
          throw new Error('Attachment exceeds the 5 MB encoded model input limit.');
        }
        const bytes = await attachment.fetchData();
        const data = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
        if (data.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('Attachment exceeds 8 MiB.');
        if (data.byteLength > MAX_MODEL_ATTACHMENT_BYTES) {
          throw new Error('Attachment exceeds the 5 MB encoded model input limit.');
        }
        if (!matchesImageFormat(mimeType, data))
          throw new Error('Attachment bytes do not match the declared image format.');
        return { name: attachment.name, mimeType, base64: data.toString('base64') };
      },
      toModelOutput: ({ mimeType, base64 }) => ({
        type: 'content',
        value: [{ type: 'image-data', data: base64, mediaType: mimeType }],
      }),
    }),
  };
}
