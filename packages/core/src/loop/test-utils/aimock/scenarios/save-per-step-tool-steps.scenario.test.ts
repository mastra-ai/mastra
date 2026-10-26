import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { assertNoDuplicateParts } from '../../../../agent/test-utils';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * savePerStep across tool steps (moved from save-and-errors.e2e, whose three
 * cases were it.skip against a hash-matched recording and never ran).
 *
 * - Each completed step is saved as it finishes, so a multi-step run calls
 *   saveMessages more than once and the stored assistant message has exactly
 *   one tool-invocation result per tool call, with no duplicated parts.
 * - When onStepFinish throws after a tool step, the user message and the
 *   completed tool step are already in memory.
 */

const echoTool = createTool({
  id: 'echoTool',
  description: 'Echoes the input string.',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async ({ input }) => ({ output: input }),
});

const uppercaseTool = createTool({
  id: 'uppercaseTool',
  description: 'Converts input to uppercase.',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async ({ input }) => ({ output: input.toUpperCase() }),
});

function countingMemory() {
  const memory = new MockMemory();
  const counter = { saves: 0 };
  const saveMessages = memory.saveMessages.bind(memory);
  memory.saveMessages = async args => {
    counter.saves++;
    return saveMessages(args);
  };
  return { memory, counter };
}

function toolResultIds(message: MastraDBMessage) {
  return message.content.parts
    .filter(part => part.type === 'tool-invocation' && part.toolInvocation.state === 'result')
    .map(part => (part as Extract<typeof part, { type: 'tool-invocation' }>).toolInvocation.toolCallId);
}

function assistantMessages(messages: MastraDBMessage[]) {
  return messages.filter(message => message.role === 'assistant');
}

describeForAllEngines('AIMock loop scenario: savePerStep across tool steps', engine => {
  const getMock = useLoopScenarioAimock();

  it('saves each tool step once, with one result per tool call', async () => {
    const { memory, counter } = countingMemory();
    const threadId = `save-per-step-echo-${engine}`;
    const resourceId = 'resource-echo';

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Echo: Please echo this long message and explain why.',
      tools: { echoTool },
      memory,
      threadId,
      resourceId,
      savePerStep: true,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'long message' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'The echo tool returned "long message".' });
      },
    });

    expect(await output.text).toBe('The echo tool returned "long message".');
    expect(counter.saves).toBeGreaterThan(1);

    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.find(message => message.role === 'user')).toBeDefined();
    const assistants = assistantMessages(messages);
    expect(assistants.length).toBeGreaterThan(0);
    for (const assistant of assistants) assertNoDuplicateParts(assistant.content.parts);
    expect(assistants.flatMap(toolResultIds)).toEqual(['call_echo']);
  });

  it('saves sequential calls to two tools before the next step runs, without duplicating results', async () => {
    const { memory, counter } = countingMemory();
    const threadId = `save-per-step-multi-${engine}`;
    const resourceId = 'resource-multi';
    let savedBeforeSecondTool: string[] | undefined;
    const observingUppercaseTool = createTool({
      ...uppercaseTool,
      execute: async (input, context) => {
        const { messages } = await memory.recall({ threadId, resourceId });
        savedBeforeSecondTool = assistantMessages(messages).flatMap(toolResultIds);
        return uppercaseTool.execute!(input, context);
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Echo: echo this. Uppercase: uppercase this. Explain both results.',
      tools: { echoTool, uppercaseTool: observingUppercaseTool },
      memory,
      threadId,
      resourceId,
      savePerStep: true,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_echo', name: 'echoTool', arguments: { input: 'echo this' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_upper', name: 'uppercaseTool', arguments: { input: 'uppercase this' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Echoed "echo this" and got "UPPERCASE THIS".' });
      },
    });

    expect(await output.text).toBe('Echoed "echo this" and got "UPPERCASE THIS".');
    expect(counter.saves).toBeGreaterThan(1);
    expect(savedBeforeSecondTool).toEqual(['call_echo']);

    const { messages } = await memory.recall({ threadId, resourceId });
    const assistants = assistantMessages(messages);
    for (const assistant of assistants) assertNoDuplicateParts(assistant.content.parts);
    expect(assistants.flatMap(toolResultIds).sort()).toEqual(['call_echo', 'call_upper']);
  });

  it('keeps the completed tool step in memory when onStepFinish throws on the next step', async () => {
    const { memory } = countingMemory();
    const threadId = `save-per-step-rescue-${engine}`;
    const resourceId = 'resource-rescue';
    let steps = 0;

    const { streamError } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Please echo this, then echo it again.',
      tools: { echoTool },
      memory,
      threadId,
      resourceId,
      savePerStep: true,
      stopWhen: stepCountIs(5),
      expectStreamError: true,
      onStepFinish: () => {
        steps++;
        if (steps === 2) throw new Error('Simulated error in onStepFinish');
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_first', name: 'echoTool', arguments: { input: 'first' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_second', name: 'echoTool', arguments: { input: 'second' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Done.' });
      },
    });

    expect(String((streamError as Error | undefined)?.message ?? streamError)).toMatch(
      /Simulated error in onStepFinish/,
    );

    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.find(message => message.role === 'user')).toBeDefined();
    expect(assistantMessages(messages).flatMap(toolResultIds)).toContain('call_first');
    expect(assistantMessages(messages).flatMap(toolResultIds)).toContain('call_second');
  });
});
