import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildMock = vi.fn().mockResolvedValue(undefined);
const startMock = vi.fn().mockResolvedValue(undefined);

vi.mock('./build', () => ({
  buildWorker: buildMock,
}));

vi.mock('./start', () => ({
  startWorker: startMock,
}));

describe('mastra worker dev', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs build then start in order', async () => {
    const order: string[] = [];
    buildMock.mockImplementation(async () => {
      order.push('build');
    });
    startMock.mockImplementation(async () => {
      order.push('start');
    });

    const { devWorker } = await import('./dev');
    await devWorker({ name: 'orchestration', dir: 'src/mastra', debug: true });

    expect(order).toEqual(['build', 'start']);
  });

  it('forwards build options to buildWorker and start options to startWorker', async () => {
    const { devWorker } = await import('./dev');
    await devWorker({
      name: 'scheduler',
      dir: 'src/mastra',
      root: '/tmp/proj',
      tools: 'a,b',
      env: '.env.test',
      debug: false,
    });

    expect(buildMock).toHaveBeenCalledWith({
      dir: 'src/mastra',
      root: '/tmp/proj',
      tools: 'a,b',
      debug: false,
    });
    expect(startMock).toHaveBeenCalledWith({
      name: 'scheduler',
      env: '.env.test',
    });
  });
});
