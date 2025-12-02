// In the absence of a WeakSet or WeakMap implementation, don't break, but don't cache either.
function noop() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
}
function createWeakMap() {
    if (typeof WeakMap !== 'undefined') {
        return new WeakMap();
    }
    else {
        return fakeSetOrMap();
    }
}
/**
 * Creates and returns a no-op implementation of a WeakMap / WeakSet that never stores anything.
 */
function fakeSetOrMap() {
    return {
        add: noop,
        delete: noop,
        get: noop,
        set: noop,
        has: function (k) { return false; },
    };
}
// Safe hasOwnProperty
var hop = Object.prototype.hasOwnProperty;
var has = function (obj, prop) {
    return hop.call(obj, prop);
};
// Copy all own enumerable properties from source to target
function extend(target, source) {
    for (var prop in source) {
        if (has(source, prop)) {
            target[prop] = source[prop];
        }
    }
    return target;
}
var reLeadingNewline = /^[ \t]*(?:\r\n|\r|\n)/;
var reTrailingNewline = /(?:\r\n|\r|\n)[ \t]*$/;
var reStartsWithNewlineOrIsEmpty = /^(?:[\r\n]|$)/;
var reDetectIndentation = /(\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;
var reOnlyWhitespaceWithAtLeastOneNewline = /^[ \t]*[\r\n][ \t\r\n]*$/;
function _outdent(strings, values, outdentInstance, options) {
    // If first interpolated value is a reference to outdent,
    // determine indentation level from the indentation of the interpolated value.
    var indentationLevel = 0;
    var match = strings[0].match(reDetectIndentation);
    if (match) {
        indentationLevel = match[2].length;
    }
    var reSource = "(\\r\\n|\\r|\\n).{0," + indentationLevel + "}";
    var reMatchIndent = new RegExp(reSource, 'g');
    // Is first interpolated value a reference to outdent, alone on its own line, without any preceding non-whitespace?
    if ((values[0] === outdentInstance || values[0] === outdent) &&
        reOnlyWhitespaceWithAtLeastOneNewline.test(strings[0]) &&
        reStartsWithNewlineOrIsEmpty.test(strings[1])) {
        values = values.slice(1);
        strings = strings.slice(1);
    }
    var l = strings.length;
    var outdentedStrings = strings.map(function (v, i) {
        // Remove leading indentation from all lines
        v = v.replace(reMatchIndent, '$1');
        // Trim a leading newline from the first string
        if (i === 0 && options.trimLeadingNewline) {
            v = v.replace(reLeadingNewline, '');
        }
        // Trim a trailing newline from the last string
        if (i === l - 1 && options.trimTrailingNewline) {
            v = v.replace(reTrailingNewline, '');
        }
        return v;
    });
    return concatStringsAndValues(outdentedStrings, values);
}
function concatStringsAndValues(strings, values) {
    var ret = '';
    for (var i = 0, l = strings.length; i < l; i++) {
        ret += strings[i];
        if (i < l - 1) {
            ret += values[i];
        }
    }
    return ret;
}
function isTemplateStringsArray(v) {
    return has(v, 'raw') && has(v, 'length');
}
/**
 * It is assumed that opts will not change.  If this is a problem, clone your options object and pass the clone to
 * makeInstance
 * @param options
 * @return {outdent}
 */
function createInstance(options) {
    var cache = createWeakMap();
    function outdent(stringsOrOptions) {
        var values = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            values[_i - 1] = arguments[_i];
        }
        /* tslint:enable:no-shadowed-variable */
        if (isTemplateStringsArray(stringsOrOptions)) {
            // TODO Enable semi-caching, both when the first interpolated value is `outdent`, and when it's not
            var strings = stringsOrOptions;
            // Serve from cache only if there are no interpolated values
            if (values.length === 0 && cache.has(strings))
                return cache.get(strings);
            // Perform outdentation
            var rendered = _outdent(strings, values, fullOutdent, options);
            // Store into the cache only if there are no interpolated values
            values.length === 0 && cache.set(strings, rendered);
            return rendered;
        }
        else {
            // Create and return a new instance of outdent with the given options
            return createInstance(extend(extend({}, options), stringsOrOptions || {}));
        }
    }
    var fullOutdent = extend(outdent, {
        string: function (str) {
            return _outdent([str], [], fullOutdent, options);
        },
    });
    return fullOutdent;
}
var outdent = createInstance({
    trimLeadingNewline: true,
    trimTrailingNewline: true,
});
// Named exports.  Simple and preferred.
export default outdent;
export { outdent };
if (typeof module !== 'undefined') {
    module.exports = exports = outdent;
    // TODO is this necessary?
    Object.defineProperty(outdent, '__esModule', { value: true });
    outdent.default = outdent;
    outdent.outdent = outdent;
}
//# sourceMappingURL=index.js.map