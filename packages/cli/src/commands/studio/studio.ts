import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import handler from 'serve-handler';
import { logger } from '../../utils/logger';

interface StudioOptions {
  env?: string;
  port?: string | number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function studio(options: StudioOptions = {}) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const distPath = join(__dirname, 'playground');

    if (!existsSync(distPath)) {
      logger.error(`Studio distribution not found at ${distPath}.`);
      process.exit(1);
    }

    const port = options.port || 3000;

    // Start the server using node
    const server = createServer(distPath);

    server.listen(port, () => {
      logger.info(`Mastra Studio running on http://localhost:${port}`);
    });

    process.on('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error: any) {
    logger.error(`Failed to start Mastra Studio: ${error.message}`);
    process.exit(1);
  }
}

const createServer = (builtStudioPath: string) => {
  // Read and transform index.html once at startup
  const indexHtmlPath = join(builtStudioPath, 'index.html');
  let indexHtml = readFileSync(indexHtmlPath, 'utf-8');

  // Replace all placeholders with actual values
  indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_HOST%%'`, `'localhost'`);
  indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PORT%%'`, `'4111'`);
  indexHtml = indexHtml.replace(`'%%MASTRA_HIDE_CLOUD_CTA%%'`, `'false'`);
  indexHtml = indexHtml.replace(`'%%MASTRA_SERVER_PROTOCOL%%'`, `'http'`);
  indexHtml = indexHtml.replace(
    `'%%MASTRA_TELEMETRY_DISABLED%%'`,
    `'${process.env.MASTRA_TELEMETRY_DISABLED || 'false'}'`,
  );
  // Replace base path placeholder - studio is served from root, so use empty string
  indexHtml = indexHtml.replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', '');

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const pathname = url.pathname;

    // Handle SSE refresh-events endpoint (no-op for static studio)
    if (pathname === '/refresh-events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      // Keep connection open but don't send refresh events
      return;
    }

    // Serve transformed index.html for HTML requests and SPA routes
    const ext = extname(pathname);
    const isAssetRequest = ext && ext !== '.html';

    if (!isAssetRequest) {
      // Serve the transformed index.html for SPA routes
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(indexHtml);
      return;
    }

    // For static assets, use serve-handler
    return handler(request, response, {
      public: builtStudioPath,
    });
  });

  return server;
};
