/**
 * AIMock Scenario: tool transform persistence
 *
 * A tool transform that only defines `transcript.output` must leave stored
 * tool-call args raw and store the redacted output, whichever save path
 * (per-step save queue or the final save) writes the assistant message.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: tool transform persistence', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([true, false])('keeps raw args and stores redacted output when savePerStep is %s', async savePerStep => {
    const memory = new MockMemory({ storage: new InMemoryStore(), options: { lastMessages: 100 } });
    const threadId = `transform-thread-${savePerStep}`;
    const resourceId = 'transform-resource';
    await memory.createThread({ threadId, resourceId });

    const lookup = createTool({
      id: 'lookup',
      description: 'Looks something up',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => ({ query, payload: 'x'.repeat(50) }),
      transform: {
        transcript: { output: ({ output }: { output: unknown }) => ({ query: (output as { query: string }).query }) },
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'look things up',
      tools: { lookup },
      stopWhen: stepCountIs(5),
      memory,
      threadId,
      resourceId,
      savePerStep,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { query: 'first' } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-1' }, {
          toolCalls: [{ id: 'call-2', name: 'lookup', arguments: { query: 'second' } }],
        } as any);
        llm.on({ endpoint: 'chat', toolCallId: 'call-2' }, { content: 'done' } as any);
      },
    });
    expect(await output.text).toBe('done');

    const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
    const invocations = messages.flatMap(message =>
      (message.content.parts ?? []).flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation] : [])),
    );
    expect(invocations.map(i => [i.args, (i as { result?: unknown }).result])).toEqual([
      [{ query: 'first' }, { query: 'first' }],
      [{ query: 'second' }, { query: 'second' }],
    ]);
  });

  const redactedTool = createTool({
    id: 'redactedTool',
    description: 'tool whose payloads are redacted',
    inputSchema: z.object({ secret: z.string() }),
    requireApproval: false,
    execute: async () => ({ ok: true, secret: 'still-secret' }),
  });

  it('stamps display and transcript transforms on tool-call and tool-result chunks', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'run it',
      tools: { redactedTool },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      transform: {
        targets: ['display', 'transcript'],
        transformToolPayload: (ctx: any) => `[redacted ${ctx.phase} on ${ctx.target}]`,
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-r', name: 'redactedTool', arguments: { secret: 'hunter2' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
      },
    });

    const meta = (type: string) =>
      (chunks ?? []).find((c: any) => c.type === type)?.metadata?.mastra?.toolPayloadTransform;
    expect(meta('tool-call')?.display?.['input-available']?.transformed).toBe('[redacted input-available on display]');
    expect(meta('tool-call')?.transcript?.['input-available']?.transformed).toBe(
      '[redacted input-available on transcript]',
    );
    expect(meta('tool-result')?.display?.['output-available']?.transformed).toBe(
      '[redacted output-available on display]',
    );
    expect(meta('tool-result')?.transcript?.['output-available']?.transformed).toBe(
      '[redacted output-available on transcript]',
    );
  });

  it('emits each streamed tool call once, after its input ends and before its result', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'run both',
      tools: { redactedTool },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      transform: {
        targets: ['display'],
        transformToolPayload: (ctx: any) => `[redacted ${ctx.phase}]`,
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call-a', name: 'redactedTool', arguments: { secret: 'a' } },
              { id: 'call-b', name: 'redactedTool', arguments: { secret: 'b' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
      },
    });

    const all = (chunks ?? []) as any[];
    const indexOf = (type: string, id: string) => all.findIndex(c => c.type === type && c.payload?.toolCallId === id);

    for (const [id, secret] of [
      ['call-a', 'a'],
      ['call-b', 'b'],
    ] as const) {
      const calls = all.filter(c => c.type === 'tool-call' && c.payload.toolCallId === id);
      expect(calls).toHaveLength(1);
      expect(calls[0].payload.args).toEqual({ secret });
      expect(calls[0].metadata?.mastra?.toolPayloadTransform?.display?.['input-available']?.transformed).toBe(
        '[redacted input-available]',
      );
      expect(indexOf('tool-call-input-streaming-end', id)).toBeGreaterThanOrEqual(0);
      expect(indexOf('tool-call-input-streaming-end', id)).toBeLessThan(indexOf('tool-call', id));
      expect(indexOf('tool-call', id)).toBeLessThan(indexOf('tool-result', id));
    }
  });
});
