import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';
import { shouldSkipDotenvLoading } from '../utils';

interface StartWorkerOptions {
  name?: string;
  dir?: string;
  env?: string;
}

export async function startWorker(options: StartWorkerOptions = {}) {
  if (!shouldSkipDotenvLoading()) {
    config({ path: [options.env || '.env.production', '.env'], quiet: true });
  }

  const outputDir = options.dir || '.mastra/output';
  const outputPath = join(process.cwd(), outputDir);
  const workerFile = join(outputPath, 'index.mjs');

  if (!fs.existsSync(workerFile)) {
    logger.error(`Worker bundle not found at ${workerFile}. Run \`mastra worker build\` first.`);
    process.exit(1);
  }

  const child = spawn(process.execPath, ['index.mjs'], {
    cwd: outputPath,
    stdio: ['inherit', 'inherit', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...(options.name ? { MASTRA_WORKERS: options.name } : {}),
    },
  });

  let stderrBuffer = '';
  child.stderr?.on('data', data => {
    stderrBuffer += data.toString();
    process.stderr.write(data);
  });

  child.on('error', err => {
    logger.error(`Worker process failed to start: ${err.message}`, {
      stack: err.stack,
    });
    process.exit(1);
  });

  child.on('exit', code => {
    if (code !== 0 && stderrBuffer.includes('ERR_MODULE_NOT_FOUND')) {
      const packageNameMatch = stderrBuffer.match(/Cannot find package '([^']+)'/);
      const packageName = packageNameMatch ? packageNameMatch[1] : null;
      if (packageName) {
        logger.error('Module not found while starting Mastra worker', { package: packageName });
      }
    }
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}
