#!/usr/bin/env node
/**
 * CLI entry point for @mastra/observability-clickhouse.
 *
 * Provides commands for:
 * - migrate: Run ClickHouse schema migrations
 * - ingest: Start or run the ingestion worker
 */

import { Command } from 'commander';

const program = new Command();

program
  .name('mastra-observability-clickhouse')
  .description('ClickHouse tools for MastraAdmin observability')
  .version('0.0.1');

// Placeholder commands - will be implemented in later phases
program
  .command('migrate')
  .description('Run ClickHouse schema migrations')
  .action(() => {
    console.info('Migration command - to be implemented');
  });

program
  .command('ingest')
  .description('Start the ingestion worker')
  .action(() => {
    console.info('Ingest command - to be implemented');
  });

program.parse();
