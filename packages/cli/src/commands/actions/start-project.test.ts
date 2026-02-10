import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: vi.fn(async ({ execution }) => {
      await execution();
    }),
  },
  origin: 'test',
}));

const startMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../start', () => ({
  start: startMock,
}));

describe('startProject - customArgs handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass parsed customArgs to start function', async () => {
    const { startProject } = await import('./start-project');

    await startProject({
      customArgs: '--require=newrelic,--max-old-space-size=4096',
    });

    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customArgs: ['--require=newrelic', '--max-old-space-size=4096'],
      }),
    );
  });

  it('should pass empty array when customArgs is undefined', async () => {
    const { startProject } = await import('./start-project');

    await startProject({});

    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customArgs: [],
      }),
    );
  });

  it('should pass single custom arg as array', async () => {
    const { startProject } = await import('./start-project');

    await startProject({
      customArgs: '--require=newrelic',
    });

    expect(startMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customArgs: ['--require=newrelic'],
      }),
    );
  });

  it('should forward dir and env alongside customArgs', async () => {
    const { startProject } = await import('./start-project');

    await startProject({
      dir: './custom-output',
      env: '.env.staging',
      customArgs: '--require=newrelic',
    });

    expect(startMock).toHaveBeenCalledWith({
      dir: './custom-output',
      env: '.env.staging',
      customArgs: ['--require=newrelic'],
    });
  });
});
