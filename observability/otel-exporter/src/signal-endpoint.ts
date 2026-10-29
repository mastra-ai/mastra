/** Resolve an HTTP signal URL while preserving query parameters and custom trace paths. */
export function resolveHttpSignalEndpoint(endpoint: string, signal: 'traces' | 'logs'): string {
  const url = new URL(endpoint);
  let path = url.pathname;
  while (path.endsWith('/')) path = path.slice(0, -1);

  if (!path) {
    path = `/v1/${signal}`;
  } else if (path.endsWith('/traces') || path.endsWith('/logs')) {
    path = path.slice(0, path.lastIndexOf('/') + 1) + signal;
  } else if (signal === 'logs') {
    path += '/v1/logs';
  }

  url.pathname = path;
  return url.toString();
}
