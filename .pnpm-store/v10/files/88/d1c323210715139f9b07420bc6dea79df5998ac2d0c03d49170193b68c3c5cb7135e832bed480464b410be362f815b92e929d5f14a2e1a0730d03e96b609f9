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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
import { createInstrumentationScope, createResource, toAttributes, } from '../common/internal';
import { getOtlpEncoder } from '../common/utils';
export function sdkSpanToOtlpSpan(span, encoder) {
    var _a;
    var ctx = span.spanContext();
    var status = span.status;
    return {
        traceId: encoder.encodeSpanContext(ctx.traceId),
        spanId: encoder.encodeSpanContext(ctx.spanId),
        parentSpanId: encoder.encodeOptionalSpanContext(span.parentSpanId),
        traceState: (_a = ctx.traceState) === null || _a === void 0 ? void 0 : _a.serialize(),
        name: span.name,
        // Span kind is offset by 1 because the API does not define a value for unset
        kind: span.kind == null ? 0 : span.kind + 1,
        startTimeUnixNano: encoder.encodeHrTime(span.startTime),
        endTimeUnixNano: encoder.encodeHrTime(span.endTime),
        attributes: toAttributes(span.attributes),
        droppedAttributesCount: span.droppedAttributesCount,
        events: span.events.map(function (event) { return toOtlpSpanEvent(event, encoder); }),
        droppedEventsCount: span.droppedEventsCount,
        status: {
            // API and proto enums share the same values
            code: status.code,
            message: status.message,
        },
        links: span.links.map(function (link) { return toOtlpLink(link, encoder); }),
        droppedLinksCount: span.droppedLinksCount,
    };
}
export function toOtlpLink(link, encoder) {
    var _a;
    return {
        attributes: link.attributes ? toAttributes(link.attributes) : [],
        spanId: encoder.encodeSpanContext(link.context.spanId),
        traceId: encoder.encodeSpanContext(link.context.traceId),
        traceState: (_a = link.context.traceState) === null || _a === void 0 ? void 0 : _a.serialize(),
        droppedAttributesCount: link.droppedAttributesCount || 0,
    };
}
export function toOtlpSpanEvent(timedEvent, encoder) {
    return {
        attributes: timedEvent.attributes
            ? toAttributes(timedEvent.attributes)
            : [],
        name: timedEvent.name,
        timeUnixNano: encoder.encodeHrTime(timedEvent.time),
        droppedAttributesCount: timedEvent.droppedAttributesCount || 0,
    };
}
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
export function createExportTraceServiceRequest(spans, options) {
    var encoder = getOtlpEncoder(options);
    return {
        resourceSpans: spanRecordsToResourceSpans(spans, encoder),
    };
}
function createResourceMap(readableSpans) {
    var e_1, _a;
    var resourceMap = new Map();
    try {
        for (var readableSpans_1 = __values(readableSpans), readableSpans_1_1 = readableSpans_1.next(); !readableSpans_1_1.done; readableSpans_1_1 = readableSpans_1.next()) {
            var record = readableSpans_1_1.value;
            var ilmMap = resourceMap.get(record.resource);
            if (!ilmMap) {
                ilmMap = new Map();
                resourceMap.set(record.resource, ilmMap);
            }
            // TODO this is duplicated in basic tracer. Consolidate on a common helper in core
            var instrumentationLibraryKey = record.instrumentationLibrary.name + "@" + (record.instrumentationLibrary.version || '') + ":" + (record.instrumentationLibrary.schemaUrl || '');
            var records = ilmMap.get(instrumentationLibraryKey);
            if (!records) {
                records = [];
                ilmMap.set(instrumentationLibraryKey, records);
            }
            records.push(record);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (readableSpans_1_1 && !readableSpans_1_1.done && (_a = readableSpans_1.return)) _a.call(readableSpans_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return resourceMap;
}
function spanRecordsToResourceSpans(readableSpans, encoder) {
    var resourceMap = createResourceMap(readableSpans);
    var out = [];
    var entryIterator = resourceMap.entries();
    var entry = entryIterator.next();
    while (!entry.done) {
        var _a = __read(entry.value, 2), resource = _a[0], ilmMap = _a[1];
        var scopeResourceSpans = [];
        var ilmIterator = ilmMap.values();
        var ilmEntry = ilmIterator.next();
        while (!ilmEntry.done) {
            var scopeSpans = ilmEntry.value;
            if (scopeSpans.length > 0) {
                var spans = scopeSpans.map(function (readableSpan) {
                    return sdkSpanToOtlpSpan(readableSpan, encoder);
                });
                scopeResourceSpans.push({
                    scope: createInstrumentationScope(scopeSpans[0].instrumentationLibrary),
                    spans: spans,
                    schemaUrl: scopeSpans[0].instrumentationLibrary.schemaUrl,
                });
            }
            ilmEntry = ilmIterator.next();
        }
        // TODO SDK types don't provide resource schema URL at this time
        var transformedSpans = {
            resource: createResource(resource),
            scopeSpans: scopeResourceSpans,
            schemaUrl: undefined,
        };
        out.push(transformedSpans);
        entry = entryIterator.next();
    }
    return out;
}
//# sourceMappingURL=internal.js.map