import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getPluginDataDir } from '../paths.js';

describe('plugin data directories', () => {
  const options = { projectRoot: '/project', homeDir: '/profile', configDir: '.custom' };
  it('is profile-local, independent of project/install scope and does not create directories', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-data-path-'));
    try {
      const directory = getPluginDataDir('@acme/plugin', { ...options, homeDir });
      expect(directory).toBe(path.join(homeDir, '.custom', 'plugin-data', '%40acme%2Fplugin'));
      expect(getPluginDataDir('@acme/plugin', { ...options, homeDir, projectRoot: '/different' })).toBe(directory);
      expect(fs.existsSync(directory)).toBe(false);
    } finally {
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });
  it('separates profiles and cannot collide via pre-encoded IDs', () => {
    expect(getPluginDataDir('a/b', options)).not.toBe(getPluginDataDir('a%2Fb', options));
    expect(getPluginDataDir('id', options)).not.toBe(getPluginDataDir('id', { ...options, homeDir: '/other' }));
    expect(getPluginDataDir('id', options)).not.toBe(getPluginDataDir('id', { ...options, configDir: '.other' }));
  });
  it.each(['', '.', '..', '../evil', 'a/../b', '..\\evil', 'a\0b'])('rejects malicious ID %j', id => {
    expect(() => getPluginDataDir(id, options)).toThrow('Invalid plugin id');
  });
});
