/**
 * Injection token for the Mastra instance.
 * Use with @Inject(MASTRA) to inject the Mastra instance.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(@Inject(MASTRA) private readonly mastra: Mastra) {}
 * }
 * ```
 */
export const MASTRA = Symbol('MASTRA');

/**
 * Injection token for the Mastra module options.
 * Used internally by MastraService.
 */
export const MASTRA_OPTIONS = Symbol('MASTRA_OPTIONS');

/**
 * Metadata key for @Public() decorator.
 * Routes marked as public skip authentication.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Metadata key for @MastraThrottle() decorator.
 * Custom rate limits per route.
 */
export const THROTTLE_KEY = 'mastraThrottle';

/**
 * Metadata key for route information.
 * Stores the Mastra route definition for the handler.
 */
export const MASTRA_ROUTE_KEY = 'mastraRoute';
