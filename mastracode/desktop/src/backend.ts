import type { MessageEvent } from 'electron';

import { parseDesktopBackendRequest } from './backend-protocol.js';
import type { DesktopBackendRequest, DesktopBackendResponse } from './backend-protocol.js';
import type { DesktopServerHandle } from './server-types.js';
import { startDesktopServer } from './server.js';

const { parentPort } = process;
let serverHandle: DesktopServerHandle | undefined;
let requestQueue = Promise.resolve();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function postResponse(response: DesktopBackendResponse): void {
  parentPort.postMessage(response);
}

async function handleRequest(request: DesktopBackendRequest): Promise<void> {
  try {
    if (request.type === 'start') {
      if (serverHandle) throw new Error('MastraCode desktop backend is already running');
      serverHandle = await startDesktopServer({ projectAccessFile: request.projectAccessFile });
      postResponse({
        type: 'started',
        requestId: request.requestId,
        bootstrapUrl: serverHandle.bootstrapUrl,
        origin: serverHandle.origin,
        port: serverHandle.port,
      });
      return;
    }

    if (!serverHandle) throw new Error('MastraCode desktop backend is not running');
    if (request.type === 'approve-project') {
      const path = await serverHandle.approveProjectDirectory(request.path);
      postResponse({ type: 'approved-project', requestId: request.requestId, path });
      return;
    }

    await serverHandle.close();
    serverHandle = undefined;
    postResponse({ type: 'closed', requestId: request.requestId });
    setImmediate(() => process.exit(0));
  } catch (error) {
    postResponse({ type: 'error', requestId: request.requestId, message: errorMessage(error) });
  }
}

parentPort.on('message', (event: MessageEvent) => {
  const payload: unknown = event.data;
  requestQueue = requestQueue.then(async () => {
    let request: DesktopBackendRequest;
    try {
      request = parseDesktopBackendRequest(payload);
    } catch (error) {
      console.error('[MastraCode Desktop] Rejected an invalid backend message:', error);
      return;
    }
    await handleRequest(request);
  });
});

async function closeBeforeExit(): Promise<void> {
  const handle = serverHandle;
  serverHandle = undefined;
  if (handle) await handle.close();
}

process.once('SIGTERM', () => {
  void closeBeforeExit().finally(() => process.exit(0));
});
