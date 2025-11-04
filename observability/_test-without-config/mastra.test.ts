import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import type { IMastraLogger } from '@mastra/core/logger';
import { describe, it, expect, vi } from 'vitest';
import '@mastra/observability/init';

describe('Observability init without observablity config', () => {
  it('should log an error providing helpful info', async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any as IMastraLogger;

    new Mastra({
      storage: new MockStore(),
      logger: mockLogger,
      // This tests the absence of this config, disabling Observability
      //
      // observability: {
      //   default: { enabled: true },
      // },
    });

    // Check if warn was called with the expected message
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Mastra Observability] Observability init registered but no config provided'),
    );
  });
});
