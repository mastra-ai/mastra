import { setupEventListeners, connections } from '../event-listeners';

export async function GET() {
  // Ensure event listeners are registered (idempotent)
  setupEventListeners();

  const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log('[Events Route] New SSE connection:', connectionId, 'Total before:', connections.size);

  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      connections.set(connectionId, { queue: [], controller });
      console.log('[Events Route] Connection stored:', connectionId, 'Total now:', connections.size);

      // Keepalive every 30 seconds
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepaliveInterval!);
          connections.delete(connectionId);
        }
      }, 30000);
    },
    cancel() {
      // Called when the client disconnects (EventSource.close() or navigation)
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      connections.delete(connectionId);
      console.log('[Events Route] SSE connection closed:', connectionId, 'Remaining:', connections.size);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
