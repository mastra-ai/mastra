import { SetMetadata } from '@nestjs/common';

import { THROTTLE_KEY } from '../constants';

export interface ThrottleOptions {
  /** Maximum number of requests in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Decorator to set custom rate limits for a route.
 * Overrides the default rate limits from MastraModuleOptions.
 *
 * @example
 * ```typescript
 * @Post('generate')
 * @MastraThrottle({ limit: 5, windowMs: 60000 }) // 5 requests per minute
 * async generate(@Body() body: GenerateDto) {
 *   // ...
 * }
 * ```
 */
export const MastraThrottle = (options: ThrottleOptions) => SetMetadata(THROTTLE_KEY, options);

/**
 * Decorator to skip rate limiting for a route.
 *
 * @example
 * ```typescript
 * @Get('health')
 * @SkipThrottle()
 * check() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SkipThrottle = () => SetMetadata(THROTTLE_KEY, { skip: true });
