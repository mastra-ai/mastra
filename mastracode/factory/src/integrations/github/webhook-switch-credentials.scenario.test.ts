/**
 * Scenario: a pull request event reaches a session that is live but showing
 * another thread. Delivery switches it onto the subscribed thread first;
 * switching loads the thread's memory, and deployed memory resolves
 * credentials for the caller. A webhook has no signed-in user, so a switch
 * with no tenant failed with "the request has no authenticated user" and the
 * event was dropped.
 *
 * Drives the real `dispatchGithubWebhook` against a real `AgentController`
 * with the tenant credential resolver registered.
 */
import {
  resolveAuthenticatedCredentialTenant,
  withCredentialTenantPreparation,
} from '@mastra/code-sdk/agents/credential-resolver';
import { stateSchema } from '@mastra/code-sdk/schema';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../../routes/tenant-credentials.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { GithubSignalSubscriptionRow } from './subscriptions.js';
import { dispatchGithubWebhook } from './webhook.js';

vi.setConfig({ testTimeout: 30_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555558';
const OWNER = { workosId: 'user-1', organizationId: 'org-1' };

afterEach(() => resetTenantCredentialResolverForTests());

describe('GitHub delivery to a session showing another thread', () => {
  it('switches the session onto the subscribed thread as the subscriber and delivers the event', async () => {
    const factory = await createFactoryStorageForTests();
    registerTenantCredentialResolver(factory.credentials, new Set(), resolveAuthenticatedCredentialTenant);

    const memoryStorage = new InMemoryStore();
    const memory = new MockMemory({ storage: memoryStorage });
    const memoryUsers: unknown[] = [];
    const agent = new Agent({
      id: 'factory-agent',
      name: 'factory agent',
      instructions: 'You follow pull requests.',
      model: new MastraLanguageModelV2Mock({}),
      // Deployed memory resolves the caller's credentials before it loads.
      memory: withCredentialTenantPreparation(({ requestContext }) => {
        memoryUsers.push(requestContext.get('user'));
        return memory;
      }),
    });
    const mastra = new Mastra({ agents: { 'factory-agent': agent }, logger: false, storage: memoryStorage });
    const controller = new AgentController<MastraCodeState>({
      id: 'code',
      stateSchema,
      storage: memoryStorage,
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('factory-agent') }],
    });
    await controller.init();
    const owner = new RequestContext();
    owner.set('user', OWNER);
    const session = await controller.createSession({
      id: 'session-1',
      resourceId: PROJECT_ID,
      ownerId: 'user-1',
      requestContext: owner,
    });
    // The pull request's thread, then a second thread the session is showing when the event arrives.
    await session.thread.create({ requestContext: owner });
    const pullRequestThreadId = session.thread.requireId();
    await session.thread.create({ requestContext: owner });
    expect(session.thread.requireId()).not.toBe(pullRequestThreadId);

    const subscription: GithubSignalSubscriptionRow = {
      id: 'sub-1',
      orgId: 'org-1',
      targetKey: 'change-request:7:99:34',
      sessionId: 'session-1',
      resourceId: PROJECT_ID,
      threadId: pullRequestThreadId,
      status: 'open',
      data: {
        installationExternalId: '7',
        projectRepositoryId: 'project-repository-1',
        repositoryExternalId: '99',
        repositorySlug: 'octo/hello',
        changeRequestId: '34',
        ownerId: 'user-1',
        source: 'explicit-tool',
        subscribedByUserId: 'user-1',
      },
      createdAt: new Date('2026-11-17T00:00:00Z'),
      updatedAt: new Date('2026-11-17T00:00:00Z'),
    };
    const targetErrors: unknown[] = [];
    memoryUsers.length = 0;

    const result = await dispatchGithubWebhook(
      {
        event: 'pull_request',
        deliveryId: 'delivery-1',
        payload: {
          action: 'closed',
          installation: { id: 7 },
          repository: { id: 99, full_name: 'octo/hello' },
          sender: { login: 'ada' },
          pull_request: { number: 34, merged: true },
        },
      },
      {
        controller,
        isAuthorizedSender: async () => true,
        listSubscriptions: async () => [subscription],
        retireSubscription: async () => {},
        github: {
          integrationStorage: {} as never,
          getRepositoryCollaboratorPermission: async () => 'write',
          sourceControlStorage: {
            sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
          },
        },
        onTargetError: (_subscription, error) => targetErrors.push(error),
      },
    );

    expect(targetErrors).toEqual([]);
    expect(result).toMatchObject({ delivered: 1, failed: 0 });
    expect(session.thread.requireId()).toBe(pullRequestThreadId);
    expect(memoryUsers[0]).toEqual(OWNER);
  });
});
