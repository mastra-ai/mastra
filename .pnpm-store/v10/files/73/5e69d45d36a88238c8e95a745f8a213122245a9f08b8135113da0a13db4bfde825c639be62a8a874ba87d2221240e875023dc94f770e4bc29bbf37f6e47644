import { Span } from '@opentelemetry/api';
import { AddressFamily } from './enums/AddressFamily';
import * as dns from 'dns';
import { IgnoreMatcher } from './types';
/**
 * Set error attributes on the span passed in params
 * @param err the error that we use for filling the attributes
 * @param span the span to be set
 * @param nodeVersion the node version
 */
export declare const setError: (err: NodeJS.ErrnoException, span: Span) => void;
/**
 * Returns the family attribute name to be set on the span
 * @param family `4` (ipv4) or `6` (ipv6). `0` means bug.
 * @param [index] `4` (ipv4) or `6` (ipv6). `0` means bug.
 */
export declare const getFamilyAttribute: (family: AddressFamily, index?: number | undefined) => string;
/**
 * Returns the span name
 * @param funcName function name that is wrapped (e.g `lookup`)
 * @param [service] e.g `http`
 */
export declare const getOperationName: (funcName: string, service?: string | undefined) => string;
export declare const setLookupAttributes: (span: Span, address: string | dns.LookupAddress[] | dns.LookupAddress, family?: number | undefined) => void;
/**
 * Check whether the given obj match pattern
 * @param constant e.g URL of request
 * @param obj obj to inspect
 * @param pattern Match pattern
 */
export declare const satisfiesPattern: (constant: string, pattern: IgnoreMatcher) => boolean;
/**
 * Check whether the given dns request is ignored by configuration
 * It will not re-throw exceptions from `list` provided by the client
 * @param constant e.g URL of request
 * @param [list] List of ignore patterns
 * @param [onException] callback for doing something when an exception has
 *     occurred
 */
export declare const isIgnored: (constant: string, list?: IgnoreMatcher | IgnoreMatcher[] | undefined, onException?: ((error: Error) => void) | undefined) => boolean;
//# sourceMappingURL=utils.d.ts.map