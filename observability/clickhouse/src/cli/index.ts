#!/usr/bin/env node
/**
 * CLI for @mastra/observability-clickhouse
 */

import { Command } from 'commander';
import { ingestCommand } from './commands/ingest.js';
import { migrateCommand } from './commands/migrate.js';

const program = new Command();

program
  .name('mastra-observability-clickhouse')
  .description('ClickHouse ingestion worker and utilities for MastraAdmin observability')
  .version('0.0.1');

program.addCommand(ingestCommand);
program.addCommand(migrateCommand);

program.parse(process.argv);
