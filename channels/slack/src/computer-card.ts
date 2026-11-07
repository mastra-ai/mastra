import crypto from 'node:crypto';

import { createSlackAdapter } from '@chat-adapter/slack';
import type { SlackAdapter } from '@chat-adapter/slack';
import type { ChannelDataPart, ChannelDataPartContext } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';

/** @experimental Computer cards are on only when the experimental computer flag is set. */
export const computerCardsEnabled = (): boolean => process.env.MASTRA_EXPERIMENTAL_COMPUTER === 'true';

/** @experimental Arguments passed to {@link ComputerEmbedUrlFn}. */
export interface ComputerEmbedUrlArgs {
  computerId: string;
  threadId: string;
  resourceId: string;
  /** `'control'` while the person holds the input lease, otherwise `'watch'`. */
  mode: 'watch' | 'control';
}

/**
 * @experimental Return a URL Slack can frame in the Work Object flexpane, or `null`.
 * The URL is only sent to Slack in the flexpane details response, never in a channel message.
 */
export type ComputerEmbedUrlFn = (args: ComputerEmbedUrlArgs) => string | null | Promise<string | null>;

export const COMPUTER_TAKE_ACTION = 'computer_take';
export const COMPUTER_RELEASE_ACTION = 'computer_release';
export const EMBED_MIME_TYPE = 'application/vnd.slack-embed';
export const OWNER_ONLY_TEXT = 'Only the person who started this conversation can control its computer.';

// --------------------------------------------------------------------------
// Signed external_ref
// --------------------------------------------------------------------------

export interface ComputerRef {
  teamId: string;
  computerId: string;
  threadId: string;
}

const REF_PREFIX = 'c1';

const b64url = (buf: Buffer) => buf.toString('base64url');

/** Derive the ref-signing key so the raw signing secret is never used directly as an HMAC key. */
export function deriveRefKey(signingSecret: string): Buffer {
  return crypto.createHmac('sha256', signingSecret).update('mastra-computer-ref-v1').digest();
}

function mac(key: Buffer, payload: string): string {
  return b64url(crypto.createHmac('sha256', key).update(payload).digest().subarray(0, 16));
}

/**
 * Authenticated (not confidential) reference to a computer card. The ids are
 * readable by anyone holding the ref, so never log or echo a decoded ref.
 */
export function signRef(key: Buffer, ref: ComputerRef): string {
  const payload = b64url(Buffer.from(JSON.stringify({ t: ref.teamId, c: ref.computerId, h: ref.threadId })));
  return `${REF_PREFIX}:${payload}:${mac(key, payload)}`;
}

export function verifyRef(key: Buffer, value: unknown): ComputerRef | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== REF_PREFIX) return null;
  const [, payload, sig] = parts as [string, string, string];
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.t !== 'string' || typeof parsed.c !== 'string' || typeof parsed.h !== 'string') return null;
    return { teamId: parsed.t, computerId: parsed.c, threadId: parsed.h };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Payload builders
// --------------------------------------------------------------------------

export function buildEntity(opts: { ref: string; url: string; name: string; previewUrl?: string | null }) {
  return {
    entity_type: 'slack#/entities/file',
    url: opts.url,
    external_ref: { id: opts.ref },
    entity_payload: {
      fields: {},
      attributes: {
        title: { text: opts.name },
        product_name: 'Mastra Computer',
        full_size_preview: opts.previewUrl
          ? { is_supported: true, mime_type: EMBED_MIME_TYPE, preview_url: opts.previewUrl }
          : { is_supported: false },
      },
    },
  };
}

export type Holder = 'agent' | 'human';

export function cardText(name: string, holder: Holder, ended: boolean): string {
  if (ended) return `Computer "${name}": session ended`;
  return holder === 'human' ? `Computer "${name}": you have control` : `Computer "${name}": agent has control`;
}

export function buildCardBlocks(opts: { name: string; holder: Holder; ended: boolean; ref: string; buttons: boolean }) {
  const status = opts.ended ? 'Session ended' : opts.holder === 'human' ? 'You have control' : 'Agent has control';
  const blocks: Array<Record<string, unknown>> = [
    { type: 'section', text: { type: 'mrkdwn', text: `*Computer:* ${escapeMrkdwn(opts.name)}\n${status}` } },
  ];
  if (opts.buttons && !opts.ended) {
    const take = opts.holder === 'agent';
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: take ? COMPUTER_TAKE_ACTION : COMPUTER_RELEASE_ACTION,
          text: { type: 'plain_text', text: take ? 'Take control' : 'Hand back' },
          value: opts.ref,
          ...(take ? { style: 'primary' } : {}),
        },
      ],
    });
  }
  return blocks;
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --------------------------------------------------------------------------
// Card-only Slack client
// --------------------------------------------------------------------------

/** WebClient options for card calls: bounded so a card can never hold a run for long. */
export const CARD_WEB_CLIENT_OPTIONS = { retryConfig: { retries: 0 }, timeout: 10_000, rejectRateLimitedCalls: true };

/** Minimal slice of `@slack/web-api` WebClient that cards use. */
export interface CardWebClient {
  chat: {
    postMessage(args: Record<string, unknown>): Promise<{ ts?: string; ok?: boolean }>;
    update(args: Record<string, unknown>): Promise<unknown>;
    postEphemeral(args: Record<string, unknown>): Promise<unknown>;
  };
  apiCall(method: string, args: Record<string, unknown>): Promise<unknown>;
}

export function createCardClient(opts: { botToken: string; botUserId: string; signingSecret: string }): {
  adapter: SlackAdapter;
  client: CardWebClient;
} {
  const adapter = createSlackAdapter({ ...opts, webClientOptions: CARD_WEB_CLIENT_OPTIONS });
  return { adapter, client: adapter.webClient as unknown as CardWebClient };
}

// --------------------------------------------------------------------------
// Card controller (one per installation)
// --------------------------------------------------------------------------

interface CardState {
  channel: string;
  ts?: string;
  name: string;
  holder: Holder;
  ended: boolean;
  ref: string;
}

interface Logger {
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface ComputerCardsOptions {
  installation: { id: string; teamId: string; signingSecret: string; webhookId: string };
  client: CardWebClient;
  /** Decodes a chat SDK thread id into Slack coordinates (the conversation adapter's `decodeThreadId`). */
  decodeThreadId: (threadId: string) => { channel: string; threadTs?: string };
  embedUrl?: ComputerEmbedUrlFn;
  getBaseUrl: () => string | undefined;
  getMastra: () => Mastra | undefined;
  /** False when the host disabled actions (`handlers.onAction: false`). */
  buttons: boolean;
  logger?: Logger;
}

type ThreadRecord = { id: string; resourceId: string; metadata?: Record<string, unknown> };

/**
 * Posts, updates and ends the Computer card in a Slack thread, answers flexpane
 * details requests, and handles Take control / Hand back clicks.
 */
export class ComputerCards {
  readonly #opts: ComputerCardsOptions;
  readonly #key: Buffer;
  readonly #cards = new Map<string, CardState>();
  readonly #chains = new Map<string, Promise<void>>();
  #warnedScope = false;

  constructor(opts: ComputerCardsOptions) {
    this.#opts = opts;
    this.#key = deriveRefKey(opts.installation.signingSecret);
  }

  /** Entity URL used for Work Objects; a static page that never echoes the ref. */
  #entityUrl(ref: string): string | undefined {
    const base = this.#opts.getBaseUrl();
    if (!base) return undefined;
    return `${base}/slack/computers/${this.#opts.installation.webhookId}?ref=${encodeURIComponent(ref)}`;
  }

  #warn(msg: string, err?: unknown) {
    const error = err instanceof Error ? err.message : err === undefined ? undefined : String(err);
    if (error?.includes('missing_scope')) {
      if (this.#warnedScope) return;
      this.#warnedScope = true;
      this.#opts.logger?.warn?.('[Slack] Computer card needs reinstalling the app for new scopes (missing_scope)');
      return;
    }
    this.#opts.logger?.warn?.(`[Slack] ${msg}`, error ? { error } : undefined);
  }

  /** `onDataPart` hook for the Slack adapter entry. */
  onDataPart = (part: ChannelDataPart, ctx: ChannelDataPartContext): Promise<void> | void => {
    if (part.type !== 'data-computer' || !ctx.threadId) return;
    const data = (part.data ?? {}) as Record<string, unknown>;
    const computerId = typeof data.computerId === 'string' ? data.computerId : undefined;
    if (!computerId) return;
    if (typeof data.threadId === 'string' && data.threadId !== ctx.threadId) return;
    const threadId = ctx.threadId;
    const key = `${computerId}:${threadId}`;
    const prev = this.#chains.get(key) ?? Promise.resolve();
    const next = prev
      .then(() => this.#apply(key, { computerId, threadId, chatThreadId: ctx.chatThread.id, data }))
      .catch(err => this.#warn('Computer card update failed', err));
    this.#chains.set(key, next);
    return next;
  };

  async #apply(
    key: string,
    p: { computerId: string; threadId: string; chatThreadId: string; data: Record<string, unknown> },
  ): Promise<void> {
    const { client, installation } = this.#opts;
    const existing = this.#cards.get(key);
    const status = p.data.status;

    if (status === 'attached') {
      if (existing && !existing.ended) {
        if (typeof p.data.name === 'string') existing.name = p.data.name;
        return this.#update(existing);
      }
      const { channel, threadTs } = this.#opts.decodeThreadId(p.chatThreadId);
      const name = typeof p.data.name === 'string' && p.data.name ? p.data.name : p.computerId;
      const ref = signRef(this.#key, { teamId: installation.teamId, computerId: p.computerId, threadId: p.threadId });
      const card: CardState = { channel, name, holder: 'agent', ended: false, ref };
      this.#cards.set(key, card);
      const url = this.#opts.embedUrl ? this.#entityUrl(ref) : undefined;
      const res = await client.chat.postMessage({
        channel,
        ...(threadTs ? { thread_ts: threadTs } : {}),
        text: cardText(name, card.holder, false),
        blocks: buildCardBlocks({ name, holder: card.holder, ended: false, ref, buttons: this.#opts.buttons }),
        ...(url ? { metadata: { entities: [buildEntity({ ref, url, name })] } } : {}),
      });
      card.ts = res.ts;
      return;
    }

    if (!existing || existing.ended) return;
    if (status === 'released') {
      existing.ended = true;
      return this.#update(existing);
    }
    if (p.data.control === 'human' || p.data.control === 'agent') {
      existing.holder = p.data.control;
      return this.#update(existing);
    }
  }

  async #update(card: CardState): Promise<void> {
    if (!card.ts) return;
    await this.#opts.client.chat.update({
      channel: card.channel,
      ts: card.ts,
      text: cardText(card.name, card.holder, card.ended),
      blocks: buildCardBlocks({ ...card, buttons: this.#opts.buttons }),
    });
  }

  async #loadThread(threadId: string): Promise<ThreadRecord | null> {
    const storage = this.#opts.getMastra()?.getStorage();
    const memory = storage ? await storage.getStore('memory') : undefined;
    if (!memory) return null;
    return ((await memory.getThreadById({ threadId })) as ThreadRecord | null) ?? null;
  }

  /**
   * Handle a `computer_take` / `computer_release` click. Returns `false` for
   * other action ids so the caller falls through to the host's handler.
   */
  async handleAction(event: {
    actionId: string;
    value?: string;
    threadId: string;
    messageId: string;
    user?: { userId?: string };
    raw?: unknown;
  }): Promise<boolean> {
    if (event.actionId !== COMPUTER_TAKE_ACTION && event.actionId !== COMPUTER_RELEASE_ACTION) return false;
    const { channel, threadTs } = this.#opts.decodeThreadId(event.threadId);
    const userId = event.user?.userId;
    const refuse = (text: string) =>
      userId
        ? this.#opts.client.chat
            .postEphemeral({ channel, user: userId, text, ...(threadTs ? { thread_ts: threadTs } : {}) })
            .catch(err => this.#warn('Computer card ephemeral failed', err))
        : undefined;

    const ref = verifyRef(this.#key, event.value);
    const raw = (event.raw ?? {}) as { team?: { id?: string }; user?: { team_id?: string } };
    const team = raw.team?.id ?? raw.user?.team_id;
    if (!ref || ref.teamId !== this.#opts.installation.teamId || team !== ref.teamId) {
      await refuse(OWNER_ONLY_TEXT);
      return true;
    }

    const thread = await this.#loadThread(ref.threadId);
    const owned =
      !!thread &&
      !!userId &&
      thread.metadata?.channel_platform === 'slack' &&
      thread.metadata?.channel_externalThreadId === event.threadId &&
      thread.resourceId === `slack:${userId}`;
    if (!owned) {
      await refuse(OWNER_ONLY_TEXT);
      return true;
    }

    const computers = this.#opts.getMastra()?.getComputers();
    if (!computers?.control) {
      await refuse('Taking control of this computer is not supported here.');
      return true;
    }

    const action = event.actionId === COMPUTER_TAKE_ACTION ? 'take' : 'release';
    let result: { holder: Holder };
    try {
      result = await computers.control(
        ref.computerId,
        { threadId: ref.threadId, resourceId: thread.resourceId },
        { action },
      );
    } catch (err) {
      this.#warn('Computer control failed', err);
      await refuse('This computer is no longer attached to this conversation.');
      return true;
    }
    const key = `${ref.computerId}:${ref.threadId}`;
    const card: CardState = this.#cards.get(key) ?? {
      channel,
      name: ref.computerId,
      holder: result.holder,
      ended: false,
      ref: event.value!,
    };
    card.ts ??= event.messageId;
    card.holder = result.holder;
    this.#cards.set(key, card);
    await this.#update(card).catch(err => this.#warn('Computer card update failed', err));
    return true;
  }

  /**
   * Answer an `entity_details_requested` event with `entity.presentDetails`.
   * Forged or foreign refs get no call at all.
   */
  async handleDetails(body: { team_id?: string; event?: Record<string, unknown> }): Promise<void> {
    const event = body.event ?? {};
    const externalRef = (event.external_ref as { id?: unknown } | undefined)?.id;
    const ref = verifyRef(this.#key, externalRef);
    const triggerId = event.trigger_id;
    if (!ref || typeof triggerId !== 'string') return;
    if (ref.teamId !== this.#opts.installation.teamId || body.team_id !== ref.teamId) return;

    const url = this.#entityUrl(externalRef as string);
    if (!url) return;
    const name = this.#cards.get(`${ref.computerId}:${ref.threadId}`)?.name ?? ref.computerId;

    let previewUrl: string | null = null;
    try {
      previewUrl = await this.#previewUrl(ref, event);
    } catch (err) {
      this.#warn('Computer flexpane check failed', err);
    }

    await this.#opts.client
      .apiCall('entity.presentDetails', {
        trigger_id: triggerId,
        metadata: buildEntity({ ref: externalRef as string, url, name, previewUrl }),
      })
      .catch(err => this.#warn('Computer flexpane details failed', err));
  }

  async #previewUrl(ref: ComputerRef, event: Record<string, unknown>): Promise<string | null> {
    if (!this.#opts.embedUrl) return null;
    const userId = typeof event.user === 'string' ? event.user : undefined;
    const thread = await this.#loadThread(ref.threadId);
    if (!thread || !userId || thread.metadata?.channel_platform !== 'slack') return null;
    if (thread.resourceId !== `slack:${userId}`) return null;
    const computers = this.#opts.getMastra()?.getComputers();
    if (!computers?.controlState) return null;
    const scope = { threadId: ref.threadId, resourceId: thread.resourceId };
    const state = await computers.controlState(ref.computerId, scope);
    if (!state) return null;
    return this.#opts.embedUrl({
      computerId: ref.computerId,
      threadId: ref.threadId,
      resourceId: thread.resourceId,
      mode: state.holder === 'human' ? 'control' : 'watch',
    });
  }
}
