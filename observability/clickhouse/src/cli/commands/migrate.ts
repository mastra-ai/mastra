/**
 * Migrate command - runs schema migrations
 */

import { createClient } from '@clickhouse/client';
import { Command } from 'commander';

import { runMigrations, checkSchemaStatus } from '../../schema/migrations.js';

export const migrateCommand = new Command('migrate')
  .description('Run ClickHouse schema migrations')
  .requiredOption('--clickhouse-url <url>', 'ClickHouse server URL (e.g., http://localhost:8123)')
  .option('--clickhouse-username <username>', 'ClickHouse username', 'default')
  .option('--clickhouse-password <password>', 'ClickHouse password', '')
  .option('--clickhouse-database <database>', 'ClickHouse database name')
  .option('--check', 'Only check migration status, do not run migrations')
  .action(async options => {
    try {
      const client = createClient({
        url: options.clickhouseUrl,
        username: options.clickhouseUsername,
        password: options.clickhousePassword,
        database: options.clickhouseDatabase,
      });

      if (options.check) {
        console.info('Checking schema status...');
        const status = await checkSchemaStatus(client);

        if (status.isInitialized) {
          console.info('Schema is up to date');
        } else {
          console.info('Schema needs migration');
          if (status.missingTables.length > 0) {
            console.info(`  Missing tables: ${status.missingTables.join(', ')}`);
          }
          if (status.missingViews.length > 0) {
            console.info(`  Missing views: ${status.missingViews.join(', ')}`);
          }
        }

        await client.close();
        process.exit(status.isInitialized ? 0 : 1);
      }

      console.info('Running migrations...');
      await runMigrations(client);
      console.info('Migrations complete');

      await client.close();
      process.exit(0);
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
  });
