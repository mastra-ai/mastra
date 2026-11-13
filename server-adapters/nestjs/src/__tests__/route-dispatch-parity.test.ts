import type { AddressInfo } from 'node:net';
import { createRouteDispatchParityTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';

import { MastraModule } from '../index';

createRouteDispatchParityTestSuite({
  suiteName: 'NestJS route dispatch parity',
  // NestJS serves custom routes registered with registerApiRoute(), not schema routes.
  probe: 'hono',
  // NestJS answers errors in its own envelope (code, requestId, timestamp).
  sameErrorBodies: false,
  startServer: async (mastra, options) => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({ mastra, prefix: options?.prefix ?? '/api', rateLimitOptions: { enabled: false } }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    return {
      request: (path, init) => fetch(`http://localhost:${port}${path}`, init),
      close: () => app.close(),
    };
  },
});
