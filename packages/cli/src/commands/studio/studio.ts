import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
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
      logger.error('Failed to load request context presets', { error: error.message });
      process.exit(1);
    }
  }

  try {
    const distPath = join(__dirname, 'studio');

    if (!existsSync(distPath)) {
      logger.error('Studio distribution not found', { distPath });
      process.exit(1);
    }

    const port = options.port || 3000;

    // Start the server using the installed serve binary
    // Start the server using node
    const server = createServer(distPath, options, requestContextPresetsJson);

    server.listen(port, () => {
      logger.info('Mastra Studio running', { url: `http://localhost:${port}` });
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
    logger.error('Failed to start Mastra Studio', { error: error.message });
    process.exit(1);
  }
}

export const createServer = (builtStudioPath: string, options: StudioOptions, requestContextPresetsJson: string) => {
  const indexHtmlPath = join(builtStudioPath, 'index.html');
  const basePath = normalizeBasePath(process.env.MASTRA_STUDIO_BASE_PATH ?? '');

  const experimentalFeatures = process.env.EXPERIMENTAL_FEATURES === 'true' ? 'true' : 'false';
  const experimentalUI = process.env.MASTRA_EXPERIMENTAL_UI === 'true' ? 'true' : 'false';
  const templatesEnabled = process.env.MASTRA_TEMPLATES === 'true' ? 'true' : 'false';

  let html = readFileSync(indexHtmlPath, 'utf8')
    .replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', basePath)
    .replaceAll('%%MASTRA_SERVER_HOST%%', options.serverHost || 'localhost')
    .replaceAll('%%MASTRA_SERVER_PORT%%', String(options.serverPort || 4111))
    .replaceAll('%%MASTRA_SERVER_PROTOCOL%%', options.serverProtocol || 'http')
    .replaceAll('%%MASTRA_API_PREFIX%%', options.serverApiPrefix || '/api')
    .replaceAll('%%MASTRA_EXPERIMENTAL_FEATURES%%', experimentalFeatures)
    .replaceAll('%%MASTRA_TEMPLATES%%', templatesEnabled)
    .replaceAll('%%MASTRA_CLOUD_API_ENDPOINT%%', '')
    .replaceAll('%%MASTRA_HIDE_CLOUD_CTA%%', '')
    .replaceAll('%%MASTRA_TELEMETRY_DISABLED%%', process.env.MASTRA_TELEMETRY_DISABLED ?? '')
    .replaceAll('%%MASTRA_REQUEST_CONTEXT_PRESETS%%', escapeJsonForHtml(requestContextPresetsJson))
    .replaceAll('%%MASTRA_EXPERIMENTAL_UI%%', experimentalUI);

  // Pre-compress the HTML shell since it's served for every non-asset request
  const compressedHtml = gzipSync(Buffer.from(html));

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
    const isAssetsPath = /(^|\/)assets\//.test(pathWithoutBase);
    const isDistAssetsPath = /(^|\/)dist\/assets\//.test(pathWithoutBase);
    const isMastraSvg = pathWithoutBase === '/mastra.svg' || pathWithoutBase.endsWith('/mastra.svg');
    const isStaticAsset = isAssetsPath || isDistAssetsPath || isMastraSvg;

    const rawEncoding = req.headers['accept-encoding'] ?? '';
    const encodingValues = Array.isArray(rawEncoding) ? rawEncoding : [rawEncoding];
    const supportsGzip = encodingValues
      .flatMap((v: string) => v.split(','))
      .map((v: string) => v.trim().toLowerCase())
      .some((v: string) => {
        const [coding, ...params] = v.split(';').map((p: string) => p.trim());
        if (coding !== 'gzip') return false;
        const q = params.find((p: string) => p.startsWith('q='));
        return q ? Number(q.slice(2)) > 0 : true;
      });

    // For everything that's not a static asset, serve the SPA shell (index.html)
    if (!isStaticAsset) {
      if (supportsGzip) {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Encoding': 'gzip',
          'Content-Length': compressedHtml.length,
          Vary: 'Accept-Encoding',
        });
        return res.end(compressedHtml);
      }
      res.writeHead(200, { 'Content-Type': 'text/html', Vary: 'Accept-Encoding' });
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
