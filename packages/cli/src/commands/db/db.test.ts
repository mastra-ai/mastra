import { describe, expect, it } from 'vitest';
import type { Environment } from '../env/platform-api.js';
import { defaultDatabaseName, formatScope } from './db.js';

const environment = {
  id: 'env-1',
  projectId: 'proj-1',
  name: 'Staging',
  slug: 'my-app-staging',
  type: 'staging',
  region: 'eu',
  branch: null,
  instanceUrl: null,
  customServerUrl: null,
  observabilityProjectId: null,
  envVars: null,
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
} as Environment;

describe('formatScope', () => {
  it('labels project-scoped databases as shared by all environments', () => {
    expect(formatScope({ environmentId: null }, [environment])).toBe('project (all environments)');
  });

  it('resolves env-scoped databases to the environment slug', () => {
    expect(formatScope({ environmentId: 'env-1' }, [environment])).toBe('environment: my-app-staging');
  });

  it('falls back to the raw environment id when the environment is gone', () => {
    expect(formatScope({ environmentId: 'env-gone' }, [environment])).toBe('environment: env-gone');
  });
});

describe('defaultDatabaseName', () => {
  it('derives a name from the project slug', () => {
    expect(defaultDatabaseName({ name: 'My App', slug: 'my-app' })).toBe('my-app-db');
  });

  it('falls back to the project name and sanitizes it for DNS-safe providers', () => {
    expect(defaultDatabaseName({ name: 'My_Fancy App!', slug: null })).toBe('my-fancy-app-db');
  });

  it('never returns leading/trailing hyphens or an empty base', () => {
    expect(defaultDatabaseName({ name: '---', slug: null })).toBe('mastra-db');
  });
});
