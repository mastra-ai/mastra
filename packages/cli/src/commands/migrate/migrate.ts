import { join } from 'node:path';
import process from 'node:process';
import { FileService } from '@mastra/deployer';
import { execa } from 'execa';
import pc from 'picocolors';

import { createLogger } from '../../utils/logger.js';

import { MigrateBundler } from './MigrateBundler';

interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  duplicatesRemoved: number;
  message: string;
}

export async function migrate({
  dir,
  root,
  env,
  debug,
}: {
  dir?: string;
  root?: string;
  env?: string;
  debug: boolean;
}) {
  const logger = createLogger(debug);
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : join(process.cwd(), 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  logger.info(pc.cyan('Mastra Spans Migration'));
  logger.info('');

  try {
    const fileService = new FileService();
    const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

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
            logger.info(`  Removed ${result.duplicatesRemoved} duplicate entries.`);
          }
        }
        logger.info(`  ${result.message}`);
      } else {
        logger.error(pc.red('✗ Migration failed.'));
        logger.error(`  ${result.message}`);
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
      logger.info('Make sure you have a mastra directory with an index.ts or index.js file.');
      logger.info(`Expected location: ${mastraDir}`);
      logger.info('');
      logger.info('You can specify a custom directory:');
      logger.info(pc.cyan('  npx mastra migrate --dir path/to/mastra'));
    } else {
      logger.error(pc.red(`Error: ${error.message}`));
      if (debug) {
        logger.error(error);
      }
    }
    process.exit(1);
  }
}
