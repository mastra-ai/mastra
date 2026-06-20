import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import type { IncomingMessage, OutgoingHttpHeaders, Server, ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { LOCALHOST } from './defaults';

export interface StudioServerOptions {
  builtStudioPath: string;
  port: number;
  serverUrl: string;
  apiPrefix?: string;
}

function parseServerUrl(serverUrl: string) {
  const url = new URL(serverUrl);
  return {
    protocol: url.protocol.replace(':', '') || 'http',
    host: url.hostname || LOCALHOST,
    port: url.port || (url.protocol === 'https:' ? '443' : '80'),
  };
}

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function requestPath(url: string) {
  return new URL(url, `http://${LOCALHOST}`).pathname;
}

type StaticAssetResult = 'served' | 'missing' | 'not-asset';

function resolveStaticAssetPath(root: string, path: string) {
  const decodedPath = decodeURIComponent(path);
  const rootPath = resolve(root);
  const filePath = resolve(rootPath, `.${decodedPath}`);

  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    return undefined;
  }

  return filePath;
}

function serveStaticAsset(req: IncomingMessage, res: ServerResponse, root: string, path: string): StaticAssetResult {
  if (path === '/' || !extname(path)) return 'not-asset';

  let filePath: string | undefined;
  try {
    filePath = resolveStaticAssetPath(root, path);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid asset path');
    return 'served';
  }

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return 'served';
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    return 'missing';
  }

  if (!stats.isFile()) return 'missing';

  const stream = createReadStream(filePath);
  stream.once('error', error => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Failed to serve asset: ${error.message}`);
  });

  res.writeHead(200, {
    'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Length': stats.size,
    'Content-Type': MIME_TYPES[extname(path)] ?? 'application/octet-stream',
  });
  stream.pipe(res);
  return 'served';
}

function proxyToMastraRuntime(req: IncomingMessage, res: ServerResponse, serverUrl: string) {
  const targetBase = new URL(serverUrl);
  const targetUrl = new URL(req.url ?? '/', targetBase);
  const headers: OutgoingHttpHeaders = {
    ...req.headers,
    host: targetUrl.host,
  };
  const request = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  const proxyReq = request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers,
    },
    proxyRes => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.statusMessage, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', error => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Mastra runtime proxy failed: ${error.message}`);
  });

  req.pipe(proxyReq);
}

export function createStudioShellServer(options: StudioServerOptions) {
  const indexHtmlPath = join(options.builtStudioPath, 'index.html');
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`Studio distribution not found at ${options.builtStudioPath}`);
  }

  const serverConfig = parseServerUrl(`http://${LOCALHOST}:${options.port}`);
  const apiPrefix = options.apiPrefix ?? '/api';
  const html = readFileSync(indexHtmlPath, 'utf8')
    .replaceAll('%%MASTRA_STUDIO_BASE_PATH%%', '')
    .replaceAll('%%MASTRA_SERVER_HOST%%', serverConfig.host)
    .replaceAll('%%MASTRA_SERVER_PORT%%', serverConfig.port)
    .replaceAll('%%MASTRA_SERVER_PROTOCOL%%', serverConfig.protocol)
    .replaceAll('%%MASTRA_API_PREFIX%%', apiPrefix)
    .replaceAll('%%MASTRA_EXPERIMENTAL_FEATURES%%', 'true')
    .replaceAll('%%MASTRA_TEMPLATES%%', 'true')
    .replaceAll('%%MASTRA_CLOUD_API_ENDPOINT%%', '')
    .replaceAll('%%MASTRA_AUTO_DETECT_URL%%', 'false')
    .replaceAll('%%MASTRA_HIDE_CLOUD_CTA%%', 'true')
    .replaceAll('%%MASTRA_TELEMETRY_DISABLED%%', process.env.MASTRA_TELEMETRY_DISABLED ?? '')
    .replaceAll('%%MASTRA_REQUEST_CONTEXT_PRESETS%%', '')
    .replaceAll('%%MASTRA_EXPERIMENTAL_UI%%', 'false')
    .replaceAll('%%MASTRA_AGENT_SIGNALS%%', 'true');

  const compressedHtml = gzipSync(Buffer.from(html));

  return createServer((req, res) => {
    const url = req.url ?? '/';
    const path = requestPath(url);

    if (path === '/refresh-events') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === apiPrefix || path.startsWith(`${apiPrefix}/`)) {
      proxyToMastraRuntime(req, res, options.serverUrl);
      return;
    }

    const assetResult = serveStaticAsset(req, res, options.builtStudioPath, path);
    if (assetResult === 'served') {
      return;
    }

    if (assetResult === 'missing') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Asset not found');
      return;
    }

    const rawEncoding = req.headers['accept-encoding'] ?? '';
    const encodings = Array.isArray(rawEncoding) ? rawEncoding : [rawEncoding];
    const supportsGzip = encodings.join(',').toLowerCase().includes('gzip');

    if (supportsGzip) {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Encoding': 'gzip',
        'Content-Length': compressedHtml.length,
        Vary: 'Accept-Encoding',
      });
      res.end(compressedHtml);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html', Vary: 'Accept-Encoding' });
    res.end(html);
  });
}

export async function startStudioShellServer(options: StudioServerOptions): Promise<Server> {
  const server = createStudioShellServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, LOCALHOST, resolve);
  });
  return server;
}
