import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../..', () => ({
  analytics: {
    trackCommand: vi.fn(),
  },
  origin: 'test',
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const devMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../dev/dev', () => ({
  dev: devMock,
}));

describe('startDevServer - inspect flag integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('boolean inspect values', () => {
    it.each([
      ['should pass boolean true for inspect to dev function', true, false],
      ['should pass boolean true for inspectBrk to dev function', false, true],
    ] as const)('%s', async (_title, inspect, inspectBrk) => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect,
        inspectBrk,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect,
          inspectBrk,
        }),
      );
    });
  });

  describe('string inspect values', () => {
    it.each([
      ['should pass string inspect value "0.0.0.0:9229" to dev function', '0.0.0.0:9229', false],
      ['should pass string inspect value "9230" to dev function', '9230', false],
      ['should pass string inspectBrk value "0.0.0.0:9229" to dev function', false, '0.0.0.0:9229'],
    ] as const)('%s', async (_title, inspect, inspectBrk) => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect,
        inspectBrk,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect,
          inspectBrk,
        }),
      );
    });
  });

  describe('mutual exclusivity with string values', () => {
    it.each([
      ['should disable inspect when inspectBrk is provided (string value)', '0.0.0.0:9230'],
      ['should disable inspect when inspectBrk is boolean true', true],
    ] as const)('%s', async (_title, inspectBrk) => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: '0.0.0.0:9229',
        inspectBrk,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: false,
          inspectBrk,
        }),
      );
    });
  });

  describe('factory mode', () => {
    it('should pass factory: true to dev when factory is set', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: false,
        inspectBrk: false,
        debug: false,
        factory: true,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          factory: true,
        }),
      );
    });

    it('should track factory dev analytics command when factory is set', async () => {
      const { analytics } = await import('../..');
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: false,
        inspectBrk: false,
        debug: false,
        factory: true,
      });

      expect(analytics.trackCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'factory dev',
        }),
      );
    });

    it('should track dev analytics command when factory is not set', async () => {
      const { analytics } = await import('../..');
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: false,
        inspectBrk: false,
        debug: false,
      });

      expect(analytics.trackCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'dev',
        }),
      );
    });
  });
});
