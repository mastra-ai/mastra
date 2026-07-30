import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const devBundlerConstructorSpy = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockImplementation((path: string) => path.endsWith('index.ts')),
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

vi.mock('@mastra/deployer/build', () => ({
  normalizeStudioBase: (base: string) => (base === '/' || base === '' ? '' : base),
  prepareFsAgentsEntry: vi.fn().mockImplementation(async (_mastraDir: string, entryFile: string | undefined) => ({
    entryFile: entryFile ?? '/mock/.mastra-fs-agents-entry.mjs',
    standalone: entryFile === undefined,
    toolPaths: [],
    agentCount: 0,
  })),
  writeFsAgentsEntry: vi.fn().mockResolvedValue(undefined),
  mirrorFsAgentWorkspaces: vi.fn().mockResolvedValue([]),
  getServerOptions: vi.fn().mockResolvedValue({
    port: 4111,
    host: 'localhost',
  }),
}));

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

vi.mock('./dev-lock', () => ({
  acquireDevLock: vi.fn().mockResolvedValue(undefined),
  updateDevLock: vi.fn().mockResolvedValue(undefined),
  releaseDevLock: vi.fn(),
}));

vi.mock('./DevBundler', () => {
  // Use a class for constructor (Vitest v4 requirement)
  class MockDevBundler {
    __setLogger = vi.fn();
    loadEnvVars = vi.fn().mockResolvedValue(new Map());
    prepare = vi.fn().mockResolvedValue(undefined);
    getAllToolPaths = vi.fn().mockReturnValue([]);
    watch = vi.fn().mockResolvedValue(mockWatcher);

    constructor(...args: any[]) {
      devBundlerConstructorSpy(...args);
    }
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

describe('dev command - factory mode environment', () => {
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

  it('should set MASTRA_FACTORY_DEV=true in spawned env when factory is true', async () => {
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
      factory: true,
    });

    expect(execaMock).toHaveBeenCalled();
    const callOptions = execaMock.mock.calls[0][2] as { env: Record<string, string> };
    expect(callOptions.env.MASTRA_FACTORY_DEV).toBe('true');
    expect(callOptions.env.MASTRA_TELEMETRY_COMMAND).toBe('factory dev');
  });

  it('should pass factory: true to DevBundler when factory is set', async () => {
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
      factory: true,
    });

    expect(devBundlerConstructorSpy).toHaveBeenCalled();
    const lastCall = devBundlerConstructorSpy.mock.calls[devBundlerConstructorSpy.mock.calls.length - 1];
    expect(lastCall[1]).toBe(true);
  });

  it('should not pass factory to DevBundler when factory is not set', async () => {
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

    expect(devBundlerConstructorSpy).toHaveBeenCalled();
    const lastCall = devBundlerConstructorSpy.mock.calls[devBundlerConstructorSpy.mock.calls.length - 1];
    expect(lastCall[1]).toBeUndefined();
  });

  it('should not set MASTRA_FACTORY_DEV in spawned env when factory is not set', async () => {
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
    const callOptions = execaMock.mock.calls[0][2] as { env: Record<string, string> };
    expect(callOptions.env.MASTRA_FACTORY_DEV).toBeUndefined();
    expect(callOptions.env.MASTRA_TELEMETRY_COMMAND).toBe('dev');
  });

  it('should retain MASTRA_FACTORY_DEV=true across a hot-reload restart', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ disabled: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

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
      factory: true,
    });

    // Initial start should have MASTRA_FACTORY_DEV=true
    expect(execaMock).toHaveBeenCalledTimes(1);
    const initialEnv = execaMock.mock.calls[0][2].env as Record<string, string>;
    expect(initialEnv.MASTRA_FACTORY_DEV).toBe('true');

    // Trigger a BUNDLE_END event to cause a hot-reload restart
    const watcherOnCall = mockWatcher.on.mock.calls.find((call: any[]) => call[0] === 'event');
    expect(watcherOnCall).toBeDefined();
    const eventCallback = watcherOnCall![1];

    eventCallback({ code: 'BUNDLE_END' });

    // Wait for the restart to call execa again
    await vi.waitFor(() => {
      expect(execaMock).toHaveBeenCalledTimes(2);
    });

    const restartEnv = execaMock.mock.calls[1][2].env as Record<string, string>;
    expect(restartEnv.MASTRA_FACTORY_DEV).toBe('true');
    expect(restartEnv.MASTRA_TELEMETRY_COMMAND).toBe('factory dev');
  });
});
