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
exports.IORedisInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const instrumentation_2 = require("@opentelemetry/instrumentation");
const utils_1 = require("./utils");
const redis_common_1 = require("@opentelemetry/redis-common");
/** @knipignore */
const version_1 = require("./version");
const DEFAULT_CONFIG = {
    requireParentSpan: true,
};
class IORedisInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('ioredis', ['>=2.0.0 <6'], (module, moduleVersion) => {
                const moduleExports = module[Symbol.toStringTag] === 'Module'
                    ? module.default // ESM
                    : module; // CommonJS
                if ((0, instrumentation_1.isWrapped)(moduleExports.prototype.sendCommand)) {
                    this._unwrap(moduleExports.prototype, 'sendCommand');
                }
                this._wrap(moduleExports.prototype, 'sendCommand', this._patchSendCommand(moduleVersion));
                if ((0, instrumentation_1.isWrapped)(moduleExports.prototype.connect)) {
                    this._unwrap(moduleExports.prototype, 'connect');
                }
                this._wrap(moduleExports.prototype, 'connect', this._patchConnection());
                return module;
            }, module => {
                if (module === undefined)
                    return;
                const moduleExports = module[Symbol.toStringTag] === 'Module'
                    ? module.default // ESM
                    : module; // CommonJS
                this._unwrap(moduleExports.prototype, 'sendCommand');
                this._unwrap(moduleExports.prototype, 'connect');
            }),
        ];
    }
    /**
     * Patch send command internal to trace requests
     */
    _patchSendCommand(moduleVersion) {
        return (original) => {
            return this._traceSendCommand(original, moduleVersion);
        };
    }
    _patchConnection() {
        return (original) => {
            return this._traceConnection(original);
        };
    }
    _traceSendCommand(original, moduleVersion) {
        const instrumentation = this;
        return function (cmd) {
            if (arguments.length < 1 || typeof cmd !== 'object') {
                return original.apply(this, arguments);
            }
            const config = instrumentation.getConfig();
            const dbStatementSerializer = config.dbStatementSerializer || redis_common_1.defaultDbStatementSerializer;
            const hasNoParentSpan = api_1.trace.getSpan(api_1.context.active()) === undefined;
            if (config.requireParentSpan === true && hasNoParentSpan) {
                return original.apply(this, arguments);
            }
            const span = instrumentation.tracer.startSpan(cmd.name, {
                kind: api_1.SpanKind.CLIENT,
                attributes: {
                    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_REDIS,
                    [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: dbStatementSerializer(cmd.name, cmd.args),
                },
            });
            const { requestHook } = config;
            if (requestHook) {
                (0, instrumentation_2.safeExecuteInTheMiddle)(() => requestHook(span, {
                    moduleVersion,
                    cmdName: cmd.name,
                    cmdArgs: cmd.args,
                }), e => {
                    if (e) {
                        api_1.diag.error('ioredis instrumentation: request hook failed', e);
                    }
                }, true);
            }
            const { host, port } = this.options;
            span.setAttributes({
                [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: host,
                [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: port,
                [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: `redis://${host}:${port}`,
            });
            try {
                const result = original.apply(this, arguments);
                const origResolve = cmd.resolve;
                /* eslint-disable @typescript-eslint/no-explicit-any */
                cmd.resolve = function (result) {
                    (0, instrumentation_2.safeExecuteInTheMiddle)(() => { var _a; return (_a = config.responseHook) === null || _a === void 0 ? void 0 : _a.call(config, span, cmd.name, cmd.args, result); }, e => {
                        if (e) {
                            api_1.diag.error('ioredis instrumentation: response hook failed', e);
                        }
                    }, true);
                    (0, utils_1.endSpan)(span, null);
                    origResolve(result);
                };
                const origReject = cmd.reject;
                cmd.reject = function (err) {
                    (0, utils_1.endSpan)(span, err);
                    origReject(err);
                };
                return result;
            }
            catch (error) {
                (0, utils_1.endSpan)(span, error);
                throw error;
            }
        };
    }
    _traceConnection(original) {
        const instrumentation = this;
        return function () {
            const hasNoParentSpan = api_1.trace.getSpan(api_1.context.active()) === undefined;
            if (instrumentation.getConfig().requireParentSpan === true &&
                hasNoParentSpan) {
                return original.apply(this, arguments);
            }
            const span = instrumentation.tracer.startSpan('connect', {
                kind: api_1.SpanKind.CLIENT,
                attributes: {
                    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_REDIS,
                    [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: 'connect',
                },
            });
            const { host, port } = this.options;
            span.setAttributes({
                [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: host,
                [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: port,
                [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: `redis://${host}:${port}`,
            });
            try {
                const client = original.apply(this, arguments);
                (0, utils_1.endSpan)(span, null);
                return client;
            }
            catch (error) {
                (0, utils_1.endSpan)(span, error);
                throw error;
            }
        };
    }
}
exports.IORedisInstrumentation = IORedisInstrumentation;
//# sourceMappingURL=instrumentation.js.map