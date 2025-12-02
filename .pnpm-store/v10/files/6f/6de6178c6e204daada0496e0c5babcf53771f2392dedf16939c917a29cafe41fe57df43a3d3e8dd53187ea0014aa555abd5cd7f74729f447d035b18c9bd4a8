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
exports.TediousInstrumentation = void 0;
const api = require("@opentelemetry/api");
const events_1 = require("events");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
const CURRENT_DATABASE = Symbol('opentelemetry.instrumentation-tedious.current-database');
const PATCHED_METHODS = [
    'callProcedure',
    'execSql',
    'execSqlBatch',
    'execBulkLoad',
    'prepare',
    'execute',
];
function setDatabase(databaseName) {
    Object.defineProperty(this, CURRENT_DATABASE, {
        value: databaseName,
        writable: true,
    });
}
class TediousInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition(TediousInstrumentation.COMPONENT, ['>=1.11.0 <20'], (moduleExports) => {
                const ConnectionPrototype = moduleExports.Connection.prototype;
                for (const method of PATCHED_METHODS) {
                    if ((0, instrumentation_1.isWrapped)(ConnectionPrototype[method])) {
                        this._unwrap(ConnectionPrototype, method);
                    }
                    this._wrap(ConnectionPrototype, method, this._patchQuery(method));
                }
                if ((0, instrumentation_1.isWrapped)(ConnectionPrototype.connect)) {
                    this._unwrap(ConnectionPrototype, 'connect');
                }
                this._wrap(ConnectionPrototype, 'connect', this._patchConnect);
                return moduleExports;
            }, (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                const ConnectionPrototype = moduleExports.Connection.prototype;
                for (const method of PATCHED_METHODS) {
                    this._unwrap(ConnectionPrototype, method);
                }
                this._unwrap(ConnectionPrototype, 'connect');
            }),
        ];
    }
    _patchConnect(original) {
        return function patchedConnect() {
            var _a, _b;
            setDatabase.call(this, (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.database);
            // remove the listener first in case it's already added
            this.removeListener('databaseChange', setDatabase);
            this.on('databaseChange', setDatabase);
            this.once('end', () => {
                this.removeListener('databaseChange', setDatabase);
            });
            return original.apply(this, arguments);
        };
    }
    _patchQuery(operation) {
        return (originalMethod) => {
            const thisPlugin = this;
            function patchedMethod(request) {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (!(request instanceof events_1.EventEmitter)) {
                    thisPlugin._diag.warn(`Unexpected invocation of patched ${operation} method. Span not recorded`);
                    return originalMethod.apply(this, arguments);
                }
                let procCount = 0;
                let statementCount = 0;
                const incrementStatementCount = () => statementCount++;
                const incrementProcCount = () => procCount++;
                const databaseName = this[CURRENT_DATABASE];
                const sql = (request => {
                    var _a, _b;
                    // Required for <11.0.9
                    if (request.sqlTextOrProcedure === 'sp_prepare' &&
                        ((_b = (_a = request.parametersByName) === null || _a === void 0 ? void 0 : _a.stmt) === null || _b === void 0 ? void 0 : _b.value)) {
                        return request.parametersByName.stmt.value;
                    }
                    return request.sqlTextOrProcedure;
                })(request);
                const span = thisPlugin.tracer.startSpan((0, utils_1.getSpanName)(operation, databaseName, sql, request.table), {
                    kind: api.SpanKind.CLIENT,
                    attributes: {
                        [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_MSSQL,
                        [semantic_conventions_1.SEMATTRS_DB_NAME]: databaseName,
                        [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.port,
                        [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: (_c = this.config) === null || _c === void 0 ? void 0 : _c.server,
                        // >=4 uses `authentication` object, older versions just userName and password pair
                        [semantic_conventions_1.SEMATTRS_DB_USER]: (_e = (_d = this.config) === null || _d === void 0 ? void 0 : _d.userName) !== null && _e !== void 0 ? _e : (_h = (_g = (_f = this.config) === null || _f === void 0 ? void 0 : _f.authentication) === null || _g === void 0 ? void 0 : _g.options) === null || _h === void 0 ? void 0 : _h.userName,
                        [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: sql,
                        [semantic_conventions_1.SEMATTRS_DB_SQL_TABLE]: request.table,
                    },
                });
                const endSpan = (0, utils_1.once)((err) => {
                    request.removeListener('done', incrementStatementCount);
                    request.removeListener('doneInProc', incrementStatementCount);
                    request.removeListener('doneProc', incrementProcCount);
                    request.removeListener('error', endSpan);
                    this.removeListener('end', endSpan);
                    span.setAttribute('tedious.procedure_count', procCount);
                    span.setAttribute('tedious.statement_count', statementCount);
                    if (err) {
                        span.setStatus({
                            code: api.SpanStatusCode.ERROR,
                            message: err.message,
                        });
                    }
                    span.end();
                });
                request.on('done', incrementStatementCount);
                request.on('doneInProc', incrementStatementCount);
                request.on('doneProc', incrementProcCount);
                request.once('error', endSpan);
                this.on('end', endSpan);
                if (typeof request.callback === 'function') {
                    thisPlugin._wrap(request, 'callback', thisPlugin._patchCallbackQuery(endSpan));
                }
                else {
                    thisPlugin._diag.error('Expected request.callback to be a function');
                }
                return api.context.with(api.trace.setSpan(api.context.active(), span), originalMethod, this, ...arguments);
            }
            Object.defineProperty(patchedMethod, 'length', {
                value: originalMethod.length,
                writable: false,
            });
            return patchedMethod;
        };
    }
    _patchCallbackQuery(endSpan) {
        return (originalCallback) => {
            return function (err, rowCount, rows) {
                endSpan(err);
                return originalCallback.apply(this, arguments);
            };
        };
    }
}
exports.TediousInstrumentation = TediousInstrumentation;
TediousInstrumentation.COMPONENT = 'tedious';
//# sourceMappingURL=instrumentation.js.map