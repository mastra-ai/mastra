const clients = new Set<ReadableStreamDefaultController>();
let hotReloadDisabled = false;

export function handleClientsRefreshRequest(abortSignal: AbortSignal): Response {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      controller.enqueue('data: connected\n\n');

      abortSignal.addEventListener('abort', () => {
        clients.delete(controller);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export function getTriggerClientsRefreshPayload() {
  clients.forEach(controller => {
    try {
      controller.enqueue('data: refresh\n\n');
    } catch {
      clients.delete(controller);
    }
  });
  return { success: true, clients: clients.size };
}

// Functions to control hot reload during template installation
export function disableHotReload() {
  hotReloadDisabled = true;
  console.info('🔒 Hot reload disabled for template installation');
}

export function enableHotReload() {
  hotReloadDisabled = false;
  console.info('🔓 Hot reload re-enabled after template installation');
}

export function isHotReloadDisabled(): boolean {
  return hotReloadDisabled;
}
