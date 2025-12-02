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
import { Hook } from 'require-in-the-middle';
import * as path from 'path';
import { ModuleNameTrie, ModuleNameSeparator } from './ModuleNameTrie';
/**
 * Whether Mocha is running in this process
 * Inspired by https://github.com/AndreasPizsa/detect-mocha
 *
 * @type {boolean}
 */
var isMocha = [
    'afterEach',
    'after',
    'beforeEach',
    'before',
    'describe',
    'it',
].every(function (fn) {
    // @ts-expect-error TS7053: Element implicitly has an 'any' type
    return typeof global[fn] === 'function';
});
/**
 * Singleton class for `require-in-the-middle`
 * Allows instrumentation plugins to patch modules with only a single `require` patch
 * WARNING: Because this class will create its own `require-in-the-middle` (RITM) instance,
 * we should minimize the number of new instances of this class.
 * Multiple instances of `@opentelemetry/instrumentation` (e.g. multiple versions) in a single process
 * will result in multiple instances of RITM, which will have an impact
 * on the performance of instrumentation hooks being applied.
 */
var RequireInTheMiddleSingleton = /** @class */ (function () {
    function RequireInTheMiddleSingleton() {
        this._moduleNameTrie = new ModuleNameTrie();
        this._initialize();
    }
    RequireInTheMiddleSingleton.prototype._initialize = function () {
        var _this = this;
        new Hook(
        // Intercept all `require` calls; we will filter the matching ones below
        null, { internals: true }, function (exports, name, basedir) {
            var e_1, _a;
            // For internal files on Windows, `name` will use backslash as the path separator
            var normalizedModuleName = normalizePathSeparators(name);
            var matches = _this._moduleNameTrie.search(normalizedModuleName, {
                maintainInsertionOrder: true,
                // For core modules (e.g. `fs`), do not match on sub-paths (e.g. `fs/promises').
                // This matches the behavior of `require-in-the-middle`.
                // `basedir` is always `undefined` for core modules.
                fullOnly: basedir === undefined,
            });
            try {
                for (var matches_1 = __values(matches), matches_1_1 = matches_1.next(); !matches_1_1.done; matches_1_1 = matches_1.next()) {
                    var onRequire = matches_1_1.value.onRequire;
                    exports = onRequire(exports, name, basedir);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (matches_1_1 && !matches_1_1.done && (_a = matches_1.return)) _a.call(matches_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return exports;
        });
    };
    /**
     * Register a hook with `require-in-the-middle`
     *
     * @param {string} moduleName Module name
     * @param {OnRequireFn} onRequire Hook function
     * @returns {Hooked} Registered hook
     */
    RequireInTheMiddleSingleton.prototype.register = function (moduleName, onRequire) {
        var hooked = { moduleName: moduleName, onRequire: onRequire };
        this._moduleNameTrie.insert(hooked);
        return hooked;
    };
    /**
     * Get the `RequireInTheMiddleSingleton` singleton
     *
     * @returns {RequireInTheMiddleSingleton} Singleton of `RequireInTheMiddleSingleton`
     */
    RequireInTheMiddleSingleton.getInstance = function () {
        var _a;
        // Mocha runs all test suites in the same process
        // This prevents test suites from sharing a singleton
        if (isMocha)
            return new RequireInTheMiddleSingleton();
        return (this._instance =
            (_a = this._instance) !== null && _a !== void 0 ? _a : new RequireInTheMiddleSingleton());
    };
    return RequireInTheMiddleSingleton;
}());
export { RequireInTheMiddleSingleton };
/**
 * Normalize the path separators to forward slash in a module name or path
 *
 * @param {string} moduleNameOrPath Module name or path
 * @returns {string} Normalized module name or path
 */
function normalizePathSeparators(moduleNameOrPath) {
    return path.sep !== ModuleNameSeparator
        ? moduleNameOrPath.split(path.sep).join(ModuleNameSeparator)
        : moduleNameOrPath;
}
//# sourceMappingURL=RequireInTheMiddleSingleton.js.map