import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import { redactStreamChunk } from '@mastra/server/server-adapter';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, from, of, switchMap } from 'rxjs';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import type { RouteHandlerResult } from '../services/route-handler.service';
import { ShutdownService } from '../services/shutdown.service';

/**
 * Interceptor that handles streaming responses and MCP transports.
 * Converts ReadableStream results to chunked HTTP responses.
 */
@Injectable()
export class StreamingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StreamingInterceptor.name);
  private readonly normalizedPrefix: string;
  private readonly heartbeatMs: number | null;

  constructor(
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(ShutdownService) private readonly shutdownService: ShutdownService,
  ) {
    // Normalize prefix once at construction time
    // Ensure it has leading slash but no trailing slash
    let prefix = options.prefix || '';
    if (prefix && !prefix.startsWith('/')) {
      prefix = '/' + prefix;
    }
    if (prefix.endsWith('/')) {
      prefix = prefix.slice(0, -1);
    }
    this.normalizedPrefix = prefix;

    const configuredHeartbeat = this.options.streamOptions?.heartbeatMs;
    if (configuredHeartbeat === undefined || configuredHeartbeat === null) {
      this.heartbeatMs = null;
    } else if (configuredHeartbeat <= 0) {
      this.heartbeatMs = null;
    } else {
      this.heartbeatMs = configuredHeartbeat;
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      switchMap((result: RouteHandlerResult | unknown) => {
        const type = this.getResultType(result);
        const handlerResult = result as RouteHandlerResult;

        switch (type) {
          case 'stream':
            return from(this.handleStreaming(context, handlerResult));
          case 'datastream-response':
            return from(this.handleDatastream(context, handlerResult));
          case 'mcp-http':
            return from(this.handleMcpHttp(context, handlerResult));
          case 'mcp-sse':
            return from(this.handleMcpSse(context, handlerResult));
          case 'json':
            return of(handlerResult.data);
          default:
            return of(result);
        }
      }),
    );
  }

  /**
   * Determine the response type of a handler result, or null if it's not
   * a recognized RouteHandlerResult.
   */
  private getResultType(result: unknown): RouteHandlerResult['responseType'] | null {
    if (result === null || typeof result !== 'object' || !('responseType' in result)) {
      return null;
    }

    const responseType = (result as RouteHandlerResult).responseType;

    // For stream results, verify the data is actually streamable
    if (responseType === 'stream' && 'data' in result) {
      const data = (result as RouteHandlerResult).data;
      const isStreamable =
        data !== null &&
        typeof data === 'object' &&
        ('fullStream' in data || typeof (data as any).getReader === 'function');
      return isStreamable ? 'stream' : null;
    }

    // For JSON results, verify data is present
    if (responseType === 'json') {
      return 'data' in result ? 'json' : null;
    }

    return responseType;
  }

  /**
   * Handle streaming response - write chunks to response.
   */
  private async handleStreaming(context: ExecutionContext, result: RouteHandlerResult): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const streamFormat = result.streamFormat || 'stream';
    const shouldRedact = this.options.streamOptions?.redact ?? true;
    const shouldHeartbeat = streamFormat === 'sse' && this.heartbeatMs !== null;

    // Set headers for streaming
    response.setHeader('Content-Type', streamFormat === 'sse' ? 'text/event-stream' : 'text/plain');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Transfer-Encoding', 'chunked');

    if (streamFormat === 'sse') {
      response.setHeader('X-Accel-Buffering', 'no');
    }

    const data = result.data;
    const hasFullStream = data !== null && typeof data === 'object' && 'fullStream' in data;
    const stream = hasFullStream ? (data as { fullStream: ReadableStream }).fullStream : (data as ReadableStream);
    const reader = stream.getReader();
    const unregisterSse = streamFormat === 'sse' ? this.shutdownService.registerSseClient(response) : null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    if (shouldHeartbeat) {
      heartbeatInterval = setInterval(() => {
        if (!response.writableFinished) {
          response.write(':keep-alive\n\n');
        }
      }, this.heartbeatMs);
    }

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          // Optionally redact sensitive data
          const outputValue = shouldRedact ? redactStreamChunk(value) : value;

          if (streamFormat === 'sse') {
            response.write(`data: ${JSON.stringify(outputValue)}\n\n`);
          } else {
            // Use record separator (\x1E) for stream format
            response.write(JSON.stringify(outputValue) + '\x1E');
          }
        }
      }
    } catch (error) {
      // Log error but don't throw - stream may have been aborted by client
      if (!response.writableFinished) {
        this.logger.error('Stream error:', error);
      }
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (unregisterSse) {
        unregisterSse();
      }
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors
      }

      if (!response.writableFinished) {
        response.end();
      }
    }
  }

  /**
   * Handle datastream response (AI SDK Response).
   */
  private async handleDatastream(context: ExecutionContext, result: RouteHandlerResult): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const fetchResponse = result.data as globalThis.Response;

    // Copy headers from the Response object
    fetchResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });

    response.status(fetchResponse.status);

    if (fetchResponse.body) {
      const reader = fetchResponse.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          response.write(value);
        }
      } finally {
        response.end();
      }
    } else {
      response.end();
    }
  }

  /**
   * Handle MCP HTTP transport response.
   */
  private async handleMcpHttp(context: ExecutionContext, result: RouteHandlerResult): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { server, httpPath, mcpOptions: routeMcpOptions } = result.data as MCPHttpTransportResult;

    try {
      // Merge module-level mcpOptions with route-specific options (route takes precedence)
      const options = { ...this.options.mcpOptions, ...routeMcpOptions };
      const requestUrl = (request as Request & { originalUrl?: string }).originalUrl ?? request.url;

      await server.startHTTP({
        url: new URL(requestUrl, `http://${request.headers.host}`),
        httpPath: `${this.normalizedPrefix}${httpPath}`,
        req: request,
        res: response,
        options: Object.keys(options).length > 0 ? options : undefined,
      });
      // Response handled by startHTTP. Keep the interceptor alive until the response finishes.
      await new Promise<void>(resolve => {
        if (response.writableFinished) {
          resolve();
          return;
        }
        response.once('finish', resolve);
        response.once('close', resolve);
      });
    } catch (error) {
      this.logger.error('MCP HTTP transport error:', error);
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }

  /**
   * Handle MCP SSE transport response.
   */
  private async handleMcpSse(context: ExecutionContext, result: RouteHandlerResult): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { server, ssePath, messagePath } = result.data as MCPSseTransportResult;

    try {
      const requestUrl = (request as Request & { originalUrl?: string }).originalUrl ?? request.url;

      await server.startSSE({
        url: new URL(requestUrl, `http://${request.headers.host}`),
        ssePath: `${this.normalizedPrefix}${ssePath}`,
        messagePath: `${this.normalizedPrefix}${messagePath}`,
        req: request,
        res: response,
      });
      // Response handled by startSSE
      await new Promise<void>(resolve => {
        if (response.writableFinished) {
          resolve();
          return;
        }
        response.once('close', resolve);
      });
    } catch (error) {
      this.logger.error('MCP SSE transport error:', error);
      if (!response.headersSent) {
        response.status(500).json({ error: 'Error handling MCP SSE request' });
      }
    }
  }
}
