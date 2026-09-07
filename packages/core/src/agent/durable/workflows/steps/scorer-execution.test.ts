import { describe, expect, it } from 'vitest';
import { serializeScorersConfig } from '../../utils/serialize-state';
import { createDurableScorerStep } from './scorer-execution';

describe('durable scorer input schema', () => {
  it('preserves the eligibility filter across the workflow boundary', () => {
    const filter = {
      op: 'eq',
      left: { path: 'requestContext.protocolVersion' },
      right: { literal: 'v3' },
    } as const;
    const serialized = serializeScorersConfig({
      groundedness: {
        scorer: { id: 'scorer-1', name: 'scorer-1', description: 'test scorer' } as any,
        sampling: { type: 'ratio', rate: 0.5 },
        filter,
      },
    });
    expect(serialized.groundedness?.filter).toEqual(filter);

    // The zod input schema strips undeclared fields — a regression here would
    // silently drop the filter and score traffic the predicate should reject.
    const step = createDurableScorerStep();
    const result = step.inputSchema!['~standard'].validate({
      scorers: serialized,
      runId: 'run-1',
      agentId: 'agent-1',
      scorerInput: [],
      scorerOutput: [],
      state: {},
    }) as { value?: { scorers: Record<string, { filter?: unknown }> } };
    expect(result.value?.scorers.groundedness?.filter).toEqual(filter);
  });
});
