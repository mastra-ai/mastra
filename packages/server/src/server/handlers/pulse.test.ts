import type { Mastra } from '@mastra/core/mastra';
import { InMemoryPulseStorage } from '@mastra/core/storage';
import type { PulseRecord } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { GET_PULSE_FLOW, GET_PULSE_FLOW_TIMELINE, LIST_PULSE_FLOWS } from './pulse';
import { createTestServerContext } from './test-utils';

const T0 = new Date('2026-08-14T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

let seq = 0;
function pulse(overrides: Partial<PulseRecord>): PulseRecord {
  return {
    id: `p${++seq}`,
    timestamp: T0,
    seq,
    type: 'state',
    surface: 'agent',
    action: 'run_started',
    traceId: 'flow-1',
    source: 'span',
    ...overrides,
  };
}

function mastraWith(store: InMemoryPulseStorage | undefined): Mastra {
  return {
    getStorage: () => ({ getStore: vi.fn().mockResolvedValue(store) }),
  } as unknown as Mastra;
}

describe('pulse routes', () => {
  let store: InMemoryPulseStorage;

  beforeEach(async () => {
    store = new InMemoryPulseStorage({ now: () => T0.getTime() + 5_000 });
    await store.batchCreatePulses([
      pulse({ spanId: 'root', threadId: 't-1', timestamp: at(0) }),
      pulse({ spanId: 'root', threadId: 't-1', action: 'run_completed', type: 'output', timestamp: at(1000) }),
    ]);
  });

  it('returns 501 when no pulse store is configured (stock behavior unchanged)', async () => {
    await expect(
      LIST_PULSE_FLOWS.handler({ ...createTestServerContext({ mastra: mastraWith(undefined) }), page: 0, perPage: 40 }),
    ).rejects.toThrow(HTTPException);
    try {
      await LIST_PULSE_FLOWS.handler({
        ...createTestServerContext({ mastra: mastraWith(undefined) }),
        page: 0,
        perPage: 40,
      });
    } catch (error) {
      expect((error as HTTPException).status).toBe(501);
    }
  });

  it('lists derived flows through the storage domain', async () => {
    const result = await LIST_PULSE_FLOWS.handler({
      ...createTestServerContext({ mastra: mastraWith(store) }),
      page: 0,
      perPage: 40,
    });
    expect(result.total).toBe(1);
    expect(result.flows[0]).toMatchObject({ flowId: 'flow-1', status: 'completed', durationMs: 1000 });
  });

  it('returns one flow with tree and null for unknown flows', async () => {
    const found = await GET_PULSE_FLOW.handler({
      ...createTestServerContext({ mastra: mastraWith(store) }),
      flowId: 'flow-1',
    });
    expect(found.flow).toMatchObject({ flowId: 'flow-1', status: 'completed' });
    expect(found.flow!.tree).toHaveLength(1);

    const missing = await GET_PULSE_FLOW.handler({
      ...createTestServerContext({ mastra: mastraWith(store) }),
      flowId: 'nope',
    });
    expect(missing.flow).toBeNull();
  });

  it('returns the ordered timeline', async () => {
    const result = await GET_PULSE_FLOW_TIMELINE.handler({
      ...createTestServerContext({ mastra: mastraWith(store) }),
      flowId: 'flow-1',
    });
    expect(result.timeline.map(t => t.action)).toEqual(['run_started', 'run_completed']);
  });
});
