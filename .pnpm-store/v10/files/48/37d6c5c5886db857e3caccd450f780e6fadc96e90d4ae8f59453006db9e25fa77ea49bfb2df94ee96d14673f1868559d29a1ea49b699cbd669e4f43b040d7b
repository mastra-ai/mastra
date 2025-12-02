/// <reference types="node" />
import type { Span } from '@opentelemetry/api';
import type { EventEmitter } from 'events';
import type { CALL_SPAN_ENDED } from './serverUtils';
import type { requestCallback, ServerUnaryCall, ServerReadableStream, ServerWritableStream, ServerDuplexStream, Server, Metadata, makeGenericClientConstructor } from '@grpc/grpc-js';
export declare type metadataCaptureType = {
    client: {
        captureRequestMetadata: (span: Span, metadata: Metadata) => void;
        captureResponseMetadata: (span: Span, metadata: Metadata) => void;
    };
    server: {
        captureRequestMetadata: (span: Span, metadata: Metadata) => void;
        captureResponseMetadata: (span: Span, metadata: Metadata) => void;
    };
};
/**
 * Server Unary callback type
 */
export declare type SendUnaryDataCallback<T> = requestCallback<T>;
/**
 * Intersection type of all grpc server call types
 */
export declare type ServerCall<T, U> = ServerUnaryCall<T, U> | ServerReadableStream<T, U> | ServerWritableStream<T, U> | ServerDuplexStream<T, U>;
/**
 * {@link ServerCall} ServerCall extended with misc. missing utility types
 */
export declare type ServerCallWithMeta<T, U> = ServerCall<T, U> & {
    metadata: Metadata;
};
/**
 * EventEmitter with span ended symbol indicator
 */
export declare type GrpcEmitter = EventEmitter & {
    [CALL_SPAN_ENDED]?: boolean;
};
/**
 * Grpc client callback function extended with missing utility types
 */
export declare type GrpcClientFunc = ((...args: unknown[]) => GrpcEmitter) & {
    path: string;
    requestStream: boolean;
    responseStream: boolean;
};
export declare type ServerRegisterFunction = typeof Server.prototype.register;
export declare type ClientRequestFunction<ReturnType> = (...args: unknown[]) => ReturnType;
export declare type MakeClientConstructorFunction = typeof makeGenericClientConstructor;
export type { HandleCall } from '@grpc/grpc-js/build/src/server-call';
export type { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
//# sourceMappingURL=internal-types.d.ts.map