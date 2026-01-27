/**
 * Timestamped log entry.
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  line: string;
  stream: 'stdout' | 'stderr';
}

/**
 * Circular buffer for efficient log retention.
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer.
   * Overwrites oldest item if at capacity.
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in order (oldest first).
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]!);
    }
    return result;
  }

  /**
   * Get the last n items (newest).
   */
  getTail(n: number): T[] {
    const count = Math.min(n, this.size);
    const result: T[] = [];
    for (let i = this.size - count; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]!);
    }
    return result;
  }

  /**
   * Get current size.
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Get items before a cursor (older items), returns in chronological order.
   * Used for "load more" when scrolling up.
   */
  getBefore(cursorId: string, limit: number, getId: (item: T) => string): T[] {
    const all = this.toArray();
    const cursorIndex = all.findIndex(item => getId(item) === cursorId);
    if (cursorIndex === -1) {
      // Cursor not found, return from the start
      return all.slice(0, limit);
    }
    // Get items before the cursor
    const startIndex = Math.max(0, cursorIndex - limit);
    return all.slice(startIndex, cursorIndex);
  }

  /**
   * Get the newest items (for initial load), returns in chronological order.
   * Used for initial page load.
   */
  getNewest(limit: number): T[] {
    return this.getTail(limit);
  }
}
