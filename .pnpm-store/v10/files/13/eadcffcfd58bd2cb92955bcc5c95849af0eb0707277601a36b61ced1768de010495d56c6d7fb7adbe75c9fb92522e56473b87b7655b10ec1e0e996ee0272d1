/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { FirestoreDataConverter, DocumentData } from '@google-cloud/firestore';
import { CallOptions } from 'google-gax';
import { Duplex } from 'stream';
import { google } from '../protos/firestore_v1_proto_api';
import { FieldPath } from './path';
import api = google.firestore.v1;
/**
 * A map in the format of the Proto API
 */
export interface ApiMapValue {
    [k: string]: google.firestore.v1.IValue;
}
/**
 * The subset of methods we use from FirestoreClient.
 *
 * We don't depend on the actual Gapic client to avoid loading the GAX stack at
 * module initialization time.
 */
export interface GapicClient {
    getProjectId(): Promise<string>;
    beginTransaction(request: api.IBeginTransactionRequest, options?: CallOptions): Promise<[api.IBeginTransactionResponse, unknown, unknown]>;
    commit(request: api.ICommitRequest, options?: CallOptions): Promise<[api.ICommitResponse, unknown, unknown]>;
    batchWrite(request: api.IBatchWriteRequest, options?: CallOptions): Promise<[api.IBatchWriteResponse, unknown, unknown]>;
    rollback(request: api.IRollbackRequest, options?: CallOptions): Promise<[google.protobuf.IEmpty, unknown, unknown]>;
    batchGetDocuments(request?: api.IBatchGetDocumentsRequest, options?: CallOptions): Duplex;
    runQuery(request?: api.IRunQueryRequest, options?: CallOptions): Duplex;
    runAggregationQuery(request?: api.IRunAggregationQueryRequest, options?: CallOptions): Duplex;
    listDocuments(request: api.IListDocumentsRequest, options?: CallOptions): Promise<[api.IDocument[], unknown, unknown]>;
    listCollectionIds(request: api.IListCollectionIdsRequest, options?: CallOptions): Promise<[string[], unknown, unknown]>;
    listen(options?: CallOptions): Duplex;
    partitionQueryStream(request?: api.IPartitionQueryRequest, options?: CallOptions): Duplex;
    close(): Promise<void>;
}
/** Request/response methods used in the Firestore SDK. */
export type FirestoreUnaryMethod = 'listDocuments' | 'listCollectionIds' | 'rollback' | 'beginTransaction' | 'commit' | 'batchWrite';
/** Streaming methods used in the Firestore SDK. */
export type FirestoreStreamingMethod = 'listen' | 'partitionQueryStream' | 'runQuery' | 'runAggregationQuery' | 'batchGetDocuments';
/** Type signature for the unary methods in the GAPIC layer. */
export type UnaryMethod<Req, Resp> = (request: Req, callOptions: CallOptions) => Promise<[Resp, unknown, unknown]>;
export type RBTree = any;
/**
 * A default converter to use when none is provided.
 * @private
 * @internal
 */
export declare function defaultConverter<AppModelType, DbModelType extends DocumentData>(): FirestoreDataConverter<AppModelType, DbModelType>;
/**
 * Update data that has been resolved to a mapping of FieldPaths to values.
 */
export type UpdateMap = Map<FieldPath, unknown>;
/**
 * Internal user data validation options.
 * @private
 * @internal
 */
export interface ValidationOptions {
    /** At what level field deletes are supported. */
    allowDeletes: 'none' | 'root' | 'all';
    /** Whether server transforms are supported. */
    allowTransforms: boolean;
    /**
     * Whether undefined values are allowed. Undefined values cannot appear at
     * the root.
     */
    allowUndefined: boolean;
}
/**
 * A Firestore Proto value in ProtoJs format.
 * @private
 * @internal
 */
export interface ProtobufJsValue extends api.IValue {
    valueType?: string;
}
