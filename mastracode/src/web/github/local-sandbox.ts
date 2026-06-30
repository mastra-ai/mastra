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
 * Environment variables that are safe to expose to sandboxed commands. The repo
 * materializer interpolates any required secrets (e.g. the GitHub install token)
 * directly into the command script, so sandboxed commands never need the
 * server's own secret env. We therefore pass only a minimal allow-list — enough
 * for `git`/`sh` to function — and drop everything else so values like
 * `GITHUB_APP_PRIVATE_KEY`, `WORKOS_API_KEY`, and `APP_DATABASE_URL` are never
 * handed to a command running against an untrusted checkout.
 */
const ALLOWED_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'TERM',
  'TZ',
  // Git locates its config/templates via these; safe, non-secret.
  'GIT_EXEC_PATH',
  'GIT_TEMPLATE_DIR',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
]);

/**
 * Build a sanitized environment for spawned sandbox commands: only the
 * allow-listed keys above plus `GIT_*` config knobs that are non-secret by
 * convention. This prevents leaking the full server environment to commands
 * that run against untrusted repository contents.
 */
export function sandboxEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (ALLOWED_ENV_KEYS.has(key)) out[key] = value;
  }
  return out;
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
        // Pass only a sanitized allow-list, never the full server environment,
        // so secrets aren't exposed to commands run against untrusted checkouts.
        env: sandboxEnv(),
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
