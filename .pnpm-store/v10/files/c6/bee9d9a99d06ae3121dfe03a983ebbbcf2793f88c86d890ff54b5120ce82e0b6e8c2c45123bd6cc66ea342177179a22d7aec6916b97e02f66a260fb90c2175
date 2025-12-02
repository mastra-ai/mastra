"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamodbServiceExtension = void 0;
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
class DynamodbServiceExtension {
    toArray(values) {
        return Array.isArray(values) ? values : [values];
    }
    requestPreSpanHook(normalizedRequest, config, diag) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        const spanKind = api_1.SpanKind.CLIENT;
        let spanName;
        const isIncoming = false;
        const operation = normalizedRequest.commandName;
        const spanAttributes = {
            [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_DYNAMODB,
            [semantic_conventions_1.SEMATTRS_DB_NAME]: (_a = normalizedRequest.commandInput) === null || _a === void 0 ? void 0 : _a.TableName,
            [semantic_conventions_1.SEMATTRS_DB_OPERATION]: operation,
        };
        if (config.dynamoDBStatementSerializer) {
            try {
                const sanitizedStatement = config.dynamoDBStatementSerializer(operation, normalizedRequest.commandInput);
                if (typeof sanitizedStatement === 'string') {
                    spanAttributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = sanitizedStatement;
                }
            }
            catch (err) {
                diag.error('failed to sanitize DynamoDB statement', err);
            }
        }
        // normalizedRequest.commandInput.RequestItems) is undefined when no table names are returned
        // keys in this object are the table names
        if ((_b = normalizedRequest.commandInput) === null || _b === void 0 ? void 0 : _b.TableName) {
            // Necessary for commands with only 1 table name (example: CreateTable). Attribute is TableName not keys of RequestItems
            // single table name returned for operations like CreateTable
            spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_NAMES] = [
                normalizedRequest.commandInput.TableName,
            ];
        }
        else if ((_c = normalizedRequest.commandInput) === null || _c === void 0 ? void 0 : _c.RequestItems) {
            spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_NAMES] = Object.keys(normalizedRequest.commandInput.RequestItems);
        }
        if (operation === 'CreateTable' || operation === 'UpdateTable') {
            // only check for ProvisionedThroughput since ReadCapacityUnits and WriteCapacity units are required attributes
            if ((_d = normalizedRequest.commandInput) === null || _d === void 0 ? void 0 : _d.ProvisionedThroughput) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROVISIONED_READ_CAPACITY] =
                    normalizedRequest.commandInput.ProvisionedThroughput.ReadCapacityUnits;
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROVISIONED_WRITE_CAPACITY] =
                    normalizedRequest.commandInput.ProvisionedThroughput.WriteCapacityUnits;
            }
        }
        if (operation === 'GetItem' ||
            operation === 'Scan' ||
            operation === 'Query') {
            if ((_e = normalizedRequest.commandInput) === null || _e === void 0 ? void 0 : _e.ConsistentRead) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_CONSISTENT_READ] =
                    normalizedRequest.commandInput.ConsistentRead;
            }
        }
        if (operation === 'Query' || operation === 'Scan') {
            if ((_f = normalizedRequest.commandInput) === null || _f === void 0 ? void 0 : _f.ProjectionExpression) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_PROJECTION] =
                    normalizedRequest.commandInput.ProjectionExpression;
            }
        }
        if (operation === 'CreateTable') {
            if ((_g = normalizedRequest.commandInput) === null || _g === void 0 ? void 0 : _g.GlobalSecondaryIndexes) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_GLOBAL_SECONDARY_INDEXES] =
                    this.toArray(normalizedRequest.commandInput.GlobalSecondaryIndexes).map((x) => JSON.stringify(x));
            }
            if ((_h = normalizedRequest.commandInput) === null || _h === void 0 ? void 0 : _h.LocalSecondaryIndexes) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_LOCAL_SECONDARY_INDEXES] =
                    this.toArray(normalizedRequest.commandInput.LocalSecondaryIndexes).map((x) => JSON.stringify(x));
            }
        }
        if (operation === 'ListTables' ||
            operation === 'Query' ||
            operation === 'Scan') {
            if ((_j = normalizedRequest.commandInput) === null || _j === void 0 ? void 0 : _j.Limit) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_LIMIT] =
                    normalizedRequest.commandInput.Limit;
            }
        }
        if (operation === 'ListTables') {
            if ((_k = normalizedRequest.commandInput) === null || _k === void 0 ? void 0 : _k.ExclusiveStartTableName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_EXCLUSIVE_START_TABLE] =
                    normalizedRequest.commandInput.ExclusiveStartTableName;
            }
        }
        if (operation === 'Query') {
            if ((_l = normalizedRequest.commandInput) === null || _l === void 0 ? void 0 : _l.ScanIndexForward) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SCAN_FORWARD] =
                    normalizedRequest.commandInput.ScanIndexForward;
            }
            if ((_m = normalizedRequest.commandInput) === null || _m === void 0 ? void 0 : _m.IndexName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_INDEX_NAME] =
                    normalizedRequest.commandInput.IndexName;
            }
            if ((_o = normalizedRequest.commandInput) === null || _o === void 0 ? void 0 : _o.Select) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SELECT] =
                    normalizedRequest.commandInput.Select;
            }
        }
        if (operation === 'Scan') {
            if ((_p = normalizedRequest.commandInput) === null || _p === void 0 ? void 0 : _p.Segment) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SEGMENT] =
                    (_q = normalizedRequest.commandInput) === null || _q === void 0 ? void 0 : _q.Segment;
            }
            if ((_r = normalizedRequest.commandInput) === null || _r === void 0 ? void 0 : _r.TotalSegments) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TOTAL_SEGMENTS] =
                    (_s = normalizedRequest.commandInput) === null || _s === void 0 ? void 0 : _s.TotalSegments;
            }
            if ((_t = normalizedRequest.commandInput) === null || _t === void 0 ? void 0 : _t.IndexName) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_INDEX_NAME] =
                    normalizedRequest.commandInput.IndexName;
            }
            if ((_u = normalizedRequest.commandInput) === null || _u === void 0 ? void 0 : _u.Select) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SELECT] =
                    normalizedRequest.commandInput.Select;
            }
        }
        if (operation === 'UpdateTable') {
            if ((_v = normalizedRequest.commandInput) === null || _v === void 0 ? void 0 : _v.AttributeDefinitions) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_ATTRIBUTE_DEFINITIONS] =
                    this.toArray(normalizedRequest.commandInput.AttributeDefinitions).map((x) => JSON.stringify(x));
            }
            if ((_w = normalizedRequest.commandInput) === null || _w === void 0 ? void 0 : _w.GlobalSecondaryIndexUpdates) {
                spanAttributes[semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_GLOBAL_SECONDARY_INDEX_UPDATES] =
                    this.toArray(normalizedRequest.commandInput.GlobalSecondaryIndexUpdates).map((x) => JSON.stringify(x));
            }
        }
        return {
            isIncoming,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
    responseHook(response, span, _tracer, _config) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if ((_a = response.data) === null || _a === void 0 ? void 0 : _a.ConsumedCapacity) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_CONSUMED_CAPACITY, toArray(response.data.ConsumedCapacity).map((x) => JSON.stringify(x)));
        }
        if ((_b = response.data) === null || _b === void 0 ? void 0 : _b.ItemCollectionMetrics) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_ITEM_COLLECTION_METRICS, this.toArray(response.data.ItemCollectionMetrics).map((x) => JSON.stringify(x)));
        }
        if ((_c = response.data) === null || _c === void 0 ? void 0 : _c.TableNames) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_TABLE_COUNT, (_d = response.data) === null || _d === void 0 ? void 0 : _d.TableNames.length);
        }
        if ((_e = response.data) === null || _e === void 0 ? void 0 : _e.Count) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_COUNT, (_f = response.data) === null || _f === void 0 ? void 0 : _f.Count);
        }
        if ((_g = response.data) === null || _g === void 0 ? void 0 : _g.ScannedCount) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_AWS_DYNAMODB_SCANNED_COUNT, (_h = response.data) === null || _h === void 0 ? void 0 : _h.ScannedCount);
        }
    }
}
exports.DynamodbServiceExtension = DynamodbServiceExtension;
function toArray(values) {
    return Array.isArray(values) ? values : [values];
}
//# sourceMappingURL=dynamodb.js.map