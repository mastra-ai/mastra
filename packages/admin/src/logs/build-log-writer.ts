import type { FileStorageProvider } from '../file-storage';

/**
 * Configuration for BuildLogWriter.
 */
export interface BuildLogWriterConfig {
  /** File storage provider for persisting logs */
  fileStorage: FileStorageProvider;
  /** Base path for build logs. @default 'builds' */
  basePath?: string;
}

/**
 * Writes build logs to file storage.
 * Buffers logs in memory during build, flushes to storage on completion.
 */
export class BuildLogWriter {
  private readonly fileStorage: FileStorageProvider;
  private readonly basePath: string;
  private readonly buffers: Map<string, string[]> = new Map();

  constructor(config: BuildLogWriterConfig) {
    this.fileStorage = config.fileStorage;
    this.basePath = config.basePath ?? 'builds';
  }

  /**
   * Append a log line (buffered in memory).
   * Call flush() when build completes.
   */
  append(buildId: string, line: string): void {
    if (!this.buffers.has(buildId)) {
      this.buffers.set(buildId, []);
    }
    this.buffers.get(buildId)!.push(line);
  }

  /**
   * Get buffered logs for a build (before flush).
   * Used to return in-progress logs via API.
   */
  getBuffered(buildId: string): string {
    const lines = this.buffers.get(buildId) ?? [];
    return lines.join('\n');
  }

  /**
   * Flush all buffered logs to file storage.
   * Call this when build completes (success or failure).
   *
   * @returns Path to the stored log file
   */
  async flush(buildId: string): Promise<string> {
    const lines = this.buffers.get(buildId) ?? [];
    const content = lines.join('\n');

    const path = `${this.basePath}/${buildId}/build.log`;
    await this.fileStorage.write(path, content);

    // Clear buffer
    this.buffers.delete(buildId);

    return path;
  }

  /**
   * Read complete build log from file storage.
   */
  async read(buildId: string): Promise<string> {
    const path = `${this.basePath}/${buildId}/build.log`;
    const content = await this.fileStorage.read(path);
    return content.toString('utf-8');
  }

  /**
   * Check if build log exists in file storage.
   */
  async exists(buildId: string): Promise<boolean> {
    const path = `${this.basePath}/${buildId}/build.log`;
    return this.fileStorage.exists(path);
  }

  /**
   * Delete build logs (for retention policy).
   */
  async delete(buildId: string): Promise<void> {
    const prefix = `${this.basePath}/${buildId}`;
    // Delete entire build directory
    const files = await this.fileStorage.list(prefix);
    for (const file of files) {
      await this.fileStorage.delete(file.path);
    }
  }
}
