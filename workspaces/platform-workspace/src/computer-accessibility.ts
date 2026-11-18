import { createHash } from 'node:crypto';

import { AccessibilityRefError } from '@mastra/core/workspace';
import type {
  AccessibilityNode,
  AccessibilityRefErrorReason,
  AccessibilitySnapshot,
  AccessibilityTreeOptions,
  CommandResult,
  ComputerAccessibility,
} from '@mastra/core/workspace';

import helperSource from './computer-accessibility-helper.py';
import type { ComputerExec } from './computer.js';

/** Private desktop state the image creates: the session bus socket, the generation id, snapshots and the helper. 0700, sandbox user only. */
export const DESKTOP_DIR = '/tmp/.mastra-desktop';
const PYTHON = '/usr/bin/python3';

/**
 * The image's desktop env. Only the computer's own execs pass it (the image
 * already gives every process the same values); ordinary commands never get it from here.
 */
export const DESKTOP_ENV: Readonly<Record<string, string>> = {
  DISPLAY: ':1',
  DBUS_SESSION_BUS_ADDRESS: `unix:path=${DESKTOP_DIR}/bus`,
  QT_LINUX_ACCESSIBILITY_ALWAYS_ON: '1',
};

/**
 * The AT-SPI helper (`computer-accessibility-helper.py`, bundled as text),
 * uploaded on first use and run once per call with one JSON request
 * argument. Caller input reaches it only as that quoted argument. It prints
 * exactly one JSON object, errors included.
 *
 * Refs are `<generation>.<snapshotId>.<n>`; a snapshot maps `n` to the node's
 * object identity (owning application bus name + accessible object path) plus
 * its role and name. Acting resolves that identity by walking the owning
 * application, never by child position.
 */
export const ACCESSIBILITY_HELPER: string = helperSource;
let helperFile: { sha256: string; path: string } | undefined;
/**
 * The helper's SHA-256 and its content-addressed path, so a changed helper is a
 * new file and an old one is never run by mistake. Hashed on first use.
 */
export function accessibilityHelperFile(): { sha256: string; path: string } {
  if (!helperFile) {
    const sha256 = createHash('sha256').update(ACCESSIBILITY_HELPER, 'utf8').digest('hex');
    helperFile = { sha256, path: `${DESKTOP_DIR}/a11y-${sha256}.py` };
  }
  return helperFile;
}

const TREE_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_DEPTH = 25;
const DEFAULT_MAX_NODES = 400;
const REASONS: readonly AccessibilityRefErrorReason[] = [
  'malformed',
  'generation',
  'snapshot-missing',
  'gone',
  'changed',
];

interface AccessibilityDeps {
  exec: ComputerExec;
  /** Runs a task on the computer's single FIFO queue, after the desktop is ensured. */
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Marks the desktop for a re-check on the next call. */
  unhealthy: () => void;
  /** Reports the generation a helper reply carried; a different one than the memo clears it. */
  seenGeneration: (generation: string) => Promise<void>;
}

type HelperReply =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error?: unknown; message?: unknown; ref?: unknown; reason?: unknown; generation?: unknown };

function tail(text: string): string {
  return text.trim().split('\n').slice(-5).join('\n');
}

export function createComputerAccessibility({
  exec,
  run,
  unhealthy,
  seenGeneration,
}: AccessibilityDeps): ComputerAccessibility {
  const call = async (
    op: string,
    request: Record<string, unknown>,
    once: boolean,
  ): Promise<HelperReply & { ok: true }> => {
    const timeout = once ? ACTION_TIMEOUT_MS : TREE_TIMEOUT_MS;
    let result: CommandResult;
    try {
      result = await exec(PYTHON, [accessibilityHelperFile().path, JSON.stringify({ op, ...request })], {
        once,
        timeout,
        env: { ...DESKTOP_ENV },
      });
    } catch (err) {
      unhealthy();
      if (!once) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `computer accessibility ${op}: the command channel failed, so the outcome is unknown; read the tree again before retrying (${message})`,
      );
    }
    if (result.timedOut) {
      unhealthy();
      const outcome = once ? ', so the outcome is unknown; read the tree again before retrying' : '';
      throw new Error(`computer accessibility ${op} timed out after ${timeout / 1000}s${outcome}`);
    }
    let reply: HelperReply | undefined;
    try {
      const parsed: unknown = JSON.parse(result.stdout.trim().split('\n').pop() ?? '');
      if (parsed && typeof parsed === 'object' && typeof (parsed as { ok?: unknown }).ok === 'boolean') {
        reply = parsed as HelperReply;
      }
    } catch {
      reply = undefined;
    }
    if (!reply) {
      unhealthy();
      throw new Error(
        `computer accessibility ${op} failed (exit ${result.exitCode}): ${tail(result.stderr) || 'no reply from the helper'}`,
      );
    }
    if (typeof reply.generation === 'string') await seenGeneration(reply.generation);
    if (reply.ok) return reply;
    const message = typeof reply.message === 'string' ? reply.message : undefined;
    if (
      reply.error === 'ref' &&
      typeof reply.ref === 'string' &&
      REASONS.includes(reply.reason as AccessibilityRefErrorReason)
    ) {
      throw new AccessibilityRefError(reply.ref, reply.reason as AccessibilityRefErrorReason, message);
    }
    if (reply.error === 'unavailable') unhealthy();
    throw new Error(`computer accessibility ${op} failed (${String(reply.error)}): ${message ?? 'unknown error'}`);
  };

  return {
    getTree: (options: AccessibilityTreeOptions = {}) =>
      run(async (): Promise<AccessibilitySnapshot> => {
        const reply = await call(
          'tree',
          {
            app: options.app,
            maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
            maxNodes: options.maxNodes ?? DEFAULT_MAX_NODES,
          },
          false,
        );
        if (typeof reply.snapshotId !== 'string' || !Array.isArray(reply.nodes)) {
          throw new Error('computer accessibility tree failed: malformed reply from the helper');
        }
        return {
          snapshotId: reply.snapshotId,
          nodes: reply.nodes as AccessibilityNode[],
          truncated: reply.truncated === true,
        };
      }),
    act: (ref: string, action: string) =>
      run(async () => {
        await call('act', { ref, action }, true);
      }),
    setText: (ref: string, text: string) =>
      run(async () => {
        await call('setText', { ref, text }, true);
      }),
  };
}
