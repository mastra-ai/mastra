import { server } from './index';

// console.error('Starting server...');
void server.start({
  transportType: 'stdio',
});
