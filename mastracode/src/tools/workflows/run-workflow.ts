/**
 * Parent-mode tool: run a saved workflow with input data. Returns the run
 * result inline so the parent agent can summarise / chain it.
 */
import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runWorkflow } from '../../workflows/service.js';

export const runWorkflowTool = createTool({
  id: 'run-workflow',
  description:
    'Run a saved workflow by id with the provided input data. Returns the run result inline. Use when the user asks you to "run X", "execute X", or asks for the outcome of a saved workflow.',
  inputSchema: z.object({
    workflowId: z.string().describe('The id of the saved workflow to run.'),
    inputData: z.any().describe('The input object the workflow consumes. Must match the workflow inputSchema.'),
  }),
  outputSchema: z.object({
    status: z.string(),
    result: z.any().optional(),
    error: z.any().optional(),
  }),
  execute: async ({ workflowId, inputData }, { mastra, requestContext }) => {
    if (!mastra) throw new Error('run-workflow requires a Mastra context.');
    // Forward the caller's requestContext so agent steps can resolve
    // `controller` bindings (session, modelId, workspace) → getDynamicModel
    // and dynamic tools work inside the workflow's agent step.
    //
    // BUT: the workflow's agent step MUST NOT inherit the caller's chat thread
    // identity. If we forwarded the parent chat's MastraMemory verbatim, the
    // nested `code-agent` invocation would write the workflow prompt + response
    // into the parent chat thread's history and contend with the parent turn's
    // own memory-dependent processors (observational-memory, task-state, …).
    //
    // Give the workflow a fresh isolated thread id but keep the parent's
    // resource id — mirroring what the `/workflows run` slash command already
    // does. Reserved thread/resource-key context values take precedence over
    // the `MastraMemory` payload, so we scrub the MASTRA_THREAD_ID_KEY too.
    // Everything is restored in `finally` so the parent chat turn continues
    // with its original memory scope. Mirrors the sub-agent-as-tool save/restore
    // pattern in packages/core/src/agent/agent.ts:4470–5209.
    const savedMastraMemory = requestContext?.get('MastraMemory') as
      | { thread?: { id?: string }; resourceId?: string; memoryConfig?: unknown }
      | undefined;
    const savedThreadIdKey = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
    const savedResourceIdKey = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    if (requestContext) {
      const parentResourceId = savedMastraMemory?.resourceId ?? savedResourceIdKey ?? '';
      requestContext.set('MastraMemory', {
        thread: { id: randomUUID() },
        resourceId: parentResourceId,
        memoryConfig: undefined,
      });
      if (savedThreadIdKey !== undefined) {
        requestContext.delete(MASTRA_THREAD_ID_KEY);
      }
      // Leave MASTRA_RESOURCE_ID_KEY as-is (parent's resource) — the workflow
      // agent step needs a resource to satisfy task-state / observational-memory.
    }

    try {
      const result = await runWorkflow(mastra as unknown as Mastra, workflowId, inputData, requestContext);
      if (result.status === 'tripwire' && result.tripwire) {
        return {
          status: result.status,
          error: `Tripwire: ${result.tripwire.reason ?? 'unknown'} (processor: ${result.tripwire.processorId ?? 'unknown'})`,
        };
      }
      let errorText: string | undefined;
      if (result.error instanceof Error) {
        errorText = `${result.error.name}: ${result.error.message}`;
        const cause = (result.error as { cause?: unknown }).cause;
        if (cause) errorText += ` | cause: ${JSON.stringify(cause, Object.getOwnPropertyNames(cause)).slice(0, 500)}`;
        if (result.error.stack) errorText += `\nstack: ${result.error.stack.split('\n').slice(0, 6).join('\n')}`;
      } else if (result.error) {
        try {
          errorText = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
        } catch {
          errorText = String(result.error);
        }
      }
      // Dump full error to a scratch file so it's inspectable even if the TUI truncates the tool result.
      if (errorText) {
        try {
          const fs = await import('node:fs');
          fs.writeFileSync(
            '/tmp/mastracode-workflow-error.log',
            `[${new Date().toISOString()}] workflowId=${workflowId}\n${errorText}\n\nfull error object:\n${JSON.stringify(result.error, Object.getOwnPropertyNames(result.error ?? {}), 2)}\n\n`,
            { flag: 'a' },
          );
        } catch {
          // best effort
        }
      }
      return { status: result.status, result: result.result, error: errorText };
    } finally {
      if (requestContext) {
        if (savedMastraMemory !== undefined) {
          requestContext.set('MastraMemory', savedMastraMemory);
        } else {
          requestContext.delete('MastraMemory');
        }
        if (savedThreadIdKey !== undefined) {
          requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
        }
        if (savedResourceIdKey !== undefined) {
          requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
        }
      }
    }
  },
});
