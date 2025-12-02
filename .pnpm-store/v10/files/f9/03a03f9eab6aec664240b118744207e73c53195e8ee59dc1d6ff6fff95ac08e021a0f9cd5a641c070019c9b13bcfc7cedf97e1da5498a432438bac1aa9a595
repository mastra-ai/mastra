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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
export var ModuleNameSeparator = '/';
/**
 * Node in a `ModuleNameTrie`
 */
var ModuleNameTrieNode = /** @class */ (function () {
    function ModuleNameTrieNode() {
        this.hooks = [];
        this.children = new Map();
    }
    return ModuleNameTrieNode;
}());
/**
 * Trie containing nodes that represent a part of a module name (i.e. the parts separated by forward slash)
 */
var ModuleNameTrie = /** @class */ (function () {
    function ModuleNameTrie() {
        this._trie = new ModuleNameTrieNode();
        this._counter = 0;
    }
    /**
     * Insert a module hook into the trie
     *
     * @param {Hooked} hook Hook
     */
    ModuleNameTrie.prototype.insert = function (hook) {
        var e_1, _a;
        var trieNode = this._trie;
        try {
            for (var _b = __values(hook.moduleName.split(ModuleNameSeparator)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var moduleNamePart = _c.value;
                var nextNode = trieNode.children.get(moduleNamePart);
                if (!nextNode) {
                    nextNode = new ModuleNameTrieNode();
                    trieNode.children.set(moduleNamePart, nextNode);
                }
                trieNode = nextNode;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        trieNode.hooks.push({ hook: hook, insertedId: this._counter++ });
    };
    /**
     * Search for matching hooks in the trie
     *
     * @param {string} moduleName Module name
     * @param {boolean} maintainInsertionOrder Whether to return the results in insertion order
     * @param {boolean} fullOnly Whether to return only full matches
     * @returns {Hooked[]} Matching hooks
     */
    ModuleNameTrie.prototype.search = function (moduleName, _a) {
        var e_2, _b;
        var _c = _a === void 0 ? {} : _a, maintainInsertionOrder = _c.maintainInsertionOrder, fullOnly = _c.fullOnly;
        var trieNode = this._trie;
        var results = [];
        var foundFull = true;
        try {
            for (var _d = __values(moduleName.split(ModuleNameSeparator)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var moduleNamePart = _e.value;
                var nextNode = trieNode.children.get(moduleNamePart);
                if (!nextNode) {
                    foundFull = false;
                    break;
                }
                if (!fullOnly) {
                    results.push.apply(results, __spreadArray([], __read(nextNode.hooks), false));
                }
                trieNode = nextNode;
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (fullOnly && foundFull) {
            results.push.apply(results, __spreadArray([], __read(trieNode.hooks), false));
        }
        if (results.length === 0) {
            return [];
        }
        if (results.length === 1) {
            return [results[0].hook];
        }
        if (maintainInsertionOrder) {
            results.sort(function (a, b) { return a.insertedId - b.insertedId; });
        }
        return results.map(function (_a) {
            var hook = _a.hook;
            return hook;
        });
    };
    return ModuleNameTrie;
}());
export { ModuleNameTrie };
//# sourceMappingURL=ModuleNameTrie.js.map