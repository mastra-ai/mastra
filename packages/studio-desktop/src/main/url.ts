import { LOCALHOST } from './defaults';

export function buildLocalUrl(port: number, pathname = '/') {
  const cleanPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `http://${LOCALHOST}:${port}${cleanPathname}`;
}

export function normalizeServerUrl(url: string) {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function toModelsEndpoint(modelUrl: string) {
  const normalized = normalizeServerUrl(modelUrl);
  return `${normalized}/models`;
}

export function toOllamaTagsEndpoint(modelUrl: string) {
  const normalized = new URL(normalizeServerUrl(modelUrl));
  normalized.pathname = normalized.pathname.replace(/\/(?:v1|api)$/, '');
  normalized.pathname = `${normalized.pathname.replace(/\/$/, '')}/api/tags`;
  return normalized.toString();
}
