import { realtimeMiddleware } from '@inngest/realtime/middleware';
import { Inngest } from 'inngest';

export const inngest: Inngest = new Inngest({
  id: 'durable-agents-example',
  baseUrl: 'http://localhost:8288',
  isDev: true,
  middleware: [realtimeMiddleware()],
});
