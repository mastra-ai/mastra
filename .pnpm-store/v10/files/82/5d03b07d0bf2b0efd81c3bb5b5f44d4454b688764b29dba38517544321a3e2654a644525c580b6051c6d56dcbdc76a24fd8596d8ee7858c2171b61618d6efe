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
var OTLPExporterBase = /** @class */ (function () {
    function OTLPExporterBase(_delegate) {
        this._delegate = _delegate;
    }
    /**
     * Export items.
     * @param items
     * @param resultCallback
     */
    OTLPExporterBase.prototype.export = function (items, resultCallback) {
        this._delegate.export(items, resultCallback);
    };
    OTLPExporterBase.prototype.forceFlush = function () {
        return this._delegate.forceFlush();
    };
    OTLPExporterBase.prototype.shutdown = function () {
        return this._delegate.shutdown();
    };
    return OTLPExporterBase;
}());
export { OTLPExporterBase };
//# sourceMappingURL=OTLPExporterBase.js.map