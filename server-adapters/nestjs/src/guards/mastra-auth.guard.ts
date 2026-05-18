import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../constants';
import { AuthService } from '../services/auth.service';

/**
 * Guard that bridges to Mastra's authentication system.
 * Checks for @Public() decorator to skip auth.
 *
 * **IMPORTANT: This guard is for custom user routes, NOT for Mastra API routes.**
 *
 * Mastra routes (agents, workflows, etc.) use AuthService internally which has
 * access to route-specific auth configuration (customRouteAuthConfig, isProtectedPath,
 * canAccessPublicly). This guard is a simplified version for when you want to
 * protect your own NestJS routes with Mastra's auth config.
 *
 * Differences from AuthService (used internally for Mastra routes):
 * - Does NOT check `customRouteAuthConfig`
 * - Does NOT check `isProtectedPath` / `canAccessPublicly` from @mastra/server/auth
 * - Has simpler dev playground detection (just checks header + config)
 *
 * @example
 * ```typescript
 * // Protect a custom route with Mastra auth
 * @Controller('my-custom')
 * @UseGuards(MastraAuthGuard)
 * export class MyController {
 *   @Get('protected')
 *   protectedRoute() { ... }
 *
 *   @Get('open')
 *   @Public() // Skip auth for this route
 *   openRoute() { ... }
 * }
 * ```
 */
@Injectable()
export class MastraAuthGuard implements CanActivate {
  private readonly logger = new Logger(MastraAuthGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    try {
      await this.authService.authenticate(request);
      return true;
    } catch (error) {
      this.logger.error(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
