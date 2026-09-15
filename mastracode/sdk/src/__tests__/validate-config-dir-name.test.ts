import { describe, expect, it } from 'vitest';
import { validateConfigDirName, DEFAULT_CONFIG_DIR } from '../constants.js';

describe('validateConfigDirName', () => {
  it('accepts the default config dir', () => {
    expect(() => validateConfigDirName(DEFAULT_CONFIG_DIR)).not.toThrow();
  });

  it('accepts a simple dotted directory name', () => {
    expect(() => validateConfigDirName('.my-tool')).not.toThrow();
  });

  it('accepts a name without a leading dot', () => {
    expect(() => validateConfigDirName('my-config')).not.toThrow();
  });

  it('accepts a name with hyphens and numbers', () => {
    expect(() => validateConfigDirName('.acme-code-2')).not.toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => validateConfigDirName('')).toThrow('non-empty');
  });

  it('rejects a whitespace-only string', () => {
    expect(() => validateConfigDirName('   ')).toThrow('non-empty');
  });

  it('rejects a tab-only string', () => {
    expect(() => validateConfigDirName('\t')).toThrow('non-empty');
  });

  it('rejects an absolute path (unix)', () => {
    expect(() => validateConfigDirName('/etc/config')).toThrow('single directory name');
  });

  it('rejects a path with forward slash', () => {
    expect(() => validateConfigDirName('foo/bar')).toThrow('single directory name');
  });

  it('rejects a path with backslash', () => {
    expect(() => validateConfigDirName('foo\\bar')).toThrow('single directory name');
  });

  it('rejects parent traversal (..)', () => {
    expect(() => validateConfigDirName('..')).toThrow('single directory name');
  });

  it('rejects current directory (.)', () => {
    expect(() => validateConfigDirName('.')).toThrow('single directory name');
  });

  it('does not reject names that contain dots but are not traversal', () => {
    expect(() => validateConfigDirName('.my.tool')).not.toThrow();
    expect(() => validateConfigDirName('...config')).not.toThrow();
  });
});
