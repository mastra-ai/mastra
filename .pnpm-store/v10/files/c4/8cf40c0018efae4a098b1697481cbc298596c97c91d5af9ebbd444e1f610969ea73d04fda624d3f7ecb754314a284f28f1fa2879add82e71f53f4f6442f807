import { createInstrumentationScope, createResource, toAttributes, } from '../common/internal';
import { getOtlpEncoder } from '../common/utils';
export function sdkSpanToOtlpSpan(span, encoder) {
    var _a;
    const ctx = span.spanContext();
    const status = span.status;
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
        events: span.events.map(event => toOtlpSpanEvent(event, encoder)),
        droppedEventsCount: span.droppedEventsCount,
        status: {
            // API and proto enums share the same values
            code: status.code,
            message: status.message,
        },
        links: span.links.map(link => toOtlpLink(link, encoder)),
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
    const encoder = getOtlpEncoder(options);
    return {
        resourceSpans: spanRecordsToResourceSpans(spans, encoder),
    };
}
function createResourceMap(readableSpans) {
    const resourceMap = new Map();
    for (const record of readableSpans) {
        let ilmMap = resourceMap.get(record.resource);
        if (!ilmMap) {
            ilmMap = new Map();
            resourceMap.set(record.resource, ilmMap);
        }
        // TODO this is duplicated in basic tracer. Consolidate on a common helper in core
        const instrumentationLibraryKey = `${record.instrumentationLibrary.name}@${record.instrumentationLibrary.version || ''}:${record.instrumentationLibrary.schemaUrl || ''}`;
        let records = ilmMap.get(instrumentationLibraryKey);
        if (!records) {
            records = [];
            ilmMap.set(instrumentationLibraryKey, records);
        }
        records.push(record);
    }
    return resourceMap;
}
function spanRecordsToResourceSpans(readableSpans, encoder) {
    const resourceMap = createResourceMap(readableSpans);
    const out = [];
    const entryIterator = resourceMap.entries();
    let entry = entryIterator.next();
    while (!entry.done) {
        const [resource, ilmMap] = entry.value;
        const scopeResourceSpans = [];
        const ilmIterator = ilmMap.values();
        let ilmEntry = ilmIterator.next();
        while (!ilmEntry.done) {
            const scopeSpans = ilmEntry.value;
            if (scopeSpans.length > 0) {
                const spans = scopeSpans.map(readableSpan => sdkSpanToOtlpSpan(readableSpan, encoder));
                scopeResourceSpans.push({
                    scope: createInstrumentationScope(scopeSpans[0].instrumentationLibrary),
                    spans: spans,
                    schemaUrl: scopeSpans[0].instrumentationLibrary.schemaUrl,
                });
            }
            ilmEntry = ilmIterator.next();
        }
        // TODO SDK types don't provide resource schema URL at this time
        const transformedSpans = {
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