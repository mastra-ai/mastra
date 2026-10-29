import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('owned PostgreSQL pools survive a dropped checked-out connection (#28234)', () => {
  it.each(['store', 'store-host', 'store-client-config', 'vector', 'factory', 'domain'])(
    '%s rejects the interrupted query and reconnects without an uncaught exception',
    async owner => {
      // Isolate Node's unhandled EventEmitter error behavior from Vitest's own
      // uncaughtException handler. The child installs only a monitor, so an
      // unguarded checked-out client really does crash it.
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(new URL('./test-fixtures/terminate-backend.ts', import.meta.url)), owner],
        { timeout: 20_000, env: process.env },
      );
      expect(stderr).not.toContain('UNCAUGHT_EXCEPTION');
      expect(stdout).toContain('QUERY_REJECTED');
      expect(stdout).toContain('RECOVERED');
    },
    25_000,
  );
});
