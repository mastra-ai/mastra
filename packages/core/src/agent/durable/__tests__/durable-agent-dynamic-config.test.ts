/**
 * Ported from validation harness case T25 (dynamic-config).
 *
 * `instructions`, `model` and `tools` may be functions of the caller's request
 * context, and the caller's request context must be the one they see on every
 * model call — not the first call, and not a static default. `activeTools` is a
 * plain call option but answers the same question: does the request the model
 * sees reflect the per-call configuration? This file asserts the resolved
 * request context and the resolved request body on each engine.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, ModelScript, ParityEngine, ParityStreamOptions } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const MARKER = 't25-marker';

type Variant = 'instructions' | 'model' | 'tools' | 'active-tools';

/** The harness's `marker(rc)` accessor. */
function marker(requestContext: unknown): string {
  const get = (requestContext as { get?: (key: string) => unknown } | undefined)?.get;
  return typeof get === 'function' ? String(get.call(requestContext, 'marker') ?? 'unset') : 'unset';
}

/** Counts the tool results a request's prompt already carries, like the harness script. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter(part => part.type === 'tool-result').length;
  }
  return count;
}

/** The harness's `systemText(call)`. */
function systemText(request: CapturedRequest): string {
  const system = request.prompt.find(message => message.role === 'system');
  if (!system) return '';
  const content: unknown = system.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Array<{ type: string; text?: string }>)
    .map(part => (part.type === 'text' ? (part.text ?? '') : ''))
    .join('');
}

/** The harness's `toolNames(call)`. */
function toolNames(request: CapturedRequest): string[] {
  return (request.tools ?? []).map(tool => tool.name);
}

/**
 * Re-labels the recording model with a marker-derived id, so the id can only be
 * right if the dynamic `model` function resolved the caller's request context.
 * `onCall` records which label actually served each model call.
 */
function taggedModel(model: unknown, modelId: string, onCall: (modelId: string) => void): unknown {
  const clone = Object.assign(Object.create(Object.getPrototypeOf(model)), model, { modelId }) as {
    doStream: (options: unknown) => unknown;
  };
  const inner = clone.doStream;
  clone.doStream = options => {
    onCall(modelId);
    return inner(options);
  };
  return clone;
}

/** Runs one T25 variant; captures the resolved markers, served model ids and committed tools per engine. */
async function runT25(variant: Variant) {
  const resolved = new Map<ParityEngine, string[]>();
  const servedModelIds = new Map<ParityEngine, string[]>();
  const commits = new Map<ParityEngine, number>();

  const model: ModelScript = {
    respond: request => {
      const done = toolResultCount(request);
      return done < 2
        ? toolCallTape('step', { n: done + 1 }, `call-${done + 1}`)
        : textOnlyTape(`finished ${done} steps`);
    },
  };

  const options: ParityStreamOptions = {
    maxSteps: 5,
    memory: { thread: `t25-thread-${variant}`, resource: 't25-resource' },
    requestContext: new RequestContext([['marker', MARKER]]),
    ...(variant === 'active-tools' ? { activeTools: ['step'] } : {}),
  };

  const results = await expectEngineParity({
    model,
    buildAgent: ({ engine, model: agentModel }) => {
      const seen: string[] = [];
      resolved.set(engine, seen);
      servedModelIds.set(engine, []);
      commits.set(engine, 0);

      const step = createTool({
        id: 'step',
        description: 'Advance one step.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          commits.set(engine, commits.get(engine)! + 1);
          return { done: n };
        },
      });
      const other = createTool({
        id: 'other',
        description: 'Unused second tool.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => ({ done: n }),
      });

      return new Agent({
        id: 't25-agent',
        name: 't25',
        instructions:
          variant === 'instructions'
            ? ({ requestContext }) => {
                seen.push(marker(requestContext));
                return `Follow the script. ${marker(requestContext)}`;
              }
            : 'Follow the script.',
        model:
          variant === 'model'
            ? ({ requestContext }) => {
                seen.push(marker(requestContext));
                return taggedModel(agentModel, `script-${marker(requestContext)}`, id =>
                  servedModelIds.get(engine)!.push(id),
                ) as typeof agentModel;
              }
            : agentModel,
        tools:
          variant === 'tools'
            ? ({ requestContext }: { requestContext: RequestContext }): Record<string, typeof step | typeof other> => {
                seen.push(marker(requestContext));
                return marker(requestContext) === MARKER ? { step } : {};
              }
            : variant === 'active-tools'
              ? { step, other }
              : { step },
        memory: new MockMemory(),
      });
    },
    run: async handle => {
      await handle.turn('Go.', options);
    },
  });

  return { results, resolved, servedModelIds, commits };
}

describe('T25 dynamic agent configuration (plain, durable, evented)', () => {
  it.each<Variant>(['instructions', 'model', 'tools', 'active-tools'])(
    '%s: the caller request context reaches every model call',
    async variant => {
      const { results, resolved, servedModelIds, commits } = await runT25(variant);

      for (const engine of ENGINES) {
        const { turns, requests } = results[engine]!;

        // 'two tool turns then an answer, one finish'
        expect(requests).toHaveLength(3);
        expect(commits.get(engine)).toBe(2);
        expect(chunksOfType(turns.at(-1)!, 'finish')).toBe(1);

        if (variant === 'instructions') {
          // 'every request carries the marker in its system text'
          expect(requests.map(systemText).every(text => text.includes(MARKER))).toBe(true);
        }
        if (variant === 'model') {
          // 'every request went to the marker-named model'
          const ids = servedModelIds.get(engine)!;
          expect(ids).toHaveLength(3);
          expect(ids.every(id => id === `script-${MARKER}`)).toBe(true);
        }
        if (variant === 'tools' || variant === 'active-tools') {
          // 'every request exposes exactly `step`'
          expect(requests.map(toolNames).every(names => names.join() === 'step')).toBe(true);
        }
        if (variant !== 'active-tools') {
          // "dynamic config only ever saw the caller's requestContext"
          const markers = resolved.get(engine)!;
          expect(markers.length).toBeGreaterThan(0);
          expect(markers.every(value => value === MARKER)).toBe(true);
        }
      }
    },
  );
});
