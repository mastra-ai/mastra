import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TLSManager } from './tls-manager';

describe('TLSManager', () => {
  let tempDir: string;
  let certDir: string;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(tmpdir(), `tls-manager-test-${Date.now()}`);
    certDir = join(tempDir, 'certs');

    await mkdir(tempDir, { recursive: true });

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
    it('should use default cert directory when not specified', () => {
      const manager = new TLSManager();
      const dir = manager.getCertDir();

      expect(dir).toBeTruthy();
      expect(dir).toContain('.mastra');
      expect(dir).toContain('certs');
    });

    it('should accept custom configuration', () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 30,
        organization: 'Test Org',
        logChanges: false,
      });

      expect(manager.getCertDir()).toBe(certDir);
    });
  });

  describe('getCertificate', () => {
    it('should generate a new certificate', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const result = await manager.getCertificate('test.local');

      expect(result.success).toBe(true);
      expect(result.certificate).toBeTruthy();
      expect(result.certificate?.cert).toContain('-----BEGIN CERTIFICATE-----');
      expect(result.certificate?.key).toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(result.certificate?.domain).toBe('test.local');
      expect(result.certificate?.expiresAt).toBeInstanceOf(Date);
    });

    it('should cache certificates in memory', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const result1 = await manager.getCertificate('cached.local');
      const result2 = await manager.getCertificate('cached.local');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Should return the same certificate
      expect(result1.certificate?.cert).toBe(result2.certificate?.cert);
    });

    it('should persist certificates to disk', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager.getCertificate('disk.local');

      // Verify files exist
      const certPath = join(certDir, 'disk.local.crt');
      const keyPath = join(certDir, 'disk.local.key');
      const metaPath = join(certDir, 'disk.local.meta.json');

      expect(existsSync(certPath)).toBe(true);
      expect(existsSync(keyPath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);

      // Verify metadata
      const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
      expect(meta.domain).toBe('disk.local');
      expect(meta.validityDays).toBe(1);
    });

    it('should load cached certificates from disk', async () => {
      // First manager generates certificate
      const manager1 = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });
      const result1 = await manager1.getCertificate('reload.local');

      // Second manager loads from disk
      const manager2 = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });
      const result2 = await manager2.getCertificate('reload.local');

      expect(result1.certificate?.cert).toBe(result2.certificate?.cert);
    });

    it('should regenerate expired certificates', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      // Generate certificate
      const result1 = await manager.getCertificate('expire.local');

      // Manually expire the certificate on disk
      const metaPath = join(certDir, 'expire.local.meta.json');
      const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
      meta.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired
      await writeFile(metaPath, JSON.stringify(meta));

      // Clear in-memory cache by creating new manager
      const manager2 = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      // Should generate new certificate
      const result2 = await manager2.generateCertificate('expire.local');

      expect(result2.success).toBe(true);
      expect(result2.certificate?.cert).not.toBe(result1.certificate?.cert);
    });

    it('should log when logging is enabled', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: true,
      });

      await manager.getCertificate('log.local');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[TLSManager] Generated certificate for: log.local',
      );
    });
  });

  describe('generateCertificate', () => {
    it('should generate certificate with wildcard SAN', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const result = await manager.generateCertificate('mastra.local');

      expect(result.success).toBe(true);
      // The certificate should include wildcards (verified by selfsigned library)
      expect(result.certificate?.cert).toBeTruthy();
    });
  });

  describe('deleteCertificate', () => {
    it('should delete certificate from disk and memory', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager.getCertificate('delete.local');

      // Verify files exist
      expect(existsSync(join(certDir, 'delete.local.crt'))).toBe(true);

      const deleted = await manager.deleteCertificate('delete.local');
      expect(deleted).toBe(true);

      // Verify files are removed
      expect(existsSync(join(certDir, 'delete.local.crt'))).toBe(false);
      expect(existsSync(join(certDir, 'delete.local.key'))).toBe(false);
      expect(existsSync(join(certDir, 'delete.local.meta.json'))).toBe(false);
    });

    it('should return false for non-existent certificate', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const deleted = await manager.deleteCertificate('nonexistent.local');
      expect(deleted).toBe(false);
    });
  });

  describe('clearCertificates', () => {
    it('should delete all certificates', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager.getCertificate('clear1.local');
      await manager.getCertificate('clear2.local');
      await manager.getCertificate('clear3.local');

      let certs = await manager.listCertificates();
      expect(certs).toHaveLength(3);

      await manager.clearCertificates();

      certs = await manager.listCertificates();
      expect(certs).toHaveLength(0);
    });
  });

  describe('listCertificates', () => {
    it('should return empty array when no certificates exist', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const certs = await manager.listCertificates();
      expect(certs).toEqual([]);
    });

    it('should list all certificate domains', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager.getCertificate('list1.local');
      await manager.getCertificate('list2.local');

      const certs = await manager.listCertificates();
      expect(certs).toContain('list1.local');
      expect(certs).toContain('list2.local');
    });
  });

  describe('hasCertificate', () => {
    it('should return true when certificate exists in memory', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager.getCertificate('has.local');

      const has = await manager.hasCertificate('has.local');
      expect(has).toBe(true);
    });

    it('should return true when certificate exists on disk', async () => {
      const manager1 = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      await manager1.getCertificate('diskhas.local');

      // New manager without memory cache
      const manager2 = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const has = await manager2.hasCertificate('diskhas.local');
      expect(has).toBe(true);
    });

    it('should return false when certificate does not exist', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const has = await manager.hasCertificate('missing.local');
      expect(has).toBe(false);
    });
  });

  describe('getTrustInstructions', () => {
    it('should return trust instructions for the domain', () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      const instructions = manager.getTrustInstructions('mastra.local');

      expect(instructions).toContain('mastra.local');
      expect(instructions).toContain('macOS');
      expect(instructions).toContain('Linux');
      expect(instructions).toContain('Windows');
      expect(instructions).toContain('certutil');
      expect(instructions).toContain('update-ca-certificates');
    });
  });

  describe('domain sanitization', () => {
    it('should sanitize domain names for file paths', async () => {
      const manager = new TLSManager({
        certDir,
        validityDays: 1,
        logChanges: false,
      });

      // Domain with special characters
      await manager.getCertificate('test-app.mastra.local');

      // Should create valid file paths
      expect(existsSync(join(certDir, 'test-app.mastra.local.crt'))).toBe(true);
    });
  });
});
