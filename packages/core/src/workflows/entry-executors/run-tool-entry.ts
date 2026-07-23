import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import type { ToolStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

/**
 * Runs a declarative `tool` entry: resolves the tool (inline handle, else the
 * Mastra registry) and executes it with the step context mapped into the tool
 * execution context.
 */
export async function runToolEntry(entry: ToolStepEntry, ctx: EntryExecuteContext, mastra?: Mastra): Promise<unknown> {
  const registry = mastra ?? (ctx?.mastra as Mastra | undefined);
  const tool = entry.tool ?? registry?.getTool(entry.toolId);
  if (!tool) {
    throw new Error(
      `Tool '${entry.toolId}' not found for workflow step '${entry.id}'. Pass the tool instance directly.`,
    );
  }

  const {
    inputData,
    mastra: ctxMastra,
    requestContext,
    suspend,
    resumeData,
    runId,
    workflowId,
    state,
    setState,
    abortSignal,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  const toolContext = {
    mastra: ctxMastra,
    requestContext,
    ...observabilityContext,
    abortSignal,
    resumeData,
    workflow: {
      runId,
      suspend,
      resumeData,
      workflowId,
      state,
      setState,
    },
  };

  return tool.execute(inputData, toolContext);
}
