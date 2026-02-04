import { MASTRA_URL, MASTRA_API_KEY, MASTRA_AGENT_ID, isConfigured } from '../config.js';
import { log, logError } from './logger.js';
import type {
  MemoryStatusResponse,
  MemoryConfigResponse,
  ObservationalMemoryResponse,
  ListThreadsResponse,
  ListMessagesResponse,
  SearchMemoryResponse,
  WorkingMemoryResponse,
  Thread,
} from '../types/index.js';

const TIMEOUT_MS = 30000;

/**
 * Build URL with query parameters
 */
function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(path, MASTRA_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

/**
 * Build request headers
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (MASTRA_API_KEY) {
    headers['Authorization'] = `Bearer ${MASTRA_API_KEY}`;
  }
  return headers;
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

/**
 * Make a fetch request with error handling
 */
async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await withTimeout(
      fetch(url, {
        ...options,
        headers: buildHeaders(),
      }),
      TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Client for Mastra Observational Memory API
 */
export class MastraClient {
  /**
   * Get memory status
   */
  async getMemoryStatus(resourceId: string, threadId?: string): Promise<MemoryStatusResponse | null> {
    if (!isConfigured()) {
      log('getMemoryStatus: not configured');
      return null;
    }

    log('getMemoryStatus: start', { resourceId, threadId });
    const url = buildUrl('/api/memory/status', {
      agentId: MASTRA_AGENT_ID,
      resourceId,
      threadId,
    });

    const result = await fetchWithErrorHandling<MemoryStatusResponse>(url);
    if (!result.success) {
      logError('getMemoryStatus failed', result.error);
      return null;
    }

    log('getMemoryStatus: success', { result: result.data.result });
    return result.data;
  }

  /**
   * Get memory configuration
   */
  async getMemoryConfig(): Promise<MemoryConfigResponse | null> {
    if (!isConfigured()) {
      log('getMemoryConfig: not configured');
      return null;
    }

    log('getMemoryConfig: start');
    const url = buildUrl('/api/memory/config', {
      agentId: MASTRA_AGENT_ID,
    });

    const result = await fetchWithErrorHandling<MemoryConfigResponse>(url);
    if (!result.success) {
      logError('getMemoryConfig failed', result.error);
      return null;
    }

    log('getMemoryConfig: success');
    return result.data;
  }

  /**
   * Get observational memory record
   */
  async getObservationalMemory(resourceId: string, threadId?: string): Promise<ObservationalMemoryResponse | null> {
    if (!isConfigured()) {
      log('getObservationalMemory: not configured');
      return null;
    }

    log('getObservationalMemory: start', { resourceId, threadId });
    const url = buildUrl('/api/memory/observational-memory', {
      agentId: MASTRA_AGENT_ID,
      resourceId,
      threadId,
    });

    const result = await fetchWithErrorHandling<ObservationalMemoryResponse>(url);
    if (!result.success) {
      logError('getObservationalMemory failed', result.error);
      return null;
    }

    log('getObservationalMemory: success', {
      hasRecord: !!result.data.record,
      historyLength: result.data.history?.length,
    });
    return result.data;
  }

  /**
   * List threads for a resource
   */
  async listThreads(
    resourceId: string,
    options?: { page?: number; perPage?: number },
  ): Promise<ListThreadsResponse | null> {
    if (!isConfigured()) {
      log('listThreads: not configured');
      return null;
    }

    log('listThreads: start', { resourceId, ...options });
    const url = buildUrl('/api/memory/threads', {
      agentId: MASTRA_AGENT_ID,
      resourceId,
      page: options?.page?.toString(),
      perPage: options?.perPage?.toString(),
    });

    const result = await fetchWithErrorHandling<ListThreadsResponse>(url);
    if (!result.success) {
      logError('listThreads failed', result.error);
      return null;
    }

    log('listThreads: success', { count: result.data.threads.length });
    return result.data;
  }

  /**
   * Get a thread by ID
   */
  async getThread(threadId: string, resourceId?: string): Promise<Thread | null> {
    if (!isConfigured()) {
      log('getThread: not configured');
      return null;
    }

    log('getThread: start', { threadId, resourceId });
    const url = buildUrl(`/api/memory/threads/${threadId}`, {
      agentId: MASTRA_AGENT_ID,
      resourceId,
    });

    const result = await fetchWithErrorHandling<Thread>(url);
    if (!result.success) {
      logError('getThread failed', result.error);
      return null;
    }

    log('getThread: success', { id: result.data.id });
    return result.data;
  }

  /**
   * List messages in a thread
   */
  async listMessages(
    threadId: string,
    resourceId?: string,
    options?: { page?: number; perPage?: number },
  ): Promise<ListMessagesResponse | null> {
    if (!isConfigured()) {
      log('listMessages: not configured');
      return null;
    }

    log('listMessages: start', { threadId, resourceId, ...options });
    const url = buildUrl(`/api/memory/threads/${threadId}/messages`, {
      agentId: MASTRA_AGENT_ID,
      resourceId,
      page: options?.page?.toString(),
      perPage: options?.perPage?.toString(),
    });

    const result = await fetchWithErrorHandling<ListMessagesResponse>(url);
    if (!result.success) {
      logError('listMessages failed', result.error);
      return null;
    }

    log('listMessages: success', { count: result.data.messages.length });
    return result.data;
  }

  /**
   * Get working memory for a thread
   */
  async getWorkingMemory(threadId: string, resourceId?: string): Promise<WorkingMemoryResponse | null> {
    if (!isConfigured()) {
      log('getWorkingMemory: not configured');
      return null;
    }

    log('getWorkingMemory: start', { threadId, resourceId });
    const url = buildUrl(`/api/memory/threads/${threadId}/working-memory`, {
      agentId: MASTRA_AGENT_ID,
      resourceId,
    });

    const result = await fetchWithErrorHandling<WorkingMemoryResponse>(url);
    if (!result.success) {
      logError('getWorkingMemory failed', result.error);
      return null;
    }

    log('getWorkingMemory: success', { source: result.data.source });
    return result.data;
  }

  /**
   * Search memory
   */
  async searchMemory(
    searchQuery: string,
    resourceId: string,
    threadId?: string,
    limit?: number,
  ): Promise<SearchMemoryResponse | null> {
    if (!isConfigured()) {
      log('searchMemory: not configured');
      return null;
    }

    log('searchMemory: start', { searchQuery, resourceId, threadId, limit });
    const url = buildUrl('/api/memory/search', {
      agentId: MASTRA_AGENT_ID,
      searchQuery,
      resourceId,
      threadId,
      limit: limit?.toString(),
    });

    const result = await fetchWithErrorHandling<SearchMemoryResponse>(url);
    if (!result.success) {
      logError('searchMemory failed', result.error);
      return null;
    }

    log('searchMemory: success', { count: result.data.count });
    return result.data;
  }

  /**
   * Create a new thread
   */
  async createThread(resourceId: string, title?: string, metadata?: Record<string, unknown>): Promise<Thread | null> {
    if (!isConfigured()) {
      log('createThread: not configured');
      return null;
    }

    log('createThread: start', { resourceId, title });
    const url = buildUrl('/api/memory/threads', {
      agentId: MASTRA_AGENT_ID,
    });

    const result = await fetchWithErrorHandling<Thread>(url, {
      method: 'POST',
      body: JSON.stringify({ resourceId, title, metadata }),
    });

    if (!result.success) {
      logError('createThread failed', result.error);
      return null;
    }

    log('createThread: success', { id: result.data.id });
    return result.data;
  }

  /**
   * Update working memory
   */
  async updateWorkingMemory(
    threadId: string,
    workingMemory: string,
    resourceId?: string,
  ): Promise<{ success: boolean }> {
    if (!isConfigured()) {
      log('updateWorkingMemory: not configured');
      return { success: false };
    }

    log('updateWorkingMemory: start', { threadId, resourceId });
    const url = buildUrl(`/api/memory/threads/${threadId}/working-memory`, {
      agentId: MASTRA_AGENT_ID,
    });

    const result = await fetchWithErrorHandling<{ success: boolean }>(url, {
      method: 'POST',
      body: JSON.stringify({ workingMemory, resourceId }),
    });

    if (!result.success) {
      logError('updateWorkingMemory failed', result.error);
      return { success: false };
    }

    log('updateWorkingMemory: success');
    return result.data;
  }
}

export const mastraClient = new MastraClient();
