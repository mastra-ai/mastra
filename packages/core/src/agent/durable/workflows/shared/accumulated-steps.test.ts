import { describe, expect, it, vi } from 'vitest';
import { loadAccumulatedSteps, readAccumulatedSteps, storeAccumulatedSteps } from './accumulated-steps';

/** Step params whose `getState` picks keys like the engines do, recording which keys each call asked for. */
function stateParams(state: Record<string, unknown>) {
  const reads: (readonly string[] | undefined)[] = [];
  return {
    reads,
    getState: async (keys?: readonly string[]) => {
      reads.push(keys);
      return keys ? Object.fromEntries(keys.filter(key => key in state).map(key => [key, state[key]])) : state;
    },
    setState: vi.fn(async (_: unknown) => {}),
  };
}

describe('readAccumulatedSteps', () => {
  it('reads the step records from workflow state when the run keeps them there', () => {
    expect(readAccumulatedSteps({ accumulatedSteps: [{ text: 'state' }] }, { accumulatedSteps: [] })).toEqual([
      { text: 'state' },
    ]);
  });

  it('falls back to the step payload for runs that never seeded them into state', () => {
    expect(readAccumulatedSteps({ messageListState: {} }, { accumulatedSteps: [{ text: 'payload' }] })).toEqual([
      { text: 'payload' },
    ]);
    expect(readAccumulatedSteps(undefined, {})).toEqual([]);
  });
});

describe('loadAccumulatedSteps', () => {
  it('loads only the step records from workflow state', async () => {
    const params = stateParams({ messageListState: 'transcript', accumulatedSteps: [{ text: 'one' }] });

    expect(await loadAccumulatedSteps(params, {})).toEqual([{ text: 'one' }]);
    expect(params.reads).toEqual([['accumulatedSteps']]);
  });

  it('falls back to the step payload for runs that thread the records there', async () => {
    expect(await loadAccumulatedSteps(stateParams({}), { accumulatedSteps: [{ text: 'payload' }] })).toEqual([
      { text: 'payload' },
    ]);
  });
});

describe('storeAccumulatedSteps', () => {
  it('writes only the records, returning nothing for the payload', async () => {
    const params = stateParams({ messageListState: 'transcript', accumulatedSteps: [{ text: 'one' }] });
    const steps = [{ text: 'one' }, { text: 'two' }];

    const fields = await storeAccumulatedSteps(params, steps);

    expect(fields).toEqual({});
    expect(params.setState).toHaveBeenCalledWith({ accumulatedSteps: steps });
    expect(params.reads).toEqual([['accumulatedSteps']]);
  });

  it('returns the records for the step payload when state does not track them', async () => {
    const params = stateParams({ messageListState: 'transcript' });
    const steps = [{ text: 'one' }];

    expect(await storeAccumulatedSteps(params, steps)).toEqual({ accumulatedSteps: steps });
    expect(params.setState).not.toHaveBeenCalled();
  });
});
