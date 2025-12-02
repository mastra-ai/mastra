"use strict";
/*
 * Copyright The OpenTelemetry Authors, Aspecto
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
exports.KafkaJsInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/** @knipignore */
const version_1 = require("./version");
const propagator_1 = require("./propagator");
const instrumentation_1 = require("@opentelemetry/instrumentation");
class KafkaJsInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const unpatch = (moduleExports) => {
            var _a, _b;
            if ((0, instrumentation_1.isWrapped)((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Kafka) === null || _a === void 0 ? void 0 : _a.prototype.producer)) {
                this._unwrap(moduleExports.Kafka.prototype, 'producer');
            }
            if ((0, instrumentation_1.isWrapped)((_b = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Kafka) === null || _b === void 0 ? void 0 : _b.prototype.consumer)) {
                this._unwrap(moduleExports.Kafka.prototype, 'consumer');
            }
        };
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition('kafkajs', ['>=0.1.0 <3'], (moduleExports) => {
            var _a, _b;
            unpatch(moduleExports);
            this._wrap((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Kafka) === null || _a === void 0 ? void 0 : _a.prototype, 'producer', this._getProducerPatch());
            this._wrap((_b = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Kafka) === null || _b === void 0 ? void 0 : _b.prototype, 'consumer', this._getConsumerPatch());
            return moduleExports;
        }, unpatch);
        return module;
    }
    _getConsumerPatch() {
        const instrumentation = this;
        return (original) => {
            return function consumer(...args) {
                const newConsumer = original.apply(this, args);
                if ((0, instrumentation_1.isWrapped)(newConsumer.run)) {
                    instrumentation._unwrap(newConsumer, 'run');
                }
                instrumentation._wrap(newConsumer, 'run', instrumentation._getConsumerRunPatch());
                return newConsumer;
            };
        };
    }
    _getProducerPatch() {
        const instrumentation = this;
        return (original) => {
            return function consumer(...args) {
                const newProducer = original.apply(this, args);
                if ((0, instrumentation_1.isWrapped)(newProducer.sendBatch)) {
                    instrumentation._unwrap(newProducer, 'sendBatch');
                }
                instrumentation._wrap(newProducer, 'sendBatch', instrumentation._getProducerSendBatchPatch());
                if ((0, instrumentation_1.isWrapped)(newProducer.send)) {
                    instrumentation._unwrap(newProducer, 'send');
                }
                instrumentation._wrap(newProducer, 'send', instrumentation._getProducerSendPatch());
                return newProducer;
            };
        };
    }
    _getConsumerRunPatch() {
        const instrumentation = this;
        return (original) => {
            return function run(...args) {
                const config = args[0];
                if (config === null || config === void 0 ? void 0 : config.eachMessage) {
                    if ((0, instrumentation_1.isWrapped)(config.eachMessage)) {
                        instrumentation._unwrap(config, 'eachMessage');
                    }
                    instrumentation._wrap(config, 'eachMessage', instrumentation._getConsumerEachMessagePatch());
                }
                if (config === null || config === void 0 ? void 0 : config.eachBatch) {
                    if ((0, instrumentation_1.isWrapped)(config.eachBatch)) {
                        instrumentation._unwrap(config, 'eachBatch');
                    }
                    instrumentation._wrap(config, 'eachBatch', instrumentation._getConsumerEachBatchPatch());
                }
                return original.call(this, config);
            };
        };
    }
    _getConsumerEachMessagePatch() {
        const instrumentation = this;
        return (original) => {
            return function eachMessage(...args) {
                const payload = args[0];
                const propagatedContext = api_1.propagation.extract(api_1.ROOT_CONTEXT, payload.message.headers, propagator_1.bufferTextMapGetter);
                const span = instrumentation._startConsumerSpan(payload.topic, payload.message, semantic_conventions_1.MESSAGINGOPERATIONVALUES_PROCESS, propagatedContext);
                const eachMessagePromise = api_1.context.with(api_1.trace.setSpan(propagatedContext, span), () => {
                    return original.apply(this, args);
                });
                return instrumentation._endSpansOnPromise([span], eachMessagePromise);
            };
        };
    }
    _getConsumerEachBatchPatch() {
        return (original) => {
            const instrumentation = this;
            return function eachBatch(...args) {
                const payload = args[0];
                // https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/trace/semantic_conventions/messaging.md#topic-with-multiple-consumers
                const receivingSpan = instrumentation._startConsumerSpan(payload.batch.topic, undefined, semantic_conventions_1.MESSAGINGOPERATIONVALUES_RECEIVE, api_1.ROOT_CONTEXT);
                return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), receivingSpan), () => {
                    const spans = payload.batch.messages.map((message) => {
                        var _a;
                        const propagatedContext = api_1.propagation.extract(api_1.ROOT_CONTEXT, message.headers, propagator_1.bufferTextMapGetter);
                        const spanContext = (_a = api_1.trace
                            .getSpan(propagatedContext)) === null || _a === void 0 ? void 0 : _a.spanContext();
                        let origSpanLink;
                        if (spanContext) {
                            origSpanLink = {
                                context: spanContext,
                            };
                        }
                        return instrumentation._startConsumerSpan(payload.batch.topic, message, semantic_conventions_1.MESSAGINGOPERATIONVALUES_PROCESS, undefined, origSpanLink);
                    });
                    const batchMessagePromise = original.apply(this, args);
                    spans.unshift(receivingSpan);
                    return instrumentation._endSpansOnPromise(spans, batchMessagePromise);
                });
            };
        };
    }
    _getProducerSendBatchPatch() {
        const instrumentation = this;
        return (original) => {
            return function sendBatch(...args) {
                const batch = args[0];
                const messages = batch.topicMessages || [];
                const spans = messages
                    .map(topicMessage => topicMessage.messages.map(message => instrumentation._startProducerSpan(topicMessage.topic, message)))
                    .reduce((acc, val) => acc.concat(val), []);
                const origSendResult = original.apply(this, args);
                return instrumentation._endSpansOnPromise(spans, origSendResult);
            };
        };
    }
    _getProducerSendPatch() {
        const instrumentation = this;
        return (original) => {
            return function send(...args) {
                const record = args[0];
                const spans = record.messages.map(message => {
                    return instrumentation._startProducerSpan(record.topic, message);
                });
                const origSendResult = original.apply(this, args);
                return instrumentation._endSpansOnPromise(spans, origSendResult);
            };
        };
    }
    _endSpansOnPromise(spans, sendPromise) {
        return Promise.resolve(sendPromise)
            .catch(reason => {
            let errorMessage;
            if (typeof reason === 'string')
                errorMessage = reason;
            else if (typeof reason === 'object' &&
                Object.prototype.hasOwnProperty.call(reason, 'message'))
                errorMessage = reason.message;
            spans.forEach(span => span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: errorMessage,
            }));
            throw reason;
        })
            .finally(() => {
            spans.forEach(span => span.end());
        });
    }
    _startConsumerSpan(topic, message, operation, context, link) {
        const span = this.tracer.startSpan(topic, {
            kind: api_1.SpanKind.CONSUMER,
            attributes: {
                [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'kafka',
                [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: topic,
                [semantic_conventions_1.SEMATTRS_MESSAGING_OPERATION]: operation,
            },
            links: link ? [link] : [],
        }, context);
        const { consumerHook } = this.getConfig();
        if (consumerHook && message) {
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => consumerHook(span, { topic, message }), e => {
                if (e)
                    this._diag.error('consumerHook error', e);
            }, true);
        }
        return span;
    }
    _startProducerSpan(topic, message) {
        var _a;
        const span = this.tracer.startSpan(topic, {
            kind: api_1.SpanKind.PRODUCER,
            attributes: {
                [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'kafka',
                [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: topic,
            },
        });
        message.headers = (_a = message.headers) !== null && _a !== void 0 ? _a : {};
        api_1.propagation.inject(api_1.trace.setSpan(api_1.context.active(), span), message.headers);
        const { producerHook } = this.getConfig();
        if (producerHook) {
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => producerHook(span, { topic, message }), e => {
                if (e)
                    this._diag.error('producerHook error', e);
            }, true);
        }
        return span;
    }
}
exports.KafkaJsInstrumentation = KafkaJsInstrumentation;
//# sourceMappingURL=instrumentation.js.map