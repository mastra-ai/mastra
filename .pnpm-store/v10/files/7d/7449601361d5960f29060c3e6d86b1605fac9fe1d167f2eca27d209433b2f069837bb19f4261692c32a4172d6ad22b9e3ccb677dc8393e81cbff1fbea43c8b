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
exports.MemcachedInstrumentation = void 0;
const api = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils = require("./utils");
/** @knipignore */
const version_1 = require("./version");
class MemcachedInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, MemcachedInstrumentation.DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, MemcachedInstrumentation.DEFAULT_CONFIG), config));
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('memcached', ['>=2.2.0 <3'], (moduleExports, moduleVersion) => {
                this.ensureWrapped(moduleExports.prototype, 'command', this.wrapCommand.bind(this, moduleVersion));
                return moduleExports;
            }, (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                // `command` is documented API missing from the types
                this._unwrap(moduleExports.prototype, 'command');
            }),
        ];
    }
    wrapCommand(moduleVersion, original) {
        const instrumentation = this;
        return function (queryCompiler, server) {
            if (typeof queryCompiler !== 'function') {
                return original.apply(this, arguments);
            }
            // The name will be overwritten later
            const span = instrumentation.tracer.startSpan('unknown memcached command', {
                kind: api.SpanKind.CLIENT,
                attributes: Object.assign({ 'memcached.version': moduleVersion }, MemcachedInstrumentation.COMMON_ATTRIBUTES),
            });
            const parentContext = api.context.active();
            const context = api.trace.setSpan(parentContext, span);
            return api.context.with(context, original, this, instrumentation.wrapQueryCompiler.call(instrumentation, queryCompiler, this, server, parentContext, span), server);
        };
    }
    wrapQueryCompiler(original, client, server, callbackContext, span) {
        const instrumentation = this;
        return function () {
            const query = original.apply(this, arguments);
            const callback = query.callback;
            span.updateName(`memcached ${query.type}`);
            span.setAttributes(Object.assign({ 'db.memcached.key': query.key, 'db.memcached.lifetime': query.lifetime, [semantic_conventions_1.SEMATTRS_DB_OPERATION]: query.type, [semantic_conventions_1.SEMATTRS_DB_STATEMENT]: instrumentation.getConfig()
                    .enhancedDatabaseReporting
                    ? query.command
                    : undefined }, utils.getPeerAttributes(client, server, query)));
            query.callback = api.context.bind(callbackContext, function (err) {
                if (err) {
                    span.recordException(err);
                    span.setStatus({
                        code: api.SpanStatusCode.ERROR,
                        message: err.message,
                    });
                }
                span.end();
                if (typeof callback === 'function') {
                    return callback.apply(this, arguments);
                }
            });
            return query;
        };
    }
    ensureWrapped(obj, methodName, wrapper) {
        if ((0, instrumentation_1.isWrapped)(obj[methodName])) {
            this._unwrap(obj, methodName);
        }
        this._wrap(obj, methodName, wrapper);
    }
}
exports.MemcachedInstrumentation = MemcachedInstrumentation;
MemcachedInstrumentation.COMPONENT = 'memcached';
MemcachedInstrumentation.COMMON_ATTRIBUTES = {
    [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_MEMCACHED,
};
MemcachedInstrumentation.DEFAULT_CONFIG = {
    enhancedDatabaseReporting: false,
};
//# sourceMappingURL=instrumentation.js.map