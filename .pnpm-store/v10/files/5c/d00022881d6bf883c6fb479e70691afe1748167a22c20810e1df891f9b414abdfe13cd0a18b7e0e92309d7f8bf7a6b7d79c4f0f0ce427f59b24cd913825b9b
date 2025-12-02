/**
 * Copyright 2024 Google LLC. All Rights Reserved.
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
import * as firestore from '@google-cloud/firestore';
import { GoogleError } from 'google-gax';
import { Serializer } from '../serializer';
import { Timestamp } from '../timestamp';
import { VectorQuery } from './vector-query';
import { Query } from './query';
import Firestore from '../index';
import { QueryOptions } from './query-options';
import { QueryResponse } from './types';
import * as protos from '../../protos/firestore_v1_proto_api';
import api = protos.google.firestore.v1;
export declare class QueryUtil<AppModelType, DbModelType extends firestore.DocumentData, Template extends Query<AppModelType, DbModelType> | VectorQuery<AppModelType, DbModelType>> {
    /** @private */
    readonly _firestore: Firestore;
    /** @private */
    readonly _queryOptions: QueryOptions<AppModelType, DbModelType>;
    /** @private */
    readonly _serializer: Serializer;
    constructor(
    /** @private */
    _firestore: Firestore, 
    /** @private */
    _queryOptions: QueryOptions<AppModelType, DbModelType>, 
    /** @private */
    _serializer: Serializer);
    _getResponse(query: Template, transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, retryWithCursor?: boolean, explainOptions?: firestore.ExplainOptions): Promise<QueryResponse<ReturnType<Template['_createSnapshot']>>>;
    _isPermanentRpcError(err: GoogleError, methodName: string): boolean;
    _hasRetryTimedOut(methodName: string, startTime: number): boolean;
    stream(query: Template): NodeJS.ReadableStream;
    _stream(query: Template, transactionOrReadTime?: Uint8Array | Timestamp | api.ITransactionOptions, retryWithCursor?: boolean, explainOptions?: firestore.ExplainOptions): NodeJS.ReadableStream;
}
