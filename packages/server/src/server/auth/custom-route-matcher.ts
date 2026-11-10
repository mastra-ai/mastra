import { Hono } from 'hono';
import { HonoRequest } from 'hono/request';

/** A custom route as the internal custom-route Hono app registers it. */
export interface CustomRouteMatcherEntry {
  method: string;
  path: string;
  /**
   * How many handlers (route middleware + handler) the route registers. Hono stores
   * each one as its own router entry, so mirror the count to build the same router.
   */
  handlerCount?: number;
}

export interface CustomRouteMatch<T> {
  entry: T;
  index: number;
  params: Record<string, string>;
}

type Marker = (...args: unknown[]) => undefined;

const noopMiddleware: Marker = () => undefined;
const paramRequest = new Request('http://localhost/');

/**
 * Answers "which custom route will run for this request?" using the same Hono router
 * the custom-route bridge dispatches with (`buildCustomRouteHandler`), registered in
 * the same order with the same paths and methods. Auth decisions use this instead
 * of a separate pattern matcher, so they can't disagree with dispatch on precedence,
 * case, trailing slashes, percent-decoding or HEAD handling.
 */
export class CustomRouteMatcher<T extends CustomRouteMatcherEntry> {
  readonly #app = new Hono();
  readonly #indexByHandler = new Map<unknown, number>();
  readonly #entries: readonly T[];

  constructor(entries: readonly T[]) {
    this.#entries = entries;
    // Same global middleware as the custom-route app, so the router sees the same table.
    this.#app.use('*', noopMiddleware as never);
    entries.forEach((entry, index) => {
      const marker: Marker = () => undefined;
      this.#indexByHandler.set(marker, index);
      const handlers = Array.from({ length: Math.max(1, entry.handlerCount ?? 1) }, () => marker as never);
      if (entry.method === 'ALL') {
        this.#app.all(entry.path, handlers[0]!, ...handlers.slice(1));
      } else {
        this.#app.on(entry.method, entry.path, handlers[0]!, ...handlers.slice(1));
      }
    });
  }

  /**
   * Match a path the way Hono dispatches it, i.e. `path` is already in the form
   * `getPath()` returns (no query string, percent-decoded once).
   * Throws if Hono can't build a router for the registered paths.
   */
  matchPath(path: string, method: string): CustomRouteMatch<T> | undefined {
    const upper = method.toUpperCase();
    // Hono serves HEAD with the GET handler.
    const dispatchMethod = upper === 'HEAD' ? 'GET' : upper;
    const result = this.#app.router.match(dispatchMethod, path);
    const handlers = result[0];
    for (let i = 0; i < handlers.length; i++) {
      const index = this.#indexByHandler.get(handlers[i]![0][0]);
      if (index === undefined) continue; // the global middleware
      const request = new HonoRequest(paramRequest, path, result as never);
      request.routeIndex = i;
      return { entry: this.#entries[index]!, index, params: request.param() as Record<string, string> };
    }
    return undefined;
  }

  /**
   * Match the full URL handed to the custom-route app. Parses it the same way
   * (`new Request(url)` then Hono's `getPath`), so dot segments, encoded characters
   * and the query string are handled exactly as dispatch handles them.
   * Throws if the URL can't be parsed.
   */
  matchUrl(url: string, method: string): CustomRouteMatch<T> | undefined {
    const path = this.#app.getPath(new Request(url));
    return this.matchPath(path, method);
  }

  /**
   * Converts a raw request path (as Express/Koa/Fastify see it, not yet decoded) to
   * the path Hono would dispatch when the bridge forwards it. Throws on an
   * unparseable path.
   */
  dispatchPathForRawPath(rawPath: string): string {
    return this.#app.getPath(new Request(`http://localhost${rawPath}`));
  }
}

const MAX_CACHED_MATCHERS = 32;
const matcherCache = new Map<string, CustomRouteMatcher<CustomRouteMatcherEntry & { key: string }>>();

/**
 * Builds (and caches) a matcher from `customRouteAuthConfig` keys. Keys are
 * `METHOD:path` in registration order, which is the order the server registers
 * custom routes with the custom-route app.
 */
export function getCustomRouteAuthConfigMatcher(
  keys: readonly string[],
): CustomRouteMatcher<CustomRouteMatcherEntry & { key: string }> {
  const signature = JSON.stringify(keys);
  const cached = matcherCache.get(signature);
  if (cached) {
    matcherCache.delete(signature);
    matcherCache.set(signature, cached);
    return cached;
  }

  const entries: Array<CustomRouteMatcherEntry & { key: string }> = [];
  for (const key of keys) {
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) continue; // malformed key
    entries.push({ key, method: key.substring(0, colonIndex).toUpperCase(), path: key.substring(colonIndex + 1) });
  }

  const matcher = new CustomRouteMatcher(entries);
  matcherCache.set(signature, matcher);
  if (matcherCache.size > MAX_CACHED_MATCHERS) {
    matcherCache.delete(matcherCache.keys().next().value!);
  }
  return matcher;
}
