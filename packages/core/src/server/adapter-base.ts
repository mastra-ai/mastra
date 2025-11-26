import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger/constants';

/**
 * Base class for server adapters that provides app storage and retrieval.
 *
 * This class extends MastraBase to get logging capabilities and provides
 * a framework-agnostic way to store and retrieve the server app instance
 * (e.g., Hono, Express).
 *
 * Server adapters (like HonoServerAdapter, ExpressServerAdapter) extend this
 * base class to inherit the app storage functionality while adding their
 * framework-specific route registration and middleware handling.
 *
 * @template TApp - The type of the server app (e.g., Hono, Express Application)
 *
 * @example
 * ```typescript
 * // After server creation, the app is accessible via Mastra
 * const app = mastra.getServerApp<Hono>();
 * const response = await app?.fetch(new Request('http://localhost/health'));
 * ```
 */
export abstract class MastraServerAdapterBase<TApp = unknown> extends MastraBase {
  #app?: TApp;

  constructor({ name }: { name?: string } = {}) {
    super({ component: RegisteredLogger.SERVER_ADAPTER, name: name ?? 'ServerAdapter' });
  }

  /**
   * Set the app instance this adapter is working with.
   *
   * This is called during server initialization to store the app reference
   * so it can be retrieved later via getApp() or mastra.getServerApp().
   *
   * @param app - The server app instance (e.g., Hono app, Express app)
   */
  setApp(app: TApp): void {
    this.#app = app;
    this.logger.debug(`Server app set`);
  }

  /**
   * Get the app instance.
   *
   * Returns the server app that was set via setApp(). This allows users
   * to access the underlying server framework's app for direct operations
   * like calling routes via app.fetch() (Hono) or using the app for testing.
   *
   * @template T - The expected type of the app (defaults to TApp)
   * @returns The app instance, or undefined if not set
   *
   * @example
   * ```typescript
   * const app = adapter.getApp<Hono>();
   * const response = await app?.fetch(new Request('http://localhost/api/agents'));
   * ```
   */
  getApp<T = TApp>(): T | undefined {
    return this.#app as T | undefined;
  }
}
