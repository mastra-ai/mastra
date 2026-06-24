import type { Chat, Adapter, ChatConfig, Message, StateAdapter, Thread } from 'chat';

import type { Harness, Session } from '../harness';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { ApiRoute } from '../server/types';
import { chatModule, getChatModule } from './chat-lazy';
import { createHarnessRenderState, handleHarnessEvent } from './harness-event-renderer';
import type { HarnessRenderDeps, HarnessRenderState } from './harness-event-renderer';
import {
  buildInlineMediaCheck,
  extractUrls,
  findInlineLinkRule,
  headContentType,
  normalizeInlineLinks,
} from './inline-media';
import type { InlineLinkRule } from './inline-media';
import { MastraStateAdapter } from './state-adapter';
import type { PendingApprovalRecord } from './stream-helpers';
import type { ChannelAdapterConfig, ChannelConfig, ChannelHandlers } from './types';

/** A file part attached to a message sent to the Session. */
interface SessionFile {
  data: string;
  mediaType: string;
  filename?: string;
}

/**
 * Resolve the Harness `resourceId` (which selects the durable {@link Session})
 * for a channel thread. A `resourceId` maps to exactly one Session per Harness,
 * and each Session owns its current Mastra thread — so one chat thread should
 * map to one stable resourceId. Defaults to `${platform}:${chatThread.id}`.
 */
export type ResolveHarnessResourceId = (ctx: {
  platform: string;
  thread: Thread;
  message: Message;
  defaultResourceId: string;
}) => string | Promise<string>;

/** Context passed to acknowledgment resolvers when a new session starts. */
export interface HarnessAckContext {
  platform: string;
  thread: Thread;
  message: Message;
  resourceId: string;
}

/**
 * Opt-in acknowledgment affordances that make a Harness-backed bot feel
 * responsive, Devin-style: react to / reply to the triggering message as soon as
 * a new session starts, before the agent's streamed reply lands. Both fields are
 * off by default, so configuring nothing preserves the existing behavior.
 *
 * The threading and session mapping are automatic (a channel-root @mention opens
 * a new session; an in-thread reply continues it). These options only add the
 * visible affordance — they never change which session a message routes to.
 */
export interface HarnessAcknowledgeConfig {
  /**
   * Emoji name (e.g. `'eyes'`) to add to the triggering message the first time a
   * session is created for its thread. Requires an adapter that supports
   * reactions (Slack does); silently skipped otherwise. Best-effort — a failure
   * never blocks the message.
   */
  reaction?: string;
  /**
   * Text posted into the thread when a **new** session starts (e.g.
   * `'🧵 Started a new session.'`). Continuations stay quiet. Pass a function to
   * compute the text per message; return `undefined` to post nothing.
   */
  sessionStartMessage?: string | ((ctx: HarnessAckContext) => string | undefined);
}

/**
 * Configuration for {@link HarnessChannels}. Reuses the {@link ChannelConfig}
 * adapter/handler/media surface, swapping the agent-specific resource hook for a
 * Harness session resolver.
 */
export interface HarnessChannelConfig extends Omit<ChannelConfig, 'resolveResourceId'> {
  /**
   * The Harness whose sessions back this bot. Usually omitted — when `channels`
   * is configured on a {@link Harness}, the Harness injects itself. Only set
   * this when constructing `HarnessChannels` standalone.
   */
  harness?: Harness<any>;
  /** Resolve the Harness resourceId (→ Session) for a channel thread. */
  resolveResourceId?: ResolveHarnessResourceId;
  /** Opt-in acknowledgment affordances fired when a new session starts. */
  acknowledge?: HarnessAcknowledgeConfig;
}

interface ThreadBinding {
  session: Session<any>;
  renderState: HarnessRenderState;
  unsubscribe: () => void;
}

/**
 * Bridges a Harness to chat platforms (Slack, etc.) by routing inbound platform
 * messages to a {@link Session} and rendering the session's {@link HarnessEvent}
 * stream back to the thread.
 *
 * This is the Harness analogue of {@link AgentChannels}. The two seams differ:
 *
 * | Seam   | AgentChannels                  | HarnessChannels                    |
 * | ------ | ------------------------------ | ---------------------------------- |
 * | Input  | `agent.sendMessage(...)`       | `session.sendMessage({ content })` |
 * | Output | `agent.subscribeToThread()`    | `session.subscribe(listener)`      |
 *
 * One chat thread ⇒ one Harness resourceId ⇒ one durable Session (which owns its
 * own Mastra thread), so this class doesn't manage Mastra threads directly.
 */
export class HarnessChannels {
  readonly adapters: Record<string, Adapter>;
  public readonly channelConfig: HarnessChannelConfig;

  private chat: Chat | null = null;
  private initPromise: Promise<void> | null = null;
  private harness: Harness<any> | undefined;
  private logger?: IMastraLogger;
  private customState: StateAdapter | undefined;
  private stateAdapter!: StateAdapter;
  private userName: string;
  private adapterConfigs: Record<string, ChannelAdapterConfig>;
  private handlerOverrides: ChannelHandlers;
  private chatOptions: Omit<ChatConfig, 'adapters' | 'state' | 'userName'>;
  private shouldInline: (mimeType: string) => boolean;
  private inlineLinkRules: InlineLinkRule[] | undefined;
  private resolveResourceId: ResolveHarnessResourceId | undefined;
  private acknowledge: HarnessAcknowledgeConfig | undefined;
  private externallyManagedPlatforms: Set<string> = new Set();

  /**
   * Per-chat-thread session bindings, keyed by the chat thread id. We open one
   * `session.subscribe()` per thread on the first inbound message so events
   * render exactly once. Closed in {@link close}.
   */
  private bindings = new Map<string, ThreadBinding>();

  /**
   * Approval cards posted and awaiting a click, keyed by toolCallId. The click
   * handler maps the card back to its Session via the chat thread, then calls
   * `session.respondToToolApproval`.
   */
  private pendingApprovalCards = new Map<string, PendingApprovalRecord>();

  constructor(config: HarnessChannelConfig) {
    const adapters: Record<string, Adapter> = {};
    const adapterConfigs: Record<string, ChannelAdapterConfig> = {};

    for (const [name, value] of Object.entries(config.adapters)) {
      if (value && typeof value === 'object' && 'adapter' in value) {
        const cfg = value as ChannelAdapterConfig;
        adapters[name] = cfg.adapter;
        adapterConfigs[name] = cfg;
      } else {
        adapters[name] = value as Adapter;
        adapterConfigs[name] = { adapter: value as Adapter };
      }
    }

    this.adapters = adapters;
    this.adapterConfigs = adapterConfigs;
    this.harness = config.harness;
    this.handlerOverrides = config.handlers ?? {};
    this.customState = config.state;
    this.userName = config.userName ?? 'Mastra';
    this.chatOptions = config.chatOptions ?? {};
    this.shouldInline = buildInlineMediaCheck(config.inlineMedia);
    this.inlineLinkRules = normalizeInlineLinks(config.inlineLinks);
    this.resolveResourceId = config.resolveResourceId;
    this.acknowledge = config.acknowledge;
    this.channelConfig = config;
  }

  /**
   * Bind this HarnessChannels to its owning Harness. Called by the Harness
   * constructor when `channels` is configured. @internal
   */
  __setHarness(harness: Harness<any>): void {
    this.harness = harness;
  }

  /** Set the logger. */
  __setLogger(logger: IMastraLogger): void {
    this.logger =
      'child' in logger && typeof (logger as any).child === 'function' ? (logger as any).child('CHANNEL') : logger;
  }

  /** Register an adapter dynamically (parallels AgentChannels.__registerAdapter). */
  __registerAdapter(
    platform: string,
    adapter: Adapter,
    config?: ChannelAdapterConfig,
    options?: { managesRoutes?: boolean },
  ): void {
    if (this.adapters[platform]) {
      if (options?.managesRoutes) this.externallyManagedPlatforms.add(platform);
      return;
    }
    this.adapters[platform] = adapter;
    this.adapterConfigs[platform] = config ?? { adapter };
    if (options?.managesRoutes) this.externallyManagedPlatforms.add(platform);
  }

  /** Whether an adapter is registered for the given platform. */
  hasAdapter(platform: string): boolean {
    return platform in this.adapters;
  }

  /** The underlying Chat SDK instance (available after {@link initialize}). */
  get sdk(): Chat | null {
    return this.chat;
  }

  /**
   * Initialize the Chat SDK, register handlers, and start listeners. Mirrors
   * {@link AgentChannels.initialize}. Idempotent.
   */
  async initialize(mastra: Mastra): Promise<void> {
    if (this.chat) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.customState) {
        this.stateAdapter = this.customState;
      } else {
        const storage = mastra.getStorage();
        const memoryStore = storage ? await storage.getStore('memory') : undefined;
        if (!memoryStore) {
          throw new Error(
            'Channels require storage to be configured on the Mastra instance. Configure a storage provider like LibSQLStore.',
          );
        }
        this.stateAdapter = new MastraStateAdapter(memoryStore);
      }

      const { Chat } = await getChatModule();
      const chat = new Chat({
        adapters: this.adapters,
        state: this.stateAdapter,
        userName: this.userName,
        concurrency: { strategy: 'queue' },
        ...this.chatOptions,
      });

      const defaultHandler = (chatThread: Thread, message: Message) => this.handleChatMessage(chatThread, message);

      const { onDirectMessage, onMention, onSubscribedMessage } = this.handlerOverrides;

      if (onDirectMessage !== false) {
        chat.onDirectMessage((thread, message) =>
          typeof onDirectMessage === 'function'
            ? onDirectMessage(thread, message, defaultHandler)
            : defaultHandler(thread, message),
        );
      }
      if (onMention !== false) {
        chat.onNewMention((thread, message) =>
          typeof onMention === 'function'
            ? onMention(thread, message, defaultHandler)
            : defaultHandler(thread, message),
        );
      }
      if (onSubscribedMessage !== false) {
        chat.onSubscribedMessage((thread, message) =>
          typeof onSubscribedMessage === 'function'
            ? onSubscribedMessage(thread, message, defaultHandler)
            : defaultHandler(thread, message),
        );
      }

      chat.onAction(async event =>
        this.handleApprovalAction({ actionId: event.actionId, thread: event.thread as Thread | null }),
      );

      this.chat = chat;
    })();

    return this.initPromise;
  }

  /** Tear down all session subscriptions. */
  close(): void {
    for (const binding of this.bindings.values()) {
      try {
        binding.unsubscribe();
      } catch (err) {
        this.log('debug', 'unsubscribe failed during close', err);
      }
    }
    this.bindings.clear();
    this.pendingApprovalCards.clear();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: unknown): void {
    this.logger?.[level]?.(message, meta as any);
  }

  /**
   * Returns API routes for receiving webhook events from each adapter. One POST
   * route per adapter at `/api/harnesses/{harnessId}/channels/{platform}/webhook`.
   * Skips externally-managed platforms. Mirrors {@link AgentChannels.getWebhookRoutes}.
   */
  getWebhookRoutes(): ApiRoute[] {
    if (!this.harness) return [];
    const harnessId = this.harness.id;
    const routes: ApiRoute[] = [];

    for (const platform of Object.keys(this.adapters)) {
      if (this.externallyManagedPlatforms.has(platform)) continue;
      const self = this;
      routes.push({
        path: `/api/harnesses/${harnessId}/channels/${platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        _mastraInternal: true,
        cors: this.adapterConfigs[platform]?.cors,
        createHandler: async () => {
          return async c => {
            if (self.initPromise) {
              try {
                await self.initPromise;
              } catch {
                return c.json({ error: 'Chat initialization failed' }, 503);
              }
            }
            const sdkInstance = self.chat;
            if (!sdkInstance) {
              return c.json({ error: 'Chat not initialized' }, 503);
            }
            const webhookHandler = (sdkInstance as any).webhooks?.[platform] as Function | undefined;
            if (!webhookHandler) {
              return c.json({ error: `No webhook handler for ${platform}` }, 404);
            }
            let execCtx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
            try {
              execCtx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
            } catch {
              execCtx = undefined;
            }
            const waitUntilFn = execCtx?.waitUntil?.bind(execCtx);
            return webhookHandler(c.req.raw, waitUntilFn ? { waitUntil: waitUntilFn } : undefined);
          };
        },
      });
    }
    return routes;
  }

  /**
   * Handle an inbound platform message: resolve the Session, open its event
   * subscription (once per thread), and forward the message to the Session.
   */
  private async handleChatMessage(chatThread: Thread, message: Message): Promise<void> {
    try {
      const platform = chatThread.adapter.name;
      const defaultResourceId = `${platform}:${chatThread.id}`;
      const resourceId = this.resolveResourceId
        ? await this.resolveResourceId({ platform, thread: chatThread, message, defaultResourceId })
        : defaultResourceId;

      const { content, files } = await this.buildMessageInput(message);

      const { binding, isNew } = await this.ensureBinding(chatThread, resourceId);

      void chatThread.subscribe().catch(err => this.log('debug', 'chatThread.subscribe failed', err));

      if (isNew) {
        void this.runAcknowledgment({ platform, thread: chatThread, message, resourceId });
      }

      await binding.session.sendMessage({ content, ...(files.length ? { files } : {}) });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log('error', `[${chatThread.adapter.name}] Error handling message`, {
        messageId: message.id,
        error: String(err),
      });
      try {
        const adapterConfig = this.adapterConfigs[chatThread.adapter.name];
        const errorMessage = adapterConfig?.formatError
          ? adapterConfig.formatError(error)
          : `❌ Error: ${error.message}`;
        await chatThread.post(errorMessage);
      } catch (postErr) {
        this.log('debug', 'Failed to post error message to thread', postErr);
      }
    }
  }

  /**
   * Fire the opt-in acknowledgment affordances for a freshly started session.
   * Best-effort and isolated: any failure here is logged but never propagates,
   * so it can't drop or delay the user's message. Called only when `isNew`.
   */
  private runAcknowledgment(ctx: HarnessAckContext): void {
    const ack = this.acknowledge;
    if (!ack) return;
    const { platform, thread, message, resourceId } = ctx;

    if (ack.reaction) {
      const adapter = this.adapters[platform];
      if (adapter && typeof adapter.addReaction === 'function') {
        void Promise.resolve()
          .then(() => adapter.addReaction(thread.id, message.id, ack.reaction!))
          .catch(err => this.log('debug', `[${platform}] addReaction failed`, err));
      }
    }

    if (ack.sessionStartMessage) {
      let text: string | undefined;
      try {
        text =
          typeof ack.sessionStartMessage === 'function'
            ? ack.sessionStartMessage({ platform, thread, message, resourceId })
            : ack.sessionStartMessage;
      } catch (err) {
        this.log('debug', `[${platform}] sessionStartMessage resolver threw`, err);
        text = undefined;
      }
      if (text) {
        void Promise.resolve()
          .then(() => thread.post(text!))
          .catch(err => this.log('debug', `[${platform}] sessionStartMessage post failed`, err));
      }
    }
  }

  /**
   * Resolve (and cache) the Session + event subscription for a chat thread. The
   * subscription renders the Session's `HarnessEvent` stream to the thread.
   */
  private async ensureBinding(
    chatThread: Thread,
    resourceId: string,
  ): Promise<{ binding: ThreadBinding; isNew: boolean }> {
    const key = chatThread.id;
    const existing = this.bindings.get(key);
    if (existing) return { binding: existing, isNew: false };

    if (!this.harness) {
      throw new Error(
        'HarnessChannels is not bound to a Harness — pass `harness` in config or configure `channels` on a Harness.',
      );
    }
    // One chat thread ⇒ one resourceId ⇒ one durable Session. `createSession`
    // is get-or-create keyed by resourceId, so deriving `id`/`ownerId` from the
    // resourceId keeps the binding stable across redeliveries and restarts.
    const session = await this.harness.createSession({ id: resourceId, ownerId: resourceId, resourceId });
    const renderState = createHarnessRenderState();
    const deps = this.buildRenderDeps(chatThread);

    const unsubscribe = session.subscribe(event => {
      void handleHarnessEvent(event, renderState, deps).catch(err =>
        this.log('debug', `[${deps.platform}] render error`, err),
      );
    });

    const binding: ThreadBinding = { session, renderState, unsubscribe };
    this.bindings.set(key, binding);
    return { binding, isNew: true };
  }

  /** Build the per-thread render dependencies the renderer needs. */
  private buildRenderDeps(chatThread: Thread): HarnessRenderDeps {
    const platform = chatThread.adapter.name;
    const adapter = this.adapters[platform]!;
    const adapterConfig = this.adapterConfigs[platform];
    const requested = adapterConfig?.toolDisplay;
    const toolDisplay: 'cards' | 'text' | 'hidden' =
      requested === 'text' ? 'text' : requested === 'hidden' ? 'hidden' : 'cards';
    const canRenderApprovalButtons = toolDisplay !== 'text';
    const updateIntervalMs = this.resolveUpdateIntervalMs(adapterConfig);

    return {
      chatThread,
      adapter,
      platform,
      toolDisplay,
      channelToolNames: new Set<string>(),
      canRenderApprovalButtons,
      updateIntervalMs,
      onApprovalPosted: (toolCallId, record) => this.pendingApprovalCards.set(toolCallId, record),
      formatError: adapterConfig?.formatError,
      logger: this.logger,
    };
  }

  private resolveUpdateIntervalMs(adapterConfig: ChannelAdapterConfig | undefined): number {
    const streaming = (adapterConfig as { streaming?: unknown } | undefined)?.streaming;
    if (streaming && typeof streaming === 'object' && 'updateIntervalMs' in streaming) {
      const v = (streaming as { updateIntervalMs?: number }).updateIntervalMs;
      if (typeof v === 'number' && v >= 0) return v;
    }
    return 1000;
  }

  /**
   * Handle an Approve/Deny button click: map the card back to its Session and
   * respond to the parked tool-approval gate.
   */
  private async handleApprovalAction(event: { actionId: string; thread?: Thread | null }): Promise<void> {
    const { actionId } = event;
    if (!actionId.startsWith('tool_approve:') && !actionId.startsWith('tool_deny:')) return;
    try {
      const approved = actionId.startsWith('tool_approve:');
      const toolCallId = actionId.split(':')[1];
      if (!toolCallId) {
        this.log('info', `Missing toolCallId in action event actionId=${actionId}`);
        return;
      }
      const chatThread = (event.thread as Thread | null | undefined) ?? null;
      if (!chatThread) {
        this.log('info', `No thread in action event for toolCallId=${toolCallId}`);
        return;
      }

      const binding = this.bindings.get(chatThread.id);
      if (!binding) {
        this.log('info', `No active session for thread ${chatThread.id}`);
        return;
      }

      this.pendingApprovalCards.delete(toolCallId);
      binding.session.respondToToolApproval({
        decision: approved ? 'approve' : 'decline',
        toolCallId,
      });
    } catch (err) {
      this.log('error', 'Error handling approval action', { error: String(err) });
    }
  }

  /**
   * Normalize a platform {@link Message} into the Session's `{ content, files }`
   * shape. Mirrors the attachment / inline-link handling in
   * {@link AgentChannels} but targets the Session's file format.
   */
  private async buildMessageInput(message: Message): Promise<{ content: string; files: SessionFile[] }> {
    const richText = message.formatted ? chatModule().stringifyMarkdown(message.formatted).trim() : undefined;
    const text = richText || message.text || '';
    const files: SessionFile[] = [];
    const extraText: string[] = [];

    const attachments = message.attachments.filter(a => a.url || a.fetchData);
    for (const att of attachments) {
      if (!att.url && !att.fetchData) continue;
      const mimeType = att.mimeType || (att.type === 'image' ? 'image/png' : undefined);
      if (!mimeType) continue;

      const filename = att.name || att.url?.split('/').pop() || 'file';
      if (this.shouldInline(mimeType)) {
        let data: string | undefined;
        if (att.fetchData) {
          try {
            const buf = await att.fetchData();
            data = `data:${mimeType};base64,${Buffer.from(buf).toString('base64')}`;
          } catch (err) {
            this.log('warn', '[CHANNEL] fetchData failed', { mimeType, error: String(err) });
          }
        } else {
          data = att.url;
        }
        if (data) {
          files.push({ data, mediaType: mimeType, ...(att.name ? { filename: att.name } : {}) });
        } else {
          extraText.push(`[Attachment unavailable: ${filename} (${mimeType})]`);
        }
      } else {
        extraText.push(`[Attached file: ${filename} (${mimeType})${att.url ? ` — ${att.url}` : ''}]`);
      }
    }

    if (this.inlineLinkRules && text) {
      for (const url of extractUrls(text)) {
        const rule = findInlineLinkRule(url, this.inlineLinkRules);
        if (!rule) continue;
        if (rule.forcedMimeType) {
          files.push({ data: url, mediaType: rule.forcedMimeType });
        } else {
          const contentType = await headContentType(url, this.logger);
          if (contentType && this.shouldInline(contentType)) {
            files.push({ data: url, mediaType: contentType });
          }
        }
      }
    }

    const content = [text, ...extraText].filter(Boolean).join('\n');
    return { content, files };
  }
}
