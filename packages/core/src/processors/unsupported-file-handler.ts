import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';

import type { MessageList } from '../agent/message-list';
import { toDisplayName } from './processors/file-upload';
import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
} from './index';

/** The media type a provider SDK names when it refuses a file: `file part media type <type>`, `media type: <type>`. */
const REJECTED_MEDIA_TYPE = /media type:?\s+(\S+)/i;
const MAX_CAUSE_DEPTH = 5;

type PromptUserMessage = Extract<LanguageModelV2Prompt[number], { role: 'user' }>;
type PromptFilePart = Extract<PromptUserMessage['content'][number], { type: 'file' }>;

/**
 * Lets an agent keep working when the model rejects a file the user sent.
 *
 * The file goes to the model unchanged first: which types a model reads varies
 * by provider and changes over time, so nothing is guessed up front. When the
 * provider SDK refuses a file type before sending the request, this processor
 * replaces the rejected file, and every other file that isn't an image, a PDF,
 * or text, with a note in the prompt, then calls the model once more. The
 * stored messages keep their files, and a thread that already stores such a
 * file works again on its next turn.
 *
 * Part of the default error processors of every agent; `errorProcessorDefaults: false` turns it off.
 */
export class UnsupportedFileHandler implements Processor<'unsupported-file-handler'> {
  readonly id = 'unsupported-file-handler' as const;
  readonly name = 'Unsupported File Handler';

  async processAPIError({
    error,
    messageList,
    retryCount,
    state,
  }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    // Only once: if the call fails again after the files are replaced, the note didn't fix it.
    if (retryCount > 0) return;
    const mediaType = rejectedMediaTypeOf(error);
    if (!mediaType || !hasFile(messageList)) return;
    rejectionsOf(state).add(mediaType);
    return { retry: true };
  }

  // Runs before every model call of the request; it only acts once a call was rejected for a file.
  async processLLMRequest({ prompt, state }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    const rejected = rejectionsOf(state);
    if (rejected.size === 0) return;
    let replaced = false;
    const rewritten = prompt.map(message => {
      if (message.role !== 'user') return message;
      const content = message.content.map(part => {
        if (part.type !== 'file' || !mayBeUnsupported(part, rejected)) return part;
        replaced = true;
        return { type: 'text' as const, text: unsentNote(part) };
      });
      return { ...message, content };
    });
    return replaced ? { prompt: rewritten } : undefined;
  }
}

function rejectionsOf(state: Record<string, unknown>): Set<string> {
  state.rejectedMediaTypes ??= new Set<string>();
  return state.rejectedMediaTypes as Set<string>;
}

/**
 * The media type of a file the provider SDK refused, if `error` is such a
 * refusal. The SDKs throw `UnsupportedFunctionalityError` on the client, before
 * the request goes out, and Mastra may wrap it.
 */
function rejectedMediaTypeOf(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const { name, functionality, cause } = current as { name?: unknown; functionality?: unknown; cause?: unknown };
    if (name === 'AI_UnsupportedFunctionalityError' && typeof functionality === 'string') {
      return functionality.match(REJECTED_MEDIA_TYPE)?.[1]?.toLowerCase();
    }
    current = cause;
  }
  return undefined;
}

// A refusal naming a media type can only come from a file; without one, there is nothing to replace.
function hasFile(messageList: MessageList): boolean {
  return messageList.get.all
    .db()
    .some(
      message =>
        message.content.parts.some(part => part.type === 'file') ||
        (message.content.experimental_attachments?.length ?? 0) > 0,
    );
}

// The call is tried again only once, so every file that may not be readable goes, not just the one named.
function mayBeUnsupported(part: PromptFilePart, rejected: Set<string>): boolean {
  const mediaType = part.mediaType.split(';')[0]!.trim().toLowerCase();
  if (rejected.has(mediaType)) return true;
  return !(mediaType.startsWith('image/') || mediaType.startsWith('text/') || mediaType === 'application/pdf');
}

function unsentNote(part: PromptFilePart): string {
  return [
    '[File not sent]',
    `name: ${toDisplayName(part.filename)}`,
    `type: ${part.mediaType}`,
    'reason: The model does not support this type of file, so the file was not sent to it.',
  ].join('\n');
}
