import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerConfig, AgentControllerEvent } from './types';

function textModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'pong' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

async function runAsMappedCaller(authorizeSessionResource?: AgentControllerConfig['authorizeSessionResource']) {
  const storage = new InMemoryStore();
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    memory: new MockMemory({ storage }),
    modes: [{ id: 'build', agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: textModel() }) }],
    defaultModeId: 'build',
    ...(authorizeSessionResource ? { authorizeSessionResource } : {}),
  });
  await controller.init();
  await controller.getMastra()?.startWorkers();
  const session = await controller.createSession({ id: 'session-1', resourceId: 'session-1', ownerId: 'owner' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'shared-workspace');
  requestContext.set('user', { id: 'user-1' });
  const thrown: string[] = [];
  await Promise.race([
    session
      .sendMessage({ content: 'ping', requestContext })
      .catch(error => thrown.push(String(error?.message ?? error))),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);

  const errors = [
    ...thrown,
    ...events.flatMap(e => (e.type === 'error' ? [String((e as any).error?.message ?? (e as any).error)] : [])),
  ];
  const replied = events.some(
    e => e.type === 'message_update' && (e as any).event?.type === 'text-delta' && (e as any).event.delta === 'pong',
  );
  return { errors, replied };
}

describe('AgentController authorizeSessionResource', () => {
  it('runs an authorized mapped caller under the session resource', async () => {
    const authorize = vi.fn().mockResolvedValue(true);
    const { errors, replied } = await runAsMappedCaller(authorize);

    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'session-1', mappedResourceId: 'shared-workspace' }),
    );
    expect(authorize.mock.calls[0]![0].requestContext.get('user')).toEqual({ id: 'user-1' });
    expect(errors).toEqual([]);
    expect(replied).toBe(true);
  }, 30000);

  it.each([
    ['denies', vi.fn().mockResolvedValue(false)],
    ['returns a truthy non-true value', vi.fn().mockResolvedValue('yes')],
    ['is not configured', undefined],
  ])(
    'keeps the mapped resource when the host %s',
    async (_label, authorize) => {
      const { errors, replied } = await runAsMappedCaller(authorize);

      expect(replied).toBe(false);
      expect(errors.join('\n')).toMatch(/belongs to resource "session-1" but resource "shared-workspace"/);
    },
    30000,
  );

  // A session resolves its workspace once, at creation. The hook only moves
  // MASTRA_RESOURCE_ID_KEY; the controller context always carries the
  // session's own resource.
  it.each([
    ['approves', true, 'session-1'],
    ['denies', false, 'shared-workspace'],
  ])('resolves a workspace factory at session creation when the host %s', async (_label, approve, expected) => {
    const seen: unknown[] = [];
    const controllerResourceIds: unknown[] = [];
    const caller = new RequestContext();
    caller.set(MASTRA_RESOURCE_ID_KEY, 'shared-workspace');
    const controller = new AgentController({
      id: 'test-controller',
      storage: new InMemoryStore(),
      workspace: ({ requestContext }) => {
        seen.push(requestContext.get(MASTRA_RESOURCE_ID_KEY));
        controllerResourceIds.push(
          (requestContext.get('controller') as { resourceId?: string } | undefined)?.resourceId,
        );
        return createMockWorkspace();
      },
      modes: [{ id: 'build', agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: textModel() }) }],
      defaultModeId: 'build',
      authorizeSessionResource: async () => approve,
    });
    await controller.init();
    await controller.createSession({
      id: 'session-1',
      resourceId: 'session-1',
      ownerId: 'owner',
      requestContext: caller,
    });

    expect(seen).toEqual([expected]);
    expect(controllerResourceIds).toEqual(['session-1']);
    expect(caller.get(MASTRA_RESOURCE_ID_KEY)).toBe('shared-workspace');
  });

  it('fails the run when the host hook throws', async () => {
    const { errors, replied } = await runAsMappedCaller(vi.fn().mockRejectedValue(new Error('lookup down')));

    expect(replied).toBe(false);
    expect(errors.join('\n')).toMatch(/lookup down/);
  }, 30000);
});
