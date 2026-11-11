import type { Mastra } from '../../mastra';
import { resolveSingleProviderTool } from '../../tool-provider';
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

  return executeToolWithStepContext(tool, entry.options, ctx);
}
