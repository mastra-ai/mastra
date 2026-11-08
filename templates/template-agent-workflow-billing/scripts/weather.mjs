import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');
register('./typescript-loader.mjs', import.meta.url);
try {
  await import('./weather.ts');
} catch (error) {
  console.error(
    error?.code
      ? `Weather request failed: ${error.code}`
      : 'Weather request failed. Check arguments, private profiles, and the running local gateway.',
  );
  process.exitCode = 1;
}
