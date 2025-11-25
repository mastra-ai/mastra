import createApp from './core/app';
import {rootLogger} from './core/logger';

async function startServer() {
  const app = await createApp();
  app.listen({port: 3003});
}

function serve() {
  startServer().catch(error => rootLogger.error(error, 'Failed to start server'));
}

serve();
