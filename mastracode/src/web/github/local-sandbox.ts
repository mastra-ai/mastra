/**
 * Local (host-process) sandbox provider.
 *
 * A drop-in `MaterializationSandbox` that runs commands directly on the server
 * host instead of a remote VM. The repo is cloned into a per-project directory
 * under a configurable base (`MASTRACODE_LOCAL_SANDBOX_ROOT`, default
 * `~/.mastracode/web/sandboxes`).
 *
 * WARNING: this provider does NOT isolate tenants — every project's git
 * operations run as the server process on the same host filesystem. It exists
 * for local single-user development when no Railway token is configured. Do not
 * use it for a shared multi-tenant deployment; use a real cloud sandbox there.
 */

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MaterializationSandbox, SandboxCommandResult } from './sandbox';

/** Base directory under which local sandboxes are created. */
export function getLocalSandboxRoot(): string {
  const configured = process.env.MASTRACODE_LOCAL_SANDBOX_ROOT;
  if (configured && configured.trim()) return configured.trim();
  return join(homedir(), '.mastracode', 'web', 'sandboxes');
}

/**
 * A sandbox backed by the local host. `start()` ensures the root directory
 * exists; commands are spawned via the host shell. Reattach is trivially the
 * same id (the host filesystem persists across opens), so `getInfo()` surfaces
 * a stable id and `stop()` is a no-op (we never delete checkouts).
 */
export class LocalSandbox implements MaterializationSandbox {
  readonly id: string;
  private readonly root: string;

  constructor(opts: { sandboxId?: string } = {}) {
    this.root = getLocalSandboxRoot();
    // A stable id keyed to the host root so re-opens reattach to the same place.
    this.id = opts.sandboxId ?? `local:${this.root}`;
  }

  async start(): Promise<void> {
    mkdirSync(this.root, { recursive: true });
  }

  async getInfo(): Promise<{ metadata?: Record<string, unknown> }> {
    return { metadata: { sandboxId: this.id, provider: 'local', root: this.root } };
  }

  async stop(): Promise<void> {
    // No-op: the local checkout persists on the host filesystem.
  }

  executeCommand(command: string, args: string[] = [], options?: { timeout?: number }): Promise<SandboxCommandResult> {
    return new Promise<SandboxCommandResult>(resolve => {
      const child = spawn(command, args, {
        cwd: this.root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeoutMs = options?.timeout;
      const timer =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              child.kill('SIGKILL');
            }, timeoutMs)
          : undefined;

      const finish = (exitCode: number) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ exitCode, stdout, stderr });
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', err => {
        stderr += (stderr ? '\n' : '') + (err instanceof Error ? err.message : String(err));
        finish(127);
      });
      child.on('close', code => {
        finish(code ?? 1);
      });
    });
  }
}
