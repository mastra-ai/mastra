/**
 * A loop whose body is a nested workflow that suspends must keep its own
 * iterationCount across suspend/resume on the evented engine, matching the
 * default engine (#29727). When the nested workflow runs its own counted loop,
 * the outer loop must not pick up the inner loop's count (#29762).
 *
 * Each case also runs with an FGA provider, which sends nested dispatch through
 * the authorization path that rewrites the body's running-record metadata.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { MockStore } from '../../storage/mock';
import { createEventedWorkflow, createWorkflow } from '../create';
import { createStep } from '../workflow';

const Value = z.object({ x: z.number() });
const ENGINES = ['default', 'evented'] as const;
type Engine = (typeof ENGINES)[number];
const MAX_RESUMES = 10;

async function runToCompletion(engine: Engine, withFga: boolean, workflows: Record<string, any>, workflowId: string) {
  const fga = { require: vi.fn(), check: vi.fn(), filterAccessible: vi.fn() };
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows,
    server: withFga ? ({ fga } as any) : undefined,
  });
  try {
    if (engine === 'evented') await mastra.startWorkers();
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });
    const run = await mastra.getWorkflow(workflowId).createRun({ resourceId: 'tenant-1' });
    let result: any = await run.start({ inputData: { x: 0 }, requestContext });
    let resumes = 0;
    while (result.status === 'suspended' && resumes < MAX_RESUMES) {
      resumes++;
      result = await run.resume({ step: result.suspended[0], resumeData: { ok: true }, requestContext });
    }
    if (withFga) expect(fga.require).toHaveBeenCalled();
    return { result, resumes };
  } finally {
    if (engine === 'evented') await mastra.stopWorkers();
  }
}

function makeAsk() {
  return createStep({
    id: 'ask',
    inputSchema: Value,
    outputSchema: Value,
    resumeSchema: z.object({ ok: z.literal(true) }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend({});
      return { x: inputData.x + 1 };
    },
  });
}

describe('loop over a suspending nested workflow keeps its iterationCount', () => {
  describe.each(ENGINES.flatMap(engine => [false, true].map(withFga => ({ engine, withFga }))))(
    '$engine engine (fga: $withFga)',
    ({ engine, withFga }) => {
      const factory = engine === 'evented' ? createEventedWorkflow : createWorkflow;

      it.each(['dountil', 'dowhile'] as const)('%s terminates on iterationCount', async loopType => {
        const counts: number[] = [];
        const body = factory({ id: `body-${loopType}`, inputSchema: Value, outputSchema: Value })
          .then(makeAsk())
          .commit();
        const condition = async ({ iterationCount }: { iterationCount: number }) => {
          counts.push(iterationCount);
          return loopType === 'dountil' ? iterationCount >= 2 : iterationCount < 2;
        };
        const loop = factory({ id: `loop-${loopType}`, inputSchema: Value, outputSchema: Value });
        (loopType === 'dountil' ? loop.dountil(body, condition) : loop.dowhile(body, condition)).commit();

        const { result, resumes } = await runToCompletion(
          engine,
          withFga,
          { [body.id]: body, [loop.id]: loop },
          loop.id,
        );

        expect(result.status).toBe('success');
        expect(resumes).toBe(2);
        expect(counts).toEqual([1, 2]);
        expect(result.result).toEqual({ x: 2 });
      });

      it.each([
        [2, 2],
        [2, 3],
      ])('outer loop uses its own count when the body loops %i times (outer %i)', async (inner, outer) => {
        const outerCounts: number[] = [];
        const body = factory({ id: `inner-${inner}-${outer}`, inputSchema: Value, outputSchema: Value })
          .dountil(makeAsk(), async ({ iterationCount }) => iterationCount >= inner)
          .commit();
        const loop = factory({ id: `outer-${inner}-${outer}`, inputSchema: Value, outputSchema: Value })
          .dountil(body, async ({ iterationCount }) => {
            outerCounts.push(iterationCount);
            return iterationCount >= outer;
          })
          .commit();

        const { result, resumes } = await runToCompletion(
          engine,
          withFga,
          { [body.id]: body, [loop.id]: loop },
          loop.id,
        );

        expect(result.status).toBe('success');
        expect(resumes).toBe(inner * outer);
        expect(outerCounts).toEqual(Array.from({ length: outer }, (_, i) => i + 1));
        expect(result.result).toEqual({ x: inner * outer });
      });
    },
  );
});
