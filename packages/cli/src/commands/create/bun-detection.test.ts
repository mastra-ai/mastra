import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPackageManager } from '../utils';

describe('Bun Runtime Detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should detect bun from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0 npm/? node/v20.0.0 darwin x64';
    expect(getPackageManager()).toBe('bun');
  });

  it('should detect bun from npm_execpath', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '/usr/local/bin/bun';
    expect(getPackageManager()).toBe('bun');
  });

  it('should fallback to npm if no package manager is detected', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '';
    expect(getPackageManager()).toBe('npm');
  });
});
