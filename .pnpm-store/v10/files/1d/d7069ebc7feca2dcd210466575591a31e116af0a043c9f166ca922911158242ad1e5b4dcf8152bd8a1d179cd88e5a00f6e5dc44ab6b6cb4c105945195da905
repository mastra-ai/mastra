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
import * as protos from '../../protos/firestore_v1_proto_api';
import api = protos.google.firestore.v1;
import { Timestamp } from '../timestamp';
import { ExplainMetrics } from '../query-profile';
import { QueryDocumentSnapshot } from '../document';
import * as firestore from '@google-cloud/firestore';
export interface QueryStreamElement<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> {
    transaction?: Uint8Array;
    readTime?: Timestamp;
    explainMetrics?: ExplainMetrics;
    document?: QueryDocumentSnapshot<AppModelType, DbModelType>;
}
export interface QueryResponse<TSnapshot> {
    transaction?: Uint8Array;
    explainMetrics?: ExplainMetrics;
    result?: TSnapshot;
}
export interface QuerySnapshotResponse<TSnapshot> extends QueryResponse<TSnapshot> {
    result: TSnapshot;
}
/** Internal representation of a query cursor before serialization. */
export interface QueryCursor {
    before: boolean;
    values: api.IValue[];
}
/*!
 * Denotes whether a provided limit is applied to the beginning or the end of
 * the result set.
 */
export declare enum LimitType {
    First = 0,
    Last = 1
}
/**
 * onSnapshot() callback that receives a QuerySnapshot.
 *
 * @callback querySnapshotCallback
 * @param {QuerySnapshot} snapshot A query snapshot.
 */
/**
 * onSnapshot() callback that receives a DocumentSnapshot.
 *
 * @callback documentSnapshotCallback
 * @param {DocumentSnapshot} snapshot A document snapshot.
 */
/**
 * onSnapshot() callback that receives an error.
 *
 * @callback errorCallback
 * @param {Error} err An error from a listen.
 */
