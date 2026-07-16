/**
 * GoalManager — persistent cross-turn goals, backed by the Agent's native goal
 * mechanism.
 *
 * The objective lives in the durable `threadState` `'goal'` slot (via
 * `agent.setObjective`/`getObjective`/`clearObjective`/`updateObjectiveOptions`)
 * and is judged in-loop by the core goal step. This manager is a thin adapter:
 * it keeps a synchronous in-memory view of the current objective for the TUI
 * (status line, modal, keyboard shortcuts) and delegates persistence to the
 * agent. There is no standalone judge agent and no between-turn re-invocation —
 * the core goal step drives continuation and surfaces progress via `goal` stream
 * chunks.
 */
import { randomUUID } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { AgentController, Session } from '@mastra/core/agent-controller';
import type { GoalObjectiveRecord } from '@mastra/core/storage';
import { loadSettings } from './onboarding/settings.js';

export interface GoalManagerState<TState extends Record<string, unknown> = Record<string, unknown>> {
  controller: AgentController<TState>;
  session: Session<TState>;
}

// =============================================================================
// Types
// =============================================================================

export type GoalStatus = 'active' | 'paused' | 'done';

/**
 * TUI-facing view of a goal. Derived from the durable {@link GoalObjectiveRecord}
 * plus the effective judge/max-runs settings, with display-only timer fields and
 * a stable `id` used to match plan-started goals.
 */
export interface GoalState {
  id: string;
  objective: string;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  startedAt: string;
  activeStartedAt?: string;
  activeDurationMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_MAX_TURNS = 50;
const THREAD_GOAL_KEY = 'goal';

// =============================================================================
// GoalManager
// =============================================================================

export class GoalManager {
  /** Synchronous in-memory view of the active objective record (source of truth is ThreadState). */
  private record: (GoalObjectiveRecord & { id: string }) | null = null;
  /** Display-only active-timer accounting (not persisted to the objective record). */
  private activeStartedAt: string | null = null;
  private activeDurationMs = 0;
  private persistGoalOnNextThreadCreate = false;

  // ---------------------------------------------------------------------------
  // Synchronous TUI surface
  // ---------------------------------------------------------------------------

  getGoal(): GoalState | null {
    if (!this.record) return null;
    const { judgeModelId, maxTurns } = this.effectiveSettings(this.record);
    return {
      id: this.record.id,
      objective: this.record.objective,
      status: this.record.status,
      turnsUsed: this.record.runsUsed,
      maxTurns,
      judgeModelId,
      startedAt: new Date(this.record.startedAt).toISOString(),
      activeStartedAt: this.activeStartedAt ?? undefined,
      activeDurationMs: this.activeDurationMs,
    };
  }

  isActive(): boolean {
    return this.record?.status === 'active';
  }

  persistOnNextThreadCreate(): void {
    this.persistGoalOnNextThreadCreate = true;
  }

  consumePersistOnNextThreadCreate(): boolean {
    if (!this.persistGoalOnNextThreadCreate) return false;
    this.persistGoalOnNextThreadCreate = false;
    return true;
  }

  startActiveTimer(): void {
    if (this.record?.status === 'active' && !this.activeStartedAt) {
      this.activeStartedAt = new Date().toISOString();
    }
  }

  stopActiveTimer(): void {
    if (!this.activeStartedAt) return;
    const startedMs = Date.parse(this.activeStartedAt);
    if (Number.isFinite(startedMs)) {
      this.activeDurationMs += Math.max(0, Date.now() - startedMs);
    }
    this.activeStartedAt = null;
  }

  /** Reset active-timer accounting to zero (e.g. for an untriggered plan goal). */
  resetActiveTimer(): void {
    this.activeStartedAt = null;
    this.activeDurationMs = 0;
  }

  // ---------------------------------------------------------------------------
  // Objective lifecycle (ThreadState-backed via the agent)
  // ---------------------------------------------------------------------------

  /**
   * Set a new objective. Persists to ThreadState via `agent.setObjective` and
   * updates the in-memory view. Only the provided settings are persisted into
   * the record; unset ones fall back to the agent's `goal` config at read time.
   */
  async setGoal(
    state: GoalManagerState,
    objective: string,
    judgeModelId: string,
    maxTurns: number = DEFAULT_MAX_TURNS,
  ): Promise<GoalState | null> {
    const threadId = state.session.thread.getId();
    const agent = this.getAgent(state);
    const now = Date.now();
    const id = randomUUID();

    if (agent && threadId) {
      const persisted = await agent.setObjective(objective, {
        id,
        threadId,
        resourceId: state.session.identity.getResourceId(),
        ...(judgeModelId ? { judgeModelId } : {}),
        maxRuns: maxTurns,
      });
      this.record = persisted
        ? { ...persisted, id: persisted.id ?? id }
        : this.localRecord(objective, judgeModelId, maxTurns, now, id);
    } else {
      this.record = this.localRecord(objective, judgeModelId, maxTurns, now, id);
    }

    this.activeStartedAt = new Date(now).toISOString();
    this.activeDurationMs = 0;
    return this.getGoal();
  }

  /**
   * Update the judge model / max-runs defaults. Persists into the active record
   * (so the override is remembered in thread state) when a goal is set.
   */
  async updateJudgeDefaults(
    state: GoalManagerState,
    judgeModelId: string,
    maxTurns: number,
  ): Promise<GoalState | null> {
    if (!this.record) return null;
    const threadId = state.session.thread.getId();
    const agent = this.getAgent(state);
    if (agent && threadId) {
      const updated = await agent.updateObjectiveOptions({
        threadId,
        ...(judgeModelId ? { judgeModelId } : {}),
        maxRuns: maxTurns,
      });
      if (updated) this.record = { ...updated, id: this.record.id };
    } else {
      this.record = {
        ...this.record,
        ...(judgeModelId ? { judgeModelId } : {}),
        maxRuns: maxTurns,
        updatedAt: Date.now(),
      };
    }
    return this.getGoal();
  }

  pause(reason?: string): GoalState | null {
    if (this.record && this.record.status === 'active') {
      this.stopActiveTimer();
      this.record = { ...this.record, status: 'paused', pausedReason: reason, updatedAt: Date.now() };
    }
    return this.getGoal();
  }

  resume(): GoalState | null {
    if (this.record && this.record.status === 'paused') {
      this.record = { ...this.record, status: 'active', pausedReason: undefined, updatedAt: Date.now() };
      this.startActiveTimer();
    }
    return this.getGoal();
  }

  markDone(): void {
    if (this.record) {
      this.stopActiveTimer();
      this.record = { ...this.record, status: 'done', updatedAt: Date.now() };
    }
  }

  clear(): void {
    this.record = null;
    this.activeStartedAt = null;
    this.activeDurationMs = 0;
    this.persistGoalOnNextThreadCreate = false;
  }

  /**
   * Sync the latest objective record from ThreadState into the in-memory view.
   * Called from the `goal` stream-chunk handler after each evaluation.
   */
  applyEvaluation(update: { runsUsed: number; status: GoalStatus }): GoalState | null {
    if (!this.record) return null;
    this.record = { ...this.record, runsUsed: update.runsUsed, status: update.status, updatedAt: Date.now() };
    if (update.status !== 'active') this.stopActiveTimer();
    return this.getGoal();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Persist the active objective to ThreadState via the agent. The objective
   * record is the source of truth; the legacy thread-metadata key is cleared so
   * stale state from older sessions does not resurface.
   */
  async saveToThread(state: GoalManagerState): Promise<void> {
    const threadId = state.session.thread.getId();
    const agent = this.getAgent(state);
    try {
      if (agent && threadId) {
        if (this.record) {
          // Push the current status/options into the existing record. If no
          // record is persisted yet (e.g. first save), create one.
          const updated = await agent.updateObjectiveOptions({
            threadId,
            status: this.record.status,
            ...(this.record.pausedReason ? { pausedReason: this.record.pausedReason } : {}),
            ...(this.record.judgeModelId ? { judgeModelId: this.record.judgeModelId } : {}),
            ...(this.record.maxRuns !== undefined ? { maxRuns: this.record.maxRuns } : {}),
          });
          if (!updated) {
            // No persisted record yet: create one. `setObjective` always writes
            // `status: 'active'`, so re-apply the in-memory status afterwards if
            // the local goal was already paused/done — otherwise the resumed
            // thread state would no longer match the in-memory state.
            const desiredStatus = this.record.status;
            await agent.setObjective(this.record.objective, {
              id: this.record.id,
              threadId,
              resourceId: state.session.identity.getResourceId(),
              ...(this.record.judgeModelId ? { judgeModelId: this.record.judgeModelId } : {}),
              ...(this.record.maxRuns !== undefined ? { maxRuns: this.record.maxRuns } : {}),
            });
            if (desiredStatus !== 'active') {
              await agent.updateObjectiveOptions({
                threadId,
                status: desiredStatus,
                ...(this.record.pausedReason ? { pausedReason: this.record.pausedReason } : {}),
              });
            }
          }
        } else {
          await agent.clearObjective({ threadId });
        }
      }
      // Clear any legacy thread-metadata goal so it can't shadow the record.
      await state.session.thread.setSetting({ key: THREAD_GOAL_KEY, value: undefined });
    } catch {
      // Persistence is not critical.
    }
  }

  /**
   * Load the objective from ThreadState (called on thread switch). Falls back to
   * the legacy thread-metadata goal for threads created before this migration.
   */
  async loadFromThread(state: GoalManagerState): Promise<void> {
    this.persistGoalOnNextThreadCreate = false;
    this.activeStartedAt = null;
    this.activeDurationMs = 0;

    const threadId = state.session.thread.getId();
    const agent = this.getAgent(state);
    if (agent && threadId) {
      try {
        const record = await agent.getObjective({ threadId });
        if (record) {
          this.record = { ...record, id: record.id ?? randomUUID() };
          return;
        }
      } catch {
        // fall through to legacy metadata
      }
    }
    this.record = null;
  }

  /**
   * Legacy entry point retained for thread-switch call sites that only have the
   * thread metadata available. Hydrates from a previously-persisted GoalState.
   */
  loadFromThreadMetadata(metadata: Record<string, unknown> | undefined): void {
    const saved = metadata?.[THREAD_GOAL_KEY] as Partial<GoalState> | undefined;
    this.persistGoalOnNextThreadCreate = false;
    this.activeStartedAt = null;
    this.activeDurationMs = 0;
    if (saved && saved.objective && saved.status) {
      this.record = {
        objective: saved.objective,
        status: saved.status,
        runsUsed: saved.turnsUsed ?? 0,
        maxRuns: saved.maxTurns ?? DEFAULT_MAX_TURNS,
        judgeModelId: saved.judgeModelId ?? '',
        startedAt: saved.startedAt ? Date.parse(saved.startedAt) || Date.now() : Date.now(),
        updatedAt: Date.now(),
        id: saved.id ?? randomUUID(),
      };
      this.activeDurationMs = saved.activeDurationMs ?? 0;
    } else {
      this.record = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getAgent(state: GoalManagerState): Agent | undefined {
    try {
      return state.controller.getCurrentAgent(state.session);
    } catch {
      return undefined;
    }
  }

  /** Resolve effective judge model + max runs (record value → settings default). */
  private effectiveSettings(record: GoalObjectiveRecord): { judgeModelId: string; maxTurns: number } {
    const settings = loadSettings();
    return {
      judgeModelId: record.judgeModelId ?? settings.models.goalJudgeModel ?? '',
      maxTurns: record.maxRuns ?? settings.models.goalMaxTurns ?? DEFAULT_MAX_TURNS,
    };
  }

  private localRecord(
    objective: string,
    judgeModelId: string,
    maxTurns: number,
    now: number,
    id: string,
  ): GoalObjectiveRecord & { id: string } {
    return {
      objective,
      status: 'active',
      runsUsed: 0,
      maxRuns: maxTurns,
      ...(judgeModelId ? { judgeModelId } : {}),
      startedAt: now,
      updatedAt: now,
      id,
    };
  }
}
