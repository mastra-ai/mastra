import type { Mastra } from '@mastra/core/mastra';
import type { ExecutionEngine, ExecutionGraph, SerializedStepFlowEntry } from '@mastra/core/workflows';

/**
 * The view of a workflow that steps actually need.
 *
 * `Workflow` keeps `executionGraph` and `serializedStepGraph` protected, so
 * `WorkflowSdkWorkflow` registers this facade — built inside the class body, where
 * those members are in scope — rather than the instance itself. Both fields are
 * getters so the entry keeps tracking the live workflow as `commit()` and
 * `__registerMastra()` mutate it.
 */
export interface RegisteredMastraWorkflow {
  readonly id: string;
  readonly executionGraph: ExecutionGraph;
  readonly serializedStepGraph: SerializedStepFlowEntry[];
  readonly mastra?: Mastra;
  /**
   * The workflow's (placeholder) execution engine. The dispatcher never routes
   * execution through it, but it carries `options.validateInputs` and is a
   * valid `engine` argument for core helpers like `runScorersForStep`.
   */
  readonly executionEngine: ExecutionEngine;
}

/**
 * Module-level registry of Workflow SDK-backed workflows, keyed by workflow id.
 *
 * The Workflow SDK compiler forbids a `"use step"` function from closing over
 * non-serializable values, so the step that runs a Mastra step cannot capture
 * the `Workflow` object. It receives a workflow id instead and looks the live
 * object up here.
 *
 * Registration happens as a side effect of `createWorkflow()` at module scope.
 * A consumer's `workflows/mastra.ts` imports their Mastra entrypoint for
 * exactly this reason: it guarantees the definitions have loaded in the flow
 * handler process before any step runs.
 *
 * The map hangs off `globalThis` under a versioned symbol rather than living in
 * a module closure. The Workflow SDK build inlines some modules into its bundles and
 * externalizes others, so this file can legitimately be evaluated more than
 * once in a single process; a plain module-level `Map` would then be populated
 * in one copy and read from another.
 */
const REGISTRY_KEY = Symbol.for('@mastra/workflow-sdk.registry.v1');

type RegistryHost = typeof globalThis & {
  [REGISTRY_KEY]?: Map<string, RegisteredMastraWorkflow>;
};

function getRegistry(): Map<string, RegisteredMastraWorkflow> {
  const host = globalThis as RegistryHost;
  const existing = host[REGISTRY_KEY];
  if (existing) {
    return existing;
  }
  const created = new Map<string, RegisteredMastraWorkflow>();
  host[REGISTRY_KEY] = created;
  return created;
}

/**
 * Records a workflow so steps can resolve it by id.
 *
 * Re-registering the same id overwrites the previous entry. That is deliberate:
 * during dev-server hot reloads the newest definition is the correct one.
 */
export function registerWorkflow(workflow: RegisteredMastraWorkflow): void {
  getRegistry().set(workflow.id, workflow);
}

export function getRegisteredWorkflow(workflowId: string): RegisteredMastraWorkflow | undefined {
  return getRegistry().get(workflowId);
}

/**
 * Resolves a workflow or throws with the most likely cause spelled out.
 *
 * A miss here almost always means the consumer's `workflows/*.ts` re-export
 * file is missing the side-effect import of their Mastra entrypoint, so the
 * definitions never loaded in the process running the step.
 */
export function requireRegisteredWorkflow(workflowId: string): RegisteredMastraWorkflow {
  const workflow = getRegisteredWorkflow(workflowId);
  if (!workflow) {
    const known = listRegisteredWorkflowIds();
    throw new Error(
      `Workflow "${workflowId}" is not registered with @mastra/workflow-sdk. ` +
        `Registered workflows: ${known.length ? known.join(', ') : '(none)'}. ` +
        `Make sure the file in your "workflows/" directory that re-exports ` +
        `"@mastra/workflow-sdk/workflows" also imports your Mastra entrypoint for its side effects, ` +
        `so createWorkflow() runs in the process that executes steps.`,
    );
  }
  return workflow;
}

export function listRegisteredWorkflowIds(): string[] {
  return [...getRegistry().keys()];
}

/** Test helper: drops every registration. */
export function clearWorkflowRegistry(): void {
  getRegistry().clear();
}
