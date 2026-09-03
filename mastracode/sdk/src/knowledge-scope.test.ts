import { createHash } from 'node:crypto';
import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
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
    const id = localMachineId({ homeDir });
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(readFileSync(path.join(homeDir, '.mastracode', MACHINE_ID_FILE), 'utf-8').trim()).toBe(id);
    expect(localMachineId({ homeDir })).toBe(id);
    expect(localMachineId({ homeDir: tempHome() })).not.toBe(id);
  });

  it('reads a previously persisted id rather than the hostname, so renames do not move the org', () => {
    const homeDir = tempHome();
    const configDirName = '.mastracode-test';
    const dir = path.join(homeDir, configDirName);
    const stored = 'abcdef012345';
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, MACHINE_ID_FILE), `${stored}\n`);
    expect(localMachineId({ homeDir, configDirName })).toBe(stored);
    expect(stored).not.toBe(createHash('sha256').update(hostname()).digest('hex').slice(0, 12));
    expect(localKnowledgeOrgId({ homeDir, configDirName })).toBe(`mastracode-${stored}`);
  });

  it('replaces a corrupt id file instead of trusting it', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'not a machine id\n');
    const id = localMachineId({ homeDir });
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(readFileSync(file, 'utf-8').trim()).toBe(id);
  });

  it('takes the winner’s id when another process creates the file first', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    const winner = '0123456789ab';
    // Simulate the race: the other process lands between our read-miss and our exclusive create.
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementationOnce((dir, opts) => {
      const result = fs.mkdirSync(dir, opts);
      fs.writeFileSync(file, `${winner}\n`);
      return result;
    });
    try {
      expect(localMachineId({ homeDir })).toBe(winner);
      expect(readFileSync(file, 'utf-8').trim()).toBe(winner);
    } finally {
      mkdir.mockRestore();
    }
  });

  it('converges on one id when two processes recover from the same corrupt file', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'garbage\n');
    const winner = 'fedcba987654';
    // The other process moves the corrupt file aside and creates its id while we are between our EEXIST and our rename.
    const rename = vi.spyOn(fs, 'renameSync').mockImplementationOnce((from, to) => {
      fs.renameSync(from, to);
      fs.writeFileSync(file, `${winner}\n`);
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    try {
      expect(localMachineId({ homeDir })).toBe(winner);
      expect(readFileSync(file, 'utf-8').trim()).toBe(winner);
      expect(
        fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(`${MACHINE_ID_FILE}.corrupt-`)),
      ).toHaveLength(1);
    } finally {
      rename.mockRestore();
    }
  });

  it('restores a valid id it displaced when the other recoverer won between our read and our rename', () => {
    const homeDir = tempHome();
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'garbage\n');
    const winner = '13579bdf2468';
    // The other process finishes its whole recovery (move aside + create) before our rename runs,
    // so our rename displaces the winner's valid file rather than the corrupt one.
    const rename = vi.spyOn(fs, 'renameSync').mockImplementationOnce((from, to) => {
      fs.renameSync(from, `${file}.corrupt-other`);
      fs.writeFileSync(file, `${winner}\n`);
      fs.renameSync(from, to);
    });
    try {
      expect(localMachineId({ homeDir })).toBe(winner);
      expect(readFileSync(file, 'utf-8').trim()).toBe(winner);
      expect(fs.readdirSync(path.dirname(file)).sort()).toEqual([MACHINE_ID_FILE, `${MACHINE_ID_FILE}.corrupt-other`]);
    } finally {
      rename.mockRestore();
    }
  });

  it('falls back to a hostname hash without persisting or caching when the config dir is unwritable', () => {
    const homeDir = tempHome();
    const hostHash = createHash('sha256').update(hostname()).digest('hex').slice(0, 12);
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });
    try {
      expect(localMachineId({ homeDir })).toBe(hostHash);
      expect(fs.existsSync(path.join(homeDir, '.mastracode', MACHINE_ID_FILE))).toBe(false);
    } finally {
      mkdir.mockRestore();
    }
    // Not cached: once the directory is writable again a real id is minted.
    const id = localMachineId({ homeDir });
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(id).not.toBe(hostHash);
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
