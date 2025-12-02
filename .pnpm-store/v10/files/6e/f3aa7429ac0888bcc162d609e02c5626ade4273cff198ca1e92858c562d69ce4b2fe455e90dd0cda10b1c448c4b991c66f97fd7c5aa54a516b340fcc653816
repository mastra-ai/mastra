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
import { NOOP_LOGGER_PROVIDER } from './NoopLoggerProvider';
import { ProxyLogger } from './ProxyLogger';
var ProxyLoggerProvider = /** @class */ (function () {
    function ProxyLoggerProvider() {
    }
    ProxyLoggerProvider.prototype.getLogger = function (name, version, options) {
        var _a;
        return ((_a = this.getDelegateLogger(name, version, options)) !== null && _a !== void 0 ? _a : new ProxyLogger(this, name, version, options));
    };
    ProxyLoggerProvider.prototype.getDelegate = function () {
        var _a;
        return (_a = this._delegate) !== null && _a !== void 0 ? _a : NOOP_LOGGER_PROVIDER;
    };
    /**
     * Set the delegate logger provider
     */
    ProxyLoggerProvider.prototype.setDelegate = function (delegate) {
        this._delegate = delegate;
    };
    ProxyLoggerProvider.prototype.getDelegateLogger = function (name, version, options) {
        var _a;
        return (_a = this._delegate) === null || _a === void 0 ? void 0 : _a.getLogger(name, version, options);
    };
    return ProxyLoggerProvider;
}());
export { ProxyLoggerProvider };
//# sourceMappingURL=ProxyLoggerProvider.js.map