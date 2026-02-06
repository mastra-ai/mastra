import { RequestContext } from '@mastra/core/request-context';
import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request, Response } from 'express';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

/**
 * REQUEST-scoped service that manages request context and abort signaling.
 * Created fresh for each HTTP request.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private readonly logger = new Logger(RequestContextService.name);
  private readonly abortController: AbortController;
  private readonly context: RequestContext;
  private isAborted = false;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
  ) {
    this.abortController = new AbortController();
    this.context = this.parseRequestContext();
    this.setupAbortHandling();
  }

  /**
   * Get the abort signal for this request.
   * Use this to detect client disconnection.
   */
  get abortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Get the parsed request context.
   */
  get requestContext(): RequestContext {
    return this.context;
  }

  /**
   * Set the authenticated user on the request context.
   * Should be called after successful authentication.
   */
  setUser(user: unknown): void {
    this.context.set('user', user);
  }

  /**
   * Parse request context from body or query parameters.
   */
  private parseRequestContext(): RequestContext {
    const context = new RequestContext();

    try {
      if (this.request.method === 'POST' || this.request.method === 'PUT' || this.request.method === 'PATCH') {
        if (this.request.body?.requestContext) {
          this.mergeContext(context, this.request.body.requestContext);
        }
      }

      if (this.request.method === 'GET') {
        const encodedContext = this.request.query.requestContext;
        if (typeof encodedContext === 'string') {
          const parsed = this.parseEncodedContext(encodedContext);
          if (parsed) {
            this.mergeContext(context, parsed);
          }
        }
      }
    } catch (error) {
      if (this.options.contextOptions?.logWarnings !== false) {
        this.logger.warn(`Failed to parse request context: ${error instanceof Error ? error.message : String(error)}`);
      }

      // In strict mode, throw the error
      if (this.options.contextOptions?.strict) {
        throw error;
      }
    }

    return context;
  }

  /**
   * Parse encoded context from query parameter.
   * Supports both plain JSON and base64-encoded JSON.
   */
  private parseEncodedContext(encoded: string): Record<string, unknown> | null {
    // Try plain JSON first
    try {
      return JSON.parse(encoded);
    } catch {
      // Try base64-encoded JSON
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      } catch {
        if (this.options.contextOptions?.logWarnings !== false) {
          this.logger.warn('Failed to decode request context (tried JSON and base64)');
        }
        return null;
      }
    }
  }

  /**
   * Merge parsed context values into the RequestContext.
   */
  private mergeContext(context: RequestContext, values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      context.set(key, value);
    }
  }

  /**
   * Setup abort handling for client disconnection.
   */
  private setupAbortHandling(): void {
    const response = this.request.res as Response | undefined;
    if (!response) return;

    // Use response 'close' event - fires when connection is actually closed
    // (unlike request 'close' which fires when body is consumed)
    response.on('close', () => {
      // Only abort if response wasn't successfully completed
      if (!response.writableFinished && !this.isAborted) {
        this.isAborted = true;
        try {
          this.abortController.abort();
        } catch {
          // Ignore abort errors
        }
      }
    });
  }

  /**
   * Manually trigger abort (e.g., during shutdown).
   */
  abort(): void {
    if (!this.isAborted) {
      this.isAborted = true;
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort errors
      }
    }
  }
}
