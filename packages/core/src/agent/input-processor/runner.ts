import type { MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import type { InputProcessor } from './index';

export async function runInputProcessors(
  processors: InputProcessor[],
  messageList: MessageList,
  telemetry?: any,
): Promise<MessageList> {
  const ctx: { messages: MessageList; abort: () => never } = {
    messages: messageList,
    abort: () => {
      throw new TripWire('Tripwire triggered');
    },
  };

  const runProcessor = async (index: number): Promise<void> => {
    if (index >= processors.length) {
      return;
    }

    const processor = processors[index];
    if (!processor) {
      return;
    }

    const abort = (reason?: string): never => {
      throw new TripWire(reason || `Tripwire triggered by ${processor.name}`);
    };

    ctx.abort = abort;

    let nextCalled = false;
    const next = async (): Promise<void> => {
      nextCalled = true;
      return await runProcessor(index + 1);
    };

    // Wrap processor execution in telemetry span, but preserve original control flow
    const executeProcessor = async () => {
      if (!telemetry) {
        return processor.process(ctx, next);
      }

      return telemetry.traceMethod(
        async () => {
          return processor.process(ctx, next);
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
    };

    await executeProcessor();

    if (!nextCalled) {
      await runProcessor(index + 1);
    }
  };

  await runProcessor(0);

  return ctx.messages;
}
