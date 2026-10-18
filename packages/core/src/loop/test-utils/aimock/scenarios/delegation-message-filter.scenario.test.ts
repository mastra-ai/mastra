import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { MessageFilterContext } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: supervisor delegation hooks — messageFilter.
 *
 * When a supervisor delegates to a subagent, the `messageFilter` callback
 * controls which parent messages are passed to the subagent as conversation
 * context. This runs AFTER onDelegationStart (so the prompt reflects any
 * modifications). This scenario proves:
 *
 * 1. The messageFilter receives the delegation context (primitiveId, prompt, parentAgentId).
 * 2. The messageFilter sees the prompt AFTER onDelegationStart modifications.
 * 3. The filtered messages are what the subagent actually receives.
 */
describeForAllEngines('AIMock loop scenario: delegation messageFilter', engine => {
  const getMock = useLoopScenarioAimock();

  it('messageFilter receives delegation context and can filter messages', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts written content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask the writer to draft something.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      delegation: {
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          // Filter out system messages (if any) to test the filtering works.
          return context.messages.filter((msg: any) => msg.role !== 'system');
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to writer.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } }],
          },
        );
        // Subagent turn: receives the filtered context.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          { content: 'Here is what you requested.' },
        );
        // Supervisor turn 2: wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Writer completed the task.' });
      },
    });

    // The messageFilter was called during delegation.
    expect(filterSpy).toHaveBeenCalled();
    const filterContext = filterSpy.mock.calls[0]![0];
    expect(filterContext.primitiveId).toBe('writer');
    expect(filterContext.primitiveType).toBe('agent');
    expect(filterContext.parentAgentId).toBeDefined();
    expect(filterContext.prompt).toBe('Write something.');

    // The final output reflects the writer's response.
    const text = await output.text;
    expect(text).toContain('Writer completed');
  });

  it('messageFilter receives the prompt after onDelegationStart modifications', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask the writer to draft something.',
      agents: { writer },
      stopWhen: stepCountIs(5),
      delegation: {
        onDelegationStart: () => ({
          proceed: true,
          modifiedPrompt: 'MODIFIED: Write a formal letter.',
        }),
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          return context.messages;
        },
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to writer.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } }],
          },
        );
        // Subagent turn: receives the modified prompt.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          { content: 'Here is the formal letter you requested.' },
        );
        // Supervisor turn 2: wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Letter drafted successfully.' });
      },
    });

    // The messageFilter received the modified prompt, not the original.
    expect(filterSpy).toHaveBeenCalled();
    const filterContext = filterSpy.mock.calls[0]![0];
    expect(filterContext.prompt).toBe('MODIFIED: Write a formal letter.');
    expect(filterContext.prompt).not.toBe('Write something.');

    // Verify the subagent actually received the modified prompt by checking its request.
    const subagentRequest = requests.find((r: any) =>
      JSON.stringify(r.body?.messages).includes('MODIFIED: Write a formal letter'),
    );
    expect(subagentRequest).toBeDefined();
  });

  it('forwards transient request-processor messages to the subagent', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Original user message',
      agents: { writer },
      stopWhen: stepCountIs(5),
      inputProcessors: [
        {
          id: 'transient-context',
          processLLMRequest: ({ prompt }: { prompt: any[] }) => ({
            prompt: [...prompt, { role: 'user', content: [{ type: 'text', text: 'Transient parent context' }] }],
          }),
        },
      ],
      delegation: {
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          return context.messages;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', systemMessage: 'You are a writer.' }, { content: 'Here it is.' });
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Writer completed the task.' });
      },
    });

    expect(await output.text).toContain('Writer completed');

    // The filter sees the processor-injected parent context alongside the real user message.
    expect(filterSpy).toHaveBeenCalledTimes(1);
    const filtered = JSON.stringify(filterSpy.mock.calls[0]![0].messages);
    expect(filtered).toContain('Transient parent context');
    expect(filtered).toContain('Original user message');

    // ...and the subagent's model request carries both.
    const subagentRequest = requests.find(r => JSON.stringify(r.body?.messages).includes('You are a writer.'));
    expect(subagentRequest).toBeDefined();
    const subagentMessages = JSON.stringify(subagentRequest?.body?.messages);
    expect(subagentMessages).toContain('Transient parent context');
    expect(subagentMessages).toContain('Original user message');
    expect(subagentMessages).toContain('Write something.');
  });

  it('excludes observational-memory continuation hints from the delegated context', async () => {
    const mock = getMock();
    const filterSpy = vi.fn();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts content',
      instructions: 'You are a writer.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Real user request',
      agents: { writer },
      stopWhen: stepCountIs(5),
      inputProcessors: [
        {
          id: 'observational-memory',
          processInput: ({ messages, systemMessages }: { messages: any[]; systemMessages: any[] }) => ({
            messages: [
              ...messages,
              {
                id: 'om-continuation',
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: 'Synthetic continuation hint' }] },
                createdAt: new Date(),
              },
            ],
            systemMessages: [...systemMessages, { role: 'system', content: 'Observed parent history' }],
          }),
        },
      ],
      delegation: {
        messageFilter: (context: MessageFilterContext) => {
          filterSpy(context);
          return context.messages;
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', systemMessage: 'You are a writer.' }, { content: 'Here it is.' });
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 'Write something.' } }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Writer completed the task.' });
      },
    });

    expect(await output.text).toContain('Writer completed');

    // The supervisor itself still sees the continuation hint...
    expect(JSON.stringify(requests[0]?.body?.messages)).toContain('Synthetic continuation hint');

    // ...but the delegated context keeps observations and the real request while dropping the hint.
    expect(filterSpy).toHaveBeenCalledTimes(1);
    const filtered = JSON.stringify(filterSpy.mock.calls[0]![0].messages);
    expect(filtered).toContain('Observed parent history');
    expect(filtered).toContain('Real user request');
    expect(filtered).not.toContain('Synthetic continuation hint');

    const subagentRequest = requests.find(r => JSON.stringify(r.body?.messages).includes('You are a writer.'));
    expect(subagentRequest).toBeDefined();
    const subagentMessages = JSON.stringify(subagentRequest?.body?.messages);
    expect(subagentMessages).toContain('Observed parent history');
    expect(subagentMessages).toContain('Real user request');
    expect(subagentMessages).not.toContain('Synthetic continuation hint');
  });
});
