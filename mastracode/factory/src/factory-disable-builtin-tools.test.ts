import { LibSQLFactoryStorage } from '@mastra/libsql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from './factory.js';

const prepareMock = vi.fn(async (_config: Record<string, unknown>) => ({
  base: { controller: { onSessionCreated: vi.fn(), setChannels: vi.fn() } },
  mastraArgs: {},
  finalize: vi.fn(async () => {}),
}));

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

describe('MastraFactory disableBuiltinTools', () => {
  beforeEach(() => {
    prepareMock.mockClear();
  });

  it('forwards disableBuiltinTools to the controller mount', async () => {
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'disable-builtin-tools-test' });
    await new MastraFactory({ storage, disableBuiltinTools: ['submit_plan'] }).prepare();

    expect(prepareMock).toHaveBeenCalledOnce();
    expect(prepareMock.mock.calls[0]![0].disableBuiltinTools).toEqual(['submit_plan']);
  });

  it('leaves built-in tools enabled by default', async () => {
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'disable-builtin-tools-default-test' });
    await new MastraFactory({ storage }).prepare();

    expect(prepareMock).toHaveBeenCalledOnce();
    expect(prepareMock.mock.calls[0]![0]).not.toHaveProperty('disableBuiltinTools');
  });
});
