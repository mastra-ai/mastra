import type { MessageList } from '../agent/message-list';
import { createSignal } from '../agent/signals';
import type { AgentSignalInput, CreatedAgentSignal } from '../agent/signals';
import type { ProcessorStreamWriter } from './index';

export function createProcessorSendSignal(args: {
  messageList: MessageList;
  writer?: ProcessorStreamWriter;
  rotateResponseMessageId?: () => string;
}): (signalInput: AgentSignalInput) => Promise<CreatedAgentSignal> {
  return async signalInput => {
    const signal = createSignal(signalInput);
    // Only seal the in-flight response message when a rotation follows. Rotation
    // marks the boundary itself (MessageList.rotateResponseMessageId); stamping it
    // WITHOUT rotating leaves the next streamed step on the same message id unable
    // to merge (MessageMerger blocks on responseBoundary), so the same-id add
    // falls into the replacement path and destroys already-streamed tool
    // call/result parts (https://github.com/mastra-ai/mastra/issues/21940).
    if (args.rotateResponseMessageId) {
      args.messageList.markResponseMessageBoundary();
      args.rotateResponseMessageId();
    }
    const signalForTranscript = args.messageList.addSignal(signal);
    await args.writer?.custom(signalForTranscript.toDataPart());
    return signalForTranscript;
  };
}
