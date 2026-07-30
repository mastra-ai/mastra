import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { getAnalytics } from '../../analytics/index.js';
import { logger } from '../../utils/logger';
import { shouldSkipDotenvLoading } from '../utils';
interface StartOptions {
  dir?: string;
  env?: string;
  customArgs?: string[];
}

// Cap the retained stderr buffer at 1MB. The buffer is only inspected for
// crash diagnostics (the ERR_MODULE_NOT_FOUND marker and the "Cannot find
// package" match), which live at the tail of a failing process's output, so
// keeping only the most recent bytes is sufficient. Without a bound, a
// long-running server that streams a lot of stderr grows the buffer until it
// exceeds V8's max string length and throws `RangeError: Invalid string length`.
export const MAX_STDERR_BUFFER = 1_000_000;

// Append a stderr chunk while keeping only the last `max` characters, so the
// retained buffer can never grow without bound.
export function boundStderr(buffer: string, chunk: string, max: number = MAX_STDERR_BUFFER): string {
  return (buffer + chunk).slice(-max);
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
        MASTRA_TELEMETRY_COMMAND: 'start',
        MASTRA_PROJECT_ROOT: process.cwd(),
        ...(getAnalytics()?.getDistinctId() ? { MASTRA_CLI_DISTINCT_ID: getAnalytics()!.getDistinctId() } : {}),
      },
    });

    let stderrBuffer = '';
    server.stderr.on('data', data => {
      stderrBuffer = boundStderr(stderrBuffer, data.toString());
      // Stream the server's stderr through live so logs from a healthy,
      // running process (warnings, channel/adapter errors) are visible.
      // The buffer above is retained only for the non-zero exit diagnostics.
      process.stderr.write(data);
    });

    server.on('exit', code => {
      if (code !== 0) {
        // Raw stderr has already been streamed live above. On a crash, add a
        // friendly hint for the common "missing dependency" case on top of it.
        if (stderrBuffer.includes('ERR_MODULE_NOT_FOUND')) {
          const packageNameMatch = stderrBuffer.match(/Cannot find package '([^']+)'/);
          const packageName = packageNameMatch ? packageNameMatch[1] : null;

          if (packageName) {
            logger.error('Module not found while starting Mastra server', { package: packageName });
          }
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
