import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

function loadEnvFile(): void {
  const candidates = [
    // Package-local env for adapter contributors.
    resolve(process.cwd(), '.env'),
    // Monorepo-root env for workspace-level integration testing.
    resolve(process.cwd(), '../../.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] ??= value;
    }

    return;
  }
}

loadEnvFile();

export default defineConfig({
  test: {
    name: 'e2e:stores/oracledb',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
