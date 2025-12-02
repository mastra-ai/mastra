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
exports.FastifyInstrumentation = exports.ANONYMOUS_NAME = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const constants_1 = require("./constants");
const AttributeNames_1 = require("./enums/AttributeNames");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
exports.ANONYMOUS_NAME = 'anonymous';
/**
 * Fastify instrumentation for OpenTelemetry
 * @deprecated This instrumentation is deprecated in favor of the official instrumentation package `@fastify/otel`,
 *             which is maintained by the fastify authors.
 */
class FastifyInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('fastify', ['>=3.0.0 <6'], moduleExports => {
                return this._patchConstructor(moduleExports);
            }),
        ];
    }
    _hookOnRequest() {
        const instrumentation = this;
        return function onRequest(request, reply, done) {
            if (!instrumentation.isEnabled()) {
                return done();
            }
            instrumentation._wrap(reply, 'send', instrumentation._patchSend());
            const anyRequest = request;
            const rpcMetadata = (0, core_1.getRPCMetadata)(api_1.context.active());
            const routeName = anyRequest.routeOptions
                ? anyRequest.routeOptions.url // since fastify@4.10.0
                : request.routerPath;
            if (routeName && (rpcMetadata === null || rpcMetadata === void 0 ? void 0 : rpcMetadata.type) === core_1.RPCType.HTTP) {
                rpcMetadata.route = routeName;
            }
            done();
        };
    }
    _wrapHandler(pluginName, hookName, original, syncFunctionWithDone) {
        const instrumentation = this;
        this._diag.debug('Patching fastify route.handler function');
        return function (...args) {
            if (!instrumentation.isEnabled()) {
                return original.apply(this, args);
            }
            const name = original.name || pluginName || exports.ANONYMOUS_NAME;
            const spanName = `${AttributeNames_1.FastifyNames.MIDDLEWARE} - ${name}`;
            const reply = args[1];
            const span = (0, utils_1.startSpan)(reply, instrumentation.tracer, spanName, {
                [AttributeNames_1.AttributeNames.FASTIFY_TYPE]: AttributeNames_1.FastifyTypes.MIDDLEWARE,
                [AttributeNames_1.AttributeNames.PLUGIN_NAME]: pluginName,
                [AttributeNames_1.AttributeNames.HOOK_NAME]: hookName,
            });
            const origDone = syncFunctionWithDone &&
                args[args.length - 1];
            if (origDone) {
                args[args.length - 1] = function (...doneArgs) {
                    (0, utils_1.endSpan)(reply);
                    origDone.apply(this, doneArgs);
                };
            }
            return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                return (0, utils_1.safeExecuteInTheMiddleMaybePromise)(() => {
                    return original.apply(this, args);
                }, err => {
                    if (err instanceof Error) {
                        span.setStatus({
                            code: api_1.SpanStatusCode.ERROR,
                            message: err.message,
                        });
                        span.recordException(err);
                    }
                    // async hooks should end the span as soon as the promise is resolved
                    if (!syncFunctionWithDone) {
                        (0, utils_1.endSpan)(reply);
                    }
                });
            });
        };
    }
    _wrapAddHook() {
        const instrumentation = this;
        this._diag.debug('Patching fastify server.addHook function');
        return function (original) {
            return function wrappedAddHook(...args) {
                const name = args[0];
                const handler = args[1];
                const pluginName = this.pluginName;
                if (!constants_1.hooksNamesToWrap.has(name)) {
                    return original.apply(this, args);
                }
                const syncFunctionWithDone = typeof args[args.length - 1] === 'function' &&
                    handler.constructor.name !== 'AsyncFunction';
                return original.apply(this, [
                    name,
                    instrumentation._wrapHandler(pluginName, name, handler, syncFunctionWithDone),
                ]);
            };
        };
    }
    _patchConstructor(moduleExports) {
        const instrumentation = this;
        function fastify(...args) {
            const app = moduleExports.fastify.apply(this, args);
            app.addHook('onRequest', instrumentation._hookOnRequest());
            app.addHook('preHandler', instrumentation._hookPreHandler());
            instrumentation._wrap(app, 'addHook', instrumentation._wrapAddHook());
            return app;
        }
        if (moduleExports.errorCodes !== undefined) {
            fastify.errorCodes = moduleExports.errorCodes;
        }
        fastify.fastify = fastify;
        fastify.default = fastify;
        return fastify;
    }
    _patchSend() {
        const instrumentation = this;
        this._diag.debug('Patching fastify reply.send function');
        return function patchSend(original) {
            return function send(...args) {
                const maybeError = args[0];
                if (!instrumentation.isEnabled()) {
                    return original.apply(this, args);
                }
                return (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                    return original.apply(this, args);
                }, err => {
                    if (!err && maybeError instanceof Error) {
                        err = maybeError;
                    }
                    (0, utils_1.endSpan)(this, err);
                });
            };
        };
    }
    _hookPreHandler() {
        const instrumentation = this;
        this._diag.debug('Patching fastify preHandler function');
        return function preHandler(request, reply, done) {
            var _a, _b;
            if (!instrumentation.isEnabled()) {
                return done();
            }
            const anyRequest = request;
            const handler = ((_a = anyRequest.routeOptions) === null || _a === void 0 ? void 0 : _a.handler) || ((_b = anyRequest.context) === null || _b === void 0 ? void 0 : _b.handler);
            const handlerName = (handler === null || handler === void 0 ? void 0 : handler.name.startsWith('bound '))
                ? handler.name.substring(6)
                : handler === null || handler === void 0 ? void 0 : handler.name;
            const spanName = `${AttributeNames_1.FastifyNames.REQUEST_HANDLER} - ${handlerName || this.pluginName || exports.ANONYMOUS_NAME}`;
            const spanAttributes = {
                [AttributeNames_1.AttributeNames.PLUGIN_NAME]: this.pluginName,
                [AttributeNames_1.AttributeNames.FASTIFY_TYPE]: AttributeNames_1.FastifyTypes.REQUEST_HANDLER,
                [semantic_conventions_1.SEMATTRS_HTTP_ROUTE]: anyRequest.routeOptions
                    ? anyRequest.routeOptions.url // since fastify@4.10.0
                    : request.routerPath,
            };
            if (handlerName) {
                spanAttributes[AttributeNames_1.AttributeNames.FASTIFY_NAME] = handlerName;
            }
            const span = (0, utils_1.startSpan)(reply, instrumentation.tracer, spanName, spanAttributes);
            const { requestHook } = instrumentation.getConfig();
            if (requestHook) {
                (0, instrumentation_1.safeExecuteInTheMiddle)(() => requestHook(span, { request }), e => {
                    if (e) {
                        instrumentation._diag.error('request hook failed', e);
                    }
                }, true);
            }
            return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                done();
            });
        };
    }
}
exports.FastifyInstrumentation = FastifyInstrumentation;
//# sourceMappingURL=instrumentation.js.map