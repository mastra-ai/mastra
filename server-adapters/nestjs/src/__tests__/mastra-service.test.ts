import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import { MastraService } from '../mastra.service';
import { ShutdownService } from '../services/shutdown.service';

describe('MastraService', () => {
  it('fails fast when Nest is not using the Express adapter', async () => {
    const context = await createDefaultTestContext();

    await expect(
      Test.createTestingModule({
        providers: [
          MastraService,
          ShutdownService,
          {
            provide: MASTRA,
            useValue: context.mastra,
          },
          {
            provide: MASTRA_OPTIONS,
            useValue: { mastra: context.mastra },
          },
          {
            provide: HttpAdapterHost,
            useValue: {
              httpAdapter: {
                getType: () => 'fastify',
                getInstance: () => ({}),
              },
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow(/Express HTTP adapter/i);
  });
});
