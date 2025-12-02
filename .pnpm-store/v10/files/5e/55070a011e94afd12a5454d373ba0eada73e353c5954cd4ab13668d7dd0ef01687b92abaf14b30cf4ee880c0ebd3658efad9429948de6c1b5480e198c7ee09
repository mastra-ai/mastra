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
import { Timestamp } from '../timestamp';
import { AggregateQuery } from './aggregate-query';
/**
 * The results of executing an aggregation query.
 */
export declare class AggregateQuerySnapshot<AggregateSpecType extends firestore.AggregateSpec, AppModelType = firestore.DocumentData, DbModelType extends firestore.DocumentData = firestore.DocumentData> implements firestore.AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType> {
    private readonly _query;
    private readonly _readTime;
    private readonly _data;
    /**
     * @internal
     *
     * @param _query The query that was executed to produce this result.
     * @param _readTime The time this snapshot was read.
     * @param _data The results of the aggregations performed over the underlying
     * query.
     */
    constructor(_query: AggregateQuery<AggregateSpecType, AppModelType, DbModelType>, _readTime: Timestamp, _data: firestore.AggregateSpecData<AggregateSpecType>);
    /** The query that was executed to produce this result. */
    get query(): AggregateQuery<AggregateSpecType, AppModelType, DbModelType>;
    /** The time this snapshot was read. */
    get readTime(): Timestamp;
    /**
     * Returns the results of the aggregations performed over the underlying
     * query.
     *
     * The keys of the returned object will be the same as those of the
     * `AggregateSpec` object specified to the aggregation method, and the
     * values will be the corresponding aggregation result.
     *
     * @returns The results of the aggregations performed over the underlying
     * query.
     */
    data(): firestore.AggregateSpecData<AggregateSpecType>;
    /**
     * Compares this object with the given object for equality.
     *
     * Two `AggregateQuerySnapshot` instances are considered "equal" if they
     * have the same data and their underlying queries compare "equal" using
     * `AggregateQuery.isEqual()`.
     *
     * @param other The object to compare to this object for equality.
     * @return `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other: firestore.AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>): boolean;
}
