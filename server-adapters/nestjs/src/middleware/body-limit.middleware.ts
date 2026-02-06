import { Inject, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { DEFAULT_MAX_BODY_SIZE } from '../utils/constants';
import { formatBytes } from '../utils/format';

/**
 * Middleware that enforces body size limits via Content-Length header.
 *
 * This middleware runs BEFORE body parsers and provides early rejection
 * of oversized payloads based on the Content-Length header.
 *
 * Note: JSON body size limits are also enforced by JsonBodyMiddleware's
 * express.json({ limit: ... }) configuration, which handles both
 * Content-Length validation and streaming body parsing.
 *
 * For multipart requests, size limits are enforced by Busboy in the
 * route handler service.
 */
@Injectable()
export class BodyLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BodyLimitMiddleware.name);
  private readonly maxSize: number;

  constructor(@Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions) {
    this.maxSize = options.bodyLimitOptions?.maxSize ?? DEFAULT_MAX_BODY_SIZE;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Only check body size for methods that typically have bodies
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      next();
      return;
    }

    // Check Content-Length for early rejection of oversized payloads
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const length = parseInt(contentLength, 10);
      if (!isNaN(length) && length > this.maxSize) {
        this.logger.warn(`Request body too large: ${length} bytes exceeds ${this.maxSize} bytes limit`);
        throw new PayloadTooLargeException(`Request body too large. Maximum size is ${formatBytes(this.maxSize)}.`);
      }
    }

    // Note: Chunked transfer encoding (no Content-Length) is handled by:
    // - express.json({ limit: ... }) for JSON bodies
    // - Busboy limits for multipart bodies
    // Attaching a 'data' listener here would race with body parsers.

    next();
  }
}
