import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VercelSandbox } from './index';

// Mock @vercel/sandbox
const mockSandbox = {
  sandboxId: 'sbx_test123',
  status: 'running' as const,
  timeout: 300_000,
  createdAt: new Date('2026-01-01'),
  stop: vi.fn().mockResolvedValue(undefined),
  runCommand: vi.fn(),
  writeFiles: vi.fn(),
  readFileToBuffer: vi.fn(),
  getCommand: vi.fn(),
  domain: vi.fn(),
};

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: vi.fn().mockResolvedValue(mockSandbox),
    get: vi.fn().mockResolvedValue(mockSandbox),
    list: vi.fn().mockResolvedValue({ json: { sandboxes: [], pagination: {} } }),
  },
}));

describe('VercelSandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox.stop.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should generate a unique id', () => {
      const sandbox = new VercelSandbox();
      expect(sandbox.id).toMatch(/^vercel-sandbox-/);
    });

    it('should set default options', () => {
      const sandbox = new VercelSandbox();
      expect(sandbox.name).toBe('VercelSandbox');
      expect(sandbox.provider).toBe('vercel');
      expect(sandbox.status).toBe('pending');
    });

    it('should have a process manager', () => {
      const sandbox = new VercelSandbox();
      expect(sandbox.processes).toBeDefined();
    });
  });

  describe('lifecycle', () => {
    it('should create a Vercel Sandbox on start', async () => {
      const sandbox = new VercelSandbox({ runtime: 'node22', vcpus: 4 });
      await sandbox._start();

      const { Sandbox } = await import('@vercel/sandbox');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'node22',
          resources: { vcpus: 4 },
        }),
      );
      expect(sandbox.status).toBe('running');
    });

    it('should pass environment variables to create', async () => {
      const sandbox = new VercelSandbox({ env: { NODE_ENV: 'test' } });
      await sandbox._start();

      const { Sandbox } = await import('@vercel/sandbox');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          env: { NODE_ENV: 'test' },
        }),
      );
    });

    it('should pass ports to create', async () => {
      const sandbox = new VercelSandbox({ ports: [3000, 8080] });
      await sandbox._start();

      const { Sandbox } = await import('@vercel/sandbox');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ports: [3000, 8080],
        }),
      );
    });

    it('should not pass empty env or ports', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();

      const { Sandbox } = await import('@vercel/sandbox');
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          env: undefined,
          ports: undefined,
        }),
      );
    });

    it('should not re-create if already started', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._start(); // second call should be no-op

      const { Sandbox } = await import('@vercel/sandbox');
      expect(Sandbox.create).toHaveBeenCalledTimes(1);
    });

    it('should stop the sandbox', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._stop();

      expect(mockSandbox.stop).toHaveBeenCalled();
      expect(sandbox.status).toBe('stopped');
    });

    it('should destroy the sandbox with blocking', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._destroy();

      expect(mockSandbox.stop).toHaveBeenCalledWith({ blocking: true });
      expect(sandbox.status).toBe('destroyed');
    });

    it('should handle stop errors gracefully', async () => {
      mockSandbox.stop.mockRejectedValueOnce(new Error('stop failed'));
      const sandbox = new VercelSandbox();
      await sandbox._start();

      // Should not throw
      await sandbox._stop();
      expect(sandbox.status).toBe('stopped');
    });
  });

  describe('vercel accessor', () => {
    it('should throw SandboxNotReadyError before start', () => {
      const sandbox = new VercelSandbox();
      expect(() => sandbox.vercel).toThrow('Sandbox is not ready');
    });

    it('should return the sandbox instance after start', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();
      expect(sandbox.vercel).toBe(mockSandbox);
    });
  });

  describe('getInfo', () => {
    it('should return sandbox info before start', async () => {
      const sandbox = new VercelSandbox();
      const info = await sandbox.getInfo();
      expect(info.provider).toBe('vercel');
      expect(info.status).toBe('pending');
      expect(info.metadata?.sandboxId).toBeUndefined();
    });

    it('should include sandboxId after start', async () => {
      const sandbox = new VercelSandbox();
      await sandbox._start();
      const info = await sandbox.getInfo();
      expect(info.metadata?.sandboxId).toBe('sbx_test123');
      expect(info.metadata?.runtime).toBe('node24');
    });
  });

  describe('getInstructions', () => {
    it('should return default instructions', () => {
      const sandbox = new VercelSandbox();
      const instructions = sandbox.getInstructions();
      expect(instructions).toContain('Vercel Sandbox');
      expect(instructions).toContain('node24');
    });

    it('should include port info when ports configured', () => {
      const sandbox = new VercelSandbox({ ports: [3000] });
      const instructions = sandbox.getInstructions();
      expect(instructions).toContain('3000');
    });

    it('should use string override', () => {
      const sandbox = new VercelSandbox({ instructions: 'Custom instructions' });
      expect(sandbox.getInstructions()).toBe('Custom instructions');
    });

    it('should use function override', () => {
      const sandbox = new VercelSandbox({
        instructions: ({ defaultInstructions }) => `CUSTOM: ${defaultInstructions}`,
      });
      const result = sandbox.getInstructions();
      expect(result).toMatch(/^CUSTOM: /);
      expect(result).toContain('Vercel Sandbox');
    });
  });
});
