/**
 * EventedAgent - A durable agent that uses fire-and-forget execution.
 *
 * EventedAgent extends DurableAgent and overrides the execution strategy to use
 * fire-and-forget execution: the workflow run is started without awaiting it.
 *
 * Unlike DurableAgent which runs the workflow synchronously, EventedAgent:
 * 1. Uses startAsync() for non-blocking execution
 * 2. Fire-and-forget pattern - execution starts and returns immediately
 * 3. Events are streamed via pubsub as the workflow executes
 */

import { createObservabilityContext } from '../../observability';
import type { ToolsInput } from '../types';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './durable-agent';
import { globalRunRegistry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Configuration for EventedAgent - wraps an existing Agent with fire-and-forget execution
 */
export interface EventedAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgentConfig<TAgentId, TTools, TOutput> {}

/**
 * EventedAgent extends DurableAgent to use fire-and-forget execution.
 *
 * This agent type uses the built-in evented workflow engine, which is useful when:
 * - You don't need an external execution engine (like Inngest)
 * - You want fire-and-forget execution with pubsub streaming
 * - You need resumable streams with event caching
 *
 * The key difference from DurableAgent is the execution strategy:
 * - DurableAgent: Runs the workflow synchronously via createRun + start
 * - EventedAgent: Starts the run without awaiting it (fire-and-forget)
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { EventedAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const eventedAgent = new EventedAgent({ agent });
 *
 * const { output, runId, cleanup } = await eventedAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */
export class EventedAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgent<TAgentId, TTools, TOutput> {
  /**
   * Create a new EventedAgent that wraps an existing Agent
   */
  constructor(config: EventedAgentConfig<TAgentId, TTools, TOutput>) {
    super(config);
  }

  /**
   * Execute the durable workflow using fire-and-forget pattern.
   *
   * Unlike DurableAgent which runs the workflow synchronously, EventedAgent starts
   * the run without awaiting it, then cleans up snapshots when the background
   * promise reaches a non-suspended terminal status.
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected override async executeWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    try {
      const workflow = this.getWorkflow();
      // Populate the run row's resourceId column so storage-level resource
      // filters (listSuspendedRuns / listActiveRuns) can narrow the query.
      const memoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const run = await workflow.createRun({
        runId,
        resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
        pubsub: this.pubsubInternal,
      });
      // Fire and forget - don't await the run, so stream() returns immediately.
      // Pass the caller's requestContext (so config selectors pick the same observability
      // instance the root spans were created with) and parent the run under the AGENT_RUN span.
      const entry = globalRunRegistry.get(runId);
      run
        .start({
          inputData: workflowInput,
          requestContext: entry?.requestContext,
          actor: workflowInput.options?.actor,
          ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
        })
        .then(async result => {
          // Reaching any non-suspended terminal status means the run is done and
          // its persisted snapshot rows will never be resumed. Delete them so
          // finished runs stop showing up in listActiveRuns() and being re-driven
          // by recoverActiveRuns() (#22209). Suspended runs keep their snapshots
          // so `resume()` / `recoverActiveRuns()` can find them. If the process
          // dies before this fires, the run is a genuine orphan and the recover
          // path performs the same cleanup once it reaches a terminal status.
          if (result?.status && result.status !== 'suspended') {
            await this.deleteRunSnapshots(runId);
          }
        })
        .catch(async error => {
          await this.emitError(runId, error instanceof Error ? error : new Error(String(error)));
        });
    } catch (error) {
      await this.emitError(runId, error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Check if an object is an EventedAgent class instance
 */
export function isEventedAgentClass(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}
