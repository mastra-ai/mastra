import type { SessionBeforeAgentEndListener } from '@mastra/core/agent-controller';
import type { WorkspaceSandbox } from '@mastra/core/workspace';

import type { FilesystemFile, FilesystemStorage } from '../storage/domains/filesystem/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

const GIT_STATUS_ARGS = ['status', '--porcelain=v1', '-z', '--untracked-files=all'];
const ARTIFACTS_LIST_COMMAND = 'cd "$1" && test -d .artifacts && find .artifacts -type f -print0 || true';

export interface FilesystemCaptureSession {
  readonly identity: { getResourceId(): string };
  readonly thread: { requireId(): string };
  getWorkspace(): { sandbox?: Pick<WorkspaceSandbox, 'executeCommand'> } | undefined;
  onBeforeAgentEnd(listener: SessionBeforeAgentEndListener): () => void;
}

export interface FilesystemCaptureDependencies {
  filesystem: Pick<FilesystemStorage, 'replaceFiles'>;
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  };
}

export function parseFilesystemCaptureFiles(output: string): FilesystemFile[] {
  const files = new Map<string, FilesystemFile>();
  const records = output.split('\0');

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) continue;

    const code = record.slice(0, 2);
    let path = record.slice(3);
    const moved = code.includes('R') || code.includes('C');
    if (moved) index += 1;
    if (path.startsWith('./')) path = path.slice(2);
    if (!path || (!code.includes('U') && code.includes('D') && !moved)) continue;

    files.set(path, { path });
  }

  return [...files.values()].toSorted((a, b) => a.path.localeCompare(b.path));
}

export async function captureSessionFilesystem(
  session: FilesystemCaptureSession,
  { filesystem, sourceControl }: FilesystemCaptureDependencies,
): Promise<void> {
  try {
    const resourceId = session.identity.getResourceId();
    const threadId = session.thread.requireId();
    const sourceSession = await sourceControl.sessions.getBySessionId(resourceId);
    // Chat-only sessions run without a workspace; there is nothing to capture.
    const sandbox = session.getWorkspace()?.sandbox;
    if (!sourceSession?.sandboxWorkdir || !sandbox?.executeCommand) return;

    const result = await sandbox.executeCommand('git', ['-C', sourceSession.sandboxWorkdir, ...GIT_STATUS_ARGS], {
      timeout: 30_000,
    });
    if (result.exitCode !== 0) {
      console.warn('[Factory filesystem capture] Unable to inspect Git status.', result.stderr);
      return;
    }

    const artifacts = await sandbox.executeCommand(
      'sh',
      ['-c', ARTIFACTS_LIST_COMMAND, 'sh', sourceSession.sandboxWorkdir],
      { timeout: 30_000 },
    );
    if (artifacts.exitCode !== 0) {
      console.warn('[Factory filesystem capture] Unable to list workspace artifacts.', artifacts.stderr);
      return;
    }

    const files = new Map(parseFilesystemCaptureFiles(result.stdout).map(file => [file.path, file]));
    for (const path of artifacts.stdout.split('\0')) {
      const normalizedPath = path.replace(/^\.\//, '');
      if (normalizedPath) {
        files.set(normalizedPath, { path: normalizedPath });
      }
    }

    await filesystem.replaceFiles({
      resourceId,
      threadId,
      files: [...files.values()].toSorted((a, b) => a.path.localeCompare(b.path)),
    });
  } catch (error) {
    console.warn('[Factory filesystem capture] Unable to persist files.', error);
  }
}

export function observeSessionFilesystem(
  session: FilesystemCaptureSession,
  dependencies: FilesystemCaptureDependencies,
): () => void {
  let capture = Promise.resolve();
  return session.onBeforeAgentEnd(() => {
    // Chain so captures stay sequential (last write wins), but do NOT return
    // the chain: finishAgentRun awaits every listener before emitting
    // agent_end, and the capture's sandbox execs (git status + artifacts
    // find, 30s timeouts each) must not gate turn completion - parity with
    // the checkpoint listener in checkpoint-capture.ts. The un-returned
    // chain cannot leak an unhandled rejection: captureSessionFilesystem's
    // entire body runs inside its own try/catch.
    capture = capture.then(() => captureSessionFilesystem(session, dependencies));
  });
}
