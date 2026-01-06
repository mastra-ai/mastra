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
    it('should pass boolean true for inspect to dev function', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: true,
        inspectBrk: false,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: true,
          inspectBrk: false,
        }),
      );
    });

    it('should pass boolean true for inspectBrk to dev function', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: false,
        inspectBrk: true,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: false,
          inspectBrk: true,
        }),
      );
    });
  });

  describe('string inspect values', () => {
    it('should pass string inspect value "0.0.0.0:9229" to dev function', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: '0.0.0.0:9229',
        inspectBrk: false,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: '0.0.0.0:9229',
          inspectBrk: false,
        }),
      );
    });

    it('should pass string inspect value "9230" to dev function', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: '9230',
        inspectBrk: false,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: '9230',
          inspectBrk: false,
        }),
      );
    });

    it('should pass string inspectBrk value "0.0.0.0:9229" to dev function', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: false,
        inspectBrk: '0.0.0.0:9229',
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: false,
          inspectBrk: '0.0.0.0:9229',
        }),
      );
    });
  });

  describe('mutual exclusivity with string values', () => {
    it('should disable inspect when inspectBrk is provided (string value)', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: '0.0.0.0:9229',
        inspectBrk: '0.0.0.0:9230',
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: false,
          inspectBrk: '0.0.0.0:9230',
        }),
      );
    });

    it('should disable inspect when inspectBrk is boolean true', async () => {
      const { startDevServer } = await import('./start-dev-server');

      await startDevServer({
        inspect: '0.0.0.0:9229',
        inspectBrk: true,
        debug: false,
      });

      expect(devMock).toHaveBeenCalledWith(
        expect.objectContaining({
          inspect: false,
          inspectBrk: true,
        }),
      );
    });
  });
});
