"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongooseInstrumentation = exports._STORED_PARENT_SPAN = void 0;
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
const utils_1 = require("./utils");
const instrumentation_1 = require("@opentelemetry/instrumentation");
/** @knipignore */
const version_1 = require("./version");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const contextCaptureFunctionsCommon = [
    'deleteOne',
    'deleteMany',
    'find',
    'findOne',
    'estimatedDocumentCount',
    'countDocuments',
    'distinct',
    'where',
    '$where',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
];
const contextCaptureFunctions6 = [
    'remove',
    'count',
    'findOneAndRemove',
    ...contextCaptureFunctionsCommon,
];
const contextCaptureFunctions7 = [
    'count',
    'findOneAndRemove',
    ...contextCaptureFunctionsCommon,
];
const contextCaptureFunctions8 = [...contextCaptureFunctionsCommon];
function getContextCaptureFunctions(moduleVersion) {
    /* istanbul ignore next */
    if (!moduleVersion) {
        return contextCaptureFunctionsCommon;
    }
    else if (moduleVersion.startsWith('6.') || moduleVersion.startsWith('5.')) {
        return contextCaptureFunctions6;
    }
    else if (moduleVersion.startsWith('7.')) {
        return contextCaptureFunctions7;
    }
    else {
        return contextCaptureFunctions8;
    }
}
function instrumentRemove(moduleVersion) {
    return ((moduleVersion &&
        (moduleVersion.startsWith('5.') || moduleVersion.startsWith('6.'))) ||
        false);
}
// when mongoose functions are called, we store the original call context
// and then set it as the parent for the spans created by Query/Aggregate exec()
// calls. this bypass the unlinked spans issue on thenables await operations.
exports._STORED_PARENT_SPAN = Symbol('stored-parent-span');
class MongooseInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition('mongoose', ['>=5.9.7 <9'], this.patch.bind(this), this.unpatch.bind(this));
        return module;
    }
    patch(moduleExports, moduleVersion) {
        this._wrap(moduleExports.Model.prototype, 'save', this.patchOnModelMethods('save', moduleVersion));
        // mongoose applies this code on module require:
        // Model.prototype.$save = Model.prototype.save;
        // which captures the save function before it is patched.
        // so we need to apply the same logic after instrumenting the save function.
        moduleExports.Model.prototype.$save = moduleExports.Model.prototype.save;
        if (instrumentRemove(moduleVersion)) {
            this._wrap(moduleExports.Model.prototype, 'remove', this.patchOnModelMethods('remove', moduleVersion));
        }
        this._wrap(moduleExports.Query.prototype, 'exec', this.patchQueryExec(moduleVersion));
        this._wrap(moduleExports.Aggregate.prototype, 'exec', this.patchAggregateExec(moduleVersion));
        const contextCaptureFunctions = getContextCaptureFunctions(moduleVersion);
        contextCaptureFunctions.forEach((funcName) => {
            this._wrap(moduleExports.Query.prototype, funcName, this.patchAndCaptureSpanContext(funcName));
        });
        this._wrap(moduleExports.Model, 'aggregate', this.patchModelAggregate());
        return moduleExports;
    }
    unpatch(moduleExports, moduleVersion) {
        const contextCaptureFunctions = getContextCaptureFunctions(moduleVersion);
        this._unwrap(moduleExports.Model.prototype, 'save');
        // revert the patch for $save which we applied by aliasing it to patched `save`
        moduleExports.Model.prototype.$save = moduleExports.Model.prototype.save;
        if (instrumentRemove(moduleVersion)) {
            this._unwrap(moduleExports.Model.prototype, 'remove');
        }
        this._unwrap(moduleExports.Query.prototype, 'exec');
        this._unwrap(moduleExports.Aggregate.prototype, 'exec');
        contextCaptureFunctions.forEach((funcName) => {
            this._unwrap(moduleExports.Query.prototype, funcName);
        });
        this._unwrap(moduleExports.Model, 'aggregate');
    }
    patchAggregateExec(moduleVersion) {
        const self = this;
        return (originalAggregate) => {
            return function exec(callback) {
                var _a;
                if (self.getConfig().requireParentSpan &&
                    api_1.trace.getSpan(api_1.context.active()) === undefined) {
                    return originalAggregate.apply(this, arguments);
                }
                const parentSpan = this[exports._STORED_PARENT_SPAN];
                const attributes = {};
                const { dbStatementSerializer } = self.getConfig();
                if (dbStatementSerializer) {
                    attributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = dbStatementSerializer('aggregate', {
                        options: this.options,
                        aggregatePipeline: this._pipeline,
                    });
                }
                const span = self._startSpan(this._model.collection, (_a = this._model) === null || _a === void 0 ? void 0 : _a.modelName, 'aggregate', attributes, parentSpan);
                return self._handleResponse(span, originalAggregate, this, arguments, callback, moduleVersion);
            };
        };
    }
    patchQueryExec(moduleVersion) {
        const self = this;
        return (originalExec) => {
            return function exec(callback) {
                if (self.getConfig().requireParentSpan &&
                    api_1.trace.getSpan(api_1.context.active()) === undefined) {
                    return originalExec.apply(this, arguments);
                }
                const parentSpan = this[exports._STORED_PARENT_SPAN];
                const attributes = {};
                const { dbStatementSerializer } = self.getConfig();
                if (dbStatementSerializer) {
                    attributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = dbStatementSerializer(this.op, {
                        condition: this._conditions,
                        updates: this._update,
                        options: this.options,
                        fields: this._fields,
                    });
                }
                const span = self._startSpan(this.mongooseCollection, this.model.modelName, this.op, attributes, parentSpan);
                return self._handleResponse(span, originalExec, this, arguments, callback, moduleVersion);
            };
        };
    }
    patchOnModelMethods(op, moduleVersion) {
        const self = this;
        return (originalOnModelFunction) => {
            return function method(options, callback) {
                if (self.getConfig().requireParentSpan &&
                    api_1.trace.getSpan(api_1.context.active()) === undefined) {
                    return originalOnModelFunction.apply(this, arguments);
                }
                const serializePayload = { document: this };
                if (options && !(options instanceof Function)) {
                    serializePayload.options = options;
                }
                const attributes = {};
                const { dbStatementSerializer } = self.getConfig();
                if (dbStatementSerializer) {
                    attributes[semantic_conventions_1.SEMATTRS_DB_STATEMENT] = dbStatementSerializer(op, serializePayload);
                }
                const span = self._startSpan(this.constructor.collection, this.constructor.modelName, op, attributes);
                if (options instanceof Function) {
                    callback = options;
                    options = undefined;
                }
                return self._handleResponse(span, originalOnModelFunction, this, arguments, callback, moduleVersion);
            };
        };
    }
    // we want to capture the otel span on the object which is calling exec.
    // in the special case of aggregate, we need have no function to path
    // on the Aggregate object to capture the context on, so we patch
    // the aggregate of Model, and set the context on the Aggregate object
    patchModelAggregate() {
        const self = this;
        return (original) => {
            return function captureSpanContext() {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const aggregate = self._callOriginalFunction(() => original.apply(this, arguments));
                if (aggregate)
                    aggregate[exports._STORED_PARENT_SPAN] = currentSpan;
                return aggregate;
            };
        };
    }
    patchAndCaptureSpanContext(funcName) {
        const self = this;
        return (original) => {
            return function captureSpanContext() {
                this[exports._STORED_PARENT_SPAN] = api_1.trace.getSpan(api_1.context.active());
                return self._callOriginalFunction(() => original.apply(this, arguments));
            };
        };
    }
    _startSpan(collection, modelName, operation, attributes, parentSpan) {
        return this.tracer.startSpan(`mongoose.${modelName}.${operation}`, {
            kind: api_1.SpanKind.CLIENT,
            attributes: Object.assign(Object.assign(Object.assign({}, attributes), (0, utils_1.getAttributesFromCollection)(collection)), { [semantic_conventions_1.SEMATTRS_DB_OPERATION]: operation, [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: 'mongoose' }),
        }, parentSpan ? api_1.trace.setSpan(api_1.context.active(), parentSpan) : undefined);
    }
    _handleResponse(span, exec, originalThis, args, callback, moduleVersion = undefined) {
        const self = this;
        if (callback instanceof Function) {
            return self._callOriginalFunction(() => (0, utils_1.handleCallbackResponse)(callback, exec, originalThis, span, args, self.getConfig().responseHook, moduleVersion));
        }
        else {
            const response = self._callOriginalFunction(() => exec.apply(originalThis, args));
            return (0, utils_1.handlePromiseResponse)(response, span, self.getConfig().responseHook, moduleVersion);
        }
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
exports.MongooseInstrumentation = MongooseInstrumentation;
//# sourceMappingURL=mongoose.js.map