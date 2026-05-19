import { calculatePagination, normalizePerPage } from '../../base';
import type { InMemoryDB } from '../inmemory-db';
import type {
  AgentRun,
  AgentRunCreateInput,
  AgentRunDeleteFilter,
  AgentRunEvent,
  AgentRunEventInput,
  AgentRunEventListOptions,
  AgentRunEventListResult,
  AgentRunListFilter,
  AgentRunListResult,
  AgentRunStatus,
  AgentRunUpdate,
} from './base';
import { AgentRunsStorage } from './base';

function cloneValue<T>(value: T): T {
  if (value == null) return value;
  return structuredClone(value);
}

function cloneRun(run: AgentRun): AgentRun {
  return cloneValue(run);
}

function cloneEvent(event: AgentRunEvent): AgentRunEvent {
  return cloneValue(event);
}

function matchesNullable(value: string | null | undefined, filter: string | null | undefined): boolean {
  if (filter === undefined) return true;
  return (value ?? null) === filter;
}

function matchesStatus(status: AgentRunStatus, filter: AgentRunStatus | AgentRunStatus[] | undefined): boolean {
  if (!filter) return true;
  const statuses = Array.isArray(filter) ? filter : [filter];
  return statuses.includes(status);
}

function dateValue(date: Date | null | undefined): number {
  return date?.getTime() ?? 0;
}

function maxDate(dates: Date[]): Date | undefined {
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates.map(date => date.getTime())));
}

function assertValidPage(page: number): void {
  if (page < 0) {
    throw new Error('page must be >= 0');
  }
}

export class InMemoryAgentRunsStorage extends AgentRunsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agentRuns.clear();
    this.db.agentRunEvents.clear();
  }

  async createRun(run: AgentRunCreateInput): Promise<AgentRun> {
    if (this.db.agentRuns.has(run.runId)) {
      throw new Error(`Agent run already exists: ${run.runId}`);
    }

    const stored = cloneRun({
      ...run,
      lastEventIndex: null,
      eventCount: 0,
    });
    this.db.agentRuns.set(run.runId, stored);
    return cloneRun(stored);
  }

  async updateRun(runId: string, update: AgentRunUpdate): Promise<AgentRun> {
    const existing = this.db.agentRuns.get(runId);
    if (!existing) {
      throw new Error(`Agent run not found: ${runId}`);
    }

    const updatedAt = maxDate([existing.updatedAt, update.updatedAt ?? new Date()]) ?? existing.updatedAt;
    const updated = cloneRun({ ...existing, ...update, runId, updatedAt });
    this.db.agentRuns.set(runId, updated);
    return cloneRun(updated);
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    const run = this.db.agentRuns.get(runId);
    return run ? cloneRun(run) : null;
  }

  async listRuns(filter: AgentRunListFilter = {}): Promise<AgentRunListResult> {
    const { page = 0, perPage: perPageInput } = filter;
    assertValidPage(page);
    const perPage = normalizePerPage(perPageInput, 100);

    let runs = Array.from(this.db.agentRuns.values());

    if (filter.agentId) {
      runs = runs.filter(run => run.agentId === filter.agentId);
    }
    runs = runs.filter(run => matchesNullable(run.threadId, filter.threadId));
    runs = runs.filter(run => matchesNullable(run.resourceId, filter.resourceId));
    runs = runs.filter(run => matchesStatus(run.status, filter.status));

    const dateField = filter.dateFilterBy ?? 'createdAt';
    if (filter.fromDate) {
      runs = runs.filter(run => {
        const value = run[dateField];
        return value != null && value >= filter.fromDate!;
      });
    }
    if (filter.toDate) {
      runs = runs.filter(run => {
        const value = run[dateField];
        return value != null && value < filter.toDate!;
      });
    }

    const orderBy = filter.orderBy ?? 'updatedAt';
    const direction = filter.orderDirection ?? 'desc';
    runs.sort((a, b) => {
      const diff = dateValue(a[orderBy]) - dateValue(b[orderBy]);
      return direction === 'asc' ? diff : -diff;
    });

    const total = runs.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const paginatedRuns = runs.slice(offset, offset + perPage);

    return {
      runs: paginatedRuns.map(cloneRun),
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async appendEvent(event: AgentRunEventInput): Promise<AgentRunEvent> {
    const [stored] = await this.appendEvents([event]);
    return stored!;
  }

  async appendEvents(events: AgentRunEventInput[]): Promise<AgentRunEvent[]> {
    if (events.length === 0) return [];

    const runId = events[0]!.runId;
    if (!this.db.agentRuns.has(runId)) {
      throw new Error(`Agent run not found: ${runId}`);
    }
    if (events.some(event => event.runId !== runId)) {
      throw new Error('appendEvents only supports one runId per call');
    }

    const existing = this.db.agentRunEvents.get(runId) ?? [];
    const usedIndexes = new Set(existing.map(event => event.index));
    let nextIndex = existing.reduce((max, event) => Math.max(max, event.index), -1) + 1;

    const storedEvents: AgentRunEvent[] = [];
    for (const event of events) {
      const index = event.index ?? nextIndex;
      if (index !== nextIndex) {
        throw new Error(`Agent run event index must be contiguous for run ${runId}: expected ${nextIndex}, received ${index}`);
      }
      if (usedIndexes.has(index)) {
        throw new Error(`Agent run event already exists for run ${runId} at index ${index}`);
      }

      usedIndexes.add(index);
      nextIndex = Math.max(nextIndex, index + 1);
      storedEvents.push(cloneEvent({ ...event, index, createdAt: event.createdAt ?? new Date() }));
    }

    const allEvents = [...existing, ...storedEvents].sort((a, b) => a.index - b.index);
    this.db.agentRunEvents.set(runId, allEvents);

    const run = this.db.agentRuns.get(runId)!;
    this.db.agentRuns.set(runId, {
      ...run,
      updatedAt: maxDate([run.updatedAt, ...storedEvents.map(event => event.createdAt)]) ?? run.updatedAt,
      lastEventIndex: allEvents.at(-1)?.index ?? null,
      eventCount: allEvents.length,
    });

    return storedEvents.map(cloneEvent);
  }

  async listEvents(runId: string, opts: AgentRunEventListOptions = {}): Promise<AgentRunEventListResult> {
    let events = [...(this.db.agentRunEvents.get(runId) ?? [])];

    if (opts.afterIndex != null) {
      events = events.filter(event => event.index > opts.afterIndex!);
    }
    if (opts.toIndex != null) {
      events = events.filter(event => event.index <= opts.toIndex!);
    }

    const direction = opts.orderDirection ?? 'asc';
    events.sort((a, b) => (direction === 'asc' ? a.index - b.index : b.index - a.index));

    const total = events.length;
    if (opts.limit != null) {
      events = events.slice(0, opts.limit);
    }

    return { events: events.map(cloneEvent), total };
  }

  async deleteRun(runId: string): Promise<void> {
    this.db.agentRuns.delete(runId);
    this.db.agentRunEvents.delete(runId);
  }

  async deleteRuns(filter: AgentRunDeleteFilter): Promise<number> {
    const dateField = filter.dateFilterBy ?? 'updatedAt';
    const runs = Array.from(this.db.agentRuns.values()).filter(run => {
      if (filter.agentId && run.agentId !== filter.agentId) return false;
      if (!matchesNullable(run.threadId, filter.threadId)) return false;
      if (!matchesNullable(run.resourceId, filter.resourceId)) return false;
      if (!matchesStatus(run.status, filter.status)) return false;
      if (filter.beforeDate) {
        const value = run[dateField];
        if (value == null || value >= filter.beforeDate) return false;
      }
      return true;
    });

    for (const run of runs) {
      await this.deleteRun(run.runId);
    }

    return runs.length;
  }
}
