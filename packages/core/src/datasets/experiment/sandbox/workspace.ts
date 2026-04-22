/**
 * Workspace Materializer
 *
 * Utilities for creating and tearing down isolated workspace directories
 * from WorkspaceSnapshot descriptions.
 *
 * This is intentionally minimal — it handles the common cases (git checkout,
 * inline files, tar extraction, passthrough) and provides a clean interface
 * for consumers to extend.
 */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { MastraDBMessage } from '../../../memory/types';
import type { MemoryStorage } from '../../../storage/domains/memory/base';
import type { WorkspaceSnapshot } from './types';

const execFileAsync = promisify(execFile);

/**
 * Materialize a workspace from a snapshot description.
 *
 * Creates an isolated temporary directory containing the workspace contents.
 * Returns the path to the workspace root.
 *
 * @param snapshot - Describes how to set up the workspace
 * @param baseDir - Base directory for temp workspaces. Defaults to OS tmpdir.
 * @returns Absolute path to the materialized workspace
 *
 * @example
 * ```typescript
 * // From a git ref
 * const path = await materializeWorkspace({
 *   type: 'git-ref',
 *   repo: '.',
 *   commit: 'abc123',
 * });
 *
 * // From inline files
 * const path = await materializeWorkspace({
 *   type: 'directory',
 *   files: [
 *     { path: 'src/index.ts', content: 'console.log("hello")' },
 *     { path: 'package.json', content: '{"name": "test"}' },
 *   ],
 * });
 * ```
 */
export async function materializeWorkspace(snapshot: WorkspaceSnapshot, baseDir?: string): Promise<string> {
  switch (snapshot.type) {
    case 'git-ref':
      return materializeGitRef(snapshot, baseDir);
    case 'directory':
      return materializeDirectory(snapshot, baseDir);
    case 'tar':
      return materializeTar(snapshot, baseDir);
    case 'current':
      // No materialization — use the directory as-is
      return snapshot.path;
    default:
      throw new Error(`Unknown workspace snapshot type: ${(snapshot as { type: string }).type}`);
  }
}

/**
 * Clean up a materialized workspace.
 * Only removes temp directories — skips 'current' type workspaces.
 */
export async function destroyWorkspace(workspacePath: string, snapshot?: WorkspaceSnapshot): Promise<void> {
  // Don't destroy 'current' workspaces — they weren't created by us
  if (snapshot?.type === 'current') return;

  // Safety: only remove paths under tmpdir
  const tmp = tmpdir();
  if (!workspacePath.startsWith(tmp)) {
    console.warn(`Refusing to destroy workspace outside tmpdir: ${workspacePath}`);
    return;
  }

  await rm(workspacePath, { recursive: true, force: true });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Snapshot materializers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function createTempDir(baseDir?: string): Promise<string> {
  const base = baseDir ?? tmpdir();
  const dir = join(base, `mastra-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function materializeGitRef(
  snapshot: Extract<WorkspaceSnapshot, { type: 'git-ref' }>,
  baseDir?: string,
): Promise<string> {
  const dir = await createTempDir(baseDir);

  // Clone the repo (shallow clone at the specific commit)
  const repo = snapshot.repo === '.' ? process.cwd() : snapshot.repo;

  await execFileAsync('git', ['clone', '--no-checkout', repo, dir], {
    timeout: 60_000,
  });

  await execFileAsync('git', ['checkout', snapshot.commit], {
    cwd: dir,
    timeout: 30_000,
  });

  if (snapshot.subpath) {
    return join(dir, snapshot.subpath);
  }
  return dir;
}

async function materializeDirectory(
  snapshot: Extract<WorkspaceSnapshot, { type: 'directory' }>,
  baseDir?: string,
): Promise<string> {
  const dir = await createTempDir(baseDir);

  // Write files
  for (const file of snapshot.files) {
    const filePath = join(dir, file.path);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
  }

  return dir;
}

async function materializeTar(
  snapshot: Extract<WorkspaceSnapshot, { type: 'tar' }>,
  baseDir?: string,
): Promise<string> {
  const dir = await createTempDir(baseDir);

  await execFileAsync('tar', ['-xf', snapshot.archivePath, '-C', dir], {
    timeout: 60_000,
  });

  return dir;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory seeding
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Seed a thread with prior messages for memory replay.
 *
 * Creates a new thread in the provided memory storage, then inserts the given
 * messages. This allows experiment items to faithfully replay conversations
 * where the agent had prior context.
 *
 * @param storage - MemoryStorage instance to seed into
 * @param messages - Messages to inject (in chronological order)
 * @param options - Optional thread/resource IDs (auto-generated if omitted)
 * @returns The thread ID and resource ID used
 *
 * @example
 * ```typescript
 * const { threadId, resourceId } = await seedThreadMemory(
 *   memoryStorage,
 *   item.memory.messages,
 *   { resourceId: 'experiment-resource' }
 * );
 * // Now run the agent against this thread
 * await agent.generate(input, { memory: { thread: threadId, resource: resourceId } });
 * ```
 */
export async function seedThreadMemory(
  storage: MemoryStorage,
  messages: MastraDBMessage[],
  options?: { threadId?: string; resourceId?: string },
): Promise<{ threadId: string; resourceId: string }> {
  const threadId = options?.threadId ?? randomUUID();
  const resourceId = options?.resourceId ?? `experiment-${randomUUID()}`;

  // Create the thread
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { source: 'sandbox-experiment' },
    },
  });

  // Seed messages (assign to this thread if not already)
  if (messages.length > 0) {
    const seededMessages = messages.map(msg => ({
      ...msg,
      threadId,
      resourceId,
    }));
    await storage.saveMessages({ messages: seededMessages });
  }

  return { threadId, resourceId };
}
