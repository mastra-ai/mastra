import { Tool } from './tool';
import type { ToolToConvert } from './tool-builder/builder';
import type { VercelTool } from './types';

/**
 * Checks if a tool is a Vercel Tool (AI SDK tool)
 * @param tool - The tool to check
 * @returns True if the tool is a Vercel Tool, false otherwise
 */
export function isVercelTool(tool?: ToolToConvert): tool is VercelTool {
  // Checks if this tool is not an instance of Mastra's Tool class
  // AI SDK tools must have an execute function and either:
  // - 'parameters' (v4) or 'inputSchema' (v5/v6)
  // This prevents plain objects with inputSchema (like client tools) from being treated as VercelTools
  return !!(
    tool &&
    !(tool instanceof Tool) &&
    ('parameters' in tool || ('execute' in tool && typeof tool.execute === 'function' && 'inputSchema' in tool))
  );
}
