import { createHash } from 'node:crypto';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import {
  categorizeFileData,
  parseDataUri,
  resolveFilePartMediaTypeAndData,
} from '../../agent/message-list/prompt/image-utils';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { parseMemoryRequestContext } from '../../memory/types';
import { RequestContext } from '../../request-context';
import type { AnyWorkspace } from '../../workspace/workspace';
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
  ProcessorMessageContext,
} from '../index';
import { describeError, FILE_UPLOAD_ERROR_CODES, FileUploadError } from './file-upload-errors';
import type { FileUploadFailureDetails, FileUploadTripwireMetadata } from './file-upload-errors';
import { resolveWritableSandbox, uploadFiles } from './file-upload-writer';

export { FILE_UPLOAD_ERROR_CODES } from './file-upload-errors';
export type { FileUploadErrorCode, FileUploadTripwireMetadata } from './file-upload-errors';

/** @internal Shared with `UnsupportedFileHandler`. */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** What the processor knows about a file before reading its bytes. Passed to `filter` and `maxFileSize`. */
export interface FileUploadFileInfo {
  /** Name the file was sent with; `undefined` when it has none. */
  fileName?: string;
  /** MIME type in lower case and without parameters: `Text/Plain; charset=utf-8` becomes `text/plain`. */
  mimeType: string;
  /** Lower-cased extension without the dot; `undefined` when the file has no name or no extension. */
  extension?: string;
}

/** Returns `true` to upload the file, `false` to leave it to the model. */
export type FileUploadFilter = (file: FileUploadFileInfo) => boolean | Promise<boolean>;

/** Returns the largest accepted size, in bytes, for a file. */
export type FileUploadMaxFileSize = (file: FileUploadFileInfo) => number;

export interface FileUploadProcessorOptions {
  /** Workspace whose sandbox receives the uploaded files. Pass the same workspace as the agent's. */
  workspace: AnyWorkspace;
  /**
   * Called for each file sent by the user: `true` uploads it, `false` leaves it to the model.
   * Without a filter, every file is uploaded. It runs more than once for the same file, so keep it pure.
   */
  filter?: FileUploadFilter;
  /**
   * Returns the largest accepted size, in bytes, for a file. Defaults to 10 MB for every file.
   * It runs more than once for the same file, so keep it pure.
   */
  maxFileSize?: FileUploadMaxFileSize;
}

type Abort = ProcessInputArgs<FileUploadTripwireMetadata>['abort'];

/**
 * Uploads the files a user sends to the workspace sandbox, and gives the model
 * a note with the sandbox path in place of each file, so the model never
 * receives the bytes. Only the prompt sent to the model changes: the stored
 * messages keep their files.
 *
 * A file of the current turn that can't be uploaded stops the turn through
 * `abort()`: read the reason from `result.tripwire.metadata.code` and compare
 * it to `FILE_UPLOAD_ERROR_CODES`. A file of the thread history that can't be
 * uploaded is replaced by a note saying why, and the turn goes on.
 *
 * @example
 * ```typescript
 * const workspace = new Workspace({ sandbox });
 *
 * const agent = new Agent({
 *   // ...
 *   workspace,
 *   inputProcessors: [
 *     new FileUploadProcessor({ workspace, filter: ({ mimeType }) => !mimeType.startsWith('image/') }),
 *   ],
 * });
 * ```
 */
export class FileUploadProcessor implements Processor<'file-upload', FileUploadTripwireMetadata> {
  readonly id = 'file-upload' as const;
  readonly name = 'File Upload';

  private readonly workspace: AnyWorkspace;
  private readonly filter?: FileUploadFilter;
  private readonly maxFileSize: FileUploadMaxFileSize;

  constructor(options: FileUploadProcessorOptions) {
    assertSandboxConfigured(options?.workspace);
    this.workspace = options.workspace;
    this.filter = options.filter;
    this.maxFileSize = options.maxFileSize ?? (() => DEFAULT_MAX_FILE_SIZE);
  }

  async processInput(args: ProcessInputArgs<FileUploadTripwireMetadata>): Promise<MessageList> {
    await this.checkNewFiles(args);
    return args.messageList;
  }

  // A signal delivered to a run that is already active only shows up here, never in `processInput`.
  async processInputStep(args: ProcessInputStepArgs<FileUploadTripwireMetadata>): Promise<void> {
    await this.checkNewFiles(args);
  }

  /**
   * Checks the files of the new messages, as they were sent, before the prompt
   * is built: a file of this turn that can't be uploaded stops the turn here,
   * before anything is written. Nothing is changed.
   */
  private async checkNewFiles({ messageList, abort }: ProcessorMessageContext<FileUploadTripwireMetadata>) {
    try {
      const accepted = await selectFiles(newFiles(messageList), this.filter);
      const planned = accepted.map(candidate => planFile(candidate, this.maxFileSize));
      planned.forEach(loadPlannedFile);
    } catch (error) {
      return this.failOn(error, abort);
    }
  }

  /**
   * Uploads every file of the prompt the filter accepts, history included,
   * and replaces it with a note in this call's prompt only. Runs before each
   * model call, so it also sees files that reached the prompt without going
   * through the hooks above, like the signals a durable run receives before its
   * first model call, or links Mastra downloads for the model.
   */
  async processLLMRequest({
    prompt,
    messageList,
    requestContext = new RequestContext(),
    abort,
    abortSignal,
    state,
  }: ProcessLLMRequestArgs<FileUploadTripwireMetadata>): Promise<ProcessLLMRequestResult> {
    try {
      const files = await selectFiles(
        promptFiles(prompt, () => namesByContent(messageList)),
        this.filter,
      );
      if (files.length === 0) return;
      const currentTurn = currentTurnContents(messageList);
      const notes = await uploadPromptFiles(files, {
        workspace: this.workspace,
        requestContext,
        maxFileSize: this.maxFileSize,
        cache: cacheOf(state),
        abortSignal,
        // A file of the thread history must never block the thread: only a file of this turn stops it.
        noteSandboxFailures: !files.some(file => isOfCurrentTurn(file, currentTurn)),
      });
      return { prompt: replaceParts(prompt, notes) };
    } catch (error) {
      return this.failOn(error, abort);
    }
  }

  // Only a `FileUploadError` is a reason to stop the turn; anything else is a bug and propagates.
  private failOn(error: unknown, abort: Abort): never {
    if (!(error instanceof FileUploadError)) throw error;
    return abort(error.message, { metadata: { processorId: this.id, code: error.code, ...error.details } });
  }
}

// A workspace without any sandbox can never work: say so when the app starts, not on the first call.
function assertSandboxConfigured(workspace: AnyWorkspace | undefined): void {
  if (workspace?.hasSandboxConfig()) return;
  throw new MastraError({
    id: 'FILE_UPLOAD_PROCESSOR_NO_SANDBOX',
    domain: ErrorDomain.MASTRA,
    category: ErrorCategory.USER,
    text: 'FileUploadProcessor requires a workspace with a sandbox to upload files to.',
    details: { code: FILE_UPLOAD_ERROR_CODES.NO_SANDBOX },
  });
}

const SHARED_DIRECTORY = 'shared';

// Each thread gets its own directory, so identical bytes from two threads never share a path.
function uploadDirectoryOf(requestContext: RequestContext): string {
  const memory = parseMemoryRequestContext(requestContext);
  return memory?.thread?.id ?? memory?.resourceId ?? SHARED_DIRECTORY;
}

const describeFile = (fileName: string | undefined): string =>
  fileName ? `File "${toDisplayName(fileName)}"` : 'An unnamed file';

// ---------------------------------------------------------------------------
// Files of the new messages, as they were sent
// ---------------------------------------------------------------------------

/** A file found in a new user or signal message. */
interface FileCandidate {
  message: MastraDBMessage;
  data: unknown;
  mimeType: string;
  fileName?: string;
}

/** A file whose bytes were sent with the message, as base64 or a data URL. */
type InlineFileCandidate = FileCandidate & { data: string };

const UPLOAD_ROLES = new Set<string>(['user', 'signal']);
const DEFAULT_MIME_TYPE = 'application/octet-stream';

// Only files sent inline are checked here; a link is only known once Mastra downloads it for the model.
const newFiles = (messageList: MessageList): InlineFileCandidate[] =>
  collectCandidates(listNewMessages(messageList)).filter(isInline);

/** Messages added during this request; recalled history is never included. */
function listNewMessages(messageList: MessageList): MastraDBMessage[] {
  return messageList.getPersisted.input.db().filter(message => UPLOAD_ROLES.has(message.role));
}

function collectCandidates(messages: MastraDBMessage[]): FileCandidate[] {
  return messages.flatMap(message => {
    const fromParts = candidatesFromParts(message);
    return [...fromParts, ...candidatesFromAttachments(message, new Set(fromParts.map(file => file.data)))];
  });
}

function candidatesFromParts(message: MastraDBMessage): FileCandidate[] {
  return message.content.parts.flatMap(part => {
    if (part.type !== 'file') return [];
    const { mediaType, data } = resolveFilePartMediaTypeAndData(part);
    const fileName = (part as { filename?: unknown }).filename;
    return [
      {
        message,
        data,
        mimeType: mediaType ?? DEFAULT_MIME_TYPE,
        fileName: typeof fileName === 'string' ? fileName : undefined,
      },
    ];
  });
}

// AI SDK v4 UI messages carry files only as attachments, with no file part.
function candidatesFromAttachments(message: MastraDBMessage, alreadyInParts: Set<unknown>): FileCandidate[] {
  return (message.content.experimental_attachments ?? [])
    .filter(attachment => !alreadyInParts.has(attachment.url))
    .map(attachment => ({
      message,
      data: attachment.url,
      mimeType: attachment.contentType ?? DEFAULT_MIME_TYPE,
      fileName: attachment.name,
    }));
}

function isInline(candidate: FileCandidate): candidate is InlineFileCandidate {
  return typeof candidate.data === 'string' && isInlineData(candidate.data);
}

/**
 * The processor never downloads anything, so a server-side request can't be
 * pointed at an internal address: a link or a provider file ID is left to the
 * model.
 */
function isInlineData(data: string): boolean {
  const { type } = categorizeFileData(data);
  return type === 'dataUri' || type === 'raw';
}

// ---------------------------------------------------------------------------
// Files of the prompt
// ---------------------------------------------------------------------------

type PromptUserMessage = Extract<LanguageModelV2Prompt[number], { role: 'user' }>;
/** @internal */
export type PromptFilePart = Extract<PromptUserMessage['content'][number], { type: 'file' }>;

/**
 * A file the user sent, as the model is about to receive it.
 *
 * @internal Shared with `UnsupportedFileHandler`.
 */
export interface PromptFile {
  part: PromptFilePart;
  /** Base64 text, or the bytes of a link Mastra downloaded for the model. */
  data: string | Uint8Array;
  mimeType: string;
  fileName?: string;
}

interface ReadyFile {
  file: PromptFile;
  hash: string;
  size: number;
  relativePath: string;
}

/** What one request remembers between its model calls. */
export interface UploadCache {
  /** Upload path relative to the command directory, mapped to the path the file was placed at. */
  paths: Map<string, string>;
  /** Hash and size of the data of a prompt file, so later calls don't decode it again. */
  digests: Map<string | Uint8Array, { hash: string; size: number }>;
}

/** @internal Shared with `UnsupportedFileHandler`. */
export interface PromptUploadOptions {
  workspace: AnyWorkspace;
  requestContext: RequestContext;
  maxFileSize: FileUploadMaxFileSize;
  cache: UploadCache;
  abortSignal?: AbortSignal;
  /** When the sandbox can't take the files, note why instead of throwing. */
  noteSandboxFailures?: boolean;
}

/** The failures that come from the sandbox rather than from a file or from user code. */
const SANDBOX_FAILURES = new Set<string>([
  FILE_UPLOAD_ERROR_CODES.NO_SANDBOX,
  FILE_UPLOAD_ERROR_CODES.NO_WRITE_CAPABILITY,
  FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED,
]);

/**
 * Uploads the files and returns, for each one, the note that replaces it in
 * the prompt. A file that is too large or can't be decoded gets a note saying
 * why. A setup problem throws a `FileUploadError` and uploads nothing, unless
 * `noteSandboxFailures` turns a sandbox failure into notes.
 *
 * @internal Shared with `UnsupportedFileHandler`.
 */
export async function uploadPromptFiles(
  files: PromptFile[],
  { workspace, requestContext, maxFileSize, cache, abortSignal, noteSandboxFailures }: PromptUploadOptions,
): Promise<Map<PromptFilePart, string>> {
  const directory = uploadDirectoryOf(requestContext);
  const notes = new Map<PromptFilePart, string>();
  const ready: ReadyFile[] = [];
  for (const file of files) {
    const loaded = loadPromptFile(file, maxFileSize, cache);
    if ('rejection' in loaded) notes.set(file.part, rejectedNote(file.fileName, loaded.rejection));
    else ready.push({ file, ...loaded, relativePath: buildUploadPath({ ...file, directory, hash: loaded.hash }) });
  }
  let sandboxFailure: string | undefined;
  try {
    await placeFiles(ready, workspace, requestContext, cache, abortSignal);
  } catch (error) {
    if (!noteSandboxFailures || !(error instanceof FileUploadError) || !SANDBOX_FAILURES.has(error.code)) throw error;
    sandboxFailure = error.message;
  }
  // After a sandbox failure, only the paths placed earlier in the request are in the cache.
  for (const { file, relativePath, size } of ready) {
    const path = cache.paths.get(relativePath);
    notes.set(
      file.part,
      path ? uploadedNote({ ...file, path, size }) : rejectedNote(file.fileName, sandboxFailure ?? 'not uploaded'),
    );
  }
  return notes;
}

// Each path is named after the content, so a path already placed during this request needs nothing more.
async function placeFiles(
  ready: ReadyFile[],
  workspace: AnyWorkspace,
  requestContext: RequestContext,
  cache: UploadCache,
  abortSignal?: AbortSignal,
): Promise<void> {
  const pending = new Map<string, { path: string; content: Buffer }>();
  for (const { file, relativePath } of ready) {
    if (cache.paths.has(relativePath) || pending.has(relativePath)) continue;
    pending.set(relativePath, { path: relativePath, content: decodePromptData(file) });
  }
  if (pending.size === 0) return;
  const sandbox = await resolveWritableSandbox(workspace, requestContext);
  const placed = await uploadFiles(sandbox, [...pending.values()], abortSignal);
  [...pending.keys()].forEach((relativePath, index) => cache.paths.set(relativePath, placed[index]!.path));
}

/** @internal Shared with `UnsupportedFileHandler`. */
export function cacheOf(state: Record<string, unknown>): UploadCache {
  state.uploads ??= { paths: new Map(), digests: new Map() } satisfies UploadCache;
  return state.uploads as UploadCache;
}

// Files produced by the assistant or returned by tools are the agent's own; only the user's are uploaded.
/** @internal Shared with `UnsupportedFileHandler`. */
export function promptFiles(prompt: LanguageModelV2Prompt, lookUpNames: () => Map<string, string>): PromptFile[] {
  let names: Map<string, string> | undefined;
  const nameOf = (data: string | Uint8Array) =>
    typeof data === 'string' ? (names ??= lookUpNames()).get(data.replace(/\s+/g, '')) : undefined;
  return prompt.flatMap(message =>
    message.role !== 'user'
      ? []
      : message.content.flatMap(part => {
          if (part.type !== 'file') return [];
          const { data } = part;
          if (!(data instanceof Uint8Array) && !(typeof data === 'string' && isInlineData(data))) return [];
          return [{ part, data, mimeType: part.mediaType, fileName: part.filename ?? nameOf(data) }];
        }),
  );
}

/**
 * Base64 content of the inline files of the new messages, to tell a file of
 * this turn from one of the thread history in the prompt. A link Mastra
 * downloads has no base64 to match, so it counts as history.
 */
function currentTurnContents(messageList: MessageList | undefined): Set<string> {
  const contents = new Set<string>();
  for (const { data } of messageList ? newFiles(messageList) : []) {
    const { isDataUri, base64Content } = parseDataUri(data);
    if (isDataUri && !BASE64_DATA_URI.test(data)) continue;
    contents.add(base64Content.replace(/\s+/g, ''));
  }
  return contents;
}

const isOfCurrentTurn = ({ data }: PromptFile, currentTurn: Set<string>) =>
  typeof data === 'string' && currentTurn.has(data.replace(/\s+/g, ''));

/**
 * Names of the files of the messages, by their base64 content. The prompt
 * drops the name of a file sent as an attachment (AI SDK v4 UI messages), and
 * `filter` must see the same name it saw when the file was checked.
 *
 * @internal Shared with `UnsupportedFileHandler`.
 */
export function namesByContent(messageList: MessageList | undefined): Map<string, string> {
  const names = new Map<string, string>();
  for (const { data, fileName } of collectCandidates(messageList?.get.all.db() ?? [])) {
    if (!fileName || typeof data !== 'string' || !isInlineData(data)) continue;
    const { isDataUri, base64Content } = parseDataUri(data);
    // A percent-encoded data URL reaches the prompt re-encoded, so its text can't be matched.
    if (isDataUri && !BASE64_DATA_URI.test(data)) continue;
    names.set(base64Content.replace(/\s+/g, ''), fileName);
  }
  return names;
}

/**
 * Checks a prompt file and reads its hash and size. A file that is too large or
 * can't be decoded is turned into a rejection instead of stopping the turn:
 * stored in the thread, it would stop every turn after this one. A file of
 * this turn never gets here in that state, `checkNewFiles` stopped the turn.
 */
function loadPromptFile(
  file: PromptFile,
  maxFileSize: FileUploadMaxFileSize,
  cache: UploadCache,
): { hash: string; size: number } | { rejection: string } {
  const limit = resolveMaxFileSize(file, maxFileSize);
  const cached = cache.digests.get(file.data);
  if (cached) return cached.size > limit ? { rejection: tooLarge(file, cached.size, limit).message } : cached;
  const encodedSize = typeof file.data === 'string' ? decodedSizeOf(file.data) : file.data.byteLength;
  if (encodedSize > limit) return { rejection: tooLarge(file, encodedSize, limit).message };
  let content: Buffer;
  try {
    content = decodePromptData(file);
  } catch (error) {
    if (error instanceof FileUploadError) return { rejection: error.message };
    throw error;
  }
  if (content.byteLength > limit) return { rejection: tooLarge(file, content.byteLength, limit).message };
  const digest = { hash: createHash('sha256').update(content).digest('hex'), size: content.byteLength };
  cache.digests.set(file.data, digest);
  return digest;
}

function decodePromptData({ data, fileName, mimeType }: PromptFile): Buffer {
  if (typeof data === 'string') return decodeInline(data, { fileName, mimeType });
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Swaps each replaced file part for a text part; the original prompt is left untouched.
 *
 * @internal Shared with `UnsupportedFileHandler`.
 */
export function replaceParts(prompt: LanguageModelV2Prompt, notes: Map<PromptFilePart, string>): LanguageModelV2Prompt {
  return prompt.map(message =>
    message.role !== 'user'
      ? message
      : {
          ...message,
          content: message.content.map(part => {
            const note = part.type === 'file' ? notes.get(part) : undefined;
            return note === undefined ? part : { type: 'text' as const, text: note };
          }),
        },
  );
}

// The path comes first: it is the line the model has to copy exactly.
function uploadedNote({ path, fileName, mimeType, size }: PromptFile & { path: string; size: number }): string {
  return [
    '[File uploaded to the sandbox]',
    `path: ${path}`,
    `name: ${toDisplayName(fileName)}`,
    `type: ${normalizeMimeType(mimeType)}`,
    `size: ${size} bytes`,
  ].join('\n');
}

function rejectedNote(fileName: string | undefined, reason: string): string {
  return ['[File not uploaded]', `name: ${toDisplayName(fileName)}`, `reason: ${reason}`].join('\n');
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

interface DescribedFile {
  fileName?: string;
  mimeType: string;
}

function fileInfoOf({ fileName, mimeType }: DescribedFile): FileUploadFileInfo {
  return { fileName, mimeType: normalizeMimeType(mimeType), extension: extensionOf(fileName) };
}

/** Lower-cased extension of the last path segment, without the dot. */
function extensionOf(fileName: string | undefined): string | undefined {
  const lastSegment = fileName?.split(/[\\/]/).pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < lastSegment.length - 1 ? lastSegment.slice(dotIndex + 1).toLowerCase() : undefined;
}

/** `text/plain; charset=utf-8` is the same type as `text/plain`. */
function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase();
}

/**
 * Keeps the files the filter accepts; without a filter, every file is kept.
 * Every answer is awaited, and an invalid one reports the first file in order.
 */
async function selectFiles<T extends DescribedFile>(files: T[], filter?: FileUploadFilter): Promise<T[]> {
  if (!filter || files.length === 0) return files;
  const verdicts = await Promise.allSettled(files.map(file => askFilter(filter, file)));
  const invalid = verdicts.find(verdict => verdict.status === 'rejected');
  if (invalid) throw invalid.reason;
  return files.filter((_, index) => (verdicts[index] as PromiseFulfilledResult<boolean>).value);
}

// `filter` is user code: an answer that is not a boolean must stop the turn, not decide for it.
async function askFilter(filter: FileUploadFilter, { fileName, mimeType }: DescribedFile): Promise<boolean> {
  const invalid = (cause: string) =>
    new FileUploadError(
      FILE_UPLOAD_ERROR_CODES.INVALID_FILTER,
      `filter must return true or false; it did not for ${describeFile(fileName)}.`,
      { fileName, mimeType, cause },
    );
  let verdict: unknown;
  try {
    verdict = await filter(fileInfoOf({ fileName, mimeType }));
  } catch (error) {
    throw invalid(describeError(error));
  }
  if (typeof verdict !== 'boolean') throw invalid(String(verdict));
  return verdict;
}

// ---------------------------------------------------------------------------
// Size checks and decoding
// ---------------------------------------------------------------------------

const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/;
const BASE64_DATA_URI = /^data:[^,]*;base64,/i;

interface PlannedFile {
  candidate: InlineFileCandidate;
  maxFileSize: number;
}

/**
 * Nothing is decoded until every file has a limit, and a file over its limit
 * is refused from its encoded form, without being decoded.
 */
function planFile(candidate: InlineFileCandidate, maxFileSize: FileUploadMaxFileSize): PlannedFile {
  const limit = resolveMaxFileSize(candidate, maxFileSize);
  const size = decodedSizeOf(candidate.data);
  if (size > limit) throw tooLarge(candidate, size, limit);
  return { candidate, maxFileSize: limit };
}

// `maxFileSize` is user code: a wrong value must stop the turn, not silently lift the limit.
function resolveMaxFileSize(file: DescribedFile, maxFileSize: FileUploadMaxFileSize): number {
  const invalid = (cause: string) =>
    new FileUploadError(
      FILE_UPLOAD_ERROR_CODES.INVALID_MAX_FILE_SIZE,
      `maxFileSize must return a non-negative number of bytes; it did not for ${describeFile(file.fileName)}.`,
      { ...fileDetails(file), cause },
    );
  let limit: unknown;
  try {
    limit = maxFileSize(fileInfoOf(file));
  } catch (error) {
    throw invalid(describeError(error));
  }
  // Written so that `NaN` fails the check too.
  if (typeof limit !== 'number' || !(limit >= 0)) throw invalid(String(limit));
  return limit;
}

function loadPlannedFile({ candidate, maxFileSize }: PlannedFile): Buffer {
  const content = decodeInline(candidate.data, fileDetails(candidate));
  if (content.byteLength > maxFileSize) throw tooLarge(candidate, content.byteLength, maxFileSize);
  return content;
}

const tooLarge = (file: DescribedFile, size: number, maxFileSize: number) =>
  new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
    `${describeFile(file.fileName)} is ${size} bytes, over the ${maxFileSize} byte limit.`,
    { ...fileDetails(file), size, maxFileSize },
  );

const fileDetails = ({ fileName, mimeType }: DescribedFile) => ({ fileName, mimeType });

/**
 * Decoded size of inline data, computed from its encoded form without decoding
 * it, so a file over its limit is never loaded. Exact for valid data; invalid
 * data is still refused when it's decoded.
 */
function decodedSizeOf(data: string): number {
  const { isDataUri, base64Content } = parseDataUri(data);
  if (isDataUri && !BASE64_DATA_URI.test(data)) return percentDecodedSizeOf(base64Content);
  return Buffer.byteLength(base64Content.replace(/\s+/g, ''), 'base64');
}

/**
 * Size in bytes of percent-encoded text once decoded, without decoding it.
 *
 * Decoding turns each `%XX` escape into exactly one byte, and every other
 * character into its UTF-8 bytes. Replacing each escape with a one-byte
 * placeholder and measuring the UTF-8 length therefore gives the same count:
 * `caf%C3%A9` becomes `caf__`, 5 bytes, like the decoded `café`.
 */
function percentDecodedSizeOf(content: string): number {
  return Buffer.byteLength(content.replace(/%[0-9a-f]{2}/gi, '_'), 'utf8');
}

function decodeInline(data: string, file: FileUploadFailureDetails): Buffer {
  const { isDataUri, base64Content } = parseDataUri(data);
  if (isDataUri && !data.includes(',')) throw invalidData(file);
  const isPercentEncoded = isDataUri && !BASE64_DATA_URI.test(data);
  return isPercentEncoded ? decodePercentEncoded(base64Content, file) : decodeBase64(base64Content, file);
}

// `Buffer.from(..., 'base64')` drops what it cannot read, so the input is checked first.
function decodeBase64(content: string, file: FileUploadFailureDetails): Buffer {
  const compact = content.replace(/\s+/g, '');
  if (!BASE64.test(compact)) throw invalidData(file);
  return Buffer.from(compact, 'base64');
}

function decodePercentEncoded(content: string, file: FileUploadFailureDetails): Buffer {
  try {
    return Buffer.from(decodeURIComponent(content));
  } catch {
    throw invalidData(file);
  }
}

const invalidData = (file: FileUploadFailureDetails) =>
  new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.INVALID_FILE_DATA,
    `${describeFile(file.fileName)} has inline data that cannot be decoded.`,
    file,
  );

// ---------------------------------------------------------------------------
// Upload paths and display names
// ---------------------------------------------------------------------------

const UPLOADS_DIRECTORY = 'uploads';

const FALLBACK_DISPLAY_NAME = 'unnamed file';
const MAX_DIRECTORY_LENGTH = 100;
const MAX_EXTENSION_LENGTH = 16;
const MAX_DISPLAY_LENGTH = 200;

const ANSI_ESCAPE_SEQUENCES = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const DIACRITICS = /[̀-ͯ]/g;

/** Extensions for files sent without a name; anything else is written without one. */
const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
};

interface UploadPathInput {
  /** Thread, resource, or shared directory the file is filed under. */
  directory: string;
  /** SHA-256 of the content, in hex. */
  hash: string;
  fileName?: string;
  mimeType: string;
}

/**
 * `uploads/<directory>/<sha256>.<ext>`. Nothing of the original name is kept
 * but its extension: a model shown a path that looks like the name can retype
 * one from the other, and ask the sandbox for a file that does not exist. The
 * hash makes the same bytes land on the same path, so they are written once.
 *
 * @internal Exported for its unit tests.
 */
export function buildUploadPath({ directory, hash, fileName, mimeType }: UploadPathInput): string {
  const extension = safeExtensionOf(fileName, mimeType);
  return `${UPLOADS_DIRECTORY}/${toSafeDirectory(directory)}/${hash}${extension ? `.${extension}` : ''}`;
}

/**
 * The name as sent, minus anything that could forge lines or colors where it is displayed.
 *
 * @internal Exported for its unit tests.
 */
export function toDisplayName(fileName: string | undefined): string {
  return stripUnprintable(fileName ?? '').slice(0, MAX_DISPLAY_LENGTH) || FALLBACK_DISPLAY_NAME;
}

// A file sent without a name takes its extension from its MIME type.
function safeExtensionOf(fileName: string | undefined, mimeType: string): string {
  const readable = stripUnprintable(fileName ?? '');
  if (!readable) return EXTENSIONS_BY_MIME_TYPE[normalizeMimeType(mimeType)] ?? '';
  return toSafeExtension(extensionOf(readable));
}

function stripUnprintable(value: string): string {
  return value.replace(ANSI_ESCAPE_SEQUENCES, '').replace(CONTROL_CHARACTERS, '');
}

// Only `[A-Za-z0-9._-]` survives, so the result is safe in a path and in a shell
// command. Path separators and `..` become `_`, which keeps the files in `uploads/`.
function toSafeDirectory(directory: string): string {
  const safe = directory
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_DIRECTORY_LENGTH);
  return safe || SHARED_DIRECTORY;
}

function toSafeExtension(extension: string | undefined): string {
  return (extension ?? '').replace(/[^a-z0-9]/g, '').slice(0, MAX_EXTENSION_LENGTH);
}
