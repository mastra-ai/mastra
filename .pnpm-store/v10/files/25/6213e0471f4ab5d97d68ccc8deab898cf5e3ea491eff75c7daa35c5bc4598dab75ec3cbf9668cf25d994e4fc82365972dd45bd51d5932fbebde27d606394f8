"use strict";
var ka = Object.create;
var ze = Object.defineProperty;
var Ta = Object.getOwnPropertyDescriptor;
var Ia = Object.getOwnPropertyNames;
var Sa = Object.getPrototypeOf, Ca = Object.prototype.hasOwnProperty;
var o = (t, e) => ze(t, "name", { value: e, configurable: !0 });
var jn = (t, e) => () => (t && (e = t(t = 0)), e);
var S = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), Pa = (t, e) => {
  for (var r in e)
    ze(t, r, { get: e[r], enumerable: !0 });
}, An = (t, e, r, n) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let s of Ia(e))
      !Ca.call(t, s) && s !== r && ze(t, s, { get: () => e[s], enumerable: !(n = Ta(e, s)) || n.enumerable });
  return t;
};
var T = (t, e, r) => (r = t != null ? ka(Sa(t)) : {}, An(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? ze(r, "default", { value: t, enumerable: !0 }) : r,
  t
)), Ea = (t) => An(ze({}, "__esModule", { value: !0 }), t);

// ../node_modules/picocolors/picocolors.js
var Nn = S((El, lr) => {
  var vt = process || {}, On = vt.argv || [], xt = vt.env || {}, ja = !(xt.NO_COLOR || On.includes("--no-color")) && (!!xt.FORCE_COLOR || On.
  includes("--color") || vt.platform === "win32" || (vt.stdout || {}).isTTY && xt.TERM !== "dumb" || !!xt.CI), Aa = /* @__PURE__ */ o((t, e, r = t) => (n) => {
    let s = "" + n, i = s.indexOf(e, t.length);
    return ~i ? t + Oa(s, e, r, i) + e : t + s + e;
  }, "formatter"), Oa = /* @__PURE__ */ o((t, e, r, n) => {
    let s = "", i = 0;
    do
      s += t.substring(i, n) + r, i = n + e.length, n = t.indexOf(e, i);
    while (~n);
    return s + t.substring(i);
  }, "replaceClose"), Zn = /* @__PURE__ */ o((t = ja) => {
    let e = t ? Aa : () => String;
    return {
      isColorSupported: t,
      reset: e("\x1B[0m", "\x1B[0m"),
      bold: e("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: e("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: e("\x1B[3m", "\x1B[23m"),
      underline: e("\x1B[4m", "\x1B[24m"),
      inverse: e("\x1B[7m", "\x1B[27m"),
      hidden: e("\x1B[8m", "\x1B[28m"),
      strikethrough: e("\x1B[9m", "\x1B[29m"),
      black: e("\x1B[30m", "\x1B[39m"),
      red: e("\x1B[31m", "\x1B[39m"),
      green: e("\x1B[32m", "\x1B[39m"),
      yellow: e("\x1B[33m", "\x1B[39m"),
      blue: e("\x1B[34m", "\x1B[39m"),
      magenta: e("\x1B[35m", "\x1B[39m"),
      cyan: e("\x1B[36m", "\x1B[39m"),
      white: e("\x1B[37m", "\x1B[39m"),
      gray: e("\x1B[90m", "\x1B[39m"),
      bgBlack: e("\x1B[40m", "\x1B[49m"),
      bgRed: e("\x1B[41m", "\x1B[49m"),
      bgGreen: e("\x1B[42m", "\x1B[49m"),
      bgYellow: e("\x1B[43m", "\x1B[49m"),
      bgBlue: e("\x1B[44m", "\x1B[49m"),
      bgMagenta: e("\x1B[45m", "\x1B[49m"),
      bgCyan: e("\x1B[46m", "\x1B[49m"),
      bgWhite: e("\x1B[47m", "\x1B[49m"),
      blackBright: e("\x1B[90m", "\x1B[39m"),
      redBright: e("\x1B[91m", "\x1B[39m"),
      greenBright: e("\x1B[92m", "\x1B[39m"),
      yellowBright: e("\x1B[93m", "\x1B[39m"),
      blueBright: e("\x1B[94m", "\x1B[39m"),
      magentaBright: e("\x1B[95m", "\x1B[39m"),
      cyanBright: e("\x1B[96m", "\x1B[39m"),
      whiteBright: e("\x1B[97m", "\x1B[39m"),
      bgBlackBright: e("\x1B[100m", "\x1B[49m"),
      bgRedBright: e("\x1B[101m", "\x1B[49m"),
      bgGreenBright: e("\x1B[102m", "\x1B[49m"),
      bgYellowBright: e("\x1B[103m", "\x1B[49m"),
      bgBlueBright: e("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: e("\x1B[105m", "\x1B[49m"),
      bgCyanBright: e("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: e("\x1B[107m", "\x1B[49m")
    };
  }, "createColors");
  lr.exports = Zn();
  lr.exports.createColors = Zn;
});

// ../node_modules/walk-up-path/dist/cjs/index.js
var $n = S((bt) => {
  "use strict";
  Object.defineProperty(bt, "__esModule", { value: !0 });
  bt.walkUp = void 0;
  var Un = require("path"), Za = /* @__PURE__ */ o(function* (t) {
    for (t = (0, Un.resolve)(t); t; ) {
      yield t;
      let e = (0, Un.dirname)(t);
      if (e === t)
        break;
      t = e;
    }
  }, "walkUp");
  bt.walkUp = Za;
});

// ../node_modules/ts-dedent/dist/index.js
var Gn = S((We) => {
  "use strict";
  Object.defineProperty(We, "__esModule", { value: !0 });
  We.dedent = void 0;
  function zn(t) {
    for (var e = [], r = 1; r < arguments.length; r++)
      e[r - 1] = arguments[r];
    var n = Array.from(typeof t == "string" ? [t] : t);
    n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var s = n.reduce(function(c, p) {
      var l = p.match(/\n([\t ]+|(?!\s).)/g);
      return l ? c.concat(l.map(function(f) {
        var x, w;
        return (w = (x = f.match(/[\t ]/g)) === null || x === void 0 ? void 0 : x.length) !== null && w !== void 0 ? w : 0;
      })) : c;
    }, []);
    if (s.length) {
      var i = new RegExp(`
[	 ]{` + Math.min.apply(Math, s) + "}", "g");
      n = n.map(function(c) {
        return c.replace(i, `
`);
      });
    }
    n[0] = n[0].replace(/^\r?\n/, "");
    var a = n[0];
    return e.forEach(function(c, p) {
      var l = a.match(/(?:^|\n)( *)$/), f = l ? l[1] : "", x = c;
      typeof c == "string" && c.includes(`
`) && (x = String(c).split(`
`).map(function(w, _) {
        return _ === 0 ? w : "" + f + w;
      }).join(`
`)), a += x + n[p + 1];
    }), a;
  }
  o(zn, "dedent");
  We.dedent = zn;
  We.default = zn;
});

// ../node_modules/zod/lib/helpers/util.js
var Je = S((P) => {
  "use strict";
  Object.defineProperty(P, "__esModule", { value: !0 });
  P.getParsedType = P.ZodParsedType = P.objectUtil = P.util = void 0;
  var yr;
  (function(t) {
    t.assertEqual = (s) => s;
    function e(s) {
    }
    o(e, "assertIs"), t.assertIs = e;
    function r(s) {
      throw new Error();
    }
    o(r, "assertNever"), t.assertNever = r, t.arrayToEnum = (s) => {
      let i = {};
      for (let a of s)
        i[a] = a;
      return i;
    }, t.getValidEnumValues = (s) => {
      let i = t.objectKeys(s).filter((c) => typeof s[s[c]] != "number"), a = {};
      for (let c of i)
        a[c] = s[c];
      return t.objectValues(a);
    }, t.objectValues = (s) => t.objectKeys(s).map(function(i) {
      return s[i];
    }), t.objectKeys = typeof Object.keys == "function" ? (s) => Object.keys(s) : (s) => {
      let i = [];
      for (let a in s)
        Object.prototype.hasOwnProperty.call(s, a) && i.push(a);
      return i;
    }, t.find = (s, i) => {
      for (let a of s)
        if (i(a))
          return a;
    }, t.isInteger = typeof Number.isInteger == "function" ? (s) => Number.isInteger(s) : (s) => typeof s == "number" && isFinite(s) && Math.
    floor(s) === s;
    function n(s, i = " | ") {
      return s.map((a) => typeof a == "string" ? `'${a}'` : a).join(i);
    }
    o(n, "joinValues"), t.joinValues = n, t.jsonStringifyReplacer = (s, i) => typeof i == "bigint" ? i.toString() : i;
  })(yr || (P.util = yr = {}));
  var Wn;
  (function(t) {
    t.mergeShapes = (e, r) => ({
      ...e,
      ...r
      // second overwrites first
    });
  })(Wn || (P.objectUtil = Wn = {}));
  P.ZodParsedType = yr.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var Da = /* @__PURE__ */ o((t) => {
    switch (typeof t) {
      case "undefined":
        return P.ZodParsedType.undefined;
      case "string":
        return P.ZodParsedType.string;
      case "number":
        return isNaN(t) ? P.ZodParsedType.nan : P.ZodParsedType.number;
      case "boolean":
        return P.ZodParsedType.boolean;
      case "function":
        return P.ZodParsedType.function;
      case "bigint":
        return P.ZodParsedType.bigint;
      case "symbol":
        return P.ZodParsedType.symbol;
      case "object":
        return Array.isArray(t) ? P.ZodParsedType.array : t === null ? P.ZodParsedType.null : t.then && typeof t.then == "function" && t.catch &&
        typeof t.catch == "function" ? P.ZodParsedType.promise : typeof Map < "u" && t instanceof Map ? P.ZodParsedType.map : typeof Set < "\
u" && t instanceof Set ? P.ZodParsedType.set : typeof Date < "u" && t instanceof Date ? P.ZodParsedType.date : P.ZodParsedType.object;
      default:
        return P.ZodParsedType.unknown;
    }
  }, "getParsedType");
  P.getParsedType = Da;
});

// ../node_modules/zod/lib/ZodError.js
var kt = S((Q) => {
  "use strict";
  Object.defineProperty(Q, "__esModule", { value: !0 });
  Q.ZodError = Q.quotelessJson = Q.ZodIssueCode = void 0;
  var Jn = Je();
  Q.ZodIssueCode = Jn.util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var La = /* @__PURE__ */ o((t) => JSON.stringify(t, null, 2).replace(/"([^"]+)":/g, "$1:"), "quotelessJson");
  Q.quotelessJson = La;
  var He = class t extends Error {
    static {
      o(this, "ZodError");
    }
    get errors() {
      return this.issues;
    }
    constructor(e) {
      super(), this.issues = [], this.addIssue = (n) => {
        this.issues = [...this.issues, n];
      }, this.addIssues = (n = []) => {
        this.issues = [...this.issues, ...n];
      };
      let r = new.target.prototype;
      Object.setPrototypeOf ? Object.setPrototypeOf(this, r) : this.__proto__ = r, this.name = "ZodError", this.issues = e;
    }
    format(e) {
      let r = e || function(i) {
        return i.message;
      }, n = { _errors: [] }, s = /* @__PURE__ */ o((i) => {
        for (let a of i.issues)
          if (a.code === "invalid_union")
            a.unionErrors.map(s);
          else if (a.code === "invalid_return_type")
            s(a.returnTypeError);
          else if (a.code === "invalid_arguments")
            s(a.argumentsError);
          else if (a.path.length === 0)
            n._errors.push(r(a));
          else {
            let c = n, p = 0;
            for (; p < a.path.length; ) {
              let l = a.path[p];
              p === a.path.length - 1 ? (c[l] = c[l] || { _errors: [] }, c[l]._errors.push(r(a))) : c[l] = c[l] || { _errors: [] }, c = c[l],
              p++;
            }
          }
      }, "processError");
      return s(this), n;
    }
    static assert(e) {
      if (!(e instanceof t))
        throw new Error(`Not a ZodError: ${e}`);
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, Jn.util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(e = (r) => r.message) {
      let r = {}, n = [];
      for (let s of this.issues)
        s.path.length > 0 ? (r[s.path[0]] = r[s.path[0]] || [], r[s.path[0]].push(e(s))) : n.push(e(s));
      return { formErrors: n, fieldErrors: r };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  Q.ZodError = He;
  He.create = (t) => new He(t);
});

// ../node_modules/zod/lib/locales/en.js
var xr = S((gr) => {
  "use strict";
  Object.defineProperty(gr, "__esModule", { value: !0 });
  var oe = Je(), O = kt(), Ma = /* @__PURE__ */ o((t, e) => {
    let r;
    switch (t.code) {
      case O.ZodIssueCode.invalid_type:
        t.received === oe.ZodParsedType.undefined ? r = "Required" : r = `Expected ${t.expected}, received ${t.received}`;
        break;
      case O.ZodIssueCode.invalid_literal:
        r = `Invalid literal value, expected ${JSON.stringify(t.expected, oe.util.jsonStringifyReplacer)}`;
        break;
      case O.ZodIssueCode.unrecognized_keys:
        r = `Unrecognized key(s) in object: ${oe.util.joinValues(t.keys, ", ")}`;
        break;
      case O.ZodIssueCode.invalid_union:
        r = "Invalid input";
        break;
      case O.ZodIssueCode.invalid_union_discriminator:
        r = `Invalid discriminator value. Expected ${oe.util.joinValues(t.options)}`;
        break;
      case O.ZodIssueCode.invalid_enum_value:
        r = `Invalid enum value. Expected ${oe.util.joinValues(t.options)}, received '${t.received}'`;
        break;
      case O.ZodIssueCode.invalid_arguments:
        r = "Invalid function arguments";
        break;
      case O.ZodIssueCode.invalid_return_type:
        r = "Invalid function return type";
        break;
      case O.ZodIssueCode.invalid_date:
        r = "Invalid date";
        break;
      case O.ZodIssueCode.invalid_string:
        typeof t.validation == "object" ? "includes" in t.validation ? (r = `Invalid input: must include "${t.validation.includes}"`, typeof t.
        validation.position == "number" && (r = `${r} at one or more positions greater than or equal to ${t.validation.position}`)) : "start\
sWith" in t.validation ? r = `Invalid input: must start with "${t.validation.startsWith}"` : "endsWith" in t.validation ? r = `Invalid input\
: must end with "${t.validation.endsWith}"` : oe.util.assertNever(t.validation) : t.validation !== "regex" ? r = `Invalid ${t.validation}` :
        r = "Invalid";
        break;
      case O.ZodIssueCode.too_small:
        t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "more than"} ${t.minimum} element(s)` :
        t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "over"} ${t.minimum} character(s)` :
        t.type === "number" ? r = `Number must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "greater tha\
n "}${t.minimum}` : t.type === "date" ? r = `Date must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "gre\
ater than "}${new Date(Number(t.minimum))}` : r = "Invalid input";
        break;
      case O.ZodIssueCode.too_big:
        t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "less than"} ${t.maximum} element(s)` :
        t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "under"} ${t.maximum} character(s)` :
        t.type === "number" ? r = `Number must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` :
        t.type === "bigint" ? r = `BigInt must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` :
        t.type === "date" ? r = `Date must be ${t.exact ? "exactly" : t.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(
        Number(t.maximum))}` : r = "Invalid input";
        break;
      case O.ZodIssueCode.custom:
        r = "Invalid input";
        break;
      case O.ZodIssueCode.invalid_intersection_types:
        r = "Intersection results could not be merged";
        break;
      case O.ZodIssueCode.not_multiple_of:
        r = `Number must be a multiple of ${t.multipleOf}`;
        break;
      case O.ZodIssueCode.not_finite:
        r = "Number must be finite";
        break;
      default:
        r = e.defaultError, oe.util.assertNever(t);
    }
    return { message: r };
  }, "errorMap");
  gr.default = Ma;
});

// ../node_modules/zod/lib/errors.js
var Tt = S((z) => {
  "use strict";
  var Ua = z && z.__importDefault || function(t) {
    return t && t.__esModule ? t : { default: t };
  };
  Object.defineProperty(z, "__esModule", { value: !0 });
  z.getErrorMap = z.setErrorMap = z.defaultErrorMap = void 0;
  var Hn = Ua(xr());
  z.defaultErrorMap = Hn.default;
  var Kn = Hn.default;
  function $a(t) {
    Kn = t;
  }
  o($a, "setErrorMap");
  z.setErrorMap = $a;
  function Va() {
    return Kn;
  }
  o(Va, "getErrorMap");
  z.getErrorMap = Va;
});

// ../node_modules/zod/lib/helpers/parseUtil.js
var br = S((I) => {
  "use strict";
  var Fa = I && I.__importDefault || function(t) {
    return t && t.__esModule ? t : { default: t };
  };
  Object.defineProperty(I, "__esModule", { value: !0 });
  I.isAsync = I.isValid = I.isDirty = I.isAborted = I.OK = I.DIRTY = I.INVALID = I.ParseStatus = I.addIssueToContext = I.EMPTY_PATH = I.makeIssue =
  void 0;
  var Ba = Tt(), Yn = Fa(xr()), qa = /* @__PURE__ */ o((t) => {
    let { data: e, path: r, errorMaps: n, issueData: s } = t, i = [...r, ...s.path || []], a = {
      ...s,
      path: i
    };
    if (s.message !== void 0)
      return {
        ...s,
        path: i,
        message: s.message
      };
    let c = "", p = n.filter((l) => !!l).slice().reverse();
    for (let l of p)
      c = l(a, { data: e, defaultError: c }).message;
    return {
      ...s,
      path: i,
      message: c
    };
  }, "makeIssue");
  I.makeIssue = qa;
  I.EMPTY_PATH = [];
  function za(t, e) {
    let r = (0, Ba.getErrorMap)(), n = (0, I.makeIssue)({
      issueData: e,
      data: t.data,
      path: t.path,
      errorMaps: [
        t.common.contextualErrorMap,
        // contextual error map is first priority
        t.schemaErrorMap,
        // then schema-bound map if available
        r,
        // then global override map
        r === Yn.default ? void 0 : Yn.default
        // then global default map
      ].filter((s) => !!s)
    });
    t.common.issues.push(n);
  }
  o(za, "addIssueToContext");
  I.addIssueToContext = za;
  var vr = class t {
    static {
      o(this, "ParseStatus");
    }
    constructor() {
      this.value = "valid";
    }
    dirty() {
      this.value === "valid" && (this.value = "dirty");
    }
    abort() {
      this.value !== "aborted" && (this.value = "aborted");
    }
    static mergeArray(e, r) {
      let n = [];
      for (let s of r) {
        if (s.status === "aborted")
          return I.INVALID;
        s.status === "dirty" && e.dirty(), n.push(s.value);
      }
      return { status: e.value, value: n };
    }
    static async mergeObjectAsync(e, r) {
      let n = [];
      for (let s of r) {
        let i = await s.key, a = await s.value;
        n.push({
          key: i,
          value: a
        });
      }
      return t.mergeObjectSync(e, n);
    }
    static mergeObjectSync(e, r) {
      let n = {};
      for (let s of r) {
        let { key: i, value: a } = s;
        if (i.status === "aborted" || a.status === "aborted")
          return I.INVALID;
        i.status === "dirty" && e.dirty(), a.status === "dirty" && e.dirty(), i.value !== "__proto__" && (typeof a.value < "u" || s.alwaysSet) &&
        (n[i.value] = a.value);
      }
      return { status: e.value, value: n };
    }
  };
  I.ParseStatus = vr;
  I.INVALID = Object.freeze({
    status: "aborted"
  });
  var Ga = /* @__PURE__ */ o((t) => ({ status: "dirty", value: t }), "DIRTY");
  I.DIRTY = Ga;
  var Wa = /* @__PURE__ */ o((t) => ({ status: "valid", value: t }), "OK");
  I.OK = Wa;
  var Ja = /* @__PURE__ */ o((t) => t.status === "aborted", "isAborted");
  I.isAborted = Ja;
  var Ha = /* @__PURE__ */ o((t) => t.status === "dirty", "isDirty");
  I.isDirty = Ha;
  var Ka = /* @__PURE__ */ o((t) => t.status === "valid", "isValid");
  I.isValid = Ka;
  var Ya = /* @__PURE__ */ o((t) => typeof Promise < "u" && t instanceof Promise, "isAsync");
  I.isAsync = Ya;
});

// ../node_modules/zod/lib/helpers/typeAliases.js
var Qn = S((Xn) => {
  "use strict";
  Object.defineProperty(Xn, "__esModule", { value: !0 });
});

// ../node_modules/zod/lib/helpers/errorUtil.js
var ts = S((It) => {
  "use strict";
  Object.defineProperty(It, "__esModule", { value: !0 });
  It.errorUtil = void 0;
  var es;
  (function(t) {
    t.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, t.toString = (e) => typeof e == "string" ? e : e?.message;
  })(es || (It.errorUtil = es = {}));
});

// ../node_modules/zod/lib/types.js
var ms = S((d) => {
  "use strict";
  var Ct = d && d.__classPrivateFieldGet || function(t, e, r, n) {
    if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
    if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did n\
ot declare it");
    return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
  }, ss = d && d.__classPrivateFieldSet || function(t, e, r, n, s) {
    if (n === "m") throw new TypeError("Private method is not writable");
    if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
    if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did no\
t declare it");
    return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
  }, Ke, Ye;
  Object.defineProperty(d, "__esModule", { value: !0 });
  d.boolean = d.bigint = d.array = d.any = d.coerce = d.ZodFirstPartyTypeKind = d.late = d.ZodSchema = d.Schema = d.custom = d.ZodReadonly =
  d.ZodPipeline = d.ZodBranded = d.BRAND = d.ZodNaN = d.ZodCatch = d.ZodDefault = d.ZodNullable = d.ZodOptional = d.ZodTransformer = d.ZodEffects =
  d.ZodPromise = d.ZodNativeEnum = d.ZodEnum = d.ZodLiteral = d.ZodLazy = d.ZodFunction = d.ZodSet = d.ZodMap = d.ZodRecord = d.ZodTuple = d.
  ZodIntersection = d.ZodDiscriminatedUnion = d.ZodUnion = d.ZodObject = d.ZodArray = d.ZodVoid = d.ZodNever = d.ZodUnknown = d.ZodAny = d.ZodNull =
  d.ZodUndefined = d.ZodSymbol = d.ZodDate = d.ZodBoolean = d.ZodBigInt = d.ZodNumber = d.ZodString = d.datetimeRegex = d.ZodType = void 0;
  d.NEVER = d.void = d.unknown = d.union = d.undefined = d.tuple = d.transformer = d.symbol = d.string = d.strictObject = d.set = d.record =
  d.promise = d.preprocess = d.pipeline = d.ostring = d.optional = d.onumber = d.oboolean = d.object = d.number = d.nullable = d.null = d.never =
  d.nativeEnum = d.nan = d.map = d.literal = d.lazy = d.intersection = d.instanceof = d.function = d.enum = d.effect = d.discriminatedUnion =
  d.date = void 0;
  var St = Tt(), y = ts(), u = br(), h = Je(), m = kt(), M = class {
    static {
      o(this, "ParseInputLazyPath");
    }
    constructor(e, r, n, s) {
      this._cachedPath = [], this.parent = e, this.data = r, this._path = n, this._key = s;
    }
    get path() {
      return this._cachedPath.length || (this._key instanceof Array ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.
      push(...this._path, this._key)), this._cachedPath;
    }
  }, rs = /* @__PURE__ */ o((t, e) => {
    if ((0, u.isValid)(e))
      return { success: !0, data: e.value };
    if (!t.common.issues.length)
      throw new Error("Validation failed but no issues detected.");
    return {
      success: !1,
      get error() {
        if (this._error)
          return this._error;
        let r = new m.ZodError(t.common.issues);
        return this._error = r, this._error;
      }
    };
  }, "handleResult");
  function v(t) {
    if (!t)
      return {};
    let { errorMap: e, invalid_type_error: r, required_error: n, description: s } = t;
    if (e && (r || n))
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    return e ? { errorMap: e, description: s } : { errorMap: /* @__PURE__ */ o((a, c) => {
      var p, l;
      let { message: f } = t;
      return a.code === "invalid_enum_value" ? { message: f ?? c.defaultError } : typeof c.data > "u" ? { message: (p = f ?? n) !== null && p !==
      void 0 ? p : c.defaultError } : a.code !== "invalid_type" ? { message: c.defaultError } : { message: (l = f ?? r) !== null && l !== void 0 ?
      l : c.defaultError };
    }, "customMap"), description: s };
  }
  o(v, "processCreateParams");
  var b = class {
    static {
      o(this, "ZodType");
    }
    get description() {
      return this._def.description;
    }
    _getType(e) {
      return (0, h.getParsedType)(e.data);
    }
    _getOrReturnCtx(e, r) {
      return r || {
        common: e.parent.common,
        data: e.data,
        parsedType: (0, h.getParsedType)(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      };
    }
    _processInputParams(e) {
      return {
        status: new u.ParseStatus(),
        ctx: {
          common: e.parent.common,
          data: e.data,
          parsedType: (0, h.getParsedType)(e.data),
          schemaErrorMap: this._def.errorMap,
          path: e.path,
          parent: e.parent
        }
      };
    }
    _parseSync(e) {
      let r = this._parse(e);
      if ((0, u.isAsync)(r))
        throw new Error("Synchronous parse encountered promise.");
      return r;
    }
    _parseAsync(e) {
      let r = this._parse(e);
      return Promise.resolve(r);
    }
    parse(e, r) {
      let n = this.safeParse(e, r);
      if (n.success)
        return n.data;
      throw n.error;
    }
    safeParse(e, r) {
      var n;
      let s = {
        common: {
          issues: [],
          async: (n = r?.async) !== null && n !== void 0 ? n : !1,
          contextualErrorMap: r?.errorMap
        },
        path: r?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, h.getParsedType)(e)
      }, i = this._parseSync({ data: e, path: s.path, parent: s });
      return rs(s, i);
    }
    "~validate"(e) {
      var r, n;
      let s = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, h.getParsedType)(e)
      };
      if (!this["~standard"].async)
        try {
          let i = this._parseSync({ data: e, path: [], parent: s });
          return (0, u.isValid)(i) ? {
            value: i.value
          } : {
            issues: s.common.issues
          };
        } catch (i) {
          !((n = (r = i?.message) === null || r === void 0 ? void 0 : r.toLowerCase()) === null || n === void 0) && n.includes("encountered") &&
          (this["~standard"].async = !0), s.common = {
            issues: [],
            async: !0
          };
        }
      return this._parseAsync({ data: e, path: [], parent: s }).then((i) => (0, u.isValid)(i) ? {
        value: i.value
      } : {
        issues: s.common.issues
      });
    }
    async parseAsync(e, r) {
      let n = await this.safeParseAsync(e, r);
      if (n.success)
        return n.data;
      throw n.error;
    }
    async safeParseAsync(e, r) {
      let n = {
        common: {
          issues: [],
          contextualErrorMap: r?.errorMap,
          async: !0
        },
        path: r?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, h.getParsedType)(e)
      }, s = this._parse({ data: e, path: n.path, parent: n }), i = await ((0, u.isAsync)(s) ? s : Promise.resolve(s));
      return rs(n, i);
    }
    refine(e, r) {
      let n = /* @__PURE__ */ o((s) => typeof r == "string" || typeof r > "u" ? { message: r } : typeof r == "function" ? r(s) : r, "getIssu\
eProperties");
      return this._refinement((s, i) => {
        let a = e(s), c = /* @__PURE__ */ o(() => i.addIssue({
          code: m.ZodIssueCode.custom,
          ...n(s)
        }), "setError");
        return typeof Promise < "u" && a instanceof Promise ? a.then((p) => p ? !0 : (c(), !1)) : a ? !0 : (c(), !1);
      });
    }
    refinement(e, r) {
      return this._refinement((n, s) => e(n) ? !0 : (s.addIssue(typeof r == "function" ? r(n, s) : r), !1));
    }
    _refinement(e) {
      return new R({
        schema: this,
        typeName: g.ZodEffects,
        effect: { type: "refinement", refinement: e }
      });
    }
    superRefine(e) {
      return this._refinement(e);
    }
    constructor(e) {
      this.spa = this.safeParseAsync, this._def = e, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync =
      this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.
      bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.
      bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.
      promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(
      this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe =
      this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.
      bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: /* @__PURE__ */ o((r) => this["~validate"](r), "validate")
      };
    }
    optional() {
      return L.create(this, this._def);
    }
    nullable() {
      return W.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return X.create(this);
    }
    promise() {
      return re.create(this, this._def);
    }
    or(e) {
      return fe.create([this, e], this._def);
    }
    and(e) {
      return me.create(this, e, this._def);
    }
    transform(e) {
      return new R({
        ...v(this._def),
        schema: this,
        typeName: g.ZodEffects,
        effect: { type: "transform", transform: e }
      });
    }
    default(e) {
      let r = typeof e == "function" ? e : () => e;
      return new ve({
        ...v(this._def),
        innerType: this,
        defaultValue: r,
        typeName: g.ZodDefault
      });
    }
    brand() {
      return new Xe({
        typeName: g.ZodBranded,
        type: this,
        ...v(this._def)
      });
    }
    catch(e) {
      let r = typeof e == "function" ? e : () => e;
      return new be({
        ...v(this._def),
        innerType: this,
        catchValue: r,
        typeName: g.ZodCatch
      });
    }
    describe(e) {
      let r = this.constructor;
      return new r({
        ...this._def,
        description: e
      });
    }
    pipe(e) {
      return Qe.create(this, e);
    }
    readonly() {
      return _e.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  d.ZodType = b;
  d.Schema = b;
  d.ZodSchema = b;
  var Xa = /^c[^\s-]{8,}$/i, Qa = /^[0-9a-z]+$/, ec = /^[0-9A-HJKMNP-TV-Z]{26}$/i, tc = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
  rc = /^[a-z0-9_-]{21}$/i, nc = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, sc = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
  ic = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, oc = "^(\\p{Extended_Pictographic}|\\p{Emoji_Comp\
onent})+$", _r, ac = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, cc = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  dc = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  uc = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  lc = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, pc = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  is = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469\
]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", fc = new RegExp(`^${is}$`);
  function os(t) {
    let e = "([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d";
    return t.precision ? e = `${e}\\.\\d{${t.precision}}` : t.precision == null && (e = `${e}(\\.\\d+)?`), e;
  }
  o(os, "timeRegexSource");
  function mc(t) {
    return new RegExp(`^${os(t)}$`);
  }
  o(mc, "timeRegex");
  function as(t) {
    let e = `${is}T${os(t)}`, r = [];
    return r.push(t.local ? "Z?" : "Z"), t.offset && r.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${r.join("|")})`, new RegExp(`^${e}$`);
  }
  o(as, "datetimeRegex");
  d.datetimeRegex = as;
  function hc(t, e) {
    return !!((e === "v4" || !e) && ac.test(t) || (e === "v6" || !e) && dc.test(t));
  }
  o(hc, "isValidIP");
  function yc(t, e) {
    if (!nc.test(t))
      return !1;
    try {
      let [r] = t.split("."), n = r.replace(/-/g, "+").replace(/_/g, "/").padEnd(r.length + (4 - r.length % 4) % 4, "="), s = JSON.parse(atob(
      n));
      return !(typeof s != "object" || s === null || !s.typ || !s.alg || e && s.alg !== e);
    } catch {
      return !1;
    }
  }
  o(yc, "isValidJWT");
  function gc(t, e) {
    return !!((e === "v4" || !e) && cc.test(t) || (e === "v6" || !e) && uc.test(t));
  }
  o(gc, "isValidCidr");
  var ee = class t extends b {
    static {
      o(this, "ZodString");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== h.ZodParsedType.string) {
        let i = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(i, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.string,
          received: i.parsedType
        }), u.INVALID;
      }
      let n = new u.ParseStatus(), s;
      for (let i of this._def.checks)
        if (i.kind === "min")
          e.data.length < i.value && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            code: m.ZodIssueCode.too_small,
            minimum: i.value,
            type: "string",
            inclusive: !0,
            exact: !1,
            message: i.message
          }), n.dirty());
        else if (i.kind === "max")
          e.data.length > i.value && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            code: m.ZodIssueCode.too_big,
            maximum: i.value,
            type: "string",
            inclusive: !0,
            exact: !1,
            message: i.message
          }), n.dirty());
        else if (i.kind === "length") {
          let a = e.data.length > i.value, c = e.data.length < i.value;
          (a || c) && (s = this._getOrReturnCtx(e, s), a ? (0, u.addIssueToContext)(s, {
            code: m.ZodIssueCode.too_big,
            maximum: i.value,
            type: "string",
            inclusive: !0,
            exact: !0,
            message: i.message
          }) : c && (0, u.addIssueToContext)(s, {
            code: m.ZodIssueCode.too_small,
            minimum: i.value,
            type: "string",
            inclusive: !0,
            exact: !0,
            message: i.message
          }), n.dirty());
        } else if (i.kind === "email")
          ic.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "email",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "emoji")
          _r || (_r = new RegExp(oc, "u")), _r.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "emoji",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "uuid")
          tc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "uuid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "nanoid")
          rc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "nanoid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "cuid")
          Xa.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "cuid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "cuid2")
          Qa.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "cuid2",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "ulid")
          ec.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "ulid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "url")
          try {
            new URL(e.data);
          } catch {
            s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
              validation: "url",
              code: m.ZodIssueCode.invalid_string,
              message: i.message
            }), n.dirty();
          }
        else i.kind === "regex" ? (i.regex.lastIndex = 0, i.regex.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          validation: "regex",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty())) : i.kind === "trim" ? e.data = e.data.trim() : i.kind === "includes" ? e.data.includes(i.value, i.position) || (s = this.
        _getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: { includes: i.value, position: i.position },
          message: i.message
        }), n.dirty()) : i.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : i.kind === "toUpperCase" ? e.data = e.data.toUpperCase() :
        i.kind === "startsWith" ? e.data.startsWith(i.value) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: { startsWith: i.value },
          message: i.message
        }), n.dirty()) : i.kind === "endsWith" ? e.data.endsWith(i.value) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: { endsWith: i.value },
          message: i.message
        }), n.dirty()) : i.kind === "datetime" ? as(i).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "datetime",
          message: i.message
        }), n.dirty()) : i.kind === "date" ? fc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "date",
          message: i.message
        }), n.dirty()) : i.kind === "time" ? mc(i).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "time",
          message: i.message
        }), n.dirty()) : i.kind === "duration" ? sc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "duration",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "ip" ? hc(e.data, i.version) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "ip",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "jwt" ? yc(e.data, i.alg) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "jwt",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "cidr" ? gc(e.data, i.version) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "cidr",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "base64" ? lc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "base64",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "base64url" ? pc.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "base64url",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : h.util.assertNever(i);
      return { status: n.value, value: e.data };
    }
    _regex(e, r, n) {
      return this.refinement((s) => e.test(s), {
        validation: r,
        code: m.ZodIssueCode.invalid_string,
        ...y.errorUtil.errToObj(n)
      });
    }
    _addCheck(e) {
      return new t({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    email(e) {
      return this._addCheck({ kind: "email", ...y.errorUtil.errToObj(e) });
    }
    url(e) {
      return this._addCheck({ kind: "url", ...y.errorUtil.errToObj(e) });
    }
    emoji(e) {
      return this._addCheck({ kind: "emoji", ...y.errorUtil.errToObj(e) });
    }
    uuid(e) {
      return this._addCheck({ kind: "uuid", ...y.errorUtil.errToObj(e) });
    }
    nanoid(e) {
      return this._addCheck({ kind: "nanoid", ...y.errorUtil.errToObj(e) });
    }
    cuid(e) {
      return this._addCheck({ kind: "cuid", ...y.errorUtil.errToObj(e) });
    }
    cuid2(e) {
      return this._addCheck({ kind: "cuid2", ...y.errorUtil.errToObj(e) });
    }
    ulid(e) {
      return this._addCheck({ kind: "ulid", ...y.errorUtil.errToObj(e) });
    }
    base64(e) {
      return this._addCheck({ kind: "base64", ...y.errorUtil.errToObj(e) });
    }
    base64url(e) {
      return this._addCheck({
        kind: "base64url",
        ...y.errorUtil.errToObj(e)
      });
    }
    jwt(e) {
      return this._addCheck({ kind: "jwt", ...y.errorUtil.errToObj(e) });
    }
    ip(e) {
      return this._addCheck({ kind: "ip", ...y.errorUtil.errToObj(e) });
    }
    cidr(e) {
      return this._addCheck({ kind: "cidr", ...y.errorUtil.errToObj(e) });
    }
    datetime(e) {
      var r, n;
      return typeof e == "string" ? this._addCheck({
        kind: "datetime",
        precision: null,
        offset: !1,
        local: !1,
        message: e
      }) : this._addCheck({
        kind: "datetime",
        precision: typeof e?.precision > "u" ? null : e?.precision,
        offset: (r = e?.offset) !== null && r !== void 0 ? r : !1,
        local: (n = e?.local) !== null && n !== void 0 ? n : !1,
        ...y.errorUtil.errToObj(e?.message)
      });
    }
    date(e) {
      return this._addCheck({ kind: "date", message: e });
    }
    time(e) {
      return typeof e == "string" ? this._addCheck({
        kind: "time",
        precision: null,
        message: e
      }) : this._addCheck({
        kind: "time",
        precision: typeof e?.precision > "u" ? null : e?.precision,
        ...y.errorUtil.errToObj(e?.message)
      });
    }
    duration(e) {
      return this._addCheck({ kind: "duration", ...y.errorUtil.errToObj(e) });
    }
    regex(e, r) {
      return this._addCheck({
        kind: "regex",
        regex: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    includes(e, r) {
      return this._addCheck({
        kind: "includes",
        value: e,
        position: r?.position,
        ...y.errorUtil.errToObj(r?.message)
      });
    }
    startsWith(e, r) {
      return this._addCheck({
        kind: "startsWith",
        value: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    endsWith(e, r) {
      return this._addCheck({
        kind: "endsWith",
        value: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    min(e, r) {
      return this._addCheck({
        kind: "min",
        value: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    max(e, r) {
      return this._addCheck({
        kind: "max",
        value: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    length(e, r) {
      return this._addCheck({
        kind: "length",
        value: e,
        ...y.errorUtil.errToObj(r)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(e) {
      return this.min(1, y.errorUtil.errToObj(e));
    }
    trim() {
      return new t({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new t({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new t({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((e) => e.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((e) => e.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((e) => e.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((e) => e.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((e) => e.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((e) => e.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((e) => e.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((e) => e.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((e) => e.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((e) => e.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((e) => e.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((e) => e.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((e) => e.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((e) => e.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((e) => e.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((e) => e.kind === "base64url");
    }
    get minLength() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "min" && (e === null || r.value > e) && (e = r.value);
      return e;
    }
    get maxLength() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "max" && (e === null || r.value < e) && (e = r.value);
      return e;
    }
  };
  d.ZodString = ee;
  ee.create = (t) => {
    var e;
    return new ee({
      checks: [],
      typeName: g.ZodString,
      coerce: (e = t?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(t)
    });
  };
  function xc(t, e) {
    let r = (t.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, s = r > n ? r : n, i = parseInt(t.toFixed(
    s).replace(".", "")), a = parseInt(e.toFixed(s).replace(".", ""));
    return i % a / Math.pow(10, s);
  }
  o(xc, "floatSafeRemainder");
  var ae = class t extends b {
    static {
      o(this, "ZodNumber");
    }
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
    }
    _parse(e) {
      if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== h.ZodParsedType.number) {
        let i = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(i, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.number,
          received: i.parsedType
        }), u.INVALID;
      }
      let n, s = new u.ParseStatus();
      for (let i of this._def.checks)
        i.kind === "int" ? h.util.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: "integer",
          received: "float",
          message: i.message
        }), s.dirty()) : i.kind === "min" ? (i.inclusive ? e.data < i.value : e.data <= i.value) && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.too_small,
          minimum: i.value,
          type: "number",
          inclusive: i.inclusive,
          exact: !1,
          message: i.message
        }), s.dirty()) : i.kind === "max" ? (i.inclusive ? e.data > i.value : e.data >= i.value) && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.too_big,
          maximum: i.value,
          type: "number",
          inclusive: i.inclusive,
          exact: !1,
          message: i.message
        }), s.dirty()) : i.kind === "multipleOf" ? xc(e.data, i.value) !== 0 && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(n,
        {
          code: m.ZodIssueCode.not_multiple_of,
          multipleOf: i.value,
          message: i.message
        }), s.dirty()) : i.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.not_finite,
          message: i.message
        }), s.dirty()) : h.util.assertNever(i);
      return { status: s.value, value: e.data };
    }
    gte(e, r) {
      return this.setLimit("min", e, !0, y.errorUtil.toString(r));
    }
    gt(e, r) {
      return this.setLimit("min", e, !1, y.errorUtil.toString(r));
    }
    lte(e, r) {
      return this.setLimit("max", e, !0, y.errorUtil.toString(r));
    }
    lt(e, r) {
      return this.setLimit("max", e, !1, y.errorUtil.toString(r));
    }
    setLimit(e, r, n, s) {
      return new t({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind: e,
            value: r,
            inclusive: n,
            message: y.errorUtil.toString(s)
          }
        ]
      });
    }
    _addCheck(e) {
      return new t({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    int(e) {
      return this._addCheck({
        kind: "int",
        message: y.errorUtil.toString(e)
      });
    }
    positive(e) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: !1,
        message: y.errorUtil.toString(e)
      });
    }
    negative(e) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: !1,
        message: y.errorUtil.toString(e)
      });
    }
    nonpositive(e) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: !0,
        message: y.errorUtil.toString(e)
      });
    }
    nonnegative(e) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: !0,
        message: y.errorUtil.toString(e)
      });
    }
    multipleOf(e, r) {
      return this._addCheck({
        kind: "multipleOf",
        value: e,
        message: y.errorUtil.toString(r)
      });
    }
    finite(e) {
      return this._addCheck({
        kind: "finite",
        message: y.errorUtil.toString(e)
      });
    }
    safe(e) {
      return this._addCheck({
        kind: "min",
        inclusive: !0,
        value: Number.MIN_SAFE_INTEGER,
        message: y.errorUtil.toString(e)
      })._addCheck({
        kind: "max",
        inclusive: !0,
        value: Number.MAX_SAFE_INTEGER,
        message: y.errorUtil.toString(e)
      });
    }
    get minValue() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "min" && (e === null || r.value > e) && (e = r.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "max" && (e === null || r.value < e) && (e = r.value);
      return e;
    }
    get isInt() {
      return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && h.util.isInteger(e.value));
    }
    get isFinite() {
      let e = null, r = null;
      for (let n of this._def.checks) {
        if (n.kind === "finite" || n.kind === "int" || n.kind === "multipleOf")
          return !0;
        n.kind === "min" ? (r === null || n.value > r) && (r = n.value) : n.kind === "max" && (e === null || n.value < e) && (e = n.value);
      }
      return Number.isFinite(r) && Number.isFinite(e);
    }
  };
  d.ZodNumber = ae;
  ae.create = (t) => new ae({
    checks: [],
    typeName: g.ZodNumber,
    coerce: t?.coerce || !1,
    ...v(t)
  });
  var ce = class t extends b {
    static {
      o(this, "ZodBigInt");
    }
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte;
    }
    _parse(e) {
      if (this._def.coerce)
        try {
          e.data = BigInt(e.data);
        } catch {
          return this._getInvalidInput(e);
        }
      if (this._getType(e) !== h.ZodParsedType.bigint)
        return this._getInvalidInput(e);
      let n, s = new u.ParseStatus();
      for (let i of this._def.checks)
        i.kind === "min" ? (i.inclusive ? e.data < i.value : e.data <= i.value) && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.too_small,
          type: "bigint",
          minimum: i.value,
          inclusive: i.inclusive,
          message: i.message
        }), s.dirty()) : i.kind === "max" ? (i.inclusive ? e.data > i.value : e.data >= i.value) && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.too_big,
          type: "bigint",
          maximum: i.value,
          inclusive: i.inclusive,
          message: i.message
        }), s.dirty()) : i.kind === "multipleOf" ? e.data % i.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.not_multiple_of,
          multipleOf: i.value,
          message: i.message
        }), s.dirty()) : h.util.assertNever(i);
      return { status: s.value, value: e.data };
    }
    _getInvalidInput(e) {
      let r = this._getOrReturnCtx(e);
      return (0, u.addIssueToContext)(r, {
        code: m.ZodIssueCode.invalid_type,
        expected: h.ZodParsedType.bigint,
        received: r.parsedType
      }), u.INVALID;
    }
    gte(e, r) {
      return this.setLimit("min", e, !0, y.errorUtil.toString(r));
    }
    gt(e, r) {
      return this.setLimit("min", e, !1, y.errorUtil.toString(r));
    }
    lte(e, r) {
      return this.setLimit("max", e, !0, y.errorUtil.toString(r));
    }
    lt(e, r) {
      return this.setLimit("max", e, !1, y.errorUtil.toString(r));
    }
    setLimit(e, r, n, s) {
      return new t({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind: e,
            value: r,
            inclusive: n,
            message: y.errorUtil.toString(s)
          }
        ]
      });
    }
    _addCheck(e) {
      return new t({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    positive(e) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: !1,
        message: y.errorUtil.toString(e)
      });
    }
    negative(e) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: !1,
        message: y.errorUtil.toString(e)
      });
    }
    nonpositive(e) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: !0,
        message: y.errorUtil.toString(e)
      });
    }
    nonnegative(e) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: !0,
        message: y.errorUtil.toString(e)
      });
    }
    multipleOf(e, r) {
      return this._addCheck({
        kind: "multipleOf",
        value: e,
        message: y.errorUtil.toString(r)
      });
    }
    get minValue() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "min" && (e === null || r.value > e) && (e = r.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "max" && (e === null || r.value < e) && (e = r.value);
      return e;
    }
  };
  d.ZodBigInt = ce;
  ce.create = (t) => {
    var e;
    return new ce({
      checks: [],
      typeName: g.ZodBigInt,
      coerce: (e = t?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(t)
    });
  };
  var de = class extends b {
    static {
      o(this, "ZodBoolean");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== h.ZodParsedType.boolean) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.boolean,
          received: n.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  d.ZodBoolean = de;
  de.create = (t) => new de({
    typeName: g.ZodBoolean,
    coerce: t?.coerce || !1,
    ...v(t)
  });
  var ue = class t extends b {
    static {
      o(this, "ZodDate");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== h.ZodParsedType.date) {
        let i = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(i, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.date,
          received: i.parsedType
        }), u.INVALID;
      }
      if (isNaN(e.data.getTime())) {
        let i = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(i, {
          code: m.ZodIssueCode.invalid_date
        }), u.INVALID;
      }
      let n = new u.ParseStatus(), s;
      for (let i of this._def.checks)
        i.kind === "min" ? e.data.getTime() < i.value && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.too_small,
          message: i.message,
          inclusive: !0,
          exact: !1,
          minimum: i.value,
          type: "date"
        }), n.dirty()) : i.kind === "max" ? e.data.getTime() > i.value && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.too_big,
          message: i.message,
          inclusive: !0,
          exact: !1,
          maximum: i.value,
          type: "date"
        }), n.dirty()) : h.util.assertNever(i);
      return {
        status: n.value,
        value: new Date(e.data.getTime())
      };
    }
    _addCheck(e) {
      return new t({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    min(e, r) {
      return this._addCheck({
        kind: "min",
        value: e.getTime(),
        message: y.errorUtil.toString(r)
      });
    }
    max(e, r) {
      return this._addCheck({
        kind: "max",
        value: e.getTime(),
        message: y.errorUtil.toString(r)
      });
    }
    get minDate() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "min" && (e === null || r.value > e) && (e = r.value);
      return e != null ? new Date(e) : null;
    }
    get maxDate() {
      let e = null;
      for (let r of this._def.checks)
        r.kind === "max" && (e === null || r.value < e) && (e = r.value);
      return e != null ? new Date(e) : null;
    }
  };
  d.ZodDate = ue;
  ue.create = (t) => new ue({
    checks: [],
    coerce: t?.coerce || !1,
    typeName: g.ZodDate,
    ...v(t)
  });
  var Ce = class extends b {
    static {
      o(this, "ZodSymbol");
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.symbol) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.symbol,
          received: n.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  d.ZodSymbol = Ce;
  Ce.create = (t) => new Ce({
    typeName: g.ZodSymbol,
    ...v(t)
  });
  var le = class extends b {
    static {
      o(this, "ZodUndefined");
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.undefined) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.undefined,
          received: n.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  d.ZodUndefined = le;
  le.create = (t) => new le({
    typeName: g.ZodUndefined,
    ...v(t)
  });
  var pe = class extends b {
    static {
      o(this, "ZodNull");
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.null) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.null,
          received: n.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  d.ZodNull = pe;
  pe.create = (t) => new pe({
    typeName: g.ZodNull,
    ...v(t)
  });
  var te = class extends b {
    static {
      o(this, "ZodAny");
    }
    constructor() {
      super(...arguments), this._any = !0;
    }
    _parse(e) {
      return (0, u.OK)(e.data);
    }
  };
  d.ZodAny = te;
  te.create = (t) => new te({
    typeName: g.ZodAny,
    ...v(t)
  });
  var Y = class extends b {
    static {
      o(this, "ZodUnknown");
    }
    constructor() {
      super(...arguments), this._unknown = !0;
    }
    _parse(e) {
      return (0, u.OK)(e.data);
    }
  };
  d.ZodUnknown = Y;
  Y.create = (t) => new Y({
    typeName: g.ZodUnknown,
    ...v(t)
  });
  var $ = class extends b {
    static {
      o(this, "ZodNever");
    }
    _parse(e) {
      let r = this._getOrReturnCtx(e);
      return (0, u.addIssueToContext)(r, {
        code: m.ZodIssueCode.invalid_type,
        expected: h.ZodParsedType.never,
        received: r.parsedType
      }), u.INVALID;
    }
  };
  d.ZodNever = $;
  $.create = (t) => new $({
    typeName: g.ZodNever,
    ...v(t)
  });
  var Pe = class extends b {
    static {
      o(this, "ZodVoid");
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.undefined) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.void,
          received: n.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  d.ZodVoid = Pe;
  Pe.create = (t) => new Pe({
    typeName: g.ZodVoid,
    ...v(t)
  });
  var X = class t extends b {
    static {
      o(this, "ZodArray");
    }
    _parse(e) {
      let { ctx: r, status: n } = this._processInputParams(e), s = this._def;
      if (r.parsedType !== h.ZodParsedType.array)
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.array,
          received: r.parsedType
        }), u.INVALID;
      if (s.exactLength !== null) {
        let a = r.data.length > s.exactLength.value, c = r.data.length < s.exactLength.value;
        (a || c) && ((0, u.addIssueToContext)(r, {
          code: a ? m.ZodIssueCode.too_big : m.ZodIssueCode.too_small,
          minimum: c ? s.exactLength.value : void 0,
          maximum: a ? s.exactLength.value : void 0,
          type: "array",
          inclusive: !0,
          exact: !0,
          message: s.exactLength.message
        }), n.dirty());
      }
      if (s.minLength !== null && r.data.length < s.minLength.value && ((0, u.addIssueToContext)(r, {
        code: m.ZodIssueCode.too_small,
        minimum: s.minLength.value,
        type: "array",
        inclusive: !0,
        exact: !1,
        message: s.minLength.message
      }), n.dirty()), s.maxLength !== null && r.data.length > s.maxLength.value && ((0, u.addIssueToContext)(r, {
        code: m.ZodIssueCode.too_big,
        maximum: s.maxLength.value,
        type: "array",
        inclusive: !0,
        exact: !1,
        message: s.maxLength.message
      }), n.dirty()), r.common.async)
        return Promise.all([...r.data].map((a, c) => s.type._parseAsync(new M(r, a, r.path, c)))).then((a) => u.ParseStatus.mergeArray(n, a));
      let i = [...r.data].map((a, c) => s.type._parseSync(new M(r, a, r.path, c)));
      return u.ParseStatus.mergeArray(n, i);
    }
    get element() {
      return this._def.type;
    }
    min(e, r) {
      return new t({
        ...this._def,
        minLength: { value: e, message: y.errorUtil.toString(r) }
      });
    }
    max(e, r) {
      return new t({
        ...this._def,
        maxLength: { value: e, message: y.errorUtil.toString(r) }
      });
    }
    length(e, r) {
      return new t({
        ...this._def,
        exactLength: { value: e, message: y.errorUtil.toString(r) }
      });
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  d.ZodArray = X;
  X.create = (t, e) => new X({
    type: t,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: g.ZodArray,
    ...v(e)
  });
  function Se(t) {
    if (t instanceof Z) {
      let e = {};
      for (let r in t.shape) {
        let n = t.shape[r];
        e[r] = L.create(Se(n));
      }
      return new Z({
        ...t._def,
        shape: /* @__PURE__ */ o(() => e, "shape")
      });
    } else return t instanceof X ? new X({
      ...t._def,
      type: Se(t.element)
    }) : t instanceof L ? L.create(Se(t.unwrap())) : t instanceof W ? W.create(Se(t.unwrap())) : t instanceof G ? G.create(t.items.map((e) => Se(
    e))) : t;
  }
  o(Se, "deepPartialify");
  var Z = class t extends b {
    static {
      o(this, "ZodObject");
    }
    constructor() {
      super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      let e = this._def.shape(), r = h.util.objectKeys(e);
      return this._cached = { shape: e, keys: r };
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.object) {
        let l = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(l, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.object,
          received: l.parsedType
        }), u.INVALID;
      }
      let { status: n, ctx: s } = this._processInputParams(e), { shape: i, keys: a } = this._getCached(), c = [];
      if (!(this._def.catchall instanceof $ && this._def.unknownKeys === "strip"))
        for (let l in s.data)
          a.includes(l) || c.push(l);
      let p = [];
      for (let l of a) {
        let f = i[l], x = s.data[l];
        p.push({
          key: { status: "valid", value: l },
          value: f._parse(new M(s, x, s.path, l)),
          alwaysSet: l in s.data
        });
      }
      if (this._def.catchall instanceof $) {
        let l = this._def.unknownKeys;
        if (l === "passthrough")
          for (let f of c)
            p.push({
              key: { status: "valid", value: f },
              value: { status: "valid", value: s.data[f] }
            });
        else if (l === "strict")
          c.length > 0 && ((0, u.addIssueToContext)(s, {
            code: m.ZodIssueCode.unrecognized_keys,
            keys: c
          }), n.dirty());
        else if (l !== "strip")
          throw new Error("Internal ZodObject error: invalid unknownKeys value.");
      } else {
        let l = this._def.catchall;
        for (let f of c) {
          let x = s.data[f];
          p.push({
            key: { status: "valid", value: f },
            value: l._parse(
              new M(s, x, s.path, f)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: f in s.data
          });
        }
      }
      return s.common.async ? Promise.resolve().then(async () => {
        let l = [];
        for (let f of p) {
          let x = await f.key, w = await f.value;
          l.push({
            key: x,
            value: w,
            alwaysSet: f.alwaysSet
          });
        }
        return l;
      }).then((l) => u.ParseStatus.mergeObjectSync(n, l)) : u.ParseStatus.mergeObjectSync(n, p);
    }
    get shape() {
      return this._def.shape();
    }
    strict(e) {
      return y.errorUtil.errToObj, new t({
        ...this._def,
        unknownKeys: "strict",
        ...e !== void 0 ? {
          errorMap: /* @__PURE__ */ o((r, n) => {
            var s, i, a, c;
            let p = (a = (i = (s = this._def).errorMap) === null || i === void 0 ? void 0 : i.call(s, r, n).message) !== null && a !== void 0 ?
            a : n.defaultError;
            return r.code === "unrecognized_keys" ? {
              message: (c = y.errorUtil.errToObj(e).message) !== null && c !== void 0 ? c : p
            } : {
              message: p
            };
          }, "errorMap")
        } : {}
      });
    }
    strip() {
      return new t({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new t({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(e) {
      return new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => ({
          ...this._def.shape(),
          ...e
        }), "shape")
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(e) {
      return new t({
        unknownKeys: e._def.unknownKeys,
        catchall: e._def.catchall,
        shape: /* @__PURE__ */ o(() => ({
          ...this._def.shape(),
          ...e._def.shape()
        }), "shape"),
        typeName: g.ZodObject
      });
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(e, r) {
      return this.augment({ [e]: r });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(e) {
      return new t({
        ...this._def,
        catchall: e
      });
    }
    pick(e) {
      let r = {};
      return h.util.objectKeys(e).forEach((n) => {
        e[n] && this.shape[n] && (r[n] = this.shape[n]);
      }), new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => r, "shape")
      });
    }
    omit(e) {
      let r = {};
      return h.util.objectKeys(this.shape).forEach((n) => {
        e[n] || (r[n] = this.shape[n]);
      }), new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => r, "shape")
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return Se(this);
    }
    partial(e) {
      let r = {};
      return h.util.objectKeys(this.shape).forEach((n) => {
        let s = this.shape[n];
        e && !e[n] ? r[n] = s : r[n] = s.optional();
      }), new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => r, "shape")
      });
    }
    required(e) {
      let r = {};
      return h.util.objectKeys(this.shape).forEach((n) => {
        if (e && !e[n])
          r[n] = this.shape[n];
        else {
          let i = this.shape[n];
          for (; i instanceof L; )
            i = i._def.innerType;
          r[n] = i;
        }
      }), new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => r, "shape")
      });
    }
    keyof() {
      return cs(h.util.objectKeys(this.shape));
    }
  };
  d.ZodObject = Z;
  Z.create = (t, e) => new Z({
    shape: /* @__PURE__ */ o(() => t, "shape"),
    unknownKeys: "strip",
    catchall: $.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  Z.strictCreate = (t, e) => new Z({
    shape: /* @__PURE__ */ o(() => t, "shape"),
    unknownKeys: "strict",
    catchall: $.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  Z.lazycreate = (t, e) => new Z({
    shape: t,
    unknownKeys: "strip",
    catchall: $.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  var fe = class extends b {
    static {
      o(this, "ZodUnion");
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e), n = this._def.options;
      function s(i) {
        for (let c of i)
          if (c.result.status === "valid")
            return c.result;
        for (let c of i)
          if (c.result.status === "dirty")
            return r.common.issues.push(...c.ctx.common.issues), c.result;
        let a = i.map((c) => new m.ZodError(c.ctx.common.issues));
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_union,
          unionErrors: a
        }), u.INVALID;
      }
      if (o(s, "handleResults"), r.common.async)
        return Promise.all(n.map(async (i) => {
          let a = {
            ...r,
            common: {
              ...r.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await i._parseAsync({
              data: r.data,
              path: r.path,
              parent: a
            }),
            ctx: a
          };
        })).then(s);
      {
        let i, a = [];
        for (let p of n) {
          let l = {
            ...r,
            common: {
              ...r.common,
              issues: []
            },
            parent: null
          }, f = p._parseSync({
            data: r.data,
            path: r.path,
            parent: l
          });
          if (f.status === "valid")
            return f;
          f.status === "dirty" && !i && (i = { result: f, ctx: l }), l.common.issues.length && a.push(l.common.issues);
        }
        if (i)
          return r.common.issues.push(...i.ctx.common.issues), i.result;
        let c = a.map((p) => new m.ZodError(p));
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_union,
          unionErrors: c
        }), u.INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  d.ZodUnion = fe;
  fe.create = (t, e) => new fe({
    options: t,
    typeName: g.ZodUnion,
    ...v(e)
  });
  var K = /* @__PURE__ */ o((t) => t instanceof he ? K(t.schema) : t instanceof R ? K(t.innerType()) : t instanceof ye ? [t.value] : t instanceof
  ge ? t.options : t instanceof xe ? h.util.objectValues(t.enum) : t instanceof ve ? K(t._def.innerType) : t instanceof le ? [void 0] : t instanceof
  pe ? [null] : t instanceof L ? [void 0, ...K(t.unwrap())] : t instanceof W ? [null, ...K(t.unwrap())] : t instanceof Xe || t instanceof _e ?
  K(t.unwrap()) : t instanceof be ? K(t._def.innerType) : [], "getDiscriminator"), Pt = class t extends b {
    static {
      o(this, "ZodDiscriminatedUnion");
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e);
      if (r.parsedType !== h.ZodParsedType.object)
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.object,
          received: r.parsedType
        }), u.INVALID;
      let n = this.discriminator, s = r.data[n], i = this.optionsMap.get(s);
      return i ? r.common.async ? i._parseAsync({
        data: r.data,
        path: r.path,
        parent: r
      }) : i._parseSync({
        data: r.data,
        path: r.path,
        parent: r
      }) : ((0, u.addIssueToContext)(r, {
        code: m.ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [n]
      }), u.INVALID);
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(e, r, n) {
      let s = /* @__PURE__ */ new Map();
      for (let i of r) {
        let a = K(i.shape[e]);
        if (!a.length)
          throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
        for (let c of a) {
          if (s.has(c))
            throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(c)}`);
          s.set(c, i);
        }
      }
      return new t({
        typeName: g.ZodDiscriminatedUnion,
        discriminator: e,
        options: r,
        optionsMap: s,
        ...v(n)
      });
    }
  };
  d.ZodDiscriminatedUnion = Pt;
  function wr(t, e) {
    let r = (0, h.getParsedType)(t), n = (0, h.getParsedType)(e);
    if (t === e)
      return { valid: !0, data: t };
    if (r === h.ZodParsedType.object && n === h.ZodParsedType.object) {
      let s = h.util.objectKeys(e), i = h.util.objectKeys(t).filter((c) => s.indexOf(c) !== -1), a = { ...t, ...e };
      for (let c of i) {
        let p = wr(t[c], e[c]);
        if (!p.valid)
          return { valid: !1 };
        a[c] = p.data;
      }
      return { valid: !0, data: a };
    } else if (r === h.ZodParsedType.array && n === h.ZodParsedType.array) {
      if (t.length !== e.length)
        return { valid: !1 };
      let s = [];
      for (let i = 0; i < t.length; i++) {
        let a = t[i], c = e[i], p = wr(a, c);
        if (!p.valid)
          return { valid: !1 };
        s.push(p.data);
      }
      return { valid: !0, data: s };
    } else return r === h.ZodParsedType.date && n === h.ZodParsedType.date && +t == +e ? { valid: !0, data: t } : { valid: !1 };
  }
  o(wr, "mergeValues");
  var me = class extends b {
    static {
      o(this, "ZodIntersection");
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e), s = /* @__PURE__ */ o((i, a) => {
        if ((0, u.isAborted)(i) || (0, u.isAborted)(a))
          return u.INVALID;
        let c = wr(i.value, a.value);
        return c.valid ? (((0, u.isDirty)(i) || (0, u.isDirty)(a)) && r.dirty(), { status: r.value, value: c.data }) : ((0, u.addIssueToContext)(
        n, {
          code: m.ZodIssueCode.invalid_intersection_types
        }), u.INVALID);
      }, "handleParsed");
      return n.common.async ? Promise.all([
        this._def.left._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        }),
        this._def.right._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        })
      ]).then(([i, a]) => s(i, a)) : s(this._def.left._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      }), this._def.right._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      }));
    }
  };
  d.ZodIntersection = me;
  me.create = (t, e, r) => new me({
    left: t,
    right: e,
    typeName: g.ZodIntersection,
    ...v(r)
  });
  var G = class t extends b {
    static {
      o(this, "ZodTuple");
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== h.ZodParsedType.array)
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.array,
          received: n.parsedType
        }), u.INVALID;
      if (n.data.length < this._def.items.length)
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: !0,
          exact: !1,
          type: "array"
        }), u.INVALID;
      !this._def.rest && n.data.length > this._def.items.length && ((0, u.addIssueToContext)(n, {
        code: m.ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), r.dirty());
      let i = [...n.data].map((a, c) => {
        let p = this._def.items[c] || this._def.rest;
        return p ? p._parse(new M(n, a, n.path, c)) : null;
      }).filter((a) => !!a);
      return n.common.async ? Promise.all(i).then((a) => u.ParseStatus.mergeArray(r, a)) : u.ParseStatus.mergeArray(r, i);
    }
    get items() {
      return this._def.items;
    }
    rest(e) {
      return new t({
        ...this._def,
        rest: e
      });
    }
  };
  d.ZodTuple = G;
  G.create = (t, e) => {
    if (!Array.isArray(t))
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    return new G({
      items: t,
      typeName: g.ZodTuple,
      rest: null,
      ...v(e)
    });
  };
  var Et = class t extends b {
    static {
      o(this, "ZodRecord");
    }
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== h.ZodParsedType.object)
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.object,
          received: n.parsedType
        }), u.INVALID;
      let s = [], i = this._def.keyType, a = this._def.valueType;
      for (let c in n.data)
        s.push({
          key: i._parse(new M(n, c, n.path, c)),
          value: a._parse(new M(n, n.data[c], n.path, c)),
          alwaysSet: c in n.data
        });
      return n.common.async ? u.ParseStatus.mergeObjectAsync(r, s) : u.ParseStatus.mergeObjectSync(r, s);
    }
    get element() {
      return this._def.valueType;
    }
    static create(e, r, n) {
      return r instanceof b ? new t({
        keyType: e,
        valueType: r,
        typeName: g.ZodRecord,
        ...v(n)
      }) : new t({
        keyType: ee.create(),
        valueType: e,
        typeName: g.ZodRecord,
        ...v(r)
      });
    }
  };
  d.ZodRecord = Et;
  var Ee = class extends b {
    static {
      o(this, "ZodMap");
    }
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== h.ZodParsedType.map)
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.map,
          received: n.parsedType
        }), u.INVALID;
      let s = this._def.keyType, i = this._def.valueType, a = [...n.data.entries()].map(([c, p], l) => ({
        key: s._parse(new M(n, c, n.path, [l, "key"])),
        value: i._parse(new M(n, p, n.path, [l, "value"]))
      }));
      if (n.common.async) {
        let c = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (let p of a) {
            let l = await p.key, f = await p.value;
            if (l.status === "aborted" || f.status === "aborted")
              return u.INVALID;
            (l.status === "dirty" || f.status === "dirty") && r.dirty(), c.set(l.value, f.value);
          }
          return { status: r.value, value: c };
        });
      } else {
        let c = /* @__PURE__ */ new Map();
        for (let p of a) {
          let l = p.key, f = p.value;
          if (l.status === "aborted" || f.status === "aborted")
            return u.INVALID;
          (l.status === "dirty" || f.status === "dirty") && r.dirty(), c.set(l.value, f.value);
        }
        return { status: r.value, value: c };
      }
    }
  };
  d.ZodMap = Ee;
  Ee.create = (t, e, r) => new Ee({
    valueType: e,
    keyType: t,
    typeName: g.ZodMap,
    ...v(r)
  });
  var je = class t extends b {
    static {
      o(this, "ZodSet");
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e);
      if (n.parsedType !== h.ZodParsedType.set)
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.set,
          received: n.parsedType
        }), u.INVALID;
      let s = this._def;
      s.minSize !== null && n.data.size < s.minSize.value && ((0, u.addIssueToContext)(n, {
        code: m.ZodIssueCode.too_small,
        minimum: s.minSize.value,
        type: "set",
        inclusive: !0,
        exact: !1,
        message: s.minSize.message
      }), r.dirty()), s.maxSize !== null && n.data.size > s.maxSize.value && ((0, u.addIssueToContext)(n, {
        code: m.ZodIssueCode.too_big,
        maximum: s.maxSize.value,
        type: "set",
        inclusive: !0,
        exact: !1,
        message: s.maxSize.message
      }), r.dirty());
      let i = this._def.valueType;
      function a(p) {
        let l = /* @__PURE__ */ new Set();
        for (let f of p) {
          if (f.status === "aborted")
            return u.INVALID;
          f.status === "dirty" && r.dirty(), l.add(f.value);
        }
        return { status: r.value, value: l };
      }
      o(a, "finalizeSet");
      let c = [...n.data.values()].map((p, l) => i._parse(new M(n, p, n.path, l)));
      return n.common.async ? Promise.all(c).then((p) => a(p)) : a(c);
    }
    min(e, r) {
      return new t({
        ...this._def,
        minSize: { value: e, message: y.errorUtil.toString(r) }
      });
    }
    max(e, r) {
      return new t({
        ...this._def,
        maxSize: { value: e, message: y.errorUtil.toString(r) }
      });
    }
    size(e, r) {
      return this.min(e, r).max(e, r);
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  d.ZodSet = je;
  je.create = (t, e) => new je({
    valueType: t,
    minSize: null,
    maxSize: null,
    typeName: g.ZodSet,
    ...v(e)
  });
  var jt = class t extends b {
    static {
      o(this, "ZodFunction");
    }
    constructor() {
      super(...arguments), this.validate = this.implement;
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e);
      if (r.parsedType !== h.ZodParsedType.function)
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.function,
          received: r.parsedType
        }), u.INVALID;
      function n(c, p) {
        return (0, u.makeIssue)({
          data: c,
          path: r.path,
          errorMaps: [
            r.common.contextualErrorMap,
            r.schemaErrorMap,
            (0, St.getErrorMap)(),
            St.defaultErrorMap
          ].filter((l) => !!l),
          issueData: {
            code: m.ZodIssueCode.invalid_arguments,
            argumentsError: p
          }
        });
      }
      o(n, "makeArgsIssue");
      function s(c, p) {
        return (0, u.makeIssue)({
          data: c,
          path: r.path,
          errorMaps: [
            r.common.contextualErrorMap,
            r.schemaErrorMap,
            (0, St.getErrorMap)(),
            St.defaultErrorMap
          ].filter((l) => !!l),
          issueData: {
            code: m.ZodIssueCode.invalid_return_type,
            returnTypeError: p
          }
        });
      }
      o(s, "makeReturnsIssue");
      let i = { errorMap: r.common.contextualErrorMap }, a = r.data;
      if (this._def.returns instanceof re) {
        let c = this;
        return (0, u.OK)(async function(...p) {
          let l = new m.ZodError([]), f = await c._def.args.parseAsync(p, i).catch((_) => {
            throw l.addIssue(n(p, _)), l;
          }), x = await Reflect.apply(a, this, f);
          return await c._def.returns._def.type.parseAsync(x, i).catch((_) => {
            throw l.addIssue(s(x, _)), l;
          });
        });
      } else {
        let c = this;
        return (0, u.OK)(function(...p) {
          let l = c._def.args.safeParse(p, i);
          if (!l.success)
            throw new m.ZodError([n(p, l.error)]);
          let f = Reflect.apply(a, this, l.data), x = c._def.returns.safeParse(f, i);
          if (!x.success)
            throw new m.ZodError([s(f, x.error)]);
          return x.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...e) {
      return new t({
        ...this._def,
        args: G.create(e).rest(Y.create())
      });
    }
    returns(e) {
      return new t({
        ...this._def,
        returns: e
      });
    }
    implement(e) {
      return this.parse(e);
    }
    strictImplement(e) {
      return this.parse(e);
    }
    static create(e, r, n) {
      return new t({
        args: e || G.create([]).rest(Y.create()),
        returns: r || Y.create(),
        typeName: g.ZodFunction,
        ...v(n)
      });
    }
  };
  d.ZodFunction = jt;
  var he = class extends b {
    static {
      o(this, "ZodLazy");
    }
    get schema() {
      return this._def.getter();
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e);
      return this._def.getter()._parse({ data: r.data, path: r.path, parent: r });
    }
  };
  d.ZodLazy = he;
  he.create = (t, e) => new he({
    getter: t,
    typeName: g.ZodLazy,
    ...v(e)
  });
  var ye = class extends b {
    static {
      o(this, "ZodLiteral");
    }
    _parse(e) {
      if (e.data !== this._def.value) {
        let r = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(r, {
          received: r.data,
          code: m.ZodIssueCode.invalid_literal,
          expected: this._def.value
        }), u.INVALID;
      }
      return { status: "valid", value: e.data };
    }
    get value() {
      return this._def.value;
    }
  };
  d.ZodLiteral = ye;
  ye.create = (t, e) => new ye({
    value: t,
    typeName: g.ZodLiteral,
    ...v(e)
  });
  function cs(t, e) {
    return new ge({
      values: t,
      typeName: g.ZodEnum,
      ...v(e)
    });
  }
  o(cs, "createZodEnum");
  var ge = class t extends b {
    static {
      o(this, "ZodEnum");
    }
    constructor() {
      super(...arguments), Ke.set(this, void 0);
    }
    _parse(e) {
      if (typeof e.data != "string") {
        let r = this._getOrReturnCtx(e), n = this._def.values;
        return (0, u.addIssueToContext)(r, {
          expected: h.util.joinValues(n),
          received: r.parsedType,
          code: m.ZodIssueCode.invalid_type
        }), u.INVALID;
      }
      if (Ct(this, Ke, "f") || ss(this, Ke, new Set(this._def.values), "f"), !Ct(this, Ke, "f").has(e.data)) {
        let r = this._getOrReturnCtx(e), n = this._def.values;
        return (0, u.addIssueToContext)(r, {
          received: r.data,
          code: m.ZodIssueCode.invalid_enum_value,
          options: n
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      let e = {};
      for (let r of this._def.values)
        e[r] = r;
      return e;
    }
    get Values() {
      let e = {};
      for (let r of this._def.values)
        e[r] = r;
      return e;
    }
    get Enum() {
      let e = {};
      for (let r of this._def.values)
        e[r] = r;
      return e;
    }
    extract(e, r = this._def) {
      return t.create(e, {
        ...this._def,
        ...r
      });
    }
    exclude(e, r = this._def) {
      return t.create(this.options.filter((n) => !e.includes(n)), {
        ...this._def,
        ...r
      });
    }
  };
  d.ZodEnum = ge;
  Ke = /* @__PURE__ */ new WeakMap();
  ge.create = cs;
  var xe = class extends b {
    static {
      o(this, "ZodNativeEnum");
    }
    constructor() {
      super(...arguments), Ye.set(this, void 0);
    }
    _parse(e) {
      let r = h.util.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
      if (n.parsedType !== h.ZodParsedType.string && n.parsedType !== h.ZodParsedType.number) {
        let s = h.util.objectValues(r);
        return (0, u.addIssueToContext)(n, {
          expected: h.util.joinValues(s),
          received: n.parsedType,
          code: m.ZodIssueCode.invalid_type
        }), u.INVALID;
      }
      if (Ct(this, Ye, "f") || ss(this, Ye, new Set(h.util.getValidEnumValues(this._def.values)), "f"), !Ct(this, Ye, "f").has(e.data)) {
        let s = h.util.objectValues(r);
        return (0, u.addIssueToContext)(n, {
          received: n.data,
          code: m.ZodIssueCode.invalid_enum_value,
          options: s
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  d.ZodNativeEnum = xe;
  Ye = /* @__PURE__ */ new WeakMap();
  xe.create = (t, e) => new xe({
    values: t,
    typeName: g.ZodNativeEnum,
    ...v(e)
  });
  var re = class extends b {
    static {
      o(this, "ZodPromise");
    }
    unwrap() {
      return this._def.type;
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e);
      if (r.parsedType !== h.ZodParsedType.promise && r.common.async === !1)
        return (0, u.addIssueToContext)(r, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.promise,
          received: r.parsedType
        }), u.INVALID;
      let n = r.parsedType === h.ZodParsedType.promise ? r.data : Promise.resolve(r.data);
      return (0, u.OK)(n.then((s) => this._def.type.parseAsync(s, {
        path: r.path,
        errorMap: r.common.contextualErrorMap
      })));
    }
  };
  d.ZodPromise = re;
  re.create = (t, e) => new re({
    type: t,
    typeName: g.ZodPromise,
    ...v(e)
  });
  var R = class extends b {
    static {
      o(this, "ZodEffects");
    }
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === g.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e), s = this._def.effect || null, i = {
        addIssue: /* @__PURE__ */ o((a) => {
          (0, u.addIssueToContext)(n, a), a.fatal ? r.abort() : r.dirty();
        }, "addIssue"),
        get path() {
          return n.path;
        }
      };
      if (i.addIssue = i.addIssue.bind(i), s.type === "preprocess") {
        let a = s.transform(n.data, i);
        if (n.common.async)
          return Promise.resolve(a).then(async (c) => {
            if (r.value === "aborted")
              return u.INVALID;
            let p = await this._def.schema._parseAsync({
              data: c,
              path: n.path,
              parent: n
            });
            return p.status === "aborted" ? u.INVALID : p.status === "dirty" || r.value === "dirty" ? (0, u.DIRTY)(p.value) : p;
          });
        {
          if (r.value === "aborted")
            return u.INVALID;
          let c = this._def.schema._parseSync({
            data: a,
            path: n.path,
            parent: n
          });
          return c.status === "aborted" ? u.INVALID : c.status === "dirty" || r.value === "dirty" ? (0, u.DIRTY)(c.value) : c;
        }
      }
      if (s.type === "refinement") {
        let a = /* @__PURE__ */ o((c) => {
          let p = s.refinement(c, i);
          if (n.common.async)
            return Promise.resolve(p);
          if (p instanceof Promise)
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          return c;
        }, "executeRefinement");
        if (n.common.async === !1) {
          let c = this._def.schema._parseSync({
            data: n.data,
            path: n.path,
            parent: n
          });
          return c.status === "aborted" ? u.INVALID : (c.status === "dirty" && r.dirty(), a(c.value), { status: r.value, value: c.value });
        } else
          return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((c) => c.status === "aborted" ? u.INVALID : (c.
          status === "dirty" && r.dirty(), a(c.value).then(() => ({ status: r.value, value: c.value }))));
      }
      if (s.type === "transform")
        if (n.common.async === !1) {
          let a = this._def.schema._parseSync({
            data: n.data,
            path: n.path,
            parent: n
          });
          if (!(0, u.isValid)(a))
            return a;
          let c = s.transform(a.value, i);
          if (c instanceof Promise)
            throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
          return { status: r.value, value: c };
        } else
          return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((a) => (0, u.isValid)(a) ? Promise.resolve(s.transform(
          a.value, i)).then((c) => ({ status: r.value, value: c })) : a);
      h.util.assertNever(s);
    }
  };
  d.ZodEffects = R;
  d.ZodTransformer = R;
  R.create = (t, e, r) => new R({
    schema: t,
    typeName: g.ZodEffects,
    effect: e,
    ...v(r)
  });
  R.createWithPreprocess = (t, e, r) => new R({
    schema: e,
    effect: { type: "preprocess", transform: t },
    typeName: g.ZodEffects,
    ...v(r)
  });
  var L = class extends b {
    static {
      o(this, "ZodOptional");
    }
    _parse(e) {
      return this._getType(e) === h.ZodParsedType.undefined ? (0, u.OK)(void 0) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  d.ZodOptional = L;
  L.create = (t, e) => new L({
    innerType: t,
    typeName: g.ZodOptional,
    ...v(e)
  });
  var W = class extends b {
    static {
      o(this, "ZodNullable");
    }
    _parse(e) {
      return this._getType(e) === h.ZodParsedType.null ? (0, u.OK)(null) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  d.ZodNullable = W;
  W.create = (t, e) => new W({
    innerType: t,
    typeName: g.ZodNullable,
    ...v(e)
  });
  var ve = class extends b {
    static {
      o(this, "ZodDefault");
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e), n = r.data;
      return r.parsedType === h.ZodParsedType.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
        data: n,
        path: r.path,
        parent: r
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  d.ZodDefault = ve;
  ve.create = (t, e) => new ve({
    innerType: t,
    typeName: g.ZodDefault,
    defaultValue: typeof e.default == "function" ? e.default : () => e.default,
    ...v(e)
  });
  var be = class extends b {
    static {
      o(this, "ZodCatch");
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e), n = {
        ...r,
        common: {
          ...r.common,
          issues: []
        }
      }, s = this._def.innerType._parse({
        data: n.data,
        path: n.path,
        parent: {
          ...n
        }
      });
      return (0, u.isAsync)(s) ? s.then((i) => ({
        status: "valid",
        value: i.status === "valid" ? i.value : this._def.catchValue({
          get error() {
            return new m.ZodError(n.common.issues);
          },
          input: n.data
        })
      })) : {
        status: "valid",
        value: s.status === "valid" ? s.value : this._def.catchValue({
          get error() {
            return new m.ZodError(n.common.issues);
          },
          input: n.data
        })
      };
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  d.ZodCatch = be;
  be.create = (t, e) => new be({
    innerType: t,
    typeName: g.ZodCatch,
    catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
    ...v(e)
  });
  var Ae = class extends b {
    static {
      o(this, "ZodNaN");
    }
    _parse(e) {
      if (this._getType(e) !== h.ZodParsedType.nan) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: m.ZodIssueCode.invalid_type,
          expected: h.ZodParsedType.nan,
          received: n.parsedType
        }), u.INVALID;
      }
      return { status: "valid", value: e.data };
    }
  };
  d.ZodNaN = Ae;
  Ae.create = (t) => new Ae({
    typeName: g.ZodNaN,
    ...v(t)
  });
  d.BRAND = Symbol("zod_brand");
  var Xe = class extends b {
    static {
      o(this, "ZodBranded");
    }
    _parse(e) {
      let { ctx: r } = this._processInputParams(e), n = r.data;
      return this._def.type._parse({
        data: n,
        path: r.path,
        parent: r
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  d.ZodBranded = Xe;
  var Qe = class t extends b {
    static {
      o(this, "ZodPipeline");
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e);
      if (n.common.async)
        return (/* @__PURE__ */ o(async () => {
          let i = await this._def.in._parseAsync({
            data: n.data,
            path: n.path,
            parent: n
          });
          return i.status === "aborted" ? u.INVALID : i.status === "dirty" ? (r.dirty(), (0, u.DIRTY)(i.value)) : this._def.out._parseAsync(
          {
            data: i.value,
            path: n.path,
            parent: n
          });
        }, "handleAsync"))();
      {
        let s = this._def.in._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return s.status === "aborted" ? u.INVALID : s.status === "dirty" ? (r.dirty(), {
          status: "dirty",
          value: s.value
        }) : this._def.out._parseSync({
          data: s.value,
          path: n.path,
          parent: n
        });
      }
    }
    static create(e, r) {
      return new t({
        in: e,
        out: r,
        typeName: g.ZodPipeline
      });
    }
  };
  d.ZodPipeline = Qe;
  var _e = class extends b {
    static {
      o(this, "ZodReadonly");
    }
    _parse(e) {
      let r = this._def.innerType._parse(e), n = /* @__PURE__ */ o((s) => ((0, u.isValid)(s) && (s.value = Object.freeze(s.value)), s), "fre\
eze");
      return (0, u.isAsync)(r) ? r.then((s) => n(s)) : n(r);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  d.ZodReadonly = _e;
  _e.create = (t, e) => new _e({
    innerType: t,
    typeName: g.ZodReadonly,
    ...v(e)
  });
  function ns(t, e) {
    let r = typeof t == "function" ? t(e) : typeof t == "string" ? { message: t } : t;
    return typeof r == "string" ? { message: r } : r;
  }
  o(ns, "cleanParams");
  function ds(t, e = {}, r) {
    return t ? te.create().superRefine((n, s) => {
      var i, a;
      let c = t(n);
      if (c instanceof Promise)
        return c.then((p) => {
          var l, f;
          if (!p) {
            let x = ns(e, n), w = (f = (l = x.fatal) !== null && l !== void 0 ? l : r) !== null && f !== void 0 ? f : !0;
            s.addIssue({ code: "custom", ...x, fatal: w });
          }
        });
      if (!c) {
        let p = ns(e, n), l = (a = (i = p.fatal) !== null && i !== void 0 ? i : r) !== null && a !== void 0 ? a : !0;
        s.addIssue({ code: "custom", ...p, fatal: l });
      }
    }) : te.create();
  }
  o(ds, "custom");
  d.custom = ds;
  d.late = {
    object: Z.lazycreate
  };
  var g;
  (function(t) {
    t.ZodString = "ZodString", t.ZodNumber = "ZodNumber", t.ZodNaN = "ZodNaN", t.ZodBigInt = "ZodBigInt", t.ZodBoolean = "ZodBoolean", t.ZodDate =
    "ZodDate", t.ZodSymbol = "ZodSymbol", t.ZodUndefined = "ZodUndefined", t.ZodNull = "ZodNull", t.ZodAny = "ZodAny", t.ZodUnknown = "ZodUn\
known", t.ZodNever = "ZodNever", t.ZodVoid = "ZodVoid", t.ZodArray = "ZodArray", t.ZodObject = "ZodObject", t.ZodUnion = "ZodUnion", t.ZodDiscriminatedUnion =
    "ZodDiscriminatedUnion", t.ZodIntersection = "ZodIntersection", t.ZodTuple = "ZodTuple", t.ZodRecord = "ZodRecord", t.ZodMap = "ZodMap",
    t.ZodSet = "ZodSet", t.ZodFunction = "ZodFunction", t.ZodLazy = "ZodLazy", t.ZodLiteral = "ZodLiteral", t.ZodEnum = "ZodEnum", t.ZodEffects =
    "ZodEffects", t.ZodNativeEnum = "ZodNativeEnum", t.ZodOptional = "ZodOptional", t.ZodNullable = "ZodNullable", t.ZodDefault = "ZodDefaul\
t", t.ZodCatch = "ZodCatch", t.ZodPromise = "ZodPromise", t.ZodBranded = "ZodBranded", t.ZodPipeline = "ZodPipeline", t.ZodReadonly = "ZodRe\
adonly";
  })(g || (d.ZodFirstPartyTypeKind = g = {}));
  var vc = /* @__PURE__ */ o((t, e = {
    message: `Input not instance of ${t.name}`
  }) => ds((r) => r instanceof t, e), "instanceOfType");
  d.instanceof = vc;
  var us = ee.create;
  d.string = us;
  var ls = ae.create;
  d.number = ls;
  var bc = Ae.create;
  d.nan = bc;
  var _c = ce.create;
  d.bigint = _c;
  var ps = de.create;
  d.boolean = ps;
  var wc = ue.create;
  d.date = wc;
  var kc = Ce.create;
  d.symbol = kc;
  var Tc = le.create;
  d.undefined = Tc;
  var Ic = pe.create;
  d.null = Ic;
  var Sc = te.create;
  d.any = Sc;
  var Cc = Y.create;
  d.unknown = Cc;
  var Pc = $.create;
  d.never = Pc;
  var Ec = Pe.create;
  d.void = Ec;
  var jc = X.create;
  d.array = jc;
  var Ac = Z.create;
  d.object = Ac;
  var Oc = Z.strictCreate;
  d.strictObject = Oc;
  var Zc = fe.create;
  d.union = Zc;
  var Nc = Pt.create;
  d.discriminatedUnion = Nc;
  var Rc = me.create;
  d.intersection = Rc;
  var Dc = G.create;
  d.tuple = Dc;
  var Lc = Et.create;
  d.record = Lc;
  var Mc = Ee.create;
  d.map = Mc;
  var Uc = je.create;
  d.set = Uc;
  var $c = jt.create;
  d.function = $c;
  var Vc = he.create;
  d.lazy = Vc;
  var Fc = ye.create;
  d.literal = Fc;
  var Bc = ge.create;
  d.enum = Bc;
  var qc = xe.create;
  d.nativeEnum = qc;
  var zc = re.create;
  d.promise = zc;
  var fs = R.create;
  d.effect = fs;
  d.transformer = fs;
  var Gc = L.create;
  d.optional = Gc;
  var Wc = W.create;
  d.nullable = Wc;
  var Jc = R.createWithPreprocess;
  d.preprocess = Jc;
  var Hc = Qe.create;
  d.pipeline = Hc;
  var Kc = /* @__PURE__ */ o(() => us().optional(), "ostring");
  d.ostring = Kc;
  var Yc = /* @__PURE__ */ o(() => ls().optional(), "onumber");
  d.onumber = Yc;
  var Xc = /* @__PURE__ */ o(() => ps().optional(), "oboolean");
  d.oboolean = Xc;
  d.coerce = {
    string: /* @__PURE__ */ o((t) => ee.create({ ...t, coerce: !0 }), "string"),
    number: /* @__PURE__ */ o((t) => ae.create({ ...t, coerce: !0 }), "number"),
    boolean: /* @__PURE__ */ o((t) => de.create({
      ...t,
      coerce: !0
    }), "boolean"),
    bigint: /* @__PURE__ */ o((t) => ce.create({ ...t, coerce: !0 }), "bigint"),
    date: /* @__PURE__ */ o((t) => ue.create({ ...t, coerce: !0 }), "date")
  };
  d.NEVER = u.INVALID;
});

// ../node_modules/zod/lib/external.js
var kr = S((U) => {
  "use strict";
  var Qc = U && U.__createBinding || (Object.create ? function(t, e, r, n) {
    n === void 0 && (n = r);
    var s = Object.getOwnPropertyDescriptor(e, r);
    (!s || ("get" in s ? !e.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: /* @__PURE__ */ o(function() {
      return e[r];
    }, "get") }), Object.defineProperty(t, n, s);
  } : function(t, e, r, n) {
    n === void 0 && (n = r), t[n] = e[r];
  }), Oe = U && U.__exportStar || function(t, e) {
    for (var r in t) r !== "default" && !Object.prototype.hasOwnProperty.call(e, r) && Qc(e, t, r);
  };
  Object.defineProperty(U, "__esModule", { value: !0 });
  Oe(Tt(), U);
  Oe(br(), U);
  Oe(Qn(), U);
  Oe(Je(), U);
  Oe(ms(), U);
  Oe(kt(), U);
});

// ../node_modules/zod/lib/index.js
var gs = S((N) => {
  "use strict";
  var hs = N && N.__createBinding || (Object.create ? function(t, e, r, n) {
    n === void 0 && (n = r);
    var s = Object.getOwnPropertyDescriptor(e, r);
    (!s || ("get" in s ? !e.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: /* @__PURE__ */ o(function() {
      return e[r];
    }, "get") }), Object.defineProperty(t, n, s);
  } : function(t, e, r, n) {
    n === void 0 && (n = r), t[n] = e[r];
  }), ed = N && N.__setModuleDefault || (Object.create ? function(t, e) {
    Object.defineProperty(t, "default", { enumerable: !0, value: e });
  } : function(t, e) {
    t.default = e;
  }), td = N && N.__importStar || function(t) {
    if (t && t.__esModule) return t;
    var e = {};
    if (t != null) for (var r in t) r !== "default" && Object.prototype.hasOwnProperty.call(t, r) && hs(e, t, r);
    return ed(e, t), e;
  }, rd = N && N.__exportStar || function(t, e) {
    for (var r in t) r !== "default" && !Object.prototype.hasOwnProperty.call(e, r) && hs(e, t, r);
  };
  Object.defineProperty(N, "__esModule", { value: !0 });
  N.z = void 0;
  var ys = td(kr());
  N.z = ys;
  rd(kr(), N);
  N.default = ys;
});

// ../node_modules/isexe/windows.js
var Is = S((cp, Ts) => {
  Ts.exports = ks;
  ks.sync = ad;
  var _s = require("fs");
  function od(t, e) {
    var r = e.pathExt !== void 0 ? e.pathExt : process.env.PATHEXT;
    if (!r || (r = r.split(";"), r.indexOf("") !== -1))
      return !0;
    for (var n = 0; n < r.length; n++) {
      var s = r[n].toLowerCase();
      if (s && t.substr(-s.length).toLowerCase() === s)
        return !0;
    }
    return !1;
  }
  o(od, "checkPathExt");
  function ws(t, e, r) {
    return !t.isSymbolicLink() && !t.isFile() ? !1 : od(e, r);
  }
  o(ws, "checkStat");
  function ks(t, e, r) {
    _s.stat(t, function(n, s) {
      r(n, n ? !1 : ws(s, t, e));
    });
  }
  o(ks, "isexe");
  function ad(t, e) {
    return ws(_s.statSync(t), t, e);
  }
  o(ad, "sync");
});

// ../node_modules/isexe/mode.js
var js = S((up, Es) => {
  Es.exports = Cs;
  Cs.sync = cd;
  var Ss = require("fs");
  function Cs(t, e, r) {
    Ss.stat(t, function(n, s) {
      r(n, n ? !1 : Ps(s, e));
    });
  }
  o(Cs, "isexe");
  function cd(t, e) {
    return Ps(Ss.statSync(t), e);
  }
  o(cd, "sync");
  function Ps(t, e) {
    return t.isFile() && dd(t, e);
  }
  o(Ps, "checkStat");
  function dd(t, e) {
    var r = t.mode, n = t.uid, s = t.gid, i = e.uid !== void 0 ? e.uid : process.getuid && process.getuid(), a = e.gid !== void 0 ? e.gid : process.
    getgid && process.getgid(), c = parseInt("100", 8), p = parseInt("010", 8), l = parseInt("001", 8), f = c | p, x = r & l || r & p && s ===
    a || r & c && n === i || r & f && i === 0;
    return x;
  }
  o(dd, "checkMode");
});

// ../node_modules/isexe/index.js
var Os = S((fp, As) => {
  var pp = require("fs"), Nt;
  process.platform === "win32" || global.TESTING_WINDOWS ? Nt = Is() : Nt = js();
  As.exports = Tr;
  Tr.sync = ud;
  function Tr(t, e, r) {
    if (typeof e == "function" && (r = e, e = {}), !r) {
      if (typeof Promise != "function")
        throw new TypeError("callback not provided");
      return new Promise(function(n, s) {
        Tr(t, e || {}, function(i, a) {
          i ? s(i) : n(a);
        });
      });
    }
    Nt(t, e || {}, function(n, s) {
      n && (n.code === "EACCES" || e && e.ignoreErrors) && (n = null, s = !1), r(n, s);
    });
  }
  o(Tr, "isexe");
  function ud(t, e) {
    try {
      return Nt.sync(t, e || {});
    } catch (r) {
      if (e && e.ignoreErrors || r.code === "EACCES")
        return !1;
      throw r;
    }
  }
  o(ud, "sync");
});

// ../node_modules/which/which.js
var Us = S((hp, Ms) => {
  var Re = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", Zs = require("path"), ld = Re ?
  ";" : ":", Ns = Os(), Rs = /* @__PURE__ */ o((t) => Object.assign(new Error(`not found: ${t}`), { code: "ENOENT" }), "getNotFoundError"), Ds = /* @__PURE__ */ o(
  (t, e) => {
    let r = e.colon || ld, n = t.match(/\//) || Re && t.match(/\\/) ? [""] : [
      // windows always checks the cwd first
      ...Re ? [process.cwd()] : [],
      ...(e.path || process.env.PATH || /* istanbul ignore next: very unusual */
      "").split(r)
    ], s = Re ? e.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", i = Re ? s.split(r) : [""];
    return Re && t.indexOf(".") !== -1 && i[0] !== "" && i.unshift(""), {
      pathEnv: n,
      pathExt: i,
      pathExtExe: s
    };
  }, "getPathInfo"), Ls = /* @__PURE__ */ o((t, e, r) => {
    typeof e == "function" && (r = e, e = {}), e || (e = {});
    let { pathEnv: n, pathExt: s, pathExtExe: i } = Ds(t, e), a = [], c = /* @__PURE__ */ o((l) => new Promise((f, x) => {
      if (l === n.length)
        return e.all && a.length ? f(a) : x(Rs(t));
      let w = n[l], _ = /^".*"$/.test(w) ? w.slice(1, -1) : w, E = Zs.join(_, t), C = !_ && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + E : E;
      f(p(C, l, 0));
    }), "step"), p = /* @__PURE__ */ o((l, f, x) => new Promise((w, _) => {
      if (x === s.length)
        return w(c(f + 1));
      let E = s[x];
      Ns(l + E, { pathExt: i }, (C, j) => {
        if (!C && j)
          if (e.all)
            a.push(l + E);
          else
            return w(l + E);
        return w(p(l, f, x + 1));
      });
    }), "subStep");
    return r ? c(0).then((l) => r(null, l), r) : c(0);
  }, "which"), pd = /* @__PURE__ */ o((t, e) => {
    e = e || {};
    let { pathEnv: r, pathExt: n, pathExtExe: s } = Ds(t, e), i = [];
    for (let a = 0; a < r.length; a++) {
      let c = r[a], p = /^".*"$/.test(c) ? c.slice(1, -1) : c, l = Zs.join(p, t), f = !p && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + l : l;
      for (let x = 0; x < n.length; x++) {
        let w = f + n[x];
        try {
          if (Ns.sync(w, { pathExt: s }))
            if (e.all)
              i.push(w);
            else
              return w;
        } catch {
        }
      }
    }
    if (e.all && i.length)
      return i;
    if (e.nothrow)
      return null;
    throw Rs(t);
  }, "whichSync");
  Ms.exports = Ls;
  Ls.sync = pd;
});

// ../node_modules/path-key/index.js
var Vs = S((gp, Ir) => {
  "use strict";
  var $s = /* @__PURE__ */ o((t = {}) => {
    let e = t.env || process.env;
    return (t.platform || process.platform) !== "win32" ? "PATH" : Object.keys(e).reverse().find((n) => n.toUpperCase() === "PATH") || "Path";
  }, "pathKey");
  Ir.exports = $s;
  Ir.exports.default = $s;
});

// ../node_modules/cross-spawn/lib/util/resolveCommand.js
var zs = S((vp, qs) => {
  "use strict";
  var Fs = require("path"), fd = Us(), md = Vs();
  function Bs(t, e) {
    let r = t.options.env || process.env, n = process.cwd(), s = t.options.cwd != null, i = s && process.chdir !== void 0 && !process.chdir.
    disabled;
    if (i)
      try {
        process.chdir(t.options.cwd);
      } catch {
      }
    let a;
    try {
      a = fd.sync(t.command, {
        path: r[md({ env: r })],
        pathExt: e ? Fs.delimiter : void 0
      });
    } catch {
    } finally {
      i && process.chdir(n);
    }
    return a && (a = Fs.resolve(s ? t.options.cwd : "", a)), a;
  }
  o(Bs, "resolveCommandAttempt");
  function hd(t) {
    return Bs(t) || Bs(t, !0);
  }
  o(hd, "resolveCommand");
  qs.exports = hd;
});

// ../node_modules/cross-spawn/lib/util/escape.js
var Gs = S((_p, Cr) => {
  "use strict";
  var Sr = /([()\][%!^"`<>&|;, *?])/g;
  function yd(t) {
    return t = t.replace(Sr, "^$1"), t;
  }
  o(yd, "escapeCommand");
  function gd(t, e) {
    return t = `${t}`, t = t.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"'), t = t.replace(/(?=(\\+?)?)\1$/, "$1$1"), t = `"${t}"`, t = t.replace(Sr,
    "^$1"), e && (t = t.replace(Sr, "^$1")), t;
  }
  o(gd, "escapeArgument");
  Cr.exports.command = yd;
  Cr.exports.argument = gd;
});

// ../node_modules/shebang-regex/index.js
var Js = S((kp, Ws) => {
  "use strict";
  Ws.exports = /^#!(.*)/;
});

// ../node_modules/shebang-command/index.js
var Ks = S((Tp, Hs) => {
  "use strict";
  var xd = Js();
  Hs.exports = (t = "") => {
    let e = t.match(xd);
    if (!e)
      return null;
    let [r, n] = e[0].replace(/#! ?/, "").split(" "), s = r.split("/").pop();
    return s === "env" ? n : n ? `${s} ${n}` : s;
  };
});

// ../node_modules/cross-spawn/lib/util/readShebang.js
var Xs = S((Ip, Ys) => {
  "use strict";
  var Pr = require("fs"), vd = Ks();
  function bd(t) {
    let r = Buffer.alloc(150), n;
    try {
      n = Pr.openSync(t, "r"), Pr.readSync(n, r, 0, 150, 0), Pr.closeSync(n);
    } catch {
    }
    return vd(r.toString());
  }
  o(bd, "readShebang");
  Ys.exports = bd;
});

// ../node_modules/cross-spawn/lib/parse.js
var ri = S((Cp, ti) => {
  "use strict";
  var _d = require("path"), Qs = zs(), ei = Gs(), wd = Xs(), kd = process.platform === "win32", Td = /\.(?:com|exe)$/i, Id = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function Sd(t) {
    t.file = Qs(t);
    let e = t.file && wd(t.file);
    return e ? (t.args.unshift(t.file), t.command = e, Qs(t)) : t.file;
  }
  o(Sd, "detectShebang");
  function Cd(t) {
    if (!kd)
      return t;
    let e = Sd(t), r = !Td.test(e);
    if (t.options.forceShell || r) {
      let n = Id.test(e);
      t.command = _d.normalize(t.command), t.command = ei.command(t.command), t.args = t.args.map((i) => ei.argument(i, n));
      let s = [t.command].concat(t.args).join(" ");
      t.args = ["/d", "/s", "/c", `"${s}"`], t.command = process.env.comspec || "cmd.exe", t.options.windowsVerbatimArguments = !0;
    }
    return t;
  }
  o(Cd, "parseNonShell");
  function Pd(t, e, r) {
    e && !Array.isArray(e) && (r = e, e = null), e = e ? e.slice(0) : [], r = Object.assign({}, r);
    let n = {
      command: t,
      args: e,
      options: r,
      file: void 0,
      original: {
        command: t,
        args: e
      }
    };
    return r.shell ? n : Cd(n);
  }
  o(Pd, "parse");
  ti.exports = Pd;
});

// ../node_modules/cross-spawn/lib/enoent.js
var ii = S((Ep, si) => {
  "use strict";
  var Er = process.platform === "win32";
  function jr(t, e) {
    return Object.assign(new Error(`${e} ${t.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${e} ${t.command}`,
      path: t.command,
      spawnargs: t.args
    });
  }
  o(jr, "notFoundError");
  function Ed(t, e) {
    if (!Er)
      return;
    let r = t.emit;
    t.emit = function(n, s) {
      if (n === "exit") {
        let i = ni(s, e);
        if (i)
          return r.call(t, "error", i);
      }
      return r.apply(t, arguments);
    };
  }
  o(Ed, "hookChildProcess");
  function ni(t, e) {
    return Er && t === 1 && !e.file ? jr(e.original, "spawn") : null;
  }
  o(ni, "verifyENOENT");
  function jd(t, e) {
    return Er && t === 1 && !e.file ? jr(e.original, "spawnSync") : null;
  }
  o(jd, "verifyENOENTSync");
  si.exports = {
    hookChildProcess: Ed,
    verifyENOENT: ni,
    verifyENOENTSync: jd,
    notFoundError: jr
  };
});

// ../node_modules/cross-spawn/index.js
var ci = S((Ap, De) => {
  "use strict";
  var oi = require("child_process"), Ar = ri(), Or = ii();
  function ai(t, e, r) {
    let n = Ar(t, e, r), s = oi.spawn(n.command, n.args, n.options);
    return Or.hookChildProcess(s, n), s;
  }
  o(ai, "spawn");
  function Ad(t, e, r) {
    let n = Ar(t, e, r), s = oi.spawnSync(n.command, n.args, n.options);
    return s.error = s.error || Or.verifyENOENTSync(s.status, n), s;
  }
  o(Ad, "spawnSync");
  De.exports = ai;
  De.exports.spawn = ai;
  De.exports.sync = Ad;
  De.exports._parse = Ar;
  De.exports._enoent = Or;
});

// ../node_modules/merge-stream/index.js
var $i = S((Hf, Ui) => {
  "use strict";
  var { PassThrough: ku } = require("stream");
  Ui.exports = function() {
    var t = [], e = new ku({ objectMode: !0 });
    return e.setMaxListeners(0), e.add = r, e.isEmpty = n, e.on("unpipe", s), Array.prototype.slice.call(arguments).forEach(r), e;
    function r(i) {
      return Array.isArray(i) ? (i.forEach(r), this) : (t.push(i), i.once("end", s.bind(null, i)), i.once("error", e.emit.bind(e, "error")),
      i.pipe(e, { end: !1 }), this);
    }
    o(r, "add");
    function n() {
      return t.length == 0;
    }
    o(n, "isEmpty");
    function s(i) {
      t = t.filter(function(a) {
        return a !== i;
      }), !t.length && e.readable && e.end();
    }
    o(s, "remove");
  };
});

// ../node_modules/slash/index.js
function sn(t) {
  return t.startsWith("\\\\?\\") ? t : t.replace(/\\/g, "/");
}
var mo = jn(() => {
  o(sn, "slash");
});

// ../node_modules/common-path-prefix/index.js
var go = S((Em, yo) => {
  "use strict";
  var { sep: Lu } = require("path"), Mu = /* @__PURE__ */ o((t) => {
    for (let e of t) {
      let r = /(\/|\\)/.exec(e);
      if (r !== null) return r[0];
    }
    return Lu;
  }, "determineSeparator");
  yo.exports = /* @__PURE__ */ o(function(e, r = Mu(e)) {
    let [n = "", ...s] = e;
    if (n === "" || s.length === 0) return "";
    let i = n.split(r), a = i.length;
    for (let p of s) {
      let l = p.split(r);
      for (let f = 0; f < a; f++)
        l[f] !== i[f] && (a = f);
      if (a === 0) return "";
    }
    let c = i.slice(0, a).join(r);
    return c.endsWith(r) ? c : c + r;
  }, "commonPathPrefix");
});

// ../node_modules/yocto-queue/index.js
var an, at, xo = jn(() => {
  an = class {
    static {
      o(this, "Node");
    }
    value;
    next;
    constructor(e) {
      this.value = e;
    }
  }, at = class {
    static {
      o(this, "Queue");
    }
    #r;
    #t;
    #e;
    constructor() {
      this.clear();
    }
    enqueue(e) {
      let r = new an(e);
      this.#r ? (this.#t.next = r, this.#t = r) : (this.#r = r, this.#t = r), this.#e++;
    }
    dequeue() {
      let e = this.#r;
      if (e)
        return this.#r = this.#r.next, this.#e--, e.value;
    }
    peek() {
      if (this.#r)
        return this.#r.value;
    }
    clear() {
      this.#r = void 0, this.#t = void 0, this.#e = 0;
    }
    get size() {
      return this.#e;
    }
    *[Symbol.iterator]() {
      let e = this.#r;
      for (; e; )
        yield e.value, e = e.next;
    }
    *drain() {
      for (; this.#r; )
        yield this.dequeue();
    }
  };
});

// ../node_modules/fetch-retry/index.js
var aa = S((fg, oa) => {
  "use strict";
  oa.exports = function(t, e) {
    if (e = e || {}, typeof t != "function")
      throw new se("fetch must be a function");
    if (typeof e != "object")
      throw new se("defaults must be an object");
    if (e.retries !== void 0 && !or(e.retries))
      throw new se("retries must be a positive integer");
    if (e.retryDelay !== void 0 && !or(e.retryDelay) && typeof e.retryDelay != "function")
      throw new se("retryDelay must be a positive integer or a function returning a positive integer");
    if (e.retryOn !== void 0 && !Array.isArray(e.retryOn) && typeof e.retryOn != "function")
      throw new se("retryOn property expects an array or function");
    var r = {
      retries: 3,
      retryDelay: 1e3,
      retryOn: []
    };
    return e = Object.assign(r, e), /* @__PURE__ */ o(function(s, i) {
      var a = e.retries, c = e.retryDelay, p = e.retryOn;
      if (i && i.retries !== void 0)
        if (or(i.retries))
          a = i.retries;
        else
          throw new se("retries must be a positive integer");
      if (i && i.retryDelay !== void 0)
        if (or(i.retryDelay) || typeof i.retryDelay == "function")
          c = i.retryDelay;
        else
          throw new se("retryDelay must be a positive integer or a function returning a positive integer");
      if (i && i.retryOn)
        if (Array.isArray(i.retryOn) || typeof i.retryOn == "function")
          p = i.retryOn;
        else
          throw new se("retryOn property expects an array or function");
      return new Promise(function(l, f) {
        var x = /* @__PURE__ */ o(function(_) {
          var E = typeof Request < "u" && s instanceof Request ? s.clone() : s;
          t(E, i).then(function(C) {
            if (Array.isArray(p) && p.indexOf(C.status) === -1)
              l(C);
            else if (typeof p == "function")
              try {
                return Promise.resolve(p(_, null, C)).then(function(j) {
                  j ? w(_, null, C) : l(C);
                }).catch(f);
              } catch (j) {
                f(j);
              }
            else
              _ < a ? w(_, null, C) : l(C);
          }).catch(function(C) {
            if (typeof p == "function")
              try {
                Promise.resolve(p(_, C, null)).then(function(j) {
                  j ? w(_, C, null) : f(C);
                }).catch(function(j) {
                  f(j);
                });
              } catch (j) {
                f(j);
              }
            else _ < a ? w(_, C, null) : f(C);
          });
        }, "wrappedFetch");
        function w(_, E, C) {
          var j = typeof c == "function" ? c(_, E, C) : c;
          setTimeout(function() {
            x(++_);
          }, j);
        }
        o(w, "retry"), x(0);
      });
    }, "fetchRetry");
  };
  function or(t) {
    return Number.isInteger(t) && t >= 0;
  }
  o(or, "isPositiveInteger");
  function se(t) {
    this.name = "ArgumentError", this.message = t;
  }
  o(se, "ArgumentError");
});

// src/telemetry/index.ts
var Cl = {};
Pa(Cl, {
  addToGlobalContext: () => _a,
  cleanPaths: () => Ie,
  computeStorybookMetadata: () => ia,
  getPrecedingUpgrade: () => ya,
  getStorybookMetadata: () => kn,
  isExampleStoryId: () => Il,
  metaFrameworks: () => _n,
  oneWayHash: () => ar,
  removeAnsiEscapeCodes: () => fr,
  sanitizeAddonName: () => wn,
  sanitizeError: () => Ge,
  telemetry: () => Sl
});
module.exports = Ea(Cl);
var En = require("storybook/internal/node-logger");

// src/telemetry/notify.ts
var pr = require("storybook/internal/common"), ie = require("storybook/internal/node-logger"), Dn = T(Nn(), 1);
var Rn = "telemetry-notification-date", Ln = /* @__PURE__ */ o(async () => {
  await pr.cache.get(Rn, null) || (pr.cache.set(Rn, Date.now()), ie.logger.log(
    `${ie.CLI_COLORS.info("Attention:")} Storybook now collects completely anonymous telemetry regarding usage. This information is used to \
shape Storybook's roadmap and prioritize features.`
  ), ie.logger.log(
    "You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:"
  ), ie.logger.log(Dn.default.cyan("https://storybook.js.org/telemetry")), ie.logger.log(""));
}, "notify");

// src/telemetry/sanitize.ts
var mr = T(require("node:path"), 1);
function Mn(t) {
  return t.replace(/[-[/{}()*+?.\\^$|]/g, "\\$&");
}
o(Mn, "regexpEscape");
function fr(t = "") {
  return t.replace(/\u001B\[[0-9;]*m/g, "");
}
o(fr, "removeAnsiEscapeCodes");
function Ie(t, e = mr.default.sep) {
  if (!t)
    return t;
  let r = process.cwd().split(e);
  for (; r.length > 1; ) {
    let n = r.join(e), s = new RegExp(Mn(n), "gi");
    t = t.replace(s, "$SNIP");
    let i = r.join(e + e), a = new RegExp(Mn(i), "gi");
    t = t.replace(a, "$SNIP"), r.pop();
  }
  return t;
}
o(Ie, "cleanPaths");
function Ge(t, e = mr.default.sep) {
  try {
    t = {
      ...JSON.parse(JSON.stringify(t)),
      message: fr(t.message),
      stack: fr(t.stack),
      cause: t.cause,
      name: t.name
    };
    let r = Ie(JSON.stringify(t), e);
    return JSON.parse(r);
  } catch (r) {
    return `Sanitization error: ${r?.message}`;
  }
}
o(Ge, "sanitizeError");

// src/telemetry/storybook-metadata.ts
var na = require("node:path"), H = require("storybook/internal/common"), sa = require("storybook/internal/csf-tools");

// ../node_modules/fd-package-json/dist/esm/main.js
var Vn = T($n(), 1), Fn = require("node:path"), _t = require("node:fs/promises"), Bn = require("node:fs");
async function Na(t) {
  try {
    return (await (0, _t.stat)(t)).isFile();
  } catch {
    return !1;
  }
}
o(Na, "fileExists");
async function hr(t) {
  for (let e of (0, Vn.walkUp)(t)) {
    let r = (0, Fn.resolve)(e, "package.json");
    if (await Na(r))
      return r;
  }
  return null;
}
o(hr, "findPackagePath");
async function qn(t) {
  let e = await hr(t);
  if (!e)
    return null;
  try {
    let r = await (0, _t.readFile)(e, { encoding: "utf8" });
    return JSON.parse(r);
  } catch {
    return null;
  }
}
o(qn, "findPackage");

// package.json
var wt = "9.1.13";

// src/cli/globalSettings.ts
var At = T(require("node:fs/promises"), 1), xs = require("node:os"), Zt = require("node:path"), vs = T(Gn(), 1), Ne = T(gs(), 1);
var nd = (0, Zt.join)((0, xs.homedir)(), ".storybook", "settings.json"), sd = 1, id = Ne.z.object({
  version: Ne.z.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: Ne.z.number().optional(),
  init: Ne.z.object({ skipOnboarding: Ne.z.boolean().optional() }).optional()
}), Ze;
async function bs(t = nd) {
  if (Ze)
    return Ze;
  try {
    let e = await At.default.readFile(t, "utf8"), r = id.parse(JSON.parse(e));
    Ze = new Ot(t, r);
  } catch {
    Ze = new Ot(t, { version: sd, userSince: Date.now() }), await Ze.save();
  }
  return Ze;
}
o(bs, "globalSettings");
var Ot = class {
  static {
    o(this, "Settings");
  }
  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   * @param value Loaded value of settings
   */
  constructor(e, r) {
    this.filePath = e, this.value = r;
  }
  /** Save settings to the file */
  async save() {
    try {
      await At.default.mkdir((0, Zt.dirname)(this.filePath), { recursive: !0 }), await At.default.writeFile(this.filePath, JSON.stringify(this.
      value, null, 2));
    } catch (e) {
      console.warn(vs.dedent`
        Unable to save global settings file to ${this.filePath}
        ${e && `Reason: ${e.message ?? e}`}`);
    }
  }
};

// src/telemetry/get-application-file-count.ts
var $o = require("node:path");

// src/telemetry/exec-command-count-lines.ts
var fo = require("node:readline");

// node_modules/execa/index.js
var oo = require("node:buffer"), ao = T(require("node:path"), 1), Jt = T(require("node:child_process"), 1), nt = T(require("node:process"), 1),
co = T(ci(), 1);

// ../node_modules/strip-final-newline/index.js
function Zr(t) {
  let e = typeof t == "string" ? `
` : 10, r = typeof t == "string" ? "\r" : 13;
  return t[t.length - 1] === e && (t = t.slice(0, -1)), t[t.length - 1] === r && (t = t.slice(0, -1)), t;
}
o(Zr, "stripFinalNewline");

// node_modules/npm-run-path/index.js
var et = T(require("node:process"), 1), Le = T(require("node:path"), 1), Nr = require("node:url");

// node_modules/path-key/index.js
function Rt(t = {}) {
  let {
    env: e = process.env,
    platform: r = process.platform
  } = t;
  return r !== "win32" ? "PATH" : Object.keys(e).reverse().find((n) => n.toUpperCase() === "PATH") || "Path";
}
o(Rt, "pathKey");

// node_modules/npm-run-path/index.js
var Od = /* @__PURE__ */ o(({
  cwd: t = et.default.cwd(),
  path: e = et.default.env[Rt()],
  preferLocal: r = !0,
  execPath: n = et.default.execPath,
  addExecPath: s = !0
} = {}) => {
  let i = t instanceof URL ? (0, Nr.fileURLToPath)(t) : t, a = Le.default.resolve(i), c = [];
  return r && Zd(c, a), s && Nd(c, n, a), [...c, e].join(Le.default.delimiter);
}, "npmRunPath"), Zd = /* @__PURE__ */ o((t, e) => {
  let r;
  for (; r !== e; )
    t.push(Le.default.join(e, "node_modules/.bin")), r = e, e = Le.default.resolve(e, "..");
}, "applyPreferLocal"), Nd = /* @__PURE__ */ o((t, e, r) => {
  let n = e instanceof URL ? (0, Nr.fileURLToPath)(e) : e;
  t.push(Le.default.resolve(r, n, ".."));
}, "applyExecPath"), di = /* @__PURE__ */ o(({ env: t = et.default.env, ...e } = {}) => {
  t = { ...t };
  let r = Rt({ env: t });
  return e.path = t[r], t[r] = Od(e), t;
}, "npmRunPathEnv");

// node_modules/mimic-fn/index.js
var Rd = /* @__PURE__ */ o((t, e, r, n) => {
  if (r === "length" || r === "prototype" || r === "arguments" || r === "caller")
    return;
  let s = Object.getOwnPropertyDescriptor(t, r), i = Object.getOwnPropertyDescriptor(e, r);
  !Dd(s, i) && n || Object.defineProperty(t, r, i);
}, "copyProperty"), Dd = /* @__PURE__ */ o(function(t, e) {
  return t === void 0 || t.configurable || t.writable === e.writable && t.enumerable === e.enumerable && t.configurable === e.configurable &&
  (t.writable || t.value === e.value);
}, "canCopyProperty"), Ld = /* @__PURE__ */ o((t, e) => {
  let r = Object.getPrototypeOf(e);
  r !== Object.getPrototypeOf(t) && Object.setPrototypeOf(t, r);
}, "changePrototype"), Md = /* @__PURE__ */ o((t, e) => `/* Wrapped ${t}*/
${e}`, "wrappedToString"), Ud = Object.getOwnPropertyDescriptor(Function.prototype, "toString"), $d = Object.getOwnPropertyDescriptor(Function.
prototype.toString, "name"), Vd = /* @__PURE__ */ o((t, e, r) => {
  let n = r === "" ? "" : `with ${r.trim()}() `, s = Md.bind(null, n, e.toString());
  Object.defineProperty(s, "name", $d), Object.defineProperty(t, "toString", { ...Ud, value: s });
}, "changeToString");
function Rr(t, e, { ignoreNonConfigurable: r = !1 } = {}) {
  let { name: n } = t;
  for (let s of Reflect.ownKeys(e))
    Rd(t, e, s, r);
  return Ld(t, e), Vd(t, e, n), t;
}
o(Rr, "mimicFunction");

// node_modules/onetime/index.js
var Dt = /* @__PURE__ */ new WeakMap(), ui = /* @__PURE__ */ o((t, e = {}) => {
  if (typeof t != "function")
    throw new TypeError("Expected a function");
  let r, n = 0, s = t.displayName || t.name || "<anonymous>", i = /* @__PURE__ */ o(function(...a) {
    if (Dt.set(i, ++n), n === 1)
      r = t.apply(this, a), t = null;
    else if (e.throw === !0)
      throw new Error(`Function \`${s}\` can only be called once`);
    return r;
  }, "onetime");
  return Rr(i, t), Dt.set(i, n), i;
}, "onetime");
ui.callCount = (t) => {
  if (!Dt.has(t))
    throw new Error(`The given function \`${t.name}\` is not wrapped by the \`onetime\` package`);
  return Dt.get(t);
};
var li = ui;

// node_modules/execa/lib/error.js
var xi = T(require("node:process"), 1);

// node_modules/human-signals/build/src/main.js
var yi = require("node:os");

// node_modules/human-signals/build/src/realtime.js
var pi = /* @__PURE__ */ o(() => {
  let t = Dr - fi + 1;
  return Array.from({ length: t }, Fd);
}, "getRealtimeSignals"), Fd = /* @__PURE__ */ o((t, e) => ({
  name: `SIGRT${e + 1}`,
  number: fi + e,
  action: "terminate",
  description: "Application-specific signal (realtime)",
  standard: "posix"
}), "getRealtimeSignal"), fi = 34, Dr = 64;

// node_modules/human-signals/build/src/signals.js
var hi = require("node:os");

// node_modules/human-signals/build/src/core.js
var mi = [
  {
    name: "SIGHUP",
    number: 1,
    action: "terminate",
    description: "Terminal closed",
    standard: "posix"
  },
  {
    name: "SIGINT",
    number: 2,
    action: "terminate",
    description: "User interruption with CTRL-C",
    standard: "ansi"
  },
  {
    name: "SIGQUIT",
    number: 3,
    action: "core",
    description: "User interruption with CTRL-\\",
    standard: "posix"
  },
  {
    name: "SIGILL",
    number: 4,
    action: "core",
    description: "Invalid machine instruction",
    standard: "ansi"
  },
  {
    name: "SIGTRAP",
    number: 5,
    action: "core",
    description: "Debugger breakpoint",
    standard: "posix"
  },
  {
    name: "SIGABRT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "ansi"
  },
  {
    name: "SIGIOT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "bsd"
  },
  {
    name: "SIGBUS",
    number: 7,
    action: "core",
    description: "Bus error due to misaligned, non-existing address or paging error",
    standard: "bsd"
  },
  {
    name: "SIGEMT",
    number: 7,
    action: "terminate",
    description: "Command should be emulated but is not implemented",
    standard: "other"
  },
  {
    name: "SIGFPE",
    number: 8,
    action: "core",
    description: "Floating point arithmetic error",
    standard: "ansi"
  },
  {
    name: "SIGKILL",
    number: 9,
    action: "terminate",
    description: "Forced termination",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGUSR1",
    number: 10,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGSEGV",
    number: 11,
    action: "core",
    description: "Segmentation fault",
    standard: "ansi"
  },
  {
    name: "SIGUSR2",
    number: 12,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGPIPE",
    number: 13,
    action: "terminate",
    description: "Broken pipe or socket",
    standard: "posix"
  },
  {
    name: "SIGALRM",
    number: 14,
    action: "terminate",
    description: "Timeout or timer",
    standard: "posix"
  },
  {
    name: "SIGTERM",
    number: 15,
    action: "terminate",
    description: "Termination",
    standard: "ansi"
  },
  {
    name: "SIGSTKFLT",
    number: 16,
    action: "terminate",
    description: "Stack is empty or overflowed",
    standard: "other"
  },
  {
    name: "SIGCHLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "posix"
  },
  {
    name: "SIGCLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "other"
  },
  {
    name: "SIGCONT",
    number: 18,
    action: "unpause",
    description: "Unpaused",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGSTOP",
    number: 19,
    action: "pause",
    description: "Paused",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGTSTP",
    number: 20,
    action: "pause",
    description: 'Paused using CTRL-Z or "suspend"',
    standard: "posix"
  },
  {
    name: "SIGTTIN",
    number: 21,
    action: "pause",
    description: "Background process cannot read terminal input",
    standard: "posix"
  },
  {
    name: "SIGBREAK",
    number: 21,
    action: "terminate",
    description: "User interruption with CTRL-BREAK",
    standard: "other"
  },
  {
    name: "SIGTTOU",
    number: 22,
    action: "pause",
    description: "Background process cannot write to terminal output",
    standard: "posix"
  },
  {
    name: "SIGURG",
    number: 23,
    action: "ignore",
    description: "Socket received out-of-band data",
    standard: "bsd"
  },
  {
    name: "SIGXCPU",
    number: 24,
    action: "core",
    description: "Process timed out",
    standard: "bsd"
  },
  {
    name: "SIGXFSZ",
    number: 25,
    action: "core",
    description: "File too big",
    standard: "bsd"
  },
  {
    name: "SIGVTALRM",
    number: 26,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGPROF",
    number: 27,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGWINCH",
    number: 28,
    action: "ignore",
    description: "Terminal window size changed",
    standard: "bsd"
  },
  {
    name: "SIGIO",
    number: 29,
    action: "terminate",
    description: "I/O is available",
    standard: "other"
  },
  {
    name: "SIGPOLL",
    number: 29,
    action: "terminate",
    description: "Watched event",
    standard: "other"
  },
  {
    name: "SIGINFO",
    number: 29,
    action: "ignore",
    description: "Request for process information",
    standard: "other"
  },
  {
    name: "SIGPWR",
    number: 30,
    action: "terminate",
    description: "Device running out of power",
    standard: "systemv"
  },
  {
    name: "SIGSYS",
    number: 31,
    action: "core",
    description: "Invalid system call",
    standard: "other"
  },
  {
    name: "SIGUNUSED",
    number: 31,
    action: "terminate",
    description: "Invalid system call",
    standard: "other"
  }
];

// node_modules/human-signals/build/src/signals.js
var Lr = /* @__PURE__ */ o(() => {
  let t = pi();
  return [...mi, ...t].map(Bd);
}, "getSignals"), Bd = /* @__PURE__ */ o(({
  name: t,
  number: e,
  description: r,
  action: n,
  forced: s = !1,
  standard: i
}) => {
  let {
    signals: { [t]: a }
  } = hi.constants, c = a !== void 0;
  return { name: t, number: c ? a : e, description: r, supported: c, action: n, forced: s, standard: i };
}, "normalizeSignal");

// node_modules/human-signals/build/src/main.js
var qd = /* @__PURE__ */ o(() => {
  let t = Lr();
  return Object.fromEntries(t.map(zd));
}, "getSignalsByName"), zd = /* @__PURE__ */ o(({
  name: t,
  number: e,
  description: r,
  supported: n,
  action: s,
  forced: i,
  standard: a
}) => [t, { name: t, number: e, description: r, supported: n, action: s, forced: i, standard: a }], "getSignalByName"), gi = qd(), Gd = /* @__PURE__ */ o(
() => {
  let t = Lr(), e = Dr + 1, r = Array.from(
    { length: e },
    (n, s) => Wd(s, t)
  );
  return Object.assign({}, ...r);
}, "getSignalsByNumber"), Wd = /* @__PURE__ */ o((t, e) => {
  let r = Jd(t, e);
  if (r === void 0)
    return {};
  let { name: n, description: s, supported: i, action: a, forced: c, standard: p } = r;
  return {
    [t]: {
      name: n,
      number: t,
      description: s,
      supported: i,
      action: a,
      forced: c,
      standard: p
    }
  };
}, "getSignalByNumber"), Jd = /* @__PURE__ */ o((t, e) => {
  let r = e.find(({ name: n }) => yi.constants.signals[n] === t);
  return r !== void 0 ? r : e.find((n) => n.number === t);
}, "findSignalByNumber"), ef = Gd();

// node_modules/execa/lib/error.js
var Hd = /* @__PURE__ */ o(({ timedOut: t, timeout: e, errorCode: r, signal: n, signalDescription: s, exitCode: i, isCanceled: a }) => t ? `\
timed out after ${e} milliseconds` : a ? "was canceled" : r !== void 0 ? `failed with ${r}` : n !== void 0 ? `was killed with ${n} (${s})` :
i !== void 0 ? `failed with exit code ${i}` : "failed", "getErrorPrefix"), tt = /* @__PURE__ */ o(({
  stdout: t,
  stderr: e,
  all: r,
  error: n,
  signal: s,
  exitCode: i,
  command: a,
  escapedCommand: c,
  timedOut: p,
  isCanceled: l,
  killed: f,
  parsed: { options: { timeout: x, cwd: w = xi.default.cwd() } }
}) => {
  i = i === null ? void 0 : i, s = s === null ? void 0 : s;
  let _ = s === void 0 ? void 0 : gi[s].description, E = n && n.code, j = `Command ${Hd({ timedOut: p, timeout: x, errorCode: E, signal: s, signalDescription: _,
  exitCode: i, isCanceled: l })}: ${a}`, q = Object.prototype.toString.call(n) === "[object Error]", Be = q ? `${j}
${n.message}` : j, Te = [Be, e, t].filter(Boolean).join(`
`);
  return q ? (n.originalMessage = n.message, n.message = Te) : n = new Error(Te), n.shortMessage = Be, n.command = a, n.escapedCommand = c, n.
  exitCode = i, n.signal = s, n.signalDescription = _, n.stdout = t, n.stderr = e, n.cwd = w, r !== void 0 && (n.all = r), "bufferedData" in
  n && delete n.bufferedData, n.failed = !0, n.timedOut = !!p, n.isCanceled = l, n.killed = f && !p, n;
}, "makeError");

// node_modules/execa/lib/stdio.js
var Lt = ["stdin", "stdout", "stderr"], Kd = /* @__PURE__ */ o((t) => Lt.some((e) => t[e] !== void 0), "hasAlias"), vi = /* @__PURE__ */ o((t) => {
  if (!t)
    return;
  let { stdio: e } = t;
  if (e === void 0)
    return Lt.map((n) => t[n]);
  if (Kd(t))
    throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${Lt.map((n) => `\`${n}\``).join(", ")}`);
  if (typeof e == "string")
    return e;
  if (!Array.isArray(e))
    throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof e}\``);
  let r = Math.max(e.length, Lt.length);
  return Array.from({ length: r }, (n, s) => e[s]);
}, "normalizeStdio");

// node_modules/execa/lib/kill.js
var _i = T(require("node:os"), 1);

// node_modules/signal-exit/dist/mjs/signals.js
var we = [];
we.push("SIGHUP", "SIGINT", "SIGTERM");
process.platform !== "win32" && we.push(
  "SIGALRM",
  "SIGABRT",
  "SIGVTALRM",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGUSR2",
  "SIGTRAP",
  "SIGSYS",
  "SIGQUIT",
  "SIGIOT"
  // should detect profiler and enable/disable accordingly.
  // see #21
  // 'SIGPROF'
);
process.platform === "linux" && we.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");

// node_modules/signal-exit/dist/mjs/index.js
var Mt = /* @__PURE__ */ o((t) => !!t && typeof t == "object" && typeof t.removeListener == "function" && typeof t.emit == "function" && typeof t.
reallyExit == "function" && typeof t.listeners == "function" && typeof t.kill == "function" && typeof t.pid == "number" && typeof t.on == "f\
unction", "processOk"), Mr = Symbol.for("signal-exit emitter"), Ur = globalThis, Yd = Object.defineProperty.bind(Object), $r = class {
  static {
    o(this, "Emitter");
  }
  emitted = {
    afterExit: !1,
    exit: !1
  };
  listeners = {
    afterExit: [],
    exit: []
  };
  count = 0;
  id = Math.random();
  constructor() {
    if (Ur[Mr])
      return Ur[Mr];
    Yd(Ur, Mr, {
      value: this,
      writable: !1,
      enumerable: !1,
      configurable: !1
    });
  }
  on(e, r) {
    this.listeners[e].push(r);
  }
  removeListener(e, r) {
    let n = this.listeners[e], s = n.indexOf(r);
    s !== -1 && (s === 0 && n.length === 1 ? n.length = 0 : n.splice(s, 1));
  }
  emit(e, r, n) {
    if (this.emitted[e])
      return !1;
    this.emitted[e] = !0;
    let s = !1;
    for (let i of this.listeners[e])
      s = i(r, n) === !0 || s;
    return e === "exit" && (s = this.emit("afterExit", r, n) || s), s;
  }
}, Ut = class {
  static {
    o(this, "SignalExitBase");
  }
}, Xd = /* @__PURE__ */ o((t) => ({
  onExit(e, r) {
    return t.onExit(e, r);
  },
  load() {
    return t.load();
  },
  unload() {
    return t.unload();
  }
}), "signalExitWrap"), Vr = class extends Ut {
  static {
    o(this, "SignalExitFallback");
  }
  onExit() {
    return () => {
    };
  }
  load() {
  }
  unload() {
  }
}, Fr = class extends Ut {
  static {
    o(this, "SignalExit");
  }
  // "SIGHUP" throws an `ENOSYS` error on Windows,
  // so use a supported signal instead
  /* c8 ignore start */
  #r = Br.platform === "win32" ? "SIGINT" : "SIGHUP";
  /* c8 ignore stop */
  #t = new $r();
  #e;
  #i;
  #o;
  #s = {};
  #n = !1;
  constructor(e) {
    super(), this.#e = e, this.#s = {};
    for (let r of we)
      this.#s[r] = () => {
        let n = this.#e.listeners(r), { count: s } = this.#t, i = e;
        if (typeof i.__signal_exit_emitter__ == "object" && typeof i.__signal_exit_emitter__.count == "number" && (s += i.__signal_exit_emitter__.
        count), n.length === s) {
          this.unload();
          let a = this.#t.emit("exit", null, r), c = r === "SIGHUP" ? this.#r : r;
          a || e.kill(e.pid, c);
        }
      };
    this.#o = e.reallyExit, this.#i = e.emit;
  }
  onExit(e, r) {
    if (!Mt(this.#e))
      return () => {
      };
    this.#n === !1 && this.load();
    let n = r?.alwaysLast ? "afterExit" : "exit";
    return this.#t.on(n, e), () => {
      this.#t.removeListener(n, e), this.#t.listeners.exit.length === 0 && this.#t.listeners.afterExit.length === 0 && this.unload();
    };
  }
  load() {
    if (!this.#n) {
      this.#n = !0, this.#t.count += 1;
      for (let e of we)
        try {
          let r = this.#s[e];
          r && this.#e.on(e, r);
        } catch {
        }
      this.#e.emit = (e, ...r) => this.#c(e, ...r), this.#e.reallyExit = (e) => this.#a(e);
    }
  }
  unload() {
    this.#n && (this.#n = !1, we.forEach((e) => {
      let r = this.#s[e];
      if (!r)
        throw new Error("Listener not defined for signal: " + e);
      try {
        this.#e.removeListener(e, r);
      } catch {
      }
    }), this.#e.emit = this.#i, this.#e.reallyExit = this.#o, this.#t.count -= 1);
  }
  #a(e) {
    return Mt(this.#e) ? (this.#e.exitCode = e || 0, this.#t.emit("exit", this.#e.exitCode, null), this.#o.call(this.#e, this.#e.exitCode)) :
    0;
  }
  #c(e, ...r) {
    let n = this.#i;
    if (e === "exit" && Mt(this.#e)) {
      typeof r[0] == "number" && (this.#e.exitCode = r[0]);
      let s = n.call(this.#e, e, ...r);
      return this.#t.emit("exit", this.#e.exitCode, null), s;
    } else
      return n.call(this.#e, e, ...r);
  }
}, Br = globalThis.process, {
  /**
   * Called when the process is exiting, whether via signal, explicit
   * exit, or running out of stuff to do.
   *
   * If the global process object is not suitable for instrumentation,
   * then this will be a no-op.
   *
   * Returns a function that may be used to unload signal-exit.
   */
  onExit: bi,
  /**
   * Load the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  load: lf,
  /**
   * Unload the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  unload: pf
} = Xd(Mt(Br) ? new Fr(Br) : new Vr());

// node_modules/execa/lib/kill.js
var Qd = 1e3 * 5, wi = /* @__PURE__ */ o((t, e = "SIGTERM", r = {}) => {
  let n = t(e);
  return eu(t, e, r, n), n;
}, "spawnedKill"), eu = /* @__PURE__ */ o((t, e, r, n) => {
  if (!tu(e, r, n))
    return;
  let s = nu(r), i = setTimeout(() => {
    t("SIGKILL");
  }, s);
  i.unref && i.unref();
}, "setKillTimeout"), tu = /* @__PURE__ */ o((t, { forceKillAfterTimeout: e }, r) => ru(t) && e !== !1 && r, "shouldForceKill"), ru = /* @__PURE__ */ o(
(t) => t === _i.default.constants.signals.SIGTERM || typeof t == "string" && t.toUpperCase() === "SIGTERM", "isSigterm"), nu = /* @__PURE__ */ o(
({ forceKillAfterTimeout: t = !0 }) => {
  if (t === !0)
    return Qd;
  if (!Number.isFinite(t) || t < 0)
    throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
  return t;
}, "getForceKillAfterTimeout"), ki = /* @__PURE__ */ o((t, e) => {
  t.kill() && (e.isCanceled = !0);
}, "spawnedCancel"), su = /* @__PURE__ */ o((t, e, r) => {
  t.kill(e), r(Object.assign(new Error("Timed out"), { timedOut: !0, signal: e }));
}, "timeoutKill"), Ti = /* @__PURE__ */ o((t, { timeout: e, killSignal: r = "SIGTERM" }, n) => {
  if (e === 0 || e === void 0)
    return n;
  let s, i = new Promise((c, p) => {
    s = setTimeout(() => {
      su(t, r, p);
    }, e);
  }), a = n.finally(() => {
    clearTimeout(s);
  });
  return Promise.race([i, a]);
}, "setupTimeout"), Ii = /* @__PURE__ */ o(({ timeout: t }) => {
  if (t !== void 0 && (!Number.isFinite(t) || t < 0))
    throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
}, "validateTimeout"), Si = /* @__PURE__ */ o(async (t, { cleanup: e, detached: r }, n) => {
  if (!e || r)
    return n;
  let s = bi(() => {
    t.kill();
  });
  return n.finally(() => {
    s();
  });
}, "setExitHandler");

// node_modules/execa/lib/pipe.js
var Ci = require("node:fs"), Pi = require("node:child_process");

// node_modules/is-stream/index.js
function $t(t) {
  return t !== null && typeof t == "object" && typeof t.pipe == "function";
}
o($t, "isStream");
function qr(t) {
  return $t(t) && t.writable !== !1 && typeof t._write == "function" && typeof t._writableState == "object";
}
o(qr, "isWritableStream");

// node_modules/execa/lib/pipe.js
var iu = /* @__PURE__ */ o((t) => t instanceof Pi.ChildProcess && typeof t.then == "function", "isExecaChildProcess"), zr = /* @__PURE__ */ o(
(t, e, r) => {
  if (typeof r == "string")
    return t[e].pipe((0, Ci.createWriteStream)(r)), t;
  if (qr(r))
    return t[e].pipe(r), t;
  if (!iu(r))
    throw new TypeError("The second argument must be a string, a stream or an Execa child process.");
  if (!qr(r.stdin))
    throw new TypeError("The target child process's stdin must be available.");
  return t[e].pipe(r.stdin), r;
}, "pipeToTarget"), Ei = /* @__PURE__ */ o((t) => {
  t.stdout !== null && (t.pipeStdout = zr.bind(void 0, t, "stdout")), t.stderr !== null && (t.pipeStderr = zr.bind(void 0, t, "stderr")), t.
  all !== void 0 && (t.pipeAll = zr.bind(void 0, t, "all"));
}, "addPipeMethods");

// node_modules/execa/lib/stream.js
var Gt = require("node:fs"), Vi = require("node:timers/promises");

// node_modules/get-stream/source/contents.js
var rt = /* @__PURE__ */ o(async (t, { init: e, convertChunk: r, getSize: n, truncateChunk: s, addChunk: i, getFinalChunk: a, finalize: c }, {
maxBuffer: p = Number.POSITIVE_INFINITY } = {}) => {
  if (!au(t))
    throw new Error("The first argument must be a Readable, a ReadableStream, or an async iterable.");
  let l = e();
  l.length = 0;
  try {
    for await (let f of t) {
      let x = cu(f), w = r[x](f, l);
      Oi({ convertedChunk: w, state: l, getSize: n, truncateChunk: s, addChunk: i, maxBuffer: p });
    }
    return ou({ state: l, convertChunk: r, getSize: n, truncateChunk: s, addChunk: i, getFinalChunk: a, maxBuffer: p }), c(l);
  } catch (f) {
    throw f.bufferedData = c(l), f;
  }
}, "getStreamContents"), ou = /* @__PURE__ */ o(({ state: t, getSize: e, truncateChunk: r, addChunk: n, getFinalChunk: s, maxBuffer: i }) => {
  let a = s(t);
  a !== void 0 && Oi({ convertedChunk: a, state: t, getSize: e, truncateChunk: r, addChunk: n, maxBuffer: i });
}, "appendFinalChunk"), Oi = /* @__PURE__ */ o(({ convertedChunk: t, state: e, getSize: r, truncateChunk: n, addChunk: s, maxBuffer: i }) => {
  let a = r(t), c = e.length + a;
  if (c <= i) {
    ji(t, e, s, c);
    return;
  }
  let p = n(t, i - e.length);
  throw p !== void 0 && ji(p, e, s, i), new Vt();
}, "appendChunk"), ji = /* @__PURE__ */ o((t, e, r, n) => {
  e.contents = r(t, e, n), e.length = n;
}, "addNewChunk"), au = /* @__PURE__ */ o((t) => typeof t == "object" && t !== null && typeof t[Symbol.asyncIterator] == "function", "isAsyn\
cIterable"), cu = /* @__PURE__ */ o((t) => {
  let e = typeof t;
  if (e === "string")
    return "string";
  if (e !== "object" || t === null)
    return "others";
  if (globalThis.Buffer?.isBuffer(t))
    return "buffer";
  let r = Ai.call(t);
  return r === "[object ArrayBuffer]" ? "arrayBuffer" : r === "[object DataView]" ? "dataView" : Number.isInteger(t.byteLength) && Number.isInteger(
  t.byteOffset) && Ai.call(t.buffer) === "[object ArrayBuffer]" ? "typedArray" : "others";
}, "getChunkType"), { toString: Ai } = Object.prototype, Vt = class extends Error {
  static {
    o(this, "MaxBufferError");
  }
  name = "MaxBufferError";
  constructor() {
    super("maxBuffer exceeded");
  }
};

// node_modules/get-stream/source/utils.js
var Gr = /* @__PURE__ */ o((t) => t, "identity"), Wr = /* @__PURE__ */ o(() => {
}, "noop"), Jr = /* @__PURE__ */ o(({ contents: t }) => t, "getContentsProp"), Ft = /* @__PURE__ */ o((t) => {
  throw new Error(`Streams in object mode are not supported: ${String(t)}`);
}, "throwObjectStream"), Bt = /* @__PURE__ */ o((t) => t.length, "getLengthProp");

// node_modules/get-stream/source/array-buffer.js
async function Hr(t, e) {
  return rt(t, gu, e);
}
o(Hr, "getStreamAsArrayBuffer");
var du = /* @__PURE__ */ o(() => ({ contents: new ArrayBuffer(0) }), "initArrayBuffer"), uu = /* @__PURE__ */ o((t) => lu.encode(t), "useTex\
tEncoder"), lu = new TextEncoder(), Zi = /* @__PURE__ */ o((t) => new Uint8Array(t), "useUint8Array"), Ni = /* @__PURE__ */ o((t) => new Uint8Array(
t.buffer, t.byteOffset, t.byteLength), "useUint8ArrayWithOffset"), pu = /* @__PURE__ */ o((t, e) => t.slice(0, e), "truncateArrayBufferChunk"),
fu = /* @__PURE__ */ o((t, { contents: e, length: r }, n) => {
  let s = Li() ? hu(e, n) : mu(e, n);
  return new Uint8Array(s).set(t, r), s;
}, "addArrayBufferChunk"), mu = /* @__PURE__ */ o((t, e) => {
  if (e <= t.byteLength)
    return t;
  let r = new ArrayBuffer(Di(e));
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBufferSlow"), hu = /* @__PURE__ */ o((t, e) => {
  if (e <= t.maxByteLength)
    return t.resize(e), t;
  let r = new ArrayBuffer(e, { maxByteLength: Di(e) });
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBuffer"), Di = /* @__PURE__ */ o((t) => Ri ** Math.ceil(Math.log(t) / Math.log(Ri)), "getNewContentsLength"), Ri = 2, yu = /* @__PURE__ */ o(
({ contents: t, length: e }) => Li() ? t : t.slice(0, e), "finalizeArrayBuffer"), Li = /* @__PURE__ */ o(() => "resize" in ArrayBuffer.prototype,
"hasArrayBufferResize"), gu = {
  init: du,
  convertChunk: {
    string: uu,
    buffer: Zi,
    arrayBuffer: Zi,
    dataView: Ni,
    typedArray: Ni,
    others: Ft
  },
  getSize: Bt,
  truncateChunk: pu,
  addChunk: fu,
  getFinalChunk: Wr,
  finalize: yu
};

// node_modules/get-stream/source/buffer.js
async function qt(t, e) {
  if (!("Buffer" in globalThis))
    throw new Error("getStreamAsBuffer() is only supported in Node.js");
  try {
    return Mi(await Hr(t, e));
  } catch (r) {
    throw r.bufferedData !== void 0 && (r.bufferedData = Mi(r.bufferedData)), r;
  }
}
o(qt, "getStreamAsBuffer");
var Mi = /* @__PURE__ */ o((t) => globalThis.Buffer.from(t), "arrayBufferToNodeBuffer");

// node_modules/get-stream/source/string.js
async function Kr(t, e) {
  return rt(t, wu, e);
}
o(Kr, "getStreamAsString");
var xu = /* @__PURE__ */ o(() => ({ contents: "", textDecoder: new TextDecoder() }), "initString"), zt = /* @__PURE__ */ o((t, { textDecoder: e }) => e.
decode(t, { stream: !0 }), "useTextDecoder"), vu = /* @__PURE__ */ o((t, { contents: e }) => e + t, "addStringChunk"), bu = /* @__PURE__ */ o(
(t, e) => t.slice(0, e), "truncateStringChunk"), _u = /* @__PURE__ */ o(({ textDecoder: t }) => {
  let e = t.decode();
  return e === "" ? void 0 : e;
}, "getFinalStringChunk"), wu = {
  init: xu,
  convertChunk: {
    string: Gr,
    buffer: zt,
    arrayBuffer: zt,
    dataView: zt,
    typedArray: zt,
    others: Ft
  },
  getSize: Bt,
  truncateChunk: bu,
  addChunk: vu,
  getFinalChunk: _u,
  finalize: Jr
};

// node_modules/execa/lib/stream.js
var Fi = T($i(), 1);
var Bi = /* @__PURE__ */ o((t) => {
  if (t !== void 0)
    throw new TypeError("The `input` and `inputFile` options cannot be both set.");
}, "validateInputOptions"), Tu = /* @__PURE__ */ o(({ input: t, inputFile: e }) => typeof e != "string" ? t : (Bi(t), (0, Gt.readFileSync)(e)),
"getInputSync"), qi = /* @__PURE__ */ o((t) => {
  let e = Tu(t);
  if ($t(e))
    throw new TypeError("The `input` option cannot be a stream in sync mode");
  return e;
}, "handleInputSync"), Iu = /* @__PURE__ */ o(({ input: t, inputFile: e }) => typeof e != "string" ? t : (Bi(t), (0, Gt.createReadStream)(e)),
"getInput"), zi = /* @__PURE__ */ o((t, e) => {
  let r = Iu(e);
  r !== void 0 && ($t(r) ? r.pipe(t.stdin) : t.stdin.end(r));
}, "handleInput"), Gi = /* @__PURE__ */ o((t, { all: e }) => {
  if (!e || !t.stdout && !t.stderr)
    return;
  let r = (0, Fi.default)();
  return t.stdout && r.add(t.stdout), t.stderr && r.add(t.stderr), r;
}, "makeAllStream"), Yr = /* @__PURE__ */ o(async (t, e) => {
  if (!(!t || e === void 0)) {
    await (0, Vi.setTimeout)(0), t.destroy();
    try {
      return await e;
    } catch (r) {
      return r.bufferedData;
    }
  }
}, "getBufferedData"), Xr = /* @__PURE__ */ o((t, { encoding: e, buffer: r, maxBuffer: n }) => {
  if (!(!t || !r))
    return e === "utf8" || e === "utf-8" ? Kr(t, { maxBuffer: n }) : e === null || e === "buffer" ? qt(t, { maxBuffer: n }) : Su(t, n, e);
}, "getStreamPromise"), Su = /* @__PURE__ */ o(async (t, e, r) => (await qt(t, { maxBuffer: e })).toString(r), "applyEncoding"), Wi = /* @__PURE__ */ o(
async ({ stdout: t, stderr: e, all: r }, { encoding: n, buffer: s, maxBuffer: i }, a) => {
  let c = Xr(t, { encoding: n, buffer: s, maxBuffer: i }), p = Xr(e, { encoding: n, buffer: s, maxBuffer: i }), l = Xr(r, { encoding: n, buffer: s,
  maxBuffer: i * 2 });
  try {
    return await Promise.all([a, c, p, l]);
  } catch (f) {
    return Promise.all([
      { error: f, signal: f.signal, timedOut: f.timedOut },
      Yr(t, c),
      Yr(e, p),
      Yr(r, l)
    ]);
  }
}, "getSpawnedResult");

// node_modules/execa/lib/promise.js
var Cu = (async () => {
})().constructor.prototype, Pu = ["then", "catch", "finally"].map((t) => [
  t,
  Reflect.getOwnPropertyDescriptor(Cu, t)
]), Qr = /* @__PURE__ */ o((t, e) => {
  for (let [r, n] of Pu) {
    let s = typeof e == "function" ? (...i) => Reflect.apply(n.value, e(), i) : n.value.bind(e);
    Reflect.defineProperty(t, r, { ...n, value: s });
  }
}, "mergePromise"), Ji = /* @__PURE__ */ o((t) => new Promise((e, r) => {
  t.on("exit", (n, s) => {
    e({ exitCode: n, signal: s });
  }), t.on("error", (n) => {
    r(n);
  }), t.stdin && t.stdin.on("error", (n) => {
    r(n);
  });
}), "getSpawnedPromise");

// node_modules/execa/lib/command.js
var Yi = require("node:buffer"), Xi = require("node:child_process");
var Qi = /* @__PURE__ */ o((t, e = []) => Array.isArray(e) ? [t, ...e] : [t], "normalizeArgs"), Eu = /^[\w.-]+$/, ju = /* @__PURE__ */ o((t) => typeof t !=
"string" || Eu.test(t) ? t : `"${t.replaceAll('"', '\\"')}"`, "escapeArg"), en = /* @__PURE__ */ o((t, e) => Qi(t, e).join(" "), "joinComman\
d"), tn = /* @__PURE__ */ o((t, e) => Qi(t, e).map((r) => ju(r)).join(" "), "getEscapedCommand"), eo = / +/g, to = /* @__PURE__ */ o((t) => {
  let e = [];
  for (let r of t.trim().split(eo)) {
    let n = e.at(-1);
    n && n.endsWith("\\") ? e[e.length - 1] = `${n.slice(0, -1)} ${r}` : e.push(r);
  }
  return e;
}, "parseCommand"), Hi = /* @__PURE__ */ o((t) => {
  let e = typeof t;
  if (e === "string")
    return t;
  if (e === "number")
    return String(t);
  if (e === "object" && t !== null && !(t instanceof Xi.ChildProcess) && "stdout" in t) {
    let r = typeof t.stdout;
    if (r === "string")
      return t.stdout;
    if (Yi.Buffer.isBuffer(t.stdout))
      return t.stdout.toString();
    throw new TypeError(`Unexpected "${r}" stdout in template expression`);
  }
  throw new TypeError(`Unexpected "${e}" in template expression`);
}, "parseExpression"), Ki = /* @__PURE__ */ o((t, e, r) => r || t.length === 0 || e.length === 0 ? [...t, ...e] : [
  ...t.slice(0, -1),
  `${t.at(-1)}${e[0]}`,
  ...e.slice(1)
], "concatTokens"), Au = /* @__PURE__ */ o(({ templates: t, expressions: e, tokens: r, index: n, template: s }) => {
  let i = s ?? t.raw[n], a = i.split(eo).filter(Boolean), c = Ki(
    r,
    a,
    i.startsWith(" ")
  );
  if (n === e.length)
    return c;
  let p = e[n], l = Array.isArray(p) ? p.map((f) => Hi(f)) : [Hi(p)];
  return Ki(
    c,
    l,
    i.endsWith(" ")
  );
}, "parseTemplate"), rn = /* @__PURE__ */ o((t, e) => {
  let r = [];
  for (let [n, s] of t.entries())
    r = Au({ templates: t, expressions: e, tokens: r, index: n, template: s });
  return r;
}, "parseTemplates");

// node_modules/execa/lib/verbose.js
var ro = require("node:util"), no = T(require("node:process"), 1);
var so = (0, ro.debuglog)("execa").enabled, Wt = /* @__PURE__ */ o((t, e) => String(t).padStart(e, "0"), "padField"), Ou = /* @__PURE__ */ o(
() => {
  let t = /* @__PURE__ */ new Date();
  return `${Wt(t.getHours(), 2)}:${Wt(t.getMinutes(), 2)}:${Wt(t.getSeconds(), 2)}.${Wt(t.getMilliseconds(), 3)}`;
}, "getTimestamp"), nn = /* @__PURE__ */ o((t, { verbose: e }) => {
  e && no.default.stderr.write(`[${Ou()}] ${t}
`);
}, "logCommand");

// node_modules/execa/index.js
var Zu = 1e3 * 1e3 * 100, Nu = /* @__PURE__ */ o(({ env: t, extendEnv: e, preferLocal: r, localDir: n, execPath: s }) => {
  let i = e ? { ...nt.default.env, ...t } : t;
  return r ? di({ env: i, cwd: n, execPath: s }) : i;
}, "getEnv"), uo = /* @__PURE__ */ o((t, e, r = {}) => {
  let n = co.default._parse(t, e, r);
  return t = n.command, e = n.args, r = n.options, r = {
    maxBuffer: Zu,
    buffer: !0,
    stripFinalNewline: !0,
    extendEnv: !0,
    preferLocal: !1,
    localDir: r.cwd || nt.default.cwd(),
    execPath: nt.default.execPath,
    encoding: "utf8",
    reject: !0,
    cleanup: !0,
    all: !1,
    windowsHide: !0,
    verbose: so,
    ...r
  }, r.env = Nu(r), r.stdio = vi(r), nt.default.platform === "win32" && ao.default.basename(t, ".exe") === "cmd" && e.unshift("/q"), { file: t,
  args: e, options: r, parsed: n };
}, "handleArguments"), st = /* @__PURE__ */ o((t, e, r) => typeof e != "string" && !oo.Buffer.isBuffer(e) ? r === void 0 ? void 0 : "" : t.stripFinalNewline ?
Zr(e) : e, "handleOutput");
function lo(t, e, r) {
  let n = uo(t, e, r), s = en(t, e), i = tn(t, e);
  nn(i, n.options), Ii(n.options);
  let a;
  try {
    a = Jt.default.spawn(n.file, n.args, n.options);
  } catch (_) {
    let E = new Jt.default.ChildProcess(), C = Promise.reject(tt({
      error: _,
      stdout: "",
      stderr: "",
      all: "",
      command: s,
      escapedCommand: i,
      parsed: n,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    }));
    return Qr(E, C), E;
  }
  let c = Ji(a), p = Ti(a, n.options, c), l = Si(a, n.options, p), f = { isCanceled: !1 };
  a.kill = wi.bind(null, a.kill.bind(a)), a.cancel = ki.bind(null, a, f);
  let w = li(/* @__PURE__ */ o(async () => {
    let [{ error: _, exitCode: E, signal: C, timedOut: j }, q, Be, Te] = await Wi(a, n.options, l), qe = st(n.options, q), ht = st(n.options,
    Be), yt = st(n.options, Te);
    if (_ || E !== 0 || C !== null) {
      let k = tt({
        error: _,
        exitCode: E,
        signal: C,
        stdout: qe,
        stderr: ht,
        all: yt,
        command: s,
        escapedCommand: i,
        parsed: n,
        timedOut: j,
        isCanceled: f.isCanceled || (n.options.signal ? n.options.signal.aborted : !1),
        killed: a.killed
      });
      if (!n.options.reject)
        return k;
      throw k;
    }
    return {
      command: s,
      escapedCommand: i,
      exitCode: 0,
      stdout: qe,
      stderr: ht,
      all: yt,
      failed: !1,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    };
  }, "handlePromise"));
  return zi(a, n.options), a.all = Gi(a, n.options), Ei(a), Qr(a, w), a;
}
o(lo, "execa");
function Ru(t, e, r) {
  let n = uo(t, e, r), s = en(t, e), i = tn(t, e);
  nn(i, n.options);
  let a = qi(n.options), c;
  try {
    c = Jt.default.spawnSync(n.file, n.args, { ...n.options, input: a });
  } catch (f) {
    throw tt({
      error: f,
      stdout: "",
      stderr: "",
      all: "",
      command: s,
      escapedCommand: i,
      parsed: n,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    });
  }
  let p = st(n.options, c.stdout, c.error), l = st(n.options, c.stderr, c.error);
  if (c.error || c.status !== 0 || c.signal !== null) {
    let f = tt({
      stdout: p,
      stderr: l,
      error: c.error,
      signal: c.signal,
      exitCode: c.status,
      command: s,
      escapedCommand: i,
      parsed: n,
      timedOut: c.error && c.error.code === "ETIMEDOUT",
      isCanceled: !1,
      killed: c.signal !== null
    });
    if (!n.options.reject)
      return f;
    throw f;
  }
  return {
    command: s,
    escapedCommand: i,
    exitCode: 0,
    stdout: p,
    stderr: l,
    failed: !1,
    timedOut: !1,
    isCanceled: !1,
    killed: !1
  };
}
o(Ru, "execaSync");
var Du = /* @__PURE__ */ o(({ input: t, inputFile: e, stdio: r }) => t === void 0 && e === void 0 && r === void 0 ? { stdin: "inherit" } : {},
"normalizeScriptStdin"), io = /* @__PURE__ */ o((t = {}) => ({
  preferLocal: !0,
  ...Du(t),
  ...t
}), "normalizeScriptOptions");
function po(t) {
  function e(r, ...n) {
    if (!Array.isArray(r))
      return po({ ...t, ...r });
    let [s, ...i] = rn(r, n);
    return lo(s, i, io(t));
  }
  return o(e, "$"), e.sync = (r, ...n) => {
    if (!Array.isArray(r))
      throw new TypeError("Please use $(options).sync`command` instead of $.sync(options)`command`.");
    let [s, ...i] = rn(r, n);
    return Ru(s, i, io(t));
  }, e;
}
o(po, "create$");
var vm = po();
function it(t, e) {
  let [r, ...n] = to(t);
  return lo(r, n, e);
}
o(it, "execaCommand");

// src/telemetry/exec-command-count-lines.ts
async function Ht(t, e) {
  let r = it(t, { shell: !0, buffer: !1, ...e });
  if (!r.stdout)
    throw new Error("Unexpected missing stdout");
  let n = 0, s = (0, fo.createInterface)(r.stdout);
  return s.on("line", () => {
    n += 1;
  }), await r, s.close(), n;
}
o(Ht, "execCommandCountLines");

// src/common/utils/file-cache.ts
var ot = require("node:crypto"), D = require("node:fs"), V = require("node:fs/promises"), ho = require("node:os"), Me = require("node:path");
var Kt = class {
  static {
    o(this, "FileSystemCache");
  }
  constructor(e = {}) {
    this.prefix = (e.ns || e.prefix || "") + "-", this.hash_alg = e.hash_alg || "sha256", this.cache_dir = e.basePath || (0, Me.join)((0, ho.tmpdir)(),
    (0, ot.randomBytes)(15).toString("base64").replace(/\//g, "-")), this.ttl = e.ttl || 0, (0, ot.createHash)(this.hash_alg), (0, D.mkdirSync)(
    this.cache_dir, { recursive: !0 });
  }
  generateHash(e) {
    return (0, Me.join)(this.cache_dir, this.prefix + (0, ot.createHash)(this.hash_alg).update(e).digest("hex"));
  }
  isExpired(e, r) {
    return e.ttl != null && r > e.ttl;
  }
  parseCacheData(e, r) {
    let n = JSON.parse(e);
    return this.isExpired(n, Date.now()) ? r : n.content;
  }
  parseSetData(e, r, n = {}) {
    let s = n.ttl ?? this.ttl;
    return JSON.stringify({ key: e, content: r, ...s && { ttl: Date.now() + s * 1e3 } });
  }
  async get(e, r) {
    try {
      let n = await (0, V.readFile)(this.generateHash(e), "utf8");
      return this.parseCacheData(n, r);
    } catch {
      return r;
    }
  }
  getSync(e, r) {
    try {
      let n = (0, D.readFileSync)(this.generateHash(e), "utf8");
      return this.parseCacheData(n, r);
    } catch {
      return r;
    }
  }
  async set(e, r, n = {}) {
    let s = typeof n == "number" ? { ttl: n } : n;
    (0, D.mkdirSync)(this.cache_dir, { recursive: !0 }), await (0, V.writeFile)(this.generateHash(e), this.parseSetData(e, r, s), {
      encoding: s.encoding || "utf8"
    });
  }
  setSync(e, r, n = {}) {
    let s = typeof n == "number" ? { ttl: n } : n;
    (0, D.mkdirSync)(this.cache_dir, { recursive: !0 }), (0, D.writeFileSync)(this.generateHash(e), this.parseSetData(e, r, s), {
      encoding: s.encoding || "utf8"
    });
  }
  async setMany(e, r) {
    await Promise.all(e.map((n) => this.set(n.key, n.content ?? n.value, r)));
  }
  setManySync(e, r) {
    e.forEach((n) => this.setSync(n.key, n.content ?? n.value, r));
  }
  async remove(e) {
    await (0, V.rm)(this.generateHash(e), { force: !0 });
  }
  removeSync(e) {
    (0, D.rmSync)(this.generateHash(e), { force: !0 });
  }
  async clear() {
    let e = await (0, V.readdir)(this.cache_dir);
    await Promise.all(
      e.filter((r) => r.startsWith(this.prefix)).map((r) => (0, V.rm)((0, Me.join)(this.cache_dir, r), { force: !0 }))
    );
  }
  clearSync() {
    (0, D.readdirSync)(this.cache_dir).filter((e) => e.startsWith(this.prefix)).forEach((e) => (0, D.rmSync)((0, Me.join)(this.cache_dir, e),
    { force: !0 }));
  }
  async getAll() {
    let e = Date.now(), r = await (0, V.readdir)(this.cache_dir);
    return (await Promise.all(
      r.filter((s) => s.startsWith(this.prefix)).map((s) => (0, V.readFile)((0, Me.join)(this.cache_dir, s), "utf8"))
    )).map((s) => JSON.parse(s)).filter((s) => s.content && !this.isExpired(s, e));
  }
  async load() {
    return {
      files: (await this.getAll()).map((r) => ({
        path: this.generateHash(r.key),
        value: r.content,
        key: r.key
      }))
    };
  }
};
function on(t) {
  return new Kt(t);
}
o(on, "createFileSystemCache");

// src/common/utils/resolve-path-in-sb-cache.ts
var fn = require("node:path");

// node_modules/find-cache-dir/index.js
var Ao = T(require("node:process"), 1), Ve = T(require("node:path"), 1), dt = T(require("node:fs"), 1), Oo = T(go(), 1);

// ../node_modules/pkg-dir/index.js
var Co = T(require("node:path"), 1);

// ../node_modules/pkg-dir/node_modules/find-up/index.js
var ct = T(require("node:path"), 1), Io = require("node:url");

// ../node_modules/locate-path/index.js
var dn = T(require("node:process"), 1), un = T(require("node:path"), 1), Ue = T(require("node:fs"), 1), vo = require("node:url");

// ../node_modules/locate-path/node_modules/p-limit/index.js
xo();
function Yt(t) {
  if (!((Number.isInteger(t) || t === Number.POSITIVE_INFINITY) && t > 0))
    throw new TypeError("Expected `concurrency` to be a number from 1 and up");
  let e = new at(), r = 0, n = /* @__PURE__ */ o(() => {
    r--, e.size > 0 && e.dequeue()();
  }, "next"), s = /* @__PURE__ */ o(async (c, p, l) => {
    r++;
    let f = (async () => c(...l))();
    p(f);
    try {
      await f;
    } catch {
    }
    n();
  }, "run"), i = /* @__PURE__ */ o((c, p, l) => {
    e.enqueue(s.bind(void 0, c, p, l)), (async () => (await Promise.resolve(), r < t && e.size > 0 && e.dequeue()()))();
  }, "enqueue"), a = /* @__PURE__ */ o((c, ...p) => new Promise((l) => {
    i(c, l, p);
  }), "generator");
  return Object.defineProperties(a, {
    activeCount: {
      get: /* @__PURE__ */ o(() => r, "get")
    },
    pendingCount: {
      get: /* @__PURE__ */ o(() => e.size, "get")
    },
    clearQueue: {
      value: /* @__PURE__ */ o(() => {
        e.clear();
      }, "value")
    }
  }), a;
}
o(Yt, "pLimit");

// ../node_modules/locate-path/node_modules/p-locate/index.js
var Xt = class extends Error {
  static {
    o(this, "EndError");
  }
  constructor(e) {
    super(), this.value = e;
  }
}, Uu = /* @__PURE__ */ o(async (t, e) => e(await t), "testElement"), $u = /* @__PURE__ */ o(async (t) => {
  let e = await Promise.all(t);
  if (e[1] === !0)
    throw new Xt(e[0]);
  return !1;
}, "finder");
async function cn(t, e, {
  concurrency: r = Number.POSITIVE_INFINITY,
  preserveOrder: n = !0
} = {}) {
  let s = Yt(r), i = [...t].map((c) => [c, s(Uu, c, e)]), a = Yt(n ? 1 : Number.POSITIVE_INFINITY);
  try {
    await Promise.all(i.map((c) => a($u, c)));
  } catch (c) {
    if (c instanceof Xt)
      return c.value;
    throw c;
  }
}
o(cn, "pLocate");

// ../node_modules/locate-path/index.js
var bo = {
  directory: "isDirectory",
  file: "isFile"
};
function _o(t) {
  if (!Object.hasOwnProperty.call(bo, t))
    throw new Error(`Invalid type specified: ${t}`);
}
o(_o, "checkType");
var wo = /* @__PURE__ */ o((t, e) => e[bo[t]](), "matchType"), ko = /* @__PURE__ */ o((t) => t instanceof URL ? (0, vo.fileURLToPath)(t) : t,
"toPath");
async function Qt(t, {
  cwd: e = dn.default.cwd(),
  type: r = "file",
  allowSymlinks: n = !0,
  concurrency: s,
  preserveOrder: i
} = {}) {
  _o(r), e = ko(e);
  let a = n ? Ue.promises.stat : Ue.promises.lstat;
  return cn(t, async (c) => {
    try {
      let p = await a(un.default.resolve(e, c));
      return wo(r, p);
    } catch {
      return !1;
    }
  }, { concurrency: s, preserveOrder: i });
}
o(Qt, "locatePath");
function $e(t, {
  cwd: e = dn.default.cwd(),
  type: r = "file",
  allowSymlinks: n = !0
} = {}) {
  _o(r), e = ko(e);
  let s = n ? Ue.default.statSync : Ue.default.lstatSync;
  for (let i of t)
    try {
      let a = s(un.default.resolve(e, i), {
        throwIfNoEntry: !1
      });
      if (!a)
        continue;
      if (wo(r, a))
        return i;
    } catch {
    }
}
o($e, "locatePathSync");

// ../node_modules/pkg-dir/node_modules/path-exists/index.js
var To = T(require("node:fs"), 1);

// ../node_modules/pkg-dir/node_modules/find-up/index.js
var Vu = /* @__PURE__ */ o((t) => t instanceof URL ? (0, Io.fileURLToPath)(t) : t, "toPath"), Fu = Symbol("findUpStop");
function Bu(t, e = {}) {
  let r = ct.default.resolve(Vu(e.cwd) || ""), { root: n } = ct.default.parse(r), s = e.stopAt || n, i = e.limit || Number.POSITIVE_INFINITY,
  a = [t].flat(), c = /* @__PURE__ */ o((l) => {
    if (typeof t != "function")
      return $e(a, l);
    let f = t(l.cwd);
    return typeof f == "string" ? $e([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = c({ ...e, cwd: r });
    if (l === Fu || (l && p.push(ct.default.resolve(r, l)), r === s || p.length >= i))
      break;
    r = ct.default.dirname(r);
  }
  return p;
}
o(Bu, "findUpMultipleSync");
function So(t, e = {}) {
  return Bu(t, { ...e, limit: 1 })[0];
}
o(So, "findUpSync");

// ../node_modules/pkg-dir/index.js
function Po({ cwd: t } = {}) {
  let e = So("package.json", { cwd: t });
  return e && Co.default.dirname(e);
}
o(Po, "packageDirectorySync");

// node_modules/find-cache-dir/index.js
var { env: ln, cwd: qu } = Ao.default, Eo = /* @__PURE__ */ o((t) => {
  try {
    return dt.default.accessSync(t, dt.default.constants.W_OK), !0;
  } catch {
    return !1;
  }
}, "isWritable");
function jo(t, e) {
  return e.create && dt.default.mkdirSync(t, { recursive: !0 }), t;
}
o(jo, "useDirectory");
function zu(t) {
  let e = Ve.default.join(t, "node_modules");
  if (!(!Eo(e) && (dt.default.existsSync(e) || !Eo(Ve.default.join(t)))))
    return e;
}
o(zu, "getNodeModuleDirectory");
function pn(t = {}) {
  if (ln.CACHE_DIR && !["true", "false", "1", "0"].includes(ln.CACHE_DIR))
    return jo(Ve.default.join(ln.CACHE_DIR, t.name), t);
  let { cwd: e = qu(), files: r } = t;
  if (r) {
    if (!Array.isArray(r))
      throw new TypeError(`Expected \`files\` option to be an array, got \`${typeof r}\`.`);
    e = (0, Oo.default)(r.map((s) => Ve.default.resolve(e, s)));
  }
  if (e = Po({ cwd: e }), !(!e || !zu(e)))
    return jo(Ve.default.join(e, "node_modules", ".cache", t.name), t);
}
o(pn, "findCacheDirectory");

// src/common/utils/resolve-path-in-sb-cache.ts
function Zo(t, e = "default") {
  let r = pn({ name: "storybook" });
  return r ||= (0, fn.join)(process.cwd(), "node_modules", ".cache", "storybook"), (0, fn.join)(r, e, t);
}
o(Zo, "resolvePathInStorybookCache");

// ../node_modules/find-up/index.js
var F = T(require("node:path"), 1);

// ../node_modules/find-up/node_modules/unicorn-magic/node.js
var No = require("node:url");
function ut(t) {
  return t instanceof URL ? (0, No.fileURLToPath)(t) : t;
}
o(ut, "toPath");

// ../node_modules/find-up/node_modules/path-exists/index.js
var Ro = T(require("node:fs"), 1);

// ../node_modules/find-up/index.js
var Do = Symbol("findUpStop");
async function Gu(t, e = {}) {
  let r = F.default.resolve(ut(e.cwd) ?? ""), { root: n } = F.default.parse(r), s = F.default.resolve(r, ut(e.stopAt ?? n)), i = e.limit ?? Number.
  POSITIVE_INFINITY, a = [t].flat(), c = /* @__PURE__ */ o(async (l) => {
    if (typeof t != "function")
      return Qt(a, l);
    let f = await t(l.cwd);
    return typeof f == "string" ? Qt([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = await c({ ...e, cwd: r });
    if (l === Do || (l && p.push(F.default.resolve(r, l)), r === s || p.length >= i))
      break;
    r = F.default.dirname(r);
  }
  return p;
}
o(Gu, "findUpMultiple");
function Wu(t, e = {}) {
  let r = F.default.resolve(ut(e.cwd) ?? ""), { root: n } = F.default.parse(r), s = F.default.resolve(r, ut(e.stopAt) ?? n), i = e.limit ?? Number.
  POSITIVE_INFINITY, a = [t].flat(), c = /* @__PURE__ */ o((l) => {
    if (typeof t != "function")
      return $e(a, l);
    let f = t(l.cwd);
    return typeof f == "string" ? $e([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = c({ ...e, cwd: r });
    if (l === Do || (l && p.push(F.default.resolve(r, l)), r === s || p.length >= i))
      break;
    r = F.default.dirname(r);
  }
  return p;
}
o(Wu, "findUpMultipleSync");
async function Lo(t, e = {}) {
  return (await Gu(t, { ...e, limit: 1 }))[0];
}
o(Lo, "findUp");
function lt(t, e = {}) {
  return Wu(t, { ...e, limit: 1 })[0];
}
o(lt, "findUpSync");

// src/common/utils/paths.ts
var B = require("node:path");

// src/common/js-package-manager/constants.ts
var Ju = "package-lock.json", Hu = "pnpm-lock.yaml", Ku = "yarn.lock", Yu = "bun.lock", Xu = "bun.lockb", Mo = [
  Ju,
  Hu,
  Ku,
  Yu,
  Xu
];

// src/common/utils/paths.ts
var J, er = /* @__PURE__ */ o(() => {
  if (J)
    return J;
  if (process.env.STORYBOOK_PROJECT_ROOT)
    return process.env.STORYBOOK_PROJECT_ROOT;
  try {
    let t = lt(".git", { type: "directory" }) || lt(".svn", { type: "directory" }) || lt(".hg", { type: "directory" });
    if (t)
      return J = (0, B.join)(t, ".."), J;
  } catch (t) {
    process.stdout.write(`
error searching for repository root: ${t}
`);
  }
  try {
    let t = lt(Mo, { type: "file" });
    if (t)
      return J = (0, B.join)(t, ".."), J;
  } catch (t) {
    process.stdout.write(`
error searching for lock file: ${t}
`);
  }
  try {
    let [t, e] = __dirname.split(`${B.sep}node_modules${B.sep}`, 2);
    if (e && !t.includes(`${B.sep}npm-cache${B.sep}`) && !(0, B.relative)(t, process.cwd()).startsWith(".."))
      return J = t, J;
  } catch (t) {
    process.stdout.write(`
error searching for splitDirname: ${t}
`);
  }
  return J = process.cwd(), J;
}, "getProjectRoot");

// src/telemetry/run-telemetry-operation.ts
var Uo = on({
  basePath: Zo("telemetry"),
  ns: "storybook",
  ttl: 24 * 60 * 60 * 1e3
  // 24h
}), tr = /* @__PURE__ */ o(async (t, e) => {
  let r = await Uo.get(t);
  return r === void 0 && (r = await e(), r !== void 0 && await Uo.set(t, r)), r;
}, "runTelemetryOperation");

// src/telemetry/get-application-file-count.ts
var Qu = ["page", "screen"], el = ["js", "jsx", "ts", "tsx"], tl = /* @__PURE__ */ o(async (t) => {
  let r = Qu.flatMap((n) => [
    n,
    [n[0].toUpperCase(), ...n.slice(1)].join("")
  ]).flatMap(
    (n) => el.map((s) => `"${t}${$o.sep}*${n}*.${s}"`)
  );
  try {
    let n = `git ls-files -- ${r.join(" ")}`;
    return await Ht(n);
  } catch {
    return;
  }
}, "getApplicationFilesCountUncached"), Vo = /* @__PURE__ */ o(async (t) => tr(
  "applicationFiles",
  async () => tl(t)
), "getApplicationFileCount");

// src/telemetry/get-chromatic-version.ts
function Fo(t) {
  let e = t.dependencies?.chromatic || t.devDependencies?.chromatic || t.peerDependencies?.chromatic;
  return e || (t.scripts && Object.values(t.scripts).find((r) => r?.match(/chromatic/)) ? "latest" : void 0);
}
o(Fo, "getChromaticVersionSpecifier");

// src/telemetry/get-framework-info.ts
var Go = require("node:path"), Wo = require("storybook/internal/common");

// src/telemetry/package-json.ts
var Bo = require("node:fs/promises"), qo = require("node:path");
var mn = /* @__PURE__ */ o(async (t) => {
  let e = Object.keys(t);
  return Promise.all(e.map(rr));
}, "getActualPackageVersions"), rr = /* @__PURE__ */ o(async (t) => {
  try {
    let e = await hn(t);
    return {
      name: e?.name || t,
      version: e?.version || null
    };
  } catch {
    return {
      name: t,
      version: null
    };
  }
}, "getActualPackageVersion"), hn = /* @__PURE__ */ o(async (t) => {
  try {
    let e = await Lo("package.json", { cwd: require.resolve(t) });
    return e || (e = require.resolve((0, qo.join)(t, "package.json"), {
      paths: [process.cwd()]
    })), JSON.parse(await (0, Bo.readFile)(e, { encoding: "utf8" }));
  } catch {
    return;
  }
}, "getActualPackageJson");

// src/telemetry/get-framework-info.ts
var rl = [
  "html",
  "react",
  "svelte",
  "vue3",
  "preact",
  "server",
  "vue",
  "web-components",
  "angular",
  "ember"
], nl = ["builder-webpack5", "builder-vite"];
function zo(t, e) {
  let { name: r = "", version: n, dependencies: s, devDependencies: i, peerDependencies: a } = t, c = {
    // We include the framework itself because it may be a renderer too (e.g. angular)
    [r]: n,
    ...s,
    ...i,
    ...a
  };
  return e.map((p) => `@storybook/${p}`).find((p) => c[p]);
}
o(zo, "findMatchingPackage");
var sl = /* @__PURE__ */ o((t) => {
  let e = (0, Go.normalize)(t).replace(new RegExp(/\\/, "g"), "/");
  return Object.keys(Wo.frameworkPackages).find((n) => e.endsWith(n)) || Ie(t).replace(/.*node_modules[\\/]/, "");
}, "getFrameworkPackageName");
async function Jo(t) {
  if (!t?.framework)
    return {};
  let e = typeof t.framework == "string" ? t.framework : t.framework?.name;
  if (!e)
    return {};
  let r = await hn(e);
  if (!r)
    return {};
  let n = zo(r, nl), s = zo(r, rl), i = sl(e), a = typeof t.framework == "object" ? t.framework.options : {};
  return {
    framework: {
      name: i,
      options: a
    },
    builder: n,
    renderer: s
  };
}
o(Jo, "getFrameworkInfo");

// src/telemetry/get-has-router-package.ts
var il = /* @__PURE__ */ new Set([
  "react-router",
  "react-router-dom",
  "remix",
  "@tanstack/react-router",
  "expo-router",
  "@reach/router",
  "react-easy-router",
  "@remix-run/router",
  "wouter",
  "wouter-preact",
  "preact-router",
  "vue-router",
  "unplugin-vue-router",
  "@angular/router",
  "@solidjs/router",
  // metaframeworks that imply routing
  "next",
  "react-scripts",
  "gatsby",
  "nuxt",
  "@sveltejs/kit"
]);
function Ho(t) {
  return Object.keys(t?.dependencies ?? {}).some(
    (e) => il.has(e)
  );
}
o(Ho, "getHasRouterPackage");

// src/telemetry/get-monorepo-type.ts
var pt = require("node:fs"), nr = require("node:path"), sr = require("storybook/internal/common");
var Ko = {
  Nx: "nx.json",
  Turborepo: "turbo.json",
  Lerna: "lerna.json",
  Rush: "rush.json",
  Lage: "lage.config.json"
}, Yo = /* @__PURE__ */ o(() => {
  let e = Object.keys(Ko).find((n) => {
    let s = (0, nr.join)((0, sr.getProjectRoot)(), Ko[n]);
    return (0, pt.existsSync)(s);
  });
  if (e)
    return e;
  if (!(0, pt.existsSync)((0, nr.join)((0, sr.getProjectRoot)(), "package.json")))
    return;
  if (JSON.parse(
    (0, pt.readFileSync)((0, nr.join)((0, sr.getProjectRoot)(), "package.json"), { encoding: "utf8" })
  )?.workspaces)
    return "Workspaces";
}, "getMonorepoType");

// ../node_modules/package-manager-detector/dist/constants.mjs
var Xo = [
  "npm",
  "yarn",
  "yarn@berry",
  "pnpm",
  "pnpm@6",
  "bun",
  "deno"
], yn = {
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "deno.lock": "deno",
  "pnpm-lock.yaml": "pnpm",
  "pnpm-workspace.yaml": "pnpm",
  "yarn.lock": "yarn",
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm"
}, gn = {
  "node_modules/.deno/": "deno",
  "node_modules/.pnpm/": "pnpm",
  "node_modules/.yarn-state.yml": "yarn",
  // yarn v2+ (node-modules)
  "node_modules/.yarn_integrity": "yarn",
  // yarn v1
  "node_modules/.package-lock.json": "npm",
  ".pnp.cjs": "yarn",
  // yarn v3+ (pnp)
  ".pnp.js": "yarn",
  // yarn v2 (pnp)
  "bun.lock": "bun",
  "bun.lockb": "bun"
};

// ../node_modules/package-manager-detector/dist/detect.mjs
var vn = T(require("node:fs/promises"), 1), ne = T(require("node:path"), 1), ea = T(require("node:process"), 1);
async function xn(t, e) {
  try {
    let r = await vn.default.stat(t);
    return e === "file" ? r.isFile() : r.isDirectory();
  } catch {
    return !1;
  }
}
o(xn, "pathExists");
function* ol(t = ea.default.cwd()) {
  let e = ne.default.resolve(t), { root: r } = ne.default.parse(e);
  for (; e && e !== r; )
    yield e, e = ne.default.dirname(e);
}
o(ol, "lookup");
async function Qo(t, e) {
  return !t || !xn(t, "file") ? null : await cl(t, e);
}
o(Qo, "parsePackageJson");
async function bn(t = {}) {
  let { cwd: e, strategies: r = ["lockfile", "packageManager-field", "devEngines-field"], onUnknown: n } = t;
  for (let s of ol(e))
    for (let i of r)
      switch (i) {
        case "lockfile": {
          for (let a of Object.keys(yn))
            if (await xn(ne.default.join(s, a), "file")) {
              let c = yn[a], p = await Qo(ne.default.join(s, "package.json"), n);
              return p || { name: c, agent: c };
            }
          break;
        }
        case "packageManager-field":
        case "devEngines-field": {
          let a = await Qo(ne.default.join(s, "package.json"), n);
          if (a)
            return a;
          break;
        }
        case "install-metadata": {
          for (let a of Object.keys(gn)) {
            let c = a.endsWith("/") ? "dir" : "file";
            if (await xn(ne.default.join(s, a), c)) {
              let p = gn[a], l = p === "yarn" ? dl(a) ? "yarn" : "yarn@berry" : p;
              return { name: p, agent: l };
            }
          }
          break;
        }
      }
  return null;
}
o(bn, "detect");
function al(t) {
  let e = /* @__PURE__ */ o((r) => r?.match(/\d+(\.\d+){0,2}/)?.[0] ?? r, "handelVer");
  if (typeof t.packageManager == "string") {
    let [r, n] = t.packageManager.replace(/^\^/, "").split("@");
    return { name: r, ver: e(n) };
  }
  if (typeof t.devEngines?.packageManager?.name == "string")
    return {
      name: t.devEngines.packageManager.name,
      ver: e(t.devEngines.packageManager.version)
    };
}
o(al, "getNameAndVer");
async function cl(t, e) {
  try {
    let r = JSON.parse(await vn.default.readFile(t, "utf8")), n, s = al(r);
    if (s) {
      let i = s.name, a = s.ver, c = a;
      return i === "yarn" && a && Number.parseInt(a) > 1 ? (n = "yarn@berry", c = "berry", { name: i, agent: n, version: c }) : i === "pnpm" &&
      a && Number.parseInt(a) < 7 ? (n = "pnpm@6", { name: i, agent: n, version: c }) : Xo.includes(i) ? (n = i, { name: i, agent: n, version: c }) :
      e?.(r.packageManager) ?? null;
    }
  } catch {
  }
  return null;
}
o(cl, "handlePackageManager");
function dl(t) {
  return t.endsWith(".yarn_integrity");
}
o(dl, "isMetadataYarnClassic");

// ../node_modules/package-manager-detector/dist/index.mjs
var Uy = require("node:fs/promises"), $y = require("node:path"), Vy = require("node:process");

// src/telemetry/get-package-manager-info.ts
var ta = /* @__PURE__ */ o(async () => {
  let t = await bn({ cwd: er() });
  if (!t)
    return;
  let e = "node_modules";
  if (t.name === "yarn")
    try {
      let { stdout: r } = await it("yarn config get nodeLinker", {
        cwd: er()
      });
      e = r.trim();
    } catch {
    }
  if (t.name === "pnpm")
    try {
      let { stdout: r } = await it("pnpm config get nodeLinker", {
        cwd: er()
      });
      e = r.trim() ?? "isolated";
    } catch {
    }
  return {
    type: t.name,
    version: t.version,
    agent: t.agent,
    nodeLinker: e
  };
}, "getPackageManagerInfo");

// src/telemetry/get-portable-stories-usage.ts
var ul = /* @__PURE__ */ o(async (t) => {
  try {
    let e = "git grep -l composeStor" + (t ? ` -- ${t}` : "");
    return await Ht(e);
  } catch (e) {
    return e.exitCode === 1 ? 0 : void 0;
  }
}, "getPortableStoriesFileCountUncached"), ra = /* @__PURE__ */ o(async (t) => tr(
  "portableStories",
  async () => ul(t)
), "getPortableStoriesFileCount");

// src/telemetry/storybook-metadata.ts
var _n = {
  next: "Next",
  "react-scripts": "CRA",
  gatsby: "Gatsby",
  "@nuxtjs/storybook": "nuxt",
  "@nrwl/storybook": "nx",
  "@vue/cli-service": "vue-cli",
  "@sveltejs/kit": "sveltekit",
  "@tanstack/react-router": "tanstack-react",
  "@react-router/dev": "react-router",
  "@remix-run/dev": "remix"
}, wn = /* @__PURE__ */ o((t) => Ie(t).replace(/\/dist\/.*/, "").replace(/\.[mc]?[tj]?s[x]?$/, "").replace(/\/register$/, "").replace(/\/manager$/,
"").replace(/\/preset$/, ""), "sanitizeAddonName"), ia = /* @__PURE__ */ o(async ({
  packageJsonPath: t,
  packageJson: e,
  mainConfig: r,
  configDir: n
}) => {
  let s = (0, H.isCI)() ? void 0 : await bs(), i = {
    generatedAt: (/* @__PURE__ */ new Date()).getTime(),
    userSince: s?.value.userSince,
    hasCustomBabel: !1,
    hasCustomWebpack: !1,
    hasStaticDirs: !1,
    hasStorybookEslint: !1,
    refCount: 0
  }, a = {
    ...e?.dependencies,
    ...e?.devDependencies,
    ...e?.peerDependencies
  }, c = Object.keys(a).find((k) => !!_n[k]);
  if (c) {
    let { version: k } = await rr(c);
    i.metaFramework = {
      name: _n[c],
      packageName: c,
      version: k || "unknown"
    };
  }
  let p = [
    "playwright",
    "vitest",
    "jest",
    "cypress",
    "nightwatch",
    "webdriver",
    "@web/test-runner",
    "puppeteer",
    "karma",
    "jasmine",
    "chai",
    "testing-library",
    "@ngneat/spectator",
    "wdio",
    "msw",
    "miragejs",
    "sinon",
    "chromatic"
  ], l = Object.keys(a).filter(
    (k) => p.find((A) => k.includes(A))
  );
  i.testPackages = Object.fromEntries(
    await Promise.all(
      l.map(async (k) => [k, (await rr(k))?.version])
    )
  ), i.hasRouterPackage = Ho(e);
  let f = Yo();
  f && (i.monorepo = f), i.packageManager = await ta();
  let x = a.typescript ? "typescript" : "javascript";
  if (!r)
    return {
      ...i,
      storybookVersionSpecifier: H.versions.storybook,
      language: x
    };
  i.hasCustomBabel = !!r.babel, i.hasCustomWebpack = !!r.webpackFinal, i.hasStaticDirs = !!r.staticDirs, typeof r.typescript == "object" && (i.
  typescriptOptions = r.typescript);
  let w = await Jo(r);
  typeof r.refs == "object" && (i.refCount = Object.keys(r.refs).length), typeof r.features == "object" && (i.features = r.features);
  let _ = {};
  r.addons && r.addons.forEach((k) => {
    let A, gt;
    typeof k == "string" ? A = wn(k) : (k.name.includes("addon-essentials") && (gt = k.options), A = wn(k.name)), _[A] = {
      options: gt,
      version: void 0
    };
  });
  let E = Fo(e);
  E && (_.chromatic = {
    version: void 0,
    versionSpecifier: E,
    options: void 0
  }), (await mn(_)).forEach(({ name: k, version: A }) => {
    _[k] = _[k] || {
      name: k,
      version: A
    }, _[k].version = A || void 0;
  });
  let j = Object.keys(_), q = Object.keys(a).filter((k) => k.includes("storybook") && !j.includes(k)).reduce((k, A) => ({
    ...k,
    [A]: { version: void 0 }
  }), {});
  (await mn(q)).forEach(({ name: k, version: A }) => {
    q[k] = q[k] || {
      name: k,
      version: A
    }, q[k].version = A || void 0;
  });
  let Te = !!a["eslint-plugin-storybook"], qe = (0, H.getStorybookInfo)(n);
  try {
    let { previewConfigPath: k } = qe;
    if (k) {
      let A = await (0, sa.readConfig)(k), gt = !!(A.getFieldNode(["globals"]) || A.getFieldNode(["globalTypes"]));
      i.preview = { ...i.preview, usesGlobals: gt };
    }
  } catch {
  }
  let ht = await ra(), yt = await Vo((0, na.dirname)(t));
  return {
    ...i,
    ...w,
    portableStoriesFileCount: ht,
    applicationFileCount: yt,
    storybookVersion: wt,
    storybookVersionSpecifier: qe.version,
    language: x,
    storybookPackages: q,
    addons: _,
    hasStorybookEslint: Te
  };
}, "computeStorybookMetadata");
async function ll() {
  let t = await hr(process.cwd());
  return t ? {
    packageJsonPath: t,
    packageJson: await qn(t) || {}
  } : {
    packageJsonPath: process.cwd(),
    packageJson: {}
  };
}
o(ll, "getPackageJsonDetails");
var ir, kn = /* @__PURE__ */ o(async (t) => {
  if (ir)
    return ir;
  let { packageJson: e, packageJsonPath: r } = await ll(), n = (t || (0, H.getStorybookConfiguration)(
    String(e?.scripts?.storybook || ""),
    "-c",
    "--config-dir"
  )) ?? ".storybook", s = await (0, H.loadMainConfig)({ configDir: n }).catch(() => {
  });
  return ir = await ia({
    mainConfig: s,
    packageJson: e,
    packageJsonPath: r,
    configDir: n
  }), ir;
}, "getStorybookMetadata");

// src/telemetry/telemetry.ts
var xa = T(require("node:os"), 1), va = require("storybook/internal/common"), ba = T(aa(), 1);

// ../node_modules/nanoid/index.js
var Tn = require("crypto");

// ../node_modules/nanoid/url-alphabet/index.js
var ca = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// ../node_modules/nanoid/index.js
var pl = 128, ke, Fe, fl = /* @__PURE__ */ o((t) => {
  !ke || ke.length < t ? (ke = Buffer.allocUnsafe(t * pl), (0, Tn.randomFillSync)(ke), Fe = 0) : Fe + t > ke.length && ((0, Tn.randomFillSync)(
  ke), Fe = 0), Fe += t;
}, "fillPool");
var ft = /* @__PURE__ */ o((t = 21) => {
  fl(t -= 0);
  let e = "";
  for (let r = Fe - t; r < Fe; r++)
    e += ca[ke[r] & 63];
  return e;
}, "nanoid");

// src/telemetry/anonymous-id.ts
var ua = require("node:path"), la = require("storybook/internal/common"), pa = require("child_process");
mo();

// src/telemetry/one-way-hash.ts
var da = require("crypto");
var ar = /* @__PURE__ */ o((t) => {
  let e = (0, da.createHash)("sha256");
  return e.update("storybook-telemetry-salt"), e.update(t), e.digest("hex");
}, "oneWayHash");

// src/telemetry/anonymous-id.ts
function ml(t) {
  let n = t.trim().replace(/#.*$/, "").replace(/^.*@/, "").replace(/^.*\/\//, "");
  return (n.endsWith(".git") ? n : `${n}.git`).replace(":", "/");
}
o(ml, "normalizeGitUrl");
function hl(t, e) {
  return `${ml(t)}${sn(e)}`;
}
o(hl, "unhashedProjectId");
var cr, fa = /* @__PURE__ */ o(() => {
  if (cr)
    return cr;
  try {
    let t = (0, ua.relative)((0, la.getProjectRoot)(), process.cwd()), e = (0, pa.execSync)("git config --local --get remote.origin.url", {
      timeout: 1e3,
      stdio: "pipe"
    });
    cr = ar(hl(String(e), t));
  } catch {
  }
  return cr;
}, "getAnonymousProjectId");

// src/telemetry/event-cache.ts
var dr = require("storybook/internal/common");
var In = Promise.resolve(), yl = /* @__PURE__ */ o(async (t, e) => {
  let r = await dr.cache.get("lastEvents") || {};
  r[t] = { body: e, timestamp: Date.now() }, await dr.cache.set("lastEvents", r);
}, "setHelper"), ha = /* @__PURE__ */ o(async (t, e) => (await In, In = yl(t, e), In), "set");
var gl = /* @__PURE__ */ o((t) => {
  let { body: e, timestamp: r } = t;
  return {
    timestamp: r,
    eventType: e?.eventType,
    eventId: e?.eventId,
    sessionId: e?.sessionId
  };
}, "upgradeFields"), xl = ["init", "upgrade"], vl = ["build", "dev", "error"], ma = /* @__PURE__ */ o((t, e) => {
  let r = e.map((n) => t?.[n]).filter(Boolean).sort((n, s) => s.timestamp - n.timestamp);
  return r.length > 0 ? r[0] : void 0;
}, "lastEvent"), ya = /* @__PURE__ */ o(async (t = void 0) => {
  let e = t || await dr.cache.get("lastEvents") || {}, r = ma(e, xl), n = ma(e, vl);
  if (r)
    return !n?.timestamp || r.timestamp > n.timestamp ? gl(r) : void 0;
}, "getPrecedingUpgrade");

// src/telemetry/fetch.ts
var ga = global.fetch;

// src/telemetry/session-id.ts
var Sn = require("storybook/internal/common");
var bl = 1e3 * 60 * 60 * 2, mt;
var Cn = /* @__PURE__ */ o(async () => {
  let t = Date.now();
  if (!mt) {
    let e = await Sn.cache.get("session");
    e && e.lastUsed >= t - bl ? mt = e.id : mt = ft();
  }
  return await Sn.cache.set("session", { id: mt, lastUsed: t }), mt;
}, "getSessionId");

// src/telemetry/telemetry.ts
var _l = (0, ba.default)(ga), wl = process.env.STORYBOOK_TELEMETRY_URL || "https://storybook.js.org/event-log", ur = [], _a = /* @__PURE__ */ o(
(t, e) => {
  Pn[t] = e;
}, "addToGlobalContext"), kl = /* @__PURE__ */ o(() => {
  try {
    let t = xa.platform();
    return t === "win32" ? "Windows" : t === "darwin" ? "macOS" : t === "linux" ? "Linux" : `Other: ${t}`;
  } catch {
    return "Unknown";
  }
}, "getOperatingSystem"), Pn = {
  inCI: (0, va.isCI)(),
  isTTY: process.stdout.isTTY,
  platform: kl(),
  nodeVersion: process.versions.node,
  storybookVersion: wt
}, Tl = /* @__PURE__ */ o(async (t, e, r) => {
  let { eventType: n, payload: s, metadata: i, ...a } = t, c = await Cn(), p = ft(), l = { ...a, eventType: n, eventId: p, sessionId: c, metadata: i,
  payload: s, context: e };
  return _l(wl, {
    method: "post",
    body: JSON.stringify(l),
    headers: { "Content-Type": "application/json" },
    retries: 3,
    retryOn: [503, 504],
    retryDelay: /* @__PURE__ */ o((f) => 2 ** f * (typeof r?.retryDelay == "number" && !Number.isNaN(r?.retryDelay) ? r.retryDelay : 1e3), "\
retryDelay")
  });
}, "prepareRequest");
async function wa(t, e = { retryDelay: 1e3, immediate: !1 }) {
  let { eventType: r, payload: n, metadata: s, ...i } = t, a = e.stripMetadata ? Pn : {
    ...Pn,
    anonymousId: fa()
  }, c;
  try {
    c = Tl(t, a, e), ur.push(c), e.immediate ? await Promise.all(ur) : await c;
    let p = await Cn(), l = ft(), f = { ...i, eventType: r, eventId: l, sessionId: p, metadata: s, payload: n, context: a };
    await ha(r, f);
  } catch {
  } finally {
    ur = ur.filter((p) => p !== c);
  }
}
o(wa, "sendTelemetry");

// src/telemetry/index.ts
var Il = /* @__PURE__ */ o((t) => t.startsWith("example-button--") || t.startsWith("example-header--") || t.startsWith("example-page--"), "i\
sExampleStoryId"), Sl = /* @__PURE__ */ o(async (t, e = {}, r = {}) => {
  t !== "boot" && r.notify !== !1 && await Ln();
  let n = {
    eventType: t,
    payload: e
  };
  try {
    r?.stripMetadata || (n.metadata = await kn(r?.configDir));
  } catch (s) {
    n.payload.metadataErrorMessage = Ge(s).message, r?.enableCrashReports && (n.payload.metadataError = Ge(s));
  } finally {
    let { error: s } = n.payload;
    s && (n.payload.error = Ge(s)), (!n.payload.error || r?.enableCrashReports) && (process.env?.STORYBOOK_TELEMETRY_DEBUG && (En.logger.info(
    `
[telemetry]`), En.logger.info(JSON.stringify(n, null, 2))), await wa(n, r));
  }
}, "telemetry");
