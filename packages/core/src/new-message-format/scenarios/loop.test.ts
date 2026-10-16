import { createOpenAI } from '@ai-sdk/openai-v7';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { createActionAgent, requestMessages, runScenario, useActionAimock } from '../test-utils/aimock';

describe('action-native loop (aimock)', () => {
  const getMock = useActionAimock();

  it('runs parallel tool calls in one turn and sends every result back', async () => {
    const llm = getMock();
    const started: string[] = [];
    const lookup = createTool({
      id: 'lookup',
      description: 'Look up a user',
      inputSchema: z.object({ user: z.string() }),
      execute: async ({ user }) => {
        started.push(user);
        await new Promise(r => setTimeout(r, 30));
        return { user, ok: true };
      },
    });
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'c1', name: 'lookup', arguments: { user: 'alice' } },
          { id: 'c2', name: 'lookup', arguments: { user: 'bob' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Both found.' });

    const { agent, memory } = createActionAgent(llm, { tools: { lookup } });
    const { types, streamed } = await runScenario(agent, memory, 'Look up alice and bob');

    expect(types).toEqual([
      'run-start',
      'text',
      'turn-start',
      'tool-call',
      'tool-call',
      'tool-started',
      'tool-started',
      'tool-result',
      'tool-result',
      'turn-end',
      'turn-start',
      'text',
      'turn-end',
      'run-end',
    ]);
    expect(started.sort()).toEqual(['alice', 'bob']);
    const results = streamed.filter(a => a.type === 'tool-result').map(a => a.toolCallId);
    expect(results.sort()).toEqual(['c1', 'c2']);
    const toolMessages = requestMessages(llm, 1).filter(m => m.role === 'tool');
    expect(toolMessages.map(m => m.tool_call_id).sort()).toEqual(['c1', 'c2']);
  });

  it('ends cleanly when the model returns an empty turn', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: '' });
    const { agent, memory } = createActionAgent(llm);
    const { types } = await runScenario(agent, memory, 'say nothing');
    expect(types).toEqual(['run-start', 'text', 'turn-start', 'turn-end', 'run-end']);
  });

  it('resolves dynamic instructions per request', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const { agent, memory } = createActionAgent(llm);
    agent.__updateInstructions(({ requestContext }) => `Speak ${requestContext.get('lang') ?? 'English'}.`);
    const ctx = new RequestContext();
    ctx.set('lang', 'French');
    await runScenario(agent, memory, 'hi', { requestContext: ctx });
    expect(requestMessages(llm, 0)[0]).toMatchObject({ role: 'system', content: 'Speak French.' });
  });

  it('resolves a dynamic model per request', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const { agent, memory } = createActionAgent(llm);
    const openai = createOpenAI({ apiKey: 'test', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    agent.__updateModel({ model: ({ requestContext }) => openai.chat(String(requestContext.get('model'))) });
    const ctx = new RequestContext();
    ctx.set('model', 'gpt-4.1-nano');
    await runScenario(agent, memory, 'hi', { requestContext: ctx });
    expect((llm.getRequests()[0]?.body as { model?: string }).model).toBe('gpt-4.1-nano');
  });

  it('passes each run its own request context into tools', async () => {
    const llm = getMock();
    const seen: unknown[] = [];
    const whoami = createTool({
      id: 'whoami',
      description: 'Who am I',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        seen.push(context.requestContext?.get('user'));
        return { ok: true };
      },
    });
    llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [{ id: 'w', name: 'whoami', arguments: {} }] });
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'ok' });
    const { agent, memory } = createActionAgent(llm, { tools: { whoami } });

    const run = (user: string) => {
      const ctx = new RequestContext();
      ctx.set('user', user);
      return runScenario(agent, memory, 'who', { requestContext: ctx });
    };
    await Promise.all([run('ann'), run('ben')]);
    expect(seen.sort()).toEqual(['ann', 'ben']);
  });

  it('aborts while a tool is running and records run-aborted', async () => {
    const llm = getMock();
    const controller = new AbortController();
    let toolSignal: AbortSignal | undefined;
    const slow = createTool({
      id: 'slow',
      description: 'Slow',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolSignal = context.abortSignal;
        controller.abort();
        await new Promise(r => setTimeout(r, 50));
        return { done: true };
      },
    });
    llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [{ id: 's', name: 'slow', arguments: {} }] });
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'should not happen' });
    const { agent, memory } = createActionAgent(llm, { tools: { slow } });

    const { streamed, stored } = await runScenario(agent, memory, 'go', { abortSignal: controller.signal });
    expect(streamed.at(-1)?.type).toBe('run-aborted');
    expect(toolSignal?.aborted).toBe(true);
    expect(llm.getRequests()).toHaveLength(1);
    expect(stored.at(-1)?.type).toBe('run-aborted');
  });

  it('stops after maxSteps even if the model keeps calling tools', async () => {
    const llm = getMock();
    const ping = createTool({
      id: 'ping',
      description: 'Ping',
      inputSchema: z.object({}),
      execute: async () => ({ pong: true }),
    });
    llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'p', name: 'ping', arguments: {} }] });

    const { agent, memory } = createActionAgent(llm, { tools: { ping } });
    const { types, streamed } = await runScenario(agent, memory, 'ping forever', { maxSteps: 3 });

    expect(types.filter(t => t === 'turn-start')).toHaveLength(3);
    expect(llm.getRequests()).toHaveLength(3);
    const end = streamed.at(-1);
    expect(end?.type).toBe('run-end');
    expect(end?.type === 'run-end' && end.finishReason).toBe('tool-calls');
  });
});
