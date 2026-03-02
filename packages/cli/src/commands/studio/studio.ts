import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import handler from 'serve-handler';
import { logger } from '../../utils/logger';
import { loadAndValidatePresets, escapeJsonForHtml } from '../../utils/validate-presets.js';

interface StudioOptions {
  env?: string;
  port?: string | number;
  serverHost?: string;
  serverPort?: string | number;
  serverProtocol?: string;
  serverApiPrefix?: string;
  requestContextPresets?: string;
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();

  if (trimmed === '' || trimmed === '/') {
    return '';
  }

  let normalized = trimmed.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
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
  config({ path: [options.env || '.env.production', '.env'], quiet: true });

  // Load and validate request context presets if provided
  let requestContextPresetsJson = '';
  if (options.requestContextPresets) {
    try {
      requestContextPresetsJson = await loadAndValidatePresets(options.requestContextPresets);
    } catch (error: any) {
      logger.error(`Failed to load request context presets: ${error.message}`);
      process.exit(1);
    }
  }

  try {
    const distPath = join(__dirname, 'studio');

    if (!existsSync(distPath)) {
      logger.error(`Studio distribution not found at ${distPath}.`);
      process.exit(1);
    }

    const port = options.port || 3000;

    // Start the server using the installed serve binary
    // Start the server using node
    const server = createServer(distPath, options, requestContextPresetsJson);

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

export const createServer = (builtStudioPath: string, options: StudioOptions, requestContextPresetsJson: string) => {
  const indexHtmlPath = join(builtStudioPath, 'index.html');
  const basePath = normalizeBasePath(process.env.MASTRA_STUDIO_BASE_PATH ?? '');

  const experimentalFeatures = process.env.EXPERIMENTAL_FEATURES === 'true' ? 'true' : 'false';

  let html = readFileSync(indexHtmlPath, 'utf8')
    .replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', basePath)
    .replaceAll('%%MASTRA_SERVER_HOST%%', options.serverHost || 'localhost')
    .replaceAll('%%MASTRA_SERVER_PORT%%', String(options.serverPort || 4111))
    .replaceAll('%%MASTRA_SERVER_PROTOCOL%%', options.serverProtocol || 'http')
    .replaceAll('%%MASTRA_API_PREFIX%%', options.serverApiPrefix || '/api')
    .replaceAll('%%MASTRA_EXPERIMENTAL_FEATURES%%', experimentalFeatures)
    .replaceAll('%%MASTRA_CLOUD_API_ENDPOINT%%', '')
    .replaceAll('%%MASTRA_HIDE_CLOUD_CTA%%', '')
    .replaceAll('%%MASTRA_TELEMETRY_DISABLED%%', process.env.MASTRA_TELEMETRY_DISABLED ?? '')
    .replaceAll('%%MASTRA_REQUEST_CONTEXT_PRESETS%%', escapeJsonForHtml(requestContextPresetsJson));

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    const queryStart = url.indexOf('?');
    const rawPathname = queryStart >= 0 ? url.slice(0, queryStart) : url;
    const query = queryStart >= 0 ? url.slice(queryStart + 1) : '';
    const pathname = rawPathname || '/';

    const pathWithoutBase =
      basePath && pathname.startsWith(`${basePath}/`)
        ? pathname.slice(basePath.length)
        : pathname === basePath
          ? '/'
          : pathname;

    // Let static assets be served by serve-handler
    const isStaticAsset =
      pathWithoutBase.includes('/assets/') ||
      pathWithoutBase.includes('/dist/assets/') ||
      pathWithoutBase.includes('/mastra.svg');

    // For everything that's not a static asset, serve the SPA shell (index.html)
    if (!isStaticAsset) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    if (basePath && pathWithoutBase !== pathname) {
      req.url = query ? `${pathWithoutBase}?${query}` : pathWithoutBase;
    }

    return handler(req, res, {
      public: builtStudioPath,
    });
  });

  return server;
};
