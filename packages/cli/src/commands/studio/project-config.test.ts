import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadProjectConfig, saveProjectConfig } from './project-config';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mastra-project-config-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  it('returns null when .mastra/project.json does not exist', async () => {
    const result = await loadProjectConfig(tempDir);
    expect(result).toBeNull();
  });

  it('loads an existing project config', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    // Write the file manually
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(tempDir, '.mastra'), { recursive: true });
    writeFileSync(join(tempDir, '.mastra', 'project.json'), JSON.stringify(config, null, 2));

    const result = await loadProjectConfig(tempDir);
    expect(result).toEqual(config);
  });
});

describe('saveProjectConfig', () => {
  it('creates .mastra directory and writes project.json', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    await saveProjectConfig(tempDir, config);

    const content = readFileSync(join(tempDir, '.mastra', 'project.json'), 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toEqual(config);
  });

  it('writes pretty-printed JSON with trailing newline', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    await saveProjectConfig(tempDir, config);

    const raw = readFileSync(join(tempDir, '.mastra', 'project.json'), 'utf-8');

    expect(raw).toBe(JSON.stringify(config, null, 2) + '\n');
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('overwrites existing project config', async () => {
    const config1 = { projectId: 'proj-1', projectName: 'App 1', organizationId: 'org-1' };
    const config2 = { projectId: 'proj-2', projectName: 'App 2', organizationId: 'org-2' };

    await saveProjectConfig(tempDir, config1);
    await saveProjectConfig(tempDir, config2);

    const result = await loadProjectConfig(tempDir);
    expect(result).toEqual(config2);
  });
});
