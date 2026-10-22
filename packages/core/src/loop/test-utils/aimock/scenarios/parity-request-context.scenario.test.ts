/**
 * Ported from validation harness case T26 (request-context), source 23f640a.
 * A caller's context must reach both tools, dynamic instructions, and processors.
 * Recovery is excluded (COR-1449); context mutation is a separate contract.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import type { ParityEngine } from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

const MARKER = 't26-marker';

describeParity('request-context parity', target => {
  it.each(['tools', 'dynamic', 'processors'] as const)(
    '%s: caller marker survives every model and tool step',
    async variant => {
      const observed = new Map<ParityEngine, { commits: { n: number; marker: unknown }[]; processorSaw: unknown[] }>();
      const results = await expectParity(target, {
        model: {
          tapes: [
            toolCallTape('echoContext', { n: 1 }, 't26-1'),
            toolCallTape('echoContext', { n: 2 }, 't26-2'),
            textOnlyTape('echoed 2'),
          ],
        },
        buildAgent: ({ engine, model }) => {
          const state = { commits: [] as { n: number; marker: unknown }[], processorSaw: [] as unknown[] };
          observed.set(engine, state);
          return new Agent({
            id: 't26-agent',
            name: 'T26 Agent',
            model,
            memory: new MockMemory(),
            instructions:
              variant === 'dynamic'
                ? ({ requestContext }) => `Follow the script. ${requestContext.get('marker') ?? 'unset'}`
                : 'Follow the script.',
            inputProcessors:
              variant === 'processors'
                ? [
                    {
                      id: 't26-input',
                      processInput: async ({ messages, requestContext }) => {
                        state.processorSaw.push(requestContext.get('marker') ?? 'unset');
                        return messages;
                      },
                    },
                  ]
                : undefined,
            tools: {
              echoContext: createTool({
                id: 'echoContext',
                description: 'Return the marker from request context.',
                inputSchema: z.object({ n: z.number() }),
                execute: async ({ n }, context) => {
                  const result = { n, marker: context?.requestContext?.get('marker') ?? 'unset' };
                  state.commits.push(result);
                  return result;
                },
              }),
            },
          });
        },
        input: 'Go.',
        options: {
          maxSteps: 5,
          memory: { thread: 't26-thread', resource: 't26-resource' },
          requestContext: new RequestContext([['marker', MARKER]]),
        },
      });
      const contracts = (['plain', target] as const).map(engine => {
        const state = observed.get(engine)!;
        const {
          turns: [turn],
          requests,
        } = results[engine]!;
        expect(turn!.error).toBeUndefined();
        expect(chunksOfType(turn!, 'finish')).toBe(1);
        expect(chunksOfType(turn!, 'error')).toBe(0);
        expect(state.commits).toEqual([
          { n: 1, marker: MARKER },
          { n: 2, marker: MARKER },
        ]);
        const systemHasMarker = requests.map(request =>
          request.prompt
            .filter(message => message.role === 'system')
            .map(message => message.content)
            .join('\n')
            .includes(MARKER),
        );
        if (variant === 'dynamic') expect(systemHasMarker).toEqual([true, true, true]);
        if (variant === 'processors') {
          expect(state.processorSaw.length).toBeGreaterThan(0);
          expect(state.processorSaw.every(marker => marker === MARKER)).toBe(true);
        }
        return {
          commits: state.commits.map(commit => commit.n),
          markers: [...new Set(state.commits.map(commit => commit.marker))],
          systemHasMarker,
          processorSaw: [...new Set(state.processorSaw)],
          finish: chunksOfType(turn!, 'finish'),
          errors: chunksOfType(turn!, 'error'),
          threw: turn!.error ?? null,
        };
      });
      expect(contracts[1]).toEqual(contracts[0]);
    },
  );
});
