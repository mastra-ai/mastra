/**
 * MemoryInputFilter — the input boundary between a client's request body and stored memory.
 *
 * ## What it is
 *
 * An input processor owned by memory. `Memory.getInputProcessors()` pushes it first, ahead of
 * MessageHistory, WorkingMemory, SemanticRecall, and Observational Memory, so it sees and can
 * rewrite the raw request input before any loader reads it.
 *
 * ## Why it exists
 *
 * Clients that use memory are told to send only the new message each turn (see the warning in
 * `docs/src/content/en/docs/memory/message-history.mdx` and the `prepareSendMessagesRequest`
 * example in `docs/src/content/en/integrations/agentic-ui/ai-sdk-ui.mdx`). Many don't. The
 * default `useChat` shape echoes the entire conversation back on every request, and that echo
 * is lossy: it is whatever the UI happened to have, not what was persisted.
 *
 * When memory treated that echo as the newest truth, three things went wrong:
 *
 *   1. The echoed copy was persisted over the stored row, so the client's `createdAt` rewrote
 *      the thread's ordering and the stored message lost its server-assigned identity.
 *   2. Assistant echoes carry text and tool calls but usually not the reasoning that produced
 *      them. Replaying text item ids without their reasoning item id makes OpenAI reject the
 *      request with "Item 'msg_*' of type 'message' was provided without its required
 *      'reasoning' item" (issue #24052).
 *   3. Whitespace differences between the stored text and the echoed text made the two copies
 *      look like distinct parts, so the model saw the assistant turn twice.
 *
 * Stripping provider metadata at send time only hid the symptom, and only for one provider path.
 * The fix is here: decide what the request is actually allowed to contribute before memory
 * loads. Memory is the base layer for a thread; the request may only add what memory doesn't
 * already have.
 *
 * ## What the request is allowed to contribute
 *
 * For a thread that already has stored messages, based on the tail of the input:
 *
 *   - ends with user message(s) → keep those, back to the last assistant message. Several
 *     consecutive user messages are all kept: they are all new, and they are stamped server-side
 *     (the normal client shape sends no ids, so ids and `createdAt` come from the server, and a
 *     client-supplied `createdAt` cannot reorder the thread).
 *   - ends with an assistant message → keep only its trailing run of `state: 'result'`
 *     tool-invocation parts. This is the client-side tool flow: the assistant turn was stored
 *     with a pending call, and the client is returning the result for it. Everything earlier in
 *     that message is already stored.
 *   - ends with an assistant message and no new results → drop it, but only if it exists in
 *     storage (see the `listMessagesById` check below). Internal callers such as the agent
 *     network pass assistant-role instruction messages that were never persisted; those are
 *     the whole prompt and must survive.
 *
 * For a thread with nothing stored, the entire input is the seed. Assistant provider metadata is
 * stripped there, because item ids name server-side items that this request never created — that
 * is exactly the orphaned-reference shape from #24052. Tool results keep their metadata: that
 * data came from the client.
 *
 * ## What happens after this runs
 *
 * Loaders add stored rows as `memory`. `MessageList.add` treats a memory-sourced message that
 * collides by id with input as the base layer — the stored copy takes the slot with its
 * reasoning, provider metadata, and `createdAt`, the input's parts layer on top, and the merged
 * message stays tagged `input` so the client's contribution is still persisted. See the
 * base-layer branch in `packages/core/src/agent/message-list/message-list.ts`.
 */
import type { Processor } from '..';
import type { MastraDBMessage, MastraMessagePart, MessageList } from '../../agent';
import { parseMemoryRequestContext } from '../../memory';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

export interface MemoryInputFilterOptions {
  storage: MemoryStorage;
}

function stripAssistantProviderMetadata(message: MastraDBMessage): MastraDBMessage {
  if (message.role !== 'assistant') return message;

  return {
    ...message,
    content: {
      ...message.content,
      parts: message.content.parts.map(part => {
        if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') return part;
        const {
          providerMetadata: _providerMetadata,
          providerOptions: _providerOptions,
          ...rest
        } = part as Record<string, unknown>;
        return rest as MastraMessagePart;
      }),
    },
  };
}

export class MemoryInputFilter implements Processor {
  readonly id = 'memory-input-filter';
  readonly name = 'MemoryInputFilter';

  private storage: MemoryStorage;

  constructor(options: MemoryInputFilterOptions) {
    this.storage = options.storage;
  }

  async processInput({
    messageList,
    requestContext,
  }: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
  }): Promise<MessageList> {
    const input = messageList.get.input.db();
    if (input.length === 0) return messageList;

    const context = parseMemoryRequestContext(requestContext);
    const threadId = context?.thread?.id ?? messageList.serialize().memoryInfo?.threadId;
    const resourceId = context?.resourceId ?? messageList.serialize().memoryInfo?.resourceId;
    if (!threadId) return messageList;

    const lastMessage = input.at(-1)!;
    let retainedInput: MastraDBMessage[];

    if (lastMessage.role === 'user') {
      const lastAssistantIndex = input.findLastIndex(message => message.role === 'assistant');
      retainedInput = input.slice(lastAssistantIndex + 1);
    } else if (lastMessage.role === 'assistant') {
      const trailingResults: Extract<MastraMessagePart, { type: 'tool-invocation' }>[] = [];
      for (let index = lastMessage.content.parts.length - 1; index >= 0; index--) {
        const part = lastMessage.content.parts[index]!;
        // Stream data parts (e.g. observational memory buffering markers) are appended
        // after the parts they annotate and carry no model content. Skip them so they
        // don't terminate the trailing-result run and drop the client's tool result.
        if (part.type.startsWith('data-')) continue;
        if (part.type !== 'tool-invocation' || part.toolInvocation.state !== 'result') break;
        trailingResults.unshift(part);
      }
      retainedInput =
        trailingResults.length > 0
          ? [
              {
                ...lastMessage,
                content: {
                  ...lastMessage.content,
                  content: '',
                  parts: trailingResults,
                },
              },
            ]
          : [];
    } else {
      return messageList;
    }

    const retainsFullInput =
      retainedInput.length === input.length && retainedInput.every((message, index) => message === input[index]);
    if (retainsFullInput) return messageList;

    const stored = await this.storage.listMessages({
      threadId,
      resourceId,
      page: 0,
      perPage: 1,
      orderBy: { field: 'createdAt', direction: 'DESC' },
      includeTotal: false,
    });

    if (stored.messages.length === 0) {
      const seeded = input.map(stripAssistantProviderMetadata);
      messageList.clear.input.db();
      for (const message of seeded) {
        messageList.add(message, 'input', { merge: false });
      }
      return messageList;
    }

    // A trailing assistant message with no new tool results is only a redundant echo
    // when it refers to a message that already exists in storage. Internal callers
    // (for example the agent network) pass assistant-role instruction messages that
    // were never persisted; dropping those would delete the prompt, so keep them.
    if (retainedInput.length === 0) {
      const { messages: persisted } = lastMessage.id
        ? await this.storage.listMessagesById({ messageIds: [lastMessage.id] })
        : { messages: [] };
      if (persisted.length === 0) return messageList;
    }

    messageList.clear.input.db();
    for (const message of retainedInput) {
      messageList.add(message, 'input', { merge: false });
    }

    return messageList;
  }
}
