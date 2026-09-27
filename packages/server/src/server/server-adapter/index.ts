import { SERVER_ROUTES } from './routes';
import type { MastraServerOptions } from './selected';
import { MastraServer as SelectedMastraServer } from './selected';

export * from './selected';
export * from './routes';
// PF-4446: framework-free fetch compiler. Exported from the package root
// (not `./selected`) because the compiler imports shared helpers from there.
export * from './fetch-compiler';

/**
 * Default server adapter base with the complete built-in route registry.
 *
 * Use `@mastra/server/server-adapter/selected` when a host intentionally loads
 * only reviewed per-domain route registries.
 */
export abstract class MastraServer<TApp, TRequest, TResponse> extends SelectedMastraServer<TApp, TRequest, TResponse> {
  /**
   * Framework adapters historically extended this public root. They now extend
   * the selected implementation so this root can inject `SERVER_ROUTES`; keep
   * their externally observable `instanceof` relationship compatible.
   */
  static [Symbol.hasInstance](instance: unknown): boolean {
    if (this === MastraServer) {
      return Function.prototype[Symbol.hasInstance].call(SelectedMastraServer, instance);
    }

    return Function.prototype[Symbol.hasInstance].call(this, instance);
  }

  constructor(options: MastraServerOptions<TApp>) {
    super({ ...options, routeRegistry: SERVER_ROUTES });
  }
}
