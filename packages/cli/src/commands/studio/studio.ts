import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';

interface StudioOptions {
  env?: string;
  port?: string | number;
}

export async function studio(options: StudioOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const distPath = join(process.cwd(), '.mastra', 'output', 'playground');

    if (!existsSync(distPath)) {
      logger.error(`Studio distribution not found at ${distPath}. Please run 'mastra build' first.`);
      process.exit(1);
    }

    const port = options.port || 3000;

    // Start the server using the installed serve binary
    const serveBin = join(process.cwd(), 'node_modules', '.bin', 'serve');
    const server = spawn(serveBin, [distPath, '-s', '-n', '-p', port.toString()]);

    let stderrBuffer = '';
    server.stderr.on('data', data => {
      stderrBuffer += data.toString();
    });

    server.on('spawn', () => {
      logger.info(`Mastra Studio running on http://localhost:${port}`);
    });

    server.on('exit', code => {
      if (code !== 0) {
        if (stderrBuffer) {
          logger.error(stderrBuffer.trim());
        }
        process.exit(code ?? 1);
      } else {
        // Normal exit - server stopped
        process.exit(0);
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
    logger.error(`Failed to start Mastra Studio: ${error.message}`);
    process.exit(1);
  }
}
