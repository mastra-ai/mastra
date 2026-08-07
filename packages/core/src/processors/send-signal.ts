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
    args.messageList.markResponseMessageBoundary();
    args.rotateResponseMessageId?.();
    const signalForTranscript = args.messageList.addSignal(signal);
    await args.writer?.custom(signalForTranscript.toDataPart());
    return signalForTranscript;
  };
}
