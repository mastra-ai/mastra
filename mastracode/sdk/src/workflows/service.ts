/**
 * Thin wrapper around Mastra's dynamic workflow and run APIs so both the
 * parent-mode tools and the `/workflows` slash command go through one
 * implementation.
 */
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { WorkflowDefinitionsStorage } from '@mastra/core/storage';
import {
  DynamicWorkflowAccessDeniedError,
  type DynamicWorkflowAccessPolicy,
  resolveDynamicWorkflowAuthorId,
} from './access-policy.js';

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

export interface WorkflowServiceContext {
  requestContext?: RequestContext;
}

export interface CreateWorkflowServiceOptions {
  accessPolicy?: DynamicWorkflowAccessPolicy;
}

async function workflowDefinitionsStore(mastra: Mastra): Promise<WorkflowDefinitionsStorage> {
  const storage = mastra.getStorage();
  if (!storage) throw new Error('Storage is not configured on the Mastra instance.');
  const store = await storage.getStore('workflowDefinitions');
  if (!store) throw new Error('workflowDefinitions storage domain is not available.');
  return store;
}

async function assertDynamicWorkflowAccess(
  mastra: Mastra,
  id: string,
  authorId: string | undefined,
  scoped: boolean,
): Promise<StoredWorkflowRow> {
  const definition = await (await workflowDefinitionsStore(mastra)).get(id);
  if (!definition || (scoped && (!authorId || definition.authorId !== authorId))) {
    throw new DynamicWorkflowAccessDeniedError();
  }
  return definition;
}

export function createWorkflowService(options: CreateWorkflowServiceOptions = {}) {
  const { accessPolicy } = options;

  async function resolveAuthorId(context?: WorkflowServiceContext): Promise<string | undefined> {
    return resolveDynamicWorkflowAuthorId(accessPolicy, context?.requestContext);
  }

  return {
    async listWorkflows(
      mastra: Mastra,
      context?: WorkflowServiceContext,
    ): Promise<{ workflows: StoredWorkflowRow[]; total: number }> {
      const authorId = await resolveAuthorId(context);
      if (accessPolicy && !authorId) return { workflows: [], total: 0 };
      const result = await (
        await workflowDefinitionsStore(mastra)
      ).list({
        status: 'active',
        ...(authorId !== undefined ? { authorId } : {}),
      });
      return { workflows: result.definitions, total: result.total };
    },

    async getWorkflow(mastra: Mastra, id: string, context?: WorkflowServiceContext): Promise<StoredWorkflowRow | null> {
      const authorId = await resolveAuthorId(context);
      if (accessPolicy && !authorId) return null;
      const definition = await (await workflowDefinitionsStore(mastra)).get(id);
      if (!definition || (authorId !== undefined && definition.authorId !== authorId)) return null;
      return definition;
    },

    async listAccessibleRegisteredWorkflows(mastra: Mastra, context?: WorkflowServiceContext) {
      const authorId = await resolveAuthorId(context);
      if (!accessPolicy) return mastra.listWorkflows?.() ?? {};

      const result = authorId
        ? await (await workflowDefinitionsStore(mastra)).list({ status: 'active', authorId })
        : { definitions: [] };
      const accessibleDynamicIds = new Set(result.definitions.map(definition => definition.id));
      return Object.fromEntries(
        Object.entries(mastra.listWorkflows?.() ?? {}).filter(([, workflow]) => {
          const workflowId = (workflow as { id: string }).id;
          return mastra.getWorkflowOrigin(workflowId) !== 'dynamic' || accessibleDynamicIds.has(workflowId);
        }),
      );
    },

    async deleteWorkflow(
      mastra: Mastra,
      id: string,
      context?: WorkflowServiceContext,
    ): Promise<{ ok: true; id: string }> {
      const authorId = await resolveAuthorId(context);
      if (accessPolicy && !authorId) return { ok: true, id };
      await mastra.deleteDynamicWorkflow(id, authorId !== undefined ? { authorId } : undefined);
      return { ok: true, id };
    },

    async runWorkflow(
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
      requestContext?: RequestContext,
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
      let lookupError: unknown;
      try {
        wf = mastra.getWorkflow(workflowId as never);
      } catch (error) {
        lookupError = error;
      }
      if (!wf) {
        if (accessPolicy) throw new DynamicWorkflowAccessDeniedError();
        throw new Error(`No workflow registered with id "${workflowId}". Was it built and saved?`, {
          cause: lookupError,
        });
      }

      if (mastra.getWorkflowOrigin?.(wf.id) === 'dynamic') {
        const authorId = await resolveAuthorId({ requestContext });
        await assertDynamicWorkflowAccess(mastra, wf.id, authorId, Boolean(accessPolicy));
      }

      const run = await wf.createRun();
      if (!onEvent) {
        return (await run.start({ inputData, requestContext })) as RunResult;
      }

      const output = run.stream({ inputData, requestContext }) as unknown as WorkflowRunOutputLike;
      for await (const event of output.fullStream) {
        try {
          onEvent(event);
        } catch {
          // Never let a bad consumer break the run.
        }
      }
      return (await output.result) as RunResult;
    },
  };
}

const defaultWorkflowService = createWorkflowService();

export const listWorkflows = defaultWorkflowService.listWorkflows;
export const getWorkflow = defaultWorkflowService.getWorkflow;
export const listAccessibleRegisteredWorkflows = defaultWorkflowService.listAccessibleRegisteredWorkflows;
export const deleteWorkflow = defaultWorkflowService.deleteWorkflow;
export const runWorkflow = defaultWorkflowService.runWorkflow;
