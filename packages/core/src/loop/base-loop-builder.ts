import type { createEventedWorkflow, createWorkflow } from '../workflows/create';
import type { Step } from '../workflows/step';
import type { Workflow } from '../workflows/workflow';
import type { LoopRuntime } from './loop-runtime';
import type { EagerToolExecutionCoordinator } from './workflows/agentic-execution/eager-tool-execution';
import type { ToolCallForeachOptions } from './workflows/agentic-execution/tool-call-concurrency';

/**
 * Predicate evaluated by the outer dowhile after every iteration. Receives the
 * engine's dowhile callback params; typed loosely because the two engines
 * consume different subsets of it (the main loop only reads `inputData`, the
 * durable loop also reads `getInitData`/`mastra`/the pubsub symbol).
 */
export type LoopContinuationPredicate = (params: any) => Promise<boolean>;

/**
 * Engine-agnostic handle for a loop step. The two engines build steps with
 * different ids and schemas (state flows through workflow context on the main
 * loop vs. serialized iteration state on the durable loop), so the overridable
 * factory surface is typed loosely; each engine's composition works with its
 * own concrete step types internally.
 */
export type LoopStep = Step<string, any, any, any, any, any, any, any>;

/** Engine-agnostic handle for a composed loop workflow (see {@link LoopStep}). */
export type LoopWorkflow = Workflow<any, any, any, any, any, any, any, any>;

/**
 * The agentic loop's shape: an outer `dowhile` workflow wrapping a
 * single-iteration workflow (LLM execution → tool calls → mapping → background
 * check → signal drain → isTaskComplete → goal). `AgenticLoopBuilder` (main
 * loop) and `DurableAgenticLoopBuilder` (durable loop) both implement it.
 *
 * This module must only use type imports. The durable builder extends this
 * class while its own module loads, and the main loop builder's imports lead
 * back to `Agent` (processors and evals construct agents), so extending the
 * main loop builder instead would make the durable engine's load order
 * depend on which module happened to load first.
 */
export abstract class BaseAgenticLoopBuilder {
  /** Which workflow engine the loop is composed on. */
  protected abstract workflowFactory(): typeof createWorkflow | typeof createEventedWorkflow;

  /** Resolve the live, non-serializable view of the run (see {@link LoopRuntime}). */
  protected abstract resolveRuntime(predicateParams: unknown): LoopRuntime;

  /** Deliver a chunk to the run's client-facing stream. */
  protected abstract emitChunk(runtime: LoopRuntime, chunk: unknown): void | Promise<void>;

  protected abstract llmExecutionStep(
    toolCallForeachOptions: ToolCallForeachOptions,
    eager?: { coordinator: EagerToolExecutionCoordinator; toolCallStep: LoopStep },
  ): LoopStep;

  protected abstract toolCallStep(): LoopStep;

  protected abstract llmMappingStep(llmExecutionStep: LoopStep): LoopStep;

  protected abstract backgroundTaskCheckStep(): LoopStep;

  protected abstract signalDrainStep(): LoopStep;

  protected abstract isTaskCompleteStep(): LoopStep;

  protected abstract goalStep(): LoopStep;

  /** The dowhile predicate deciding after each iteration whether the loop continues. */
  protected abstract buildContinuationPredicate(): LoopContinuationPredicate;

  /** The single-iteration workflow. */
  abstract buildIterationWorkflow(): LoopWorkflow;

  /** The outer loop workflow: dowhile(iteration workflow, continuation predicate). */
  abstract build(): LoopWorkflow;
}
