import pc from 'picocolors';
import { analytics, origin } from '../..';
import { logger } from '../../utils/logger';

interface MigrateArgs {
  host?: string;
  port?: string;
}

interface MigrationResponse {
  success: boolean;
  alreadyMigrated: boolean;
  duplicatesRemoved: number;
  message: string;
}

interface MigrationStatusResponse {
  needsMigration: boolean;
  hasDuplicates: boolean;
  duplicateCount: number;
  constraintExists: boolean;
  tableName: string;
}

export const migrate = async (args: MigrateArgs) => {
  analytics.trackCommand({
    command: 'migrate',
    origin,
  });

  const host = args?.host || 'localhost';
  const port = args?.port || '4111';
  const baseUrl = `http://${host}:${port}`;

  logger.info(pc.cyan('Mastra Spans Migration'));
  logger.info('');

  // First, check the migration status
  logger.info('Checking migration status...');

  try {
    const statusResponse = await fetch(`${baseUrl}/api/system/migrate/status`);

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        logger.error(pc.red('Error: Migration endpoint not found.'));
        logger.info('');
        logger.info('Make sure you are running a Mastra server with the latest version.');
        logger.info(`Expected server at: ${baseUrl}`);
        logger.info('');
        logger.info('To start the dev server:');
        logger.info(pc.cyan('  npx mastra dev'));
        process.exit(1);
      }
      throw new Error(`Server returned status ${statusResponse.status}`);
    }

    const status: MigrationStatusResponse = await statusResponse.json();

    if (!status.needsMigration) {
      logger.info(pc.green('✓ No migration needed. Your database is up to date.'));
      logger.info(`  Table: ${status.tableName}`);
      logger.info(`  Constraint exists: ${status.constraintExists}`);
      return;
    }

    logger.info(pc.yellow('Migration required:'));
    logger.info(`  Table: ${status.tableName}`);
    logger.info(`  Duplicate entries: ${status.duplicateCount}`);
    logger.info('');

    // Run the migration
    logger.info('Running migration...');
    logger.info(pc.dim('This may take a while for large tables.'));
    logger.info('');

    const migrateResponse = await fetch(`${baseUrl}/api/system/migrate`, {
      method: 'POST',
    });

    if (!migrateResponse.ok) {
      throw new Error(`Migration failed with status ${migrateResponse.status}`);
    }

    const result: MigrationResponse = await migrateResponse.json();

    if (result.success) {
      if (result.alreadyMigrated) {
        logger.info(pc.green('✓ Migration already complete.'));
      } else {
        logger.info(pc.green('✓ Migration completed successfully!'));
        if (result.duplicatesRemoved > 0) {
          logger.info(`  Removed ${result.duplicatesRemoved} duplicate entries.`);
        }
      }
      logger.info(`  ${result.message}`);
    } else {
      logger.error(pc.red('✗ Migration failed.'));
      logger.error(`  ${result.message}`);
      process.exit(1);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      logger.error(pc.red('Error: Could not connect to Mastra server.'));
      logger.info('');
      logger.info('The migration command requires a running Mastra server.');
      logger.info(`Expected server at: ${baseUrl}`);
      logger.info('');
      logger.info('To start the dev server:');
      logger.info(pc.cyan('  npx mastra dev'));
      logger.info('');
      logger.info('Then run the migration again:');
      logger.info(pc.cyan('  npx mastra migrate'));
      logger.info('');
      logger.info('Or specify a custom host/port:');
      logger.info(pc.cyan('  npx mastra migrate --host localhost --port 4111'));
    } else {
      logger.error(pc.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
};
