import { Tool } from './tool';
import type { ToolToConvert } from './tool-builder/builder';
import type { VercelTool } from './types';

/**
 * Checks if a tool is a Vercel Tool
 * @param tool - The tool to check
 * @returns True if the tool is a Vercel Tool, false otherwise
 */
export function isVercelTool(tool?: ToolToConvert): tool is VercelTool {
  // Checks if this tool is not an instance of Tool
  return !!(tool && !(tool instanceof Tool) && 'parameters' in tool);
}
