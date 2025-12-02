import type { Span } from '@opentelemetry/api';
import type { ServerCallWithMeta, SendUnaryDataCallback, HandleCall } from './internal-types';
import type { IgnoreMatcher } from './types';
export declare const CALL_SPAN_ENDED: unique symbol;
/**
 * Patch callback or EventEmitter provided by `originalFunc` and set appropriate `span`
 * properties based on its result.
 */
export declare function handleServerFunction<RequestType, ResponseType>(span: Span, type: string, originalFunc: HandleCall<RequestType, ResponseType>, call: ServerCallWithMeta<RequestType, ResponseType>, callback: SendUnaryDataCallback<unknown>): void;
/**
 * Does not patch any callbacks or EventEmitters to omit tracing on requests
 * that should not be traced.
 */
export declare function handleUntracedServerFunction<RequestType, ResponseType>(type: string, originalFunc: HandleCall<RequestType, ResponseType>, call: ServerCallWithMeta<RequestType, ResponseType>, callback: SendUnaryDataCallback<unknown>): void;
/**
 * Returns true if the server call should not be traced.
 */
export declare function shouldNotTraceServerCall(methodName: string, ignoreGrpcMethods?: IgnoreMatcher[]): boolean;
//# sourceMappingURL=serverUtils.d.ts.map