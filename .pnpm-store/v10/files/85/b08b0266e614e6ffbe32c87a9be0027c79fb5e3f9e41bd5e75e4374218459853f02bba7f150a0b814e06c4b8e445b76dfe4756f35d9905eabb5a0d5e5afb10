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
import * as firestore from '@google-cloud/firestore';
import { ResourcePath } from '../path';
import { FilterInternal } from './filter-internal';
import { FieldOrder } from './field-order';
import { LimitType, QueryCursor } from './types';
/**
 * Internal class representing custom Query options.
 *
 * These options are immutable. Modified options can be created using `with()`.
 * @private
 * @internal
 */
export declare class QueryOptions<AppModelType, DbModelType extends firestore.DocumentData> {
    readonly parentPath: ResourcePath;
    readonly collectionId: string;
    readonly converter: firestore.FirestoreDataConverter<AppModelType, DbModelType>;
    readonly allDescendants: boolean;
    readonly filters: FilterInternal[];
    readonly fieldOrders: FieldOrder[];
    readonly startAt?: QueryCursor | undefined;
    readonly endAt?: QueryCursor | undefined;
    readonly limit?: number | undefined;
    readonly limitType?: LimitType | undefined;
    readonly offset?: number | undefined;
    readonly projection?: api.StructuredQuery.IProjection | undefined;
    readonly kindless: boolean;
    readonly requireConsistency: boolean;
    constructor(parentPath: ResourcePath, collectionId: string, converter: firestore.FirestoreDataConverter<AppModelType, DbModelType>, allDescendants: boolean, filters: FilterInternal[], fieldOrders: FieldOrder[], startAt?: QueryCursor | undefined, endAt?: QueryCursor | undefined, limit?: number | undefined, limitType?: LimitType | undefined, offset?: number | undefined, projection?: api.StructuredQuery.IProjection | undefined, kindless?: boolean, requireConsistency?: boolean);
    /**
     * Returns query options for a collection group query.
     * @private
     * @internal
     */
    static forCollectionGroupQuery<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData>(collectionId: string, converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>): QueryOptions<AppModelType, DbModelType>;
    /**
     * Returns query options for a single-collection query.
     * @private
     * @internal
     */
    static forCollectionQuery<AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData>(collectionRef: ResourcePath, converter?: firestore.FirestoreDataConverter<AppModelType, DbModelType>): QueryOptions<AppModelType, DbModelType>;
    /**
     * Returns query options for a query that fetches all descendants under the
     * specified reference.
     *
     * @private
     * @internal
     */
    static forKindlessAllDescendants(parent: ResourcePath, id: string, requireConsistency?: boolean): QueryOptions<firestore.DocumentData, firestore.DocumentData>;
    /**
     * Returns the union of the current and the provided options.
     * @private
     * @internal
     */
    with(settings: Partial<Omit<QueryOptions<AppModelType, DbModelType>, 'converter'>>): QueryOptions<AppModelType, DbModelType>;
    withConverter<NewAppModelType, NewDbModelType extends firestore.DocumentData = firestore.DocumentData>(converter: firestore.FirestoreDataConverter<NewAppModelType, NewDbModelType>): QueryOptions<NewAppModelType, NewDbModelType>;
    hasFieldOrders(): boolean;
    isEqual(other: QueryOptions<AppModelType, DbModelType>): boolean;
    private filtersEqual;
}
