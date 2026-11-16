/**
 * Ported from validation harness case T1 (tool-roundtrip), source 23f640a.
 * A dependent read must receive the write's receipt, including when an output
 * has a `value` key alongside other fields (the F1 output-unwrapping boundary).
 * Recovery (COR-1449) and evented redelivery (COR-1442) are deliberately excluded.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import type { CapturedRequest, ParityEngine } from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

const THREAD = 'thread-t1';
const RESOURCE = 'resource-t1';
const RECEIPT = 't1-record-receipt';

function outputs(request: CapturedRequest) {
  return request.prompt.flatMap(message =>
    message.role === 'tool'
      ? message.content.map(part => (part.output.type === 'json' ? part.output.value : undefined))
      : [],
  );
}

describeParity('tool-roundtrip parity', target => {
  it.each(['amount', 'value'] as const)(
    '%s: dependent read preserves the receipt, record and transcript',
    async field => {
      const observed = new Map<
        ParityEngine,
        {
          memory: MockMemory;
          writes: unknown[];
          readInputs: unknown[];
          reads: unknown[];
          finishes: number;
          errors: number;
        }
      >();
      const expected = { name: 'comparison', [field]: 42, verified: true };
      const written = { name: 'comparison', [field]: 42, receipt: RECEIPT };
      const results = await expectParity(target, {
        model: {
          respond: request => {
            const rs = outputs(request);
            if (rs.length === 0) return toolCallTape('writeRecord', { name: 'comparison', [field]: 42 }, 't1-write');
            if (rs.length === 1) {
              const result = z.object({ receipt: z.string() }).safeParse(rs[0]);
              return toolCallTape(
                'readRecord',
                { receipt: result.success ? result.data.receipt : 'missing-receipt' },
                't1-read',
              );
            }
            const result = z
              .object({ name: z.string(), [field]: z.number(), verified: z.literal(true) })
              .safeParse(rs[1]);
            return textOnlyTape(
              result.success ? `verified ${result.data.name} value ${result.data[field]}` : 'could not verify',
            );
          },
        },
        buildAgent: ({ engine, model }) => {
          const state = {
            memory: new MockMemory(),
            writes: [] as unknown[],
            readInputs: [] as unknown[],
            reads: [] as unknown[],
            finishes: 0,
            errors: 0,
          };
          observed.set(engine, state);
          let saved: typeof written | undefined;
          return new Agent({
            id: 't1-agent',
            name: 'T1 Agent',
            instructions: 'Follow the script.',
            model,
            memory: state.memory,
            tools: {
              writeRecord: createTool({
                id: 'writeRecord',
                description: 'Write a record and return its receipt.',
                inputSchema: z.object({ name: z.literal('comparison'), [field]: z.literal(42) }),
                outputSchema: z.object({ receipt: z.string(), name: z.string(), [field]: z.number() }),
                execute: async input => {
                  if (saved) throw new Error('Record already written');
                  saved = { ...input, receipt: RECEIPT };
                  state.writes.push(saved);
                  return saved;
                },
              }),
              readRecord: createTool({
                id: 'readRecord',
                description: 'Read using the receipt returned by writeRecord.',
                inputSchema: z.object({ receipt: z.string() }),
                outputSchema: z.object({ name: z.string(), [field]: z.number(), verified: z.boolean() }),
                execute: async input => {
                  state.readInputs.push(input);
                  if (!saved || input.receipt !== saved.receipt) throw new Error('Incorrect receipt');
                  const result = { name: saved.name, [field]: saved[field], verified: true };
                  state.reads.push(result);
                  return result;
                },
              }),
            },
          });
        },
        run: async handle => {
          const state = observed.get(handle.engine)!;
          await handle.turn(
            'Write record comparison with value 42, read it back using its receipt, and report the verified value.',
            {
              maxSteps: 5,
              memory: { thread: THREAD, resource: RESOURCE },
              onFinish: () => {
                state.finishes++;
              },
              onError: () => {
                state.errors++;
              },
            },
          );
        },
      });

      for (const engine of ['plain', target] as const) {
        const state = observed.get(engine)!;
        const {
          turns: [turn],
          requests,
        } = results[engine]!;
        expect(state.writes).toEqual([written]);
        expect(state.readInputs).toEqual([{ receipt: RECEIPT }]);
        expect(state.reads).toEqual([expected]);
        expect(state.finishes).toBe(1);
        expect(state.errors).toBe(0);
        expect(turn!.error).toBeUndefined();
        expect(turn!.text).toBe('verified comparison value 42');
        expect(turn!.stepCount).toBe(3);
        expect(chunksOfType(turn!, 'finish')).toBe(1);
        for (const type of ['error', 'abort', 'tripwire']) expect(chunksOfType(turn!, type)).toBe(0);
        const calls = turn!.chunkPayloads
          .filter((_, index) => turn!.chunkTypes[index] === 'tool-call')
          .map(payload => z.object({ toolName: z.string() }).parse(payload).toolName);
        expect(calls).toEqual(['writeRecord', 'readRecord']);
        expect(chunksOfType(turn!, 'tool-result')).toBe(2);
        expect(turn!.toolResults.map(result => ({ name: result.toolName, id: result.toolCallId }))).toEqual([
          { name: 'readRecord', id: 't1-read' },
          { name: 'writeRecord', id: 't1-write' },
        ]);
        expect(requests).toHaveLength(3);
        expect(outputs(requests[1]!)).toEqual([written]);
        expect(outputs(requests[2]!)).toEqual([written, expected]);
        const { messages } = await state.memory.recall({ threadId: THREAD, resourceId: RESOURCE });
        const stored = messages
          .flatMap(message => message.content.parts ?? [])
          .filter(part => part.type === 'tool-invocation')
          .map(part => part.toolInvocation);
        expect(
          stored.map(part => ({
            name: part.toolName,
            state: part.state,
            result: 'result' in part ? part.result : undefined,
          })),
        ).toEqual([
          { name: 'writeRecord', state: 'result', result: written },
          { name: 'readRecord', state: 'result', result: expected },
        ]);
        expect(messages.filter(message => message.role === 'user')).toHaveLength(1);
        expect(new Set(messages.map(message => message.id)).size).toBe(messages.length);
        expect(
          messages
            .filter(message => message.role === 'assistant')
            .flatMap(message => message.content.parts ?? [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n'),
        ).toContain('42');
      }
    },
  );
});
