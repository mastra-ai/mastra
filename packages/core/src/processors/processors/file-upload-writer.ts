import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import { shellQuote } from '../../workspace/sandbox/utils';
import { describeError, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { Result } from './file-upload-errors';

/** Max shell-command payload per chunk; stays under the per-argument limit of `sh -c`. */
const UPLOAD_CHUNK_SIZE = 96_000;

export interface SandboxUpload {
  path: string;
  content: Buffer;
}

export function hasWriteCapability(sandbox: WorkspaceSandbox): boolean {
  return typeof sandbox.writeFiles === 'function' || typeof sandbox.executeCommand === 'function';
}

/**
 * Writes with the provider's batch upload when it exists, otherwise through
 * shell commands. On failure, removes whatever was written before reporting it.
 */
export async function writeFilesToSandbox(
  sandbox: WorkspaceSandbox,
  files: SandboxUpload[],
  abortSignal?: AbortSignal,
): Promise<Result<void>> {
  try {
    if (sandbox.executeCommand) {
      await runScript(sandbox, `mkdir -p ${directoriesOf(files).map(shellQuote).join(' ')}`, abortSignal);
    }
    if (sandbox.writeFiles) await sandbox.writeFiles(files.map(toSandboxFile), { abortSignal });
    else await writeWithCommands(sandbox, files, abortSignal);
    return ok(undefined);
  } catch (error) {
    const orphanPaths = await removeUploaded(sandbox, files);
    return failed(FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED, 'Files could not be written to the sandbox.', {
      cause: describeError(error),
      ...(orphanPaths.length > 0 ? { orphanPaths } : {}),
    });
  }
}

const toSandboxFile = ({ path, content }: SandboxUpload) => ({ path, content });

function directoriesOf(files: SandboxUpload[]): string[] {
  return [...new Set(files.map(file => file.path.slice(0, file.path.lastIndexOf('/'))))];
}

// `allSettled`, not `all`: a write still running after the first failure would
// recreate its files right after they are removed.
async function writeWithCommands(sandbox: WorkspaceSandbox, files: SandboxUpload[], abortSignal?: AbortSignal) {
  const writes = await Promise.allSettled(files.map(file => writeOneWithCommands(sandbox, file, abortSignal)));
  const rejected = writes.find(write => write.status === 'rejected');
  if (rejected) throw rejected.reason;
}

// Base64 goes through the shell in chunks: a whole file would exceed the argument limit.
async function writeOneWithCommands(sandbox: WorkspaceSandbox, file: SandboxUpload, abortSignal?: AbortSignal) {
  const target = shellQuote(file.path);
  const encoded = shellQuote(encodedPathOf(file));
  await runScript(sandbox, `: > ${encoded}`, abortSignal);
  for (const chunk of toBase64Chunks(file.content)) {
    await runScript(sandbox, `printf '%s' ${shellQuote(chunk)} >> ${encoded}`, abortSignal);
  }
  await runScript(sandbox, `base64 -d < ${encoded} > ${target} && rm -f ${encoded}`, abortSignal);
}

const encodedPathOf = (file: SandboxUpload) => `${file.path}.b64`;

function toBase64Chunks(content: Buffer): string[] {
  const base64 = content.toString('base64');
  const chunks: string[] = [];
  for (let index = 0; index < base64.length; index += UPLOAD_CHUNK_SIZE) {
    chunks.push(base64.slice(index, index + UPLOAD_CHUNK_SIZE));
  }
  return chunks;
}

/** Best effort: returns the paths that may still exist because they could not be removed. */
async function removeUploaded(sandbox: WorkspaceSandbox, files: SandboxUpload[]): Promise<string[]> {
  const paths = files.flatMap(file => [file.path, encodedPathOf(file)]);
  try {
    await runScript(sandbox, `rm -f ${paths.map(shellQuote).join(' ')}`);
    return [];
  } catch {
    return files.map(file => file.path);
  }
}

// The script is never echoed in the error: it can carry file content.
async function runScript(sandbox: WorkspaceSandbox, script: string, abortSignal?: AbortSignal): Promise<void> {
  if (!sandbox.executeCommand) throw new Error('The sandbox cannot run commands.');
  const result = await sandbox.executeCommand('sh', ['-c', script], { abortSignal });
  if (!result.success) {
    throw new Error(result.stderr.trim() || `Command exited with code ${result.exitCode}`);
  }
}
