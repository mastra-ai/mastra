import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadTiming(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv('FACTORY_TIMING', flag ?? '');
  return import('./timing.js');
}

describe('FACTORY_TIMING instrumentation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs method durations in place, preserving identity and results, when enabled', async () => {
    const { instrumentMethods } = await loadTiming('1');
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const sandbox = {
      prefix: 'out:',
      async executeCommand(cmd: string) {
        return `${this.prefix}${cmd}`;
      },
    };

    const result = instrumentMethods(sandbox, 'sandbox(s1)', ['executeCommand']);

    expect(result).toBe(sandbox);
    await expect(sandbox.executeCommand('pwd')).resolves.toBe('out:pwd');
    expect(write).toHaveBeenCalledWith(
      expect.stringMatching(/^\[factory:timing\] sandbox\(s1\)\.executeCommand \d+ms\n$/),
    );
  });

  it('times storage domain calls reached through getDomain', async () => {
    const { instrumentAsyncMethods } = await loadTiming('true');
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const domain = { list: async () => ['a'] };
    const storage = instrumentAsyncMethods({ getDomain: (_name: string) => domain }, 'storage');

    await expect(storage.getDomain('sessions').list()).resolves.toEqual(['a']);
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/^\[factory:timing\] storage\.sessions\.list \d+ms\n$/));
  });

  it('leaves objects untouched and logs nothing when disabled', async () => {
    const { instrumentMethods, instrumentAsyncMethods, timed } = await loadTiming(undefined);
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const run = async () => 1;
    const target = { run };

    instrumentMethods(target, 'x', ['run']);
    expect(target.run).toBe(run);
    expect(instrumentAsyncMethods(target, 'x')).toBe(target);
    await expect(timed('phase', run)).resolves.toBe(1);
    expect(write).not.toHaveBeenCalled();
  });
});
