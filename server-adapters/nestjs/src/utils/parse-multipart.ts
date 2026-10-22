import { Busboy } from '@fastify/busboy';
import { SERVER_ERROR_CODES } from '@mastra/server/error-codes';
import { isSafeObjectKey } from '@mastra/server/server-adapter';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';

import { formatBytes } from './format';

export interface MultipartOptions {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types for file uploads */
  allowedMimeTypes?: string[];
}

/**
 * Parse multipart/form-data using @fastify/busboy.
 * Converts file uploads to Buffers and parses JSON field values.
 *
 * This matches the behavior of the Express adapter's parseMultipartFormData().
 *
 * @param request - The Express request object
 * @param options - Multipart parsing options
 */
export function parseMultipartFormData(
  request: Request,
  options: MultipartOptions = {},
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const result: Record<string, unknown> = {};

    const contentType = request.headers['content-type'];
    if (!contentType) {
      reject(
        new BadRequestException({
          message: 'Content-Type header is required for multipart requests',
          code: SERVER_ERROR_CODES.REQUEST_MULTIPART_INVALID,
        }),
      );
      return;
    }

    const busboy = new Busboy({
      headers: {
        'content-type': contentType,
      },
      limits: options.maxFileSize ? { fileSize: options.maxFileSize } : undefined,
    });

    busboy.on(
      'file',
      (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
        // Validate MIME type if allowedMimeTypes is specified
        if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
          if (!options.allowedMimeTypes.includes(mimetype)) {
            file.resume(); // Drain the stream
            reject(
              new BadRequestException({
                message: `Invalid file type: ${mimetype}. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
                code: SERVER_ERROR_CODES.REQUEST_FILE_TYPE_NOT_ALLOWED,
                metadata: { mimetype },
              }),
            );
            return;
          }
        }

        const chunks: Buffer[] = [];
        let limitExceeded = false;

        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on('limit', () => {
          limitExceeded = true;
          const maxSize = options.maxFileSize;
          reject(
            new PayloadTooLargeException({
              message: `File size limit exceeded${maxSize ? ` (max: ${formatBytes(maxSize)})` : ''}`,
              code: SERVER_ERROR_CODES.REQUEST_FILE_TOO_LARGE,
            }),
          );
        });

        file.on('end', () => {
          if (!limitExceeded && isSafeObjectKey(fieldname)) {
            result[fieldname] = Buffer.concat(chunks);
          }
        });
      },
    );

    busboy.on('field', (fieldname: string, value: string) => {
      if (!isSafeObjectKey(fieldname)) {
        return;
      }
      // Try to parse JSON strings (like 'options')
      try {
        result[fieldname] = JSON.parse(value);
      } catch {
        result[fieldname] = value;
      }
    });

    busboy.on('finish', () => {
      resolve(result);
    });

    busboy.on('error', (error: Error) => {
      reject(
        new BadRequestException({
          message: `Failed to parse multipart form data: ${error.message}`,
          code: SERVER_ERROR_CODES.REQUEST_MULTIPART_INVALID,
        }),
      );
    });

    request.pipe(busboy);
  });
}
