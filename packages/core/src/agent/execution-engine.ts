import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ExtendedRunRegistry } from './durable/run-registry';
import type { AgentStreamBus } from './streams/bus';
import type { AgentRunRecord } from './streams/run-records';

/** The resource and thread a run belongs to, which the server authorizes callers against. */
export interface AgentRunOwner {
  resourceId?: string;
  threadId?: string;
}

/**
 * Where an agent's run frames and run records live: its stream bus (undefined when streams are
 * off) and whether its runs publish on Mastra's shared log.
 */
export interface AgentRunLog {
  bus: AgentStreamBus | undefined;
  usesSharedRunLog: boolean;
}

/**
 * How an agent runs: in-process without checkpoints (plain), or on a durable workflow
 * engine (default or evented). Engines are hostless: they take explicit inputs and return
 * outcomes, and never hold or call back into the Agent.
 *
 * This module only has type imports, so it always finishes loading before an engine extends it.
 */
export abstract class AgentExecutionEngine {
  constructor(
    protected readonly id: string,
    protected mastra?: Mastra,
  ) {}

  registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  /** Whether runs execute on a checkpointed workflow engine. */
  abstract get durable(): boolean;

  /** Whether run frames are published by workers on Mastra's shared log. Only asked once registered. */
  abstract usesSharedRunLog(logger: IMastraLogger): boolean;

  /**
   * Whether a run's executor can live in another process than the stream that started it. A
   * thread abort then also asks the executor to stop, and looks up the thread's lease owner when
   * no run here answered.
   */
  abstract get abortsRemoteExecutors(): boolean;

  /** Abort the controller this process holds for a run it executes. Returns whether it holds one. */
  abstract abortLocalExecution(runId: string, registry: ExtendedRunRegistry, mastra: Mastra | undefined): boolean;

  /** Whether aborting a run's local controller confirms that its executor stopped. */
  abstract confirmsLocalAbort(logger: IMastraLogger): boolean;

  /** Owner of a run this process tracks, or undefined. */
  abstract getRunOwner(runId: string, registry: ExtendedRunRegistry): AgentRunOwner | undefined;

  /**
   * Owner of a run whose replay history is still retained, given the owner this process tracks
   * for it. Undefined when the engine keeps no replay history. Rejects when the shared record
   * cannot be read.
   */
  abstract getReplayOwner(
    agentId: string,
    runId: string,
    localOwner: AgentRunOwner | undefined,
    runLog: AgentRunLog,
  ): Promise<AgentRunOwner | undefined>;

  /** The shared ownership record of a run. Rejects when the record cache cannot be read. */
  abstract getRunRecord(agentId: string, runId: string, runLog: AgentRunLog): Promise<AgentRunRecord | undefined>;
}
