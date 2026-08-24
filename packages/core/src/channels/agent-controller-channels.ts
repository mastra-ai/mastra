import type { Message, SlashCommandEvent, Thread } from 'chat';

import type { Agent } from '../agent/agent';
import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { AgentSignalContents } from '../agent/signals';
import type { AgentController } from '../agent-controller/agent-controller';
import type { Session } from '../agent-controller/session';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import type { RequestContext } from '../request-context';

import { AgentChannels } from './agent-channels';
import { ChannelSessionRejectedError } from './errors';
import type { ChannelConfig } from './types';

/** Context passed to {@link AgentControllerChannelsConfig.onSessionStart}. */
export interface ChannelSessionStartContext {
  /**
   * The controller session, already bound to `thread`. Bound before the hook
   * runs on purpose: session settings persist to the bound thread's metadata,
   * so a hook that writes settings must not race the thread switch.
   */
  session: Session<any>;
  /** The mapped Mastra thread the session is bound to. */
  thread: Pick<StorageThreadType, 'id' | 'resourceId'>;
  /** Request context of the message that started the session, when there is one. */
  requestContext?: RequestContext;
}

/**
 * Configure a session the first time a channel thread reaches it, before the
 * inbound message is dispatched.
 *
 * The seam exists because a host can name a session (`resolveResourceId`) but
 * never receives the `Session` object — it is created here, inside the channel
 * machinery. Without this hook a host that resolves its own resourceIds can
 * only ever configure sessions the web UI created, and channel-created sessions
 * silently run on the SDK's built-in defaults.
 *
 * Errors are logged and swallowed: configuration is best-effort and must not
 * drop the message that triggered it.
 */
export type ChannelSessionStart = (ctx: ChannelSessionStartContext) => void | Promise<void>;

/** Context passed to {@link AgentControllerChannelsConfig.resolveSession}. */
export interface ChannelSessionResolveContext {
  /**
   * The bound controller. The resolver must create its session through this
   * controller so the channels instance stays the single owner of outbound
   * delivery for that session.
   */
  controller: AgentController<any>;
  /** The mapped Mastra thread the returned session will be bound to. */
  thread: Pick<StorageThreadType, 'id' | 'resourceId'>;
  /** Request context of the inbound message or approval action, when there is one. */
  requestContext?: RequestContext;
}

/**
 * Create the controller session for a mapped channel thread, replacing the
 * default `controller.createSession({ resourceId: thread.resourceId, ... })`.
 *
 * `onSessionStart` cannot serve this purpose: it runs after the session already
 * exists and its errors are swallowed, so a host cannot use it to authorize or
 * route. This hook runs *before* any session is created and its errors
 * propagate, which is what makes fail-closed authorization possible — a host
 * that rejects the request ends up with no session, no model call, and no
 * output.
 *
 * It also runs on approval continuations, so a shared install can revalidate
 * the execution principal on every approve/decline rather than only on the
 * message that opened the session.
 *
 * The returned session must own the mapped thread, i.e. be created under
 * `thread.resourceId` — a session can only bind threads it owns. Hosts that
 * want a different session identity choose it on both ends, by pairing this
 * with the channels `resolveResourceId` option.
 */
export type ChannelSessionResolve = (ctx: ChannelSessionResolveContext) => Session<any> | Promise<Session<any>>;

/** Context passed to {@link AgentControllerChannelsConfig.onStaleToolApproval}. */
export interface ChannelStaleToolApprovalContext {
  /** Which button the user pressed on the approval card. */
  decision: 'approve' | 'decline';
  /** The tool call the action referred to. */
  toolCallId: string;
  /**
   * The run the approval card was rendered for — the run the user actually
   * answered. This is the id to settle against: after a restart it is the only
   * one that still identifies that attempt.
   */
  runId: string;
  /**
   * The run currently on the session, when there is one. Usually `null` for a
   * restart-recovered action, and a *different* run when the session has since
   * moved on — never assume it matches {@link runId}.
   */
  currentRunId: string | null;
  /** Request context of the approval action. */
  requestContext: RequestContext;
  /** The mapped thread/resource the approval card belongs to. */
  memory: { thread: string; resource: string };
  /** The session the action resolved to. */
  session: Session<any>;
}

/**
 * Called when an approval action arrives with no matching parked approval gate
 * — the usual cause being a process restart, which drops the in-memory gate and
 * makes every recovered approval stale.
 *
 * Core still never executes the tool action; the hook exists so a durable host
 * can settle that exact attempt (mark it interrupted, retryable, expired)
 * instead of silently dropping the user's click. Errors propagate.
 */
export type ChannelStaleToolApproval = (ctx: ChannelStaleToolApprovalContext) => void | Promise<void>;

/** Configuration for {@link AgentControllerChannels}. */
export interface AgentControllerChannelsConfig extends ChannelConfig {
  /**
   * Called once per session per process, after the session is bound to its
   * thread and before the first message dispatches. Concurrent messages on a
   * new session wait for the hook to settle rather than dispatching on an
   * unconfigured session. See {@link ChannelSessionStart}.
   */
  onSessionStart?: ChannelSessionStart;
  /**
   * Creates the session instead of the built-in `createSession` call, before
   * any session exists. Use this — not `onSessionStart` — for authorization and
   * routing: it can fail closed. See {@link ChannelSessionResolve}.
   */
  resolveSession?: ChannelSessionResolve;
  /**
   * Called when an approval action has no matching parked gate, typically after
   * a restart. See {@link ChannelStaleToolApproval}.
   */
  onStaleToolApproval?: ChannelStaleToolApproval;
}

/**
 * Runs an AgentController inside chat channels (Slack, Discord, ...).
 *
 * Extends {@link AgentChannels} so all inbound machinery (thread mapping,
 * history, attachments, event context) and all outbound rendering
 * (`ChatChannelOutputProcessor` with native streaming, tool cards, typing
 * status) are reused unchanged. Only the dispatch seams differ: instead of
 * routing into a bare agent, inbound messages route into a controller
 * `Session` — one durable session per chat thread, keyed by the mapped
 * Mastra thread's `resourceId`.
 *
 * V1 targets long-lived servers: controller sessions are in-memory objects
 * and do not survive process restarts.
 */
export class AgentControllerChannels extends AgentChannels {
  private controller: AgentController<any> | null = null;

  /**
   * Session resourceIds whose adapter can't render approval buttons, so their
   * runs must auto-approve tools (`requireToolApproval: false`) instead of
   * parking forever on an approval nobody can answer. Kept outside session
   * state on purpose: state is validated against the controller's
   * `stateSchema`, which would strip (or reject) an injected flag. Refreshed
   * on every inbound message; in-memory only, matching the v1 long-lived
   * server scope.
   */
  private autoApproveResourceIds = new Set<string>();

  /** See {@link AgentControllerChannelsConfig.onSessionStart}. */
  private readonly onSessionStart: ChannelSessionStart | undefined;

  /** See {@link AgentControllerChannelsConfig.resolveSession}. */
  private readonly resolveSession: ChannelSessionResolve | undefined;

  /** See {@link AgentControllerChannelsConfig.onStaleToolApproval}. */
  private readonly onStaleToolApproval: ChannelStaleToolApproval | undefined;

  /**
   * One start-hook invocation per session resourceId. A map of promises rather
   * than a set of ids: concurrent messages on a new thread must all WAIT for
   * the hook, not just skip it, or the losers dispatch on an unconfigured
   * session. In-memory, matching the v1 scope where sessions themselves don't
   * survive a restart: a session rebuilt after a restart is a new session and
   * gets configured again. Keyed by session rather than by thread because a
   * `resolveSession` host can hand back a different session for the same thread
   * (per-principal routing), and each of those is a session that has never been
   * configured.
   */
  private sessionStartRuns = new WeakMap<Session<any>, Promise<void>>();

  constructor(config: AgentControllerChannelsConfig) {
    super(config);
    this.onSessionStart = config.onSessionStart;
    this.resolveSession = config.resolveSession;
    this.onStaleToolApproval = config.onStaleToolApproval;
  }

  /** @internal Called by AgentController's constructor to bind itself. */
  __setController(controller: AgentController<any>): void {
    this.controller = controller;
  }

  /**
   * @internal Consulted by the controller's run-option builder: `true` when
   * the session's channel adapter can't render approval buttons and tool
   * calls must auto-approve (the session-side equivalent of the base agent
   * path's `autoResumeSuspendedTools`).
   */
  __isAutoApproveResource(resourceId: string): boolean {
    return this.autoApproveResourceIds.has(resourceId);
  }

  /**
   * @internal No-op override. The controller attaches this instance to its
   * mode agents via `Agent.setChannels`, which calls `__setAgent(agent)` —
   * with multiple mode agents the last one would win. Every `this.agent` use
   * is overridden in this subclass, so keep the base field unset rather than
   * holding a misleading ref.
   */
  override __setAgent(_agent: Agent<any, any, any, any>): void {}

  protected override getOwnerId(): string | null {
    return this.controller?.id ?? null;
  }

  protected override getWebhookBasePath(): string {
    return `/api/agent-controllers/${this.getOwnerId()}`;
  }

  protected override getMastra(): Mastra | undefined {
    return this.controller?.getMastra();
  }

  /**
   * One session per chat thread: unless the user supplied a custom
   * `resolveResourceId`, key new Mastra threads (and therefore controller
   * sessions) off the platform + external thread id.
   */
  protected override resolveChannelResourceId(args: {
    platform: string;
    chatThread: Thread;
    message: Message;
    defaultResourceId: string;
  }): string | (() => string | Promise<string>) {
    const base = super.resolveChannelResourceId(args);
    // The base returns a thunk only when a custom resolveResourceId was
    // configured — honor it. Otherwise derive the channel-thread key. The
    // adapter's thread id is already platform-prefixed (e.g. `slack:C123:ts`),
    // so don't prepend the platform again or the key double-prefixes.
    if (typeof base === 'function') return base;
    return `channel:${args.chatThread.id}`;
  }

  protected override resolveSlashCommandResourceId(event: SlashCommandEvent): string {
    return 'channel:' + event.channel.id;
  }

  /**
   * Route an inbound chat message into the controller session bound to this
   * chat thread. Output renders back to the platform through the channels
   * output processor: the `requestContext` built by the base class (carrying
   * the channel context and render context) flows through the session into
   * the run.
   */
  protected override async dispatchInboundMessage(args: {
    signalContents: AgentSignalContents;
    attributes: Record<string, string | undefined>;
    signalMetadata: Record<string, unknown>;
    providerOptions: MastraProviderMetadata;
    requestContext: RequestContext;
    thread: StorageThreadType;
    memory: { thread: string; resource: string };
    autoResumeSuspendedTools: true | undefined;
  }): Promise<void> {
    const {
      signalContents,
      attributes,
      signalMetadata,
      providerOptions,
      requestContext,
      thread,
      autoResumeSuspendedTools,
    } = args;

    // The tenant, when there is one, is already stamped on `requestContext` by
    // the channel handler that accepted this message — a host that maps
    // platform senders to Mastra users writes `user` before calling
    // `defaultHandler`, and gating an unlinked sender means not calling it at
    // all. Core dispatches whatever reaches it.
    const session = await this.getSessionForThread(thread, requestContext);

    // The session equivalent of the base path's `autoResumeSuspendedTools`:
    // controller runs set `requireToolApproval` from this marker, so on
    // adapters that can't render approval buttons the run auto-approves
    // instead of parking forever on an approval nobody can answer. Tracked
    // outside session state so the controller's `stateSchema` (which would
    // strip or reject an injected key) never sees it.
    const sessionResourceId = thread.resourceId;
    if (autoResumeSuspendedTools) {
      this.autoApproveResourceIds.add(sessionResourceId);
    } else {
      this.autoApproveResourceIds.delete(sessionResourceId);
    }

    const result = session.sendSignal(
      {
        type: 'user',
        tagName: 'user',
        contents: signalContents,
        attributes,
        ...(Object.keys(signalMetadata).length > 0 ? { metadata: signalMetadata } : {}),
        providerOptions,
      },
      { requestContext },
    );
    await result.accepted;
  }

  /**
   * Resolve an approval-card "approve" action against the controller session's
   * parked tool-approval gate. The run engine — awaiting the gate inside its
   * stream-consumer loop — performs the actual resume itself and keeps
   * consuming, so the continuation renders through the output processor.
   */
  protected override async dispatchApproval(args: {
    runId: string;
    toolCallId: string;
    requestContext: RequestContext;
    memory: { thread: string; resource: string };
  }): Promise<void> {
    await this.respondToSessionApproval({ decision: 'approve', ...args });
  }

  /**
   * Resolve an approval-card "deny" action against the controller session's
   * parked tool-approval gate (see {@link dispatchApproval}).
   */
  protected override async dispatchDecline(args: {
    runId: string;
    toolCallId: string;
    requestContext: RequestContext;
    memory: { thread: string; resource: string };
  }): Promise<void> {
    await this.respondToSessionApproval({ decision: 'decline', ...args });
  }

  /**
   * Shared approve/decline path. Never calls the session's internal
   * `approveToolCall`/`declineToolCall` executors directly — the engine parked
   * at the gate owns the resume. `respondToToolApproval` is a silent no-op
   * when nothing is armed or the toolCallId mismatches, so staleness is
   * pre-checked explicitly (an armed gate does not survive process restarts,
   * so restart-recovered approvals are always stale — consistent with the
   * v1 long-lived-server scope).
   */
  private async respondToSessionApproval({
    decision,
    runId,
    toolCallId,
    requestContext,
    memory,
  }: {
    decision: 'approve' | 'decline';
    runId: string;
    toolCallId: string;
    requestContext: RequestContext;
    memory: { thread: string; resource: string };
  }): Promise<void> {
    // The action's requestContext flows in so a `resolveSession` host revalidates
    // the execution principal on every continuation, not just on the message
    // that opened the session.
    const session = await this.getSessionForThread({ id: memory.thread, resourceId: memory.resource }, requestContext);
    if (!session.approval.isArmed() || session.approval.getToolCallId() !== toolCallId) {
      this.log(
        'info',
        `Ignoring stale tool ${decision === 'approve' ? 'approval' : 'denial'} action (no matching parked approval for toolCallId=${toolCallId})`,
      );
      // Core still refuses to execute the action. The hook only lets a durable
      // host settle the attempt the click referred to, which is otherwise
      // dropped with nothing but a log line.
      await this.onStaleToolApproval?.({
        decision,
        toolCallId,
        // The action's own runId, not the session's: the point of the hook is
        // settling an attempt from before a restart, and by then the session's
        // current run is null or something else entirely.
        runId,
        currentRunId: session.getCurrentRunId(),
        requestContext,
        memory,
        session,
      });
      return;
    }
    // The requestContext carries the channel render context, so the resumed
    // stream renders back to the platform through the output processor.
    session.respondToToolApproval({ decision, toolCallId, requestContext });
  }

  /**
   * Get-or-create the durable controller session for a mapped channel thread
   * and bind it to that thread. Keyed off the thread's own `resourceId` so
   * pre-existing threads (custom resolveResourceId, or created before this
   * feature) always pass the session's thread-ownership check.
   */
  protected async getSessionForThread(
    thread: Pick<StorageThreadType, 'id' | 'resourceId'>,
    requestContext?: RequestContext,
  ): Promise<Session<any>> {
    const controller = this.requireController();
    const channelResourceId = thread.resourceId;
    // `createSession` is get-or-create keyed by resourceId, so follow-up messages
    // on the same thread reuse the cached session bound to this thread. The
    // dispatch requestContext must flow in: a dynamic workspace factory is
    // resolved once at session creation with THIS context, and it may need the
    // stamped tenant (`user`) to authorize a repo-backed session workspace.
    // The resolver replaces this call entirely and its errors propagate, so a
    // host can refuse the request before a session, a model call, or any output
    // exists. It gets the same controller so this channels instance stays the
    // owner of outbound delivery for whatever session it returns. A throw is
    // tagged as a refusal so the channel error boundary keeps it out of the
    // chat thread instead of posting the host's authorization message there.
    const session = this.resolveSession
      ? await this.resolveChannelSession({ controller, thread, requestContext })
      : await controller.createSession({
          resourceId: channelResourceId,
          id: channelResourceId,
          ownerId: controller.id,
          requestContext,
        });
    // A session may only bind threads it owns, and the mapped thread's owner is
    // fixed by the channel's resourceId mapping. Catching the mismatch here
    // turns an opaque "Thread not found" from deep inside the session into the
    // actual instruction: line the two up, which hosts do by pairing this
    // resolver with `resolveResourceId`.
    if (this.resolveSession && session.identity.getResourceId() !== channelResourceId) {
      throw new Error(
        `resolveSession returned a session for resourceId="${session.identity.getResourceId()}", but the mapped channel thread belongs to resourceId="${channelResourceId}". A session can only bind threads it owns — resolve the session under the thread's resourceId, or map the thread onto the session's resourceId with the channels \`resolveResourceId\` option.`,
      );
    }
    // Bind the mapped thread. Guard is mandatory: `switch` aborts any active
    // run, so never re-switch when the session is already on this thread.
    if (session.thread.getId() !== thread.id) {
      await session.thread.switch({ threadId: thread.id });
    }
    await this.runSessionStartHook(session, thread, requestContext);
    return session;
  }

  /**
   * Call the host's resolver and tag anything it throws as a refusal. Covers
   * synchronous throws too — the hook may return a `Session` directly, so a
   * plain `.catch()` on the return value would miss them.
   */
  private async resolveChannelSession(ctx: ChannelSessionResolveContext): Promise<Session<any>> {
    try {
      return await this.resolveSession!(ctx);
    } catch (cause) {
      throw new ChannelSessionRejectedError(cause);
    }
  }

  /**
   * Run the configured session-start hook at most once per session. Fires after
   * the thread binding above, so a hook that persists session settings writes
   * them to the thread the session actually ends up on.
   */
  private async runSessionStartHook(
    session: Session<any>,
    thread: Pick<StorageThreadType, 'id' | 'resourceId'>,
    requestContext?: RequestContext,
  ): Promise<void> {
    const onSessionStart = this.onSessionStart;
    if (!onSessionStart) return;
    // Memoize before the first await: two messages arriving together on a new
    // thread both reach this point. The first starts the hook; every later
    // caller awaits the same run, so no message dispatches before the session
    // is configured.
    let run = this.sessionStartRuns.get(session);
    if (!run) {
      run = (async () => {
        try {
          await onSessionStart({ session, thread, requestContext });
        } catch (error) {
          // Best-effort by contract: a session that couldn't be configured
          // still answers the message, on whatever defaults it was created
          // with.
          this.log('error', `Channel session-start hook failed for resourceId=${thread.resourceId}: ${error}`);
        }
      })();
      this.sessionStartRuns.set(session, run);
    }
    await run;
  }

  private requireController(): AgentController<any> {
    if (!this.controller) {
      throw new Error(
        'AgentControllerChannels is not bound to an AgentController. Pass it via `channels` in AgentControllerConfig.',
      );
    }
    return this.controller;
  }
}
