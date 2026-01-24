/**
 * Ingestion worker for processing JSONL files into ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { getProcessedFilePath } from '@mastra/observability-writer';
import { runMigrations } from '../schema/migrations.js';
import type {
  IngestionWorkerConfig,
  ProcessingResult,
  ProcessingError,
  WorkerStatus,
  FileStorageProvider,
} from '../types.js';
import { bulkInsert } from './bulk-inserter.js';
import { processFile, listPendingFiles } from './file-processor.js';

/**
 * Default configuration values
 */
const DEFAULT_POLL_INTERVAL_MS = 10000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_INSERT_BATCH_SIZE = 10000;
const DEFAULT_BASE_PATH = 'observability';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * IngestionWorker continuously polls file storage for new JSONL files
 * and ingests them into ClickHouse.
 */
export class IngestionWorker {
  private readonly fileStorage: FileStorageProvider;
  private readonly client: ClickHouseClient;
  private readonly config: Required<
    Omit<IngestionWorkerConfig, 'fileStorage' | 'clickhouse' | 'projectId'> & {
      projectId: string | undefined;
    }
  >;

  private isRunning = false;
  private isProcessing = false;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  // Statistics
  private startedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalFilesProcessed = 0;
  private totalEventsIngested = 0;
  private totalEventsByType: Record<string, number> = {};
  private currentErrors: ProcessingError[] = [];

  constructor(config: IngestionWorkerConfig) {
    this.fileStorage = config.fileStorage;

    // Create or use provided ClickHouse client
    if ('client' in config.clickhouse) {
      this.client = config.clickhouse.client;
    } else {
      this.client = createClient({
        url: config.clickhouse.url,
        username: config.clickhouse.username,
        password: config.clickhouse.password,
        database: config.clickhouse.database,
        ...config.clickhouse.options,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
        },
      });
    }

    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      insertBatchSize: config.insertBatchSize ?? DEFAULT_INSERT_BATCH_SIZE,
      basePath: config.basePath ?? DEFAULT_BASE_PATH,
      deleteAfterProcess: config.deleteAfterProcess ?? false,
      retryAttempts: config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
      retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      projectId: config.projectId,
      debug: config.debug ?? false,
    };
  }

  /**
   * Initialize the worker (run migrations).
   */
  async init(): Promise<void> {
    await runMigrations(this.client);
  }

  /**
   * Start the worker. It will continuously poll for files.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startedAt = new Date();
    this.currentErrors = [];

    if (this.config.debug) {
      console.info('[IngestionWorker] Starting...');
    }

    // Start the poll loop
    this.schedulePoll();
  }

  /**
   * Stop the worker gracefully.
   * Waits for any in-progress processing to complete.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.config.debug) {
      console.info('[IngestionWorker] Stopping...');
    }

    this.isRunning = false;

    // Clear any pending poll
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Wait for in-progress processing
    if (this.isProcessing && !this.shutdownPromise) {
      this.shutdownPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isProcessing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    if (this.shutdownPromise) {
      await this.shutdownPromise;
    }

    if (this.config.debug) {
      console.info('[IngestionWorker] Stopped');
    }
  }

  /**
   * Process files once (for manual/cron-based execution).
   */
  async processOnce(): Promise<ProcessingResult> {
    return this.runProcessingCycle();
  }

  /**
   * Get current worker status.
   */
  getStatus(): WorkerStatus {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      lastProcessedAt: this.lastProcessedAt,
      totalFilesProcessed: this.totalFilesProcessed,
      totalEventsIngested: this.totalEventsIngested,
      totalEventsByType: { ...this.totalEventsByType },
      currentErrors: [...this.currentErrors],
      startedAt: this.startedAt,
    };
  }

  /**
   * Schedule the next poll.
   */
  private schedulePoll(): void {
    if (!this.isRunning) {
      return;
    }

    this.pollTimeout = setTimeout(async () => {
      try {
        await this.runProcessingCycle();
      } catch (error) {
        if (this.config.debug) {
          console.error('[IngestionWorker] Processing cycle error:', error);
        }
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Run a single processing cycle.
   */
  private async runProcessingCycle(): Promise<ProcessingResult> {
    if (this.isProcessing) {
      return {
        filesProcessed: 0,
        eventsIngested: 0,
        eventsByType: {},
        errors: [],
        durationMs: 0,
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const result: ProcessingResult = {
      filesProcessed: 0,
      eventsIngested: 0,
      eventsByType: {},
      errors: [],
      durationMs: 0,
    };

    try {
      // List pending files
      const files = await listPendingFiles(this.fileStorage, this.config.basePath, {
        projectId: this.config.projectId,
        limit: this.config.batchSize,
      });

      if (files.length === 0) {
        if (this.config.debug) {
          console.info('[IngestionWorker] No pending files');
        }
        return result;
      }

      if (this.config.debug) {
        console.info(`[IngestionWorker] Found ${files.length} pending files`);
      }

      // Process each file
      for (const filePath of files) {
        await this.processFileWithRetry(filePath, result);
      }

      // Update statistics
      this.totalFilesProcessed += result.filesProcessed;
      this.totalEventsIngested += result.eventsIngested;
      for (const [type, count] of Object.entries(result.eventsByType)) {
        this.totalEventsByType[type] = (this.totalEventsByType[type] || 0) + count;
      }
      this.lastProcessedAt = new Date();

      // Clear errors on successful processing
      if (result.errors.length === 0) {
        this.currentErrors = [];
      } else {
        this.currentErrors = result.errors;
      }
    } finally {
      this.isProcessing = false;
      result.durationMs = Date.now() - startTime;
    }

    if (this.config.debug) {
      console.info(
        `[IngestionWorker] Processed ${result.filesProcessed} files, ` +
          `${result.eventsIngested} events in ${result.durationMs}ms`,
      );
    }

    return result;
  }

  /**
   * Process a single file with retry logic.
   */
  private async processFileWithRetry(filePath: string, result: ProcessingResult): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        // Process the file
        const fileResult = await processFile(this.fileStorage, filePath);

        if (fileResult.errors.length > 0 && this.config.debug) {
          console.warn(`[IngestionWorker] ${fileResult.errors.length} parse errors in ${filePath}`);
        }

        if (fileResult.events.length > 0) {
          // Insert events into ClickHouse
          const { insertedByType } = await bulkInsert(
            this.client,
            fileResult.events.map(e => ({ type: e.type, data: e.data })),
          );

          result.eventsIngested += fileResult.events.length;
          for (const [type, count] of Object.entries(insertedByType)) {
            result.eventsByType[type] = (result.eventsByType[type] || 0) + count;
          }
        }

        // Move or delete the file
        if (this.config.deleteAfterProcess) {
          await this.fileStorage.delete(filePath);
        } else {
          const processedPath = getProcessedFilePath(filePath);
          await this.fileStorage.move(filePath, processedPath);
        }

        result.filesProcessed += 1;
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts - 1) {
          if (this.config.debug) {
            console.warn(`[IngestionWorker] Retry ${attempt + 1}/${this.config.retryAttempts} for ${filePath}`);
          }
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    // All retries failed
    result.errors.push({
      filePath,
      message: lastError?.message || 'Unknown error',
      error: lastError || new Error('Unknown error'),
      retryCount: this.config.retryAttempts,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
