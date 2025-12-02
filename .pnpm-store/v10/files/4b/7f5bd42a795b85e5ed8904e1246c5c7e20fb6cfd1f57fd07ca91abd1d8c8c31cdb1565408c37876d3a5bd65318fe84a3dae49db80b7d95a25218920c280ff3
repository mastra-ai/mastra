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
exports.MySQL2Instrumentation = void 0;
const api = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const sql_common_1 = require("@opentelemetry/sql-common");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
const supportedVersions = ['>=1.4.2 <4'];
class MySQL2Instrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        let format;
        function setFormatFunction(moduleExports) {
            if (!format && moduleExports.format) {
                format = moduleExports.format;
            }
        }
        const patch = (ConnectionPrototype) => {
            if ((0, instrumentation_1.isWrapped)(ConnectionPrototype.query)) {
                this._unwrap(ConnectionPrototype, 'query');
            }
            this._wrap(ConnectionPrototype, 'query', this._patchQuery(format, false));
            if ((0, instrumentation_1.isWrapped)(ConnectionPrototype.execute)) {
                this._unwrap(ConnectionPrototype, 'execute');
            }
            this._wrap(ConnectionPrototype, 'execute', this._patchQuery(format, true));
        };
        const unpatch = (ConnectionPrototype) => {
            this._unwrap(ConnectionPrototype, 'query');
            this._unwrap(ConnectionPrototype, 'execute');
        };
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('mysql2', supportedVersions, (moduleExports) => {
                setFormatFunction(moduleExports);
                return moduleExports;
            }, () => { }, [
                new instrumentation_1.InstrumentationNodeModuleFile('mysql2/promise.js', supportedVersions, (moduleExports) => {
                    setFormatFunction(moduleExports);
                    return moduleExports;
                }, () => { }),
                new instrumentation_1.InstrumentationNodeModuleFile('mysql2/lib/connection.js', supportedVersions, (moduleExports) => {
                    const ConnectionPrototype = (0, utils_1.getConnectionPrototypeToInstrument)(moduleExports);
                    patch(ConnectionPrototype);
                    return moduleExports;
                }, (moduleExports) => {
                    if (moduleExports === undefined)
                        return;
                    const ConnectionPrototype = (0, utils_1.getConnectionPrototypeToInstrument)(moduleExports);
                    unpatch(ConnectionPrototype);
                }),
            ]),
        ];
    }
    _patchQuery(format, isPrepared) {
        return (originalQuery) => {
            const thisPlugin = this;
            return function query(query, _valuesOrCallback, _callback) {
                let values;
                if (Array.isArray(_valuesOrCallback)) {
                    values = _valuesOrCallback;
                }
                else if (arguments[2]) {
                    values = [_valuesOrCallback];
                }
                const span = thisPlugin.tracer.startSpan((0, utils_1.getSpanName)(query), {
                    kind: api.SpanKind.CLIENT,
                    attributes: Object.assign(Object.assign(Object.assign({}, MySQL2Instrumentation.COMMON_ATTRIBUTES), (0, utils_1.getConnectionAttributes)(this.config)), { [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: (0, utils_1.getDbStatement)(query, format, values) }),
                });
                if (!isPrepared &&
                    thisPlugin.getConfig().addSqlCommenterCommentToQueries) {
                    arguments[0] = query =
                        typeof query === 'string'
                            ? (0, sql_common_1.addSqlCommenterComment)(span, query)
                            : Object.assign(query, {
                                sql: (0, sql_common_1.addSqlCommenterComment)(span, query.sql),
                            });
                }
                const endSpan = (0, utils_1.once)((err, results) => {
                    if (err) {
                        span.setStatus({
                            code: api.SpanStatusCode.ERROR,
                            message: err.message,
                        });
                    }
                    else {
                        const { responseHook } = thisPlugin.getConfig();
                        if (typeof responseHook === 'function') {
                            (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                                responseHook(span, {
                                    queryResults: results,
                                });
                            }, err => {
                                if (err) {
                                    thisPlugin._diag.warn('Failed executing responseHook', err);
                                }
                            }, true);
                        }
                    }
                    span.end();
                });
                if (arguments.length === 1) {
                    if (typeof query.onResult === 'function') {
                        thisPlugin._wrap(query, 'onResult', thisPlugin._patchCallbackQuery(endSpan));
                    }
                    const streamableQuery = originalQuery.apply(this, arguments);
                    // `end` in mysql behaves similarly to `result` in mysql2.
                    streamableQuery
                        .once('error', err => {
                        endSpan(err);
                    })
                        .once('result', results => {
                        endSpan(undefined, results);
                    });
                    return streamableQuery;
                }
                if (typeof arguments[1] === 'function') {
                    thisPlugin._wrap(arguments, 1, thisPlugin._patchCallbackQuery(endSpan));
                }
                else if (typeof arguments[2] === 'function') {
                    thisPlugin._wrap(arguments, 2, thisPlugin._patchCallbackQuery(endSpan));
                }
                return originalQuery.apply(this, arguments);
            };
        };
    }
    _patchCallbackQuery(endSpan) {
        return (originalCallback) => {
            return function (err, results, fields) {
                endSpan(err, results);
                return originalCallback(...arguments);
            };
        };
    }
}
exports.MySQL2Instrumentation = MySQL2Instrumentation;
MySQL2Instrumentation.COMMON_ATTRIBUTES = {
    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_MYSQL,
};
//# sourceMappingURL=instrumentation.js.map