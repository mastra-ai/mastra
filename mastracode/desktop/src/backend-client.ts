import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import electron from 'electron';
import type { UtilityProcess } from 'electron';

import { parseDesktopBackendResponse } from './backend-protocol.js';
import type { DesktopBackendRequest, DesktopBackendResponse } from './backend-protocol.js';
import type { DesktopServerHandle, DesktopServerOptions } from './server-types.js';

const BACKEND_REQUEST_TIMEOUT_MS = 30_000;
const { utilityProcess } = electron;

interface PendingRequest {
  resolve: (response: DesktopBackendResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface DesktopBackendOptions extends DesktopServerOptions {
  onUnexpectedExit: (error: Error) => void;
}

function validateStartedResponse(
  response: DesktopBackendResponse,
): asserts response is Extract<DesktopBackendResponse, { type: 'started' }> {
  if (response.type !== 'started') throw new Error(`Unexpected desktop backend response: ${response.type}`);
  const bootstrapUrl = new URL(response.bootstrapUrl);
  if (
    bootstrapUrl.protocol !== 'http:' ||
    bootstrapUrl.hostname !== '127.0.0.1' ||
    bootstrapUrl.origin !== response.origin ||
    Number(bootstrapUrl.port) !== response.port
  ) {
    throw new Error('Desktop backend returned an invalid loopback address');
  }
}

class DesktopBackendClient {
  readonly #process: UtilityProcess;
  readonly #onUnexpectedExit: (error: Error) => void;
  readonly #pending = new Map<string, PendingRequest>();
  #closed = false;
  #closing = false;
  #started = false;

  constructor(process: UtilityProcess, onUnexpectedExit: (error: Error) => void) {
    this.#process = process;
    this.#onUnexpectedExit = onUnexpectedExit;
    process.on('message', (message: unknown) => {
      this.#receive(message);
    });
    process.on('error', (_type, location, report) => {
      this.#fail(new Error(`MastraCode backend failed at ${location}: ${report}`));
    });
    process.on('exit', code => {
      const wasClosed = this.#closed;
      this.#closed = true;
      const error = new Error(`MastraCode backend exited with code ${code}`);
      this.#rejectPending(error);
      if (!wasClosed && this.#started && !this.#closing) this.#onUnexpectedExit(error);
    });
  }

  markStarted(): void {
    this.#started = true;
  }

  request(request: DesktopBackendRequest): Promise<DesktopBackendResponse> {
    if (this.#closed) return Promise.reject(new Error('MastraCode backend is not running'));
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(request.requestId);
        rejectRequest(new Error(`MastraCode backend request timed out: ${request.type}`));
      }, BACKEND_REQUEST_TIMEOUT_MS);
      this.#pending.set(request.requestId, { resolve: resolveRequest, reject: rejectRequest, timeout });
      this.#process.postMessage(request);
    });
  }

  async close(): Promise<void> {
    if (this.#closing || this.#closed) return;
    this.#closing = true;
    try {
      const response = await this.request({ type: 'close', requestId: randomUUID() });
      if (response.type !== 'closed') throw new Error(`Unexpected desktop backend response: ${response.type}`);
    } finally {
      this.#process.kill();
    }
  }

  #receive(message: unknown): void {
    let response: DesktopBackendResponse;
    try {
      response = parseDesktopBackendResponse(message);
    } catch (error) {
      this.#fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const pending = this.#pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.#pending.delete(response.requestId);
    if (response.type === 'error') pending.reject(new Error(response.message));
    else pending.resolve(response);
  }

  #fail(error: Error): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#rejectPending(error);
    this.#process.kill();
    if (this.#started && !this.#closing) this.#onUnexpectedExit(error);
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
  }
}

export async function startDesktopBackend(options: DesktopBackendOptions): Promise<DesktopServerHandle> {
  const backendProcess = utilityProcess.fork(resolve(import.meta.dirname, 'backend.js'), [], {
    allowLoadingUnsignedLibraries: false,
    serviceName: 'MastraCode Backend',
    stdio: 'inherit',
  });
  const client = new DesktopBackendClient(backendProcess, options.onUnexpectedExit);
  let response: DesktopBackendResponse;
  try {
    response = await client.request({
      type: 'start',
      requestId: randomUUID(),
      projectAccessFile: options.projectAccessFile,
    });
    validateStartedResponse(response);
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
  client.markStarted();

  let closePromise: Promise<void> | undefined;
  return {
    bootstrapUrl: response.bootstrapUrl,
    origin: response.origin,
    port: response.port,
    approveProjectDirectory: async path => {
      const approval = await client.request({ type: 'approve-project', requestId: randomUUID(), path });
      if (approval.type !== 'approved-project') {
        throw new Error(`Unexpected desktop backend response: ${approval.type}`);
      }
      return approval.path;
    },
    close: () => {
      closePromise ??= client.close();
      return closePromise;
    },
  };
}
