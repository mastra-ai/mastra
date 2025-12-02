"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmqplibInstrumentation = void 0;
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
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const types_1 = require("./types");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
const supportedVersions = ['>=0.5.5 <1'];
class AmqplibInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, types_1.DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, types_1.DEFAULT_CONFIG), config));
    }
    init() {
        const channelModelModuleFile = new instrumentation_1.InstrumentationNodeModuleFile('amqplib/lib/channel_model.js', supportedVersions, this.patchChannelModel.bind(this), this.unpatchChannelModel.bind(this));
        const callbackModelModuleFile = new instrumentation_1.InstrumentationNodeModuleFile('amqplib/lib/callback_model.js', supportedVersions, this.patchChannelModel.bind(this), this.unpatchChannelModel.bind(this));
        const connectModuleFile = new instrumentation_1.InstrumentationNodeModuleFile('amqplib/lib/connect.js', supportedVersions, this.patchConnect.bind(this), this.unpatchConnect.bind(this));
        const module = new instrumentation_1.InstrumentationNodeModuleDefinition('amqplib', supportedVersions, undefined, undefined, [channelModelModuleFile, connectModuleFile, callbackModelModuleFile]);
        return module;
    }
    patchConnect(moduleExports) {
        moduleExports = this.unpatchConnect(moduleExports);
        if (!(0, instrumentation_1.isWrapped)(moduleExports.connect)) {
            this._wrap(moduleExports, 'connect', this.getConnectPatch.bind(this));
        }
        return moduleExports;
    }
    unpatchConnect(moduleExports) {
        if ((0, instrumentation_1.isWrapped)(moduleExports.connect)) {
            this._unwrap(moduleExports, 'connect');
        }
        return moduleExports;
    }
    patchChannelModel(moduleExports, moduleVersion) {
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.publish)) {
            this._wrap(moduleExports.Channel.prototype, 'publish', this.getPublishPatch.bind(this, moduleVersion));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.consume)) {
            this._wrap(moduleExports.Channel.prototype, 'consume', this.getConsumePatch.bind(this, moduleVersion));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.ack)) {
            this._wrap(moduleExports.Channel.prototype, 'ack', this.getAckPatch.bind(this, false, types_1.EndOperation.Ack));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.nack)) {
            this._wrap(moduleExports.Channel.prototype, 'nack', this.getAckPatch.bind(this, true, types_1.EndOperation.Nack));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.reject)) {
            this._wrap(moduleExports.Channel.prototype, 'reject', this.getAckPatch.bind(this, true, types_1.EndOperation.Reject));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.ackAll)) {
            this._wrap(moduleExports.Channel.prototype, 'ackAll', this.getAckAllPatch.bind(this, false, types_1.EndOperation.AckAll));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.nackAll)) {
            this._wrap(moduleExports.Channel.prototype, 'nackAll', this.getAckAllPatch.bind(this, true, types_1.EndOperation.NackAll));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.emit)) {
            this._wrap(moduleExports.Channel.prototype, 'emit', this.getChannelEmitPatch.bind(this));
        }
        if (!(0, instrumentation_1.isWrapped)(moduleExports.ConfirmChannel.prototype.publish)) {
            this._wrap(moduleExports.ConfirmChannel.prototype, 'publish', this.getConfirmedPublishPatch.bind(this, moduleVersion));
        }
        return moduleExports;
    }
    unpatchChannelModel(moduleExports) {
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.publish)) {
            this._unwrap(moduleExports.Channel.prototype, 'publish');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.consume)) {
            this._unwrap(moduleExports.Channel.prototype, 'consume');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.ack)) {
            this._unwrap(moduleExports.Channel.prototype, 'ack');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.nack)) {
            this._unwrap(moduleExports.Channel.prototype, 'nack');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.reject)) {
            this._unwrap(moduleExports.Channel.prototype, 'reject');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.ackAll)) {
            this._unwrap(moduleExports.Channel.prototype, 'ackAll');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.nackAll)) {
            this._unwrap(moduleExports.Channel.prototype, 'nackAll');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.Channel.prototype.emit)) {
            this._unwrap(moduleExports.Channel.prototype, 'emit');
        }
        if ((0, instrumentation_1.isWrapped)(moduleExports.ConfirmChannel.prototype.publish)) {
            this._unwrap(moduleExports.ConfirmChannel.prototype, 'publish');
        }
        return moduleExports;
    }
    getConnectPatch(original) {
        return function patchedConnect(url, socketOptions, openCallback) {
            return original.call(this, url, socketOptions, function (err, conn) {
                if (err == null) {
                    const urlAttributes = (0, utils_1.getConnectionAttributesFromUrl)(url);
                    // the type of conn in @types/amqplib is amqp.Connection, but in practice the library send the
                    // `serverProperties` on the `conn` and not in a property `connection`.
                    // I don't have capacity to debug it currently but it should probably be fixed in @types or
                    // in the package itself
                    // currently setting as any to calm typescript
                    const serverAttributes = (0, utils_1.getConnectionAttributesFromServer)(conn);
                    conn[utils_1.CONNECTION_ATTRIBUTES] = Object.assign(Object.assign({}, urlAttributes), serverAttributes);
                }
                openCallback.apply(this, arguments);
            });
        };
    }
    getChannelEmitPatch(original) {
        const self = this;
        return function emit(eventName) {
            if (eventName === 'close') {
                self.endAllSpansOnChannel(this, true, types_1.EndOperation.ChannelClosed, undefined);
                const activeTimer = this[utils_1.CHANNEL_CONSUME_TIMEOUT_TIMER];
                if (activeTimer) {
                    clearInterval(activeTimer);
                }
                this[utils_1.CHANNEL_CONSUME_TIMEOUT_TIMER] = undefined;
            }
            else if (eventName === 'error') {
                self.endAllSpansOnChannel(this, true, types_1.EndOperation.ChannelError, undefined);
            }
            return original.apply(this, arguments);
        };
    }
    getAckAllPatch(isRejected, endOperation, original) {
        const self = this;
        return function ackAll(requeueOrEmpty) {
            self.endAllSpansOnChannel(this, isRejected, endOperation, requeueOrEmpty);
            return original.apply(this, arguments);
        };
    }
    getAckPatch(isRejected, endOperation, original) {
        const self = this;
        return function ack(message, allUpToOrRequeue, requeue) {
            var _a;
            const channel = this;
            // we use this patch in reject function as well, but it has different signature
            const requeueResolved = endOperation === types_1.EndOperation.Reject ? allUpToOrRequeue : requeue;
            const spansNotEnded = (_a = channel[utils_1.CHANNEL_SPANS_NOT_ENDED]) !== null && _a !== void 0 ? _a : [];
            const msgIndex = spansNotEnded.findIndex(msgDetails => msgDetails.msg === message);
            if (msgIndex < 0) {
                // should not happen in happy flow
                // but possible if user is calling the api function ack twice with same message
                self.endConsumerSpan(message, isRejected, endOperation, requeueResolved);
            }
            else if (endOperation !== types_1.EndOperation.Reject && allUpToOrRequeue) {
                for (let i = 0; i <= msgIndex; i++) {
                    self.endConsumerSpan(spansNotEnded[i].msg, isRejected, endOperation, requeueResolved);
                }
                spansNotEnded.splice(0, msgIndex + 1);
            }
            else {
                self.endConsumerSpan(message, isRejected, endOperation, requeueResolved);
                spansNotEnded.splice(msgIndex, 1);
            }
            return original.apply(this, arguments);
        };
    }
    getConsumePatch(moduleVersion, original) {
        const self = this;
        return function consume(queue, onMessage, options) {
            const channel = this;
            if (!Object.prototype.hasOwnProperty.call(channel, utils_1.CHANNEL_SPANS_NOT_ENDED)) {
                const { consumeTimeoutMs } = self.getConfig();
                if (consumeTimeoutMs) {
                    const timer = setInterval(() => {
                        self.checkConsumeTimeoutOnChannel(channel);
                    }, consumeTimeoutMs);
                    timer.unref();
                    channel[utils_1.CHANNEL_CONSUME_TIMEOUT_TIMER] = timer;
                }
                channel[utils_1.CHANNEL_SPANS_NOT_ENDED] = [];
            }
            const patchedOnMessage = function (msg) {
                var _a, _b, _c, _d, _e;
                // msg is expected to be null for signaling consumer cancel notification
                // https://www.rabbitmq.com/consumer-cancel.html
                // in this case, we do not start a span, as this is not a real message.
                if (!msg) {
                    return onMessage.call(this, msg);
                }
                const headers = (_a = msg.properties.headers) !== null && _a !== void 0 ? _a : {};
                let parentContext = api_1.propagation.extract(api_1.ROOT_CONTEXT, headers);
                const exchange = (_b = msg.fields) === null || _b === void 0 ? void 0 : _b.exchange;
                let links;
                if (self._config.useLinksForConsume) {
                    const parentSpanContext = parentContext
                        ? (_c = api_1.trace.getSpan(parentContext)) === null || _c === void 0 ? void 0 : _c.spanContext()
                        : undefined;
                    parentContext = undefined;
                    if (parentSpanContext) {
                        links = [
                            {
                                context: parentSpanContext,
                            },
                        ];
                    }
                }
                const span = self.tracer.startSpan(`${queue} process`, {
                    kind: api_1.SpanKind.CONSUMER,
                    attributes: Object.assign(Object.assign({}, (_d = channel === null || channel === void 0 ? void 0 : channel.connection) === null || _d === void 0 ? void 0 : _d[utils_1.CONNECTION_ATTRIBUTES]), { [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: exchange, [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND]: semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_TOPIC, [semantic_conventions_1.SEMATTRS_MESSAGING_RABBITMQ_ROUTING_KEY]: (_e = msg.fields) === null || _e === void 0 ? void 0 : _e.routingKey, [semantic_conventions_1.SEMATTRS_MESSAGING_OPERATION]: semantic_conventions_1.MESSAGINGOPERATIONVALUES_PROCESS, [semantic_conventions_1.SEMATTRS_MESSAGING_MESSAGE_ID]: msg === null || msg === void 0 ? void 0 : msg.properties.messageId, [semantic_conventions_1.SEMATTRS_MESSAGING_CONVERSATION_ID]: msg === null || msg === void 0 ? void 0 : msg.properties.correlationId }),
                    links,
                }, parentContext);
                const { consumeHook } = self.getConfig();
                if (consumeHook) {
                    (0, instrumentation_1.safeExecuteInTheMiddle)(() => consumeHook(span, { moduleVersion, msg }), e => {
                        if (e) {
                            api_1.diag.error('amqplib instrumentation: consumerHook error', e);
                        }
                    }, true);
                }
                if (!(options === null || options === void 0 ? void 0 : options.noAck)) {
                    // store the message on the channel so we can close the span on ackAll etc
                    channel[utils_1.CHANNEL_SPANS_NOT_ENDED].push({
                        msg,
                        timeOfConsume: (0, core_1.hrTime)(),
                    });
                    // store the span on the message, so we can end it when user call 'ack' on it
                    msg[utils_1.MESSAGE_STORED_SPAN] = span;
                }
                const setContext = parentContext
                    ? parentContext
                    : api_1.ROOT_CONTEXT;
                api_1.context.with(api_1.trace.setSpan(setContext, span), () => {
                    onMessage.call(this, msg);
                });
                if (options === null || options === void 0 ? void 0 : options.noAck) {
                    self.callConsumeEndHook(span, msg, false, types_1.EndOperation.AutoAck);
                    span.end();
                }
            };
            arguments[1] = patchedOnMessage;
            return original.apply(this, arguments);
        };
    }
    getConfirmedPublishPatch(moduleVersion, original) {
        const self = this;
        return function confirmedPublish(exchange, routingKey, content, options, callback) {
            const channel = this;
            const { span, modifiedOptions } = self.createPublishSpan(self, exchange, routingKey, channel, options);
            const { publishHook } = self.getConfig();
            if (publishHook) {
                (0, instrumentation_1.safeExecuteInTheMiddle)(() => publishHook(span, {
                    moduleVersion,
                    exchange,
                    routingKey,
                    content,
                    options: modifiedOptions,
                    isConfirmChannel: true,
                }), e => {
                    if (e) {
                        api_1.diag.error('amqplib instrumentation: publishHook error', e);
                    }
                }, true);
            }
            const patchedOnConfirm = function (err, ok) {
                try {
                    callback === null || callback === void 0 ? void 0 : callback.call(this, err, ok);
                }
                finally {
                    const { publishConfirmHook } = self.getConfig();
                    if (publishConfirmHook) {
                        (0, instrumentation_1.safeExecuteInTheMiddle)(() => publishConfirmHook(span, {
                            moduleVersion,
                            exchange,
                            routingKey,
                            content,
                            options,
                            isConfirmChannel: true,
                            confirmError: err,
                        }), e => {
                            if (e) {
                                api_1.diag.error('amqplib instrumentation: publishConfirmHook error', e);
                            }
                        }, true);
                    }
                    if (err) {
                        span.setStatus({
                            code: api_1.SpanStatusCode.ERROR,
                            message: "message confirmation has been nack'ed",
                        });
                    }
                    span.end();
                }
            };
            // calling confirm channel publish function is storing the message in queue and registering the callback for broker confirm.
            // span ends in the patched callback.
            const markedContext = (0, utils_1.markConfirmChannelTracing)(api_1.context.active());
            const argumentsCopy = [...arguments];
            argumentsCopy[3] = modifiedOptions;
            argumentsCopy[4] = api_1.context.bind((0, utils_1.unmarkConfirmChannelTracing)(api_1.trace.setSpan(markedContext, span)), patchedOnConfirm);
            return api_1.context.with(markedContext, original.bind(this, ...argumentsCopy));
        };
    }
    getPublishPatch(moduleVersion, original) {
        const self = this;
        return function publish(exchange, routingKey, content, options) {
            if ((0, utils_1.isConfirmChannelTracing)(api_1.context.active())) {
                // work already done
                return original.apply(this, arguments);
            }
            else {
                const channel = this;
                const { span, modifiedOptions } = self.createPublishSpan(self, exchange, routingKey, channel, options);
                const { publishHook } = self.getConfig();
                if (publishHook) {
                    (0, instrumentation_1.safeExecuteInTheMiddle)(() => publishHook(span, {
                        moduleVersion,
                        exchange,
                        routingKey,
                        content,
                        options: modifiedOptions,
                        isConfirmChannel: false,
                    }), e => {
                        if (e) {
                            api_1.diag.error('amqplib instrumentation: publishHook error', e);
                        }
                    }, true);
                }
                // calling normal channel publish function is only storing the message in queue.
                // it does not send it and waits for an ack, so the span duration is expected to be very short.
                const argumentsCopy = [...arguments];
                argumentsCopy[3] = modifiedOptions;
                const originalRes = original.apply(this, argumentsCopy);
                span.end();
                return originalRes;
            }
        };
    }
    createPublishSpan(self, exchange, routingKey, channel, options) {
        var _a;
        const normalizedExchange = (0, utils_1.normalizeExchange)(exchange);
        const span = self.tracer.startSpan(`publish ${normalizedExchange}`, {
            kind: api_1.SpanKind.PRODUCER,
            attributes: Object.assign(Object.assign({}, channel.connection[utils_1.CONNECTION_ATTRIBUTES]), { [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: exchange, [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND]: semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_TOPIC, [semantic_conventions_1.SEMATTRS_MESSAGING_RABBITMQ_ROUTING_KEY]: routingKey, [semantic_conventions_1.SEMATTRS_MESSAGING_MESSAGE_ID]: options === null || options === void 0 ? void 0 : options.messageId, [semantic_conventions_1.SEMATTRS_MESSAGING_CONVERSATION_ID]: options === null || options === void 0 ? void 0 : options.correlationId }),
        });
        const modifiedOptions = options !== null && options !== void 0 ? options : {};
        modifiedOptions.headers = (_a = modifiedOptions.headers) !== null && _a !== void 0 ? _a : {};
        api_1.propagation.inject(api_1.trace.setSpan(api_1.context.active(), span), modifiedOptions.headers);
        return { span, modifiedOptions };
    }
    endConsumerSpan(message, isRejected, operation, requeue) {
        const storedSpan = message[utils_1.MESSAGE_STORED_SPAN];
        if (!storedSpan)
            return;
        if (isRejected !== false) {
            storedSpan.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: operation !== types_1.EndOperation.ChannelClosed &&
                    operation !== types_1.EndOperation.ChannelError
                    ? `${operation} called on message${requeue === true
                        ? ' with requeue'
                        : requeue === false
                            ? ' without requeue'
                            : ''}`
                    : operation,
            });
        }
        this.callConsumeEndHook(storedSpan, message, isRejected, operation);
        storedSpan.end();
        message[utils_1.MESSAGE_STORED_SPAN] = undefined;
    }
    endAllSpansOnChannel(channel, isRejected, operation, requeue) {
        var _a;
        const spansNotEnded = (_a = channel[utils_1.CHANNEL_SPANS_NOT_ENDED]) !== null && _a !== void 0 ? _a : [];
        spansNotEnded.forEach(msgDetails => {
            this.endConsumerSpan(msgDetails.msg, isRejected, operation, requeue);
        });
        channel[utils_1.CHANNEL_SPANS_NOT_ENDED] = [];
    }
    callConsumeEndHook(span, msg, rejected, endOperation) {
        const { consumeEndHook } = this.getConfig();
        if (!consumeEndHook)
            return;
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => consumeEndHook(span, { msg, rejected, endOperation }), e => {
            if (e) {
                api_1.diag.error('amqplib instrumentation: consumerEndHook error', e);
            }
        }, true);
    }
    checkConsumeTimeoutOnChannel(channel) {
        var _a;
        const currentTime = (0, core_1.hrTime)();
        const spansNotEnded = (_a = channel[utils_1.CHANNEL_SPANS_NOT_ENDED]) !== null && _a !== void 0 ? _a : [];
        let i;
        const { consumeTimeoutMs } = this.getConfig();
        for (i = 0; i < spansNotEnded.length; i++) {
            const currMessage = spansNotEnded[i];
            const timeFromConsume = (0, core_1.hrTimeDuration)(currMessage.timeOfConsume, currentTime);
            if ((0, core_1.hrTimeToMilliseconds)(timeFromConsume) < consumeTimeoutMs) {
                break;
            }
            this.endConsumerSpan(currMessage.msg, null, types_1.EndOperation.InstrumentationTimeout, true);
        }
        spansNotEnded.splice(0, i);
    }
}
exports.AmqplibInstrumentation = AmqplibInstrumentation;
//# sourceMappingURL=amqplib.js.map