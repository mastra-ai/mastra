/**
 * Return a new object that is a copy of `obj`, with its `subpath` property
 * replaced with the return value of `wrapper(original)`.
 *
 * This is similar to shimmer (i.e. `InstrumentationBase.prototype._wrap`).
 * However, it uses a different technique to support wrapping properties that
 * are only available via a getter (i.e. their property descriptor is `.writable
 * === false`).
 *
 * For example:
 *    var os = propwrap(require('os'), 'platform', (orig) => {
 *      return function wrappedPlatform () {
 *        return orig().toUpperCase()
 *      }
 *    })
 *    console.log(os.platform()) // => DARWIN
 *
 * The subpath can indicate a nested property. Each property in that subpath,
 * except the last, must identify an *Object*.
 *
 * Limitations:
 * - This doesn't handle possible Symbol properties on the copied object(s).
 * - This cannot wrap a property of a function, because we cannot create a
 *   copy of the function.
 *
 * @param {object} obj
 * @param {string} subpath - The property subpath on `obj` to wrap. This may
 *    point to a nested property by using a '.' to separate levels. For example:
 *        var fs = wrap(fs, 'promises.sync', (orig) => { ... })
 * @param {Function} wrapper - A function of the form `function (orig)`, where
 *    `orig` is the original property value. This must synchronously return the
 *    new property value.
 * @returns {object} A new object with the wrapped property.
 * @throws {TypeError} if the subpath points to a non-existent property, or if
 *    any but the last subpath part points to a non-Object.
 */
export declare const propwrap: (obj: any, subpath: string, wrapper: Function) => any;
//# sourceMappingURL=propwrap.d.ts.map