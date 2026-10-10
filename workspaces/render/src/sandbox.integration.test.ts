import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';

const enabled = Boolean(process.env.RENDER_API_KEY && process.env.RENDER_WORKSPACE_ID);
describe.skipIf(!enabled)('Render Sandbox cloud integration', () => {
  it('executes commands, transfers files, preserves attached resources and confirms owned cleanup', async () => {
    await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/live.ts'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      timeout: 240_000,
      maxBuffer: 1024 * 1024,
    });
  }, 250_000);
});
