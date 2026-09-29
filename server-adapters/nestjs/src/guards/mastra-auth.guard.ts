import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { IS_PUBLIC_KEY } from '../constants';
import { AuthService } from '../services/auth.service';

/**
 * Guard that bridges to Mastra's authentication system.
 * Checks for @Public() decorator to skip auth.
 *
 * **IMPORTANT: This guard is for custom user routes, NOT for Mastra API routes.**
 *
 * Mastra routes (agents, workflows, etc.) and `server.apiRoutes` are protected by
 * MastraRouteGuard. Use this guard to protect your own NestJS routes with the
 * same Mastra auth pipeline (`server.auth`).
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
      await this.authService.authenticate(request, {
        response: context.switchToHttp().getResponse<Response>(),
      });
      return true;
    } catch (error) {
      this.logger.error(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
