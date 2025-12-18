import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import handler from 'serve-handler';
import { logger } from '../../utils/logger';

interface StudioOptions {
  env?: string;
  port?: string | number;
  basePath?: string;
  serverHost?: string;
  serverPort?: string | number;
  serverProtocol?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function studio(
  options: StudioOptions = {
    basePath: '/',
    serverHost: 'localhost',
    serverPort: 4111,
    serverProtocol: 'http',
  },
) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const distPath = join(__dirname, 'playground');

    if (!existsSync(distPath)) {
      logger.error(`Studio distribution not found at ${distPath}.`);
      process.exit(1);
    }

    const port = options.port || 3000;

    // Start the server using the installed serve binary
    // Start the server using node
    const server = createServer(distPath, options);

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

const createServer = (builtStudioPath: string, options: StudioOptions) => {
  const indexHtmlPath = join(builtStudioPath, 'index.html');
  const basePath = options?.basePath ? `${options.basePath}/` : '/';

  let html = readFileSync(indexHtmlPath, 'utf8')
    .replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', basePath)
    .replace('%%MASTRA_SERVER_HOST%%', options.serverHost || 'localhost')
    .replace('%%MASTRA_SERVER_PORT%%', String(options.serverPort || 4111))
    .replace('%%MASTRA_SERVER_PROTOCOL%%', options.serverProtocol || 'http');

  const server = http.createServer((req, res) => {
    const url = req.url || basePath;

    // Let static assets be served by serve-handler
    const isStaticAsset =
      url.includes('/assets/') ||
      url.includes('/dist/assets/') ||
      url.includes('/mastra.svg') ||
      url.includes('/favicon.ico');

    // For everything that's not a static asset, serve the SPA shell (index.html)
    if (!isStaticAsset) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    const newUrl = basePath === '/' ? url : url.replace(basePath, '');
    req.url = newUrl;

    return handler(req, res, {
      public: builtStudioPath,
    });
  });

  return server;
};
