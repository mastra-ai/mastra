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
  serverHost?: string;
  serverPort?: string | number;
  serverProtocol?: string;
  serverApiPrefix?: string;
  authHeader?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function studio(
  options: StudioOptions = {
    serverHost: 'localhost',
    serverPort: 4111,
    serverProtocol: 'http',
  },
) {
  // Load environment variables from .env files
  config({ path: [options.env || '.env.production', '.env'] });

  try {
    const distPath = join(__dirname, 'studio');

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

/**
 * Escapes a string value for safe injection into a JavaScript string literal within an HTML script tag.
 * Handles backslashes, single quotes, angle brackets, and control characters.
 */
export function escapeForHtmlScript(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/</g, '\\x3c') // Escape < to prevent script tag injection
    .replace(/>/g, '\\x3e') // Escape > to prevent script tag injection
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r'); // Escape carriage returns
}

export const createServer = (builtStudioPath: string, options: StudioOptions) => {
  const indexHtmlPath = join(builtStudioPath, 'index.html');
  const basePath = '';

  const experimentalFeatures = process.env.EXPERIMENTAL_FEATURES === 'true' ? 'true' : 'false';

  let html = readFileSync(indexHtmlPath, 'utf8')
    .replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', basePath)
    .replaceAll('%%MASTRA_SERVER_HOST%%', options.serverHost || 'localhost')
    .replaceAll('%%MASTRA_SERVER_PORT%%', String(options.serverPort || 4111))
    .replaceAll('%%MASTRA_SERVER_PROTOCOL%%', options.serverProtocol || 'http')
    .replaceAll('%%MASTRA_API_PREFIX%%', options.serverApiPrefix || '/api')
    .replaceAll('%%MASTRA_AUTH_HEADER%%', escapeForHtmlScript(options.authHeader ?? ''))
    .replaceAll('%%MASTRA_EXPERIMENTAL_FEATURES%%', experimentalFeatures)
    .replaceAll('%%MASTRA_CLOUD_API_ENDPOINT%%', '')
    .replaceAll('%%MASTRA_HIDE_CLOUD_CTA%%', '')
    .replaceAll('%%MASTRA_TELEMETRY_DISABLED%%', escapeForHtmlScript(process.env.MASTRA_TELEMETRY_DISABLED ?? ''));

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

    return handler(req, res, {
      public: builtStudioPath,
    });
  });

  return server;
};
