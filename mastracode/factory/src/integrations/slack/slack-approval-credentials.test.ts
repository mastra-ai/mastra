import { withCredentialTenantPreparation } from '@mastra/code-sdk/agents/credential-resolver';
import { stateSchema } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  primeTenantCredentialsForRequestContext,
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../../routes/tenant-credentials.js';
import { resolveFactoryCredentialTenant } from '../../session/credential-policy.js';
import { createSourceControlSessionLookup, ensureFactorySourceSession } from '../../session/factory-session.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { createChannelSessionResolver, createChannelSessionStartHook, createHandlers } from './slack.js';

const ORG = 'org-1';
const OWNER = 'owner';
const TEAM = 'T-shipyard';
const SLACK_USER = 'U-caleb';
const OTHER_ORG_USER = 'U-other-org';
const UNLINKED_USER = 'U-unlinked';
const THREAD_ID = 'slack:C-repro:1792032051.248899';

function mockAdapter() {
  return {
    name: 'slack',
    postMessage: vi.fn().mockResolvedValue({ id: 'sent-1', text: 'ok' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok')),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    postEphemeral: vi.fn().mockResolvedValue({ id: 'eph-1', text: '' }),
    openDM: vi.fn().mockResolvedValue('slack:D-dm'),
    userName: 'Shipyard',
  } as any;
}

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** First stream calls the approval-gated tool; every later stream answers with text. */
function approvalFlowModel() {
  let call = 0;
  const parts = () => {
    call += 1;
    if (call === 1) {
      return [
        { type: 'stream-start', warnings: [] },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'deployTool', input: '{"action":"prod"}' },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
      ];
    }
    return [
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: 'Deployed successfully.' },
      { type: 'text-end', id: 't' },
      { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
    ];
  };
  return {
    specificationVersion: 'v3' as const,
    provider: 'test',
    modelId: 'approval-flow',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('not used');
    },
    doStream: async () => {
      const chunks = parts();
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
      };
    },
  };
}

async function waitFor(cond: () => boolean, what: string, timeoutMs = 15_000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

afterEach(() => {
  resetTenantCredentialResolverForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Boot a Factory-backed Slack controller and park one tool call at its approval gate. */
async function parkApproval() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({
    orgId: ORG,
    userId: OWNER,
    input: { name: 'P', modelScope: 'factory' },
  });
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: OWNER,
    externalId: '1',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: ORG,
    input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/shipyard', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: OWNER,
  });
  await sourceControl.projectRepositories.link({
    orgId: ORG,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: OWNER,
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox',
  });
  const sourceSession = await ensureFactorySourceSession({
    sourceControl,
    orgId: ORG,
    factoryProjectId: project.id,
    repositorySlug: repository.slug,
    branch: 'slack-approval',
  });
  await seed.credentials.setCredential({ orgId: ORG }, 'openai-codex', { type: 'api_key', key: 'org-key' });
  await seed.channelIdentity.saveAccountLink({
    platform: 'slack',
    externalTeamId: TEAM,
    externalUserId: SLACK_USER,
    orgId: ORG,
    userId: OWNER,
  });
  await seed.channelIdentity.saveAccountLink({
    platform: 'slack',
    externalTeamId: TEAM,
    externalUserId: OTHER_ORG_USER,
    orgId: 'org-2',
    userId: 'other',
  });

  const policyDeps = {
    projects: seed.projects,
    sourceControl: createSourceControlSessionLookup([sourceControl]),
    workItems: seed.workItems,
  };
  const unresolved: Array<{ hasUser: boolean }> = [];
  registerTenantCredentialResolver(seed.credentials, new Set(), async ctx => {
    const tenant = await resolveFactoryCredentialTenant(ctx, policyDeps);
    if (!tenant) unresolved.push({ hasUser: ctx.get('user') !== undefined });
    return tenant;
  });

  const slackDeps = {
    accountLinks: seed.channelIdentity,
    projects: seed.projects,
    sourceControls: [sourceControl],
    modelDefaults: seed.modelDefaults,
    workItems: seed.workItems,
  };
  const execute = vi.fn(async ({ action }: { action: string }) => ({ deployed: action }));
  const model = approvalFlowModel();
  const agent = new Agent({
    id: 'build',
    name: 'Build',
    instructions: 'test',
    memory: withCredentialTenantPreparation(() => new MockMemory()) as any,
    model: withCredentialTenantPreparation(() => model as any),
    tools: {
      deployTool: createTool({
        id: 'deployTool',
        description: 'Deploys the given target',
        inputSchema: z.object({ action: z.string() }),
        execute: execute as any,
      }),
    },
  });
  const adapter = mockAdapter();
  const controller = new AgentController({
    id: 'code',
    storage: new InMemoryStore({ id: 'slack-approval' }),
    stateSchema,
    modes: [{ id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-5.5', agent }],
    channels: {
      adapters: { slack: { adapter } },
      handlers: createHandlers(slackDeps as any),
      resolveResourceId: async () => sourceSession.sessionId,
      resolveSession: createChannelSessionResolver(slackDeps as any),
      onSessionStart: createChannelSessionStartHook(slackDeps as any),
    },
  } as any);
  await controller.init();
  const mastra = controller.getMastra()!;
  await mastra.startWorkers();
  const channels = controller.getChannels()! as any;
  await channels.initialize(mastra);

  const chatThread = {
    id: THREAD_ID,
    channelId: 'slack:C-repro',
    isDM: false,
    adapter,
    isSubscribed: vi.fn().mockResolvedValue(false),
    subscribe: vi.fn().mockResolvedValue(undefined),
    mentionUser: vi.fn((id: string) => `<@${id}>`),
    messages: (async function* () {})(),
    post: vi.fn().mockResolvedValue({ id: 'posted-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  } as any;
  const message = {
    id: 'm-1',
    text: '<@Shipyard> deploy prod',
    author: { userId: SLACK_USER, userName: 'caleb', fullName: 'Caleb Barnes' },
    attachments: [],
    raw: { team_id: TEAM },
  } as any;

  // The message carries what the Slack gate stamps for a linked sender.
  const messageContext = new RequestContext();
  messageContext.set('user', { id: OWNER, organizationId: ORG });
  await primeTenantCredentialsForRequestContext(messageContext);
  await channels.processChatMessage(chatThread, message, mastra, messageContext);

  const session = (await controller.getSessionByResource(sourceSession.sessionId))!;
  await waitFor(() => session.approval.isArmed(), 'approval gate armed');
  const toolCallId = session.approval.getToolCallIds()[0]!;
  expect(unresolved).toEqual([]);

  const click = (userId: string, threadId = THREAD_ID) =>
    channels.sdk.processAction({
      actionId: `tool_approve:${toolCallId}`,
      adapter,
      messageId: 'posted-1',
      threadId,
      user: { userId, userName: userId, fullName: userId },
      raw: { type: 'block_actions', team: { id: TEAM }, user: { id: userId, team_id: TEAM } },
    });
  const posted = () =>
    JSON.stringify([
      ...chatThread.post.mock.calls,
      ...adapter.postMessage.mock.calls,
      ...adapter.postEphemeral.mock.calls,
    ]);

  return { session, execute, unresolved, adapter, click, posted };
}

/** A refused click must leave the run parked: no tool execution, gate still armed. */
async function expectStillParked({ session, execute, unresolved }: Awaited<ReturnType<typeof parkApproval>>) {
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(execute).not.toHaveBeenCalled();
  expect(session.approval.isArmed()).toBe(true);
  expect(unresolved).toEqual([]);
}

describe('Slack tool-approval actions', () => {
  it('resumes an approved tool call with tenant credentials resolved', async () => {
    const { execute, unresolved, click, posted } = await parkApproval();

    await click(SLACK_USER);

    await waitFor(() => execute.mock.calls.length > 0 || unresolved.length > 0, 'tool execution or failed resolution');
    await waitFor(
      () => posted().includes('Deployed successfully.') || unresolved.length > 0,
      'post-approval continuation',
    );
    expect(unresolved).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(1);
  }, 30_000);

  it('sends an unlinked clicker the connect card instead of resuming', async () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com');
    const parked = await parkApproval();

    await parked.click(UNLINKED_USER);

    await waitFor(() => parked.posted().includes('/connect/slack'), 'connect card');
    await expectStillParked(parked);
  }, 30_000);

  it('refuses a clicker linked to another organization', async () => {
    const parked = await parkApproval();

    await parked.click(OTHER_ORG_USER);

    await waitFor(
      () => parked.posted().includes('This thread belongs to a Factory session in another organization.'),
      'other-organization refusal',
    );
    await expectStillParked(parked);
  }, 30_000);

  it('reports a pre-dispatch error when the clicked thread has no internal mapping', async () => {
    const parked = await parkApproval();

    await parked.click(SLACK_USER, 'slack:C-repro:9999999999.000001');

    await waitFor(
      () =>
        parked.posted().includes('Couldn’t start processing your message.') &&
        parked.posted().includes('messageId: posted-1'),
      'pre-dispatch reply',
    );
    await expectStillParked(parked);
  }, 30_000);
});
