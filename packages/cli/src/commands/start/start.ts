import { spawn } from 'child_process';
import fs from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';
interface StartOptions {
  dir?: string;
  env?: string;
}

export async function start(options: StartOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  const outputDir = options.dir || '.mastra/output';

  try {
    // Check if the output directory exist
    const outputPath = join(process.cwd(), outputDir);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output directory ${outputPath} does not exist`);
    }

    const commands = [];

    commands.push('index.mjs');

    // Start the server using node
    const server = spawn('node', commands, {
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
            logger.error(`Module \`${packageName}\` not found while starting the Mastra server.
This usually indicates that a transitive dependency could not be bundled correctly during the build process.
Try adding \`${packageName}\` to your externals:

export const mastra = new Mastra({
  bundler: {
    externals: ["${packageName}"],
  }
})

If this doesn't resolve the issue, investigate the dependencies you added to your package.json as one of them might use \`${packageName}\` internally. Add that particular dependency to the externals instead. Also consider opening an issue.

Original error:

${stderrBuffer.trim()}`);
          }
        } else {
          logger.error(stderrBuffer.trim());
        }
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
