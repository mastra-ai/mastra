import type { ToolSet } from '@internal/ai-sdk-v5';
import type { CoreTool } from './types';

type ResolvedTool = ToolSet[string] | CoreTool | undefined;

export function getToolTitle(tool: ResolvedTool): string | undefined {
  if (!tool || !('title' in tool) || typeof tool.title !== 'string') {
    return undefined;
  }
  return tool.title || undefined;
}

export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

export function getMcpAppPointer(tool: ResolvedTool): Record<string, unknown> | undefined {
  const ui = (tool as { mcp?: { _meta?: { ui?: unknown } } } | undefined)?.mcp?._meta?.ui;
  if (!ui || typeof ui !== 'object' || typeof (ui as { resourceUri?: unknown }).resourceUri !== 'string') {
    return undefined;
  }
  return { ...(ui as Record<string, unknown>), mimeType: MCP_APP_MIME_TYPE };
}

export function withToolTitle<T extends { type: string; payload?: any }>(chunk: T, tool: ResolvedTool): T {
  const toolChunk = chunk.type === 'tool-call' || chunk.type === 'tool-call-input-streaming-start';
  if (!toolChunk) return chunk;
  const title = chunk.payload?.title ?? getToolTitle(tool);
  const app = getMcpAppPointer(tool);
  if (!title && !app) return chunk;
  return {
    ...chunk,
    payload: {
      ...chunk.payload,
      ...(title ? { title } : {}),
      ...(app ? { toolMetadata: { ...chunk.payload?.toolMetadata, app } } : {}),
    },
  };
}
