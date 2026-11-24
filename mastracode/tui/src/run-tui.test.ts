import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMastraCode = vi.hoisted(() => vi.fn());

vi.mock('@mastra/code-sdk', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk')>()),
  createMastraCode,
}));
vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>()),
  loadSettings: () => ({ preferences: { theme: 'dark' }, browser: undefined, factory: undefined }),
}));
vi.mock('@mastra/code-sdk/analytics', () => ({ createMastraCodeAnalytics: () => undefined }));
vi.mock('@mastra/code-sdk/utils/debug-log', () => ({ setupDebugLogging: () => {}, truncateLogFile: () => {} }));
vi.mock('./tui/commands/theme.js', () => ({
  applyThemePreference: async () => {},
  normalizeThemePreference: () => '',
}));

const { runTui } = await import('./run-tui.js');

const originalArgv = process.argv;
const originalIsTTY = process.stdin.isTTY;

/** Run the boot until it reaches createMastraCode, and return the config it passed. */
async function bootConfig(options?: Parameters<typeof runTui>[0]) {
  createMastraCode.mockReset();
  // Never resolves: the test only needs the config, not a running TUI.
  createMastraCode.mockReturnValue(new Promise(() => {}));
  void runTui(options);
  await vi.waitFor(() => expect(createMastraCode).toHaveBeenCalledTimes(1));
  return createMastraCode.mock.calls[0]![0] as Record<string, unknown>;
}

describe('runTui', () => {
  beforeEach(() => {
    process.argv = ['node', 'mastracode'];
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    for (const name of [
      'MASTRACODE_MODEL_ID',
      'MASTRACODE_YOLO',
      'MASTRACODE_DISABLE_MEMORY',
      'MASTRACODE_LOCAL',
      'MASTRA_THEME',
    ]) {
      vi.stubEnv(name, '');
    }
  });

  afterEach(() => {
    process.argv = originalArgv;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    vi.unstubAllEnvs();
  });

  it('passes a launcher’s knowledge and scopes through to createMastraCode', async () => {
    const knowledge = { key: 'director', instance: { id: 'director-knowledge' } as never };

    const config = await bootConfig({ createMastraCode: { knowledge, scopes: ['org:mastra', 'team:mastracode'] } });

    expect(config.knowledge).toBe(knowledge);
    expect(config.scopes).toEqual(['org:mastra', 'team:mastracode']);
    expect(config).toMatchObject({ createInitialThread: false, coAuthor: { name: 'mastracode' } });
  });

  it('lets a launcher option replace the value Mastra Code passes for the same key', async () => {
    const config = await bootConfig({ createMastraCode: { createInitialThread: true } });

    expect(config.createInitialThread).toBe(true);
  });

  it('passes only Mastra Code’s own options when called without options', async () => {
    const config = await bootConfig();

    expect(Object.keys(config).sort()).toEqual(
      ['coAuthor', 'createInitialThread', 'disableHooks', 'disableMcp', 'subagents', 'unixSocketPubSub'].sort(),
    );
  });

  it('does not carry a previous launcher’s options into a call without options', async () => {
    await bootConfig({ createMastraCode: { scopes: ['org:mastra'] } });

    const config = await bootConfig();

    expect(config).not.toHaveProperty('scopes');
  });
});
