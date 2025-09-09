import { spawn } from 'child_process';
import fs from 'fs';
import { join } from 'path';
import { isWebContainer } from '@webcontainer/env';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';
interface StartOptions {
  dir?: string;
  telemetry?: boolean;
  env?: string;
}

export async function start(options: StartOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  const outputDir = options.dir || '.mastra/output';
  const telemetry = options.telemetry ?? true;

  try {
    // Check if the output directory exist
    const outputPath = join(process.cwd(), outputDir);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output directory ${outputPath} does not exist`);
    }

    const commands = [];

    if (telemetry && !isWebContainer()) {
      const instrumentation = '@opentelemetry/instrumentation/hook.mjs';
      commands.push('--import=./instrumentation.mjs', `--import=${instrumentation}`);
    }

    commands.push('index.mjs');

    // Start the server using node
    const server = spawn('node', commands, {
      cwd: outputPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    server.on('error', err => {
      logger.error(`Failed to start server: ${err.message}`);
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
    logger.error(`Failed to start Mastra server: ${error.message}`);
    process.exit(1);
  }
}
