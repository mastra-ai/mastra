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
exports.AwsLambdaInstrumentation = exports.lambdaMaxInitInMilliseconds = void 0;
const path = require("path");
const fs = require("fs");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const semconv_1 = require("./semconv");
/** @knipignore */
const version_1 = require("./version");
const headerGetter = {
    keys(carrier) {
        return Object.keys(carrier);
    },
    get(carrier, key) {
        return carrier[key];
    },
};
exports.lambdaMaxInitInMilliseconds = 10000;
class AwsLambdaInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        var _a;
        const taskRoot = process.env.LAMBDA_TASK_ROOT;
        const handlerDef = (_a = this.getConfig().lambdaHandler) !== null && _a !== void 0 ? _a : process.env._HANDLER;
        // _HANDLER and LAMBDA_TASK_ROOT are always defined in Lambda but guard bail out if in the future this changes.
        if (!taskRoot || !handlerDef) {
            this._diag.debug('Skipping lambda instrumentation: no _HANDLER/lambdaHandler or LAMBDA_TASK_ROOT.', { taskRoot, handlerDef });
            return [];
        }
        const handler = path.basename(handlerDef);
        const moduleRoot = handlerDef.substring(0, handlerDef.length - handler.length);
        const [module, functionName] = handler.split('.', 2);
        // Lambda loads user function using an absolute path.
        let filename = path.resolve(taskRoot, moduleRoot, module);
        if (!filename.endsWith('.js')) {
            // It's impossible to know in advance if the user has a js, mjs or cjs file.
            // Check that the .js file exists otherwise fallback to the next known possibilities (.mjs, .cjs).
            try {
                fs.statSync(`${filename}.js`);
                filename += '.js';
            }
            catch (e) {
                try {
                    fs.statSync(`${filename}.mjs`);
                    // fallback to .mjs (ESM)
                    filename += '.mjs';
                }
                catch (e2) {
                    try {
                        fs.statSync(`${filename}.cjs`);
                        // fallback to .cjs (CommonJS)
                        filename += '.cjs';
                    }
                    catch (e3) {
                        this._diag.warn('No handler file was able to resolved with one of the known extensions for the file', filename);
                    }
                }
            }
        }
        api_1.diag.debug('Instrumenting lambda handler', {
            taskRoot,
            handlerDef,
            handler,
            moduleRoot,
            module,
            filename,
            functionName,
        });
        const lambdaStartTime = this.getConfig().lambdaStartTime ||
            Date.now() - Math.floor(1000 * process.uptime());
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition(
            // NB: The patching infrastructure seems to match names backwards, this must be the filename, while
            // InstrumentationNodeModuleFile must be the module name.
            filename, ['*'], undefined, undefined, [
                new instrumentation_1.InstrumentationNodeModuleFile(module, ['*'], (moduleExports) => {
                    if ((0, instrumentation_1.isWrapped)(moduleExports[functionName])) {
                        this._unwrap(moduleExports, functionName);
                    }
                    this._wrap(moduleExports, functionName, this._getHandler(lambdaStartTime));
                    return moduleExports;
                }, (moduleExports) => {
                    if (moduleExports == null)
                        return;
                    this._unwrap(moduleExports, functionName);
                }),
            ]),
        ];
    }
    _getHandler(handlerLoadStartTime) {
        return (original) => {
            return this._getPatchHandler(original, handlerLoadStartTime);
        };
    }
    _getPatchHandler(original, lambdaStartTime) {
        api_1.diag.debug('patch handler function');
        const plugin = this;
        let requestHandledBefore = false;
        let requestIsColdStart = true;
        function _onRequest() {
            if (requestHandledBefore) {
                // Non-first requests cannot be coldstart.
                requestIsColdStart = false;
            }
            else {
                if (process.env.AWS_LAMBDA_INITIALIZATION_TYPE ===
                    'provisioned-concurrency') {
                    // If sandbox environment is initialized with provisioned concurrency,
                    // even the first requests should not be considered as coldstart.
                    requestIsColdStart = false;
                }
                else {
                    // Check whether it is proactive initialization or not:
                    // https://aaronstuyvenberg.com/posts/understanding-proactive-initialization
                    const passedTimeSinceHandlerLoad = Date.now() - lambdaStartTime;
                    const proactiveInitialization = passedTimeSinceHandlerLoad > exports.lambdaMaxInitInMilliseconds;
                    // If sandbox has been initialized proactively before the actual request,
                    // even the first requests should not be considered as coldstart.
                    requestIsColdStart = !proactiveInitialization;
                }
                requestHandledBefore = true;
            }
        }
        return function patchedHandler(
        // The event can be a user type, it truly is any.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event, context, callback) {
            _onRequest();
            const config = plugin.getConfig();
            const parent = AwsLambdaInstrumentation._determineParent(event, context, config.eventContextExtractor ||
                AwsLambdaInstrumentation._defaultEventContextExtractor);
            const name = context.functionName;
            const span = plugin.tracer.startSpan(name, {
                kind: api_1.SpanKind.SERVER,
                attributes: Object.assign({ [semantic_conventions_1.SEMATTRS_FAAS_EXECUTION]: context.awsRequestId, [semantic_conventions_1.SEMRESATTRS_FAAS_ID]: context.invokedFunctionArn, [semantic_conventions_1.SEMRESATTRS_CLOUD_ACCOUNT_ID]: AwsLambdaInstrumentation._extractAccountId(context.invokedFunctionArn), [semconv_1.ATTR_FAAS_COLDSTART]: requestIsColdStart }, AwsLambdaInstrumentation._extractOtherEventFields(event)),
            }, parent);
            const { requestHook } = config;
            if (requestHook) {
                (0, instrumentation_1.safeExecuteInTheMiddle)(() => requestHook(span, { event, context }), e => {
                    if (e)
                        api_1.diag.error('aws-lambda instrumentation: requestHook error', e);
                }, true);
            }
            return api_1.context.with(api_1.trace.setSpan(parent, span), () => {
                // Lambda seems to pass a callback even if handler is of Promise form, so we wrap all the time before calling
                // the handler and see if the result is a Promise or not. In such a case, the callback is usually ignored. If
                // the handler happened to both call the callback and complete a returned Promise, whichever happens first will
                // win and the latter will be ignored.
                const wrappedCallback = plugin._wrapCallback(callback, span);
                const maybePromise = (0, instrumentation_1.safeExecuteInTheMiddle)(() => original.apply(this, [event, context, wrappedCallback]), error => {
                    if (error != null) {
                        // Exception thrown synchronously before resolving callback / promise.
                        plugin._applyResponseHook(span, error);
                        plugin._endSpan(span, error, () => { });
                    }
                });
                if (typeof (maybePromise === null || maybePromise === void 0 ? void 0 : maybePromise.then) === 'function') {
                    return maybePromise.then(value => {
                        plugin._applyResponseHook(span, null, value);
                        return new Promise(resolve => plugin._endSpan(span, undefined, () => resolve(value)));
                    }, (err) => {
                        plugin._applyResponseHook(span, err);
                        return new Promise((resolve, reject) => plugin._endSpan(span, err, () => reject(err)));
                    });
                }
                return maybePromise;
            });
        };
    }
    setTracerProvider(tracerProvider) {
        super.setTracerProvider(tracerProvider);
        this._traceForceFlusher = this._traceForceFlush(tracerProvider);
    }
    _traceForceFlush(tracerProvider) {
        if (!tracerProvider)
            return undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentProvider = tracerProvider;
        if (typeof currentProvider.getDelegate === 'function') {
            currentProvider = currentProvider.getDelegate();
        }
        if (typeof currentProvider.forceFlush === 'function') {
            return currentProvider.forceFlush.bind(currentProvider);
        }
        return undefined;
    }
    setMeterProvider(meterProvider) {
        super.setMeterProvider(meterProvider);
        this._metricForceFlusher = this._metricForceFlush(meterProvider);
    }
    _metricForceFlush(meterProvider) {
        if (!meterProvider)
            return undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentProvider = meterProvider;
        if (typeof currentProvider.forceFlush === 'function') {
            return currentProvider.forceFlush.bind(currentProvider);
        }
        return undefined;
    }
    _wrapCallback(original, span) {
        const plugin = this;
        return function wrappedCallback(err, res) {
            api_1.diag.debug('executing wrapped lookup callback function');
            plugin._applyResponseHook(span, err, res);
            plugin._endSpan(span, err, () => {
                api_1.diag.debug('executing original lookup callback function');
                return original.apply(this, [err, res]);
            });
        };
    }
    _endSpan(span, err, callback) {
        if (err) {
            span.recordException(err);
        }
        let errMessage;
        if (typeof err === 'string') {
            errMessage = err;
        }
        else if (err) {
            errMessage = err.message;
        }
        if (errMessage) {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: errMessage,
            });
        }
        span.end();
        const flushers = [];
        if (this._traceForceFlusher) {
            flushers.push(this._traceForceFlusher());
        }
        else {
            api_1.diag.error('Spans may not be exported for the lambda function because we are not force flushing before callback.');
        }
        if (this._metricForceFlusher) {
            flushers.push(this._metricForceFlusher());
        }
        else {
            api_1.diag.error('Metrics may not be exported for the lambda function because we are not force flushing before callback.');
        }
        Promise.all(flushers).then(callback, callback);
    }
    _applyResponseHook(span, err, res) {
        const { responseHook } = this.getConfig();
        if (responseHook) {
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => responseHook(span, { err, res }), e => {
                if (e)
                    api_1.diag.error('aws-lambda instrumentation: responseHook error', e);
            }, true);
        }
    }
    static _extractAccountId(arn) {
        const parts = arn.split(':');
        if (parts.length >= 5) {
            return parts[4];
        }
        return undefined;
    }
    static _defaultEventContextExtractor(event) {
        // The default extractor tries to get sampled trace header from HTTP headers.
        const httpHeaders = event.headers || {};
        return api_1.propagation.extract(api_1.context.active(), httpHeaders, headerGetter);
    }
    static _extractOtherEventFields(event) {
        const answer = {};
        const fullUrl = this._extractFullUrl(event);
        if (fullUrl) {
            answer[semantic_conventions_1.ATTR_URL_FULL] = fullUrl;
        }
        return answer;
    }
    static _extractFullUrl(event) {
        var _a;
        // API gateway encodes a lot of url information in various places to recompute this
        if (!event.headers) {
            return undefined;
        }
        // Helper function to deal with case variations (instead of making a tolower() copy of the headers)
        function findAny(event, key1, key2) {
            var _a;
            return (_a = event.headers[key1]) !== null && _a !== void 0 ? _a : event.headers[key2];
        }
        const host = findAny(event, 'host', 'Host');
        const proto = findAny(event, 'x-forwarded-proto', 'X-Forwarded-Proto');
        const port = findAny(event, 'x-forwarded-port', 'X-Forwarded-Port');
        if (!(proto && host && (event.path || event.rawPath))) {
            return undefined;
        }
        let answer = proto + '://' + host;
        if (port) {
            answer += ':' + port;
        }
        answer += (_a = event.path) !== null && _a !== void 0 ? _a : event.rawPath;
        if (event.queryStringParameters) {
            let first = true;
            for (const key in event.queryStringParameters) {
                answer += first ? '?' : '&';
                answer += encodeURIComponent(key);
                answer += '=';
                answer += encodeURIComponent(event.queryStringParameters[key]);
                first = false;
            }
        }
        return answer;
    }
    static _determineParent(event, context, eventContextExtractor) {
        var _a;
        const extractedContext = (0, instrumentation_1.safeExecuteInTheMiddle)(() => eventContextExtractor(event, context), e => {
            if (e)
                api_1.diag.error('aws-lambda instrumentation: eventContextExtractor error', e);
        }, true);
        if ((_a = api_1.trace.getSpan(extractedContext)) === null || _a === void 0 ? void 0 : _a.spanContext()) {
            return extractedContext;
        }
        return api_1.ROOT_CONTEXT;
    }
}
exports.AwsLambdaInstrumentation = AwsLambdaInstrumentation;
//# sourceMappingURL=instrumentation.js.map