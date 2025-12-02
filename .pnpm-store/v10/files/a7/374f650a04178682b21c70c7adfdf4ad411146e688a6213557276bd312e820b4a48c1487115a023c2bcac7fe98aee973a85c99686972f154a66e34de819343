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
exports.CucumberInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const types_1 = require("./types");
/** @knipignore */
const version_1 = require("./version");
const hooks = ['Before', 'BeforeStep', 'AfterStep', 'After'];
const steps = ['Given', 'When', 'Then'];
const supportedVersions = ['>=8.0.0 <12'];
class CucumberInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('@cucumber/cucumber', supportedVersions, (moduleExports) => {
                this.module = moduleExports;
                steps.forEach(step => {
                    if ((0, instrumentation_1.isWrapped)(moduleExports[step])) {
                        this._unwrap(moduleExports, step);
                    }
                    this._wrap(moduleExports, step, this._getStepPatch(step));
                });
                hooks.forEach(hook => {
                    if ((0, instrumentation_1.isWrapped)(moduleExports[hook])) {
                        this._unwrap(moduleExports, hook);
                    }
                    this._wrap(moduleExports, hook, this._getHookPatch(hook));
                });
                return moduleExports;
            }, (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                [...hooks, ...steps].forEach(method => {
                    this._unwrap(moduleExports, method);
                });
            }, [
                new instrumentation_1.InstrumentationNodeModuleFile('@cucumber/cucumber/lib/runtime/test_case_runner.js', supportedVersions, moduleExports => {
                    if ((0, instrumentation_1.isWrapped)(moduleExports.default.prototype.run)) {
                        this._unwrap(moduleExports.default.prototype, 'run');
                        this._unwrap(moduleExports.default.prototype, 'runStep');
                        if ('runAttempt' in moduleExports.default.prototype) {
                            this._unwrap(moduleExports.default.prototype, 'runAttempt');
                        }
                    }
                    this._wrap(moduleExports.default.prototype, 'run', this._getTestCaseRunPatch());
                    this._wrap(moduleExports.default.prototype, 'runStep', this._getTestCaseRunStepPatch());
                    if ('runAttempt' in moduleExports.default.prototype) {
                        this._wrap(moduleExports.default.prototype, 'runAttempt', this._getTestCaseRunAttemptPatch());
                    }
                    return moduleExports;
                }, moduleExports => {
                    if (moduleExports === undefined)
                        return;
                    this._unwrap(moduleExports.default.prototype, 'run');
                    this._unwrap(moduleExports.default.prototype, 'runStep');
                    if ('runAttempt' in moduleExports.default.prototype) {
                        this._unwrap(moduleExports.default.prototype, 'runAttempt');
                    }
                }),
            ]),
        ];
    }
    static mapTags(tags) {
        return tags.map(tag => tag.name);
    }
    static setSpanToError(span, error) {
        var _a;
        span.recordException(error);
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : error,
        });
    }
    setSpanToStepStatus(span, status, context) {
        // if the telemetry is enabled, the module should be defined
        if (!this.module)
            return;
        span.setAttribute(types_1.AttributeNames.STEP_STATUS, status);
        if ([
            this.module.Status.UNDEFINED,
            this.module.Status.AMBIGUOUS,
            this.module.Status.FAILED,
        ].includes(status)) {
            span.recordException(status);
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: context || status,
            });
        }
    }
    _getTestCaseRunPatch() {
        const instrumentation = this;
        return function (original) {
            return async function (...args) {
                var _a;
                const gherkinDocument = this['gherkinDocument'];
                const { feature } = gherkinDocument;
                const pickle = this['pickle'];
                const scenario = (_a = feature.children.find(node => { var _a; return ((_a = node === null || node === void 0 ? void 0 : node.scenario) === null || _a === void 0 ? void 0 : _a.id) === pickle.astNodeIds[0]; })) === null || _a === void 0 ? void 0 : _a.scenario;
                return instrumentation.tracer.startActiveSpan(`Feature: ${feature.name}. Scenario: ${pickle.name}`, {
                    kind: api_1.SpanKind.CLIENT,
                    attributes: {
                        [semantic_conventions_1.SEMATTRS_CODE_FILEPATH]: gherkinDocument.uri,
                        [semantic_conventions_1.SEMATTRS_CODE_LINENO]: scenario.location.line,
                        [semantic_conventions_1.SEMATTRS_CODE_FUNCTION]: scenario.name,
                        [semantic_conventions_1.SEMATTRS_CODE_NAMESPACE]: feature.name,
                        [types_1.AttributeNames.FEATURE_TAGS]: CucumberInstrumentation.mapTags(feature.tags),
                        [types_1.AttributeNames.FEATURE_LANGUAGE]: feature.language,
                        [types_1.AttributeNames.FEATURE_DESCRIPTION]: feature.description,
                        [types_1.AttributeNames.SCENARIO_TAGS]: CucumberInstrumentation.mapTags(scenario.tags),
                        [types_1.AttributeNames.SCENARIO_DESCRIPTION]: scenario.description,
                    },
                }, async (span) => {
                    try {
                        const status = await original.apply(this, args);
                        instrumentation.setSpanToStepStatus(span, status);
                        return status;
                    }
                    catch (error) {
                        CucumberInstrumentation.setSpanToError(span, error);
                        throw error;
                    }
                    finally {
                        span.end();
                    }
                });
            };
        };
    }
    _getTestCaseRunStepPatch() {
        const instrumentation = this;
        return function (original) {
            return async function (...args) {
                const [pickleStep] = args;
                return instrumentation.tracer.startActiveSpan(pickleStep.text, {
                    kind: api_1.SpanKind.CLIENT,
                    attributes: {
                        [types_1.AttributeNames.STEP_TYPE]: pickleStep.type,
                    },
                }, async (span) => {
                    try {
                        const result = await original.apply(this, args);
                        instrumentation.setSpanToStepStatus(span, result.status, result.message);
                        return result;
                    }
                    catch (error) {
                        CucumberInstrumentation.setSpanToError(span, error);
                        throw error;
                    }
                    finally {
                        span.end();
                    }
                });
            };
        };
    }
    _getTestCaseRunAttemptPatch() {
        const instrumentation = this;
        return function (original) {
            return async function (...args) {
                const [attempt] = args;
                return instrumentation.tracer.startActiveSpan(`Attempt #${attempt}`, {
                    kind: api_1.SpanKind.CLIENT,
                    attributes: {},
                }, async (span) => {
                    try {
                        const result = await original.apply(this, args);
                        const worstResult = this.getWorstStepResult();
                        instrumentation.setSpanToStepStatus(span, worstResult.status, worstResult.message);
                        return result;
                    }
                    catch (error) {
                        CucumberInstrumentation.setSpanToError(span, error);
                        throw error;
                    }
                    finally {
                        span.end();
                    }
                });
            };
        };
    }
    _getHookPatch(name) {
        const instrumentation = this;
        return function (original) {
            return function (tagsOrOptions, code) {
                if (typeof tagsOrOptions === 'function') {
                    code = tagsOrOptions;
                    tagsOrOptions = {};
                }
                function traceableCode(arg) {
                    // because we're wrapping the function that was passed to the hook,
                    // it will stay wrapped in cucumber's internal state
                    // even if we disable the instrumentation
                    if (!instrumentation.isEnabled())
                        return code === null || code === void 0 ? void 0 : code.call(this, arg);
                    return instrumentation.tracer.startActiveSpan(name, {
                        kind: api_1.SpanKind.CLIENT,
                    }, async (span) => {
                        var _a;
                        try {
                            return await (code === null || code === void 0 ? void 0 : code.call(this, arg));
                        }
                        catch (error) {
                            (_a = this.attach) === null || _a === void 0 ? void 0 : _a.call(this, JSON.stringify(span.spanContext()));
                            CucumberInstrumentation.setSpanToError(span, error);
                            throw error;
                        }
                        finally {
                            span.end();
                        }
                    });
                }
                return original.call(this, tagsOrOptions, traceableCode);
            };
        };
    }
    _getStepPatch(name) {
        const instrumentation = this;
        return function (original) {
            return function (pattern, options, code) {
                if (typeof options === 'function') {
                    code = options;
                    options = {};
                }
                function traceableCode(...args) {
                    // because we're wrapping the function that was passed to the hook,
                    // it will stay wrapped in cucumber's internal state
                    // even if we disable the instrumentation
                    if (!instrumentation.isEnabled())
                        return code === null || code === void 0 ? void 0 : code.apply(this, args);
                    return instrumentation.tracer.startActiveSpan(`${name}(${pattern.toString()})`, {
                        kind: api_1.SpanKind.CLIENT,
                        // ignore the last argument because it's a callback
                        attributes: args.slice(0, -1).reduce((attrs, arg, index) => (Object.assign(Object.assign({}, attrs), { [`${types_1.AttributeNames.STEP_ARGS}[${index}]`]: (arg === null || arg === void 0 ? void 0 : arg.raw) instanceof Function
                                ? JSON.stringify(arg.raw())
                                : arg })), {}),
                    }, async (span) => {
                        var _a;
                        try {
                            return await (code === null || code === void 0 ? void 0 : code.apply(this, args));
                        }
                        catch (error) {
                            (_a = this.attach) === null || _a === void 0 ? void 0 : _a.call(this, JSON.stringify(span.spanContext()));
                            CucumberInstrumentation.setSpanToError(span, error);
                            throw error;
                        }
                        finally {
                            span.end();
                        }
                    });
                }
                // cucumber asks for the number of arguments to match the specified pattern
                // copy the value from the original function
                Object.defineProperty(traceableCode, 'length', {
                    value: code === null || code === void 0 ? void 0 : code.length,
                });
                return original.call(this, pattern, options, traceableCode);
            };
        };
    }
}
exports.CucumberInstrumentation = CucumberInstrumentation;
//# sourceMappingURL=instrumentation.js.map