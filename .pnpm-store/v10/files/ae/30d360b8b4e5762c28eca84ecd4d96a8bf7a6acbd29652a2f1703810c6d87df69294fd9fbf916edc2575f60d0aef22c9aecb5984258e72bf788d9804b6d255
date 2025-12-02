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
exports.DnsInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const utils = require("./utils");
/** @knipignore */
const version_1 = require("./version");
/**
 * Dns instrumentation for Opentelemetry
 */
class DnsInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('dns', ['*'], (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.lookup)) {
                    this._unwrap(moduleExports, 'lookup');
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._wrap(moduleExports, 'lookup', this._getLookup());
                this._wrap(moduleExports.promises, 'lookup', 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._getLookup());
                return moduleExports;
            }, moduleExports => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports, 'lookup');
                this._unwrap(moduleExports.promises, 'lookup');
            }),
            new instrumentation_1.InstrumentationNodeModuleDefinition('dns/promises', ['*'], (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.lookup)) {
                    this._unwrap(moduleExports, 'lookup');
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._wrap(moduleExports, 'lookup', this._getLookup());
                return moduleExports;
            }, moduleExports => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports, 'lookup');
            }),
        ];
    }
    /**
     * Get the patched lookup function
     */
    _getLookup() {
        return (original) => {
            return this._getPatchLookupFunction(original);
        };
    }
    /**
     * Creates spans for lookup operations, restoring spans' context if applied.
     */
    _getPatchLookupFunction(original) {
        const plugin = this;
        return function patchedLookup(hostname, ...args) {
            if (utils.isIgnored(hostname, plugin.getConfig().ignoreHostnames, (e) => api_1.diag.error('caught ignoreHostname error: ', e))) {
                return original.apply(this, [hostname, ...args]);
            }
            const argsCount = args.length;
            api_1.diag.debug('wrap lookup callback function and starts span');
            const name = utils.getOperationName('lookup');
            const span = plugin.tracer.startSpan(name, {
                kind: api_1.SpanKind.CLIENT,
            });
            const originalCallback = args[argsCount - 1];
            if (typeof originalCallback === 'function') {
                args[argsCount - 1] = plugin._wrapLookupCallback(originalCallback, span);
                return (0, instrumentation_1.safeExecuteInTheMiddle)(() => original.apply(this, [hostname, ...args]), error => {
                    if (error != null) {
                        utils.setError(error, span);
                        span.end();
                    }
                });
            }
            else {
                const promise = (0, instrumentation_1.safeExecuteInTheMiddle)(() => original.apply(this, [
                    hostname,
                    ...args,
                ]), error => {
                    if (error != null) {
                        utils.setError(error, span);
                        span.end();
                    }
                });
                promise.then(result => {
                    utils.setLookupAttributes(span, result);
                    span.end();
                }, (e) => {
                    utils.setError(e, span);
                    span.end();
                });
                return promise;
            }
        };
    }
    /**
     * Wrap lookup callback function
     */
    _wrapLookupCallback(original, span) {
        return function wrappedLookupCallback(err, address, family) {
            api_1.diag.debug('executing wrapped lookup callback function');
            if (err !== null) {
                utils.setError(err, span);
            }
            else {
                utils.setLookupAttributes(span, address, family);
            }
            span.end();
            api_1.diag.debug('executing original lookup callback function');
            return original.apply(this, arguments);
        };
    }
}
exports.DnsInstrumentation = DnsInstrumentation;
//# sourceMappingURL=instrumentation.js.map