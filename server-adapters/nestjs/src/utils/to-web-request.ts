import type { Request } from 'express';

/**
 * Convert an Express request to a Web API Request.
 * Auth providers and route handlers expect this canonical header/cookie shape.
 */
export function toWebRequest(req: Request): globalThis.Request {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  const url = `${protocol}://${host}${req.originalUrl || req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  return new globalThis.Request(url, {
    method: req.method,
    headers,
    // Note: body is not needed as it's already parsed
  });
}
