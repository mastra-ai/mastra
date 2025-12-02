"use strict";
/*!
 * Copyright 2020-2024 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubsubEvents = exports.PubsubSpans = exports.modernAttributeName = exports.pubsubSetter = exports.pubsubGetter = exports.PubsubMessageSet = exports.PubsubMessageGet = exports.PubsubMessageGetSet = exports.OpenTelemetryLevel = void 0;
exports.setGloballyEnabled = setGloballyEnabled;
exports.isEnabled = isEnabled;
exports.spanContextToContext = spanContextToContext;
exports.getSubscriptionInfo = getSubscriptionInfo;
exports.getTopicInfo = getTopicInfo;
exports.injectSpan = injectSpan;
exports.containsSpanContext = containsSpanContext;
exports.extractSpan = extractSpan;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
// We need this to get the library version.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json');
/**
 * Instantiates a Opentelemetry tracer for the library
 *
 * @private
 * @internal
 */
let cachedTracer;
function getTracer() {
    const tracer = cachedTracer ??
        api_1.trace.getTracer('@google-cloud/pubsub', packageJson.version);
    cachedTracer = tracer;
    return cachedTracer;
}
/**
 * Determination of the level of OTel support we're providing.
 *
 * @private
 * @internal
 */
var OpenTelemetryLevel;
(function (OpenTelemetryLevel) {
    /**
     * None: OTel support is not enabled because we found no trace provider, or
     * the user has not enabled it.
     */
    OpenTelemetryLevel[OpenTelemetryLevel["None"] = 0] = "None";
    /**
     * Modern: We will only inject/extract the modern propagation attribute.
     */
    OpenTelemetryLevel[OpenTelemetryLevel["Modern"] = 2] = "Modern";
})(OpenTelemetryLevel || (exports.OpenTelemetryLevel = OpenTelemetryLevel = {}));
/**
 * The W3C trace context propagator, used for injecting/extracting trace context.
 *
 * @private
 * @internal
 */
const w3cTraceContextPropagator = new core_1.W3CTraceContextPropagator();
// True if user code elsewhere wants to enable OpenTelemetry support.
let globallyEnabled = false;
/**
 * Manually set the OpenTelemetry enabledness.
 *
 * @param enabled The enabled flag to use, to override any automated methods.
 * @private
 * @internal
 */
function setGloballyEnabled(enabled) {
    globallyEnabled = enabled;
}
/**
 * Tries to divine what sort of OpenTelemetry we're supporting. See the enum
 * for the meaning of the values, and other notes.
 *
 * @private
 * @internal
 */
function isEnabled() {
    return globallyEnabled ? OpenTelemetryLevel.Modern : OpenTelemetryLevel.None;
}
/**
 * Implements common members for the TextMap getter and setter interfaces for Pub/Sub messages.
 *
 * @private
 * @internal
 */
class PubsubMessageGetSet {
    static keyPrefix = 'googclient_';
    keys(carrier) {
        return Object.getOwnPropertyNames(carrier.attributes)
            .filter(n => n.startsWith(PubsubMessageGetSet.keyPrefix))
            .map(n => n.substring(PubsubMessageGetSet.keyPrefix.length));
    }
    attributeName(key) {
        return `${PubsubMessageGetSet.keyPrefix}${key}`;
    }
}
exports.PubsubMessageGetSet = PubsubMessageGetSet;
/**
 * Implements the TextMap getter interface for Pub/Sub messages.
 *
 * @private
 * @internal
 */
class PubsubMessageGet extends PubsubMessageGetSet {
    get(carrier, key) {
        return carrier?.attributes?.[this.attributeName(key)];
    }
}
exports.PubsubMessageGet = PubsubMessageGet;
/**
 * Implements the TextMap setter interface for Pub/Sub messages.
 *
 * @private
 * @internal
 */
class PubsubMessageSet extends PubsubMessageGetSet {
    set(carrier, key, value) {
        if (!carrier.attributes) {
            carrier.attributes = {};
        }
        carrier.attributes[this.attributeName(key)] = value;
    }
}
exports.PubsubMessageSet = PubsubMessageSet;
/**
 * The getter to use when calling extract() on a Pub/Sub message.
 *
 * @private
 * @internal
 */
exports.pubsubGetter = new PubsubMessageGet();
/**
 * The setter to use when calling inject() on a Pub/Sub message.
 *
 * @private
 * @internal
 */
exports.pubsubSetter = new PubsubMessageSet();
/**
 * Converts a SpanContext to a full Context, as needed.
 *
 * @private
 * @internal
 */
function spanContextToContext(parent) {
    return parent ? api_1.trace.setSpanContext(api_1.context.active(), parent) : undefined;
}
/**
 * The modern propagation attribute name.
 *
 * Technically this is determined by the OpenTelemetry library, but
 * in practice, it follows the W3C spec, so this should be the right
 * one. The only thing we're using it for, anyway, is emptying user
 * supplied attributes.
 *
 * @private
 * @internal
 */
exports.modernAttributeName = 'googclient_traceparent';
/**
 * Break down the subscription's full name into its project and ID.
 *
 * @private
 * @internal
 */
function getSubscriptionInfo(fullName) {
    const results = fullName.match(/projects\/([^/]+)\/subscriptions\/(.+)/);
    if (!results?.[0]) {
        return {
            subName: fullName,
        };
    }
    return {
        subName: fullName,
        projectId: results[1],
        subId: results[2],
    };
}
/**
 * Break down the subscription's full name into its project and ID.
 *
 * @private
 * @internal
 */
function getTopicInfo(fullName) {
    const results = fullName.match(/projects\/([^/]+)\/topics\/(.+)/);
    if (!results?.[0]) {
        return {
            topicName: fullName,
        };
    }
    return {
        topicName: fullName,
        projectId: results[1],
        topicId: results[2],
    };
}
// Determines if a trace is to be sampled. There doesn't appear to be a sanctioned
// way to do this currently (isRecording does something different).
//
// Based on this: https://github.com/open-telemetry/opentelemetry-js/issues/4193
function isSampled(span) {
    const FLAG_MASK_SAMPLED = 0x1;
    const spanContext = span.spanContext();
    const traceFlags = spanContext?.traceFlags;
    const sampled = !!(traceFlags && (traceFlags & FLAG_MASK_SAMPLED) === FLAG_MASK_SAMPLED);
    return sampled;
}
/**
 * Contains utility methods for creating spans.
 *
 * @private
 * @internal
 */
class PubsubSpans {
    static createAttributes(params, message, caller, operation) {
        const destinationName = params.topicName ?? params.subName;
        const destinationId = params.topicId ?? params.subId;
        const projectId = params.projectId;
        // Purposefully leaving this debug check here as a comment - this should
        // always be true, but we don't want to fail in prod if it's not.
        /*if (
          (params.topicName && params.subName) ||
          (!destinationName && !projectId && !destinationId)
        ) {
          throw new Error(
            'One of topicName or subName must be specified, and must be fully qualified'
          );
        }*/
        const spanAttributes = {
            // Add Opentelemetry semantic convention attributes to the span, based on:
            // https://github.com/open-telemetry/semantic-conventions/blob/v1.24.0/docs/messaging/messaging-spans.md
            ['messaging.system']: 'gcp_pubsub',
            ['messaging.destination.name']: destinationId ?? destinationName,
            ['gcp.project_id']: projectId,
            ['code.function']: caller ?? 'unknown',
        };
        if (message) {
            if (message.calculatedSize) {
                spanAttributes['messaging.message.envelope.size'] =
                    message.calculatedSize;
            }
            else {
                if (message.data?.length) {
                    spanAttributes['messaging.message.envelope.size'] =
                        message.data?.length;
                }
            }
            if (message.orderingKey) {
                spanAttributes['messaging.gcp_pubsub.message.ordering_key'] =
                    message.orderingKey;
            }
            if (message.isExactlyOnceDelivery) {
                spanAttributes['messaging.gcp_pubsub.message.exactly_once_delivery'] =
                    message.isExactlyOnceDelivery;
            }
            if (message.ackId) {
                spanAttributes['messaging.gcp_pubsub.message.ack_id'] = message.ackId;
            }
            if (operation) {
                spanAttributes['messaging.operation'] = operation;
            }
        }
        return spanAttributes;
    }
    static createPublisherSpan(message, topicName, caller) {
        if (!globallyEnabled) {
            return undefined;
        }
        const topicInfo = getTopicInfo(topicName);
        const span = getTracer().startSpan(`${topicName} create`, {
            kind: api_1.SpanKind.PRODUCER,
            attributes: PubsubSpans.createAttributes(topicInfo, message, caller, 'create'),
        });
        if (topicInfo.topicId) {
            span.updateName(`${topicInfo.topicId} create`);
            span.setAttribute('messaging.destination.name', topicInfo.topicId);
        }
        return span;
    }
    static updatePublisherTopicName(span, topicName) {
        const topicInfo = getTopicInfo(topicName);
        if (topicInfo.topicId) {
            span.updateName(`${topicInfo.topicId} create`);
            span.setAttribute('messaging.destination.name', topicInfo.topicId);
        }
        else {
            span.updateName(`${topicName} create`);
        }
        if (topicInfo.projectId) {
            span.setAttribute('gcp.project_id', topicInfo.projectId);
        }
    }
    static createReceiveSpan(message, subName, parent, caller) {
        if (!globallyEnabled) {
            return undefined;
        }
        const subInfo = getSubscriptionInfo(subName);
        const name = `${subInfo.subId ?? subName} subscribe`;
        const attributes = this.createAttributes(subInfo, message, caller, 'receive');
        if (subInfo.subId) {
            attributes['messaging.destination.name'] = subInfo.subId;
        }
        if (api_1.context) {
            return getTracer().startSpan(name, {
                kind: api_1.SpanKind.CONSUMER,
                attributes,
            }, parent);
        }
        else {
            return getTracer().startSpan(name, {
                kind: api_1.SpanKind.CONSUMER,
                attributes,
            });
        }
    }
    static createChildSpan(name, message, parentSpan, attributes) {
        if (!globallyEnabled) {
            return undefined;
        }
        const parent = message?.parentSpan ?? parentSpan;
        if (parent) {
            return getTracer().startSpan(name, {
                kind: api_1.SpanKind.INTERNAL,
                attributes: attributes ?? {},
            }, spanContextToContext(parent.spanContext()));
        }
        else {
            return undefined;
        }
    }
    static createPublishFlowSpan(message) {
        return PubsubSpans.createChildSpan('publisher flow control', message);
    }
    static createPublishSchedulerSpan(message) {
        return PubsubSpans.createChildSpan('publisher batching', message);
    }
    static createPublishRpcSpan(messages, topicName, caller) {
        if (!globallyEnabled) {
            return undefined;
        }
        const spanAttributes = PubsubSpans.createAttributes(getTopicInfo(topicName), undefined, caller, 'create');
        const links = messages
            .filter(m => m.parentSpan && isSampled(m.parentSpan))
            .map(m => ({ context: m.parentSpan.spanContext() }))
            .filter(l => l.context);
        const span = getTracer().startSpan(`${topicName} send`, {
            kind: api_1.SpanKind.PRODUCER,
            attributes: spanAttributes,
            links,
        }, api_1.ROOT_CONTEXT);
        span?.setAttribute('messaging.batch.message_count', messages.length);
        if (span) {
            // Also attempt to link from message spans back to the publish RPC span.
            messages.forEach(m => {
                if (m.parentSpan && isSampled(m.parentSpan)) {
                    m.parentSpan.addLink({ context: span.spanContext() });
                }
            });
        }
        return span;
    }
    static createAckRpcSpan(messageSpans, subName, caller) {
        if (!globallyEnabled) {
            return undefined;
        }
        const subInfo = getSubscriptionInfo(subName);
        const spanAttributes = PubsubSpans.createAttributes(subInfo, undefined, caller, 'receive');
        const links = messageSpans
            .filter(m => m && isSampled(m))
            .map(m => ({ context: m.spanContext() }))
            .filter(l => l.context);
        const span = getTracer().startSpan(`${subInfo.subId ?? subInfo.subName} ack`, {
            kind: api_1.SpanKind.CONSUMER,
            attributes: spanAttributes,
            links,
        }, api_1.ROOT_CONTEXT);
        span?.setAttribute('messaging.batch.message_count', messageSpans.length);
        if (span) {
            // Also attempt to link from the subscribe span(s) back to the publish RPC span.
            messageSpans.forEach(m => {
                if (m && isSampled(m)) {
                    m.addLink({ context: span.spanContext() });
                }
            });
        }
        return span;
    }
    static createModackRpcSpan(messageSpans, subName, type, caller, deadline, isInitial) {
        if (!globallyEnabled) {
            return undefined;
        }
        const subInfo = getSubscriptionInfo(subName);
        const spanAttributes = PubsubSpans.createAttributes(subInfo, undefined, caller, 'receive');
        const links = messageSpans
            .filter(m => m && isSampled(m))
            .map(m => ({ context: m.spanContext() }))
            .filter(l => l.context);
        const span = getTracer().startSpan(`${subInfo.subId ?? subInfo.subName} ${type}`, {
            kind: api_1.SpanKind.CONSUMER,
            attributes: spanAttributes,
            links,
        }, api_1.ROOT_CONTEXT);
        span?.setAttribute('messaging.batch.message_count', messageSpans.length);
        if (span) {
            // Also attempt to link from the subscribe span(s) back to the publish RPC span.
            messageSpans.forEach(m => {
                if (m && isSampled(m)) {
                    m.addLink({ context: span.spanContext() });
                }
            });
        }
        if (deadline) {
            span?.setAttribute('messaging.gcp_pubsub.message.ack_deadline_seconds', deadline.totalOf('second'));
        }
        if (isInitial !== undefined) {
            span?.setAttribute('messaging.gcp_pubsub.is_receipt_modack', isInitial);
        }
        return span;
    }
    static createReceiveFlowSpan(message) {
        return PubsubSpans.createChildSpan('subscriber concurrency control', message);
    }
    static createReceiveSchedulerSpan(message) {
        return PubsubSpans.createChildSpan('subscriber scheduler', message);
    }
    static createReceiveProcessSpan(message, subName) {
        const subInfo = getSubscriptionInfo(subName);
        return PubsubSpans.createChildSpan(`${subInfo.subId ?? subName} process`, message);
    }
    static setReceiveProcessResult(span, isAck) {
        span?.setAttribute('messaging.gcp_pubsub.result', isAck ? 'ack' : 'nack');
    }
}
exports.PubsubSpans = PubsubSpans;
/**
 * Creates and manipulates Pub/Sub-related events on spans.
 *
 * @private
 * @internal
 */
class PubsubEvents {
    static addEvent(text, message, attributes) {
        const parent = message.parentSpan;
        if (!parent) {
            return;
        }
        parent.addEvent(text, attributes);
    }
    static publishStart(message) {
        PubsubEvents.addEvent('publish start', message);
    }
    static publishEnd(message) {
        PubsubEvents.addEvent('publish end', message);
    }
    static ackStart(message) {
        PubsubEvents.addEvent('ack start', message);
    }
    static ackEnd(message) {
        PubsubEvents.addEvent('ack end', message);
    }
    static modackStart(message) {
        PubsubEvents.addEvent('modack start', message);
    }
    static modackEnd(message) {
        PubsubEvents.addEvent('modack end', message);
    }
    static nackStart(message) {
        PubsubEvents.addEvent('nack start', message);
    }
    static nackEnd(message) {
        PubsubEvents.addEvent('nack end', message);
    }
    static ackCalled(span) {
        span.addEvent('ack called');
    }
    static nackCalled(span) {
        span.addEvent('nack called');
    }
    static modAckCalled(span, deadline) {
        // User-called modAcks are never initial ones.
        span.addEvent('modack called', {
            'messaging.gcp_pubsub.modack_deadline_seconds': `${deadline.totalOf('second')}`,
            'messaging.gcp_pubsub.is_receipt_modack': 'false',
        });
    }
    static modAckStart(message, deadline, isInitial) {
        PubsubEvents.addEvent('modack start', message, {
            'messaging.gcp_pubsub.modack_deadline_seconds': `${deadline.totalOf('second')}`,
            'messaging.gcp_pubsub.is_receipt_modack': isInitial ? 'true' : 'false',
        });
    }
    static modAckEnd(message) {
        PubsubEvents.addEvent('modack end', message);
    }
    // Add this event any time the process is shut down before processing
    // of the message can complete.
    static shutdown(message) {
        PubsubEvents.addEvent('shutdown', message);
    }
}
exports.PubsubEvents = PubsubEvents;
/**
 * Injects the trace context into a Pub/Sub message (or other object with
 * an 'attributes' object) for propagation.
 *
 * This is for the publish side.
 *
 * @private
 * @internal
 */
function injectSpan(span, message) {
    if (!globallyEnabled) {
        return;
    }
    if (!message.attributes) {
        message.attributes = {};
    }
    if (message.attributes[exports.modernAttributeName]) {
        console.warn(`${exports.modernAttributeName} key set as message attribute, but will be overridden.`);
        delete message.attributes[exports.modernAttributeName];
    }
    // Always do propagation injection with the trace context.
    const context = api_1.trace.setSpanContext(api_1.ROOT_CONTEXT, span.spanContext());
    w3cTraceContextPropagator.inject(context, message, exports.pubsubSetter);
    // Also put the direct reference to the Span object for while we're
    // passing it around in the client library.
    message.parentSpan = span;
}
/**
 * Returns true if this message potentially contains a span context.
 *
 * @private
 * @internal
 */
function containsSpanContext(message) {
    if (message.parentSpan) {
        return true;
    }
    if (!message.attributes) {
        return false;
    }
    const keys = Object.getOwnPropertyNames(message.attributes);
    return !!keys.find(n => n === exports.modernAttributeName);
}
/**
 * Extracts the trace context from a Pub/Sub message (or other object with
 * an 'attributes' object) from a propagation, for receive processing. If no
 * context was present, create a new parent span.
 *
 * This is for the receive side.
 *
 * @private
 * @internal
 */
function extractSpan(message, subName) {
    if (!globallyEnabled) {
        return undefined;
    }
    if (message.parentSpan) {
        return message.parentSpan;
    }
    const keys = Object.getOwnPropertyNames(message.attributes ?? {});
    let context;
    if (keys.includes(exports.modernAttributeName)) {
        context = w3cTraceContextPropagator.extract(api_1.ROOT_CONTEXT, message, exports.pubsubGetter);
    }
    const span = PubsubSpans.createReceiveSpan(message, subName, context, 'extractSpan');
    message.parentSpan = span;
    return span;
}
//# sourceMappingURL=telemetry-tracing.js.map