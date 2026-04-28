import { Busboy } from '@fastify/busboy';
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
      reject(new BadRequestException('Content-Type header is required for multipart requests'));
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
              new BadRequestException(
                `Invalid file type: ${mimetype}. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
              ),
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
            new PayloadTooLargeException(`File size limit exceeded${maxSize ? ` (max: ${formatBytes(maxSize)})` : ''}`),
          );
        });

        file.on('end', () => {
          if (!limitExceeded) {
            result[fieldname] = Buffer.concat(chunks);
          }
        });
      },
    );

    busboy.on('field', (fieldname: string, value: string) => {
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
      reject(new BadRequestException(`Failed to parse multipart form data: ${error.message}`));
    });

    request.pipe(busboy);
  });
}
