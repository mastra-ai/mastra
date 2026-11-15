import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
process.env.BILLING_PROJECT_ROOT = root;
process.env.MASTRA_PROJECT_ROOT = root;
register('./typescript-loader.mjs', import.meta.url);
try {
  const { runSandboxCommand } = await import('./autumn-sandbox.ts');
  await runSandboxCommand(process.argv.slice(2), process.env);
} catch (error) {
  console.error(
    error?.name === 'SandboxSetupError'
      ? error.message
      : 'Autumn sandbox command failed. Check docs/autumn.md, configuration, private files and service availability.',
  );
  process.exitCode = 1;
}
