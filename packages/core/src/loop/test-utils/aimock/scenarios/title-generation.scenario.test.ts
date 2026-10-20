import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: thread title generation (`memory.options.generateTitle`).
 *
 * After the first turn on an untitled thread, the agent asks a model for a short
 * title and saves it on the thread. Title requests reach the same AIMock server
 * as the agent's own calls, so each scenario tells them apart by the title system
 * prompt and checks what the title model was sent from the request journal.
 */
describeForAllEngines('AIMock loop scenario: thread title generation', engine => {
  const getMock = useLoopScenarioAimock();

  const TITLE_INSTRUCTIONS = 'TITLE_INSTRUCTIONS: name this conversation';
  const DEFAULT_INSTRUCTIONS_MARKER = 'you will generate a short title';

  function openaiFor(llm: ReturnType<typeof getMock>) {
    return createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  }

  // Fixture predicates receive the request body; journal entries wrap it in `body`.
  function messagesOf(request: any): any[] {
    return request?.body?.messages ?? request?.messages ?? [];
  }

  function systemText(request: any): string {
    const system = messagesOf(request)?.find((m: any) => m.role === 'system');
    return typeof system?.content === 'string' ? system.content : JSON.stringify(system?.content ?? '');
  }

  function userText(request: any): string {
    const user = messagesOf(request)?.find((m: any) => m.role === 'user');
    return typeof user?.content === 'string' ? user.content : JSON.stringify(user?.content ?? '');
  }

  function isTitleRequest(marker: string) {
    return (request: any) => systemText(request).includes(marker);
  }

  async function waitForTitle(memory: MockMemory, threadId: string) {
    return vi.waitFor(async () => {
      const thread = await memory.getThreadById({ threadId });
      expect(thread?.title).toBeTruthy();
      return thread!.title;
    });
  }

  it('titles a new thread with the configured title model and instructions', async () => {
    const llm = getMock();
    const memory = new MockMemory({
      options: { generateTitle: { model: openaiFor(llm)('title-model'), instructions: TITLE_INSTRUCTIONS } },
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'What is the weather like today?',
      memory,
      threadId: 'title-custom-model',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Weather Today' });
        llm.on({ endpoint: 'chat' }, { content: 'It is sunny.' });
      },
    });

    expect(await output.text).toBe('It is sunny.');
    expect(await waitForTitle(memory, 'title-custom-model')).toBe('Weather Today');

    const thread = await memory.getThreadById({ threadId: 'title-custom-model' });
    expect(thread?.resourceId).toBe('user-1');

    const requests = llm.getRequests();
    const agentRequests = requests.filter(r => !isTitleRequest(TITLE_INSTRUCTIONS)(r));
    const titleRequests = requests.filter(isTitleRequest(TITLE_INSTRUCTIONS));
    expect(agentRequests.map(r => r.body?.model)).toEqual([SCENARIO_MODEL_ID]);
    expect(titleRequests).toHaveLength(1);
    expect(titleRequests[0]!.body?.model).toBe('title-model');
    expect(systemText(titleRequests[0]!)).toBe(TITLE_INSTRUCTIONS);
    expect(userText(titleRequests[0]!)).toContain('User: What is the weather like today?');
  });

  it("generateTitle: true titles the thread with the agent's own model and the default instructions", async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: true } });

    await runLoopScenario({
      engine,
      llm,
      prompt: 'Help me plan a trip to Lisbon',
      memory,
      threadId: 'title-boolean',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: isTitleRequest(DEFAULT_INSTRUCTIONS_MARKER) },
          { content: 'Lisbon Trip' },
        );
        llm.on({ endpoint: 'chat' }, { content: 'Lisbon is lovely in spring.' });
      },
    });

    expect(await waitForTitle(memory, 'title-boolean')).toBe('Lisbon Trip');
    const titleRequests = llm.getRequests().filter(isTitleRequest(DEFAULT_INSTRUCTIONS_MARKER));
    expect(titleRequests).toHaveLength(1);
    expect(titleRequests[0]!.body?.model).toBe(SCENARIO_MODEL_ID);
    expect(userText(titleRequests[0]!)).toContain('User: Help me plan a trip to Lisbon');
  });

  it('titles a thread that was created up front without a title (#13145)', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });
    await memory.createThread({ threadId: 'title-precreated', resourceId: 'user-1' });

    await runLoopScenario({
      engine,
      llm,
      prompt: 'Help me with my coding project',
      memory,
      threadId: 'title-precreated',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Coding Project Help' });
        llm.on({ endpoint: 'chat' }, { content: 'Sure, what are you building?' });
      },
    });

    expect(await waitForTitle(memory, 'title-precreated')).toBe('Coding Project Help');
  });

  it('keeps an existing thread title and never asks for a new one', async () => {
    const llm = getMock();
    // emitEvent holds finish until any title work is done on the in-process loop.
    const memory = new MockMemory({
      options: { generateTitle: { instructions: TITLE_INSTRUCTIONS, emitEvent: true } },
    });
    await memory.createThread({ threadId: 'title-existing', resourceId: 'user-1', title: 'Existing Title' });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Second message',
      memory,
      threadId: 'title-existing',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Replacement Title' });
        llm.on({ endpoint: 'chat' }, { content: 'Reply to the second message.' });
      },
    });

    expect(await output.text).toBe('Reply to the second message.');

    // Barrier for durable engines, where title work outlives the stream: titling an untitled
    // thread afterwards means any stray request from the first run has already arrived.
    await runLoopScenario({
      engine,
      llm,
      prompt: 'Control',
      fixtures: () => {},
      memory,
      threadId: 'title-control',
      resourceId: 'user-1',
    });
    expect(await waitForTitle(memory, 'title-control')).toBe('Replacement Title');

    const titleRequests = llm.getRequests().filter(isTitleRequest(TITLE_INSTRUCTIONS));
    expect(titleRequests).toHaveLength(1);
    expect(userText(titleRequests[0]!)).toContain('Control');
    const thread = await memory.getThreadById({ threadId: 'title-existing' });
    expect(thread?.title).toBe('Existing Title');
  });

  it('does not title the thread when generateTitle is not configured', async () => {
    const llm = getMock();
    const memory = new MockMemory();

    await runLoopScenario({
      engine,
      llm,
      prompt: 'No title wanted',
      memory,
      threadId: 'title-unset',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Fine.' });
      },
    });

    // A second turn is the barrier: a title request from the first turn would land before it.
    await runLoopScenario({
      engine,
      llm,
      prompt: 'Still no title',
      fixtures: () => {},
      memory,
      threadId: 'title-unset',
      resourceId: 'user-1',
    });

    expect(llm.getRequests()).toHaveLength(2);
    // Both requests are agent turns (the second carries the first as history), none a title request.
    expect(llm.getRequests().map(r => messagesOf(r).filter((m: any) => m.role === 'user').length)).toEqual([1, 2]);
    const thread = await memory.getThreadById({ threadId: 'title-unset' });
    expect(thread?.title).toBeFalsy();
  });

  it('a failing title model leaves the reply and the saved turn intact', async () => {
    const llm = getMock();
    const memory = new MockMemory({
      options: { generateTitle: { model: openaiFor(llm)('title-model'), instructions: TITLE_INSTRUCTIONS } },
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Tell me a joke',
      memory,
      threadId: 'title-fails',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) },
          { error: { message: 'TITLE_MODEL_DOWN', type: 'invalid_request_error' }, status: 400 },
        );
        llm.on({ endpoint: 'chat' }, { content: 'Why did the chicken cross the road?' });
      },
    });

    expect(await output.text).toBe('Why did the chicken cross the road?');
    await vi.waitFor(() => expect(llm.getRequests().filter(isTitleRequest(TITLE_INSTRUCTIONS))).toHaveLength(1));

    const { messages } = await memory.recall({ threadId: 'title-fails', resourceId: 'user-1' });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    const thread = await memory.getThreadById({ threadId: 'title-fails' });
    expect(thread?.title).toBeFalsy();
  });

  it('resolves dynamic title model and instructions from the request context', async () => {
    const llm = getMock();
    const openai = openaiFor(llm);
    const memory = new MockMemory({
      options: {
        generateTitle: {
          model: ({ requestContext }) => openai(`title-${requestContext.get('tier')}`),
          instructions: ({ requestContext }) => `${TITLE_INSTRUCTIONS} in ${requestContext.get('language')}`,
        },
      },
    });
    const requestContext = new RequestContext();
    requestContext.set('tier', 'premium');
    requestContext.set('language', 'Spanish');

    await runLoopScenario({
      engine,
      llm,
      prompt: 'Recommend a book',
      memory,
      threadId: 'title-dynamic',
      resourceId: 'user-1',
      requestContext,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) },
          { content: 'Recomendación de libro' },
        );
        llm.on({ endpoint: 'chat' }, { content: 'Try Dune.' });
      },
    });

    expect(await waitForTitle(memory, 'title-dynamic')).toBe('Recomendación de libro');
    const [titleRequest] = llm.getRequests().filter(isTitleRequest(TITLE_INSTRUCTIONS));
    expect(titleRequest!.body?.model).toBe('title-premium');
    expect(systemText(titleRequest!)).toBe(`${TITLE_INSTRUCTIONS} in Spanish`);
  });

  it('builds the title only from the thread being titled, not from recalled messages of other threads', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });
    // Stands in for resource-scoped recall: a message from another thread of the same resource
    // lands in the message list for this run.
    const recallOtherThread: InputProcessor = {
      id: 'fake-resource-scoped-recall',
      processInput: async ({ messageList }) => {
        messageList.add(
          {
            id: 'foreign-thread-message',
            threadId: 'old-thread',
            resourceId: 'user-1',
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Help me write a Python stock scraper' }] },
            createdAt: new Date(Date.now() - 60_000),
          },
          'memory',
        );
        return messageList;
      },
    };

    await runLoopScenario({
      engine,
      llm,
      prompt: 'What is a good recipe for biryani?',
      memory,
      threadId: 'title-resource-scope',
      resourceId: 'user-1',
      inputProcessors: [recallOtherThread],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Biryani Recipe' });
        llm.on({ endpoint: 'chat' }, { content: 'Start with basmati rice.' });
      },
    });

    expect(await waitForTitle(memory, 'title-resource-scope')).toBe('Biryani Recipe');
    const agentRequest = llm.getRequests().find(r => !isTitleRequest(TITLE_INSTRUCTIONS)(r));
    expect(JSON.stringify(agentRequest!.body?.messages)).toContain('stock scraper');
    const [titleRequest] = llm.getRequests().filter(isTitleRequest(TITLE_INSTRUCTIONS));
    expect(userText(titleRequest!)).toContain('biryani');
    expect(userText(titleRequest!)).not.toContain('stock scraper');
  });

  it('does not title the ephemeral thread of a sub-agent that inherits the memory (#18738)', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });
    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'A helper sub-agent.',
      instructions: 'Say hello.',
      model: openaiFor(llm)(SCENARIO_MODEL_ID),
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Please delegate to the helper',
      memory,
      threadId: 'title-supervisor',
      resourceId: 'user-1',
      agents: { helper },
      maxSteps: 3,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Delegation Chat' });
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /Please delegate/ },
          { toolCalls: [{ id: 'call_helper', name: 'agent-helper', arguments: { prompt: 'HELPER_TASK' } }] },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /HELPER_TASK/ },
          { content: 'Hello from helper.' },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_helper', hasToolResult: true }, { content: 'Done delegating.' });
      },
    });

    expect(await output.text).toBe('Done delegating.');
    expect(await waitForTitle(memory, 'title-supervisor')).toBe('Delegation Chat');
    const titleRequests = llm.getRequests().filter(isTitleRequest(TITLE_INSTRUCTIONS));
    expect(titleRequests).toHaveLength(1);
    expect(userText(titleRequests[0]!)).toContain('Please delegate to the helper');
    expect(userText(titleRequests[0]!)).not.toContain('HELPER_TASK');
    // The helper's own run finishes before the supervisor's, so a title request for its thread
    // would already be in the journal. With the override lost it uses the default instructions.
    expect(llm.getRequests().filter(isTitleRequest(DEFAULT_INSTRUCTIONS_MARKER))).toHaveLength(0);
    expect(llm.getRequests()).toHaveLength(4);
  });

  it('keeps existing thread metadata when saving the title', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });
    await memory.createThread({ threadId: 'title-metadata', resourceId: 'user-1', metadata: { keep: 'me' } });

    await runLoopScenario({
      engine,
      llm,
      prompt: 'Plan my week',
      memory,
      threadId: 'title-metadata',
      resourceId: 'user-1',
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Weekly Plan' });
        llm.on({ endpoint: 'chat' }, { content: 'Monday: rest.' });
      },
    });

    expect(await waitForTitle(memory, 'title-metadata')).toBe('Weekly Plan');
    const thread = await memory.getThreadById({ threadId: 'title-metadata' });
    expect(thread?.metadata).toMatchObject({ keep: 'me' });
  });

  it('generateTitle.emitEvent streams the title as a transient chunk before finish', async () => {
    const llm = getMock();
    const memory = new MockMemory({
      options: { generateTitle: { instructions: TITLE_INSTRUCTIONS, emitEvent: true } },
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Explain quantum computing',
      memory,
      threadId: 'title-emit',
      resourceId: 'user-1',
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Quantum Basics' });
        llm.on({ endpoint: 'chat' }, { content: 'Qubits can be 0 and 1.' });
      },
    });

    expect(await waitForTitle(memory, 'title-emit')).toBe('Quantum Basics');
    const types = chunks!.map((c: any) => c.type);
    const titleChunk = chunks!.find((c: any) => c.type === 'data-thread-title') as any;
    expect(titleChunk).toMatchObject({ data: { threadId: 'title-emit', title: 'Quantum Basics' }, transient: true });
    expect(types.indexOf('finish')).toBeGreaterThan(types.indexOf('data-thread-title'));
  });

  it('calls memory.onTitleGenerated with the saved title', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });
    const onTitleGenerated = vi.fn();

    await runLoopScenario({
      engine,
      llm,
      prompt: 'Recommend a book',
      memory,
      threadId: 'title-callback',
      resourceId: 'user-1',
      onTitleGenerated,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'Book Picks' });
        llm.on({ endpoint: 'chat' }, { content: 'Try Dune.' });
      },
    });

    await vi.waitFor(() => expect(onTitleGenerated).toHaveBeenCalledWith('Book Picks'));
    expect(onTitleGenerated).toHaveBeenCalledTimes(1);
    expect((await memory.getThreadById({ threadId: 'title-callback' }))?.title).toBe('Book Picks');
  });

  it('does not stream a title chunk when emitEvent is unset, but still saves the title', async () => {
    const llm = getMock();
    const memory = new MockMemory({ options: { generateTitle: { instructions: TITLE_INSTRUCTIONS } } });

    const { chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Summarize the news',
      memory,
      threadId: 'title-no-emit',
      resourceId: 'user-1',
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isTitleRequest(TITLE_INSTRUCTIONS) }, { content: 'News Summary' });
        llm.on({ endpoint: 'chat' }, { content: 'Nothing new.' });
      },
    });

    expect(chunks!.some((c: any) => c.type === 'finish')).toBe(true);
    expect(await waitForTitle(memory, 'title-no-emit')).toBe('News Summary');
    expect(chunks!.some((c: any) => c.type === 'data-thread-title')).toBe(false);
  });
});
