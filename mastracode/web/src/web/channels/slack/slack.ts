import { randomUUID } from 'node:crypto';

import {
  AgentControllerChannels,
  type ChannelHandler,
  type ChannelHandlerContext,
  type ChannelHandlers,
  type ResolveResourceId,
  type ResolveThreadId,
} from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import type {
  ChannelAccountLink,
  ChannelAccountLinkKey,
  ChannelIdentityStorage,
  FactoryProjectsStorage,
} from '@mastra/factory';
import { createSlackAdapter } from '@mastra/slack';
import { Card, CardText, Actions, LinkButton } from 'chat';

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
}

/**
 * The slice of the GitHub integration's source-control storage the Slack
 * wiring needs. Structural (not the storage types themselves) so slack.ts
 * stays decoupled from the integration's module graph and tests can stub it.
 */
export interface SlackSourceControl {
  /**
   * Resolve the factory's linked repository — first repo on the factory's
   * GitHub connection, the same single-repo assumption the web kickoff makes.
   */
  resolveProjectRepository(args: {
    orgId: string;
    factoryProjectId: string;
  }): Promise<{ projectRepositoryId: string; baseBranch: string } | null>;
  /** Look up an existing user session for a repo branch (idempotent reuse). */
  getSessionForBranch(args: {
    projectRepositoryId: string;
    userId: string;
    branch: string;
  }): Promise<{ sessionId: string } | null>;
  /** Create the durable user-session row the workspace factory materializes. */
  createSession(args: {
    projectRepositoryId: string;
    orgId: string;
    userId: string;
    branch: string;
    baseBranch: string;
  }): Promise<{ sessionId: string }>;
}

/**
 * Structural slice of `GithubIntegration` the source-control adapter reads.
 * `sourceControlStorage` is bound during `factory.prepare()`; all access here
 * is lazy (request time), well after preparation.
 */
interface GithubIntegrationSlice {
  id: string;
  sourceControlStorage: {
    connections: {
      list(args: { orgId: string; factoryProjectId: string }): Promise<Array<{ id: string; integrationId: string }>>;
    };
    projectRepositories: {
      list(args: {
        orgId: string;
        connectionId: string;
      }): Promise<Array<{ id: string; repositoryId: string; branch?: string | null }>>;
    };
    repositories: {
      get(args: { orgId: string; id: string }): Promise<{ defaultBranch: string } | null>;
    };
    sessions: {
      getForBranch(args: {
        projectRepositoryId: string;
        userId: string;
        branch: string;
      }): Promise<{ sessionId: string } | null>;
      create(input: {
        sessionId: string;
        projectRepositoryId: string;
        orgId: string;
        userId: string;
        branch: string;
        baseBranch: string;
      }): Promise<{ sessionId: string }>;
    };
  };
}

/**
 * Adapt the GitHub integration's source-control storage into the
 * {@link SlackSourceControl} surface. Repo resolution mirrors the factory's
 * own `ensureFactoryRuleSession`: the factory's GitHub connection → its first
 * linked repository → pinned branch or repo default as the base.
 */
export function createGithubSourceControl(github: GithubIntegrationSlice): SlackSourceControl {
  return {
    async resolveProjectRepository({ orgId, factoryProjectId }) {
      const storage = github.sourceControlStorage;
      const connections = await storage.connections.list({ orgId, factoryProjectId });
      const connection = connections.find(candidate => candidate.integrationId === github.id);
      if (!connection) return null;
      const projectRepositories = await storage.projectRepositories.list({ orgId, connectionId: connection.id });
      const first = projectRepositories[0];
      if (!first) return null;
      const repository = await storage.repositories.get({ orgId, id: first.repositoryId });
      if (!repository) return null;
      return { projectRepositoryId: first.id, baseBranch: first.branch ?? repository.defaultBranch };
    },
    getSessionForBranch: args => github.sourceControlStorage.sessions.getForBranch(args),
    createSession: args => github.sourceControlStorage.sessions.create({ sessionId: randomUUID(), ...args }),
  };
}

/**
 * Read the Slack team id off a raw platform payload (Events API envelope or
 * slash-command body — both carry `team_id`), duck-typed to build the
 * workspace-scoped account-link key.
 */
function rawTeamId(rawPayload: unknown): string | undefined {
  if (!rawPayload || typeof rawPayload !== 'object') return undefined;
  const raw = rawPayload as { team_id?: unknown; team?: unknown };
  if (typeof raw.team_id === 'string' && raw.team_id) return raw.team_id;
  if (typeof raw.team === 'string' && raw.team) return raw.team;
  if (raw.team && typeof raw.team === 'object') {
    const id = (raw.team as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

/**
 * The Slack team id survives onto a normalized chat Message only on
 * `message.raw` (the Slack Events API envelope).
 */
function slackTeamId(message: HandlerMessage): string | undefined {
  return rawTeamId(message.raw);
}

/**
 * Resolve the web-UI origin for links humans open in a browser (Connect card,
 * session deep links). Prefers `MASTRACODE_PUBLIC_URL` — the origin auth
 * cookies and OAuth redirect allow-lists are registered against — over the
 * channels tunnel, which only Slack's servers need to reach.
 */
function webPublicUrl(): string | undefined {
  return process.env.MASTRACODE_PUBLIC_URL ?? process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
}

/** Outcome of the sender-link gate for one inbound message. */
type LinkedSenderResult =
  /** Gating not configured — dispatch as before account linking existed. */
  | { status: 'ungated' }
  /** Sender unlinked — Connect card posted (when possible), do not dispatch. */
  | { status: 'blocked' }
  /** Sender linked — their tenant plus the sender key the link lives under. */
  | { status: 'linked'; link: ChannelAccountLink; key: ChannelAccountLinkKey };

/**
 * Resolve the sender's account link, posting an ephemeral "connect your
 * account" card (visible only to the sender) linking into the web UI's
 * Slack-connect flow when they're unlinked.
 */
export async function resolveLinkedSender({
  thread,
  message,
  accountLinks,
}: {
  thread: HandlerThread;
  message: HandlerMessage;
  accountLinks?: ChannelIdentityStorage;
}): Promise<LinkedSenderResult> {
  if (!accountLinks) return { status: 'ungated' };
  const platform = thread.adapter.name;
  const externalUserId = message.author.userId;
  const externalTeamId = slackTeamId(message);
  // Without a team id we can't identify the workspace-scoped link; treat as
  // unlinked so a run never proceeds tenant-less.
  const key = externalTeamId ? { platform, externalTeamId, externalUserId } : undefined;
  const link = key ? await accountLinks.getAccountLink(key) : null;
  if (link && key) return { status: 'linked', link, key };

  const publicUrl = webPublicUrl();
  // A public origin is all the card needs. The link carries no identity: the
  // web app authenticates the visitor, then Slack's OIDC flow proves which
  // Slack account they control. Without an origin, still block, just no card.
  if (publicUrl) {
    await thread.postEphemeral(message.author, buildConnectCard(publicUrl), { fallbackToDM: true });
  }
  return { status: 'blocked' };
}

/**
 * The "connect your account" card. The link is deliberately identity-free —
 * `/connect/slack` sends the visitor to Connected accounts, where "Connect
 * Slack" runs the OIDC flow and Slack itself asserts the (team, user) pair.
 */
function buildConnectCard(publicUrl: string) {
  return Card({
    title: 'Connect your account',
    children: [
      CardText('Connect your account to use this agent.'),
      Actions([
        LinkButton({
          url: `${publicUrl}/connect/slack`,
          label: 'Connect account',
        }),
      ]),
    ],
  });
}

/** Outcome of factory routing for one linked sender's inbound message. */
type FactoryRouteResult =
  /** Factory routing not configured — dispatch without a factory. */
  | { status: 'ungated' }
  /** No factory resolved — prompt card posted (when possible), do not dispatch. */
  | { status: 'blocked' }
  /** The Factory project this sender's runs route to. */
  | { status: 'resolved'; factoryProjectId: string };

/**
 * Decide which Factory project a linked sender's run belongs to:
 *
 * 1. The link's `defaultFactoryProjectId`, when it still exists (a stale id —
 *    deleted factory — falls through as if unset).
 * 2. Else, the tenant's only factory, stamped back onto the link so it shows
 *    up (and stays editable) in Connected Accounts settings.
 * 3. Else — zero or several factories — an ephemeral "pick a default factory"
 *    card deep-linking to settings, and the run is blocked.
 */
export async function resolveFactoryForLink({
  thread,
  message,
  link,
  key,
  accountLinks,
  projects,
}: {
  thread: HandlerThread;
  message: HandlerMessage;
  link: ChannelAccountLink;
  key: ChannelAccountLinkKey;
  accountLinks: ChannelIdentityStorage;
  projects?: FactoryProjectsStorage;
}): Promise<FactoryRouteResult> {
  if (!projects) return { status: 'ungated' };
  // Factories are org-scoped; a personal account (no org) has none and lands
  // on the prompt below.
  const orgId = link.orgId ?? '';

  if (link.defaultFactoryProjectId) {
    const existing = await projects.get({ orgId, id: link.defaultFactoryProjectId });
    if (existing) return { status: 'resolved', factoryProjectId: existing.id };
  }

  const factories = orgId ? await projects.list({ orgId }) : [];
  if (factories.length === 1) {
    const only = factories[0]!;
    await accountLinks.setDefaultFactory({ ...key, userId: link.userId, factoryProjectId: only.id });
    return { status: 'resolved', factoryProjectId: only.id };
  }

  const publicUrl = webPublicUrl();
  if (publicUrl) {
    await thread.postEphemeral(
      message.author,
      Card({
        title: 'Pick a default factory',
        children: [
          CardText(
            factories.length === 0
              ? 'Your account has no factory yet. Create one in the web app, then message me again.'
              : 'Your account has several factories. Pick which one Slack sessions should go to, then message me again.',
          ),
          Actions([
            LinkButton({
              url: `${publicUrl}/settings/connected-accounts`,
              label: 'Open settings',
            }),
          ]),
        ],
      }),
      { fallbackToDM: true },
    );
  }
  return { status: 'blocked' };
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
 * Run the account-link + factory-routing gates for one inbound message.
 * Returns `null` when the run must not dispatch (a prompt card was posted
 * where possible); otherwise the dispatch context — with `routed` present
 * only when a linked sender resolved to a factory.
 */
async function gateDispatch(
  thread: HandlerThread,
  message: HandlerMessage,
  { accountLinks, projects }: SlackChannelDeps,
  ctx: ChannelHandlerContext,
): Promise<{ routed?: { link: ChannelAccountLink; factoryProjectId: string } } | null> {
  const sender = await resolveLinkedSender({ thread, message, accountLinks });
  if (sender.status === 'blocked') return null;
  // Linked senders must also route to a Factory project before a run starts.
  if (sender.status === 'linked' && accountLinks) {
    // Stamp the tenant on the run's request context — the single seam
    // `resolveCredentialStore` reads to load this sender's model credentials.
    // This belongs to the link, not to the routing: a linked sender whose
    // factory routing comes back `ungated` still exits below and dispatches, so
    // stamping only in the routed branch would silently run them on default
    // credentials.
    ctx.requestContext.set('user', { id: sender.link.userId, organizationId: sender.link.orgId });

    const route = await resolveFactoryForLink({ thread, message, ...sender, accountLinks, projects });
    if (route.status === 'blocked') return null;
    if (route.status === 'resolved') {
      return { routed: { link: sender.link, factoryProjectId: route.factoryProjectId } };
    }
  }
  return {};
}

function createNewSessionChatHandler(deps: SlackChannelDeps): ChannelHandler {
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

    // The announcement card is only useful with a public origin to deep-link
    // to — otherwise the link would be `undefined/threads/...`. Without one the
    // session is still created; we skip the (broken) card and the lookup it
    // needs entirely.

    if (!process.env.MASTRACODE_PUBLIC_URL) return;

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
    const needsResourceParam = isChatOnly || !gate.routed;
    const url = needsResourceParam
      ? `${process.env.MASTRACODE_PUBLIC_URL}${threadPath}?resourceId=${encodeURIComponent(internalThread.resourceId)}`
      : `${process.env.MASTRACODE_PUBLIC_URL}${threadPath}`;

    await thread.post(
      Card({
        title: 'New session started',
        children: [Actions([LinkButton({ url, label: 'View session' })])],
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

export function createAgentControllerSlackChannels(
  deps: SlackChannelDeps & { slack: SlackCredentials },
): AgentControllerChannels {
  const channels = new AgentControllerChannels({
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
  });

  return channels;
}
