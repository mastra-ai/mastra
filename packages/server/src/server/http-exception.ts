// Copied from https://github.com/honojs/hono/blob/main/packages/hono/src/http-exception.ts

/**
 * @module
 * This module provides the `HTTPException` class.
 */

import type { ServerErrorCode, ServerProblem } from './error-codes';

type InfoStatusCode = 100 | 101 | 102 | 103;
type SuccessStatusCode = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226;
type DeprecatedStatusCode = 305 | 306;
type RedirectStatusCode = 300 | 301 | 302 | 303 | 304 | DeprecatedStatusCode | 307 | 308;
type ClientErrorStatusCode =
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451;
type ServerErrorStatusCode = 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

/**
 * `UnofficialStatusCode` can be used to specify an unofficial status code.
 * @example
 *
 * ```ts
 * app.get('/unknown', (c) => {
 *   return c.text("Unknown Error", 520 as UnofficialStatusCode)
 * })
 * ```
 */
export type UnofficialStatusCode = -1;

/**
 * If you want to use an unofficial status, use `UnofficialStatusCode`.
 */
export type StatusCode =
  | InfoStatusCode
  | SuccessStatusCode
  | RedirectStatusCode
  | ClientErrorStatusCode
  | ServerErrorStatusCode
  | UnofficialStatusCode;

/**
 * Options for creating an `HTTPException`.
 * @property code - Business error code from `SERVER_ERROR_CODES`, serialized as `problem.code`.
 * @property metadata - Optional JSON-serializable details serialized as `problem.metadata`. Never put stack traces, raw causes or secrets here.
 * @property res - Optional response object to use.
 * @property message - Optional custom error message.
 * @property cause - Optional cause of the error.
 * @property stack - Optional stack trace for the error.
 */
export type HTTPExceptionOptions = {
  code: ServerErrorCode;
  metadata?: Record<string, unknown>;
  res?: Response;
  message?: string;
  cause?: unknown;
  stack?: string;
};

/**
 * `HTTPException` must be used when a fatal error such as authentication failure occurs.
 *
 * @see {@link https://hono.dev/docs/api/exception}
 *
 * @param {StatusCode} status - status code of HTTPException
 * @param {HTTPExceptionOptions} options - options of HTTPException
 * @param {HTTPExceptionOptions["res"]} options.res - response of options of HTTPException
 * @param {HTTPExceptionOptions["message"]} options.message - message of options of HTTPException
 * @param {HTTPExceptionOptions["cause"]} options.cause - cause of options of HTTPException
 *
 * @example
 * ```ts
 * import { HTTPException } from 'hono/http-exception'
 *
 * // ...
 *
 * app.post('/auth', async (c, next) => {
 *   // authentication
 *   if (authorized === false) {
 *     throw new HTTPException(401, { message: 'Custom error message', code: 'AUTHENTICATION_REQUIRED' })
 *   }
 *   await next()
 * })
 * ```
 */
export class HTTPException extends Error {
  readonly res?: Response;
  readonly status: StatusCode;
  readonly problem: ServerProblem;

  /**
   * Creates an instance of `HTTPException`.
   * @param status - HTTP status code for the exception.
   * @param options - Additional options for the exception.
   */
  constructor(status: StatusCode, options: HTTPExceptionOptions) {
    super(options.message, { cause: options.cause });
    this.res = options.res;
    this.status = status;
    this.stack = options.stack || this.stack;
    this.problem = options.metadata ? { code: options.code, metadata: options.metadata } : { code: options.code };
  }

  /**
   * Returns the response object associated with the exception.
   * If a response object is not provided, a JSON `{ error, problem }` response is created with the status code.
   * @returns The response object.
   */
  getResponse(): Response {
    if (this.res) {
      const newResponse = new Response(this.res.body, {
        status: this.status,
        headers: this.res.headers,
      });
      return newResponse;
    }
    return Response.json({ error: this.message, problem: this.problem }, { status: this.status });
  }
}
