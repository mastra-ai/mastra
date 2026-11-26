import { convertArrayToReadableStream, MockLanguageModelV3 } from '@internal/ai-v6/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// Regression for https://github.com/mastra-ai/mastra/issues/24917

afterEach(() => vi.restoreAllMocks());

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function scriptedModel(steps: any[][]) {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      const parts = steps[Math.min(call++, steps.length - 1)]!;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

const textPart = (id: string, text: string) => [
  { type: 'text-start', id },
  { type: 'text-delta', id, delta: text },
  { type: 'text-end', id },
];
const askCall = (id: string) => ({ type: 'tool-call', toolCallId: id, toolName: 'ask', input: '{"question":"ok?"}' });
const finish = (unified: string) => ({ type: 'finish', finishReason: { unified, raw: unified }, usage });

const askTool = createTool({
  id: 'ask',
  description: 'Ask the user',
  inputSchema: z.object({ question: z.string() }),
  execute: async () => ({ answered: true }),
});

const passThrough: Processor = {
  id: 'pass-through',
  processOutputStream: async ({ part }) => part,
};

const stopOnAsk = ({ steps }: { steps: any[] }) =>
  steps.at(-1)?.toolCalls?.some((c: any) => (c.toolName ?? c.payload?.toolName) === 'ask') ?? false;

function makeAgent(model: MockLanguageModelV3, withProcessor: boolean) {
  return new Agent({
    id: 'a',
    name: 'a',
    instructions: 'test',
    model,
    tools: { ask: askTool },
    ...(withProcessor ? { outputProcessors: [passThrough] } : {}),
  });
}

async function run(agent: Agent) {
  const stream = await agent.stream('hi', { stopWhen: stopOnAsk as any });
  await stream.consumeStream();
  return { text: await stream.text, steps: await stream.steps };
}

describe('output processor + stopWhen on a text+tool-call step (#24917)', () => {
  for (const withProcessor of [false, true]) {
    it(`keeps text on both sides of the tool call in the final step (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([
        [...textPart('t1', 'Before. '), askCall('c1'), ...textPart('t2', 'After.'), finish('tool-calls')],
      ]);
      const { text, steps } = await run(makeAgent(model, withProcessor));

      expect(steps).toHaveLength(1);
      expect(steps.at(-1)!.text).toBe('Before. After.');
      expect(text).toBe('Before. After.');
    });

    it(`keeps all text when the final step interleaves text and tool calls (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([
        [...textPart('t1', 'A '), askCall('c1'), ...textPart('t2', 'B'), askCall('c2'), finish('tool-calls')],
      ]);
      const { text, steps } = await run(makeAgent(model, withProcessor));

      expect(steps).toHaveLength(1);
      expect(steps.at(-1)!.text).toBe('A B');
      expect(text).toBe('A B');
    });
  }

  it('uses processed step text when an output processor collapses text parts', async () => {
    const model = scriptedModel([[...textPart('t1', 'secret '), ...textPart('t2', 'stuff'), finish('stop')]]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'collapse-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message =>
              message.role === 'assistant'
                ? {
                    ...message,
                    content: {
                      ...message.content,
                      content: 'REDACTED',
                      parts: [{ type: 'text', text: 'REDACTED' }],
                    },
                  }
                : message,
            ),
        },
      ],
    });

    const stream = await agent.stream('hi');
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('REDACTED');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['REDACTED']);
    expect(fullOutput.text).toBe('REDACTED');
  });

  it('preserves destructive processing when collapsing a feedback continuation', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'SECRET'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'collapse-and-redact-continuation-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message => {
              if (message.role !== 'assistant' || message.content?.metadata?.completionResult) return message;

              const text = message.content.parts
                ?.map(part => (part.type === 'text' ? part.text.replace('SECRET', '[redacted]') : ''))
                .join('');
              return {
                ...message,
                content: {
                  ...message.content,
                  content: text,
                  parts: [{ type: 'text', text }],
                },
              };
            }),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('first[redacted]');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', '[redacted]']);
    expect(fullOutput.text).toBe('first[redacted]');
  });

  it('keeps the final step local when collapsing an earlier rewritten iteration', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'token:abc123 '), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'collapse-and-redact-earlier-iteration',
          processOutputResult: async ({ messages }) =>
            messages.map(message => {
              if (message.role !== 'assistant' || message.content?.metadata?.completionResult) return message;

              const text = message.content.parts
                ?.map(part => (part.type === 'text' ? part.text.replace('token:abc123', '[r]') : ''))
                .join('');
              return {
                ...message,
                content: {
                  ...message.content,
                  content: text,
                  parts: [{ type: 'text', text }],
                },
              };
            }),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('[r] MORE');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['[r] ', 'MORE']);
    expect(fullOutput.text).toBe('[r] MORE');
  });

  it('uses processor output when collapsing rewrites in both iterations', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'SECRET '), finish('stop')],
      [...textPart('t2', 'SECRET'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'collapse-and-redact-both-iterations',
          processOutputResult: async ({ messages }) =>
            messages.map(message => {
              if (message.role !== 'assistant' || message.content?.metadata?.completionResult) return message;

              const text = message.content.parts
                ?.map(part => (part.type === 'text' ? part.text.replace('SECRET', '[redacted]') : ''))
                .join('');
              return {
                ...message,
                content: {
                  ...message.content,
                  content: text,
                  parts: [{ type: 'text', text }],
                },
              };
            }),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('[redacted] [redacted]');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['[redacted] ', '[redacted]']);
    expect(fullOutput.text).toBe('[redacted] [redacted]');
  });

  it('keeps feedback continuation steps iteration-local with an output processor', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [passThrough],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say MORE.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('firstMORE');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'MORE']);
    expect(fullOutput.text).toBe('firstMORE');
  });

  it('keeps processed feedback continuation text iteration-local', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'more'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'uppercase-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message => ({
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.map(part =>
                  part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
                ),
              },
            })),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('FIRSTMORE');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['FIRST', 'MORE']);
    expect(fullOutput.text).toBe('FIRSTMORE');
  });

  it('keeps rewritten text attributed across three feedback continuation steps when the clock does not advance', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'second'), finish('stop')],
      [...textPart('t3', 'third'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'uppercase-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message => ({
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.flatMap(part => {
                  if (part.type !== 'text') return part;
                  const rewrittenText = `${part.text.toUpperCase()}!`;
                  const splitAt = Math.ceil(rewrittenText.length / 2);
                  return [
                    { ...part, text: rewrittenText.slice(0, splitAt) },
                    { ...part, text: rewrittenText.slice(splitAt) },
                  ];
                }),
              },
            })),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 3,
      onIterationComplete: async () => (++iteration < 3 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('FIRST!SECOND!THIRD!');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['FIRST!', 'SECOND!', 'THIRD!']);
    expect(fullOutput.text).toBe('FIRST!SECOND!THIRD!');
  });

  it('tracks step provenance when the total processed part count stays unchanged', async () => {
    const model = scriptedModel([
      [...textPart('t1a', 'fir'), ...textPart('t1b', 'st'), finish('stop')],
      [...textPart('t2', 'second'), finish('stop')],
      [...textPart('t3', 'third'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'reshape-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message => ({
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.flatMap(part => {
                  if (part.type !== 'text') return part;
                  if (part.text === 'fir') return { ...part, text: 'FIRST!' };
                  if (part.text === 'st') return [];
                  if (part.text === 'second') {
                    return [
                      { ...part, text: 'SECO' },
                      { ...part, text: 'ND!' },
                    ];
                  }
                  if (part.text === 'third') return { ...part, text: 'THIRD!' };
                  return part;
                }),
              },
            })),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 3,
      onIterationComplete: async () => (++iteration < 3 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('FIRST!SECOND!THIRD!');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['FIRST!', 'SECOND!', 'THIRD!']);
    expect(fullOutput.text).toBe('FIRST!SECOND!THIRD!');
  });

  it('keeps step attribution when text-preserving processing merges earlier step parts', async () => {
    const model = scriptedModel([
      [...textPart('t1a', 'fir'), ...textPart('t1b', 'st'), finish('stop')],
      [...textPart('t2', 'second'), finish('stop')],
      [...textPart('t3', 'third'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'merge-text-parts',
          processOutputResult: async ({ messages }) =>
            messages.map(message => {
              const textParts = message.content.parts?.filter(part => part.type === 'text');
              const firstTextPart = textParts?.[0];
              if (!firstTextPart) return message;

              return {
                ...message,
                content: {
                  ...message.content,
                  parts: [{ ...firstTextPart, text: textParts.map(part => part.text).join('') }],
                },
              };
            }),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 3,
      onIterationComplete: async () => (++iteration < 3 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('firstsecondthird');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'second', 'third']);
    expect(fullOutput.text).toBe('firstsecondthird');
  });

  it('removes final step text when its response is removed', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'remove-final-response',
          processOutputResult: async ({ messages }) => {
            const finalResponse = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!finalResponse) return messages;

            return [
              ...messages.filter(message => message.id !== finalResponse.id),
              {
                ...finalResponse,
                id: 'earlier-response',
                content: {
                  ...finalResponse.content,
                  content: 'first',
                  parts: [{ type: 'text', text: 'first' }],
                },
              },
            ];
          },
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say MORE.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('first');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', '']);
    expect(fullOutput.text).toBe('first');
  });

  it('provides a coalesced transcript view to custom persisting processors', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const persistedTranscripts: Array<{
      splitResponseCount: number;
      responseCount: number;
      responseTexts: string[];
    }> = [];
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'custom-persister',
          processOutputResult: async ({ messages, messageList }) => {
            const persistedResponses = messageList.cloneForPersistence().get.response.db();
            persistedTranscripts.push({
              splitResponseCount: messageList.get.response.db().length,
              responseCount: persistedResponses.length,
              responseTexts: persistedResponses.map(message =>
                (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join(''),
              ),
            });
            return messages;
          },
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Continue.' } : undefined),
    });
    await stream.getFullOutput();

    expect(persistedTranscripts).toHaveLength(1);
    expect(persistedTranscripts[0]).toMatchObject({ splitResponseCount: 3, responseCount: 2 });
    expect(persistedTranscripts[0]!.responseTexts).toContain('firstMORE');
  });

  it('uses the processed text when a processor redacts interleaved text', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'A '), askCall('c1'), ...textPart('t2', 'B'), askCall('c2'), finish('tool-calls')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      tools: { ask: askTool },
      outputProcessors: [
        {
          id: 'redact',
          processOutputStream: async ({ part }) =>
            part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: 'X' } } : part,
        },
      ],
    });
    const { text, steps } = await run(agent);

    expect(steps.at(-1)!.text).toBe('XX');
    expect(text).toBe('XX');
  });

  it('keeps the resolved text consistent when a processor removes the response', async () => {
    const model = scriptedModel([[...textPart('t1', 'Hello there.'), finish('stop')]]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'remove-response',
          processOutputResult: async ({ messages }) => messages.filter(message => message.role !== 'assistant'),
        },
      ],
    });

    const stream = await agent.stream('hi', { maxSteps: 1 });
    const fullOutput = await stream.getFullOutput();

    expect(fullOutput.steps.map(step => step.text)).toEqual(['']);
    expect(fullOutput.text).toBe('');
    expect(await stream.text).toBe('');
  });

  it('reconciles the final step when a processor replaces the response under a new id', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'abcdef'), finish('stop')],
      [...textPart('t2', 'ghij'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'replace-response-id',
          processOutputResult: async ({ messages }) => {
            const response = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!response) return messages;
            const parts = response.content?.parts ?? [];
            const rewritten = parts.map(part =>
              part.type === 'text' ? { ...part, text: part.text.replace('abcdef', 'ab') } : part,
            );
            return messages.map(message =>
              message.id === response.id
                ? {
                    ...message,
                    id: 'replaced-response',
                    content: {
                      ...message.content,
                      content: rewritten.map(part => (part.type === 'text' ? part.text : '')).join(''),
                      parts: rewritten,
                    },
                  }
                : message,
            );
          },
        },
      ],
    });

    let iteration = 0;
    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    // The processor is still matched to the step it rewrote, so the final step carries only the
    // current iteration's text instead of the whole accumulated response.
    expect(fullOutput.steps.map(step => step.text)).toEqual(['abcdef', 'ghij']);
    expect(fullOutput.text).toBe('abcdefghij');
  });

  it('reconciles the final step when a processor keeps the response and appends a revised one', async () => {
    const model = scriptedModel([[...textPart('t1', 'abcdef'), finish('stop')]]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'append-revised-response',
          processOutputResult: async ({ messages }) => {
            const response = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!response) return messages;
            // Current-iteration-only, so the revision carries no earlier-iteration boundary.
            const parts = [{ type: 'text' as const, text: 'REVISED' }];
            return [
              ...messages,
              {
                ...response,
                id: `${response.id}-revised`,
                content: {
                  ...response.content,
                  content: 'REVISED',
                  parts,
                },
              },
            ];
          },
        },
      ],
    });

    const stream = await agent.stream('hi', { maxSteps: 1 });
    const fullOutput = await stream.getFullOutput();

    // Keeping the original response means the id it had before processing still resolves, so an id
    // lookup alone reports the stale message. The reconciled step text must come from the response
    // the resolved output text is read from, otherwise the step disagrees with the streamed text.
    expect(fullOutput.steps.map(step => step.text)).toEqual(['REVISED']);
    expect(fullOutput.text).toBe('REVISED');
    expect(await stream.text).toBe('REVISED');
  });

  it('keeps a continuation step scoped to its iteration when a processor appends a revised response', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'abcdef'), finish('stop')],
      [...textPart('t2', 'ghij'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'append-revised-response',
          processOutputResult: async ({ messages }) => {
            const response = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!response) return messages;
            // Current-iteration-only, so the revision carries no earlier-iteration boundary.
            const parts = [{ type: 'text' as const, text: 'REVISED' }];
            return [
              ...messages,
              {
                ...response,
                id: `${response.id}-revised`,
                content: {
                  ...response.content,
                  content: 'REVISED',
                  parts,
                },
              },
            ];
          },
        },
      ],
    });

    let iteration = 0;
    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    // The earlier iteration keeps its model text; the final step still carries only the appended
    // revision, so full output accumulates the per-iteration step text instead of the whole response.
    expect(fullOutput.steps.map(step => step.text)).toEqual(['abcdef', 'REVISED']);
    expect(fullOutput.text).toBe('abcdefREVISED');
  });

  it('keeps every part of an appended response when the original offset is nonzero', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'abcdef'), finish('stop')],
      [...textPart('t2', 'ghij'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'append-two-part-revision',
          processOutputResult: async ({ messages }) => {
            const response = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!response) return messages;
            // Two text parts, all belonging to the current iteration.
            const parts = [
              { type: 'text' as const, text: 'REV' },
              { type: 'text' as const, text: 'ISED' },
            ];
            return [
              ...messages,
              {
                ...response,
                id: `${response.id}-revised`,
                content: {
                  ...response.content,
                  content: 'REVISED',
                  parts,
                },
              },
            ];
          },
        },
      ],
    });

    let iteration = 0;
    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    // The original response has two parts (offset derived against the pre-processing message), but the
    // appended response is current-iteration-only, so its offset is zero. Applying the original offset
    // would drop its first part, making the step and full output disagree with the streamed text.
    expect(fullOutput.steps.map(step => step.text)).toEqual(['abcdef', 'REVISED']);
    expect(fullOutput.text).toBe('abcdefREVISED');
    expect(await stream.text).toBe('REVISED');
  });

  it('keeps the current iteration when a processor splits its text into more parts', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'more'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'split-final-text',
          processOutputResult: async ({ messages }) => {
            const response = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!response) return messages;
            const parts = [...(response.content?.parts ?? [])].filter(part => part.type !== 'step-start');
            const lastTextIndex = parts.findLastIndex(part => part.type === 'text');
            if (lastTextIndex === -1) return messages;
            // Split the current iteration's text into more parts, keeping earlier iterations and the
            // message id. The rewrite changes the resolved text and rebuilding the parts drops the
            // boundary marker, matching a processor that rebuilds the response.
            const text = parts[lastTextIndex]!.type === 'text' ? parts[lastTextIndex]!.text : '';
            const midpoint = Math.ceil(text.length / 2);
            const nextParts = [
              ...parts.slice(0, lastTextIndex),
              { type: 'text' as const, text: text.slice(0, midpoint).toUpperCase() },
              { type: 'text' as const, text: text.slice(midpoint).toUpperCase() },
              ...parts.slice(lastTextIndex + 1),
            ];
            const nextContent = nextParts.map(part => (part.type === 'text' ? part.text : '')).join('');
            return messages.map(message =>
              message.id === response.id
                ? { ...message, content: { ...message.content, content: nextContent, parts: nextParts } }
                : message,
            );
          },
        },
      ],
    });

    let iteration = 0;
    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    // The response keeps its id but now has more parts than before processing. The earlier iteration's
    // text must stay out of the final step, so full output does not duplicate the `first` prefix.
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'MORE']);
    expect(fullOutput.text).toBe('firstMORE');
    expect(await stream.text).toBe('firstMORE');
  });
});
