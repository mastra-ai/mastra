const MANAGED_STUDIO_ROUTES = new Set(['/agent-builder/agents/create']);

export function normalizeManagedStudioRoute(route?: string) {
  const value = route?.trim();
  if (!value) return '';
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error('Managed Studio route must be a local path.');
  }

  const url = new URL(value, 'http://mastra.local');
  if (!MANAGED_STUDIO_ROUTES.has(url.pathname)) {
    throw new Error(`Managed Studio route is not allowed: ${url.pathname}`);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function applyManagedStudioRoute(studioUrl: string, route?: string) {
  const normalizedRoute = normalizeManagedStudioRoute(route);
  if (!normalizedRoute) return studioUrl;

  const url = new URL(studioUrl);
  const routeUrl = new URL(normalizedRoute, url);
  url.pathname = routeUrl.pathname;
  url.search = routeUrl.search;
  url.hash = routeUrl.hash;
  return url.toString();
}
