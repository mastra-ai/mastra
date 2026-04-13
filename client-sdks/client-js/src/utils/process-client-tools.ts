import type { ToolsInput } from '@mastra/core/agent';
import { zodToJsonSchema } from './zod-to-json-schema';

export function processClientTools(clientTools: ToolsInput | undefined): ToolsInput | undefined {
  if (!clientTools) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(clientTools).map(([key, value]) => {
      const tool = value as any;
      return [
        key,
        {
          ...value,
          // Serialize parameters (Vercel v4 tool format)
          ...(tool.parameters !== undefined ? { parameters: zodToJsonSchema(tool.parameters) } : {}),
          // Serialize inputSchema (Mastra tool, ClientTool, or Vercel v5 tool format)
          ...(tool.inputSchema !== undefined ? { inputSchema: zodToJsonSchema(tool.inputSchema) } : {}),
          // Serialize outputSchema
          ...(tool.outputSchema !== undefined ? { outputSchema: zodToJsonSchema(tool.outputSchema) } : {}),
        },
      ];
    }),
  );
}
