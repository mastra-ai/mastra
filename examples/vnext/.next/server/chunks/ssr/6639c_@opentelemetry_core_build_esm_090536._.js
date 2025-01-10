module.exports = {

"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/constants.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "BAGGAGE_HEADER": (()=>BAGGAGE_HEADER),
    "BAGGAGE_ITEMS_SEPARATOR": (()=>BAGGAGE_ITEMS_SEPARATOR),
    "BAGGAGE_KEY_PAIR_SEPARATOR": (()=>BAGGAGE_KEY_PAIR_SEPARATOR),
    "BAGGAGE_MAX_NAME_VALUE_PAIRS": (()=>BAGGAGE_MAX_NAME_VALUE_PAIRS),
    "BAGGAGE_MAX_PER_NAME_VALUE_PAIRS": (()=>BAGGAGE_MAX_PER_NAME_VALUE_PAIRS),
    "BAGGAGE_MAX_TOTAL_LENGTH": (()=>BAGGAGE_MAX_TOTAL_LENGTH),
    "BAGGAGE_PROPERTIES_SEPARATOR": (()=>BAGGAGE_PROPERTIES_SEPARATOR)
});
var BAGGAGE_KEY_PAIR_SEPARATOR = '=';
var BAGGAGE_PROPERTIES_SEPARATOR = ';';
var BAGGAGE_ITEMS_SEPARATOR = ',';
var BAGGAGE_HEADER = 'baggage';
var BAGGAGE_MAX_NAME_VALUE_PAIRS = 180;
var BAGGAGE_MAX_PER_NAME_VALUE_PAIRS = 4096;
var BAGGAGE_MAX_TOTAL_LENGTH = 8192; //# sourceMappingURL=constants.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/utils.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getKeyPairs": (()=>getKeyPairs),
    "parseKeyPairsIntoRecord": (()=>parseKeyPairsIntoRecord),
    "parsePairKeyValue": (()=>parsePairKeyValue),
    "serializeKeyPairs": (()=>serializeKeyPairs)
});
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
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/constants.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
function serializeKeyPairs(keyPairs) {
    return keyPairs.reduce(function(hValue, current) {
        var value = "" + hValue + (hValue !== '' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_ITEMS_SEPARATOR"] : '') + current;
        return value.length > __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_MAX_TOTAL_LENGTH"] ? hValue : value;
    }, '');
}
function getKeyPairs(baggage) {
    return baggage.getAllEntries().map(function(_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        var entry = encodeURIComponent(key) + "=" + encodeURIComponent(value.value);
        // include opaque metadata if provided
        // NOTE: we intentionally don't URI-encode the metadata - that responsibility falls on the metadata implementation
        if (value.metadata !== undefined) {
            entry += __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_PROPERTIES_SEPARATOR"] + value.metadata.toString();
        }
        return entry;
    });
}
function parsePairKeyValue(entry) {
    var valueProps = entry.split(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_PROPERTIES_SEPARATOR"]);
    if (valueProps.length <= 0) return;
    var keyPairPart = valueProps.shift();
    if (!keyPairPart) return;
    var separatorIndex = keyPairPart.indexOf(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_KEY_PAIR_SEPARATOR"]);
    if (separatorIndex <= 0) return;
    var key = decodeURIComponent(keyPairPart.substring(0, separatorIndex).trim());
    var value = decodeURIComponent(keyPairPart.substring(separatorIndex + 1).trim());
    var metadata;
    if (valueProps.length > 0) {
        metadata = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["baggageEntryMetadataFromString"])(valueProps.join(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_PROPERTIES_SEPARATOR"]));
    }
    return {
        key: key,
        value: value,
        metadata: metadata
    };
}
function parseKeyPairsIntoRecord(value) {
    if (typeof value !== 'string' || value.length === 0) return {};
    return value.split(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_ITEMS_SEPARATOR"]).map(function(entry) {
        return parsePairKeyValue(entry);
    }).filter(function(keyPair) {
        return keyPair !== undefined && keyPair.value.length > 0;
    }).reduce(function(headers, keyPair) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        headers[keyPair.key] = keyPair.value;
        return headers;
    }, {});
} //# sourceMappingURL=utils.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "isTracingSuppressed": (()=>isTracingSuppressed),
    "suppressTracing": (()=>suppressTracing),
    "unsuppressTracing": (()=>unsuppressTracing)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
var SUPPRESS_TRACING_KEY = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["createContextKey"])('OpenTelemetry SDK Context Key SUPPRESS_TRACING');
function suppressTracing(context) {
    return context.setValue(SUPPRESS_TRACING_KEY, true);
}
function unsuppressTracing(context) {
    return context.deleteValue(SUPPRESS_TRACING_KEY);
}
function isTracingSuppressed(context) {
    return context.getValue(SUPPRESS_TRACING_KEY) === true;
} //# sourceMappingURL=suppress-tracing.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/internal/exporter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "_export": (()=>_export)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
;
;
function _export(exporter, arg) {
    return new Promise(function(resolve) {
        // prevent downstream exporter calls from generating spans
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].with((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["suppressTracing"])(__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].active()), function() {
            exporter.export(arg, function(result) {
                resolve(result);
            });
        });
    });
} //# sourceMappingURL=exporter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "baggageUtils": (()=>baggageUtils),
    "internal": (()=>internal)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$internal$2f$exporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/internal/exporter.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
var baggageUtils = {
    getKeyPairs: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getKeyPairs"],
    serializeKeyPairs: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serializeKeyPairs"],
    parseKeyPairsIntoRecord: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseKeyPairsIntoRecord"],
    parsePairKeyValue: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parsePairKeyValue"]
};
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
var internal = {
    _export: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$internal$2f$exporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_export"]
}; //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "AlwaysOffSampler": (()=>AlwaysOffSampler)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
/**
 * @deprecated Use the one defined in @opentelemetry/sdk-trace-base instead.
 * Sampler that samples no traces.
 */ var AlwaysOffSampler = function() {
    function AlwaysOffSampler() {}
    AlwaysOffSampler.prototype.shouldSample = function() {
        return {
            decision: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SamplingDecision"].NOT_RECORD
        };
    };
    AlwaysOffSampler.prototype.toString = function() {
        return 'AlwaysOffSampler';
    };
    return AlwaysOffSampler;
}();
;
 //# sourceMappingURL=AlwaysOffSampler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "AlwaysOnSampler": (()=>AlwaysOnSampler)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
/**
 * @deprecated Use the one defined in @opentelemetry/sdk-trace-base instead.
 * Sampler that samples all traces.
 */ var AlwaysOnSampler = function() {
    function AlwaysOnSampler() {}
    AlwaysOnSampler.prototype.shouldSample = function() {
        return {
            decision: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SamplingDecision"].RECORD_AND_SAMPLED
        };
    };
    AlwaysOnSampler.prototype.toString = function() {
        return 'AlwaysOnSampler';
    };
    return AlwaysOnSampler;
}();
;
 //# sourceMappingURL=AlwaysOnSampler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/anchored-clock.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * A utility for returning wall times anchored to a given point in time. Wall time measurements will
 * not be taken from the system, but instead are computed by adding a monotonic clock time
 * to the anchor point.
 *
 * This is needed because the system time can change and result in unexpected situations like
 * spans ending before they are started. Creating an anchored clock for each local root span
 * ensures that span timings and durations are accurate while preventing span times from drifting
 * too far from the system clock.
 *
 * Only creating an anchored clock once per local trace ensures span times are correct relative
 * to each other. For example, a child span will never have a start time before its parent even
 * if the system clock is corrected during the local trace.
 *
 * Heavily inspired by the OTel Java anchored clock
 * https://github.com/open-telemetry/opentelemetry-java/blob/main/sdk/trace/src/main/java/io/opentelemetry/sdk/trace/AnchoredClock.java
 */ __turbopack_esm__({
    "AnchoredClock": (()=>AnchoredClock)
});
var AnchoredClock = function() {
    /**
     * Create a new AnchoredClock anchored to the current time returned by systemClock.
     *
     * @param systemClock should be a clock that returns the number of milliseconds since January 1 1970 such as Date
     * @param monotonicClock should be a clock that counts milliseconds monotonically such as window.performance or perf_hooks.performance
     */ function AnchoredClock(systemClock, monotonicClock) {
        this._monotonicClock = monotonicClock;
        this._epochMillis = systemClock.now();
        this._performanceMillis = monotonicClock.now();
    }
    /**
     * Returns the current time by adding the number of milliseconds since the
     * AnchoredClock was created to the creation epoch time
     */ AnchoredClock.prototype.now = function() {
        var delta = this._monotonicClock.now() - this._performanceMillis;
        return this._epochMillis + delta;
    };
    return AnchoredClock;
}();
;
 //# sourceMappingURL=anchored-clock.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/promise.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "Deferred": (()=>Deferred)
});
var Deferred = function() {
    function Deferred() {
        var _this = this;
        this._promise = new Promise(function(resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "promise", {
        get: function() {
            return this._promise;
        },
        enumerable: false,
        configurable: true
    });
    Deferred.prototype.resolve = function(val) {
        this._resolve(val);
    };
    Deferred.prototype.reject = function(err) {
        this._reject(err);
    };
    return Deferred;
}();
;
 //# sourceMappingURL=promise.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/callback.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "BindOnceFuture": (()=>BindOnceFuture)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$promise$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/promise.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
;
/**
 * Bind the callback and only invoke the callback once regardless how many times `BindOnceFuture.call` is invoked.
 */ var BindOnceFuture = function() {
    function BindOnceFuture(_callback, _that) {
        this._callback = _callback;
        this._that = _that;
        this._isCalled = false;
        this._deferred = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$promise$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Deferred"]();
    }
    Object.defineProperty(BindOnceFuture.prototype, "isCalled", {
        get: function() {
            return this._isCalled;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BindOnceFuture.prototype, "promise", {
        get: function() {
            return this._deferred.promise;
        },
        enumerable: false,
        configurable: true
    });
    BindOnceFuture.prototype.call = function() {
        var _a;
        var _this = this;
        var args = [];
        for(var _i = 0; _i < arguments.length; _i++){
            args[_i] = arguments[_i];
        }
        if (!this._isCalled) {
            this._isCalled = true;
            try {
                Promise.resolve((_a = this._callback).call.apply(_a, __spreadArray([
                    this._that
                ], __read(args), false))).then(function(val) {
                    return _this._deferred.resolve(val);
                }, function(err) {
                    return _this._deferred.reject(err);
                });
            } catch (err) {
                this._deferred.reject(err);
            }
        }
        return this._deferred.promise;
    };
    return BindOnceFuture;
}();
;
 //# sourceMappingURL=callback.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/propagation/composite.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "CompositePropagator": (()=>CompositePropagator)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
;
/** Combines multiple propagators into a single propagator. */ var CompositePropagator = function() {
    /**
     * Construct a composite propagator from a list of propagators.
     *
     * @param [config] Configuration object for composite propagator
     */ function CompositePropagator(config) {
        if (config === void 0) {
            config = {};
        }
        var _a;
        this._propagators = (_a = config.propagators) !== null && _a !== void 0 ? _a : [];
        this._fields = Array.from(new Set(this._propagators// older propagators may not have fields function, null check to be sure
        .map(function(p) {
            return typeof p.fields === 'function' ? p.fields() : [];
        }).reduce(function(x, y) {
            return x.concat(y);
        }, [])));
    }
    /**
     * Run each of the configured propagators with the given context and carrier.
     * Propagators are run in the order they are configured, so if multiple
     * propagators write the same carrier key, the propagator later in the list
     * will "win".
     *
     * @param context Context to inject
     * @param carrier Carrier into which context will be injected
     */ CompositePropagator.prototype.inject = function(context, carrier, setter) {
        var e_1, _a;
        try {
            for(var _b = __values(this._propagators), _c = _b.next(); !_c.done; _c = _b.next()){
                var propagator = _c.value;
                try {
                    propagator.inject(context, carrier, setter);
                } catch (err) {
                    __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Failed to inject with " + propagator.constructor.name + ". Err: " + err.message);
                }
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
    };
    /**
     * Run each of the configured propagators with the given context and carrier.
     * Propagators are run in the order they are configured, so if multiple
     * propagators write the same context key, the propagator later in the list
     * will "win".
     *
     * @param context Context to add values to
     * @param carrier Carrier from which to extract context
     */ CompositePropagator.prototype.extract = function(context, carrier, getter) {
        return this._propagators.reduce(function(ctx, propagator) {
            try {
                return propagator.extract(ctx, carrier, getter);
            } catch (err) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Failed to extract with " + propagator.constructor.name + ". Err: " + err.message);
            }
            return ctx;
        }, context);
    };
    CompositePropagator.prototype.fields = function() {
        // return a new array so our fields cannot be modified
        return this._fields.slice();
    };
    return CompositePropagator;
}();
;
 //# sourceMappingURL=composite.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/sampling.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TracesSamplerValues": (()=>TracesSamplerValues)
});
var TracesSamplerValues;
(function(TracesSamplerValues) {
    TracesSamplerValues["AlwaysOff"] = "always_off";
    TracesSamplerValues["AlwaysOn"] = "always_on";
    TracesSamplerValues["ParentBasedAlwaysOff"] = "parentbased_always_off";
    TracesSamplerValues["ParentBasedAlwaysOn"] = "parentbased_always_on";
    TracesSamplerValues["ParentBasedTraceIdRatio"] = "parentbased_traceidratio";
    TracesSamplerValues["TraceIdRatio"] = "traceidratio";
})(TracesSamplerValues || (TracesSamplerValues = {})); //# sourceMappingURL=sampling.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/environment.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "DEFAULT_ATTRIBUTE_COUNT_LIMIT": (()=>DEFAULT_ATTRIBUTE_COUNT_LIMIT),
    "DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT": (()=>DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT),
    "DEFAULT_ENVIRONMENT": (()=>DEFAULT_ENVIRONMENT),
    "DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT": (()=>DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT),
    "DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT": (()=>DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT),
    "parseEnvironment": (()=>parseEnvironment)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/sampling.js [app-rsc] (ecmascript)");
;
;
var DEFAULT_LIST_SEPARATOR = ',';
/**
 * Environment interface to define all names
 */ var ENVIRONMENT_BOOLEAN_KEYS = [
    'OTEL_SDK_DISABLED'
];
function isEnvVarABoolean(key) {
    return ENVIRONMENT_BOOLEAN_KEYS.indexOf(key) > -1;
}
var ENVIRONMENT_NUMBERS_KEYS = [
    'OTEL_BSP_EXPORT_TIMEOUT',
    'OTEL_BSP_MAX_EXPORT_BATCH_SIZE',
    'OTEL_BSP_MAX_QUEUE_SIZE',
    'OTEL_BSP_SCHEDULE_DELAY',
    'OTEL_BLRP_EXPORT_TIMEOUT',
    'OTEL_BLRP_MAX_EXPORT_BATCH_SIZE',
    'OTEL_BLRP_MAX_QUEUE_SIZE',
    'OTEL_BLRP_SCHEDULE_DELAY',
    'OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT',
    'OTEL_ATTRIBUTE_COUNT_LIMIT',
    'OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT',
    'OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT',
    'OTEL_LOGRECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT',
    'OTEL_LOGRECORD_ATTRIBUTE_COUNT_LIMIT',
    'OTEL_SPAN_EVENT_COUNT_LIMIT',
    'OTEL_SPAN_LINK_COUNT_LIMIT',
    'OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT',
    'OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT',
    'OTEL_EXPORTER_OTLP_TIMEOUT',
    'OTEL_EXPORTER_OTLP_TRACES_TIMEOUT',
    'OTEL_EXPORTER_OTLP_METRICS_TIMEOUT',
    'OTEL_EXPORTER_OTLP_LOGS_TIMEOUT',
    'OTEL_EXPORTER_JAEGER_AGENT_PORT'
];
function isEnvVarANumber(key) {
    return ENVIRONMENT_NUMBERS_KEYS.indexOf(key) > -1;
}
var ENVIRONMENT_LISTS_KEYS = [
    'OTEL_NO_PATCH_MODULES',
    'OTEL_PROPAGATORS',
    'OTEL_SEMCONV_STABILITY_OPT_IN'
];
function isEnvVarAList(key) {
    return ENVIRONMENT_LISTS_KEYS.indexOf(key) > -1;
}
var DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT = Infinity;
var DEFAULT_ATTRIBUTE_COUNT_LIMIT = 128;
var DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT = 128;
var DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT = 128;
var DEFAULT_ENVIRONMENT = {
    OTEL_SDK_DISABLED: false,
    CONTAINER_NAME: '',
    ECS_CONTAINER_METADATA_URI_V4: '',
    ECS_CONTAINER_METADATA_URI: '',
    HOSTNAME: '',
    KUBERNETES_SERVICE_HOST: '',
    NAMESPACE: '',
    OTEL_BSP_EXPORT_TIMEOUT: 30000,
    OTEL_BSP_MAX_EXPORT_BATCH_SIZE: 512,
    OTEL_BSP_MAX_QUEUE_SIZE: 2048,
    OTEL_BSP_SCHEDULE_DELAY: 5000,
    OTEL_BLRP_EXPORT_TIMEOUT: 30000,
    OTEL_BLRP_MAX_EXPORT_BATCH_SIZE: 512,
    OTEL_BLRP_MAX_QUEUE_SIZE: 2048,
    OTEL_BLRP_SCHEDULE_DELAY: 5000,
    OTEL_EXPORTER_JAEGER_AGENT_HOST: '',
    OTEL_EXPORTER_JAEGER_AGENT_PORT: 6832,
    OTEL_EXPORTER_JAEGER_ENDPOINT: '',
    OTEL_EXPORTER_JAEGER_PASSWORD: '',
    OTEL_EXPORTER_JAEGER_USER: '',
    OTEL_EXPORTER_OTLP_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_HEADERS: '',
    OTEL_EXPORTER_OTLP_TRACES_HEADERS: '',
    OTEL_EXPORTER_OTLP_METRICS_HEADERS: '',
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: '',
    OTEL_EXPORTER_OTLP_TIMEOUT: 10000,
    OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: 10000,
    OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: 10000,
    OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: 10000,
    OTEL_EXPORTER_ZIPKIN_ENDPOINT: 'http://localhost:9411/api/v2/spans',
    OTEL_LOG_LEVEL: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].INFO,
    OTEL_NO_PATCH_MODULES: [],
    OTEL_PROPAGATORS: [
        'tracecontext',
        'baggage'
    ],
    OTEL_RESOURCE_ATTRIBUTES: '',
    OTEL_SERVICE_NAME: '',
    OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT,
    OTEL_ATTRIBUTE_COUNT_LIMIT: DEFAULT_ATTRIBUTE_COUNT_LIMIT,
    OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT,
    OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT: DEFAULT_ATTRIBUTE_COUNT_LIMIT,
    OTEL_LOGRECORD_ATTRIBUTE_VALUE_LENGTH_LIMIT: DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT,
    OTEL_LOGRECORD_ATTRIBUTE_COUNT_LIMIT: DEFAULT_ATTRIBUTE_COUNT_LIMIT,
    OTEL_SPAN_EVENT_COUNT_LIMIT: 128,
    OTEL_SPAN_LINK_COUNT_LIMIT: 128,
    OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT: DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT,
    OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT: DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT,
    OTEL_TRACES_EXPORTER: '',
    OTEL_TRACES_SAMPLER: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].ParentBasedAlwaysOn,
    OTEL_TRACES_SAMPLER_ARG: '',
    OTEL_LOGS_EXPORTER: '',
    OTEL_EXPORTER_OTLP_INSECURE: '',
    OTEL_EXPORTER_OTLP_TRACES_INSECURE: '',
    OTEL_EXPORTER_OTLP_METRICS_INSECURE: '',
    OTEL_EXPORTER_OTLP_LOGS_INSECURE: '',
    OTEL_EXPORTER_OTLP_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_COMPRESSION: '',
    OTEL_EXPORTER_OTLP_TRACES_COMPRESSION: '',
    OTEL_EXPORTER_OTLP_METRICS_COMPRESSION: '',
    OTEL_EXPORTER_OTLP_LOGS_COMPRESSION: '',
    OTEL_EXPORTER_OTLP_CLIENT_KEY: '',
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY: '',
    OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY: '',
    OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY: '',
    OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE: '',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: 'cumulative',
    OTEL_SEMCONV_STABILITY_OPT_IN: []
};
/**
 * @param key
 * @param environment
 * @param values
 */ function parseBoolean(key, environment, values) {
    if (typeof values[key] === 'undefined') {
        return;
    }
    var value = String(values[key]);
    // support case-insensitive "true"
    environment[key] = value.toLowerCase() === 'true';
}
/**
 * Parses a variable as number with number validation
 * @param name
 * @param environment
 * @param values
 * @param min
 * @param max
 */ function parseNumber(name, environment, values, min, max) {
    if (min === void 0) {
        min = -Infinity;
    }
    if (max === void 0) {
        max = Infinity;
    }
    if (typeof values[name] !== 'undefined') {
        var value = Number(values[name]);
        if (!isNaN(value)) {
            if (value < min) {
                environment[name] = min;
            } else if (value > max) {
                environment[name] = max;
            } else {
                environment[name] = value;
            }
        }
    }
}
/**
 * Parses list-like strings from input into output.
 * @param name
 * @param environment
 * @param values
 * @param separator
 */ function parseStringList(name, output, input, separator) {
    if (separator === void 0) {
        separator = DEFAULT_LIST_SEPARATOR;
    }
    var givenValue = input[name];
    if (typeof givenValue === 'string') {
        output[name] = givenValue.split(separator).map(function(v) {
            return v.trim();
        });
    }
}
// The support string -> DiagLogLevel mappings
var logLevelMap = {
    ALL: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].ALL,
    VERBOSE: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].VERBOSE,
    DEBUG: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].DEBUG,
    INFO: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].INFO,
    WARN: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].WARN,
    ERROR: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].ERROR,
    NONE: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["DiagLogLevel"].NONE
};
/**
 * Environmentally sets log level if valid log level string is provided
 * @param key
 * @param environment
 * @param values
 */ function setLogLevelFromEnv(key, environment, values) {
    var value = values[key];
    if (typeof value === 'string') {
        var theLevel = logLevelMap[value.toUpperCase()];
        if (theLevel != null) {
            environment[key] = theLevel;
        }
    }
}
function parseEnvironment(values) {
    var environment = {};
    for(var env in DEFAULT_ENVIRONMENT){
        var key = env;
        switch(key){
            case 'OTEL_LOG_LEVEL':
                setLogLevelFromEnv(key, environment, values);
                break;
            default:
                if (isEnvVarABoolean(key)) {
                    parseBoolean(key, environment, values);
                } else if (isEnvVarANumber(key)) {
                    parseNumber(key, environment, values);
                } else if (isEnvVarAList(key)) {
                    parseStringList(key, environment, values);
                } else {
                    var value = values[key];
                    if (typeof value !== 'undefined' && value !== null) {
                        environment[key] = String(value);
                    }
                }
        }
    }
    return environment;
} //# sourceMappingURL=environment.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ExportResultCode": (()=>ExportResultCode)
});
var ExportResultCode;
(function(ExportResultCode) {
    ExportResultCode[ExportResultCode["SUCCESS"] = 0] = "SUCCESS";
    ExportResultCode[ExportResultCode["FAILED"] = 1] = "FAILED";
})(ExportResultCode || (ExportResultCode = {})); //# sourceMappingURL=ExportResult.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/logging-error-handler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "loggingErrorHandler": (()=>loggingErrorHandler)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
function loggingErrorHandler() {
    return function(ex) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error(stringifyException(ex));
    };
}
/**
 * Converts an exception into a string representation
 * @param {Exception} ex
 */ function stringifyException(ex) {
    if (typeof ex === 'string') {
        return ex;
    } else {
        return JSON.stringify(flattenException(ex));
    }
}
/**
 * Flattens an exception into key-value pairs by traversing the prototype chain
 * and coercing values to strings. Duplicate properties will not be overwritten;
 * the first insert wins.
 */ function flattenException(ex) {
    var result = {};
    var current = ex;
    while(current !== null){
        Object.getOwnPropertyNames(current).forEach(function(propertyName) {
            if (result[propertyName]) return;
            var value = current[propertyName];
            if (value) {
                result[propertyName] = String(value);
            }
        });
        current = Object.getPrototypeOf(current);
    }
    return result;
} //# sourceMappingURL=logging-error-handler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "globalErrorHandler": (()=>globalErrorHandler),
    "setGlobalErrorHandler": (()=>setGlobalErrorHandler)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$logging$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/logging-error-handler.js [app-rsc] (ecmascript)");
;
/** The global error handler delegate */ var delegateHandler = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$logging$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loggingErrorHandler"])();
function setGlobalErrorHandler(handler) {
    delegateHandler = handler;
}
function globalErrorHandler(ex) {
    try {
        delegateHandler(ex);
    } catch (_a) {} // eslint-disable-line no-empty
} //# sourceMappingURL=global-error-handler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/ParentBasedSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ParentBasedSampler": (()=>ParentBasedSampler)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)");
;
;
;
;
/**
 * @deprecated Use the one defined in @opentelemetry/sdk-trace-base instead.
 * A composite sampler that either respects the parent span's sampling decision
 * or delegates to `delegateSampler` for root spans.
 */ var ParentBasedSampler = function() {
    function ParentBasedSampler(config) {
        var _a, _b, _c, _d;
        this._root = config.root;
        if (!this._root) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(new Error('ParentBasedSampler must have a root sampler configured'));
            this._root = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        }
        this._remoteParentSampled = (_a = config.remoteParentSampled) !== null && _a !== void 0 ? _a : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        this._remoteParentNotSampled = (_b = config.remoteParentNotSampled) !== null && _b !== void 0 ? _b : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]();
        this._localParentSampled = (_c = config.localParentSampled) !== null && _c !== void 0 ? _c : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        this._localParentNotSampled = (_d = config.localParentNotSampled) !== null && _d !== void 0 ? _d : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]();
    }
    ParentBasedSampler.prototype.shouldSample = function(context, traceId, spanName, spanKind, attributes, links) {
        var parentContext = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["trace"].getSpanContext(context);
        if (!parentContext || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["isSpanContextValid"])(parentContext)) {
            return this._root.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.isRemote) {
            if (parentContext.traceFlags & __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["TraceFlags"].SAMPLED) {
                return this._remoteParentSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
            }
            return this._remoteParentNotSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        if (parentContext.traceFlags & __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["TraceFlags"].SAMPLED) {
            return this._localParentSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
        }
        return this._localParentNotSampled.shouldSample(context, traceId, spanName, spanKind, attributes, links);
    };
    ParentBasedSampler.prototype.toString = function() {
        return "ParentBased{root=" + this._root.toString() + ", remoteParentSampled=" + this._remoteParentSampled.toString() + ", remoteParentNotSampled=" + this._remoteParentNotSampled.toString() + ", localParentSampled=" + this._localParentSampled.toString() + ", localParentNotSampled=" + this._localParentNotSampled.toString() + "}";
    };
    return ParentBasedSampler;
}();
;
 //# sourceMappingURL=ParentBasedSampler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/rpc-metadata.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "RPCType": (()=>RPCType),
    "deleteRPCMetadata": (()=>deleteRPCMetadata),
    "getRPCMetadata": (()=>getRPCMetadata),
    "setRPCMetadata": (()=>setRPCMetadata)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
var RPC_METADATA_KEY = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["createContextKey"])('OpenTelemetry SDK Context Key RPC_METADATA');
var RPCType;
(function(RPCType) {
    RPCType["HTTP"] = "http";
})(RPCType || (RPCType = {}));
function setRPCMetadata(context, meta) {
    return context.setValue(RPC_METADATA_KEY, meta);
}
function deleteRPCMetadata(context) {
    return context.deleteValue(RPC_METADATA_KEY);
}
function getRPCMetadata(context) {
    return context.getValue(RPC_METADATA_KEY);
} //# sourceMappingURL=rpc-metadata.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/RandomIdGenerator.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "RandomIdGenerator": (()=>RandomIdGenerator)
});
var SPAN_ID_BYTES = 8;
var TRACE_ID_BYTES = 16;
/**
 * @deprecated Use the one defined in @opentelemetry/sdk-trace-base instead.
 */ var RandomIdGenerator = function() {
    function RandomIdGenerator() {
        /**
         * Returns a random 16-byte trace ID formatted/encoded as a 32 lowercase hex
         * characters corresponding to 128 bits.
         */ this.generateTraceId = getIdGenerator(TRACE_ID_BYTES);
        /**
         * Returns a random 8-byte span ID formatted/encoded as a 16 lowercase hex
         * characters corresponding to 64 bits.
         */ this.generateSpanId = getIdGenerator(SPAN_ID_BYTES);
    }
    return RandomIdGenerator;
}();
;
var SHARED_BUFFER = Buffer.allocUnsafe(TRACE_ID_BYTES);
function getIdGenerator(bytes) {
    return function generateId() {
        for(var i = 0; i < bytes / 4; i++){
            // unsigned right shift drops decimal part of the number
            // it is required because if a number between 2**32 and 2**32 - 1 is generated, an out of range error is thrown by writeUInt32BE
            SHARED_BUFFER.writeUInt32BE(Math.random() * Math.pow(2, 32) >>> 0, i * 4);
        }
        // If buffer is all 0, set the last byte to 1 to guarantee a valid w3c id is generated
        for(var i = 0; i < bytes; i++){
            if (SHARED_BUFFER[i] > 0) {
                break;
            } else if (i === bytes - 1) {
                SHARED_BUFFER[bytes - 1] = 1;
            }
        }
        return SHARED_BUFFER.toString('hex', 0, bytes);
    };
} //# sourceMappingURL=RandomIdGenerator.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/version.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ // this is autogenerated file, see scripts/version-update.js
__turbopack_esm__({
    "VERSION": (()=>VERSION)
});
var VERSION = '1.28.0'; //# sourceMappingURL=version.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/sdk-info.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "SDK_INFO": (()=>SDK_INFO)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+semantic-conventions@1.27.0/node_modules/@opentelemetry/semantic-conventions/build/esm/resource/SemanticResourceAttributes.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$version$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/version.js [app-rsc] (ecmascript)");
var _a;
;
;
var SDK_INFO = (_a = {}, _a[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMRESATTRS_TELEMETRY_SDK_NAME"]] = 'opentelemetry', _a[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMRESATTRS_PROCESS_RUNTIME_NAME"]] = 'node', _a[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMRESATTRS_TELEMETRY_SDK_LANGUAGE"]] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TELEMETRYSDKLANGUAGEVALUES_NODEJS"], _a[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$resource$2f$SemanticResourceAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMRESATTRS_TELEMETRY_SDK_VERSION"]] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$version$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["VERSION"], _a); //# sourceMappingURL=sdk-info.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/internal/validators.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "validateKey": (()=>validateKey),
    "validateValue": (()=>validateValue)
});
var VALID_KEY_CHAR_RANGE = '[_0-9a-z-*/]';
var VALID_KEY = "[a-z]" + VALID_KEY_CHAR_RANGE + "{0,255}";
var VALID_VENDOR_KEY = "[a-z0-9]" + VALID_KEY_CHAR_RANGE + "{0,240}@[a-z]" + VALID_KEY_CHAR_RANGE + "{0,13}";
var VALID_KEY_REGEX = new RegExp("^(?:" + VALID_KEY + "|" + VALID_VENDOR_KEY + ")$");
var VALID_VALUE_BASE_REGEX = /^[ -~]{0,255}[!-~]$/;
var INVALID_VALUE_COMMA_EQUAL_REGEX = /,|=/;
function validateKey(key) {
    return VALID_KEY_REGEX.test(key);
}
function validateValue(value) {
    return VALID_VALUE_BASE_REGEX.test(value) && !INVALID_VALUE_COMMA_EQUAL_REGEX.test(value);
} //# sourceMappingURL=validators.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/TraceState.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TraceState": (()=>TraceState)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$internal$2f$validators$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/internal/validators.js [app-rsc] (ecmascript)");
;
var MAX_TRACE_STATE_ITEMS = 32;
var MAX_TRACE_STATE_LEN = 512;
var LIST_MEMBERS_SEPARATOR = ',';
var LIST_MEMBER_KEY_VALUE_SPLITTER = '=';
/**
 * TraceState must be a class and not a simple object type because of the spec
 * requirement (https://www.w3.org/TR/trace-context/#tracestate-field).
 *
 * Here is the list of allowed mutations:
 * - New key-value pair should be added into the beginning of the list
 * - The value of any key can be updated. Modified keys MUST be moved to the
 * beginning of the list.
 */ var TraceState = function() {
    function TraceState(rawTraceState) {
        this._internalState = new Map();
        if (rawTraceState) this._parse(rawTraceState);
    }
    TraceState.prototype.set = function(key, value) {
        // TODO: Benchmark the different approaches(map vs list) and
        // use the faster one.
        var traceState = this._clone();
        if (traceState._internalState.has(key)) {
            traceState._internalState.delete(key);
        }
        traceState._internalState.set(key, value);
        return traceState;
    };
    TraceState.prototype.unset = function(key) {
        var traceState = this._clone();
        traceState._internalState.delete(key);
        return traceState;
    };
    TraceState.prototype.get = function(key) {
        return this._internalState.get(key);
    };
    TraceState.prototype.serialize = function() {
        var _this = this;
        return this._keys().reduce(function(agg, key) {
            agg.push(key + LIST_MEMBER_KEY_VALUE_SPLITTER + _this.get(key));
            return agg;
        }, []).join(LIST_MEMBERS_SEPARATOR);
    };
    TraceState.prototype._parse = function(rawTraceState) {
        if (rawTraceState.length > MAX_TRACE_STATE_LEN) return;
        this._internalState = rawTraceState.split(LIST_MEMBERS_SEPARATOR).reverse() // Store in reverse so new keys (.set(...)) will be placed at the beginning
        .reduce(function(agg, part) {
            var listMember = part.trim(); // Optional Whitespace (OWS) handling
            var i = listMember.indexOf(LIST_MEMBER_KEY_VALUE_SPLITTER);
            if (i !== -1) {
                var key = listMember.slice(0, i);
                var value = listMember.slice(i + 1, part.length);
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$internal$2f$validators$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateKey"])(key) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$internal$2f$validators$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateValue"])(value)) {
                    agg.set(key, value);
                } else {
                // TODO: Consider to add warning log
                }
            }
            return agg;
        }, new Map());
        // Because of the reverse() requirement, trunc must be done after map is created
        if (this._internalState.size > MAX_TRACE_STATE_ITEMS) {
            this._internalState = new Map(Array.from(this._internalState.entries()).reverse() // Use reverse same as original tracestate parse chain
            .slice(0, MAX_TRACE_STATE_ITEMS));
        }
    };
    TraceState.prototype._keys = function() {
        return Array.from(this._internalState.keys()).reverse();
    };
    TraceState.prototype._clone = function() {
        var traceState = new TraceState();
        traceState._internalState = new Map(this._internalState);
        return traceState;
    };
    return TraceState;
}();
;
 //# sourceMappingURL=TraceState.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/W3CTraceContextPropagator.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TRACE_PARENT_HEADER": (()=>TRACE_PARENT_HEADER),
    "TRACE_STATE_HEADER": (()=>TRACE_STATE_HEADER),
    "W3CTraceContextPropagator": (()=>W3CTraceContextPropagator),
    "parseTraceParent": (()=>parseTraceParent)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$TraceState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/TraceState.js [app-rsc] (ecmascript)");
;
;
;
var TRACE_PARENT_HEADER = 'traceparent';
var TRACE_STATE_HEADER = 'tracestate';
var VERSION = '00';
var VERSION_PART = '(?!ff)[\\da-f]{2}';
var TRACE_ID_PART = '(?![0]{32})[\\da-f]{32}';
var PARENT_ID_PART = '(?![0]{16})[\\da-f]{16}';
var FLAGS_PART = '[\\da-f]{2}';
var TRACE_PARENT_REGEX = new RegExp("^\\s?(" + VERSION_PART + ")-(" + TRACE_ID_PART + ")-(" + PARENT_ID_PART + ")-(" + FLAGS_PART + ")(-.*)?\\s?$");
function parseTraceParent(traceParent) {
    var match = TRACE_PARENT_REGEX.exec(traceParent);
    if (!match) return null;
    // According to the specification the implementation should be compatible
    // with future versions. If there are more parts, we only reject it if it's using version 00
    // See https://www.w3.org/TR/trace-context/#versioning-of-traceparent
    if (match[1] === '00' && match[5]) return null;
    return {
        traceId: match[2],
        spanId: match[3],
        traceFlags: parseInt(match[4], 16)
    };
}
/**
 * Propagates {@link SpanContext} through Trace Context format propagation.
 *
 * Based on the Trace Context specification:
 * https://www.w3.org/TR/trace-context/
 */ var W3CTraceContextPropagator = function() {
    function W3CTraceContextPropagator() {}
    W3CTraceContextPropagator.prototype.inject = function(context, carrier, setter) {
        var spanContext = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["trace"].getSpanContext(context);
        if (!spanContext || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTracingSuppressed"])(context) || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["isSpanContextValid"])(spanContext)) return;
        var traceParent = VERSION + "-" + spanContext.traceId + "-" + spanContext.spanId + "-0" + Number(spanContext.traceFlags || __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["TraceFlags"].NONE).toString(16);
        setter.set(carrier, TRACE_PARENT_HEADER, traceParent);
        if (spanContext.traceState) {
            setter.set(carrier, TRACE_STATE_HEADER, spanContext.traceState.serialize());
        }
    };
    W3CTraceContextPropagator.prototype.extract = function(context, carrier, getter) {
        var traceParentHeader = getter.get(carrier, TRACE_PARENT_HEADER);
        if (!traceParentHeader) return context;
        var traceParent = Array.isArray(traceParentHeader) ? traceParentHeader[0] : traceParentHeader;
        if (typeof traceParent !== 'string') return context;
        var spanContext = parseTraceParent(traceParent);
        if (!spanContext) return context;
        spanContext.isRemote = true;
        var traceStateHeader = getter.get(carrier, TRACE_STATE_HEADER);
        if (traceStateHeader) {
            // If more than one `tracestate` header is found, we merge them into a
            // single header.
            var state = Array.isArray(traceStateHeader) ? traceStateHeader.join(',') : traceStateHeader;
            spanContext.traceState = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$TraceState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceState"](typeof state === 'string' ? state : undefined);
        }
        return __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["trace"].setSpanContext(context, spanContext);
    };
    W3CTraceContextPropagator.prototype.fields = function() {
        return [
            TRACE_PARENT_HEADER,
            TRACE_STATE_HEADER
        ];
    };
    return W3CTraceContextPropagator;
}();
;
 //# sourceMappingURL=W3CTraceContextPropagator.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/timeout.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TimeoutError": (()=>TimeoutError),
    "callWithTimeout": (()=>callWithTimeout)
});
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
/**
 * Error that is thrown on timeouts.
 */ var TimeoutError = function(_super) {
    __extends(TimeoutError, _super);
    function TimeoutError(message) {
        var _this = _super.call(this, message) || this;
        // manually adjust prototype to retain `instanceof` functionality when targeting ES5, see:
        // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(_this, TimeoutError.prototype);
        return _this;
    }
    return TimeoutError;
}(Error);
;
function callWithTimeout(promise, timeout) {
    var timeoutHandle;
    var timeoutPromise = new Promise(function timeoutFunction(_resolve, reject) {
        timeoutHandle = setTimeout(function timeoutHandler() {
            reject(new TimeoutError('Operation timed out.'));
        }, timeout);
    });
    return Promise.race([
        promise,
        timeoutPromise
    ]).then(function(result) {
        clearTimeout(timeoutHandle);
        return result;
    }, function(reason) {
        clearTimeout(timeoutHandle);
        throw reason;
    });
} //# sourceMappingURL=timeout.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/TraceIdRatioBasedSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TraceIdRatioBasedSampler": (()=>TraceIdRatioBasedSampler)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
;
/**
 * @deprecated Use the one defined in @opentelemetry/sdk-trace-base instead.
 * Sampler that samples a given fraction of traces based of trace id deterministically.
 */ var TraceIdRatioBasedSampler = function() {
    function TraceIdRatioBasedSampler(_ratio) {
        if (_ratio === void 0) {
            _ratio = 0;
        }
        this._ratio = _ratio;
        this._ratio = this._normalize(_ratio);
        this._upperBound = Math.floor(this._ratio * 0xffffffff);
    }
    TraceIdRatioBasedSampler.prototype.shouldSample = function(context, traceId) {
        return {
            decision: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["isValidTraceId"])(traceId) && this._accumulate(traceId) < this._upperBound ? __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SamplingDecision"].RECORD_AND_SAMPLED : __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SamplingDecision"].NOT_RECORD
        };
    };
    TraceIdRatioBasedSampler.prototype.toString = function() {
        return "TraceIdRatioBased{" + this._ratio + "}";
    };
    TraceIdRatioBasedSampler.prototype._normalize = function(ratio) {
        if (typeof ratio !== 'number' || isNaN(ratio)) return 0;
        return ratio >= 1 ? 1 : ratio <= 0 ? 0 : ratio;
    };
    TraceIdRatioBasedSampler.prototype._accumulate = function(traceId) {
        var accumulation = 0;
        for(var i = 0; i < traceId.length / 8; i++){
            var pos = i * 8;
            var part = parseInt(traceId.slice(pos, pos + 8), 16);
            accumulation = (accumulation ^ part) >>> 0;
        }
        return accumulation;
    };
    return TraceIdRatioBasedSampler;
}();
;
 //# sourceMappingURL=TraceIdRatioBasedSampler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/propagation/W3CBaggagePropagator.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "W3CBaggagePropagator": (()=>W3CBaggagePropagator)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/constants.js [app-rsc] (ecmascript)");
;
;
;
;
/**
 * Propagates {@link Baggage} through Context format propagation.
 *
 * Based on the Baggage specification:
 * https://w3c.github.io/baggage/
 */ var W3CBaggagePropagator = function() {
    function W3CBaggagePropagator() {}
    W3CBaggagePropagator.prototype.inject = function(context, carrier, setter) {
        var baggage = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["propagation"].getBaggage(context);
        if (!baggage || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTracingSuppressed"])(context)) return;
        var keyPairs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getKeyPairs"])(baggage).filter(function(pair) {
            return pair.length <= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_MAX_PER_NAME_VALUE_PAIRS"];
        }).slice(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_MAX_NAME_VALUE_PAIRS"]);
        var headerValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serializeKeyPairs"])(keyPairs);
        if (headerValue.length > 0) {
            setter.set(carrier, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_HEADER"], headerValue);
        }
    };
    W3CBaggagePropagator.prototype.extract = function(context, carrier, getter) {
        var headerValue = getter.get(carrier, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_HEADER"]);
        var baggageString = Array.isArray(headerValue) ? headerValue.join(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_ITEMS_SEPARATOR"]) : headerValue;
        if (!baggageString) return context;
        var baggage = {};
        if (baggageString.length === 0) {
            return context;
        }
        var pairs = baggageString.split(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_ITEMS_SEPARATOR"]);
        pairs.forEach(function(entry) {
            var keyPair = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parsePairKeyValue"])(entry);
            if (keyPair) {
                var baggageEntry = {
                    value: keyPair.value
                };
                if (keyPair.metadata) {
                    baggageEntry.metadata = keyPair.metadata;
                }
                baggage[keyPair.key] = baggageEntry;
            }
        });
        if (Object.entries(baggage).length === 0) {
            return context;
        }
        return __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["propagation"].setBaggage(context, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["propagation"].createBaggage(baggage));
    };
    W3CBaggagePropagator.prototype.fields = function() {
        return [
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BAGGAGE_HEADER"]
        ];
    };
    return W3CBaggagePropagator;
}();
;
 //# sourceMappingURL=W3CBaggagePropagator.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/globalThis.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /** only globals that common to node and browsers are allowed */ // eslint-disable-next-line node/no-unsupported-features/es-builtins
__turbopack_esm__({
    "_globalThis": (()=>_globalThis)
});
var _globalThis = typeof globalThis === 'object' ? globalThis : global; //# sourceMappingURL=globalThis.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/performance.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "otperformance": (()=>otperformance)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$perf_hooks$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (perf_hooks, cjs)");
;
var otperformance = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$perf_hooks$2c$__cjs$29$__["performance"]; //# sourceMappingURL=performance.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "addHrTimes": (()=>addHrTimes),
    "getTimeOrigin": (()=>getTimeOrigin),
    "hrTime": (()=>hrTime),
    "hrTimeDuration": (()=>hrTimeDuration),
    "hrTimeToMicroseconds": (()=>hrTimeToMicroseconds),
    "hrTimeToMilliseconds": (()=>hrTimeToMilliseconds),
    "hrTimeToNanoseconds": (()=>hrTimeToNanoseconds),
    "hrTimeToTimeStamp": (()=>hrTimeToTimeStamp),
    "isTimeInput": (()=>isTimeInput),
    "isTimeInputHrTime": (()=>isTimeInputHrTime),
    "millisToHrTime": (()=>millisToHrTime),
    "timeInputToHrTime": (()=>timeInputToHrTime)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/performance.js [app-rsc] (ecmascript)");
;
var NANOSECOND_DIGITS = 9;
var NANOSECOND_DIGITS_IN_MILLIS = 6;
var MILLISECONDS_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS_IN_MILLIS);
var SECOND_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS);
function millisToHrTime(epochMillis) {
    var epochSeconds = epochMillis / 1000;
    // Decimals only.
    var seconds = Math.trunc(epochSeconds);
    // Round sub-nanosecond accuracy to nanosecond.
    var nanos = Math.round(epochMillis % 1000 * MILLISECONDS_TO_NANOSECONDS);
    return [
        seconds,
        nanos
    ];
}
function getTimeOrigin() {
    var timeOrigin = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"].timeOrigin;
    if (typeof timeOrigin !== 'number') {
        var perf = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"];
        timeOrigin = perf.timing && perf.timing.fetchStart;
    }
    return timeOrigin;
}
function hrTime(performanceNow) {
    var timeOrigin = millisToHrTime(getTimeOrigin());
    var now = millisToHrTime(typeof performanceNow === 'number' ? performanceNow : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"].now());
    return addHrTimes(timeOrigin, now);
}
function timeInputToHrTime(time) {
    // process.hrtime
    if (isTimeInputHrTime(time)) {
        return time;
    } else if (typeof time === 'number') {
        // Must be a performance.now() if it's smaller than process start time.
        if (time < getTimeOrigin()) {
            return hrTime(time);
        } else {
            // epoch milliseconds or performance.timeOrigin
            return millisToHrTime(time);
        }
    } else if (time instanceof Date) {
        return millisToHrTime(time.getTime());
    } else {
        throw TypeError('Invalid input type');
    }
}
function hrTimeDuration(startTime, endTime) {
    var seconds = endTime[0] - startTime[0];
    var nanos = endTime[1] - startTime[1];
    // overflow
    if (nanos < 0) {
        seconds -= 1;
        // negate
        nanos += SECOND_TO_NANOSECONDS;
    }
    return [
        seconds,
        nanos
    ];
}
function hrTimeToTimeStamp(time) {
    var precision = NANOSECOND_DIGITS;
    var tmp = "" + '0'.repeat(precision) + time[1] + "Z";
    var nanoString = tmp.substr(tmp.length - precision - 1);
    var date = new Date(time[0] * 1000).toISOString();
    return date.replace('000Z', nanoString);
}
function hrTimeToNanoseconds(time) {
    return time[0] * SECOND_TO_NANOSECONDS + time[1];
}
function hrTimeToMilliseconds(time) {
    return time[0] * 1e3 + time[1] / 1e6;
}
function hrTimeToMicroseconds(time) {
    return time[0] * 1e6 + time[1] / 1e3;
}
function isTimeInputHrTime(value) {
    return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}
function isTimeInput(value) {
    return isTimeInputHrTime(value) || typeof value === 'number' || value instanceof Date;
}
function addHrTimes(time1, time2) {
    var out = [
        time1[0] + time2[0],
        time1[1] + time2[1]
    ];
    // Nanoseconds
    if (out[1] >= SECOND_TO_NANOSECONDS) {
        out[1] -= SECOND_TO_NANOSECONDS;
        out[0] += 1;
    }
    return out;
} //# sourceMappingURL=time.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "getEnv": (()=>getEnv),
    "getEnvWithoutDefaults": (()=>getEnvWithoutDefaults)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/environment.js [app-rsc] (ecmascript)");
;
function getEnv() {
    var processEnv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseEnvironment"])(process.env);
    return Object.assign({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ENVIRONMENT"], processEnv);
}
function getEnvWithoutDefaults() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseEnvironment"])(process.env);
} //# sourceMappingURL=environment.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/hex-to-binary.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "hexToBinary": (()=>hexToBinary)
});
function intValue(charCode) {
    // 0-9
    if (charCode >= 48 && charCode <= 57) {
        return charCode - 48;
    }
    // a-f
    if (charCode >= 97 && charCode <= 102) {
        return charCode - 87;
    }
    // A-F
    return charCode - 55;
}
function hexToBinary(hexStr) {
    var buf = new Uint8Array(hexStr.length / 2);
    var offset = 0;
    for(var i = 0; i < hexStr.length; i += 2){
        var hi = intValue(hexStr.charCodeAt(i));
        var lo = intValue(hexStr.charCodeAt(i + 1));
        buf[offset++] = hi << 4 | lo;
    }
    return buf;
} //# sourceMappingURL=hex-to-binary.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/hex-to-base64.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "hexToBase64": (()=>hexToBase64)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$hex$2d$to$2d$binary$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/hex-to-binary.js [app-rsc] (ecmascript)");
;
function hexToBase64(hexStr) {
    return Buffer.from((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$hex$2d$to$2d$binary$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hexToBinary"])(hexStr)).toString('base64');
} //# sourceMappingURL=hex-to-base64.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/attributes.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "isAttributeKey": (()=>isAttributeKey),
    "isAttributeValue": (()=>isAttributeValue),
    "sanitizeAttributes": (()=>sanitizeAttributes)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
function sanitizeAttributes(attributes) {
    var e_1, _a;
    var out = {};
    if (typeof attributes !== 'object' || attributes == null) {
        return out;
    }
    try {
        for(var _b = __values(Object.entries(attributes)), _c = _b.next(); !_c.done; _c = _b.next()){
            var _d = __read(_c.value, 2), key = _d[0], val = _d[1];
            if (!isAttributeKey(key)) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Invalid attribute key: " + key);
                continue;
            }
            if (!isAttributeValue(val)) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Invalid attribute value set for key: " + key);
                continue;
            }
            if (Array.isArray(val)) {
                out[key] = val.slice();
            } else {
                out[key] = val;
            }
        }
    } catch (e_1_1) {
        e_1 = {
            error: e_1_1
        };
    } finally{
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        } finally{
            if (e_1) throw e_1.error;
        }
    }
    return out;
}
function isAttributeKey(key) {
    return typeof key === 'string' && key.length > 0;
}
function isAttributeValue(val) {
    if (val == null) {
        return true;
    }
    if (Array.isArray(val)) {
        return isHomogeneousAttributeValueArray(val);
    }
    return isValidPrimitiveAttributeValue(val);
}
function isHomogeneousAttributeValueArray(arr) {
    var e_2, _a;
    var type;
    try {
        for(var arr_1 = __values(arr), arr_1_1 = arr_1.next(); !arr_1_1.done; arr_1_1 = arr_1.next()){
            var element = arr_1_1.value;
            // null/undefined elements are allowed
            if (element == null) continue;
            if (!type) {
                if (isValidPrimitiveAttributeValue(element)) {
                    type = typeof element;
                    continue;
                }
                // encountered an invalid primitive
                return false;
            }
            if (typeof element === type) {
                continue;
            }
            return false;
        }
    } catch (e_2_1) {
        e_2 = {
            error: e_2_1
        };
    } finally{
        try {
            if (arr_1_1 && !arr_1_1.done && (_a = arr_1.return)) _a.call(arr_1);
        } finally{
            if (e_2) throw e_2.error;
        }
    }
    return true;
}
function isValidPrimitiveAttributeValue(val) {
    switch(typeof val){
        case 'number':
        case 'boolean':
        case 'string':
            return true;
    }
    return false;
} //# sourceMappingURL=attributes.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/url.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isUrlIgnored": (()=>isUrlIgnored),
    "urlMatches": (()=>urlMatches)
});
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
function urlMatches(url, urlToMatch) {
    if (typeof urlToMatch === 'string') {
        return url === urlToMatch;
    } else {
        return !!url.match(urlToMatch);
    }
}
function isUrlIgnored(url, ignoredUrls) {
    var e_1, _a;
    if (!ignoredUrls) {
        return false;
    }
    try {
        for(var ignoredUrls_1 = __values(ignoredUrls), ignoredUrls_1_1 = ignoredUrls_1.next(); !ignoredUrls_1_1.done; ignoredUrls_1_1 = ignoredUrls_1.next()){
            var ignoreUrl = ignoredUrls_1_1.value;
            if (urlMatches(url, ignoreUrl)) {
                return true;
            }
        }
    } catch (e_1_1) {
        e_1 = {
            error: e_1_1
        };
    } finally{
        try {
            if (ignoredUrls_1_1 && !ignoredUrls_1_1.done && (_a = ignoredUrls_1.return)) _a.call(ignoredUrls_1);
        } finally{
            if (e_1) throw e_1.error;
        }
    }
    return false;
} //# sourceMappingURL=url.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/wrap.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * Checks if certain function has been already wrapped
 * @param func
 */ __turbopack_esm__({
    "isWrapped": (()=>isWrapped)
});
function isWrapped(func) {
    return typeof func === 'function' && typeof func.__original === 'function' && typeof func.__unwrap === 'function' && func.__wrapped === true;
} //# sourceMappingURL=wrap.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/lodash.merge.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /* eslint-disable @typescript-eslint/no-explicit-any */ /**
 * based on lodash in order to support esm builds without esModuleInterop.
 * lodash is using MIT License.
 **/ __turbopack_esm__({
    "isPlainObject": (()=>isPlainObject)
});
var objectTag = '[object Object]';
var nullTag = '[object Null]';
var undefinedTag = '[object Undefined]';
var funcProto = Function.prototype;
var funcToString = funcProto.toString;
var objectCtorString = funcToString.call(Object);
var getPrototype = overArg(Object.getPrototypeOf, Object);
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;
var nativeObjectToString = objectProto.toString;
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */ function overArg(func, transform) {
    return function(arg) {
        return func(transform(arg));
    };
}
function isPlainObject(value) {
    if (!isObjectLike(value) || baseGetTag(value) !== objectTag) {
        return false;
    }
    var proto = getPrototype(value);
    if (proto === null) {
        return true;
    }
    var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
    return typeof Ctor == 'function' && Ctor instanceof Ctor && funcToString.call(Ctor) === objectCtorString;
}
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */ function isObjectLike(value) {
    return value != null && typeof value == 'object';
}
/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */ function baseGetTag(value) {
    if (value == null) {
        return value === undefined ? undefinedTag : nullTag;
    }
    return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}
/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */ function getRawTag(value) {
    var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
    var unmasked = false;
    try {
        value[symToStringTag] = undefined;
        unmasked = true;
    } catch (e) {
    // silence
    }
    var result = nativeObjectToString.call(value);
    if (unmasked) {
        if (isOwn) {
            value[symToStringTag] = tag;
        } else {
            delete value[symToStringTag];
        }
    }
    return result;
}
/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */ function objectToString(value) {
    return nativeObjectToString.call(value);
} //# sourceMappingURL=lodash.merge.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/merge.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /* eslint-disable @typescript-eslint/no-explicit-any */ __turbopack_esm__({
    "merge": (()=>merge)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$lodash$2e$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/lodash.merge.js [app-rsc] (ecmascript)");
;
var MAX_LEVEL = 20;
function merge() {
    var args = [];
    for(var _i = 0; _i < arguments.length; _i++){
        args[_i] = arguments[_i];
    }
    var result = args.shift();
    var objects = new WeakMap();
    while(args.length > 0){
        result = mergeTwoObjects(result, args.shift(), 0, objects);
    }
    return result;
}
function takeValue(value) {
    if (isArray(value)) {
        return value.slice();
    }
    return value;
}
/**
 * Merges two objects
 * @param one - first object
 * @param two - second object
 * @param level - current deep level
 * @param objects - objects holder that has been already referenced - to prevent
 * cyclic dependency
 */ function mergeTwoObjects(one, two, level, objects) {
    if (level === void 0) {
        level = 0;
    }
    var result;
    if (level > MAX_LEVEL) {
        return undefined;
    }
    level++;
    if (isPrimitive(one) || isPrimitive(two) || isFunction(two)) {
        result = takeValue(two);
    } else if (isArray(one)) {
        result = one.slice();
        if (isArray(two)) {
            for(var i = 0, j = two.length; i < j; i++){
                result.push(takeValue(two[i]));
            }
        } else if (isObject(two)) {
            var keys = Object.keys(two);
            for(var i = 0, j = keys.length; i < j; i++){
                var key = keys[i];
                result[key] = takeValue(two[key]);
            }
        }
    } else if (isObject(one)) {
        if (isObject(two)) {
            if (!shouldMerge(one, two)) {
                return two;
            }
            result = Object.assign({}, one);
            var keys = Object.keys(two);
            for(var i = 0, j = keys.length; i < j; i++){
                var key = keys[i];
                var twoValue = two[key];
                if (isPrimitive(twoValue)) {
                    if (typeof twoValue === 'undefined') {
                        delete result[key];
                    } else {
                        // result[key] = takeValue(twoValue);
                        result[key] = twoValue;
                    }
                } else {
                    var obj1 = result[key];
                    var obj2 = twoValue;
                    if (wasObjectReferenced(one, key, objects) || wasObjectReferenced(two, key, objects)) {
                        delete result[key];
                    } else {
                        if (isObject(obj1) && isObject(obj2)) {
                            var arr1 = objects.get(obj1) || [];
                            var arr2 = objects.get(obj2) || [];
                            arr1.push({
                                obj: one,
                                key: key
                            });
                            arr2.push({
                                obj: two,
                                key: key
                            });
                            objects.set(obj1, arr1);
                            objects.set(obj2, arr2);
                        }
                        result[key] = mergeTwoObjects(result[key], twoValue, level, objects);
                    }
                }
            }
        } else {
            result = two;
        }
    }
    return result;
}
/**
 * Function to check if object has been already reference
 * @param obj
 * @param key
 * @param objects
 */ function wasObjectReferenced(obj, key, objects) {
    var arr = objects.get(obj[key]) || [];
    for(var i = 0, j = arr.length; i < j; i++){
        var info = arr[i];
        if (info.key === key && info.obj === obj) {
            return true;
        }
    }
    return false;
}
function isArray(value) {
    return Array.isArray(value);
}
function isFunction(value) {
    return typeof value === 'function';
}
function isObject(value) {
    return !isPrimitive(value) && !isArray(value) && !isFunction(value) && typeof value === 'object';
}
function isPrimitive(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'undefined' || value instanceof Date || value instanceof RegExp || value === null;
}
function shouldMerge(one, two) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$lodash$2e$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isPlainObject"])(one) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$lodash$2e$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isPlainObject"])(two)) {
        return false;
    }
    return true;
} //# sourceMappingURL=merge.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/timer-util.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "unrefTimer": (()=>unrefTimer)
});
function unrefTimer(timer) {
    timer.unref();
} //# sourceMappingURL=timer-util.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AlwaysOffSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]),
    "AlwaysOnSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]),
    "AnchoredClock": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$anchored$2d$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AnchoredClock"]),
    "BindOnceFuture": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BindOnceFuture"]),
    "CompositePropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$propagation$2f$composite$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompositePropagator"]),
    "DEFAULT_ATTRIBUTE_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ATTRIBUTE_COUNT_LIMIT"]),
    "DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT"]),
    "DEFAULT_ENVIRONMENT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ENVIRONMENT"]),
    "DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT"]),
    "DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT"]),
    "ExportResultCode": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"]),
    "ParentBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ParentBasedSampler"]),
    "RPCType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$rpc$2d$metadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["RPCType"]),
    "RandomIdGenerator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["RandomIdGenerator"]),
    "SDK_INFO": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$sdk$2d$info$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SDK_INFO"]),
    "TRACE_PARENT_HEADER": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TRACE_PARENT_HEADER"]),
    "TRACE_STATE_HEADER": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TRACE_STATE_HEADER"]),
    "TimeoutError": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$timeout$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TimeoutError"]),
    "TraceIdRatioBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceIdRatioBasedSampler"]),
    "TraceState": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$TraceState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceState"]),
    "TracesSamplerValues": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"]),
    "VERSION": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$version$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["VERSION"]),
    "W3CBaggagePropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$propagation$2f$W3CBaggagePropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["W3CBaggagePropagator"]),
    "W3CTraceContextPropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["W3CTraceContextPropagator"]),
    "_globalThis": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$globalThis$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_globalThis"]),
    "addHrTimes": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addHrTimes"]),
    "baggageUtils": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["baggageUtils"]),
    "callWithTimeout": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$timeout$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"]),
    "deleteRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$rpc$2d$metadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deleteRPCMetadata"]),
    "getEnv": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"]),
    "getEnvWithoutDefaults": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnvWithoutDefaults"]),
    "getRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$rpc$2d$metadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRPCMetadata"]),
    "getTimeOrigin": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getTimeOrigin"]),
    "globalErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"]),
    "hexToBase64": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$hex$2d$to$2d$base64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hexToBase64"]),
    "hexToBinary": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$hex$2d$to$2d$binary$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hexToBinary"]),
    "hrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTime"]),
    "hrTimeDuration": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeDuration"]),
    "hrTimeToMicroseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"]),
    "hrTimeToMilliseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMilliseconds"]),
    "hrTimeToNanoseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToNanoseconds"]),
    "hrTimeToTimeStamp": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToTimeStamp"]),
    "internal": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["internal"]),
    "isAttributeKey": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAttributeKey"]),
    "isAttributeValue": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAttributeValue"]),
    "isTimeInput": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTimeInput"]),
    "isTimeInputHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTimeInputHrTime"]),
    "isTracingSuppressed": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTracingSuppressed"]),
    "isUrlIgnored": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$url$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isUrlIgnored"]),
    "isWrapped": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$wrap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isWrapped"]),
    "loggingErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$logging$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loggingErrorHandler"]),
    "merge": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["merge"]),
    "millisToHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"]),
    "otperformance": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"]),
    "parseEnvironment": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseEnvironment"]),
    "parseTraceParent": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseTraceParent"]),
    "sanitizeAttributes": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeAttributes"]),
    "setGlobalErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setGlobalErrorHandler"]),
    "setRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$rpc$2d$metadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setRPCMetadata"]),
    "suppressTracing": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["suppressTracing"]),
    "timeInputToHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["timeInputToHrTime"]),
    "unrefTimer": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unrefTimer"]),
    "unsuppressTracing": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unsuppressTracing"]),
    "urlMatches": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$url$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["urlMatches"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$anchored$2d$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/anchored-clock.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/callback.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$propagation$2f$composite$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/propagation/composite.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/ParentBasedSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$rpc$2d$metadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/rpc-metadata.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/RandomIdGenerator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$sdk$2d$info$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/sdk-info.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/W3CTraceContextPropagator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$timeout$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/timeout.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/sampler/TraceIdRatioBasedSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$TraceState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/TraceState.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/sampling.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$version$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/version.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$propagation$2f$W3CBaggagePropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/propagation/W3CBaggagePropagator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$globalThis$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/globalThis.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$hex$2d$to$2d$base64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/hex-to-base64.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$hex$2d$to$2d$binary$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/hex-to-binary.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/attributes.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$url$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/url.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$wrap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/wrap.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$logging$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/logging-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/merge.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/performance.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/timer-util.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AlwaysOffSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AlwaysOffSampler"]),
    "AlwaysOnSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AlwaysOnSampler"]),
    "AnchoredClock": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AnchoredClock"]),
    "BindOnceFuture": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["BindOnceFuture"]),
    "CompositePropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["CompositePropagator"]),
    "DEFAULT_ATTRIBUTE_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_ATTRIBUTE_COUNT_LIMIT"]),
    "DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT"]),
    "DEFAULT_ENVIRONMENT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_ENVIRONMENT"]),
    "DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT"]),
    "DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT"]),
    "ExportResultCode": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ExportResultCode"]),
    "ParentBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ParentBasedSampler"]),
    "RPCType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["RPCType"]),
    "RandomIdGenerator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["RandomIdGenerator"]),
    "SDK_INFO": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["SDK_INFO"]),
    "TRACE_PARENT_HEADER": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TRACE_PARENT_HEADER"]),
    "TRACE_STATE_HEADER": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TRACE_STATE_HEADER"]),
    "TimeoutError": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TimeoutError"]),
    "TraceIdRatioBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TraceIdRatioBasedSampler"]),
    "TraceState": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TraceState"]),
    "TracesSamplerValues": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TracesSamplerValues"]),
    "VERSION": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["VERSION"]),
    "W3CBaggagePropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["W3CBaggagePropagator"]),
    "W3CTraceContextPropagator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["W3CTraceContextPropagator"]),
    "_globalThis": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["_globalThis"]),
    "addHrTimes": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["addHrTimes"]),
    "baggageUtils": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["baggageUtils"]),
    "callWithTimeout": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["callWithTimeout"]),
    "deleteRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["deleteRPCMetadata"]),
    "getEnv": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["getEnv"]),
    "getEnvWithoutDefaults": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["getEnvWithoutDefaults"]),
    "getRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["getRPCMetadata"]),
    "getTimeOrigin": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["getTimeOrigin"]),
    "globalErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["globalErrorHandler"]),
    "hexToBase64": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hexToBase64"]),
    "hexToBinary": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hexToBinary"]),
    "hrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTime"]),
    "hrTimeDuration": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTimeDuration"]),
    "hrTimeToMicroseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTimeToMicroseconds"]),
    "hrTimeToMilliseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTimeToMilliseconds"]),
    "hrTimeToNanoseconds": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTimeToNanoseconds"]),
    "hrTimeToTimeStamp": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["hrTimeToTimeStamp"]),
    "internal": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["internal"]),
    "isAttributeKey": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isAttributeKey"]),
    "isAttributeValue": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isAttributeValue"]),
    "isTimeInput": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isTimeInput"]),
    "isTimeInputHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isTimeInputHrTime"]),
    "isTracingSuppressed": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isTracingSuppressed"]),
    "isUrlIgnored": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isUrlIgnored"]),
    "isWrapped": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isWrapped"]),
    "loggingErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["loggingErrorHandler"]),
    "merge": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["merge"]),
    "millisToHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["millisToHrTime"]),
    "otperformance": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["otperformance"]),
    "parseEnvironment": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["parseEnvironment"]),
    "parseTraceParent": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["parseTraceParent"]),
    "sanitizeAttributes": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["sanitizeAttributes"]),
    "setGlobalErrorHandler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["setGlobalErrorHandler"]),
    "setRPCMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["setRPCMetadata"]),
    "suppressTracing": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["suppressTracing"]),
    "timeInputToHrTime": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["timeInputToHrTime"]),
    "unrefTimer": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["unrefTimer"]),
    "unsuppressTracing": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["unsuppressTracing"]),
    "urlMatches": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["urlMatches"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=6639c_%40opentelemetry_core_build_esm_090536._.js.map