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
  Processor,
  ProcessorMessageContext,
} from '../index';
import { describeError, FILE_UPLOAD_ERROR_CODES, FileUploadError } from './file-upload-errors';
import type { FileUploadFailureDetails, FileUploadTripwireMetadata } from './file-upload-errors';
import { resolveWritableSandbox, writeFilesToSandbox } from './file-upload-writer';

export { FILE_UPLOAD_ERROR_CODES } from './file-upload-errors';
export type { FileUploadErrorCode, FileUploadTripwireMetadata } from './file-upload-errors';

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

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

/** What is recorded in the message metadata about an uploaded file. */
export interface FileUploadRecord {
  /** Name the file was sent with; absent when it had none. */
  name?: string;
  /** Path of the file in the sandbox, relative to its working directory. */
  path: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
}

export interface FileUploadProcessorOptions {
  /** Workspace whose sandbox receives the uploaded files. Pass the same workspace as the agent's. */
  workspace: AnyWorkspace;
  /**
   * Called for each file of a new user message: `true` uploads it, `false` leaves it to the model.
   * Without a filter, every file is uploaded. It can run more than once for the same file, so keep it pure.
   */
  filter?: FileUploadFilter;
  /** Returns the largest accepted size, in bytes, for a file. Defaults to 10 MB for every file. */
  maxFileSize?: FileUploadMaxFileSize;
}

type Abort = ProcessInputArgs<FileUploadTripwireMetadata>['abort'];

/**
 * Uploads files found in new user messages to the workspace sandbox and
 * replaces each one with a text reference to its sandbox path, so the model
 * never receives the bytes.
 *
 * Every failure stops the turn through `abort()`: read the reason from
 * `result.tripwire.metadata.code` and compare it to `FILE_UPLOAD_ERROR_CODES`.
 *
 * @example
 * ```typescript
 * const workspace = new Workspace({ sandbox });
 *
 * const agent = new Agent({
 *   // ...
 *   memory,
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
    await this.uploadNewFiles(args);
    return args.messageList;
  }

  // A signal delivered to a run that is already active only shows up here, never in `processInput`.
  async processInputStep(args: ProcessInputStepArgs<FileUploadTripwireMetadata>): Promise<void> {
    await this.uploadNewFiles(args);
  }

  // Scorers, agent networks and calls without a thread run input processors too,
  // so a turn without a file to upload is left alone: nothing is checked.
  private async uploadNewFiles({
    messageList,
    requestContext = new RequestContext(),
    abort,
    abortSignal,
  }: ProcessorMessageContext<FileUploadTripwireMetadata>): Promise<void> {
    const files = newFiles(messageList);
    // A failing filter rejects every file of the turn; a later failure only the files it accepted.
    let affected: FileCandidate[] = files;
    try {
      const accepted = await selectFiles(files, this.filter);
      if (accepted.length === 0) return;
      affected = accepted;
      assertWritableMemory(requestContext);
      await this.upload(accepted, requestContext, abortSignal);
    } catch (error) {
      return this.failOn(error, abort, affected);
    }
  }

  // Last line of defense: a file of this request that the filter accepts but that is still in a
  // message stops the call here. On a durable agent, the signals queued before the first model
  // call are added after the hooks above ran, so this is the only place that sees them. Files of the
  // thread history are left alone, so threads from before the processor keep working. Without a
  // message list, new files can't be told from the history, so nothing is checked.
  async processLLMRequest({ messageList, abort }: ProcessLLMRequestArgs<FileUploadTripwireMetadata>): Promise<void> {
    if (!messageList) return;
    const files = newFiles(messageList);
    let leaked: InlineFileCandidate[];
    try {
      leaked = await selectFiles(files, this.filter);
    } catch (error) {
      return this.failOn(error, abort, files);
    }
    const [file] = leaked;
    if (!file) return;
    return this.fail(
      abort,
      leaked,
      new FileUploadError(
        FILE_UPLOAD_ERROR_CODES.FILE_NOT_UPLOADED,
        `${describeFile(file.fileName)} is accepted by the filter but was not uploaded, so the model call was stopped.`,
        { fileName: file.fileName, mimeType: file.mimeType },
      ),
    );
  }

  private async upload(
    candidates: InlineFileCandidate[],
    requestContext: RequestContext,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const sandbox = await resolveWritableSandbox(this.workspace, requestContext);
    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    if (!threadId) throw memoryRequired();
    const prepared = prepareFiles(candidates, this.maxFileSize, threadId);
    const written = await writeFilesToSandbox(sandbox, prepared, abortSignal);
    written.forEach(applyUploadedNote);
  }

  // Only a `FileUploadError` is a reason to stop the turn; anything else is a bug and propagates.
  private failOn(error: unknown, abort: Abort, candidates: FileCandidate[]): never {
    if (error instanceof FileUploadError) return this.fail(abort, candidates, error);
    throw error;
  }

  /**
   * The only place the processor stops a turn. Every file of the turn is
   * replaced by a note first: an aborted turn can still be stored, and a raw
   * file left in the thread would reach the model on the next turn.
   */
  private fail(abort: Abort, candidates: FileCandidate[], { code, message, details }: FileUploadError): never {
    candidates.forEach(candidate => markRejected(candidate, message));
    return abort(message, { metadata: { processorId: this.id, code, ...details } });
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

// Without a writable thread the replaced message is not stored, and the client
// would send the original file again on the next turn.
function assertWritableMemory(requestContext: RequestContext): void {
  const memory = parseMemoryRequestContext(requestContext);
  if (!memory?.thread?.id || memory.memoryConfig?.readOnly) throw memoryRequired();
}

const memoryRequired = () =>
  new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.MEMORY_REQUIRED,
    'FileUploadProcessor requires an agent with memory and a thread that is not read-only.',
  );

const describeFile = (fileName: string | undefined): string =>
  fileName ? `File "${toDisplayName(fileName)}"` : 'An unnamed file';

// ---------------------------------------------------------------------------
// Files of the new messages
// ---------------------------------------------------------------------------

type MessagePart = MastraDBMessage['content']['parts'][number];

/** A file found in a new user or signal message. */
interface FileCandidate {
  message: MastraDBMessage;
  /** The file part to replace; absent when the file only exists as an attachment. */
  part?: MessagePart;
  data: unknown;
  mimeType: string;
  fileName?: string;
}

/** A file whose bytes were sent with the message, as base64 or a data URL. */
type InlineFileCandidate = FileCandidate & { data: string };

const UPLOAD_ROLES = new Set<string>(['user', 'signal']);
const DEFAULT_MIME_TYPE = 'application/octet-stream';

// Only files sent inline are handled; links stay in the message for the model.
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
        part,
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

/**
 * The processor only handles files sent inline. A URL or a provider file ID is
 * never fetched, so a server-side request can't be pointed at an internal
 * address: the file stays in the message and the model receives it as usual.
 */
function isInline(candidate: FileCandidate): candidate is InlineFileCandidate {
  if (typeof candidate.data !== 'string') return false;
  const { type } = categorizeFileData(candidate.data);
  return type === 'dataUri' || type === 'raw';
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

function fileInfoOf({ fileName, mimeType }: { fileName?: string; mimeType: string }): FileUploadFileInfo {
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
async function selectFiles<T extends FileCandidate>(files: T[], filter?: FileUploadFilter): Promise<T[]> {
  if (!filter || files.length === 0) return files;
  const verdicts = await Promise.allSettled(files.map(file => askFilter(filter, file)));
  const invalid = verdicts.find(verdict => verdict.status === 'rejected');
  if (invalid) throw invalid.reason;
  return files.filter((_, index) => (verdicts[index] as PromiseFulfilledResult<boolean>).value);
}

// `filter` is user code: an answer that is not a boolean must stop the turn, not decide for it.
async function askFilter(filter: FileUploadFilter, { fileName, mimeType }: FileCandidate): Promise<boolean> {
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

/** A file whose bytes are loaded, checked, and ready to be written to the sandbox. */
interface PreparedFile {
  candidate: FileCandidate;
  path: string;
  content: Buffer;
}

interface PlannedFile {
  candidate: InlineFileCandidate;
  maxFileSize: number;
}

/**
 * Checks and decodes every file before the first write: one bad file stops the
 * whole turn. Nothing is decoded until every file has a limit, and a file over
 * its limit is refused from its encoded form, without being decoded.
 */
function prepareFiles(
  candidates: InlineFileCandidate[],
  maxFileSize: FileUploadMaxFileSize,
  threadId: string,
): PreparedFile[] {
  const planned = candidates.map(candidate => planFile(candidate, maxFileSize));
  return planned.map(file => loadPlannedFile(file, threadId));
}

function planFile(candidate: InlineFileCandidate, maxFileSize: FileUploadMaxFileSize): PlannedFile {
  const limit = resolveMaxFileSize(candidate, maxFileSize);
  const size = decodedSizeOf(candidate.data);
  if (size > limit) throw tooLarge(candidate, size, limit);
  return { candidate, maxFileSize: limit };
}

// `maxFileSize` is user code: a wrong value must stop the turn, not silently lift the limit.
function resolveMaxFileSize(candidate: FileCandidate, maxFileSize: FileUploadMaxFileSize): number {
  const { fileName, mimeType } = candidate;
  const invalid = (cause: string) =>
    new FileUploadError(
      FILE_UPLOAD_ERROR_CODES.INVALID_MAX_FILE_SIZE,
      `maxFileSize must return a non-negative number of bytes; it did not for ${describeFile(fileName)}.`,
      { ...fileDetails(candidate), cause },
    );
  let limit: unknown;
  try {
    limit = maxFileSize(fileInfoOf({ fileName, mimeType }));
  } catch (error) {
    throw invalid(describeError(error));
  }
  // Written so that `NaN` fails the check too.
  if (typeof limit !== 'number' || !(limit >= 0)) throw invalid(String(limit));
  return limit;
}

function loadPlannedFile({ candidate, maxFileSize }: PlannedFile, threadId: string): PreparedFile {
  const content = decodeInline(candidate.data, fileDetails(candidate));
  const size = content.byteLength;
  if (size > maxFileSize) throw tooLarge(candidate, size, maxFileSize);
  const path = buildUploadPath({ ...fileDetails(candidate), threadId, uuid: globalThis.crypto.randomUUID() });
  return { candidate, path, content };
}

const tooLarge = (candidate: FileCandidate, size: number, maxFileSize: number) =>
  new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
    `${describeFile(candidate.fileName)} is ${size} bytes, over the ${maxFileSize} byte limit.`,
    { ...fileDetails(candidate), size, maxFileSize },
  );

const fileDetails = ({ fileName, mimeType }: FileCandidate) => ({ fileName, mimeType });

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

const FALLBACK_THREAD_DIRECTORY = 'thread';
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
  /** Thread the file was sent in; each thread gets its own directory. */
  threadId: string;
  uuid: string;
  fileName?: string;
  mimeType: string;
}

/**
 * `uploads/<thread>/<uuid>.<ext>`. Nothing of the original name is kept but its
 * extension: a model shown a path that looks like the name can retype one from
 * the other, and ask the sandbox for a file that does not exist.
 *
 * @internal Exported for its unit tests.
 */
export function buildUploadPath({ threadId, uuid, fileName, mimeType }: UploadPathInput): string {
  const extension = safeExtensionOf(fileName, mimeType);
  return `${UPLOADS_DIRECTORY}/${toSafeDirectory(threadId)}/${uuid}${extension ? `.${extension}` : ''}`;
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
function toSafeDirectory(threadId: string): string {
  const safe = threadId
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_DIRECTORY_LENGTH);
  return safe || FALLBACK_THREAD_DIRECTORY;
}

function toSafeExtension(extension: string | undefined): string {
  return (extension ?? '').replace(/[^a-z0-9]/g, '').slice(0, MAX_EXTENSION_LENGTH);
}

// ---------------------------------------------------------------------------
// Notes that replace the files
// ---------------------------------------------------------------------------

/** Notes that stand in for attachment-only files; they keep their order at the start of the message. */
const attachmentNotes = new WeakSet<MessagePart>();

function applyUploadedNote({ candidate, path, content }: PreparedFile): void {
  const { fileName, mimeType } = candidate;
  markUploaded(candidate, { ...(fileName ? { name: fileName } : {}), path, mimeType, size: content.byteLength });
}

/** Replaces the file with a note for the model and records the upload for clients. */
function markUploaded(candidate: FileCandidate, upload: FileUploadRecord): void {
  replaceCandidate(candidate, formatUploadedNote(upload));
  const content = candidate.message.content;
  const previous = Array.isArray(content.metadata?.fileUploads) ? content.metadata.fileUploads : [];
  content.metadata = { ...content.metadata, fileUploads: [...previous, upload] };
}

/** Replaces the file with a note saying why it was not uploaded. */
function markRejected(candidate: FileCandidate, reason: string): void {
  const note = ['[File not uploaded]', `name: ${toDisplayName(candidate.fileName)}`, `reason: ${reason}`].join('\n');
  replaceCandidate(candidate, note);
}

// The path comes first: it is the line the model has to copy exactly.
function formatUploadedNote(file: FileUploadRecord): string {
  return [
    '[File uploaded to the sandbox]',
    `path: ${file.path}`,
    `name: ${toDisplayName(file.name)}`,
    `type: ${file.mimeType}`,
    `size: ${file.size} bytes`,
  ].join('\n');
}

/** Swaps the file for a text part, so the bytes can no longer reach the model. */
function replaceCandidate(candidate: FileCandidate, text: string): void {
  const { parts } = candidate.message.content;
  if (candidate.part) replacePart(parts, candidate.part, text);
  else insertAttachmentNote(parts, text);
  removeAttachmentsFor(candidate);
  syncTextMirror(candidate.message);
}

function replacePart(parts: MessagePart[], part: MessagePart, text: string): void {
  const index = parts.indexOf(part);
  if (index === -1) return;
  const createdAt = (part as { createdAt?: number }).createdAt;
  parts[index] = { type: 'text', text, ...(createdAt === undefined ? {} : { createdAt }) };
}

// An attachment has no position among the parts; the prompt puts attachments first, so do the notes.
function insertAttachmentNote(parts: MessagePart[], text: string): void {
  const note: MessagePart = { type: 'text', text };
  const firstOtherPart = parts.findIndex(part => !attachmentNotes.has(part));
  parts.splice(firstOtherPart === -1 ? parts.length : firstOtherPart, 0, note);
  attachmentNotes.add(note);
}

// The same bytes are mirrored in `experimental_attachments`; left in place they
// are turned back into a file part when the prompt is built.
function removeAttachmentsFor({ message, data }: FileCandidate): void {
  const attachments = message.content.experimental_attachments;
  if (!attachments) return;
  message.content.experimental_attachments = attachments.filter(attachment => attachment.url !== data);
}

function syncTextMirror(message: MastraDBMessage): void {
  if (typeof message.content.content !== 'string') return;
  message.content.content = message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('\n');
}
