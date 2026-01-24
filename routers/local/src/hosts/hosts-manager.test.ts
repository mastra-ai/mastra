import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HostsManager } from './hosts-manager';

describe('HostsManager', () => {
  let tempDir: string;
  let hostsPath: string;
  let backupDir: string;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(tmpdir(), `hosts-manager-test-${Date.now()}`);
    hostsPath = join(tempDir, 'hosts');
    backupDir = join(tempDir, 'backups');

    await mkdir(tempDir, { recursive: true });

    // Create initial hosts file
    await writeFile(
      hostsPath,
      `127.0.0.1\tlocalhost
255.255.255.255\tbroadcasthost
::1\tlocalhost
`,
    );

    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleInfoSpy.mockRestore();

    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should use default hosts path when not specified', () => {
      const manager = new HostsManager();
      const path = manager.getHostsPath();

      // Should be platform-specific default
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });

    it('should accept custom configuration', () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        localIp: '127.0.0.2',
        logChanges: false,
      });

      expect(manager.getHostsPath()).toBe(hostsPath);
    });
  });

  describe('addEntry', () => {
    it('should add a single entry', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      const result = await manager.addEntry('test.mastra.local');

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeTruthy();

      const content = await readFile(hostsPath, 'utf-8');
      expect(content).toContain('127.0.0.1\ttest.mastra.local');
      expect(content).toContain('# BEGIN MASTRA LOCAL ROUTING');
      expect(content).toContain('# END MASTRA LOCAL ROUTING');
    });

    it('should add entry with comment', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('test.mastra.local', 'Test deployment');

      const content = await readFile(hostsPath, 'utf-8');
      expect(content).toContain('127.0.0.1\ttest.mastra.local # Test deployment');
    });

    it('should use custom IP address', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        localIp: '192.168.1.100',
        logChanges: false,
      });

      await manager.addEntry('test.mastra.local');

      const content = await readFile(hostsPath, 'utf-8');
      expect(content).toContain('192.168.1.100\ttest.mastra.local');
    });

    it('should not duplicate entries', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('test.mastra.local');
      await manager.addEntry('test.mastra.local');

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(1);
    });

    it('should log when logging is enabled', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: true,
      });

      await manager.addEntry('test.mastra.local');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[HostsManager] Added: test.mastra.local → 127.0.0.1',
      );
    });
  });

  describe('addEntries', () => {
    it('should add multiple entries at once', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      const result = await manager.addEntries([
        { hostname: 'app1.mastra.local', ip: '127.0.0.1' },
        { hostname: 'app2.mastra.local', ip: '127.0.0.1' },
        { hostname: 'app3.mastra.local', ip: '127.0.0.1', comment: 'Third app' },
      ]);

      expect(result.success).toBe(true);

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(3);
    });
  });

  describe('removeEntry', () => {
    it('should remove a single entry', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('test.mastra.local');
      expect(await manager.hasEntry('test.mastra.local')).toBe(true);

      const result = await manager.removeEntry('test.mastra.local');
      expect(result.success).toBe(true);
      expect(await manager.hasEntry('test.mastra.local')).toBe(false);
    });

    it('should preserve other entries when removing', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('app1.mastra.local');
      await manager.addEntry('app2.mastra.local');

      await manager.removeEntry('app1.mastra.local');

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].hostname).toBe('app2.mastra.local');
    });
  });

  describe('removeEntries', () => {
    it('should remove multiple entries at once', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntries([
        { hostname: 'app1.mastra.local', ip: '127.0.0.1' },
        { hostname: 'app2.mastra.local', ip: '127.0.0.1' },
        { hostname: 'app3.mastra.local', ip: '127.0.0.1' },
      ]);

      const result = await manager.removeEntries(['app1.mastra.local', 'app3.mastra.local']);
      expect(result.success).toBe(true);

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].hostname).toBe('app2.mastra.local');
    });
  });

  describe('removeAllEntries', () => {
    it('should remove the entire Mastra section', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('app1.mastra.local');
      await manager.addEntry('app2.mastra.local');

      const result = await manager.removeAllEntries();
      expect(result.success).toBe(true);

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(0);

      // Verify Mastra markers are removed
      const content = await readFile(hostsPath, 'utf-8');
      expect(content).not.toContain('# BEGIN MASTRA LOCAL ROUTING');
      expect(content).not.toContain('# END MASTRA LOCAL ROUTING');
    });

    it('should preserve non-Mastra entries', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('app1.mastra.local');
      await manager.removeAllEntries();

      const content = await readFile(hostsPath, 'utf-8');
      expect(content).toContain('127.0.0.1\tlocalhost');
      expect(content).toContain('::1\tlocalhost');
    });
  });

  describe('getEntries', () => {
    it('should return empty array when no entries exist', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      const entries = await manager.getEntries();
      expect(entries).toEqual([]);
    });

    it('should return all Mastra entries', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('app1.mastra.local');
      await manager.addEntry('app2.mastra.local', 'Second app');

      const entries = await manager.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].hostname).toBe('app1.mastra.local');
      expect(entries[1].hostname).toBe('app2.mastra.local');
      expect(entries[1].comment).toBe('Second app');
    });
  });

  describe('hasEntry', () => {
    it('should return true when entry exists', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      await manager.addEntry('test.mastra.local');

      expect(await manager.hasEntry('test.mastra.local')).toBe(true);
    });

    it('should return false when entry does not exist', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      expect(await manager.hasEntry('nonexistent.mastra.local')).toBe(false);
    });
  });

  describe('backup and restore', () => {
    it('should create backup before modifications', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      const result = await manager.addEntry('test.mastra.local');

      expect(result.backupPath).toBeTruthy();
      expect(result.backupPath).toContain('hosts.backup.');
    });

    it('should restore from backup', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      // Add entries
      const result = await manager.addEntry('test.mastra.local');

      // Restore from backup
      const restoreResult = await manager.restoreFromBackup(result.backupPath!);
      expect(restoreResult.success).toBe(true);

      // Entry should be gone
      expect(await manager.hasEntry('test.mastra.local')).toBe(false);
    });

    it('should return error for non-existent backup', async () => {
      const manager = new HostsManager({
        hostsPath,
        backupDir,
        logChanges: false,
      });

      const result = await manager.restoreFromBackup('/nonexistent/backup');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup file not found');
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      const manager = new HostsManager({
        hostsPath: '/root/forbidden/hosts',
        backupDir,
        logChanges: false,
      });

      const result = await manager.addEntry('test.mastra.local');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle missing hosts file', async () => {
      const manager = new HostsManager({
        hostsPath: join(tempDir, 'nonexistent'),
        backupDir,
        logChanges: false,
      });

      // Should create entries even if hosts file doesn't exist initially
      const result = await manager.addEntry('test.mastra.local');
      expect(result.success).toBe(true);
    });
  });
});
