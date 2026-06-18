import type { MastraMemory } from '../memory/memory';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { SessionIdentity, SessionMode, SessionModel, SessionState, SessionThread } from './session';
import type { HarnessEvent, HarnessThread } from './types';

export interface SessionThreadHostRuntime {
  getMemoryStorage: () => Promise<MemoryStorage>;
  resolveMemory: () => Promise<MastraMemory>;
  emit: (event: HarnessEvent) => void;
  generateId: () => string;
  abort: () => void;
  cleanupAgentThreadSubscription: () => void;
  ensureCurrentAgentThreadSubscription: () => Promise<void>;
  loadThreadMetadata: () => Promise<void>;
  threadLock?: {
    acquire: (threadId: string) => void | Promise<void>;
    release: (threadId: string) => void | Promise<void>;
  };
  hasStorage: () => boolean;
  getProjectPath: () => string | undefined;
}

export interface SessionThreadHostOptions<TState> {
  identity: SessionIdentity;
  thread: SessionThread;
  mode: SessionMode;
  model: SessionModel;
  state: SessionState<TState>;
  resetTokenUsage: () => void;
}

/**
 * Owns session-scoped thread lifecycle transitions.
 *
 * The Session owns which thread it is bound to and how lifecycle transitions
 * mutate that binding. The Harness connects shared infrastructure (storage,
 * memory, locks, event bus, metadata hydration, and agent stream rebinding)
 * through {@link connect}.
 */
export class SessionThreadHost<TState = unknown> {
  readonly #identity: SessionIdentity;
  readonly #thread: SessionThread;
  readonly #mode: SessionMode;
  readonly #model: SessionModel;
  readonly #state: SessionState<TState>;
  readonly #resetTokenUsage: () => void;
  #runtime: SessionThreadHostRuntime | undefined;

  constructor({ identity, thread, mode, model, state, resetTokenUsage }: SessionThreadHostOptions<TState>) {
    this.#identity = identity;
    this.#thread = thread;
    this.#mode = mode;
    this.#model = model;
    this.#state = state;
    this.#resetTokenUsage = resetTokenUsage;
  }

  connect(runtime: SessionThreadHostRuntime): void {
    this.#runtime = runtime;
  }

  async selectOrCreateThread(): Promise<HarnessThread> {
    const runtime = this.#requireRuntime();
    const threads = await this.#thread.list();

    if (threads.length === 0) {
      return await this.createThread();
    }

    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const mostRecent = sortedThreads[0]!;
    await runtime.threadLock?.acquire(mostRecent.id);
    this.#thread.set({ threadId: mostRecent.id });
    await runtime.loadThreadMetadata();
    await runtime.ensureCurrentAgentThreadSubscription();

    return mostRecent;
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const runtime = this.#requireRuntime();
    runtime.cleanupAgentThreadSubscription();
    const now = new Date();
    const thread: HarnessThread = {
      id: runtime.generateId(),
      resourceId: this.#identity.getResourceId(),
      title: title || '',
      createdAt: now,
      updatedAt: now,
    };

    const currentStateModel = this.#model.get();
    const currentMode = this.#mode.resolve();
    const modelId = currentStateModel || currentMode.defaultModelId;

    const metadata: Record<string, unknown> = {};
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${this.#mode.get()}`] = modelId;
    }

    // Auto-tag with projectPath from state so threads are scoped to the working directory.
    const projectPath = runtime.getProjectPath() ?? (this.#state.get() as { projectPath?: string }).projectPath;
    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    // Acquire lock on new thread before releasing old one.
    // If acquire fails, attempt to re-acquire the old lock before rethrowing.
    const oldThreadId = this.#thread.getId();
    if (runtime.threadLock) {
      try {
        await runtime.threadLock.acquire(thread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            await runtime.threadLock.acquire(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        await runtime.threadLock.release(oldThreadId);
      }
    }

    if (runtime.hasStorage()) {
      const memoryStorage = await runtime.getMemoryStorage();
      try {
        await memoryStorage.saveThread({
          thread: {
            id: thread.id,
            resourceId: thread.resourceId,
            title: thread.title!,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        });
      } catch (err) {
        // saveThread failed after lock was swapped; restore previous lock state
        let reacquired = false;
        if (runtime.threadLock) {
          try {
            await runtime.threadLock.release(thread.id);
          } catch {
            // Best-effort release of new thread lock
          }
          if (oldThreadId) {
            try {
              await runtime.threadLock.acquire(oldThreadId);
              reacquired = true;
            } catch {
              // Re-acquire failed; no lock is held
            }
          }
        }
        if (reacquired && oldThreadId) {
          this.#thread.set({ threadId: oldThreadId });
        } else {
          this.#thread.clear();
        }
        throw err;
      }
    }

    this.#thread.set({ threadId: thread.id });

    if (modelId && !currentStateModel) {
      this.#model.set({ modelId });
    }

    this.#resetTokenUsage();
    runtime.emit({ type: 'thread_created', thread });
    await runtime.ensureCurrentAgentThreadSubscription();

    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const runtime = this.#requireRuntime();
    if (!runtime.hasStorage()) return;

    const memoryStorage = await runtime.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const isDeletingCurrentThread = this.#thread.getId() === threadId;

    await memoryStorage.deleteThread({ threadId });

    if (isDeletingCurrentThread) {
      try {
        await runtime.threadLock?.release(threadId);
      } catch {
        // Lock release failed; proceed with state cleanup regardless
      }
      runtime.cleanupAgentThreadSubscription();
      this.#thread.clear();
      this.#resetTokenUsage();
    }

    runtime.emit({ type: 'thread_deleted', threadId });
  }

  async cloneThread({
    sourceThreadId,
    title,
    resourceId,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<HarnessThread> {
    const runtime = this.#requireRuntime();
    const sourceId = sourceThreadId ?? this.#thread.getId();
    if (!sourceId) {
      throw new Error('No source thread to clone');
    }

    const memory = await runtime.resolveMemory();

    const result = await memory.cloneThread({
      sourceThreadId: sourceId,
      resourceId: resourceId ?? this.#identity.getResourceId(),
      title,
    });

    const clonedThread: HarnessThread = {
      id: result.thread.id,
      resourceId: result.thread.resourceId,
      title: result.thread.title ?? 'Cloned Thread',
      createdAt: result.thread.createdAt,
      updatedAt: result.thread.updatedAt,
      metadata: result.thread.metadata,
    };

    // Acquire lock on new thread before releasing old one
    const oldThreadId = this.#thread.getId();
    if (runtime.threadLock) {
      try {
        await runtime.threadLock.acquire(clonedThread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            await runtime.threadLock.acquire(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        await runtime.threadLock.release(oldThreadId);
      }
    }

    runtime.cleanupAgentThreadSubscription();
    this.#thread.set({ threadId: clonedThread.id });
    await runtime.loadThreadMetadata();
    this.#resetTokenUsage();
    runtime.emit({ type: 'thread_created', thread: clonedThread });
    await runtime.ensureCurrentAgentThreadSubscription();

    return clonedThread;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const runtime = this.#requireRuntime();
    runtime.abort();
    runtime.cleanupAgentThreadSubscription();

    // Acquire lock on new thread before releasing old one.
    // Lock operations must be adjacent (no intermediate awaits) so callers
    // can rely on a single microtask tick to observe both acquire and release.
    await runtime.threadLock?.acquire(threadId);
    const previousThreadId = this.#thread.getId();
    if (previousThreadId) {
      await runtime.threadLock?.release(previousThreadId);
    }

    if (runtime.hasStorage()) {
      const memoryStorage = await runtime.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }
    }

    this.#thread.set({ threadId });

    await runtime.loadThreadMetadata();

    runtime.emit({ type: 'thread_changed', threadId, previousThreadId });
    await runtime.ensureCurrentAgentThreadSubscription();
  }

  #requireRuntime(): SessionThreadHostRuntime {
    if (!this.#runtime) {
      throw new Error('SessionThreadHost is not connected');
    }
    return this.#runtime;
  }
}
