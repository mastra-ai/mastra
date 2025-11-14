import http from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import handler from 'serve-handler';
import { logger } from '../../utils/logger';

interface StudioOptions {
  env?: string;
  port?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function studio(options: StudioOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const builtStudioPath = join(__dirname, 'playground');

    logger.info(`Studio current path: ${builtStudioPath}`);
    const port = options.port || 3000;

    // Start the server using node
    const server = createServer(builtStudioPath);

    server.listen(port, () => {
      logger.info(`Mastra Studio running on http://localhost:${port}`);
    });

    process.on('SIGINT', () => {
      server.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      server.close();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error(`Failed to start Mastra Studio: ${error.message}`);
    process.exit(1);
  }
}

const createServer = (builtStudioPath: string) => {
  const server = http.createServer((request, response) => {
    // You pass two more arguments for config and middleware
    // More details here: https://github.com/vercel/serve-handler#options
    return handler(request, response, {
      public: builtStudioPath,
      rewrites: [
        {
          source: '**',
          destination: '/index.html',
        },
      ],
    });
  });

  return server;
};
