"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsInstrumentation = void 0;
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
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const enums_1 = require("./enums");
const services_1 = require("./services");
/** @knipignore */
const version_1 = require("./version");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const utils_1 = require("./utils");
const propwrap_1 = require("./propwrap");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const V3_CLIENT_CONFIG_KEY = Symbol('opentelemetry.instrumentation.aws-sdk.client.config');
const REQUEST_SPAN_KEY = Symbol('opentelemetry.instrumentation.aws-sdk.span');
class AwsInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
        this.servicesExtensions = new services_1.ServicesExtensions();
    }
    init() {
        const v3MiddlewareStackFileOldVersions = new instrumentation_1.InstrumentationNodeModuleFile('@aws-sdk/middleware-stack/dist/cjs/MiddlewareStack.js', ['>=3.1.0 <3.35.0'], this.patchV3ConstructStack.bind(this), this.unpatchV3ConstructStack.bind(this));
        const v3MiddlewareStackFileNewVersions = new instrumentation_1.InstrumentationNodeModuleFile('@aws-sdk/middleware-stack/dist-cjs/MiddlewareStack.js', ['>=3.35.0'], this.patchV3ConstructStack.bind(this), this.unpatchV3ConstructStack.bind(this));
        // as for aws-sdk v3.13.1, constructStack is exported from @aws-sdk/middleware-stack as
        // getter instead of function, which fails shimmer.
        // so we are patching the MiddlewareStack.js file directly to get around it.
        const v3MiddlewareStack = new instrumentation_1.InstrumentationNodeModuleDefinition('@aws-sdk/middleware-stack', ['^3.1.0'], undefined, undefined, [v3MiddlewareStackFileOldVersions, v3MiddlewareStackFileNewVersions]);
        // Patch for @smithy/middleware-stack for @aws-sdk/* packages v3.363.0+.
        // As of @smithy/middleware-stack@2.1.0 `constructStack` is only available
        // as a getter, so we cannot use `this._wrap()`.
        const self = this;
        const v3SmithyMiddlewareStack = new instrumentation_1.InstrumentationNodeModuleDefinition('@smithy/middleware-stack', ['>=2.0.0'], (moduleExports, moduleVersion) => {
            const newExports = (0, propwrap_1.propwrap)(moduleExports, 'constructStack', (orig) => {
                self._diag.debug('propwrapping aws-sdk v3 constructStack');
                return self._getV3ConstructStackPatch(moduleVersion, orig);
            });
            return newExports;
        });
        const v3SmithyClient = new instrumentation_1.InstrumentationNodeModuleDefinition('@aws-sdk/smithy-client', ['^3.1.0'], this.patchV3SmithyClient.bind(this), this.unpatchV3SmithyClient.bind(this));
        // patch for new @smithy/smithy-client for aws-sdk packages v3.363.0+
        const v3NewSmithyClient = new instrumentation_1.InstrumentationNodeModuleDefinition('@smithy/smithy-client', ['>=1.0.3'], this.patchV3SmithyClient.bind(this), this.unpatchV3SmithyClient.bind(this));
        const v2Request = new instrumentation_1.InstrumentationNodeModuleFile('aws-sdk/lib/core.js', ['^2.308.0'], this.patchV2.bind(this), this.unpatchV2.bind(this));
        const v2Module = new instrumentation_1.InstrumentationNodeModuleDefinition('aws-sdk', ['^2.308.0'], undefined, undefined, [v2Request]);
        return [
            v2Module,
            v3MiddlewareStack,
            v3SmithyMiddlewareStack,
            v3SmithyClient,
            v3NewSmithyClient,
        ];
    }
    patchV3ConstructStack(moduleExports, moduleVersion) {
        this._wrap(moduleExports, 'constructStack', this._getV3ConstructStackPatch.bind(this, moduleVersion));
        return moduleExports;
    }
    unpatchV3ConstructStack(moduleExports) {
        this._unwrap(moduleExports, 'constructStack');
        return moduleExports;
    }
    patchV3SmithyClient(moduleExports) {
        this._wrap(moduleExports.Client.prototype, 'send', this._getV3SmithyClientSendPatch.bind(this));
        return moduleExports;
    }
    unpatchV3SmithyClient(moduleExports) {
        this._unwrap(moduleExports.Client.prototype, 'send');
        return moduleExports;
    }
    patchV2(moduleExports, moduleVersion) {
        this.unpatchV2(moduleExports);
        this._wrap(moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Request.prototype, 'send', this._getRequestSendPatch.bind(this, moduleVersion));
        this._wrap(moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Request.prototype, 'promise', this._getRequestPromisePatch.bind(this, moduleVersion));
        return moduleExports;
    }
    unpatchV2(moduleExports) {
        if ((0, instrumentation_1.isWrapped)(moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Request.prototype.send)) {
            this._unwrap(moduleExports.Request.prototype, 'send');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Request.prototype.promise)) {
            this._unwrap(moduleExports.Request.prototype, 'promise');
        }
    }
    _startAwsV3Span(normalizedRequest, metadata) {
        var _a, _b;
        const name = (_a = metadata.spanName) !== null && _a !== void 0 ? _a : `${normalizedRequest.serviceName}.${normalizedRequest.commandName}`;
        const newSpan = this.tracer.startSpan(name, {
            kind: (_b = metadata.spanKind) !== null && _b !== void 0 ? _b : api_1.SpanKind.CLIENT,
            attributes: Object.assign(Object.assign({}, (0, utils_1.extractAttributesFromNormalizedRequest)(normalizedRequest)), metadata.spanAttributes),
        });
        return newSpan;
    }
    _startAwsV2Span(request, metadata, normalizedRequest) {
        var _a, _b, _c, _d, _e;
        const operation = request.operation;
        const service = request.service;
        const serviceIdentifier = service === null || service === void 0 ? void 0 : service.serviceIdentifier;
        const name = (_a = metadata.spanName) !== null && _a !== void 0 ? _a : `${normalizedRequest.serviceName}.${normalizedRequest.commandName}`;
        const newSpan = this.tracer.startSpan(name, {
            kind: (_b = metadata.spanKind) !== null && _b !== void 0 ? _b : api_1.SpanKind.CLIENT,
            attributes: Object.assign(Object.assign({ [enums_1.AttributeNames.AWS_OPERATION]: operation, [enums_1.AttributeNames.AWS_SIGNATURE_VERSION]: (_c = service === null || service === void 0 ? void 0 : service.config) === null || _c === void 0 ? void 0 : _c.signatureVersion, [enums_1.AttributeNames.AWS_SERVICE_API]: (_d = service === null || service === void 0 ? void 0 : service.api) === null || _d === void 0 ? void 0 : _d.className, [enums_1.AttributeNames.AWS_SERVICE_IDENTIFIER]: serviceIdentifier, [enums_1.AttributeNames.AWS_SERVICE_NAME]: (_e = service === null || service === void 0 ? void 0 : service.api) === null || _e === void 0 ? void 0 : _e.abbreviation }, (0, utils_1.extractAttributesFromNormalizedRequest)(normalizedRequest)), metadata.spanAttributes),
        });
        return newSpan;
    }
    _callUserPreRequestHook(span, request, moduleVersion) {
        const { preRequestHook } = this.getConfig();
        if (preRequestHook) {
            const requestInfo = {
                moduleVersion,
                request,
            };
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => preRequestHook(span, requestInfo), (e) => {
                if (e)
                    api_1.diag.error(`${AwsInstrumentation.component} instrumentation: preRequestHook error`, e);
            }, true);
        }
    }
    _callUserResponseHook(span, response) {
        const { responseHook } = this.getConfig();
        if (!responseHook)
            return;
        const responseInfo = {
            response,
        };
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => responseHook(span, responseInfo), (e) => {
            if (e)
                api_1.diag.error(`${AwsInstrumentation.component} instrumentation: responseHook error`, e);
        }, true);
    }
    _registerV2CompletedEvent(span, v2Request, normalizedRequest, completedEventContext) {
        const self = this;
        v2Request.on('complete', response => {
            // read issue https://github.com/aspecto-io/opentelemetry-ext-js/issues/60
            api_1.context.with(completedEventContext, () => {
                var _a;
                if (!v2Request[REQUEST_SPAN_KEY]) {
                    return;
                }
                delete v2Request[REQUEST_SPAN_KEY];
                const requestId = response.requestId;
                const normalizedResponse = {
                    data: response.data,
                    request: normalizedRequest,
                    requestId: requestId,
                };
                self._callUserResponseHook(span, normalizedResponse);
                if (response.error) {
                    span.recordException(response.error);
                }
                else {
                    this.servicesExtensions.responseHook(normalizedResponse, span, self.tracer, self.getConfig());
                }
                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_ID, requestId);
                const httpStatusCode = (_a = response.httpResponse) === null || _a === void 0 ? void 0 : _a.statusCode;
                if (httpStatusCode) {
                    span.setAttribute(semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE, httpStatusCode);
                }
                span.end();
            });
        });
    }
    _getV3ConstructStackPatch(moduleVersion, original) {
        const self = this;
        return function constructStack(...args) {
            const stack = original.apply(this, args);
            self.patchV3MiddlewareStack(moduleVersion, stack);
            return stack;
        };
    }
    _getV3SmithyClientSendPatch(original) {
        return function send(command, ...args) {
            command[V3_CLIENT_CONFIG_KEY] = this.config;
            return original.apply(this, [command, ...args]);
        };
    }
    patchV3MiddlewareStack(moduleVersion, middlewareStackToPatch) {
        if (!(0, instrumentation_1.isWrapped)(middlewareStackToPatch.resolve)) {
            this._wrap(middlewareStackToPatch, 'resolve', this._getV3MiddlewareStackResolvePatch.bind(this, moduleVersion));
        }
        // 'clone' and 'concat' functions are internally calling 'constructStack' which is in same
        // module, thus not patched, and we need to take care of it specifically.
        this._wrap(middlewareStackToPatch, 'clone', this._getV3MiddlewareStackClonePatch.bind(this, moduleVersion));
        this._wrap(middlewareStackToPatch, 'concat', this._getV3MiddlewareStackClonePatch.bind(this, moduleVersion));
    }
    _getV3MiddlewareStackClonePatch(moduleVersion, original) {
        const self = this;
        return function (...args) {
            const newStack = original.apply(this, args);
            self.patchV3MiddlewareStack(moduleVersion, newStack);
            return newStack;
        };
    }
    _getV3MiddlewareStackResolvePatch(moduleVersion, original) {
        const self = this;
        return function (_handler, awsExecutionContext) {
            const origHandler = original.call(this, _handler, awsExecutionContext);
            const patchedHandler = function (command) {
                var _a, _b, _c, _d;
                const clientConfig = command[V3_CLIENT_CONFIG_KEY];
                const regionPromise = (_a = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.region) === null || _a === void 0 ? void 0 : _a.call(clientConfig);
                const serviceName = (_b = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.serviceId) !== null && _b !== void 0 ? _b : (0, utils_1.removeSuffixFromStringIfExists)(awsExecutionContext.clientName, 'Client');
                const commandName = (_c = awsExecutionContext.commandName) !== null && _c !== void 0 ? _c : (_d = command.constructor) === null || _d === void 0 ? void 0 : _d.name;
                const normalizedRequest = (0, utils_1.normalizeV3Request)(serviceName, commandName, command.input, undefined);
                const requestMetadata = self.servicesExtensions.requestPreSpanHook(normalizedRequest, self.getConfig(), self._diag);
                const span = self._startAwsV3Span(normalizedRequest, requestMetadata);
                const activeContextWithSpan = api_1.trace.setSpan(api_1.context.active(), span);
                const handlerPromise = new Promise((resolve, reject) => {
                    Promise.resolve(regionPromise)
                        .then(resolvedRegion => {
                        normalizedRequest.region = resolvedRegion;
                        span.setAttribute(enums_1.AttributeNames.AWS_REGION, resolvedRegion);
                    })
                        .catch(e => {
                        // there is nothing much we can do in this case.
                        // we'll just continue without region
                        api_1.diag.debug(`${AwsInstrumentation.component} instrumentation: failed to extract region from async function`, e);
                    })
                        .finally(() => {
                        self._callUserPreRequestHook(span, normalizedRequest, moduleVersion);
                        const resultPromise = api_1.context.with(activeContextWithSpan, () => {
                            self.servicesExtensions.requestPostSpanHook(normalizedRequest);
                            return self._callOriginalFunction(() => origHandler.call(this, command));
                        });
                        const promiseWithResponseLogic = resultPromise
                            .then(response => {
                            var _a, _b, _c, _d, _e, _f;
                            const requestId = (_b = (_a = response.output) === null || _a === void 0 ? void 0 : _a.$metadata) === null || _b === void 0 ? void 0 : _b.requestId;
                            if (requestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_ID, requestId);
                            }
                            const httpStatusCode = (_d = (_c = response.output) === null || _c === void 0 ? void 0 : _c.$metadata) === null || _d === void 0 ? void 0 : _d.httpStatusCode;
                            if (httpStatusCode) {
                                span.setAttribute(semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE, httpStatusCode);
                            }
                            const extendedRequestId = (_f = (_e = response.output) === null || _e === void 0 ? void 0 : _e.$metadata) === null || _f === void 0 ? void 0 : _f.extendedRequestId;
                            if (extendedRequestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_EXTENDED_ID, extendedRequestId);
                            }
                            const normalizedResponse = {
                                data: response.output,
                                request: normalizedRequest,
                                requestId: requestId,
                            };
                            self.servicesExtensions.responseHook(normalizedResponse, span, self.tracer, self.getConfig());
                            self._callUserResponseHook(span, normalizedResponse);
                            return response;
                        })
                            .catch(err => {
                            var _a;
                            const requestId = err === null || err === void 0 ? void 0 : err.RequestId;
                            if (requestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_ID, requestId);
                            }
                            const httpStatusCode = (_a = err === null || err === void 0 ? void 0 : err.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode;
                            if (httpStatusCode) {
                                span.setAttribute(semantic_conventions_1.SEMATTRS_HTTP_STATUS_CODE, httpStatusCode);
                            }
                            const extendedRequestId = err === null || err === void 0 ? void 0 : err.extendedRequestId;
                            if (extendedRequestId) {
                                span.setAttribute(enums_1.AttributeNames.AWS_REQUEST_EXTENDED_ID, extendedRequestId);
                            }
                            span.setStatus({
                                code: api_1.SpanStatusCode.ERROR,
                                message: err.message,
                            });
                            span.recordException(err);
                            throw err;
                        })
                            .finally(() => {
                            span.end();
                        });
                        promiseWithResponseLogic
                            .then(res => {
                            resolve(res);
                        })
                            .catch(err => reject(err));
                    });
                });
                return requestMetadata.isIncoming
                    ? (0, utils_1.bindPromise)(handlerPromise, activeContextWithSpan, 2)
                    : handlerPromise;
            };
            return patchedHandler;
        };
    }
    _getRequestSendPatch(moduleVersion, original) {
        const self = this;
        return function (callback) {
            /*
              if the span was already started, we don't want to start a new one
              when Request.promise() is called
            */
            if (this[REQUEST_SPAN_KEY]) {
                return original.call(this, callback);
            }
            const normalizedRequest = (0, utils_1.normalizeV2Request)(this);
            const requestMetadata = self.servicesExtensions.requestPreSpanHook(normalizedRequest, self.getConfig(), self._diag);
            const span = self._startAwsV2Span(this, requestMetadata, normalizedRequest);
            this[REQUEST_SPAN_KEY] = span;
            const activeContextWithSpan = api_1.trace.setSpan(api_1.context.active(), span);
            const callbackWithContext = api_1.context.bind(activeContextWithSpan, callback);
            self._callUserPreRequestHook(span, normalizedRequest, moduleVersion);
            self._registerV2CompletedEvent(span, this, normalizedRequest, activeContextWithSpan);
            return api_1.context.with(activeContextWithSpan, () => {
                self.servicesExtensions.requestPostSpanHook(normalizedRequest);
                return self._callOriginalFunction(() => original.call(this, callbackWithContext));
            });
        };
    }
    _getRequestPromisePatch(moduleVersion, original) {
        const self = this;
        return function (...args) {
            // if the span was already started, we don't want to start a new one when Request.promise() is called
            if (this[REQUEST_SPAN_KEY]) {
                return original.apply(this, args);
            }
            const normalizedRequest = (0, utils_1.normalizeV2Request)(this);
            const requestMetadata = self.servicesExtensions.requestPreSpanHook(normalizedRequest, self.getConfig(), self._diag);
            const span = self._startAwsV2Span(this, requestMetadata, normalizedRequest);
            this[REQUEST_SPAN_KEY] = span;
            const activeContextWithSpan = api_1.trace.setSpan(api_1.context.active(), span);
            self._callUserPreRequestHook(span, normalizedRequest, moduleVersion);
            self._registerV2CompletedEvent(span, this, normalizedRequest, activeContextWithSpan);
            const origPromise = api_1.context.with(activeContextWithSpan, () => {
                self.servicesExtensions.requestPostSpanHook(normalizedRequest);
                return self._callOriginalFunction(() => original.call(this, arguments));
            });
            return requestMetadata.isIncoming
                ? (0, utils_1.bindPromise)(origPromise, activeContextWithSpan)
                : origPromise;
        };
    }
    _callOriginalFunction(originalFunction) {
        if (this.getConfig().suppressInternalInstrumentation) {
            return api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), originalFunction);
        }
        else {
            return originalFunction();
        }
    }
}
exports.AwsInstrumentation = AwsInstrumentation;
AwsInstrumentation.component = 'aws-sdk';
//# sourceMappingURL=aws-sdk.js.map