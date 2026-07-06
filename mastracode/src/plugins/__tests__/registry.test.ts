import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { getPluginRegistryPath, getPluginRoot, getPluginScopePaths } from '../paths.js';
import {
  loadPluginRegistry,
  mergePluginRegistries,
  removePluginRecord,
  savePluginRegistry,
  setPluginRecord,
} from '../registry.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('plugin paths', () => {
  it('computes project and global plugin roots using the configured configDir', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugins-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');

    expect(getPluginRoot('project', { projectRoot, homeDir, configDir: '.acme-code' })).toBe(
      path.join(projectRoot, '.acme-code', 'plugins'),
    );
    expect(getPluginRegistryPath('global', { projectRoot, homeDir, configDir: '.acme-code' })).toBe(
      path.join(homeDir, '.acme-code', 'plugins', 'plugins.json'),
    );
    expect(getPluginScopePaths('project', { projectRoot, homeDir }).sourcesPath).toBe(
      path.join(projectRoot, '.mastracode', 'plugins', 'sources'),
    );
  });
});

describe('plugin registry', () => {
  it('loads, validates, and saves plugin registry files', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugins-'));
    const registryPath = path.join(tempDir, 'plugins.json');

    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        disabledPlugins: ['valid', 12, 'valid'],
        plugins: {
          valid: {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: '../plugin',
            entry: 'src/index.ts',
            ref: 12,
          },
          invalid: { enabled: true, source: 'npm' },
        },
      }),
    );

    const loaded = loadPluginRegistry(registryPath);

    expect(loaded).toEqual({
      disabledPlugins: ['valid'],
      plugins: {
        valid: {
          enabled: true,
          source: 'local',
          specifier: '../plugin',
          path: '../plugin',
          entry: 'src/index.ts',
        },
      },
    });

    savePluginRegistry(
      registryPath,
      setPluginRecord(loaded, 'github.plugin', {
        enabled: false,
        source: 'github',
        specifier: 'https://github.com/acme/plugin',
        path: 'sources/github/acme-plugin',
        entry: 'src/index.ts',
        ref: 'main',
      }),
    );

    expect(loadPluginRegistry(registryPath).plugins['github.plugin']?.ref).toBe('main');
  });

  it('returns empty registries when files are missing or invalid', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugins-'));
    const missingPath = path.join(tempDir, 'missing.json');
    const invalidPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(invalidPath, '{invalid');

    expect(loadPluginRegistry(missingPath)).toEqual({ plugins: {}, disabledPlugins: [] });
    expect(loadPluginRegistry(invalidPath)).toEqual({ plugins: {}, disabledPlugins: [] });
  });

  it('merges global and project registries with project plugins taking precedence', () => {
    const globalRegistry = setPluginRecord({ plugins: {} }, 'acme.plugin', {
      enabled: true,
      source: 'github',
      specifier: 'https://github.com/acme/global',
      path: 'sources/github/global',
      entry: 'src/index.ts',
    });
    const projectRegistry = setPluginRecord({ plugins: {} }, 'acme.plugin', {
      enabled: false,
      source: 'local',
      specifier: '../project',
      path: '../project',
      entry: 'index.ts',
    });

    expect(mergePluginRegistries(globalRegistry, projectRegistry)).toEqual([
      {
        id: 'acme.plugin',
        scope: 'project',
        enabled: false,
        source: 'local',
        specifier: '../project',
        path: '../project',
        entry: 'index.ts',
      },
    ]);
  });

  it('marks merged plugins blocked when their id is listed in disabledPlugins', () => {
    const globalRegistry = setPluginRecord({ plugins: {} }, 'alexandria', {
      enabled: true,
      source: 'github',
      specifier: 'https://github.com/acme/alexandria',
      path: 'sources/github/alexandria',
      entry: 'src/index.ts',
    });
    const projectRegistry = { plugins: {}, disabledPlugins: ['alexandria'] };

    expect(mergePluginRegistries(globalRegistry, projectRegistry)).toMatchObject([
      {
        id: 'alexandria',
        scope: 'global',
        blocked: true,
      },
    ]);
  });

  it('removes plugin records immutably', () => {
    const registry = setPluginRecord({ plugins: {} }, 'acme.plugin', {
      enabled: true,
      source: 'local',
      specifier: '../plugin',
      path: '../plugin',
      entry: 'index.ts',
    });

    expect(removePluginRecord(registry, 'acme.plugin')).toEqual({ plugins: {}, disabledPlugins: [] });
    expect(registry.plugins).toHaveProperty('acme.plugin');
  });
});
