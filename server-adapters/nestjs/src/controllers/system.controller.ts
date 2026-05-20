import { createRequire } from 'node:module';
import type { Mastra } from '@mastra/core/mastra';
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import { Public } from '../decorators/public.decorator';
import { SkipThrottle } from '../decorators/throttle.decorator';
import type { MastraModuleOptions } from '../mastra.module';
import { ShutdownService } from '../services/shutdown.service';

// Read package version at module load time
const require = createRequire(import.meta.url);
const PACKAGE_VERSION = (() => {
  try {
    return (require('@mastra/nestjs/package.json') as { version: string }).version;
  } catch {
    try {
      return (require('../package.json') as { version: string }).version;
    } catch {
      return 'unknown';
    }
  }
})();

/**
 * System controller for health checks and diagnostics.
 *
 * Routes are at the root level (not under the Mastra prefix) for compatibility
 * with Kubernetes, Docker, and container orchestration systems that typically
 * expect /health at root level.
 *
 * These routes are public (@Public) and skip rate limiting (@SkipThrottle).
 */
@Controller()
export class SystemController {
  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(ShutdownService) private readonly shutdownService: ShutdownService,
  ) {}

  /**
   * Health check endpoint.
   * Returns 200 if healthy, 503 if shutting down.
   */
  @Get('health')
  @Public()
  @SkipThrottle()
  health(@Res({ passthrough: true }) res: Response): { status: 'ok' | 'shutting_down'; timestamp: string } {
    const shuttingDown = this.shutdownService.shuttingDown;
    if (shuttingDown) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: shuttingDown ? 'shutting_down' : 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check endpoint.
   * Returns 200 if ready to accept traffic, 503 if not.
   */
  @Get('ready')
  @Public()
  @SkipThrottle()
  ready(@Res({ passthrough: true }) res: Response): { ready: boolean; activeRequests: number; timestamp: string } {
    const ready = !this.shutdownService.shuttingDown;
    if (!ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      ready,
      activeRequests: this.shutdownService.activeRequestCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Version and info endpoint.
   */
  @Get('info')
  @Public()
  @SkipThrottle()
  info(): { version: string; prefix: string; timestamp: string } {
    return {
      version: PACKAGE_VERSION,
      prefix: this.options.prefix || '/api',
      timestamp: new Date().toISOString(),
    };
  }
}
