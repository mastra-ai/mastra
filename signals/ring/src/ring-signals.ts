import type { NotificationSignalAttributes } from '@mastra/core/notifications';
import type { InputProcessorOrWorkflow, ProcessInputStepArgs } from '@mastra/core/processors';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget, SignalProviderWebhookRequest, SignalSubscription } from '@mastra/core/signals';
import type { ChannelInstallation, ChannelsStorage } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  computeLinkNonce,
  computeWebhookSignature,
  decrypt,
  deriveMediaKey,
  encrypt,
  isEncrypted,
  safeEqual,
  signMediaPath,
} from './crypto';
import { RingApiClient, RingApiError } from './ring-api';
import type { RingAuth } from './ring-api';
import type {
  RingAccount,
  RingEventNotification,
  RingEventType,
  RingSignalsOptions,
  RingTokens,
  RingWebhookEvent,
} from './types';

const PLATFORM = 'ring';

/**
 * Guidance added to the agent's system prompt for Ring notifications, covering only the enabled tools.
 * It depends only on config, so it's the same on every request and doesn't invalidate the prompt cache.
 */
export const buildRingInstructions = (tools: { snapshot: boolean; clip: boolean }): string => {
  const steps = [
    ...(tools.snapshot
      ? ['Call ring_snapshot with its deviceId and timestamp, then describe who or what is at the door.']
      : []),
    ...(tools.clip ? ['Call ring_clip with the same deviceId and timestamp.'] : []),
  ];
  const lines = ['Ring events arrive as <notification source="ring"> messages with deviceId and timestamp attributes.'];
  if (steps.length > 0) {
    lines.push(
      'When a notification has type="button_press":',
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      "Don't include snapshot or clip urls in your reply unless a tool result asks you to share one.",
    );
  }
  return lines.join('\n');
};

/**
 * Default guidance when both tools are enabled.
 */
export const DEFAULT_RING_INSTRUCTIONS = buildRingInstructions({ snapshot: true, clip: true });
const LINK_WINDOW_MS = 10 * 60 * 1000;
const SNAPSHOT_WINDOW_MS = 15_000;
const SNAPSHOT_LOOK_BACK_MS = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const DEFAULT_CLIP_DURATION_MS = 15_000;
const DEFAULT_MAX_ATTACHMENT_BYTES = 10_000_000;
const MEDIA_CACHE_TTL_MS = 10 * 60_000;
const MEDIA_CACHE_MAX_ENTRIES = 20;
const MAX_CLIP_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_CLIP_PROCESSING_TIMEOUT_MS = 120_000;
const CLIP_RETRY_MS = 5_000;
const DEFAULT_MEDIA_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Default notification for each Ring event type. Unlisted events are disabled.
 */
export const DEFAULT_RING_EVENTS: Partial<Record<RingEventType, RingEventNotification>> = {
  button_press: { priority: 'high', summary: 'Doorbell was pressed.' },
  motion_detected: { priority: 'medium', summary: 'Motion was detected.' },
};

const primitiveAttributes = (attributes: Record<string, unknown> = {}): NotificationSignalAttributes => {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      ([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value),
    ),
  ) as NotificationSignalAttributes;
};

const mediaOutputSchema = z.object({
  mediaId: z.string(),
  url: z.string().optional(),
  attached: z.boolean(),
  shareLink: z.boolean(),
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ring signal provider.
 *
 * Links a Ring account to an agent, receives Ring webhooks, and sends each event
 * to an agent thread as a notification signal. Adds `ring_snapshot` and `ring_clip`
 * tools so the agent can fetch media for an event.
 *
 * ```ts
 * const ring = new RingSignals();
 *
 * const agent = new Agent({ signals: [ring], ... });
 *
 * export const mastra = new Mastra({ agents: { agent }, storage });
 * ```
 *
 * Mastra adds the routes from `getRoutes()` to the server when the agent is registered.
 */
export class RingSignals extends SignalProvider<'ring-signals'> {
  readonly id = 'ring-signals' as const;
  override readonly name = 'Ring Signals';

  readonly #options: RingSignalsOptions;
  readonly #api: RingApiClient;
  readonly #hmacKey: string;
  readonly #mediaKey: string;
  readonly #missingConfig: string[];
  readonly #routePrefix: string;
  readonly #events: Partial<Record<RingEventType, RingEventNotification | false>>;
  readonly #snapshots = new Map<string, string>();
  readonly #clips = new Map<string, string>();
  readonly #mediaCache = new Map<string, { data: Promise<Buffer | undefined>; expiresAt: number }>();
  #warnedPlaintext = false;
  readonly #refreshes = new Map<string, Promise<RingAccount>>();

  constructor(options: RingSignalsOptions = {}) {
    super();
    this.#options = options;
    const clientId = options.clientId ?? process.env.RING_CLIENT_ID ?? '';
    const clientSecret = options.clientSecret ?? process.env.RING_CLIENT_SECRET ?? '';
    this.#hmacKey = options.hmacKey ?? process.env.RING_HMAC_KEY ?? '';
    this.#mediaKey = this.#hmacKey ? deriveMediaKey(this.#hmacKey) : '';
    this.#missingConfig = [
      ...(clientId ? [] : ['clientId (RING_CLIENT_ID)']),
      ...(clientSecret ? [] : ['clientSecret (RING_CLIENT_SECRET)']),
      ...(this.#hmacKey ? [] : ['hmacKey (RING_HMAC_KEY)']),
    ];
    this.#routePrefix = (options.routePrefix ?? '/ring').replace(/\/$/, '');
    this.#events = { ...DEFAULT_RING_EVENTS, ...options.events };
    this.#api = new RingApiClient({ clientId, clientSecret, userAgent: options.userAgent ?? 'MastraRingSignals/1.0' });
  }

  /**
   * Warns when credentials are missing as soon as the agent is added to Mastra.
   * Mastra registers the routes from `getRoutes()` itself.
   */
  override __registerMastra(mastra: Parameters<SignalProvider['__registerMastra']>[0]): void {
    super.__registerMastra(mastra);

    if (this.#missingConfig.length > 0) {
      mastra
        .getLogger()
        ?.warn(
          `[Ring] RingSignals is missing ${this.#missingConfig.join(', ')}. Account linking, webhooks and media will fail until it's set.`,
        );
    }
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  /**
   * Send events from a Ring device to a specific thread.
   * Devices without a subscription use the `target` option.
   */
  subscribeThread(target: SignalProviderTarget, deviceId: string): SignalSubscription {
    return this.subscribe(target, deviceId);
  }

  /**
   * Stop sending events from a Ring device to a thread.
   *
   * @returns `true` if the thread was subscribed.
   */
  unsubscribeThread(target: SignalProviderTarget, deviceId: string): boolean {
    return this.unsubscribe(target, deviceId);
  }

  // ── Webhooks ────────────────────────────────────────────────────────

  /**
   * Verify and handle a Ring webhook. `body` must be the raw request body string,
   * because Ring signs the exact bytes it sent.
   */
  async handleWebhook(request: SignalProviderWebhookRequest): Promise<{ status?: number; body?: unknown }> {
    this.#assertConfigured();
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const signature = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'x-signature')?.[1];

    if (!signature || !safeEqual(computeWebhookSignature(this.#hmacKey, rawBody), signature)) {
      return { status: 401, body: { error: 'invalid signature' } };
    }

    let event: RingWebhookEvent;
    try {
      event = JSON.parse(rawBody) as RingWebhookEvent;
    } catch {
      return { status: 400, body: { error: 'invalid JSON body' } };
    }
    await this.#handleAccountEvent(event);
    const notification = this.#events[event.data.type as RingEventType];

    if (!notification) {
      return { status: 200, body: { ignored: event.data.type } };
    }

    const targets = await this.#resolveTargets(event);
    const { source, source_type: sourceType, timestamp, sub_type: subType } = event.data.attributes;

    for (const target of targets) {
      await this.notify(
        {
          source: 'ring',
          kind: event.data.type,
          priority: notification.priority,
          summary: notification.summary,
          attributes: {
            ...(sourceType === 'devices' ? { deviceId: source } : {}),
            ...(timestamp !== undefined ? { timestamp } : {}),
            ...(event.data.type === 'motion_detected' && subType ? { motionType: subType } : {}),
            ...primitiveAttributes(notification.attributes?.(event)),
          },
          payload: event.data,
          dedupeKey: `ring:${event.meta.request_id}:${target.threadId}`,
          ...(notification.coalesce ? { coalesceKey: `ring:${event.data.type}:${source}` } : {}),
        },
        target,
      );
    }

    return { status: 200, body: { delivered: targets.length } };
  }

  // ── Routes ──────────────────────────────────────────────────────────

  /**
   * API routes for Ring account linking, webhooks and media. Mastra adds them to `server.apiRoutes` automatically.
   *
   * | Ring setting       | Route                         |
   * | ------------------ | ----------------------------- |
   * | Account Link URL   | `GET  {prefix}/link`          |
   * | Token Exchange URL | `POST {prefix}/token`         |
   * | Webhook URL        | `POST {prefix}/webhook`       |
   * | App Homepage URL   | `GET  {prefix}/home`          |
   */
  getRoutes(): ApiRoute[] {
    const prefix = this.#routePrefix;

    return [
      registerApiRoute(`${prefix}/token`, {
        method: 'POST',
        requiresAuth: false,
        handler: async context => {
          const { code } = await context.req.parseBody();
          try {
            await this.#exchangeCode(String(code));
            return context.json({ ok: true });
          } catch (error) {
            this.#logError('token exchange failed', error);
            return context.json({ error: 'token exchange failed' }, 500);
          }
        },
      }),
      registerApiRoute(`${prefix}/link`, {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const { nonce, time } = context.req.query();
          try {
            const failure = await this.#completeLink(nonce ?? '', time ?? '');
            if (failure) {
              this.#logError(`account link failed: ${failure}`);
              return context.text(`Ring account link failed: ${failure}`, 400);
            }
            return context.text('Ring account linked');
          } catch (error) {
            this.#logError('account link failed', error);
            return context.text('Ring account link failed', 500);
          }
        },
      }),
      registerApiRoute(`${prefix}/webhook`, {
        method: 'POST',
        requiresAuth: false,
        handler: async context => {
          try {
            const result = await this.handleWebhook({
              body: await context.req.text(),
              headers: Object.fromEntries(context.req.raw.headers.entries()),
            });
            return context.json(result.body ?? {}, (result.status ?? 200) as 200);
          } catch (error) {
            this.#logError('webhook failed', error);
            return context.json({ error: 'webhook failed' }, 500);
          }
        },
      }),
      registerApiRoute(`${prefix}/home`, {
        method: 'GET',
        requiresAuth: false,
        handler: async context => context.text(this.name),
      }),
      registerApiRoute(`${prefix}/media/:kind/:deviceId/:timestamp`, {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const { kind, deviceId, timestamp } = context.req.param();
          const path = `${kind}/${deviceId}/${timestamp}`;
          const expires = Number(context.req.query('expires'));
          const signature = context.req.query('signature') ?? '';

          if (!this.#mediaKey || !safeEqual(signMediaPath(this.#mediaKey, path, expires), signature)) {
            return context.text('Invalid signature', 403);
          }
          if (!(expires > Date.now())) {
            return context.text('Link expired', 403);
          }

          const media =
            kind === 'clip'
              ? await this.#getClip(deviceId, Number(timestamp))
              : await this.#getSnapshot(deviceId, Number(timestamp));

          if (!media) {
            return context.text('Not found', 404);
          }

          const contentType = kind === 'clip' ? 'video/mp4' : 'image/jpeg';
          const range = /^bytes=(\d*)-(\d*)$/.exec(context.req.header('Range') ?? '');

          if (range) {
            const start = range[1] ? Number(range[1]) : Math.max(media.length - Number(range[2]), 0);
            const end = range[1] && range[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;

            if (start > end || start >= media.length) {
              return context.body(null, 416, { 'Content-Range': `bytes */${media.length}` });
            }

            return context.body(new Uint8Array(media.subarray(start, end + 1)), 206, {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${media.length}`,
              'Accept-Ranges': 'bytes',
            });
          }

          return context.body(new Uint8Array(media), 200, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
          });
        },
      }),
    ];
  }

  // ── Tools ───────────────────────────────────────────────────────────

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this as unknown as InputProcessorOrWorkflow];
  }

  /**
   * Adds the Ring guidance as a tagged system message. The text never changes, so the
   * system prompt stays identical across requests and the prompt cache stays valid.
   */
  processInputStep({ messageList }: ProcessInputStepArgs) {
    const instructions =
      this.#options.instructions ??
      buildRingInstructions({ snapshot: this.#snapshotEnabled(), clip: this.#clipOptions() !== undefined });
    if (instructions) {
      messageList.addSystem(instructions, 'ring-signals');
    }
    return messageList;
  }

  #snapshotEnabled(): boolean {
    return this.#options.tools?.snapshot !== false;
  }

  #visibleToModel(tool: 'snapshot' | 'clip'): boolean {
    const configured = this.#options.tools?.[tool];
    const visibleToModel = typeof configured === 'object' ? configured.visibleToModel : undefined;
    return visibleToModel ?? tool === 'snapshot';
  }

  /**
   * Whether to attach media of this size for this tool call. Function options are given the platform
   * stored on the thread by its channel, so they work for runs woken by a Ring signal too.
   */
  async #shouldAttach(
    tool: 'snapshot' | 'clip',
    threadId: string | undefined,
    size: number,
  ): Promise<{ attached: boolean; platform: string | undefined }> {
    const configured = this.#options.tools?.[tool];
    const options = typeof configured === 'object' ? configured : {};
    const platform = await this.#threadPlatform(threadId);

    const attachment = options.attachment ?? true;
    const attach = platform !== undefined && (Array.isArray(attachment) ? attachment.includes(platform) : attachment);
    if (!attach) return { attached: false, platform };

    const maxBytes =
      (typeof options.maxAttachmentBytes === 'object'
        ? options.maxAttachmentBytes[platform]
        : options.maxAttachmentBytes) ?? DEFAULT_MAX_ATTACHMENT_BYTES;
    if (size > maxBytes) {
      this.mastra
        ?.getLogger()
        ?.info(
          `[Ring] Not attaching ${tool} (${size} bytes) on ${platform ?? 'this thread'}: over the ${maxBytes} byte limit.`,
        );
      return { attached: false, platform };
    }
    return { attached: true, platform };
  }

  /**
   * What the model is told about a media tool result. On a channel thread the user can't see tool results,
   * so media that wasn't attached has to be shared as a link.
   */
  #mediaModelText(label: 'snapshot' | 'clip', output: { url?: string; attached: boolean; shareLink: boolean }): string {
    if (output.attached) {
      return `The ${label} was sent to the user as an attachment, so don't include its url.`;
    }
    if (!output.url) {
      return `The ${label} was fetched, but there's no link to share with the user.`;
    }
    if (output.shareLink) {
      return label === 'clip'
        ? `This chat can't show tool results, so share the clip as a link in your reply: [Watch clip](${output.url})`
        : `This chat can't show tool results, so share the snapshot as a link in your reply: [View snapshot](${output.url})`;
    }
    return `The ${label} is shown to the user from this tool result, so don't include its url.`;
  }

  async #threadPlatform(threadId: string | undefined): Promise<string | undefined> {
    if (!threadId) return undefined;
    const memory = await this.mastra?.getStorage()?.getStore('memory');
    const thread = await memory?.getThreadById({ threadId });
    const platform = thread?.metadata?.channel_platform;
    return typeof platform === 'string' ? platform : undefined;
  }

  /**
   * Writes the media as a `file` chunk. Mastra's channel layer posts `file` chunks as attachments
   * on every channel platform; other surfaces can ignore them. Returns whether a chunk was written.
   */
  async #attachFile(
    writer: { custom: (chunk: any) => Promise<void> } | undefined,
    data: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<boolean> {
    if (!writer?.custom) return false;
    await writer.custom({
      type: 'file',
      runId: this.id,
      from: 'AGENT',
      payload: { data: data.toString('base64'), mimeType, filename },
    });
    return true;
  }

  /**
   * Resolved clip settings, or `undefined` when the clip tool is disabled.
   */
  #clipOptions(): { audio: boolean; durationMs: number; processingTimeoutMs: number } | undefined {
    const clip = this.#options.tools?.clip ?? true;
    if (clip === false) return undefined;
    const options = clip === true ? {} : clip;
    return {
      audio: options.audio ?? true,
      durationMs: Math.min(options.durationMs ?? DEFAULT_CLIP_DURATION_MS, MAX_CLIP_DURATION_MS),
      processingTimeoutMs: options.processingTimeoutMs ?? DEFAULT_CLIP_PROCESSING_TIMEOUT_MS,
    };
  }

  getTools() {
    const clipOptions = this.#clipOptions();
    const clipSeconds = Math.round((clipOptions?.durationMs ?? DEFAULT_CLIP_DURATION_MS) / 1000);

    const ringSnapshot = createTool({
      id: 'ring_snapshot',
      description:
        'Get a still image from a Ring camera for an event. Uses the latest image after the event, or the most recent image before it if there is none.',
      inputSchema: z.object({
        deviceId: z.string().describe('The deviceId attribute from the Ring notification'),
        timestamp: z.number().describe('The timestamp attribute from the Ring notification, in epoch milliseconds'),
      }),
      outputSchema: mediaOutputSchema,
      execute: async ({ deviceId, timestamp }, context) => {
        const image = await this.#getSnapshot(deviceId, timestamp);
        if (!image) {
          throw new Error('Ring has no image for this device in the last 24 hours.');
        }
        const attachment = await this.#shouldAttach('snapshot', context?.agent?.threadId, image.length);
        const { platform } = attachment;
        const attached =
          attachment.attached &&
          (await this.#attachFile(context?.writer, image, 'image/jpeg', `snapshot-${timestamp}.jpg`));
        const url = this.#mediaUrl('snapshot', deviceId, timestamp);
        const mediaId = `snapshot:${deviceId}:${timestamp}`;
        if (this.#visibleToModel('snapshot')) {
          this.#snapshots.set(mediaId, image.toString('base64'));
        }
        return { mediaId, url, attached, shareLink: platform !== undefined && !attached && url !== undefined };
      },
      toModelOutput: output => {
        const image = this.#snapshots.get(output.mediaId);
        this.#snapshots.delete(output.mediaId);
        return {
          type: 'content',
          value: [
            {
              type: 'text',
              text: this.#mediaModelText('snapshot', output),
            },
            ...(image ? [{ type: 'image-data' as const, data: image, mediaType: 'image/jpeg' }] : []),
          ],
        };
      },
    });

    const ringClip = createTool({
      id: 'ring_clip',
      description: `Get a ${clipSeconds} second Ring video clip starting at an event. Waits up to ${Math.round((clipOptions?.processingTimeoutMs ?? DEFAULT_CLIP_PROCESSING_TIMEOUT_MS) / 1000)} seconds for Ring to process it.`,
      inputSchema: z.object({
        deviceId: z.string().describe('The deviceId attribute from the Ring notification'),
        timestamp: z.number().describe('The timestamp attribute from the Ring notification, in epoch milliseconds'),
      }),
      outputSchema: mediaOutputSchema,
      execute: async ({ deviceId, timestamp }, context) => {
        const clip = await this.#getClip(deviceId, timestamp);
        if (!clip) {
          throw new Error('Ring has no recording for this event.');
        }
        const attachment = await this.#shouldAttach('clip', context?.agent?.threadId, clip.length);
        const { platform } = attachment;
        const attached =
          attachment.attached && (await this.#attachFile(context?.writer, clip, 'video/mp4', `clip-${timestamp}.mp4`));
        const url = this.#mediaUrl('clip', deviceId, timestamp);
        const mediaId = `clip:${deviceId}:${timestamp}`;
        if (this.#visibleToModel('clip')) {
          this.#clips.set(mediaId, clip.toString('base64'));
        }
        return { mediaId, url, attached, shareLink: platform !== undefined && !attached && url !== undefined };
      },
      toModelOutput: output => {
        const video = this.#clips.get(output.mediaId);
        this.#clips.delete(output.mediaId);
        return {
          type: 'content',
          value: [
            {
              type: 'text',
              text: this.#mediaModelText('clip', output),
            },
            ...(video ? [{ type: 'file-data' as const, data: video, mediaType: 'video/mp4' }] : []),
          ],
        };
      },
    });

    return {
      ...(this.#snapshotEnabled() ? { ring_snapshot: ringSnapshot } : {}),
      ...(clipOptions ? { ring_clip: ringClip } : {}),
    };
  }

  // ── Routing ─────────────────────────────────────────────────────────

  async #resolveTargets(event: RingWebhookEvent): Promise<SignalProviderTarget[]> {
    const deviceId = event.data.attributes.source;
    const subscriptions = this.getSubscriptionsForResource(deviceId);

    if (subscriptions.length > 0) {
      return subscriptions.map(({ resourceId, threadId }) => ({ resourceId, threadId }));
    }

    const { target } = this.#options;
    const resolved =
      typeof target === 'function'
        ? await target(event)
        : (target ?? { resourceId: this.agent?.id ?? 'ring', threadId: deviceId });

    return resolved ? [resolved] : [];
  }

  // ── Account linking ─────────────────────────────────────────────────

  async #exchangeCode(code: string): Promise<void> {
    this.#assertConfigured();
    const tokens = await this.#api.exchangeCode(code);
    const hardwareId = this.#options.hardwareId ?? crypto.randomUUID();
    const accountId = await this.#api.getAccountId({ accessToken: tokens.accessToken, hardwareId });
    await this.#saveAccount({ accountId, hardwareId, deviceIds: [], ...tokens }, 'pending');
  }

  /**
   * Returns a failure reason, or `undefined` when the link completed.
   * A pending account only becomes active once its nonce checks out, so a new token exchange
   * never overwrites a working link.
   */
  async #completeLink(nonce: string, time: string): Promise<string | undefined> {
    this.#assertConfigured();
    if (!nonce || !time) return 'missing nonce or time';
    if (!(Math.abs(Date.now() - Number(time)) <= LINK_WINDOW_MS)) return 'link request expired';

    const pending = (await this.#listInstallations('pending')).map(installation => this.#readAccount(installation));
    if (pending.length === 0) return 'no account saved by the token exchange';

    const account = pending.find(candidate =>
      safeEqual(computeLinkNonce(this.#hmacKey, time, candidate.accountId), nonce),
    );
    if (!account) return 'nonce mismatch';

    await this.#api.confirmLink(account, nonce, account.accountId);
    const deviceIds = await this.#api.listDeviceIds(account).catch(() => []);
    await this.#saveAccount({ ...account, deviceIds }, 'active');
    await (await this.#channelsStorage()).deleteInstallation(this.#installationId(account.accountId, 'pending'));
    return undefined;
  }

  /**
   * Keeps stored accounts in sync with Ring: removes an account's tokens when the app is unlinked,
   * and records which account each device belongs to.
   */
  async #handleAccountEvent(event: RingWebhookEvent): Promise<void> {
    const accountId = event.meta.account_id;
    if (!accountId) return;

    if (event.data.type === 'app_integration_removed') {
      await this.#deleteAccount(accountId);
      this.mastra?.getLogger()?.info(`[Ring] Ring account unlinked; removed its stored tokens.`);
      return;
    }

    if (event.data.type === 'subscription_deactivated') {
      this.mastra
        ?.getLogger()
        ?.warn("[Ring] The Ring subscription was deactivated. Snapshots and clips won't be available.");
      return;
    }

    const deviceId = event.data.attributes.source;
    if (event.data.attributes.source_type === 'devices' && deviceId) {
      await this.#rememberDevice(accountId, deviceId);
    }
  }

  #assertConfigured(): void {
    if (this.#missingConfig.length > 0) {
      throw new Error(`[Ring] RingSignals is missing ${this.#missingConfig.join(', ')}.`);
    }
  }

  #logError(message: string, error?: unknown) {
    const detail =
      error instanceof RingApiError ? `${error.message}: ${error.body}` : error instanceof Error ? error.message : '';
    this.mastra?.getLogger()?.error(`[Ring] ${message}${detail ? ` - ${detail}` : ''}`);
  }

  // ── Token storage ───────────────────────────────────────────────────

  /**
   * One record per linked Ring account, so several accounts can be linked to the same agent.
   * The account waiting for `/link` to confirm it is stored separately until then.
   */
  #installationId(accountId: string, status: 'active' | 'pending'): string {
    const id = `${PLATFORM}:${this.agent?.id ?? 'default'}:${accountId}`;
    return status === 'pending' ? `${id}:pending` : id;
  }

  async #channelsStorage(): Promise<ChannelsStorage> {
    const storage = this.mastra?.getStorage();
    const channels = storage ? ((await storage.getStore('channels')) as ChannelsStorage | undefined) : undefined;
    if (!channels) {
      throw new Error(
        '[Ring] RingSignals needs Mastra storage with channels support (e.g. LibSQLStore or PostgresStore).',
      );
    }
    return channels;
  }

  async #listInstallations(status: 'active' | 'pending'): Promise<ChannelInstallation[]> {
    const channels = await this.#channelsStorage();
    const agentId = this.agent?.id ?? 'default';
    return (await channels.listInstallations(PLATFORM)).filter(
      installation => installation.agentId === agentId && installation.status === status,
    );
  }

  async #saveAccount(account: RingAccount, status: 'active' | 'pending'): Promise<void> {
    const channels = await this.#channelsStorage();
    const id = this.#installationId(account.accountId, status);
    const existing = await channels.getInstallation(id);
    const now = new Date();
    await channels.saveInstallation({
      id,
      platform: PLATFORM,
      agentId: this.agent?.id ?? 'default',
      status,
      data: {
        accountId: account.accountId,
        hardwareId: account.hardwareId,
        deviceIds: account.deviceIds,
        accessToken: this.#encrypt(account.accessToken),
        refreshToken: this.#encrypt(account.refreshToken),
        expiresAt: account.expiresAt,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    if (status === 'active') {
      for (const duplicate of await this.#listInstallations('active')) {
        if (duplicate.id !== id && (duplicate.data as { accountId?: string }).accountId === account.accountId) {
          await channels.deleteInstallation(duplicate.id);
        }
      }
    }
  }

  async #deleteAccount(accountId: string): Promise<void> {
    const channels = await this.#channelsStorage();
    for (const status of ['active', 'pending'] as const) {
      for (const installation of await this.#listInstallations(status)) {
        if ((installation.data as { accountId?: string }).accountId === accountId) {
          await channels.deleteInstallation(installation.id);
        }
      }
    }
  }

  async #rememberDevice(accountId: string, deviceId: string): Promise<void> {
    // Saving the account rewrites its tokens, so let a refresh store the rotated ones first.
    await this.#refreshes.get(accountId)?.catch(() => undefined);
    const account = await this.#loadAccount(accountId);
    if (!account || account.deviceIds.includes(deviceId)) return;
    await this.#saveAccount({ ...account, deviceIds: [...account.deviceIds, deviceId] }, 'active');
  }

  #readAccount(installation: ChannelInstallation): RingAccount {
    const data = installation.data as RingAccount;
    return {
      accountId: data.accountId,
      hardwareId: data.hardwareId,
      deviceIds: data.deviceIds ?? [],
      accessToken: this.#decrypt(data.accessToken),
      refreshToken: this.#decrypt(data.refreshToken),
      expiresAt: data.expiresAt,
    };
  }

  async #loadAccount(accountId: string): Promise<RingAccount | undefined> {
    const installation = (await this.#listInstallations('active')).find(
      candidate => (candidate.data as { accountId?: string }).accountId === accountId,
    );
    return installation ? this.#readAccount(installation) : undefined;
  }

  /**
   * The linked account that owns a device. Falls back to the only linked account, so a single-account
   * setup works before the device has been seen in a webhook.
   */
  async #accountForDevice(deviceId: string): Promise<RingAccount> {
    const accounts = (await this.#listInstallations('active')).map(installation => this.#readAccount(installation));
    const owner =
      accounts.find(account => account.deviceIds.includes(deviceId)) ??
      (accounts.length === 1 ? accounts[0] : undefined);
    if (!owner) {
      throw new Error(
        accounts.length === 0
          ? '[Ring] No linked Ring account. Link the app from the Ring Appstore first.'
          : "[Ring] Couldn't tell which linked Ring account owns this device.",
      );
    }
    return owner;
  }

  /**
   * Fresh credentials for the account that owns a device. Ring invalidates the old refresh token on every
   * refresh, so concurrent refreshes in this process share one request, and if another process refreshed
   * first, the tokens it stored are used instead.
   */
  async #getAuth(deviceId: string): Promise<RingAuth> {
    const account = await this.#accountForDevice(deviceId);
    if (account.expiresAt - Date.now() > 60_000) {
      return account;
    }

    const inFlight = this.#refreshes.get(account.accountId);
    if (inFlight) return inFlight;

    const refresh = (async () => {
      try {
        const tokens: RingTokens = await this.#api.refresh(account.refreshToken);
        const refreshed = { ...account, ...tokens };
        await this.#saveAccount(refreshed, 'active');
        return refreshed;
      } catch (error) {
        const stored = await this.#loadAccount(account.accountId);
        if (stored && stored.refreshToken !== account.refreshToken && stored.expiresAt - Date.now() > 60_000) {
          return stored;
        }
        throw error;
      } finally {
        this.#refreshes.delete(account.accountId);
      }
    })();

    this.#refreshes.set(account.accountId, refresh);
    return refresh;
  }

  #encryptionKey(): string | undefined {
    return this.#options.encryptionKey ?? process.env.MASTRA_ENCRYPTION_KEY;
  }

  #encrypt(value: string): string {
    const key = this.#encryptionKey();
    if (!key && !this.#warnedPlaintext) {
      this.#warnedPlaintext = true;
      this.mastra
        ?.getLogger()
        ?.warn(
          '[Ring] Storing Ring tokens WITHOUT encryption. Set `encryptionKey` on RingSignals or MASTRA_ENCRYPTION_KEY to encrypt them at rest.',
        );
    }
    return key ? encrypt(value, key) : value;
  }

  #decrypt(value: string): string {
    const key = this.#encryptionKey();
    if (!isEncrypted(value)) return value;
    if (!key) {
      throw new Error(
        '[Ring] The stored Ring tokens are encrypted, but no encryption key is configured. Set `encryptionKey` on RingSignals or MASTRA_ENCRYPTION_KEY.',
      );
    }
    return decrypt(value, key);
  }

  // ── Media ───────────────────────────────────────────────────────────

  /**
   * A signed link to the media route, or `undefined` when `baseUrl` isn't set. Ring media needs the account's
   * tokens to download, so links point at this server, which fetches the media from Ring when opened.
   */
  #mediaUrl(kind: 'snapshot' | 'clip', deviceId: string, timestamp: number): string | undefined {
    this.#assertConfigured();
    const baseUrl = this.#options.baseUrl ?? process.env.RING_BASE_URL;
    if (!baseUrl) return undefined;
    const path = `${kind}/${deviceId}/${timestamp}`;
    const expires = Date.now() + (this.#options.mediaUrlTtlMs ?? DEFAULT_MEDIA_URL_TTL_MS);
    const signature = signMediaPath(this.#mediaKey, path, expires);
    return `${baseUrl.replace(/\/$/, '')}${this.#routePrefix}/media/${path}?expires=${expires}&signature=${signature}`;
  }

  /**
   * Media is cached briefly so a tool call and the link it returns share one download, and so every
   * byte-range request a video player makes reads the same file instead of downloading the clip again.
   */
  #cachedMedia(key: string, download: () => Promise<Buffer | undefined>): Promise<Buffer | undefined> {
    const now = Date.now();
    for (const [cachedKey, entry] of this.#mediaCache) {
      if (entry.expiresAt <= now) this.#mediaCache.delete(cachedKey);
    }

    const cached = this.#mediaCache.get(key);
    if (cached) return cached.data;

    const data = download().then(
      media => {
        if (!media) this.#mediaCache.delete(key);
        return media;
      },
      (error: unknown) => {
        this.#mediaCache.delete(key);
        throw error;
      },
    );
    this.#mediaCache.set(key, { data, expiresAt: now + MEDIA_CACHE_TTL_MS });

    while (this.#mediaCache.size > MEDIA_CACHE_MAX_ENTRIES) {
      const oldest = this.#mediaCache.keys().next().value;
      if (oldest === undefined) break;
      this.#mediaCache.delete(oldest);
    }
    return data;
  }

  #getSnapshot(deviceId: string, timestamp: number): Promise<Buffer | undefined> {
    return this.#cachedMedia(`snapshot:${deviceId}:${timestamp}`, () => this.#downloadSnapshot(deviceId, timestamp));
  }

  #getClip(deviceId: string, timestamp: number): Promise<Buffer | undefined> {
    return this.#cachedMedia(`clip:${deviceId}:${timestamp}`, () => this.#downloadClip(deviceId, timestamp));
  }

  async #downloadSnapshot(deviceId: string, timestamp: number): Promise<Buffer | undefined> {
    const endTimestamp = Math.min(timestamp + SNAPSHOT_WINDOW_MS, Date.now() + SNAPSHOT_WINDOW_MS);
    const waitMs = endTimestamp - Date.now();
    if (waitMs > 0) await sleep(waitMs);

    const auth = await this.#getAuth(deviceId);
    const afterEvent = await this.#api.downloadLatestImage(auth, deviceId, timestamp, endTimestamp);
    if (afterEvent) return afterEvent;

    for (const lookBack of SNAPSHOT_LOOK_BACK_MS) {
      const beforeEvent = await this.#api.downloadLatestImage(auth, deviceId, timestamp - lookBack, endTimestamp);
      if (beforeEvent) return beforeEvent;
    }

    return undefined;
  }

  async #downloadClip(deviceId: string, timestamp: number): Promise<Buffer | undefined> {
    const clipOptions = this.#clipOptions() ?? {
      audio: true,
      durationMs: DEFAULT_CLIP_DURATION_MS,
      processingTimeoutMs: DEFAULT_CLIP_PROCESSING_TIMEOUT_MS,
    };
    const deadline = Date.now() + clipOptions.processingTimeoutMs;

    let partial: Buffer | undefined;

    while (true) {
      const response = await this.#api.downloadClip(
        await this.#getAuth(deviceId),
        deviceId,
        timestamp,
        clipOptions.durationMs,
        clipOptions.audio,
      );

      if (response.status === 200) {
        return Buffer.from(await response.arrayBuffer());
      }

      if (response.status === 206) {
        partial = Buffer.from(await response.arrayBuffer());
      } else if (![416, 425].includes(response.status)) {
        return partial;
      }

      if (Date.now() > deadline) {
        return partial;
      }

      await sleep(CLIP_RETRY_MS);
    }
  }
}
