"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsExecutor = void 0;
/* eslint jsdoc/require-jsdoc: off */
const analyticstypes_1 = require("./analyticstypes");
const bindingutilities_1 = require("./bindingutilities");
const streamablepromises_1 = require("./streamablepromises");
/**
 * @internal
 */
class AnalyticsExecutor {
    /**
     * @internal
     */
    constructor(cluster) {
        this._cluster = cluster;
    }
    /**
     * @internal
     */
    query(query, options) {
        const emitter = new streamablepromises_1.StreamableRowPromise((rows, meta) => {
            return new analyticstypes_1.AnalyticsResult({
                rows: rows,
                meta: meta,
            });
        });
        const timeout = options.timeout || this._cluster.analyticsTimeout;
        this._cluster.conn.analytics({
            statement: query,
            timeout,
            client_context_id: options.clientContextId,
            readonly: options.readOnly || false,
            priority: options.priority || false,
            scope_qualifier: options.queryContext,
            scan_consistency: (0, bindingutilities_1.analyticsScanConsistencyToCpp)(options.scanConsistency),
            raw: options.raw
                ? Object.fromEntries(Object.entries(options.raw)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v]) => [k, JSON.stringify(v)]))
                : {},
            positional_parameters: options.parameters && Array.isArray(options.parameters)
                ? options.parameters.map((v) => JSON.stringify(v !== null && v !== void 0 ? v : null))
                : [],
            named_parameters: options.parameters && !Array.isArray(options.parameters)
                ? Object.fromEntries(Object.entries(options.parameters)
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v]) => [k, JSON.stringify(v)]))
                : {},
            body_str: '',
        }, (cppErr, resp) => {
            const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
            if (err) {
                emitter.emit('error', err);
                emitter.emit('end');
                return;
            }
            resp.rows.forEach((row) => {
                emitter.emit('row', JSON.parse(row));
            });
            {
                const metaData = resp.meta;
                let warnings;
                if (metaData.warnings) {
                    warnings = metaData.warnings.map((warningData) => new analyticstypes_1.AnalyticsWarning({
                        code: warningData.code,
                        message: warningData.message,
                    }));
                }
                else {
                    warnings = [];
                }
                const metricsData = metaData.metrics;
                const metrics = new analyticstypes_1.AnalyticsMetrics({
                    elapsedTime: metricsData.elapsed_time,
                    executionTime: metricsData.execution_time,
                    resultCount: metricsData.result_count,
                    resultSize: metricsData.result_size,
                    errorCount: metricsData.error_count,
                    processedObjects: metricsData.processed_objects,
                    warningCount: metricsData.warning_count,
                });
                const meta = new analyticstypes_1.AnalyticsMetaData({
                    requestId: metaData.request_id,
                    clientContextId: metaData.client_context_id,
                    status: (0, bindingutilities_1.analyticsStatusFromCpp)(metaData.status),
                    signature: metaData.signature
                        ? JSON.parse(metaData.signature)
                        : undefined,
                    warnings: warnings,
                    metrics: metrics,
                });
                emitter.emit('meta', meta);
            }
            emitter.emit('end');
            return;
        });
        return emitter;
    }
}
exports.AnalyticsExecutor = AnalyticsExecutor;
