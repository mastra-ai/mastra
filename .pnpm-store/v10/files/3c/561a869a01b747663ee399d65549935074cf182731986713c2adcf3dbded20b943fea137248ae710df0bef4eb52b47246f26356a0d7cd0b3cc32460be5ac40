/**
 * Copyright 2023 Google LLC. All Rights Reserved.
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
import { FieldPath } from './path';
import { google } from '../protos/firestore_v1_proto_api';
import IAggregation = google.firestore.v1.StructuredAggregationQuery.IAggregation;
/**
 * Concrete implementation of the Aggregate type.
 */
export declare class Aggregate {
    readonly alias: string;
    readonly aggregateType: AggregateType;
    readonly fieldPath?: (string | FieldPath) | undefined;
    constructor(alias: string, aggregateType: AggregateType, fieldPath?: (string | FieldPath) | undefined);
    /**
     * Converts this object to the proto representation of an Aggregate.
     * @internal
     */
    toProto(): IAggregation;
}
/**
 * Represents an aggregation that can be performed by Firestore.
 */
export declare class AggregateField<T> implements firestore.AggregateField<T> {
    readonly aggregateType: AggregateType;
    /** A type string to uniquely identify instances of this class. */
    readonly type = "AggregateField";
    /**
     * The field on which the aggregation is performed.
     * @internal
     **/
    readonly _field?: string | FieldPath;
    /**
     * Create a new AggregateField<T>
     * @param aggregateType Specifies the type of aggregation operation to perform.
     * @param field Optionally specifies the field that is aggregated.
     * @internal
     */
    private constructor();
    /**
     * Compares this object with the given object for equality.
     *
     * This object is considered "equal" to the other object if and only if
     * `other` performs the same kind of aggregation on the same field (if any).
     *
     * @param other The object to compare to this object for equality.
     * @return `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other: AggregateField<T>): boolean;
    /**
     * Create an AggregateField object that can be used to compute the count of
     * documents in the result set of a query.
     */
    static count(): AggregateField<number>;
    /**
     * Create an AggregateField object that can be used to compute the average of
     * a specified field over a range of documents in the result set of a query.
     * @param field Specifies the field to average across the result set.
     */
    static average(field: string | FieldPath): AggregateField<number | null>;
    /**
     * Create an AggregateField object that can be used to compute the sum of
     * a specified field over a range of documents in the result set of a query.
     * @param field Specifies the field to sum across the result set.
     */
    static sum(field: string | FieldPath): AggregateField<number>;
}
/**
 * A type whose property values are all `AggregateField` objects.
 */
export interface AggregateSpec {
    [field: string]: AggregateFieldType;
}
/**
 * The union of all `AggregateField` types that are supported by Firestore.
 */
export type AggregateFieldType = ReturnType<typeof AggregateField.count> | ReturnType<typeof AggregateField.sum> | ReturnType<typeof AggregateField.average>;
/**
 * Union type representing the aggregate type to be performed.
 */
export type AggregateType = 'count' | 'avg' | 'sum';
