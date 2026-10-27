import type { Mastra } from '@mastra/core/mastra';

type WaitUntil = (promise: Promise<unknown>) => void;
type FetchHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Response | Promise<Response>;

export interface ModelUsageTelemetryOptions<Args extends unknown[]> {
  /** The serverless platform, sent with each report (for example `vercel`). */
  runtime: string;
  /** A value that identifies the deployed project on the platform. Only a hash of it is sent. */
  projectKey?: string;
  /** Returns the platform's `waitUntil` for the current request, when it has one. */
  getWaitUntil: (request: Request, ...args: Args) => WaitUntil | undefined;
}

/**
 * Wraps a serverless fetch handler so the model tokens used while serving each request are
 * reported once its response has finished, including streamed responses, and keeps the
 * function alive for the report with the platform's `waitUntil`. Returns the handler
 * unchanged when usage isn't counted: telemetry disabled, no observability, or an
 * `@mastra/core` without serverless usage telemetry.
 */
export async function withModelUsageTelemetry<Args extends unknown[]>(
  mastra: Mastra,
  fetch: FetchHandler<Args>,
  options: ModelUsageTelemetryOptions<Args>,
): Promise<FetchHandler<Args>> {
  // Older @mastra/core versions don't export it, hence the optional call.
  const reporter = await import('@mastra/core/telemetry')
    .then(({ startServerlessModelUsageTelemetry }) =>
      startServerlessModelUsageTelemetry?.(mastra, { runtime: options.runtime, projectKey: options.projectKey }),
    )
    .catch(() => undefined);
  if (!reporter) {
    return fetch;
  }

  return async (request, ...args) => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    // A model span can end just after the last byte of its stream is written, so give it
    // a macrotask to land before reporting.
    const delivery = finished.then(() => new Promise(resolve => setTimeout(resolve, 0))).then(() => reporter.report());
    try {
      options.getWaitUntil(request, ...args)?.(delivery);
    } catch {
      // Without waitUntil the report is sent best-effort.
    }

    let response: Response;
    try {
      response = await fetch(request, ...args);
    } catch (error) {
      finish();
      throw error;
    }

    if (!response.body) {
      finish();
      return response;
    }
    return new Response(notifyWhenDone(response.body, finish), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/** Passes the body through unchanged and calls `onDone` once it ends, errors, or is cancelled. */
function notifyWhenDone(body: ReadableStream<Uint8Array>, onDone: () => void): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          onDone();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
        onDone();
      }
    },
    cancel(reason) {
      onDone();
      return reader.cancel(reason);
    },
  });
}
