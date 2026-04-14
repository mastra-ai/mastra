import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@mastra/deployer/build', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    getFirstExistingFile: vi.fn().mockImplementation((files: string[]) => files[0]),
  })),
}));

vi.mock('../build/BuildBundler.js', () => ({
  BuildBundler: class MockBuildBundler {
    protected platform = 'node';
    constructor(_options?: { studio?: boolean }) {}
    __setLogger(_logger: unknown) {}
    getAllToolPaths(_dir: string, _extra: unknown[]) {
      return [];
    }
    prepare(_path: string) {
      return Promise.resolve();
    }
    loadEnvVars() {
      return Promise.resolve(new Map());
    }
    protected _bundle(_entry: string, _entryFile: string, _options: unknown, _toolsPaths: unknown): Promise<void> {
      return Promise.resolve();
    }
  },
}));

import { RunBundler } from './RunBundler';
import type { RunEntryOptions } from './RunBundler';

const defaultOptions: RunEntryOptions = {
  prompt: 'Hello world',
  agentId: 'testAgent',
  outputFormat: 'text',
  strict: false,
};

describe('RunBundler', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.MASTRA_SKIP_DOTENV;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create bundler with entry options', () => {
      const bundler = new RunBundler(defaultOptions);
      expect(bundler).toBeInstanceOf(RunBundler);
    });

    it('should accept custom env file', () => {
      const bundler = new RunBundler(defaultOptions, '.env.custom');
      expect(bundler).toBeInstanceOf(RunBundler);
    });
  });

  describe('getEntry bootstrap wiring', () => {
    it('should import mastra from #mastra', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain("import { mastra } from '#mastra'");
    });

    it('should import runHeadless from @mastra/core/harness', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain("import { runHeadless } from '@mastra/core/harness'");
    });

    it('should invoke runHeadless with the mastra instance', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('runHeadless(mastra,');
    });

    it('should wire process.stdout, process.stderr, process.exit, and SIGINT into the IO object', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('stdout: process.stdout');
      expect(entry).toContain('stderr: process.stderr');
      expect(entry).toContain('process.exit(code)');
      expect(entry).toContain("process.on('SIGINT', handler)");
    });

    it('should embed a fatal error handler that exits with code 1', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('.catch((err)');
      expect(entry).toContain('process.exit(1)');
    });
  });

  describe('getEntry option embedding', () => {
    it('should embed the prompt as a JSON-escaped literal', () => {
      const bundler = new RunBundler({
        ...defaultOptions,
        prompt: 'Say "hello" and use a backslash \\ here',
      });
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('Say \\"hello\\"');
      expect(entry).toContain('backslash \\\\');
    });

    it('should embed the agent ID', () => {
      const bundler = new RunBundler({ ...defaultOptions, agentId: 'myCustomAgent' });
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('agentId: "myCustomAgent"');
    });

    it('should embed the output format', () => {
      const bundler = new RunBundler({ ...defaultOptions, outputFormat: 'json' });
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('outputFormat: "json"');
    });

    it('should embed the strict flag as a boolean literal', () => {
      const bundlerFalse = new RunBundler({ ...defaultOptions, strict: false });
      expect((bundlerFalse as any).getEntry()).toContain('strict: false');

      const bundlerTrue = new RunBundler({ ...defaultOptions, strict: true });
      expect((bundlerTrue as any).getEntry()).toContain('strict: true');
    });

    it('should embed jsonSchema as a JSON-escaped string literal when provided', () => {
      const bundler = new RunBundler({
        ...defaultOptions,
        jsonSchema: '{"type":"object"}',
      });
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('jsonSchema: "{\\"type\\":\\"object\\"}"');
    });

    it('should embed jsonSchema as undefined when not provided', () => {
      const bundler = new RunBundler(defaultOptions);
      const entry = (bundler as any).getEntry();
      expect(entry).toContain('jsonSchema: undefined');
    });
  });

  describe('getEnvFiles', () => {
    it('should return env files when no custom env file specified', async () => {
      const bundler = new RunBundler(defaultOptions);
      const envFiles = await bundler.getEnvFiles();

      expect(Array.isArray(envFiles)).toBe(true);
    });

    it('should return empty array when MASTRA_SKIP_DOTENV is set', async () => {
      process.env.MASTRA_SKIP_DOTENV = 'true';

      const bundler = new RunBundler(defaultOptions);
      const envFiles = await bundler.getEnvFiles();

      expect(envFiles).toEqual([]);
    });
  });
});
