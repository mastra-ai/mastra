import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadProjectConfig, saveProjectConfig, PROJECT_CONFIG_FILE } from './project-config';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mastra-project-config-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('loadProjectConfig', () => {
  it('returns null when no config file exists', async () => {
    const result = await loadProjectConfig(tempDir);
    expect(result).toBeNull();
  });

  it('loads config from default .mastra-project.json', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    writeFileSync(join(tempDir, PROJECT_CONFIG_FILE), JSON.stringify(config, null, 2));

    const result = await loadProjectConfig(tempDir);
    expect(result).toEqual(config);
  });

  it('loads config from custom file path', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    writeFileSync(join(tempDir, 'custom-config.json'), JSON.stringify(config, null, 2));

    const result = await loadProjectConfig(tempDir, 'custom-config.json');
    expect(result).toEqual(config);
  });

  it('loads config from absolute path', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    const absolutePath = join(tempDir, 'absolute-config.json');
    writeFileSync(absolutePath, JSON.stringify(config, null, 2));

    const result = await loadProjectConfig(tempDir, absolutePath);
    expect(result).toEqual(config);
  });
});

describe('saveProjectConfig', () => {
  it('writes config to default .mastra-project.json', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    await saveProjectConfig(tempDir, config);

    const content = readFileSync(join(tempDir, PROJECT_CONFIG_FILE), 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toEqual(config);
  });

  it('writes config to custom file path', async () => {
    const config = {
      projectId: 'proj-1',
      projectName: 'My App',
      organizationId: 'org-1',
    };

    await saveProjectConfig(tempDir, config, 'custom-config.json');

    const content = readFileSync(join(tempDir, 'custom-config.json'), 'utf-8');
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

    const raw = readFileSync(join(tempDir, PROJECT_CONFIG_FILE), 'utf-8');

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
