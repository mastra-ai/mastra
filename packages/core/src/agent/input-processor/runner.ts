import type { MessageList } from '../message-list';
import { TripWire } from '../trip-wire';
import type { InputProcessor } from './index';

export async function runInputProcessors(processors: InputProcessor[], messageList: MessageList): Promise<MessageList> {
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

    await processor.process(ctx, next);

    if (!nextCalled) {
      await runProcessor(index + 1);
    }
  };

  await runProcessor(0);

  return ctx.messages;
}
