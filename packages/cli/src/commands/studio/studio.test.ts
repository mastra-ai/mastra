import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
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
    <script>
      window.MASTRA_STUDIO_BASE_PATH = '%%MASTRA_STUDIO_BASE_PATH%%';
      window.MASTRA_TEMPLATES = '%%MASTRA_TEMPLATES%%';
      window.MASTRA_AGENT_SIGNALS = '%%MASTRA_AGENT_SIGNALS%%';
      window.MASTRA_SIGNALS_UI = '%%MASTRA_SIGNALS_UI%%';
      window.MASTRA_ORGANIZATION_ID = '%%MASTRA_ORGANIZATION_ID%%';
      window.MASTRA_PLATFORM_PROJECT_ID = '%%MASTRA_PLATFORM_PROJECT_ID%%';
      window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = '%%MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT%%';
      window.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT = '%%MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT%%';
    </script>
  </head>
  <body>studio</body>
</html>`,
  );

  return dir;
}

function request(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, response => {
        const chunks: string[] = [];
        response.setEncoding('utf8');
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: chunks.join(''),
          });
        });
      })
      .on('error', reject);
  });
}

afterEach(() => {
  delete process.env.MASTRA_STUDIO_BASE_PATH;
  delete process.env.MASTRA_TEMPLATES;
  delete process.env.MASTRA_AGENT_SIGNALS;
  delete process.env.MASTRA_SIGNALS_UI;
  delete process.env.MASTRA_ORGANIZATION_ID;
  delete process.env.MASTRA_PLATFORM_PROJECT_ID;
  delete process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
  delete process.env.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT;

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
      const htmlResponse = await request(`http://127.0.0.1:${port}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain('<base href="/agents/"');
      expect(htmlResponse.body).toContain("window.MASTRA_STUDIO_BASE_PATH = '/agents'");

      const assetResponse = await request(`http://127.0.0.1:${port}/agents/assets/app.js`);

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.body).toContain('console.log("ok")');
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('injects MASTRA_TEMPLATES from env', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    process.env.MASTRA_TEMPLATES = 'true';
    const studioDir = createStudioFixture();
    const server = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${port}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_TEMPLATES = 'true'");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('enables agent signals by default and preserves the explicit opt-out', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const defaultServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => defaultServer.listen(0, resolve));
    const defaultAddress = defaultServer.address();
    const defaultPort = typeof defaultAddress === 'object' && defaultAddress ? defaultAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${defaultPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_AGENT_SIGNALS = 'true'");
    } finally {
      await new Promise<void>((resolve, reject) => defaultServer.close(err => (err ? reject(err) : resolve())));
    }

    process.env.MASTRA_AGENT_SIGNALS = 'false';
    const optOutServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => optOutServer.listen(0, resolve));
    const optOutAddress = optOutServer.address();
    const optOutPort = typeof optOutAddress === 'object' && optOutAddress ? optOutAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${optOutPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_AGENT_SIGNALS = 'false'");
    } finally {
      await new Promise<void>((resolve, reject) => optOutServer.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('disables the signals UI by default and enables it when explicitly opted in', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const defaultServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => defaultServer.listen(0, resolve));
    const defaultAddress = defaultServer.address();
    const defaultPort = typeof defaultAddress === 'object' && defaultAddress ? defaultAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${defaultPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_SIGNALS_UI = 'false'");
    } finally {
      await new Promise<void>((resolve, reject) => defaultServer.close(err => (err ? reject(err) : resolve())));
    }

    process.env.MASTRA_SIGNALS_UI = 'true';
    const optInServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => optInServer.listen(0, resolve));
    const optInAddress = optInServer.address();
    const optInPort = typeof optInAddress === 'object' && optInAddress ? optInAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${optInPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_SIGNALS_UI = 'true'");
    } finally {
      await new Promise<void>((resolve, reject) => optInServer.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('injects empty platform endpoints by default and the configured values when set', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const defaultServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => defaultServer.listen(0, resolve));
    const defaultAddress = defaultServer.address();
    const defaultPort = typeof defaultAddress === 'object' && defaultAddress ? defaultAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${defaultPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain("window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = ''");
      expect(htmlResponse.body).toContain("window.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT = ''");
      expect(htmlResponse.body).toContain("window.MASTRA_ORGANIZATION_ID = ''");
      expect(htmlResponse.body).toContain("window.MASTRA_PLATFORM_PROJECT_ID = ''");
    } finally {
      await new Promise<void>((resolve, reject) => defaultServer.close(err => (err ? reject(err) : resolve())));
    }

    process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = 'https://observability.example.com';
    process.env.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT = 'https://learning.example.com';
    process.env.MASTRA_ORGANIZATION_ID = 'org-123';
    process.env.MASTRA_PLATFORM_PROJECT_ID = 'proj-456';
    const optInServer = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => optInServer.listen(0, resolve));
    const optInAddress = optInServer.address();
    const optInPort = typeof optInAddress === 'object' && optInAddress ? optInAddress.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${optInPort}/agents`);

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.body).toContain(
        "window.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = 'https://observability.example.com'",
      );
      expect(htmlResponse.body).toContain(
        "window.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT = 'https://learning.example.com'",
      );
      expect(htmlResponse.body).toContain("window.MASTRA_ORGANIZATION_ID = 'org-123'");
      expect(htmlResponse.body).toContain("window.MASTRA_PLATFORM_PROJECT_ID = 'proj-456'");
    } finally {
      await new Promise<void>((resolve, reject) => optInServer.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('delivers hostile platform env values to window.* intact without executing them', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const organizationId = "org'; window.pwned = true; //";
    const platformProjectId = 'proj-$&-dollar';
    const observabilityEndpoint = 'https://x.example</script><script>window.pwned = true</script>';
    process.env.MASTRA_ORGANIZATION_ID = organizationId;
    process.env.MASTRA_PLATFORM_PROJECT_ID = platformProjectId;
    process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = observabilityEndpoint;
    const studioDir = createStudioFixture();
    const server = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const htmlResponse = await request(`http://127.0.0.1:${port}/agents`);

      expect(htmlResponse.status).toBe(200);

      // Browsers close an inline script at the first `</script>`, wherever it
      // appears. If a value could smuggle one in, the page would grow a second
      // script block containing the injected payload.
      const scripts = [...htmlResponse.body.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
      expect(scripts).toHaveLength(1);

      // Execute the served config script the way a browser would: it must
      // assign the raw env values verbatim and nothing else. A breakout would
      // throw a SyntaxError or set `window.pwned`.
      const windowStub: Record<string, unknown> = {};

      new Function('window', scripts[0]![1]!)(windowStub);
      expect(windowStub.pwned).toBeUndefined();
      expect(windowStub.MASTRA_ORGANIZATION_ID).toBe(organizationId);
      expect(windowStub.MASTRA_PLATFORM_PROJECT_ID).toBe(platformProjectId);
      expect(windowStub.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT).toBe(observabilityEndpoint);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('preserves the full query string when rewriting asset requests', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const server = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const assetResponse = await request(`http://127.0.0.1:${port}/agents/assets/app.js?first=1?second=2`);

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.body).toContain('console.log("ok")');
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });

  it('does not treat SPA routes with asset-like substrings as static assets', async () => {
    process.env.MASTRA_STUDIO_BASE_PATH = '/agents';
    const studioDir = createStudioFixture();
    const server = createServer(studioDir, {}, '');

    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const spaLikeRoute = await request(`http://127.0.0.1:${port}/agents/user/assets-settings`);

      expect(spaLikeRoute.status).toBe(200);
      expect(spaLikeRoute.body).toContain('<body>studio</body>');
    } finally {
      await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    }
  });
});
