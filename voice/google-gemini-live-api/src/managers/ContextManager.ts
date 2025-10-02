export interface ContextEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ContextConfig {
  maxEntries?: number;
  maxContentLength?: number;
  compressionThreshold?: number;
  compressionEnabled?: boolean;
}

export class ContextManager {
  private contextHistory: ContextEntry[] = [];
  private readonly maxEntries: number;
  private readonly maxContentLength: number;
  private readonly compressionThreshold: number;
  private compressionEnabled: boolean;

  constructor(config: ContextConfig = {}) {
    this.maxEntries = config.maxEntries || 100;
    this.maxContentLength = config.maxContentLength || 10000; // 10KB per entry
    this.compressionThreshold = config.compressionThreshold || 50;
    this.compressionEnabled = config.compressionEnabled ?? false;
  }

  /**
   * Add entry to context history
   */
  addEntry(role: 'user' | 'assistant', content: string): void {
    // Validate content length
    let processedContent = content;
    if (content.length > this.maxContentLength) {
      processedContent = content.substring(0, this.maxContentLength) + '...';
    }

    const entry: ContextEntry = {
      role,
      content: processedContent,
      timestamp: Date.now(),
    };

    this.contextHistory.push(entry);

    if (this.contextHistory.length > this.maxEntries) {
      if (this.compressionEnabled) {
        this.compressContext();
      } else {
        this.contextHistory = this.contextHistory.slice(-this.maxEntries);
      }
    }
  }

  /**
   * Get context history
   */
  getContextHistory(): ContextEntry[] {
    return [...this.contextHistory];
  }

  /**
   * Get context history as array of role/content pairs
   */
  getContextArray(): Array<{ role: string; content: string }> {
    return this.contextHistory.map(entry => ({
      role: entry.role,
      content: entry.content,
    }));
  }

  /**
   * Clear context history
   */
  clearContext(): void {
    this.contextHistory = [];
  }

  /**
   * Get context size
   */
  getContextSize(): number {
    return this.contextHistory.length;
  }

  /**
   * Compress context when it exceeds threshold
   */
  private compressContext(): void {
    if (!this.compressionEnabled || this.contextHistory.length <= this.compressionThreshold) {
      return;
    }

    // Keep first and last entries, compress middle ones
    const keepCount = Math.floor(this.compressionThreshold / 3);
    const firstEntries = this.contextHistory.slice(0, keepCount);
    const lastEntries = this.contextHistory.slice(-keepCount);

    // Create compressed middle entry
    const middleEntries = this.contextHistory.slice(keepCount, -keepCount);
    if (middleEntries.length > 0) {
      const compressedEntry: ContextEntry = {
        role: 'assistant',
        content: `[Compressed ${middleEntries.length} previous messages]`,
        timestamp: Date.now(),
      };

      this.contextHistory = [...firstEntries, compressedEntry, ...lastEntries];
    } else {
      this.contextHistory = [...firstEntries, ...lastEntries];
    }
  }

  /**
   * Enable or disable compression at runtime
   */
  setCompressionEnabled(enabled: boolean): void {
    this.compressionEnabled = enabled;
  }

  /**
   * Get context summary
   */
  getContextSummary(): {
    totalEntries: number;
    userEntries: number;
    assistantEntries: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    if (this.contextHistory.length === 0) {
      return {
        totalEntries: 0,
        userEntries: 0,
        assistantEntries: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const userEntries = this.contextHistory.filter(entry => entry.role === 'user').length;
    const assistantEntries = this.contextHistory.filter(entry => entry.role === 'assistant').length;
    const timestamps = this.contextHistory.map(entry => entry.timestamp);

    return {
      totalEntries: this.contextHistory.length,
      userEntries,
      assistantEntries,
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
    };
  }

  /**
   * Search context for specific content
   */
  searchContext(query: string, role?: 'user' | 'assistant'): ContextEntry[] {
    const searchQuery = query.toLowerCase();

    return this.contextHistory.filter(entry => {
      const matchesRole = role ? entry.role === role : true;
      const matchesContent = entry.content.toLowerCase().includes(searchQuery);

      return matchesRole && matchesContent;
    });
  }

  /**
   * Get recent context entries
   */
  getRecentEntries(count: number): ContextEntry[] {
    return this.contextHistory.slice(-count);
  }

  /**
   * Get context entries by role
   */
  getEntriesByRole(role: 'user' | 'assistant'): ContextEntry[] {
    return this.contextHistory.filter(entry => entry.role === role);
  }
}
