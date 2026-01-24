import type { LogStreamCallback } from '@mastra/admin';
import type { LogCollector as ILogCollector } from '../types';
import { RingBuffer  } from './ring-buffer';
import type {LogEntry} from './ring-buffer';

/**
 * Collects and manages logs for a running process.
 */
export class LogCollector implements ILogCollector {
  private readonly buffer: RingBuffer<LogEntry>;
  private readonly listeners: Set<LogStreamCallback> = new Set();

  constructor(maxLines: number = 10000) {
    this.buffer = new RingBuffer<LogEntry>(maxLines);
  }

  /**
   * Append a log line with timestamp.
   */
  append(line: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      line,
    };
    this.buffer.push(entry);

    // Notify all listeners
    for (const callback of this.listeners) {
      try {
        callback(line);
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
  stream(callback: LogStreamCallback): () => void {
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
}
