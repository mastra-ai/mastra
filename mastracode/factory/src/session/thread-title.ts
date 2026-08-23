import { generateThreadTitle } from '@mastra/code-sdk';
import type { ThinkingLevel } from '@mastra/code-sdk';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { StorageThreadType } from '@mastra/core/memory';
import type { ProcessInputArgs, Processor, ProcessInputResult } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { TitleGenerationSetting } from '../storage/domains/title-settings/base.js';

export interface ThreadTitleThreads {
  getThreadById(input: { threadId: string }): Promise<StorageThreadType | null>;
  updateThread(input: { id: string; title?: string }): Promise<StorageThreadType>;
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
 *
 * `processInput` never awaits anything: the store lookup, the per-org setting,
 * and the generation all happen in a detached task, so the answering run is
 * never blocked or failed by naming. A disabled setting, an unreachable
 * provider, or a failed request all leave the thread on its fallback name.
 */
export class FactoryThreadTitleProcessor implements Processor {
  readonly id = 'factory-thread-title';

  readonly #resolveSetting: (requestContext?: RequestContext) => Promise<TitleGenerationSetting | undefined>;
  readonly #threads: () => Promise<ThreadTitleThreads | undefined>;
  readonly #inFlight = new Set<string>();

  constructor(input: {
    resolveSetting: (requestContext?: RequestContext) => Promise<TitleGenerationSetting | undefined>;
    threads: () => Promise<ThreadTitleThreads | undefined>;
  }) {
    this.#resolveSetting = input.resolveSetting;
    this.#threads = input.threads;
  }

  processInput({ messages, requestContext, abortSignal }: ProcessInputArgs): ProcessInputResult {
    const { threadId, prompt } = lastUserPrompt(messages);
    if (!threadId || !prompt || this.#inFlight.has(threadId)) return messages;

    this.#inFlight.add(threadId);
    void this.#title(threadId, prompt, requestContext, abortSignal).finally(() => this.#inFlight.delete(threadId));
    return messages;
  }

  async #title(
    threadId: string,
    prompt: string,
    requestContext: RequestContext | undefined,
    abortSignal: AbortSignal | undefined,
  ): Promise<void> {
    try {
      const threads = await this.#threads();
      const setting = await this.#resolveSetting(requestContext);
      if (!threads || !setting?.enabled) return;

      const thread = await threads.getThreadById({ threadId });
      if (!thread || thread.title?.trim()) return;

      const title = await generateThreadTitle({
        prompt,
        requestContext,
        ...(setting.modelId ? { model: setting.modelId } : {}),
        ...(setting.thinkingLevel ? { thinkingLevel: setting.thinkingLevel } : {}),
        ...(abortSignal ? { abortSignal } : {}),
      });
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
