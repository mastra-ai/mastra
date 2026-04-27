import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { AgentVersion } from './domains/agents/base';
import { FilesystemDB } from './filesystem-db';
import { FilesystemVersionedHelpers } from './filesystem-versioned';
import { GitHistory } from './git-history';
import type { StorageAgentType } from './types';

/**
 * Helper to run git commands in a directory.
 */
function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf-8' });
}

/**
 * Helper to write a JSON file and commit it.
 */
function writeAndCommit(dir: string, filename: string, data: Record<string, unknown>, message: string): string {
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
  git(dir, ['add', filename]);
  git(dir, ['commit', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

describe('GitHistory', () => {
  let repoDir: string;
  let storageDir: string;
  let gitHistory: GitHistory;

  beforeEach(async () => {
    // Create a temp directory with a git repo and a nested storage directory
    repoDir = await mkdtemp(join(tmpdir(), 'mastra-git-test-'));
    storageDir = join(repoDir, '.mastra-storage');
    mkdirSync(storageDir, { recursive: true });

    git(repoDir, ['init']);
    git(repoDir, ['config', 'user.email', 'test@test.com']);
    git(repoDir, ['config', 'user.name', 'Test User']);

    gitHistory = new GitHistory();
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  describe('isGitRepo', () => {
    it('returns true for a directory inside a git repo', async () => {
      expect(await gitHistory.isGitRepo(storageDir)).toBe(true);
    });

    it('returns false for a directory outside a git repo', async () => {
      const nonRepo = await mkdtemp(join(tmpdir(), 'mastra-no-git-'));
      try {
        expect(await gitHistory.isGitRepo(nonRepo)).toBe(false);
      } finally {
        await rm(nonRepo, { recursive: true, force: true });
      }
    });

    it('caches results', async () => {
      await gitHistory.isGitRepo(storageDir);
      // Second call should use cache
      expect(await gitHistory.isGitRepo(storageDir)).toBe(true);
    });
  });

  describe('getFileHistory', () => {
    it('returns empty array when file has no history', async () => {
      const commits = await gitHistory.getFileHistory(storageDir, 'agents.json');
      expect(commits).toEqual([]);
    });

    it('returns commits that touched the file, newest first', async () => {
      const sha1 = writeAndCommit(storageDir, 'agents.json', { agent1: { name: 'A1' } }, 'Add agent1');
      const sha2 = writeAndCommit(storageDir, 'agents.json', { agent1: { name: 'A1 v2' } }, 'Update agent1');

      const commits = await gitHistory.getFileHistory(storageDir, 'agents.json');
      expect(commits).toHaveLength(2);
      expect(commits[0]!.hash).toBe(sha2);
      expect(commits[0]!.message).toBe('Update agent1');
      expect(commits[1]!.hash).toBe(sha1);
      expect(commits[1]!.message).toBe('Add agent1');
    });

    it('only returns commits for the specific file', async () => {
      writeAndCommit(storageDir, 'agents.json', { agent1: { name: 'A1' } }, 'Add agent');
      writeAndCommit(storageDir, 'prompts.json', { p1: { text: 'Hello' } }, 'Add prompt');

      const agentCommits = await gitHistory.getFileHistory(storageDir, 'agents.json');
      expect(agentCommits).toHaveLength(1);
      expect(agentCommits[0]!.message).toBe('Add agent');
    });

    it('respects the limit parameter', async () => {
      writeAndCommit(storageDir, 'agents.json', { a: { v: 1 } }, 'v1');
      writeAndCommit(storageDir, 'agents.json', { a: { v: 2 } }, 'v2');
      writeAndCommit(storageDir, 'agents.json', { a: { v: 3 } }, 'v3');

      const commits = await gitHistory.getFileHistory(storageDir, 'agents.json', 2);
      expect(commits).toHaveLength(2);
      expect(commits[0]!.message).toBe('v3');
      expect(commits[1]!.message).toBe('v2');
    });

    it('parses commit dates as Date objects', async () => {
      writeAndCommit(storageDir, 'agents.json', { a: { v: 1 } }, 'v1');

      const commits = await gitHistory.getFileHistory(storageDir, 'agents.json');
      expect(commits[0]!.date).toBeInstanceOf(Date);
      expect(commits[0]!.date.getTime()).toBeGreaterThan(0);
    });
  });

  describe('getFileAtCommit', () => {
    it('returns the file content at a specific commit', async () => {
      const sha1 = writeAndCommit(storageDir, 'agents.json', { agent1: { name: 'Version 1' } }, 'v1');
      writeAndCommit(storageDir, 'agents.json', { agent1: { name: 'Version 2' } }, 'v2');

      const snapshot = await gitHistory.getFileAtCommit(storageDir, sha1, 'agents.json');
      expect(snapshot).toEqual({ agent1: { name: 'Version 1' } });
    });

    it('returns null when the file did not exist at the commit', async () => {
      // Create a commit that doesn't include agents.json
      writeFileSync(join(storageDir, 'other.txt'), 'hello');
      git(storageDir, ['add', 'other.txt']);
      git(storageDir, ['commit', '-m', 'Add other file']);
      const sha = git(storageDir, ['rev-parse', 'HEAD']).trim();

      const snapshot = await gitHistory.getFileAtCommit(storageDir, sha, 'agents.json');
      expect(snapshot).toBeNull();
    });

    it('returns the full entity map at that commit', async () => {
      writeAndCommit(
        storageDir,
        'agents.json',
        {
          agent1: { name: 'A1', model: { provider: 'openai', name: 'gpt-4' } },
          agent2: { name: 'A2', model: { provider: 'anthropic', name: 'claude' } },
        },
        'Add two agents',
      );

      const sha = git(storageDir, ['rev-parse', 'HEAD']).trim();
      const snapshot = await gitHistory.getFileAtCommit(storageDir, sha, 'agents.json');
      expect(snapshot).toHaveProperty('agent1');
      expect(snapshot).toHaveProperty('agent2');
      expect((snapshot as Record<string, Record<string, unknown>>)['agent1']!['name']).toBe('A1');
    });
  });

  describe('invalidateCache', () => {
    it('clears all caches', async () => {
      writeAndCommit(storageDir, 'agents.json', { a: { v: 1 } }, 'v1');

      // Populate caches
      await gitHistory.getFileHistory(storageDir, 'agents.json');
      await gitHistory.isGitRepo(storageDir);

      gitHistory.invalidateCache();

      // Should still work (re-fetches from git)
      const commits = await gitHistory.getFileHistory(storageDir, 'agents.json');
      expect(commits).toHaveLength(1);
    });
  });
});

// =============================================================================
// Integration: FilesystemAgentsStorage + Git history
// =============================================================================

describe('FilesystemVersionedHelpers - Git integration', () => {
  let repoDir: string;
  let storageDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), 'mastra-git-versioned-'));
    storageDir = join(repoDir, '.mastra-storage');
    mkdirSync(storageDir, { recursive: true });

    git(repoDir, ['init']);
    git(repoDir, ['config', 'user.email', 'test@test.com']);
    git(repoDir, ['config', 'user.name', 'Test User']);
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  function versionInput(agentId: string, opts: { page?: number; perPage?: number } = {}): any {
    return { agentId, page: opts.page ?? 0, perPage: opts.perPage ?? 100 };
  }

  function createHelpers() {
    const db = new FilesystemDB(storageDir);
    return new FilesystemVersionedHelpers<StorageAgentType, AgentVersion>({
      db,
      entitiesFile: 'agents.json',
      parentIdField: 'agentId',
      name: 'TestAgents',
      versionMetadataFields: ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  it('loads git commits as read-only versions', async () => {
    // Create git history with two commits
    writeAndCommit(
      storageDir,
      'agents.json',
      { 'agent-1': { name: 'Agent v1', instructions: 'Be helpful' } },
      'Add agent-1',
    );
    writeAndCommit(
      storageDir,
      'agents.json',
      { 'agent-1': { name: 'Agent v2', instructions: 'Be very helpful' } },
      'Update agent-1',
    );

    const helpers = createHelpers();

    // listVersions triggers ensureGitHistory
    const result = await helpers.listVersions(versionInput('agent-1'), 'agentId');

    // 2 git versions + 1 hydrated (current disk)
    expect(result.total).toBe(3);

    // Versions should be ordered by versionNumber DESC
    const versions = result.versions;
    expect(versions[0]!.versionNumber).toBe(3); // hydrated
    expect(versions[1]!.versionNumber).toBe(2); // git commit 2
    expect(versions[2]!.versionNumber).toBe(1); // git commit 1

    // Git versions should have commit messages
    expect(versions[2]!.changeMessage).toBe('Add agent-1');
    expect(versions[1]!.changeMessage).toBe('Update agent-1');
  });

  it('git versions contain snapshot config data', async () => {
    writeAndCommit(
      storageDir,
      'agents.json',
      { 'agent-1': { name: 'My Agent', instructions: 'Hello world', model: { provider: 'openai', name: 'gpt-4' } } },
      'Initial commit',
    );

    const helpers = createHelpers();
    const version = await helpers.getVersionByNumber('agent-1', 1);

    expect(version).not.toBeNull();
    const v = version as unknown as Record<string, unknown>;
    expect(v.name).toBe('My Agent');
    expect(v.instructions).toBe('Hello world');
    expect(v.model).toEqual({ provider: 'openai', name: 'gpt-4' });
  });

  it('git versions are read-only (deleteVersion is no-op)', async () => {
    writeAndCommit(storageDir, 'agents.json', { a: { name: 'test' } }, 'init');

    const helpers = createHelpers();
    const result = await helpers.listVersions(versionInput('a'), 'agentId');

    const gitVersion = result.versions.find(v => v.id.startsWith('git-'));
    expect(gitVersion).toBeDefined();

    // Delete should be a no-op
    await helpers.deleteVersion(gitVersion!.id);

    const afterDelete = await helpers.listVersions(versionInput('a'), 'agentId');
    expect(afterDelete.versions.find(v => v.id === gitVersion!.id)).toBeDefined();
  });

  it('deleteVersionsByParentId skips git versions', async () => {
    writeAndCommit(storageDir, 'agents.json', { a: { name: 'test' } }, 'init');

    const helpers = createHelpers();

    // Ensure git versions are loaded
    await helpers.countVersions('a');

    // Delete all versions (should only delete non-git ones)
    await helpers.deleteVersionsByParentId('a');

    const result = await helpers.listVersions(versionInput('a'), 'agentId');
    // Only git versions remain
    expect(result.versions.every(v => v.id.startsWith('git-'))).toBe(true);
    expect(result.total).toBeGreaterThan(0);
  });

  it('new version numbers continue after git history', async () => {
    // 3 git commits
    writeAndCommit(storageDir, 'agents.json', { a: { name: 'v1' } }, 'v1');
    writeAndCommit(storageDir, 'agents.json', { a: { name: 'v2' } }, 'v2');
    writeAndCommit(storageDir, 'agents.json', { a: { name: 'v3' } }, 'v3');

    const helpers = createHelpers();

    const nextNum = await helpers.getNextVersionNumber('a');
    // 3 git + 1 hydrated = version 4 is current, next is 5
    expect(nextNum).toBe(5);
  });

  it('handles entities that only appear in some commits', async () => {
    // Commit 1: only agent-1
    writeAndCommit(storageDir, 'agents.json', { 'agent-1': { name: 'A1' } }, 'Add A1');

    // Commit 2: agent-1 and agent-2
    writeAndCommit(
      storageDir,
      'agents.json',
      { 'agent-1': { name: 'A1 updated' }, 'agent-2': { name: 'A2' } },
      'Add A2',
    );

    const helpers = createHelpers();

    const a1Versions = await helpers.listVersions(versionInput('agent-1'), 'agentId');
    const a2Versions = await helpers.listVersions(versionInput('agent-2'), 'agentId');

    // agent-1: 2 git commits + 1 hydrated = 3
    expect(a1Versions.total).toBe(3);
    // agent-2: 1 git commit + 1 hydrated = 2
    expect(a2Versions.total).toBe(2);
  });

  it('works correctly without git (no repo)', async () => {
    // Create a non-git directory
    const nonRepoDir = await mkdtemp(join(tmpdir(), 'mastra-no-git-'));
    const nonRepoStorage = join(nonRepoDir, '.mastra-storage');
    mkdirSync(nonRepoStorage, { recursive: true });

    try {
      const db = new FilesystemDB(nonRepoStorage);
      const helpers = new FilesystemVersionedHelpers<StorageAgentType, AgentVersion>({
        db,
        entitiesFile: 'agents.json',
        parentIdField: 'agentId',
        name: 'TestAgents',
        versionMetadataFields: ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
      });

      // Write some data to disk manually
      db.writeDomain('agents.json', { 'test-agent': { name: 'Test', instructions: 'Hi' } });

      const result = await helpers.listVersions(versionInput('test-agent'), 'agentId');
      // Only 1 hydrated version (no git history)
      expect(result.total).toBe(1);
      expect(result.versions[0]!.versionNumber).toBe(1);
    } finally {
      await rm(nonRepoDir, { recursive: true, force: true });
    }
  });

  it('isGitVersion correctly identifies git vs non-git versions', () => {
    expect(FilesystemVersionedHelpers.isGitVersion('git-abc123-agent-1')).toBe(true);
    expect(FilesystemVersionedHelpers.isGitVersion('hydrated-agent-1-v1')).toBe(false);
    expect(FilesystemVersionedHelpers.isGitVersion('some-random-uuid')).toBe(false);
  });
});
