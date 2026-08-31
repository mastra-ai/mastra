import { randomUUID } from 'node:crypto';

import type {
  ChannelHandler,
  ChannelHandlerContext,
  ChannelHandlers,
  ChannelSessionStart,
  ResolveResourceId,
  ResolveThreadId,
} from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import { createSlackAdapter } from '@mastra/slack';
import type { SlackAdapterChannelConfig } from '@mastra/slack';
import { Card, CardText, Actions, LinkButton } from 'chat';

import {
  hydrateFactorySession,
  resolveFactoryDefaultModelId,
  resolveFactoryProjectForSession,
  resolveFactorySourceRepository,
} from '../../session/factory-session.js';
import { readRequestContextOrgId, seedSessionOrg } from '../../session/org-seed.js';
import type {
  ChannelAccountLink,
  ChannelAccountLinkKey,
  ChannelIdentityStorage,
} from '../../storage/domains/channel-identity/base.js';
import type { FactoryActorExternalIdentity } from '../../storage/domains/comments/actor.js';
import { actorFromChannelAuthor } from '../../storage/domains/comments/actor.js';
import type { CommentsDomain } from '../../storage/domains/comments/domain.js';
import type { MemorySettingsStorage } from '../../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { ExternalWorkItemSource, WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { FactoryChannelsConfig } from '../base.js';

import { slackCommentSource } from './feed-publisher.js';

// Derive the thread/message types from the core handler signature rather than
// importing them from `chat` directly: mc-web can resolve a different `chat`
// version than @mastra/core, and the two `Thread`/`Message` declarations are
// structurally incompatible (private fields). Using the handler's own types
// keeps everything on one version.
type HandlerThread = Parameters<ChannelHandler>[0];
type HandlerMessage = Parameters<ChannelHandler>[1];

const SLACK_REQUEST_TIMEOUT_MS = 15_000;

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
   * Storage handle of the integration that owns source control
   * (`IntegrationContext.storage.sourceControlOwner`). Used to make new Slack
   * threads repo-backed: when the sender is linked and their factory has a
   * repository, the thread's resourceId becomes a Factory user-session id (repo
   * cloned on a `slack/{threadTs}` branch) instead of the chat-only
   * `channel:...` id. It also lets a started session read back the project it
   * belongs to. Nothing here is provider-specific — the connection is matched
   * by the handle's own `integrationId`. Absent (no source-control integration
   * registered) → chat-only sessions as before.
   */
  sourceControl?: SourceControlStorageHandle;
  /**
   * Observational-memory settings domain. When provided, a repo-backed session
   * adopts its factory project's shared memory settings on start, matching the
   * web kickoff.
   */
  memorySettings?: MemorySettingsStorage;
  /**
   * Factory work-items domain. When provided, a dispatched new-session thread
   * (DM or mention) upserts a Work-board card in Building (`execute`) carrying
   * the Slack thread as its external source and binding the repo-backed
   * session. Best-effort — a failure never blocks the run. Unset → no card.
   */
  workItems?: WorkItemsStorage;
  /**
   * Work-item feed. With it (and `workItems`), an `aside` lands as a comment on
   * the card the thread created. Unset → asides stay ignored, as before.
   */
  feed?: Pick<CommentsDomain, 'createComment'>;
  /** Overrides applied to the Slack channel adapter entry. */
  adapterOptions?: SlackAdapterChannelConfig;
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
 * `/connect/slack` sends the visitor to Connections, where "Connect Slack"
 * runs the OIDC flow and Slack itself asserts the (team, user) pair.
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
  | { status: 'resolved'; factoryProjectId: string; slackWorkItemsEnabled: boolean };

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
    if (existing) {
      return {
        status: 'resolved',
        factoryProjectId: existing.id,
        slackWorkItemsEnabled: existing.slackWorkItemsEnabled,
      };
    }
  }

  const factories = orgId ? await projects.list({ orgId }) : [];
  if (factories.length === 1) {
    const only = factories[0]!;
    await accountLinks.setDefaultFactory({ ...key, userId: link.userId, factoryProjectId: only.id });
    return {
      status: 'resolved',
      factoryProjectId: only.id,
      slackWorkItemsEnabled: only.slackWorkItemsEnabled,
    };
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
              url: `${publicUrl}/settings/connections`,
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
 *
 * Top-level DM and channel conversations use the empty-threadTs thread form,
 * so the trailing segment can be empty; a bare `slack/` is not a valid git
 * ref. Fall back to the last non-empty segment (the channel id): one
 * deterministic branch per top-level conversation.
 */
function threadBranch(threadId: string): string {
  const segments = threadId.split(':');
  const tail = segments.findLast(segment => segment.length > 0) ?? threadId;
  return `slack/${tail.replace(/[^A-Za-z0-9_/-]/g, '-')}`;
}

/**
 * Resolve the resourceId for a NEW Slack channel thread. A linked sender whose
 * factory has a repository gets a Factory user-session id — the controller
 * session then materializes the repo sandbox via the factory's dynamic
 * workspace (clone + PAT), the session shows up in the web Sessions list, and
 * View Session deep-links land on the normal workspace route. Everything else
 * (unlinked, unrouted, repo-less, or no source control) keeps the chat-only
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

      const repo = await resolveFactorySourceRepository({ sourceControl, orgId, factoryProjectId });
      if (!repo.found) return chatOnlyResourceId;

      const branch = threadBranch(thread.id);
      // Attributed to the Slack sender, not to whoever connected the repository:
      // unlike an autonomous rule run, a Slack thread has a real interactive user.
      const existing = await sourceControl.sessions.getForBranch({
        projectRepositoryId: repo.projectRepositoryId,
        userId: link.userId,
        branch,
      });
      if (existing) return existing.sessionId;
      const session = await sourceControl.sessions.create({
        sessionId: randomUUID(),
        projectRepositoryId: repo.projectRepositoryId,
        orgId,
        userId: link.userId,
        branch,
        baseBranch: repo.baseBranch,
        // DMs are the only private origin; channel threads are org-visible.
        visibility: thread.isDM ? 'private' : 'org',
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
 * Apply the factory's configuration to a Slack-created session the first time
 * its thread reaches the controller.
 *
 * Without this a Slack session runs on the SDK's built-in mode default
 * (`openai/gpt-5.5`), so a factory configured for any other provider fails every
 * message with a missing-credentials error. The web kickoff has always applied
 * the factory default; this brings Slack to the same footing.
 *
 * Only repo-backed threads are configured. Their resourceId IS the Factory
 * session id, which the source-control rows turn back into a project — a
 * chat-only `channel:...` id names no project, so there is nothing to read.
 *
 * Skips a session whose mode already has a model persisted on the thread. That
 * is the durable record of a deliberate choice — either an earlier start or a
 * user's own switch — and re-applying the factory default over it would undo
 * the user's selection every time the process restarts.
 */
export function createChannelSessionStartHook(deps: SlackChannelDeps): ChannelSessionStart {
  const { projects, sourceControl, memorySettings } = deps;
  return async ({ session, thread, requestContext }) => {
    // Seed the tenant org above every guard below. `gateDispatch` stamps it on
    // the message's request context before the session exists, so this needs no
    // storage read — which matters, because the guards below deliberately skip
    // storage on a restarted session. A channel-only thread and a thread whose
    // dispatch was ungated both land here with no org and are marked unresolved
    // rather than being left to look like a local session.
    await seedSessionOrg(session, readRequestContextOrgId(requestContext));

    if (!projects || !sourceControl) return;
    if (thread.resourceId.startsWith('channel:')) return;

    const owner = await resolveFactoryProjectForSession({ sourceControl, sessionId: thread.resourceId });
    if (!owner) return;

    // Repo-backed Slack sessions are factory sessions: stamp the owning
    // project onto controller state so downstream reads (org-first credential
    // resolution, authority gates) recognize them, same as board runs.
    await session.state.set({ factoryProjectId: owner.factoryProjectId });
    // Route the org through the seed helper rather than stamping it directly:
    // an ungated dispatch marked this session unresolved above, and owner
    // recovery is the resolution that has to clear that marker with it.
    await seedSessionOrg(session, owner.orgId);

    const modeModelKey = `modeModelId_${session.mode.get()}`;
    if (await session.thread.getSetting({ key: modeModelKey })) return;

    const defaultModelId = await resolveFactoryDefaultModelId(projects, owner.factoryProjectId);
    await hydrateFactorySession(session, {
      orgId: owner.orgId,
      factoryProjectId: owner.factoryProjectId,
      defaultModelId,
      memorySettings,
    });
  };
}

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
): Promise<{
  routed?: { link: ChannelAccountLink; factoryProjectId: string; slackWorkItemsEnabled: boolean };
} | null> {
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
      return {
        routed: {
          link: sender.link,
          factoryProjectId: route.factoryProjectId,
          slackWorkItemsEnabled: route.slackWorkItemsEnabled,
        },
      };
    }
  }
  return {};
}

/**
 * A channel id and a `ts` name a thread only inside the workspace that issued
 * them, so the team scopes the card's key — without it two workspaces could
 * hold one key and an aside would land on another tenant's card.
 */
export function slackThreadSource(thread: HandlerThread, teamId?: string): ExternalWorkItemSource {
  return {
    integrationId: thread.adapter.name,
    type: 'slack-thread',
    ...(teamId ? { workspaceId: teamId } : {}),
    externalId: thread.id,
  };
}

/** Cards written before the key carried a team are still keyed bare. */
async function findThreadWorkItem(
  workItems: WorkItemsStorage,
  thread: HandlerThread,
  teamId?: string,
): Promise<WorkItemRow | null> {
  const scoped = await workItems.getBySource(slackThreadSource(thread, teamId));
  if (scoped || !teamId) return scoped;
  return workItems.getBySource(slackThreadSource(thread));
}

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
        externalSource: { ...slackThreadSource(thread, slackTeamId(message)), ...(url ? { url } : {}) },
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

/**
 * An `aside` never reaches the agent, but it is still part of the conversation:
 * record it on the card the thread created. The link is resolved here rather
 * than through `gateDispatch`, which posts a Connect card an aside must not
 * trigger. Best-effort — nothing here may surface in the Slack thread.
 */
async function ingestAside(
  thread: HandlerThread,
  message: HandlerMessage,
  { feed, workItems, accountLinks }: SlackChannelDeps,
): Promise<void> {
  if (!feed || !workItems) return;
  const body = message.text.replace(/^aside\b[,:]?\s*/i, '').trim();
  if (!body) return;
  try {
    const teamId = slackTeamId(message);
    const workItem = await findThreadWorkItem(workItems, thread, teamId);
    if (!workItem) return;

    const external: FactoryActorExternalIdentity = {
      platform: thread.adapter.name,
      ...(teamId ? { teamId } : {}),
      messageId: message.id,
      userId: message.author.userId,
      userName: message.author.userName,
      fullName: message.author.fullName,
      isBot: message.author.isBot,
    };
    const link =
      accountLinks && teamId
        ? await accountLinks.getAccountLink({
            platform: external.platform,
            externalTeamId: teamId,
            externalUserId: external.userId,
          })
        : null;

    const result = await feed.createComment({
      orgId: workItem.orgId,
      workItemId: workItem.id,
      author: actorFromChannelAuthor(external, link),
      body,
      occurredAt: message.metadata.dateSent,
      externalSource: slackCommentSource(thread.id, message.id, teamId),
    });
    if (result.status !== 'created') {
      console.warn('[slack] aside not ingested', { thread: thread.id, messageTs: message.id, status: result.status });
    }
  } catch (error) {
    // Slack was acked before this handler ran, so a lost aside is never redelivered.
    console.warn('[slack] aside ingest failed', { thread: thread.id, messageTs: message.id, error });
  }
}

export const createHandlers = (deps: SlackChannelDeps): ChannelHandlers => {
  const newSessionChatHandler = createNewSessionChatHandler(deps);

  return {
    onSubscribedMessage: async (thread, message, defaultHandler, ctx) => {
      // `aside` as its own leading word lets humans talk in a subscribed
      // thread without the bot replying. Word boundary so messages that
      // merely start with "aside..." (e.g. "asides can wait") still route.
      if (/^aside\b/i.test(message.text)) return ingestAside(thread, message, deps);
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
  // Per HTTP attempt, not per call: the WebClient's own retry policy still
  // waits out a 429. Without it a dead socket hangs a post forever.
  const adapter = createSlackAdapter({ ...deps.slack, webClientOptions: { timeout: SLACK_REQUEST_TIMEOUT_MS } });
  const slack =
    deps.adapterOptions?.streaming === false
      ? { adapter, ...deps.adapterOptions }
      : { adapter, ...deps.adapterOptions, streaming: deps.adapterOptions?.streaming ?? true };

  return {
    adapters: { slack },
    handlers: createHandlers(deps),
    // New linked+repo-backed threads own a Factory user-session id as their
    // resourceId, which is what makes the controller session repo-backed.
    resolveResourceId: createChannelResourceIdResolver(deps),
    resolveThreadId: resolveChannelThreadId,
    // Those sessions are created by the channel machinery, not the web kickoff,
    // so this is where they pick up the factory's configuration.
    onSessionStart: createChannelSessionStartHook(deps),
  };
}
