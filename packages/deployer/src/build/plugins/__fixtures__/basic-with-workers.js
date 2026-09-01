import { Mastra } from '@mastra/core/mastra';

function initializeStorage() {
  throw new Error('storage must not initialize during worker introspection');
}

class RuntimeNamedWorker {
  name = process.env.DEPLOYMENT_WORKER_NAME;
}

export const mastra = new Mastra({
  storage: initializeStorage(),
  workers: [new RuntimeNamedWorker()],
});
