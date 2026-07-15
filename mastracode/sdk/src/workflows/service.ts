/**
 * Thin wrapper around `mastra.getStorage().getStore('workflowDefinitions')` and
 * `mastra.getWorkflow(id).createRun().stream(...)` so both the parent-mode
 * tools and the `/workflows` slash command go through one implementation.
 */
import type { Mastra } from '@mastra/core/mastra';

export interface StoredWorkflowRow {
  id: string;
  description?: string;
  status: 'active' | 'archived';
  inputSchema?: unknown;
  outputSchema?: unknown;
  graph?: unknown[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RunResult {
  status: string;
  result?: unknown;
  error?: unknown;
  steps?: Record<string, unknown>;
  tripwire?: { reason?: string; retry?: unknown; metadata?: unknown; processorId?: string };
}

export interface WorkflowRunEvent {
  type: string;
  payload?: Record<string, unknown> & { id?: string };
  [key: string]: unknown;
}

export type WorkflowRunEventCallback = (event: WorkflowRunEvent) => void;

interface WorkflowRunOutputLike {
  fullStream: ReadableStream<WorkflowRunEvent>;
  result: Promise<unknown>;
}

interface WorkflowDefinitionsStore {
  list: (args?: { status?: 'active' | 'archived' }) => Promise<{ definitions: StoredWorkflowRow[]; total: number }>;
  get: (id: string) => Promise<StoredWorkflowRow | null>;
  delete: (id: string) => Promise<void>;
}

async function workflowDefinitionsStore(mastra: Mastra): Promise<WorkflowDefinitionsStore> {
  const storage = mastra.getStorage();
  if (!storage) throw new Error('Storage is not configured on the Mastra instance.');
  // `getStore` is a generic domain accessor; workflowDefinitions is registered
  // by mastracode. The domain shape is validated at boot; cast the resolved
  // store to the interface we exercise.
  const store = (await (storage as unknown as { getStore: (name: string) => Promise<unknown> }).getStore(
    'workflowDefinitions',
  )) as WorkflowDefinitionsStore | undefined;
  if (!store) throw new Error('workflowDefinitions storage domain is not available.');
  return store;
}

export async function listWorkflows(mastra: Mastra): Promise<{ workflows: StoredWorkflowRow[]; total: number }> {
  const store = await workflowDefinitionsStore(mastra);
  const result = await store.list({ status: 'active' });
  return { workflows: result.definitions, total: result.total };
}

export async function getWorkflow(mastra: Mastra, id: string): Promise<StoredWorkflowRow | null> {
  const store = await workflowDefinitionsStore(mastra);
  return store.get(id);
}

export async function deleteWorkflow(mastra: Mastra, id: string): Promise<{ ok: true; id: string }> {
  const store = await workflowDefinitionsStore(mastra);
  await store.delete(id);
  // Also unregister the live in-process Workflow instance so a subsequent
  // save-workflow with the same id re-registers cleanly instead of getting
  // no-op'd by addWorkflow's first-write-wins guard.
  mastra.removeWorkflow(id);
  return { ok: true, id };
}

export async function runWorkflow(
  mastra: Mastra,
  workflowId: string,
  inputData: unknown,
  /**
   * Optional. When provided, passed through to `run.stream(...)` so agent steps
   * (like `code-agent`) that depend on session state — `getDynamicModel` reads
   * `controller.session.modelId` off it — can resolve correctly.
   *
   * Chat-driven `run-workflow` inherits its context from the parent code-agent
   * turn, so this is unused there. The `/workflows run` slash handler builds a
   * synthetic context from the current TUI session and passes it here.
   */
  requestContext?: unknown,
  /**
   * Optional. When provided, invoked for every `WorkflowStreamEvent` the run
   * emits — used by the `/workflows run` slash handler to render live per-step
   * progress in the TUI. Non-fatal: errors in the callback are swallowed so a
   * misbehaving consumer can't take the workflow down.
   */
  onEvent?: WorkflowRunEventCallback,
): Promise<RunResult> {
  // `getWorkflow` is generic over the statically-registered workflow map, but
  // stored workflows are registered dynamically at load time — the id is a
  // runtime value, not a compile-time key. `as never` widens the arg past the
  // generic constraint; the runtime lookup already validates.
  let wf: ReturnType<Mastra['getWorkflow']> | undefined;
  try {
    wf = mastra.getWorkflow(workflowId as never);
  } catch {
    wf = undefined;
  }
  if (!wf) throw new Error(`No workflow registered with id "${workflowId}". Was it built and saved?`);

  const run = await wf.createRun();
  const output = run.stream({
    inputData,
    requestContext: requestContext as Parameters<typeof run.stream>[0]['requestContext'],
  }) as unknown as WorkflowRunOutputLike;
  if (onEvent) {
    for await (const event of output.fullStream) {
      try {
        onEvent(event);
      } catch {
        // Never let a bad consumer break the run.
      }
    }
  }
  const result = (await output.result) as RunResult;
  return result;
}
