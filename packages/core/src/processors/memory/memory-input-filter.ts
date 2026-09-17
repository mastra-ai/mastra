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

    const replacementInput = stored.messages.length > 0 ? retainedInput : input.map(stripAssistantProviderMetadata);
    messageList.clear.input.db();
    for (const message of replacementInput) {
      messageList.add(message, 'input', { merge: false });
    }

    return messageList;
  }
}
