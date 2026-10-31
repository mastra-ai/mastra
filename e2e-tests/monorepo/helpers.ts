import { createHash } from 'crypto';
import { expect } from 'vitest';
import { join, relative } from 'path';
import { mkdtemp, readdir, readFile, readlink, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { execa, execaNode } from 'execa';

export const timeout = 5 * 60 * 1000;

export function getPnpmImporterDependencies(lockfile: string, importer: string): Map<string, string> {
  const lines = lockfile.split(/\r?\n/);
  const importerStart = lines.findIndex(line => line === `  ${importer}:`);
  if (importerStart === -1) {
    throw new Error(`Missing pnpm lockfile importer: ${importer}`);
  }

  const dependencies = new Map<string, string>();
  let dependencyName: string | undefined;
  for (let index = importerStart + 1; index < lines.length; index++) {
    const line = lines[index]!;
    if (/^  \S/.test(line)) break;

    const dependencyMatch = /^      ([^\s].*):$/.exec(line);
    if (dependencyMatch?.[1]) {
      dependencyName = dependencyMatch[1].replace(/^['"]|['"]$/g, '');
      continue;
    }

    const versionMatch = /^        version: (.+)$/.exec(line);
    if (dependencyName && versionMatch?.[1]) {
      dependencies.set(dependencyName, versionMatch[1].replace(/^['"]|['"]$/g, ''));
      dependencyName = undefined;
    }
  }

  return dependencies;
}

/**
 * Killing the `npm run dev` wrapper orphans the `mastra dev` grandchild, which
 * keeps running and holds `.mastra/dev.lock`. `mastra build` refuses to build
 * while that lock names a live pid, so later build suites in this file fail
 * with "A `mastra dev` server is running in this directory" unless the real
 * dev server is killed and the lock removed.
 */
export async function killOrphanedDevServer(projectDir: string) {
  const lockPath = join(projectDir, '.mastra', 'dev.lock');
  try {
    const { pid } = JSON.parse(await readFile(lockPath, 'utf-8'));
    if (typeof pid !== 'number' || pid <= 0) return;
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return;
    }
    await rm(lockPath, { force: true });
  } catch {}
}

export async function findInDir(root: string, targetName: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name === targetName) {
      return true;
    }
    if (entry.isDirectory()) {
      if (await findInDir(join(root, entry.name), targetName)) {
        return true;
      }
    }
  }
  return false;
}

export async function getDirectoryDigests(root: string): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};

  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((first, second) => first.name.localeCompare(second.name));

    for (const entry of entries) {
      const path = join(dir, entry.name);
      const relativePath = relative(root, path).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isSymbolicLink()) {
        digests[relativePath] = `link:${await readlink(path)}`;
      } else if (entry.isFile()) {
        digests[relativePath] = createHash('sha256')
          .update(await readFile(path))
          .digest('hex');
      }
    }
  }

  await visit(root);
  return digests;
}

// A Node preload that replaces fetch for PostHog hosts only, recording each batch a
// process sends instead of letting it reach the network.
export async function createPostHogCapture() {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-usage-telemetry-'));
  const capturePath = join(dir, 'posthog-batches.jsonl');
  const preloadPath = join(dir, 'capture-posthog.mjs');
  await writeFile(
    preloadPath,
    [
      "import { appendFileSync } from 'node:fs';",
      "import { gunzipSync } from 'node:zlib';",
      'const realFetch = globalThis.fetch;',
      'globalThis.fetch = async (input, init = {}) => {',
      "  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);",
      "  if (!url.hostname.endsWith('posthog.com')) return realFetch(input, init);",
      "  if (url.pathname.startsWith('/batch')) {",
      '    let body = Buffer.from(await new Response(init.body).arrayBuffer());',
      "    if (new Headers(init.headers).get('content-encoding') === 'gzip') body = gunzipSync(body);",
      "    appendFileSync(process.env.POSTHOG_CAPTURE_PATH, body.toString('utf8') + '\\n');",
      '  }',
      "  return new Response('{\"status\":1}', { status: 200, headers: { 'content-type': 'application/json' } });",
      '};',
    ].join('\n'),
  );

  return {
    preloadUrl: pathToFileURL(preloadPath).href,
    env: (port: number) => ({
      MASTRA_PORT: port.toString(),
      MASTRA_TELEMETRY_DISABLED: '',
      POSTHOG_CAPTURE_PATH: capturePath,
      // Keep the legacy usage sync's cursor file out of the real home directory.
      HOME: dir,
    }),
    async usageEvents() {
      const batches = await readFile(capturePath, 'utf-8').catch(() => '');
      return batches
        .split('\n')
        .filter(Boolean)
        .flatMap(line => JSON.parse(line).batch as Array<{ event: string; properties: Record<string, unknown> }>)
        .filter(event => event.event === 'mastra_model_token_usage_v2');
    },
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function waitForServer(port: number) {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/tools`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Server on port ${port} failed to start within timeout`);
}

// The usage agent's model reports 123 input and 45 output tokens per call.
export async function callUsageAgentTwice(port: number) {
  for (let call = 0; call < 2; call++) {
    const response = await fetch(`http://localhost:${port}/model-usage`, { method: 'POST' });
    expect(response.status).toBe(200);
  }
}

export const twoUsageCallsReportedAtShutdown = [
  expect.objectContaining({
    properties: expect.objectContaining({
      model: 'e2e-usage-model',
      input_tokens: 246,
      output_tokens: 90,
      report_reason: 'shutdown',
    }),
  }),
];

export const activeProcesses: Array<{
  controller: AbortController;
  proc: ReturnType<typeof execa | typeof execaNode>;
}> = [];

export async function cleanupAllProcesses() {
  for (const { controller, proc } of activeProcesses) {
    try {
      controller.abort();
      proc.kill('SIGKILL');
      await Promise.race([proc.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5_000))]);
    } catch {}
  }
  activeProcesses.length = 0;
}

process.once('SIGINT', async () => {
  await cleanupAllProcesses();
  process.exit(130);
});

process.once('SIGTERM', async () => {
  await cleanupAllProcesses();
  process.exit(143);
});

export async function removeOutputDir(path: string) {
  const outputDir = join(path, 'apps', 'custom', '.mastra', 'output');
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(outputDir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 4) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
  }
}
