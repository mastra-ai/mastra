import * as path from 'node:path';

import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';

import type { ChangeEvent, LocalProjectSource } from './types';

/**
 * Options for the file watcher.
 */
export interface WatcherOptions {
  /**
   * Debounce interval for events (ms).
   * @default 300
   */
  debounceMs?: number;

  /**
   * Patterns to ignore when watching.
   */
  ignored?: (string | RegExp)[];

  /**
   * Use polling instead of native events.
   * Useful for network mounts or containers.
   * @default false
   */
  usePolling?: boolean;

  /**
   * Polling interval (ms) when usePolling is true.
   * @default 1000
   */
  pollInterval?: number;
}

/**
 * Default patterns to ignore when watching.
 */
const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.log',
];

/**
 * Watches for file changes in a project directory.
 */
export class ProjectWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: Map<string, ChangeEvent> = new Map();

  constructor(private readonly options: WatcherOptions = {}) {}

  /**
   * Start watching a project for file changes.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watch(source: LocalProjectSource, callback: (event: ChangeEvent) => void): () => void {
    const { debounceMs = 300, ignored = [], usePolling = false, pollInterval = 1000 } = this.options;

    // Combine default ignored patterns with custom ones
    const allIgnored = [...DEFAULT_IGNORED, ...ignored];

    this.watcher = chokidar.watch(source.path, {
      ignored: allIgnored,
      persistent: true,
      ignoreInitial: true,
      usePolling,
      interval: pollInterval,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    // Handler for file events
    const handleEvent = (eventType: 'add' | 'change' | 'unlink', filePath: string) => {
      const relativePath = path.relative(source.path, filePath);

      // Skip if the file is in ignored directories (double check)
      if (this.shouldIgnore(relativePath)) {
        return;
      }

      const event: ChangeEvent = {
        type: eventType,
        path: relativePath,
        timestamp: new Date(),
      };

      // Use the file path as key to dedupe rapid events on the same file
      this.pendingEvents.set(relativePath, event);

      // Debounce: collect events and emit them after the debounce period
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        // Emit all pending events
        for (const pendingEvent of this.pendingEvents.values()) {
          callback(pendingEvent);
        }
        this.pendingEvents.clear();
      }, debounceMs);
    };

    this.watcher
      .on('add', filePath => handleEvent('add', filePath))
      .on('change', filePath => handleEvent('change', filePath))
      .on('unlink', filePath => handleEvent('unlink', filePath));

    // Return cleanup function
    return () => {
      this.stop();
    };
  }

  /**
   * Stop watching.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }

    this.pendingEvents.clear();
  }

  /**
   * Check if a path should be ignored.
   */
  private shouldIgnore(relativePath: string): boolean {
    const segments = relativePath.split(path.sep);
    return segments.some(segment => ['node_modules', '.git', 'dist', 'build', '.next', '.turbo'].includes(segment));
  }
}
