import { describe, it, expect } from 'vitest';
import { diagnosticsKey } from './client';

describe('diagnosticsKey', () => {
  it('returns the same key for Windows file URIs that differ in drive-letter case and colon encoding', () => {
    const fromPathToFileURL = 'file:///C:/Users/me/res/client.lua';
    const fromVscodeUri = 'file:///c%3A/Users/me/res/client.lua';

    expect(diagnosticsKey(fromPathToFileURL)).toBe(diagnosticsKey(fromVscodeUri));
  });

  it('lowercases the drive letter', () => {
    const key = diagnosticsKey('file:///C:/Users/me/res/client.lua');
    expect(key).toContain('c:');
    expect(key).not.toContain('C:');
  });

  it('returns a normal posix path unchanged', () => {
    const key = diagnosticsKey('file:///home/me/res/client.lua');
    expect(key).toBe('/home/me/res/client.lua');
  });

  it('passes through non-file-URI strings unchanged', () => {
    expect(diagnosticsKey('/already/a/path.ts')).toBe('/already/a/path.ts');
  });
});
