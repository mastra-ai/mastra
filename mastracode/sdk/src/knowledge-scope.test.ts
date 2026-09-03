import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

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

  it('falls back to a hostname hash without persisting when the config dir is unwritable', () => {
    if (process.getuid?.() === 0) return; // root ignores mode bits
    const homeDir = tempHome();
    chmodSync(homeDir, 0o500);
    try {
      expect(localMachineId({ homeDir })).toBe(createHash('sha256').update(hostname()).digest('hex').slice(0, 12));
    } finally {
      chmodSync(homeDir, 0o700);
    }
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
