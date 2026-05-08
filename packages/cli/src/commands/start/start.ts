import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';
import { shouldSkipDotenvLoading } from '../utils';
interface StartOptions {
  dir?: string;
  env?: string;
  customArgs?: string[];
}

export async function start(options: StartOptions = {}) {
  // Load environment variables from .env files
  if (!shouldSkipDotenvLoading()) {
    config({ path: [options.env || '.env.production', '.env'], quiet: true });
  }
  const outputDir = options.dir || '.mastra/output';

  try {
    // Check if the output directory exist
    const outputPath = join(process.cwd(), outputDir);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output directory ${outputPath} does not exist`);
    }

    const commands = [];

    if (options.customArgs) {
      commands.push(...options.customArgs);
    }

    commands.push('index.mjs');

    // Start the server using node
    const server = spawn(process.execPath, commands, {
      cwd: outputPath,
      stdio: ['inherit', 'inherit', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    let stderrBuffer = '';
    server.stderr.on('data', data => {
      stderrBuffer += data.toString();
    });

    server.on('exit', code => {
      if (code !== 0 && stderrBuffer) {
        if (stderrBuffer.includes('ERR_MODULE_NOT_FOUND')) {
          const packageNameMatch = stderrBuffer.match(/Cannot find package '([^']+)'/);
          const packageName = packageNameMatch ? packageNameMatch[1] : null;

          if (!packageName) {
            logger.error(stderrBuffer.trim());
          } else {
            logger.error('Module not found while starting Mastra server', { package: packageName });
          }
        } else {
          logger.error(stderrBuffer.trim());
        }
        process.exit(code);
      }
    });

    server.on('error', err => {
      logger.error('Failed to start server', { error: err.message });
      process.exit(1);
    });

    process.on('SIGINT', () => {
      server.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      server.kill('SIGTERM');
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Failed to start Mastra server', { error: error.message });
    process.exit(1);
  }
}
