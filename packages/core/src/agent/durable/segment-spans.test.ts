import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { RequestContext } from '../../request-context';
import { setExecutionClaim } from './execution-fence';
import { claimSegmentEnd, endFailedSegmentSpans } from './segment-spans';

describe('endFailedSegmentSpans', () => {
  const input = { agentSpanData: { id: 'agent' }, modelSpanData: { id: 'model' } };

  it.each([
    { run: 'a failed run', state: input, steps: { input }, ended: ['model', 'agent'] },
    { run: 'a run whose engine threw, maybe after the finish step', state: input, steps: {}, ended: [] },
    {
      run: 'an iteration that failed before its model call',
      state: { ...input, iterationCount: 0 },
      steps: { input },
      ended: [],
    },
  ])('ends $ended for $run', ({ state, steps, ended }) => {
    const error = vi.fn();
    const rebuildSpan = ({ id }: { id: string }) => ({ error: () => error(id) });
    const mastra: any = { observability: { getSelectedInstance: () => ({ rebuildSpan }) } };

    endFailedSegmentSpans({
      mastra,
      requestContext: new RequestContext(),
      runId: 'run',
      state,
      steps,
      error: new Error('run failed'),
    });

    expect(error.mock.calls.flat()).toEqual(ended);
  });
});

describe('claimSegmentEnd', () => {
  function claims({ generation }: { generation?: number } = { generation: 1 }) {
    const pubsub = new EventEmitterPubSub();
    vi.spyOn(pubsub, 'deliversAcrossProcesses', 'get').mockReturnValue(true);
    const requestContext = new RequestContext();
    setExecutionClaim(requestContext, 'run', { executionId: 'execution', agentId: 'agent', generation });
    const claim = (outcome: 'suspend' | 'fail') =>
      claimSegmentEnd({ mastra: { pubsub } as any, requestContext, runId: 'run', iterationCount: 0, outcome });
    return { pubsub, claim };
  }

  it.each([
    ['suspend', 'fail'],
    ['fail', 'suspend'],
  ] as const)('lets only %s end the spans when it comes before %s', async (first, second) => {
    const { claim } = claims();
    expect(await claim(first)).toBe(true);
    expect(await claim(second)).toBe(false);
    // A redelivery of the first one still ends them.
    expect(await claim(first)).toBe(true);
  });

  it.each([
    ['the run is not fenced in storage', () => claims({})],
    [
      'the broker has no leases',
      () => {
        const { pubsub, claim } = claims();
        Object.assign(pubsub, { getLeaseProvider: () => undefined });
        return { claim };
      },
    ],
    [
      'the lease cannot be taken',
      () => {
        const { pubsub, claim } = claims();
        vi.spyOn(pubsub, 'acquireLease').mockRejectedValue(new Error('connection lost'));
        return { claim };
      },
    ],
    [
      'the broker is closed',
      () => {
        const { pubsub, claim } = claims();
        vi.spyOn(pubsub, 'acquireLease').mockResolvedValue({ acquired: false });
        return { claim };
      },
    ],
  ])('leaves the spans to the suspension when %s', async (_, setup) => {
    const { claim } = setup();
    expect(await claim('fail')).toBe(false);
    expect(await claim('suspend')).toBe(true);
  });
});
