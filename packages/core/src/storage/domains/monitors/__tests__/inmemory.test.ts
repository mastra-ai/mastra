import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryDB } from '../../inmemory-db';
import type { Monitor, MonitorEvent } from '../base';
import { InMemoryMonitorsStorage } from '../inmemory';

function buildMonitor(overrides: Partial<Monitor> = {}): Monitor {
  const now = Date.now();
  return {
    id: 'mon-1',
    name: 'Cohort quality',
    filter: { scorerIds: ['answer-relevancy'], metadata: { cohort: 'oncology' } },
    windowMinutes: 60,
    aggregation: 'avg',
    threshold: { op: 'lt', value: 0.7 },
    cooldownMinutes: 30,
    channels: [{ type: 'webhook', url: 'https://hooks.example.com/alerts' }],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildEvent(overrides: Partial<MonitorEvent> = {}): MonitorEvent {
  return {
    monitorId: 'mon-1',
    type: 'breach',
    value: 0.5,
    count: 10,
    threshold: { op: 'lt', value: 0.7 },
    windowStart: Date.now() - 3_600_000,
    windowEnd: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('InMemoryMonitorsStorage', () => {
  let storage: InMemoryMonitorsStorage;

  beforeEach(() => {
    storage = new InMemoryMonitorsStorage({ db: new InMemoryDB() });
  });

  it('creates and fetches a monitor', async () => {
    const created = await storage.createMonitor(buildMonitor());
    expect(created.id).toBe('mon-1');
    const fetched = await storage.getMonitor('mon-1');
    expect(fetched).toEqual(created);
  });

  it('rejects duplicate ids', async () => {
    await storage.createMonitor(buildMonitor());
    await expect(storage.createMonitor(buildMonitor())).rejects.toThrow('already exists');
  });

  it('rejects invalid threshold op', async () => {
    await expect(storage.createMonitor(buildMonitor({ threshold: { op: 'eq' as never, value: 0.7 } }))).rejects.toThrow(
      'Invalid monitor threshold op',
    );
  });

  it('rejects invalid aggregation and window', async () => {
    await expect(storage.createMonitor(buildMonitor({ aggregation: 'median' as never }))).rejects.toThrow(
      'Invalid monitor aggregation',
    );
    await expect(storage.createMonitor(buildMonitor({ windowMinutes: 0 }))).rejects.toThrow('Invalid monitor window');
  });

  it('rejects invalid channels', async () => {
    await expect(storage.createMonitor(buildMonitor({ channels: [{ type: 'webhook', url: '' }] }))).rejects.toThrow(
      'Invalid monitor channel',
    );
  });

  it('lists monitors filtered by status, oldest first', async () => {
    await storage.createMonitor(buildMonitor({ id: 'a', createdAt: 1, updatedAt: 1 }));
    await storage.createMonitor(buildMonitor({ id: 'b', createdAt: 2, updatedAt: 2, status: 'paused' }));
    const all = await storage.listMonitors();
    expect(all.map(m => m.id)).toEqual(['a', 'b']);
    const active = await storage.listMonitors({ status: 'active' });
    expect(active.map(m => m.id)).toEqual(['a']);
  });

  it('patches a monitor and revalidates', async () => {
    await storage.createMonitor(buildMonitor());
    const updated = await storage.updateMonitor('mon-1', { threshold: { op: 'gte', value: 0.9 }, status: 'paused' });
    expect(updated.threshold).toEqual({ op: 'gte', value: 0.9 });
    expect(updated.status).toBe('paused');
    await expect(storage.updateMonitor('mon-1', { windowMinutes: -5 })).rejects.toThrow('Invalid monitor window');
    await expect(storage.updateMonitor('missing', { status: 'paused' })).rejects.toThrow('not found');
  });

  it('records and lists events newest first with filters', async () => {
    await storage.createMonitor(buildMonitor());
    const first = await storage.recordMonitorEvent(buildEvent({ createdAt: 100 }));
    await storage.recordMonitorEvent(buildEvent({ type: 'recovery', value: 0.8, createdAt: 200 }));
    await storage.recordMonitorEvent(buildEvent({ monitorId: 'other', createdAt: 300 }));

    expect(first.id).toBeDefined();
    const events = await storage.listMonitorEvents('mon-1');
    expect(events.map(e => e.createdAt)).toEqual([200, 100]);
    expect(await storage.listMonitorEvents('mon-1', { type: 'breach' })).toHaveLength(1);
    expect(await storage.listMonitorEvents('mon-1', { fromCreatedAt: 150 })).toHaveLength(1);
    expect(await storage.listMonitorEvents('mon-1', { limit: 1 })).toHaveLength(1);
  });

  it('deleting a monitor removes its events', async () => {
    await storage.createMonitor(buildMonitor());
    await storage.recordMonitorEvent(buildEvent());
    await storage.deleteMonitor('mon-1');
    expect(await storage.getMonitor('mon-1')).toBeNull();
    expect(await storage.listMonitorEvents('mon-1')).toHaveLength(0);
  });
});
