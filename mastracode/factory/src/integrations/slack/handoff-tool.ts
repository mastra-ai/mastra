import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { AgentControllerChannels } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { RequestContext as RequestContextClass } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { Card, CardText, Actions, LinkButton } from 'chat';
import { z } from 'zod';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../../auth.js';
import type { ChannelIdentityStorage } from '../../storage/domains/channel-identity/base.js';
import type { CommentsDomain } from '../../storage/domains/comments/domain.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';

import {
  buildSessionDeepLink,
  findThreadWorkItem,
  resolveSlackFactorySession,
  threadBranch,
  upsertThreadWorkItem,
} from './slack.js';

const SLACK_PLATFORM = 'slack';

const handoffInputSchema = z.object({
  factoryProjectId: z.string().min(1).describe('The id of the factory to continue in, from factory_locate.'),
  factoryName: z
    .string()
    .min(1)
    .describe(
      'The name of that factory exactly as factory_locate returned it, so the approval card shows where the thread is going.',
    ),
  summary: z
    .string()
    .min(1)
    .describe(
      'Everything the next session needs: the original request in the person’s words, what you checked here, and what factory_locate found (repositories and paths).',
    ),
});

export interface ChannelThreadCoordinates {
  platform: string;
  externalThreadId: string;
  channelId: string;
}

export interface HandoffThreadStore {
  getThreadById(args: { threadId: string }): Promise<{ metadata?: Record<string, unknown> | null } | null>;
}

export interface HandoffChannels {
  rebindThread: AgentControllerChannels['rebindThread'];
  getSessionForThread: AgentControllerChannels['getSessionForThread'];
  sdk: Pick<NonNullable<AgentControllerChannels['sdk']>, 'thread'> | null;
}

export interface HandoffDeps {
  channels: () => HandoffChannels | null;
  threads: () => Promise<HandoffThreadStore | undefined>;
  accountLinks: Pick<ChannelIdentityStorage, 'getAccountLink'>;
  projects: Pick<FactoryProjectsStorage, 'get'>;
  sourceControl: SourceControlStorageHandle;
  workItems?: WorkItemsStorage;
  feed?: Pick<CommentsDomain, 'createComment'>;
}

export type HandoffResult =
  | { status: 'handed_off'; factoryName: string; sessionId: string; url?: string; started: boolean }
  | { status: 'refused'; reason: string };

type FactorySessionState = { factoryProjectId?: string };

export function channelThreadCoordinates(
  metadata: Record<string, unknown> | null | undefined,
): ChannelThreadCoordinates | undefined {
  const platform = metadata?.channel_platform;
  const externalThreadId = metadata?.channel_externalThreadId;
  const channelId = metadata?.channel_externalChannelId;
  if (typeof platform !== 'string' || typeof externalThreadId !== 'string' || typeof channelId !== 'string') {
    return undefined;
  }
  return { platform, externalThreadId, channelId };
}

function tenantContext(requestContext: RequestContext): RequestContext {
  const next = new RequestContextClass();
  next.set('user', requestContext.get('user'));
  return next;
}

export async function handOffSlackThread(
  deps: HandoffDeps,
  requestContext: RequestContext,
  input: z.infer<typeof handoffInputSchema>,
): Promise<HandoffResult> {
  const user = getFactoryAuthUserFromContext(requestContext);
  const orgId = getFactoryAuthOrgId(user);
  const userId = getFactoryAuthUserId(user);
  const controller = requestContext.get('controller') as AgentControllerRequestContext<FactorySessionState> | undefined;
  if (!orgId || !userId || !controller?.threadId) {
    return { status: 'refused', reason: 'Handoff needs an organization session with an active thread.' };
  }
  const currentFactoryProjectId = controller.getState().factoryProjectId;
  if (currentFactoryProjectId === input.factoryProjectId) {
    return { status: 'refused', reason: 'That is the factory this session already runs in.' };
  }

  const store = await deps.threads();
  const thread = store ? await store.getThreadById({ threadId: controller.threadId }) : null;
  const coordinates = channelThreadCoordinates(thread?.metadata);
  if (!coordinates || coordinates.platform !== SLACK_PLATFORM) {
    return { status: 'refused', reason: 'Handoff only works from a Slack thread.' };
  }
  const channels = deps.channels();
  if (!channels) return { status: 'refused', reason: 'Slack channels are not attached.' };

  const target = await deps.projects.get({ orgId, id: input.factoryProjectId });
  if (!target) return { status: 'refused', reason: 'No factory with that id in this organization.' };
  if (!sameFactoryName(target.name, input.factoryName)) {
    return {
      status: 'refused',
      reason: `Factory ${input.factoryProjectId} is named ${target.name}, not ${input.factoryName}. Use the id and name factory_locate returned together.`,
    };
  }

  const previousSession = await deps.sourceControl.sessions.getBySessionId(controller.resourceId);
  const sessionId = await resolveSlackFactorySession({
    sourceControl: deps.sourceControl,
    orgId,
    userId,
    factoryProjectId: target.id,
    externalThreadId: coordinates.externalThreadId,
    visibility: previousSession?.visibility ?? 'org',
  });
  if (!sessionId) return { status: 'refused', reason: `${target.name} has no repository linked.` };

  await channels.rebindThread({
    platform: coordinates.platform,
    externalThreadId: coordinates.externalThreadId,
    channelId: coordinates.channelId,
    resourceId: sessionId,
    threadId: sessionId,
  });

  const url = buildSessionDeepLink({ factoryProjectId: target.id, resourceId: sessionId, threadId: sessionId });
  const handedOff: HandoffResult & { status: 'handed_off' } = {
    status: 'handed_off',
    factoryName: target.name,
    sessionId,
    started: false,
  };
  if (url) handedOff.url = url;
  const slackThread = { id: coordinates.externalThreadId, adapter: { name: SLACK_PLATFORM } };
  const teamId = deps.workItems ? await previousCardTeamId(deps.workItems, slackThread) : undefined;

  if (deps.workItems && deps.feed) {
    const previousCard = await findThreadWorkItem(deps.workItems, slackThread, teamId);
    if (previousCard) {
      await deps.feed
        .createComment({
          orgId,
          workItemId: previousCard.id,
          author: { kind: 'user', id: userId },
          body: `Handed off to the ${target.name} factory.`,
        })
        .catch(error => console.warn('[factory_handoff] could not note the handoff on the previous card', error));
    }
  }
  if (deps.workItems && target.slackWorkItemsEnabled) {
    await upsertThreadWorkItem({
      workItems: deps.workItems,
      thread: slackThread,
      message: { text: input.summary, raw: teamId ? { team_id: teamId } : {} },
      link: { orgId, userId },
      factoryProjectId: target.id,
      session: { sessionId, branch: threadBranch(coordinates.externalThreadId), threadId: sessionId },
      url,
    });
  }

  if (url && channels.sdk) {
    await channels.sdk
      .thread(coordinates.externalThreadId)
      .post(
        Card({
          title: `Continuing in ${target.name}`,
          children: [Actions([LinkButton({ url, label: 'View session' })])],
        }),
      )
      .catch(error => console.warn('[factory_handoff] could not post the handoff card', error));
  }

  const tenant = tenantContext(requestContext);
  try {
    const session = await channels.getSessionForThread({ id: sessionId, resourceId: sessionId }, tenant);
    await session.sendMessage({ content: handoffMessage(target.name, input.summary), requestContext: tenant });
  } catch (error) {
    console.warn('[factory_handoff] rebound the thread but could not start the session', { sessionId, error });
    if (channels.sdk) {
      await channels.sdk
        .thread(coordinates.externalThreadId)
        .post(
          CardText(
            `Couldn't start the session in ${target.name}. Send another message in this thread to continue there.`,
          ),
        )
        .catch(() => undefined);
    }
    return handedOff;
  }
  handedOff.started = true;
  return handedOff;
}

async function previousCardTeamId(
  workItems: WorkItemsStorage,
  slackThread: { id: string; adapter: { name: string } },
): Promise<string | undefined> {
  const card = await findThreadWorkItem(workItems, slackThread);
  return card?.externalSource?.workspaceId;
}

function sameFactoryName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function handoffMessage(factoryName: string, summary: string): string {
  return [
    `This Slack thread was handed to the ${factoryName} factory from another factory's session. Continue the work here in this repository; the person is waiting in the same thread.`,
    '',
    summary,
  ].join('\n');
}

export function createFactoryHandoffTool(requestContext: RequestContext, deps: HandoffDeps) {
  const user = getFactoryAuthUserFromContext(requestContext);
  if (!getFactoryAuthOrgId(user) || !getFactoryAuthUserId(user)) return {};
  const controller = requestContext.get('controller') as AgentControllerRequestContext<FactorySessionState> | undefined;
  if (!controller?.threadId || !controller.getState().factoryProjectId) return {};

  return {
    factory_handoff: createTool({
      id: 'factory_handoff',
      description:
        'Move this Slack conversation to another factory in the organization and continue the work there. Call it after factory_locate showed the work belongs in that factory. Slack posts an approval card the person has to accept before anything moves; nothing happens if they deny it. After it returns, reply with one short sentence and stop; the other factory’s session takes over this thread.',
      inputSchema: handoffInputSchema,
      requireApproval: true,
      execute: async input => handOffSlackThread(deps, requestContext, input),
    }),
  };
}
