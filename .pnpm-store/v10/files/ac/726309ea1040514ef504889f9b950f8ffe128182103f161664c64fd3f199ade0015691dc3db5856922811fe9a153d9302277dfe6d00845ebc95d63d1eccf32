/*!
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
import { google } from '../protos/firestore_v1_proto_api';
import { Serializer } from './serializer';
import IPlanSummary = google.firestore.v1.IPlanSummary;
import IExecutionStats = google.firestore.v1.IExecutionStats;
import IExplainMetrics = google.firestore.v1.IExplainMetrics;
/**
 * PlanSummary contains information about the planning stage of a query.
 *
 * @class PlanSummary
 */
export declare class PlanSummary implements firestore.PlanSummary {
    readonly indexesUsed: Record<string, unknown>[];
    /**
     * @private
     * @internal
     */
    constructor(indexesUsed: Record<string, unknown>[]);
    /**
     * @private
     * @internal
     */
    static _fromProto(plan: IPlanSummary | null | undefined, serializer: Serializer): PlanSummary;
}
/**
 *  ExecutionStats contains information about the execution of a query.
 *
 * @class ExecutionStats
 */
export declare class ExecutionStats implements firestore.ExecutionStats {
    readonly resultsReturned: number;
    readonly executionDuration: firestore.Duration;
    readonly readOperations: number;
    readonly debugStats: Record<string, unknown>;
    /**
     * @private
     * @internal
     */
    constructor(resultsReturned: number, executionDuration: firestore.Duration, readOperations: number, debugStats: Record<string, unknown>);
    /**
     * @private
     * @internal
     */
    static _fromProto(stats: IExecutionStats | null | undefined, serializer: Serializer): ExecutionStats | null;
}
/**
 * ExplainMetrics contains information about planning and execution of a query.
 *
 * @class ExplainMetrics
 */
export declare class ExplainMetrics implements firestore.ExplainMetrics {
    readonly planSummary: PlanSummary;
    readonly executionStats: ExecutionStats | null;
    /**
     * @private
     * @internal
     */
    constructor(planSummary: PlanSummary, executionStats: ExecutionStats | null);
    /**
     * @private
     * @internal
     */
    static _fromProto(metrics: IExplainMetrics, serializer: Serializer): ExplainMetrics;
}
/**
 * ExplainResults contains information about planning, execution, and results
 * of a query.
 *
 * @class ExplainResults
 */
export declare class ExplainResults<T> implements firestore.ExplainResults<T> {
    readonly metrics: ExplainMetrics;
    readonly snapshot: T | null;
    /**
     * @private
     * @internal
     */
    constructor(metrics: ExplainMetrics, snapshot: T | null);
}
