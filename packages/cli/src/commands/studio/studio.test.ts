import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from './studio';

const createdDirs: string[] = [];

function createStudioFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'mastra-studio-test-'));
  createdDirs.push(dir);

  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("ok")');

  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html>
<html>
  <head>
    <base href="%%MASTRA_STUDIO_BASE_PATH%%/" />
    <script>window.MASTRA_STUDIO_BASE_PATH = '%%MASTRA_STUDIO_BASE_PATH%%';</script>
  </head>
  <body>studio</body>
</html>`,
  );

  return dir;
}

afterEach(() => {
  delete process.env.MASTRA_STUDIO_BASE_PATH;

  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('studio base path support', () => {
  it('injects base path and serves assets under configured subpath', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const server = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const htmlResponse = await fetch(`http://127.0.0.1:${port}/agents`);
      const html = await htmlResponse.text();

      expect(htmlResponse.status).toBe(200);
      expect(html).toContain('<base href="/agents/"');
      expect(html).toContain("window.MASTRA_STUDIO_BASE_PATH = '/agents'");

      const assetResponse = await fetch(`http://127.0.0.1:${port}/agents/assets/app.js`);
      const assetBody = await assetResponse.text();

      expect(assetResponse.status).toBe(200);
      expect(assetBody).toContain('console.log("ok")');
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });
});
