import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { endFailedSegmentSpans } from './segment-spans';

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
