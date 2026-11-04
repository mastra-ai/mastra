import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';

import type { MastraToolInvocationPart, MessageList } from '../agent/message-list';
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
/** Statuses that ask to try again later. They say nothing about the files, and the retry processor resends the request as is. */
const TRY_LATER_STATUS_CODES: ReadonlySet<unknown> = new Set([408, 409, 429, 503, 504]);
/**
 * 400s in which the provider says a file or image part of the request is invalid. Matched against the error
 * message and the response body. Kept to these shapes so no other 400 drops content from the history.
 */
const REJECTED_PART_PATTERNS = [
  // OpenAI Responses: `{"error":{"message":"The file you uploaded is badly formatted or corrupted...","code":"invalid_file"}}`.
  /"code"\s*:\s*"invalid_file"/,
  // Anthropic: `...image.source.base64: The image was specified using the image/png media type, but the image appears to be a image/webp image`.
  /image was specified using the \S+ media type, but the image appears to be/i,
];
/** First bytes of a file with a fixed signature, for the media types that have one. */
const MEDIA_SIGNATURES: Record<string, (head: Buffer) => boolean> = {
  'image/png': head => head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': head => head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  'image/gif': head => head.subarray(0, 4).toString('latin1') === 'GIF8',
  'image/webp': head =>
    head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': head => head.includes('%PDF-'),
};

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
 * A file or image in a tool result is different: when the provider answers 400
 * that a file part is invalid (OpenAI's `invalid_file`, Anthropic's media type
 * mismatch), it would fail every later call too. So that part is replaced with
 * a note in the stored history, and the model is called once more.
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
    // A tool result's file or image the provider called invalid would fail every later call too, so it leaves the history.
    // The error rarely says which part it means. With a user file the model may not read in the request, only a tool
    // part whose bytes contradict its type is taken; otherwise the user-file fallback below handles the rejection.
    if (isRejectedPartError(error) && omitRejectedToolMedia(messageList, !hasUnreadableFile(messageList))) {
      return { retry: true };
    }
    const mediaType = rejectedMediaTypeOf(error);
    if (mediaType) {
      if (!hasFile(messageList)) return;
      rejectionsOf(state).add(mediaType);
      return { retry: true };
    }
    // A provider can reject the file in its HTTP response with nothing about the file in it, like Gemini's 502,
    // so an API error counts when the request holds a file the model may not read, unless it asks to try again later.
    const apiError = apiCallErrorOf(error);
    if (!apiError || TRY_LATER_STATUS_CODES.has(apiError.statusCode) || !hasUnreadableFile(messageList)) return;
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

function apiCallErrorOf(error: unknown): { statusCode?: unknown } | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const { name, cause } = current as { name?: unknown; cause?: unknown };
    if (name === 'AI_APICallError') return current as { statusCode?: unknown };
    current = cause;
  }
  return undefined;
}

function isRejectedPartError(error: unknown): boolean {
  const apiError = apiCallErrorOf(error) as
    | { statusCode?: unknown; message?: unknown; responseBody?: unknown }
    | undefined;
  if (apiError?.statusCode !== 400) return false;
  const texts = [apiError.message, apiError.responseBody].filter(text => typeof text === 'string');
  return texts.some(text => REJECTED_PART_PATTERNS.some(pattern => pattern.test(text)));
}

type ToolMediaItem = { type: 'media' | 'image-data' | 'file-data'; data: string; mediaType?: string };

/** The content items of a tool result as the model receives them: `toModelOutput`'s output, stored on the part. */
function toolModelOutputOf(part: MastraToolInvocationPart): { type: 'content'; value: unknown[] } | undefined {
  const output = (part.providerMetadata?.mastra as { modelOutput?: unknown } | undefined)?.modelOutput as
    | { type?: unknown; value?: unknown }
    | undefined;
  return output?.type === 'content' && Array.isArray(output.value)
    ? (output as { type: 'content'; value: unknown[] })
    : undefined;
}

function isToolMediaItem(item: unknown): item is ToolMediaItem {
  const { type, data } = (item ?? {}) as { type?: unknown; data?: unknown };
  return (type === 'media' || type === 'image-data' || type === 'file-data') && typeof data === 'string';
}

/** False when the bytes show the item is not the media type it is labelled with. Types without a signature pass. */
function matchesItsMediaType({ data, mediaType = '' }: ToolMediaItem): boolean {
  const matches = MEDIA_SIGNATURES[normalizedMediaType(mediaType)];
  if (!matches) return true;
  const base64 = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
  // 1368 base64 characters are 1 KiB of bytes, enough to find `%PDF-` anywhere in the first 1 KiB.
  return matches(Buffer.from(base64.slice(0, 1368), 'base64'));
}

/**
 * Replaces, in the stored history, the tool-result file or image the provider rejected with a text note, and
 * returns whether it replaced any. The error rarely says which part it means, so this takes every part whose
 * bytes don't match its media type, or else (when `allowNewest`) the newest one: the call before it went through
 * without that part.
 */
function omitRejectedToolMedia(messageList: MessageList, allowNewest: boolean): boolean {
  const found: { part: MastraToolInvocationPart; index: number; item: ToolMediaItem }[] = [];
  for (const message of messageList.get.all.db()) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation' || part.toolInvocation.state !== 'result') continue;
      toolModelOutputOf(part)?.value.forEach((item, index) => {
        if (isToolMediaItem(item)) found.push({ part, index, item });
      });
    }
  }
  const mislabeled = found.filter(({ item }) => !matchesItsMediaType(item));
  const omitted = mislabeled.length > 0 ? mislabeled : allowNewest ? found.slice(-1) : [];
  for (const part of new Set(omitted.map(({ part }) => part))) {
    const output = toolModelOutputOf(part)!;
    const value = output.value.map((item, index) =>
      omitted.some(entry => entry.part === part && entry.index === index)
        ? { type: 'text', text: rejectedPartNote((item as ToolMediaItem).mediaType) }
        : item,
    );
    // Through the message list, so a message that was already saved is saved again without the part.
    messageList.updateToolInvocation({
      ...part,
      providerMetadata: {
        ...part.providerMetadata,
        mastra: { ...part.providerMetadata?.mastra, modelOutput: { ...output, value } },
      },
    } as MastraToolInvocationPart);
  }
  return omitted.length > 0;
}

const rejectedPartNote = (mediaType?: string) =>
  `[file omitted${mediaType ? ` (${mediaType})` : ''}: the provider rejected it as invalid; read it as text or check its type]`;

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
