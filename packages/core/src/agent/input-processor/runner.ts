import { MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import { ProcessorMessages } from './processor-messages';
import type { InputProcessor } from './index';

export async function runInputProcessors(
  processors: InputProcessor[],
  messageList: MessageList,
  telemetry?: any,
): Promise<MessageList> {
  // Use the same v2 format for both MessageList and ProcessorMessages
  const v2Messages = messageList.get.all.v2();
  const processorMessages = new ProcessorMessages(v2Messages);

  const ctx: { messages: ProcessorMessages; abort: () => never } = {
    messages: processorMessages,
    abort: () => {
      throw new TripWire('Tripwire triggered');
    },
  };

  // Run all processors sequentially
  for (let index = 0; index < processors.length; index++) {
    const processor = processors[index];
    if (!processor) {
      continue;
    }

    const abort = (reason?: string): never => {
      throw new TripWire(reason || `Tripwire triggered by ${processor.name}`);
    };

    ctx.abort = abort;

    // Wrap processor execution in telemetry span
    if (!telemetry) {
      await processor.process(ctx);
    } else {
      await telemetry.traceMethod(
        async () => {
          return processor.process(ctx);
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

  // Convert back to MessageList - use the processed v2 messages directly
  const processedV2Messages = ctx.messages.getAll();
  const newMessageList = new MessageList();
  messageList.add(processedV2Messages, 'user');
  return newMessageList;
}
