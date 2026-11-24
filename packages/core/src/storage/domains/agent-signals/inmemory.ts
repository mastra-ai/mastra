import { AgentSignalsStorage } from './base';
import type {
  AgentSignalClaimArgs,
  AgentSignalScope,
  AgentSignalWriteResult,
  StoredAgentSignal,
  StoredAgentSignalPayload,
} from './base';

type Row = StoredAgentSignal & { seq: number };

function toStored({ seq: _seq, ...row }: Row): StoredAgentSignal {
  return { ...row, signal: structuredClone(row.signal), createdAt: new Date(row.createdAt) };
}

/**
 * In-memory implementation of {@link AgentSignalsStorage}.
 *
 * Every method mutates its maps without awaiting in between, so calls are
 * atomic with respect to each other within the process. Not durable across
 * restarts and not shared between processes.
 */
export class InMemoryAgentSignalsStorage extends AgentSignalsStorage {
  private readonly rows = new Map<string, Row>();
  /** Closed flag per run, grouped by thread. */
  private readonly runs = new Map<string, Map<string, boolean>>();
  private nextSeq = 0;

  override get sharedAcrossProcesses(): boolean {
    return false;
  }

  async enqueue(row: {
    id: string;
    threadKey: string;
    runId: string | null;
    scope: AgentSignalScope;
    signal: StoredAgentSignalPayload;
  }): Promise<AgentSignalWriteResult> {
    if (row.runId !== null) {
      if (this.isClosed(row.threadKey, row.runId)) return 'run-closed';
      this.setClosed(row.threadKey, row.runId, false);
    }
    if (this.rows.has(row.id)) return 'accepted';
    this.rows.set(row.id, {
      id: row.id,
      threadKey: row.threadKey,
      runId: row.runId,
      scope: row.scope,
      claimedBy: null,
      signal: structuredClone(row.signal),
      createdAt: new Date(),
      seq: this.nextSeq++,
    });
    return 'accepted';
  }

  async claim({ threadKey, runId, scope, leftovers }: AgentSignalClaimArgs): Promise<StoredAgentSignal[]> {
    if (this.isClosed(threadKey, runId)) return [];
    this.setClosed(threadKey, runId, false);

    if (leftovers) {
      for (const row of this.rowsOf(threadKey)) {
        if (row.runId === runId || (row.runId !== null && this.isClosed(threadKey, row.runId))) continue;
        if (row.claimedBy !== null) {
          this.rows.delete(row.id);
          continue;
        }
        row.runId = runId;
        row.scope = 'pre-run';
      }
      for (const otherRunId of this.runs.get(threadKey)!.keys()) {
        if (otherRunId !== runId) this.setClosed(threadKey, otherRunId, true);
      }
    }

    const claimed: Row[] = [];
    for (const row of this.rowsOf(threadKey)) {
      if (row.runId !== runId || row.scope !== scope) continue;
      if (row.claimedBy === null) row.claimedBy = runId;
      if (row.claimedBy === runId) claimed.push(row);
    }
    return claimed.map(toStored);
  }

  async delete({ ids }: { ids: string[] }): Promise<void> {
    for (const id of ids) this.rows.delete(id);
  }

  async closeRun({
    threadKey,
    runId,
    consumedIds,
  }: {
    threadKey: string;
    runId: string;
    consumedIds: string[];
  }): Promise<void> {
    const consumed = new Set(consumedIds);
    for (const row of this.rowsOf(threadKey)) {
      if (row.runId !== runId) continue;
      if (consumed.has(row.id)) {
        this.rows.delete(row.id);
        continue;
      }
      row.runId = null;
      row.claimedBy = null;
    }
    this.setClosed(threadKey, runId, true);
  }

  async cancel({ threadKey, ids }: { threadKey: string; ids: string[] }): Promise<string[]> {
    const cancelled: string[] = [];
    for (const id of new Set(ids)) {
      const row = this.rows.get(id);
      if (!row || row.threadKey !== threadKey || row.claimedBy !== null) continue;
      this.rows.delete(id);
      cancelled.push(id);
    }
    return cancelled;
  }

  async readdress({
    threadKey,
    fromRunId,
    toRunId,
  }: {
    threadKey: string;
    fromRunId: string;
    toRunId: string;
  }): Promise<AgentSignalWriteResult> {
    if (fromRunId === toRunId) return this.isClosed(threadKey, toRunId) ? 'run-closed' : 'accepted';
    const targetClosed = this.isClosed(threadKey, toRunId);
    if (!targetClosed) this.setClosed(threadKey, toRunId, false);
    for (const row of this.rowsOf(threadKey)) {
      if (row.runId !== fromRunId || row.claimedBy !== null) continue;
      if (targetClosed) this.rows.delete(row.id);
      else row.runId = toRunId;
    }
    this.setClosed(threadKey, fromRunId, true);
    return targetClosed ? 'run-closed' : 'accepted';
  }

  async listPending({ threadKey, runId }: { threadKey: string; runId?: string | null }): Promise<StoredAgentSignal[]> {
    return this.rowsOf(threadKey)
      .filter(row => row.claimedBy === null && (runId === undefined || row.runId === runId))
      .map(toStored);
  }

  async deleteThread({ threadKey }: { threadKey: string }): Promise<void> {
    for (const row of this.rowsOf(threadKey)) this.rows.delete(row.id);
    this.runs.delete(threadKey);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.rows.clear();
    this.runs.clear();
  }

  private isClosed(threadKey: string, runId: string): boolean {
    return this.runs.get(threadKey)?.get(runId) === true;
  }

  private setClosed(threadKey: string, runId: string, closed: boolean): void {
    let threadRuns = this.runs.get(threadKey);
    if (!threadRuns) {
      threadRuns = new Map();
      this.runs.set(threadKey, threadRuns);
    }
    threadRuns.set(runId, closed);
  }

  private rowsOf(threadKey: string): Row[] {
    return [...this.rows.values()].filter(row => row.threadKey === threadKey).sort((a, b) => a.seq - b.seq);
  }
}
