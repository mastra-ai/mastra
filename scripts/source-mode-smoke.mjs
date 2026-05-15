import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const DIST_DIRS = [
  'packages/core/dist',
  'packages/loggers/dist',
  'packages/_internal-core/dist',
  'stores/libsql/dist',
  'voice/openai/dist',
  'server-adapters/express/dist',
  'auth/clerk/dist',
  'deployers/vercel/dist',
  'observability/langfuse/dist',
  'client-sdks/client-js/dist',
  'workspaces/s3/dist',
  'integrations/tavily/dist',
];

const RESOLVE_TARGETS = [
  { specifier: '@mastra/core', cwd: 'packages/core' },
  { specifier: '@mastra/core/agent', cwd: 'packages/core' },
  { specifier: '@mastra/core/logger', cwd: 'packages/core' },
  { specifier: '@mastra/core/tools', cwd: 'packages/core' },
  { specifier: '@mastra/loggers', cwd: 'packages/loggers' },
  { specifier: '@mastra/libsql', cwd: 'stores/libsql' },
  { specifier: '@mastra/voice-openai', cwd: 'voice/openai' },
  { specifier: '@mastra/express', cwd: 'server-adapters/express' },
  { specifier: '@mastra/auth-clerk', cwd: 'auth/clerk' },
  { specifier: '@mastra/deployer-vercel', cwd: 'deployers/vercel' },
  { specifier: '@mastra/langfuse', cwd: 'observability/langfuse' },
  { specifier: '@mastra/client-js', cwd: 'client-sdks/client-js' },
  { specifier: '@mastra/s3', cwd: 'workspaces/s3' },
  { specifier: '@mastra/tavily', cwd: 'integrations/tavily' },
];

const renamed = [];

function moveDistAway(relativePath) {
  const distPath = join(ROOT, relativePath);
  if (!existsSync(distPath)) return;

  const temporaryPath = `${distPath}.source-mode-smoke`;
  rmSync(temporaryPath, { recursive: true, force: true });
  renameSync(distPath, temporaryPath);
  renamed.push([temporaryPath, distPath]);
}

function restoreDist() {
  for (const [temporaryPath, distPath] of renamed.reverse()) {
    rmSync(distPath, { recursive: true, force: true });
    if (existsSync(temporaryPath)) renameSync(temporaryPath, distPath);
  }
}

try {
  for (const relativePath of DIST_DIRS) moveDistAway(relativePath);

  for (const { specifier, cwd } of RESOLVE_TARGETS) {
    const resolver = `
      const specifier = ${JSON.stringify(specifier)};
      const resolved = await import.meta.resolve(specifier);
      if (!resolved.includes('/src/')) {
        throw new Error(\`${'${specifier}'} resolved to non-source path ${'${resolved}'}\`);
      }
      console.log(\`${'${specifier}'} -> ${'${resolved}'}\`);
    `;

    const result = spawnSync(
      process.execPath,
      ['--conditions=mastra-source', '--input-type=module', '--eval', resolver],
      {
        cwd: join(ROOT, cwd),
        encoding: 'utf8',
        stdio: 'inherit',
      },
    );

    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} finally {
  restoreDist();
}
