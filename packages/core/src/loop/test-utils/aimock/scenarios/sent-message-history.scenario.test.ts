/**
 * AIMock Scenario: a message a person sends is in thread history while the agent works on it.
 *
 * A chat that reloads mid-run rebuilds its transcript from stored history. A message sent with
 * `sendMessage` used to be stored only when the run saved its turn (at its end, or at a later
 * step), so a reload during a long first step showed an empty conversation. Each case reads
 * storage from inside a tool, while the run is provably still working.
 */

import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import type { StorageThreadType } from '../../../../memory/types';
import type { Processor } from '../../../../processors';
import { MessageHistory } from '../../../../processors/memory';
import { createTool } from '../../../../tools';
import { anyToolResult, createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { isDurableEngineVariant } from '../types';

// Stores a copy of each thread, as a database does, so a run's in-memory thread does not see
// writes made by others.
class CopyingMemory extends MockMemory {
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await super.saveThread({ thread: structuredClone(thread) });
    return thread;
  }
}

const REQUEST = 'Build the login page.';
const FOLLOW_UP = 'Use the existing button component.';
const LATE_FOLLOW_UP = 'Also add a forgot-password link.';
const ANSWER = 'The login page is ready.';

function texts(messages: MastraDBMessage[]) {
  return messages.filter(message => message.role === 'signal').map(message => JSON.stringify(message.content.parts));
}

function requestText(request: any): string {
  return JSON.stringify(request?.body?.messages ?? []);
}

async function storedMessages(memory: MockMemory, threadId: string) {
  const store = (await memory.storage.getStore('memory'))!;
  return (await store.listMessages({ threadId, perPage: false })).messages;
}

async function finishRun(accepted: Promise<any>) {
  const run = await accepted;
  expect(run.action).toBe('wake');
  await run.output.consumeStream();
}

describeForAllEngines('A sent message is in thread history while the agent works on it', engine => {
  const getMock = useLoopScenarioAimock();
  // Durable engines save the message that starts a run before execution, from the run's input
  // (see durable-input-persistence.scenario.test.ts). A message that joins a running run is saved
  // with the turn there, and a step processor that rejects the message cannot undo that save.
  const durable = isDurableEngineVariant(engine);
  const itFailsOnDurable = durable ? it.fails : it;

  it('stores the message that starts a run while the agent works on it', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = 'sent-message-wake';
    const resourceId = 'sent-message-user';
    let duringTool: MastraDBMessage[] | undefined;
    const tools = {
      clone_repository: createTool({
        id: 'clone_repository',
        description: 'Clones the repository; slow',
        inputSchema: z.object({}),
        execute: async () => {
          duringTool = await storedMessages(memory, threadId);
          return { cloned: true };
        },
      }),
    };
    llm.on(
      { endpoint: 'chat', predicate: req => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_clone', name: 'clone_repository', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', predicate: req => anyToolResult(req) }, { content: ANSWER });
    const { agent } = await createSharedAgent(llm, { engine, memory, tools });

    const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
    await finishRun(sent.accepted);

    expect(texts(duringTool!), 'the request must be stored while the agent works on it').toEqual([
      expect.stringContaining(REQUEST),
    ]);
    const after = await storedMessages(memory, threadId);
    expect(
      after.filter(message => message.id === sent.signal.id),
      'the run saves the same row',
    ).toHaveLength(1);
    expect(JSON.stringify(after.filter(message => message.role === 'assistant'))).toContain(ANSWER);
  });

  itFailsOnDurable('stores a message sent right after the first, which joins the same request', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = 'sent-message-pre-run';
    const resourceId = 'sent-message-user';
    let duringTool: MastraDBMessage[] | undefined;
    const tools = {
      clone_repository: createTool({
        id: 'clone_repository',
        description: 'Clones the repository; slow',
        inputSchema: z.object({}),
        execute: async () => {
          duringTool = await storedMessages(memory, threadId);
          return { cloned: true };
        },
      }),
    };
    llm.on(
      { endpoint: 'chat', predicate: req => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_clone', name: 'clone_repository', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', predicate: req => anyToolResult(req) }, { content: ANSWER });
    const { agent } = await createSharedAgent(llm, { engine, memory, tools });

    const first = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
    const second = agent.sendMessage({ contents: FOLLOW_UP }, { resourceId, threadId });
    expect(await second.accepted).toMatchObject({ action: 'deliver' });
    await finishRun(first.accepted);

    expect(requestText(llm.getRequests()[0]), 'the follow-up joins the first request').toContain(FOLLOW_UP);
    expect(texts(duringTool!)).toEqual([expect.stringContaining(REQUEST), expect.stringContaining(FOLLOW_UP)]);
  });

  itFailsOnDurable('stores a message sent while the agent works once its next request takes it in', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = 'sent-message-active';
    const resourceId = 'sent-message-user';
    let agent: any;
    let duringNextTool: MastraDBMessage[] | undefined;
    const tools = {
      clone_repository: createTool({
        id: 'clone_repository',
        description: 'Clones the repository; the person sends a follow-up meanwhile',
        inputSchema: z.object({}),
        execute: async () => {
          const followUp = agent.sendMessage({ contents: LATE_FOLLOW_UP }, { resourceId, threadId });
          expect(await followUp.accepted).toMatchObject({ action: 'deliver' });
          return { cloned: true };
        },
      }),
      run_checks: createTool({
        id: 'run_checks',
        description: 'Runs the checks',
        inputSchema: z.object({}),
        execute: async () => {
          duringNextTool = await storedMessages(memory, threadId);
          return { passed: true };
        },
      }),
    };
    llm.on(
      { endpoint: 'chat', predicate: req => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_clone', name: 'clone_repository', arguments: {} }] },
    );
    llm.on(
      {
        endpoint: 'chat',
        predicate: req => JSON.stringify(req).includes(LATE_FOLLOW_UP) && !JSON.stringify(req).includes('call_checks'),
      },
      { toolCalls: [{ id: 'call_checks', name: 'run_checks', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', predicate: req => JSON.stringify(req).includes('call_checks') }, { content: ANSWER });
    ({ agent } = await createSharedAgent(llm, { engine, memory, tools }));

    const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId, ifIdle: { behavior: 'wake' } });
    const run = await sent.accepted;
    await run.output.consumeStream();

    expect(duringNextTool, 'the request that took in the follow-up must have run a tool').toBeDefined();
    expect(texts(duringNextTool!)).toEqual([expect.stringContaining(REQUEST), expect.stringContaining(LATE_FOLLOW_UP)]);
  });

  itFailsOnDurable('stores the message only where a configured MessageHistory saves the turn', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const historyMemory = new MockMemory();
    const threadId = 'sent-message-own-history';
    const resourceId = 'sent-message-user';
    let duringTool: { history: MastraDBMessage[]; memory: MastraDBMessage[] } | undefined;
    const tools = {
      clone_repository: createTool({
        id: 'clone_repository',
        description: 'Clones the repository; slow',
        inputSchema: z.object({}),
        execute: async () => {
          duringTool = {
            history: await storedMessages(historyMemory, threadId),
            memory: await storedMessages(memory, threadId),
          };
          return { cloned: true };
        },
      }),
    };
    llm.on(
      { endpoint: 'chat', predicate: req => !anyToolResult(req) },
      { toolCalls: [{ id: 'call_clone', name: 'clone_repository', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', predicate: req => anyToolResult(req) }, { content: ANSWER });
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      tools,
      defaultOptions: {
        outputProcessors: [new MessageHistory({ storage: (await historyMemory.storage.getStore('memory'))! })],
      },
    });

    const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
    await finishRun(sent.accepted);

    expect(texts(duringTool!.history), 'its save marks the live stream as saved, so only the turn saves').toEqual([]);
    expect(texts(duringTool!.memory)).toEqual([]);
    const after = await storedMessages(historyMemory, threadId);
    expect(after.filter(message => message.id === sent.signal.id)).toHaveLength(1);
    expect(texts(await storedMessages(memory, threadId))).toEqual([]);
  });

  // The early save must not re-create a thread the run already created: that rewrote the thread
  // from the run's copy and dropped metadata written since (here by an input processor).
  it('keeps thread metadata written during the run when the message starts a new thread', async () => {
    const llm = getMock();
    const memory = new CopyingMemory();
    const threadId = 'sent-message-new-thread-metadata';
    const resourceId = 'sent-message-user';
    llm.on({ endpoint: 'chat' }, { content: ANSWER });
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      inputProcessors: [
        {
          id: 'tag-thread',
          processInput: async ({ messages }) => {
            await memory.updateThread({ id: threadId, title: '', metadata: { fromProcessor: 'kept' } });
            return messages;
          },
        },
      ],
    });

    const sent = agent.sendMessage(
      { contents: REQUEST },
      {
        resourceId,
        threadId,
        ifIdle: {
          behavior: 'wake',
          streamOptions: { memory: { resource: resourceId, thread: { id: threadId, metadata: { client: 'chat' } } } },
        },
      },
    );
    await finishRun(sent.accepted);

    expect((await memory.getThreadById({ threadId }))?.metadata).toEqual({ client: 'chat', fromProcessor: 'kept' });
    expect(texts(await storedMessages(memory, threadId))).toEqual([expect.stringContaining(REQUEST)]);
  });

  // Durable engines stop before the model when their initial save fails, by design
  // (see durable-input-persistence.scenario.test.ts).
  it.skipIf(durable)(
    'still answers when the early save fails, and stores the message at the next request',
    async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const threadId = 'sent-message-failed-early-save';
      const resourceId = 'sent-message-user';
      await memory.createThread({ threadId, resourceId });
      const store = (await memory.storage.getStore('memory'))!;
      const save = store.saveMessages.bind(store);
      let failures = 1;
      const failFirstSave = vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
        if (failures-- > 0) throw new Error('STORAGE_UNAVAILABLE');
        return save(args);
      });
      let duringFirstTool: MastraDBMessage[] | undefined;
      let duringSecondTool: MastraDBMessage[] | undefined;
      const tools = {
        clone_repository: createTool({
          id: 'clone_repository',
          description: 'Clones the repository; slow',
          inputSchema: z.object({}),
          execute: async () => {
            duringFirstTool = await storedMessages(memory, threadId);
            return { cloned: true };
          },
        }),
        run_checks: createTool({
          id: 'run_checks',
          description: 'Runs the checks',
          inputSchema: z.object({}),
          execute: async () => {
            duringSecondTool = await storedMessages(memory, threadId);
            return { passed: true };
          },
        }),
      };
      llm.on(
        { endpoint: 'chat', predicate: req => !JSON.stringify(req).includes('call_clone') },
        { toolCalls: [{ id: 'call_clone', name: 'clone_repository', arguments: {} }] },
      );
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => JSON.stringify(req).includes('call_clone') && !JSON.stringify(req).includes('call_checks'),
        },
        { toolCalls: [{ id: 'call_checks', name: 'run_checks', arguments: {} }] },
      );
      llm.on({ endpoint: 'chat', predicate: req => JSON.stringify(req).includes('call_checks') }, { content: ANSWER });
      const { agent } = await createSharedAgent(llm, { engine, memory, tools });
      try {
        const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
        await finishRun(sent.accepted);

        expect(llm.getRequests()).toHaveLength(3);
        expect(texts(duringFirstTool!), 'the first save failed').toEqual([]);
        expect(texts(duringSecondTool!), 'stored again before the next request').toEqual([
          expect.stringContaining(REQUEST),
        ]);
        const after = await storedMessages(memory, threadId);
        expect(after.filter(message => message.id === sent.signal.id)).toHaveLength(1);
        expect(JSON.stringify(after.filter(message => message.role === 'assistant'))).toContain(ANSWER);
      } finally {
        failFirstSave.mockRestore();
      }
    },
  );

  it('does not store a sent message when the run reads memory read-only', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = 'sent-message-read-only';
    const resourceId = 'sent-message-reader';
    await memory.createThread({ threadId, resourceId });
    llm.on({ endpoint: 'chat' }, { content: ANSWER });
    const { agent } = await createSharedAgent(llm, { engine, memory });

    const sent = agent.sendMessage(
      { contents: REQUEST },
      {
        resourceId,
        threadId,
        ifIdle: {
          behavior: 'wake',
          streamOptions: { memory: { resource: resourceId, thread: threadId, options: { readOnly: true } } },
        },
      },
    );
    await finishRun(sent.accepted);

    expect(llm.getRequests()).toHaveLength(1);
    expect(await storedMessages(memory, threadId)).toEqual([]);
  });

  it('stores nothing early when an input processor rejects the message', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = 'sent-message-rejected';
    const resourceId = 'sent-message-user';
    llm.on({ endpoint: 'chat' }, { content: 'This must never be generated.' });
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      inputProcessors: [
        {
          id: 'reject-request',
          processInput: async ({ abort, messages }) => {
            abort('Request rejected by policy.');
            return messages;
          },
        },
      ],
    });

    const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
    const run = await sent.accepted;
    if (run.action === 'wake') await run.output.consumeStream();

    expect(llm.getRequests()).toHaveLength(0);
    expect(texts(await storedMessages(memory, threadId))).toEqual([]);
  });

  const stepRejections = {
    processInputStep: { id: 'reject-step', processInputStep: ({ abort }) => abort('Request rejected by policy.') },
    processLLMRequest: { id: 'reject-step', processLLMRequest: ({ abort }) => abort('Request rejected by policy.') },
  } satisfies Record<string, Processor>;
  for (const [hook, processor] of Object.entries(stepRejections)) {
    itFailsOnDurable(`stores nothing when ${hook} rejects the message`, async () => {
      const llm = getMock();
      const memory = new MockMemory();
      const threadId = `sent-message-rejected-${hook}`;
      const resourceId = 'sent-message-user';
      llm.on({ endpoint: 'chat' }, { content: 'This must never be generated.' });
      const { agent } = await createSharedAgent(llm, { engine, memory, inputProcessors: [processor] });

      const sent = agent.sendMessage({ contents: REQUEST }, { resourceId, threadId });
      const run = await sent.accepted;
      if (run.action === 'wake') await run.output.consumeStream();

      expect(llm.getRequests()).toHaveLength(0);
      expect(texts(await storedMessages(memory, threadId))).toEqual([]);
    });
  }
});
