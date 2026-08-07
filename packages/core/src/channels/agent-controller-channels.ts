import type { Message, Thread } from 'chat';

import type { Agent } from '../agent/agent';
import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { AgentSignalContents } from '../agent/signals';
import type { AgentController } from '../agent-controller/agent-controller';
import type { Session } from '../agent-controller/session';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import type { RequestContext } from '../request-context';

import { AgentChannels } from './agent-channels';
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

/** Configuration for {@link AgentControllerChannels}. */
export interface AgentControllerChannelsConfig extends ChannelConfig {
  /**
   * Called once per session per process, after the session is bound to its
   * thread and before the first message dispatches. Concurrent messages on a
   * new session wait for the hook to settle rather than dispatching on an
   * unconfigured session. See {@link ChannelSessionStart}.
   */
  onSessionStart?: ChannelSessionStart;
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

  /**
   * One start-hook invocation per session resourceId. A map of promises rather
   * than a set of ids: concurrent messages on a new thread must all WAIT for
   * the hook, not just skip it, or the losers dispatch on an unconfigured
   * session. In-memory, matching the v1 scope where sessions themselves don't
   * survive a restart: a session rebuilt after a restart is a new session and
   * gets configured again.
   */
  private sessionStartRuns = new Map<string, Promise<void>>();

  constructor(config: AgentControllerChannelsConfig) {
    super(config);
    this.onSessionStart = config.onSessionStart;
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
    providerOptions: MastraProviderMetadata;
    requestContext: RequestContext;
    thread: StorageThreadType;
    memory: { thread: string; resource: string };
    autoResumeSuspendedTools: true | undefined;
  }): Promise<void> {
    const { signalContents, attributes, providerOptions, requestContext, thread, autoResumeSuspendedTools } = args;

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

    const result = session.sendSignal({
      content: signalContents,
      ifActive: { attributes },
      ifIdle: { attributes },
      requestContext,
      providerOptions,
    });
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
    toolCallId,
    requestContext,
    memory,
  }: {
    decision: 'approve' | 'decline';
    toolCallId: string;
    requestContext: RequestContext;
    memory: { thread: string; resource: string };
  }): Promise<void> {
    const session = await this.getSessionForThread({ id: memory.thread, resourceId: memory.resource });
    if (!session.approval.isArmed() || session.approval.getToolCallId() !== toolCallId) {
      this.log(
        'info',
        `Ignoring stale tool ${decision === 'approve' ? 'approval' : 'denial'} action (no matching parked approval for toolCallId=${toolCallId})`,
      );
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
    const session = await controller.createSession({
      resourceId: channelResourceId,
      id: channelResourceId,
      ownerId: controller.id,
      requestContext,
    });
    // Bind the mapped thread. Guard is mandatory: `switch` aborts any active
    // run, so never re-switch when the session is already on this thread.
    if (session.thread.getId() !== thread.id) {
      await session.thread.switch({ threadId: thread.id });
    }
    await this.runSessionStartHook(session, thread, requestContext);
    return session;
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
    let run = this.sessionStartRuns.get(thread.resourceId);
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
      this.sessionStartRuns.set(thread.resourceId, run);
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
