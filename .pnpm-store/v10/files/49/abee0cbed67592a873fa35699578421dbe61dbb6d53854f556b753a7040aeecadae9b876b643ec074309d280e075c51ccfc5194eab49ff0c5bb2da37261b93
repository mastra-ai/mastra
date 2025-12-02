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
exports.NestInstrumentation = void 0;
const api = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
/** @knipignore */
const version_1 = require("./version");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const enums_1 = require("./enums");
const supportedVersions = ['>=4.0.0 <11'];
class NestInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition(NestInstrumentation.COMPONENT, supportedVersions);
        module.files.push(this.getNestFactoryFileInstrumentation(supportedVersions), this.getRouterExecutionContextFileInstrumentation(supportedVersions));
        return module;
    }
    getNestFactoryFileInstrumentation(versions) {
        return new instrumentation_1.InstrumentationNodeModuleFile('@nestjs/core/nest-factory.js', versions, (NestFactoryStatic, moduleVersion) => {
            this.ensureWrapped(NestFactoryStatic.NestFactoryStatic.prototype, 'create', createWrapNestFactoryCreate(this.tracer, moduleVersion));
            return NestFactoryStatic;
        }, (NestFactoryStatic) => {
            this._unwrap(NestFactoryStatic.NestFactoryStatic.prototype, 'create');
        });
    }
    getRouterExecutionContextFileInstrumentation(versions) {
        return new instrumentation_1.InstrumentationNodeModuleFile('@nestjs/core/router/router-execution-context.js', versions, (RouterExecutionContext, moduleVersion) => {
            this.ensureWrapped(RouterExecutionContext.RouterExecutionContext.prototype, 'create', createWrapCreateHandler(this.tracer, moduleVersion));
            return RouterExecutionContext;
        }, (RouterExecutionContext) => {
            this._unwrap(RouterExecutionContext.RouterExecutionContext.prototype, 'create');
        });
    }
    ensureWrapped(obj, methodName, wrapper) {
        if ((0, instrumentation_1.isWrapped)(obj[methodName])) {
            this._unwrap(obj, methodName);
        }
        this._wrap(obj, methodName, wrapper);
    }
}
exports.NestInstrumentation = NestInstrumentation;
NestInstrumentation.COMPONENT = '@nestjs/core';
NestInstrumentation.COMMON_ATTRIBUTES = {
    component: NestInstrumentation.COMPONENT,
};
function createWrapNestFactoryCreate(tracer, moduleVersion) {
    return function wrapCreate(original) {
        return function createWithTrace(nestModule
        /* serverOrOptions */
        ) {
            const span = tracer.startSpan('Create Nest App', {
                attributes: Object.assign(Object.assign({}, NestInstrumentation.COMMON_ATTRIBUTES), { [enums_1.AttributeNames.TYPE]: enums_1.NestType.APP_CREATION, [enums_1.AttributeNames.VERSION]: moduleVersion, [enums_1.AttributeNames.MODULE]: nestModule.name }),
            });
            const spanContext = api.trace.setSpan(api.context.active(), span);
            return api.context.with(spanContext, async () => {
                try {
                    return await original.apply(this, arguments);
                }
                catch (e) {
                    throw addError(span, e);
                }
                finally {
                    span.end();
                }
            });
        };
    };
}
function createWrapCreateHandler(tracer, moduleVersion) {
    return function wrapCreateHandler(original) {
        return function createHandlerWithTrace(instance, callback) {
            arguments[1] = createWrapHandler(tracer, moduleVersion, callback);
            const handler = original.apply(this, arguments);
            const callbackName = callback.name;
            const instanceName = instance.constructor && instance.constructor.name
                ? instance.constructor.name
                : 'UnnamedInstance';
            const spanName = callbackName
                ? `${instanceName}.${callbackName}`
                : instanceName;
            return function (req, res, next) {
                var _a, _b;
                const span = tracer.startSpan(spanName, {
                    attributes: Object.assign(Object.assign({}, NestInstrumentation.COMMON_ATTRIBUTES), { [enums_1.AttributeNames.VERSION]: moduleVersion, [enums_1.AttributeNames.TYPE]: enums_1.NestType.REQUEST_CONTEXT, [semantic_conventions_1.SEMATTRS_HTTP_METHOD]: req.method, [semantic_conventions_1.SEMATTRS_HTTP_URL]: req.originalUrl || req.url, [semantic_conventions_1.SEMATTRS_HTTP_ROUTE]: ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || ((_b = req.routeOptions) === null || _b === void 0 ? void 0 : _b.url) || req.routerPath, [enums_1.AttributeNames.CONTROLLER]: instanceName, [enums_1.AttributeNames.CALLBACK]: callbackName }),
                });
                const spanContext = api.trace.setSpan(api.context.active(), span);
                return api.context.with(spanContext, async () => {
                    try {
                        return await handler.apply(this, arguments);
                    }
                    catch (e) {
                        throw addError(span, e);
                    }
                    finally {
                        span.end();
                    }
                });
            };
        };
    };
}
function createWrapHandler(tracer, moduleVersion, handler) {
    const spanName = handler.name || 'anonymous nest handler';
    const options = {
        attributes: Object.assign(Object.assign({}, NestInstrumentation.COMMON_ATTRIBUTES), { [enums_1.AttributeNames.VERSION]: moduleVersion, [enums_1.AttributeNames.TYPE]: enums_1.NestType.REQUEST_HANDLER, [enums_1.AttributeNames.CALLBACK]: handler.name }),
    };
    const wrappedHandler = function () {
        const span = tracer.startSpan(spanName, options);
        const spanContext = api.trace.setSpan(api.context.active(), span);
        return api.context.with(spanContext, async () => {
            try {
                return await handler.apply(this, arguments);
            }
            catch (e) {
                throw addError(span, e);
            }
            finally {
                span.end();
            }
        });
    };
    if (handler.name) {
        Object.defineProperty(wrappedHandler, 'name', { value: handler.name });
    }
    // Get the current metadata and set onto the wrapper to ensure other decorators ( ie: NestJS EventPattern / RolesGuard )
    // won't be affected by the use of this instrumentation
    Reflect.getMetadataKeys(handler).forEach(metadataKey => {
        Reflect.defineMetadata(metadataKey, Reflect.getMetadata(metadataKey, handler), wrappedHandler);
    });
    return wrappedHandler;
}
const addError = (span, error) => {
    span.recordException(error);
    span.setStatus({ code: api.SpanStatusCode.ERROR, message: error.message });
    return error;
};
//# sourceMappingURL=instrumentation.js.map