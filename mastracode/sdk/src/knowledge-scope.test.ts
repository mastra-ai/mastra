import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MACHINE_ID_FILE,
  localKnowledgeOrgId,
  localMachineId,
  resolveKnowledgeScopeIdentity,
} from './knowledge-scope.js';

const tempHomes: string[] = [];
function tempHome(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'mastracode-machine-id-'));
  tempHomes.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempHomes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('localMachineId', () => {
  it('generates a random id on first use and persists it under the config dir', () => {
    const homeDir = tempHome();
    const first = localMachineId({ homeDir });
    expect(first.ok).toBe(true);
    const id = first.ok ? first.id : '';
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(readFileSync(path.join(homeDir, '.mastracode', MACHINE_ID_FILE), 'utf-8').trim()).toBe(id);
    expect(localMachineId({ homeDir })).toEqual({ ok: true, id });
    expect(localMachineId({ homeDir: tempHome() })).not.toEqual({ ok: true, id });
  });

  it('reads a previously persisted id rather than the hostname, so renames do not move the org', () => {
    const homeDir = tempHome();
    const configDirName = '.mastracode-test';
    const dir = path.join(homeDir, configDirName);
    const stored = 'abcdef012345';
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, MACHINE_ID_FILE), `${stored}\n`);
    expect(localMachineId({ homeDir, configDirName })).toEqual({ ok: true, id: stored });
    expect(localKnowledgeOrgId({ homeDir, configDirName })).toBe(`mastracode-${stored}`);
  });

  it('refuses a corrupt id file instead of replacing it or substituting another identity', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'not a machine id\n');
    const result = localMachineId({ homeDir });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain(file);
    expect(readFileSync(file, 'utf-8')).toBe('not a machine id\n');
    expect(() => localKnowledgeOrgId({ homeDir })).toThrow(file);
    expect(resolveKnowledgeScopeIdentity(undefined, { homeDir })).toMatchObject({ resolved: false });
    // Not cached: once repaired the stored id is used.
    writeFileSync(file, 'abcdef012345\n');
    expect(localMachineId({ homeDir })).toEqual({ ok: true, id: 'abcdef012345' });
  });

  it('takes the winner’s id when another process creates the file first', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    const winner = '0123456789ab';
    // Simulate the race: the other process lands between our read-miss and our exclusive create.
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation((dir, opts) => {
      const result = mkdirSync(dir, opts as never);
      if (!fs.existsSync(file)) fs.writeFileSync(file, `${winner}\n`);
      return result;
    });
    try {
      expect(localMachineId({ homeDir })).toEqual({ ok: true, id: winner });
      expect(readFileSync(file, 'utf-8').trim()).toBe(winner);
    } finally {
      mkdir.mockRestore();
    }
  });

  it('fails closed without persisting, caching, or substituting an identity when the config dir is unwritable', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });
    try {
      const result = localMachineId({ homeDir });
      expect(result).toMatchObject({ ok: false });
      expect(result.ok ? '' : result.reason).toContain('EACCES');
      expect(resolveKnowledgeScopeIdentity(undefined, { homeDir })).toMatchObject({ resolved: false });
      expect(fs.existsSync(file)).toBe(false);
    } finally {
      mkdir.mockRestore();
    }
    // Not cached: once the directory is writable again a real id is minted.
    expect(localMachineId({ homeDir })).toMatchObject({ ok: true, id: expect.stringMatching(/^[0-9a-f]{12}$/) });
  });

  it('fails closed when the id file exists but cannot be read', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'abcdef012345\n');
    const read = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });
    try {
      expect(localMachineId({ homeDir })).toMatchObject({ ok: false });
    } finally {
      read.mockRestore();
    }
    expect(localMachineId({ homeDir })).toEqual({ ok: true, id: 'abcdef012345' });
  });
});

describe('resolveKnowledgeScopeIdentity', () => {
  it('defaults TUI/studio sessions to the machine org regardless of project', () => {
    const homeDir = tempHome();
    const expected = { resolved: true, organizationId: localKnowledgeOrgId({ homeDir }) };
    expect(resolveKnowledgeScopeIdentity(undefined, { homeDir })).toEqual(expected);
    expect(resolveKnowledgeScopeIdentity({ projectPath: '/tmp/p' } as never, { homeDir })).toEqual(expected);
    expect(resolveKnowledgeScopeIdentity({ projectPath: '/tmp/other' } as never, { homeDir })).toEqual(expected);
  });

  it('anchors Factory project sessions on the seeded org and project ids', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: 'org-1', factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: 'proj-1',
    });
  });

  it('trims the org id the way the Factory seeder stores it', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: ' org-1 ' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: undefined,
    });
  });

  it('keeps the session resource for an org-only Factory session', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: 'org-1' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: undefined,
    });
  });

  it('fails closed for Factory-owned sessions without a resolved org', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: 'proj-1',
    });
    expect(resolveKnowledgeScopeIdentity({ factoryProjectId: 'proj-1', factoryOrgId: '   ' } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: 'proj-1',
    });
    expect(resolveKnowledgeScopeIdentity({ factoryOrgUnresolved: true } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: undefined,
    });
  });
});
