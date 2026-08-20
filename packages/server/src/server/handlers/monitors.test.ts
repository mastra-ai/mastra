import { Mastra } from '@mastra/core/mastra';
import type { Monitor, MonitorsStorage } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  LIST_MONITORS_ROUTE,
  GET_MONITOR_ROUTE,
  CREATE_MONITOR_ROUTE,
  UPDATE_MONITOR_ROUTE,
  DELETE_MONITOR_ROUTE,
  LIST_MONITOR_EVENTS_ROUTE,
  EVALUATE_MONITORS_ROUTE,
} from './monitors';
import { createTestServerContext } from './test-utils';

const monitorBody = {
  name: 'Relevancy floor',
  filter: { scorerIds: ['relevancy'] },
  windowMinutes: 60,
  aggregation: 'avg' as const,
  threshold: { op: 'lt' as const, value: 0.7 },
  channels: [],
};

describe('Monitors Handlers', () => {
  let mastra: Mastra;
  let monitorsStore: MonitorsStorage;

  beforeEach(async () => {
    const storage = new InMemoryStore();
    await storage.init();
    monitorsStore = (await storage.getStore('monitors'))!;
    mastra = new Mastra({ logger: false, storage });
  });

  const ctx = () => createTestServerContext({ mastra });

  it('creates a monitor with generated id and defaults', async () => {
    const created = (await CREATE_MONITOR_ROUTE.handler({ ...ctx(), ...monitorBody } as any)) as Monitor;
    expect(created.id).toBeDefined();
    expect(created.status).toBe('active');
    expect(created.threshold).toEqual({ op: 'lt', value: 0.7 });

    const listed = (await LIST_MONITORS_ROUTE.handler(ctx() as any)) as { monitors: Monitor[] };
    expect(listed.monitors).toHaveLength(1);
  });

  it('rejects an invalid threshold op via storage validation', async () => {
    await expect(
      CREATE_MONITOR_ROUTE.handler({ ...ctx(), ...monitorBody, threshold: { op: 'eq', value: 1 } } as any),
    ).rejects.toThrow();
  });

  it('gets, updates and deletes a monitor', async () => {
    const created = (await CREATE_MONITOR_ROUTE.handler({ ...ctx(), ...monitorBody } as any)) as Monitor;

    const fetched = (await GET_MONITOR_ROUTE.handler({ ...ctx(), monitorId: created.id } as any)) as Monitor;
    expect(fetched.id).toBe(created.id);

    const updated = (await UPDATE_MONITOR_ROUTE.handler({
      ...ctx(),
      monitorId: created.id,
      status: 'paused',
    } as any)) as Monitor;
    expect(updated.status).toBe('paused');

    await DELETE_MONITOR_ROUTE.handler({ ...ctx(), monitorId: created.id } as any);
    await expect(GET_MONITOR_ROUTE.handler({ ...ctx(), monitorId: created.id } as any)).rejects.toThrow(HTTPException);
  });

  it('404s on unknown monitor', async () => {
    await expect(GET_MONITOR_ROUTE.handler({ ...ctx(), monitorId: 'nope' } as any)).rejects.toThrow('not found');
    await expect(
      UPDATE_MONITOR_ROUTE.handler({ ...ctx(), monitorId: 'nope', status: 'paused' } as any),
    ).rejects.toThrow('not found');
  });

  it('lists monitor events', async () => {
    const created = (await CREATE_MONITOR_ROUTE.handler({ ...ctx(), ...monitorBody } as any)) as Monitor;
    await monitorsStore.recordMonitorEvent({
      monitorId: created.id,
      type: 'breach',
      value: 0.4,
      count: 3,
      threshold: { op: 'lt', value: 0.7 },
      windowStart: 0,
      windowEnd: 1,
      createdAt: Date.now(),
    });

    const res = (await LIST_MONITOR_EVENTS_ROUTE.handler({ ...ctx(), monitorId: created.id } as any)) as {
      events: unknown[];
    };
    expect(res.events).toHaveLength(1);
  });

  it('evaluates all monitors exactly once per call', async () => {
    await CREATE_MONITOR_ROUTE.handler({ ...ctx(), ...monitorBody, noDataBehavior: 'skip' } as any);
    const res = (await EVALUATE_MONITORS_ROUTE.handler(ctx() as any)) as {
      results: { monitorId: string; value: number | null }[];
    };
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.value).toBeNull();
  });
});
