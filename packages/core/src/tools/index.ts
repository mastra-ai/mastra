export * from './tool';
export * from './types';
export * from './ui-types';
export { isVercelTool } from './toolchecks';
export { ToolStream } from './stream';
export {
  // Primary API - Deferred loading pattern (like Anthropic's Tool Search Tool)
  DeferredToolset,
  type DeferredToolsetConfig,
  type AddToolOptions,
  // Shared types
  type ToolSearchResult,
  type ToolSearchOptions,
  // Legacy API (deprecated, use DeferredToolset instead)
  ToolSearchIndex,
  createToolSearchTool,
  createToolSearch,
  type ToolSearchIndexConfig,
  type CreateToolSearchToolConfig,
} from './tool-search';
