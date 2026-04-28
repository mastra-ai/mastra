import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap, catchError } from 'rxjs';

import { ShutdownService } from '../services/shutdown.service';

/**
 * Interceptor that tracks requests for graceful shutdown.
 * Also rejects new requests during shutdown.
 */
@Injectable()
export class RequestTrackingInterceptor implements NestInterceptor {
  constructor(@Inject(ShutdownService) private readonly shutdownService: ShutdownService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Reject requests during shutdown
    if (this.shutdownService.shuttingDown) {
      throw new ServiceUnavailableException('Server is shutting down');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestId = this.shutdownService.registerRequest(request.path);

    // Store request ID in request for other middleware/interceptors
    (request as any).mastraRequestId = requestId;

    return next.handle().pipe(
      tap({
        complete: () => {
          this.shutdownService.completeRequest(requestId);
        },
      }),
      catchError(error => {
        this.shutdownService.completeRequest(requestId);
        throw error;
      }),
    );
  }
}
