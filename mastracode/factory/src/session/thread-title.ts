import { generateThreadTitle } from '@mastra/code-sdk';
import type { ThinkingLevel } from '@mastra/code-sdk';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { StorageThreadType } from '@mastra/core/memory';
import type { ProcessInputArgs, Processor, ProcessInputResult } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

export interface ThreadTitleGenerationConfig {
  /**
   * Model id (`provider/model`) used to generate titles. Omitted → the same
   * cheap-model pack selection OM uses, for the first reachable provider.
   */
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface ThreadTitleThreads {
  getThreadById(input: { threadId: string }): Promise<StorageThreadType | null>;
  updateThread(input: { id: string; title?: string }): Promise<StorageThreadType>;
}

export function createThreadTitleGenerator({
  model,
  thinkingLevel,
}: ThreadTitleGenerationConfig): (prompt: string, requestContext?: RequestContext) => Promise<string | undefined> {
  return (prompt, requestContext) =>
    generateThreadTitle({
      prompt,
      requestContext,
      ...(model ? { model } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
    });
}

function lastUserPrompt(messages: MastraDBMessage[]): { threadId?: string; prompt: string } {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'user') continue;
    return {
      threadId: message.threadId,
      prompt: message.content.parts
        .flatMap(part => (part.type === 'text' ? [part.text] : []))
        .join(' ')
        .trim(),
    };
  }
  return { prompt: '' };
}

/**
 * Names otherwise-untitled threads during their first answer. Runs as an input
 * processor so the title request carries the run's request context and
 * resolves model credentials exactly like the answering model does.
 */
export class FactoryThreadTitleProcessor implements Processor {
  readonly id = 'factory-thread-title';

  readonly #generateTitle: (prompt: string, requestContext?: RequestContext) => Promise<string | undefined>;
  readonly #threads: () => Promise<ThreadTitleThreads | undefined>;
  readonly #inFlight = new Set<string>();

  constructor(input: {
    generateTitle: (prompt: string, requestContext?: RequestContext) => Promise<string | undefined>;
    threads: () => Promise<ThreadTitleThreads | undefined>;
  }) {
    this.#generateTitle = input.generateTitle;
    this.#threads = input.threads;
  }

  async processInput({ messages, requestContext, abortSignal }: ProcessInputArgs): Promise<ProcessInputResult> {
    const { threadId, prompt } = lastUserPrompt(messages);
    if (!threadId || !prompt || this.#inFlight.has(threadId)) return messages;

    const threads = await this.#threads();
    if (!threads) return messages;

    this.#inFlight.add(threadId);
    void this.#title(threads, threadId, prompt, requestContext, abortSignal).finally(() =>
      this.#inFlight.delete(threadId),
    );
    return messages;
  }

  async #title(
    threads: ThreadTitleThreads,
    threadId: string,
    prompt: string,
    requestContext: RequestContext | undefined,
    abortSignal: AbortSignal | undefined,
  ): Promise<void> {
    try {
      const thread = await threads.getThreadById({ threadId });
      if (!thread || thread.title?.trim()) return;

      const title = await this.#generateTitle(prompt, requestContext);
      if (!title) return;

      // The user may have named the thread while the request ran — keep theirs.
      const current = await threads.getThreadById({ threadId });
      if (!current || current.title?.trim()) return;

      await threads.updateThread({ id: threadId, title });
    } catch (error) {
      console.warn('[Factory thread-title] Unable to generate a thread title.', error);
    }
  }
}
