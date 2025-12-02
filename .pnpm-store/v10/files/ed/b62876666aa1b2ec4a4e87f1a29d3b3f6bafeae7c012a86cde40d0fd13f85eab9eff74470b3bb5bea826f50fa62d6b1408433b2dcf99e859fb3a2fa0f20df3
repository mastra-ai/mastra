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
exports.RouterInstrumentation = void 0;
const api = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/** @knipignore */
const version_1 = require("./version");
const constants = require("./constants");
const utils = require("./utils");
const AttributeNames_1 = require("./enums/AttributeNames");
const LayerType_1 = require("./enums/LayerType");
const supportedVersions = ['>=1.0.0 <2'];
class RouterInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition(constants.MODULE_NAME, supportedVersions, (moduleExports, moduleVersion) => {
            this._moduleVersion = moduleVersion;
            return moduleExports;
        });
        module.files.push(new instrumentation_1.InstrumentationNodeModuleFile('router/lib/layer.js', supportedVersions, moduleExports => {
            const Layer = moduleExports;
            if ((0, instrumentation_1.isWrapped)(Layer.prototype.handle_request)) {
                this._unwrap(Layer.prototype, 'handle_request');
            }
            this._wrap(Layer.prototype, 'handle_request', this._requestHandlerPatcher.bind(this));
            if ((0, instrumentation_1.isWrapped)(Layer.prototype.handle_error)) {
                this._unwrap(Layer.prototype, 'handle_error');
            }
            this._wrap(Layer.prototype, 'handle_error', this._errorHandlerPatcher.bind(this));
            return moduleExports;
        }, moduleExports => {
            const Layer = moduleExports;
            this._unwrap(Layer.prototype, 'handle_request');
            this._unwrap(Layer.prototype, 'handle_error');
            return moduleExports;
        }));
        return module;
    }
    // Define handle_request wrapper separately to ensure the signature has the correct length
    _requestHandlerPatcher(original) {
        const instrumentation = this;
        return function wrapped_handle_request(req, res, next) {
            // Skip creating spans if the registered handler is of invalid length, because
            // we know router will ignore those
            if (utils.isInternal(this.handle) || this.handle.length > 3) {
                return original.call(this, req, res, next);
            }
            const { context, wrappedNext } = instrumentation._setupSpan(this, req, res, next);
            return api.context.with(context, original, this, req, res, wrappedNext);
        };
    }
    // Define handle_error wrapper separately to ensure the signature has the correct length
    _errorHandlerPatcher(original) {
        const instrumentation = this;
        return function wrapped_handle_request(error, req, res, next) {
            // Skip creating spans if the registered handler is of invalid length, because
            // we know router will ignore those
            if (utils.isInternal(this.handle) || this.handle.length !== 4) {
                return original.call(this, error, req, res, next);
            }
            const { context, wrappedNext } = instrumentation._setupSpan(this, req, res, next);
            return api.context.with(context, original, this, error, req, res, wrappedNext);
        };
    }
    _setupSpan(layer, req, res, next) {
        var _a, _b;
        const fnName = layer.handle.name || '<anonymous>';
        const type = layer.method
            ? LayerType_1.default.REQUEST_HANDLER
            : LayerType_1.default.MIDDLEWARE;
        const route = req.baseUrl + ((_b = (_a = req.route) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : '') || '/';
        const spanName = type === LayerType_1.default.REQUEST_HANDLER
            ? `request handler - ${route}`
            : `middleware - ${fnName}`;
        const attributes = {
            [AttributeNames_1.default.NAME]: fnName,
            [AttributeNames_1.default.VERSION]: this._moduleVersion,
            [AttributeNames_1.default.TYPE]: type,
            [semantic_conventions_1.SEMATTRS_HTTP_ROUTE]: route,
        };
        const parent = api.context.active();
        const parentSpan = api.trace.getSpan(parent);
        const span = this.tracer.startSpan(spanName, {
            attributes,
        }, parent);
        const endSpan = utils.once(span.end.bind(span));
        utils.renameHttpSpan(parentSpan, layer.method, route);
        // make sure spans are ended at least when response is finished
        res.prependOnceListener('finish', endSpan);
        const wrappedNext = err => {
            if (err) {
                span.recordException(err);
            }
            endSpan();
            if (parent) {
                return api.context.with(parent, next, undefined, err);
            }
            return next(err);
        };
        return {
            context: api.trace.setSpan(parent, span),
            wrappedNext,
        };
    }
}
exports.RouterInstrumentation = RouterInstrumentation;
//# sourceMappingURL=instrumentation.js.map