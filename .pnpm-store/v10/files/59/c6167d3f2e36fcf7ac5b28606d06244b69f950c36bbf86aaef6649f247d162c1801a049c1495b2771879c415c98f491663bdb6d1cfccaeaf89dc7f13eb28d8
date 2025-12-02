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
exports.DataloaderInstrumentation = void 0;
const instrumentation_1 = require("@opentelemetry/instrumentation");
const api_1 = require("@opentelemetry/api");
/** @knipignore */
const version_1 = require("./version");
const MODULE_NAME = 'dataloader';
class DataloaderInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition(MODULE_NAME, ['>=2.0.0 <3'], dataloader => {
                this._patchLoad(dataloader.prototype);
                this._patchLoadMany(dataloader.prototype);
                return this._getPatchedConstructor(dataloader);
            }, dataloader => {
                if ((0, instrumentation_1.isWrapped)(dataloader.prototype.load)) {
                    this._unwrap(dataloader.prototype, 'load');
                }
                if ((0, instrumentation_1.isWrapped)(dataloader.prototype.loadMany)) {
                    this._unwrap(dataloader.prototype, 'loadMany');
                }
            }),
        ];
    }
    shouldCreateSpans() {
        const config = this.getConfig();
        const hasParentSpan = api_1.trace.getSpan(api_1.context.active()) !== undefined;
        return hasParentSpan || !config.requireParentSpan;
    }
    getSpanName(dataloader, operation) {
        const dataloaderName = dataloader.name;
        if (dataloaderName === undefined || dataloaderName === null) {
            return `${MODULE_NAME}.${operation}`;
        }
        return `${MODULE_NAME}.${operation} ${dataloaderName}`;
    }
    _getPatchedConstructor(constructor) {
        const prototype = constructor.prototype;
        const instrumentation = this;
        function PatchedDataloader(...args) {
            const inst = new constructor(...args);
            if (!instrumentation.isEnabled()) {
                return inst;
            }
            if ((0, instrumentation_1.isWrapped)(inst._batchLoadFn)) {
                instrumentation._unwrap(inst, '_batchLoadFn');
            }
            instrumentation._wrap(inst, '_batchLoadFn', original => {
                return function patchedBatchLoadFn(...args) {
                    var _a;
                    if (!instrumentation.isEnabled() ||
                        !instrumentation.shouldCreateSpans()) {
                        return original.call(this, ...args);
                    }
                    const parent = api_1.context.active();
                    const span = instrumentation.tracer.startSpan(instrumentation.getSpanName(inst, 'batch'), { links: (_a = this._batch) === null || _a === void 0 ? void 0 : _a.spanLinks }, parent);
                    return api_1.context.with(api_1.trace.setSpan(parent, span), () => {
                        return original.apply(this, args)
                            .then(value => {
                            span.end();
                            return value;
                        })
                            .catch(err => {
                            span.recordException(err);
                            span.setStatus({
                                code: api_1.SpanStatusCode.ERROR,
                                message: err.message,
                            });
                            span.end();
                            throw err;
                        });
                    });
                };
            });
            return inst;
        }
        PatchedDataloader.prototype = prototype;
        return PatchedDataloader;
    }
    _patchLoad(proto) {
        if ((0, instrumentation_1.isWrapped)(proto.load)) {
            this._unwrap(proto, 'load');
        }
        this._wrap(proto, 'load', this._getPatchedLoad.bind(this));
    }
    _getPatchedLoad(original) {
        const instrumentation = this;
        return function patchedLoad(...args) {
            if (!instrumentation.shouldCreateSpans()) {
                return original.call(this, ...args);
            }
            const parent = api_1.context.active();
            const span = instrumentation.tracer.startSpan(instrumentation.getSpanName(this, 'load'), { kind: api_1.SpanKind.CLIENT }, parent);
            return api_1.context.with(api_1.trace.setSpan(parent, span), () => {
                const result = original
                    .call(this, ...args)
                    .then(value => {
                    span.end();
                    return value;
                })
                    .catch(err => {
                    span.recordException(err);
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: err.message,
                    });
                    span.end();
                    throw err;
                });
                const loader = this;
                if (loader._batch) {
                    if (!loader._batch.spanLinks) {
                        loader._batch.spanLinks = [];
                    }
                    loader._batch.spanLinks.push({ context: span.spanContext() });
                }
                return result;
            });
        };
    }
    _patchLoadMany(proto) {
        if ((0, instrumentation_1.isWrapped)(proto.loadMany)) {
            this._unwrap(proto, 'loadMany');
        }
        this._wrap(proto, 'loadMany', this._getPatchedLoadMany.bind(this));
    }
    _getPatchedLoadMany(original) {
        const instrumentation = this;
        return function patchedLoadMany(...args) {
            if (!instrumentation.shouldCreateSpans()) {
                return original.call(this, ...args);
            }
            const parent = api_1.context.active();
            const span = instrumentation.tracer.startSpan(instrumentation.getSpanName(this, 'loadMany'), { kind: api_1.SpanKind.CLIENT }, parent);
            return api_1.context.with(api_1.trace.setSpan(parent, span), () => {
                // .loadMany never rejects, as errors from internal .load
                // calls are caught by dataloader lib
                return original.call(this, ...args).then(value => {
                    span.end();
                    return value;
                });
            });
        };
    }
}
exports.DataloaderInstrumentation = DataloaderInstrumentation;
//# sourceMappingURL=instrumentation.js.map