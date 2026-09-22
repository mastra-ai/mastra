import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type FactoryDevSettings,
  loadEnvironmentValue,
  loadSettings,
  localPostgresUrl,
  saveEnvironment,
  saveSettings,
  settingsPath,
} from './settings.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-dev-settings-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe('Factory development settings', () => {
  it('returns null when setup has not run', async () => {
    expect(await loadSettings(await createTempDir())).toBeNull();
  });

  it('persists non-secret setup choices and loads them again', async () => {
    const root = await createTempDir();
    const settings: FactoryDevSettings = {
      version: 1,
      auth: { source: 'mastra-cli-session' },
      organization: { id: 'org-1', name: 'Mastra' },
      project: { id: 'project-1', name: 'Factory' },
      environment: { id: 'env-1', name: 'Production' },
      database: { provider: 'platform', databaseId: 'database-1' },
      sandbox: { provider: 'platform' },
    };

    await saveSettings(root, settings);

    expect(await loadSettings(root)).toEqual(settings);
    const contents = await fs.readFile(settingsPath(root), 'utf8');
    expect(contents).not.toContain('token');
    expect(contents).not.toContain('DATABASE_URL');
    expect((await fs.stat(settingsPath(root))).mode & 0o777).toBe(0o600);
  });

  it('writes resolved values to .env while preserving unmanaged values and removing stale managed values', async () => {
    const root = await createTempDir();
    const file = path.join(root, '.env');
    await fs.writeFile(file, 'OPENAI_API_KEY=existing\nDATABASE_URL=stale\nFACTORY_SANDBOX_PROVIDER=local\n');

    await saveEnvironment(file, {
      MASTRA_PLATFORM_ACCESS_TOKEN: undefined,
      MASTRA_PLATFORM_SECRET_KEY: 'sk_selected-org',
      MASTRA_PROJECT_ID: 'project-1',
      DATABASE_URL: 'postgres://platform/database',
      FACTORY_SANDBOX_PROVIDER: undefined,
    });

    expect(await fs.readFile(file, 'utf8')).toBe(
      'OPENAI_API_KEY=existing\n' +
        'MASTRA_PLATFORM_SECRET_KEY="sk_selected-org"\n' +
        'MASTRA_PROJECT_ID="project-1"\n' +
        'DATABASE_URL="postgres://platform/database"\n',
    );
    expect(await loadEnvironmentValue(file, 'MASTRA_PLATFORM_SECRET_KEY')).toBe('sk_selected-org');
    expect(await loadEnvironmentValue(file, 'MASTRA_PLATFORM_ACCESS_TOKEN')).toBeUndefined();
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  });

  it('derives the local PostgreSQL URL without persisting credentials', () => {
    expect(localPostgresUrl({})).toBe('postgres://user:pass@localhost:54329/mastracode_web');
    expect(
      localPostgresUrl({ POSTGRES_USER: 'factory user', POSTGRES_PASSWORD: 'p@ss', POSTGRES_DB: 'factory/dev' }),
    ).toBe('postgres://factory%20user:p%40ss@localhost:54329/factory%2Fdev');
  });
});
