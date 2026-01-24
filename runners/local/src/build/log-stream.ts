import type { LogStreamCallback } from '@mastra/admin';

/**
 * Build log stream configuration.
 */
export interface BuildLogStreamConfig {
  /** Whether to include timestamps. @default true */
  includeTimestamp?: boolean;
  /** Prefix for log lines (e.g., build step name). */
  prefix?: string;
  /** Whether to buffer lines before flushing. @default false */
  buffered?: boolean;
  /** Buffer flush interval in ms. @default 100 */
  flushIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<BuildLogStreamConfig> = {
  includeTimestamp: true,
  prefix: '',
  buffered: false,
  flushIntervalMs: 100,
};

/**
 * Creates a wrapped log stream callback with formatting options.
 *
 * @example
 * ```typescript
 * const logStream = createBuildLogStream(onLog, { prefix: '[install]' });
 * logStream('Installing dependencies...');
 * // Output: [2025-01-23T12:00:00.000Z] [install] Installing dependencies...
 * ```
 */
export function createBuildLogStream(
  callback: LogStreamCallback | undefined,
  config: BuildLogStreamConfig = {},
): LogStreamCallback {
  if (!callback) {
    return () => {};
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (mergedConfig.buffered) {
    return createBufferedLogStream(callback, mergedConfig);
  }

  return (line: string) => {
    const formatted = formatLogLine(line, mergedConfig);
    callback(formatted);
  };
}

/**
 * Format a log line with timestamp and prefix.
 */
export function formatLogLine(line: string, config: BuildLogStreamConfig = {}): string {
  const parts: string[] = [];

  if (config.includeTimestamp !== false) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  if (config.prefix) {
    parts.push(config.prefix);
  }

  parts.push(line);

  return parts.join(' ');
}

/**
 * Creates a buffered log stream that batches lines before sending.
 * Useful for high-frequency log output to reduce callback overhead.
 */
function createBufferedLogStream(
  callback: LogStreamCallback,
  config: Required<BuildLogStreamConfig>,
): LogStreamCallback {
  let buffer: string[] = [];
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (buffer.length > 0) {
      const lines = buffer.join('\n');
      buffer = [];
      callback(lines);
    }
    flushTimeout = null;
  };

  return (line: string) => {
    const formatted = formatLogLine(line, config);
    buffer.push(formatted);

    if (!flushTimeout) {
      flushTimeout = setTimeout(flush, config.flushIntervalMs);
    }
  };
}

/**
 * Creates a multi-destination log stream that sends to multiple callbacks.
 */
export function createMultiLogStream(...callbacks: (LogStreamCallback | undefined)[]): LogStreamCallback {
  const validCallbacks: LogStreamCallback[] = [];
  for (const cb of callbacks) {
    if (cb !== undefined) {
      validCallbacks.push(cb);
    }
  }

  if (validCallbacks.length === 0) {
    return () => {};
  }

  if (validCallbacks.length === 1) {
    return validCallbacks[0]!;
  }

  return (line: string) => {
    for (const callback of validCallbacks) {
      try {
        callback(line);
      } catch {
        // Ignore callback errors to prevent one failing callback from blocking others
      }
    }
  };
}

/**
 * Creates a log stream that filters lines based on a predicate.
 */
export function createFilteredLogStream(
  callback: LogStreamCallback | undefined,
  predicate: (line: string) => boolean,
): LogStreamCallback {
  if (!callback) {
    return () => {};
  }

  return (line: string) => {
    if (predicate(line)) {
      callback(line);
    }
  };
}
