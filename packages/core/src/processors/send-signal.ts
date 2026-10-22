import type { MessageList } from '../agent/message-list';
import { createSignal } from '../agent/signals';
import type { AgentSignalInput, CreatedAgentSignal } from '../agent/signals';
import type { ProcessorStreamWriter } from './index';

/**
 * Where a processor's `sendSignal` goes once the step that created it has
 * returned. Durable engines rebuild the MessageList for every step, so a held
 * `sendSignal` writing into the old list would never reach the model.
 */
export interface ProcessorLateSignalSink {
  isClosed(): boolean;
  send(signalInput: AgentSignalInput): Promise<CreatedAgentSignal>;
}

export function createProcessorSendSignal(args: {
  messageList: MessageList;
  writer?: ProcessorStreamWriter;
  rotateResponseMessageId?: () => string;
  lateSink?: ProcessorLateSignalSink;
}): (signalInput: AgentSignalInput) => Promise<CreatedAgentSignal> {
  return async signalInput => {
    if (args.lateSink?.isClosed()) {
      return args.lateSink.send(signalInput);
    }
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
