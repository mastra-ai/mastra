import type { ToolsInput } from '@mastra/core/agent';
import type { BatchOutput } from '@mastra/core/browser';
import { batchInputSchema, batchOutputSchema } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createBatchTool(getBrowser: () => Promise<BrowserManagerLike>, getTools: () => ToolsInput) {
  return createTool({
    id: 'browser_batch',
    description: 'Execute multiple browser commands in sequence. Use for efficiency when multiple actions are needed.',
    inputSchema: batchInputSchema,
    outputSchema: batchOutputSchema,
    execute: async ({ context: { commands, stopOnError = true } }): Promise<BatchOutput> => {
      const results: Array<{ tool: string; success: boolean; output?: unknown; error?: string }> = [];
      let executedCount = 0;

      const tools = getTools();

      for (const command of commands) {
        executedCount++;
        const toolName = `browser_${command.tool}`;
        const tool = tools[toolName];

        if (!tool) {
          const result = {
            tool: command.tool,
            success: false,
            error: `Unknown tool: ${command.tool}`,
          };
          results.push(result);

          if (stopOnError) {
            break;
          }
          continue;
        }

        try {
          // @ts-expect-error - tool.execute expects proper context
          const output = await tool.execute({ context: command.input });
          const success =
            typeof output === 'object' && output !== null && 'success' in output ? !!output.success : true;

          results.push({
            tool: command.tool,
            success,
            output,
          });

          if (!success && stopOnError) {
            break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({
            tool: command.tool,
            success: false,
            error: errorMessage,
          });

          if (stopOnError) {
            break;
          }
        }
      }

      const allSuccess = results.every(r => r.success);

      return {
        success: allSuccess,
        results,
        executedCount,
        totalCount: commands.length,
      };
    },
  });
}
