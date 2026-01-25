/**
 * Dynamic Tool Search Module
 *
 * This module implements the "Tool Search" pattern for Mastra agents, enabling
 * dynamic discovery and loading of tools on demand. This dramatically reduces
 * context token usage when working with large numbers of tools.
 *
 * @example
 * ```typescript
 * import { createDynamicToolSet } from '@mastra/core/tools/dynamic';
 *
 * const { searchTool, loadTool, getLoadedTools } = createDynamicToolSet({
 *   tools: allMyTools,
 * });
 *
 * const agent = new Agent({
 *   name: 'my-agent',
 *   tools: { searchTool, loadTool },
 * });
 *
 * // Include loaded tools during generation
 * const result = await agent.generate(prompt, {
 *   threadId: 'conv-123',
 *   toolsets: {
 *     dynamic: await getLoadedTools({ threadId: 'conv-123' }),
 *   },
 * });
 * ```
 *
 * @module
 */

export { createDynamicToolSet } from './create-dynamic-toolset';
export { createToolRegistry } from './registry';
export { loadedToolsState, getLoadedToolNames, clearLoadedToolsCache } from './state';
export type {
  AnyTool,
  DynamicToolSet,
  DynamicToolSetConfig,
  ToolRegistry,
  ToolRegistryEntry,
  ToolSearchResult,
  LoadedToolsState,
} from './types';
