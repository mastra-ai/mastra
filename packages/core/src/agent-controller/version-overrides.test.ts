import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { getMessageAuthor } from '../agent/signals';
import { getAgentVersionPins } from '../agent/version-pins';
import { Mastra } from '../mastra';
import type { VersionOverrides } from '../mastra/types';
import { MockMemory } from '../memory/mock';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { createMockModel } from '../test-utils/llm-mock';
import { AgentController } from './agent-controller';
import { THREAD_OWNER_ID_CONTEXT_KEY } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerRequestContext } from './types';

async function createRuntime({ persistMessages = false } = {}) {
  const defaults = vi.fn((_input: { requestContext: RequestContext }) => ({
    versions: { agents: { root: { versionId: 'default-version' } } } satisfies VersionOverrides,
  }));
  const contexts: RequestContext[] = [];
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'root',
    name: 'Root',
    instructions: ({ requestContext }) => {
      contexts.push(requestContext);
      return 'Answer briefly.';
    },
    model: createMockModel({ mockText: 'Completed' }),
    defaultOptions: defaults,
    ...(persistMessages && { memory: new MockMemory({ storage }) }),
  });
  const controller = new AgentController({
    id: 'controller',
    storage,
    workspace: createMockWorkspace(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  const mastra = new Mastra({ logger: false, storage, agentControllers: { controller } });
  const resolveVersion = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (source, selector) => {
    const fork = source.__fork();
    fork.__setRawConfig({ resolvedVersionId: 'versionId' in selector ? selector.versionId : 'default-version' });
    fork.__markStoredVersionApplied();
    return fork;
  });
  await controller.init();
  const session = await controller.createSession({ id: crypto.randomUUID(), ownerId: 'owner' });
  defaults.mockClear();
  contexts.length = 0;
  const buildStreamOptions = vi.spyOn(session.machinery, 'buildStreamOptions');
  const requestContext = new RequestContext();
  requestContext.set('tenant', 'original-tenant');
  requestContext.set(MASTRA_VERSIONS_KEY, { agents: { root: { versionId: 'context-version' } } });
  return { agent, session, defaults, contexts, resolveVersion, requestContext, buildStreamOptions };
}

describe('AgentController per-call version selection', () => {
  it.each(['sendMessage', 'steer', 'followUp', 'queueMessage'] as const)(
    '%s keeps its explicit version ahead of agent defaults and preserves execution context',
    async method => {
      const baseline = await createRuntime();
      await baseline.session[method]({ content: 'Run configured defaults', requestContext: baseline.requestContext });
      const runtime = await createRuntime();
      const versions: VersionOverrides = { agents: { root: { versionId: 'requested-version' } } };

      await runtime.session[method]({
        content: 'Run the requested version',
        requestContext: runtime.requestContext,
        versions,
      });

      expect(runtime.resolveVersion).toHaveBeenCalledWith(expect.any(Agent), { versionId: 'requested-version' });
      // Stream setup and tool preparation already evaluate defaults. Forwarding
      // per-call selectors must not add another eager evaluation in the controller.
      expect(runtime.defaults).toHaveBeenCalledTimes(baseline.defaults.mock.calls.length);
      const executionContext = runtime.contexts.at(-1)!;
      expect(executionContext.get('tenant')).toBe('original-tenant');
      expect(runtime.buildStreamOptions.mock.calls[0]![0].requestContext).toBe(runtime.requestContext);
      expect(
        runtime.defaults.mock.calls.every(([input]) => input.requestContext.get('tenant') === 'original-tenant'),
      ).toBe(true);
      expect(getAgentVersionPins(executionContext)?.root?.versionId).toBe('requested-version');
      expect(runtime.requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
        agents: { root: { versionId: 'context-version' } },
      });
    },
  );

  it.each(['sendMessage', 'queueMessage', 'steer'] as const)(
    '%s preserves explicit versions and message authors independently of the trusted thread owner',
    async method => {
      const runtime = await createRuntime({ persistMessages: true });
      await runtime.session.thread.transferOwnership({ toOwnerId: 'thread-owner' });
      runtime.requestContext.setRaw(THREAD_OWNER_ID_CONTEXT_KEY, 'spoofed-owner');
      runtime.requestContext.set('controller', { threadOwnerId: 'spoofed-owner' });
      const author = { id: 'message-author', name: 'Reviewer' };

      await runtime.session[method]({
        content: 'Run the requested version with an explicit author',
        requestContext: runtime.requestContext,
        versions: { agents: { root: { versionId: 'requested-version' } } },
        author,
      });

      const executionContext = runtime.contexts.at(-1)!;
      const controllerContext = executionContext.get('controller') as AgentControllerRequestContext;
      expect(getAgentVersionPins(executionContext)?.root).toMatchObject({
        agentId: 'root',
        versionId: 'requested-version',
      });
      expect(controllerContext.threadOwnerId).toBe('thread-owner');
      expect(controllerContext.session.ownerId).toBe('owner');
      expect(executionContext.getRaw(THREAD_OWNER_ID_CONTEXT_KEY)).toBe('thread-owner');
      expect(runtime.requestContext.getRaw(THREAD_OWNER_ID_CONTEXT_KEY)).toBe('spoofed-owner');
      expect(runtime.requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
        agents: { root: { versionId: 'context-version' } },
      });

      const messages = await runtime.session.thread.listMessages({ threadId: runtime.session.thread.requireId() });
      const userMessages = messages.filter(message => message.role === 'signal');
      expect(userMessages).toHaveLength(1);
      expect(getMessageAuthor(userMessages[0]!)).toEqual(author);
    },
  );

  it('captures the caller policy before asynchronous message setup', async () => {
    const runtime = await createRuntime();
    const versions: VersionOverrides = { agents: { root: { versionId: 'requested-version' } } };
    const run = runtime.session.sendMessage({ content: 'Run once', requestContext: runtime.requestContext, versions });
    versions.agents!.root = { versionId: 'mutated-version' };
    await run;

    expect(runtime.resolveVersion).toHaveBeenCalledWith(expect.any(Agent), { versionId: 'requested-version' });
  });

  it('forwards selectors supplied in sendSignal options to the real run', async () => {
    const runtime = await createRuntime();
    let complete = false;
    runtime.session.subscribe(event => {
      if (event.type === 'agent_end' && event.reason === 'complete') complete = true;
    });
    const signal = runtime.session.sendSignal(
      { content: 'Run the requested version' },
      {
        requestContext: runtime.requestContext,
        versions: { agents: { root: { versionId: 'requested-version' } } },
        requireDelivery: true,
      },
    );
    await signal.accepted;
    await vi.waitFor(() => expect(complete).toBe(true));

    expect(getAgentVersionPins(runtime.contexts.at(-1)!)?.root?.versionId).toBe('requested-version');
  });
});
