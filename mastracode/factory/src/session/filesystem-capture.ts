import type { AgentControllerEvent, SessionBeforeAgentEndListener } from '@mastra/core/agent-controller';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';

import type { FilesystemFile, FilesystemStorage } from '../storage/domains/filesystem/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { isMeaningfulToolName } from './first-exec-capture.js';

const GIT_STATUS_ARGS = ['status', '--porcelain=v1', '-z', '--untracked-files=all'];
const ARTIFACTS_LIST_COMMAND = 'cd "$1" && test -d .artifacts && find .artifacts -type f -print0 || true';

export interface FilesystemCaptureSession {
  readonly identity: { getResourceId(): string };
  readonly thread: { requireId(): string };
  getWorkspace(): { sandbox?: Pick<WorkspaceSandbox, 'executeCommand'> } | undefined;
  onBeforeAgentEnd(listener: SessionBeforeAgentEndListener): () => void;
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
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
    if (!sourceSession || !sandbox?.executeCommand) return;
    // The live workdir comes from the per-process memo (the deterministic
    // truth) ONLY — never the persisted observability column, which a row
    // written under a previous provider can point at a workdir that no
    // longer exists (the stale-workdir incident class). No memo entry means
    // no live sandbox worth capturing in this replica; capture is
    // best-effort telemetry, so skip.
    const entry = peekSessionSandbox(sourceSession.id);
    if (!entry) return;
    // Telemetry must never provision a VM: executeCommand lazily starts the
    // sandbox via ensureRunning, so a chat turn that never touched the
    // workspace would otherwise boot (and clone into) a fresh VM just to
    // capture an empty git status. Only capture when the turn already has a
    // running sandbox.
    if (entry.sandbox.status !== 'running') return;
    // Running-but-unresolved should not happen (the start hook resolves the
    // workdir), but capture is best-effort — skip rather than guess.
    const workdir = entry.workdir;
    if (!workdir) return;

    const result = await sandbox.executeCommand('git', ['-C', workdir, ...GIT_STATUS_ARGS], {
      timeout: 30_000,
    });
    if (result.exitCode !== 0) {
      console.warn('[Factory filesystem capture] Unable to inspect Git status.', result.stderr);
      return;
    }

    const artifacts = await sandbox.executeCommand('sh', ['-c', ARTIFACTS_LIST_COMMAND, 'sh', workdir], {
      timeout: 30_000,
    });
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

/**
 * In-flight capture chains keyed by session resource id. Serves two purposes:
 * readers of the persisted file listing (the /web/workspace routes) await the
 * capture for the turn that just ended instead of racing it, and captures for
 * the same resource stay sequential (last write wins) even when multiple
 * scoped sessions observe the same resource id. In-process only: the factory
 * server that runs the session controller also serves those routes.
 */
const pendingCaptures = new Map<string, Promise<void>>();

/**
 * Resolve once the session's in-flight filesystem capture (if any) has
 * persisted, or after `timeoutMs` so a reader that arrives mid-capture is
 * never blocked by the execs' worst-case 30s timeouts. Never rejects: the
 * capture body is fully try/catch contained.
 */
export async function waitForPendingFilesystemCapture(resourceId: string, timeoutMs = 10_000): Promise<void> {
  const pending = pendingCaptures.get(resourceId);
  if (!pending) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pending,
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function observeSessionFilesystem(
  session: FilesystemCaptureSession,
  dependencies: FilesystemCaptureDependencies,
): () => void {
  let fallbackChain = Promise.resolve();
  // Capture only runs after a turn that actually touched the workspace: a
  // successful workspace tool call both proves the sandbox is awake and is
  // the only way the listing can have changed. Without this gate every chat
  // turn would run two sandbox execs — and since executeCommand resumes an
  // idle VM, a pure-chat turn would keep waking a sandbox it never used.
  // Same bookkeeping as first-exec capture: tool names resolve at tool_end
  // via the tool_start map, and suspended calls survive agent_end so a
  // resumed run's eventual completion still counts for that turn.
  let workspaceTouched = false;
  const toolNames = new Map<string, string>();
  const suspended = new Set<string>();
  const unsubscribeEvents = session.subscribe(event => {
    switch (event.type) {
      case 'tool_start': {
        toolNames.set(event.toolCallId, event.toolName);
        return;
      }
      case 'tool_suspended': {
        suspended.add(event.toolCallId);
        return;
      }
      case 'tool_suspension_cancelled': {
        toolNames.delete(event.toolCallId);
        suspended.delete(event.toolCallId);
        return;
      }
      case 'agent_end': {
        for (const id of toolNames.keys()) {
          if (!suspended.has(id)) toolNames.delete(id);
        }
        return;
      }
      case 'tool_end': {
        const toolName = toolNames.get(event.toolCallId);
        toolNames.delete(event.toolCallId);
        suspended.delete(event.toolCallId);
        if (event.isError || event.denied) return;
        if (isMeaningfulToolName(toolName)) workspaceTouched = true;
        return;
      }
    }
  });
  const unsubscribeEnd = session.onBeforeAgentEnd(() => {
    // onBeforeAgentEnd fires before agent_end is emitted, so every tool_end
    // of the finishing run has already been observed; read then reset.
    if (!workspaceTouched) return;
    workspaceTouched = false;
    // Chain so captures stay sequential (last write wins), but do NOT return
    // the chain: finishAgentRun awaits every listener before emitting
    // agent_end, and the capture's sandbox execs (git status + artifacts
    // find, 30s timeouts each) must not gate turn completion. Readers that
    // need the fresh listing await the pending capture through
    // waitForPendingFilesystemCapture instead. The un-returned chain cannot
    // leak an unhandled rejection: captureSessionFilesystem's entire body
    // runs inside its own try/catch, and disposal of this listener does not
    // cancel an in-flight chain, so a final turn's capture still persists.
    let resourceId: string | undefined;
    try {
      resourceId = session.identity.getResourceId();
    } catch {
      // No resource id means no route can address this session's listing;
      // keep a per-observer chain so captures still run sequentially.
      fallbackChain = fallbackChain.then(() => captureSessionFilesystem(session, dependencies));
      return;
    }
    // Extend the resource-level chain rather than a per-session one: sessions
    // are deduplicated by (resourceId, scope), so multiple scoped sessions can
    // observe the same resource, and their captures must not interleave.
    const chain = (pendingCaptures.get(resourceId) ?? Promise.resolve()).then(() =>
      captureSessionFilesystem(session, dependencies),
    );
    pendingCaptures.set(resourceId, chain);
    void chain.finally(() => {
      if (pendingCaptures.get(resourceId) === chain) {
        pendingCaptures.delete(resourceId);
      }
    });
  });
  return () => {
    unsubscribeEvents();
    unsubscribeEnd();
  };
}
