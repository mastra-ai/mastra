import { randomUUID } from 'node:crypto';
import type { InMemoryDB } from '../inmemory-db';
import type { Schedule, ScheduleFilter, ScheduleTrigger, ScheduleTriggerListOptions, ScheduleUpdate } from './base';
import { SchedulesStorage } from './base';

function clone<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export class InMemorySchedulesStorage extends SchedulesStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.schedules.clear();
    this.db.scheduleTriggers.length = 0;
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    if (this.db.schedules.has(schedule.id)) {
      throw new Error(`Schedule ${schedule.id} already exists`);
    }
    const stored = clone(schedule);
    this.db.schedules.set(stored.id, stored);
    return clone(stored);
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const found = this.db.schedules.get(id);
    return found ? clone(found) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    let rows = Array.from(this.db.schedules.values());
    if (filter?.status) {
      rows = rows.filter(r => r.status === filter.status);
    }
    if (filter?.workflowId) {
      rows = rows.filter(r => r.target.type === 'workflow' && r.target.workflowId === filter.workflowId);
    }
    if (filter?.ownerType !== undefined) {
      rows = rows.filter(r => (r.ownerType ?? null) === filter.ownerType);
    }
    if (filter?.ownerId !== undefined) {
      rows = rows.filter(r => (r.ownerId ?? null) === filter.ownerId);
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows.map(clone);
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const due: Schedule[] = [];
    for (const row of this.db.schedules.values()) {
      if (row.status === 'active' && row.nextFireAt <= now) {
        due.push(row);
      }
    }
    due.sort((a, b) => a.nextFireAt - b.nextFireAt);
    const cap = limit ?? due.length;
    return due.slice(0, cap).map(clone);
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    const existing = this.db.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule ${id} not found`);
    }
    const updated: Schedule = {
      ...existing,
      ...patch,
      target: patch.target !== undefined ? patch.target : existing.target,
      metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      updatedAt: Date.now(),
    };
    const stored = clone(updated);
    this.db.schedules.set(id, stored);
    return clone(stored);
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    const existing = this.db.schedules.get(id);
    if (!existing) return false;
    if (existing.nextFireAt !== expectedNextFireAt) return false;
    if (existing.status !== 'active') return false;
    const stored: Schedule = {
      ...existing,
      nextFireAt: newNextFireAt,
      lastFireAt,
      lastRunId,
      updatedAt: Date.now(),
    };
    this.db.schedules.set(id, stored);
    return true;
  }

  async deleteSchedule(id: string): Promise<void> {
    this.db.schedules.delete(id);
    for (let i = this.db.scheduleTriggers.length - 1; i >= 0; i--) {
      if (this.db.scheduleTriggers[i]!.scheduleId === id) {
        this.db.scheduleTriggers.splice(i, 1);
      }
    }
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    const stored: ScheduleTrigger = {
      ...trigger,
      id: trigger.id ?? randomUUID(),
      triggerKind: trigger.triggerKind ?? 'schedule-fire',
    };
    this.db.scheduleTriggers.push(clone(stored));
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    let rows = this.db.scheduleTriggers.filter(f => f.scheduleId === scheduleId);
    if (opts?.fromActualFireAt != null) {
      rows = rows.filter(f => f.actualFireAt >= opts.fromActualFireAt!);
    }
    if (opts?.toActualFireAt != null) {
      rows = rows.filter(f => f.actualFireAt < opts.toActualFireAt!);
    }
    rows.sort((a, b) => b.actualFireAt - a.actualFireAt);
    if (opts?.limit != null) {
      rows = rows.slice(0, opts.limit);
    }
    return rows.map(clone);
  }
}
