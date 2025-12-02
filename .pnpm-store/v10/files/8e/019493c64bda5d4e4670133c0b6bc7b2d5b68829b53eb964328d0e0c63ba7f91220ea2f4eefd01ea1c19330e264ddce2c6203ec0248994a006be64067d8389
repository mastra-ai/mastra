/// <reference types="node" />
import type { EventEmitter } from 'events';
import type { Span } from '@opentelemetry/api';
import type { Client, Metadata } from '@grpc/grpc-js';
import type * as grpcJs from '@grpc/grpc-js';
import type { GrpcInstrumentation } from './';
import type { GrpcClientFunc, SendUnaryDataCallback, metadataCaptureType } from './internal-types';
/**
 * Parse a package method list and return a list of methods to patch
 * with both possible casings e.g. "TestMethod" & "testMethod"
 */
export declare function getMethodsToWrap(this: GrpcInstrumentation, client: typeof Client, methods: {
    [key: string]: {
        originalName?: string;
    };
}): string[];
/**
 * Patches a callback so that the current span for this trace is also ended
 * when the callback is invoked.
 */
export declare function patchedCallback(span: Span, callback: SendUnaryDataCallback<ResponseType>): SendUnaryDataCallback<ResponseType>;
export declare function patchResponseMetadataEvent(span: Span, call: EventEmitter, metadataCapture: metadataCaptureType): void;
export declare function patchResponseStreamEvents(span: Span, call: EventEmitter): void;
/**
 * Execute grpc client call. Apply completion span properties and end the
 * span on callback or receiving an emitted event.
 */
export declare function makeGrpcClientRemoteCall(metadataCapture: metadataCaptureType, original: GrpcClientFunc, args: unknown[], metadata: grpcJs.Metadata, self: grpcJs.Client): (span: Span) => EventEmitter;
export declare function getMetadataIndex(args: Array<unknown | Metadata>): number;
/**
 * Returns the metadata argument from user provided arguments (`args`)
 * If no metadata is provided in `args`: adds empty metadata to `args` and returns that empty metadata
 */
export declare function extractMetadataOrSplice(grpcLib: typeof grpcJs, args: Array<unknown | grpcJs.Metadata>, spliceIndex: number): Metadata;
/**
 * Returns the metadata argument from user provided arguments (`args`)
 * Adds empty metadata to arguments if the default is used.
 */
export declare function extractMetadataOrSpliceDefault(grpcClient: typeof grpcJs, original: GrpcClientFunc, args: Array<unknown | grpcJs.Metadata>): grpcJs.Metadata;
/**
 * Inject opentelemetry trace context into `metadata` for use by another
 * grpc receiver
 * @param metadata
 */
export declare function setSpanContext(metadata: Metadata): void;
//# sourceMappingURL=clientUtils.d.ts.map