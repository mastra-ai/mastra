import createApp from './core/app';
import {rootLogger} from './core/logger';

async function startServer(port: string | number) {
  const app = await createApp();
  app.listen({port: typeof port === 'string' ? parseInt(port) : port, host: '::'});
}

function serve(port: string | number) {
  startServer(port).catch(error => rootLogger.error(error, 'Failed to start server'));
}

serve(process.env.DEFAULT_PORT ?? 8080);
