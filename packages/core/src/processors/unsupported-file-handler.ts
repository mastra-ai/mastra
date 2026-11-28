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
 * a note in the stored history, and the model is called once more. The error
 * often doesn't say which part it means, so a part is only replaced when the
 * error points at it in the request, when it is the only file in the request,
 * or when its bytes are not the type it is labelled with. Otherwise the stored
 * history is left alone.
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
    // Only a part shown to be the rejected one goes. When none is, the history stays as it is, and the user-file
    // fallback below handles the error or it surfaces.
    const rejectedPartError = rejectedPartErrorOf(error);
    // An unlocated refusal may be about an unreadable user file, even if a tool result has invalid-looking bytes.
    // In that case the existing prompt-only user-file fallback must run before tool history is changed.
    if (
      rejectedPartError &&
      (!hasUnreadableFile(messageList) || identifiesToolResult(rejectedPartError)) &&
      omitRejectedToolMedia(messageList, rejectedPartError)
    )
      return { retry: true };
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

/** What the handler reads of a provider 400 that says a file or image part of the request is invalid. */
type RejectedPartError = { message?: unknown; responseBody?: unknown; requestBodyValues?: unknown };

/** The API error in `error`, when it is a 400 in which the provider says a file or image part is invalid. */
function rejectedPartErrorOf(error: unknown): RejectedPartError | undefined {
  const apiError = apiCallErrorOf(error) as (RejectedPartError & { statusCode?: unknown }) | undefined;
  if (apiError?.statusCode !== 400) return undefined;
  const texts = [apiError.message, apiError.responseBody].filter(text => typeof text === 'string');
  return texts.some(text => REJECTED_PART_PATTERNS.some(pattern => pattern.test(text))) ? apiError : undefined;
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

/** Whether a tool result's content item is a file or image given inline. */
function isToolMediaItem(item: unknown): item is ToolMediaItem {
  const { type, data } = (item ?? {}) as { type?: unknown; data?: unknown };
  return (type === 'media' || type === 'image-data' || type === 'file-data') && typeof data === 'string';
}

/** The base64 of inline file data, without the prefix of a `data:` URL. */
const base64Of = (data: string) => (data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data);

/** False when the bytes show the item is not the media type it is labelled with. Types without a signature pass. */
function matchesItsMediaType({ data, mediaType = '' }: ToolMediaItem): boolean {
  const matches = MEDIA_SIGNATURES[normalizedMediaType(mediaType)];
  if (!matches) return true;
  // 1368 base64 characters are 1 KiB of bytes, enough to find `%PDF-` anywhere in the first 1 KiB.
  return matches(Buffer.from(base64Of(data).slice(0, 1368), 'base64'));
}

/**
 * Replaces, in the stored history, the tool-result files and images shown to be the ones the provider rejected with
 * a text note, and returns whether it replaced any. The error often doesn't say which part it means, so a part is
 * taken only on evidence: the error points at it in the request, it is the only file in the request, or its bytes
 * are not the media type it is labelled with. Never by position: a wrong guess would stay in the history while the
 * rejected file is sent again.
 */
function omitRejectedToolMedia(messageList: MessageList, error: RejectedPartError): boolean {
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
  const rejected = rejectedPayloadOf(error);
  const named = rejected === undefined ? [] : found.filter(({ item }) => base64Of(item.data) === rejected);
  // The rejected file is not in a tool result, like one a user sent, so the tool results stay.
  if (rejected !== undefined && named.length === 0) return false;
  const omitted = [...new Set([...named, ...found.filter(({ item }) => !matchesItsMediaType(item))])];
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

/**
 * The base64 of the one file or image the error is about, read from the request the provider rejected: the media
 * block at the path the error names (Anthropic starts its message with one, like `messages.2.content.0.content.1`;
 * OpenAI gives one in `param`), or the only media block under that path. `null` when that block has no inline
 * base64, like an image URL. `undefined` when the request is unknown or no single file can be told apart.
 */
function rejectedPayloadOf(error: RejectedPartError): string | null | undefined {
  const body = jsonOf(error.requestBodyValues);
  if (!isRecord(body)) return undefined;
  const scope = requestNodeAt(body, errorPathOf(error, body));
  if (scope === undefined) return undefined;
  const payloads = new Set(mediaBlocksIn(scope).map(block => payloadOf(block)));
  return payloads.size === 1 ? [...payloads][0] : undefined;
}

/** Paths naming a request node in an error message, followed by a colon (e.g. `messages.2.content.0.image.source.base64:`). */
function requestPathsIn(text: string): string[] {
  const paths: string[] = [];
  const identifierStart = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
  const identifierPart = (code: number) => identifierStart(code) || (code >= 48 && code <= 57);
  const digit = (code: number) => code >= 48 && code <= 57;
  let cursor = 0;
  while (cursor < text.length) {
    if (!identifierStart(text.charCodeAt(cursor))) {
      cursor++;
      continue;
    }
    let end = cursor + 1;
    while (identifierPart(text.charCodeAt(end))) end++;
    let segments = 0;
    while (end < text.length) {
      if (text[end] === '.') {
        if (!identifierPart(text.charCodeAt(end + 1))) break;
        end++;
        while (identifierPart(text.charCodeAt(end))) end++;
      } else if (text[end] === '[') {
        if (!digit(text.charCodeAt(end + 1))) break;
        end++;
        while (digit(text.charCodeAt(end))) end++;
        if (text[end] !== ']') break;
        end++;
      } else {
        break;
      }
      segments++;
    }
    if (segments > 0 && text[end] === ':') paths.push(text.slice(cursor, end));
    cursor = Math.max(end, cursor + 1);
  }
  return paths;
}

/** True only when a path into the actual rejected request identifies an Anthropic tool result. */
function identifiesToolResult(error: RejectedPartError): boolean {
  const body = jsonOf(error.requestBodyValues);
  if (!isRecord(body)) return false;
  let node: unknown = body;
  for (const key of errorPathOf(error, body)) {
    if (isRecord(node) && node.type === 'tool_result') return true;
    if (Array.isArray(node) && /^\d+$/.test(key)) node = node[Number(key)];
    else if (isRecord(node) && key in node) node = node[key];
    else if (!isRecord(node) || node.type !== key) return false;
  }
  return isRecord(node) && node.type === 'tool_result';
}

/** The keys of the path the error names in the request, from OpenAI's `param` or the start of Anthropic's message. */
function errorPathOf(error: RejectedPartError, body: Record<string, unknown>): string[] {
  const response = jsonOf(error.responseBody);
  const param = isRecord(response) && isRecord(response.error) ? response.error.param : undefined;
  const texts = [error.message, error.responseBody].filter((text): text is string => typeof text === 'string');
  const paths = [...(typeof param === 'string' ? [param] : []), ...texts.flatMap(requestPathsIn)];
  const keyLists = paths.map(path => path.split(/[.[\]]+/).filter(Boolean));
  return keyLists.find(([first]) => first !== undefined && first in body) ?? [];
}

/**
 * The node of the request `path` leads to, or the media block on the way. A key the node doesn't have ends the walk
 * there, unless it is the node's type, as Anthropic names the block type in its paths (`content.1.image.source`).
 * `undefined` when an index is past the end of a list: the path is not about this request.
 */
function requestNodeAt(body: Record<string, unknown>, path: string[]): unknown {
  let node: unknown = body;
  for (const key of path) {
    if (isMediaBlock(node)) return node;
    if (Array.isArray(node) && /^\d+$/.test(key)) {
      if (Number(key) >= node.length) return undefined;
      node = node[Number(key)];
    } else if (isRecord(node) && key in node) {
      node = node[key];
    } else if (!isRecord(node) || node.type !== key) {
      break;
    }
  }
  return node;
}

/** Content block types that carry a file or image: Anthropic's, OpenAI Responses' and OpenAI Chat Completions'. */
const MEDIA_BLOCK_TYPES: ReadonlySet<unknown> = new Set([
  'image',
  'document',
  'file',
  'image_url',
  'input_image',
  'input_file',
  'input_audio',
]);

/** Whether a node of a provider request is a content block that carries a file or image. Google's have no type. */
function isMediaBlock(node: unknown): node is Record<string, unknown> {
  return isRecord(node) && (MEDIA_BLOCK_TYPES.has(node.type) || 'inlineData' in node || 'fileData' in node);
}

/** Every media block in a node of a provider request. */
function mediaBlocksIn(node: unknown): Record<string, unknown>[] {
  if (isMediaBlock(node)) return [node];
  if (Array.isArray(node)) return node.flatMap(mediaBlocksIn);
  return isRecord(node) ? Object.values(node).flatMap(mediaBlocksIn) : [];
}

/** The inline base64 in a media block: a `data:` URL, or a `data` field like Anthropic's `source.data`. */
function payloadOf(node: unknown, key?: string): string | null {
  if (typeof node === 'string') return node.startsWith('data:') ? base64Of(node) : key === 'data' ? node : null;
  const entries: [string | undefined, unknown][] = Array.isArray(node)
    ? node.map(child => [undefined, child])
    : isRecord(node)
      ? Object.entries(node)
      : [];
  for (const [childKey, child] of entries) {
    const payload = payloadOf(child, childKey);
    if (payload !== null) return payload;
  }
  return null;
}

/** A provider request or response body: the AI SDK keeps the request as an object and the response as text. */
function jsonOf(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
