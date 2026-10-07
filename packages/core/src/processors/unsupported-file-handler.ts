import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';

import type { MessageList } from '../agent/message-list';
import { resolveFilePartMediaTypeAndData } from '../agent/message-list/prompt/image-utils';
import { unavailableAttachmentPlaceholder } from '../agent/message-list/prompt/unavailable-attachments';
import { RequestContext } from '../request-context';
import {
  cacheOf,
  DEFAULT_MAX_FILE_SIZE,
  namesByContent,
  promptFiles,
  replaceParts,
  toDisplayName,
  uploadPromptFiles,
} from './processors/file-upload';
import type { PromptFile, PromptFilePart } from './processors/file-upload';
import { FileUploadError } from './processors/file-upload-errors';
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
/** Recorded for a rejection that names no media type: every file the model may not read goes. */
const UNNAMED_REJECTION = '*';

/**
 * Lets an agent keep working when the model rejects a file the user sent.
 *
 * The file goes to the model unchanged first: which types a model reads varies
 * by provider and changes over time, so nothing is guessed up front. When the
 * provider SDK refuses a file type before sending the request, or the provider
 * rejects a request that holds a file the model may not read, this processor
 * replaces the rejected file, and every other file that isn't an image, a PDF,
 * or text, then calls the model once more. When the agent's workspace has a
 * sandbox, each file is uploaded there and the model gets its path; otherwise,
 * or when the upload fails, it gets a note saying the file wasn't sent. Only the
 * prompt changes: the stored messages keep their files, and a thread that
 * already stores such a file works again on its next turn.
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
    if (mediaType) {
      if (!hasFile(messageList)) return;
      rejectionsOf(state).add(mediaType);
      return { retry: true };
    }
    // A provider can reject the file in its HTTP response with nothing about the file in it,
    // like Gemini's 502, so any API error counts when the request holds a file the model may not read.
    if (!isAPICallError(error) || !hasUnreadableFile(messageList)) return;
    rejectionsOf(state).add(UNNAMED_REJECTION);
    return { retry: true };
  }

  // Runs before every model call of the request; it only acts once a call was rejected for a file.
  async processLLMRequest({
    prompt,
    messageList,
    workspace,
    requestContext = new RequestContext(),
    abortSignal,
    state,
  }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    const rejected = rejectionsOf(state);
    if (rejected.size === 0) return;
    const parts = unsupportedParts(prompt, rejected);
    if (parts.length === 0) return;
    const named = promptFiles(prompt, () => namesByContent(messageList)).filter(file => parts.includes(file.part));
    const notes = new Map(
      parts.map(part => [part, unsentNote(part, named.find(file => file.part === part)?.fileName)]),
    );
    const uploaded = await uploadToSandbox(named, { workspace, requestContext, abortSignal, state });
    uploaded?.forEach((note, part) => notes.set(part, note));
    return { prompt: replaceParts(prompt, notes) };
  }
}

/**
 * The sandbox only improves on the note: a file the model can work on with its
 * tools. Anything that keeps the sandbox out of reach leaves the note, so this
 * processor never stops a turn.
 */
async function uploadToSandbox(
  files: PromptFile[],
  {
    workspace,
    requestContext,
    abortSignal,
    state,
  }: Pick<ProcessLLMRequestArgs, 'workspace' | 'abortSignal' | 'state'> & { requestContext: RequestContext },
): Promise<Map<PromptFilePart, string> | undefined> {
  if (files.length === 0 || !workspace?.hasSandboxConfig()) return undefined;
  try {
    return await uploadPromptFiles(files, {
      workspace,
      requestContext,
      maxFileSize: () => DEFAULT_MAX_FILE_SIZE,
      cache: cacheOf(state),
      abortSignal,
    });
  } catch (error) {
    if (error instanceof FileUploadError) return undefined;
    throw error;
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

function isAPICallError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const { name, cause } = current as { name?: unknown; cause?: unknown };
    if (name === 'AI_APICallError') return true;
    current = cause;
  }
  return false;
}

function hasUnreadableFile(messageList: MessageList): boolean {
  return messageList.get.all
    .db()
    .some(
      message =>
        message.role === 'user' &&
        (message.content.parts.some(
          part => part.type === 'file' && !isReadable(resolveFilePartMediaTypeAndData(part).mediaType),
        ) ||
          (message.content.experimental_attachments ?? []).some(attachment => !isReadable(attachment.contentType))),
    );
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
function unsupportedParts(prompt: LanguageModelV2Prompt, rejected: Set<string>): PromptFilePart[] {
  return prompt.flatMap(message =>
    message.role !== 'user'
      ? []
      : message.content.filter(
          (part): part is PromptFilePart => part.type === 'file' && mayBeUnsupported(part, rejected),
        ),
  );
}

function mayBeUnsupported(part: PromptFilePart, rejected: Set<string>): boolean {
  return rejected.has(normalizedMediaType(part.mediaType)) || !isReadable(part.mediaType);
}

// Images, PDFs and text: the types most models read.
function isReadable(mediaType: string | undefined): boolean {
  const type = normalizedMediaType(mediaType ?? '');
  return type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf';
}

const normalizedMediaType = (mediaType: string) => mediaType.split(';')[0]!.trim().toLowerCase();

// The placeholder Mastra uses for an attachment it can't use, so the model sees one wording for both cases.
// A file without a name shows its type, as there.
function unsentNote(part: PromptFilePart, fileName = part.filename): string {
  return unavailableAttachmentPlaceholder(fileName ? toDisplayName(fileName) : part.mediaType || 'file');
}
