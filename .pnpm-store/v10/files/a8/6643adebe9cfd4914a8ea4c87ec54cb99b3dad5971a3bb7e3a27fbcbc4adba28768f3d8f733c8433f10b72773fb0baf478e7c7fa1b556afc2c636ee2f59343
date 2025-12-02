type TODO = any;

// In the absence of a WeakSet or WeakMap implementation, don't break, but don't cache either.
function noop(...args: Array<any>) { }
function createWeakMap<K extends object, V>(): WeakMap<K, V> {
    if(typeof WeakMap !== 'undefined') {
        return new WeakMap<K, V>();
    } else {
        return fakeSetOrMap<K, V>();
    }
}

/**
 * Creates and returns a no-op implementation of a WeakMap / WeakSet that never stores anything.
 */
function fakeSetOrMap<K extends object, V = any>(): WeakMap<K, V> & WeakSet<K> {
    return {
        add: noop as WeakSet<K>['add'],
        delete: noop as WeakMap<K, V>['delete'],
        get: noop as WeakMap<K, V>['get'],
        set: noop as WeakMap<K, V>['set'],
        has(k: K) { return false; },
    };
}

// Safe hasOwnProperty
const hop = Object.prototype.hasOwnProperty;
const has = function(obj: object, prop: string): boolean {
    return hop.call(obj, prop);
};

// Copy all own enumerable properties from source to target
function extend<T, S extends object>(target: T, source: S) {
    type Extended = T & S;
    for(const prop in source) {
        if(has(source, prop)) {
            (target as any)[prop] = source[prop];
        }
    }
    return target as Extended;
}

const reLeadingNewline = /^[ \t]*(?:\r\n|\r|\n)/;
const reTrailingNewline = /(?:\r\n|\r|\n)[ \t]*$/;
const reStartsWithNewlineOrIsEmpty = /^(?:[\r\n]|$)/;
const reDetectIndentation = /(\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;
const reOnlyWhitespaceWithAtLeastOneNewline = /^[ \t]*[\r\n][ \t\r\n]*$/;

function _outdent(strings: ReadonlyArray<string>, values: Array<any>, outdentInstance: Outdent, options: Options) {
    // If first interpolated value is a reference to outdent,
    // determine indentation level from the indentation of the interpolated value.
    let indentationLevel = 0;

    const match = strings[0].match(reDetectIndentation);
    if(match) {
        indentationLevel = match[2].length;
    }

    const reSource = `(\\r\\n|\\r|\\n).{0,${ indentationLevel }}`;
    const reMatchIndent = new RegExp(reSource, 'g');

    // Is first interpolated value a reference to outdent, alone on its own line, without any preceding non-whitespace?
    if(
        (values[0] === outdentInstance || values[0] === outdent) &&
        reOnlyWhitespaceWithAtLeastOneNewline.test(strings[0]) &&
        reStartsWithNewlineOrIsEmpty.test(strings[1])
    ) {
        values = values.slice(1);
        strings = strings.slice(1);
    }

    const l = strings.length;
    const outdentedStrings = strings.map((v, i) => {
        // Remove leading indentation from all lines
        v = v.replace(reMatchIndent, '$1');
        // Trim a leading newline from the first string
        if(i === 0 && options.trimLeadingNewline) {
            v = v.replace(reLeadingNewline, '');
        }
        // Trim a trailing newline from the last string
        if(i === l - 1 && options.trimTrailingNewline) {
            v = v.replace(reTrailingNewline, '');
        }
        return v;
    });

    return concatStringsAndValues(outdentedStrings, values);
}

function concatStringsAndValues(strings: ReadonlyArray<string>, values: ReadonlyArray<any>): string {
    let ret = '';
    for(let i = 0, l = strings.length; i < l; i++) {
        ret += strings[i];
        if(i < l - 1) {
            ret += values[i];
        }
    }
    return ret;
}

function isTemplateStringsArray(v: any): v is TemplateStringsArray {
    return has(v, 'raw') && has(v, 'length');
}

/**
 * It is assumed that opts will not change.  If this is a problem, clone your options object and pass the clone to
 * makeInstance
 * @param options
 * @return {outdent}
 */
function createInstance(options: Options): Outdent {
    const cache = createWeakMap<TemplateStringsArray, string>();

    /* tslint:disable:no-shadowed-variable */
    function outdent(stringsOrOptions: TemplateStringsArray, ...values: Array<any>): string;
    function outdent(stringsOrOptions: Options): Outdent;
    function outdent(stringsOrOptions: TemplateStringsArray | Options, ...values: Array<any>): string | Outdent {
        /* tslint:enable:no-shadowed-variable */
        if(isTemplateStringsArray(stringsOrOptions)) {
            // TODO Enable semi-caching, both when the first interpolated value is `outdent`, and when it's not
            const strings = stringsOrOptions;
            // Serve from cache only if there are no interpolated values
            if(values.length === 0 && cache.has(strings)) return cache.get(strings)!;

            // Perform outdentation
            const rendered = _outdent(strings, values, fullOutdent, options);

            // Store into the cache only if there are no interpolated values
            values.length === 0 && cache.set(strings, rendered);
            return rendered;
        } else {
            // Create and return a new instance of outdent with the given options
            return createInstance(extend(extend({}, options), stringsOrOptions || {}));
        }
    }

    const fullOutdent = extend(outdent, {
        string(str: string): string {
            return _outdent([str], [], fullOutdent, options);
        },
    });

    return fullOutdent;
}

const outdent = createInstance({
    trimLeadingNewline: true,
    trimTrailingNewline: true,
});

export interface Outdent {
    /**
     * Remove indentation from a template literal.
     */
    (strings: TemplateStringsArray, ...values: Array<any>): string;
    /**
     * Create and return a new Outdent instance with the given options.
     */
    (options: Options): Outdent;

    /**
     * Remove indentation from a string
     */
    string(str: string): string;
}
export interface Options {
    trimLeadingNewline?: boolean;
    trimTrailingNewline?: boolean;
}

// Named exports.  Simple and preferred.
export default outdent;
export { outdent };

// In CommonJS environments, enable `var outdent = require('outdent');` by
// replacing the exports object.
// Make sure that our replacement includes the named exports from above.
declare var module: any, exports: any;
if(typeof module !== 'undefined') {
    module.exports = exports = outdent;
    // TODO is this necessary?
    Object.defineProperty(outdent, '__esModule', { value: true });
    (outdent as any).default = outdent;
    (outdent as any).outdent = outdent;
}
