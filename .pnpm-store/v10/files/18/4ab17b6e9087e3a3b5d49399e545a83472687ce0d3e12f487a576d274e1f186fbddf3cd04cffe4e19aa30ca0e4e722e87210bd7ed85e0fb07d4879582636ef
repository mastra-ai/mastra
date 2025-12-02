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
exports.KnexInstrumentation = void 0;
const api = require("@opentelemetry/api");
/** @knipignore */
const version_1 = require("./version");
const constants = require("./constants");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils = require("./utils");
const contextSymbol = Symbol('opentelemetry.instrumentation-knex.context');
const DEFAULT_CONFIG = {
    maxQueryLength: 1022,
    requireParentSpan: false,
};
class KnexInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    init() {
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition(constants.MODULE_NAME, constants.SUPPORTED_VERSIONS);
        module.files.push(this.getClientNodeModuleFileInstrumentation('src'), this.getClientNodeModuleFileInstrumentation('lib'), this.getRunnerNodeModuleFileInstrumentation('src'), this.getRunnerNodeModuleFileInstrumentation('lib'), this.getRunnerNodeModuleFileInstrumentation('lib/execution'));
        return module;
    }
    getRunnerNodeModuleFileInstrumentation(basePath) {
        return new instrumentation_1.InstrumentationNodeModuleFile(`knex/${basePath}/runner.js`, constants.SUPPORTED_VERSIONS, (Runner, moduleVersion) => {
            this.ensureWrapped(Runner.prototype, 'query', this.createQueryWrapper(moduleVersion));
            return Runner;
        }, (Runner, moduleVersion) => {
            this._unwrap(Runner.prototype, 'query');
            return Runner;
        });
    }
    getClientNodeModuleFileInstrumentation(basePath) {
        return new instrumentation_1.InstrumentationNodeModuleFile(`knex/${basePath}/client.js`, constants.SUPPORTED_VERSIONS, (Client) => {
            this.ensureWrapped(Client.prototype, 'queryBuilder', this.storeContext.bind(this));
            this.ensureWrapped(Client.prototype, 'schemaBuilder', this.storeContext.bind(this));
            this.ensureWrapped(Client.prototype, 'raw', this.storeContext.bind(this));
            return Client;
        }, (Client) => {
            this._unwrap(Client.prototype, 'queryBuilder');
            this._unwrap(Client.prototype, 'schemaBuilder');
            this._unwrap(Client.prototype, 'raw');
            return Client;
        });
    }
    createQueryWrapper(moduleVersion) {
        const instrumentation = this;
        return function wrapQuery(original) {
            return function wrapped_logging_method(query) {
                var _a, _b, _c, _d, _e, _f;
                const config = this.client.config;
                const table = utils.extractTableName(this.builder);
                // `method` actually refers to the knex API method - Not exactly "operation"
                // in the spec sense, but matches most of the time.
                const operation = query === null || query === void 0 ? void 0 : query.method;
                const name = ((_a = config === null || config === void 0 ? void 0 : config.connection) === null || _a === void 0 ? void 0 : _a.filename) || ((_b = config === null || config === void 0 ? void 0 : config.connection) === null || _b === void 0 ? void 0 : _b.database);
                const { maxQueryLength } = instrumentation.getConfig();
                const attributes = {
                    'knex.version': moduleVersion,
                    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: utils.mapSystem(config.client),
                    [semantic_conventions_1.SEMATTRS_DB_SQL_TABLE]: table,
                    [semantic_conventions_1.SEMATTRS_DB_OPERATION]: operation,
                    [semantic_conventions_1.SEMATTRS_DB_USER]: (_c = config === null || config === void 0 ? void 0 : config.connection) === null || _c === void 0 ? void 0 : _c.user,
                    [semantic_conventions_1.SEMATTRS_DB_NAME]: name,
                    [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: (_d = config === null || config === void 0 ? void 0 : config.connection) === null || _d === void 0 ? void 0 : _d.host,
                    [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: (_e = config === null || config === void 0 ? void 0 : config.connection) === null || _e === void 0 ? void 0 : _e.port,
                    [semantic_conventions_1.SEMATTRS_NET_TRANSPORT]: ((_f = config === null || config === void 0 ? void 0 : config.connection) === null || _f === void 0 ? void 0 : _f.filename) === ':memory:' ? 'inproc' : undefined,
                };
                if (maxQueryLength) {
                    // filters both undefined and 0
                    attributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = utils.limitLength(query === null || query === void 0 ? void 0 : query.sql, maxQueryLength);
                }
                const parentContext = this.builder[contextSymbol] || api.context.active();
                const parentSpan = api.trace.getSpan(parentContext);
                const hasActiveParent = parentSpan && api.trace.isSpanContextValid(parentSpan.spanContext());
                if (instrumentation._config.requireParentSpan && !hasActiveParent) {
                    return original.bind(this)(...arguments);
                }
                const span = instrumentation.tracer.startSpan(utils.getName(name, operation, table), {
                    kind: api.SpanKind.CLIENT,
                    attributes,
                }, parentContext);
                const spanContext = api.trace.setSpan(api.context.active(), span);
                return api.context
                    .with(spanContext, original, this, ...arguments)
                    .then((result) => {
                    span.end();
                    return result;
                })
                    .catch((err) => {
                    // knex adds full query with all the binding values to the message,
                    // we want to undo that without changing the original error
                    const formatter = utils.getFormatter(this);
                    const fullQuery = formatter(query.sql, query.bindings || []);
                    const message = err.message.replace(fullQuery + ' - ', '');
                    const exc = utils.otelExceptionFromKnexError(err, message);
                    span.recordException(exc);
                    span.setStatus({ code: api.SpanStatusCode.ERROR, message });
                    span.end();
                    throw err;
                });
            };
        };
    }
    storeContext(original) {
        return function wrapped_logging_method() {
            const builder = original.apply(this, arguments);
            // Builder is a custom promise type and when awaited it fails to propagate context.
            // We store the parent context at the moment of initiating the builder
            // otherwise we'd have nothing to attach the span as a child for in `query`.
            Object.defineProperty(builder, contextSymbol, {
                value: api.context.active(),
            });
            return builder;
        };
    }
    ensureWrapped(obj, methodName, wrapper) {
        if ((0, instrumentation_1.isWrapped)(obj[methodName])) {
            this._unwrap(obj, methodName);
        }
        this._wrap(obj, methodName, wrapper);
    }
}
exports.KnexInstrumentation = KnexInstrumentation;
//# sourceMappingURL=instrumentation.js.map