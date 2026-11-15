import { createObservabilitySignalWriteTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';
import { MastraModule } from '../index';

createObservabilitySignalWriteTestSuite({
  startServer: async mastra => {
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra })],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    return {
      request: (path, init) => fetch(`${baseUrl}${path}`, init),
      close: () => app.close(),
    };
  },
});
