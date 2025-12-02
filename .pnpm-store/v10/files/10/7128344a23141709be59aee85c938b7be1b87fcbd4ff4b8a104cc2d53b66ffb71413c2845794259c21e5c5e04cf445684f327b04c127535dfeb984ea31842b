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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var _a;
import * as api from '@opentelemetry/api';
import { hrTimeToMicroseconds } from '@opentelemetry/core';
import * as zipkinTypes from './types';
var ZIPKIN_SPAN_KIND_MAPPING = (_a = {},
    _a[api.SpanKind.CLIENT] = zipkinTypes.SpanKind.CLIENT,
    _a[api.SpanKind.SERVER] = zipkinTypes.SpanKind.SERVER,
    _a[api.SpanKind.CONSUMER] = zipkinTypes.SpanKind.CONSUMER,
    _a[api.SpanKind.PRODUCER] = zipkinTypes.SpanKind.PRODUCER,
    // When absent, the span is local.
    _a[api.SpanKind.INTERNAL] = undefined,
    _a);
export var defaultStatusCodeTagName = 'otel.status_code';
export var defaultStatusErrorTagName = 'error';
/**
 * Translate OpenTelemetry ReadableSpan to ZipkinSpan format
 * @param span Span to be translated
 */
export function toZipkinSpan(span, serviceName, statusCodeTagName, statusErrorTagName) {
    var zipkinSpan = {
        traceId: span.spanContext().traceId,
        parentId: span.parentSpanId,
        name: span.name,
        id: span.spanContext().spanId,
        kind: ZIPKIN_SPAN_KIND_MAPPING[span.kind],
        timestamp: hrTimeToMicroseconds(span.startTime),
        duration: Math.round(hrTimeToMicroseconds(span.duration)),
        localEndpoint: { serviceName: serviceName },
        tags: _toZipkinTags(span, statusCodeTagName, statusErrorTagName),
        annotations: span.events.length
            ? _toZipkinAnnotations(span.events)
            : undefined,
    };
    return zipkinSpan;
}
/** Converts OpenTelemetry Span properties to Zipkin Tags format. */
export function _toZipkinTags(_a, statusCodeTagName, statusErrorTagName) {
    var e_1, _b;
    var attributes = _a.attributes, resource = _a.resource, status = _a.status, droppedAttributesCount = _a.droppedAttributesCount, droppedEventsCount = _a.droppedEventsCount, droppedLinksCount = _a.droppedLinksCount;
    var tags = {};
    try {
        for (var _c = __values(Object.keys(attributes)), _d = _c.next(); !_d.done; _d = _c.next()) {
            var key = _d.value;
            tags[key] = String(attributes[key]);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (status.code !== api.SpanStatusCode.UNSET) {
        tags[statusCodeTagName] = String(api.SpanStatusCode[status.code]);
    }
    if (status.code === api.SpanStatusCode.ERROR && status.message) {
        tags[statusErrorTagName] = status.message;
    }
    /* Add droppedAttributesCount as a tag */
    if (droppedAttributesCount) {
        tags['otel.dropped_attributes_count'] = String(droppedAttributesCount);
    }
    /* Add droppedEventsCount as a tag */
    if (droppedEventsCount) {
        tags['otel.dropped_events_count'] = String(droppedEventsCount);
    }
    /* Add droppedLinksCount as a tag */
    if (droppedLinksCount) {
        tags['otel.dropped_links_count'] = String(droppedLinksCount);
    }
    Object.keys(resource.attributes).forEach(function (name) { return (tags[name] = String(resource.attributes[name])); });
    return tags;
}
/**
 * Converts OpenTelemetry Events to Zipkin Annotations format.
 */
export function _toZipkinAnnotations(events) {
    return events.map(function (event) { return ({
        timestamp: Math.round(hrTimeToMicroseconds(event.time)),
        value: event.name,
    }); });
}
//# sourceMappingURL=transform.js.map