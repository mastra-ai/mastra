/**
 * Ingest command - runs the ingestion worker
 */

import { Command } from 'commander';
import { IngestionWorker } from '../../ingestion/worker.js';

export const ingestCommand = new Command('ingest')
  .description('Run the ingestion worker to process JSONL files into ClickHouse')
  .requiredOption('--clickhouse-url <url>', 'ClickHouse server URL (e.g., http://localhost:8123)')
  .option('--clickhouse-username <username>', 'ClickHouse username', 'default')
  .option('--clickhouse-password <password>', 'ClickHouse password', '')
  .option('--clickhouse-database <database>', 'ClickHouse database name')
  .requiredOption('--file-storage-type <type>', 'File storage type (local)', 'local')
  .option('--file-storage-path <path>', 'Base path for file storage (required for local)')
  .option('--base-path <path>', 'Base path within file storage for observability files', 'observability')
  .option('--poll-interval <ms>', 'Poll interval in milliseconds', '10000')
  .option('--batch-size <count>', 'Number of files to process per batch', '10')
  .option('--delete-after-process', 'Delete files after processing instead of moving to processed/')
  .option('--project-id <id>', 'Only process files for a specific project')
  .option('--once', 'Process files once and exit (for cron-based execution)')
  .option('--debug', 'Enable debug logging')
  .action(async options => {
    try {
      // Validate file storage options
      if (options.fileStorageType === 'local' && !options.fileStoragePath) {
        console.error('Error: --file-storage-path is required when --file-storage-type is local');
        process.exit(1);
      }

      // Create file storage
      let fileStorage;
      if (options.fileStorageType === 'local') {
        const { LocalFileStorage } = await import('@mastra/observability-file-local');
        fileStorage = new LocalFileStorage({
          baseDir: options.fileStoragePath,
        });
      } else {
        console.error(`Error: Unsupported file storage type: ${options.fileStorageType}`);
        process.exit(1);
      }

      // Create worker
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: {
          url: options.clickhouseUrl,
          username: options.clickhouseUsername,
          password: options.clickhousePassword,
          database: options.clickhouseDatabase,
        },
        basePath: options.basePath,
        pollIntervalMs: parseInt(options.pollInterval, 10),
        batchSize: parseInt(options.batchSize, 10),
        deleteAfterProcess: options.deleteAfterProcess ?? false,
        projectId: options.projectId,
        debug: options.debug ?? false,
      });

      // Initialize (run migrations)
      console.info('Initializing ClickHouse schema...');
      await worker.init();
      console.info('Schema initialized');

      if (options.once) {
        // Process once and exit
        console.info('Processing files once...');
        const result = await worker.processOnce();
        console.info(`Processed ${result.filesProcessed} files, ${result.eventsIngested} events`);
        if (result.errors.length > 0) {
          console.error(`Errors: ${result.errors.length}`);
          for (const error of result.errors) {
            console.error(`  - ${error.filePath}: ${error.message}`);
          }
        }
        process.exit(result.errors.length > 0 ? 1 : 0);
      } else {
        // Run continuously
        console.info('Starting ingestion worker...');
        console.info(`  ClickHouse URL: ${options.clickhouseUrl}`);
        console.info(`  File storage: ${options.fileStorageType} (${options.fileStoragePath || 'n/a'})`);
        console.info(`  Poll interval: ${options.pollInterval}ms`);
        console.info(`  Batch size: ${options.batchSize}`);

        // Handle shutdown signals
        const shutdown = async () => {
          console.info('\nShutting down...');
          await worker.stop();
          const status = worker.getStatus();
          console.info(`Total files processed: ${status.totalFilesProcessed}`);
          console.info(`Total events ingested: ${status.totalEventsIngested}`);
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        await worker.start();

        // Keep the process running
        await new Promise(() => {}); // Never resolves
      }
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  });
