import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';

import { MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';
import { DEFAULT_MAX_BODY_SIZE } from '../utils/constants';

/**
 * Middleware that parses JSON request bodies.
 * Uses express.json() with size limits from configuration.
 *
 * This middleware is essential for POST/PUT/PATCH requests to work properly.
 * NestJS does not automatically parse JSON bodies unless body-parser is configured.
 */
@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  private readonly jsonParser: ReturnType<typeof express.json>;

  constructor(@Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions) {
    const maxSize = options.bodyLimitOptions?.maxSize ?? DEFAULT_MAX_BODY_SIZE;

    this.jsonParser = express.json({
      limit: maxSize,
      // Only parse JSON content types
      type: ['application/json', 'application/*+json'],
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip if body is already parsed (e.g., by another middleware)
    if (req.body !== undefined && Object.keys(req.body).length > 0) {
      next();
      return;
    }

    // Skip multipart requests - they're handled separately by route handlers
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      next();
      return;
    }

    this.jsonParser(req, res, next);
  }
}
