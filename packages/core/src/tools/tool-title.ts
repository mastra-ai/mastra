import type { ToolSet } from '@internal/ai-sdk-v5';
import type { CoreTool } from './types';

type ResolvedTool = ToolSet[string] | CoreTool | undefined;

export function getToolTitle(tool: ResolvedTool): string | undefined {
  if (!tool || !('title' in tool) || typeof tool.title !== 'string') {
    return undefined;
  }
  return tool.title || undefined;
}

export function withToolTitle<T extends { type: string; payload?: any }>(chunk: T, tool: ResolvedTool): T {
  const toolChunk = chunk.type === 'tool-call' || chunk.type === 'tool-call-input-streaming-start';
  if (!toolChunk) return chunk;
  const title = chunk.payload?.title ?? getToolTitle(tool);
  return title ? { ...chunk, payload: { ...chunk.payload, title } } : chunk;
}
