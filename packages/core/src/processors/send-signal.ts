import type { MessageList } from '../agent/message-list';
import { createSignal, resolveSignalTagName } from '../agent/signals';
import type { AgentSignalInput, CreatedAgentSignal } from '../agent/signals';
import type { ProcessorStreamWriter } from './index';

/**
 * Stable transcript id for a transient signal whose sender did not supply one.
 *
 * A transient signal is meant to be re-injected — typically from `processInputStep`, which runs
 * once per model call — and the message-list upsert is keyed on `id`. Without a stable id every
 * re-injection mints a fresh UUID and lands as an additional copy in the same turn, so every step
 * of a tool loop adds another copy of the same reminder. Keying on the emitting processor
 * plus the tag name gives each emitter one slot per tag without the caller having to know that ids
 * are what drive deduplication.
 *
 * With a stable id every re-injection targets the same transcript row — one slot per emitting
 * processor and tag — instead of minting a new UUID and stacking copies. The message list then
 * drops that row and re-appends it (see the transient branch in `addSignal`), so a single copy is
 * kept and repositioned after the newest message on each step: recency is per step, not per turn.
 * A transient signal is never persisted, so the next turn reloads a history without it and appends
 * it fresh. Keeping the cached prompt prefix stable across the moving copy is the consumer's job —
 * place prompt-cache breakpoints behind transient rows; see the note on `isTransientSignalMessage`
 * in agent/signals.ts.
 *
 * An explicitly supplied `id` always wins: a caller that wants several concurrent transient signals
 * from the same processor and tag distinguishes them itself.
 */
function defaultTransientSignalId(processorId: string, tagName: string): string {
  return `transient:${encodeURIComponent(processorId)}:${encodeURIComponent(tagName)}`;
}

export function createProcessorSendSignal(args: {
  messageList: MessageList;
  writer?: ProcessorStreamWriter;
  rotateResponseMessageId?: () => string;
  /** Id of the processor this `sendSignal` is handed to; used to key re-injected transient signals. */
  processorId?: string;
}): (signalInput: AgentSignalInput) => Promise<CreatedAgentSignal> {
  return async signalInput => {
    const input =
      signalInput.transient && !signalInput.id && args.processorId
        ? { ...signalInput, id: defaultTransientSignalId(args.processorId, resolveSignalTagName(signalInput)) }
        : signalInput;
    const signal = createSignal(input);
    args.messageList.markResponseMessageBoundary();
    args.rotateResponseMessageId?.();
    const signalForTranscript = args.messageList.addSignal(signal);
    await args.writer?.custom(signalForTranscript.toDataPart());
    return signalForTranscript;
  };
}
