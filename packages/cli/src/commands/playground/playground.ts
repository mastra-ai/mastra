import { spawn } from 'child_process';
import { join } from 'path';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';

interface PlaygroundOptions {
  env?: string;
  port?: string;
}

export async function playground(options: PlaygroundOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const distPath = join(process.cwd(), 'dist', 'playground');
    const port = options.port || 3000;

    // Start the server using node
    const server = spawn('npx', ['serve', distPath, '-s', '-n', '-p', port.toString()]);

    let stderrBuffer = '';
    server.stderr.on('data', data => {
      stderrBuffer += data.toString();
    });

    server.on('spawn', () => {
      logger.info(`Mastra playground running on http://localhost:${port}`);
    });

    server.on('exit', code => {
      if (code !== 0 && stderrBuffer) {
        logger.error(stderrBuffer.trim());

        process.exit(code);
      }
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
