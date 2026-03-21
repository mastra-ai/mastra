/**
 * Harness factory — creates MastraCode instances backed by E2B sandboxes.
 * Each Slack thread gets its own Harness + sandbox session.
 */
import type { HarnessEventListener } from '@mastra/core/harness';

import { createMastraCode } from 'mastracode';
import { createCodingSandbox, createBareSandbox, createCodingWorkspace } from './workspace-config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodingSessionConfig {
  repoUrl?: string;
  branch?: string;
  githubToken: string;
  gitUserName: string;
  gitUserEmail: string;
}

interface CachedSession {
  harness: Awaited<ReturnType<typeof createMastraCode>>['harness'];
  threadKey: string;
  lastActivity: number;
}

// ---------------------------------------------------------------------------
// Session Cache
// ---------------------------------------------------------------------------

const sessions = new Map<string, CachedSession>();

// ---------------------------------------------------------------------------
// Harness Creation
// ---------------------------------------------------------------------------

async function createHarnessForSession(
  threadKey: string,
  config: CodingSessionConfig,
) {
  // Create E2B sandbox — with repo pre-cloned if repoUrl is provided
  const sandboxId = `slack-coding-${threadKey}`;
  const sandbox = config.repoUrl
    ? createCodingSandbox({
        repoUrl: config.repoUrl,
        branch: config.branch,
        githubToken: config.githubToken,
        gitUserName: config.gitUserName,
        gitUserEmail: config.gitUserEmail,
        sandboxId,
      })
    : createBareSandbox({
        sandboxId,
        githubToken: config.githubToken,
        gitUserName: config.gitUserName,
        gitUserEmail: config.gitUserEmail,
      });

  const workspace = createCodingWorkspace(sandbox);

  console.log('[harness-factory] workspace created:', {
    id: workspace.id,
    hasSandbox: !!workspace.sandbox,
    hasFilesystem: !!workspace.filesystem,
    constructorName: workspace.constructor.name,
  });

  const { harness } = await createMastraCode({
    workspace,
    disableMcp: true,
    disableHooks: true,
    initialState: {
      projectPath: '/home/user/project',
      yolo: true,
      permissionRules: {
        categories: {},
        tools: {
          // request_sandbox_access is a local TUI tool that waits for terminal input.
          // In Slack/E2B context it hangs forever, so deny it entirely.
          request_sandbox_access: 'deny',
        },
      },
    },
  });

  // Debug: log workspace state after harness creation
  console.log('[harness-factory] harness created, workspace state:', {
    hasSandbox: !!workspace.sandbox,
    sandboxHasExecCmd: !!workspace.sandbox?.executeCommand,
    sandboxStatus: workspace.status,
  });

  return harness;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get an existing Harness for a Slack thread, or create a new one.
 * Returns `isNew: true` when a fresh session was created.
 */
export async function getOrCreateHarness(
  threadKey: string,
  config: CodingSessionConfig,
): Promise<{ harness: CachedSession['harness']; isNew: boolean }> {
  const existing = sessions.get(threadKey);
  if (existing) {
    existing.lastActivity = Date.now();
    return { harness: existing.harness, isNew: false };
  }

  const harness = await createHarnessForSession(threadKey, config);

  // Subscribe to workspace events during init
  harness.subscribe((event: any) => {
    if (event.type === 'workspace_status_changed' || event.type === 'workspace_ready' || event.type === 'workspace_error') {
      console.log('[harness-factory] workspace event:', JSON.stringify(event));
    }
  });

  await harness.init();

  console.log('[harness-factory] harness.init() completed for thread:', threadKey);

  // Check if the workspace is ready and has tools
  try {
    const ws = harness.getWorkspace();
    console.log('[harness-factory] post-init workspace:', {
      hasWorkspace: !!ws,
      status: ws?.status,
      hasSandbox: !!ws?.sandbox,
      sandboxHasExecCmd: !!ws?.sandbox?.executeCommand,
      hasFilesystem: !!ws?.filesystem,
    });
  } catch (e) {
    console.log('[harness-factory] post-init workspace check failed:', e);
  }

  sessions.set(threadKey, {
    harness,
    threadKey,
    lastActivity: Date.now(),
  });

  return { harness, isNew: true };
}

/**
 * Destroy a session and its sandbox.
 */
export async function destroySession(threadKey: string): Promise<boolean> {
  const session = sessions.get(threadKey);
  if (!session) return false;

  try {
    await session.harness.destroyWorkspace();
  } catch {
    // Best-effort cleanup
  }
  sessions.delete(threadKey);
  return true;
}

/**
 * Get an existing session without creating a new one.
 */
export function getSession(threadKey: string): CachedSession | undefined {
  return sessions.get(threadKey);
}

/**
 * Subscribe to Harness events for a session.
 */
export function subscribeToSession(
  threadKey: string,
  listener: HarnessEventListener,
): boolean {
  const session = sessions.get(threadKey);
  if (!session) return false;
  session.harness.subscribe(listener);
  return true;
}

/**
 * List all active sessions.
 */
export function listSessions(): Array<{ threadKey: string; lastActivity: number }> {
  return Array.from(sessions.entries()).map(([key, s]) => ({
    threadKey: key,
    lastActivity: s.lastActivity,
  }));
}
