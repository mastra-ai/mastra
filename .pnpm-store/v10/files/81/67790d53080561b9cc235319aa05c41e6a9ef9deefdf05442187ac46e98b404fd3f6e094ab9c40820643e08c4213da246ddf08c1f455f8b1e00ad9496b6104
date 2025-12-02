"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplainResults = exports.ExplainMetrics = exports.ExecutionStats = exports.PlanSummary = void 0;
/**
 * PlanSummary contains information about the planning stage of a query.
 *
 * @class PlanSummary
 */
class PlanSummary {
    /**
     * @private
     * @internal
     */
    constructor(indexesUsed) {
        this.indexesUsed = indexesUsed;
    }
    /**
     * @private
     * @internal
     */
    static _fromProto(plan, serializer) {
        const indexes = [];
        if (plan && plan.indexesUsed) {
            for (const index of plan.indexesUsed) {
                indexes.push(serializer.decodeGoogleProtobufStruct(index));
            }
        }
        return new PlanSummary(indexes);
    }
}
exports.PlanSummary = PlanSummary;
/**
 *  ExecutionStats contains information about the execution of a query.
 *
 * @class ExecutionStats
 */
class ExecutionStats {
    /**
     * @private
     * @internal
     */
    constructor(resultsReturned, executionDuration, readOperations, debugStats) {
        this.resultsReturned = resultsReturned;
        this.executionDuration = executionDuration;
        this.readOperations = readOperations;
        this.debugStats = debugStats;
    }
    /**
     * @private
     * @internal
     */
    static _fromProto(stats, serializer) {
        var _a, _b;
        if (stats) {
            return new ExecutionStats(Number(stats.resultsReturned), {
                seconds: Number((_a = stats.executionDuration) === null || _a === void 0 ? void 0 : _a.seconds),
                nanoseconds: Number((_b = stats.executionDuration) === null || _b === void 0 ? void 0 : _b.nanos),
            }, Number(stats.readOperations), serializer.decodeGoogleProtobufStruct(stats.debugStats));
        }
        return null;
    }
}
exports.ExecutionStats = ExecutionStats;
/**
 * ExplainMetrics contains information about planning and execution of a query.
 *
 * @class ExplainMetrics
 */
class ExplainMetrics {
    /**
     * @private
     * @internal
     */
    constructor(planSummary, executionStats) {
        this.planSummary = planSummary;
        this.executionStats = executionStats;
    }
    /**
     * @private
     * @internal
     */
    static _fromProto(metrics, serializer) {
        return new ExplainMetrics(PlanSummary._fromProto(metrics.planSummary, serializer), ExecutionStats._fromProto(metrics.executionStats, serializer));
    }
}
exports.ExplainMetrics = ExplainMetrics;
/**
 * ExplainResults contains information about planning, execution, and results
 * of a query.
 *
 * @class ExplainResults
 */
class ExplainResults {
    /**
     * @private
     * @internal
     */
    constructor(metrics, snapshot) {
        this.metrics = metrics;
        this.snapshot = snapshot;
    }
}
exports.ExplainResults = ExplainResults;
//# sourceMappingURL=query-profile.js.map