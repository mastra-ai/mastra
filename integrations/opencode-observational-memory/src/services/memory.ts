import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG } from '../config.js';
import { log, logError } from './logger.js';

// Dynamic imports to avoid type issues during development
// These will be resolved at runtime when the package is installed
let Memory: any;
let LibSQLStore: any;

async function loadDependencies() {
  if (!Memory) {
    // @ts-ignore - Types available at runtime when package is installed
    const memoryModule = await import('@mastra/memory');
    Memory = memoryModule.Memory;
  }
  if (!LibSQLStore) {
    // @ts-ignore - Types available at runtime when package is installed
    const libsqlModule = await import('@mastra/libsql');
    LibSQLStore = libsqlModule.LibSQLStore;
  }
}

let memoryInstance: any = null;
let initializationPromise: Promise<any> | null = null;

/**
 * Get or create the Memory instance with Observational Memory enabled.
 * Uses LibSQL for local SQLite storage.
 */
export async function getMemory(): Promise<any> {
  if (memoryInstance) {
    return memoryInstance;
  }

  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = initializeMemory();
  memoryInstance = await initializationPromise;
  initializationPromise = null;

  return memoryInstance;
}

async function initializeMemory(): Promise<any> {
  log('Initializing Memory with Observational Memory', {
    dbPath: CONFIG.dbPath,
    model: CONFIG.model,
    scope: CONFIG.scope,
  });

  // Ensure database directory exists
  const dbDir = dirname(CONFIG.dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  try {
    // Load dependencies dynamically
    await loadDependencies();

    // Create LibSQL storage for local SQLite database
    const storage = new LibSQLStore({
      url: `file:${CONFIG.dbPath}`,
    });

    // Create Memory instance with Observational Memory enabled
    const memory = new Memory({
      storage,
      options: {
        // Enable observational memory with configuration
        observationalMemory: {
          enabled: true,
          scope: CONFIG.scope,
          model: CONFIG.model,
          observation: {
            model: CONFIG.observerModel || CONFIG.model,
            messageTokens: CONFIG.messageTokenThreshold,
          },
          reflection: {
            model: CONFIG.reflectorModel || CONFIG.model,
            observationTokens: CONFIG.observationTokenThreshold,
          },
        },
      },
    });

    log('Memory initialized successfully');
    return memory;
  } catch (error) {
    logError('Failed to initialize Memory', error);
    throw error;
  }
}

/**
 * Get observations for a resource/thread
 */
export async function getObservations(
  resourceId: string,
  threadId?: string,
): Promise<string | null> {
  try {
    const memory = await getMemory();
    const memoryStore = await memory.storage.getStore('memory');
    if (!memoryStore) {
      return null;
    }

    const record = await memoryStore.getObservationalMemory(
      CONFIG.scope === 'resource' ? null : (threadId ?? null),
      resourceId,
    );

    if (!record) {
      return null;
    }

    return record.activeObservations || null;
  } catch (error) {
    logError('Failed to get observations', error);
    return null;
  }
}

/**
 * Get working memory for a thread
 */
export async function getWorkingMemory(
  threadId: string,
  resourceId: string,
): Promise<string | null> {
  try {
    const memory = await getMemory();
    return memory.getWorkingMemory({ threadId, resourceId });
  } catch (error) {
    logError('Failed to get working memory', error);
    return null;
  }
}

/**
 * Create or get a thread for a session
 */
export async function ensureThread(
  sessionId: string,
  resourceId: string,
): Promise<string> {
  try {
    const memory = await getMemory();
    const threadId = `opencode-${sessionId}`;

    // Check if thread exists
    const existing = await memory.getThreadById({ threadId });
    if (existing) {
      return threadId;
    }

    // Create new thread
    await memory.createThread({
      threadId,
      resourceId,
      title: `OpenCode Session ${sessionId}`,
    });

    log('Created new thread', { threadId, resourceId });
    return threadId;
  } catch (error) {
    logError('Failed to ensure thread', error);
    throw error;
  }
}

/**
 * Save messages to memory
 */
export async function saveMessages(
  messages: Array<{
    id: string;
    role: string;
    content: string;
    threadId: string;
    resourceId: string;
  }>,
): Promise<void> {
  try {
    const memory = await getMemory();

    const dbMessages = messages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: {
        type: 'text' as const,
        content: m.content,
      },
      threadId: m.threadId,
      resourceId: m.resourceId,
      createdAt: new Date(),
    }));

    await memory.saveMessages({ messages: dbMessages });
    log('Saved messages', { count: messages.length });
  } catch (error) {
    logError('Failed to save messages', error);
  }
}

/**
 * Get the memory storage for direct operations
 */
export async function getMemoryStore(): Promise<any> {
  const memory = await getMemory();
  return memory.storage.getStore('memory');
}
