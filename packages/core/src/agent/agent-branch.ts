import { randomUUID } from 'crypto';

import type { MastraDBMessage, MessageListInput } from './message-list';
import type { Agent } from './agent';
import type { ToolsInput } from './types';
import type { AgentExecutionOptions } from './agent.types';
import type { OutputSchema } from '../stream/base/schema';
import type { MastraModelOutput } from '../stream/base/output';

export interface BranchOptions {
  /** Source thread ID to branch from */
  threadId: string;
  /** Resource ID for the thread */
  resourceId: string;
  /** Optional: Specify a custom thread ID for the new branch (auto-generated if not provided) */
  newThreadId?: string;
}

/**
 * Represents a branched conversation thread from an existing thread.
 *
 * Created via `agent.branch()`, this class lazily copies messages from a source
 * thread to a new thread when `.stream()` or `.generate()` is first called.
 *
 * @example
 * ```typescript
 * // Branch and continue conversation
 * const result = await agent
 *   .branch({ threadId: 'source-thread', resourceId: 'user-123' })
 *   .stream('Continue from here...');
 *
 * // Access the new thread ID
 * const branch = agent.branch({ threadId: 'source', resourceId: 'user-123' });
 * console.log('New thread:', branch.newThreadId);
 * ```
 */
export class AgentBranch<TAgentId extends string, TTools extends ToolsInput> {
  #agent: Agent<TAgentId, TTools>;
  #sourceThreadId: string;
  #resourceId: string;
  #newThreadId: string;
  #branched: boolean = false;
  #branchLock: Promise<void> | null = null;

  constructor(agent: Agent<TAgentId, TTools>, options: BranchOptions) {
    this.#agent = agent;
    this.#sourceThreadId = options.threadId;
    this.#resourceId = options.resourceId;
    this.#newThreadId = options.newThreadId ?? randomUUID();
  }

  /** Get the new thread ID that will be used for this branch */
  get newThreadId(): string {
    return this.#newThreadId;
  }

  /**
   * Performs the lazy branch operation - copies messages from source to new thread.
   * Uses locking to ensure this only happens once even with concurrent calls.
   */
  async #ensureBranched(): Promise<void> {
    if (this.#branched) return;

    if (this.#branchLock) {
      await this.#branchLock;
      return;
    }

    this.#branchLock = this.#performBranch();
    await this.#branchLock;
  }

  async #performBranch(): Promise<void> {
    const memory = await this.#agent.getMemory();

    if (!memory) {
      throw new Error(
        `Cannot branch: Agent "${this.#agent.name}" has no memory configured. ` +
          `Branch requires memory to copy messages between threads.`,
      );
    }

    // Get all messages from source thread
    const { messages } = await memory.recall({
      threadId: this.#sourceThreadId,
      resourceId: this.#resourceId,
    });

    // Create the new thread with metadata indicating it's a branch
    await memory.createThread({
      threadId: this.#newThreadId,
      resourceId: this.#resourceId,
      metadata: {
        branchedFrom: this.#sourceThreadId,
        branchedAt: new Date().toISOString(),
      },
    });

    // Copy messages to new thread with new IDs
    if (messages.length > 0) {
      const copiedMessages: MastraDBMessage[] = messages.map(msg => ({
        ...msg,
        id: randomUUID(),
        threadId: this.#newThreadId,
      }));

      await memory.saveMessages({ messages: copiedMessages });
    }

    this.#branched = true;
  }

  /**
   * Stream a response using the branched thread.
   * On first call, copies messages from source thread to the new thread.
   */
  async stream<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    options?: AgentExecutionOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    await this.#ensureBranched();

    return this.#agent.stream(messages, {
      ...options,
      memory: {
        thread: this.#newThreadId,
        resource: this.#resourceId,
        options: options?.memory?.options,
      },
    });
  }

  /**
   * Generate a response using the branched thread.
   * On first call, copies messages from source thread to the new thread.
   */
  async generate<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    options?: AgentExecutionOptions<OUTPUT>,
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    await this.#ensureBranched();

    return this.#agent.generate(messages, {
      ...options,
      memory: {
        thread: this.#newThreadId,
        resource: this.#resourceId,
        options: options?.memory?.options,
      },
    });
  }
}
