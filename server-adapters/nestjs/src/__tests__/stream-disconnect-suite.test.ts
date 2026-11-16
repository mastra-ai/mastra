import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';
import compression from 'compression';
import { MastraModule } from '../index';

createStreamDisconnectTestSuite({
  supportsCompression: true,
  startServer: async (route, { beforeContext, compress } = {}) => {
    SERVER_ROUTES.push(route);
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: new Mastra({ logger: false }), prefix: '' })],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    if (compress) {
      app.use(compression());
    }

    if (beforeContext) {
      app.use((_req: unknown, _res: unknown, next: (error?: unknown) => void) => {
        beforeContext().then(() => next(), next);
      });
    }
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP listener');
    }

    return {
      url: `http://127.0.0.1:${address.port}${route.path}`,
      close: async () => {
        SERVER_ROUTES.splice(SERVER_ROUTES.indexOf(route), 1);
        server.closeAllConnections();
        await app.close();
      },
    };
  },
});
