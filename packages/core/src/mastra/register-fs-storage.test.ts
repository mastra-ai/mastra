import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../storage';
import { Mastra } from './index';

const fallbackWarning = 'No `storage` configured on Mastra';

describe('Mastra.__registerFsStorage', () => {
  it('suppresses the fallback warning when file-system storage is registered during module initialization', async () => {
    const mastra = new Mastra({});
    const warn = vi.fn();
    mastra.getLogger().warn = warn;

    mastra.__registerFsStorage(new InMemoryStore({ id: 'fs-storage' }));
    await Promise.resolve();

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(fallbackWarning));
  });

  it('warns when no configured or file-system storage replaces the fallback', async () => {
    const mastra = new Mastra({});
    const warn = vi.fn();
    mastra.getLogger().warn = warn;

    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(fallbackWarning));
  });
});
