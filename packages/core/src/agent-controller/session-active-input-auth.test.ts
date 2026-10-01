import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

const SESSION_RESOURCE = 'session-1';

function textChunks(text: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ] as any[];
}

/** Records every prompt; the first stream stays open until `release()`. */
function createRecordingModel() {
  const prompts: string[] = [];
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let started!: () => void;
  const firstStarted = new Promise<void>(resolve => (started = resolve));
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls += 1;
      prompts.push(JSON.stringify(prompt));
      const hold = calls === 1;
      if (hold) started();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            const [first, ...rest] = textChunks('ok');
            controller.enqueue(first);
            if (hold) await released;
            rest.forEach(chunk => controller.enqueue(chunk));
            controller.close();
          },
        }),
      };
    },
  });
  return { model, prompts, release, firstStarted };
}

/** A mapped caller: the server's auth layer put their user resource on the context. */
function mappedCaller(user: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, user);
  requestContext.set('mastra__user', { id: user });
  return requestContext;
}

const mismatch = { id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH', category: 'USER' };

async function setup({ withThread = true } = {}) {
  const storage = new InMemoryStore();
  const recording = createRecordingModel();
  const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: recording.model });
  const authorize = vi.fn(async ({ mappedResourceId }: { mappedResourceId: string }) =>
    mappedResourceId.startsWith('carol'),
  );
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    memory: new MockMemory({ storage }),
    modes: [{ id: 'build', agent }],
    defaultModeId: 'build',
    authorizeSessionResource: authorize as any,
  });
  await controller.init();
  await controller.getMastra()?.startWorkers();
  const session = await controller.createSession({ id: SESSION_RESOURCE, resourceId: SESSION_RESOURCE, ownerId: 'o' });
  if (withThread) {
    if (!session.thread.getId()) session.thread.set({ threadId: (await session.thread.create()).id });
  } else {
    session.thread.clear();
  }
  return { agent, session, authorize, storage, ...recording };
}

/** Alice (the session's own resource) starts a run that stays open. */
async function startAliceRun(ctx: Awaited<ReturnType<typeof setup>>) {
  const alice = ctx.session.sendMessage({ content: 'from alice' });
  await ctx.firstStarted;
  await vi.waitFor(() => expect(ctx.session.stream.isActive()).toBe(true));
  return { alice };
}

async function finish(ctx: Awaited<ReturnType<typeof setup>>, pending: unknown[]) {
  ctx.release();
  await vi.waitFor(() => expect(ctx.session.stream.isActive()).toBe(false));
  await Promise.allSettled(pending);
}

async function storedText(ctx: Awaited<ReturnType<typeof setup>>) {
  const messages = await ctx.session.thread.listActiveMessages();
  return JSON.stringify(messages);
}

describe('Session active-run input authorization', () => {
  it('rejects a denied caller sending into a live run; the text never reaches the model or storage', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);

    await expect(
      ctx.session.sendMessage({ content: 'bob-secret', requestContext: mappedCaller('bob') }),
    ).rejects.toMatchObject(mismatch);
    expect(ctx.authorize).toHaveBeenCalledTimes(1);

    await finish(ctx, [alice]);
    const next = ctx.session.sendMessage({ content: 'after' });
    await vi.waitFor(() => expect(ctx.prompts.length).toBeGreaterThanOrEqual(2));
    await next;
    expect(ctx.prompts.at(-1)).toContain('after');
    expect(ctx.prompts.join('\n')).not.toContain('bob-secret');
    expect(await storedText(ctx)).not.toContain('bob-secret');
  });

  it('delivers an approved caller into the live run with the policy called once', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);

    const carol = ctx.session.sendMessage({ content: 'carol-hello', requestContext: mappedCaller('carol') });
    await vi.waitFor(() => expect(ctx.authorize).toHaveBeenCalledTimes(1));
    await finish(ctx, [alice, carol]);
    await expect(carol).resolves.toBeUndefined();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
    expect(ctx.prompts.join('\n')).toContain('carol-hello');
  });

  it('delivers both approved callers when they collide during one run', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);

    const one = ctx.session.sendMessage({ content: 'carol-one', requestContext: mappedCaller('carol-1') });
    const two = ctx.session.sendMessage({ content: 'carol-two', requestContext: mappedCaller('carol-2') });
    await vi.waitFor(() => expect(ctx.authorize).toHaveBeenCalledTimes(2));
    await finish(ctx, [alice, one, two]);
    await expect(Promise.all([one, two])).resolves.toBeDefined();
    const all = ctx.prompts.join('\n');
    expect(all).toContain('carol-one');
    expect(all).toContain('carol-two');
  });

  it('rejects a denied caller on a session with no thread without creating one', async () => {
    const ctx = await setup({ withThread: false });
    const subscribe = vi.spyOn(ctx.agent, 'subscribeToThread');

    const error = await ctx.session
      .sendMessage({ content: 'bob-secret', requestContext: mappedCaller('bob') })
      .catch(e => e);
    expect(error).toMatchObject(mismatch);
    expect(error.message).toBe(
      'Resource "bob" was provided but this session belongs to resource "session-1". A thread can only be used by the resource that owns it.',
    );
    expect(error.details).not.toHaveProperty('threadId');
    expect(ctx.session.thread.getId()).toBeNull();
    expect(subscribe).not.toHaveBeenCalled();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
  });

  it('rejects a denied direct Session.sendSignal into a live run', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);
    const sendSignal = vi.spyOn(ctx.agent, 'sendSignal');

    const result = ctx.session.sendSignal(
      { type: 'user-message', contents: 'bob-secret' } as any,
      { requestContext: mappedCaller('bob') } as any,
    );
    await expect(result.accepted).rejects.toMatchObject(mismatch);
    expect(sendSignal).not.toHaveBeenCalled();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
    await finish(ctx, [alice]);
    expect(ctx.prompts.join('\n')).not.toContain('bob-secret');
  });

  it('rejects a denied steer without aborting the live run', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);
    const runId = ctx.session.stream.activeRunId();

    await expect(
      ctx.session.steer({ content: 'bob-steer', requestContext: mappedCaller('bob') }),
    ).rejects.toMatchObject(mismatch);
    expect(ctx.session.stream.activeRunId()).toBe(runId);
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
    await finish(ctx, [alice]);
    expect(ctx.prompts.join('\n')).not.toContain('bob-steer');
  });

  it('lets an approved caller steer with the policy called once', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);

    const steer = ctx.session.steer({ content: 'carol-steer', requestContext: mappedCaller('carol') });
    ctx.release();
    await steer;
    await vi.waitFor(() => expect(ctx.prompts.join('\n')).toContain('carol-steer'));
    await vi.waitFor(() => expect(ctx.session.stream.isActive()).toBe(false));
    await Promise.allSettled([alice]);
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
  });

  it('rejects a denied follow-up with nothing queued', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);
    const queueMessage = vi.spyOn(ctx.agent, 'queueMessage');

    await expect(
      ctx.session.followUp({ content: 'bob-follow', requestContext: mappedCaller('bob') }),
    ).rejects.toMatchObject(mismatch);
    expect(queueMessage).not.toHaveBeenCalled();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
    await finish(ctx, [alice]);
    expect(ctx.prompts.join('\n')).not.toContain('bob-follow');
  });

  it('rejects a denied queued message while another caller runs', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);
    const queueMessage = vi.spyOn(ctx.agent, 'queueMessage');

    await expect(
      ctx.session.queueMessage({ content: 'bob-queued', requestContext: mappedCaller('bob') }),
    ).rejects.toMatchObject(mismatch);
    expect(queueMessage).not.toHaveBeenCalled();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
    await finish(ctx, [alice]);
    expect(ctx.prompts.join('\n')).not.toContain('bob-queued');
    expect(await storedText(ctx)).not.toContain('bob-queued');
  });

  it('rejects a denied queued message on a threadless session without creating a thread', async () => {
    const ctx = await setup({ withThread: false });
    const subscribe = vi.spyOn(ctx.agent, 'subscribeToThread');

    const error = await ctx.session
      .queueMessage({ content: 'bob-queued', requestContext: mappedCaller('bob') })
      .catch(e => e);
    expect(error).toMatchObject(mismatch);
    expect(error.message).not.toContain('Thread "undefined"');
    expect(ctx.session.thread.getId()).toBeNull();
    expect(subscribe).not.toHaveBeenCalled();
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
  });

  it('queues an approved message with matching top-level and ifIdle resource keys', async () => {
    const ctx = await setup();
    const { alice } = await startAliceRun(ctx);
    const queueMessage = vi.spyOn(ctx.agent, 'queueMessage');

    const queued = ctx.session.queueMessage({ content: 'carol-queued', requestContext: mappedCaller('carol') });
    await vi.waitFor(() => expect(queueMessage).toHaveBeenCalledTimes(1));
    const target = queueMessage.mock.calls[0]![1] as any;
    expect(target.requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe(SESSION_RESOURCE);
    expect(target.ifIdle.streamOptions.requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe(
      target.requestContext.get(MASTRA_RESOURCE_ID_KEY),
    );
    expect(target.requestContext.get('controller')).toBeDefined();
    await finish(ctx, [alice, queued]);
    await vi.waitFor(() => expect(ctx.prompts.join('\n')).toContain('carol-queued'));
    expect(ctx.authorize).toHaveBeenCalledTimes(1);
  });

  describe('notifications', () => {
    const note = (summary: string) => ({ source: 'ci', kind: 'status', priority: 'high' as const, summary });
    async function records(ctx: Awaited<ReturnType<typeof setup>>) {
      const notifications = await ctx.storage.getStore('notifications');
      return notifications!.listNotifications({ threadId: ctx.session.thread.getId()! });
    }

    it('rejects a denied active notification with no record created', async () => {
      const ctx = await setup();
      const { alice } = await startAliceRun(ctx);

      await expect(
        ctx.session.sendNotificationSignal(note('bob-note'), { requestContext: mappedCaller('bob') }),
      ).rejects.toMatchObject(mismatch);
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(await records(ctx))).not.toContain('bob-note');
      await finish(ctx, [alice]);
      expect(ctx.prompts.join('\n')).not.toContain('bob-note');
    });

    it('delivers and records an approved active notification', async () => {
      const ctx = await setup();
      const { alice } = await startAliceRun(ctx);

      const result = await ctx.session.sendNotificationSignal(note('carol-note'), {
        requestContext: mappedCaller('carol'),
      });
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
      expect(result.record?.summary).toBe('carol-note');
      await finish(ctx, [alice, result.accepted]);
      expect(JSON.stringify(await records(ctx))).toContain('carol-note');
    });

    it('rejects a denied idle notification without creating a thread or subscription', async () => {
      const ctx = await setup({ withThread: false });
      const subscribe = vi.spyOn(ctx.agent, 'subscribeToThread');

      const error = await ctx.session
        .sendNotificationSignal(note('bob-note'), { requestContext: mappedCaller('bob') })
        .catch(e => e);
      expect(error).toMatchObject(mismatch);
      expect(error.message).not.toContain('Thread "undefined"');
      expect(ctx.session.thread.getId()).toBeNull();
      expect(subscribe).not.toHaveBeenCalled();
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects a direct agent.sendToolApproval with a mismatched caller context', async () => {
    const ctx = await setup();
    await expect(
      ctx.agent.sendToolApproval({
        resourceId: SESSION_RESOURCE,
        threadId: ctx.session.thread.getId()!,
        approved: true,
        requestContext: mappedCaller('mallory'),
      }),
    ).rejects.toMatchObject(mismatch);
    expect(ctx.prompts).toHaveLength(0);
  });

  describe('tool control', () => {
    it.each(['approveToolCall', 'declineToolCall'] as const)(
      'rejects a denied %s before anything reaches the run, even with the caller passing its own resourceId',
      async method => {
        const ctx = await setup();
        const { alice } = await startAliceRun(ctx);
        const sendToolApproval = vi.spyOn(ctx.agent, 'sendToolApproval');
        const subscribe = vi.spyOn(ctx.agent, 'subscribeToThread');

        await expect(
          ctx.session[method]({ toolCallId: 'call-1', resourceId: 'bob', requestContext: mappedCaller('bob') }),
        ).rejects.toMatchObject(mismatch);
        expect(sendToolApproval).not.toHaveBeenCalled();
        expect(subscribe).not.toHaveBeenCalled();
        expect(ctx.authorize).toHaveBeenCalledTimes(1);
        await finish(ctx, [alice]);
      },
    );

    it('rejects a denied resumeToolCall and leaves the tool parked', async () => {
      const ctx = await setup();
      const { alice } = await startAliceRun(ctx);
      ctx.session.suspensions.register({
        toolCallId: 'call-1',
        runId: 'alice-run',
        toolName: 'ask',
        threadId: ctx.session.thread.getId()!,
        resourceId: SESSION_RESOURCE,
      });
      const resume = vi.spyOn(ctx.agent, 'resumeStream');

      await expect(
        ctx.session.resumeToolCall({ toolCallId: 'call-1', resumeData: 'x', requestContext: mappedCaller('bob') }),
      ).rejects.toMatchObject(mismatch);
      expect(ctx.session.suspensions.get({ toolCallId: 'call-1' })).toBeDefined();
      expect(resume).not.toHaveBeenCalled();
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
      await finish(ctx, [alice]);
    });

    it('rejects a denied respondToToolSuspension without ending the owner run', async () => {
      const ctx = await setup();
      const { alice } = await startAliceRun(ctx);
      ctx.session.suspensions.register({
        toolCallId: 'call-1',
        runId: 'alice-run',
        toolName: 'ask',
        threadId: ctx.session.thread.getId()!,
        resourceId: SESSION_RESOURCE,
      });
      const resume = vi.spyOn(ctx.agent, 'resumeStream');
      const events: string[] = [];
      ctx.session.subscribe(event => {
        events.push(event.type);
      });

      await expect(
        ctx.session.respondToToolSuspension({
          toolCallId: 'call-1',
          resumeData: 'x',
          requestContext: mappedCaller('bob'),
        }),
      ).rejects.toMatchObject(mismatch);
      expect(ctx.session.suspensions.get({ toolCallId: 'call-1' })).toBeDefined();
      expect(resume).not.toHaveBeenCalled();
      expect(events).not.toContain('agent_end');
      expect(events).not.toContain('error');
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
      await finish(ctx, [alice]);
    });

    it('lets an approved caller through approveToolCall with the policy called once', async () => {
      const ctx = await setup();
      const { alice } = await startAliceRun(ctx);
      const sendToolApproval = vi.spyOn(ctx.agent, 'sendToolApproval').mockResolvedValue(undefined as never);

      await ctx.session.approveToolCall({ toolCallId: 'call-1', requestContext: mappedCaller('carol') });
      expect(sendToolApproval).toHaveBeenCalledOnce();
      expect(sendToolApproval.mock.calls[0]![0].requestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe(SESSION_RESOURCE);
      expect(ctx.authorize).toHaveBeenCalledTimes(1);
      await finish(ctx, [alice]);
    });
  });
});
