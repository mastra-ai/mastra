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

interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  duplicatesRemoved: number;
  message: string;
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

    const processResult = await migrationProcess;

    // Try to parse the JSON result from stdout
    let result: MigrationResult | undefined;
    try {
      // Find the last JSON object in the output (in case there's other output)
      const jsonMatch = stdoutData.match(/\{[^{}]*"success"[^{}]*\}/g);
      if (jsonMatch && jsonMatch.length > 0) {
        result = JSON.parse(jsonMatch[jsonMatch.length - 1]!);
      }
    } catch {
      // If we can't parse JSON, the migration likely failed
    }

    if (result) {
      if (result.success) {
        if (result.alreadyMigrated) {
          logger.info(pc.green('✓ Migration already complete.'));
        } else {
          logger.info(pc.green('✓ Migration completed successfully!'));
          if (result.duplicatesRemoved > 0) {
            logger.info('Removed duplicate entries', { count: result.duplicatesRemoved });
          }
        }
        logger.info(result.message);
      } else {
        logger.error(pc.red('✗ Migration failed.'));
        logger.error(result.message);
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
