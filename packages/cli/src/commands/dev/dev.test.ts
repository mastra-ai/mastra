import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@expo/devcert', () => ({
  default: {
    certificateFor: vi.fn().mockResolvedValue({
      key: Buffer.from('mock-key'),
      cert: Buffer.from('mock-cert'),
    }),
  },
}));

vi.mock('@mastra/deployer', () => {
  // Use a class for constructor (Vitest v4 requirement)
  class MockFileService {
    getFirstExistingFile = vi.fn().mockReturnValue('/mock/index.ts');
  }

  return {
    FileService: MockFileService,
  };
});

vi.mock('@mastra/deployer/build', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@mastra/deployer/build')>();

  return {
    normalizeStudioBase: actual.normalizeStudioBase,
    getServerOptions: vi.fn().mockResolvedValue({
      port: 4111,
      host: 'localhost',
    }),
  };
});

vi.mock('get-port', () => ({
  default: vi.fn().mockResolvedValue(4111),
}));

vi.mock('../../utils/dev-logger.js', () => ({
  devLogger: {
    starting: vi.fn(),
    ready: vi.fn(),
    watching: vi.fn(),
    restarting: vi.fn(),
    bundling: vi.fn(),
    bundleComplete: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    serverError: vi.fn(),
    shutdown: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockWatcher = {
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./DevBundler', () => {
  // Use a class for constructor (Vitest v4 requirement)
  class MockDevBundler {
    __setLogger = vi.fn();
    loadEnvVars = vi.fn().mockResolvedValue(new Map());
    prepare = vi.fn().mockResolvedValue(undefined);
    getAllToolPaths = vi.fn().mockReturnValue([]);
    watch = vi.fn().mockResolvedValue(mockWatcher);
  }

  return {
    DevBundler: MockDevBundler,
  };
});

class MockChildProcess extends EventEmitter {
  pid = 12345;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stdout = {
    on: vi.fn(),
  } as any;
  stderr = {
    on: vi.fn(),
  } as any;
  kill = vi.fn((signal?: NodeJS.Signals | number) => {
    if (signal === 'SIGKILL') {
      return true;
    }

    if (signal === 'SIGINT') {
      setTimeout(() => {
        this.signalCode = 'SIGINT';
        this.emit('exit', null, 'SIGINT');
      }, 0);
      return true;
    }

    return true;
  });

  override on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'message') {
      setTimeout(() => {
        listener({ type: 'server-ready' });
      }, 10);
    }

    return super.on(event, listener);
  }
}

describe('dev command - https scheme in internal fetches', () => {
  let execaMock: any;
  let mockChildProcess: MockChildProcess;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockChildProcess = new MockChildProcess();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ disabled: false }) });
    vi.stubGlobal('fetch', fetchMock);

    const { execa } = await import('execa');
    execaMock = vi.mocked(execa);
    execaMock.mockReturnValue(mockChildProcess as unknown as ChildProcess);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should use http:// scheme for internal fetches when https is not configured', async () => {
    const { getServerOptions } = await import('@mastra/deployer/build');
    vi.mocked(getServerOptions).mockResolvedValue({
      port: 4111,
      host: 'localhost',
    } as any);

    const { dev } = await import('./dev');

    await dev({
      dir: undefined,
      root: process.cwd(),
      tools: undefined,
      env: undefined,
      inspect: false,
      inspectBrk: false,
      customArgs: undefined,
      https: false,
      debug: false,
    });

    // Wait for the server-ready message handler to fire and trigger fetch calls
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call: any[]) => {
          const url = String(call[0]);
          return url.includes('__restart-active-workflow-runs') || url.includes('__refresh');
        }),
      ).toBe(true);
    });

    const fetchedUrls = fetchMock.mock.calls.map((call: any[]) => call[0] as string);
    const internalFetches = fetchedUrls.filter(
      (url: string) => url.includes('__restart-active-workflow-runs') || url.includes('__refresh'),
    );

    for (const url of internalFetches) {
      expect(url).toMatch(/^http:\/\//);
    }
  });

  it('should use https:// scheme for internal fetches when server.https is configured', async () => {
    const { getServerOptions } = await import('@mastra/deployer/build');
    vi.mocked(getServerOptions).mockResolvedValue({
      port: 4111,
      host: 'localhost',
      https: {
        key: Buffer.from('mock-key'),
        cert: Buffer.from('mock-cert'),
      },
    } as any);

    const { dev } = await import('./dev');

    await dev({
      dir: undefined,
      root: process.cwd(),
      tools: undefined,
      env: undefined,
      inspect: false,
      inspectBrk: false,
      customArgs: undefined,
      https: false,
      debug: false,
    });

    // Wait for the server-ready message handler to fire and trigger fetch calls
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call: any[]) => {
          const url = String(call[0]);
          return url.includes('__restart-active-workflow-runs') || url.includes('__refresh');
        }),
      ).toBe(true);
    });

    const fetchedUrls = fetchMock.mock.calls.map((call: any[]) => call[0] as string);
    const internalFetches = fetchedUrls.filter(
      (url: string) => url.includes('__restart-active-workflow-runs') || url.includes('__refresh'),
    );

    for (const url of internalFetches) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe('dev command - inspect flag behavior', () => {
  let execaMock: any;
  let mockChildProcess: MockChildProcess;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockChildProcess = new MockChildProcess();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('server unavailable')));

    const { execa } = await import('execa');
    execaMock = vi.mocked(execa);
    execaMock.mockReturnValue(mockChildProcess as unknown as ChildProcess);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('inspect flag (boolean)', () => {
    it('should pass --inspect flag when inspect is true', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: true,
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect');
      expect(commands).not.toContain('--inspect-brk');
    });

    it('should pass --inspect-brk flag when inspectBrk is true', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: false,
        inspectBrk: true,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect-brk');
      expect(commands).not.toContain('--inspect');
    });

    it('should not pass inspect flags when both are false', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: false,
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).not.toContain('--inspect');
      expect(commands).not.toContain('--inspect-brk');
    });
  });

  describe('inspect flag with custom host:port', () => {
    it('should pass --inspect=0.0.0.0:9229 when inspect is "0.0.0.0:9229"', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: '0.0.0.0:9229',
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect=0.0.0.0:9229');
    });

    it('should pass --inspect=9230 when inspect is "9230"', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: '9230',
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect=9230');
    });

    it('should pass --inspect=localhost:9230 when inspect is "localhost:9230"', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: 'localhost:9230',
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect=localhost:9230');
    });

    it('should pass --inspect-brk=0.0.0.0:9229 when inspectBrk is "0.0.0.0:9229"', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: false,
        inspectBrk: '0.0.0.0:9229',
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect-brk=0.0.0.0:9229');
    });
  });

  describe('empty string edge case', () => {
    it('should use default --inspect when inspect is empty string', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: '',
        inspectBrk: false,
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect');
      expect(commands.some(cmd => cmd.startsWith('--inspect='))).toBe(false);
    });

    it('should use default --inspect-brk when inspectBrk is empty string', async () => {
      const { dev } = await import('./dev');

      await dev({
        dir: undefined,
        root: process.cwd(),
        tools: undefined,
        env: undefined,
        inspect: false,
        inspectBrk: '',
        customArgs: undefined,
        https: false,
        debug: false,
      });

      expect(execaMock).toHaveBeenCalled();
      const callArgs = execaMock.mock.calls[0];
      const commands = callArgs[1] as string[];

      expect(commands).toContain('--inspect-brk');
      expect(commands.some(cmd => cmd.startsWith('--inspect-brk='))).toBe(false);
    });
  });
});
