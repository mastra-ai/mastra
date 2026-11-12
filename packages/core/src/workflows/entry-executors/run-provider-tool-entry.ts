import type { Mastra } from '../../mastra';
import { resolveSingleProviderTool } from '../../tool-provider';
import { isMastraTool } from '../../tools/toolchecks';
import { getValidationIssuePaths, validateToolInput, validateToolOutput } from '../../tools/validation';
import type { ProviderToolEntry } from '../types';
import { executeToolWithStepContext } from './run-tool-entry';
import type { EntryExecuteContext } from './types';

export async function runProviderToolEntry(
  entry: ProviderToolEntry,
  ctx: EntryExecuteContext,
  mastra?: Mastra,
): Promise<unknown> {
  const registry = mastra ?? (ctx.mastra as Mastra | undefined);
  const editor = registry?.getEditor();
  if (!editor) {
    throw new Error(
      `Provider tool '${entry.providerId}/${entry.toolSlug}' cannot run without a MastraEditor instance.`,
    );
  }

  const provider = editor.getToolProviderOrThrow(entry.providerId);
  const tool = await resolveSingleProviderTool({
    provider,
    providerId: entry.providerId,
    toolSlug: entry.toolSlug,
    connection: entry.connection,
    authorId: entry.ownerId,
    requestContext: ctx.requestContext,
    logger: registry?.getLogger(),
  });

  const isPlainToolAction = !isMastraTool(tool);
  let toolInput = ctx.inputData;
  if (ctx.validateInputs !== false && isPlainToolAction && tool.inputSchema && '~standard' in tool.inputSchema) {
    const validation = validateToolInput(tool.inputSchema, toolInput, entry.toolSlug);
    if (validation.error) {
      throw new Error(validation.error.message);
    }
    toolInput = validation.data;
  }

  let suspended = false;
  const output = await executeToolWithStepContext(tool, entry.options, {
    ...ctx,
    inputData: toolInput,
    suspend: async (...args: Parameters<typeof ctx.suspend>) => {
      suspended = true;
      return ctx.suspend(...args);
    },
  });
  if (!suspended && isPlainToolAction && tool.outputSchema && '~standard' in tool.outputSchema) {
    const validation = validateToolOutput(tool.outputSchema, output, entry.toolSlug);
    if (validation.error) {
      registry?.getLogger()?.warn('Tool output validation failed', {
        toolId: entry.toolSlug,
        issuePaths: getValidationIssuePaths(validation.error, tool.outputSchema, 'output'),
      });
      if (tool.outputValidation === 'warn') {
        return output;
      }
      throw new Error(validation.error.message);
    }
    return validation.data;
  }

  return output;
}
