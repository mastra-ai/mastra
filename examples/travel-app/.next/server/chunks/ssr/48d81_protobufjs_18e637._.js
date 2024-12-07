module.exports = {

"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/longbits.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = LongBits;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
/**
 * Constructs new long bits.
 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
 * @memberof util
 * @constructor
 * @param {number} lo Low 32 bits, unsigned
 * @param {number} hi High 32 bits, unsigned
 */ function LongBits(lo, hi) {
    // note that the casts below are theoretically unnecessary as of today, but older statically
    // generated converter code might still call the ctor with signed 32bits. kept for compat.
    /**
     * Low bits.
     * @type {number}
     */ this.lo = lo >>> 0;
    /**
     * High bits.
     * @type {number}
     */ this.hi = hi >>> 0;
}
/**
 * Zero bits.
 * @memberof util.LongBits
 * @type {util.LongBits}
 */ var zero = LongBits.zero = new LongBits(0, 0);
zero.toNumber = function() {
    return 0;
};
zero.zzEncode = zero.zzDecode = function() {
    return this;
};
zero.length = function() {
    return 1;
};
/**
 * Zero hash.
 * @memberof util.LongBits
 * @type {string}
 */ var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";
/**
 * Constructs new long bits from the specified number.
 * @param {number} value Value
 * @returns {util.LongBits} Instance
 */ LongBits.fromNumber = function fromNumber(value) {
    if (value === 0) return zero;
    var sign = value < 0;
    if (sign) value = -value;
    var lo = value >>> 0, hi = (value - lo) / 4294967296 >>> 0;
    if (sign) {
        hi = ~hi >>> 0;
        lo = ~lo >>> 0;
        if (++lo > 4294967295) {
            lo = 0;
            if (++hi > 4294967295) hi = 0;
        }
    }
    return new LongBits(lo, hi);
};
/**
 * Constructs new long bits from a number, long or string.
 * @param {Long|number|string} value Value
 * @returns {util.LongBits} Instance
 */ LongBits.from = function from(value) {
    if (typeof value === "number") return LongBits.fromNumber(value);
    if (util.isString(value)) {
        /* istanbul ignore else */ if (util.Long) value = util.Long.fromString(value);
        else return LongBits.fromNumber(parseInt(value, 10));
    }
    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
};
/**
 * Converts this long bits to a possibly unsafe JavaScript number.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {number} Possibly unsafe number
 */ LongBits.prototype.toNumber = function toNumber(unsigned) {
    if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0, hi = ~this.hi >>> 0;
        if (!lo) hi = hi + 1 >>> 0;
        return -(lo + hi * 4294967296);
    }
    return this.lo + this.hi * 4294967296;
};
/**
 * Converts this long bits to a long.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long} Long
 */ LongBits.prototype.toLong = function toLong(unsigned) {
    return util.Long ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned)) : {
        low: this.lo | 0,
        high: this.hi | 0,
        unsigned: Boolean(unsigned)
    };
};
var charCodeAt = String.prototype.charCodeAt;
/**
 * Constructs new long bits from the specified 8 characters long hash.
 * @param {string} hash Hash
 * @returns {util.LongBits} Bits
 */ LongBits.fromHash = function fromHash(hash) {
    if (hash === zeroHash) return zero;
    return new LongBits((charCodeAt.call(hash, 0) | charCodeAt.call(hash, 1) << 8 | charCodeAt.call(hash, 2) << 16 | charCodeAt.call(hash, 3) << 24) >>> 0, (charCodeAt.call(hash, 4) | charCodeAt.call(hash, 5) << 8 | charCodeAt.call(hash, 6) << 16 | charCodeAt.call(hash, 7) << 24) >>> 0);
};
/**
 * Converts this long bits to a 8 characters long hash.
 * @returns {string} Hash
 */ LongBits.prototype.toHash = function toHash() {
    return String.fromCharCode(this.lo & 255, this.lo >>> 8 & 255, this.lo >>> 16 & 255, this.lo >>> 24, this.hi & 255, this.hi >>> 8 & 255, this.hi >>> 16 & 255, this.hi >>> 24);
};
/**
 * Zig-zag encodes this long bits.
 * @returns {util.LongBits} `this`
 */ LongBits.prototype.zzEncode = function zzEncode() {
    var mask = this.hi >> 31;
    this.hi = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
    this.lo = (this.lo << 1 ^ mask) >>> 0;
    return this;
};
/**
 * Zig-zag decodes this long bits.
 * @returns {util.LongBits} `this`
 */ LongBits.prototype.zzDecode = function zzDecode() {
    var mask = -(this.lo & 1);
    this.lo = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
    this.hi = (this.hi >>> 1 ^ mask) >>> 0;
    return this;
};
/**
 * Calculates the length of this longbits when encoded as a varint.
 * @returns {number} Length
 */ LongBits.prototype.length = function length() {
    var part0 = this.lo, part1 = (this.lo >>> 28 | this.hi << 4) >>> 0, part2 = this.hi >>> 24;
    return part2 === 0 ? part1 === 0 ? part0 < 16384 ? part0 < 128 ? 1 : 2 : part0 < 2097152 ? 3 : 4 : part1 < 16384 ? part1 < 128 ? 5 : 6 : part1 < 2097152 ? 7 : 8 : part2 < 128 ? 9 : 10;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var util = exports;
// used to return a Promise where callback is omitted
util.asPromise = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+aspromise@1.1.2/node_modules/@protobufjs/aspromise/index.js [app-rsc] (ecmascript)");
// converts to / from base64 encoded strings
util.base64 = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+base64@1.1.2/node_modules/@protobufjs/base64/index.js [app-rsc] (ecmascript)");
// base class of rpc.Service
util.EventEmitter = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+eventemitter@1.1.0/node_modules/@protobufjs/eventemitter/index.js [app-rsc] (ecmascript)");
// float handling accross browsers
util.float = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+float@1.0.2/node_modules/@protobufjs/float/index.js [app-rsc] (ecmascript)");
// requires modules optionally and hides the call from bundlers
util.inquire = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+inquire@1.1.0/node_modules/@protobufjs/inquire/index.js [app-rsc] (ecmascript)");
// converts to / from utf8 encoded strings
util.utf8 = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+utf8@1.1.0/node_modules/@protobufjs/utf8/index.js [app-rsc] (ecmascript)");
// provides a node-like buffer pool in the browser
util.pool = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+pool@1.1.0/node_modules/@protobufjs/pool/index.js [app-rsc] (ecmascript)");
// utility to work with the low and high bits of a 64 bit value
util.LongBits = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/longbits.js [app-rsc] (ecmascript)");
/**
 * Whether running within node or not.
 * @memberof util
 * @type {boolean}
 */ util.isNode = Boolean(typeof global !== "undefined" && global && global.process && global.process.versions && global.process.versions.node);
/**
 * Global object reference.
 * @memberof util
 * @type {Object}
 */ util.global = util.isNode && global || "undefined" !== "undefined" && window || typeof self !== "undefined" && self || this; // eslint-disable-line no-invalid-this
/**
 * An immuable empty array.
 * @memberof util
 * @type {Array.<*>}
 * @const
 */ util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes
/**
 * An immutable empty object.
 * @type {Object}
 * @const
 */ util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes
/**
 * Tests if the specified value is an integer.
 * @function
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is an integer
 */ util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
};
/**
 * Tests if the specified value is a string.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a string
 */ util.isString = function isString(value) {
    return typeof value === "string" || value instanceof String;
};
/**
 * Tests if the specified value is a non-null object.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a non-null object
 */ util.isObject = function isObject(value) {
    return value && typeof value === "object";
};
/**
 * Checks if a property on a message is considered to be present.
 * This is an alias of {@link util.isSet}.
 * @function
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */ util.isset = /**
 * Checks if a property on a message is considered to be present.
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */ util.isSet = function isSet(obj, prop) {
    var value = obj[prop];
    if (value != null && obj.hasOwnProperty(prop)) return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
    return false;
};
/**
 * Any compatible Buffer instance.
 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
 * @interface Buffer
 * @extends Uint8Array
 */ /**
 * Node's Buffer class if available.
 * @type {Constructor<Buffer>}
 */ util.Buffer = function() {
    try {
        var Buffer = util.inquire("buffer").Buffer;
        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
    } catch (e) {
        /* istanbul ignore next */ return null;
    }
}();
// Internal alias of or polyfull for Buffer.from.
util._Buffer_from = null;
// Internal alias of or polyfill for Buffer.allocUnsafe.
util._Buffer_allocUnsafe = null;
/**
 * Creates a new buffer of whatever type supported by the environment.
 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
 * @returns {Uint8Array|Buffer} Buffer
 */ util.newBuffer = function newBuffer(sizeOrArray) {
    /* istanbul ignore next */ return typeof sizeOrArray === "number" ? util.Buffer ? util._Buffer_allocUnsafe(sizeOrArray) : new util.Array(sizeOrArray) : util.Buffer ? util._Buffer_from(sizeOrArray) : typeof Uint8Array === "undefined" ? sizeOrArray : new Uint8Array(sizeOrArray);
};
/**
 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
 * @type {Constructor<Uint8Array>}
 */ util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */  : Array;
/**
 * Any compatible Long instance.
 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
 * @interface Long
 * @property {number} low Low bits
 * @property {number} high High bits
 * @property {boolean} unsigned Whether unsigned or not
 */ /**
 * Long.js's Long class if available.
 * @type {Constructor<Long>}
 */ util.Long = /* istanbul ignore next */ util.global.dcodeIO && /* istanbul ignore next */ util.global.dcodeIO.Long || /* istanbul ignore next */ util.global.Long || util.inquire("long");
/**
 * Regular expression used to verify 2 bit (`bool`) map keys.
 * @type {RegExp}
 * @const
 */ util.key2Re = /^true|false|0|1$/;
/**
 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
 * @type {RegExp}
 * @const
 */ util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;
/**
 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
 * @type {RegExp}
 * @const
 */ util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;
/**
 * Converts a number or long to an 8 characters long hash string.
 * @param {Long|number} value Value to convert
 * @returns {string} Hash
 */ util.longToHash = function longToHash(value) {
    return value ? util.LongBits.from(value).toHash() : util.LongBits.zeroHash;
};
/**
 * Converts an 8 characters long hash string to a long or number.
 * @param {string} hash Hash
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long|number} Original value
 */ util.longFromHash = function longFromHash(hash, unsigned) {
    var bits = util.LongBits.fromHash(hash);
    if (util.Long) return util.Long.fromBits(bits.lo, bits.hi, unsigned);
    return bits.toNumber(Boolean(unsigned));
};
/**
 * Merges the properties of the source object into the destination object.
 * @memberof util
 * @param {Object.<string,*>} dst Destination object
 * @param {Object.<string,*>} src Source object
 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
 * @returns {Object.<string,*>} Destination object
 */ function merge(dst, src, ifNotSet) {
    for(var keys = Object.keys(src), i = 0; i < keys.length; ++i)if (dst[keys[i]] === undefined || !ifNotSet) dst[keys[i]] = src[keys[i]];
    return dst;
}
util.merge = merge;
/**
 * Converts the first character of a string to lower case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.lcFirst = function lcFirst(str) {
    return str.charAt(0).toLowerCase() + str.substring(1);
};
/**
 * Creates a custom error constructor.
 * @memberof util
 * @param {string} name Error name
 * @returns {Constructor<Error>} Custom error constructor
 */ function newError(name) {
    function CustomError(message, properties) {
        if (!(this instanceof CustomError)) return new CustomError(message, properties);
        // Error.call(this, message);
        // ^ just returns a new error instance because the ctor can be called as a function
        Object.defineProperty(this, "message", {
            get: function() {
                return message;
            }
        });
        /* istanbul ignore next */ if (Error.captureStackTrace) Error.captureStackTrace(this, CustomError);
        else Object.defineProperty(this, "stack", {
            value: new Error().stack || ""
        });
        if (properties) merge(this, properties);
    }
    CustomError.prototype = Object.create(Error.prototype, {
        constructor: {
            value: CustomError,
            writable: true,
            enumerable: false,
            configurable: true
        },
        name: {
            get: function get() {
                return name;
            },
            set: undefined,
            enumerable: false,
            // configurable: false would accurately preserve the behavior of
            // the original, but I'm guessing that was not intentional.
            // For an actual error subclass, this property would
            // be configurable.
            configurable: true
        },
        toString: {
            value: function value() {
                return this.name + ": " + this.message;
            },
            writable: true,
            enumerable: false,
            configurable: true
        }
    });
    return CustomError;
}
util.newError = newError;
/**
 * Constructs a new protocol error.
 * @classdesc Error subclass indicating a protocol specifc error.
 * @memberof util
 * @extends Error
 * @template T extends Message<T>
 * @constructor
 * @param {string} message Error message
 * @param {Object.<string,*>} [properties] Additional properties
 * @example
 * try {
 *     MyMessage.decode(someBuffer); // throws if required fields are missing
 * } catch (e) {
 *     if (e instanceof ProtocolError && e.instance)
 *         console.log("decoded so far: " + JSON.stringify(e.instance));
 * }
 */ util.ProtocolError = newError("ProtocolError");
/**
 * So far decoded message instance.
 * @name util.ProtocolError#instance
 * @type {Message<T>}
 */ /**
 * A OneOf getter as returned by {@link util.oneOfGetter}.
 * @typedef OneOfGetter
 * @type {function}
 * @returns {string|undefined} Set field name, if any
 */ /**
 * Builds a getter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfGetter} Unbound getter
 */ util.oneOfGetter = function getOneOf(fieldNames) {
    var fieldMap = {};
    for(var i = 0; i < fieldNames.length; ++i)fieldMap[fieldNames[i]] = 1;
    /**
     * @returns {string|undefined} Set field name, if any
     * @this Object
     * @ignore
     */ return function() {
        for(var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null) return keys[i];
    };
};
/**
 * A OneOf setter as returned by {@link util.oneOfSetter}.
 * @typedef OneOfSetter
 * @type {function}
 * @param {string|undefined} value Field name
 * @returns {undefined}
 */ /**
 * Builds a setter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfSetter} Unbound setter
 */ util.oneOfSetter = function setOneOf(fieldNames) {
    /**
     * @param {string} name Field name
     * @returns {undefined}
     * @this Object
     * @ignore
     */ return function(name) {
        for(var i = 0; i < fieldNames.length; ++i)if (fieldNames[i] !== name) delete this[fieldNames[i]];
    };
};
/**
 * Default conversion options used for {@link Message#toJSON} implementations.
 *
 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
 *
 * - Longs become strings
 * - Enums become string keys
 * - Bytes become base64 encoded strings
 * - (Sub-)Messages become plain objects
 * - Maps become plain objects with all string keys
 * - Repeated fields become arrays
 * - NaN and Infinity for float and double fields become strings
 *
 * @type {IConversionOptions}
 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
 */ util.toJSONOptions = {
    longs: String,
    enums: String,
    bytes: String,
    json: true
};
// Sets up buffer utility according to the environment (called in index-minimal)
util._configure = function() {
    var Buffer = util.Buffer;
    /* istanbul ignore if */ if (!Buffer) {
        util._Buffer_from = util._Buffer_allocUnsafe = null;
        return;
    }
    // because node 4.x buffers are incompatible & immutable
    // see: https://github.com/dcodeIO/protobuf.js/pull/665
    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from || /* istanbul ignore next */ function Buffer_from(value, encoding) {
        return new Buffer(value, encoding);
    };
    util._Buffer_allocUnsafe = Buffer.allocUnsafe || /* istanbul ignore next */ function Buffer_allocUnsafe(size) {
        return new Buffer(size);
    };
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/roots.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = {}; /**
 * Named roots.
 * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
 * Can also be used manually to make roots available across modules.
 * @name roots
 * @type {Object.<string,Root>}
 * @example
 * // pbjs -r myroot -o compiled.js ...
 *
 * // in another module:
 * require("./compiled.js");
 *
 * // in any subsequent module:
 * var root = protobuf.roots["myroot"];
 */ 
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * Common type constants.
 * @namespace
 */ var types = exports;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
var s = [
    "double",
    "float",
    "int32",
    "uint32",
    "sint32",
    "fixed32",
    "sfixed32",
    "int64",
    "uint64",
    "sint64",
    "fixed64",
    "sfixed64",
    "bool",
    "string",
    "bytes" // 14
];
function bake(values, offset) {
    var i = 0, o = {};
    offset |= 0;
    while(i < values.length)o[s[i + offset]] = values[i++];
    return o;
}
/**
 * Basic type wire types.
 * @type {Object.<string,number>}
 * @const
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 * @property {number} bytes=2 Ldelim wire type
 */ types.basic = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2,
    /* bytes    */ 2
]);
/**
 * Basic type defaults.
 * @type {Object.<string,*>}
 * @const
 * @property {number} double=0 Double default
 * @property {number} float=0 Float default
 * @property {number} int32=0 Int32 default
 * @property {number} uint32=0 Uint32 default
 * @property {number} sint32=0 Sint32 default
 * @property {number} fixed32=0 Fixed32 default
 * @property {number} sfixed32=0 Sfixed32 default
 * @property {number} int64=0 Int64 default
 * @property {number} uint64=0 Uint64 default
 * @property {number} sint64=0 Sint32 default
 * @property {number} fixed64=0 Fixed64 default
 * @property {number} sfixed64=0 Sfixed64 default
 * @property {boolean} bool=false Bool default
 * @property {string} string="" String default
 * @property {Array.<number>} bytes=Array(0) Bytes default
 * @property {null} message=null Message default
 */ types.defaults = bake([
    /* double   */ 0,
    /* float    */ 0,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 0,
    /* sfixed32 */ 0,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 0,
    /* sfixed64 */ 0,
    /* bool     */ false,
    /* string   */ "",
    /* bytes    */ util.emptyArray,
    /* message  */ null
]);
/**
 * Basic long type wire types.
 * @type {Object.<string,number>}
 * @const
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 */ types.long = bake([
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1
], 7);
/**
 * Allowed types for map keys with their associated wire type.
 * @type {Object.<string,number>}
 * @const
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 */ types.mapKey = bake([
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2
], 2);
/**
 * Allowed types for packed repeated fields with their associated wire type.
 * @type {Object.<string,number>}
 * @const
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 */ types.packed = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0
]);
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Field;
// extends ReflectionObject
var ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = "Field";
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
var Type; // cyclic
var ruleRe = /^required|optional|repeated$/;
/**
 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
 * @name Field
 * @classdesc Reflected message field.
 * @extends FieldBase
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} type Value type
 * @param {string|Object.<string,*>} [rule="optional"] Field rule
 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
 * @param {Object.<string,*>} [options] Declared options
 */ /**
 * Constructs a field from a field descriptor.
 * @param {string} name Field name
 * @param {IField} json Field descriptor
 * @returns {Field} Created field
 * @throws {TypeError} If arguments are invalid
 */ Field.fromJSON = function fromJSON(name, json) {
    return new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment);
};
/**
 * Not an actual constructor. Use {@link Field} instead.
 * @classdesc Base class of all reflected message fields. This is not an actual class but here for the sake of having consistent type definitions.
 * @exports FieldBase
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} type Value type
 * @param {string|Object.<string,*>} [rule="optional"] Field rule
 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function Field(name, id, type, rule, extend, options, comment) {
    if (util.isObject(rule)) {
        comment = extend;
        options = rule;
        rule = extend = undefined;
    } else if (util.isObject(extend)) {
        comment = options;
        options = extend;
        extend = undefined;
    }
    ReflectionObject.call(this, name, options);
    if (!util.isInteger(id) || id < 0) throw TypeError("id must be a non-negative integer");
    if (!util.isString(type)) throw TypeError("type must be a string");
    if (rule !== undefined && !ruleRe.test(rule = rule.toString().toLowerCase())) throw TypeError("rule must be a string rule");
    if (extend !== undefined && !util.isString(extend)) throw TypeError("extend must be a string");
    /**
     * Field rule, if any.
     * @type {string|undefined}
     */ if (rule === "proto3_optional") {
        rule = "optional";
    }
    this.rule = rule && rule !== "optional" ? rule : undefined; // toJSON
    /**
     * Field type.
     * @type {string}
     */ this.type = type; // toJSON
    /**
     * Unique field id.
     * @type {number}
     */ this.id = id; // toJSON, marker
    /**
     * Extended type if different from parent.
     * @type {string|undefined}
     */ this.extend = extend || undefined; // toJSON
    /**
     * Whether this field is required.
     * @type {boolean}
     */ this.required = rule === "required";
    /**
     * Whether this field is optional.
     * @type {boolean}
     */ this.optional = !this.required;
    /**
     * Whether this field is repeated.
     * @type {boolean}
     */ this.repeated = rule === "repeated";
    /**
     * Whether this field is a map or not.
     * @type {boolean}
     */ this.map = false;
    /**
     * Message this field belongs to.
     * @type {Type|null}
     */ this.message = null;
    /**
     * OneOf this field belongs to, if any,
     * @type {OneOf|null}
     */ this.partOf = null;
    /**
     * The field type's default value.
     * @type {*}
     */ this.typeDefault = null;
    /**
     * The field's default value on prototypes.
     * @type {*}
     */ this.defaultValue = null;
    /**
     * Whether this field's value should be treated as a long.
     * @type {boolean}
     */ this.long = util.Long ? types.long[type] !== undefined : /* istanbul ignore next */ false;
    /**
     * Whether this field's value is a buffer.
     * @type {boolean}
     */ this.bytes = type === "bytes";
    /**
     * Resolved type if not a basic type.
     * @type {Type|Enum|null}
     */ this.resolvedType = null;
    /**
     * Sister-field within the extended type if a declaring extension field.
     * @type {Field|null}
     */ this.extensionField = null;
    /**
     * Sister-field within the declaring namespace if an extended field.
     * @type {Field|null}
     */ this.declaringField = null;
    /**
     * Internally remembers whether this field is packed.
     * @type {boolean|null}
     * @private
     */ this._packed = null;
    /**
     * Comment for this field.
     * @type {string|null}
     */ this.comment = comment;
}
/**
 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
 * @name Field#packed
 * @type {boolean}
 * @readonly
 */ Object.defineProperty(Field.prototype, "packed", {
    get: function() {
        // defaults to packed=true if not explicity set to false
        if (this._packed === null) this._packed = this.getOption("packed") !== false;
        return this._packed;
    }
});
/**
 * @override
 */ Field.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (name === "packed") this._packed = null;
    return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
};
/**
 * Field descriptor.
 * @interface IField
 * @property {string} [rule="optional"] Field rule
 * @property {string} type Field type
 * @property {number} id Field id
 * @property {Object.<string,*>} [options] Field options
 */ /**
 * Extension field descriptor.
 * @interface IExtensionField
 * @extends IField
 * @property {string} extend Extended type
 */ /**
 * Converts this field to a field descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IField} Field descriptor
 */ Field.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "rule",
        this.rule !== "optional" && this.rule || undefined,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Resolves this field's type references.
 * @returns {Field} `this`
 * @throws {Error} If any reference cannot be resolved
 */ Field.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    if ((this.typeDefault = types.defaults[this.type]) === undefined) {
        this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type);
        if (this.resolvedType instanceof Type) this.typeDefault = null;
        else this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]; // first defined
    } else if (this.options && this.options.proto3_optional) {
        // proto3 scalar value marked optional; should default to null
        this.typeDefault = null;
    }
    // use explicitly set default value if present
    if (this.options && this.options["default"] != null) {
        this.typeDefault = this.options["default"];
        if (this.resolvedType instanceof Enum && typeof this.typeDefault === "string") this.typeDefault = this.resolvedType.values[this.typeDefault];
    }
    // remove unnecessary options
    if (this.options) {
        if (this.options.packed === true || this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum)) delete this.options.packed;
        if (!Object.keys(this.options).length) this.options = undefined;
    }
    // convert to internal data type if necesssary
    if (this.long) {
        this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === "u");
        /* istanbul ignore else */ if (Object.freeze) Object.freeze(this.typeDefault); // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)
    } else if (this.bytes && typeof this.typeDefault === "string") {
        var buf;
        if (util.base64.test(this.typeDefault)) util.base64.decode(this.typeDefault, buf = util.newBuffer(util.base64.length(this.typeDefault)), 0);
        else util.utf8.write(this.typeDefault, buf = util.newBuffer(util.utf8.length(this.typeDefault)), 0);
        this.typeDefault = buf;
    }
    // take special care of maps and repeated fields
    if (this.map) this.defaultValue = util.emptyObject;
    else if (this.repeated) this.defaultValue = util.emptyArray;
    else this.defaultValue = this.typeDefault;
    // ensure proper value on prototype
    if (this.parent instanceof Type) this.parent.ctor.prototype[this.name] = this.defaultValue;
    return ReflectionObject.prototype.resolve.call(this);
};
/**
 * Decorator function as returned by {@link Field.d} and {@link MapField.d} (TypeScript).
 * @typedef FieldDecorator
 * @type {function}
 * @param {Object} prototype Target prototype
 * @param {string} fieldName Field name
 * @returns {undefined}
 */ /**
 * Field decorator (TypeScript).
 * @name Field.d
 * @function
 * @param {number} fieldId Field id
 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"string"|"bool"|"bytes"|Object} fieldType Field type
 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
 * @param {T} [defaultValue] Default value
 * @returns {FieldDecorator} Decorator function
 * @template T extends number | number[] | Long | Long[] | string | string[] | boolean | boolean[] | Uint8Array | Uint8Array[] | Buffer | Buffer[]
 */ Field.d = function decorateField(fieldId, fieldType, fieldRule, defaultValue) {
    // submessage: decorate the submessage and use its name as the type
    if (typeof fieldType === "function") fieldType = util.decorateType(fieldType).name;
    else if (fieldType && typeof fieldType === "object") fieldType = util.decorateEnum(fieldType).name;
    return function fieldDecorator(prototype, fieldName) {
        util.decorateType(prototype.constructor).add(new Field(fieldName, fieldId, fieldType, fieldRule, {
            "default": defaultValue
        }));
    };
};
/**
 * Field decorator (TypeScript).
 * @name Field.d
 * @function
 * @param {number} fieldId Field id
 * @param {Constructor<T>|string} fieldType Field type
 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
 * @returns {FieldDecorator} Decorator function
 * @template T extends Message<T>
 * @variation 2
 */ // like Field.d but without a default value
// Sets up cyclic dependencies (called in index-light)
Field._configure = function configure(Type_) {
    Type = Type_;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = OneOf;
// extends ReflectionObject
var ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = "OneOf";
var Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Constructs a new oneof instance.
 * @classdesc Reflected oneof.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Oneof name
 * @param {string[]|Object.<string,*>} [fieldNames] Field names
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function OneOf(name, fieldNames, options, comment) {
    if (!Array.isArray(fieldNames)) {
        options = fieldNames;
        fieldNames = undefined;
    }
    ReflectionObject.call(this, name, options);
    /* istanbul ignore if */ if (!(fieldNames === undefined || Array.isArray(fieldNames))) throw TypeError("fieldNames must be an Array");
    /**
     * Field names that belong to this oneof.
     * @type {string[]}
     */ this.oneof = fieldNames || []; // toJSON, marker
    /**
     * Fields that belong to this oneof as an array for iteration.
     * @type {Field[]}
     * @readonly
     */ this.fieldsArray = []; // declared readonly for conformance, possibly not yet added to parent
    /**
     * Comment for this field.
     * @type {string|null}
     */ this.comment = comment;
}
/**
 * Oneof descriptor.
 * @interface IOneOf
 * @property {Array.<string>} oneof Oneof field names
 * @property {Object.<string,*>} [options] Oneof options
 */ /**
 * Constructs a oneof from a oneof descriptor.
 * @param {string} name Oneof name
 * @param {IOneOf} json Oneof descriptor
 * @returns {OneOf} Created oneof
 * @throws {TypeError} If arguments are invalid
 */ OneOf.fromJSON = function fromJSON(name, json) {
    return new OneOf(name, json.oneof, json.options, json.comment);
};
/**
 * Converts this oneof to a oneof descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IOneOf} Oneof descriptor
 */ OneOf.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        this.options,
        "oneof",
        this.oneof,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Adds the fields of the specified oneof to the parent if not already done so.
 * @param {OneOf} oneof The oneof
 * @returns {undefined}
 * @inner
 * @ignore
 */ function addFieldsToParent(oneof) {
    if (oneof.parent) {
        for(var i = 0; i < oneof.fieldsArray.length; ++i)if (!oneof.fieldsArray[i].parent) oneof.parent.add(oneof.fieldsArray[i]);
    }
}
/**
 * Adds a field to this oneof and removes it from its current parent, if any.
 * @param {Field} field Field to add
 * @returns {OneOf} `this`
 */ OneOf.prototype.add = function add(field) {
    /* istanbul ignore if */ if (!(field instanceof Field)) throw TypeError("field must be a Field");
    if (field.parent && field.parent !== this.parent) field.parent.remove(field);
    this.oneof.push(field.name);
    this.fieldsArray.push(field);
    field.partOf = this; // field.parent remains null
    addFieldsToParent(this);
    return this;
};
/**
 * Removes a field from this oneof and puts it back to the oneof's parent.
 * @param {Field} field Field to remove
 * @returns {OneOf} `this`
 */ OneOf.prototype.remove = function remove(field) {
    /* istanbul ignore if */ if (!(field instanceof Field)) throw TypeError("field must be a Field");
    var index = this.fieldsArray.indexOf(field);
    /* istanbul ignore if */ if (index < 0) throw Error(field + " is not a member of " + this);
    this.fieldsArray.splice(index, 1);
    index = this.oneof.indexOf(field.name);
    /* istanbul ignore else */ if (index > -1) this.oneof.splice(index, 1);
    field.partOf = null;
    return this;
};
/**
 * @override
 */ OneOf.prototype.onAdd = function onAdd(parent) {
    ReflectionObject.prototype.onAdd.call(this, parent);
    var self = this;
    // Collect present fields
    for(var i = 0; i < this.oneof.length; ++i){
        var field = parent.get(this.oneof[i]);
        if (field && !field.partOf) {
            field.partOf = self;
            self.fieldsArray.push(field);
        }
    }
    // Add not yet present fields
    addFieldsToParent(this);
};
/**
 * @override
 */ OneOf.prototype.onRemove = function onRemove(parent) {
    for(var i = 0, field; i < this.fieldsArray.length; ++i)if ((field = this.fieldsArray[i]).parent) field.parent.remove(field);
    ReflectionObject.prototype.onRemove.call(this, parent);
};
/**
 * Decorator function as returned by {@link OneOf.d} (TypeScript).
 * @typedef OneOfDecorator
 * @type {function}
 * @param {Object} prototype Target prototype
 * @param {string} oneofName OneOf name
 * @returns {undefined}
 */ /**
 * OneOf decorator (TypeScript).
 * @function
 * @param {...string} fieldNames Field names
 * @returns {OneOfDecorator} Decorator function
 * @template T extends string
 */ OneOf.d = function decorateOneOf() {
    var fieldNames = new Array(arguments.length), index = 0;
    while(index < arguments.length)fieldNames[index] = arguments[index++];
    return function oneOfDecorator(prototype, oneofName) {
        util.decorateType(prototype.constructor).add(new OneOf(oneofName, fieldNames));
        Object.defineProperty(prototype, oneofName, {
            get: util.oneOfGetter(fieldNames),
            set: util.oneOfSetter(fieldNames)
        });
    };
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Namespace;
// extends ReflectionObject
var ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = "Namespace";
var Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)"), OneOf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)");
var Type, Service, Enum;
/**
 * Constructs a new namespace instance.
 * @name Namespace
 * @classdesc Reflected namespace.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 */ /**
 * Constructs a namespace from JSON.
 * @memberof Namespace
 * @function
 * @param {string} name Namespace name
 * @param {Object.<string,*>} json JSON object
 * @returns {Namespace} Created namespace
 * @throws {TypeError} If arguments are invalid
 */ Namespace.fromJSON = function fromJSON(name, json) {
    return new Namespace(name, json.options).addJSON(json.nested);
};
/**
 * Converts an array of reflection objects to JSON.
 * @memberof Namespace
 * @param {ReflectionObject[]} array Object array
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
 */ function arrayToJSON(array, toJSONOptions) {
    if (!(array && array.length)) return undefined;
    var obj = {};
    for(var i = 0; i < array.length; ++i)obj[array[i].name] = array[i].toJSON(toJSONOptions);
    return obj;
}
Namespace.arrayToJSON = arrayToJSON;
/**
 * Tests if the specified id is reserved.
 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Namespace.isReservedId = function isReservedId(reserved, id) {
    if (reserved) {
        for(var i = 0; i < reserved.length; ++i)if (typeof reserved[i] !== "string" && reserved[i][0] <= id && reserved[i][1] > id) return true;
    }
    return false;
};
/**
 * Tests if the specified name is reserved.
 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Namespace.isReservedName = function isReservedName(reserved, name) {
    if (reserved) {
        for(var i = 0; i < reserved.length; ++i)if (reserved[i] === name) return true;
    }
    return false;
};
/**
 * Not an actual constructor. Use {@link Namespace} instead.
 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
 * @exports NamespaceBase
 * @extends ReflectionObject
 * @abstract
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 * @see {@link Namespace}
 */ function Namespace(name, options) {
    ReflectionObject.call(this, name, options);
    /**
     * Nested objects by name.
     * @type {Object.<string,ReflectionObject>|undefined}
     */ this.nested = undefined; // toJSON
    /**
     * Cached nested objects as an array.
     * @type {ReflectionObject[]|null}
     * @private
     */ this._nestedArray = null;
}
function clearCache(namespace) {
    namespace._nestedArray = null;
    return namespace;
}
/**
 * Nested objects of this namespace as an array for iteration.
 * @name NamespaceBase#nestedArray
 * @type {ReflectionObject[]}
 * @readonly
 */ Object.defineProperty(Namespace.prototype, "nestedArray", {
    get: function() {
        return this._nestedArray || (this._nestedArray = util.toArray(this.nested));
    }
});
/**
 * Namespace descriptor.
 * @interface INamespace
 * @property {Object.<string,*>} [options] Namespace options
 * @property {Object.<string,AnyNestedObject>} [nested] Nested object descriptors
 */ /**
 * Any extension field descriptor.
 * @typedef AnyExtensionField
 * @type {IExtensionField|IExtensionMapField}
 */ /**
 * Any nested object descriptor.
 * @typedef AnyNestedObject
 * @type {IEnum|IType|IService|AnyExtensionField|INamespace|IOneOf}
 */ /**
 * Converts this namespace to a namespace descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {INamespace} Namespace descriptor
 */ Namespace.prototype.toJSON = function toJSON(toJSONOptions) {
    return util.toObject([
        "options",
        this.options,
        "nested",
        arrayToJSON(this.nestedArray, toJSONOptions)
    ]);
};
/**
 * Adds nested objects to this namespace from nested object descriptors.
 * @param {Object.<string,AnyNestedObject>} nestedJson Any nested object descriptors
 * @returns {Namespace} `this`
 */ Namespace.prototype.addJSON = function addJSON(nestedJson) {
    var ns = this;
    /* istanbul ignore else */ if (nestedJson) {
        for(var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i){
            nested = nestedJson[names[i]];
            ns.add((nested.fields !== undefined ? Type.fromJSON : nested.values !== undefined ? Enum.fromJSON : nested.methods !== undefined ? Service.fromJSON : nested.id !== undefined ? Field.fromJSON : Namespace.fromJSON)(names[i], nested));
        }
    }
    return this;
};
/**
 * Gets the nested object of the specified name.
 * @param {string} name Nested object name
 * @returns {ReflectionObject|null} The reflection object or `null` if it doesn't exist
 */ Namespace.prototype.get = function get(name) {
    return this.nested && this.nested[name] || null;
};
/**
 * Gets the values of the nested {@link Enum|enum} of the specified name.
 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
 * @param {string} name Nested enum name
 * @returns {Object.<string,number>} Enum values
 * @throws {Error} If there is no such enum
 */ Namespace.prototype.getEnum = function getEnum(name) {
    if (this.nested && this.nested[name] instanceof Enum) return this.nested[name].values;
    throw Error("no such enum: " + name);
};
/**
 * Adds a nested object to this namespace.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name
 */ Namespace.prototype.add = function add(object) {
    if (!(object instanceof Field && object.extend !== undefined || object instanceof Type || object instanceof OneOf || object instanceof Enum || object instanceof Service || object instanceof Namespace)) throw TypeError("object must be a valid nested object");
    if (!this.nested) this.nested = {};
    else {
        var prev = this.get(object.name);
        if (prev) {
            if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
                // replace plain namespace but keep existing nested elements and options
                var nested = prev.nestedArray;
                for(var i = 0; i < nested.length; ++i)object.add(nested[i]);
                this.remove(prev);
                if (!this.nested) this.nested = {};
                object.setOptions(prev.options, true);
            } else throw Error("duplicate name '" + object.name + "' in " + this);
        }
    }
    this.nested[object.name] = object;
    object.onAdd(this);
    return clearCache(this);
};
/**
 * Removes a nested object from this namespace.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this namespace
 */ Namespace.prototype.remove = function remove(object) {
    if (!(object instanceof ReflectionObject)) throw TypeError("object must be a ReflectionObject");
    if (object.parent !== this) throw Error(object + " is not a member of " + this);
    delete this.nested[object.name];
    if (!Object.keys(this.nested).length) this.nested = undefined;
    object.onRemove(this);
    return clearCache(this);
};
/**
 * Defines additial namespaces within this one if not yet existing.
 * @param {string|string[]} path Path to create
 * @param {*} [json] Nested types to create from JSON
 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
 */ Namespace.prototype.define = function define(path, json) {
    if (util.isString(path)) path = path.split(".");
    else if (!Array.isArray(path)) throw TypeError("illegal path");
    if (path && path.length && path[0] === "") throw Error("path must be relative");
    var ptr = this;
    while(path.length > 0){
        var part = path.shift();
        if (ptr.nested && ptr.nested[part]) {
            ptr = ptr.nested[part];
            if (!(ptr instanceof Namespace)) throw Error("path conflicts with non-namespace objects");
        } else ptr.add(ptr = new Namespace(part));
    }
    if (json) ptr.addJSON(json);
    return ptr;
};
/**
 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
 * @returns {Namespace} `this`
 */ Namespace.prototype.resolveAll = function resolveAll() {
    var nested = this.nestedArray, i = 0;
    while(i < nested.length)if (nested[i] instanceof Namespace) nested[i++].resolveAll();
    else nested[i++].resolve();
    return this.resolve();
};
/**
 * Recursively looks up the reflection object matching the specified path in the scope of this namespace.
 * @param {string|string[]} path Path to look up
 * @param {*|Array.<*>} filterTypes Filter types, any combination of the constructors of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
 */ Namespace.prototype.lookup = function lookup(path, filterTypes, parentAlreadyChecked) {
    /* istanbul ignore next */ if (typeof filterTypes === "boolean") {
        parentAlreadyChecked = filterTypes;
        filterTypes = undefined;
    } else if (filterTypes && !Array.isArray(filterTypes)) filterTypes = [
        filterTypes
    ];
    if (util.isString(path) && path.length) {
        if (path === ".") return this.root;
        path = path.split(".");
    } else if (!path.length) return this;
    // Start at root if path is absolute
    if (path[0] === "") return this.root.lookup(path.slice(1), filterTypes);
    // Test if the first part matches any nested object, and if so, traverse if path contains more
    var found = this.get(path[0]);
    if (found) {
        if (path.length === 1) {
            if (!filterTypes || filterTypes.indexOf(found.constructor) > -1) return found;
        } else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterTypes, true))) return found;
    // Otherwise try each nested namespace
    } else for(var i = 0; i < this.nestedArray.length; ++i)if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i].lookup(path, filterTypes, true))) return found;
    // If there hasn't been a match, try again at the parent
    if (this.parent === null || parentAlreadyChecked) return null;
    return this.parent.lookup(path, filterTypes);
};
/**
 * Looks up the reflection object at the specified path, relative to this namespace.
 * @name NamespaceBase#lookup
 * @function
 * @param {string|string[]} path Path to look up
 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
 * @variation 2
 */ // lookup(path: string, [parentAlreadyChecked: boolean])
/**
 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Type} Looked up type
 * @throws {Error} If `path` does not point to a type
 */ Namespace.prototype.lookupType = function lookupType(path) {
    var found = this.lookup(path, [
        Type
    ]);
    if (!found) throw Error("no such type: " + path);
    return found;
};
/**
 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Enum} Looked up enum
 * @throws {Error} If `path` does not point to an enum
 */ Namespace.prototype.lookupEnum = function lookupEnum(path) {
    var found = this.lookup(path, [
        Enum
    ]);
    if (!found) throw Error("no such Enum '" + path + "' in " + this);
    return found;
};
/**
 * Looks up the {@link Type|type} or {@link Enum|enum} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Type} Looked up type or enum
 * @throws {Error} If `path` does not point to a type or enum
 */ Namespace.prototype.lookupTypeOrEnum = function lookupTypeOrEnum(path) {
    var found = this.lookup(path, [
        Type,
        Enum
    ]);
    if (!found) throw Error("no such Type or Enum '" + path + "' in " + this);
    return found;
};
/**
 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Service} Looked up service
 * @throws {Error} If `path` does not point to a service
 */ Namespace.prototype.lookupService = function lookupService(path) {
    var found = this.lookup(path, [
        Service
    ]);
    if (!found) throw Error("no such Service '" + path + "' in " + this);
    return found;
};
// Sets up cyclic dependencies (called in index-light)
Namespace._configure = function(Type_, Service_, Enum_) {
    Type = Type_;
    Service = Service_;
    Enum = Enum_;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/mapfield.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = MapField;
// extends Field
var Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)");
((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = "MapField";
var types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Constructs a new map field instance.
 * @classdesc Reflected map field.
 * @extends FieldBase
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} keyType Key type
 * @param {string} type Value type
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function MapField(name, id, keyType, type, options, comment) {
    Field.call(this, name, id, type, undefined, undefined, options, comment);
    /* istanbul ignore if */ if (!util.isString(keyType)) throw TypeError("keyType must be a string");
    /**
     * Key type.
     * @type {string}
     */ this.keyType = keyType; // toJSON, marker
    /**
     * Resolved key type if not a basic type.
     * @type {ReflectionObject|null}
     */ this.resolvedKeyType = null;
    // Overrides Field#map
    this.map = true;
}
/**
 * Map field descriptor.
 * @interface IMapField
 * @extends {IField}
 * @property {string} keyType Key type
 */ /**
 * Extension map field descriptor.
 * @interface IExtensionMapField
 * @extends IMapField
 * @property {string} extend Extended type
 */ /**
 * Constructs a map field from a map field descriptor.
 * @param {string} name Field name
 * @param {IMapField} json Map field descriptor
 * @returns {MapField} Created map field
 * @throws {TypeError} If arguments are invalid
 */ MapField.fromJSON = function fromJSON(name, json) {
    return new MapField(name, json.id, json.keyType, json.type, json.options, json.comment);
};
/**
 * Converts this map field to a map field descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IMapField} Map field descriptor
 */ MapField.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "keyType",
        this.keyType,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * @override
 */ MapField.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    // Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
    if (types.mapKey[this.keyType] === undefined) throw Error("invalid key type: " + this.keyType);
    return Field.prototype.resolve.call(this);
};
/**
 * Map field decorator (TypeScript).
 * @name MapField.d
 * @function
 * @param {number} fieldId Field id
 * @param {"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"} fieldKeyType Field key type
 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"|"bytes"|Object|Constructor<{}>} fieldValueType Field value type
 * @returns {FieldDecorator} Decorator function
 * @template T extends { [key: string]: number | Long | string | boolean | Uint8Array | Buffer | number[] | Message<{}> }
 */ MapField.d = function decorateMapField(fieldId, fieldKeyType, fieldValueType) {
    // submessage value: decorate the submessage and use its name as the type
    if (typeof fieldValueType === "function") fieldValueType = util.decorateType(fieldValueType).name;
    else if (fieldValueType && typeof fieldValueType === "object") fieldValueType = util.decorateEnum(fieldValueType).name;
    return function mapFieldDecorator(prototype, fieldName) {
        util.decorateType(prototype.constructor).add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
    };
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/method.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Method;
// extends ReflectionObject
var ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = "Method";
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Constructs a new service method instance.
 * @classdesc Reflected service method.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Method name
 * @param {string|undefined} type Method type, usually `"rpc"`
 * @param {string} requestType Request message type
 * @param {string} responseType Response message type
 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] The comment for this method
 * @param {Object.<string,*>} [parsedOptions] Declared options, properly parsed into an object
 */ function Method(name, type, requestType, responseType, requestStream, responseStream, options, comment, parsedOptions) {
    /* istanbul ignore next */ if (util.isObject(requestStream)) {
        options = requestStream;
        requestStream = responseStream = undefined;
    } else if (util.isObject(responseStream)) {
        options = responseStream;
        responseStream = undefined;
    }
    /* istanbul ignore if */ if (!(type === undefined || util.isString(type))) throw TypeError("type must be a string");
    /* istanbul ignore if */ if (!util.isString(requestType)) throw TypeError("requestType must be a string");
    /* istanbul ignore if */ if (!util.isString(responseType)) throw TypeError("responseType must be a string");
    ReflectionObject.call(this, name, options);
    /**
     * Method type.
     * @type {string}
     */ this.type = type || "rpc"; // toJSON
    /**
     * Request type.
     * @type {string}
     */ this.requestType = requestType; // toJSON, marker
    /**
     * Whether requests are streamed or not.
     * @type {boolean|undefined}
     */ this.requestStream = requestStream ? true : undefined; // toJSON
    /**
     * Response type.
     * @type {string}
     */ this.responseType = responseType; // toJSON
    /**
     * Whether responses are streamed or not.
     * @type {boolean|undefined}
     */ this.responseStream = responseStream ? true : undefined; // toJSON
    /**
     * Resolved request type.
     * @type {Type|null}
     */ this.resolvedRequestType = null;
    /**
     * Resolved response type.
     * @type {Type|null}
     */ this.resolvedResponseType = null;
    /**
     * Comment for this method
     * @type {string|null}
     */ this.comment = comment;
    /**
     * Options properly parsed into an object
     */ this.parsedOptions = parsedOptions;
}
/**
 * Method descriptor.
 * @interface IMethod
 * @property {string} [type="rpc"] Method type
 * @property {string} requestType Request type
 * @property {string} responseType Response type
 * @property {boolean} [requestStream=false] Whether requests are streamed
 * @property {boolean} [responseStream=false] Whether responses are streamed
 * @property {Object.<string,*>} [options] Method options
 * @property {string} comment Method comments
 * @property {Object.<string,*>} [parsedOptions] Method options properly parsed into an object
 */ /**
 * Constructs a method from a method descriptor.
 * @param {string} name Method name
 * @param {IMethod} json Method descriptor
 * @returns {Method} Created method
 * @throws {TypeError} If arguments are invalid
 */ Method.fromJSON = function fromJSON(name, json) {
    return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options, json.comment, json.parsedOptions);
};
/**
 * Converts this method to a method descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IMethod} Method descriptor
 */ Method.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "type",
        this.type !== "rpc" && /* istanbul ignore next */ this.type || undefined,
        "requestType",
        this.requestType,
        "requestStream",
        this.requestStream,
        "responseType",
        this.responseType,
        "responseStream",
        this.responseStream,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined,
        "parsedOptions",
        this.parsedOptions
    ]);
};
/**
 * @override
 */ Method.prototype.resolve = function resolve() {
    /* istanbul ignore if */ if (this.resolved) return this;
    this.resolvedRequestType = this.parent.lookupType(this.requestType);
    this.resolvedResponseType = this.parent.lookupType(this.responseType);
    return ReflectionObject.prototype.resolve.call(this);
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/rpc/service.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Service;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
// Extends EventEmitter
(Service.prototype = Object.create(util.EventEmitter.prototype)).constructor = Service;
/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 *
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {TRes} [response] Response message
 * @returns {undefined}
 */ /**
 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
 */ /**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */ function Service(rpcImpl, requestDelimited, responseDelimited) {
    if (typeof rpcImpl !== "function") throw TypeError("rpcImpl must be a function");
    util.EventEmitter.call(this);
    /**
     * RPC implementation. Becomes `null` once the service is ended.
     * @type {RPCImpl|null}
     */ this.rpcImpl = rpcImpl;
    /**
     * Whether requests are length-delimited.
     * @type {boolean}
     */ this.requestDelimited = Boolean(requestDelimited);
    /**
     * Whether responses are length-delimited.
     * @type {boolean}
     */ this.responseDelimited = Boolean(responseDelimited);
}
/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
 * @param {Constructor<TReq>} requestCtor Request constructor
 * @param {Constructor<TRes>} responseCtor Response constructor
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
 * @returns {undefined}
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 */ Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
    if (!request) throw TypeError("request must be specified");
    var self = this;
    if (!callback) return util.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);
    if (!self.rpcImpl) {
        setTimeout(function() {
            callback(Error("already ended"));
        }, 0);
        return undefined;
    }
    try {
        return self.rpcImpl(method, requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(), function rpcCallback(err, response) {
            if (err) {
                self.emit("error", err, method);
                return callback(err);
            }
            if (response === null) {
                self.end(/* endedByRPC */ true);
                return undefined;
            }
            if (!(response instanceof responseCtor)) {
                try {
                    response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
                } catch (err) {
                    self.emit("error", err, method);
                    return callback(err);
                }
            }
            self.emit("data", response, method);
            return callback(null, response);
        });
    } catch (err) {
        self.emit("error", err, method);
        setTimeout(function() {
            callback(err);
        }, 0);
        return undefined;
    }
};
/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */ Service.prototype.end = function end(endedByRPC) {
    if (this.rpcImpl) {
        if (!endedByRPC) this.rpcImpl(null, null, null);
        this.rpcImpl = null;
        this.emit("end").off();
    }
    return this;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/rpc.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * Streaming RPC helpers.
 * @namespace
 */ var rpc = exports;
/**
 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
 * @typedef RPCImpl
 * @type {function}
 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
 * @param {Uint8Array} requestData Request data
 * @param {RPCImplCallback} callback Callback function
 * @returns {undefined}
 * @example
 * function rpcImpl(method, requestData, callback) {
 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
 *         throw Error("no such method");
 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
 *         callback(err, responseData);
 *     });
 * }
 */ /**
 * Node-style callback as used by {@link RPCImpl}.
 * @typedef RPCImplCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
 * @returns {undefined}
 */ rpc.Service = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/rpc/service.js [app-rsc] (ecmascript)");
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/service.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Service;
// extends Namespace
var Namespace = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)");
((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = "Service";
var Method = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/method.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)"), rpc = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/rpc.js [app-rsc] (ecmascript)");
/**
 * Constructs a new service instance.
 * @classdesc Reflected service.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Service name
 * @param {Object.<string,*>} [options] Service options
 * @throws {TypeError} If arguments are invalid
 */ function Service(name, options) {
    Namespace.call(this, name, options);
    /**
     * Service methods.
     * @type {Object.<string,Method>}
     */ this.methods = {}; // toJSON, marker
    /**
     * Cached methods as an array.
     * @type {Method[]|null}
     * @private
     */ this._methodsArray = null;
}
/**
 * Service descriptor.
 * @interface IService
 * @extends INamespace
 * @property {Object.<string,IMethod>} methods Method descriptors
 */ /**
 * Constructs a service from a service descriptor.
 * @param {string} name Service name
 * @param {IService} json Service descriptor
 * @returns {Service} Created service
 * @throws {TypeError} If arguments are invalid
 */ Service.fromJSON = function fromJSON(name, json) {
    var service = new Service(name, json.options);
    /* istanbul ignore else */ if (json.methods) for(var names = Object.keys(json.methods), i = 0; i < names.length; ++i)service.add(Method.fromJSON(names[i], json.methods[names[i]]));
    if (json.nested) service.addJSON(json.nested);
    service.comment = json.comment;
    return service;
};
/**
 * Converts this service to a service descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IService} Service descriptor
 */ Service.prototype.toJSON = function toJSON(toJSONOptions) {
    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        inherited && inherited.options || undefined,
        "methods",
        Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */ {},
        "nested",
        inherited && inherited.nested || undefined,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Methods of this service as an array for iteration.
 * @name Service#methodsArray
 * @type {Method[]}
 * @readonly
 */ Object.defineProperty(Service.prototype, "methodsArray", {
    get: function() {
        return this._methodsArray || (this._methodsArray = util.toArray(this.methods));
    }
});
function clearCache(service) {
    service._methodsArray = null;
    return service;
}
/**
 * @override
 */ Service.prototype.get = function get(name) {
    return this.methods[name] || Namespace.prototype.get.call(this, name);
};
/**
 * @override
 */ Service.prototype.resolveAll = function resolveAll() {
    var methods = this.methodsArray;
    for(var i = 0; i < methods.length; ++i)methods[i].resolve();
    return Namespace.prototype.resolve.call(this);
};
/**
 * @override
 */ Service.prototype.add = function add(object) {
    /* istanbul ignore if */ if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this);
    if (object instanceof Method) {
        this.methods[object.name] = object;
        object.parent = this;
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};
/**
 * @override
 */ Service.prototype.remove = function remove(object) {
    if (object instanceof Method) {
        /* istanbul ignore if */ if (this.methods[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.methods[object.name];
        object.parent = null;
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};
/**
 * Creates a runtime service using the specified rpc implementation.
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
 */ Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
    var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited);
    for(var i = 0, method; i < /* initializes */ this.methodsArray.length; ++i){
        var methodName = util.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, "");
        rpcService[methodName] = util.codegen([
            "r",
            "c"
        ], util.isReserved(methodName) ? methodName + "_" : methodName)("return this.rpcCall(m,q,s,r,c)")({
            m: method,
            q: method.resolvedRequestType.ctor,
            s: method.resolvedResponseType.ctor
        });
    }
    return rpcService;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/message.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Message;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
/**
 * Constructs a new message instance.
 * @classdesc Abstract runtime message.
 * @constructor
 * @param {Properties<T>} [properties] Properties to set
 * @template T extends object = object
 */ function Message(properties) {
    // not used internally
    if (properties) for(var keys = Object.keys(properties), i = 0; i < keys.length; ++i)this[keys[i]] = properties[keys[i]];
}
/**
 * Reference to the reflected type.
 * @name Message.$type
 * @type {Type}
 * @readonly
 */ /**
 * Reference to the reflected type.
 * @name Message#$type
 * @type {Type}
 * @readonly
 */ /*eslint-disable valid-jsdoc*/ /**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<T>} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.create = function create(properties) {
    return this.$type.create(properties);
};
/**
 * Encodes a message of this type.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.encode = function encode(message, writer) {
    return this.$type.encode(message, writer);
};
/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.encodeDelimited = function encodeDelimited(message, writer) {
    return this.$type.encodeDelimited(message, writer);
};
/**
 * Decodes a message of this type.
 * @name Message.decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.decode = function decode(reader) {
    return this.$type.decode(reader);
};
/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Message.decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.decodeDelimited = function decodeDelimited(reader) {
    return this.$type.decodeDelimited(reader);
};
/**
 * Verifies a message of this type.
 * @name Message.verify
 * @function
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {string|null} `null` if valid, otherwise the reason why it is not
 */ Message.verify = function verify(message) {
    return this.$type.verify(message);
};
/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {T} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.fromObject = function fromObject(object) {
    return this.$type.fromObject(object);
};
/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {T} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.toObject = function toObject(message, options) {
    return this.$type.toObject(message, options);
};
/**
 * Converts this message to JSON.
 * @returns {Object.<string,*>} JSON object
 */ Message.prototype.toJSON = function toJSON() {
    return this.$type.toObject(this, util.toJSONOptions);
}; /*eslint-enable valid-jsdoc*/ 
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Reader;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
var BufferReader; // cyclic
var LongBits = util.LongBits, utf8 = util.utf8;
/* istanbul ignore next */ function indexOutOfRange(reader, writeLength) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}
/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */ function Reader(buffer) {
    /**
     * Read buffer.
     * @type {Uint8Array}
     */ this.buf = buffer;
    /**
     * Read buffer position.
     * @type {number}
     */ this.pos = 0;
    /**
     * Read buffer length.
     * @type {number}
     */ this.len = buffer.length;
}
var create_array = typeof Uint8Array !== "undefined" ? function create_typed_array(buffer) {
    if (buffer instanceof Uint8Array || Array.isArray(buffer)) return new Reader(buffer);
    throw Error("illegal buffer");
} : function create_array(buffer) {
    if (Array.isArray(buffer)) return new Reader(buffer);
    throw Error("illegal buffer");
};
var create = function create() {
    return util.Buffer ? function create_buffer_setup(buffer) {
        return (Reader.create = function create_buffer(buffer) {
            return util.Buffer.isBuffer(buffer) ? new BufferReader(buffer) : create_array(buffer);
        })(buffer);
    } : create_array;
};
/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 * @throws {Error} If `buffer` is not a valid buffer
 */ Reader.create = create();
Reader.prototype._slice = util.Array.prototype.subarray || /* istanbul ignore next */ util.Array.prototype.slice;
/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.uint32 = function read_uint32_setup() {
    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
    return function read_uint32() {
        value = (this.buf[this.pos] & 127) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 7) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 15) << 28) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        /* istanbul ignore if */ if ((this.pos += 5) > this.len) {
            this.pos = this.len;
            throw indexOutOfRange(this, 10);
        }
        return value;
    };
}();
/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */ Reader.prototype.int32 = function read_int32() {
    return this.uint32() | 0;
};
/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */ Reader.prototype.sint32 = function read_sint32() {
    var value = this.uint32();
    return value >>> 1 ^ -(value & 1) | 0;
};
/* eslint-disable no-invalid-this */ function readLongVarint() {
    // tends to deopt with local vars for octet etc.
    var bits = new LongBits(0, 0);
    var i = 0;
    if (this.len - this.pos > 4) {
        for(; i < 4; ++i){
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
        // 5th
        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >> 4) >>> 0;
        if (this.buf[this.pos++] < 128) return bits;
        i = 0;
    } else {
        for(; i < 3; ++i){
            /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
            // 1st..3th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
        // 4th
        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
        return bits;
    }
    if (this.len - this.pos > 4) {
        for(; i < 5; ++i){
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
    } else {
        for(; i < 5; ++i){
            /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
    }
    /* istanbul ignore next */ throw Error("invalid varint encoding");
}
/* eslint-enable no-invalid-this */ /**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */ Reader.prototype.bool = function read_bool() {
    return this.uint32() !== 0;
};
function readFixed32_end(buf, end) {
    return (buf[end - 4] | buf[end - 3] << 8 | buf[end - 2] << 16 | buf[end - 1] << 24) >>> 0;
}
/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */ Reader.prototype.fixed32 = function read_fixed32() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    return readFixed32_end(this.buf, this.pos += 4);
};
/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */ Reader.prototype.sfixed32 = function read_sfixed32() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    return readFixed32_end(this.buf, this.pos += 4) | 0;
};
/* eslint-disable no-invalid-this */ function readFixed64() {
    /* istanbul ignore if */ if (this.pos + 8 > this.len) throw indexOutOfRange(this, 8);
    return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
}
/* eslint-enable no-invalid-this */ /**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.float = function read_float() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    var value = util.float.readFloatLE(this.buf, this.pos);
    this.pos += 4;
    return value;
};
/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.double = function read_double() {
    /* istanbul ignore if */ if (this.pos + 8 > this.len) throw indexOutOfRange(this, 4);
    var value = util.float.readDoubleLE(this.buf, this.pos);
    this.pos += 8;
    return value;
};
/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */ Reader.prototype.bytes = function read_bytes() {
    var length = this.uint32(), start = this.pos, end = this.pos + length;
    /* istanbul ignore if */ if (end > this.len) throw indexOutOfRange(this, length);
    this.pos += length;
    if (Array.isArray(this.buf)) return this.buf.slice(start, end);
    if (start === end) {
        var nativeBuffer = util.Buffer;
        return nativeBuffer ? nativeBuffer.alloc(0) : new this.buf.constructor(0);
    }
    return this._slice.call(this.buf, start, end);
};
/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */ Reader.prototype.string = function read_string() {
    var bytes = this.bytes();
    return utf8.read(bytes, 0, bytes.length);
};
/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */ Reader.prototype.skip = function skip(length) {
    if (typeof length === "number") {
        /* istanbul ignore if */ if (this.pos + length > this.len) throw indexOutOfRange(this, length);
        this.pos += length;
    } else {
        do {
            /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
        }while (this.buf[this.pos++] & 128)
    }
    return this;
};
/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @returns {Reader} `this`
 */ Reader.prototype.skipType = function(wireType) {
    switch(wireType){
        case 0:
            this.skip();
            break;
        case 1:
            this.skip(8);
            break;
        case 2:
            this.skip(this.uint32());
            break;
        case 3:
            while((wireType = this.uint32() & 7) !== 4){
                this.skipType(wireType);
            }
            break;
        case 5:
            this.skip(4);
            break;
        /* istanbul ignore next */ default:
            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
    }
    return this;
};
Reader._configure = function(BufferReader_) {
    BufferReader = BufferReader_;
    Reader.create = create();
    BufferReader._configure();
    var fn = util.Long ? "toLong" : /* istanbul ignore next */ "toNumber";
    util.merge(Reader.prototype, {
        int64: function read_int64() {
            return readLongVarint.call(this)[fn](false);
        },
        uint64: function read_uint64() {
            return readLongVarint.call(this)[fn](true);
        },
        sint64: function read_sint64() {
            return readLongVarint.call(this).zzDecode()[fn](false);
        },
        fixed64: function read_fixed64() {
            return readFixed64.call(this)[fn](true);
        },
        sfixed64: function read_sfixed64() {
            return readFixed64.call(this)[fn](false);
        }
    });
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Writer;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
var BufferWriter; // cyclic
var LongBits = util.LongBits, base64 = util.base64, utf8 = util.utf8;
/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */ function Op(fn, len, val) {
    /**
     * Function to call.
     * @type {function(Uint8Array, number, *)}
     */ this.fn = fn;
    /**
     * Value byte length.
     * @type {number}
     */ this.len = len;
    /**
     * Next operation.
     * @type {Writer.Op|undefined}
     */ this.next = undefined;
    /**
     * Value to write.
     * @type {*}
     */ this.val = val; // type varies
}
/* istanbul ignore next */ function noop() {} // eslint-disable-line no-empty-function
/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @ignore
 */ function State(writer) {
    /**
     * Current head.
     * @type {Writer.Op}
     */ this.head = writer.head;
    /**
     * Current tail.
     * @type {Writer.Op}
     */ this.tail = writer.tail;
    /**
     * Current buffer length.
     * @type {number}
     */ this.len = writer.len;
    /**
     * Next state.
     * @type {State|null}
     */ this.next = writer.states;
}
/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */ function Writer() {
    /**
     * Current length.
     * @type {number}
     */ this.len = 0;
    /**
     * Operations head.
     * @type {Object}
     */ this.head = new Op(noop, 0, 0);
    /**
     * Operations tail
     * @type {Object}
     */ this.tail = this.head;
    /**
     * Linked forked states.
     * @type {Object|null}
     */ this.states = null;
// When a value is written, the writer calculates its byte length and puts it into a linked
// list of operations to perform when finish() is called. This both allows us to allocate
// buffers of the exact required size and reduces the amount of work we have to do compared
// to first calculating over objects and then encoding over objects. In our case, the encoding
// part is just a linked list walk calling operations with already prepared values.
}
var create = function create() {
    return util.Buffer ? function create_buffer_setup() {
        return (Writer.create = function create_buffer() {
            return new BufferWriter();
        })();
    } : function create_array() {
        return new Writer();
    };
};
/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */ Writer.create = create();
/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */ Writer.alloc = function alloc(size) {
    return new util.Array(size);
};
// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */ if (util.Array !== Array) Writer.alloc = util.pool(Writer.alloc, util.Array.prototype.subarray);
/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 * @private
 */ Writer.prototype._push = function push(fn, len, val) {
    this.tail = this.tail.next = new Op(fn, len, val);
    this.len += len;
    return this;
};
function writeByte(val, buf, pos) {
    buf[pos] = val & 255;
}
function writeVarint32(val, buf, pos) {
    while(val > 127){
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}
/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */ function VarintOp(len, val) {
    this.len = len;
    this.next = undefined;
    this.val = val;
}
VarintOp.prototype = Object.create(Op.prototype);
VarintOp.prototype.fn = writeVarint32;
/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.uint32 = function write_uint32(value) {
    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
    // uint32 is by far the most frequently used operation and benefits significantly from this.
    this.len += (this.tail = this.tail.next = new VarintOp((value = value >>> 0) < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5, value)).len;
    return this;
};
/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.int32 = function write_int32(value) {
    return value < 0 ? this._push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
     : this.uint32(value);
};
/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.sint32 = function write_sint32(value) {
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
};
function writeVarint64(val, buf, pos) {
    while(val.hi){
        buf[pos++] = val.lo & 127 | 128;
        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
        val.hi >>>= 7;
    }
    while(val.lo > 127){
        buf[pos++] = val.lo & 127 | 128;
        val.lo = val.lo >>> 7;
    }
    buf[pos++] = val.lo;
}
/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.uint64 = function write_uint64(value) {
    var bits = LongBits.from(value);
    return this._push(writeVarint64, bits.length(), bits);
};
/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.int64 = Writer.prototype.uint64;
/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.sint64 = function write_sint64(value) {
    var bits = LongBits.from(value).zzEncode();
    return this._push(writeVarint64, bits.length(), bits);
};
/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.bool = function write_bool(value) {
    return this._push(writeByte, 1, value ? 1 : 0);
};
function writeFixed32(val, buf, pos) {
    buf[pos] = val & 255;
    buf[pos + 1] = val >>> 8 & 255;
    buf[pos + 2] = val >>> 16 & 255;
    buf[pos + 3] = val >>> 24;
}
/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.fixed32 = function write_fixed32(value) {
    return this._push(writeFixed32, 4, value >>> 0);
};
/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.sfixed32 = Writer.prototype.fixed32;
/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.fixed64 = function write_fixed64(value) {
    var bits = LongBits.from(value);
    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
};
/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.sfixed64 = Writer.prototype.fixed64;
/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.float = function write_float(value) {
    return this._push(util.float.writeFloatLE, 4, value);
};
/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.double = function write_double(value) {
    return this._push(util.float.writeDoubleLE, 8, value);
};
var writeBytes = util.Array.prototype.set ? function writeBytes_set(val, buf, pos) {
    buf.set(val, pos); // also works for plain array values
} : function writeBytes_for(val, buf, pos) {
    for(var i = 0; i < val.length; ++i)buf[pos + i] = val[i];
};
/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */ Writer.prototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    if (!len) return this._push(writeByte, 1, 0);
    if (util.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0);
        value = buf;
    }
    return this.uint32(len)._push(writeBytes, len, value);
};
/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.string = function write_string(value) {
    var len = utf8.length(value);
    return len ? this.uint32(len)._push(utf8.write, len, value) : this._push(writeByte, 1, 0);
};
/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */ Writer.prototype.fork = function fork() {
    this.states = new State(this);
    this.head = this.tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};
/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */ Writer.prototype.reset = function reset() {
    if (this.states) {
        this.head = this.states.head;
        this.tail = this.states.tail;
        this.len = this.states.len;
        this.states = this.states.next;
    } else {
        this.head = this.tail = new Op(noop, 0, 0);
        this.len = 0;
    }
    return this;
};
/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */ Writer.prototype.ldelim = function ldelim() {
    var head = this.head, tail = this.tail, len = this.len;
    this.reset().uint32(len);
    if (len) {
        this.tail.next = head.next; // skip noop
        this.tail = tail;
        this.len += len;
    }
    return this;
};
/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */ Writer.prototype.finish = function finish() {
    var head = this.head.next, buf = this.constructor.alloc(this.len), pos = 0;
    while(head){
        head.fn(head.val, buf, pos);
        pos += head.len;
        head = head.next;
    }
    // this.head = this.tail = null;
    return buf;
};
Writer._configure = function(BufferWriter_) {
    BufferWriter = BufferWriter_;
    Writer.create = create();
    BufferWriter._configure();
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/decoder.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = decoder;
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
function missing(field) {
    return "missing required '" + field.name + "'";
}
/**
 * Generates a decoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function decoder(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "r",
        "l"
    ], mtype.name + "$decode")("if(!(r instanceof Reader))")("r=Reader.create(r)")("var c=l===undefined?r.len:r.pos+l,m=new this.ctor" + (mtype.fieldsArray.filter(function(field) {
        return field.map;
    }).length ? ",k,value" : ""))("while(r.pos<c){")("var t=r.uint32()");
    if (mtype.group) gen("if((t&7)===4)")("break");
    gen("switch(t>>>3){");
    var i = 0;
    for(; i < /* initializes */ mtype.fieldsArray.length; ++i){
        var field = mtype._fieldsArray[i].resolve(), type = field.resolvedType instanceof Enum ? "int32" : field.type, ref = "m" + util.safeProp(field.name);
        gen("case %i: {", field.id);
        // Map fields
        if (field.map) {
            gen("if(%s===util.emptyObject)", ref)("%s={}", ref)("var c2 = r.uint32()+r.pos");
            if (types.defaults[field.keyType] !== undefined) gen("k=%j", types.defaults[field.keyType]);
            else gen("k=null");
            if (types.defaults[type] !== undefined) gen("value=%j", types.defaults[type]);
            else gen("value=null");
            gen("while(r.pos<c2){")("var tag2=r.uint32()")("switch(tag2>>>3){")("case 1: k=r.%s(); break", field.keyType)("case 2:");
            if (types.basic[type] === undefined) gen("value=types[%i].decode(r,r.uint32())", i); // can't be groups
            else gen("value=r.%s()", type);
            gen("break")("default:")("r.skipType(tag2&7)")("break")("}")("}");
            if (types.long[field.keyType] !== undefined) gen("%s[typeof k===\"object\"?util.longToHash(k):k]=value", ref);
            else gen("%s[k]=value", ref);
        // Repeated fields
        } else if (field.repeated) {
            gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref);
            // Packable (always check for forward and backward compatiblity)
            if (types.packed[type] !== undefined) gen("if((t&7)===2){")("var c2=r.uint32()+r.pos")("while(r.pos<c2)")("%s.push(r.%s())", ref, type)("}else");
            // Non-packed
            if (types.basic[type] === undefined) gen(field.resolvedType.group ? "%s.push(types[%i].decode(r))" : "%s.push(types[%i].decode(r,r.uint32()))", ref, i);
            else gen("%s.push(r.%s())", ref, type);
        // Non-repeated
        } else if (types.basic[type] === undefined) gen(field.resolvedType.group ? "%s=types[%i].decode(r)" : "%s=types[%i].decode(r,r.uint32())", ref, i);
        else gen("%s=r.%s()", ref, type);
        gen("break")("}");
    // Unknown fields
    }
    gen("default:")("r.skipType(t&7)")("break")("}")("}");
    // Field presence
    for(i = 0; i < mtype._fieldsArray.length; ++i){
        var rfield = mtype._fieldsArray[i];
        if (rfield.required) gen("if(!m.hasOwnProperty(%j))", rfield.name)("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
    }
    return gen("return m");
/* eslint-enable no-unexpected-multiline */ }
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/verifier.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = verifier;
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
function invalid(field, expected) {
    return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:" + field.keyType + "}" : "") + " expected";
}
/**
 * Generates a partial value verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genVerifyValue(gen, field, fieldIndex, ref) {
    /* eslint-disable no-unexpected-multiline */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) {
            gen("switch(%s){", ref)("default:")("return%j", invalid(field, "enum value"));
            for(var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j)gen("case %i:", field.resolvedType.values[keys[j]]);
            gen("break")("}");
        } else {
            gen("{")("var e=types[%i].verify(%s);", fieldIndex, ref)("if(e)")("return%j+e", field.name + ".")("}");
        }
    } else {
        switch(field.type){
            case "int32":
            case "uint32":
            case "sint32":
            case "fixed32":
            case "sfixed32":
                gen("if(!util.isInteger(%s))", ref)("return%j", invalid(field, "integer"));
                break;
            case "int64":
            case "uint64":
            case "sint64":
            case "fixed64":
            case "sfixed64":
                gen("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)("return%j", invalid(field, "integer|Long"));
                break;
            case "float":
            case "double":
                gen("if(typeof %s!==\"number\")", ref)("return%j", invalid(field, "number"));
                break;
            case "bool":
                gen("if(typeof %s!==\"boolean\")", ref)("return%j", invalid(field, "boolean"));
                break;
            case "string":
                gen("if(!util.isString(%s))", ref)("return%j", invalid(field, "string"));
                break;
            case "bytes":
                gen("if(!(%s&&typeof %s.length===\"number\"||util.isString(%s)))", ref, ref, ref)("return%j", invalid(field, "buffer"));
                break;
        }
    }
    return gen;
/* eslint-enable no-unexpected-multiline */ }
/**
 * Generates a partial key verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genVerifyKey(gen, field, ref) {
    /* eslint-disable no-unexpected-multiline */ switch(field.keyType){
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32":
            gen("if(!util.key32Re.test(%s))", ref)("return%j", invalid(field, "integer key"));
            break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64":
            gen("if(!util.key64Re.test(%s))", ref) // see comment above: x is ok, d is not
            ("return%j", invalid(field, "integer|Long key"));
            break;
        case "bool":
            gen("if(!util.key2Re.test(%s))", ref)("return%j", invalid(field, "boolean key"));
            break;
    }
    return gen;
/* eslint-enable no-unexpected-multiline */ }
/**
 * Generates a verifier specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function verifier(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "m"
    ], mtype.name + "$verify")("if(typeof m!==\"object\"||m===null)")("return%j", "object expected");
    var oneofs = mtype.oneofsArray, seenFirstField = {};
    if (oneofs.length) gen("var p={}");
    for(var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i){
        var field = mtype._fieldsArray[i].resolve(), ref = "m" + util.safeProp(field.name);
        if (field.optional) gen("if(%s!=null&&m.hasOwnProperty(%j)){", ref, field.name); // !== undefined && !== null
        // map fields
        if (field.map) {
            gen("if(!util.isObject(%s))", ref)("return%j", invalid(field, "object"))("var k=Object.keys(%s)", ref)("for(var i=0;i<k.length;++i){");
            genVerifyKey(gen, field, "k[i]");
            genVerifyValue(gen, field, i, ref + "[k[i]]")("}");
        // repeated fields
        } else if (field.repeated) {
            gen("if(!Array.isArray(%s))", ref)("return%j", invalid(field, "array"))("for(var i=0;i<%s.length;++i){", ref);
            genVerifyValue(gen, field, i, ref + "[i]")("}");
        // required or present fields
        } else {
            if (field.partOf) {
                var oneofProp = util.safeProp(field.partOf.name);
                if (seenFirstField[field.partOf.name] === 1) gen("if(p%s===1)", oneofProp)("return%j", field.partOf.name + ": multiple values");
                seenFirstField[field.partOf.name] = 1;
                gen("p%s=1", oneofProp);
            }
            genVerifyValue(gen, field, i, ref);
        }
        if (field.optional) gen("}");
    }
    return gen("return null");
/* eslint-enable no-unexpected-multiline */ }
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/converter.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * Runtime message from/to plain object converters.
 * @namespace
 */ var converter = exports;
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Generates a partial value fromObject conveter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
    var defaultAlreadyEmitted = false;
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) {
            gen("switch(d%s){", prop);
            for(var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i){
                // enum unknown values passthrough
                if (values[keys[i]] === field.typeDefault && !defaultAlreadyEmitted) {
                    gen("default:")("if(typeof(d%s)===\"number\"){m%s=d%s;break}", prop, prop, prop);
                    if (!field.repeated) gen // fallback to default value only for
                    ("break"); // for non-repeated fields, just ignore
                    defaultAlreadyEmitted = true;
                }
                gen("case%j:", keys[i])("case %i:", values[keys[i]])("m%s=%j", prop, values[keys[i]])("break");
            }
            gen("}");
        } else gen("if(typeof d%s!==\"object\")", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s=types[%i].fromObject(d%s)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch(field.type){
            case "double":
            case "float":
                gen("m%s=Number(d%s)", prop, prop); // also catches "NaN", "Infinity"
                break;
            case "uint32":
            case "fixed32":
                gen("m%s=d%s>>>0", prop, prop);
                break;
            case "int32":
            case "sint32":
            case "sfixed32":
                gen("m%s=d%s|0", prop, prop);
                break;
            case "uint64":
                isUnsigned = true;
            // eslint-disable-next-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64":
                gen("if(util.Long)")("(m%s=util.Long.fromValue(d%s)).unsigned=%j", prop, prop, isUnsigned)("else if(typeof d%s===\"string\")", prop)("m%s=parseInt(d%s,10)", prop, prop)("else if(typeof d%s===\"number\")", prop)("m%s=d%s", prop, prop)("else if(typeof d%s===\"object\")", prop)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
                break;
            case "bytes":
                gen("if(typeof d%s===\"string\")", prop)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)("else if(d%s.length >= 0)", prop)("m%s=d%s", prop, prop);
                break;
            case "string":
                gen("m%s=String(d%s)", prop, prop);
                break;
            case "bool":
                gen("m%s=Boolean(d%s)", prop, prop);
                break;
        }
    }
    return gen;
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }
/**
 * Generates a plain object to runtime message converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ converter.fromObject = function fromObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var fields = mtype.fieldsArray;
    var gen = util.codegen([
        "d"
    ], mtype.name + "$fromObject")("if(d instanceof this.ctor)")("return d");
    if (!fields.length) return gen("return new this.ctor");
    gen("var m=new this.ctor");
    for(var i = 0; i < fields.length; ++i){
        var field = fields[i].resolve(), prop = util.safeProp(field.name);
        // Map fields
        if (field.map) {
            gen("if(d%s){", prop)("if(typeof d%s!==\"object\")", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s={}", prop)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop);
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[ks[i]]")("}")("}");
        // Repeated fields
        } else if (field.repeated) {
            gen("if(d%s){", prop)("if(!Array.isArray(d%s))", prop)("throw TypeError(%j)", field.fullName + ": array expected")("m%s=[]", prop)("for(var i=0;i<d%s.length;++i){", prop);
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[i]")("}")("}");
        // Non-repeated fields
        } else {
            if (!(field.resolvedType instanceof Enum)) gen // no need to test for null/undefined if an enum (uses switch)
            ("if(d%s!=null){", prop); // !== undefined && !== null
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop);
            if (!(field.resolvedType instanceof Enum)) gen("}");
        }
    }
    return gen("return m");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ };
/**
 * Generates a partial value toObject converter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genValuePartial_toObject(gen, field, fieldIndex, prop) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) gen("d%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s", prop, fieldIndex, prop, prop, fieldIndex, prop, prop);
        else gen("d%s=types[%i].toObject(m%s,o)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch(field.type){
            case "double":
            case "float":
                gen("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", prop, prop, prop, prop);
                break;
            case "uint64":
                isUnsigned = true;
            // eslint-disable-next-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64":
                gen("if(typeof m%s===\"number\")", prop)("d%s=o.longs===String?String(m%s):m%s", prop, prop, prop)("else") // Long-like
                ("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", prop, prop, prop, prop, isUnsigned ? "true" : "", prop);
                break;
            case "bytes":
                gen("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", prop, prop, prop, prop, prop);
                break;
            default:
                gen("d%s=m%s", prop, prop);
                break;
        }
    }
    return gen;
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }
/**
 * Generates a runtime message to plain object converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ converter.toObject = function toObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById);
    if (!fields.length) return util.codegen()("return {}");
    var gen = util.codegen([
        "m",
        "o"
    ], mtype.name + "$toObject")("if(!o)")("o={}")("var d={}");
    var repeatedFields = [], mapFields = [], normalFields = [], i = 0;
    for(; i < fields.length; ++i)if (!fields[i].partOf) (fields[i].resolve().repeated ? repeatedFields : fields[i].map ? mapFields : normalFields).push(fields[i]);
    if (repeatedFields.length) {
        gen("if(o.arrays||o.defaults){");
        for(i = 0; i < repeatedFields.length; ++i)gen("d%s=[]", util.safeProp(repeatedFields[i].name));
        gen("}");
    }
    if (mapFields.length) {
        gen("if(o.objects||o.defaults){");
        for(i = 0; i < mapFields.length; ++i)gen("d%s={}", util.safeProp(mapFields[i].name));
        gen("}");
    }
    if (normalFields.length) {
        gen("if(o.defaults){");
        for(i = 0; i < normalFields.length; ++i){
            var field = normalFields[i], prop = util.safeProp(field.name);
            if (field.resolvedType instanceof Enum) gen("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
            else if (field.long) gen("if(util.Long){")("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)("d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n", prop)("}else")("d%s=o.longs===String?%j:%i", prop, field.typeDefault.toString(), field.typeDefault.toNumber());
            else if (field.bytes) {
                var arrayDefault = "[" + Array.prototype.slice.call(field.typeDefault).join(",") + "]";
                gen("if(o.bytes===String)d%s=%j", prop, String.fromCharCode.apply(String, field.typeDefault))("else{")("d%s=%s", prop, arrayDefault)("if(o.bytes!==Array)d%s=util.newBuffer(d%s)", prop, prop)("}");
            } else gen("d%s=%j", prop, field.typeDefault); // also messages (=null)
        }
        gen("}");
    }
    var hasKs2 = false;
    for(i = 0; i < fields.length; ++i){
        var field = fields[i], index = mtype._fieldsArray.indexOf(field), prop = util.safeProp(field.name);
        if (field.map) {
            if (!hasKs2) {
                hasKs2 = true;
                gen("var ks2");
            }
            gen("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)("d%s={}", prop)("for(var j=0;j<ks2.length;++j){");
            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[ks2[j]]")("}");
        } else if (field.repeated) {
            gen("if(m%s&&m%s.length){", prop, prop)("d%s=[]", prop)("for(var j=0;j<m%s.length;++j){", prop);
            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[j]")("}");
        } else {
            gen("if(m%s!=null&&m.hasOwnProperty(%j)){", prop, field.name); // !== undefined && !== null
            genValuePartial_toObject(gen, field, /* sorted */ index, prop);
            if (field.partOf) gen("if(o.oneofs)")("d%s=%j", util.safeProp(field.partOf.name), field.name);
        }
        gen("}");
    }
    return gen("return d");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ };
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/wrappers.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * Wrappers for common types.
 * @type {Object.<string,IWrapper>}
 * @const
 */ var wrappers = exports;
var Message = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/message.js [app-rsc] (ecmascript)");
/**
 * From object converter part of an {@link IWrapper}.
 * @typedef WrapperFromObjectConverter
 * @type {function}
 * @param {Object.<string,*>} object Plain object
 * @returns {Message<{}>} Message instance
 * @this Type
 */ /**
 * To object converter part of an {@link IWrapper}.
 * @typedef WrapperToObjectConverter
 * @type {function}
 * @param {Message<{}>} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @this Type
 */ /**
 * Common type wrapper part of {@link wrappers}.
 * @interface IWrapper
 * @property {WrapperFromObjectConverter} [fromObject] From object converter
 * @property {WrapperToObjectConverter} [toObject] To object converter
 */ // Custom wrapper for Any
wrappers[".google.protobuf.Any"] = {
    fromObject: function(object) {
        // unwrap value type if mapped
        if (object && object["@type"]) {
            // Only use fully qualified type name after the last '/'
            var name = object["@type"].substring(object["@type"].lastIndexOf("/") + 1);
            var type = this.lookup(name);
            /* istanbul ignore else */ if (type) {
                // type_url does not accept leading "."
                var type_url = object["@type"].charAt(0) === "." ? object["@type"].slice(1) : object["@type"];
                // type_url prefix is optional, but path seperator is required
                if (type_url.indexOf("/") === -1) {
                    type_url = "/" + type_url;
                }
                return this.create({
                    type_url: type_url,
                    value: type.encode(type.fromObject(object)).finish()
                });
            }
        }
        return this.fromObject(object);
    },
    toObject: function(message, options) {
        // Default prefix
        var googleApi = "type.googleapis.com/";
        var prefix = "";
        var name = "";
        // decode value if requested and unmapped
        if (options && options.json && message.type_url && message.value) {
            // Only use fully qualified type name after the last '/'
            name = message.type_url.substring(message.type_url.lastIndexOf("/") + 1);
            // Separate the prefix used
            prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
            var type = this.lookup(name);
            /* istanbul ignore else */ if (type) message = type.decode(message.value);
        }
        // wrap value if unmapped
        if (!(message instanceof this.ctor) && message instanceof Message) {
            var object = message.$type.toObject(message, options);
            var messageName = message.$type.fullName[0] === "." ? message.$type.fullName.slice(1) : message.$type.fullName;
            // Default to type.googleapis.com prefix if no prefix is used
            if (prefix === "") {
                prefix = googleApi;
            }
            name = prefix + messageName;
            object["@type"] = name;
            return object;
        }
        return this.toObject(message, options);
    }
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/type.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Type;
// extends Namespace
var Namespace = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)");
((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = "Type";
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), OneOf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)"), Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)"), MapField = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/mapfield.js [app-rsc] (ecmascript)"), Service = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/service.js [app-rsc] (ecmascript)"), Message = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/message.js [app-rsc] (ecmascript)"), Reader = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader.js [app-rsc] (ecmascript)"), Writer = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)"), encoder = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/encoder.js [app-rsc] (ecmascript)"), decoder = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/decoder.js [app-rsc] (ecmascript)"), verifier = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/verifier.js [app-rsc] (ecmascript)"), converter = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/converter.js [app-rsc] (ecmascript)"), wrappers = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/wrappers.js [app-rsc] (ecmascript)");
/**
 * Constructs a new reflected message type instance.
 * @classdesc Reflected message type.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Message name
 * @param {Object.<string,*>} [options] Declared options
 */ function Type(name, options) {
    Namespace.call(this, name, options);
    /**
     * Message fields.
     * @type {Object.<string,Field>}
     */ this.fields = {}; // toJSON, marker
    /**
     * Oneofs declared within this namespace, if any.
     * @type {Object.<string,OneOf>}
     */ this.oneofs = undefined; // toJSON
    /**
     * Extension ranges, if any.
     * @type {number[][]}
     */ this.extensions = undefined; // toJSON
    /**
     * Reserved ranges, if any.
     * @type {Array.<number[]|string>}
     */ this.reserved = undefined; // toJSON
    /*?
     * Whether this type is a legacy group.
     * @type {boolean|undefined}
     */ this.group = undefined; // toJSON
    /**
     * Cached fields by id.
     * @type {Object.<number,Field>|null}
     * @private
     */ this._fieldsById = null;
    /**
     * Cached fields as an array.
     * @type {Field[]|null}
     * @private
     */ this._fieldsArray = null;
    /**
     * Cached oneofs as an array.
     * @type {OneOf[]|null}
     * @private
     */ this._oneofsArray = null;
    /**
     * Cached constructor.
     * @type {Constructor<{}>}
     * @private
     */ this._ctor = null;
}
Object.defineProperties(Type.prototype, {
    /**
     * Message fields by id.
     * @name Type#fieldsById
     * @type {Object.<number,Field>}
     * @readonly
     */ fieldsById: {
        get: function() {
            /* istanbul ignore if */ if (this._fieldsById) return this._fieldsById;
            this._fieldsById = {};
            for(var names = Object.keys(this.fields), i = 0; i < names.length; ++i){
                var field = this.fields[names[i]], id = field.id;
                /* istanbul ignore if */ if (this._fieldsById[id]) throw Error("duplicate id " + id + " in " + this);
                this._fieldsById[id] = field;
            }
            return this._fieldsById;
        }
    },
    /**
     * Fields of this message as an array for iteration.
     * @name Type#fieldsArray
     * @type {Field[]}
     * @readonly
     */ fieldsArray: {
        get: function() {
            return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields));
        }
    },
    /**
     * Oneofs of this message as an array for iteration.
     * @name Type#oneofsArray
     * @type {OneOf[]}
     * @readonly
     */ oneofsArray: {
        get: function() {
            return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs));
        }
    },
    /**
     * The registered constructor, if any registered, otherwise a generic constructor.
     * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
     * @name Type#ctor
     * @type {Constructor<{}>}
     */ ctor: {
        get: function() {
            return this._ctor || (this.ctor = Type.generateConstructor(this)());
        },
        set: function(ctor) {
            // Ensure proper prototype
            var prototype = ctor.prototype;
            if (!(prototype instanceof Message)) {
                (ctor.prototype = new Message()).constructor = ctor;
                util.merge(ctor.prototype, prototype);
            }
            // Classes and messages reference their reflected type
            ctor.$type = ctor.prototype.$type = this;
            // Mix in static methods
            util.merge(ctor, Message, true);
            this._ctor = ctor;
            // Messages have non-enumerable default values on their prototype
            var i = 0;
            for(; i < /* initializes */ this.fieldsArray.length; ++i)this._fieldsArray[i].resolve(); // ensures a proper value
            // Messages have non-enumerable getters and setters for each virtual oneof field
            var ctorProperties = {};
            for(i = 0; i < /* initializes */ this.oneofsArray.length; ++i)ctorProperties[this._oneofsArray[i].resolve().name] = {
                get: util.oneOfGetter(this._oneofsArray[i].oneof),
                set: util.oneOfSetter(this._oneofsArray[i].oneof)
            };
            if (i) Object.defineProperties(ctor.prototype, ctorProperties);
        }
    }
});
/**
 * Generates a constructor function for the specified type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ Type.generateConstructor = function generateConstructor(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "p"
    ], mtype.name);
    // explicitly initialize mutable object/array fields so that these aren't just inherited from the prototype
    for(var i = 0, field; i < mtype.fieldsArray.length; ++i)if ((field = mtype._fieldsArray[i]).map) gen("this%s={}", util.safeProp(field.name));
    else if (field.repeated) gen("this%s=[]", util.safeProp(field.name));
    return gen("if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null)") // omit undefined or null
    ("this[ks[i]]=p[ks[i]]");
/* eslint-enable no-unexpected-multiline */ };
function clearCache(type) {
    type._fieldsById = type._fieldsArray = type._oneofsArray = null;
    delete type.encode;
    delete type.decode;
    delete type.verify;
    return type;
}
/**
 * Message type descriptor.
 * @interface IType
 * @extends INamespace
 * @property {Object.<string,IOneOf>} [oneofs] Oneof descriptors
 * @property {Object.<string,IField>} fields Field descriptors
 * @property {number[][]} [extensions] Extension ranges
 * @property {Array.<number[]|string>} [reserved] Reserved ranges
 * @property {boolean} [group=false] Whether a legacy group or not
 */ /**
 * Creates a message type from a message type descriptor.
 * @param {string} name Message name
 * @param {IType} json Message type descriptor
 * @returns {Type} Created message type
 */ Type.fromJSON = function fromJSON(name, json) {
    var type = new Type(name, json.options);
    type.extensions = json.extensions;
    type.reserved = json.reserved;
    var names = Object.keys(json.fields), i = 0;
    for(; i < names.length; ++i)type.add((typeof json.fields[names[i]].keyType !== "undefined" ? MapField.fromJSON : Field.fromJSON)(names[i], json.fields[names[i]]));
    if (json.oneofs) for(names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
    if (json.nested) for(names = Object.keys(json.nested), i = 0; i < names.length; ++i){
        var nested = json.nested[names[i]];
        type.add((nested.id !== undefined ? Field.fromJSON : nested.fields !== undefined ? Type.fromJSON : nested.values !== undefined ? Enum.fromJSON : nested.methods !== undefined ? Service.fromJSON : Namespace.fromJSON)(names[i], nested));
    }
    if (json.extensions && json.extensions.length) type.extensions = json.extensions;
    if (json.reserved && json.reserved.length) type.reserved = json.reserved;
    if (json.group) type.group = true;
    if (json.comment) type.comment = json.comment;
    return type;
};
/**
 * Converts this message type to a message type descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IType} Message type descriptor
 */ Type.prototype.toJSON = function toJSON(toJSONOptions) {
    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        inherited && inherited.options || undefined,
        "oneofs",
        Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
        "fields",
        Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) {
            return !obj.declaringField;
        }), toJSONOptions) || {},
        "extensions",
        this.extensions && this.extensions.length ? this.extensions : undefined,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : undefined,
        "group",
        this.group || undefined,
        "nested",
        inherited && inherited.nested || undefined,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * @override
 */ Type.prototype.resolveAll = function resolveAll() {
    var fields = this.fieldsArray, i = 0;
    while(i < fields.length)fields[i++].resolve();
    var oneofs = this.oneofsArray;
    i = 0;
    while(i < oneofs.length)oneofs[i++].resolve();
    return Namespace.prototype.resolveAll.call(this);
};
/**
 * @override
 */ Type.prototype.get = function get(name) {
    return this.fields[name] || this.oneofs && this.oneofs[name] || this.nested && this.nested[name] || null;
};
/**
 * Adds a nested object to this type.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
 */ Type.prototype.add = function add(object) {
    if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this);
    if (object instanceof Field && object.extend === undefined) {
        // NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
        // The root object takes care of adding distinct sister-fields to the respective extended
        // type instead.
        // avoids calling the getter if not absolutely necessary because it's called quite frequently
        if (this._fieldsById ? /* istanbul ignore next */ this._fieldsById[object.id] : this.fieldsById[object.id]) throw Error("duplicate id " + object.id + " in " + this);
        if (this.isReservedId(object.id)) throw Error("id " + object.id + " is reserved in " + this);
        if (this.isReservedName(object.name)) throw Error("name '" + object.name + "' is reserved in " + this);
        if (object.parent) object.parent.remove(object);
        this.fields[object.name] = object;
        object.message = this;
        object.onAdd(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        if (!this.oneofs) this.oneofs = {};
        this.oneofs[object.name] = object;
        object.onAdd(this);
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};
/**
 * Removes a nested object from this type.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this type
 */ Type.prototype.remove = function remove(object) {
    if (object instanceof Field && object.extend === undefined) {
        // See Type#add for the reason why extension fields are excluded here.
        /* istanbul ignore if */ if (!this.fields || this.fields[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.fields[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        /* istanbul ignore if */ if (!this.oneofs || this.oneofs[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.oneofs[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};
/**
 * Tests if the specified id is reserved.
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Type.prototype.isReservedId = function isReservedId(id) {
    return Namespace.isReservedId(this.reserved, id);
};
/**
 * Tests if the specified name is reserved.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Type.prototype.isReservedName = function isReservedName(name) {
    return Namespace.isReservedName(this.reserved, name);
};
/**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<{}>} Message instance
 */ Type.prototype.create = function create(properties) {
    return new this.ctor(properties);
};
/**
 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
 * @returns {Type} `this`
 */ Type.prototype.setup = function setup() {
    // Sets up everything at once so that the prototype chain does not have to be re-evaluated
    // multiple times (V8, soft-deopt prototype-check).
    var fullName = this.fullName, types = [];
    for(var i = 0; i < /* initializes */ this.fieldsArray.length; ++i)types.push(this._fieldsArray[i].resolve().resolvedType);
    // Replace setup methods with type-specific generated functions
    this.encode = encoder(this)({
        Writer: Writer,
        types: types,
        util: util
    });
    this.decode = decoder(this)({
        Reader: Reader,
        types: types,
        util: util
    });
    this.verify = verifier(this)({
        types: types,
        util: util
    });
    this.fromObject = converter.fromObject(this)({
        types: types,
        util: util
    });
    this.toObject = converter.toObject(this)({
        types: types,
        util: util
    });
    // Inject custom wrappers for common types
    var wrapper = wrappers[fullName];
    if (wrapper) {
        var originalThis = Object.create(this);
        // if (wrapper.fromObject) {
        originalThis.fromObject = this.fromObject;
        this.fromObject = wrapper.fromObject.bind(originalThis);
        // }
        // if (wrapper.toObject) {
        originalThis.toObject = this.toObject;
        this.toObject = wrapper.toObject.bind(originalThis);
    // }
    }
    return this;
};
/**
 * Encodes a message of this type. Does not implicitly {@link Type#verify|verify} messages.
 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */ Type.prototype.encode = function encode_setup(message, writer) {
    return this.setup().encode(message, writer); // overrides this method
};
/**
 * Encodes a message of this type preceeded by its byte length as a varint. Does not implicitly {@link Type#verify|verify} messages.
 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */ Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
    return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
};
/**
 * Decodes a message of this type.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @param {number} [length] Length of the message, if known beforehand
 * @returns {Message<{}>} Decoded message
 * @throws {Error} If the payload is not a reader or valid buffer
 * @throws {util.ProtocolError<{}>} If required fields are missing
 */ Type.prototype.decode = function decode_setup(reader, length) {
    return this.setup().decode(reader, length); // overrides this method
};
/**
 * Decodes a message of this type preceeded by its byte length as a varint.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @returns {Message<{}>} Decoded message
 * @throws {Error} If the payload is not a reader or valid buffer
 * @throws {util.ProtocolError} If required fields are missing
 */ Type.prototype.decodeDelimited = function decodeDelimited(reader) {
    if (!(reader instanceof Reader)) reader = Reader.create(reader);
    return this.decode(reader, reader.uint32());
};
/**
 * Verifies that field values are valid and that required fields are present.
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {null|string} `null` if valid, otherwise the reason why it is not
 */ Type.prototype.verify = function verify_setup(message) {
    return this.setup().verify(message); // overrides this method
};
/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object to convert
 * @returns {Message<{}>} Message instance
 */ Type.prototype.fromObject = function fromObject(object) {
    return this.setup().fromObject(object);
};
/**
 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
 * @interface IConversionOptions
 * @property {Function} [longs] Long conversion type.
 * Valid values are `String` and `Number` (the global types).
 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
 * @property {Function} [enums] Enum value conversion type.
 * Only valid value is `String` (the global type).
 * Defaults to copy the present value, which is the numeric id.
 * @property {Function} [bytes] Bytes value conversion type.
 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
 * @property {boolean} [defaults=false] Also sets default values on the resulting object
 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
 * @property {boolean} [oneofs=false] Includes virtual oneof properties set to the present field's name, if any
 * @property {boolean} [json=false] Performs additional JSON compatibility conversions, i.e. NaN and Infinity to strings
 */ /**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {Message<{}>} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */ Type.prototype.toObject = function toObject(message, options) {
    return this.setup().toObject(message, options);
};
/**
 * Decorator function as returned by {@link Type.d} (TypeScript).
 * @typedef TypeDecorator
 * @type {function}
 * @param {Constructor<T>} target Target constructor
 * @returns {undefined}
 * @template T extends Message<T>
 */ /**
 * Type decorator (TypeScript).
 * @param {string} [typeName] Type name, defaults to the constructor's name
 * @returns {TypeDecorator<T>} Decorator function
 * @template T extends Message<T>
 */ Type.d = function decorateType(typeName) {
    return function typeDecorator(target) {
        util.decorateType(target, typeName);
    };
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/root.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Root;
// extends Namespace
var Namespace = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)");
((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = "Root";
var Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)"), Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), OneOf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
var Type, parse, common; // "
/**
 * Constructs a new root namespace instance.
 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
 * @extends NamespaceBase
 * @constructor
 * @param {Object.<string,*>} [options] Top level options
 */ function Root(options) {
    Namespace.call(this, "", options);
    /**
     * Deferred extension fields.
     * @type {Field[]}
     */ this.deferred = [];
    /**
     * Resolved file names of loaded files.
     * @type {string[]}
     */ this.files = [];
}
/**
 * Loads a namespace descriptor into a root namespace.
 * @param {INamespace} json Nameespace descriptor
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
 * @returns {Root} Root namespace
 */ Root.fromJSON = function fromJSON(json, root) {
    if (!root) root = new Root();
    if (json.options) root.setOptions(json.options);
    return root.addJSON(json.nested);
};
/**
 * Resolves the path of an imported file, relative to the importing origin.
 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
 * @function
 * @param {string} origin The file name of the importing file
 * @param {string} target The file name being imported
 * @returns {string|null} Resolved path to `target` or `null` to skip the file
 */ Root.prototype.resolvePath = util.path.resolve;
/**
 * Fetch content from file path or url
 * This method exists so you can override it with your own logic.
 * @function
 * @param {string} path File path or url
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 */ Root.prototype.fetch = util.fetch;
// A symbol-like function to safely signal synchronous loading
/* istanbul ignore next */ function SYNC() {} // eslint-disable-line no-empty-function
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} options Parse options
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 */ Root.prototype.load = function load(filename, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = undefined;
    }
    var self = this;
    if (!callback) return util.asPromise(load, self, filename, options);
    var sync = callback === SYNC; // undocumented
    // Finishes loading by calling the callback (exactly once)
    function finish(err, root) {
        /* istanbul ignore if */ if (!callback) return;
        if (sync) throw err;
        var cb = callback;
        callback = null;
        cb(err, root);
    }
    // Bundled definition existence checking
    function getBundledFileName(filename) {
        var idx = filename.lastIndexOf("google/protobuf/");
        if (idx > -1) {
            var altname = filename.substring(idx);
            if (altname in common) return altname;
        }
        return null;
    }
    // Processes a single file
    function process(filename, source) {
        try {
            if (util.isString(source) && source.charAt(0) === "{") source = JSON.parse(source);
            if (!util.isString(source)) self.setOptions(source.options).addJSON(source.nested);
            else {
                parse.filename = filename;
                var parsed = parse(source, self, options), resolved, i = 0;
                if (parsed.imports) {
                    for(; i < parsed.imports.length; ++i)if (resolved = getBundledFileName(parsed.imports[i]) || self.resolvePath(filename, parsed.imports[i])) fetch(resolved);
                }
                if (parsed.weakImports) {
                    for(i = 0; i < parsed.weakImports.length; ++i)if (resolved = getBundledFileName(parsed.weakImports[i]) || self.resolvePath(filename, parsed.weakImports[i])) fetch(resolved, true);
                }
            }
        } catch (err) {
            finish(err);
        }
        if (!sync && !queued) finish(null, self); // only once anyway
    }
    // Fetches a single file
    function fetch(filename, weak) {
        filename = getBundledFileName(filename) || filename;
        // Skip if already loaded / attempted
        if (self.files.indexOf(filename) > -1) return;
        self.files.push(filename);
        // Shortcut bundled definitions
        if (filename in common) {
            if (sync) process(filename, common[filename]);
            else {
                ++queued;
                setTimeout(function() {
                    --queued;
                    process(filename, common[filename]);
                });
            }
            return;
        }
        // Otherwise fetch from disk or network
        if (sync) {
            var source;
            try {
                source = util.fs.readFileSync(filename).toString("utf8");
            } catch (err) {
                if (!weak) finish(err);
                return;
            }
            process(filename, source);
        } else {
            ++queued;
            self.fetch(filename, function(err, source) {
                --queued;
                /* istanbul ignore if */ if (!callback) return; // terminated meanwhile
                if (err) {
                    /* istanbul ignore else */ if (!weak) finish(err);
                    else if (!queued) finish(null, self);
                    return;
                }
                process(filename, source);
            });
        }
    }
    var queued = 0;
    // Assembling the root namespace doesn't require working type
    // references anymore, so we can load everything in parallel
    if (util.isString(filename)) filename = [
        filename
    ];
    for(var i = 0, resolved; i < filename.length; ++i)if (resolved = self.resolvePath("", filename[i])) fetch(resolved);
    if (sync) return self;
    if (!queued) finish(null, self);
    return undefined;
};
// function load(filename:string, options:IParseOptions, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @function Root#load
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @variation 2
 */ // function load(filename:string, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
 * @function Root#load
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Promise<Root>} Promise
 * @variation 3
 */ // function load(filename:string, [options:IParseOptions]):Promise<Root>
/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
 * @function Root#loadSync
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 */ Root.prototype.loadSync = function loadSync(filename, options) {
    if (!util.isNode) throw Error("not supported");
    return this.load(filename, options, SYNC);
};
/**
 * @override
 */ Root.prototype.resolveAll = function resolveAll() {
    if (this.deferred.length) throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
        return "'extend " + field.extend + "' in " + field.parent.fullName;
    }).join(", "));
    return Namespace.prototype.resolveAll.call(this);
};
// only uppercased (and thus conflict-free) children are exposed, see below
var exposeRe = /^[A-Z]/;
/**
 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
 * @param {Root} root Root instance
 * @param {Field} field Declaring extension field witin the declaring type
 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
 * @inner
 * @ignore
 */ function tryHandleExtension(root, field) {
    var extendedType = field.parent.lookup(field.extend);
    if (extendedType) {
        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options);
        //do not allow to extend same field twice to prevent the error
        if (extendedType.get(sisterField.name)) {
            return true;
        }
        sisterField.declaringField = field;
        field.extensionField = sisterField;
        extendedType.add(sisterField);
        return true;
    }
    return false;
}
/**
 * Called when any object is added to this root or its sub-namespaces.
 * @param {ReflectionObject} object Object added
 * @returns {undefined}
 * @private
 */ Root.prototype._handleAdd = function _handleAdd(object) {
    if (object instanceof Field) {
        if (/* an extension field (implies not part of a oneof) */ object.extend !== undefined && /* not already handled */ !object.extensionField) {
            if (!tryHandleExtension(this, object)) this.deferred.push(object);
        }
    } else if (object instanceof Enum) {
        if (exposeRe.test(object.name)) object.parent[object.name] = object.values; // expose enum values as property of its parent
    } else if (!(object instanceof OneOf)) /* everything else is a namespace */ {
        if (object instanceof Type) for(var i = 0; i < this.deferred.length;)if (tryHandleExtension(this, this.deferred[i])) this.deferred.splice(i, 1);
        else ++i;
        for(var j = 0; j < /* initializes */ object.nestedArray.length; ++j)this._handleAdd(object._nestedArray[j]);
        if (exposeRe.test(object.name)) object.parent[object.name] = object; // expose namespace as property of its parent
    }
// The above also adds uppercased (and thus conflict-free) nested types, services and enums as
// properties of namespaces just like static code does. This allows using a .d.ts generated for
// a static module with reflection-based solutions where the condition is met.
};
/**
 * Called when any object is removed from this root or its sub-namespaces.
 * @param {ReflectionObject} object Object removed
 * @returns {undefined}
 * @private
 */ Root.prototype._handleRemove = function _handleRemove(object) {
    if (object instanceof Field) {
        if (/* an extension field */ object.extend !== undefined) {
            if (/* already handled */ object.extensionField) {
                object.extensionField.parent.remove(object.extensionField);
                object.extensionField = null;
            } else {
                var index = this.deferred.indexOf(object);
                /* istanbul ignore else */ if (index > -1) this.deferred.splice(index, 1);
            }
        }
    } else if (object instanceof Enum) {
        if (exposeRe.test(object.name)) delete object.parent[object.name]; // unexpose enum values
    } else if (object instanceof Namespace) {
        for(var i = 0; i < /* initializes */ object.nestedArray.length; ++i)this._handleRemove(object._nestedArray[i]);
        if (exposeRe.test(object.name)) delete object.parent[object.name]; // unexpose namespaces
    }
};
// Sets up cyclic dependencies (called in index-light)
Root._configure = function(Type_, parse_, common_) {
    Type = Type_;
    parse = parse_;
    common = common_;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * Various utility functions.
 * @namespace
 */ var util = module.exports = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
var roots = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/roots.js [app-rsc] (ecmascript)");
var Type, Enum;
util.codegen = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+codegen@2.0.4/node_modules/@protobufjs/codegen/index.js [app-rsc] (ecmascript)");
util.fetch = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+fetch@1.1.0/node_modules/@protobufjs/fetch/index.js [app-rsc] (ecmascript)");
util.path = __turbopack_require__("[project]/node_modules/.pnpm/@protobufjs+path@1.1.2/node_modules/@protobufjs/path/index.js [app-rsc] (ecmascript)");
/**
 * Node's fs module if available.
 * @type {Object.<string,*>}
 */ util.fs = util.inquire("fs");
/**
 * Converts an object's values to an array.
 * @param {Object.<string,*>} object Object to convert
 * @returns {Array.<*>} Converted array
 */ util.toArray = function toArray(object) {
    if (object) {
        var keys = Object.keys(object), array = new Array(keys.length), index = 0;
        while(index < keys.length)array[index] = object[keys[index++]];
        return array;
    }
    return [];
};
/**
 * Converts an array of keys immediately followed by their respective value to an object, omitting undefined values.
 * @param {Array.<*>} array Array to convert
 * @returns {Object.<string,*>} Converted object
 */ util.toObject = function toObject(array) {
    var object = {}, index = 0;
    while(index < array.length){
        var key = array[index++], val = array[index++];
        if (val !== undefined) object[key] = val;
    }
    return object;
};
var safePropBackslashRe = /\\/g, safePropQuoteRe = /"/g;
/**
 * Tests whether the specified name is a reserved word in JS.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ util.isReserved = function isReserved(name) {
    return /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/.test(name);
};
/**
 * Returns a safe property accessor for the specified property name.
 * @param {string} prop Property name
 * @returns {string} Safe accessor
 */ util.safeProp = function safeProp(prop) {
    if (!/^[$\w_]+$/.test(prop) || util.isReserved(prop)) return "[\"" + prop.replace(safePropBackslashRe, "\\\\").replace(safePropQuoteRe, "\\\"") + "\"]";
    return "." + prop;
};
/**
 * Converts the first character of a string to upper case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.ucFirst = function ucFirst(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
};
var camelCaseRe = /_([a-z])/g;
/**
 * Converts a string to camel case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.camelCase = function camelCase(str) {
    return str.substring(0, 1) + str.substring(1).replace(camelCaseRe, function($0, $1) {
        return $1.toUpperCase();
    });
};
/**
 * Compares reflected fields by id.
 * @param {Field} a First field
 * @param {Field} b Second field
 * @returns {number} Comparison value
 */ util.compareFieldsById = function compareFieldsById(a, b) {
    return a.id - b.id;
};
/**
 * Decorator helper for types (TypeScript).
 * @param {Constructor<T>} ctor Constructor function
 * @param {string} [typeName] Type name, defaults to the constructor's name
 * @returns {Type} Reflected type
 * @template T extends Message<T>
 * @property {Root} root Decorators root
 */ util.decorateType = function decorateType(ctor, typeName) {
    /* istanbul ignore if */ if (ctor.$type) {
        if (typeName && ctor.$type.name !== typeName) {
            util.decorateRoot.remove(ctor.$type);
            ctor.$type.name = typeName;
            util.decorateRoot.add(ctor.$type);
        }
        return ctor.$type;
    }
    /* istanbul ignore next */ if (!Type) Type = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/type.js [app-rsc] (ecmascript)");
    var type = new Type(typeName || ctor.name);
    util.decorateRoot.add(type);
    type.ctor = ctor; // sets up .encode, .decode etc.
    Object.defineProperty(ctor, "$type", {
        value: type,
        enumerable: false
    });
    Object.defineProperty(ctor.prototype, "$type", {
        value: type,
        enumerable: false
    });
    return type;
};
var decorateEnumIndex = 0;
/**
 * Decorator helper for enums (TypeScript).
 * @param {Object} object Enum object
 * @returns {Enum} Reflected enum
 */ util.decorateEnum = function decorateEnum(object) {
    /* istanbul ignore if */ if (object.$type) return object.$type;
    /* istanbul ignore next */ if (!Enum) Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)");
    var enm = new Enum("Enum" + decorateEnumIndex++, object);
    util.decorateRoot.add(enm);
    Object.defineProperty(object, "$type", {
        value: enm,
        enumerable: false
    });
    return enm;
};
/**
 * Sets the value of a property by property path. If a value already exists, it is turned to an array
 * @param {Object.<string,*>} dst Destination object
 * @param {string} path dot '.' delimited path of the property to set
 * @param {Object} value the value to set
 * @returns {Object.<string,*>} Destination object
 */ util.setProperty = function setProperty(dst, path, value) {
    function setProp(dst, path, value) {
        var part = path.shift();
        if (part === "__proto__" || part === "prototype") {
            return dst;
        }
        if (path.length > 0) {
            dst[part] = setProp(dst[part] || {}, path, value);
        } else {
            var prevValue = dst[part];
            if (prevValue) value = [].concat(prevValue).concat(value);
            dst[part] = value;
        }
        return dst;
    }
    if (typeof dst !== "object") throw TypeError("dst must be an object");
    if (!path) throw TypeError("path must be specified");
    path = path.split(".");
    return setProp(dst, path, value);
};
/**
 * Decorator root (TypeScript).
 * @name util.decorateRoot
 * @type {Root}
 * @readonly
 */ Object.defineProperty(util, "decorateRoot", {
    get: function() {
        return roots["decorated"] || (roots["decorated"] = new (__turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/root.js [app-rsc] (ecmascript)"))());
    }
});
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = ReflectionObject;
ReflectionObject.className = "ReflectionObject";
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
var Root; // cyclic
/**
 * Constructs a new reflection object instance.
 * @classdesc Base class of all reflection objects.
 * @constructor
 * @param {string} name Object name
 * @param {Object.<string,*>} [options] Declared options
 * @abstract
 */ function ReflectionObject(name, options) {
    if (!util.isString(name)) throw TypeError("name must be a string");
    if (options && !util.isObject(options)) throw TypeError("options must be an object");
    /**
     * Options.
     * @type {Object.<string,*>|undefined}
     */ this.options = options; // toJSON
    /**
     * Parsed Options.
     * @type {Array.<Object.<string,*>>|undefined}
     */ this.parsedOptions = null;
    /**
     * Unique name within its namespace.
     * @type {string}
     */ this.name = name;
    /**
     * Parent namespace.
     * @type {Namespace|null}
     */ this.parent = null;
    /**
     * Whether already resolved or not.
     * @type {boolean}
     */ this.resolved = false;
    /**
     * Comment text, if any.
     * @type {string|null}
     */ this.comment = null;
    /**
     * Defining file name.
     * @type {string|null}
     */ this.filename = null;
}
Object.defineProperties(ReflectionObject.prototype, {
    /**
     * Reference to the root namespace.
     * @name ReflectionObject#root
     * @type {Root}
     * @readonly
     */ root: {
        get: function() {
            var ptr = this;
            while(ptr.parent !== null)ptr = ptr.parent;
            return ptr;
        }
    },
    /**
     * Full name including leading dot.
     * @name ReflectionObject#fullName
     * @type {string}
     * @readonly
     */ fullName: {
        get: function() {
            var path = [
                this.name
            ], ptr = this.parent;
            while(ptr){
                path.unshift(ptr.name);
                ptr = ptr.parent;
            }
            return path.join(".");
        }
    }
});
/**
 * Converts this reflection object to its descriptor representation.
 * @returns {Object.<string,*>} Descriptor
 * @abstract
 */ ReflectionObject.prototype.toJSON = /* istanbul ignore next */ function toJSON() {
    throw Error(); // not implemented, shouldn't happen
};
/**
 * Called when this object is added to a parent.
 * @param {ReflectionObject} parent Parent added to
 * @returns {undefined}
 */ ReflectionObject.prototype.onAdd = function onAdd(parent) {
    if (this.parent && this.parent !== parent) this.parent.remove(this);
    this.parent = parent;
    this.resolved = false;
    var root = parent.root;
    if (root instanceof Root) root._handleAdd(this);
};
/**
 * Called when this object is removed from a parent.
 * @param {ReflectionObject} parent Parent removed from
 * @returns {undefined}
 */ ReflectionObject.prototype.onRemove = function onRemove(parent) {
    var root = parent.root;
    if (root instanceof Root) root._handleRemove(this);
    this.parent = null;
    this.resolved = false;
};
/**
 * Resolves this objects type references.
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    if (this.root instanceof Root) this.resolved = true; // only if part of a root
    return this;
};
/**
 * Gets an option value.
 * @param {string} name Option name
 * @returns {*} Option value or `undefined` if not set
 */ ReflectionObject.prototype.getOption = function getOption(name) {
    if (this.options) return this.options[name];
    return undefined;
};
/**
 * Sets an option.
 * @param {string} name Option name
 * @param {*} value Option value
 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (!ifNotSet || !this.options || this.options[name] === undefined) (this.options || (this.options = {}))[name] = value;
    return this;
};
/**
 * Sets a parsed option.
 * @param {string} name parsed Option name
 * @param {*} value Option value
 * @param {string} propName dot '.' delimited full path of property within the option to set. if undefined\empty, will add a new option with that value
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setParsedOption = function setParsedOption(name, value, propName) {
    if (!this.parsedOptions) {
        this.parsedOptions = [];
    }
    var parsedOptions = this.parsedOptions;
    if (propName) {
        // If setting a sub property of an option then try to merge it
        // with an existing option
        var opt = parsedOptions.find(function(opt) {
            return Object.prototype.hasOwnProperty.call(opt, name);
        });
        if (opt) {
            // If we found an existing option - just merge the property value
            var newValue = opt[name];
            util.setProperty(newValue, propName, value);
        } else {
            // otherwise, create a new option, set it's property and add it to the list
            opt = {};
            opt[name] = util.setProperty({}, propName, value);
            parsedOptions.push(opt);
        }
    } else {
        // Always create a new option when setting the value of the option itself
        var newOpt = {};
        newOpt[name] = value;
        parsedOptions.push(newOpt);
    }
    return this;
};
/**
 * Sets multiple options.
 * @param {Object.<string,*>} options Options to set
 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
    if (options) for(var keys = Object.keys(options), i = 0; i < keys.length; ++i)this.setOption(keys[i], options[keys[i]], ifNotSet);
    return this;
};
/**
 * Converts this instance to its string representation.
 * @returns {string} Class name[, space, full name]
 */ ReflectionObject.prototype.toString = function toString() {
    var className = this.constructor.className, fullName = this.fullName;
    if (fullName.length) return className + " " + fullName;
    return className;
};
// Sets up cyclic dependencies (called in index-light)
ReflectionObject._configure = function(Root_) {
    Root = Root_;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = Enum;
// extends ReflectionObject
var ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = "Enum";
var Namespace = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Constructs a new enum instance.
 * @classdesc Reflected enum.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {Object.<string,number>} [values] Enum values as an object, by name
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] The comment for this enum
 * @param {Object.<string,string>} [comments] The value comments for this enum
 * @param {Object.<string,Object<string,*>>|undefined} [valuesOptions] The value options for this enum
 */ function Enum(name, values, options, comment, comments, valuesOptions) {
    ReflectionObject.call(this, name, options);
    if (values && typeof values !== "object") throw TypeError("values must be an object");
    /**
     * Enum values by id.
     * @type {Object.<number,string>}
     */ this.valuesById = {};
    /**
     * Enum values by name.
     * @type {Object.<string,number>}
     */ this.values = Object.create(this.valuesById); // toJSON, marker
    /**
     * Enum comment text.
     * @type {string|null}
     */ this.comment = comment;
    /**
     * Value comment texts, if any.
     * @type {Object.<string,string>}
     */ this.comments = comments || {};
    /**
     * Values options, if any
     * @type {Object<string, Object<string, *>>|undefined}
     */ this.valuesOptions = valuesOptions;
    /**
     * Reserved ranges, if any.
     * @type {Array.<number[]|string>}
     */ this.reserved = undefined; // toJSON
    // Note that values inherit valuesById on their prototype which makes them a TypeScript-
    // compatible enum. This is used by pbts to write actual enum definitions that work for
    // static and reflection code alike instead of emitting generic object definitions.
    if (values) {
        for(var keys = Object.keys(values), i = 0; i < keys.length; ++i)if (typeof values[keys[i]] === "number") this.valuesById[this.values[keys[i]] = values[keys[i]]] = keys[i];
    }
}
/**
 * Enum descriptor.
 * @interface IEnum
 * @property {Object.<string,number>} values Enum values
 * @property {Object.<string,*>} [options] Enum options
 */ /**
 * Constructs an enum from an enum descriptor.
 * @param {string} name Enum name
 * @param {IEnum} json Enum descriptor
 * @returns {Enum} Created enum
 * @throws {TypeError} If arguments are invalid
 */ Enum.fromJSON = function fromJSON(name, json) {
    var enm = new Enum(name, json.values, json.options, json.comment, json.comments);
    enm.reserved = json.reserved;
    return enm;
};
/**
 * Converts this enum to an enum descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IEnum} Enum descriptor
 */ Enum.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        this.options,
        "valuesOptions",
        this.valuesOptions,
        "values",
        this.values,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : undefined,
        "comment",
        keepComments ? this.comment : undefined,
        "comments",
        keepComments ? this.comments : undefined
    ]);
};
/**
 * Adds a value to this enum.
 * @param {string} name Value name
 * @param {number} id Value id
 * @param {string} [comment] Comment, if any
 * @param {Object.<string, *>|undefined} [options] Options, if any
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a value with this name or id
 */ Enum.prototype.add = function add(name, id, comment, options) {
    // utilized by the parser but not by .fromJSON
    if (!util.isString(name)) throw TypeError("name must be a string");
    if (!util.isInteger(id)) throw TypeError("id must be an integer");
    if (this.values[name] !== undefined) throw Error("duplicate name '" + name + "' in " + this);
    if (this.isReservedId(id)) throw Error("id " + id + " is reserved in " + this);
    if (this.isReservedName(name)) throw Error("name '" + name + "' is reserved in " + this);
    if (this.valuesById[id] !== undefined) {
        if (!(this.options && this.options.allow_alias)) throw Error("duplicate id " + id + " in " + this);
        this.values[name] = id;
    } else this.valuesById[this.values[name] = id] = name;
    if (options) {
        if (this.valuesOptions === undefined) this.valuesOptions = {};
        this.valuesOptions[name] = options || null;
    }
    this.comments[name] = comment || null;
    return this;
};
/**
 * Removes a value from this enum
 * @param {string} name Value name
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `name` is not a name of this enum
 */ Enum.prototype.remove = function remove(name) {
    if (!util.isString(name)) throw TypeError("name must be a string");
    var val = this.values[name];
    if (val == null) throw Error("name '" + name + "' does not exist in " + this);
    delete this.valuesById[val];
    delete this.values[name];
    delete this.comments[name];
    if (this.valuesOptions) delete this.valuesOptions[name];
    return this;
};
/**
 * Tests if the specified id is reserved.
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Enum.prototype.isReservedId = function isReservedId(id) {
    return Namespace.isReservedId(this.reserved, id);
};
/**
 * Tests if the specified name is reserved.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Enum.prototype.isReservedName = function isReservedName(name) {
    return Namespace.isReservedName(this.reserved, name);
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/encoder.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = encoder;
var Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
/**
 * Generates a partial message type encoder.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genTypePartial(gen, field, fieldIndex, ref) {
    return field.resolvedType.group ? gen("types[%i].encode(%s,w.uint32(%i)).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0) : gen("types[%i].encode(%s,w.uint32(%i).fork()).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
}
/**
 * Generates an encoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function encoder(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var gen = util.codegen([
        "m",
        "w"
    ], mtype.name + "$encode")("if(!w)")("w=Writer.create()");
    var i, ref;
    // "when a message is serialized its known fields should be written sequentially by field number"
    var fields = /* initializes */ mtype.fieldsArray.slice().sort(util.compareFieldsById);
    for(var i = 0; i < fields.length; ++i){
        var field = fields[i].resolve(), index = mtype._fieldsArray.indexOf(field), type = field.resolvedType instanceof Enum ? "int32" : field.type, wireType = types.basic[type];
        ref = "m" + util.safeProp(field.name);
        // Map fields
        if (field.map) {
            gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name) // !== undefined && !== null
            ("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref)("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType);
            if (wireType === undefined) gen("types[%i].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()", index, ref); // can't be groups
            else gen(".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref);
            gen("}")("}");
        // Repeated fields
        } else if (field.repeated) {
            gen("if(%s!=null&&%s.length){", ref, ref); // !== undefined && !== null
            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) {
                gen("w.uint32(%i).fork()", (field.id << 3 | 2) >>> 0)("for(var i=0;i<%s.length;++i)", ref)("w.%s(%s[i])", type, ref)("w.ldelim()");
            // Non-packed
            } else {
                gen("for(var i=0;i<%s.length;++i)", ref);
                if (wireType === undefined) genTypePartial(gen, field, index, ref + "[i]");
                else gen("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref);
            }
            gen("}");
        // Non-repeated
        } else {
            if (field.optional) gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j))", ref, field.name); // !== undefined && !== null
            if (wireType === undefined) genTypePartial(gen, field, index, ref);
            else gen("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);
        }
    }
    return gen("return w");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer_buffer.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = BufferWriter;
// extends Writer
var Writer = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer.js [app-rsc] (ecmascript)");
(BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */ function BufferWriter() {
    Writer.call(this);
}
BufferWriter._configure = function() {
    /**
     * Allocates a buffer of the specified size.
     * @function
     * @param {number} size Buffer size
     * @returns {Buffer} Buffer
     */ BufferWriter.alloc = util._Buffer_allocUnsafe;
    BufferWriter.writeBytesBuffer = util.Buffer && util.Buffer.prototype instanceof Uint8Array && util.Buffer.prototype.set.name === "set" ? function writeBytesBuffer_set(val, buf, pos) {
        buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
    // also works for plain array values
    } : function writeBytesBuffer_copy(val, buf, pos) {
        if (val.copy) val.copy(buf, pos, 0, val.length);
        else for(var i = 0; i < val.length;)buf[pos++] = val[i++];
    };
};
/**
 * @override
 */ BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
    if (util.isString(value)) value = util._Buffer_from(value, "base64");
    var len = value.length >>> 0;
    this.uint32(len);
    if (len) this._push(BufferWriter.writeBytesBuffer, len, value);
    return this;
};
function writeStringBuffer(val, buf, pos) {
    if (val.length < 40) util.utf8.write(val, buf, pos);
    else if (buf.utf8Write) buf.utf8Write(val, pos);
    else buf.write(val, pos);
}
/**
 * @override
 */ BufferWriter.prototype.string = function write_string_buffer(value) {
    var len = util.Buffer.byteLength(value);
    this.uint32(len);
    if (len) this._push(writeStringBuffer, len, value);
    return this;
};
/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */ BufferWriter._configure();
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader_buffer.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = BufferReader;
// extends Reader
var Reader = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader.js [app-rsc] (ecmascript)");
(BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader;
var util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */ function BufferReader(buffer) {
    Reader.call(this, buffer);
/**
     * Read buffer.
     * @name BufferReader#buf
     * @type {Buffer}
     */ }
BufferReader._configure = function() {
    /* istanbul ignore else */ if (util.Buffer) BufferReader.prototype._slice = util.Buffer.prototype.slice;
};
/**
 * @override
 */ BufferReader.prototype.string = function read_string_buffer() {
    var len = this.uint32(); // modifies pos
    return this.buf.utf8Slice ? this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len)) : this.buf.toString("utf-8", this.pos, this.pos = Math.min(this.pos + len, this.len));
};
/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */ BufferReader._configure();
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index-minimal.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var protobuf = exports;
/**
 * Build type, one of `"full"`, `"light"` or `"minimal"`.
 * @name build
 * @type {string}
 * @const
 */ protobuf.build = "minimal";
// Serialization
protobuf.Writer = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer.js [app-rsc] (ecmascript)");
protobuf.BufferWriter = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/writer_buffer.js [app-rsc] (ecmascript)");
protobuf.Reader = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader.js [app-rsc] (ecmascript)");
protobuf.BufferReader = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/reader_buffer.js [app-rsc] (ecmascript)");
// Utility
protobuf.util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util/minimal.js [app-rsc] (ecmascript)");
protobuf.rpc = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/rpc.js [app-rsc] (ecmascript)");
protobuf.roots = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/roots.js [app-rsc] (ecmascript)");
protobuf.configure = configure;
/* istanbul ignore next */ /**
 * Reconfigures the library according to the environment.
 * @returns {undefined}
 */ function configure() {
    protobuf.util._configure();
    protobuf.Writer._configure(protobuf.BufferWriter);
    protobuf.Reader._configure(protobuf.BufferReader);
}
// Set up buffer utility according to the environment
configure();
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index-light.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var protobuf = module.exports = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index-minimal.js [app-rsc] (ecmascript)");
protobuf.build = "light";
/**
 * A node-style callback as used by {@link load} and {@link Root#load}.
 * @typedef LoadCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Root} [root] Root, if there hasn't been an error
 * @returns {undefined}
 */ /**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} root Root namespace, defaults to create a new one if omitted.
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 */ function load(filename, root, callback) {
    if (typeof root === "function") {
        callback = root;
        root = new protobuf.Root();
    } else if (!root) root = new protobuf.Root();
    return root.load(filename, callback);
}
/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 * @variation 2
 */ // function load(filename:string, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Promise<Root>} Promise
 * @see {@link Root#load}
 * @variation 3
 */ // function load(filename:string, [root:Root]):Promise<Root>
protobuf.load = load;
/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 * @see {@link Root#loadSync}
 */ function loadSync(filename, root) {
    if (!root) root = new protobuf.Root();
    return root.loadSync(filename);
}
protobuf.loadSync = loadSync;
// Serialization
protobuf.encoder = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/encoder.js [app-rsc] (ecmascript)");
protobuf.decoder = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/decoder.js [app-rsc] (ecmascript)");
protobuf.verifier = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/verifier.js [app-rsc] (ecmascript)");
protobuf.converter = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/converter.js [app-rsc] (ecmascript)");
// Reflection
protobuf.ReflectionObject = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/object.js [app-rsc] (ecmascript)");
protobuf.Namespace = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/namespace.js [app-rsc] (ecmascript)");
protobuf.Root = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/root.js [app-rsc] (ecmascript)");
protobuf.Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)");
protobuf.Type = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/type.js [app-rsc] (ecmascript)");
protobuf.Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)");
protobuf.OneOf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)");
protobuf.MapField = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/mapfield.js [app-rsc] (ecmascript)");
protobuf.Service = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/service.js [app-rsc] (ecmascript)");
protobuf.Method = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/method.js [app-rsc] (ecmascript)");
// Runtime
protobuf.Message = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/message.js [app-rsc] (ecmascript)");
protobuf.wrappers = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/wrappers.js [app-rsc] (ecmascript)");
// Utility
protobuf.types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)");
protobuf.util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
// Set up possibly cyclic reflection dependencies
protobuf.ReflectionObject._configure(protobuf.Root);
protobuf.Namespace._configure(protobuf.Type, protobuf.Service, protobuf.Enum);
protobuf.Root._configure(protobuf.Type);
protobuf.Field._configure(protobuf.Type);
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/tokenize.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = tokenize;
var delimRe = /[\s{}=;:[\],'"()<>]/g, stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g, stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g;
var setCommentRe = /^ *[*/]+ */, setCommentAltRe = /^\s*\*?\/*/, setCommentSplitRe = /\n/g, whitespaceRe = /\s/, unescapeRe = /\\(.?)/g;
var unescapeMap = {
    "0": "\0",
    "r": "\r",
    "n": "\n",
    "t": "\t"
};
/**
 * Unescapes a string.
 * @param {string} str String to unescape
 * @returns {string} Unescaped string
 * @property {Object.<string,string>} map Special characters map
 * @memberof tokenize
 */ function unescape(str) {
    return str.replace(unescapeRe, function($0, $1) {
        switch($1){
            case "\\":
            case "":
                return $1;
            default:
                return unescapeMap[$1] || "";
        }
    });
}
tokenize.unescape = unescape;
/**
 * Gets the next token and advances.
 * @typedef TokenizerHandleNext
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */ /**
 * Peeks for the next token.
 * @typedef TokenizerHandlePeek
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */ /**
 * Pushes a token back to the stack.
 * @typedef TokenizerHandlePush
 * @type {function}
 * @param {string} token Token
 * @returns {undefined}
 */ /**
 * Skips the next token.
 * @typedef TokenizerHandleSkip
 * @type {function}
 * @param {string} expected Expected token
 * @param {boolean} [optional=false] If optional
 * @returns {boolean} Whether the token matched
 * @throws {Error} If the token didn't match and is not optional
 */ /**
 * Gets the comment on the previous line or, alternatively, the line comment on the specified line.
 * @typedef TokenizerHandleCmnt
 * @type {function}
 * @param {number} [line] Line number
 * @returns {string|null} Comment text or `null` if none
 */ /**
 * Handle object returned from {@link tokenize}.
 * @interface ITokenizerHandle
 * @property {TokenizerHandleNext} next Gets the next token and advances (`null` on eof)
 * @property {TokenizerHandlePeek} peek Peeks for the next token (`null` on eof)
 * @property {TokenizerHandlePush} push Pushes a token back to the stack
 * @property {TokenizerHandleSkip} skip Skips a token, returns its presence and advances or, if non-optional and not present, throws
 * @property {TokenizerHandleCmnt} cmnt Gets the comment on the previous line or the line comment on the specified line, if any
 * @property {number} line Current line number
 */ /**
 * Tokenizes the given .proto source and returns an object with useful utility functions.
 * @param {string} source Source contents
 * @param {boolean} alternateCommentMode Whether we should activate alternate comment parsing mode.
 * @returns {ITokenizerHandle} Tokenizer handle
 */ function tokenize(source, alternateCommentMode) {
    /* eslint-disable callback-return */ source = source.toString();
    var offset = 0, length = source.length, line = 1, lastCommentLine = 0, comments = {};
    var stack = [];
    var stringDelim = null;
    /* istanbul ignore next */ /**
     * Creates an error for illegal syntax.
     * @param {string} subject Subject
     * @returns {Error} Error created
     * @inner
     */ function illegal(subject) {
        return Error("illegal " + subject + " (line " + line + ")");
    }
    /**
     * Reads a string till its end.
     * @returns {string} String read
     * @inner
     */ function readString() {
        var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe;
        re.lastIndex = offset - 1;
        var match = re.exec(source);
        if (!match) throw illegal("string");
        offset = re.lastIndex;
        push(stringDelim);
        stringDelim = null;
        return unescape(match[1]);
    }
    /**
     * Gets the character at `pos` within the source.
     * @param {number} pos Position
     * @returns {string} Character
     * @inner
     */ function charAt(pos) {
        return source.charAt(pos);
    }
    /**
     * Sets the current comment text.
     * @param {number} start Start offset
     * @param {number} end End offset
     * @param {boolean} isLeading set if a leading comment
     * @returns {undefined}
     * @inner
     */ function setComment(start, end, isLeading) {
        var comment = {
            type: source.charAt(start++),
            lineEmpty: false,
            leading: isLeading
        };
        var lookback;
        if (alternateCommentMode) {
            lookback = 2; // alternate comment parsing: "//" or "/*"
        } else {
            lookback = 3; // "///" or "/**"
        }
        var commentOffset = start - lookback, c;
        do {
            if (--commentOffset < 0 || (c = source.charAt(commentOffset)) === "\n") {
                comment.lineEmpty = true;
                break;
            }
        }while (c === " " || c === "\t")
        var lines = source.substring(start, end).split(setCommentSplitRe);
        for(var i = 0; i < lines.length; ++i)lines[i] = lines[i].replace(alternateCommentMode ? setCommentAltRe : setCommentRe, "").trim();
        comment.text = lines.join("\n").trim();
        comments[line] = comment;
        lastCommentLine = line;
    }
    function isDoubleSlashCommentLine(startOffset) {
        var endOffset = findEndOfLine(startOffset);
        // see if remaining line matches comment pattern
        var lineText = source.substring(startOffset, endOffset);
        var isComment = /^\s*\/\//.test(lineText);
        return isComment;
    }
    function findEndOfLine(cursor) {
        // find end of cursor's line
        var endOffset = cursor;
        while(endOffset < length && charAt(endOffset) !== "\n"){
            endOffset++;
        }
        return endOffset;
    }
    /**
     * Obtains the next token.
     * @returns {string|null} Next token or `null` on eof
     * @inner
     */ function next() {
        if (stack.length > 0) return stack.shift();
        if (stringDelim) return readString();
        var repeat, prev, curr, start, isDoc, isLeadingComment = offset === 0;
        do {
            if (offset === length) return null;
            repeat = false;
            while(whitespaceRe.test(curr = charAt(offset))){
                if (curr === "\n") {
                    isLeadingComment = true;
                    ++line;
                }
                if (++offset === length) return null;
            }
            if (charAt(offset) === "/") {
                if (++offset === length) {
                    throw illegal("comment");
                }
                if (charAt(offset) === "/") {
                    if (!alternateCommentMode) {
                        // check for triple-slash comment
                        isDoc = charAt(start = offset + 1) === "/";
                        while(charAt(++offset) !== "\n"){
                            if (offset === length) {
                                return null;
                            }
                        }
                        ++offset;
                        if (isDoc) {
                            setComment(start, offset - 1, isLeadingComment);
                            // Trailing comment cannot not be multi-line,
                            // so leading comment state should be reset to handle potential next comments
                            isLeadingComment = true;
                        }
                        ++line;
                        repeat = true;
                    } else {
                        // check for double-slash comments, consolidating consecutive lines
                        start = offset;
                        isDoc = false;
                        if (isDoubleSlashCommentLine(offset - 1)) {
                            isDoc = true;
                            do {
                                offset = findEndOfLine(offset);
                                if (offset === length) {
                                    break;
                                }
                                offset++;
                                if (!isLeadingComment) {
                                    break;
                                }
                            }while (isDoubleSlashCommentLine(offset))
                        } else {
                            offset = Math.min(length, findEndOfLine(offset) + 1);
                        }
                        if (isDoc) {
                            setComment(start, offset, isLeadingComment);
                            isLeadingComment = true;
                        }
                        line++;
                        repeat = true;
                    }
                } else if ((curr = charAt(offset)) === "*") {
                    // check for /** (regular comment mode) or /* (alternate comment mode)
                    start = offset + 1;
                    isDoc = alternateCommentMode || charAt(start) === "*";
                    do {
                        if (curr === "\n") {
                            ++line;
                        }
                        if (++offset === length) {
                            throw illegal("comment");
                        }
                        prev = curr;
                        curr = charAt(offset);
                    }while (prev !== "*" || curr !== "/")
                    ++offset;
                    if (isDoc) {
                        setComment(start, offset - 2, isLeadingComment);
                        isLeadingComment = true;
                    }
                    repeat = true;
                } else {
                    return "/";
                }
            }
        }while (repeat)
        // offset !== length if we got here
        var end = offset;
        delimRe.lastIndex = 0;
        var delim = delimRe.test(charAt(end++));
        if (!delim) while(end < length && !delimRe.test(charAt(end)))++end;
        var token = source.substring(offset, offset = end);
        if (token === "\"" || token === "'") stringDelim = token;
        return token;
    }
    /**
     * Pushes a token back to the stack.
     * @param {string} token Token
     * @returns {undefined}
     * @inner
     */ function push(token) {
        stack.push(token);
    }
    /**
     * Peeks for the next token.
     * @returns {string|null} Token or `null` on eof
     * @inner
     */ function peek() {
        if (!stack.length) {
            var token = next();
            if (token === null) return null;
            push(token);
        }
        return stack[0];
    }
    /**
     * Skips a token.
     * @param {string} expected Expected token
     * @param {boolean} [optional=false] Whether the token is optional
     * @returns {boolean} `true` when skipped, `false` if not
     * @throws {Error} When a required token is not present
     * @inner
     */ function skip(expected, optional) {
        var actual = peek(), equals = actual === expected;
        if (equals) {
            next();
            return true;
        }
        if (!optional) throw illegal("token '" + actual + "', '" + expected + "' expected");
        return false;
    }
    /**
     * Gets a comment.
     * @param {number} [trailingLine] Line number if looking for a trailing comment
     * @returns {string|null} Comment text
     * @inner
     */ function cmnt(trailingLine) {
        var ret = null;
        var comment;
        if (trailingLine === undefined) {
            comment = comments[line - 1];
            delete comments[line - 1];
            if (comment && (alternateCommentMode || comment.type === "*" || comment.lineEmpty)) {
                ret = comment.leading ? comment.text : null;
            }
        } else {
            /* istanbul ignore else */ if (lastCommentLine < trailingLine) {
                peek();
            }
            comment = comments[trailingLine];
            delete comments[trailingLine];
            if (comment && !comment.lineEmpty && (alternateCommentMode || comment.type === "/")) {
                ret = comment.leading ? null : comment.text;
            }
        }
        return ret;
    }
    return Object.defineProperty({
        next: next,
        peek: peek,
        push: push,
        skip: skip,
        cmnt: cmnt
    }, "line", {
        get: function() {
            return line;
        }
    });
/* eslint-enable callback-return */ }
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/parse.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = parse;
parse.filename = null;
parse.defaults = {
    keepCase: false
};
var tokenize = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/tokenize.js [app-rsc] (ecmascript)"), Root = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/root.js [app-rsc] (ecmascript)"), Type = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/type.js [app-rsc] (ecmascript)"), Field = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/field.js [app-rsc] (ecmascript)"), MapField = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/mapfield.js [app-rsc] (ecmascript)"), OneOf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/oneof.js [app-rsc] (ecmascript)"), Enum = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/enum.js [app-rsc] (ecmascript)"), Service = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/service.js [app-rsc] (ecmascript)"), Method = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/method.js [app-rsc] (ecmascript)"), types = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/types.js [app-rsc] (ecmascript)"), util = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/util.js [app-rsc] (ecmascript)");
var base10Re = /^[1-9][0-9]*$/, base10NegRe = /^-?[1-9][0-9]*$/, base16Re = /^0[x][0-9a-fA-F]+$/, base16NegRe = /^-?0[x][0-9a-fA-F]+$/, base8Re = /^0[0-7]+$/, base8NegRe = /^-?0[0-7]+$/, numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/, nameRe = /^[a-zA-Z_][a-zA-Z_0-9]*$/, typeRefRe = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/, fqTypeRefRe = /^(?:\.[a-zA-Z_][a-zA-Z_0-9]*)+$/;
/**
 * Result object returned from {@link parse}.
 * @interface IParserResult
 * @property {string|undefined} package Package name, if declared
 * @property {string[]|undefined} imports Imports, if any
 * @property {string[]|undefined} weakImports Weak imports, if any
 * @property {string|undefined} syntax Syntax, if specified (either `"proto2"` or `"proto3"`)
 * @property {Root} root Populated root instance
 */ /**
 * Options modifying the behavior of {@link parse}.
 * @interface IParseOptions
 * @property {boolean} [keepCase=false] Keeps field casing instead of converting to camel case
 * @property {boolean} [alternateCommentMode=false] Recognize double-slash comments in addition to doc-block comments.
 * @property {boolean} [preferTrailingComment=false] Use trailing comment when both leading comment and trailing comment exist.
 */ /**
 * Options modifying the behavior of JSON serialization.
 * @interface IToJSONOptions
 * @property {boolean} [keepComments=false] Serializes comments.
 */ /**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @param {string} source Source contents
 * @param {Root} root Root to populate
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {IParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {IParseOptions} defaults Default {@link IParseOptions}
 */ function parse(source, root, options) {
    /* eslint-disable callback-return */ if (!(root instanceof Root)) {
        options = root;
        root = new Root();
    }
    if (!options) options = parse.defaults;
    var preferTrailingComment = options.preferTrailingComment || false;
    var tn = tokenize(source, options.alternateCommentMode || false), next = tn.next, push = tn.push, peek = tn.peek, skip = tn.skip, cmnt = tn.cmnt;
    var head = true, pkg, imports, weakImports, syntax, isProto3 = false;
    var ptr = root;
    var applyCase = options.keepCase ? function(name) {
        return name;
    } : util.camelCase;
    /* istanbul ignore next */ function illegal(token, name, insideTryCatch) {
        var filename = parse.filename;
        if (!insideTryCatch) parse.filename = null;
        return Error("illegal " + (name || "token") + " '" + token + "' (" + (filename ? filename + ", " : "") + "line " + tn.line + ")");
    }
    function readString() {
        var values = [], token;
        do {
            /* istanbul ignore if */ if ((token = next()) !== "\"" && token !== "'") throw illegal(token);
            values.push(next());
            skip(token);
            token = peek();
        }while (token === "\"" || token === "'")
        return values.join("");
    }
    function readValue(acceptTypeRef) {
        var token = next();
        switch(token){
            case "'":
            case "\"":
                push(token);
                return readString();
            case "true":
            case "TRUE":
                return true;
            case "false":
            case "FALSE":
                return false;
        }
        try {
            return parseNumber(token, /* insideTryCatch */ true);
        } catch (e) {
            /* istanbul ignore else */ if (acceptTypeRef && typeRefRe.test(token)) return token;
            /* istanbul ignore next */ throw illegal(token, "value");
        }
    }
    function readRanges(target, acceptStrings) {
        var token, start;
        do {
            if (acceptStrings && ((token = peek()) === "\"" || token === "'")) target.push(readString());
            else target.push([
                start = parseId(next()),
                skip("to", true) ? parseId(next()) : start
            ]);
        }while (skip(",", true))
        var dummy = {
            options: undefined
        };
        dummy.setOption = function(name, value) {
            if (this.options === undefined) this.options = {};
            this.options[name] = value;
        };
        ifBlock(dummy, function parseRange_block(token) {
            /* istanbul ignore else */ if (token === "option") {
                parseOption(dummy, token); // skip
                skip(";");
            } else throw illegal(token);
        }, function parseRange_line() {
            parseInlineOptions(dummy); // skip
        });
    }
    function parseNumber(token, insideTryCatch) {
        var sign = 1;
        if (token.charAt(0) === "-") {
            sign = -1;
            token = token.substring(1);
        }
        switch(token){
            case "inf":
            case "INF":
            case "Inf":
                return sign * Infinity;
            case "nan":
            case "NAN":
            case "Nan":
            case "NaN":
                return NaN;
            case "0":
                return 0;
        }
        if (base10Re.test(token)) return sign * parseInt(token, 10);
        if (base16Re.test(token)) return sign * parseInt(token, 16);
        if (base8Re.test(token)) return sign * parseInt(token, 8);
        /* istanbul ignore else */ if (numberRe.test(token)) return sign * parseFloat(token);
        /* istanbul ignore next */ throw illegal(token, "number", insideTryCatch);
    }
    function parseId(token, acceptNegative) {
        switch(token){
            case "max":
            case "MAX":
            case "Max":
                return 536870911;
            case "0":
                return 0;
        }
        /* istanbul ignore if */ if (!acceptNegative && token.charAt(0) === "-") throw illegal(token, "id");
        if (base10NegRe.test(token)) return parseInt(token, 10);
        if (base16NegRe.test(token)) return parseInt(token, 16);
        /* istanbul ignore else */ if (base8NegRe.test(token)) return parseInt(token, 8);
        /* istanbul ignore next */ throw illegal(token, "id");
    }
    function parsePackage() {
        /* istanbul ignore if */ if (pkg !== undefined) throw illegal("package");
        pkg = next();
        /* istanbul ignore if */ if (!typeRefRe.test(pkg)) throw illegal(pkg, "name");
        ptr = ptr.define(pkg);
        skip(";");
    }
    function parseImport() {
        var token = peek();
        var whichImports;
        switch(token){
            case "weak":
                whichImports = weakImports || (weakImports = []);
                next();
                break;
            case "public":
                next();
            // eslint-disable-next-line no-fallthrough
            default:
                whichImports = imports || (imports = []);
                break;
        }
        token = readString();
        skip(";");
        whichImports.push(token);
    }
    function parseSyntax() {
        skip("=");
        syntax = readString();
        isProto3 = syntax === "proto3";
        /* istanbul ignore if */ if (!isProto3 && syntax !== "proto2") throw illegal(syntax, "syntax");
        // Syntax is needed to understand the meaning of the optional field rule
        // Otherwise the meaning is ambiguous between proto2 and proto3
        root.setOption("syntax", syntax);
        skip(";");
    }
    function parseCommon(parent, token) {
        switch(token){
            case "option":
                parseOption(parent, token);
                skip(";");
                return true;
            case "message":
                parseType(parent, token);
                return true;
            case "enum":
                parseEnum(parent, token);
                return true;
            case "service":
                parseService(parent, token);
                return true;
            case "extend":
                parseExtension(parent, token);
                return true;
        }
        return false;
    }
    function ifBlock(obj, fnIf, fnElse) {
        var trailingLine = tn.line;
        if (obj) {
            if (typeof obj.comment !== "string") {
                obj.comment = cmnt(); // try block-type comment
            }
            obj.filename = parse.filename;
        }
        if (skip("{", true)) {
            var token;
            while((token = next()) !== "}")fnIf(token);
            skip(";", true);
        } else {
            if (fnElse) fnElse();
            skip(";");
            if (obj && (typeof obj.comment !== "string" || preferTrailingComment)) obj.comment = cmnt(trailingLine) || obj.comment; // try line-type comment
        }
    }
    function parseType(parent, token) {
        /* istanbul ignore if */ if (!nameRe.test(token = next())) throw illegal(token, "type name");
        var type = new Type(token);
        ifBlock(type, function parseType_block(token) {
            if (parseCommon(type, token)) return;
            switch(token){
                case "map":
                    parseMapField(type, token);
                    break;
                case "required":
                case "repeated":
                    parseField(type, token);
                    break;
                case "optional":
                    /* istanbul ignore if */ if (isProto3) {
                        parseField(type, "proto3_optional");
                    } else {
                        parseField(type, "optional");
                    }
                    break;
                case "oneof":
                    parseOneOf(type, token);
                    break;
                case "extensions":
                    readRanges(type.extensions || (type.extensions = []));
                    break;
                case "reserved":
                    readRanges(type.reserved || (type.reserved = []), true);
                    break;
                default:
                    /* istanbul ignore if */ if (!isProto3 || !typeRefRe.test(token)) throw illegal(token);
                    push(token);
                    parseField(type, "optional");
                    break;
            }
        });
        parent.add(type);
    }
    function parseField(parent, rule, extend) {
        var type = next();
        if (type === "group") {
            parseGroup(parent, rule);
            return;
        }
        // Type names can consume multiple tokens, in multiple variants:
        //    package.subpackage   field       tokens: "package.subpackage" [TYPE NAME ENDS HERE] "field"
        //    package . subpackage field       tokens: "package" "." "subpackage" [TYPE NAME ENDS HERE] "field"
        //    package.  subpackage field       tokens: "package." "subpackage" [TYPE NAME ENDS HERE] "field"
        //    package  .subpackage field       tokens: "package" ".subpackage" [TYPE NAME ENDS HERE] "field"
        // Keep reading tokens until we get a type name with no period at the end,
        // and the next token does not start with a period.
        while(type.endsWith(".") || peek().startsWith(".")){
            type += next();
        }
        /* istanbul ignore if */ if (!typeRefRe.test(type)) throw illegal(type, "type");
        var name = next();
        /* istanbul ignore if */ if (!nameRe.test(name)) throw illegal(name, "name");
        name = applyCase(name);
        skip("=");
        var field = new Field(name, parseId(next()), type, rule, extend);
        ifBlock(field, function parseField_block(token) {
            /* istanbul ignore else */ if (token === "option") {
                parseOption(field, token);
                skip(";");
            } else throw illegal(token);
        }, function parseField_line() {
            parseInlineOptions(field);
        });
        if (rule === "proto3_optional") {
            // for proto3 optional fields, we create a single-member Oneof to mimic "optional" behavior
            var oneof = new OneOf("_" + name);
            field.setOption("proto3_optional", true);
            oneof.add(field);
            parent.add(oneof);
        } else {
            parent.add(field);
        }
        // JSON defaults to packed=true if not set so we have to set packed=false explicity when
        // parsing proto2 descriptors without the option, where applicable. This must be done for
        // all known packable types and anything that could be an enum (= is not a basic type).
        if (!isProto3 && field.repeated && (types.packed[type] !== undefined || types.basic[type] === undefined)) field.setOption("packed", false, /* ifNotSet */ true);
    }
    function parseGroup(parent, rule) {
        var name = next();
        /* istanbul ignore if */ if (!nameRe.test(name)) throw illegal(name, "name");
        var fieldName = util.lcFirst(name);
        if (name === fieldName) name = util.ucFirst(name);
        skip("=");
        var id = parseId(next());
        var type = new Type(name);
        type.group = true;
        var field = new Field(fieldName, id, name, rule);
        field.filename = parse.filename;
        ifBlock(type, function parseGroup_block(token) {
            switch(token){
                case "option":
                    parseOption(type, token);
                    skip(";");
                    break;
                case "required":
                case "repeated":
                    parseField(type, token);
                    break;
                case "optional":
                    /* istanbul ignore if */ if (isProto3) {
                        parseField(type, "proto3_optional");
                    } else {
                        parseField(type, "optional");
                    }
                    break;
                case "message":
                    parseType(type, token);
                    break;
                case "enum":
                    parseEnum(type, token);
                    break;
                /* istanbul ignore next */ default:
                    throw illegal(token); // there are no groups with proto3 semantics
            }
        });
        parent.add(type).add(field);
    }
    function parseMapField(parent) {
        skip("<");
        var keyType = next();
        /* istanbul ignore if */ if (types.mapKey[keyType] === undefined) throw illegal(keyType, "type");
        skip(",");
        var valueType = next();
        /* istanbul ignore if */ if (!typeRefRe.test(valueType)) throw illegal(valueType, "type");
        skip(">");
        var name = next();
        /* istanbul ignore if */ if (!nameRe.test(name)) throw illegal(name, "name");
        skip("=");
        var field = new MapField(applyCase(name), parseId(next()), keyType, valueType);
        ifBlock(field, function parseMapField_block(token) {
            /* istanbul ignore else */ if (token === "option") {
                parseOption(field, token);
                skip(";");
            } else throw illegal(token);
        }, function parseMapField_line() {
            parseInlineOptions(field);
        });
        parent.add(field);
    }
    function parseOneOf(parent, token) {
        /* istanbul ignore if */ if (!nameRe.test(token = next())) throw illegal(token, "name");
        var oneof = new OneOf(applyCase(token));
        ifBlock(oneof, function parseOneOf_block(token) {
            if (token === "option") {
                parseOption(oneof, token);
                skip(";");
            } else {
                push(token);
                parseField(oneof, "optional");
            }
        });
        parent.add(oneof);
    }
    function parseEnum(parent, token) {
        /* istanbul ignore if */ if (!nameRe.test(token = next())) throw illegal(token, "name");
        var enm = new Enum(token);
        ifBlock(enm, function parseEnum_block(token) {
            switch(token){
                case "option":
                    parseOption(enm, token);
                    skip(";");
                    break;
                case "reserved":
                    readRanges(enm.reserved || (enm.reserved = []), true);
                    break;
                default:
                    parseEnumValue(enm, token);
            }
        });
        parent.add(enm);
    }
    function parseEnumValue(parent, token) {
        /* istanbul ignore if */ if (!nameRe.test(token)) throw illegal(token, "name");
        skip("=");
        var value = parseId(next(), true), dummy = {
            options: undefined
        };
        dummy.setOption = function(name, value) {
            if (this.options === undefined) this.options = {};
            this.options[name] = value;
        };
        ifBlock(dummy, function parseEnumValue_block(token) {
            /* istanbul ignore else */ if (token === "option") {
                parseOption(dummy, token); // skip
                skip(";");
            } else throw illegal(token);
        }, function parseEnumValue_line() {
            parseInlineOptions(dummy); // skip
        });
        parent.add(token, value, dummy.comment, dummy.options);
    }
    function parseOption(parent, token) {
        var isCustom = skip("(", true);
        /* istanbul ignore if */ if (!typeRefRe.test(token = next())) throw illegal(token, "name");
        var name = token;
        var option = name;
        var propName;
        if (isCustom) {
            skip(")");
            name = "(" + name + ")";
            option = name;
            token = peek();
            if (fqTypeRefRe.test(token)) {
                propName = token.slice(1); //remove '.' before property name
                name += token;
                next();
            }
        }
        skip("=");
        var optionValue = parseOptionValue(parent, name);
        setParsedOption(parent, option, optionValue, propName);
    }
    function parseOptionValue(parent, name) {
        // { a: "foo" b { c: "bar" } }
        if (skip("{", true)) {
            var objectResult = {};
            while(!skip("}", true)){
                /* istanbul ignore if */ if (!nameRe.test(token = next())) {
                    throw illegal(token, "name");
                }
                if (token === null) {
                    throw illegal(token, "end of input");
                }
                var value;
                var propName = token;
                skip(":", true);
                if (peek() === "{") value = parseOptionValue(parent, name + "." + token);
                else if (peek() === "[") {
                    // option (my_option) = {
                    //     repeated_value: [ "foo", "bar" ]
                    // };
                    value = [];
                    var lastValue;
                    if (skip("[", true)) {
                        do {
                            lastValue = readValue(true);
                            value.push(lastValue);
                        }while (skip(",", true))
                        skip("]");
                        if (typeof lastValue !== "undefined") {
                            setOption(parent, name + "." + token, lastValue);
                        }
                    }
                } else {
                    value = readValue(true);
                    setOption(parent, name + "." + token, value);
                }
                var prevValue = objectResult[propName];
                if (prevValue) value = [].concat(prevValue).concat(value);
                objectResult[propName] = value;
                // Semicolons and commas can be optional
                skip(",", true);
                skip(";", true);
            }
            return objectResult;
        }
        var simpleValue = readValue(true);
        setOption(parent, name, simpleValue);
        return simpleValue;
    // Does not enforce a delimiter to be universal
    }
    function setOption(parent, name, value) {
        if (parent.setOption) parent.setOption(name, value);
    }
    function setParsedOption(parent, name, value, propName) {
        if (parent.setParsedOption) parent.setParsedOption(name, value, propName);
    }
    function parseInlineOptions(parent) {
        if (skip("[", true)) {
            do {
                parseOption(parent, "option");
            }while (skip(",", true))
            skip("]");
        }
        return parent;
    }
    function parseService(parent, token) {
        /* istanbul ignore if */ if (!nameRe.test(token = next())) throw illegal(token, "service name");
        var service = new Service(token);
        ifBlock(service, function parseService_block(token) {
            if (parseCommon(service, token)) return;
            /* istanbul ignore else */ if (token === "rpc") parseMethod(service, token);
            else throw illegal(token);
        });
        parent.add(service);
    }
    function parseMethod(parent, token) {
        // Get the comment of the preceding line now (if one exists) in case the
        // method is defined across multiple lines.
        var commentText = cmnt();
        var type = token;
        /* istanbul ignore if */ if (!nameRe.test(token = next())) throw illegal(token, "name");
        var name = token, requestType, requestStream, responseType, responseStream;
        skip("(");
        if (skip("stream", true)) requestStream = true;
        /* istanbul ignore if */ if (!typeRefRe.test(token = next())) throw illegal(token);
        requestType = token;
        skip(")");
        skip("returns");
        skip("(");
        if (skip("stream", true)) responseStream = true;
        /* istanbul ignore if */ if (!typeRefRe.test(token = next())) throw illegal(token);
        responseType = token;
        skip(")");
        var method = new Method(name, type, requestType, responseType, requestStream, responseStream);
        method.comment = commentText;
        ifBlock(method, function parseMethod_block(token) {
            /* istanbul ignore else */ if (token === "option") {
                parseOption(method, token);
                skip(";");
            } else throw illegal(token);
        });
        parent.add(method);
    }
    function parseExtension(parent, token) {
        /* istanbul ignore if */ if (!typeRefRe.test(token = next())) throw illegal(token, "reference");
        var reference = token;
        ifBlock(null, function parseExtension_block(token) {
            switch(token){
                case "required":
                case "repeated":
                    parseField(parent, token, reference);
                    break;
                case "optional":
                    /* istanbul ignore if */ if (isProto3) {
                        parseField(parent, "proto3_optional", reference);
                    } else {
                        parseField(parent, "optional", reference);
                    }
                    break;
                default:
                    /* istanbul ignore if */ if (!isProto3 || !typeRefRe.test(token)) throw illegal(token);
                    push(token);
                    parseField(parent, "optional", reference);
                    break;
            }
        });
    }
    var token;
    while((token = next()) !== null){
        switch(token){
            case "package":
                /* istanbul ignore if */ if (!head) throw illegal(token);
                parsePackage();
                break;
            case "import":
                /* istanbul ignore if */ if (!head) throw illegal(token);
                parseImport();
                break;
            case "syntax":
                /* istanbul ignore if */ if (!head) throw illegal(token);
                parseSyntax();
                break;
            case "option":
                parseOption(ptr, token);
                skip(";");
                break;
            default:
                /* istanbul ignore else */ if (parseCommon(ptr, token)) {
                    head = false;
                    continue;
                }
                /* istanbul ignore next */ throw illegal(token);
        }
    }
    parse.filename = null;
    return {
        "package": pkg,
        "imports": imports,
        weakImports: weakImports,
        syntax: syntax,
        root: root
    };
} /**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @name parse
 * @function
 * @param {string} source Source contents
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {IParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {IParseOptions} defaults Default {@link IParseOptions}
 * @variation 2
 */ 
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/common.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
module.exports = common;
var commonRe = /\/|\./;
/**
 * Provides common type definitions.
 * Can also be used to provide additional google types or your own custom types.
 * @param {string} name Short name as in `google/protobuf/[name].proto` or full file name
 * @param {Object.<string,*>} json JSON definition within `google.protobuf` if a short name, otherwise the file's root definition
 * @returns {undefined}
 * @property {INamespace} google/protobuf/any.proto Any
 * @property {INamespace} google/protobuf/duration.proto Duration
 * @property {INamespace} google/protobuf/empty.proto Empty
 * @property {INamespace} google/protobuf/field_mask.proto FieldMask
 * @property {INamespace} google/protobuf/struct.proto Struct, Value, NullValue and ListValue
 * @property {INamespace} google/protobuf/timestamp.proto Timestamp
 * @property {INamespace} google/protobuf/wrappers.proto Wrappers
 * @example
 * // manually provides descriptor.proto (assumes google/protobuf/ namespace and .proto extension)
 * protobuf.common("descriptor", descriptorJson);
 *
 * // manually provides a custom definition (uses my.foo namespace)
 * protobuf.common("my/foo/bar.proto", myFooBarJson);
 */ function common(name, json) {
    if (!commonRe.test(name)) {
        name = "google/protobuf/" + name + ".proto";
        json = {
            nested: {
                google: {
                    nested: {
                        protobuf: {
                            nested: json
                        }
                    }
                }
            }
        };
    }
    common[name] = json;
}
// Not provided because of limited use (feel free to discuss or to provide yourself):
//
// google/protobuf/descriptor.proto
// google/protobuf/source_context.proto
// google/protobuf/type.proto
//
// Stripped and pre-parsed versions of these non-bundled files are instead available as part of
// the repository or package within the google/protobuf directory.
common("any", {
    /**
     * Properties of a google.protobuf.Any message.
     * @interface IAny
     * @type {Object}
     * @property {string} [typeUrl]
     * @property {Uint8Array} [bytes]
     * @memberof common
     */ Any: {
        fields: {
            type_url: {
                type: "string",
                id: 1
            },
            value: {
                type: "bytes",
                id: 2
            }
        }
    }
});
var timeType;
common("duration", {
    /**
     * Properties of a google.protobuf.Duration message.
     * @interface IDuration
     * @type {Object}
     * @property {number|Long} [seconds]
     * @property {number} [nanos]
     * @memberof common
     */ Duration: timeType = {
        fields: {
            seconds: {
                type: "int64",
                id: 1
            },
            nanos: {
                type: "int32",
                id: 2
            }
        }
    }
});
common("timestamp", {
    /**
     * Properties of a google.protobuf.Timestamp message.
     * @interface ITimestamp
     * @type {Object}
     * @property {number|Long} [seconds]
     * @property {number} [nanos]
     * @memberof common
     */ Timestamp: timeType
});
common("empty", {
    /**
     * Properties of a google.protobuf.Empty message.
     * @interface IEmpty
     * @memberof common
     */ Empty: {
        fields: {}
    }
});
common("struct", {
    /**
     * Properties of a google.protobuf.Struct message.
     * @interface IStruct
     * @type {Object}
     * @property {Object.<string,IValue>} [fields]
     * @memberof common
     */ Struct: {
        fields: {
            fields: {
                keyType: "string",
                type: "Value",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.Value message.
     * @interface IValue
     * @type {Object}
     * @property {string} [kind]
     * @property {0} [nullValue]
     * @property {number} [numberValue]
     * @property {string} [stringValue]
     * @property {boolean} [boolValue]
     * @property {IStruct} [structValue]
     * @property {IListValue} [listValue]
     * @memberof common
     */ Value: {
        oneofs: {
            kind: {
                oneof: [
                    "nullValue",
                    "numberValue",
                    "stringValue",
                    "boolValue",
                    "structValue",
                    "listValue"
                ]
            }
        },
        fields: {
            nullValue: {
                type: "NullValue",
                id: 1
            },
            numberValue: {
                type: "double",
                id: 2
            },
            stringValue: {
                type: "string",
                id: 3
            },
            boolValue: {
                type: "bool",
                id: 4
            },
            structValue: {
                type: "Struct",
                id: 5
            },
            listValue: {
                type: "ListValue",
                id: 6
            }
        }
    },
    NullValue: {
        values: {
            NULL_VALUE: 0
        }
    },
    /**
     * Properties of a google.protobuf.ListValue message.
     * @interface IListValue
     * @type {Object}
     * @property {Array.<IValue>} [values]
     * @memberof common
     */ ListValue: {
        fields: {
            values: {
                rule: "repeated",
                type: "Value",
                id: 1
            }
        }
    }
});
common("wrappers", {
    /**
     * Properties of a google.protobuf.DoubleValue message.
     * @interface IDoubleValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */ DoubleValue: {
        fields: {
            value: {
                type: "double",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.FloatValue message.
     * @interface IFloatValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */ FloatValue: {
        fields: {
            value: {
                type: "float",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.Int64Value message.
     * @interface IInt64Value
     * @type {Object}
     * @property {number|Long} [value]
     * @memberof common
     */ Int64Value: {
        fields: {
            value: {
                type: "int64",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.UInt64Value message.
     * @interface IUInt64Value
     * @type {Object}
     * @property {number|Long} [value]
     * @memberof common
     */ UInt64Value: {
        fields: {
            value: {
                type: "uint64",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.Int32Value message.
     * @interface IInt32Value
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */ Int32Value: {
        fields: {
            value: {
                type: "int32",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.UInt32Value message.
     * @interface IUInt32Value
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */ UInt32Value: {
        fields: {
            value: {
                type: "uint32",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.BoolValue message.
     * @interface IBoolValue
     * @type {Object}
     * @property {boolean} [value]
     * @memberof common
     */ BoolValue: {
        fields: {
            value: {
                type: "bool",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.StringValue message.
     * @interface IStringValue
     * @type {Object}
     * @property {string} [value]
     * @memberof common
     */ StringValue: {
        fields: {
            value: {
                type: "string",
                id: 1
            }
        }
    },
    /**
     * Properties of a google.protobuf.BytesValue message.
     * @interface IBytesValue
     * @type {Object}
     * @property {Uint8Array} [value]
     * @memberof common
     */ BytesValue: {
        fields: {
            value: {
                type: "bytes",
                id: 1
            }
        }
    }
});
common("field_mask", {
    /**
     * Properties of a google.protobuf.FieldMask message.
     * @interface IDoubleValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */ FieldMask: {
        fields: {
            paths: {
                rule: "repeated",
                type: "string",
                id: 1
            }
        }
    }
});
/**
 * Gets the root definition of the specified common proto file.
 *
 * Bundled definitions are:
 * - google/protobuf/any.proto
 * - google/protobuf/duration.proto
 * - google/protobuf/empty.proto
 * - google/protobuf/field_mask.proto
 * - google/protobuf/struct.proto
 * - google/protobuf/timestamp.proto
 * - google/protobuf/wrappers.proto
 *
 * @param {string} file Proto file name
 * @returns {INamespace|null} Root definition or `null` if not defined
 */ common.get = function get(file) {
    return common[file] || null;
};
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var protobuf = module.exports = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index-light.js [app-rsc] (ecmascript)");
protobuf.build = "full";
// Parser
protobuf.tokenize = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/tokenize.js [app-rsc] (ecmascript)");
protobuf.parse = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/parse.js [app-rsc] (ecmascript)");
protobuf.common = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/common.js [app-rsc] (ecmascript)");
// Configure parser
protobuf.Root._configure(protobuf.Type, protobuf.parse, protobuf.common);
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
// full library entry point.
"use strict";
module.exports = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index.js [app-rsc] (ecmascript)");
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/google/protobuf/descriptor.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"nested\":{\"google\":{\"nested\":{\"protobuf\":{\"nested\":{\"FileDescriptorSet\":{\"fields\":{\"file\":{\"rule\":\"repeated\",\"type\":\"FileDescriptorProto\",\"id\":1}}},\"FileDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"package\":{\"type\":\"string\",\"id\":2},\"dependency\":{\"rule\":\"repeated\",\"type\":\"string\",\"id\":3},\"publicDependency\":{\"rule\":\"repeated\",\"type\":\"int32\",\"id\":10,\"options\":{\"packed\":false}},\"weakDependency\":{\"rule\":\"repeated\",\"type\":\"int32\",\"id\":11,\"options\":{\"packed\":false}},\"messageType\":{\"rule\":\"repeated\",\"type\":\"DescriptorProto\",\"id\":4},\"enumType\":{\"rule\":\"repeated\",\"type\":\"EnumDescriptorProto\",\"id\":5},\"service\":{\"rule\":\"repeated\",\"type\":\"ServiceDescriptorProto\",\"id\":6},\"extension\":{\"rule\":\"repeated\",\"type\":\"FieldDescriptorProto\",\"id\":7},\"options\":{\"type\":\"FileOptions\",\"id\":8},\"sourceCodeInfo\":{\"type\":\"SourceCodeInfo\",\"id\":9},\"syntax\":{\"type\":\"string\",\"id\":12}}},\"DescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"field\":{\"rule\":\"repeated\",\"type\":\"FieldDescriptorProto\",\"id\":2},\"extension\":{\"rule\":\"repeated\",\"type\":\"FieldDescriptorProto\",\"id\":6},\"nestedType\":{\"rule\":\"repeated\",\"type\":\"DescriptorProto\",\"id\":3},\"enumType\":{\"rule\":\"repeated\",\"type\":\"EnumDescriptorProto\",\"id\":4},\"extensionRange\":{\"rule\":\"repeated\",\"type\":\"ExtensionRange\",\"id\":5},\"oneofDecl\":{\"rule\":\"repeated\",\"type\":\"OneofDescriptorProto\",\"id\":8},\"options\":{\"type\":\"MessageOptions\",\"id\":7},\"reservedRange\":{\"rule\":\"repeated\",\"type\":\"ReservedRange\",\"id\":9},\"reservedName\":{\"rule\":\"repeated\",\"type\":\"string\",\"id\":10}},\"nested\":{\"ExtensionRange\":{\"fields\":{\"start\":{\"type\":\"int32\",\"id\":1},\"end\":{\"type\":\"int32\",\"id\":2}}},\"ReservedRange\":{\"fields\":{\"start\":{\"type\":\"int32\",\"id\":1},\"end\":{\"type\":\"int32\",\"id\":2}}}}},\"FieldDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"number\":{\"type\":\"int32\",\"id\":3},\"label\":{\"type\":\"Label\",\"id\":4},\"type\":{\"type\":\"Type\",\"id\":5},\"typeName\":{\"type\":\"string\",\"id\":6},\"extendee\":{\"type\":\"string\",\"id\":2},\"defaultValue\":{\"type\":\"string\",\"id\":7},\"oneofIndex\":{\"type\":\"int32\",\"id\":9},\"jsonName\":{\"type\":\"string\",\"id\":10},\"options\":{\"type\":\"FieldOptions\",\"id\":8}},\"nested\":{\"Type\":{\"values\":{\"TYPE_DOUBLE\":1,\"TYPE_FLOAT\":2,\"TYPE_INT64\":3,\"TYPE_UINT64\":4,\"TYPE_INT32\":5,\"TYPE_FIXED64\":6,\"TYPE_FIXED32\":7,\"TYPE_BOOL\":8,\"TYPE_STRING\":9,\"TYPE_GROUP\":10,\"TYPE_MESSAGE\":11,\"TYPE_BYTES\":12,\"TYPE_UINT32\":13,\"TYPE_ENUM\":14,\"TYPE_SFIXED32\":15,\"TYPE_SFIXED64\":16,\"TYPE_SINT32\":17,\"TYPE_SINT64\":18}},\"Label\":{\"values\":{\"LABEL_OPTIONAL\":1,\"LABEL_REQUIRED\":2,\"LABEL_REPEATED\":3}}}},\"OneofDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"options\":{\"type\":\"OneofOptions\",\"id\":2}}},\"EnumDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"value\":{\"rule\":\"repeated\",\"type\":\"EnumValueDescriptorProto\",\"id\":2},\"options\":{\"type\":\"EnumOptions\",\"id\":3}}},\"EnumValueDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"number\":{\"type\":\"int32\",\"id\":2},\"options\":{\"type\":\"EnumValueOptions\",\"id\":3}}},\"ServiceDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"method\":{\"rule\":\"repeated\",\"type\":\"MethodDescriptorProto\",\"id\":2},\"options\":{\"type\":\"ServiceOptions\",\"id\":3}}},\"MethodDescriptorProto\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"inputType\":{\"type\":\"string\",\"id\":2},\"outputType\":{\"type\":\"string\",\"id\":3},\"options\":{\"type\":\"MethodOptions\",\"id\":4},\"clientStreaming\":{\"type\":\"bool\",\"id\":5},\"serverStreaming\":{\"type\":\"bool\",\"id\":6}}},\"FileOptions\":{\"fields\":{\"javaPackage\":{\"type\":\"string\",\"id\":1},\"javaOuterClassname\":{\"type\":\"string\",\"id\":8},\"javaMultipleFiles\":{\"type\":\"bool\",\"id\":10},\"javaGenerateEqualsAndHash\":{\"type\":\"bool\",\"id\":20,\"options\":{\"deprecated\":true}},\"javaStringCheckUtf8\":{\"type\":\"bool\",\"id\":27},\"optimizeFor\":{\"type\":\"OptimizeMode\",\"id\":9,\"options\":{\"default\":\"SPEED\"}},\"goPackage\":{\"type\":\"string\",\"id\":11},\"ccGenericServices\":{\"type\":\"bool\",\"id\":16},\"javaGenericServices\":{\"type\":\"bool\",\"id\":17},\"pyGenericServices\":{\"type\":\"bool\",\"id\":18},\"deprecated\":{\"type\":\"bool\",\"id\":23},\"ccEnableArenas\":{\"type\":\"bool\",\"id\":31},\"objcClassPrefix\":{\"type\":\"string\",\"id\":36},\"csharpNamespace\":{\"type\":\"string\",\"id\":37},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]],\"reserved\":[[38,38]],\"nested\":{\"OptimizeMode\":{\"values\":{\"SPEED\":1,\"CODE_SIZE\":2,\"LITE_RUNTIME\":3}}}},\"MessageOptions\":{\"fields\":{\"messageSetWireFormat\":{\"type\":\"bool\",\"id\":1},\"noStandardDescriptorAccessor\":{\"type\":\"bool\",\"id\":2},\"deprecated\":{\"type\":\"bool\",\"id\":3},\"mapEntry\":{\"type\":\"bool\",\"id\":7},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]],\"reserved\":[[8,8]]},\"FieldOptions\":{\"fields\":{\"ctype\":{\"type\":\"CType\",\"id\":1,\"options\":{\"default\":\"STRING\"}},\"packed\":{\"type\":\"bool\",\"id\":2},\"jstype\":{\"type\":\"JSType\",\"id\":6,\"options\":{\"default\":\"JS_NORMAL\"}},\"lazy\":{\"type\":\"bool\",\"id\":5},\"deprecated\":{\"type\":\"bool\",\"id\":3},\"weak\":{\"type\":\"bool\",\"id\":10},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]],\"reserved\":[[4,4]],\"nested\":{\"CType\":{\"values\":{\"STRING\":0,\"CORD\":1,\"STRING_PIECE\":2}},\"JSType\":{\"values\":{\"JS_NORMAL\":0,\"JS_STRING\":1,\"JS_NUMBER\":2}}}},\"OneofOptions\":{\"fields\":{\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]]},\"EnumOptions\":{\"fields\":{\"allowAlias\":{\"type\":\"bool\",\"id\":2},\"deprecated\":{\"type\":\"bool\",\"id\":3},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]]},\"EnumValueOptions\":{\"fields\":{\"deprecated\":{\"type\":\"bool\",\"id\":1},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]]},\"ServiceOptions\":{\"fields\":{\"deprecated\":{\"type\":\"bool\",\"id\":33},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]]},\"MethodOptions\":{\"fields\":{\"deprecated\":{\"type\":\"bool\",\"id\":33},\"uninterpretedOption\":{\"rule\":\"repeated\",\"type\":\"UninterpretedOption\",\"id\":999}},\"extensions\":[[1000,536870911]]},\"UninterpretedOption\":{\"fields\":{\"name\":{\"rule\":\"repeated\",\"type\":\"NamePart\",\"id\":2},\"identifierValue\":{\"type\":\"string\",\"id\":3},\"positiveIntValue\":{\"type\":\"uint64\",\"id\":4},\"negativeIntValue\":{\"type\":\"int64\",\"id\":5},\"doubleValue\":{\"type\":\"double\",\"id\":6},\"stringValue\":{\"type\":\"bytes\",\"id\":7},\"aggregateValue\":{\"type\":\"string\",\"id\":8}},\"nested\":{\"NamePart\":{\"fields\":{\"namePart\":{\"rule\":\"required\",\"type\":\"string\",\"id\":1},\"isExtension\":{\"rule\":\"required\",\"type\":\"bool\",\"id\":2}}}}},\"SourceCodeInfo\":{\"fields\":{\"location\":{\"rule\":\"repeated\",\"type\":\"Location\",\"id\":1}},\"nested\":{\"Location\":{\"fields\":{\"path\":{\"rule\":\"repeated\",\"type\":\"int32\",\"id\":1},\"span\":{\"rule\":\"repeated\",\"type\":\"int32\",\"id\":2},\"leadingComments\":{\"type\":\"string\",\"id\":3},\"trailingComments\":{\"type\":\"string\",\"id\":4},\"leadingDetachedComments\":{\"rule\":\"repeated\",\"type\":\"string\",\"id\":6}}}}},\"GeneratedCodeInfo\":{\"fields\":{\"annotation\":{\"rule\":\"repeated\",\"type\":\"Annotation\",\"id\":1}},\"nested\":{\"Annotation\":{\"fields\":{\"path\":{\"rule\":\"repeated\",\"type\":\"int32\",\"id\":1},\"sourceFile\":{\"type\":\"string\",\"id\":2},\"begin\":{\"type\":\"int32\",\"id\":3},\"end\":{\"type\":\"int32\",\"id\":4}}}}}}}}}}}"));}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/ext/descriptor/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var $protobuf = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/index.js [app-rsc] (ecmascript)");
module.exports = exports = $protobuf.descriptor = $protobuf.Root.fromJSON(__turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/google/protobuf/descriptor.json (json)")).lookup(".google.protobuf");
var Namespace = $protobuf.Namespace, Root = $protobuf.Root, Enum = $protobuf.Enum, Type = $protobuf.Type, Field = $protobuf.Field, MapField = $protobuf.MapField, OneOf = $protobuf.OneOf, Service = $protobuf.Service, Method = $protobuf.Method;
// --- Root ---
/**
 * Properties of a FileDescriptorSet message.
 * @interface IFileDescriptorSet
 * @property {IFileDescriptorProto[]} file Files
 */ /**
 * Properties of a FileDescriptorProto message.
 * @interface IFileDescriptorProto
 * @property {string} [name] File name
 * @property {string} [package] Package
 * @property {*} [dependency] Not supported
 * @property {*} [publicDependency] Not supported
 * @property {*} [weakDependency] Not supported
 * @property {IDescriptorProto[]} [messageType] Nested message types
 * @property {IEnumDescriptorProto[]} [enumType] Nested enums
 * @property {IServiceDescriptorProto[]} [service] Nested services
 * @property {IFieldDescriptorProto[]} [extension] Nested extension fields
 * @property {IFileOptions} [options] Options
 * @property {*} [sourceCodeInfo] Not supported
 * @property {string} [syntax="proto2"] Syntax
 */ /**
 * Properties of a FileOptions message.
 * @interface IFileOptions
 * @property {string} [javaPackage]
 * @property {string} [javaOuterClassname]
 * @property {boolean} [javaMultipleFiles]
 * @property {boolean} [javaGenerateEqualsAndHash]
 * @property {boolean} [javaStringCheckUtf8]
 * @property {IFileOptionsOptimizeMode} [optimizeFor=1]
 * @property {string} [goPackage]
 * @property {boolean} [ccGenericServices]
 * @property {boolean} [javaGenericServices]
 * @property {boolean} [pyGenericServices]
 * @property {boolean} [deprecated]
 * @property {boolean} [ccEnableArenas]
 * @property {string} [objcClassPrefix]
 * @property {string} [csharpNamespace]
 */ /**
 * Values of he FileOptions.OptimizeMode enum.
 * @typedef IFileOptionsOptimizeMode
 * @type {number}
 * @property {number} SPEED=1
 * @property {number} CODE_SIZE=2
 * @property {number} LITE_RUNTIME=3
 */ /**
 * Creates a root from a descriptor set.
 * @param {IFileDescriptorSet|Reader|Uint8Array} descriptor Descriptor
 * @returns {Root} Root instance
 */ Root.fromDescriptor = function fromDescriptor(descriptor) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.FileDescriptorSet.decode(descriptor);
    var root = new Root();
    if (descriptor.file) {
        var fileDescriptor, filePackage;
        for(var j = 0, i; j < descriptor.file.length; ++j){
            filePackage = root;
            if ((fileDescriptor = descriptor.file[j])["package"] && fileDescriptor["package"].length) filePackage = root.define(fileDescriptor["package"]);
            if (fileDescriptor.name && fileDescriptor.name.length) root.files.push(filePackage.filename = fileDescriptor.name);
            if (fileDescriptor.messageType) for(i = 0; i < fileDescriptor.messageType.length; ++i)filePackage.add(Type.fromDescriptor(fileDescriptor.messageType[i], fileDescriptor.syntax));
            if (fileDescriptor.enumType) for(i = 0; i < fileDescriptor.enumType.length; ++i)filePackage.add(Enum.fromDescriptor(fileDescriptor.enumType[i]));
            if (fileDescriptor.extension) for(i = 0; i < fileDescriptor.extension.length; ++i)filePackage.add(Field.fromDescriptor(fileDescriptor.extension[i]));
            if (fileDescriptor.service) for(i = 0; i < fileDescriptor.service.length; ++i)filePackage.add(Service.fromDescriptor(fileDescriptor.service[i]));
            var opts = fromDescriptorOptions(fileDescriptor.options, exports.FileOptions);
            if (opts) {
                var ks = Object.keys(opts);
                for(i = 0; i < ks.length; ++i)filePackage.setOption(ks[i], opts[ks[i]]);
            }
        }
    }
    return root;
};
/**
 * Converts a root to a descriptor set.
 * @returns {Message<IFileDescriptorSet>} Descriptor
 * @param {string} [syntax="proto2"] Syntax
 */ Root.prototype.toDescriptor = function toDescriptor(syntax) {
    var set = exports.FileDescriptorSet.create();
    Root_toDescriptorRecursive(this, set.file, syntax);
    return set;
};
// Traverses a namespace and assembles the descriptor set
function Root_toDescriptorRecursive(ns, files, syntax) {
    // Create a new file
    var file = exports.FileDescriptorProto.create({
        name: ns.filename || (ns.fullName.substring(1).replace(/\./g, "_") || "root") + ".proto"
    });
    if (syntax) file.syntax = syntax;
    if (!(ns instanceof Root)) file["package"] = ns.fullName.substring(1);
    // Add nested types
    for(var i = 0, nested; i < ns.nestedArray.length; ++i)if ((nested = ns._nestedArray[i]) instanceof Type) file.messageType.push(nested.toDescriptor(syntax));
    else if (nested instanceof Enum) file.enumType.push(nested.toDescriptor());
    else if (nested instanceof Field) file.extension.push(nested.toDescriptor(syntax));
    else if (nested instanceof Service) file.service.push(nested.toDescriptor());
    else if (nested instanceof /* plain */ Namespace) Root_toDescriptorRecursive(nested, files, syntax); // requires new file
    // Keep package-level options
    file.options = toDescriptorOptions(ns.options, exports.FileOptions);
    // And keep the file only if there is at least one nested object
    if (file.messageType.length + file.enumType.length + file.extension.length + file.service.length) files.push(file);
}
// --- Type ---
/**
 * Properties of a DescriptorProto message.
 * @interface IDescriptorProto
 * @property {string} [name] Message type name
 * @property {IFieldDescriptorProto[]} [field] Fields
 * @property {IFieldDescriptorProto[]} [extension] Extension fields
 * @property {IDescriptorProto[]} [nestedType] Nested message types
 * @property {IEnumDescriptorProto[]} [enumType] Nested enums
 * @property {IDescriptorProtoExtensionRange[]} [extensionRange] Extension ranges
 * @property {IOneofDescriptorProto[]} [oneofDecl] Oneofs
 * @property {IMessageOptions} [options] Not supported
 * @property {IDescriptorProtoReservedRange[]} [reservedRange] Reserved ranges
 * @property {string[]} [reservedName] Reserved names
 */ /**
 * Properties of a MessageOptions message.
 * @interface IMessageOptions
 * @property {boolean} [mapEntry=false] Whether this message is a map entry
 */ /**
 * Properties of an ExtensionRange message.
 * @interface IDescriptorProtoExtensionRange
 * @property {number} [start] Start field id
 * @property {number} [end] End field id
 */ /**
 * Properties of a ReservedRange message.
 * @interface IDescriptorProtoReservedRange
 * @property {number} [start] Start field id
 * @property {number} [end] End field id
 */ var unnamedMessageIndex = 0;
/**
 * Creates a type from a descriptor.
 * @param {IDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @param {string} [syntax="proto2"] Syntax
 * @returns {Type} Type instance
 */ Type.fromDescriptor = function fromDescriptor(descriptor, syntax) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.DescriptorProto.decode(descriptor);
    // Create the message type
    var type = new Type(descriptor.name.length ? descriptor.name : "Type" + unnamedMessageIndex++, fromDescriptorOptions(descriptor.options, exports.MessageOptions)), i;
    /* Oneofs */ if (descriptor.oneofDecl) for(i = 0; i < descriptor.oneofDecl.length; ++i)type.add(OneOf.fromDescriptor(descriptor.oneofDecl[i]));
    /* Fields */ if (descriptor.field) for(i = 0; i < descriptor.field.length; ++i){
        var field = Field.fromDescriptor(descriptor.field[i], syntax);
        type.add(field);
        if (descriptor.field[i].hasOwnProperty("oneofIndex")) type.oneofsArray[descriptor.field[i].oneofIndex].add(field);
    }
    /* Extension fields */ if (descriptor.extension) for(i = 0; i < descriptor.extension.length; ++i)type.add(Field.fromDescriptor(descriptor.extension[i], syntax));
    /* Nested types */ if (descriptor.nestedType) for(i = 0; i < descriptor.nestedType.length; ++i){
        type.add(Type.fromDescriptor(descriptor.nestedType[i], syntax));
        if (descriptor.nestedType[i].options && descriptor.nestedType[i].options.mapEntry) type.setOption("map_entry", true);
    }
    /* Nested enums */ if (descriptor.enumType) for(i = 0; i < descriptor.enumType.length; ++i)type.add(Enum.fromDescriptor(descriptor.enumType[i]));
    /* Extension ranges */ if (descriptor.extensionRange && descriptor.extensionRange.length) {
        type.extensions = [];
        for(i = 0; i < descriptor.extensionRange.length; ++i)type.extensions.push([
            descriptor.extensionRange[i].start,
            descriptor.extensionRange[i].end
        ]);
    }
    /* Reserved... */ if (descriptor.reservedRange && descriptor.reservedRange.length || descriptor.reservedName && descriptor.reservedName.length) {
        type.reserved = [];
        /* Ranges */ if (descriptor.reservedRange) for(i = 0; i < descriptor.reservedRange.length; ++i)type.reserved.push([
            descriptor.reservedRange[i].start,
            descriptor.reservedRange[i].end
        ]);
        /* Names */ if (descriptor.reservedName) for(i = 0; i < descriptor.reservedName.length; ++i)type.reserved.push(descriptor.reservedName[i]);
    }
    return type;
};
/**
 * Converts a type to a descriptor.
 * @returns {Message<IDescriptorProto>} Descriptor
 * @param {string} [syntax="proto2"] Syntax
 */ Type.prototype.toDescriptor = function toDescriptor(syntax) {
    var descriptor = exports.DescriptorProto.create({
        name: this.name
    }), i;
    /* Fields */ for(i = 0; i < this.fieldsArray.length; ++i){
        var fieldDescriptor;
        descriptor.field.push(fieldDescriptor = this._fieldsArray[i].toDescriptor(syntax));
        if (this._fieldsArray[i] instanceof MapField) {
            var keyType = toDescriptorType(this._fieldsArray[i].keyType, this._fieldsArray[i].resolvedKeyType), valueType = toDescriptorType(this._fieldsArray[i].type, this._fieldsArray[i].resolvedType), valueTypeName = valueType === /* type */ 11 || valueType === /* enum */ 14 ? this._fieldsArray[i].resolvedType && shortname(this.parent, this._fieldsArray[i].resolvedType) || this._fieldsArray[i].type : undefined;
            descriptor.nestedType.push(exports.DescriptorProto.create({
                name: fieldDescriptor.typeName,
                field: [
                    exports.FieldDescriptorProto.create({
                        name: "key",
                        number: 1,
                        label: 1,
                        type: keyType
                    }),
                    exports.FieldDescriptorProto.create({
                        name: "value",
                        number: 2,
                        label: 1,
                        type: valueType,
                        typeName: valueTypeName
                    })
                ],
                options: exports.MessageOptions.create({
                    mapEntry: true
                })
            }));
        }
    }
    /* Oneofs */ for(i = 0; i < this.oneofsArray.length; ++i)descriptor.oneofDecl.push(this._oneofsArray[i].toDescriptor());
    /* Nested... */ for(i = 0; i < this.nestedArray.length; ++i){
        /* Extension fields */ if (this._nestedArray[i] instanceof Field) descriptor.field.push(this._nestedArray[i].toDescriptor(syntax));
        else if (this._nestedArray[i] instanceof Type) descriptor.nestedType.push(this._nestedArray[i].toDescriptor(syntax));
        else if (this._nestedArray[i] instanceof Enum) descriptor.enumType.push(this._nestedArray[i].toDescriptor());
    // plain nested namespaces become packages instead in Root#toDescriptor
    }
    /* Extension ranges */ if (this.extensions) for(i = 0; i < this.extensions.length; ++i)descriptor.extensionRange.push(exports.DescriptorProto.ExtensionRange.create({
        start: this.extensions[i][0],
        end: this.extensions[i][1]
    }));
    /* Reserved... */ if (this.reserved) for(i = 0; i < this.reserved.length; ++i)/* Names */ if (typeof this.reserved[i] === "string") descriptor.reservedName.push(this.reserved[i]);
    else descriptor.reservedRange.push(exports.DescriptorProto.ReservedRange.create({
        start: this.reserved[i][0],
        end: this.reserved[i][1]
    }));
    descriptor.options = toDescriptorOptions(this.options, exports.MessageOptions);
    return descriptor;
};
// --- Field ---
/**
 * Properties of a FieldDescriptorProto message.
 * @interface IFieldDescriptorProto
 * @property {string} [name] Field name
 * @property {number} [number] Field id
 * @property {IFieldDescriptorProtoLabel} [label] Field rule
 * @property {IFieldDescriptorProtoType} [type] Field basic type
 * @property {string} [typeName] Field type name
 * @property {string} [extendee] Extended type name
 * @property {string} [defaultValue] Literal default value
 * @property {number} [oneofIndex] Oneof index if part of a oneof
 * @property {*} [jsonName] Not supported
 * @property {IFieldOptions} [options] Field options
 */ /**
 * Values of the FieldDescriptorProto.Label enum.
 * @typedef IFieldDescriptorProtoLabel
 * @type {number}
 * @property {number} LABEL_OPTIONAL=1
 * @property {number} LABEL_REQUIRED=2
 * @property {number} LABEL_REPEATED=3
 */ /**
 * Values of the FieldDescriptorProto.Type enum.
 * @typedef IFieldDescriptorProtoType
 * @type {number}
 * @property {number} TYPE_DOUBLE=1
 * @property {number} TYPE_FLOAT=2
 * @property {number} TYPE_INT64=3
 * @property {number} TYPE_UINT64=4
 * @property {number} TYPE_INT32=5
 * @property {number} TYPE_FIXED64=6
 * @property {number} TYPE_FIXED32=7
 * @property {number} TYPE_BOOL=8
 * @property {number} TYPE_STRING=9
 * @property {number} TYPE_GROUP=10
 * @property {number} TYPE_MESSAGE=11
 * @property {number} TYPE_BYTES=12
 * @property {number} TYPE_UINT32=13
 * @property {number} TYPE_ENUM=14
 * @property {number} TYPE_SFIXED32=15
 * @property {number} TYPE_SFIXED64=16
 * @property {number} TYPE_SINT32=17
 * @property {number} TYPE_SINT64=18
 */ /**
 * Properties of a FieldOptions message.
 * @interface IFieldOptions
 * @property {boolean} [packed] Whether packed or not (defaults to `false` for proto2 and `true` for proto3)
 * @property {IFieldOptionsJSType} [jstype] JavaScript value type (not used by protobuf.js)
 */ /**
 * Values of the FieldOptions.JSType enum.
 * @typedef IFieldOptionsJSType
 * @type {number}
 * @property {number} JS_NORMAL=0
 * @property {number} JS_STRING=1
 * @property {number} JS_NUMBER=2
 */ // copied here from parse.js
var numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/;
/**
 * Creates a field from a descriptor.
 * @param {IFieldDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @param {string} [syntax="proto2"] Syntax
 * @returns {Field} Field instance
 */ Field.fromDescriptor = function fromDescriptor(descriptor, syntax) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.DescriptorProto.decode(descriptor);
    if (typeof descriptor.number !== "number") throw Error("missing field id");
    // Rewire field type
    var fieldType;
    if (descriptor.typeName && descriptor.typeName.length) fieldType = descriptor.typeName;
    else fieldType = fromDescriptorType(descriptor.type);
    // Rewire field rule
    var fieldRule;
    switch(descriptor.label){
        // 0 is reserved for errors
        case 1:
            fieldRule = undefined;
            break;
        case 2:
            fieldRule = "required";
            break;
        case 3:
            fieldRule = "repeated";
            break;
        default:
            throw Error("illegal label: " + descriptor.label);
    }
    var extendee = descriptor.extendee;
    if (descriptor.extendee !== undefined) {
        extendee = extendee.length ? extendee : undefined;
    }
    var field = new Field(descriptor.name.length ? descriptor.name : "field" + descriptor.number, descriptor.number, fieldType, fieldRule, extendee);
    field.options = fromDescriptorOptions(descriptor.options, exports.FieldOptions);
    if (descriptor.defaultValue && descriptor.defaultValue.length) {
        var defaultValue = descriptor.defaultValue;
        switch(defaultValue){
            case "true":
            case "TRUE":
                defaultValue = true;
                break;
            case "false":
            case "FALSE":
                defaultValue = false;
                break;
            default:
                var match = numberRe.exec(defaultValue);
                if (match) defaultValue = parseInt(defaultValue); // eslint-disable-line radix
                break;
        }
        field.setOption("default", defaultValue);
    }
    if (packableDescriptorType(descriptor.type)) {
        if (syntax === "proto3") {
            if (descriptor.options && !descriptor.options.packed) field.setOption("packed", false);
        } else if (!(descriptor.options && descriptor.options.packed)) field.setOption("packed", false);
    }
    return field;
};
/**
 * Converts a field to a descriptor.
 * @returns {Message<IFieldDescriptorProto>} Descriptor
 * @param {string} [syntax="proto2"] Syntax
 */ Field.prototype.toDescriptor = function toDescriptor(syntax) {
    var descriptor = exports.FieldDescriptorProto.create({
        name: this.name,
        number: this.id
    });
    if (this.map) {
        descriptor.type = 11; // message
        descriptor.typeName = $protobuf.util.ucFirst(this.name); // fieldName -> FieldNameEntry (built in Type#toDescriptor)
        descriptor.label = 3; // repeated
    } else {
        // Rewire field type
        switch(descriptor.type = toDescriptorType(this.type, this.resolve().resolvedType)){
            case 10:
            case 11:
            case 14:
                descriptor.typeName = this.resolvedType ? shortname(this.parent, this.resolvedType) : this.type;
                break;
        }
        // Rewire field rule
        switch(this.rule){
            case "repeated":
                descriptor.label = 3;
                break;
            case "required":
                descriptor.label = 2;
                break;
            default:
                descriptor.label = 1;
                break;
        }
    }
    // Handle extension field
    descriptor.extendee = this.extensionField ? this.extensionField.parent.fullName : this.extend;
    // Handle part of oneof
    if (this.partOf) {
        if ((descriptor.oneofIndex = this.parent.oneofsArray.indexOf(this.partOf)) < 0) throw Error("missing oneof");
    }
    if (this.options) {
        descriptor.options = toDescriptorOptions(this.options, exports.FieldOptions);
        if (this.options["default"] != null) descriptor.defaultValue = String(this.options["default"]);
    }
    if (syntax === "proto3") {
        if (!this.packed) (descriptor.options || (descriptor.options = exports.FieldOptions.create())).packed = false;
    } else if (this.packed) (descriptor.options || (descriptor.options = exports.FieldOptions.create())).packed = true;
    return descriptor;
};
// --- Enum ---
/**
 * Properties of an EnumDescriptorProto message.
 * @interface IEnumDescriptorProto
 * @property {string} [name] Enum name
 * @property {IEnumValueDescriptorProto[]} [value] Enum values
 * @property {IEnumOptions} [options] Enum options
 */ /**
 * Properties of an EnumValueDescriptorProto message.
 * @interface IEnumValueDescriptorProto
 * @property {string} [name] Name
 * @property {number} [number] Value
 * @property {*} [options] Not supported
 */ /**
 * Properties of an EnumOptions message.
 * @interface IEnumOptions
 * @property {boolean} [allowAlias] Whether aliases are allowed
 * @property {boolean} [deprecated]
 */ var unnamedEnumIndex = 0;
/**
 * Creates an enum from a descriptor.
 * @param {IEnumDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @returns {Enum} Enum instance
 */ Enum.fromDescriptor = function fromDescriptor(descriptor) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.EnumDescriptorProto.decode(descriptor);
    // Construct values object
    var values = {};
    if (descriptor.value) for(var i = 0; i < descriptor.value.length; ++i){
        var name = descriptor.value[i].name, value = descriptor.value[i].number || 0;
        values[name && name.length ? name : "NAME" + value] = value;
    }
    return new Enum(descriptor.name && descriptor.name.length ? descriptor.name : "Enum" + unnamedEnumIndex++, values, fromDescriptorOptions(descriptor.options, exports.EnumOptions));
};
/**
 * Converts an enum to a descriptor.
 * @returns {Message<IEnumDescriptorProto>} Descriptor
 */ Enum.prototype.toDescriptor = function toDescriptor() {
    // Values
    var values = [];
    for(var i = 0, ks = Object.keys(this.values); i < ks.length; ++i)values.push(exports.EnumValueDescriptorProto.create({
        name: ks[i],
        number: this.values[ks[i]]
    }));
    return exports.EnumDescriptorProto.create({
        name: this.name,
        value: values,
        options: toDescriptorOptions(this.options, exports.EnumOptions)
    });
};
// --- OneOf ---
/**
 * Properties of a OneofDescriptorProto message.
 * @interface IOneofDescriptorProto
 * @property {string} [name] Oneof name
 * @property {*} [options] Not supported
 */ var unnamedOneofIndex = 0;
/**
 * Creates a oneof from a descriptor.
 * @param {IOneofDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @returns {OneOf} OneOf instance
 */ OneOf.fromDescriptor = function fromDescriptor(descriptor) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.OneofDescriptorProto.decode(descriptor);
    return new OneOf(// unnamedOneOfIndex is global, not per type, because we have no ref to a type here
    descriptor.name && descriptor.name.length ? descriptor.name : "oneof" + unnamedOneofIndex++);
};
/**
 * Converts a oneof to a descriptor.
 * @returns {Message<IOneofDescriptorProto>} Descriptor
 */ OneOf.prototype.toDescriptor = function toDescriptor() {
    return exports.OneofDescriptorProto.create({
        name: this.name
    });
};
// --- Service ---
/**
 * Properties of a ServiceDescriptorProto message.
 * @interface IServiceDescriptorProto
 * @property {string} [name] Service name
 * @property {IMethodDescriptorProto[]} [method] Methods
 * @property {IServiceOptions} [options] Options
 */ /**
 * Properties of a ServiceOptions message.
 * @interface IServiceOptions
 * @property {boolean} [deprecated]
 */ var unnamedServiceIndex = 0;
/**
 * Creates a service from a descriptor.
 * @param {IServiceDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @returns {Service} Service instance
 */ Service.fromDescriptor = function fromDescriptor(descriptor) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.ServiceDescriptorProto.decode(descriptor);
    var service = new Service(descriptor.name && descriptor.name.length ? descriptor.name : "Service" + unnamedServiceIndex++, fromDescriptorOptions(descriptor.options, exports.ServiceOptions));
    if (descriptor.method) for(var i = 0; i < descriptor.method.length; ++i)service.add(Method.fromDescriptor(descriptor.method[i]));
    return service;
};
/**
 * Converts a service to a descriptor.
 * @returns {Message<IServiceDescriptorProto>} Descriptor
 */ Service.prototype.toDescriptor = function toDescriptor() {
    // Methods
    var methods = [];
    for(var i = 0; i < this.methodsArray.length; ++i)methods.push(this._methodsArray[i].toDescriptor());
    return exports.ServiceDescriptorProto.create({
        name: this.name,
        method: methods,
        options: toDescriptorOptions(this.options, exports.ServiceOptions)
    });
};
// --- Method ---
/**
 * Properties of a MethodDescriptorProto message.
 * @interface IMethodDescriptorProto
 * @property {string} [name] Method name
 * @property {string} [inputType] Request type name
 * @property {string} [outputType] Response type name
 * @property {IMethodOptions} [options] Not supported
 * @property {boolean} [clientStreaming=false] Whether requests are streamed
 * @property {boolean} [serverStreaming=false] Whether responses are streamed
 */ /**
 * Properties of a MethodOptions message.
 * @interface IMethodOptions
 * @property {boolean} [deprecated]
 */ var unnamedMethodIndex = 0;
/**
 * Creates a method from a descriptor.
 * @param {IMethodDescriptorProto|Reader|Uint8Array} descriptor Descriptor
 * @returns {Method} Reflected method instance
 */ Method.fromDescriptor = function fromDescriptor(descriptor) {
    // Decode the descriptor message if specified as a buffer:
    if (typeof descriptor.length === "number") descriptor = exports.MethodDescriptorProto.decode(descriptor);
    return new Method(// unnamedMethodIndex is global, not per service, because we have no ref to a service here
    descriptor.name && descriptor.name.length ? descriptor.name : "Method" + unnamedMethodIndex++, "rpc", descriptor.inputType, descriptor.outputType, Boolean(descriptor.clientStreaming), Boolean(descriptor.serverStreaming), fromDescriptorOptions(descriptor.options, exports.MethodOptions));
};
/**
 * Converts a method to a descriptor.
 * @returns {Message<IMethodDescriptorProto>} Descriptor
 */ Method.prototype.toDescriptor = function toDescriptor() {
    return exports.MethodDescriptorProto.create({
        name: this.name,
        inputType: this.resolvedRequestType ? this.resolvedRequestType.fullName : this.requestType,
        outputType: this.resolvedResponseType ? this.resolvedResponseType.fullName : this.responseType,
        clientStreaming: this.requestStream,
        serverStreaming: this.responseStream,
        options: toDescriptorOptions(this.options, exports.MethodOptions)
    });
};
// --- utility ---
// Converts a descriptor type to a protobuf.js basic type
function fromDescriptorType(type) {
    switch(type){
        // 0 is reserved for errors
        case 1:
            return "double";
        case 2:
            return "float";
        case 3:
            return "int64";
        case 4:
            return "uint64";
        case 5:
            return "int32";
        case 6:
            return "fixed64";
        case 7:
            return "fixed32";
        case 8:
            return "bool";
        case 9:
            return "string";
        case 12:
            return "bytes";
        case 13:
            return "uint32";
        case 15:
            return "sfixed32";
        case 16:
            return "sfixed64";
        case 17:
            return "sint32";
        case 18:
            return "sint64";
    }
    throw Error("illegal type: " + type);
}
// Tests if a descriptor type is packable
function packableDescriptorType(type) {
    switch(type){
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
            return true;
    }
    return false;
}
// Converts a protobuf.js basic type to a descriptor type
function toDescriptorType(type, resolvedType) {
    switch(type){
        // 0 is reserved for errors
        case "double":
            return 1;
        case "float":
            return 2;
        case "int64":
            return 3;
        case "uint64":
            return 4;
        case "int32":
            return 5;
        case "fixed64":
            return 6;
        case "fixed32":
            return 7;
        case "bool":
            return 8;
        case "string":
            return 9;
        case "bytes":
            return 12;
        case "uint32":
            return 13;
        case "sfixed32":
            return 15;
        case "sfixed64":
            return 16;
        case "sint32":
            return 17;
        case "sint64":
            return 18;
    }
    if (resolvedType instanceof Enum) return 14;
    if (resolvedType instanceof Type) return resolvedType.group ? 10 : 11;
    throw Error("illegal type: " + type);
}
// Converts descriptor options to an options object
function fromDescriptorOptions(options, type) {
    if (!options) return undefined;
    var out = [];
    for(var i = 0, field, key, val; i < type.fieldsArray.length; ++i)if ((key = (field = type._fieldsArray[i]).name) !== "uninterpretedOption") {
        if (options.hasOwnProperty(key)) {
            val = options[key];
            if (field.resolvedType instanceof Enum && typeof val === "number" && field.resolvedType.valuesById[val] !== undefined) val = field.resolvedType.valuesById[val];
            out.push(underScore(key), val);
        }
    }
    return out.length ? $protobuf.util.toObject(out) : undefined;
}
// Converts an options object to descriptor options
function toDescriptorOptions(options, type) {
    if (!options) return undefined;
    var out = [];
    for(var i = 0, ks = Object.keys(options), key, val; i < ks.length; ++i){
        val = options[key = ks[i]];
        if (key === "default") continue;
        var field = type.fields[key];
        if (!field && !(field = type.fields[key = $protobuf.util.camelCase(key)])) continue;
        out.push(key, val);
    }
    return out.length ? type.fromObject($protobuf.util.toObject(out)) : undefined;
}
// Calculates the shortest relative path from `from` to `to`.
function shortname(from, to) {
    var fromPath = from.fullName.split("."), toPath = to.fullName.split("."), i = 0, j = 0, k = toPath.length - 1;
    if (!(from instanceof Root) && to instanceof Namespace) while(i < fromPath.length && j < k && fromPath[i] === toPath[j]){
        var other = to.lookup(fromPath[i++], true);
        if (other !== null && other !== to) break;
        ++j;
    }
    else for(; i < fromPath.length && j < k && fromPath[i] === toPath[j]; ++i, ++j);
    return toPath.slice(j).join(".");
}
// copied here from cli/targets/proto.js
function underScore(str) {
    return str.substring(0, 1) + str.substring(1).replace(/([A-Z])(?=[a-z]|$)/g, function($0, $1) {
        return "_" + $1.toLowerCase();
    });
} // --- exports ---
 /**
 * Reflected file descriptor set.
 * @name FileDescriptorSet
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected file descriptor proto.
 * @name FileDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected descriptor proto.
 * @name DescriptorProto
 * @type {Type}
 * @property {Type} ExtensionRange
 * @property {Type} ReservedRange
 * @const
 * @tstype $protobuf.Type & {
 *     ExtensionRange: $protobuf.Type,
 *     ReservedRange: $protobuf.Type
 * }
 */  /**
 * Reflected field descriptor proto.
 * @name FieldDescriptorProto
 * @type {Type}
 * @property {Enum} Label
 * @property {Enum} Type
 * @const
 * @tstype $protobuf.Type & {
 *     Label: $protobuf.Enum,
 *     Type: $protobuf.Enum
 * }
 */  /**
 * Reflected oneof descriptor proto.
 * @name OneofDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected enum descriptor proto.
 * @name EnumDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected service descriptor proto.
 * @name ServiceDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected enum value descriptor proto.
 * @name EnumValueDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected method descriptor proto.
 * @name MethodDescriptorProto
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected file options.
 * @name FileOptions
 * @type {Type}
 * @property {Enum} OptimizeMode
 * @const
 * @tstype $protobuf.Type & {
 *     OptimizeMode: $protobuf.Enum
 * }
 */  /**
 * Reflected message options.
 * @name MessageOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected field options.
 * @name FieldOptions
 * @type {Type}
 * @property {Enum} CType
 * @property {Enum} JSType
 * @const
 * @tstype $protobuf.Type & {
 *     CType: $protobuf.Enum,
 *     JSType: $protobuf.Enum
 * }
 */  /**
 * Reflected oneof options.
 * @name OneofOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected enum options.
 * @name EnumOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected enum value options.
 * @name EnumValueOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected service options.
 * @name ServiceOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected method options.
 * @name MethodOptions
 * @type {Type}
 * @const
 * @tstype $protobuf.Type
 */  /**
 * Reflected uninterpretet option.
 * @name UninterpretedOption
 * @type {Type}
 * @property {Type} NamePart
 * @const
 * @tstype $protobuf.Type & {
 *     NamePart: $protobuf.Type
 * }
 */  /**
 * Reflected source code info.
 * @name SourceCodeInfo
 * @type {Type}
 * @property {Type} Location
 * @const
 * @tstype $protobuf.Type & {
 *     Location: $protobuf.Type
 * }
 */  /**
 * Reflected generated code info.
 * @name GeneratedCodeInfo
 * @type {Type}
 * @property {Type} Annotation
 * @const
 * @tstype $protobuf.Type & {
 *     Annotation: $protobuf.Type
 * }
 */ 
}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/google/protobuf/api.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"nested\":{\"google\":{\"nested\":{\"protobuf\":{\"nested\":{\"Api\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"methods\":{\"rule\":\"repeated\",\"type\":\"Method\",\"id\":2},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":3},\"version\":{\"type\":\"string\",\"id\":4},\"sourceContext\":{\"type\":\"SourceContext\",\"id\":5},\"mixins\":{\"rule\":\"repeated\",\"type\":\"Mixin\",\"id\":6},\"syntax\":{\"type\":\"Syntax\",\"id\":7}}},\"Method\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"requestTypeUrl\":{\"type\":\"string\",\"id\":2},\"requestStreaming\":{\"type\":\"bool\",\"id\":3},\"responseTypeUrl\":{\"type\":\"string\",\"id\":4},\"responseStreaming\":{\"type\":\"bool\",\"id\":5},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":6},\"syntax\":{\"type\":\"Syntax\",\"id\":7}}},\"Mixin\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"root\":{\"type\":\"string\",\"id\":2}}},\"SourceContext\":{\"fields\":{\"fileName\":{\"type\":\"string\",\"id\":1}}},\"Option\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"value\":{\"type\":\"Any\",\"id\":2}}},\"Syntax\":{\"values\":{\"SYNTAX_PROTO2\":0,\"SYNTAX_PROTO3\":1}}}}}}}}"));}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/google/protobuf/source_context.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"nested\":{\"google\":{\"nested\":{\"protobuf\":{\"nested\":{\"SourceContext\":{\"fields\":{\"fileName\":{\"type\":\"string\",\"id\":1}}}}}}}}}"));}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/google/protobuf/type.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"nested\":{\"google\":{\"nested\":{\"protobuf\":{\"nested\":{\"Type\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"fields\":{\"rule\":\"repeated\",\"type\":\"Field\",\"id\":2},\"oneofs\":{\"rule\":\"repeated\",\"type\":\"string\",\"id\":3},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":4},\"sourceContext\":{\"type\":\"SourceContext\",\"id\":5},\"syntax\":{\"type\":\"Syntax\",\"id\":6}}},\"Field\":{\"fields\":{\"kind\":{\"type\":\"Kind\",\"id\":1},\"cardinality\":{\"type\":\"Cardinality\",\"id\":2},\"number\":{\"type\":\"int32\",\"id\":3},\"name\":{\"type\":\"string\",\"id\":4},\"typeUrl\":{\"type\":\"string\",\"id\":6},\"oneofIndex\":{\"type\":\"int32\",\"id\":7},\"packed\":{\"type\":\"bool\",\"id\":8},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":9},\"jsonName\":{\"type\":\"string\",\"id\":10},\"defaultValue\":{\"type\":\"string\",\"id\":11}},\"nested\":{\"Kind\":{\"values\":{\"TYPE_UNKNOWN\":0,\"TYPE_DOUBLE\":1,\"TYPE_FLOAT\":2,\"TYPE_INT64\":3,\"TYPE_UINT64\":4,\"TYPE_INT32\":5,\"TYPE_FIXED64\":6,\"TYPE_FIXED32\":7,\"TYPE_BOOL\":8,\"TYPE_STRING\":9,\"TYPE_GROUP\":10,\"TYPE_MESSAGE\":11,\"TYPE_BYTES\":12,\"TYPE_UINT32\":13,\"TYPE_ENUM\":14,\"TYPE_SFIXED32\":15,\"TYPE_SFIXED64\":16,\"TYPE_SINT32\":17,\"TYPE_SINT64\":18}},\"Cardinality\":{\"values\":{\"CARDINALITY_UNKNOWN\":0,\"CARDINALITY_OPTIONAL\":1,\"CARDINALITY_REQUIRED\":2,\"CARDINALITY_REPEATED\":3}}}},\"Enum\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"enumvalue\":{\"rule\":\"repeated\",\"type\":\"EnumValue\",\"id\":2},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":3},\"sourceContext\":{\"type\":\"SourceContext\",\"id\":4},\"syntax\":{\"type\":\"Syntax\",\"id\":5}}},\"EnumValue\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"number\":{\"type\":\"int32\",\"id\":2},\"options\":{\"rule\":\"repeated\",\"type\":\"Option\",\"id\":3}}},\"Option\":{\"fields\":{\"name\":{\"type\":\"string\",\"id\":1},\"value\":{\"type\":\"Any\",\"id\":2}}},\"Syntax\":{\"values\":{\"SYNTAX_PROTO2\":0,\"SYNTAX_PROTO3\":1}},\"Any\":{\"fields\":{\"type_url\":{\"type\":\"string\",\"id\":1},\"value\":{\"type\":\"bytes\",\"id\":2}}},\"SourceContext\":{\"fields\":{\"fileName\":{\"type\":\"string\",\"id\":1}}}}}}}}}"));}}),
"[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/minimal.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
// minimal library entry point.
"use strict";
module.exports = __turbopack_require__("[project]/node_modules/.pnpm/protobufjs@7.4.0/node_modules/protobufjs/src/index-minimal.js [app-rsc] (ecmascript)");
}}),

};

//# sourceMappingURL=48d81_protobufjs_18e637._.js.map