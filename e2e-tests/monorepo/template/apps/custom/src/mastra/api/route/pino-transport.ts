import { registerApiRoute } from '@mastra/core/server';
import pino from 'pino';

// The build must detect this target and add pino-pretty to the output dependencies.
// Created per request so the server does not start a transport worker on boot.
export const pinoTransportRoute = registerApiRoute('/pino-transport', {
  method: 'GET',
  handler: async c => {
    const transport = pino.transport({ target: 'pino-pretty' });
    transport.end();
    return c.json({ ok: true });
  },
});
