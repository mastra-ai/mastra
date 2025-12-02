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
exports.RestifyInstrumentation = void 0;
const api = require("@opentelemetry/api");
const types_1 = require("./types");
const AttributeNames_1 = require("./enums/AttributeNames");
/** @knipignore */
const version_1 = require("./version");
const constants = require("./constants");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const utils_1 = require("./utils");
const core_1 = require("@opentelemetry/core");
const supportedVersions = ['>=4.1.0 <12'];
class RestifyInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
        this._isDisabled = false;
    }
    init() {
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition(constants.MODULE_NAME, supportedVersions, (moduleExports, moduleVersion) => {
            this._moduleVersion = moduleVersion;
            return moduleExports;
        });
        module.files.push(new instrumentation_1.InstrumentationNodeModuleFile('restify/lib/server.js', supportedVersions, moduleExports => {
            this._isDisabled = false;
            const Server = moduleExports;
            for (const name of constants.RESTIFY_METHODS) {
                if ((0, instrumentation_1.isWrapped)(Server.prototype[name])) {
                    this._unwrap(Server.prototype, name);
                }
                this._wrap(Server.prototype, name, this._methodPatcher.bind(this));
            }
            for (const name of constants.RESTIFY_MW_METHODS) {
                if ((0, instrumentation_1.isWrapped)(Server.prototype[name])) {
                    this._unwrap(Server.prototype, name);
                }
                this._wrap(Server.prototype, name, this._middlewarePatcher.bind(this));
            }
            return moduleExports;
        }, moduleExports => {
            this._isDisabled = true;
            if (moduleExports) {
                const Server = moduleExports;
                for (const name of constants.RESTIFY_METHODS) {
                    this._unwrap(Server.prototype, name);
                }
                for (const name of constants.RESTIFY_MW_METHODS) {
                    this._unwrap(Server.prototype, name);
                }
            }
        }));
        return module;
    }
    _middlewarePatcher(original, methodName) {
        const instrumentation = this;
        return function (...handler) {
            return original.call(this, instrumentation._handlerPatcher({ type: types_1.LayerType.MIDDLEWARE, methodName }, handler));
        };
    }
    _methodPatcher(original, methodName) {
        const instrumentation = this;
        return function (path, ...handler) {
            return original.call(this, path, ...instrumentation._handlerPatcher({ type: types_1.LayerType.REQUEST_HANDLER, path, methodName }, handler));
        };
    }
    // will return the same type as `handler`, but all functions recursively patched
    _handlerPatcher(metadata, handler) {
        if (Array.isArray(handler)) {
            return handler.map(handler => this._handlerPatcher(metadata, handler));
        }
        if (typeof handler === 'function') {
            return (req, res, next) => {
                var _a, _b;
                if (this._isDisabled) {
                    return handler(req, res, next);
                }
                const route = typeof req.getRoute === 'function'
                    ? (_a = req.getRoute()) === null || _a === void 0 ? void 0 : _a.path
                    : (_b = req.route) === null || _b === void 0 ? void 0 : _b.path;
                // replace HTTP instrumentations name with one that contains a route
                const httpMetadata = (0, core_1.getRPCMetadata)(api.context.active());
                if ((httpMetadata === null || httpMetadata === void 0 ? void 0 : httpMetadata.type) === core_1.RPCType.HTTP) {
                    httpMetadata.route = route;
                }
                const fnName = handler.name || undefined;
                const spanName = metadata.type === types_1.LayerType.REQUEST_HANDLER
                    ? `request handler - ${route}`
                    : `middleware - ${fnName || 'anonymous'}`;
                const attributes = {
                    [AttributeNames_1.AttributeNames.NAME]: fnName,
                    [AttributeNames_1.AttributeNames.VERSION]: this._moduleVersion || 'n/a',
                    [AttributeNames_1.AttributeNames.TYPE]: metadata.type,
                    [AttributeNames_1.AttributeNames.METHOD]: metadata.methodName,
                    [semantic_conventions_1.SEMATTRS_HTTP_ROUTE]: route,
                };
                const span = this.tracer.startSpan(spanName, {
                    attributes,
                }, api.context.active());
                const instrumentation = this;
                const { requestHook } = instrumentation.getConfig();
                if (requestHook) {
                    (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                        return requestHook(span, {
                            request: req,
                            layerType: metadata.type,
                        });
                    }, e => {
                        if (e) {
                            instrumentation._diag.error('request hook failed', e);
                        }
                    }, true);
                }
                const patchedNext = (err) => {
                    span.end();
                    next(err);
                };
                patchedNext.ifError = next.ifError;
                const wrapPromise = (promise) => {
                    return promise
                        .then(value => {
                        span.end();
                        return value;
                    })
                        .catch(err => {
                        span.recordException(err);
                        span.end();
                        throw err;
                    });
                };
                const newContext = api.trace.setSpan(api.context.active(), span);
                return api.context.with(newContext, (req, res, next) => {
                    if ((0, utils_1.isAsyncFunction)(handler)) {
                        return wrapPromise(handler(req, res, next));
                    }
                    try {
                        const result = handler(req, res, next);
                        if ((0, utils_1.isPromise)(result)) {
                            return wrapPromise(result);
                        }
                        span.end();
                        return result;
                    }
                    catch (err) {
                        span.recordException(err);
                        span.end();
                        throw err;
                    }
                }, this, req, res, patchedNext);
            };
        }
        return handler;
    }
}
exports.RestifyInstrumentation = RestifyInstrumentation;
//# sourceMappingURL=instrumentation.js.map