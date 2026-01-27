import type { LogCollector as ILogCollector, ExtendedLogStreamCallback } from '../types';
import { RingBuffer  } from './ring-buffer';
import type {LogEntry} from './ring-buffer';

/**
 * Structured log entry for pagination.
 */
export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  line: string;
  stream: 'stdout' | 'stderr';
}

/**
 * Result from paginated log query.
 */
export interface PaginatedLogsResult {
  entries: StructuredLogEntry[];
  hasMore: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
}

// Simple counter for unique IDs within a session
let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`;
}

/**
 * Collects and manages logs for a running process.
 */
export class LogCollector implements ILogCollector {
  private readonly buffer: RingBuffer<LogEntry>;
  private readonly listeners: Set<ExtendedLogStreamCallback> = new Set();

  constructor(maxLines: number = 10000) {
    this.buffer = new RingBuffer<LogEntry>(maxLines);
  }

  /**
   * Append a log line with timestamp.
   */
  append(line: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      line,
      stream,
    };
    this.buffer.push(entry);

    // Notify all listeners with the full entry
    for (const callback of this.listeners) {
      try {
        callback(line, entry.id, stream);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Append multiple lines at once.
   */
  appendMultiple(lines: string[]): void {
    for (const line of lines) {
      this.append(line);
    }
  }

  /**
   * Get all logs as a single string.
   */
  getAll(): string {
    return this.buffer
      .toArray()
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Get the last n lines.
   */
  getTail(lines: number): string {
    return this.buffer
      .getTail(lines)
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Get logs since a timestamp.
   */
  getSince(since: Date): string {
    return this.buffer
      .toArray()
      .filter(entry => entry.timestamp >= since)
      .map(entry => entry.line)
      .join('\n');
  }

  /**
   * Stream logs to a callback.
   * Returns cleanup function.
   */
  stream(callback: ExtendedLogStreamCallback): () => void {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Get number of stored lines.
   */
  getLineCount(): number {
    return this.buffer.getSize();
  }

  /**
   * Get paginated logs for initial load (newest first in reverse order).
   * Returns entries in chronological order (oldest to newest) for display.
   */
  getPaginated(limit: number = 100, beforeCursor?: string): PaginatedLogsResult {
    const entries = beforeCursor
      ? this.buffer.getBefore(beforeCursor, limit, entry => entry.id)
      : this.buffer.getNewest(limit);

    const structuredEntries: StructuredLogEntry[] = entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      line: entry.line,
      stream: entry.stream,
    }));

    // Check if there are more entries before the oldest one we returned
    const allEntries = this.buffer.toArray();
    const oldestReturned = entries[0];
    const hasMore = oldestReturned
      ? allEntries.findIndex(e => e.id === oldestReturned.id) > 0
      : false;

    return {
      entries: structuredEntries,
      hasMore,
      oldestCursor: structuredEntries[0]?.id ?? null,
      newestCursor: structuredEntries[structuredEntries.length - 1]?.id ?? null,
    };
  }

  /**
   * Get all entries as structured objects.
   */
  getAllStructured(): StructuredLogEntry[] {
    return this.buffer.toArray().map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      line: entry.line,
      stream: entry.stream,
    }));
  }
}
