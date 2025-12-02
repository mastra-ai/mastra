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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { InstrumentationAbstract } from '../../instrumentation';
/**
 * Base abstract class for instrumenting web plugins
 */
var InstrumentationBase = /** @class */ (function (_super) {
    __extends(InstrumentationBase, _super);
    function InstrumentationBase(instrumentationName, instrumentationVersion, config) {
        var _this = _super.call(this, instrumentationName, instrumentationVersion, config) || this;
        if (_this._config.enabled) {
            _this.enable();
        }
        return _this;
    }
    return InstrumentationBase;
}(InstrumentationAbstract));
export { InstrumentationBase };
//# sourceMappingURL=instrumentation.js.map