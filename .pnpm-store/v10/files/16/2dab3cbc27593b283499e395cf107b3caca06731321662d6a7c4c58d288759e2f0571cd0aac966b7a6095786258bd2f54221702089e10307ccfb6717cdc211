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
exports.GrpcInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const serverUtils_1 = require("./serverUtils");
const clientUtils_1 = require("./clientUtils");
const utils_1 = require("./utils");
const AttributeValues_1 = require("./enums/AttributeValues");
const version_1 = require("./version");
class GrpcInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super('@opentelemetry/instrumentation-grpc', version_1.VERSION, config);
        this._metadataCapture = this._createMetadataCapture();
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('@grpc/grpc-js', ['^1.0.0'], moduleExports => {
                // Patch Server methods
                this._wrap(moduleExports.Server.prototype, 'register', this._patchServer());
                // Patch Client methods
                this._wrap(moduleExports, 'makeGenericClientConstructor', this._patchClient(moduleExports));
                this._wrap(moduleExports, 'makeClientConstructor', this._patchClient(moduleExports));
                this._wrap(moduleExports, 'loadPackageDefinition', this._patchLoadPackageDefinition(moduleExports));
                this._wrap(moduleExports.Client.prototype, 'makeUnaryRequest', this._patchClientRequestMethod(moduleExports, false));
                this._wrap(moduleExports.Client.prototype, 'makeClientStreamRequest', this._patchClientRequestMethod(moduleExports, false));
                this._wrap(moduleExports.Client.prototype, 'makeServerStreamRequest', this._patchClientRequestMethod(moduleExports, true));
                this._wrap(moduleExports.Client.prototype, 'makeBidiStreamRequest', this._patchClientRequestMethod(moduleExports, true));
                return moduleExports;
            }, moduleExports => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports.Server.prototype, 'register');
                this._unwrap(moduleExports, 'makeClientConstructor');
                this._unwrap(moduleExports, 'makeGenericClientConstructor');
                this._unwrap(moduleExports, 'loadPackageDefinition');
                this._unwrap(moduleExports.Client.prototype, 'makeUnaryRequest');
                this._unwrap(moduleExports.Client.prototype, 'makeClientStreamRequest');
                this._unwrap(moduleExports.Client.prototype, 'makeServerStreamRequest');
                this._unwrap(moduleExports.Client.prototype, 'makeBidiStreamRequest');
            }),
        ];
    }
    setConfig(config = {}) {
        super.setConfig(config);
        this._metadataCapture = this._createMetadataCapture();
    }
    /**
     * Patch for grpc.Server.prototype.register(...) function. Provides auto-instrumentation for
     * client_stream, server_stream, bidi, unary server handler calls.
     */
    _patchServer() {
        const instrumentation = this;
        return (originalRegister) => {
            const config = this.getConfig();
            instrumentation._diag.debug('patched gRPC server');
            return function register(name, handler, serialize, deserialize, type) {
                const originalRegisterResult = originalRegister.call(this, name, handler, serialize, deserialize, type);
                const handlerSet = this['handlers'].get(name);
                instrumentation._wrap(handlerSet, 'func', (originalFunc) => {
                    return function func(call, callback) {
                        const self = this;
                        if ((0, serverUtils_1.shouldNotTraceServerCall)(name, config.ignoreGrpcMethods)) {
                            return (0, serverUtils_1.handleUntracedServerFunction)(type, originalFunc, call, callback);
                        }
                        const spanName = `grpc.${name.replace('/', '')}`;
                        const spanOptions = {
                            kind: api_1.SpanKind.SERVER,
                        };
                        instrumentation._diag.debug(`patch func: ${JSON.stringify(spanOptions)}`);
                        api_1.context.with(api_1.propagation.extract(api_1.ROOT_CONTEXT, call.metadata, {
                            get: (carrier, key) => carrier.get(key).map(String),
                            keys: carrier => Object.keys(carrier.getMap()),
                        }), () => {
                            const { service, method } = (0, utils_1._extractMethodAndService)(name);
                            const span = instrumentation.tracer
                                .startSpan(spanName, spanOptions)
                                .setAttributes({
                                [semantic_conventions_1.SEMATTRS_RPC_SYSTEM]: AttributeValues_1.AttributeValues.RPC_SYSTEM,
                                [semantic_conventions_1.SEMATTRS_RPC_METHOD]: method,
                                [semantic_conventions_1.SEMATTRS_RPC_SERVICE]: service,
                            });
                            instrumentation._metadataCapture.server.captureRequestMetadata(span, call.metadata);
                            instrumentation._wrap(call, 'sendMetadata', originalSendMetadata => (responseMetadata) => {
                                instrumentation._metadataCapture.server.captureResponseMetadata(span, responseMetadata);
                                originalSendMetadata.call(call, responseMetadata);
                            });
                            api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                                serverUtils_1.handleServerFunction.call(self, span, type, originalFunc, call, callback);
                            });
                        });
                    };
                });
                return originalRegisterResult;
            };
        };
    }
    /**
     * Patch for grpc.Client.make*Request(...) functions.
     * Provides auto-instrumentation for client requests when using a Client without
     * makeGenericClientConstructor/makeClientConstructor
     */
    _patchClientRequestMethod(grpcLib, hasResponseStream) {
        const instrumentation = this;
        return (original) => {
            instrumentation._diag.debug('patched makeClientStreamRequest on grpc client');
            return function makeClientStreamRequest() {
                // method must always be at first position
                const method = arguments[0];
                const { name, service, methodAttributeValue } = instrumentation._splitMethodString(method);
                // Do not attempt to trace/inject context if method is ignored
                if (method != null &&
                    (0, utils_1._methodIsIgnored)(methodAttributeValue, instrumentation.getConfig().ignoreGrpcMethods)) {
                    return original.apply(this, [...arguments]);
                }
                const modifiedArgs = [...arguments];
                const metadata = (0, clientUtils_1.extractMetadataOrSplice)(grpcLib, modifiedArgs, 4);
                const span = instrumentation.createClientSpan(name, methodAttributeValue, service, metadata);
                instrumentation.extractNetMetadata(this, span);
                // Callback is only present when there is no responseStream
                if (!hasResponseStream) {
                    // Replace the callback with the patched one if it is there.
                    // If the callback arg is not a function on the last position then the client will throw
                    // and never call the callback -> so there's nothing to patch
                    const lastArgIndex = modifiedArgs.length - 1;
                    const callback = modifiedArgs[lastArgIndex];
                    if (typeof callback === 'function') {
                        modifiedArgs[lastArgIndex] = (0, clientUtils_1.patchedCallback)(span, callback);
                    }
                }
                return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => {
                    (0, clientUtils_1.setSpanContext)(metadata);
                    const call = original.apply(this, [...modifiedArgs]);
                    (0, clientUtils_1.patchResponseMetadataEvent)(span, call, instrumentation._metadataCapture);
                    // Subscribe to response stream events when there's a response stream.
                    if (hasResponseStream) {
                        (0, clientUtils_1.patchResponseStreamEvents)(span, call);
                    }
                    return call;
                });
            };
        };
    }
    /**
     * Entry point for applying client patches to `grpc.makeClientConstructor(...)` equivalents
     * @param this GrpcJsPlugin
     */
    _patchClient(grpcClient) {
        const instrumentation = this;
        return (original) => {
            instrumentation._diag.debug('patching client');
            return function makeClientConstructor(methods, serviceName, options) {
                const client = original.call(this, methods, serviceName, options);
                instrumentation._massWrap(client.prototype, clientUtils_1.getMethodsToWrap.call(instrumentation, client, methods), instrumentation._getPatchedClientMethods(grpcClient));
                return client;
            };
        };
    }
    /**
     * Entry point for client patching for grpc.loadPackageDefinition(...)
     * @param this - GrpcJsPlugin
     */
    _patchLoadPackageDefinition(grpcClient) {
        const instrumentation = this;
        instrumentation._diag.debug('patching loadPackageDefinition');
        return (original) => {
            return function patchedLoadPackageDefinition(packageDef) {
                const result = original.call(this, packageDef);
                instrumentation._patchLoadedPackage(grpcClient, result);
                return result;
            };
        };
    }
    /**
     * Parse initial client call properties and start a span to trace its execution
     */
    _getPatchedClientMethods(grpcClient) {
        const instrumentation = this;
        return (original) => {
            instrumentation._diag.debug('patch all client methods');
            function clientMethodTrace() {
                const name = `grpc.${original.path.replace('/', '')}`;
                const args = [...arguments];
                const metadata = clientUtils_1.extractMetadataOrSpliceDefault.call(instrumentation, grpcClient, original, args);
                const { service, method } = (0, utils_1._extractMethodAndService)(original.path);
                const span = instrumentation.tracer
                    .startSpan(name, { kind: api_1.SpanKind.CLIENT })
                    .setAttributes({
                    [semantic_conventions_1.SEMATTRS_RPC_SYSTEM]: 'grpc',
                    [semantic_conventions_1.SEMATTRS_RPC_METHOD]: method,
                    [semantic_conventions_1.SEMATTRS_RPC_SERVICE]: service,
                });
                instrumentation.extractNetMetadata(this, span);
                instrumentation._metadataCapture.client.captureRequestMetadata(span, metadata);
                return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => (0, clientUtils_1.makeGrpcClientRemoteCall)(instrumentation._metadataCapture, original, args, metadata, this)(span));
            }
            Object.assign(clientMethodTrace, original);
            return clientMethodTrace;
        };
    }
    _splitMethodString(method) {
        if (method == null) {
            return { name: '', service: '', methodAttributeValue: '' };
        }
        const name = `grpc.${method.replace('/', '')}`;
        const { service, method: methodAttributeValue } = (0, utils_1._extractMethodAndService)(method);
        return { name, service, methodAttributeValue };
    }
    createClientSpan(name, methodAttributeValue, service, metadata) {
        const span = this.tracer
            .startSpan(name, { kind: api_1.SpanKind.CLIENT })
            .setAttributes({
            [semantic_conventions_1.SEMATTRS_RPC_SYSTEM]: 'grpc',
            [semantic_conventions_1.SEMATTRS_RPC_METHOD]: methodAttributeValue,
            [semantic_conventions_1.SEMATTRS_RPC_SERVICE]: service,
        });
        if (metadata != null) {
            this._metadataCapture.client.captureRequestMetadata(span, metadata);
        }
        return span;
    }
    extractNetMetadata(client, span) {
        // set net.peer.* from target (e.g., "dns:otel-productcatalogservice:8080") as a hint to APMs
        const parsedUri = utils_1.URI_REGEX.exec(client.getChannel().getTarget());
        if (parsedUri != null && parsedUri.groups != null) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_NAME, parsedUri.groups['name']);
            span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_PORT, parseInt(parsedUri.groups['port']));
        }
    }
    /**
     * Utility function to patch *all* functions loaded through a proto file.
     * Recursively searches for Client classes and patches all methods, reversing the
     * parsing done by grpc.loadPackageDefinition
     * https://github.com/grpc/grpc-node/blob/1d14203c382509c3f36132bd0244c99792cb6601/packages/grpc-js/src/make-client.ts#L200-L217
     */
    _patchLoadedPackage(grpcClient, result) {
        Object.values(result).forEach(service => {
            if (typeof service === 'function') {
                this._massWrap(service.prototype, clientUtils_1.getMethodsToWrap.call(this, service, service.service), this._getPatchedClientMethods.call(this, grpcClient));
            }
            else if (typeof service.format !== 'string') {
                // GrpcObject
                this._patchLoadedPackage.call(this, grpcClient, service);
            }
        });
    }
    _createMetadataCapture() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const config = this.getConfig();
        return {
            client: {
                captureRequestMetadata: (0, utils_1.metadataCapture)('request', (_c = (_b = (_a = config.metadataToSpanAttributes) === null || _a === void 0 ? void 0 : _a.client) === null || _b === void 0 ? void 0 : _b.requestMetadata) !== null && _c !== void 0 ? _c : []),
                captureResponseMetadata: (0, utils_1.metadataCapture)('response', (_f = (_e = (_d = config.metadataToSpanAttributes) === null || _d === void 0 ? void 0 : _d.client) === null || _e === void 0 ? void 0 : _e.responseMetadata) !== null && _f !== void 0 ? _f : []),
            },
            server: {
                captureRequestMetadata: (0, utils_1.metadataCapture)('request', (_j = (_h = (_g = config.metadataToSpanAttributes) === null || _g === void 0 ? void 0 : _g.server) === null || _h === void 0 ? void 0 : _h.requestMetadata) !== null && _j !== void 0 ? _j : []),
                captureResponseMetadata: (0, utils_1.metadataCapture)('response', (_m = (_l = (_k = config.metadataToSpanAttributes) === null || _k === void 0 ? void 0 : _k.server) === null || _l === void 0 ? void 0 : _l.responseMetadata) !== null && _m !== void 0 ? _m : []),
            },
        };
    }
}
exports.GrpcInstrumentation = GrpcInstrumentation;
//# sourceMappingURL=instrumentation.js.map