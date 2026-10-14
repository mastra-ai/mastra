import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';

/**
 * Base class for server adapters that provides app storage and retrieval.
 *
 * This class extends MastraBase to get logging capabilities and provides
 * a framework-agnostic way to store and retrieve the server app instance
 * (e.g., Hono, Express).
 *
 * Server adapters (like MastraServer from @mastra/hono or @mastra/express) extend this
 * base class to inherit the app storage functionality while adding their
 * framework-specific route registration and middleware handling.
 *
 * @template TApp - The type of the server app (e.g., Hono, Express Application)
 *
 * @example
 * ```typescript
 * // After server creation, the app is accessible via Mastra
 * const app = mastra.getServerApp<Hono>();
 * const response = await app.fetch(new Request('http://localhost/health'));
 * ```
 */
export abstract class MastraServerBase<TApp = unknown> extends MastraBase {
  #app: TApp;

  /**
   * True for servers that keep request bodies from setting agent scopes (the `scopes` option and
   * the `mastra__scopes` request context key). While a registered server does not set it, agents
   * refuse scopes from the call and the request context, and accept only their own `scopes` option.
   */
  declare readonly reservesAgentScopes?: boolean;

  constructor({ app, name }: { app: TApp; name?: string }) {
    super({ component: RegisteredLogger.SERVER, name: name ?? 'Server' });
    this.#app = app;
  }

  /**
   * Get the app instance.
   *
   * Returns the server app that was passed to the constructor. This allows users
   * to access the underlying server framework's app for direct operations
   * like calling routes via app.fetch() (Hono) or using the app for testing.
   *
   * @template T - The expected type of the app (defaults to TApp)
   * @returns The app instance cast to T. Callers are responsible for ensuring T matches the actual app type.
   *
   * @example
   * ```typescript
   * const app = adapter.getApp<Hono>();
   * const response = await app.fetch(new Request('http://localhost/api/agents'));
   * ```
   */
  getApp<T = TApp>(): T {
    return this.#app as unknown as T;
  }

  /**
   * Protected getter for subclasses to access the app.
   * This allows subclasses to use `this.app` naturally.
   */
  protected get app(): TApp {
    return this.#app;
  }
}
