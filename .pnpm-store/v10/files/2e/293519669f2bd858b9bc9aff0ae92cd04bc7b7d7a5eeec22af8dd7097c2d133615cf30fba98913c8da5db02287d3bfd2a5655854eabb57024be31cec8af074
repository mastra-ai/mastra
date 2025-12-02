"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const AttributeNames_1 = require("./AttributeNames");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
class MySQLInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
        this._setMetricInstruments();
    }
    setMeterProvider(meterProvider) {
        super.setMeterProvider(meterProvider);
        this._setMetricInstruments();
    }
    _setMetricInstruments() {
        this._connectionsUsage = this.meter.createUpDownCounter('db.client.connections.usage', //TODO:: use semantic convention
        {
            description: 'The number of connections that are currently in state described by the state attribute.',
            unit: '{connection}',
        });
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('mysql', ['>=2.0.0 <3'], (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.createConnection)) {
                    this._unwrap(moduleExports, 'createConnection');
                }
                this._wrap(moduleExports, 'createConnection', this._patchCreateConnection());
                if ((0, instrumentation_1.isWrapped)(moduleExports.createPool)) {
                    this._unwrap(moduleExports, 'createPool');
                }
                this._wrap(moduleExports, 'createPool', this._patchCreatePool());
                if ((0, instrumentation_1.isWrapped)(moduleExports.createPoolCluster)) {
                    this._unwrap(moduleExports, 'createPoolCluster');
                }
                this._wrap(moduleExports, 'createPoolCluster', this._patchCreatePoolCluster());
                return moduleExports;
            }, (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports, 'createConnection');
                this._unwrap(moduleExports, 'createPool');
                this._unwrap(moduleExports, 'createPoolCluster');
            }),
        ];
    }
    // global export function
    _patchCreateConnection() {
        return (originalCreateConnection) => {
            const thisPlugin = this;
            return function createConnection(_connectionUri) {
                const originalResult = originalCreateConnection(...arguments);
                // This is unwrapped on next call after unpatch
                thisPlugin._wrap(originalResult, 'query', thisPlugin._patchQuery(originalResult));
                return originalResult;
            };
        };
    }
    // global export function
    _patchCreatePool() {
        return (originalCreatePool) => {
            const thisPlugin = this;
            return function createPool(_config) {
                const pool = originalCreatePool(...arguments);
                thisPlugin._wrap(pool, 'query', thisPlugin._patchQuery(pool));
                thisPlugin._wrap(pool, 'getConnection', thisPlugin._patchGetConnection(pool));
                thisPlugin._wrap(pool, 'end', thisPlugin._patchPoolEnd(pool));
                thisPlugin._setPoolcallbacks(pool, thisPlugin, '');
                return pool;
            };
        };
    }
    _patchPoolEnd(pool) {
        return (originalPoolEnd) => {
            const thisPlugin = this;
            return function end(callback) {
                const nAll = pool._allConnections.length;
                const nFree = pool._freeConnections.length;
                const nUsed = nAll - nFree;
                const poolName = (0, utils_1.getPoolName)(pool);
                thisPlugin._connectionsUsage.add(-nUsed, {
                    state: 'used',
                    name: poolName,
                });
                thisPlugin._connectionsUsage.add(-nFree, {
                    state: 'idle',
                    name: poolName,
                });
                originalPoolEnd.apply(pool, arguments);
            };
        };
    }
    // global export function
    _patchCreatePoolCluster() {
        return (originalCreatePoolCluster) => {
            const thisPlugin = this;
            return function createPool(_config) {
                const cluster = originalCreatePoolCluster(...arguments);
                // This is unwrapped on next call after unpatch
                thisPlugin._wrap(cluster, 'getConnection', thisPlugin._patchGetConnection(cluster));
                thisPlugin._wrap(cluster, 'add', thisPlugin._patchAdd(cluster));
                return cluster;
            };
        };
    }
    _patchAdd(cluster) {
        return (originalAdd) => {
            const thisPlugin = this;
            return function add(id, config) {
                // Unwrap if unpatch has been called
                if (!thisPlugin['_enabled']) {
                    thisPlugin._unwrap(cluster, 'add');
                    return originalAdd.apply(cluster, arguments);
                }
                originalAdd.apply(cluster, arguments);
                const nodes = cluster['_nodes'];
                if (nodes) {
                    const nodeId = typeof id === 'object'
                        ? 'CLUSTER::' + cluster._lastId
                        : String(id);
                    const pool = nodes[nodeId].pool;
                    thisPlugin._setPoolcallbacks(pool, thisPlugin, id);
                }
            };
        };
    }
    // method on cluster or pool
    _patchGetConnection(pool) {
        return (originalGetConnection) => {
            const thisPlugin = this;
            return function getConnection(arg1, arg2, arg3) {
                // Unwrap if unpatch has been called
                if (!thisPlugin['_enabled']) {
                    thisPlugin._unwrap(pool, 'getConnection');
                    return originalGetConnection.apply(pool, arguments);
                }
                if (arguments.length === 1 && typeof arg1 === 'function') {
                    const patchFn = thisPlugin._getConnectionCallbackPatchFn(arg1);
                    return originalGetConnection.call(pool, patchFn);
                }
                if (arguments.length === 2 && typeof arg2 === 'function') {
                    const patchFn = thisPlugin._getConnectionCallbackPatchFn(arg2);
                    return originalGetConnection.call(pool, arg1, patchFn);
                }
                if (arguments.length === 3 && typeof arg3 === 'function') {
                    const patchFn = thisPlugin._getConnectionCallbackPatchFn(arg3);
                    return originalGetConnection.call(pool, arg1, arg2, patchFn);
                }
                return originalGetConnection.apply(pool, arguments);
            };
        };
    }
    _getConnectionCallbackPatchFn(cb) {
        const thisPlugin = this;
        const activeContext = api_1.context.active();
        return function (err, connection) {
            if (connection) {
                // this is the callback passed into a query
                // no need to unwrap
                if (!(0, instrumentation_1.isWrapped)(connection.query)) {
                    thisPlugin._wrap(connection, 'query', thisPlugin._patchQuery(connection));
                }
            }
            if (typeof cb === 'function') {
                api_1.context.with(activeContext, cb, this, err, connection);
            }
        };
    }
    _patchQuery(connection) {
        return (originalQuery) => {
            const thisPlugin = this;
            return function query(query, _valuesOrCallback, _callback) {
                if (!thisPlugin['_enabled']) {
                    thisPlugin._unwrap(connection, 'query');
                    return originalQuery.apply(connection, arguments);
                }
                const span = thisPlugin.tracer.startSpan((0, utils_1.getSpanName)(query), {
                    kind: api_1.SpanKind.CLIENT,
                    attributes: Object.assign(Object.assign({}, MySQLInstrumentation.COMMON_ATTRIBUTES), (0, utils_1.getConnectionAttributes)(connection.config)),
                });
                span.setAttribute(semantic_conventions_1.SEMATTRS_DB_STATEMENT, (0, utils_1.getDbStatement)(query));
                if (thisPlugin.getConfig().enhancedDatabaseReporting) {
                    let values;
                    if (Array.isArray(_valuesOrCallback)) {
                        values = _valuesOrCallback;
                    }
                    else if (arguments[2]) {
                        values = [_valuesOrCallback];
                    }
                    span.setAttribute(AttributeNames_1.AttributeNames.MYSQL_VALUES, (0, utils_1.getDbValues)(query, values));
                }
                const cbIndex = Array.from(arguments).findIndex(arg => typeof arg === 'function');
                const parentContext = api_1.context.active();
                if (cbIndex === -1) {
                    const streamableQuery = api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                        return originalQuery.apply(connection, arguments);
                    });
                    api_1.context.bind(parentContext, streamableQuery);
                    return streamableQuery
                        .on('error', err => span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: err.message,
                    }))
                        .on('end', () => {
                        span.end();
                    });
                }
                else {
                    thisPlugin._wrap(arguments, cbIndex, thisPlugin._patchCallbackQuery(span, parentContext));
                    return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                        return originalQuery.apply(connection, arguments);
                    });
                }
            };
        };
    }
    _patchCallbackQuery(span, parentContext) {
        return (originalCallback) => {
            return function (err, results, fields) {
                if (err) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: err.message,
                    });
                }
                span.end();
                return api_1.context.with(parentContext, () => originalCallback(...arguments));
            };
        };
    }
    _setPoolcallbacks(pool, thisPlugin, id) {
        //TODO:: use semantic convention
        const poolName = id || (0, utils_1.getPoolName)(pool);
        pool.on('connection', connection => {
            thisPlugin._connectionsUsage.add(1, {
                state: 'idle',
                name: poolName,
            });
        });
        pool.on('acquire', connection => {
            thisPlugin._connectionsUsage.add(-1, {
                state: 'idle',
                name: poolName,
            });
            thisPlugin._connectionsUsage.add(1, {
                state: 'used',
                name: poolName,
            });
        });
        pool.on('release', connection => {
            thisPlugin._connectionsUsage.add(-1, {
                state: 'used',
                name: poolName,
            });
            thisPlugin._connectionsUsage.add(1, {
                state: 'idle',
                name: poolName,
            });
        });
    }
}
exports.MySQLInstrumentation = MySQLInstrumentation;
MySQLInstrumentation.COMMON_ATTRIBUTES = {
    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_MYSQL,
};
//# sourceMappingURL=instrumentation.js.map