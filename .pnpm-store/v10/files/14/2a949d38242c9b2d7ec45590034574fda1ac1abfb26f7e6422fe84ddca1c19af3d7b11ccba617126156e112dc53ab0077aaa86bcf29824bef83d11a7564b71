import { HTTPError } from '../errors/HTTPError.js';
import { TimeoutError } from '../errors/TimeoutError.js';
/**
 * Type guard to check if an error is a Ky error (HTTPError or TimeoutError).
 *
 * @param error - The error to check
 * @returns `true` if the error is a Ky error, `false` otherwise
 *
 * @example
 * ```
 * import ky, {isKyError} from 'ky';
 * try {
 *   const response = await ky.get('/api/data');
 * } catch (error) {
 *   if (isKyError(error)) {
 *     // Handle Ky-specific errors
 *     console.log('Ky error occurred:', error.message);
 *   } else {
 *     // Handle other errors
 *     console.log('Unknown error:', error);
 *   }
 * }
 * ```
 */
export declare function isKyError(error: unknown): error is HTTPError | TimeoutError;
/**
 * Type guard to check if an error is an HTTPError.
 *
 * @param error - The error to check
 * @returns `true` if the error is an HTTPError, `false` otherwise
 *
 * @example
 * ```
 * import ky, {isHTTPError} from 'ky';
 * try {
 *   const response = await ky.get('/api/data');
 * } catch (error) {
 *   if (isHTTPError(error)) {
 *     console.log('HTTP error status:', error.response.status);
 *   }
 * }
 * ```
 */
export declare function isHTTPError<T = unknown>(error: unknown): error is HTTPError<T>;
/**
 * Type guard to check if an error is a TimeoutError.
 *
 * @param error - The error to check
 * @returns `true` if the error is a TimeoutError, `false` otherwise
 *
 * @example
 * ```
 * import ky, {isTimeoutError} from 'ky';
 * try {
 *   const response = await ky.get('/api/data', { timeout: 1000 });
 * } catch (error) {
 *   if (isTimeoutError(error)) {
 *     console.log('Request timed out:', error.request.url);
 *   }
 * }
 * ```
 */
export declare function isTimeoutError(error: unknown): error is TimeoutError;
