import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import type { ToolStepEntry } from '../types';
import { resolveEntryActor } from './actor';
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
    suspendData,
    runId,
    workflowId,
    setState,
    abortSignal,
    actor,
    writer,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  const toolContext = {
    mastra: ctxMastra,
    requestContext,
    actor: resolveEntryActor(entry.options as Record<string, unknown> | undefined, actor),
    ...observabilityContext,
    abortSignal,
    writer,
    resumeData,
    suspendPayload: suspendData,
    // `state` forwards to the step's, which throws on storage v2 runs and isn't enumerable there.
    workflow: Object.defineProperty(
      { runId, suspend, resumeData, suspendPayload: suspendData, workflowId, getState: ctx.getState, setState },
      'state',
      { enumerable: Object.prototype.propertyIsEnumerable.call(ctx, 'state'), get: () => ctx.state },
    ),
  };

  return tool.execute(inputData, toolContext);
}
