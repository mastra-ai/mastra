import { randomUUID } from 'node:crypto';

import type { ChannelHandler, ChannelHandlerContext } from '@mastra/core/channels';
import { Card, CardText, Actions, LinkButton } from 'chat';

import type { MessagingSenderRef, MessagingWorkspaceContext } from '../../capabilities/messaging.js';
import type {
  ChannelAccountLink,
  ChannelAccountLinkKey,
  ChannelIdentityStorage,
} from '../../storage/domains/channel-identity/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';

// Derive the thread/message types from the core handler signature rather than
// importing them from `chat` directly: mc-web can resolve a different `chat`
// version than @mastra/core, and the two `Thread`/`Message` declarations are
// structurally incompatible (private fields). Using the handler's own types
// keeps everything on one version.
type HandlerThread = Parameters<ChannelHandler>[0];
type HandlerMessage = Parameters<ChannelHandler>[1];

/** The source-control surface Slack needs to create repo-backed sessions. */
export interface SlackSourceControl {
  resolveProjectRepository(args: {
    orgId: string;
    factoryProjectId: string;
  }): Promise<{ projectRepositoryId: string; baseBranch: string } | null>;
  getSessionForBranch(args: {
    projectRepositoryId: string;
    userId: string;
    branch: string;
  }): Promise<{ sessionId: string } | null>;
  createSession(args: {
    projectRepositoryId: string;
    orgId: string;
    userId: string;
    branch: string;
    baseBranch: string;
  }): Promise<{ sessionId: string }>;
}

/** Structural slice of the factory's source-control owner storage handle. */
interface SourceControlOwnerSlice {
  integrationId: string;
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
}

/** Adapt the source-control owner's storage handle for Slack session creation. */
export function createGithubSourceControl(owner: SourceControlOwnerSlice): SlackSourceControl {
  return {
    async resolveProjectRepository({ orgId, factoryProjectId }) {
      const connections = await owner.connections.list({ orgId, factoryProjectId });
      const connection = connections.find(candidate => candidate.integrationId === owner.integrationId);
      if (!connection) return null;
      const projectRepositories = await owner.projectRepositories.list({ orgId, connectionId: connection.id });
      const first = projectRepositories[0];
      if (!first) return null;
      const repository = await owner.repositories.get({ orgId, id: first.repositoryId });
      if (!repository) return null;
      return { projectRepositoryId: first.id, baseBranch: first.branch ?? repository.defaultBranch };
    },
    getSessionForBranch: args => owner.sessions.getForBranch(args),
    createSession: args => owner.sessions.create({ sessionId: randomUUID(), ...args }),
  };
}

/** Read a Slack team id from an Events API envelope or slash-command body. */
export function rawTeamId(rawPayload: unknown): string | undefined {
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

function slackTeamId(message: HandlerMessage): string | undefined {
  return rawTeamId(message.raw);
}

function webPublicUrl(): string | undefined {
  return process.env.MASTRACODE_PUBLIC_URL ?? process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
}

type LinkedSenderResult =
  | { status: 'ungated' }
  | { status: 'blocked' }
  | { status: 'linked'; link: ChannelAccountLink; key: ChannelAccountLinkKey };

/**
 * Read the persisted sender→workspace mapping. Single production entry point
 * shared by `SlackIntegration.messaging.resolveWorkspaceContext` and the Slack
 * dispatch gate (`resolveLinkedSender`), so both surfaces read the account
 * link exactly once via the same code path.
 */
export async function readSenderLink(
  accountLinks: ChannelIdentityStorage,
  ref: MessagingSenderRef,
): Promise<ChannelAccountLink | null> {
  return accountLinks.getAccountLink(ref);
}

/** Project a persisted link into the capability-level workspace context. */
export function linkToWorkspaceContext(link: ChannelAccountLink): MessagingWorkspaceContext {
  return {
    orgId: link.orgId ?? '',
    userId: link.userId,
    defaultFactoryProjectId: link.defaultFactoryProjectId ?? null,
  };
}

/**
 * Resolve a sender's persisted workspace context via {@link readSenderLink}.
 * `SlackIntegration.messaging.resolveWorkspaceContext` and the dispatch gate
 * both funnel through {@link readSenderLink} so this is not a parallel path —
 * the capability method and the runtime dispatch path share one read.
 */
export async function resolveWorkspaceContext(
  accountLinks: ChannelIdentityStorage,
  ref: MessagingSenderRef,
): Promise<MessagingWorkspaceContext | null> {
  const link = await readSenderLink(accountLinks, ref);
  return link ? linkToWorkspaceContext(link) : null;
}

/** Resolve the sender account link and prompt unlinked senders to connect. */
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
  const key: ChannelAccountLinkKey | undefined = externalTeamId
    ? { platform, externalTeamId, externalUserId }
    : undefined;
  // Route the read through the same helper `Messaging.resolveWorkspaceContext`
  // uses so dispatch and the capability method are not parallel paths.
  const link = key ? await readSenderLink(accountLinks, key) : null;
  if (link && key) return { status: 'linked', link, key };

  const publicUrl = webPublicUrl();
  if (publicUrl) {
    await thread.postEphemeral(
      message.author,
      Card({
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
      }),
      { fallbackToDM: true },
    );
  }
  return { status: 'blocked' };
}

type FactoryRouteResult =
  | { status: 'ungated' }
  | { status: 'blocked' }
  | { status: 'resolved'; factoryProjectId: string; slackWorkItemsEnabled: boolean };

/** Resolve the linked sender's default Factory project or prompt for one. */
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

/** Run account-link and factory-routing gates for one inbound Slack message. */
export async function gateDispatch(
  thread: HandlerThread,
  message: HandlerMessage,
  { accountLinks, projects }: { accountLinks?: ChannelIdentityStorage; projects?: FactoryProjectsStorage },
  ctx: ChannelHandlerContext,
): Promise<{
  routed?: { link: ChannelAccountLink; factoryProjectId: string; slackWorkItemsEnabled: boolean };
} | null> {
  const sender = await resolveLinkedSender({ thread, message, accountLinks });
  if (sender.status === 'blocked') return null;
  if (sender.status === 'linked' && accountLinks) {
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
