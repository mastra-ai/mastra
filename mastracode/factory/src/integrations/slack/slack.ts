import type { ChannelHandler, ChannelHandlers, ResolveResourceId, ResolveThreadId } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import { createSlackAdapter } from '@mastra/slack';
import { Card, Actions, LinkButton } from 'chat';

import type { ChannelAccountLink, ChannelIdentityStorage } from '../../storage/domains/channel-identity/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { FactoryChannelsConfig } from '../base.js';

import { gateDispatch, rawTeamId, type SlackSourceControl } from './gates.js';

// Derive the thread/message types from the core handler signature rather than
// importing them from `chat` directly: mc-web can resolve a different `chat`
// version than @mastra/core, and the two `Thread`/`Message` declarations are
// structurally incompatible (private fields). Using the handler's own types
// keeps everything on one version.
type HandlerThread = Parameters<ChannelHandler>[0];
type HandlerMessage = Parameters<ChannelHandler>[1];

/** Dependencies the Slack channel handlers close over, injected from the web entry. */
interface SlackChannelDeps {
  /**
   * The factory's reverse-index store mapping a Slack sender to a Mastra
   * tenant. When provided, inbound messages from an unlinked sender are not
   * dispatched — the run only proceeds (with the sender's tenant stamped on
   * the request context) once they've linked their account. Unlinked senders
   * get an ephemeral "connect your account" card instead.
   */
  accountLinks?: ChannelIdentityStorage;
  /**
   * Factory projects domain. When provided (alongside `accountLinks`), a
   * linked sender's run must also resolve to a Factory project before it
   * dispatches: their link's default factory, else their tenant's only
   * factory (stamped back onto the link), else an ephemeral "pick a default
   * factory" card and no run. Unset → no factory routing (runs dispatch as
   * before).
   */
  projects?: FactoryProjectsStorage;
  /**
   * Narrow source-control surface used to make new Slack threads repo-backed:
   * when the sender is linked and their factory has a repository, the thread's
   * resourceId becomes a Factory user-session id (repo cloned on a
   * `slack/{threadTs}` branch) instead of the chat-only `channel:...` id.
   * Absent (no GitHub App configured) → chat-only sessions as before.
   */
  sourceControl?: SlackSourceControl;
  /**
   * Factory work-items domain. When provided, a dispatched new-session thread
   * (DM or mention) upserts a Work-board card in Building (`execute`) carrying
   * the Slack thread as its external source and binding the repo-backed
   * session. Best-effort — a failure never blocks the run. Unset → no card.
   */
  workItems?: WorkItemsStorage;
}

/**
 * Deterministic per-thread branch name: `slack/{threadTs}` with characters
 * outside the sandbox git-ref allow-list (`[A-Za-z0-9_./-]`, and `.` for
 * readability) mapped to `-`. `thread.id` is `{channelId}:{threadTs}`
 * (platform-prefixed on handler threads) — the trailing segment is the ts.
 */
function threadBranch(threadId: string): string {
  const ts = threadId.split(':').at(-1) ?? threadId;
  return `slack/${ts.replace(/[^A-Za-z0-9_/-]/g, '-')}`;
}

/**
 * Resolve the resourceId for a NEW Slack channel thread. A linked sender whose
 * factory has a repository gets a Factory user-session id — the controller
 * session then materializes the repo sandbox via the factory's dynamic
 * workspace (clone + PAT), the session shows up in the web Sessions list, and
 * View Session deep-links land on the normal workspace route. Everything else
 * (unlinked, unrouted, repo-less, or no GitHub) keeps the chat-only
 * `defaultResourceId`.
 *
 * Pure lookups only — cards for unlinked/unrouted senders are the dispatch
 * gate's job; this hook must never post.
 */
export function createChannelResourceIdResolver(deps: SlackChannelDeps): ResolveResourceId {
  const { accountLinks, projects, sourceControl } = deps;
  return async ({ platform, thread, message }) => {
    // NOT the hook's `defaultResourceId`: configuring a custom resolver
    // bypasses AgentControllerChannels' own `channel:{thread.id}` derivation
    // (agent-controller-channels.ts `resolveChannelResourceId`), and the base
    // default is the per-USER memory key. Chat-only fallbacks must stay
    // per-thread, so reproduce the controller default here.
    const chatOnlyResourceId = `channel:${thread.id}`;
    if (!accountLinks || !projects || !sourceControl) return chatOnlyResourceId;
    try {
      const externalTeamId = rawTeamId(message.raw);
      if (!externalTeamId) return chatOnlyResourceId;
      const link = await accountLinks.getAccountLink({
        platform,
        externalTeamId,
        externalUserId: message.author.userId,
      });
      if (!link) return chatOnlyResourceId;

      // Same chain as `resolveFactoryForLink`, minus prompts/stamping: the
      // dispatch gate has already run (and stamped a lone factory) by the
      // time a new thread is created, so this is a read-only re-resolve.
      const orgId = link.orgId ?? '';
      let factoryProjectId: string | undefined;
      if (link.defaultFactoryProjectId && (await projects.get({ orgId, id: link.defaultFactoryProjectId }))) {
        factoryProjectId = link.defaultFactoryProjectId;
      } else if (orgId) {
        const factories = await projects.list({ orgId });
        if (factories.length === 1) factoryProjectId = factories[0]!.id;
      }
      if (!factoryProjectId) return chatOnlyResourceId;

      const repo = await sourceControl.resolveProjectRepository({ orgId, factoryProjectId });
      if (!repo) return chatOnlyResourceId;

      const branch = threadBranch(thread.id);
      const existing = await sourceControl.getSessionForBranch({
        projectRepositoryId: repo.projectRepositoryId,
        userId: link.userId,
        branch,
      });
      if (existing) return existing.sessionId;
      const session = await sourceControl.createSession({
        projectRepositoryId: repo.projectRepositoryId,
        orgId,
        userId: link.userId,
        branch,
        baseBranch: repo.baseBranch,
      });
      return session.sessionId;
    } catch (error) {
      // Fall back to a chat-only session rather than dropping the message.
      console.warn('[slack] repo-backed session resolution failed for thread', thread.id, error);
      return chatOnlyResourceId;
    }
  };
}

/**
 * Thread id for a NEW Slack channel thread. Repo-backed threads take the
 * user-session id AS their thread id, matching the web convention
 * (FactoryStartCoordinator seeds threads with threadId = sessionId) so
 * `/workspaces/{sessionId}/threads/{sessionId}` resolves Slack-created
 * sessions exactly like web-created ones — no `?resourceId=` override needed.
 * Chat-only threads keep the default random id: their `channel:...`
 * resourceId is a memory key, not a unique thread id.
 */
export const resolveChannelThreadId: ResolveThreadId = ({ resourceId, defaultThreadId }) =>
  resourceId.startsWith('channel:') ? defaultThreadId : resourceId;

/**
 * The internal Mastra thread the framework created for a channel conversation.
 * The handler's `thread.id` is the platform thread id (e.g. `slack:C123:ts`),
 * NOT the internal UUID — the mapping lives in the stored thread's channel
 * metadata.
 */
async function findInternalThread(mastra: Mastra | undefined, thread: HandlerThread) {
  const store = await mastra?.getStorage()?.getStore('memory');
  const { threads } = (await store?.listThreads({
    filter: {
      metadata: {
        channel_platform: thread.adapter.name,
        channel_externalThreadId: thread.id,
        channel_externalChannelId: thread.channelId,
      },
    },
    perPage: 1,
  })) ?? { threads: [] };
  return threads[0];
}

/**
 * Build the "new session" handler for mention / direct-message events. A mention or
 * DM on a not-yet-subscribed thread starts a NEW session; once subscribed, later
 * events are follow-ups and don't re-announce.
 */
/**
 * Upsert the Work-board card for a dispatched Slack-thread run. Keyed on the
 * thread via `externalSource` — the work-items domain's unique
 * `(factory_project_id, source_key)` index makes repeat messages reuse the
 * same card, and `reuseMode: 'preserve'` keeps a card a human already dragged
 * across stages untouched. The card lands in Building (`execute`) for every
 * dispatched thread (DM or mention) — there is deliberately no per-origin
 * stage split; smart routing is a follow-up.
 *
 * The session id / branch / threadId and the workspace deep-link are resolved
 * by the caller (which already looked up the internal thread), so this helper
 * just shapes and writes. Best-effort: the run is already dispatched, so a
 * failure logs instead of throwing — work-item creation must never abort a Slack run.
 */
export async function upsertThreadWorkItem({
  workItems,
  thread,
  message,
  link,
  factoryProjectId,
  session,
  url,
}: {
  workItems: WorkItemsStorage;
  thread: HandlerThread;
  message: HandlerMessage;
  link: ChannelAccountLink;
  factoryProjectId: string;
  /**
   * The repo-backed Factory session to bind under the `chat` role, or
   * `undefined` for a chat-only thread (no Factory session to bind).
   */
  session?: { sessionId: string; branch: string; threadId: string };
  /** Workspace deep-link to the running session; omitted when no public URL. */
  url?: string;
}): Promise<void> {
  try {
    const title = message.text.length > 80 ? `${message.text.slice(0, 79)}…` : message.text;

    await workItems.upsert({
      orgId: link.orgId ?? '',
      userId: link.userId,
      factoryProjectId,
      reuseMode: 'preserve',
      input: {
        title: title || 'Slack thread',
        // `integrationId` is the platform ('slack'); `type` is a single
        // constant (no DM/mention distinction); `externalId` is the stable
        // platform thread id — together they form the idempotency key.
        externalSource: {
          integrationId: thread.adapter.name,
          type: 'slack-thread',
          externalId: thread.id,
          ...(url ? { url } : {}),
        },
        stages: ['execute'],
        ...(session ? { sessions: { chat: session } } : {}),
      },
    });
  } catch (error) {
    console.warn('[slack] work-item creation failed for thread', thread.id, error);
  }
}

function createNewSessionChatHandler(deps: SlackChannelDeps): ChannelHandler {
  const { workItems } = deps;
  return async (thread, message, defaultHandler, ctx) => {
    // Gate on the sender having linked their Slack account to a Mastra tenant.
    // Unlinked → post the ephemeral Connect card and stop; no session/run is
    // created (which would otherwise be tenant-less and fail credential
    // resolution). This handler is the only gate — core dispatches whatever
    // reaches it — so every slot that can start a run must call it.
    const gate = await gateDispatch(thread, message, deps, ctx);
    if (!gate) return;

    // A mention on a not-yet-subscribed thread is a NEW session. The
    // default handler auto-subscribes, so once subscribed this is a
    // follow-up mention — don't re-announce.
    const isNewSession = !(await thread.isSubscribed());

    // Run the framework handler first so the internal Mastra thread and
    // controller session are created before we build the deep link.
    await defaultHandler(thread, message);

    if (!isNewSession) return;

    // The internal-thread lookup and deep-link are needed by BOTH the
    // announcement card AND work-item creation, so they run BEFORE the
    // card-only `MASTRACODE_PUBLIC_URL` gate — a deployment without a public
    // origin should still create board cards, just without a clickable link.
    const internalThread = await findInternalThread(ctx.mastra, thread);
    if (!internalThread) {
      console.warn('[onMention] no internal thread found for', thread.id);
      return;
    }

    // When the sender routed to a factory we know exactly which workspace the
    // session belongs to — deep-link straight into it. A repo-backed thread's
    // resourceId IS the Factory user-session id, so the link lands on the same
    // route a web-started run navigates to; chat-only threads keep the literal
    // `channel` segment (the real resource rides the `?resourceId=` override).
    // Unrouted senders fall back to the factory-agnostic /threads/ redirect.
    // One predicate drives both the path segment and the query param, so the
    // two can never disagree about what the URL already carries.
    const isChatOnly = internalThread.resourceId.startsWith('channel:');
    const workspaceSegment = isChatOnly ? 'channel' : encodeURIComponent(internalThread.resourceId);
    const threadPath = gate.routed
      ? `/factories/${encodeURIComponent(gate.routed.factoryProjectId)}/workspaces/${workspaceSegment}/threads/${encodeURIComponent(internalThread.id)}`
      : `/threads/${internalThread.id}`;

    // The param is an override for a URL that can't otherwise name its
    // resource. A routed repo-backed thread already spells the resourceId out
    // as its workspace segment, so appending it again is duplication the app
    // ignores. Chat-only threads need it (their segment is the literal string
    // `channel`), and so does the unrouted fallback, which has no workspace
    // segment at all — `ChannelThreadRedirect` forwards the search through.
    //
    // One shared deep-link: the card's button and the work-item `url` read the
    // SAME value so they can never drift. Undefined without a public origin —
    // the card is then skipped, but the work item is still created (url omitted).
    const needsResourceParam = isChatOnly || !gate.routed;
    const deepLink = process.env.MASTRACODE_PUBLIC_URL
      ? needsResourceParam
        ? `${process.env.MASTRACODE_PUBLIC_URL}${threadPath}?resourceId=${encodeURIComponent(internalThread.resourceId)}`
        : `${process.env.MASTRACODE_PUBLIC_URL}${threadPath}`
      : undefined;

    // A dispatched, routed new-session thread becomes a Work-board card in
    // Building. Only routed senders (linked → factory) have the org/user/factory
    // a work item needs. Bind the repo-backed Factory session under the `chat`
    // role; a chat-only `channel:` resourceId is NOT a session id, so bind
    // nothing rather than a bad id. Best-effort (the helper swallows failures).
    if (workItems && gate.routed?.slackWorkItemsEnabled) {
      const session = isChatOnly
        ? undefined
        : { sessionId: internalThread.resourceId, branch: threadBranch(thread.id), threadId: internalThread.id };
      await upsertThreadWorkItem({
        workItems,
        thread,
        message,
        link: gate.routed.link,
        factoryProjectId: gate.routed.factoryProjectId,
        session,
        url: deepLink,
      });
    }

    // The announcement card is only useful with a public origin to deep-link
    // to — otherwise the link would be `undefined/threads/...`. Without one the
    // session (and now the work item) still exist; we just skip the broken card.
    if (!deepLink) return;

    await thread.post(
      Card({
        title: 'New session started',
        children: [Actions([LinkButton({ url: deepLink, label: 'View session' })])],
      }),
    );
  };
}
export const createHandlers = (deps: SlackChannelDeps): ChannelHandlers => {
  const newSessionChatHandler = createNewSessionChatHandler(deps);

  return {
    onSubscribedMessage: async (thread, message, defaultHandler, ctx) => {
      // `aside` as its own leading word lets humans talk in a subscribed
      // thread without the bot replying. Word boundary so messages that
      // merely start with "aside..." (e.g. "asides can wait") still route.
      if (/^aside\b/i.test(message.text)) return;
      // A subscribed follow-up from an unlinked sender must not run either
      // (e.g. the link was removed mid-conversation), and it must still
      // resolve a factory (e.g. the default was cleared or its factory
      // deleted mid-conversation).
      const gate = await gateDispatch(thread, message, deps, ctx);
      if (!gate) return;
      await defaultHandler(thread, message);
    },
    onMention: newSessionChatHandler,
    onDirectMessage: newSessionChatHandler,
  };
};

/** Slack app credentials, passed in explicitly rather than read from env here. */
interface SlackCredentials {
  clientId?: string;
  clientSecret?: string;
  signingSecret: string;
  botToken?: string;
}

export function createSlackChannelsConfig(deps: SlackChannelDeps & { slack: SlackCredentials }): FactoryChannelsConfig {
  return {
    adapters: {
      slack: {
        adapter: createSlackAdapter(deps.slack),
        toolDisplay: 'hidden',
      },
    },
    handlers: createHandlers(deps),
    // New linked+repo-backed threads own a Factory user-session id as their
    // resourceId, which is what makes the controller session repo-backed.
    resolveResourceId: createChannelResourceIdResolver(deps),
    resolveThreadId: resolveChannelThreadId,
  };
}
