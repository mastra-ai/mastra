import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { Module } from '@nestjs/common';
import type { DynamicModule, MiddlewareConsumer, NestModule, Provider, Type } from '@nestjs/common';

import { MASTRA, MASTRA_OPTIONS } from './constants';
import { MastraController } from './controllers/mastra.controller';
import { SystemController } from './controllers/system.controller';
import { MastraExceptionFilter } from './filters/mastra-exception.filter';
import { MastraAuthGuard } from './guards/mastra-auth.guard';
import { MastraRouteGuard } from './guards/mastra-route.guard';
import { MastraThrottleGuard } from './guards/mastra-throttle.guard';
import { RequestTrackingInterceptor } from './interceptors/request-tracking.interceptor';
import { StreamingInterceptor } from './interceptors/streaming.interceptor';
import { TracingInterceptor } from './interceptors/tracing.interceptor';
import { MastraService } from './mastra.service';
import { BodyLimitMiddleware } from './middleware/body-limit.middleware';
import { JsonBodyMiddleware } from './middleware/json-body.middleware';
import { AuthService } from './services/auth.service';
import { RequestContextService } from './services/request-context.service';
import { RouteHandlerService } from './services/route-handler.service';
import { ShutdownService } from './services/shutdown.service';

/**
 * Options for MastraModule configuration.
 */
export interface MastraModuleOptions {
  /** The Mastra instance to register */
  mastra: Mastra;

  /** Route prefix (default: '/api') */
  prefix?: string;

  /** Request body size limits */
  bodyLimitOptions?: {
    /** Max body size in bytes (default: 10MB) */
    maxSize?: number;
    /** Max per-file size in bytes (default: 50MB) */
    maxFileSize?: number;
    /** Temp directory for file uploads */
    tempDir?: string;
    /** Allowed MIME types for file uploads */
    allowedMimeTypes?: string[];
  };

  /**
   * Rate limiting options.
   * Rate limiting is ON by default - set enabled: false to disable.
   */
  rateLimitOptions?: {
    /** Enable/disable rate limiting (default: true) */
    enabled?: boolean;
    /** Default requests per window (default: 100) */
    defaultLimit?: number;
    /** Window size in ms (default: 60000 = 1 minute) */
    windowMs?: number;
    /** Stricter limit for /generate endpoints (default: 10) */
    generateLimit?: number;
  };

  /** Graceful shutdown options */
  shutdownOptions?: {
    /** Max wait time for in-flight requests in ms (default: 30000) */
    timeoutMs?: number;
    /** Send shutdown event to SSE clients (default: true) */
    notifyClients?: boolean;
  };

  /** Observability options */
  tracingOptions?: {
    /** Enable tracing (default: auto-detect @opentelemetry/api) */
    enabled?: boolean;
    /** Service name for spans */
    serviceName?: string;
  };

  /** Context parsing options */
  contextOptions?: {
    /** Fail on parse errors (default: false) */
    strict?: boolean;
    /** Log parse warnings (default: true) */
    logWarnings?: boolean;
  };

  /** Additional tools to register */
  tools?: ToolsInput;

  /** Task store for async operations */
  taskStore?: InMemoryTaskStore;

  /** Mastra-internal authentication configuration. Disabled by default.
   *  Most NestJS apps have their own global auth guards -- Mastra defers to those.
   *  Enable this only if you want Mastra's built-in token auth. */
  auth?: {
    /** Enable Mastra's internal auth (default: false) */
    enabled?: boolean;
  };

  /** Per-route auth configuration */
  customRouteAuthConfig?: Map<string, boolean>;

  /** Streaming configuration */
  streamOptions?: {
    /** Redact sensitive data from streams (default: true) */
    redact?: boolean;
    /** Send SSE heartbeats every N ms (default: disabled). Set <= 0 to disable. */
    heartbeatMs?: number;
  };

  /** MCP transport options */
  mcpOptions?: {
    /** Run in serverless mode */
    serverless?: boolean;
    /** Custom session ID generator */
    sessionIdGenerator?: () => string;
  };
}

/**
 * Options for async module configuration.
 */
export interface MastraModuleAsyncOptions {
  /** Modules to import for dependency injection */
  imports?: any[];
  /** Factory function to create module options */
  useFactory?: (...args: any[]) => Promise<MastraModuleOptions> | MastraModuleOptions;
  /** Dependencies to inject into the factory function */
  inject?: any[];
  /** Use an existing provider */
  useExisting?: Type<MastraModuleOptionsFactory>;
  /** Use a class to create options */
  useClass?: Type<MastraModuleOptionsFactory>;
}

/**
 * Interface for async options factory.
 */
export interface MastraModuleOptionsFactory {
  createMastraOptions(): Promise<MastraModuleOptions> | MastraModuleOptions;
}

/**
 * NestJS module for integrating Mastra into your application.
 *
 * @example
 * Basic registration:
 * ```typescript
 * @Module({
 *   imports: [
 *     MastraModule.register({
 *       mastra: new Mastra({ agents: { ... } }),
 *       prefix: '/api',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * With rate limiting disabled:
 * ```typescript
 * MastraModule.register({
 *   mastra,
 *   rateLimitOptions: { enabled: false },
 * })
 * ```
 *
 * @example
 * Async registration:
 * ```typescript
 * MastraModule.registerAsync({
 *   imports: [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     mastra: new Mastra({ ... }),
 *     prefix: config.get('MASTRA_PREFIX', '/api'),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
@Module({})
export class MastraModule implements NestModule {
  /**
   * Register Mastra with the NestJS application.
   *
   * @param options - Configuration options including the Mastra instance
   * @returns Dynamic module configuration
   */
  static register(options: MastraModuleOptions): DynamicModule {
    const normalizedOptions: MastraModuleOptions = {
      prefix: '/api',
      ...options,
    };

    const optionsProvider: Provider = {
      provide: MASTRA_OPTIONS,
      useValue: normalizedOptions,
    };

    const mastraProvider: Provider = {
      provide: MASTRA,
      useValue: normalizedOptions.mastra,
    };

    return {
      module: MastraModule,
      // SystemController must come before MastraController so its specific
      // routes (/health, /ready, /info) are matched before the catch-all
      controllers: [SystemController, MastraController],
      providers: [
        optionsProvider,
        mastraProvider,
        MastraService,
        RouteHandlerService,
        RequestContextService,
        ShutdownService,
        AuthService,
        BodyLimitMiddleware,
        JsonBodyMiddleware,
        // Guards are available for use but NOT registered as APP_GUARD
        // to avoid affecting other modules in the user's app.
        // MastraRouteGuard applies auth + rate limiting only for Mastra routes.
        MastraAuthGuard,
        MastraThrottleGuard,
        MastraRouteGuard,
        TracingInterceptor,
        StreamingInterceptor,
        RequestTrackingInterceptor,
        MastraExceptionFilter,
      ],
      exports: [MASTRA, MastraService],
    };
  }

  /**
   * Register Mastra asynchronously for when configuration depends on other services.
   *
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static registerAsync(options: MastraModuleAsyncOptions): DynamicModule {
    if (!options.useFactory && !options.useClass && !options.useExisting) {
      throw new Error('MastraModule.registerAsync() requires one of: useFactory, useClass, or useExisting');
    }

    const providers: Provider[] = [];

    if (options.useFactory) {
      providers.push({
        provide: MASTRA_OPTIONS,
        useFactory: async (...args: any[]) => {
          const resolved = await options.useFactory!(...args);
          return { prefix: '/api', ...resolved };
        },
        inject: options.inject || [],
      });
    } else if (options.useClass) {
      providers.push(
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: MASTRA_OPTIONS,
          useFactory: async (factory: MastraModuleOptionsFactory) => {
            const resolved = await factory.createMastraOptions();
            return { prefix: '/api', ...resolved };
          },
          inject: [options.useClass],
        },
      );
    } else if (options.useExisting) {
      providers.push({
        provide: MASTRA_OPTIONS,
        useFactory: async (factory: MastraModuleOptionsFactory) => {
          const resolved = await factory.createMastraOptions();
          return { prefix: '/api', ...resolved };
        },
        inject: [options.useExisting],
      });
    }

    // Provide MASTRA by extracting from options
    providers.push({
      provide: MASTRA,
      useFactory: (opts: MastraModuleOptions) => opts.mastra,
      inject: [MASTRA_OPTIONS],
    });

    return {
      module: MastraModule,
      imports: options.imports || [],
      // SystemController must come before MastraController so its specific
      // routes (/health, /ready, /info) are matched before the catch-all
      controllers: [SystemController, MastraController],
      providers: [
        ...providers,
        MastraService,
        RouteHandlerService,
        RequestContextService,
        ShutdownService,
        AuthService,
        BodyLimitMiddleware,
        JsonBodyMiddleware,
        // Guards are available for use but NOT registered as APP_GUARD
        // to avoid affecting other modules in the user's app.
        // MastraRouteGuard applies auth + rate limiting only for Mastra routes.
        MastraAuthGuard,
        MastraThrottleGuard,
        MastraRouteGuard,
        TracingInterceptor,
        StreamingInterceptor,
        RequestTrackingInterceptor,
        MastraExceptionFilter,
      ],
      exports: [MASTRA, MastraService],
    };
  }

  /**
   * Configure middleware for the module.
   * Order matters: body limit must run BEFORE JSON parsing.
   *
   * Middleware is scoped to MastraController to avoid affecting other routes
   * in the user's NestJS application.
   */
  configure(consumer: MiddlewareConsumer): void {
    // Apply middleware only to Mastra routes (MastraController)
    // This avoids affecting other controllers in the user's app
    consumer.apply(BodyLimitMiddleware, JsonBodyMiddleware).forRoutes(MastraController);
  }
}
