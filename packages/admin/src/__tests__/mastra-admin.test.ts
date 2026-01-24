import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MastraAdmin } from '../mastra-admin';
import {
  createMockStorage,
  createMockRunner,
  createMockRouter,
  createMockSource,
} from './test-utils';

describe('MastraAdmin', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let runner: ReturnType<typeof createMockRunner>;
  let router: ReturnType<typeof createMockRouter>;
  let source: ReturnType<typeof createMockSource>;

  beforeEach(() => {
    storage = createMockStorage();
    runner = createMockRunner();
    router = createMockRouter();
    source = createMockSource();
  });

  describe('init', () => {
    it('should initialize storage', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        logger: false,
      });

      await admin.init();

      expect(storage.init).toHaveBeenCalled();
    });

    it('should inject source provider into runner when both are configured', async () => {
      // This test verifies the fix for Issue 2:
      // MastraAdmin should call runner.setSource(source) during init
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        runner,
        source,
        logger: false,
      });

      await admin.init();

      // Verify setSource was called on the runner with the source provider
      expect(runner.setSource).toHaveBeenCalledWith(source);
    });

    it('should not fail if runner has no setSource method', async () => {
      // Some runners might not need source injection
      const runnerWithoutSetSource = {
        ...createMockRunner(),
        setSource: undefined,
      };

      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        runner: runnerWithoutSetSource as any,
        source,
        logger: false,
      });

      // Should not throw
      await expect(admin.init()).resolves.not.toThrow();
    });

    it('should not call setSource if source is not configured', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        runner,
        // No source configured
        logger: false,
      });

      await admin.init();

      // setSource should not be called without a source provider
      expect(runner.setSource).not.toHaveBeenCalled();
    });

    it('should not call setSource if runner is not configured', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        source,
        // No runner configured
        logger: false,
      });

      // Should not throw
      await expect(admin.init()).resolves.not.toThrow();
    });

    it('should only initialize once', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        runner,
        source,
        logger: false,
      });

      await admin.init();
      await admin.init(); // Second call should be no-op

      expect(storage.init).toHaveBeenCalledTimes(1);
      expect(runner.setSource).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrchestrator', () => {
    it('should return the build orchestrator', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        runner,
        source,
        logger: false,
      });

      await admin.init();

      const orchestrator = admin.getOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(orchestrator.queueBuild).toBeDefined();
      expect(orchestrator.processNextBuild).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should close storage', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        logger: false,
      });

      await admin.init();
      await admin.shutdown();

      expect(storage.close).toHaveBeenCalled();
    });
  });

  describe('license validation', () => {
    it('should accept dev license key', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'dev',
        storage,
        logger: false,
      });

      await expect(admin.init()).resolves.not.toThrow();

      const licenseInfo = admin.getLicenseInfo();
      expect(licenseInfo.tier).toBe('enterprise');
    });

    it('should accept development license key', async () => {
      const admin = new MastraAdmin({
        licenseKey: 'development',
        storage,
        logger: false,
      });

      await expect(admin.init()).resolves.not.toThrow();
    });
  });
});
