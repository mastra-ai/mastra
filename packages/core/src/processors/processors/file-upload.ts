import type { MessageList } from '../../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { parseMemoryRequestContext } from '../../memory/types';
import { RequestContext } from '../../request-context';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import type { AnyWorkspace } from '../../workspace/workspace';
import type { ProcessInputArgs, ProcessInputStepArgs, ProcessLLMRequestArgs, Processor } from '../index';
import { describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { FileUploadFailure, FileUploadTripwireMetadata, Result } from './file-upload-errors';
import { createFileMatcher } from './file-upload-matching';
import type { FileMatcher, FileMatcherOptions } from './file-upload-matching';
import {
  collectCandidates,
  findUnuploadedFile,
  listNewMessages,
  markRejected,
  markUploaded,
} from './file-upload-messages';
import type { FileCandidate } from './file-upload-messages';
import { prepareFiles } from './file-upload-prepare';
import type { FileUploadMaxFileSize, PreparedFile } from './file-upload-prepare';
import { hasWriteCapability, writeFilesToSandbox } from './file-upload-writer';

export { FILE_UPLOAD_ERROR_CODES } from './file-upload-errors';
export type { FileUploadErrorCode, FileUploadTripwireMetadata } from './file-upload-errors';
export type { FileUploadRecord } from './file-upload-messages';
export type { FileUploadMaxFileSize, FileUploadMaxFileSizeArgs } from './file-upload-prepare';

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface FileUploadProcessorOptions extends FileMatcherOptions {
  /** Workspace whose sandbox receives the uploaded files. Pass the same workspace as the agent's. */
  workspace: AnyWorkspace;
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
 *   inputProcessors: [new FileUploadProcessor({ workspace, mimeTypes: ['application/pdf', 'image/*'] })],
 * });
 * ```
 */
export class FileUploadProcessor implements Processor<'file-upload', FileUploadTripwireMetadata> {
  readonly id = 'file-upload' as const;
  readonly name = 'File Upload';

  private readonly workspace: AnyWorkspace;
  private readonly matches: FileMatcher;
  private readonly maxFileSize: FileUploadMaxFileSize;

  constructor(options: FileUploadProcessorOptions) {
    assertSandboxConfigured(options?.workspace);
    this.workspace = options.workspace;
    this.matches = createFileMatcher(options);
    this.maxFileSize = options.maxFileSize ?? (() => DEFAULT_MAX_FILE_SIZE);
  }

  async processInput({
    messageList,
    requestContext = new RequestContext(),
    abort,
    abortSignal,
  }: ProcessInputArgs<FileUploadTripwireMetadata>): Promise<MessageList> {
    const candidates = this.findCandidates(messageList);
    const memory = checkMemory(requestContext);
    if (!memory.ok) return this.fail(abort, candidates, memory.failure);
    const uploaded = await this.upload(candidates, requestContext, abortSignal);
    if (!uploaded.ok) return this.fail(abort, candidates, uploaded.failure);
    return messageList;
  }

  // A signal delivered to a run that is already active only shows up here, never in `processInput`.
  async processInputStep({
    messageList,
    requestContext = new RequestContext(),
    abort,
    abortSignal,
  }: ProcessInputStepArgs<FileUploadTripwireMetadata>): Promise<void> {
    const candidates = this.findCandidates(messageList);
    if (candidates.length === 0) return;
    const uploaded = await this.upload(candidates, requestContext, abortSignal);
    if (!uploaded.ok) return this.fail(abort, candidates, uploaded.failure);
  }

  // Last line of defense: whatever path a matching file took to get into the
  // prompt (a stored message the hooks above never saw, for instance), it stops here.
  processLLMRequest({ prompt, messageList, abort }: ProcessLLMRequestArgs<FileUploadTripwireMetadata>): void {
    const leaked = findUnuploadedFile(prompt, this.matches);
    if (!leaked) return;
    const candidates = messageList ? this.findCandidates(messageList) : [];
    return this.fail(abort, candidates, {
      code: FILE_UPLOAD_ERROR_CODES.FILE_NOT_UPLOADED,
      message: `${describeFile(leaked.fileName)} matches the upload filters but was not uploaded, so the model call was stopped.`,
      details: leaked,
    });
  }

  private findCandidates(messageList: MessageList): FileCandidate[] {
    return collectCandidates(listNewMessages(messageList)).filter(this.matches);
  }

  // The sandbox is checked even when there is nothing to upload, so a broken setup shows on the first call.
  private async upload(
    candidates: FileCandidate[],
    requestContext: RequestContext,
    abortSignal?: AbortSignal,
  ): Promise<Result<void>> {
    const sandbox = await resolveSandbox(this.workspace, requestContext);
    if (!sandbox.ok) return sandbox;
    if (candidates.length === 0) return ok(undefined);
    const prepared = await prepareFiles(candidates, this.maxFileSize);
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
