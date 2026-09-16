import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { createDurableAgent } from '../agent/durable';
import { createTool } from '../tools';
import type { MastraBrowser } from '../browser';
import { RequestContext } from '../request-context';
import { createTestAgent, createTestController } from './test-utils';

function browser() {
  return { providerType: 'sdk', close: vi.fn().mockResolvedValue(undefined) } as unknown as MastraBrowser;
}

describe('session browser binding', () => {
  it('allows an unused browser to follow the initial exact-thread creation race', async () => {
    const unused = { ...browser(), status: 'pending' } as MastraBrowser;
    const controller = createTestController({ browser: async () => unused });
    await controller.init();
    const early = await controller.createSession({ ownerId: 'owner', resourceId: 'user', scope: 'thread:exact' });
    const exact = await controller.createSession({
      ownerId: 'owner',
      resourceId: 'user',
      scope: 'thread:exact',
      threadId: 'exact',
    });
    expect(exact).toBe(early);
    expect(exact.thread.getId()).toBe('exact');
    expect(exact.browser).toBe(unused);
  });

  it.each([false, true])(
    'executes each session browser tool through the registered agent (durable=%s)',
    async durable => {
      const calls: string[] = [];
      const model = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'tool-call', toolCallId: 'fixture', toolName: 'browser_fixture', input: '{}' }],
          finishReason: 'tool-calls',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'fixture',
                toolName: 'browser_fixture',
                input: '{}',
              });
              controller.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        }),
      });
      const base = createTestAgent({ model });
      const agent = durable ? createDurableAgent({ agent: base }) : base;
      const controller = createTestController({
        agent,
        browser: async ({ requestContext }) => {
          const scope = (requestContext.get('controller') as { scope: string }).scope;
          return {
            ...browser(),
            id: scope,
            provider: 'fixture',
            headless: true,
            getTools: () => ({
              browser_fixture: createTool({
                id: 'browser_fixture',
                description: 'Read local browser fixture',
                inputSchema: z.object({}),
                execute: async () => {
                  calls.push(scope);
                  return { browser: scope };
                },
              }),
            }),
            getInputProcessors: () => [],
            hasThreadSession: () => true,
            isBrowserRunning: () => true,
            getSessionId: () => scope,
            getBrowserState: async () => ({ tabs: [{ url: 'https://example.com/' + scope }], activeTabIndex: 0 }),
          } as unknown as MastraBrowser;
        },
      });
      await controller.init();
      const sessions = await Promise.all(
        ['a', 'b'].map(scope => controller.createSession({ ownerId: 'owner', resourceId: 'user', scope })),
      );
      const results = await Promise.all(
        sessions.map(async session =>
          agent.generate('Read my browser', {
            requestContext: await session.machinery.buildRequestContext(),
            maxSteps: 1,
          }),
        ),
      );
      expect(calls.sort()).toEqual(['a', 'b']);
      expect(results.map(result => result.toolResults[0]?.payload.result)).toEqual([
        { browser: 'a' },
        { browser: 'b' },
      ]);
      expect(sessions.map(session => session.browser?.id)).toEqual(['a', 'b']);
    },
  );

  it('hides a factory browser after thread rebinding and retains it for cleanup', async () => {
    const agent = createTestAgent();
    const controller = createTestController({ agent, browser: async () => browser() });
    await controller.init();
    const session = await controller.createSession({ ownerId: 'owner', resourceId: 'user' });
    const original = session.browser!;
    await session.thread.create();
    expect(session.browser).toBeUndefined();
    expect(await agent.getBrowser({ requestContext: await session.machinery.buildRequestContext() })).toBeUndefined();
    await controller.deleteSession({ resourceId: 'user' });
    expect(original.close).toHaveBeenCalledOnce();
  });

  it('keeps a failed close reachable so deletion can retry', async () => {
    const owned = browser();
    vi.mocked(owned.close).mockRejectedValueOnce(new Error('close failed'));
    const controller = createTestController({ browser: async () => owned });
    await controller.init();
    const session = await controller.createSession({ ownerId: 'owner', resourceId: 'user' });
    await expect(controller.deleteSession({ resourceId: 'user' })).rejects.toThrow('close failed');
    expect(await controller.getSessionByResource('user')).toBe(session);
    expect(session.browser).toBe(owned);
    await controller.deleteSession({ resourceId: 'user' });
    expect(owned.close).toHaveBeenCalledTimes(2);
    expect(await controller.getSessionByResource('user')).toBeUndefined();
  });

  it('returns the exact session browser for concurrent scopes and rejects stale identity', async () => {
    const factory = vi.fn(async () => browser());
    const agent = createTestAgent();
    const controller = createTestController({ agent, browser: factory });
    await controller.init();
    const [a, b] = await Promise.all(
      ['a', 'b'].map(scope => controller.createSession({ ownerId: 'owner', resourceId: 'user', scope })),
    );
    const [ca, cb] = await Promise.all([a!.machinery.buildRequestContext(), b!.machinery.buildRequestContext()]);
    expect(
      await Promise.all([agent.getBrowser({ requestContext: ca }), agent.getBrowser({ requestContext: cb })]),
    ).toEqual([a!.browser, b!.browser]);
    expect(a!.browser).not.toBe(b!.browser);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(agent.browser).toBeUndefined();
    const old = a!.browser!;
    await controller.deleteSession({ resourceId: 'user', scope: 'a' });
    expect(old.close).toHaveBeenCalledOnce();
    expect(b!.browser!.close).not.toHaveBeenCalled();
    expect(await agent.getBrowser({ requestContext: ca })).toBeUndefined();
    const replacement = await controller.createSession({ ownerId: 'owner', resourceId: 'user', scope: 'a' });
    expect(replacement.browser).not.toBe(old);
    expect(await agent.getBrowser({ requestContext: ca })).toBeUndefined();
    expect(await agent.getBrowser({ requestContext: new RequestContext() })).toBeUndefined();
  });

  it('releases a factory browser before moving to another resource', async () => {
    const agent = createTestAgent();
    const controller = createTestController({ agent, browser: async () => browser() });
    await controller.init();
    const session = await controller.createSession({ ownerId: 'owner', resourceId: 'a' });
    const old = session.browser!;
    await controller.setResourceId(session, { resourceId: 'b' });
    expect(old.close).toHaveBeenCalledOnce();
    expect(session.browser).toBeUndefined();
  });

  it('does not close a caller-owned static browser or replace an agent browser', async () => {
    const shared = browser();
    const own = browser();
    const agent = createTestAgent({ browser: own });
    const controller = createTestController({ agent, browser: shared });
    await controller.init();
    await controller.createSession({ ownerId: 'owner', resourceId: 'user' });
    await controller.deleteSession({ resourceId: 'user' });
    expect(shared.close).not.toHaveBeenCalled();
    expect(await agent.getBrowser()).toBe(own);
  });

  it('closes a shared factory result only after its last session is deleted', async () => {
    const shared = browser();
    const controller = createTestController({ browser: async () => shared });
    await controller.init();
    await Promise.all(
      ['a', 'b'].map(scope => controller.createSession({ ownerId: 'owner', resourceId: 'user', scope })),
    );
    await controller.deleteSession({ resourceId: 'user', scope: 'a' });
    expect(shared.close).not.toHaveBeenCalled();
    await controller.deleteSession({ resourceId: 'user', scope: 'b' });
    expect(shared.close).toHaveBeenCalledOnce();
  });
});
