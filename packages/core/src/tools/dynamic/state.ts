import type { MastraMemory } from '../../memory';
import type { ToolExecutionContext } from '../types';

/**
 * Metadata key used to store loaded tools in thread metadata
 */
const LOADED_TOOLS_KEY = 'dynamicLoadedTools';

/**
 * In-memory fallback cache for when memory is not configured.
 * Keyed by threadId (or 'default' if no threadId).
 */
const loadedToolsCache = new Map<string, Set<string>>();

/**
 * Type guard to check if context is a ToolExecutionContext
 */
function isToolExecutionContext(
  context: ToolExecutionContext | { threadId?: string },
): context is ToolExecutionContext {
  return context !== null && typeof context === 'object' && ('mastra' in context || 'agent' in context);
}

/**
 * Get the cache key for a given context.
 * Uses threadId if available, otherwise falls back to 'default'.
 */
function getCacheKey(context: ToolExecutionContext | { threadId?: string }): string {
  if (isToolExecutionContext(context)) {
    return context.agent?.threadId || 'default';
  }
  return context.threadId || 'default';
}

/**
 * Try to get memory from the execution context.
 * Returns null if memory is not available or not configured.
 */
async function getMemoryFromContext(context: ToolExecutionContext): Promise<MastraMemory | null> {
  const mastra = context.mastra;
  if (!mastra) return null;

  // Try to get the first available memory instance
  try {
    // MastraUnion should have getMemory methods
    const memories = (mastra as any).memory;
    if (memories && typeof memories === 'object') {
      const memoryKeys = Object.keys(memories);
      const firstKey = memoryKeys[0];
      if (firstKey !== undefined) {
        return memories[firstKey] as MastraMemory;
      }
    }
  } catch {
    // Memory not available
  }

  return null;
}

/**
 * Load tool names from thread metadata (persistent storage).
 */
async function loadFromThreadMetadata(
  memory: MastraMemory,
  threadId: string,
): Promise<string[] | null> {
  try {
    const thread = await memory.getThreadById({ threadId });
    if (thread?.metadata?.[LOADED_TOOLS_KEY]) {
      return thread.metadata[LOADED_TOOLS_KEY] as string[];
    }
  } catch {
    // Thread might not exist yet
  }
  return null;
}

/**
 * Save tool names to thread metadata (persistent storage).
 */
async function saveToThreadMetadata(
  memory: MastraMemory,
  threadId: string,
  toolNames: string[],
): Promise<boolean> {
  try {
    const thread = await memory.getThreadById({ threadId });
    if (thread) {
      await memory.saveThread({
        thread: {
          ...thread,
          metadata: {
            ...thread.metadata,
            [LOADED_TOOLS_KEY]: toolNames,
          },
        },
      });
      return true;
    }
  } catch {
    // Failed to save
  }
  return false;
}

/**
 * Manages the state of loaded tools with a hybrid persistence approach.
 *
 * - If memory is configured and threadId is available: Uses thread metadata (persistent)
 * - Otherwise: Falls back to in-memory cache (process lifetime only)
 */
export class LoadedToolsStateManager {
  /**
   * Get the list of currently loaded tool names.
   */
  async getLoadedToolNames(context: ToolExecutionContext): Promise<string[]> {
    const cacheKey = getCacheKey(context);
    const threadId = context.agent?.threadId;

    // Try thread metadata first (persistent)
    if (threadId) {
      const memory = await getMemoryFromContext(context);
      if (memory) {
        const fromStorage = await loadFromThreadMetadata(memory, threadId);
        if (fromStorage !== null) {
          // Sync to cache
          loadedToolsCache.set(cacheKey, new Set(fromStorage));
          return fromStorage;
        }
      }
    }

    // Fall back to in-memory cache
    const cached = loadedToolsCache.get(cacheKey);
    return cached ? Array.from(cached) : [];
  }

  /**
   * Add a tool to the loaded set.
   */
  async addLoadedTool(context: ToolExecutionContext, toolName: string): Promise<void> {
    const cacheKey = getCacheKey(context);
    const threadId = context.agent?.threadId;

    // Update in-memory cache first (always)
    if (!loadedToolsCache.has(cacheKey)) {
      loadedToolsCache.set(cacheKey, new Set());
    }
    loadedToolsCache.get(cacheKey)!.add(toolName);

    // Try to persist to thread metadata
    if (threadId) {
      const memory = await getMemoryFromContext(context);
      if (memory) {
        const currentTools = await this.getLoadedToolNames(context);
        const updatedTools = [...new Set([...currentTools, toolName])];
        await saveToThreadMetadata(memory, threadId, updatedTools);
      }
    }
  }

  /**
   * Check if a tool is already loaded.
   */
  async isToolLoaded(context: ToolExecutionContext, toolName: string): Promise<boolean> {
    const loadedTools = await this.getLoadedToolNames(context);
    return loadedTools.includes(toolName);
  }

  /**
   * Clear all loaded tools for a context (useful for testing).
   */
  async clearLoadedTools(context: ToolExecutionContext): Promise<void> {
    const cacheKey = getCacheKey(context);
    loadedToolsCache.delete(cacheKey);

    const threadId = context.agent?.threadId;
    if (threadId) {
      const memory = await getMemoryFromContext(context);
      if (memory) {
        await saveToThreadMetadata(memory, threadId, []);
      }
    }
  }
}

/**
 * Singleton instance of the state manager.
 * Shared across all dynamic tool sets to maintain consistent state.
 */
export const loadedToolsState = new LoadedToolsStateManager();

/**
 * Get loaded tool names for a given context.
 * Simplified helper for external use.
 */
export async function getLoadedToolNames(
  context: ToolExecutionContext | { threadId?: string },
): Promise<string[]> {
  const cacheKey = getCacheKey(context);
  const cached = loadedToolsCache.get(cacheKey);
  return cached ? Array.from(cached) : [];
}

/**
 * Clear the in-memory cache (useful for testing).
 */
export function clearLoadedToolsCache(): void {
  loadedToolsCache.clear();
}
