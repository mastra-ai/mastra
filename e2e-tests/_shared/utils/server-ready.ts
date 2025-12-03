export interface WaitForServerOptions {
  /** URL to poll for readiness */
  url: string;
  /** Maximum time to wait in milliseconds (default: 60000) */
  timeout?: number;
  /** Interval between polling attempts in milliseconds (default: 500) */
  interval?: number;
  /** Custom health check function (default: response.ok) */
  healthCheck?: (response: Response) => boolean | Promise<boolean>;
  /** Called on each failed attempt for debugging */
  onAttempt?: (attempt: number, error?: Error) => void;
}

/**
 * Wait for a server to become ready by polling a URL.
 *
 * This is more robust than waiting for stdout patterns because:
 * - It actually verifies the server is responding to HTTP requests
 * - It's not affected by stdout buffering or format changes
 * - It supports custom health checks for specific endpoints
 *
 * @example
 * ```ts
 * // Wait for server to respond with 200
 * await waitForServer({ url: 'http://localhost:3000' });
 *
 * // Wait for specific health endpoint
 * await waitForServer({
 *   url: 'http://localhost:3000/health',
 *   healthCheck: async (res) => {
 *     const data = await res.json();
 *     return data.status === 'ready';
 *   }
 * });
 * ```
 */
export async function waitForServer(options: WaitForServerOptions): Promise<void> {
  const { url, timeout = 60_000, interval = 500, healthCheck = res => res.ok, onAttempt } = options;

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeout) {
    attempt++;

    try {
      const response = await fetch(url);
      const isHealthy = await healthCheck(response);

      if (isHealthy) {
        return;
      }

      onAttempt?.(attempt);
    } catch (error) {
      onAttempt?.(attempt, error instanceof Error ? error : new Error(String(error)));
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Server at ${url} failed to become ready within ${timeout}ms after ${attempt} attempts`);
}

export interface WaitForOutputOptions {
  /** The readable stream to monitor */
  stream: NodeJS.ReadableStream;
  /** Pattern to match in the output (string or regex) */
  pattern: string | RegExp;
  /** Maximum time to wait in milliseconds (default: 60000) */
  timeout?: number;
  /** Whether to also pipe output to stdout (default: true) */
  passthrough?: boolean;
}

/**
 * Wait for a specific pattern in a process output stream.
 *
 * Use this when you need to wait for startup messages before the server
 * is actually ready to accept connections (e.g., for servers that bind
 * to ports asynchronously).
 *
 * @example
 * ```ts
 * const proc = spawn('node', ['server.js']);
 * await waitForOutput({
 *   stream: proc.stdout!,
 *   pattern: /listening on port \d+/i,
 * });
 * ```
 */
export async function waitForOutput(options: WaitForOutputOptions): Promise<string> {
  const { stream, pattern, timeout = 60_000, passthrough = true } = options;

  return new Promise((resolve, reject) => {
    let output = '';
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for pattern "${pattern}" in output. Received: ${output.slice(-500)}`));
    }, timeout);

    const onData = (data: Buffer) => {
      const text = data.toString();
      output += text;

      if (passthrough) {
        process.stdout.write(text);
      }

      const match = typeof pattern === 'string' ? output.includes(pattern) : pattern.test(output);

      if (match) {
        cleanup();
        resolve(output);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onClose = () => {
      cleanup();
      reject(new Error(`Stream closed before pattern "${pattern}" was found. Output: ${output.slice(-500)}`));
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      stream.off('data', onData);
      stream.off('error', onError);
      stream.off('close', onClose);
    };

    stream.on('data', onData);
    stream.on('error', onError);
    stream.on('close', onClose);
  });
}
