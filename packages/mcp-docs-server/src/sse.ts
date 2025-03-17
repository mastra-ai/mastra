import { server } from './index.js';

// console.error('Starting server...');
void server.start({
  transportType: 'sse',
  sse: {
    endpoint: '/sse',
    port: 9991,
  },
});
