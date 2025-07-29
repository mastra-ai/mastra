import type { MastraMessageV2, MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import type { InputProcessor } from './index';

export async function runInputProcessors(
  processors: InputProcessor[],
  messageList: MessageList,
  telemetry?: any,
): Promise<MessageList> {
  const userMessages = messageList.clear.input.v2();

  let processableMessages: MastraMessageV2[] = [...userMessages];

  const ctx: { messages: MastraMessageV2[]; abort: () => never } = {
    messages: processableMessages,
    abort: () => {
      throw new TripWire('Tripwire triggered');
    },
  };

  for (const [index, processor] of processors.entries()) {
    const abort = (reason?: string): never => {
      throw new TripWire(reason || `Tripwire triggered by ${processor.name}`);
    };

    ctx.abort = abort;

    if (!telemetry) {
      processableMessages = await processor.process({ messages: processableMessages, abort: ctx.abort });
    } else {
      await telemetry.traceMethod(
        async () => {
          processableMessages = await processor.process({ messages: processableMessages, abort: ctx.abort });
          return processableMessages;
        },
        {
          spanName: `agent.inputProcessor.${processor.name}`,
          attributes: {
            'processor.name': processor.name,
            'processor.index': index.toString(),
            'processor.total': processors.length.toString(),
          },
        },
      )();
    }
  }

  if (processableMessages.length > 0) {
    messageList.add(processableMessages, 'user');
  }

  return messageList;
}
