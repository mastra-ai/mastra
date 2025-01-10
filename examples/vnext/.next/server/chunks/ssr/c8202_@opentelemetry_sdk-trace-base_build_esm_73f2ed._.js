module.exports = {

"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
 * A sampling decision that determines how a {@link Span} will be recorded
 * and collected.
 */ __turbopack_esm__({
    "SamplingDecision": (()=>SamplingDecision)
});
var SamplingDecision;
(function(SamplingDecision) {
    /**
     * `Span.isRecording() === false`, span will not be recorded and all events
     * and attributes will be dropped.
     */ SamplingDecision[SamplingDecision["NOT_RECORD"] = 0] = "NOT_RECORD";
    /**
     * `Span.isRecording() === true`, but `Sampled` flag in {@link TraceFlags}
     * MUST NOT be set.
     */ SamplingDecision[SamplingDecision["RECORD"] = 1] = "RECORD";
    /**
     * `Span.isRecording() === true` AND `Sampled` flag in {@link TraceFlags}
     * MUST be set.
     */ SamplingDecision[SamplingDecision["RECORD_AND_SAMPLED"] = 2] = "RECORD_AND_SAMPLED";
})(SamplingDecision || (SamplingDecision = {})); //# sourceMappingURL=Sampler.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/TraceIdRatioBasedSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js [app-rsc] (ecmascript)");
;
;
/** Sampler that samples a given fraction of traces based of trace id deterministically. */ var TraceIdRatioBasedSampler = function() {
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
            decision: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["isValidTraceId"])(traceId) && this._accumulate(traceId) < this._upperBound ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SamplingDecision"].RECORD_AND_SAMPLED : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SamplingDecision"].NOT_RECORD
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
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js [app-rsc] (ecmascript)");
;
/** Sampler that samples all traces. */ var AlwaysOnSampler = function() {
    function AlwaysOnSampler() {}
    AlwaysOnSampler.prototype.shouldSample = function() {
        return {
            decision: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SamplingDecision"].RECORD_AND_SAMPLED
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
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js [app-rsc] (ecmascript)");
;
/** Sampler that samples no traces. */ var AlwaysOffSampler = function() {
    function AlwaysOffSampler() {}
    AlwaysOffSampler.prototype.shouldSample = function() {
        return {
            decision: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SamplingDecision"].NOT_RECORD
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
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/ParentBasedSampler.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)");
;
;
;
;
/**
 * A composite sampler that either respects the parent span's sampling decision
 * or delegates to `delegateSampler` for root spans.
 */ var ParentBasedSampler = function() {
    function ParentBasedSampler(config) {
        var _a, _b, _c, _d;
        this._root = config.root;
        if (!this._root) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(new Error('ParentBasedSampler must have a root sampler configured'));
            this._root = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        }
        this._remoteParentSampled = (_a = config.remoteParentSampled) !== null && _a !== void 0 ? _a : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        this._remoteParentNotSampled = (_b = config.remoteParentNotSampled) !== null && _b !== void 0 ? _b : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]();
        this._localParentSampled = (_c = config.localParentSampled) !== null && _c !== void 0 ? _c : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        this._localParentNotSampled = (_d = config.localParentNotSampled) !== null && _d !== void 0 ? _d : new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]();
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
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/ConsoleSpanExporter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "ConsoleSpanExporter": (()=>ConsoleSpanExporter)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
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
/**
 * This is implementation of {@link SpanExporter} that prints spans to the
 * console. This class can be used for diagnostic purposes.
 *
 * NOTE: This {@link SpanExporter} is intended for diagnostics use only, output rendered to the console may change at any time.
 */ /* eslint-disable no-console */ var ConsoleSpanExporter = function() {
    function ConsoleSpanExporter() {}
    /**
     * Export spans.
     * @param spans
     * @param resultCallback
     */ ConsoleSpanExporter.prototype.export = function(spans, resultCallback) {
        return this._sendSpans(spans, resultCallback);
    };
    /**
     * Shutdown the exporter.
     */ ConsoleSpanExporter.prototype.shutdown = function() {
        this._sendSpans([]);
        return this.forceFlush();
    };
    /**
     * Exports any pending spans in exporter
     */ ConsoleSpanExporter.prototype.forceFlush = function() {
        return Promise.resolve();
    };
    /**
     * converts span info into more readable format
     * @param span
     */ ConsoleSpanExporter.prototype._exportInfo = function(span) {
        var _a;
        return {
            resource: {
                attributes: span.resource.attributes
            },
            instrumentationScope: span.instrumentationLibrary,
            traceId: span.spanContext().traceId,
            parentId: span.parentSpanId,
            traceState: (_a = span.spanContext().traceState) === null || _a === void 0 ? void 0 : _a.serialize(),
            name: span.name,
            id: span.spanContext().spanId,
            kind: span.kind,
            timestamp: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(span.startTime),
            duration: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(span.duration),
            attributes: span.attributes,
            status: span.status,
            events: span.events,
            links: span.links
        };
    };
    /**
     * Showing spans in console
     * @param spans
     * @param done
     */ ConsoleSpanExporter.prototype._sendSpans = function(spans, done) {
        var e_1, _a;
        try {
            for(var spans_1 = __values(spans), spans_1_1 = spans_1.next(); !spans_1_1.done; spans_1_1 = spans_1.next()){
                var span = spans_1_1.value;
                console.dir(this._exportInfo(span), {
                    depth: 3
                });
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (spans_1_1 && !spans_1_1.done && (_a = spans_1.return)) _a.call(spans_1);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
        if (done) {
            return done({
                code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS
            });
        }
    };
    return ConsoleSpanExporter;
}();
;
 //# sourceMappingURL=ConsoleSpanExporter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
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
 */ __turbopack_esm__({});
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
 //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/enums.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
 */ // Event name definitions
__turbopack_esm__({
    "ExceptionEventName": (()=>ExceptionEventName)
});
var ExceptionEventName = 'exception'; //# sourceMappingURL=enums.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Span.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "Span": (()=>Span)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/attributes.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/performance.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+semantic-conventions@1.27.0/node_modules/@opentelemetry/semantic-conventions/build/esm/trace/SemanticAttributes.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$enums$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/enums.js [app-rsc] (ecmascript)");
var __assign = this && this.__assign || function() {
    __assign = Object.assign || function(t) {
        for(var s, i = 1, n = arguments.length; i < n; i++){
            s = arguments[i];
            for(var p in s)if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
;
;
;
/**
 * This class represents a span.
 */ var Span = function() {
    /**
     * Constructs a new Span instance.
     *
     * @deprecated calling Span constructor directly is not supported. Please use tracer.startSpan.
     * */ function Span(parentTracer, context, spanName, spanContext, kind, parentSpanId, links, startTime, _deprecatedClock, attributes) {
        if (links === void 0) {
            links = [];
        }
        this.attributes = {};
        this.links = [];
        this.events = [];
        this._droppedAttributesCount = 0;
        this._droppedEventsCount = 0;
        this._droppedLinksCount = 0;
        this.status = {
            code: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SpanStatusCode"].UNSET
        };
        this.endTime = [
            0,
            0
        ];
        this._ended = false;
        this._duration = [
            -1,
            -1
        ];
        this.name = spanName;
        this._spanContext = spanContext;
        this.parentSpanId = parentSpanId;
        this.kind = kind;
        this.links = links;
        var now = Date.now();
        this._performanceStartTime = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"].now();
        this._performanceOffset = now - (this._performanceStartTime + (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getTimeOrigin"])());
        this._startTimeProvided = startTime != null;
        this.startTime = this._getTime(startTime !== null && startTime !== void 0 ? startTime : now);
        this.resource = parentTracer.resource;
        this.instrumentationLibrary = parentTracer.instrumentationLibrary;
        this._spanLimits = parentTracer.getSpanLimits();
        this._attributeValueLengthLimit = this._spanLimits.attributeValueLengthLimit || 0;
        if (attributes != null) {
            this.setAttributes(attributes);
        }
        this._spanProcessor = parentTracer.getActiveSpanProcessor();
        this._spanProcessor.onStart(this, context);
    }
    Span.prototype.spanContext = function() {
        return this._spanContext;
    };
    Span.prototype.setAttribute = function(key, value) {
        if (value == null || this._isSpanEnded()) return this;
        if (key.length === 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Invalid attribute key: " + key);
            return this;
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAttributeValue"])(value)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Invalid attribute value set for key: " + key);
            return this;
        }
        if (Object.keys(this.attributes).length >= this._spanLimits.attributeCountLimit && !Object.prototype.hasOwnProperty.call(this.attributes, key)) {
            this._droppedAttributesCount++;
            return this;
        }
        this.attributes[key] = this._truncateToSize(value);
        return this;
    };
    Span.prototype.setAttributes = function(attributes) {
        var e_1, _a;
        try {
            for(var _b = __values(Object.entries(attributes)), _c = _b.next(); !_c.done; _c = _b.next()){
                var _d = __read(_c.value, 2), k = _d[0], v = _d[1];
                this.setAttribute(k, v);
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
        return this;
    };
    /**
     *
     * @param name Span Name
     * @param [attributesOrStartTime] Span attributes or start time
     *     if type is {@type TimeInput} and 3rd param is undefined
     * @param [timeStamp] Specified time stamp for the event
     */ Span.prototype.addEvent = function(name, attributesOrStartTime, timeStamp) {
        if (this._isSpanEnded()) return this;
        if (this._spanLimits.eventCountLimit === 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('No events allowed.');
            this._droppedEventsCount++;
            return this;
        }
        if (this.events.length >= this._spanLimits.eventCountLimit) {
            if (this._droppedEventsCount === 0) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].debug('Dropping extra events.');
            }
            this.events.shift();
            this._droppedEventsCount++;
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTimeInput"])(attributesOrStartTime)) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTimeInput"])(timeStamp)) {
                timeStamp = attributesOrStartTime;
            }
            attributesOrStartTime = undefined;
        }
        var attributes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeAttributes"])(attributesOrStartTime);
        this.events.push({
            name: name,
            attributes: attributes,
            time: this._getTime(timeStamp),
            droppedAttributesCount: 0
        });
        return this;
    };
    Span.prototype.addLink = function(link) {
        this.links.push(link);
        return this;
    };
    Span.prototype.addLinks = function(links) {
        var _a;
        (_a = this.links).push.apply(_a, __spreadArray([], __read(links), false));
        return this;
    };
    Span.prototype.setStatus = function(status) {
        if (this._isSpanEnded()) return this;
        this.status = __assign({}, status);
        // When using try-catch, the caught "error" is of type `any`. When then assigning `any` to `status.message`,
        // TypeScript will not error. While this can happen during use of any API, it is more common on Span#setStatus()
        // as it's likely used in a catch-block. Therefore, we validate if `status.message` is actually a string, null, or
        // undefined to avoid an incorrect type causing issues downstream.
        if (this.status.message != null && typeof status.message !== 'string') {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Dropping invalid status.message of type '" + typeof status.message + "', expected 'string'");
            delete this.status.message;
        }
        return this;
    };
    Span.prototype.updateName = function(name) {
        if (this._isSpanEnded()) return this;
        this.name = name;
        return this;
    };
    Span.prototype.end = function(endTime) {
        if (this._isSpanEnded()) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error(this.name + " " + this._spanContext.traceId + "-" + this._spanContext.spanId + " - You can only call end() on a span once.");
            return;
        }
        this._ended = true;
        this.endTime = this._getTime(endTime);
        this._duration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeDuration"])(this.startTime, this.endTime);
        if (this._duration[0] < 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('Inconsistent start and end time, startTime > endTime. Setting span duration to 0ms.', this.startTime, this.endTime);
            this.endTime = this.startTime.slice();
            this._duration = [
                0,
                0
            ];
        }
        if (this._droppedEventsCount > 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Dropped " + this._droppedEventsCount + " events because eventCountLimit reached");
        }
        this._spanProcessor.onEnd(this);
    };
    Span.prototype._getTime = function(inp) {
        if (typeof inp === 'number' && inp <= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"].now()) {
            // must be a performance timestamp
            // apply correction and convert to hrtime
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTime"])(inp + this._performanceOffset);
        }
        if (typeof inp === 'number') {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(inp);
        }
        if (inp instanceof Date) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(inp.getTime());
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTimeInputHrTime"])(inp)) {
            return inp;
        }
        if (this._startTimeProvided) {
            // if user provided a time for the start manually
            // we can't use duration to calculate event/end times
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(Date.now());
        }
        var msDuration = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$performance$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["otperformance"].now() - this._performanceStartTime;
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addHrTimes"])(this.startTime, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(msDuration));
    };
    Span.prototype.isRecording = function() {
        return this._ended === false;
    };
    Span.prototype.recordException = function(exception, time) {
        var attributes = {};
        if (typeof exception === 'string') {
            attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_MESSAGE"]] = exception;
        } else if (exception) {
            if (exception.code) {
                attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_TYPE"]] = exception.code.toString();
            } else if (exception.name) {
                attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_TYPE"]] = exception.name;
            }
            if (exception.message) {
                attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_MESSAGE"]] = exception.message;
            }
            if (exception.stack) {
                attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_STACKTRACE"]] = exception.stack;
            }
        }
        // these are minimum requirements from spec
        if (attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_TYPE"]] || attributes[__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$semantic$2d$conventions$40$1$2e$27$2e$0$2f$node_modules$2f40$opentelemetry$2f$semantic$2d$conventions$2f$build$2f$esm$2f$trace$2f$SemanticAttributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEMATTRS_EXCEPTION_MESSAGE"]]) {
            this.addEvent(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$enums$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExceptionEventName"], attributes, time);
        } else {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Failed to record an exception " + exception);
        }
    };
    Object.defineProperty(Span.prototype, "duration", {
        get: function() {
            return this._duration;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Span.prototype, "ended", {
        get: function() {
            return this._ended;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Span.prototype, "droppedAttributesCount", {
        get: function() {
            return this._droppedAttributesCount;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Span.prototype, "droppedEventsCount", {
        get: function() {
            return this._droppedEventsCount;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Span.prototype, "droppedLinksCount", {
        get: function() {
            return this._droppedLinksCount;
        },
        enumerable: false,
        configurable: true
    });
    Span.prototype._isSpanEnded = function() {
        if (this._ended) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Can not execute the operation on ended Span {traceId: " + this._spanContext.traceId + ", spanId: " + this._spanContext.spanId + "}");
        }
        return this._ended;
    };
    // Utility function to truncate given value within size
    // for value type of string, will truncate to given limit
    // for type of non-string, will return same value
    Span.prototype._truncateToLimitUtil = function(value, limit) {
        if (value.length <= limit) {
            return value;
        }
        return value.substr(0, limit);
    };
    /**
     * If the given attribute value is of type string and has more characters than given {@code attributeValueLengthLimit} then
     * return string with truncated to {@code attributeValueLengthLimit} characters
     *
     * If the given attribute value is array of strings then
     * return new array of strings with each element truncated to {@code attributeValueLengthLimit} characters
     *
     * Otherwise return same Attribute {@code value}
     *
     * @param value Attribute value
     * @returns truncated attribute value if required, otherwise same value
     */ Span.prototype._truncateToSize = function(value) {
        var _this = this;
        var limit = this._attributeValueLengthLimit;
        // Check limit
        if (limit <= 0) {
            // Negative values are invalid, so do not truncate
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Attribute value limit must be positive, got " + limit);
            return value;
        }
        // String
        if (typeof value === 'string') {
            return this._truncateToLimitUtil(value, limit);
        }
        // Array of strings
        if (Array.isArray(value)) {
            return value.map(function(val) {
                return typeof val === 'string' ? _this._truncateToLimitUtil(val, limit) : val;
            });
        }
        // Other types, no need to apply value length limit
        return value;
    };
    return Span;
}();
;
 //# sourceMappingURL=Span.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/config.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "buildSamplerFromEnv": (()=>buildSamplerFromEnv),
    "loadDefaultConfig": (()=>loadDefaultConfig)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/sampling.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/ParentBasedSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/TraceIdRatioBasedSampler.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
var env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])();
var FALLBACK_OTEL_TRACES_SAMPLER = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].AlwaysOn;
var DEFAULT_RATIO = 1;
function loadDefaultConfig() {
    var _env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])();
    return {
        sampler: buildSamplerFromEnv(env),
        forceFlushTimeoutMillis: 30000,
        generalLimits: {
            attributeValueLengthLimit: _env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT,
            attributeCountLimit: _env.OTEL_ATTRIBUTE_COUNT_LIMIT
        },
        spanLimits: {
            attributeValueLengthLimit: _env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT,
            attributeCountLimit: _env.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT,
            linkCountLimit: _env.OTEL_SPAN_LINK_COUNT_LIMIT,
            eventCountLimit: _env.OTEL_SPAN_EVENT_COUNT_LIMIT,
            attributePerEventCountLimit: _env.OTEL_SPAN_ATTRIBUTE_PER_EVENT_COUNT_LIMIT,
            attributePerLinkCountLimit: _env.OTEL_SPAN_ATTRIBUTE_PER_LINK_COUNT_LIMIT
        },
        mergeResourceWithDefaults: true
    };
}
function buildSamplerFromEnv(environment) {
    if (environment === void 0) {
        environment = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])();
    }
    switch(environment.OTEL_TRACES_SAMPLER){
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].AlwaysOn:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].AlwaysOff:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]();
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].ParentBasedAlwaysOn:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ParentBasedSampler"]({
                root: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]()
            });
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].ParentBasedAlwaysOff:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ParentBasedSampler"]({
                root: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]()
            });
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].TraceIdRatio:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceIdRatioBasedSampler"](getSamplerProbabilityFromEnv(environment));
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$sampling$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TracesSamplerValues"].ParentBasedTraceIdRatio:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ParentBasedSampler"]({
                root: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceIdRatioBasedSampler"](getSamplerProbabilityFromEnv(environment))
            });
        default:
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error("OTEL_TRACES_SAMPLER value \"" + environment.OTEL_TRACES_SAMPLER + " invalid, defaulting to " + FALLBACK_OTEL_TRACES_SAMPLER + "\".");
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]();
    }
}
function getSamplerProbabilityFromEnv(environment) {
    if (environment.OTEL_TRACES_SAMPLER_ARG === undefined || environment.OTEL_TRACES_SAMPLER_ARG === '') {
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error("OTEL_TRACES_SAMPLER_ARG is blank, defaulting to " + DEFAULT_RATIO + ".");
        return DEFAULT_RATIO;
    }
    var probability = Number(environment.OTEL_TRACES_SAMPLER_ARG);
    if (isNaN(probability)) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error("OTEL_TRACES_SAMPLER_ARG=" + environment.OTEL_TRACES_SAMPLER_ARG + " was given, but it is invalid, defaulting to " + DEFAULT_RATIO + ".");
        return DEFAULT_RATIO;
    }
    if (probability < 0 || probability > 1) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error("OTEL_TRACES_SAMPLER_ARG=" + environment.OTEL_TRACES_SAMPLER_ARG + " was given, but it is out of range ([0..1]), defaulting to " + DEFAULT_RATIO + ".");
        return DEFAULT_RATIO;
    }
    return probability;
} //# sourceMappingURL=config.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/utility.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "mergeConfig": (()=>mergeConfig),
    "reconfigureLimits": (()=>reconfigureLimits)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/environment.js [app-rsc] (ecmascript)");
;
;
function mergeConfig(userConfig) {
    var perInstanceDefaults = {
        sampler: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["buildSamplerFromEnv"])()
    };
    var DEFAULT_CONFIG = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadDefaultConfig"])();
    var target = Object.assign({}, DEFAULT_CONFIG, perInstanceDefaults, userConfig);
    target.generalLimits = Object.assign({}, DEFAULT_CONFIG.generalLimits, userConfig.generalLimits || {});
    target.spanLimits = Object.assign({}, DEFAULT_CONFIG.spanLimits, userConfig.spanLimits || {});
    return target;
}
function reconfigureLimits(userConfig) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var spanLimits = Object.assign({}, userConfig.spanLimits);
    var parsedEnvConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnvWithoutDefaults"])();
    /**
     * Reassign span attribute count limit to use first non null value defined by user or use default value
     */ spanLimits.attributeCountLimit = (_f = (_e = (_d = (_b = (_a = userConfig.spanLimits) === null || _a === void 0 ? void 0 : _a.attributeCountLimit) !== null && _b !== void 0 ? _b : (_c = userConfig.generalLimits) === null || _c === void 0 ? void 0 : _c.attributeCountLimit) !== null && _d !== void 0 ? _d : parsedEnvConfig.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT) !== null && _e !== void 0 ? _e : parsedEnvConfig.OTEL_ATTRIBUTE_COUNT_LIMIT) !== null && _f !== void 0 ? _f : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ATTRIBUTE_COUNT_LIMIT"];
    /**
     * Reassign span attribute value length limit to use first non null value defined by user or use default value
     */ spanLimits.attributeValueLengthLimit = (_m = (_l = (_k = (_h = (_g = userConfig.spanLimits) === null || _g === void 0 ? void 0 : _g.attributeValueLengthLimit) !== null && _h !== void 0 ? _h : (_j = userConfig.generalLimits) === null || _j === void 0 ? void 0 : _j.attributeValueLengthLimit) !== null && _k !== void 0 ? _k : parsedEnvConfig.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT) !== null && _l !== void 0 ? _l : parsedEnvConfig.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) !== null && _m !== void 0 ? _m : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT"];
    return Object.assign({}, userConfig, {
        spanLimits: spanLimits
    });
} //# sourceMappingURL=utility.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/RandomIdGenerator.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
var RandomIdGenerator = function() {
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
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Tracer.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "Tracer": (()=>Tracer)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/attributes.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Span$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Span.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$utility$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/utility.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/RandomIdGenerator.js [app-rsc] (ecmascript)");
;
;
;
;
;
/**
 * This class represents a basic tracer.
 */ var Tracer = function() {
    /**
     * Constructs a new Tracer instance.
     */ function Tracer(instrumentationLibrary, config, _tracerProvider) {
        this._tracerProvider = _tracerProvider;
        var localConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$utility$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mergeConfig"])(config);
        this._sampler = localConfig.sampler;
        this._generalLimits = localConfig.generalLimits;
        this._spanLimits = localConfig.spanLimits;
        this._idGenerator = config.idGenerator || new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["RandomIdGenerator"]();
        this.resource = _tracerProvider.resource;
        this.instrumentationLibrary = instrumentationLibrary;
    }
    /**
     * Starts a new Span or returns the default NoopSpan based on the sampling
     * decision.
     */ Tracer.prototype.startSpan = function(name, options, context) {
        var _a, _b, _c;
        if (options === void 0) {
            options = {};
        }
        if (context === void 0) {
            context = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.context.active();
        }
        // remove span from context in case a root span is requested via options
        if (options.root) {
            context = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.deleteSpan(context);
        }
        var parentSpan = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.getSpan(context);
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isTracingSuppressed"])(context)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.debug('Instrumentation suppressed, returning Noop Span');
            var nonRecordingSpan = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.wrapSpanContext(__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.INVALID_SPAN_CONTEXT);
            return nonRecordingSpan;
        }
        var parentSpanContext = parentSpan === null || parentSpan === void 0 ? void 0 : parentSpan.spanContext();
        var spanId = this._idGenerator.generateSpanId();
        var traceId;
        var traceState;
        var parentSpanId;
        if (!parentSpanContext || !__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.isSpanContextValid(parentSpanContext)) {
            // New root span.
            traceId = this._idGenerator.generateTraceId();
        } else {
            // New child span.
            traceId = parentSpanContext.traceId;
            traceState = parentSpanContext.traceState;
            parentSpanId = parentSpanContext.spanId;
        }
        var spanKind = (_a = options.kind) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.SpanKind.INTERNAL;
        var links = ((_b = options.links) !== null && _b !== void 0 ? _b : []).map(function(link) {
            return {
                context: link.context,
                attributes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeAttributes"])(link.attributes)
            };
        });
        var attributes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeAttributes"])(options.attributes);
        // make sampling decision
        var samplingResult = this._sampler.shouldSample(context, traceId, name, spanKind, attributes, links);
        traceState = (_c = samplingResult.traceState) !== null && _c !== void 0 ? _c : traceState;
        var traceFlags = samplingResult.decision === __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.SamplingDecision.RECORD_AND_SAMPLED ? __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.TraceFlags.SAMPLED : __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.TraceFlags.NONE;
        var spanContext = {
            traceId: traceId,
            spanId: spanId,
            traceFlags: traceFlags,
            traceState: traceState
        };
        if (samplingResult.decision === __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.SamplingDecision.NOT_RECORD) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.debug('Recording is off, propagating context in a non-recording span');
            var nonRecordingSpan = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.wrapSpanContext(spanContext);
            return nonRecordingSpan;
        }
        // Set initial span attributes. The attributes object may have been mutated
        // by the sampler, so we sanitize the merged attributes before setting them.
        var initAttributes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$attributes$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeAttributes"])(Object.assign(attributes, samplingResult.attributes));
        var span = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Span$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Span"](this, context, name, spanContext, spanKind, parentSpanId, links, options.startTime, undefined, initAttributes);
        return span;
    };
    Tracer.prototype.startActiveSpan = function(name, arg2, arg3, arg4) {
        var opts;
        var ctx;
        var fn;
        if (arguments.length < 2) {
            return;
        } else if (arguments.length === 2) {
            fn = arg2;
        } else if (arguments.length === 3) {
            opts = arg2;
            fn = arg3;
        } else {
            opts = arg2;
            ctx = arg3;
            fn = arg4;
        }
        var parentContext = ctx !== null && ctx !== void 0 ? ctx : __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.context.active();
        var span = this.startSpan(name, opts, parentContext);
        var contextWithSpanSet = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.trace.setSpan(parentContext, span);
        return __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.context.with(contextWithSpanSet, fn, undefined, span);
    };
    /** Returns the active {@link GeneralLimits}. */ Tracer.prototype.getGeneralLimits = function() {
        return this._generalLimits;
    };
    /** Returns the active {@link SpanLimits}. */ Tracer.prototype.getSpanLimits = function() {
        return this._spanLimits;
    };
    Tracer.prototype.getActiveSpanProcessor = function() {
        return this._tracerProvider.getActiveSpanProcessor();
    };
    return Tracer;
}();
;
 //# sourceMappingURL=Tracer.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/MultiSpanProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "MultiSpanProcessor": (()=>MultiSpanProcessor)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
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
/**
 * Implementation of the {@link SpanProcessor} that simply forwards all
 * received events to a list of {@link SpanProcessor}s.
 */ var MultiSpanProcessor = function() {
    function MultiSpanProcessor(_spanProcessors) {
        this._spanProcessors = _spanProcessors;
    }
    MultiSpanProcessor.prototype.forceFlush = function() {
        var e_1, _a;
        var promises = [];
        try {
            for(var _b = __values(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()){
                var spanProcessor = _c.value;
                promises.push(spanProcessor.forceFlush());
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
        return new Promise(function(resolve) {
            Promise.all(promises).then(function() {
                resolve();
            }).catch(function(error) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(error || new Error('MultiSpanProcessor: forceFlush failed'));
                resolve();
            });
        });
    };
    MultiSpanProcessor.prototype.onStart = function(span, context) {
        var e_2, _a;
        try {
            for(var _b = __values(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()){
                var spanProcessor = _c.value;
                spanProcessor.onStart(span, context);
            }
        } catch (e_2_1) {
            e_2 = {
                error: e_2_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_2) throw e_2.error;
            }
        }
    };
    MultiSpanProcessor.prototype.onEnd = function(span) {
        var e_3, _a;
        try {
            for(var _b = __values(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()){
                var spanProcessor = _c.value;
                spanProcessor.onEnd(span);
            }
        } catch (e_3_1) {
            e_3 = {
                error: e_3_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_3) throw e_3.error;
            }
        }
    };
    MultiSpanProcessor.prototype.shutdown = function() {
        var e_4, _a;
        var promises = [];
        try {
            for(var _b = __values(this._spanProcessors), _c = _b.next(); !_c.done; _c = _b.next()){
                var spanProcessor = _c.value;
                promises.push(spanProcessor.shutdown());
            }
        } catch (e_4_1) {
            e_4 = {
                error: e_4_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_4) throw e_4.error;
            }
        }
        return new Promise(function(resolve, reject) {
            Promise.all(promises).then(function() {
                resolve();
            }, reject);
        });
    };
    return MultiSpanProcessor;
}();
;
 //# sourceMappingURL=MultiSpanProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/NoopSpanProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
 */ /** No-op implementation of SpanProcessor */ __turbopack_esm__({
    "NoopSpanProcessor": (()=>NoopSpanProcessor)
});
var NoopSpanProcessor = function() {
    function NoopSpanProcessor() {}
    NoopSpanProcessor.prototype.onStart = function(_span, _context) {};
    NoopSpanProcessor.prototype.onEnd = function(_span) {};
    NoopSpanProcessor.prototype.shutdown = function() {
        return Promise.resolve();
    };
    NoopSpanProcessor.prototype.forceFlush = function() {
        return Promise.resolve();
    };
    return NoopSpanProcessor;
}();
;
 //# sourceMappingURL=NoopSpanProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/BatchSpanProcessorBase.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "BatchSpanProcessorBase": (()=>BatchSpanProcessorBase)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/timer-util.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/callback.js [app-rsc] (ecmascript)");
;
;
/**
 * Implementation of the {@link SpanProcessor} that batches spans exported by
 * the SDK then pushes them to the exporter pipeline.
 */ var BatchSpanProcessorBase = function() {
    function BatchSpanProcessorBase(_exporter, config) {
        this._exporter = _exporter;
        this._isExporting = false;
        this._finishedSpans = [];
        this._droppedSpansCount = 0;
        var env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])();
        this._maxExportBatchSize = typeof (config === null || config === void 0 ? void 0 : config.maxExportBatchSize) === 'number' ? config.maxExportBatchSize : env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE;
        this._maxQueueSize = typeof (config === null || config === void 0 ? void 0 : config.maxQueueSize) === 'number' ? config.maxQueueSize : env.OTEL_BSP_MAX_QUEUE_SIZE;
        this._scheduledDelayMillis = typeof (config === null || config === void 0 ? void 0 : config.scheduledDelayMillis) === 'number' ? config.scheduledDelayMillis : env.OTEL_BSP_SCHEDULE_DELAY;
        this._exportTimeoutMillis = typeof (config === null || config === void 0 ? void 0 : config.exportTimeoutMillis) === 'number' ? config.exportTimeoutMillis : env.OTEL_BSP_EXPORT_TIMEOUT;
        this._shutdownOnce = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BindOnceFuture"](this._shutdown, this);
        if (this._maxExportBatchSize > this._maxQueueSize) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('BatchSpanProcessor: maxExportBatchSize must be smaller or equal to maxQueueSize, setting maxExportBatchSize to match maxQueueSize');
            this._maxExportBatchSize = this._maxQueueSize;
        }
    }
    BatchSpanProcessorBase.prototype.forceFlush = function() {
        if (this._shutdownOnce.isCalled) {
            return this._shutdownOnce.promise;
        }
        return this._flushAll();
    };
    // does nothing.
    BatchSpanProcessorBase.prototype.onStart = function(_span, _parentContext) {};
    BatchSpanProcessorBase.prototype.onEnd = function(span) {
        if (this._shutdownOnce.isCalled) {
            return;
        }
        if ((span.spanContext().traceFlags & __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["TraceFlags"].SAMPLED) === 0) {
            return;
        }
        this._addToBuffer(span);
    };
    BatchSpanProcessorBase.prototype.shutdown = function() {
        return this._shutdownOnce.call();
    };
    BatchSpanProcessorBase.prototype._shutdown = function() {
        var _this = this;
        return Promise.resolve().then(function() {
            return _this.onShutdown();
        }).then(function() {
            return _this._flushAll();
        }).then(function() {
            return _this._exporter.shutdown();
        });
    };
    /** Add a span in the buffer. */ BatchSpanProcessorBase.prototype._addToBuffer = function(span) {
        if (this._finishedSpans.length >= this._maxQueueSize) {
            // limit reached, drop span
            if (this._droppedSpansCount === 0) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].debug('maxQueueSize reached, dropping spans');
            }
            this._droppedSpansCount++;
            return;
        }
        if (this._droppedSpansCount > 0) {
            // some spans were dropped, log once with count of spans dropped
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Dropped " + this._droppedSpansCount + " spans because maxQueueSize reached");
            this._droppedSpansCount = 0;
        }
        this._finishedSpans.push(span);
        this._maybeStartTimer();
    };
    /**
     * Send all spans to the exporter respecting the batch size limit
     * This function is used only on forceFlush or shutdown,
     * for all other cases _flush should be used
     * */ BatchSpanProcessorBase.prototype._flushAll = function() {
        var _this = this;
        return new Promise(function(resolve, reject) {
            var promises = [];
            // calculate number of batches
            var count = Math.ceil(_this._finishedSpans.length / _this._maxExportBatchSize);
            for(var i = 0, j = count; i < j; i++){
                promises.push(_this._flushOneBatch());
            }
            Promise.all(promises).then(function() {
                resolve();
            }).catch(reject);
        });
    };
    BatchSpanProcessorBase.prototype._flushOneBatch = function() {
        var _this = this;
        this._clearTimer();
        if (this._finishedSpans.length === 0) {
            return Promise.resolve();
        }
        return new Promise(function(resolve, reject) {
            var timer = setTimeout(function() {
                // don't wait anymore for export, this way the next batch can start
                reject(new Error('Timeout'));
            }, _this._exportTimeoutMillis);
            // prevent downstream exporter calls from generating spans
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].with((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$suppress$2d$tracing$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["suppressTracing"])(__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].active()), function() {
                // Reset the finished spans buffer here because the next invocations of the _flush method
                // could pass the same finished spans to the exporter if the buffer is cleared
                // outside the execution of this callback.
                var spans;
                if (_this._finishedSpans.length <= _this._maxExportBatchSize) {
                    spans = _this._finishedSpans;
                    _this._finishedSpans = [];
                } else {
                    spans = _this._finishedSpans.splice(0, _this._maxExportBatchSize);
                }
                var doExport = function() {
                    return _this._exporter.export(spans, function(result) {
                        var _a;
                        clearTimeout(timer);
                        if (result.code === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS) {
                            resolve();
                        } else {
                            reject((_a = result.error) !== null && _a !== void 0 ? _a : new Error('BatchSpanProcessor: span export failed'));
                        }
                    });
                };
                var pendingResources = null;
                for(var i = 0, len = spans.length; i < len; i++){
                    var span = spans[i];
                    if (span.resource.asyncAttributesPending && span.resource.waitForAsyncAttributes) {
                        pendingResources !== null && pendingResources !== void 0 ? pendingResources : pendingResources = [];
                        pendingResources.push(span.resource.waitForAsyncAttributes());
                    }
                }
                // Avoid scheduling a promise to make the behavior more predictable and easier to test
                if (pendingResources === null) {
                    doExport();
                } else {
                    Promise.all(pendingResources).then(doExport, function(err) {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(err);
                        reject(err);
                    });
                }
            });
        });
    };
    BatchSpanProcessorBase.prototype._maybeStartTimer = function() {
        var _this = this;
        if (this._isExporting) return;
        var flush = function() {
            _this._isExporting = true;
            _this._flushOneBatch().finally(function() {
                _this._isExporting = false;
                if (_this._finishedSpans.length > 0) {
                    _this._clearTimer();
                    _this._maybeStartTimer();
                }
            }).catch(function(e) {
                _this._isExporting = false;
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(e);
            });
        };
        // we only wait if the queue doesn't have enough elements yet
        if (this._finishedSpans.length >= this._maxExportBatchSize) {
            return flush();
        }
        if (this._timer !== undefined) return;
        this._timer = setTimeout(function() {
            return flush();
        }, this._scheduledDelayMillis);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unrefTimer"])(this._timer);
    };
    BatchSpanProcessorBase.prototype._clearTimer = function() {
        if (this._timer !== undefined) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }
    };
    return BatchSpanProcessorBase;
}();
;
 //# sourceMappingURL=BatchSpanProcessorBase.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/export/BatchSpanProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "BatchSpanProcessor": (()=>BatchSpanProcessor)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$BatchSpanProcessorBase$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/BatchSpanProcessorBase.js [app-rsc] (ecmascript)");
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
;
var BatchSpanProcessor = function(_super) {
    __extends(BatchSpanProcessor, _super);
    function BatchSpanProcessor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BatchSpanProcessor.prototype.onShutdown = function() {};
    return BatchSpanProcessor;
}(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$BatchSpanProcessorBase$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BatchSpanProcessorBase"]);
;
 //# sourceMappingURL=BatchSpanProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/BasicTracerProvider.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "BasicTracerProvider": (()=>BasicTracerProvider),
    "ForceFlushState": (()=>ForceFlushState)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Tracer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Tracer.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$MultiSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/MultiSpanProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/environment.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$propagation$2f$composite$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/propagation/composite.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/trace/W3CTraceContextPropagator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$propagation$2f$W3CBaggagePropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/baggage/propagation/W3CBaggagePropagator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/merge.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$utility$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/utility.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+resources@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/resources/build/esm/Resource.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$NoopSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/NoopSpanProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$export$2f$BatchSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/export/BatchSpanProcessor.js [app-rsc] (ecmascript)");
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
;
;
;
;
;
;
;
;
var ForceFlushState;
(function(ForceFlushState) {
    ForceFlushState[ForceFlushState["resolved"] = 0] = "resolved";
    ForceFlushState[ForceFlushState["timeout"] = 1] = "timeout";
    ForceFlushState[ForceFlushState["error"] = 2] = "error";
    ForceFlushState[ForceFlushState["unresolved"] = 3] = "unresolved";
})(ForceFlushState || (ForceFlushState = {}));
/**
 * This class represents a basic tracer provider which platform libraries can extend
 */ var BasicTracerProvider = function() {
    function BasicTracerProvider(config) {
        if (config === void 0) {
            config = {};
        }
        var _a, _b;
        this._registeredSpanProcessors = [];
        this._tracers = new Map();
        var mergedConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$merge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["merge"])({}, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadDefaultConfig"])(), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$utility$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["reconfigureLimits"])(config));
        this.resource = (_a = mergedConfig.resource) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Resource"].empty();
        if (mergedConfig.mergeResourceWithDefaults) {
            this.resource = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Resource"].default().merge(this.resource);
        }
        this._config = Object.assign({}, mergedConfig, {
            resource: this.resource
        });
        if ((_b = config.spanProcessors) === null || _b === void 0 ? void 0 : _b.length) {
            this._registeredSpanProcessors = __spreadArray([], __read(config.spanProcessors), false);
            this.activeSpanProcessor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$MultiSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MultiSpanProcessor"](this._registeredSpanProcessors);
        } else {
            var defaultExporter = this._buildExporterFromEnv();
            if (defaultExporter !== undefined) {
                var batchProcessor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$export$2f$BatchSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BatchSpanProcessor"](defaultExporter);
                this.activeSpanProcessor = batchProcessor;
            } else {
                this.activeSpanProcessor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$NoopSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoopSpanProcessor"]();
            }
        }
    }
    BasicTracerProvider.prototype.getTracer = function(name, version, options) {
        var key = name + "@" + (version || '') + ":" + ((options === null || options === void 0 ? void 0 : options.schemaUrl) || '');
        if (!this._tracers.has(key)) {
            this._tracers.set(key, new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Tracer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Tracer"]({
                name: name,
                version: version,
                schemaUrl: options === null || options === void 0 ? void 0 : options.schemaUrl
            }, this._config, this));
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._tracers.get(key);
    };
    /**
     * @deprecated please use {@link TracerConfig} spanProcessors property
     * Adds a new {@link SpanProcessor} to this tracer.
     * @param spanProcessor the new SpanProcessor to be added.
     */ BasicTracerProvider.prototype.addSpanProcessor = function(spanProcessor) {
        if (this._registeredSpanProcessors.length === 0) {
            // since we might have enabled by default a batchProcessor, we disable it
            // before adding the new one
            this.activeSpanProcessor.shutdown().catch(function(err) {
                return __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error('Error while trying to shutdown current span processor', err);
            });
        }
        this._registeredSpanProcessors.push(spanProcessor);
        this.activeSpanProcessor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$MultiSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MultiSpanProcessor"](this._registeredSpanProcessors);
    };
    BasicTracerProvider.prototype.getActiveSpanProcessor = function() {
        return this.activeSpanProcessor;
    };
    /**
     * Register this TracerProvider for use with the OpenTelemetry API.
     * Undefined values may be replaced with defaults, and
     * null values will be skipped.
     *
     * @param config Configuration object for SDK registration
     */ BasicTracerProvider.prototype.register = function(config) {
        if (config === void 0) {
            config = {};
        }
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["trace"].setGlobalTracerProvider(this);
        if (config.propagator === undefined) {
            config.propagator = this._buildPropagatorFromEnv();
        }
        if (config.contextManager) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].setGlobalContextManager(config.contextManager);
        }
        if (config.propagator) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["propagation"].setGlobalPropagator(config.propagator);
        }
    };
    BasicTracerProvider.prototype.forceFlush = function() {
        var timeout = this._config.forceFlushTimeoutMillis;
        var promises = this._registeredSpanProcessors.map(function(spanProcessor) {
            return new Promise(function(resolve) {
                var state;
                var timeoutInterval = setTimeout(function() {
                    resolve(new Error("Span processor did not completed within timeout period of " + timeout + " ms"));
                    state = ForceFlushState.timeout;
                }, timeout);
                spanProcessor.forceFlush().then(function() {
                    clearTimeout(timeoutInterval);
                    if (state !== ForceFlushState.timeout) {
                        state = ForceFlushState.resolved;
                        resolve(state);
                    }
                }).catch(function(error) {
                    clearTimeout(timeoutInterval);
                    state = ForceFlushState.error;
                    resolve(error);
                });
            });
        });
        return new Promise(function(resolve, reject) {
            Promise.all(promises).then(function(results) {
                var errors = results.filter(function(result) {
                    return result !== ForceFlushState.resolved;
                });
                if (errors.length > 0) {
                    reject(errors);
                } else {
                    resolve();
                }
            }).catch(function(error) {
                return reject([
                    error
                ]);
            });
        });
    };
    BasicTracerProvider.prototype.shutdown = function() {
        return this.activeSpanProcessor.shutdown();
    };
    /**
     * TS cannot yet infer the type of this.constructor:
     * https://github.com/Microsoft/TypeScript/issues/3841#issuecomment-337560146
     * There is no need to override either of the getters in your child class.
     * The type of the registered component maps should be the same across all
     * classes in the inheritance tree.
     */ BasicTracerProvider.prototype._getPropagator = function(name) {
        var _a;
        return (_a = this.constructor._registeredPropagators.get(name)) === null || _a === void 0 ? void 0 : _a();
    };
    BasicTracerProvider.prototype._getSpanExporter = function(name) {
        var _a;
        return (_a = this.constructor._registeredExporters.get(name)) === null || _a === void 0 ? void 0 : _a();
    };
    BasicTracerProvider.prototype._buildPropagatorFromEnv = function() {
        var _this = this;
        // per spec, propagators from env must be deduplicated
        var uniquePropagatorNames = Array.from(new Set((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])().OTEL_PROPAGATORS));
        var propagators = uniquePropagatorNames.map(function(name) {
            var propagator = _this._getPropagator(name);
            if (!propagator) {
                __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Propagator \"" + name + "\" requested through environment variable is unavailable.");
            }
            return propagator;
        });
        var validPropagators = propagators.reduce(function(list, item) {
            if (item) {
                list.push(item);
            }
            return list;
        }, []);
        if (validPropagators.length === 0) {
            return;
        } else if (uniquePropagatorNames.length === 1) {
            return validPropagators[0];
        } else {
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$propagation$2f$composite$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CompositePropagator"]({
                propagators: validPropagators
            });
        }
    };
    BasicTracerProvider.prototype._buildExporterFromEnv = function() {
        var exporterName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$environment$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEnv"])().OTEL_TRACES_EXPORTER;
        if (exporterName === 'none' || exporterName === '') return;
        var exporter = this._getSpanExporter(exporterName);
        if (!exporter) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error("Exporter \"" + exporterName + "\" requested through environment variable is unavailable.");
        }
        return exporter;
    };
    BasicTracerProvider._registeredPropagators = new Map([
        [
            'tracecontext',
            function() {
                return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$trace$2f$W3CTraceContextPropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["W3CTraceContextPropagator"]();
            }
        ],
        [
            'baggage',
            function() {
                return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$baggage$2f$propagation$2f$W3CBaggagePropagator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["W3CBaggagePropagator"]();
            }
        ]
    ]);
    BasicTracerProvider._registeredExporters = new Map();
    return BasicTracerProvider;
}();
;
 //# sourceMappingURL=BasicTracerProvider.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/InMemorySpanExporter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "InMemorySpanExporter": (()=>InMemorySpanExporter)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
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
 * This class can be used for testing purposes. It stores the exported spans
 * in a list in memory that can be retrieved using the `getFinishedSpans()`
 * method.
 */ var InMemorySpanExporter = function() {
    function InMemorySpanExporter() {
        this._finishedSpans = [];
        /**
         * Indicates if the exporter has been "shutdown."
         * When false, exported spans will not be stored in-memory.
         */ this._stopped = false;
    }
    InMemorySpanExporter.prototype.export = function(spans, resultCallback) {
        var _a;
        if (this._stopped) return resultCallback({
            code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].FAILED,
            error: new Error('Exporter has been stopped')
        });
        (_a = this._finishedSpans).push.apply(_a, __spreadArray([], __read(spans), false));
        setTimeout(function() {
            return resultCallback({
                code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS
            });
        }, 0);
    };
    InMemorySpanExporter.prototype.shutdown = function() {
        this._stopped = true;
        this._finishedSpans = [];
        return this.forceFlush();
    };
    /**
     * Exports any pending spans in the exporter
     */ InMemorySpanExporter.prototype.forceFlush = function() {
        return Promise.resolve();
    };
    InMemorySpanExporter.prototype.reset = function() {
        this._finishedSpans = [];
    };
    InMemorySpanExporter.prototype.getFinishedSpans = function() {
        return this._finishedSpans;
    };
    return InMemorySpanExporter;
}();
;
 //# sourceMappingURL=InMemorySpanExporter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/SimpleSpanProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
    "SimpleSpanProcessor": (()=>SimpleSpanProcessor)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/utils/callback.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
;
;
/**
 * An implementation of the {@link SpanProcessor} that converts the {@link Span}
 * to {@link ReadableSpan} and passes it to the configured exporter.
 *
 * Only spans that are sampled are converted.
 *
 * NOTE: This {@link SpanProcessor} exports every ended span individually instead of batching spans together, which causes significant performance overhead with most exporters. For production use, please consider using the {@link BatchSpanProcessor} instead.
 */ var SimpleSpanProcessor = function() {
    function SimpleSpanProcessor(_exporter) {
        this._exporter = _exporter;
        this._shutdownOnce = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$utils$2f$callback$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BindOnceFuture"](this._shutdown, this);
        this._unresolvedExports = new Set();
    }
    SimpleSpanProcessor.prototype.forceFlush = function() {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        // await unresolved resources before resolving
                        return [
                            4 /*yield*/ ,
                            Promise.all(Array.from(this._unresolvedExports))
                        ];
                    case 1:
                        // await unresolved resources before resolving
                        _a.sent();
                        if (!this._exporter.forceFlush) return [
                            3 /*break*/ ,
                            3
                        ];
                        return [
                            4 /*yield*/ ,
                            this._exporter.forceFlush()
                        ];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    SimpleSpanProcessor.prototype.onStart = function(_span, _parentContext) {};
    SimpleSpanProcessor.prototype.onEnd = function(span) {
        var _this = this;
        var _a, _b;
        if (this._shutdownOnce.isCalled) {
            return;
        }
        if ((span.spanContext().traceFlags & __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["TraceFlags"].SAMPLED) === 0) {
            return;
        }
        var doExport = function() {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["internal"]._export(_this._exporter, [
                span
            ]).then(function(result) {
                var _a;
                if (result.code !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])((_a = result.error) !== null && _a !== void 0 ? _a : new Error("SimpleSpanProcessor: span export failed (status " + result + ")"));
                }
            }).catch(function(error) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(error);
            });
        };
        // Avoid scheduling a promise to make the behavior more predictable and easier to test
        if (span.resource.asyncAttributesPending) {
            var exportPromise_1 = (_b = (_a = span.resource).waitForAsyncAttributes) === null || _b === void 0 ? void 0 : _b.call(_a).then(function() {
                if (exportPromise_1 != null) {
                    _this._unresolvedExports.delete(exportPromise_1);
                }
                return doExport();
            }, function(err) {
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(err);
            });
            // store the unresolved exports
            if (exportPromise_1 != null) {
                this._unresolvedExports.add(exportPromise_1);
            }
        } else {
            void doExport();
        }
    };
    SimpleSpanProcessor.prototype.shutdown = function() {
        return this._shutdownOnce.call();
    };
    SimpleSpanProcessor.prototype._shutdown = function() {
        return this._exporter.shutdown();
    };
    return SimpleSpanProcessor;
}();
;
 //# sourceMappingURL=SimpleSpanProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AlwaysOffSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOffSampler"]),
    "AlwaysOnSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AlwaysOnSampler"]),
    "BasicTracerProvider": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$BasicTracerProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BasicTracerProvider"]),
    "BatchSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$export$2f$BatchSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BatchSpanProcessor"]),
    "ConsoleSpanExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$ConsoleSpanExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConsoleSpanExporter"]),
    "ForceFlushState": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$BasicTracerProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ForceFlushState"]),
    "InMemorySpanExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$InMemorySpanExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InMemorySpanExporter"]),
    "NoopSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$NoopSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoopSpanProcessor"]),
    "ParentBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ParentBasedSampler"]),
    "RandomIdGenerator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["RandomIdGenerator"]),
    "SamplingDecision": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SamplingDecision"]),
    "SimpleSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$SimpleSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SimpleSpanProcessor"]),
    "Span": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Span$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Span"]),
    "TraceIdRatioBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TraceIdRatioBasedSampler"]),
    "Tracer": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Tracer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Tracer"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOffSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOffSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$AlwaysOnSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/AlwaysOnSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$BasicTracerProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/BasicTracerProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$export$2f$BatchSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/export/BatchSpanProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$ConsoleSpanExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/ConsoleSpanExporter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$InMemorySpanExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/InMemorySpanExporter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$NoopSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/NoopSpanProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$ParentBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/ParentBasedSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$platform$2f$node$2f$RandomIdGenerator$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/platform/node/RandomIdGenerator.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Sampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Sampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$export$2f$SimpleSpanProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/export/SimpleSpanProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Span$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Span.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$sampler$2f$TraceIdRatioBasedSampler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/sampler/TraceIdRatioBasedSampler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$Tracer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/Tracer.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AlwaysOffSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AlwaysOffSampler"]),
    "AlwaysOnSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AlwaysOnSampler"]),
    "BasicTracerProvider": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["BasicTracerProvider"]),
    "BatchSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["BatchSpanProcessor"]),
    "ConsoleSpanExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ConsoleSpanExporter"]),
    "ForceFlushState": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ForceFlushState"]),
    "InMemorySpanExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["InMemorySpanExporter"]),
    "NoopSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["NoopSpanProcessor"]),
    "ParentBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ParentBasedSampler"]),
    "RandomIdGenerator": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["RandomIdGenerator"]),
    "SamplingDecision": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["SamplingDecision"]),
    "SimpleSpanProcessor": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["SimpleSpanProcessor"]),
    "Span": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["Span"]),
    "TraceIdRatioBasedSampler": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TraceIdRatioBasedSampler"]),
    "Tracer": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["Tracer"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$trace$2d$base$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$trace$2d$base$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-trace-base@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-trace-base/build/esm/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=c8202_%40opentelemetry_sdk-trace-base_build_esm_73f2ed._.js.map