import { randomUUID } from 'node:crypto';
import type { InMemoryDB } from '../inmemory-db';
import type { Monitor, MonitorEvent, MonitorEventListOptions, MonitorStatus, MonitorUpdate } from './base';
import { MonitorsStorage, validateMonitor } from './base';

function clone<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export class InMemoryMonitorsStorage extends MonitorsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.monitors.clear();
    this.db.monitorEvents.length = 0;
  }

  async createMonitor(monitor: Monitor): Promise<Monitor> {
    if (this.db.monitors.has(monitor.id)) {
      throw new Error(`Monitor ${monitor.id} already exists`);
    }
    validateMonitor(monitor);
    const stored = clone(monitor);
    this.db.monitors.set(stored.id, stored);
    return clone(stored);
  }

  async getMonitor(id: string): Promise<Monitor | null> {
    const found = this.db.monitors.get(id);
    return found ? clone(found) : null;
  }

  async listMonitors(filter?: { status?: MonitorStatus }): Promise<Monitor[]> {
    let rows = Array.from(this.db.monitors.values());
    if (filter?.status) {
      rows = rows.filter(r => r.status === filter.status);
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows.map(clone);
  }

  async updateMonitor(id: string, patch: MonitorUpdate): Promise<Monitor> {
    const existing = this.db.monitors.get(id);
    if (!existing) {
      throw new Error(`Monitor ${id} not found`);
    }
    const updated: Monitor = {
      ...existing,
      ...patch,
      filter: patch.filter !== undefined ? patch.filter : existing.filter,
      metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      updatedAt: Date.now(),
    };
    validateMonitor(updated);
    const stored = clone(updated);
    this.db.monitors.set(id, stored);
    return clone(stored);
  }

  async deleteMonitor(id: string): Promise<void> {
    this.db.monitors.delete(id);
    for (let i = this.db.monitorEvents.length - 1; i >= 0; i--) {
      if (this.db.monitorEvents[i]!.monitorId === id) {
        this.db.monitorEvents.splice(i, 1);
      }
    }
  }

  async recordMonitorEvent(event: MonitorEvent): Promise<MonitorEvent> {
    const stored: MonitorEvent = { ...event, id: event.id ?? randomUUID() };
    this.db.monitorEvents.push(clone(stored));
    return clone(stored);
  }

  async listMonitorEvents(monitorId: string, opts?: MonitorEventListOptions): Promise<MonitorEvent[]> {
    let rows = this.db.monitorEvents.filter(e => e.monitorId === monitorId);
    if (opts?.type) {
      rows = rows.filter(e => e.type === opts.type);
    }
    if (opts?.fromCreatedAt != null) {
      rows = rows.filter(e => e.createdAt >= opts.fromCreatedAt!);
    }
    if (opts?.toCreatedAt != null) {
      rows = rows.filter(e => e.createdAt < opts.toCreatedAt!);
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    if (opts?.limit != null) {
      rows = rows.slice(0, opts.limit);
    }
    return rows.map(clone);
  }
}
