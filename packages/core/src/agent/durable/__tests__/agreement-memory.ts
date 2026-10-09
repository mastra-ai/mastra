import {
  removeWorkingMemoryToolInvocationParts,
  removeWorkingMemoryToolInvocations,
} from '../../../memory/working-memory-utils';
import { isTransientSignalMessage } from '../../signals';

/**
 * A core-only message memory for the restart-agreement cells.
 *
 * The harness runs the cells these tests mirror against `@mastra/memory`, whose
 * `saveMessages` hides `updateWorkingMemory` tool calls and drops transient signals
 * before writing to the storage memory domain. `MockMemory` filters system messages
 * only, so a check like "updateWorkingMemory not persisted as a visible tool part"
 * would otherwise measure this vehicle instead of the durable run. The filtering here
 * uses core's own helpers, so the persisted shape matches what `@mastra/memory` writes
 * for every part an agreement check reads.
 *
 * The subclass is built from the `MockMemory` class the caller hands in, so the memory
 * is always an instance of the *current* module graph — these cells exist to measure
 * fresh-graph restarts, and the memory must not smuggle graph 1's modules into graph 2.
 *
 * Behaviour of `@mastra/memory` this deliberately does not replicate, because no
 * agreement check depends on it: semantic recall and vector search, generated thread
 * titles, thread-scoped working-memory storage, and `removeWorkingMemoryTags` text
 * rewriting. The processor hooks (`getInputProcessors` / `getOutputProcessors`) are
 * inherited from `MastraMemory` unchanged, which is what makes the save step run.
 */
type MockMemoryClass = new (opts: any) => any;

export function createAgreementMemory({
  MockMemory,
  storage,
  options,
}: {
  MockMemory: MockMemoryClass;
  storage: unknown;
  /** Extra `MockMemory` constructor options (e.g. working memory); forwarded verbatim. */
  options?: Record<string, unknown>;
}): any {
  class AgreementMemory extends MockMemory {
    protected hideWorkingMemoryToolCalls(message: any): any {
      const content = message?.content;
      if (!content || typeof content !== 'object' || Array.isArray(content) || !Array.isArray(content.parts)) {
        return message;
      }

      const parts = removeWorkingMemoryToolInvocationParts(content.parts);
      if (parts.length === content.parts.length) {
        return message;
      }

      const hidden = { ...content, parts };
      if (Array.isArray(content.toolInvocations)) {
        hidden.toolInvocations = removeWorkingMemoryToolInvocations(content.toolInvocations);
      }

      // A message left with no parts and no text body was only the working-memory
      // call; `@mastra/memory` drops it rather than storing an empty message.
      const hasText = typeof content.content === 'string' && content.content.trim().length > 0;
      return parts.length === 0 && !hasText ? null : { ...message, content: hidden };
    }

    async saveMessages({ messages }: { messages: any[] }): Promise<{ messages: any[] }> {
      const persistable = messages
        .filter(message => message?.role !== 'system' && !isTransientSignalMessage(message))
        .map(message => this.hideWorkingMemoryToolCalls(message))
        .filter((message): boolean => message !== null);

      return super.saveMessages({ messages: persistable });
    }
  }

  return new AgreementMemory({ storage, ...options });
}
