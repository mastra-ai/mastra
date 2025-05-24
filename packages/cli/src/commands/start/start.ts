import { spawn } from 'child_process';
import { join } from 'path';
import { isWebContainer } from '@webcontainer/env';
import { logger } from '../../utils/logger';

interface StartOptions {
  dir?: string;
  telemetry?: boolean;
}

export async function start(options: StartOptions = {}) {
  const outputDir = options.dir || '.mastra/output';
  const telemetry = options.telemetry || false;

  try {
    // Check if the output directory exists
    const outputPath = join(process.cwd(), outputDir);

    const commands = [];

    if (telemetry && !isWebContainer()) {
      const instrumentation = import.meta.resolve('@opentelemetry/instrumentation/hook.mjs');
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
