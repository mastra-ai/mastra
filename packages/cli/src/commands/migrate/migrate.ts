import { join, relative } from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import { execa } from 'execa';
import pc from 'picocolors';

import { createLogger } from '../../utils/logger.js';

import {
  findMastraEntryCandidates,
  resolveMigrateEntryFile,
  resolveMigratePaths,
  toDetectedProjectRoot,
} from './migrate-paths';
import { MigrateBundler } from './MigrateBundler';

interface StorageResult {
  skipped: boolean;
  success?: boolean;
  alreadyMigrated?: boolean;
  duplicatesRemoved?: number;
  message?: string;
}

interface AuthSyncResult {
  skipped: boolean;
  success?: boolean;
  message?: string;
  permissions?: { created: string[]; updated: string[]; unchanged: string[]; errors: string[] } | null;
  roles?: { created: string[]; updated: string[]; unchanged: string[]; errors: string[] } | null;
}

interface MigrationResult {
  success: boolean;
  storage: StorageResult;
  auth: AuthSyncResult;
}

function quoteShellArg(value: string): string {
  return `"${value.replace(/(["\\$`])/gu, '\\$1')}"`;
}

export async function migrate({
  dir,
  root,
  env,
  debug,
  yes,
}: {
  dir?: string;
  root?: string;
  env?: string;
  debug: boolean;
  yes: boolean;
}) {
  const logger = createLogger(debug);
  const { rootDir, mastraDir } = resolveMigratePaths({
    cwd: process.cwd(),
    root,
    dir,
  });
  const { checkedPaths, entryFile } = resolveMigrateEntryFile(mastraDir);
  const dotMastraPath = join(rootDir, '.mastra');

  if (!entryFile) {
    logger.error(pc.red('Error: Could not find Mastra entry file.'));
    logger.info('');
    logger.info('Expected one of the following files:');
    checkedPaths.forEach(path => logger.info(`  - ${path}`));
    logger.info('');
    logger.info('This command requires a Mastra entrypoint (src/mastra/index.ts or index.js).');
    logger.info('If your project is in a custom location (for example in a monorepo), run:');
    logger.info(pc.cyan('  npx mastra migrate --dir <path/to/src/mastra> --root <path/to/project-root>'));
    logger.info(pc.cyan('  pnpm exec mastra migrate --dir <path/to/src/mastra> --root <path/to/project-root>'));

    const candidates = findMastraEntryCandidates(rootDir, 5);
    if (candidates.length > 0) {
      logger.info('');
      logger.info('Detected candidate entrypoints under the selected root:');
      for (const candidate of candidates) {
        const rootBase = toDetectedProjectRoot(candidate);
        const suggestedDir = relative(rootBase, candidate).replace(/[\\/]index\.(ts|js)$/u, '');
        const suggestedRoot = relative(process.cwd(), rootBase) || '.';
        logger.info(`  - ${candidate}`);
        logger.info(
          pc.dim(
            `    Example: npx mastra migrate --dir ${quoteShellArg(suggestedDir)} --root ${quoteShellArg(suggestedRoot)}`,
          ),
        );
      }
    }

    process.exit(1);
  }

  p.intro(pc.cyan('Mastra Storage Migration'));

  // Show backup warning and ask for confirmation (unless --yes flag is used)
  if (!yes) {
    p.log.warn(pc.yellow('Warning: This migration will modify your database.'));
    p.log.message('Before proceeding, please ensure you have:');
    p.log.message('  • Created a backup of your database');
    p.log.message('  • Tested this migration in a non-production environment');

    const confirmed = await p.confirm({
      message: 'Have you backed up your database and are ready to proceed?',
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.log.info('Migration cancelled. Please back up your database before running this command.');
      p.log.message(pc.dim('Tip: Use --yes or -y to skip this prompt in CI/automation.'));
      process.exit(0);
    }
  }

  try {
    const bundler = new MigrateBundler(env);
    bundler.__setLogger(logger);

    logger.info('Building project for migration...');

    // Prepare the output directory
    await bundler.prepare(dotMastraPath);

    // Bundle the project with migration entry
    const discoveredTools = bundler.getAllToolPaths(mastraDir, []);
    await bundler.bundle(entryFile, dotMastraPath, {
      toolsPaths: discoveredTools,
      projectRoot: rootDir,
    });

    logger.info('Running migration...');
    logger.info(pc.dim('This may take a while for large tables.'));
    logger.info('');

    // Load environment variables
    const loadedEnv = await bundler.loadEnvVars();

    // Execute the bundled migration script
    const migrationProcess = execa(process.execPath, [join(dotMastraPath, 'output', 'index.mjs')], {
      cwd: rootDir,
      env: {
        ...process.env, // Inherit current environment (PATH, etc.)
        NODE_ENV: 'production',
        MASTRA_DISABLE_STORAGE_INIT: 'true', // Prevent MIGRATION_REQUIRED error during import
        ...Object.fromEntries(loadedEnv),
      },
      stdio: ['inherit', 'pipe', 'pipe'],
      reject: false,
    });

    let stdoutData = '';
    let stderrData = '';

    migrationProcess.stdout?.on('data', (data: Buffer) => {
      stdoutData += data.toString();
    });

    migrationProcess.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString();
      // Print stderr to console for debugging
      if (debug) {
        process.stderr.write(data);
      }
    });

    if (debug) {
      logger.debug('Waiting for migration process to complete...');
    }

    const processResult = await migrationProcess;

    if (debug) {
      logger.debug(`Migration process exited with code ${processResult.exitCode}`);
      logger.debug(`stdout: ${stdoutData.slice(0, 500)}`);
      logger.debug(`stderr: ${stderrData.slice(0, 500)}`);
    }

    // Try to parse the JSON result from stdout
    let result: MigrationResult | undefined;
    try {
      // Find the JSON object starting with {"success" - the migration output starts with this pattern
      // We parse from the first { that's followed by "success" to handle any prefix logs
      const jsonStartIndex = stdoutData.indexOf('{"success"');
      if (jsonStartIndex !== -1) {
        result = JSON.parse(stdoutData.slice(jsonStartIndex));
      }
    } catch {
      // If we can't parse JSON, the migration likely failed
      if (debug) {
        logger.debug(`Failed to parse migration result JSON: ${stdoutData.slice(0, 200)}`);
      }
    }

    if (result) {
      // Report storage migration results
      if (result.storage) {
        if (result.storage.skipped) {
          logger.info(pc.dim(`Storage: ${result.storage.message || 'Skipped'}`));
        } else if (result.storage.success) {
          if (result.storage.alreadyMigrated) {
            logger.info(pc.green('✓ Storage: Already migrated'));
          } else {
            logger.info(pc.green('✓ Storage: Migration completed'));
            if (result.storage.duplicatesRemoved && result.storage.duplicatesRemoved > 0) {
              logger.info(`  Removed ${result.storage.duplicatesRemoved} duplicate entries`);
            }
          }
        } else {
          logger.error(pc.red(`✗ Storage: ${result.storage.message || 'Failed'}`));
        }
      }

      // Report auth sync results
      if (result.auth) {
        if (result.auth.skipped) {
          logger.info(pc.dim(`Auth: ${result.auth.message || 'Skipped'}`));
        } else if (result.auth.success) {
          logger.info(pc.green('✓ Auth: Sync completed'));
          if (result.auth.permissions) {
            const p = result.auth.permissions;
            logger.info(
              `  Permissions: ${p.created.length} created, ${p.updated.length} updated, ${p.unchanged.length} unchanged`,
            );
          }
          if (result.auth.roles) {
            const r = result.auth.roles;
            logger.info(
              `  Roles: ${r.created.length} created, ${r.updated.length} updated, ${r.unchanged.length} unchanged`,
            );
          }
        } else {
          logger.error(pc.red(`✗ Auth: ${result.auth.message || 'Failed'}`));
        }
      }

      if (!result.success) {
        process.exit(1);
      }
    } else {
      // No JSON result - check if process failed
      if (processResult.exitCode !== 0) {
        logger.error(pc.red('✗ Migration failed.'));
        if (stderrData) {
          logger.error(stderrData);
        }
        if (stdoutData && !stdoutData.includes('"success"')) {
          logger.error(stdoutData);
        }
        process.exit(1);
      } else {
        // Process succeeded but no JSON output - unusual but OK
        logger.info(pc.green('✓ Migration completed.'));
      }
    }
  } catch (error: any) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      logger.error(pc.red('Error: Could not find Mastra entry file.'));
      logger.info('');
      logger.info('Make sure your Mastra directory has an index.ts or index.js file.');
      logger.info('Expected location', { path: mastraDir });
      logger.info('');
      logger.info('You can specify a custom directory:');
      logger.info(pc.cyan('  npx mastra migrate --dir <path/to/src/mastra> --root <path/to/project-root>'));
    } else {
      logger.error(pc.red(`Error: ${error.message}`));
      if (debug) {
        logger.error(error);
      }
    }
    process.exit(1);
  }
}
