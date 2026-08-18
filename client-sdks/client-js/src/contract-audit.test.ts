import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Ratchet gate for SDK <-> server contract drift.
 *
 * `scripts/audit-contract.ts` invokes every public SDK method against a mocked fetch and
 * validates the captured request with the Zod schemas the server actually runs. Known
 * drift is recorded in `.audit/snapshot.json`; this test fails only when a request shape
 * drifts that was not already recorded, so the set of drift can shrink but never grow.
 *
 * If this fails, fix the SDK method (or the server schema) so the request validates.
 * Do NOT re-snapshot to silence it — re-snapshotting is only for recording a deliberate,
 * reviewed change, via `pnpm --filter @mastra/client-js audit:contract:snapshot`.
 */
describe('SDK <-> server contract audit', () => {
  it('introduces no new contract drift', async () => {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync('npx', ['tsx', 'scripts/audit-contract.ts', '--check'], {
        cwd: PKG_ROOT,
        maxBuffer: 32 * 1024 * 1024,
      }));
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      throw new Error(
        `Contract audit reported new drift.\n\n${e.stderr ?? ''}\n${e.stdout ?? ''}\n` +
          `Fix the drifting request rather than re-snapshotting.`,
      );
    }

    expect(stdout).toContain('No new contract drift');
  }, 180_000);
});
