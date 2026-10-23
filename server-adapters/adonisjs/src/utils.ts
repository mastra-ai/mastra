import type { HttpContext } from '@adonisjs/core/http';

export function toWebRequest(ctx: HttpContext): globalThis.Request {
  const request = ctx.request;
  const protocol = request.protocol() || 'http';
  const host = request.host() || 'localhost';
  const url = `${protocol}://${host}${request.url(true)}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.request.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  return new globalThis.Request(url, {
    method: request.method(),
    headers,
  });
}
