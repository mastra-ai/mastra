import type { MessageList } from '../../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { parseMemoryRequestContext } from '../../memory/types';
import { RequestContext } from '../../request-context';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import type { AnyWorkspace } from '../../workspace/workspace';
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessLLMRequestArgs,
  Processor,
  ProcessorMessageContext,
} from '../index';
import { describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { FileUploadFailure, FileUploadTripwireMetadata, Result } from './file-upload-errors';
import { selectFiles } from './file-upload-filter';
import type { FileUploadFilter } from './file-upload-filter';
import { collectCandidates, listNewMessages, markRejected, markUploaded } from './file-upload-messages';
import type { FileCandidate } from './file-upload-messages';
import { prepareFiles } from './file-upload-prepare';
import type { FileUploadMaxFileSize, PreparedFile } from './file-upload-prepare';
import { isInline } from './file-upload-source';
import type { InlineFileCandidate } from './file-upload-source';
import { hasWriteCapability, writeFilesToSandbox } from './file-upload-writer';

export { FILE_UPLOAD_ERROR_CODES } from './file-upload-errors';
export type { FileUploadErrorCode, FileUploadTripwireMetadata } from './file-upload-errors';
export type { FileUploadFileInfo } from './file-upload-file-info';
export type { FileUploadFilter } from './file-upload-filter';
export type { FileUploadRecord } from './file-upload-messages';
export type { FileUploadMaxFileSize } from './file-upload-prepare';

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    const accepted = await selectFiles(files, this.filter);
    if (!accepted.ok) return this.fail(abort, files, accepted.failure);
    if (accepted.value.length === 0) return;
    const memory = checkMemory(requestContext);
    if (!memory.ok) return this.fail(abort, accepted.value, memory.failure);
    const uploaded = await this.upload(accepted.value, requestContext, abortSignal);
    if (!uploaded.ok) return this.fail(abort, accepted.value, uploaded.failure);
  }

  // Last line of defense: a file of this request that the filter accepts but that is still in a
  // message (a signal the hooks above never saw, for instance) stops the call here. Files of the
  // thread history are left alone, so threads from before the processor keep working. Without a
  // message list, new files can't be told from the history, so nothing is checked.
  async processLLMRequest({ messageList, abort }: ProcessLLMRequestArgs<FileUploadTripwireMetadata>): Promise<void> {
    if (!messageList) return;
    const files = newFiles(messageList);
    const leaked = await selectFiles(files, this.filter);
    if (!leaked.ok) return this.fail(abort, files, leaked.failure);
    const [file] = leaked.value;
    if (!file) return;
    return this.fail(abort, leaked.value, {
      code: FILE_UPLOAD_ERROR_CODES.FILE_NOT_UPLOADED,
      message: `${describeFile(file.fileName)} is accepted by the filter but was not uploaded, so the model call was stopped.`,
      details: { fileName: file.fileName, mimeType: file.mimeType },
    });
  }

  private async upload(
    candidates: InlineFileCandidate[],
    requestContext: RequestContext,
    abortSignal?: AbortSignal,
  ): Promise<Result<void>> {
    const sandbox = await resolveSandbox(this.workspace, requestContext);
    if (!sandbox.ok) return sandbox;
    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    if (!threadId) return memoryRequired();
    const prepared = prepareFiles(candidates, this.maxFileSize, threadId);
    if (!prepared.ok) return prepared;
    const written = await writeFilesToSandbox(sandbox.value, prepared.value, abortSignal);
    if (!written.ok) return written;
    prepared.value.forEach(applyUploadedNote);
    return ok(undefined);
  }

  /**
   * The only place the processor stops a turn. Every file of the turn is
   * replaced by a note first: an aborted turn can still be stored, and a raw
   * file left in the thread would reach the model on the next turn.
   */
  private fail(abort: Abort, candidates: FileCandidate[], { code, message, details }: FileUploadFailure): never {
    candidates.forEach(candidate => markRejected(candidate, message));
    return abort(message, { metadata: { processorId: this.id, code, ...details } });
  }
}

// Only files sent inline are handled; links stay in the message for the model.
const newFiles = (messageList: MessageList): InlineFileCandidate[] =>
  collectCandidates(listNewMessages(messageList)).filter(isInline);

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
function checkMemory(requestContext: RequestContext): Result<void> {
  const memory = parseMemoryRequestContext(requestContext);
  if (memory?.thread?.id && !memory.memoryConfig?.readOnly) return ok(undefined);
  return memoryRequired();
}

function memoryRequired(): Result<never> {
  return failed(
    FILE_UPLOAD_ERROR_CODES.MEMORY_REQUIRED,
    'FileUploadProcessor requires an agent with memory and a thread that is not read-only.',
  );
}

// A sandbox resolver is user code: it can throw, or resolve nothing.
async function resolveSandbox(
  workspace: AnyWorkspace,
  requestContext: RequestContext,
): Promise<Result<WorkspaceSandbox>> {
  try {
    const sandbox = await workspace.resolveSandbox({ requestContext });
    return sandbox ? checkWriteCapability(sandbox) : noSandbox();
  } catch (error) {
    return noSandbox(describeError(error));
  }
}

function noSandbox(cause?: string): Result<never> {
  return failed(
    FILE_UPLOAD_ERROR_CODES.NO_SANDBOX,
    'The workspace resolved no sandbox to upload files to.',
    cause === undefined ? {} : { cause },
  );
}

function checkWriteCapability(sandbox: WorkspaceSandbox): Result<WorkspaceSandbox> {
  if (hasWriteCapability(sandbox)) return ok(sandbox);
  return failed(
    FILE_UPLOAD_ERROR_CODES.NO_WRITE_CAPABILITY,
    `Sandbox "${sandbox.name}" supports neither writeFiles nor executeCommand, so files cannot be uploaded to it.`,
  );
}

function applyUploadedNote({ candidate, path, content }: PreparedFile): void {
  const { fileName, mimeType } = candidate;
  markUploaded(candidate, { ...(fileName ? { name: fileName } : {}), path, mimeType, size: content.byteLength });
}
