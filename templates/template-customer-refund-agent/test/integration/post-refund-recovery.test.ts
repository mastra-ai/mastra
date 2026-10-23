import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

/** This is intentionally a process boundary, rather than a mocked workflow
 * restart. The first process exits immediately after the real refund write;
 * the second reopens the same SQLite file and real Mastra snapshot. */
describe('post-refund workflow recovery', () => {
  it('completes a persisted approved decision without a second approval or refund', async () => {
    const token = randomUUID();
    const databasePath = join(tmpdir(), `phase002-post-refund-${token}.db`);
    const output = `test/.phase002-post-refund-${token}.mjs`;
    const env = {
      ...process.env,
      MASTRA_TELEMETRY_DISABLED: '1',
      DISABLE_RUNTIME_SCORERS: '1',
      LOCAL_AUTH_SIGNING_KEY: 'phase003-test-signing-key-must-be-at-least-32-chars',
      DATABASE_URL: `file:${databasePath}`,
    };
    try {
      await build({
        entryPoints: ['test/fixtures/post-refund-recovery.ts'],
        bundle: true,
        format: 'esm',
        outfile: output,
        packages: 'external',
        platform: 'node',
      });
      await expect(execFileAsync(process.execPath, [output, 'init'], { env })).rejects.toMatchObject({ code: 71 });
      const recovered = await execFileAsync(process.execPath, [output, 'recover'], {
        env,
      });
      const line = recovered.stdout.split('\n').find(entry => entry.startsWith('POST_REFUND_RECOVERY_RESULT '));
      expect(line).toBeDefined();
      const result = JSON.parse(line!.slice('POST_REFUND_RECOVERY_RESULT '.length));
      expect(result).toMatchObject({
        case: { status: 'resolved', refundResult: { status: 'executed' } },
        counts: { refunds: 1, outbox: 1, deliveries: 1 },
      });
    } finally {
      await Promise.all([
        rm(output, { force: true }),
        rm(databasePath, { force: true }),
        rm(`${databasePath}-shm`, { force: true }),
        rm(`${databasePath}-wal`, { force: true }),
      ]);
    }
  });
});
