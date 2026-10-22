import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycleMocks = vi.hoisted(() => {
  const order: string[] = [];
  const diagnostics = { stop: vi.fn(async () => void order.push('diagnostics-stop')) };
  return {
    order,
    diagnostics,
    createMastraCode: vi.fn(),
    createDiagnostics: vi.fn(() => ({ diagnostics, enabled: true, error: null })),
    startDiagnostics: vi.fn(async () => {
      order.push('diagnostics-start');
      return diagnostics;
    }),
    stopDiagnostics: vi.fn(async () => diagnostics.stop()),
    runMC: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    resolveModelDefaults: vi.fn(),
    listBuiltinModePacks: vi.fn(),
  };
});

vi.mock('../index.js', () => ({ createMastraCode: lifecycleMocks.createMastraCode }));
vi.mock('../onboarding/packs.js', async () => ({
  ...(await vi.importActual<typeof import('../onboarding/packs.js')>('../onboarding/packs.js')),
  listBuiltinModePacks: lifecycleMocks.listBuiltinModePacks,
}));
vi.mock('../onboarding/settings.js', async () => ({
  ...(await vi.importActual<typeof import('../onboarding/settings.js')>('../onboarding/settings.js')),
  loadSettings: lifecycleMocks.loadSettings,
  saveSettings: lifecycleMocks.saveSettings,
  resolveModelDefaults: lifecycleMocks.resolveModelDefaults,
}));
vi.mock('../process-memory-diagnostics.js', () => ({
  createProcessMemoryDiagnosticsFromEnvironment: lifecycleMocks.createDiagnostics,
  startConfiguredProcessMemoryDiagnostics: lifecycleMocks.startDiagnostics,
  stopProcessMemoryDiagnosticsWithTimeout: lifecycleMocks.stopDiagnostics,
}));
vi.mock('./run-mc.js', () => ({ runMC: lifecycleMocks.runMC }));

import { flushWritable, hasHeadlessFlag, parseHeadlessArgs, runMCCli } from './cli.js';
import { buildParseArgsOptions, FLAGS, renderFlagUsage } from './flags.js';

function argv(...rest: string[]): string[] {
  return ['node', 'main.js', ...rest];
}

describe('hasHeadlessFlag', () => {
  it('detects --prompt', () => {
    expect(hasHeadlessFlag(argv('--prompt', 'do it'))).toBe(true);
  });

  it('detects -p', () => {
    expect(hasHeadlessFlag(argv('-p', 'do it'))).toBe(true);
  });

  it('returns false without a prompt flag', () => {
    expect(hasHeadlessFlag(argv('--continue'))).toBe(false);
  });
});

describe('parseHeadlessArgs', () => {
  it('parses --prompt and applies defaults', () => {
    const args = parseHeadlessArgs(argv('--prompt', 'Fix the bug'));
    expect(args.prompt).toBe('Fix the bug');
    expect(args.output).toBe('human');
    expect(args.continue_).toBe(false);
    expect(args.cloneThread).toBe(false);
  });

  it('parses the -p short flag', () => {
    expect(parseHeadlessArgs(argv('-p', 'Fix the bug')).prompt).toBe('Fix the bug');
  });

  it('reads a positional prompt when no flag is given', () => {
    expect(parseHeadlessArgs(argv('Fix the bug')).prompt).toBe('Fix the bug');
  });

  it('parses the consolidated --output modes', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--output', 'json')).output).toBe('json');
    expect(parseHeadlessArgs(argv('-p', 'x', '-o', 'jsonl')).output).toBe('jsonl');
    expect(parseHeadlessArgs(argv('-p', 'x', '--output', 'human')).output).toBe('human');
  });

  it('rejects an invalid --output value', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--output', 'xml'))).toThrow(/--output must be one of/);
  });

  it('parses --timeout as a positive integer', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--timeout', '300')).timeout).toBe(300);
  });

  it('rejects a non-positive or non-integer --timeout', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', '0'))).toThrow(/--timeout/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', '1.5'))).toThrow(/--timeout/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--timeout', 'soon'))).toThrow(/--timeout/);
  });

  it('validates --mode', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--mode', 'plan')).mode).toBe('plan');
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--mode', 'turbo'))).toThrow(/--mode/);
  });

  it('validates --thinking-level', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--thinking-level', 'high')).thinkingLevel).toBe('high');
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--thinking-level', 'extreme'))).toThrow(/--thinking-level/);
  });

  it('parses thread flags', () => {
    const args = parseHeadlessArgs(argv('-p', 'x', '--thread', 't-1', '--title', 'My run', '--clone-thread'));
    expect(args.thread).toBe('t-1');
    expect(args.title).toBe('My run');
    expect(args.cloneThread).toBe(true);
  });

  it('parses --continue', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--continue')).continue_).toBe(true);
    expect(parseHeadlessArgs(argv('-p', 'x', '-c')).continue_).toBe(true);
  });

  it('rejects --continue together with --thread', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--continue', '--thread', 't-1'))).toThrow(
      /--continue and --thread/,
    );
  });

  it('parses --model, --resource-id, and --settings', () => {
    const args = parseHeadlessArgs(
      argv('-p', 'x', '--model', 'openai/gpt-4o', '--resource-id', 'r-1', '--settings', './s.json'),
    );
    expect(args.model).toBe('openai/gpt-4o');
    expect(args.resourceId).toBe('r-1');
    expect(args.settings).toBe('./s.json');
  });

  it('parses --pack and --pack=<id>', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--pack', 'openai')).pack).toBe('openai');
    expect(parseHeadlessArgs(argv('-p', 'x', '--pack=custom:Kimi')).pack).toBe('custom:Kimi');
    expect(parseHeadlessArgs(argv('-p', 'x')).pack).toBeUndefined();
  });

  it('parses --max-turns as a positive integer', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--max-turns', '5')).maxTurns).toBe(5);
  });

  it('leaves maxTurns undefined when --max-turns is absent', () => {
    expect(parseHeadlessArgs(argv('-p', 'x')).maxTurns).toBeUndefined();
  });

  it('rejects a non-positive or non-integer --max-turns', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '0'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '-3'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', '2.5'))).toThrow(/--max-turns/);
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--max-turns', 'lots'))).toThrow(/--max-turns/);
  });

  it('validates --permission-mode', () => {
    expect(parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'auto')).permissionMode).toBe('auto');
    expect(parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'deny')).permissionMode).toBe('deny');
  });

  it('leaves permissionMode undefined when absent', () => {
    expect(parseHeadlessArgs(argv('-p', 'x')).permissionMode).toBeUndefined();
  });

  it('rejects an invalid --permission-mode value', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'yolo'))).toThrow(/--permission-mode must be/);
  });

  it('parses every flag together', () => {
    const args = parseHeadlessArgs(
      argv(
        '--prompt',
        'Do everything',
        '--output',
        'json',
        '--model',
        'openai/gpt-4o',
        '--mode',
        'plan',
        '--thinking-level',
        'high',
        '--timeout',
        '120',
        '--max-turns',
        '8',
        '--permission-mode',
        'deny',
        '--thread',
        't-9',
        '--title',
        'Full run',
        '--clone-thread',
        '--resource-id',
        'r-9',
        '--settings',
        './ci.json',
      ),
    );
    expect(args).toEqual({
      prompt: 'Do everything',
      output: 'json',
      model: 'openai/gpt-4o',
      mode: 'plan',
      thinkingLevel: 'high',
      timeout: 120,
      maxTurns: 8,
      permissionMode: 'deny',
      continue_: false,
      thread: 't-9',
      title: 'Full run',
      cloneThread: true,
      resourceId: 'r-9',
      settings: './ci.json',
    });
  });
});

describe('runMCCli process memory diagnostics lifecycle', () => {
  const originalArgv = process.argv;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    lifecycleMocks.order.length = 0;
    lifecycleMocks.createMastraCode.mockReset();
    lifecycleMocks.createDiagnostics.mockClear();
    lifecycleMocks.startDiagnostics.mockClear();
    lifecycleMocks.diagnostics.stop.mockClear();
    lifecycleMocks.runMC.mockReset();
    lifecycleMocks.loadSettings.mockReset();
    lifecycleMocks.saveSettings.mockClear();
    lifecycleMocks.resolveModelDefaults.mockReset();
    lifecycleMocks.listBuiltinModePacks.mockReset();
    lifecycleMocks.loadSettings.mockReturnValue({ models: { activeModelPackId: null, modeDefaults: {} } });
    lifecycleMocks.resolveModelDefaults.mockReturnValue({});
    lifecycleMocks.listBuiltinModePacks.mockReturnValue([]);
    process.argv = argv('--prompt', 'do it');
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
      lifecycleMocks.order.push(`exit-${code}`);
      throw new Error(`EXIT:${code}`);
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('starts diagnostics before Mastra Code and stops them before exit', async () => {
    const controller = {
      getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => void lifecycleMocks.order.push('workers-stop')) })),
      stopIntervals: vi.fn(async () => void lifecycleMocks.order.push('intervals-stop')),
    };
    lifecycleMocks.createMastraCode.mockImplementation(async () => {
      lifecycleMocks.order.push('mastracode-create');
      return {
        controller,
        session: {},
        mcpManager: {
          hasServers: () => false,
          disconnect: vi.fn(async () => void lifecycleMocks.order.push('mcp-stop')),
        },
        effectiveDefaults: { build: 'openai/gpt-5.5' },
        // close() reads `this` like the real pubsub, so a detached call is caught.
        signalsPubSub: {
          closed: false,
          async close() {
            this.closed = true;
            lifecycleMocks.order.push('signals-stop');
          },
        },
        stopNotificationDispatch: vi.fn(async () => void lifecycleMocks.order.push('dispatch-stop')),
        stopPluginSignalProviders: vi.fn(() => lifecycleMocks.order.push('providers-stop')),
        releaseThreadClaims: vi.fn(() => lifecycleMocks.order.push('claims-release')),
      };
    });
    lifecycleMocks.runMC.mockReturnValue({
      async *[Symbol.asyncIterator]() {},
      result: Promise.resolve({ status: 'completed', exitCode: 0 }),
    });
    const settings = {
      models: { activeModelPackId: 'custom:review-pack', modeDefaults: {} },
      customModelPacks: [{ name: 'review-pack', models: { build: 'anthropic/claude-opus-4-6' } }],
    };
    lifecycleMocks.loadSettings.mockReturnValue(settings);
    lifecycleMocks.resolveModelDefaults.mockReturnValue({ build: 'anthropic/claude-opus-4-6' });

    await expect(runMCCli('do it', { coAuthor: { name: 'mastracode' } })).rejects.toThrow('EXIT:0');

    expect(lifecycleMocks.createMastraCode).toHaveBeenCalledWith({
      settingsPath: undefined,
      coAuthor: { name: 'mastracode' },
    });
    expect(lifecycleMocks.resolveModelDefaults).toHaveBeenCalledWith(settings, []);
    expect(lifecycleMocks.runMC).toHaveBeenCalledWith(
      expect.objectContaining({ modeDefaults: { build: 'anthropic/claude-opus-4-6' } }),
    );
    expect(lifecycleMocks.order).toEqual(
      expect.arrayContaining(['diagnostics-start', 'mastracode-create', 'intervals-stop', 'diagnostics-stop']),
    );
    expect(lifecycleMocks.order.indexOf('diagnostics-start')).toBeLessThan(
      lifecycleMocks.order.indexOf('mastracode-create'),
    );
    expect(lifecycleMocks.order.indexOf('diagnostics-stop')).toBeGreaterThan(
      lifecycleMocks.order.indexOf('intervals-stop'),
    );
    expect(lifecycleMocks.order.at(-1)).toBe('exit-0');
    expect(lifecycleMocks.diagnostics.stop).toHaveBeenCalledOnce();
    // Dispatch leases are released first; the pubsub closes only after the workers stop.
    const at = (step: string) => lifecycleMocks.order.indexOf(step);
    expect(at('dispatch-stop')).toBeGreaterThan(-1);
    expect(at('dispatch-stop')).toBeLessThan(at('workers-stop'));
    expect(at('signals-stop')).toBeGreaterThan(at('workers-stop'));
    // Thread claims are released before any slow teardown step.
    expect(at('claims-release')).toBeGreaterThan(-1);
    expect(at('claims-release')).toBeLessThan(at('providers-stop'));
    expect(at('claims-release')).toBeLessThan(at('dispatch-stop'));
  });

  it('passes a deferred pack resolver to runMC and activates the pack only once applied', async () => {
    const settings = {
      models: { activeModelPackId: null, modeDefaults: {}, packFallbacks: {} },
      customModelPacks: [{ name: 'review-pack', models: { build: 'anthropic/claude-opus-4-6' } }],
    };
    lifecycleMocks.loadSettings.mockReturnValue(settings);
    lifecycleMocks.createMastraCode.mockImplementation(async () => ({
      controller: {
        getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => {}) })),
        stopIntervals: vi.fn(async () => {}),
      },
      session: { mode: { get: () => 'build' } },
      mcpManager: { hasServers: () => false, disconnect: vi.fn(async () => {}) },
      signalsPubSub: { async close() {} },
    }));
    // runMC resolves the pack against the post-resume mode and calls
    // onApplied only once it has applied the selection to the session.
    lifecycleMocks.runMC.mockImplementation((options: any) => {
      const selection = options.pack.resolve('build');
      expect(selection.modelId).toBe('anthropic/claude-opus-4-6');
      // Settings must not be saved before the pack is applied.
      expect(lifecycleMocks.saveSettings).not.toHaveBeenCalled();
      options.pack.onApplied();
      return {
        async *[Symbol.asyncIterator]() {},
        result: Promise.resolve({ status: 'completed', exitCode: 0 }),
      };
    });
    process.argv = argv('--prompt', 'do it', '--pack', 'review-pack');

    await expect(runMCCli('do it', { coAuthor: { name: 'mastracode' } })).rejects.toThrow('EXIT:0');

    expect(settings.models.activeModelPackId).toBe('custom:review-pack');
    expect(lifecycleMocks.saveSettings).toHaveBeenCalledWith(settings, undefined);
    expect(lifecycleMocks.runMC).toHaveBeenCalledWith(
      expect.objectContaining({
        pack: expect.objectContaining({ id: 'custom:review-pack', resolve: expect.any(Function) }),
      }),
    );
  });

  it('propagates a pack-mode rejection from runMC without saving settings', async () => {
    lifecycleMocks.loadSettings.mockReturnValue({
      models: { activeModelPackId: null, modeDefaults: {}, packFallbacks: {} },
      customModelPacks: [{ name: 'plan-only', models: { plan: 'anthropic/claude-opus-4-6' } }],
    });
    lifecycleMocks.createMastraCode.mockImplementation(async () => ({
      controller: {
        getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => {}) })),
        stopIntervals: vi.fn(async () => {}),
      },
      session: { mode: { get: () => 'build' } },
      mcpManager: { hasServers: () => false, disconnect: vi.fn(async () => {}) },
      signalsPubSub: { async close() {} },
    }));
    // The real runMC fails the run when the pack has no model for the mode it
    // ended up in; onApplied is never called, so settings stay untouched.
    lifecycleMocks.runMC.mockImplementation((options: any) => {
      expect(options.pack.resolve('build')).toBeUndefined();
      return {
        async *[Symbol.asyncIterator]() {},
        result: Promise.resolve({
          status: 'error',
          error: { name: 'Error', message: 'Model pack "custom:plan-only" has no model for build mode' },
          exitCode: 1,
        }),
      };
    });
    process.argv = argv('--prompt', 'do it', '--pack', 'plan-only');

    await expect(runMCCli('do it', { coAuthor: { name: 'mastracode' } })).rejects.toThrow('EXIT:1');

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Model pack "custom:plan-only" has no model for build mode'),
    );
    expect(lifecycleMocks.saveSettings).not.toHaveBeenCalled();
    // Teardown still ran on the error path.
    expect(lifecycleMocks.order).toContain('diagnostics-stop');
  });

  it('exits even when notification dispatch never finishes stopping', async () => {
    const pubsub = { close: vi.fn(async () => void lifecycleMocks.order.push('signals-stop')) };
    lifecycleMocks.createMastraCode.mockImplementation(async () => ({
      controller: {
        getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => {}) })),
        stopIntervals: vi.fn(async () => {}),
      },
      session: {},
      mcpManager: { hasServers: () => false, disconnect: vi.fn(async () => {}) },
      effectiveDefaults: {},
      signalsPubSub: pubsub,
      stopNotificationDispatch: vi.fn(() => new Promise<void>(() => {})),
      stopPluginSignalProviders: vi.fn(),
      releaseThreadClaims: vi.fn(),
    }));
    lifecycleMocks.runMC.mockReturnValue({
      async *[Symbol.asyncIterator]() {},
      result: Promise.resolve({ status: 'completed', exitCode: 0 }),
    });

    await expect(runMCCli('do it')).rejects.toThrow('EXIT:0');

    expect(pubsub.close).toHaveBeenCalledOnce();
    expect(lifecycleMocks.order.at(-1)).toBe('exit-0');
  }, 10_000);

  /** Run `--output json` against a stdout that behaves like a slow pipe. */
  async function runWithPipedStdout(status: string, exitCode: number, writeError?: Error) {
    lifecycleMocks.createMastraCode.mockImplementation(async () => ({
      controller: {
        getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => {}) })),
        stopIntervals: vi.fn(async () => {}),
      },
      session: {},
      mcpManager: { hasServers: () => false, disconnect: vi.fn(async () => {}) },
      signalsPubSub: { close: vi.fn(async () => {}) },
      stopPluginSignalProviders: vi.fn(),
      releaseThreadClaims: vi.fn(),
    }));
    lifecycleMocks.runMC.mockReturnValue({
      async *[Symbol.asyncIterator]() {},
      result: Promise.resolve({ status, text: 'done', toolCalls: [], toolResults: [], exitCode }),
    });
    process.argv = argv('--prompt', 'do it', '--output', 'json');

    // Bytes stay queued until the write callbacks run, as on a pipe whose
    // reader is slower than the writer.
    let pending = 0;
    const lengthSpy = vi.spyOn(process.stdout, 'writableLength', 'get').mockImplementation(() => pending);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: string,
      callback?: (error?: Error | null) => void,
    ) => {
      pending += chunk.length;
      setTimeout(() => {
        pending = 0;
        if (chunk) lifecycleMocks.order.push('stdout-result-flushed');
        callback?.(writeError);
      }, 20);
      return false;
    }) as typeof process.stdout.write);

    let written: unknown[][];
    try {
      await expect(runMCCli('do it')).rejects.toThrow(/EXIT:/);
    } finally {
      written = [...stdoutSpy.mock.calls];
      stdoutSpy.mockRestore();
      lengthSpy.mockRestore();
    }
    return written;
  }

  it('waits for pending stdout writes before exiting', async () => {
    const written = await runWithPipedStdout('completed', 0);

    expect(JSON.parse(written[0]![0] as string)).toMatchObject({ status: 'completed', text: 'done' });
    expect(lifecycleMocks.order.slice(-3)).toEqual(['diagnostics-stop', 'stdout-result-flushed', 'exit-0']);
  });

  it('fails an otherwise successful run whose output could not be delivered', async () => {
    const epipe = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    await runWithPipedStdout('completed', 0, epipe);
    expect(lifecycleMocks.order.at(-1)).toBe('exit-1');

    lifecycleMocks.order.length = 0;
    await runWithPipedStdout('timeout', 2, epipe);
    expect(lifecycleMocks.order.at(-1)).toBe('exit-2');
  });

  it('streams controller events but not display snapshots in jsonl mode', async () => {
    lifecycleMocks.createMastraCode.mockImplementation(async () => ({
      controller: {
        getMastra: vi.fn(() => ({ stopWorkers: vi.fn(async () => {}) })),
        stopIntervals: vi.fn(async () => {}),
      },
      session: {},
      mcpManager: { hasServers: () => false, disconnect: vi.fn(async () => {}) },
      signalsPubSub: { close: vi.fn(async () => {}) },
      stopPluginSignalProviders: vi.fn(),
      releaseThreadClaims: vi.fn(),
    }));
    // A snapshot that holds a large tool result, re-sent after each event the
    // way the session bus does.
    const snapshot = { type: 'display_state_changed', displayState: { toolOutput: 'x'.repeat(1_000_000) } };
    const events = [
      { type: 'agent_start' },
      snapshot,
      { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: { command: 'ls' } },
      snapshot,
      { type: 'shell_output', toolCallId: 't1', output: 'a.txt\n', stream: 'stdout' },
      snapshot,
      { type: 'tool_end', toolCallId: 't1', result: 'a.txt', isError: false },
      snapshot,
      { type: 'agent_end', reason: 'complete' },
      snapshot,
    ];
    lifecycleMocks.runMC.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield* events;
      },
      result: Promise.resolve({ status: 'completed', text: 'done', toolCalls: [], toolResults: [], exitCode: 0 }),
    });
    process.argv = argv('--prompt', 'do it', '--output', 'jsonl');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    let written: string;
    try {
      await expect(runMCCli('do it')).rejects.toThrow('EXIT:0');
    } finally {
      written = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      stdoutSpy.mockRestore();
    }

    const lines = written
      .trimEnd()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(lines.map(line => line.type)).toEqual([
      'agent_start',
      'tool_start',
      'shell_output',
      'tool_end',
      'agent_end',
      'result',
    ]);
    expect(lines.at(-1)).toMatchObject({ status: 'completed', text: 'done', exitCode: 0 });
    expect(written.length).toBeLessThan(10_000);
  });

  it('stops diagnostics when Mastra Code startup fails', async () => {
    lifecycleMocks.createMastraCode.mockRejectedValue(new Error('boot failed'));

    await expect(runMCCli('do it')).rejects.toThrow('EXIT:1');

    expect(lifecycleMocks.diagnostics.stop).toHaveBeenCalledOnce();
    expect(lifecycleMocks.order).toEqual(['diagnostics-start', 'diagnostics-stop', 'exit-1']);
  });
});

describe('flushWritable', () => {
  /** A writable whose underlying writes finish only when `release` is called. */
  function slowStream() {
    const callbacks: Array<(error?: Error | null) => void> = [];
    const stream = new Writable({
      highWaterMark: 16,
      write(_chunk, _encoding, callback) {
        callbacks.push(callback);
      },
    });
    const release = (error?: Error) => {
      while (callbacks.length) callbacks.shift()!(error);
    };
    return { stream, release };
  }

  it('resolves immediately when nothing is pending', async () => {
    await expect(flushWritable(new Writable({ write: (_c, _e, cb) => cb() }))).resolves.toBe(true);
  });

  it('resolves only after earlier writes have been handed off', async () => {
    const { stream, release } = slowStream();
    stream.write('x'.repeat(1024 * 1024));
    let flushed: boolean | undefined;
    const flush = flushWritable(stream).then(result => {
      flushed = result;
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(flushed).toBeUndefined();

    // The queued zero-length write lands after the payload; release both.
    release();
    await new Promise(resolve => setImmediate(resolve));
    release();
    await flush;
    expect(flushed).toBe(true);
  });

  it('reports failure when the reader goes away mid-flush', async () => {
    const { stream, release } = slowStream();
    stream.write('x'.repeat(1024));
    const flush = flushWritable(stream);

    release(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));

    await expect(flush).resolves.toBe(false);
    expect(stream.destroyed).toBe(true);
    await expect(flushWritable(stream)).resolves.toBe(false);
  });
});

describe('flag spec', () => {
  it('derives parseArgs options from the flag table', () => {
    const options = buildParseArgsOptions();
    // Every declared flag is present with the right kind + short alias.
    for (const flag of FLAGS) {
      expect(options[flag.key]).toMatchObject({ type: flag.type });
      if (flag.short) expect(options[flag.key]!.short).toBe(flag.short);
    }
    // Booleans default to false so they're always defined.
    expect(options.continue).toMatchObject({ type: 'boolean', default: false });
  });

  it('renders one usage entry per flag, aligned', () => {
    const usage = renderFlagUsage();
    for (const flag of FLAGS) {
      expect(usage).toContain(`--${flag.key}`);
    }
    // First help line of a multi-line flag stays on the same row as the flag.
    expect(usage).toMatch(/--permission-mode <mode>\s+How tool approvals/);
  });

  it('reports unknown enum values uniformly', () => {
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--mode', 'turbo'))).toThrow(
      '--mode must be one of: build, plan, fast',
    );
    expect(() => parseHeadlessArgs(argv('-p', 'x', '--permission-mode', 'nope'))).toThrow(
      '--permission-mode must be one of: auto, deny',
    );
  });
});
