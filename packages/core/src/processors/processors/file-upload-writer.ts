import type { RequestContext } from '../../request-context';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import { shellQuote } from '../../workspace/sandbox/utils';
import type { AnyWorkspace } from '../../workspace/workspace';
import { describeError, FILE_UPLOAD_ERROR_CODES, FileUploadError } from './file-upload-errors';

/** Max shell-command payload per chunk; stays under the per-argument limit of `sh -c`. */
const UPLOAD_CHUNK_SIZE = 96_000;

export interface SandboxUpload {
  path: string;
  content: Buffer;
}

/** The sandbox to upload to for this request, once it is known to accept files. */
export async function resolveWritableSandbox(
  workspace: AnyWorkspace,
  requestContext: RequestContext,
): Promise<WorkspaceSandbox> {
  const sandbox = await resolveSandbox(workspace, requestContext);
  if (typeof sandbox.writeFiles === 'function' || typeof sandbox.executeCommand === 'function') return sandbox;
  throw new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.NO_WRITE_CAPABILITY,
    `Sandbox "${sandbox.name}" supports neither writeFiles nor executeCommand, so files cannot be uploaded to it.`,
  );
}

// A sandbox resolver is user code: it can throw, or resolve nothing.
async function resolveSandbox(workspace: AnyWorkspace, requestContext: RequestContext): Promise<WorkspaceSandbox> {
  let sandbox: WorkspaceSandbox | undefined;
  try {
    sandbox = await workspace.resolveSandbox({ requestContext });
  } catch (error) {
    throw noSandbox(describeError(error));
  }
  if (!sandbox) throw noSandbox();
  return sandbox;
}

const noSandbox = (cause?: string) =>
  new FileUploadError(
    FILE_UPLOAD_ERROR_CODES.NO_SANDBOX,
    'The workspace resolved no sandbox to upload files to.',
    cause === undefined ? {} : { cause },
  );

/**
 * Puts the files in the sandbox and returns them with the path they are at.
 * A file the sandbox already has is not written again: paths are named after
 * the content, so the same path holds the same bytes. Each file is written
 * under a temporary name and moved into place, so an interrupted write never
 * leaves a partial file that a later turn would take for a complete one. On
 * failure, removes whatever this call wrote before reporting it.
 *
 * Relative paths are made absolute from the directory where commands run: each
 * provider resolves a relative path for `writeFiles` its own way, and the model
 * looks for the file with its command tool.
 */
export async function uploadFiles<T extends SandboxUpload>(
  sandbox: WorkspaceSandbox,
  files: T[],
  abortSignal?: AbortSignal,
): Promise<T[]> {
  const token = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  let written: SandboxUpload[] = [];
  try {
    const { root, existing } = await inspect(sandbox, files, abortSignal);
    const placed = files.map(file => ({
      ...file,
      path: root ? `${root.replace(/\/+$/, '')}/${file.path}` : file.path,
    }));
    written = placed.filter((_, index) => !existing.has(files[index]!.path));
    if (written.length > 0) await write(sandbox, written, token, abortSignal);
    return placed;
  } catch (error) {
    const orphanPaths = await removeUploaded(sandbox, written, token);
    throw new FileUploadError(FILE_UPLOAD_ERROR_CODES.UPLOAD_FAILED, 'Files could not be written to the sandbox.', {
      cause: describeError(error),
      ...(orphanPaths.length > 0 ? { orphanPaths } : {}),
    });
  }
}

/**
 * Creates the upload directories, and reads the directory where commands run
 * and which files are already there, in a single command. A sandbox that can't
 * run commands only has its working directory to go by, and every file is
 * written; without either directory, paths stay relative.
 */
async function inspect(
  sandbox: WorkspaceSandbox,
  files: SandboxUpload[],
  abortSignal?: AbortSignal,
): Promise<{ root?: string; existing: Set<string> }> {
  if (!sandbox.executeCommand) return { root: absolute(workingDirectoryOf(sandbox)), existing: new Set() };
  const directories = directoriesOf(files).map(shellQuote).join(' ');
  const paths = files.map(file => shellQuote(file.path)).join(' ');
  const script = `mkdir -p ${directories} && pwd && for f in ${paths}; do if [ -e "$f" ]; then printf '%s\\n' "$f"; fi; done`;
  const [root = '', ...existing] = (await runScript(sandbox, script, abortSignal)).split('\n');
  return { root: absolute(root.trim()), existing: new Set(existing.map(line => line.trim()).filter(Boolean)) };
}

// Not part of the sandbox interface: `MastraSandbox` providers expose it, other sandboxes may not.
function workingDirectoryOf(sandbox: WorkspaceSandbox): string | undefined {
  const { workingDirectory } = sandbox as { workingDirectory?: unknown };
  return typeof workingDirectory === 'string' ? workingDirectory : undefined;
}

const absolute = (directory: string | undefined) => (directory?.startsWith('/') ? directory : undefined);

function directoriesOf(files: SandboxUpload[]): string[] {
  return [...new Set(files.map(file => file.path.slice(0, file.path.lastIndexOf('/'))))];
}

const temporaryPathOf = (file: SandboxUpload, token: string) => `${file.path}.${token}.part`;
const encodedPathOf = (file: SandboxUpload, token: string) => `${file.path}.${token}.b64`;

// Without commands nothing can be moved, so the file is written in place; it is
// also never skipped then, so a partial write is replaced on the next turn.
async function write(sandbox: WorkspaceSandbox, files: SandboxUpload[], token: string, abortSignal?: AbortSignal) {
  if (!sandbox.writeFiles) return writeWithCommands(sandbox, files, token, abortSignal);
  if (!sandbox.executeCommand) {
    return sandbox.writeFiles(
      files.map(({ path, content }) => ({ path, content })),
      { abortSignal },
    );
  }
  await sandbox.writeFiles(
    files.map(file => ({ path: temporaryPathOf(file, token), content: file.content })),
    { abortSignal },
  );
  const moves = files.map(file => `mv -f ${shellQuote(temporaryPathOf(file, token))} ${shellQuote(file.path)}`);
  await runScript(sandbox, moves.join(' && '), abortSignal);
}

// `allSettled`, not `all`: a write still running after the first failure would
// recreate its files right after they are removed.
async function writeWithCommands(
  sandbox: WorkspaceSandbox,
  files: SandboxUpload[],
  token: string,
  abortSignal?: AbortSignal,
) {
  const writes = await Promise.allSettled(files.map(file => writeOneWithCommands(sandbox, file, token, abortSignal)));
  const rejected = writes.find(result => result.status === 'rejected');
  if (rejected) throw rejected.reason;
}

// Base64 goes through the shell in chunks: a whole file would exceed the argument limit.
async function writeOneWithCommands(
  sandbox: WorkspaceSandbox,
  file: SandboxUpload,
  token: string,
  abortSignal?: AbortSignal,
) {
  const target = shellQuote(file.path);
  const temporary = shellQuote(temporaryPathOf(file, token));
  const encoded = shellQuote(encodedPathOf(file, token));
  await runScript(sandbox, `: > ${encoded}`, abortSignal);
  for (const chunk of toBase64Chunks(file.content)) {
    await runScript(sandbox, `printf '%s' ${shellQuote(chunk)} >> ${encoded}`, abortSignal);
  }
  await runScript(
    sandbox,
    `base64 -d < ${encoded} > ${temporary} && mv -f ${temporary} ${target} && rm -f ${encoded}`,
    abortSignal,
  );
}

function toBase64Chunks(content: Buffer): string[] {
  const base64 = content.toString('base64');
  const chunks: string[] = [];
  for (let index = 0; index < base64.length; index += UPLOAD_CHUNK_SIZE) {
    chunks.push(base64.slice(index, index + UPLOAD_CHUNK_SIZE));
  }
  return chunks;
}

/** Best effort: returns the paths that may still exist because they could not be removed. */
async function removeUploaded(sandbox: WorkspaceSandbox, files: SandboxUpload[], token: string): Promise<string[]> {
  if (files.length === 0) return [];
  const paths = files.flatMap(file => [file.path, temporaryPathOf(file, token), encodedPathOf(file, token)]);
  try {
    await runScript(sandbox, `rm -f ${paths.map(shellQuote).join(' ')}`);
    return [];
  } catch {
    return files.map(file => file.path);
  }
}

// The script is never echoed in the error: it can carry file content.
async function runScript(sandbox: WorkspaceSandbox, script: string, abortSignal?: AbortSignal): Promise<string> {
  if (!sandbox.executeCommand) throw new Error('The sandbox cannot run commands.');
  const result = await sandbox.executeCommand('sh', ['-c', script], { abortSignal });
  if (!result.success) {
    throw new Error(result.stderr.trim() || `Command exited with code ${result.exitCode}`);
  }
  return result.stdout;
}
