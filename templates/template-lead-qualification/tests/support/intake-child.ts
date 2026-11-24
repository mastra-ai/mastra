import { serve } from '@hono/node-server';
import { harness } from './application';

const directory = process.argv[2]!;
const holdDispatch = process.argv[3] === 'hold';
const application = await harness({ directory, dispatch: !holdDispatch });
const server = serve({ fetch: application.http.fetch, hostname: '127.0.0.1', port: 0 });
server.once('listening', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.send?.({ type: 'ready', port: address.port });
});
process.on('message', message => {
  if (message === 'stop') {
    server.close(() => {
      void application.close(false).then(() => process.exit(0));
    });
  }
});
