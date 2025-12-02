import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var Lo = Object.create;
var Kt = Object.defineProperty;
var Mo = Object.getOwnPropertyDescriptor;
var Uo = Object.getOwnPropertyNames;
var $o = Object.getPrototypeOf, Vo = Object.prototype.hasOwnProperty;
var o = (t, e) => Kt(t, "name", { value: e, configurable: !0 }), O = /* @__PURE__ */ ((t) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(t, {
  get: (e, r) => (typeof require < "u" ? require : e)[r]
}) : t)(function(t) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + t + '" is not supported');
});
var dn = (t, e) => () => (t && (e = t(t = 0)), e);
var I = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
var Fo = (t, e, r, n) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let s of Uo(e))
      !Vo.call(t, s) && s !== r && Kt(t, s, { get: () => e[s], enumerable: !(n = Mo(e, s)) || n.enumerable });
  return t;
};
var H = (t, e, r) => (r = t != null ? Lo($o(t)) : {}, Fo(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? Kt(r, "default", { value: t, enumerable: !0 }) : r,
  t
));

// ../node_modules/picocolors/picocolors.js
var pn = I((Fl, Yt) => {
  var ot = process || {}, un = ot.argv || [], it = ot.env || {}, Bo = !(it.NO_COLOR || un.includes("--no-color")) && (!!it.FORCE_COLOR || un.
  includes("--color") || ot.platform === "win32" || (ot.stdout || {}).isTTY && it.TERM !== "dumb" || !!it.CI), qo = /* @__PURE__ */ o((t, e, r = t) => (n) => {
    let s = "" + n, i = s.indexOf(e, t.length);
    return ~i ? t + zo(s, e, r, i) + e : t + s + e;
  }, "formatter"), zo = /* @__PURE__ */ o((t, e, r, n) => {
    let s = "", i = 0;
    do
      s += t.substring(i, n) + r, i = n + e.length, n = t.indexOf(e, i);
    while (~n);
    return s + t.substring(i);
  }, "replaceClose"), ln = /* @__PURE__ */ o((t = Bo) => {
    let e = t ? qo : () => String;
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
  Yt.exports = ln();
  Yt.exports.createColors = ln;
});

// ../node_modules/walk-up-path/dist/cjs/index.js
var _n = I((dt) => {
  "use strict";
  Object.defineProperty(dt, "__esModule", { value: !0 });
  dt.walkUp = void 0;
  var bn = O("path"), Wo = /* @__PURE__ */ o(function* (t) {
    for (t = (0, bn.resolve)(t); t; ) {
      yield t;
      let e = (0, bn.dirname)(t);
      if (e === t)
        break;
      t = e;
    }
  }, "walkUp");
  dt.walkUp = Wo;
});

// ../node_modules/ts-dedent/dist/index.js
var In = I((Le) => {
  "use strict";
  Object.defineProperty(Le, "__esModule", { value: !0 });
  Le.dedent = void 0;
  function Tn(t) {
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
  o(Tn, "dedent");
  Le.dedent = Tn;
  Le.default = Tn;
});

// ../node_modules/zod/lib/helpers/util.js
var Me = I((C) => {
  "use strict";
  Object.defineProperty(C, "__esModule", { value: !0 });
  C.getParsedType = C.ZodParsedType = C.objectUtil = C.util = void 0;
  var Qt;
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
  })(Qt || (C.util = Qt = {}));
  var Sn;
  (function(t) {
    t.mergeShapes = (e, r) => ({
      ...e,
      ...r
      // second overwrites first
    });
  })(Sn || (C.objectUtil = Sn = {}));
  C.ZodParsedType = Qt.arrayToEnum([
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
  var Qo = /* @__PURE__ */ o((t) => {
    switch (typeof t) {
      case "undefined":
        return C.ZodParsedType.undefined;
      case "string":
        return C.ZodParsedType.string;
      case "number":
        return isNaN(t) ? C.ZodParsedType.nan : C.ZodParsedType.number;
      case "boolean":
        return C.ZodParsedType.boolean;
      case "function":
        return C.ZodParsedType.function;
      case "bigint":
        return C.ZodParsedType.bigint;
      case "symbol":
        return C.ZodParsedType.symbol;
      case "object":
        return Array.isArray(t) ? C.ZodParsedType.array : t === null ? C.ZodParsedType.null : t.then && typeof t.then == "function" && t.catch &&
        typeof t.catch == "function" ? C.ZodParsedType.promise : typeof Map < "u" && t instanceof Map ? C.ZodParsedType.map : typeof Set < "\
u" && t instanceof Set ? C.ZodParsedType.set : typeof Date < "u" && t instanceof Date ? C.ZodParsedType.date : C.ZodParsedType.object;
      default:
        return C.ZodParsedType.unknown;
    }
  }, "getParsedType");
  C.getParsedType = Qo;
});

// ../node_modules/zod/lib/ZodError.js
var lt = I((K) => {
  "use strict";
  Object.defineProperty(K, "__esModule", { value: !0 });
  K.ZodError = K.quotelessJson = K.ZodIssueCode = void 0;
  var Cn = Me();
  K.ZodIssueCode = Cn.util.arrayToEnum([
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
  var ea = /* @__PURE__ */ o((t) => JSON.stringify(t, null, 2).replace(/"([^"]+)":/g, "$1:"), "quotelessJson");
  K.quotelessJson = ea;
  var Ue = class t extends Error {
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
      return JSON.stringify(this.issues, Cn.util.jsonStringifyReplacer, 2);
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
  K.ZodError = Ue;
  Ue.create = (t) => new Ue(t);
});

// ../node_modules/zod/lib/locales/en.js
var tr = I((er) => {
  "use strict";
  Object.defineProperty(er, "__esModule", { value: !0 });
  var te = Me(), A = lt(), ta = /* @__PURE__ */ o((t, e) => {
    let r;
    switch (t.code) {
      case A.ZodIssueCode.invalid_type:
        t.received === te.ZodParsedType.undefined ? r = "Required" : r = `Expected ${t.expected}, received ${t.received}`;
        break;
      case A.ZodIssueCode.invalid_literal:
        r = `Invalid literal value, expected ${JSON.stringify(t.expected, te.util.jsonStringifyReplacer)}`;
        break;
      case A.ZodIssueCode.unrecognized_keys:
        r = `Unrecognized key(s) in object: ${te.util.joinValues(t.keys, ", ")}`;
        break;
      case A.ZodIssueCode.invalid_union:
        r = "Invalid input";
        break;
      case A.ZodIssueCode.invalid_union_discriminator:
        r = `Invalid discriminator value. Expected ${te.util.joinValues(t.options)}`;
        break;
      case A.ZodIssueCode.invalid_enum_value:
        r = `Invalid enum value. Expected ${te.util.joinValues(t.options)}, received '${t.received}'`;
        break;
      case A.ZodIssueCode.invalid_arguments:
        r = "Invalid function arguments";
        break;
      case A.ZodIssueCode.invalid_return_type:
        r = "Invalid function return type";
        break;
      case A.ZodIssueCode.invalid_date:
        r = "Invalid date";
        break;
      case A.ZodIssueCode.invalid_string:
        typeof t.validation == "object" ? "includes" in t.validation ? (r = `Invalid input: must include "${t.validation.includes}"`, typeof t.
        validation.position == "number" && (r = `${r} at one or more positions greater than or equal to ${t.validation.position}`)) : "start\
sWith" in t.validation ? r = `Invalid input: must start with "${t.validation.startsWith}"` : "endsWith" in t.validation ? r = `Invalid input\
: must end with "${t.validation.endsWith}"` : te.util.assertNever(t.validation) : t.validation !== "regex" ? r = `Invalid ${t.validation}` :
        r = "Invalid";
        break;
      case A.ZodIssueCode.too_small:
        t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "more than"} ${t.minimum} element(s)` :
        t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "over"} ${t.minimum} character(s)` :
        t.type === "number" ? r = `Number must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "greater tha\
n "}${t.minimum}` : t.type === "date" ? r = `Date must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "gre\
ater than "}${new Date(Number(t.minimum))}` : r = "Invalid input";
        break;
      case A.ZodIssueCode.too_big:
        t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "less than"} ${t.maximum} element(s)` :
        t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "under"} ${t.maximum} character(s)` :
        t.type === "number" ? r = `Number must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` :
        t.type === "bigint" ? r = `BigInt must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` :
        t.type === "date" ? r = `Date must be ${t.exact ? "exactly" : t.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(
        Number(t.maximum))}` : r = "Invalid input";
        break;
      case A.ZodIssueCode.custom:
        r = "Invalid input";
        break;
      case A.ZodIssueCode.invalid_intersection_types:
        r = "Intersection results could not be merged";
        break;
      case A.ZodIssueCode.not_multiple_of:
        r = `Number must be a multiple of ${t.multipleOf}`;
        break;
      case A.ZodIssueCode.not_finite:
        r = "Number must be finite";
        break;
      default:
        r = e.defaultError, te.util.assertNever(t);
    }
    return { message: r };
  }, "errorMap");
  er.default = ta;
});

// ../node_modules/zod/lib/errors.js
var pt = I((V) => {
  "use strict";
  var ra = V && V.__importDefault || function(t) {
    return t && t.__esModule ? t : { default: t };
  };
  Object.defineProperty(V, "__esModule", { value: !0 });
  V.getErrorMap = V.setErrorMap = V.defaultErrorMap = void 0;
  var Pn = ra(tr());
  V.defaultErrorMap = Pn.default;
  var En = Pn.default;
  function na(t) {
    En = t;
  }
  o(na, "setErrorMap");
  V.setErrorMap = na;
  function sa() {
    return En;
  }
  o(sa, "getErrorMap");
  V.getErrorMap = sa;
});

// ../node_modules/zod/lib/helpers/parseUtil.js
var nr = I((T) => {
  "use strict";
  var ia = T && T.__importDefault || function(t) {
    return t && t.__esModule ? t : { default: t };
  };
  Object.defineProperty(T, "__esModule", { value: !0 });
  T.isAsync = T.isValid = T.isDirty = T.isAborted = T.OK = T.DIRTY = T.INVALID = T.ParseStatus = T.addIssueToContext = T.EMPTY_PATH = T.makeIssue =
  void 0;
  var oa = pt(), jn = ia(tr()), aa = /* @__PURE__ */ o((t) => {
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
  T.makeIssue = aa;
  T.EMPTY_PATH = [];
  function ca(t, e) {
    let r = (0, oa.getErrorMap)(), n = (0, T.makeIssue)({
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
        r === jn.default ? void 0 : jn.default
        // then global default map
      ].filter((s) => !!s)
    });
    t.common.issues.push(n);
  }
  o(ca, "addIssueToContext");
  T.addIssueToContext = ca;
  var rr = class t {
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
          return T.INVALID;
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
          return T.INVALID;
        i.status === "dirty" && e.dirty(), a.status === "dirty" && e.dirty(), i.value !== "__proto__" && (typeof a.value < "u" || s.alwaysSet) &&
        (n[i.value] = a.value);
      }
      return { status: e.value, value: n };
    }
  };
  T.ParseStatus = rr;
  T.INVALID = Object.freeze({
    status: "aborted"
  });
  var da = /* @__PURE__ */ o((t) => ({ status: "dirty", value: t }), "DIRTY");
  T.DIRTY = da;
  var ua = /* @__PURE__ */ o((t) => ({ status: "valid", value: t }), "OK");
  T.OK = ua;
  var la = /* @__PURE__ */ o((t) => t.status === "aborted", "isAborted");
  T.isAborted = la;
  var pa = /* @__PURE__ */ o((t) => t.status === "dirty", "isDirty");
  T.isDirty = pa;
  var fa = /* @__PURE__ */ o((t) => t.status === "valid", "isValid");
  T.isValid = fa;
  var ma = /* @__PURE__ */ o((t) => typeof Promise < "u" && t instanceof Promise, "isAsync");
  T.isAsync = ma;
});

// ../node_modules/zod/lib/helpers/typeAliases.js
var On = I((An) => {
  "use strict";
  Object.defineProperty(An, "__esModule", { value: !0 });
});

// ../node_modules/zod/lib/helpers/errorUtil.js
var Nn = I((ft) => {
  "use strict";
  Object.defineProperty(ft, "__esModule", { value: !0 });
  ft.errorUtil = void 0;
  var Zn;
  (function(t) {
    t.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, t.toString = (e) => typeof e == "string" ? e : e?.message;
  })(Zn || (ft.errorUtil = Zn = {}));
});

// ../node_modules/zod/lib/types.js
var Wn = I((d) => {
  "use strict";
  var ht = d && d.__classPrivateFieldGet || function(t, e, r, n) {
    if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
    if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did n\
ot declare it");
    return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
  }, Ln = d && d.__classPrivateFieldSet || function(t, e, r, n, s) {
    if (n === "m") throw new TypeError("Private method is not writable");
    if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
    if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did no\
t declare it");
    return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
  }, $e, Ve;
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
  var mt = pt(), y = Nn(), u = nr(), h = Me(), m = lt(), L = class {
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
  }, Rn = /* @__PURE__ */ o((t, e) => {
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
      return Rn(s, i);
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
      return Rn(n, i);
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
      return D.create(this, this._def);
    }
    nullable() {
      return B.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return J.create(this);
    }
    promise() {
      return Q.create(this, this._def);
    }
    or(e) {
      return ce.create([this, e], this._def);
    }
    and(e) {
      return de.create(this, e, this._def);
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
      return new me({
        ...v(this._def),
        innerType: this,
        defaultValue: r,
        typeName: g.ZodDefault
      });
    }
    brand() {
      return new Fe({
        typeName: g.ZodBranded,
        type: this,
        ...v(this._def)
      });
    }
    catch(e) {
      let r = typeof e == "function" ? e : () => e;
      return new he({
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
      return Be.create(this, e);
    }
    readonly() {
      return ye.create(this);
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
  var ha = /^c[^\s-]{8,}$/i, ya = /^[0-9a-z]+$/, ga = /^[0-9A-HJKMNP-TV-Z]{26}$/i, xa = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
  va = /^[a-z0-9_-]{21}$/i, ba = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, _a = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
  wa = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, ka = "^(\\p{Extended_Pictographic}|\\p{Emoji_Comp\
onent})+$", sr, Ta = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Ia = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  Sa = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  Ca = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  Pa = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, Ea = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  Mn = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469\
]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", ja = new RegExp(`^${Mn}$`);
  function Un(t) {
    let e = "([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d";
    return t.precision ? e = `${e}\\.\\d{${t.precision}}` : t.precision == null && (e = `${e}(\\.\\d+)?`), e;
  }
  o(Un, "timeRegexSource");
  function Aa(t) {
    return new RegExp(`^${Un(t)}$`);
  }
  o(Aa, "timeRegex");
  function $n(t) {
    let e = `${Mn}T${Un(t)}`, r = [];
    return r.push(t.local ? "Z?" : "Z"), t.offset && r.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${r.join("|")})`, new RegExp(`^${e}$`);
  }
  o($n, "datetimeRegex");
  d.datetimeRegex = $n;
  function Oa(t, e) {
    return !!((e === "v4" || !e) && Ta.test(t) || (e === "v6" || !e) && Sa.test(t));
  }
  o(Oa, "isValidIP");
  function Za(t, e) {
    if (!ba.test(t))
      return !1;
    try {
      let [r] = t.split("."), n = r.replace(/-/g, "+").replace(/_/g, "/").padEnd(r.length + (4 - r.length % 4) % 4, "="), s = JSON.parse(atob(
      n));
      return !(typeof s != "object" || s === null || !s.typ || !s.alg || e && s.alg !== e);
    } catch {
      return !1;
    }
  }
  o(Za, "isValidJWT");
  function Na(t, e) {
    return !!((e === "v4" || !e) && Ia.test(t) || (e === "v6" || !e) && Ca.test(t));
  }
  o(Na, "isValidCidr");
  var Y = class t extends b {
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
          wa.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "email",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "emoji")
          sr || (sr = new RegExp(ka, "u")), sr.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "emoji",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "uuid")
          xa.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "uuid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "nanoid")
          va.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "nanoid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "cuid")
          ha.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "cuid",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "cuid2")
          ya.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
            validation: "cuid2",
            code: m.ZodIssueCode.invalid_string,
            message: i.message
          }), n.dirty());
        else if (i.kind === "ulid")
          ga.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
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
        }), n.dirty()) : i.kind === "datetime" ? $n(i).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "datetime",
          message: i.message
        }), n.dirty()) : i.kind === "date" ? ja.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "date",
          message: i.message
        }), n.dirty()) : i.kind === "time" ? Aa(i).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: m.ZodIssueCode.invalid_string,
          validation: "time",
          message: i.message
        }), n.dirty()) : i.kind === "duration" ? _a.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "duration",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "ip" ? Oa(e.data, i.version) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "ip",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "jwt" ? Za(e.data, i.alg) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "jwt",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "cidr" ? Na(e.data, i.version) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "cidr",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "base64" ? Pa.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          validation: "base64",
          code: m.ZodIssueCode.invalid_string,
          message: i.message
        }), n.dirty()) : i.kind === "base64url" ? Ea.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
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
  d.ZodString = Y;
  Y.create = (t) => {
    var e;
    return new Y({
      checks: [],
      typeName: g.ZodString,
      coerce: (e = t?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(t)
    });
  };
  function Ra(t, e) {
    let r = (t.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, s = r > n ? r : n, i = parseInt(t.toFixed(
    s).replace(".", "")), a = parseInt(e.toFixed(s).replace(".", ""));
    return i % a / Math.pow(10, s);
  }
  o(Ra, "floatSafeRemainder");
  var re = class t extends b {
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
        }), s.dirty()) : i.kind === "multipleOf" ? Ra(e.data, i.value) !== 0 && (n = this._getOrReturnCtx(e, n), (0, u.addIssueToContext)(n,
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
  d.ZodNumber = re;
  re.create = (t) => new re({
    checks: [],
    typeName: g.ZodNumber,
    coerce: t?.coerce || !1,
    ...v(t)
  });
  var ne = class t extends b {
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
  d.ZodBigInt = ne;
  ne.create = (t) => {
    var e;
    return new ne({
      checks: [],
      typeName: g.ZodBigInt,
      coerce: (e = t?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(t)
    });
  };
  var se = class extends b {
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
  d.ZodBoolean = se;
  se.create = (t) => new se({
    typeName: g.ZodBoolean,
    coerce: t?.coerce || !1,
    ...v(t)
  });
  var ie = class t extends b {
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
  d.ZodDate = ie;
  ie.create = (t) => new ie({
    checks: [],
    coerce: t?.coerce || !1,
    typeName: g.ZodDate,
    ...v(t)
  });
  var we = class extends b {
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
  d.ZodSymbol = we;
  we.create = (t) => new we({
    typeName: g.ZodSymbol,
    ...v(t)
  });
  var oe = class extends b {
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
  d.ZodUndefined = oe;
  oe.create = (t) => new oe({
    typeName: g.ZodUndefined,
    ...v(t)
  });
  var ae = class extends b {
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
  d.ZodNull = ae;
  ae.create = (t) => new ae({
    typeName: g.ZodNull,
    ...v(t)
  });
  var X = class extends b {
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
  d.ZodAny = X;
  X.create = (t) => new X({
    typeName: g.ZodAny,
    ...v(t)
  });
  var W = class extends b {
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
  d.ZodUnknown = W;
  W.create = (t) => new W({
    typeName: g.ZodUnknown,
    ...v(t)
  });
  var U = class extends b {
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
  d.ZodNever = U;
  U.create = (t) => new U({
    typeName: g.ZodNever,
    ...v(t)
  });
  var ke = class extends b {
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
  d.ZodVoid = ke;
  ke.create = (t) => new ke({
    typeName: g.ZodVoid,
    ...v(t)
  });
  var J = class t extends b {
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
        return Promise.all([...r.data].map((a, c) => s.type._parseAsync(new L(r, a, r.path, c)))).then((a) => u.ParseStatus.mergeArray(n, a));
      let i = [...r.data].map((a, c) => s.type._parseSync(new L(r, a, r.path, c)));
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
  d.ZodArray = J;
  J.create = (t, e) => new J({
    type: t,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: g.ZodArray,
    ...v(e)
  });
  function _e(t) {
    if (t instanceof Z) {
      let e = {};
      for (let r in t.shape) {
        let n = t.shape[r];
        e[r] = D.create(_e(n));
      }
      return new Z({
        ...t._def,
        shape: /* @__PURE__ */ o(() => e, "shape")
      });
    } else return t instanceof J ? new J({
      ...t._def,
      type: _e(t.element)
    }) : t instanceof D ? D.create(_e(t.unwrap())) : t instanceof B ? B.create(_e(t.unwrap())) : t instanceof F ? F.create(t.items.map((e) => _e(
    e))) : t;
  }
  o(_e, "deepPartialify");
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
      if (!(this._def.catchall instanceof U && this._def.unknownKeys === "strip"))
        for (let l in s.data)
          a.includes(l) || c.push(l);
      let p = [];
      for (let l of a) {
        let f = i[l], x = s.data[l];
        p.push({
          key: { status: "valid", value: l },
          value: f._parse(new L(s, x, s.path, l)),
          alwaysSet: l in s.data
        });
      }
      if (this._def.catchall instanceof U) {
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
              new L(s, x, s.path, f)
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
      return _e(this);
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
          for (; i instanceof D; )
            i = i._def.innerType;
          r[n] = i;
        }
      }), new t({
        ...this._def,
        shape: /* @__PURE__ */ o(() => r, "shape")
      });
    }
    keyof() {
      return Vn(h.util.objectKeys(this.shape));
    }
  };
  d.ZodObject = Z;
  Z.create = (t, e) => new Z({
    shape: /* @__PURE__ */ o(() => t, "shape"),
    unknownKeys: "strip",
    catchall: U.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  Z.strictCreate = (t, e) => new Z({
    shape: /* @__PURE__ */ o(() => t, "shape"),
    unknownKeys: "strict",
    catchall: U.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  Z.lazycreate = (t, e) => new Z({
    shape: t,
    unknownKeys: "strip",
    catchall: U.create(),
    typeName: g.ZodObject,
    ...v(e)
  });
  var ce = class extends b {
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
  d.ZodUnion = ce;
  ce.create = (t, e) => new ce({
    options: t,
    typeName: g.ZodUnion,
    ...v(e)
  });
  var G = /* @__PURE__ */ o((t) => t instanceof ue ? G(t.schema) : t instanceof R ? G(t.innerType()) : t instanceof le ? [t.value] : t instanceof
  pe ? t.options : t instanceof fe ? h.util.objectValues(t.enum) : t instanceof me ? G(t._def.innerType) : t instanceof oe ? [void 0] : t instanceof
  ae ? [null] : t instanceof D ? [void 0, ...G(t.unwrap())] : t instanceof B ? [null, ...G(t.unwrap())] : t instanceof Fe || t instanceof ye ?
  G(t.unwrap()) : t instanceof he ? G(t._def.innerType) : [], "getDiscriminator"), yt = class t extends b {
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
        let a = G(i.shape[e]);
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
  d.ZodDiscriminatedUnion = yt;
  function ir(t, e) {
    let r = (0, h.getParsedType)(t), n = (0, h.getParsedType)(e);
    if (t === e)
      return { valid: !0, data: t };
    if (r === h.ZodParsedType.object && n === h.ZodParsedType.object) {
      let s = h.util.objectKeys(e), i = h.util.objectKeys(t).filter((c) => s.indexOf(c) !== -1), a = { ...t, ...e };
      for (let c of i) {
        let p = ir(t[c], e[c]);
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
        let a = t[i], c = e[i], p = ir(a, c);
        if (!p.valid)
          return { valid: !1 };
        s.push(p.data);
      }
      return { valid: !0, data: s };
    } else return r === h.ZodParsedType.date && n === h.ZodParsedType.date && +t == +e ? { valid: !0, data: t } : { valid: !1 };
  }
  o(ir, "mergeValues");
  var de = class extends b {
    static {
      o(this, "ZodIntersection");
    }
    _parse(e) {
      let { status: r, ctx: n } = this._processInputParams(e), s = /* @__PURE__ */ o((i, a) => {
        if ((0, u.isAborted)(i) || (0, u.isAborted)(a))
          return u.INVALID;
        let c = ir(i.value, a.value);
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
  d.ZodIntersection = de;
  de.create = (t, e, r) => new de({
    left: t,
    right: e,
    typeName: g.ZodIntersection,
    ...v(r)
  });
  var F = class t extends b {
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
        return p ? p._parse(new L(n, a, n.path, c)) : null;
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
  d.ZodTuple = F;
  F.create = (t, e) => {
    if (!Array.isArray(t))
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    return new F({
      items: t,
      typeName: g.ZodTuple,
      rest: null,
      ...v(e)
    });
  };
  var gt = class t extends b {
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
          key: i._parse(new L(n, c, n.path, c)),
          value: a._parse(new L(n, n.data[c], n.path, c)),
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
        keyType: Y.create(),
        valueType: e,
        typeName: g.ZodRecord,
        ...v(r)
      });
    }
  };
  d.ZodRecord = gt;
  var Te = class extends b {
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
        key: s._parse(new L(n, c, n.path, [l, "key"])),
        value: i._parse(new L(n, p, n.path, [l, "value"]))
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
  d.ZodMap = Te;
  Te.create = (t, e, r) => new Te({
    valueType: e,
    keyType: t,
    typeName: g.ZodMap,
    ...v(r)
  });
  var Ie = class t extends b {
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
      let c = [...n.data.values()].map((p, l) => i._parse(new L(n, p, n.path, l)));
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
  d.ZodSet = Ie;
  Ie.create = (t, e) => new Ie({
    valueType: t,
    minSize: null,
    maxSize: null,
    typeName: g.ZodSet,
    ...v(e)
  });
  var xt = class t extends b {
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
            (0, mt.getErrorMap)(),
            mt.defaultErrorMap
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
            (0, mt.getErrorMap)(),
            mt.defaultErrorMap
          ].filter((l) => !!l),
          issueData: {
            code: m.ZodIssueCode.invalid_return_type,
            returnTypeError: p
          }
        });
      }
      o(s, "makeReturnsIssue");
      let i = { errorMap: r.common.contextualErrorMap }, a = r.data;
      if (this._def.returns instanceof Q) {
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
        args: F.create(e).rest(W.create())
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
        args: e || F.create([]).rest(W.create()),
        returns: r || W.create(),
        typeName: g.ZodFunction,
        ...v(n)
      });
    }
  };
  d.ZodFunction = xt;
  var ue = class extends b {
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
  d.ZodLazy = ue;
  ue.create = (t, e) => new ue({
    getter: t,
    typeName: g.ZodLazy,
    ...v(e)
  });
  var le = class extends b {
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
  d.ZodLiteral = le;
  le.create = (t, e) => new le({
    value: t,
    typeName: g.ZodLiteral,
    ...v(e)
  });
  function Vn(t, e) {
    return new pe({
      values: t,
      typeName: g.ZodEnum,
      ...v(e)
    });
  }
  o(Vn, "createZodEnum");
  var pe = class t extends b {
    static {
      o(this, "ZodEnum");
    }
    constructor() {
      super(...arguments), $e.set(this, void 0);
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
      if (ht(this, $e, "f") || Ln(this, $e, new Set(this._def.values), "f"), !ht(this, $e, "f").has(e.data)) {
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
  d.ZodEnum = pe;
  $e = /* @__PURE__ */ new WeakMap();
  pe.create = Vn;
  var fe = class extends b {
    static {
      o(this, "ZodNativeEnum");
    }
    constructor() {
      super(...arguments), Ve.set(this, void 0);
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
      if (ht(this, Ve, "f") || Ln(this, Ve, new Set(h.util.getValidEnumValues(this._def.values)), "f"), !ht(this, Ve, "f").has(e.data)) {
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
  d.ZodNativeEnum = fe;
  Ve = /* @__PURE__ */ new WeakMap();
  fe.create = (t, e) => new fe({
    values: t,
    typeName: g.ZodNativeEnum,
    ...v(e)
  });
  var Q = class extends b {
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
  d.ZodPromise = Q;
  Q.create = (t, e) => new Q({
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
  var D = class extends b {
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
  d.ZodOptional = D;
  D.create = (t, e) => new D({
    innerType: t,
    typeName: g.ZodOptional,
    ...v(e)
  });
  var B = class extends b {
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
  d.ZodNullable = B;
  B.create = (t, e) => new B({
    innerType: t,
    typeName: g.ZodNullable,
    ...v(e)
  });
  var me = class extends b {
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
  d.ZodDefault = me;
  me.create = (t, e) => new me({
    innerType: t,
    typeName: g.ZodDefault,
    defaultValue: typeof e.default == "function" ? e.default : () => e.default,
    ...v(e)
  });
  var he = class extends b {
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
  d.ZodCatch = he;
  he.create = (t, e) => new he({
    innerType: t,
    typeName: g.ZodCatch,
    catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
    ...v(e)
  });
  var Se = class extends b {
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
  d.ZodNaN = Se;
  Se.create = (t) => new Se({
    typeName: g.ZodNaN,
    ...v(t)
  });
  d.BRAND = Symbol("zod_brand");
  var Fe = class extends b {
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
  d.ZodBranded = Fe;
  var Be = class t extends b {
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
  d.ZodPipeline = Be;
  var ye = class extends b {
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
  d.ZodReadonly = ye;
  ye.create = (t, e) => new ye({
    innerType: t,
    typeName: g.ZodReadonly,
    ...v(e)
  });
  function Dn(t, e) {
    let r = typeof t == "function" ? t(e) : typeof t == "string" ? { message: t } : t;
    return typeof r == "string" ? { message: r } : r;
  }
  o(Dn, "cleanParams");
  function Fn(t, e = {}, r) {
    return t ? X.create().superRefine((n, s) => {
      var i, a;
      let c = t(n);
      if (c instanceof Promise)
        return c.then((p) => {
          var l, f;
          if (!p) {
            let x = Dn(e, n), w = (f = (l = x.fatal) !== null && l !== void 0 ? l : r) !== null && f !== void 0 ? f : !0;
            s.addIssue({ code: "custom", ...x, fatal: w });
          }
        });
      if (!c) {
        let p = Dn(e, n), l = (a = (i = p.fatal) !== null && i !== void 0 ? i : r) !== null && a !== void 0 ? a : !0;
        s.addIssue({ code: "custom", ...p, fatal: l });
      }
    }) : X.create();
  }
  o(Fn, "custom");
  d.custom = Fn;
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
  var Da = /* @__PURE__ */ o((t, e = {
    message: `Input not instance of ${t.name}`
  }) => Fn((r) => r instanceof t, e), "instanceOfType");
  d.instanceof = Da;
  var Bn = Y.create;
  d.string = Bn;
  var qn = re.create;
  d.number = qn;
  var La = Se.create;
  d.nan = La;
  var Ma = ne.create;
  d.bigint = Ma;
  var zn = se.create;
  d.boolean = zn;
  var Ua = ie.create;
  d.date = Ua;
  var $a = we.create;
  d.symbol = $a;
  var Va = oe.create;
  d.undefined = Va;
  var Fa = ae.create;
  d.null = Fa;
  var Ba = X.create;
  d.any = Ba;
  var qa = W.create;
  d.unknown = qa;
  var za = U.create;
  d.never = za;
  var Ga = ke.create;
  d.void = Ga;
  var Wa = J.create;
  d.array = Wa;
  var Ja = Z.create;
  d.object = Ja;
  var Ha = Z.strictCreate;
  d.strictObject = Ha;
  var Ka = ce.create;
  d.union = Ka;
  var Ya = yt.create;
  d.discriminatedUnion = Ya;
  var Xa = de.create;
  d.intersection = Xa;
  var Qa = F.create;
  d.tuple = Qa;
  var ec = gt.create;
  d.record = ec;
  var tc = Te.create;
  d.map = tc;
  var rc = Ie.create;
  d.set = rc;
  var nc = xt.create;
  d.function = nc;
  var sc = ue.create;
  d.lazy = sc;
  var ic = le.create;
  d.literal = ic;
  var oc = pe.create;
  d.enum = oc;
  var ac = fe.create;
  d.nativeEnum = ac;
  var cc = Q.create;
  d.promise = cc;
  var Gn = R.create;
  d.effect = Gn;
  d.transformer = Gn;
  var dc = D.create;
  d.optional = dc;
  var uc = B.create;
  d.nullable = uc;
  var lc = R.createWithPreprocess;
  d.preprocess = lc;
  var pc = Be.create;
  d.pipeline = pc;
  var fc = /* @__PURE__ */ o(() => Bn().optional(), "ostring");
  d.ostring = fc;
  var mc = /* @__PURE__ */ o(() => qn().optional(), "onumber");
  d.onumber = mc;
  var hc = /* @__PURE__ */ o(() => zn().optional(), "oboolean");
  d.oboolean = hc;
  d.coerce = {
    string: /* @__PURE__ */ o((t) => Y.create({ ...t, coerce: !0 }), "string"),
    number: /* @__PURE__ */ o((t) => re.create({ ...t, coerce: !0 }), "number"),
    boolean: /* @__PURE__ */ o((t) => se.create({
      ...t,
      coerce: !0
    }), "boolean"),
    bigint: /* @__PURE__ */ o((t) => ne.create({ ...t, coerce: !0 }), "bigint"),
    date: /* @__PURE__ */ o((t) => ie.create({ ...t, coerce: !0 }), "date")
  };
  d.NEVER = u.INVALID;
});

// ../node_modules/zod/lib/external.js
var or = I((M) => {
  "use strict";
  var yc = M && M.__createBinding || (Object.create ? function(t, e, r, n) {
    n === void 0 && (n = r);
    var s = Object.getOwnPropertyDescriptor(e, r);
    (!s || ("get" in s ? !e.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: /* @__PURE__ */ o(function() {
      return e[r];
    }, "get") }), Object.defineProperty(t, n, s);
  } : function(t, e, r, n) {
    n === void 0 && (n = r), t[n] = e[r];
  }), Ce = M && M.__exportStar || function(t, e) {
    for (var r in t) r !== "default" && !Object.prototype.hasOwnProperty.call(e, r) && yc(e, t, r);
  };
  Object.defineProperty(M, "__esModule", { value: !0 });
  Ce(pt(), M);
  Ce(nr(), M);
  Ce(On(), M);
  Ce(Me(), M);
  Ce(Wn(), M);
  Ce(lt(), M);
});

// ../node_modules/zod/lib/index.js
var Kn = I((N) => {
  "use strict";
  var Jn = N && N.__createBinding || (Object.create ? function(t, e, r, n) {
    n === void 0 && (n = r);
    var s = Object.getOwnPropertyDescriptor(e, r);
    (!s || ("get" in s ? !e.__esModule : s.writable || s.configurable)) && (s = { enumerable: !0, get: /* @__PURE__ */ o(function() {
      return e[r];
    }, "get") }), Object.defineProperty(t, n, s);
  } : function(t, e, r, n) {
    n === void 0 && (n = r), t[n] = e[r];
  }), gc = N && N.__setModuleDefault || (Object.create ? function(t, e) {
    Object.defineProperty(t, "default", { enumerable: !0, value: e });
  } : function(t, e) {
    t.default = e;
  }), xc = N && N.__importStar || function(t) {
    if (t && t.__esModule) return t;
    var e = {};
    if (t != null) for (var r in t) r !== "default" && Object.prototype.hasOwnProperty.call(t, r) && Jn(e, t, r);
    return gc(e, t), e;
  }, vc = N && N.__exportStar || function(t, e) {
    for (var r in t) r !== "default" && !Object.prototype.hasOwnProperty.call(e, r) && Jn(e, t, r);
  };
  Object.defineProperty(N, "__esModule", { value: !0 });
  N.z = void 0;
  var Hn = xc(or());
  N.z = Hn;
  vc(or(), N);
  N.default = Hn;
});

// ../node_modules/isexe/windows.js
var ns = I((Op, rs) => {
  rs.exports = ts;
  ts.sync = Cc;
  var Qn = O("fs");
  function Sc(t, e) {
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
  o(Sc, "checkPathExt");
  function es(t, e, r) {
    return !t.isSymbolicLink() && !t.isFile() ? !1 : Sc(e, r);
  }
  o(es, "checkStat");
  function ts(t, e, r) {
    Qn.stat(t, function(n, s) {
      r(n, n ? !1 : es(s, t, e));
    });
  }
  o(ts, "isexe");
  function Cc(t, e) {
    return es(Qn.statSync(t), t, e);
  }
  o(Cc, "sync");
});

// ../node_modules/isexe/mode.js
var cs = I((Np, as) => {
  as.exports = is;
  is.sync = Pc;
  var ss = O("fs");
  function is(t, e, r) {
    ss.stat(t, function(n, s) {
      r(n, n ? !1 : os(s, e));
    });
  }
  o(is, "isexe");
  function Pc(t, e) {
    return os(ss.statSync(t), e);
  }
  o(Pc, "sync");
  function os(t, e) {
    return t.isFile() && Ec(t, e);
  }
  o(os, "checkStat");
  function Ec(t, e) {
    var r = t.mode, n = t.uid, s = t.gid, i = e.uid !== void 0 ? e.uid : process.getuid && process.getuid(), a = e.gid !== void 0 ? e.gid : process.
    getgid && process.getgid(), c = parseInt("100", 8), p = parseInt("010", 8), l = parseInt("001", 8), f = c | p, x = r & l || r & p && s ===
    a || r & c && n === i || r & f && i === 0;
    return x;
  }
  o(Ec, "checkMode");
});

// ../node_modules/isexe/index.js
var us = I((Lp, ds) => {
  var Dp = O("fs"), bt;
  process.platform === "win32" || global.TESTING_WINDOWS ? bt = ns() : bt = cs();
  ds.exports = cr;
  cr.sync = jc;
  function cr(t, e, r) {
    if (typeof e == "function" && (r = e, e = {}), !r) {
      if (typeof Promise != "function")
        throw new TypeError("callback not provided");
      return new Promise(function(n, s) {
        cr(t, e || {}, function(i, a) {
          i ? s(i) : n(a);
        });
      });
    }
    bt(t, e || {}, function(n, s) {
      n && (n.code === "EACCES" || e && e.ignoreErrors) && (n = null, s = !1), r(n, s);
    });
  }
  o(cr, "isexe");
  function jc(t, e) {
    try {
      return bt.sync(t, e || {});
    } catch (r) {
      if (e && e.ignoreErrors || r.code === "EACCES")
        return !1;
      throw r;
    }
  }
  o(jc, "sync");
});

// ../node_modules/which/which.js
var gs = I((Up, ys) => {
  var je = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", ls = O("path"), Ac = je ? ";" :
  ":", ps = us(), fs = /* @__PURE__ */ o((t) => Object.assign(new Error(`not found: ${t}`), { code: "ENOENT" }), "getNotFoundError"), ms = /* @__PURE__ */ o(
  (t, e) => {
    let r = e.colon || Ac, n = t.match(/\//) || je && t.match(/\\/) ? [""] : [
      // windows always checks the cwd first
      ...je ? [process.cwd()] : [],
      ...(e.path || process.env.PATH || /* istanbul ignore next: very unusual */
      "").split(r)
    ], s = je ? e.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", i = je ? s.split(r) : [""];
    return je && t.indexOf(".") !== -1 && i[0] !== "" && i.unshift(""), {
      pathEnv: n,
      pathExt: i,
      pathExtExe: s
    };
  }, "getPathInfo"), hs = /* @__PURE__ */ o((t, e, r) => {
    typeof e == "function" && (r = e, e = {}), e || (e = {});
    let { pathEnv: n, pathExt: s, pathExtExe: i } = ms(t, e), a = [], c = /* @__PURE__ */ o((l) => new Promise((f, x) => {
      if (l === n.length)
        return e.all && a.length ? f(a) : x(fs(t));
      let w = n[l], _ = /^".*"$/.test(w) ? w.slice(1, -1) : w, P = ls.join(_, t), S = !_ && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + P : P;
      f(p(S, l, 0));
    }), "step"), p = /* @__PURE__ */ o((l, f, x) => new Promise((w, _) => {
      if (x === s.length)
        return w(c(f + 1));
      let P = s[x];
      ps(l + P, { pathExt: i }, (S, E) => {
        if (!S && E)
          if (e.all)
            a.push(l + P);
          else
            return w(l + P);
        return w(p(l, f, x + 1));
      });
    }), "subStep");
    return r ? c(0).then((l) => r(null, l), r) : c(0);
  }, "which"), Oc = /* @__PURE__ */ o((t, e) => {
    e = e || {};
    let { pathEnv: r, pathExt: n, pathExtExe: s } = ms(t, e), i = [];
    for (let a = 0; a < r.length; a++) {
      let c = r[a], p = /^".*"$/.test(c) ? c.slice(1, -1) : c, l = ls.join(p, t), f = !p && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + l : l;
      for (let x = 0; x < n.length; x++) {
        let w = f + n[x];
        try {
          if (ps.sync(w, { pathExt: s }))
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
    throw fs(t);
  }, "whichSync");
  ys.exports = hs;
  hs.sync = Oc;
});

// ../node_modules/path-key/index.js
var vs = I((Vp, dr) => {
  "use strict";
  var xs = /* @__PURE__ */ o((t = {}) => {
    let e = t.env || process.env;
    return (t.platform || process.platform) !== "win32" ? "PATH" : Object.keys(e).reverse().find((n) => n.toUpperCase() === "PATH") || "Path";
  }, "pathKey");
  dr.exports = xs;
  dr.exports.default = xs;
});

// ../node_modules/cross-spawn/lib/util/resolveCommand.js
var ks = I((Bp, ws) => {
  "use strict";
  var bs = O("path"), Zc = gs(), Nc = vs();
  function _s(t, e) {
    let r = t.options.env || process.env, n = process.cwd(), s = t.options.cwd != null, i = s && process.chdir !== void 0 && !process.chdir.
    disabled;
    if (i)
      try {
        process.chdir(t.options.cwd);
      } catch {
      }
    let a;
    try {
      a = Zc.sync(t.command, {
        path: r[Nc({ env: r })],
        pathExt: e ? bs.delimiter : void 0
      });
    } catch {
    } finally {
      i && process.chdir(n);
    }
    return a && (a = bs.resolve(s ? t.options.cwd : "", a)), a;
  }
  o(_s, "resolveCommandAttempt");
  function Rc(t) {
    return _s(t) || _s(t, !0);
  }
  o(Rc, "resolveCommand");
  ws.exports = Rc;
});

// ../node_modules/cross-spawn/lib/util/escape.js
var Ts = I((zp, lr) => {
  "use strict";
  var ur = /([()\][%!^"`<>&|;, *?])/g;
  function Dc(t) {
    return t = t.replace(ur, "^$1"), t;
  }
  o(Dc, "escapeCommand");
  function Lc(t, e) {
    return t = `${t}`, t = t.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"'), t = t.replace(/(?=(\\+?)?)\1$/, "$1$1"), t = `"${t}"`, t = t.replace(ur,
    "^$1"), e && (t = t.replace(ur, "^$1")), t;
  }
  o(Lc, "escapeArgument");
  lr.exports.command = Dc;
  lr.exports.argument = Lc;
});

// ../node_modules/shebang-regex/index.js
var Ss = I((Wp, Is) => {
  "use strict";
  Is.exports = /^#!(.*)/;
});

// ../node_modules/shebang-command/index.js
var Ps = I((Jp, Cs) => {
  "use strict";
  var Mc = Ss();
  Cs.exports = (t = "") => {
    let e = t.match(Mc);
    if (!e)
      return null;
    let [r, n] = e[0].replace(/#! ?/, "").split(" "), s = r.split("/").pop();
    return s === "env" ? n : n ? `${s} ${n}` : s;
  };
});

// ../node_modules/cross-spawn/lib/util/readShebang.js
var js = I((Hp, Es) => {
  "use strict";
  var pr = O("fs"), Uc = Ps();
  function $c(t) {
    let r = Buffer.alloc(150), n;
    try {
      n = pr.openSync(t, "r"), pr.readSync(n, r, 0, 150, 0), pr.closeSync(n);
    } catch {
    }
    return Uc(r.toString());
  }
  o($c, "readShebang");
  Es.exports = $c;
});

// ../node_modules/cross-spawn/lib/parse.js
var Ns = I((Yp, Zs) => {
  "use strict";
  var Vc = O("path"), As = ks(), Os = Ts(), Fc = js(), Bc = process.platform === "win32", qc = /\.(?:com|exe)$/i, zc = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function Gc(t) {
    t.file = As(t);
    let e = t.file && Fc(t.file);
    return e ? (t.args.unshift(t.file), t.command = e, As(t)) : t.file;
  }
  o(Gc, "detectShebang");
  function Wc(t) {
    if (!Bc)
      return t;
    let e = Gc(t), r = !qc.test(e);
    if (t.options.forceShell || r) {
      let n = zc.test(e);
      t.command = Vc.normalize(t.command), t.command = Os.command(t.command), t.args = t.args.map((i) => Os.argument(i, n));
      let s = [t.command].concat(t.args).join(" ");
      t.args = ["/d", "/s", "/c", `"${s}"`], t.command = process.env.comspec || "cmd.exe", t.options.windowsVerbatimArguments = !0;
    }
    return t;
  }
  o(Wc, "parseNonShell");
  function Jc(t, e, r) {
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
    return r.shell ? n : Wc(n);
  }
  o(Jc, "parse");
  Zs.exports = Jc;
});

// ../node_modules/cross-spawn/lib/enoent.js
var Ls = I((Qp, Ds) => {
  "use strict";
  var fr = process.platform === "win32";
  function mr(t, e) {
    return Object.assign(new Error(`${e} ${t.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${e} ${t.command}`,
      path: t.command,
      spawnargs: t.args
    });
  }
  o(mr, "notFoundError");
  function Hc(t, e) {
    if (!fr)
      return;
    let r = t.emit;
    t.emit = function(n, s) {
      if (n === "exit") {
        let i = Rs(s, e);
        if (i)
          return r.call(t, "error", i);
      }
      return r.apply(t, arguments);
    };
  }
  o(Hc, "hookChildProcess");
  function Rs(t, e) {
    return fr && t === 1 && !e.file ? mr(e.original, "spawn") : null;
  }
  o(Rs, "verifyENOENT");
  function Kc(t, e) {
    return fr && t === 1 && !e.file ? mr(e.original, "spawnSync") : null;
  }
  o(Kc, "verifyENOENTSync");
  Ds.exports = {
    hookChildProcess: Hc,
    verifyENOENT: Rs,
    verifyENOENTSync: Kc,
    notFoundError: mr
  };
});

// ../node_modules/cross-spawn/index.js
var $s = I((tf, Ae) => {
  "use strict";
  var Ms = O("child_process"), hr = Ns(), yr = Ls();
  function Us(t, e, r) {
    let n = hr(t, e, r), s = Ms.spawn(n.command, n.args, n.options);
    return yr.hookChildProcess(s, n), s;
  }
  o(Us, "spawn");
  function Yc(t, e, r) {
    let n = hr(t, e, r), s = Ms.spawnSync(n.command, n.args, n.options);
    return s.error = s.error || yr.verifyENOENTSync(s.status, n), s;
  }
  o(Yc, "spawnSync");
  Ae.exports = Us;
  Ae.exports.spawn = Us;
  Ae.exports.sync = Yc;
  Ae.exports._parse = hr;
  Ae.exports._enoent = yr;
});

// ../node_modules/merge-stream/index.js
var fi = I((Pm, pi) => {
  "use strict";
  var { PassThrough: Hd } = O("stream");
  pi.exports = function() {
    var t = [], e = new Hd({ objectMode: !0 });
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
function Fr(t) {
  return t.startsWith("\\\\?\\") ? t : t.replace(/\\/g, "/");
}
var Oi = dn(() => {
  o(Fr, "slash");
});

// ../node_modules/common-path-prefix/index.js
var Ui = I((Th, Mi) => {
  "use strict";
  var { sep: Iu } = O("path"), Su = /* @__PURE__ */ o((t) => {
    for (let e of t) {
      let r = /(\/|\\)/.exec(e);
      if (r !== null) return r[0];
    }
    return Iu;
  }, "determineSeparator");
  Mi.exports = /* @__PURE__ */ o(function(e, r = Su(e)) {
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
var zr, Ke, $i = dn(() => {
  zr = class {
    static {
      o(this, "Node");
    }
    value;
    next;
    constructor(e) {
      this.value = e;
    }
  }, Ke = class {
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
      let r = new zr(e);
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
var Io = I((Bx, To) => {
  "use strict";
  To.exports = function(t, e) {
    if (e = e || {}, typeof t != "function")
      throw new ee("fetch must be a function");
    if (typeof e != "object")
      throw new ee("defaults must be an object");
    if (e.retries !== void 0 && !Wt(e.retries))
      throw new ee("retries must be a positive integer");
    if (e.retryDelay !== void 0 && !Wt(e.retryDelay) && typeof e.retryDelay != "function")
      throw new ee("retryDelay must be a positive integer or a function returning a positive integer");
    if (e.retryOn !== void 0 && !Array.isArray(e.retryOn) && typeof e.retryOn != "function")
      throw new ee("retryOn property expects an array or function");
    var r = {
      retries: 3,
      retryDelay: 1e3,
      retryOn: []
    };
    return e = Object.assign(r, e), /* @__PURE__ */ o(function(s, i) {
      var a = e.retries, c = e.retryDelay, p = e.retryOn;
      if (i && i.retries !== void 0)
        if (Wt(i.retries))
          a = i.retries;
        else
          throw new ee("retries must be a positive integer");
      if (i && i.retryDelay !== void 0)
        if (Wt(i.retryDelay) || typeof i.retryDelay == "function")
          c = i.retryDelay;
        else
          throw new ee("retryDelay must be a positive integer or a function returning a positive integer");
      if (i && i.retryOn)
        if (Array.isArray(i.retryOn) || typeof i.retryOn == "function")
          p = i.retryOn;
        else
          throw new ee("retryOn property expects an array or function");
      return new Promise(function(l, f) {
        var x = /* @__PURE__ */ o(function(_) {
          var P = typeof Request < "u" && s instanceof Request ? s.clone() : s;
          t(P, i).then(function(S) {
            if (Array.isArray(p) && p.indexOf(S.status) === -1)
              l(S);
            else if (typeof p == "function")
              try {
                return Promise.resolve(p(_, null, S)).then(function(E) {
                  E ? w(_, null, S) : l(S);
                }).catch(f);
              } catch (E) {
                f(E);
              }
            else
              _ < a ? w(_, null, S) : l(S);
          }).catch(function(S) {
            if (typeof p == "function")
              try {
                Promise.resolve(p(_, S, null)).then(function(E) {
                  E ? w(_, S, null) : f(S);
                }).catch(function(E) {
                  f(E);
                });
              } catch (E) {
                f(E);
              }
            else _ < a ? w(_, S, null) : f(S);
          });
        }, "wrappedFetch");
        function w(_, P, S) {
          var E = typeof c == "function" ? c(_, P, S) : c;
          setTimeout(function() {
            x(++_);
          }, E);
        }
        o(w, "retry"), x(0);
      });
    }, "fetchRetry");
  };
  function Wt(t) {
    return Number.isInteger(t) && t >= 0;
  }
  o(Wt, "isPositiveInteger");
  function ee(t) {
    this.name = "ArgumentError", this.message = t;
  }
  o(ee, "ArgumentError");
});

// src/telemetry/index.ts
import { logger as Do } from "storybook/internal/node-logger";

// src/telemetry/notify.ts
var hn = H(pn(), 1);
import { cache as fn } from "storybook/internal/common";
import { CLI_COLORS as Go, logger as at } from "storybook/internal/node-logger";
var mn = "telemetry-notification-date", yn = /* @__PURE__ */ o(async () => {
  await fn.get(mn, null) || (fn.set(mn, Date.now()), at.log(
    `${Go.info("Attention:")} Storybook now collects completely anonymous telemetry regarding usage. This information is used to shape Story\
book's roadmap and prioritize features.`
  ), at.log(
    "You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:"
  ), at.log(hn.default.cyan("https://storybook.js.org/telemetry")), at.log(""));
}, "notify");

// src/telemetry/sanitize.ts
import vn from "node:path";
function gn(t) {
  return t.replace(/[-[/{}()*+?.\\^$|]/g, "\\$&");
}
o(gn, "regexpEscape");
function xn(t = "") {
  return t.replace(/\u001B\[[0-9;]*m/g, "");
}
o(xn, "removeAnsiEscapeCodes");
function De(t, e = vn.sep) {
  if (!t)
    return t;
  let r = process.cwd().split(e);
  for (; r.length > 1; ) {
    let n = r.join(e), s = new RegExp(gn(n), "gi");
    t = t.replace(s, "$SNIP");
    let i = r.join(e + e), a = new RegExp(gn(i), "gi");
    t = t.replace(a, "$SNIP"), r.pop();
  }
  return t;
}
o(De, "cleanPaths");
function ct(t, e = vn.sep) {
  try {
    t = {
      ...JSON.parse(JSON.stringify(t)),
      message: xn(t.message),
      stack: xn(t.stack),
      cause: t.cause,
      name: t.name
    };
    let r = De(JSON.stringify(t), e);
    return JSON.parse(r);
  } catch (r) {
    return `Sanitization error: ${r?.message}`;
  }
}
o(ct, "sanitizeError");

// src/telemetry/storybook-metadata.ts
import { dirname as pl } from "node:path";
import {
  getStorybookConfiguration as fl,
  getStorybookInfo as ml,
  isCI as hl,
  loadMainConfig as yl,
  versions as gl
} from "storybook/internal/common";
import { readConfig as xl } from "storybook/internal/csf-tools";

// ../node_modules/fd-package-json/dist/esm/main.js
var wn = H(_n(), 1);
import { resolve as Jo } from "node:path";
import { stat as Ho, readFile as Ko } from "node:fs/promises";
import { statSync as rp, readFileSync as np } from "node:fs";
async function Yo(t) {
  try {
    return (await Ho(t)).isFile();
  } catch {
    return !1;
  }
}
o(Yo, "fileExists");
async function Xt(t) {
  for (let e of (0, wn.walkUp)(t)) {
    let r = Jo(e, "package.json");
    if (await Yo(r))
      return r;
  }
  return null;
}
o(Xt, "findPackagePath");
async function kn(t) {
  let e = await Xt(t);
  if (!e)
    return null;
  try {
    let r = await Ko(e, { encoding: "utf8" });
    return JSON.parse(r);
  } catch {
    return null;
  }
}
o(kn, "findPackage");

// package.json
var ut = "9.1.13";

// src/cli/globalSettings.ts
var Yn = H(In(), 1), Ee = H(Kn(), 1);
import ar from "node:fs/promises";
import { homedir as bc } from "node:os";
import { dirname as _c, join as wc } from "node:path";
var kc = wc(bc(), ".storybook", "settings.json"), Tc = 1, Ic = Ee.z.object({
  version: Ee.z.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: Ee.z.number().optional(),
  init: Ee.z.object({ skipOnboarding: Ee.z.boolean().optional() }).optional()
}), Pe;
async function Xn(t = kc) {
  if (Pe)
    return Pe;
  try {
    let e = await ar.readFile(t, "utf8"), r = Ic.parse(JSON.parse(e));
    Pe = new vt(t, r);
  } catch {
    Pe = new vt(t, { version: Tc, userSince: Date.now() }), await Pe.save();
  }
  return Pe;
}
o(Xn, "globalSettings");
var vt = class {
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
      await ar.mkdir(_c(this.filePath), { recursive: !0 }), await ar.writeFile(this.filePath, JSON.stringify(this.value, null, 2));
    } catch (e) {
      console.warn(Yn.dedent`
        Unable to save global settings file to ${this.filePath}
        ${e && `Reason: ${e.message ?? e}`}`);
    }
  }
};

// src/telemetry/get-application-file-count.ts
import { sep as Wu } from "node:path";

// src/telemetry/exec-command-count-lines.ts
import { createInterface as xu } from "node:readline";

// node_modules/execa/index.js
var Pi = H($s(), 1);
import { Buffer as pu } from "node:buffer";
import fu from "node:path";
import Vr from "node:child_process";
import Nt from "node:process";

// ../node_modules/strip-final-newline/index.js
function gr(t) {
  let e = typeof t == "string" ? `
` : 10, r = typeof t == "string" ? "\r" : 13;
  return t[t.length - 1] === e && (t = t.slice(0, -1)), t[t.length - 1] === r && (t = t.slice(0, -1)), t;
}
o(gr, "stripFinalNewline");

// node_modules/npm-run-path/index.js
import wt from "node:process";
import qe from "node:path";
import { fileURLToPath as Vs } from "node:url";

// node_modules/path-key/index.js
function _t(t = {}) {
  let {
    env: e = process.env,
    platform: r = process.platform
  } = t;
  return r !== "win32" ? "PATH" : Object.keys(e).reverse().find((n) => n.toUpperCase() === "PATH") || "Path";
}
o(_t, "pathKey");

// node_modules/npm-run-path/index.js
var Xc = /* @__PURE__ */ o(({
  cwd: t = wt.cwd(),
  path: e = wt.env[_t()],
  preferLocal: r = !0,
  execPath: n = wt.execPath,
  addExecPath: s = !0
} = {}) => {
  let i = t instanceof URL ? Vs(t) : t, a = qe.resolve(i), c = [];
  return r && Qc(c, a), s && ed(c, n, a), [...c, e].join(qe.delimiter);
}, "npmRunPath"), Qc = /* @__PURE__ */ o((t, e) => {
  let r;
  for (; r !== e; )
    t.push(qe.join(e, "node_modules/.bin")), r = e, e = qe.resolve(e, "..");
}, "applyPreferLocal"), ed = /* @__PURE__ */ o((t, e, r) => {
  let n = e instanceof URL ? Vs(e) : e;
  t.push(qe.resolve(r, n, ".."));
}, "applyExecPath"), Fs = /* @__PURE__ */ o(({ env: t = wt.env, ...e } = {}) => {
  t = { ...t };
  let r = _t({ env: t });
  return e.path = t[r], t[r] = Xc(e), t;
}, "npmRunPathEnv");

// node_modules/mimic-fn/index.js
var td = /* @__PURE__ */ o((t, e, r, n) => {
  if (r === "length" || r === "prototype" || r === "arguments" || r === "caller")
    return;
  let s = Object.getOwnPropertyDescriptor(t, r), i = Object.getOwnPropertyDescriptor(e, r);
  !rd(s, i) && n || Object.defineProperty(t, r, i);
}, "copyProperty"), rd = /* @__PURE__ */ o(function(t, e) {
  return t === void 0 || t.configurable || t.writable === e.writable && t.enumerable === e.enumerable && t.configurable === e.configurable &&
  (t.writable || t.value === e.value);
}, "canCopyProperty"), nd = /* @__PURE__ */ o((t, e) => {
  let r = Object.getPrototypeOf(e);
  r !== Object.getPrototypeOf(t) && Object.setPrototypeOf(t, r);
}, "changePrototype"), sd = /* @__PURE__ */ o((t, e) => `/* Wrapped ${t}*/
${e}`, "wrappedToString"), id = Object.getOwnPropertyDescriptor(Function.prototype, "toString"), od = Object.getOwnPropertyDescriptor(Function.
prototype.toString, "name"), ad = /* @__PURE__ */ o((t, e, r) => {
  let n = r === "" ? "" : `with ${r.trim()}() `, s = sd.bind(null, n, e.toString());
  Object.defineProperty(s, "name", od), Object.defineProperty(t, "toString", { ...id, value: s });
}, "changeToString");
function xr(t, e, { ignoreNonConfigurable: r = !1 } = {}) {
  let { name: n } = t;
  for (let s of Reflect.ownKeys(e))
    td(t, e, s, r);
  return nd(t, e), ad(t, e, n), t;
}
o(xr, "mimicFunction");

// node_modules/onetime/index.js
var kt = /* @__PURE__ */ new WeakMap(), Bs = /* @__PURE__ */ o((t, e = {}) => {
  if (typeof t != "function")
    throw new TypeError("Expected a function");
  let r, n = 0, s = t.displayName || t.name || "<anonymous>", i = /* @__PURE__ */ o(function(...a) {
    if (kt.set(i, ++n), n === 1)
      r = t.apply(this, a), t = null;
    else if (e.throw === !0)
      throw new Error(`Function \`${s}\` can only be called once`);
    return r;
  }, "onetime");
  return xr(i, t), kt.set(i, n), i;
}, "onetime");
Bs.callCount = (t) => {
  if (!kt.has(t))
    throw new Error(`The given function \`${t.name}\` is not wrapped by the \`onetime\` package`);
  return kt.get(t);
};
var qs = Bs;

// node_modules/execa/lib/error.js
import gd from "node:process";

// node_modules/human-signals/build/src/main.js
import { constants as ld } from "node:os";

// node_modules/human-signals/build/src/realtime.js
var zs = /* @__PURE__ */ o(() => {
  let t = vr - Gs + 1;
  return Array.from({ length: t }, cd);
}, "getRealtimeSignals"), cd = /* @__PURE__ */ o((t, e) => ({
  name: `SIGRT${e + 1}`,
  number: Gs + e,
  action: "terminate",
  description: "Application-specific signal (realtime)",
  standard: "posix"
}), "getRealtimeSignal"), Gs = 34, vr = 64;

// node_modules/human-signals/build/src/signals.js
import { constants as dd } from "node:os";

// node_modules/human-signals/build/src/core.js
var Ws = [
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
var br = /* @__PURE__ */ o(() => {
  let t = zs();
  return [...Ws, ...t].map(ud);
}, "getSignals"), ud = /* @__PURE__ */ o(({
  name: t,
  number: e,
  description: r,
  action: n,
  forced: s = !1,
  standard: i
}) => {
  let {
    signals: { [t]: a }
  } = dd, c = a !== void 0;
  return { name: t, number: c ? a : e, description: r, supported: c, action: n, forced: s, standard: i };
}, "normalizeSignal");

// node_modules/human-signals/build/src/main.js
var pd = /* @__PURE__ */ o(() => {
  let t = br();
  return Object.fromEntries(t.map(fd));
}, "getSignalsByName"), fd = /* @__PURE__ */ o(({
  name: t,
  number: e,
  description: r,
  supported: n,
  action: s,
  forced: i,
  standard: a
}) => [t, { name: t, number: e, description: r, supported: n, action: s, forced: i, standard: a }], "getSignalByName"), Js = pd(), md = /* @__PURE__ */ o(
() => {
  let t = br(), e = vr + 1, r = Array.from(
    { length: e },
    (n, s) => hd(s, t)
  );
  return Object.assign({}, ...r);
}, "getSignalsByNumber"), hd = /* @__PURE__ */ o((t, e) => {
  let r = yd(t, e);
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
}, "getSignalByNumber"), yd = /* @__PURE__ */ o((t, e) => {
  let r = e.find(({ name: n }) => ld.signals[n] === t);
  return r !== void 0 ? r : e.find((n) => n.number === t);
}, "findSignalByNumber"), jf = md();

// node_modules/execa/lib/error.js
var xd = /* @__PURE__ */ o(({ timedOut: t, timeout: e, errorCode: r, signal: n, signalDescription: s, exitCode: i, isCanceled: a }) => t ? `\
timed out after ${e} milliseconds` : a ? "was canceled" : r !== void 0 ? `failed with ${r}` : n !== void 0 ? `was killed with ${n} (${s})` :
i !== void 0 ? `failed with exit code ${i}` : "failed", "getErrorPrefix"), ze = /* @__PURE__ */ o(({
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
  parsed: { options: { timeout: x, cwd: w = gd.cwd() } }
}) => {
  i = i === null ? void 0 : i, s = s === null ? void 0 : s;
  let _ = s === void 0 ? void 0 : Js[s].description, P = n && n.code, E = `Command ${xd({ timedOut: p, timeout: x, errorCode: P, signal: s, signalDescription: _,
  exitCode: i, isCanceled: l })}: ${a}`, $ = Object.prototype.toString.call(n) === "[object Error]", Ne = $ ? `${E}
${n.message}` : E, be = [Ne, e, t].filter(Boolean).join(`
`);
  return $ ? (n.originalMessage = n.message, n.message = be) : n = new Error(be), n.shortMessage = Ne, n.command = a, n.escapedCommand = c, n.
  exitCode = i, n.signal = s, n.signalDescription = _, n.stdout = t, n.stderr = e, n.cwd = w, r !== void 0 && (n.all = r), "bufferedData" in
  n && delete n.bufferedData, n.failed = !0, n.timedOut = !!p, n.isCanceled = l, n.killed = f && !p, n;
}, "makeError");

// node_modules/execa/lib/stdio.js
var Tt = ["stdin", "stdout", "stderr"], vd = /* @__PURE__ */ o((t) => Tt.some((e) => t[e] !== void 0), "hasAlias"), Hs = /* @__PURE__ */ o((t) => {
  if (!t)
    return;
  let { stdio: e } = t;
  if (e === void 0)
    return Tt.map((n) => t[n]);
  if (vd(t))
    throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${Tt.map((n) => `\`${n}\``).join(", ")}`);
  if (typeof e == "string")
    return e;
  if (!Array.isArray(e))
    throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof e}\``);
  let r = Math.max(e.length, Tt.length);
  return Array.from({ length: r }, (n, s) => e[s]);
}, "normalizeStdio");

// node_modules/execa/lib/kill.js
import wd from "node:os";

// node_modules/signal-exit/dist/mjs/signals.js
var ge = [];
ge.push("SIGHUP", "SIGINT", "SIGTERM");
process.platform !== "win32" && ge.push(
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
process.platform === "linux" && ge.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");

// node_modules/signal-exit/dist/mjs/index.js
var It = /* @__PURE__ */ o((t) => !!t && typeof t == "object" && typeof t.removeListener == "function" && typeof t.emit == "function" && typeof t.
reallyExit == "function" && typeof t.listeners == "function" && typeof t.kill == "function" && typeof t.pid == "number" && typeof t.on == "f\
unction", "processOk"), _r = Symbol.for("signal-exit emitter"), wr = globalThis, bd = Object.defineProperty.bind(Object), kr = class {
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
    if (wr[_r])
      return wr[_r];
    bd(wr, _r, {
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
}, St = class {
  static {
    o(this, "SignalExitBase");
  }
}, _d = /* @__PURE__ */ o((t) => ({
  onExit(e, r) {
    return t.onExit(e, r);
  },
  load() {
    return t.load();
  },
  unload() {
    return t.unload();
  }
}), "signalExitWrap"), Tr = class extends St {
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
}, Ir = class extends St {
  static {
    o(this, "SignalExit");
  }
  // "SIGHUP" throws an `ENOSYS` error on Windows,
  // so use a supported signal instead
  /* c8 ignore start */
  #r = Sr.platform === "win32" ? "SIGINT" : "SIGHUP";
  /* c8 ignore stop */
  #t = new kr();
  #e;
  #i;
  #o;
  #s = {};
  #n = !1;
  constructor(e) {
    super(), this.#e = e, this.#s = {};
    for (let r of ge)
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
    if (!It(this.#e))
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
      for (let e of ge)
        try {
          let r = this.#s[e];
          r && this.#e.on(e, r);
        } catch {
        }
      this.#e.emit = (e, ...r) => this.#c(e, ...r), this.#e.reallyExit = (e) => this.#a(e);
    }
  }
  unload() {
    this.#n && (this.#n = !1, ge.forEach((e) => {
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
    return It(this.#e) ? (this.#e.exitCode = e || 0, this.#t.emit("exit", this.#e.exitCode, null), this.#o.call(this.#e, this.#e.exitCode)) :
    0;
  }
  #c(e, ...r) {
    let n = this.#i;
    if (e === "exit" && It(this.#e)) {
      typeof r[0] == "number" && (this.#e.exitCode = r[0]);
      let s = n.call(this.#e, e, ...r);
      return this.#t.emit("exit", this.#e.exitCode, null), s;
    } else
      return n.call(this.#e, e, ...r);
  }
}, Sr = globalThis.process, {
  /**
   * Called when the process is exiting, whether via signal, explicit
   * exit, or running out of stuff to do.
   *
   * If the global process object is not suitable for instrumentation,
   * then this will be a no-op.
   *
   * Returns a function that may be used to unload signal-exit.
   */
  onExit: Ks,
  /**
   * Load the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  load: Vf,
  /**
   * Unload the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  unload: Ff
} = _d(It(Sr) ? new Ir(Sr) : new Tr());

// node_modules/execa/lib/kill.js
var kd = 1e3 * 5, Ys = /* @__PURE__ */ o((t, e = "SIGTERM", r = {}) => {
  let n = t(e);
  return Td(t, e, r, n), n;
}, "spawnedKill"), Td = /* @__PURE__ */ o((t, e, r, n) => {
  if (!Id(e, r, n))
    return;
  let s = Cd(r), i = setTimeout(() => {
    t("SIGKILL");
  }, s);
  i.unref && i.unref();
}, "setKillTimeout"), Id = /* @__PURE__ */ o((t, { forceKillAfterTimeout: e }, r) => Sd(t) && e !== !1 && r, "shouldForceKill"), Sd = /* @__PURE__ */ o(
(t) => t === wd.constants.signals.SIGTERM || typeof t == "string" && t.toUpperCase() === "SIGTERM", "isSigterm"), Cd = /* @__PURE__ */ o(({ forceKillAfterTimeout: t = !0 }) => {
  if (t === !0)
    return kd;
  if (!Number.isFinite(t) || t < 0)
    throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
  return t;
}, "getForceKillAfterTimeout"), Xs = /* @__PURE__ */ o((t, e) => {
  t.kill() && (e.isCanceled = !0);
}, "spawnedCancel"), Pd = /* @__PURE__ */ o((t, e, r) => {
  t.kill(e), r(Object.assign(new Error("Timed out"), { timedOut: !0, signal: e }));
}, "timeoutKill"), Qs = /* @__PURE__ */ o((t, { timeout: e, killSignal: r = "SIGTERM" }, n) => {
  if (e === 0 || e === void 0)
    return n;
  let s, i = new Promise((c, p) => {
    s = setTimeout(() => {
      Pd(t, r, p);
    }, e);
  }), a = n.finally(() => {
    clearTimeout(s);
  });
  return Promise.race([i, a]);
}, "setupTimeout"), ei = /* @__PURE__ */ o(({ timeout: t }) => {
  if (t !== void 0 && (!Number.isFinite(t) || t < 0))
    throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
}, "validateTimeout"), ti = /* @__PURE__ */ o(async (t, { cleanup: e, detached: r }, n) => {
  if (!e || r)
    return n;
  let s = Ks(() => {
    t.kill();
  });
  return n.finally(() => {
    s();
  });
}, "setExitHandler");

// node_modules/execa/lib/pipe.js
import { createWriteStream as Ed } from "node:fs";
import { ChildProcess as jd } from "node:child_process";

// node_modules/is-stream/index.js
function Ct(t) {
  return t !== null && typeof t == "object" && typeof t.pipe == "function";
}
o(Ct, "isStream");
function Cr(t) {
  return Ct(t) && t.writable !== !1 && typeof t._write == "function" && typeof t._writableState == "object";
}
o(Cr, "isWritableStream");

// node_modules/execa/lib/pipe.js
var Ad = /* @__PURE__ */ o((t) => t instanceof jd && typeof t.then == "function", "isExecaChildProcess"), Pr = /* @__PURE__ */ o((t, e, r) => {
  if (typeof r == "string")
    return t[e].pipe(Ed(r)), t;
  if (Cr(r))
    return t[e].pipe(r), t;
  if (!Ad(r))
    throw new TypeError("The second argument must be a string, a stream or an Execa child process.");
  if (!Cr(r.stdin))
    throw new TypeError("The target child process's stdin must be available.");
  return t[e].pipe(r.stdin), r;
}, "pipeToTarget"), ri = /* @__PURE__ */ o((t) => {
  t.stdout !== null && (t.pipeStdout = Pr.bind(void 0, t, "stdout")), t.stderr !== null && (t.pipeStderr = Pr.bind(void 0, t, "stderr")), t.
  all !== void 0 && (t.pipeAll = Pr.bind(void 0, t, "all"));
}, "addPipeMethods");

// node_modules/execa/lib/stream.js
import { createReadStream as Kd, readFileSync as Yd } from "node:fs";
import { setTimeout as Xd } from "node:timers/promises";

// node_modules/get-stream/source/contents.js
var Ge = /* @__PURE__ */ o(async (t, { init: e, convertChunk: r, getSize: n, truncateChunk: s, addChunk: i, getFinalChunk: a, finalize: c }, {
maxBuffer: p = Number.POSITIVE_INFINITY } = {}) => {
  if (!Zd(t))
    throw new Error("The first argument must be a Readable, a ReadableStream, or an async iterable.");
  let l = e();
  l.length = 0;
  try {
    for await (let f of t) {
      let x = Nd(f), w = r[x](f, l);
      ii({ convertedChunk: w, state: l, getSize: n, truncateChunk: s, addChunk: i, maxBuffer: p });
    }
    return Od({ state: l, convertChunk: r, getSize: n, truncateChunk: s, addChunk: i, getFinalChunk: a, maxBuffer: p }), c(l);
  } catch (f) {
    throw f.bufferedData = c(l), f;
  }
}, "getStreamContents"), Od = /* @__PURE__ */ o(({ state: t, getSize: e, truncateChunk: r, addChunk: n, getFinalChunk: s, maxBuffer: i }) => {
  let a = s(t);
  a !== void 0 && ii({ convertedChunk: a, state: t, getSize: e, truncateChunk: r, addChunk: n, maxBuffer: i });
}, "appendFinalChunk"), ii = /* @__PURE__ */ o(({ convertedChunk: t, state: e, getSize: r, truncateChunk: n, addChunk: s, maxBuffer: i }) => {
  let a = r(t), c = e.length + a;
  if (c <= i) {
    ni(t, e, s, c);
    return;
  }
  let p = n(t, i - e.length);
  throw p !== void 0 && ni(p, e, s, i), new Pt();
}, "appendChunk"), ni = /* @__PURE__ */ o((t, e, r, n) => {
  e.contents = r(t, e, n), e.length = n;
}, "addNewChunk"), Zd = /* @__PURE__ */ o((t) => typeof t == "object" && t !== null && typeof t[Symbol.asyncIterator] == "function", "isAsyn\
cIterable"), Nd = /* @__PURE__ */ o((t) => {
  let e = typeof t;
  if (e === "string")
    return "string";
  if (e !== "object" || t === null)
    return "others";
  if (globalThis.Buffer?.isBuffer(t))
    return "buffer";
  let r = si.call(t);
  return r === "[object ArrayBuffer]" ? "arrayBuffer" : r === "[object DataView]" ? "dataView" : Number.isInteger(t.byteLength) && Number.isInteger(
  t.byteOffset) && si.call(t.buffer) === "[object ArrayBuffer]" ? "typedArray" : "others";
}, "getChunkType"), { toString: si } = Object.prototype, Pt = class extends Error {
  static {
    o(this, "MaxBufferError");
  }
  name = "MaxBufferError";
  constructor() {
    super("maxBuffer exceeded");
  }
};

// node_modules/get-stream/source/utils.js
var Er = /* @__PURE__ */ o((t) => t, "identity"), jr = /* @__PURE__ */ o(() => {
}, "noop"), Ar = /* @__PURE__ */ o(({ contents: t }) => t, "getContentsProp"), Et = /* @__PURE__ */ o((t) => {
  throw new Error(`Streams in object mode are not supported: ${String(t)}`);
}, "throwObjectStream"), jt = /* @__PURE__ */ o((t) => t.length, "getLengthProp");

// node_modules/get-stream/source/array-buffer.js
async function Or(t, e) {
  return Ge(t, Bd, e);
}
o(Or, "getStreamAsArrayBuffer");
var Rd = /* @__PURE__ */ o(() => ({ contents: new ArrayBuffer(0) }), "initArrayBuffer"), Dd = /* @__PURE__ */ o((t) => Ld.encode(t), "useTex\
tEncoder"), Ld = new TextEncoder(), oi = /* @__PURE__ */ o((t) => new Uint8Array(t), "useUint8Array"), ai = /* @__PURE__ */ o((t) => new Uint8Array(
t.buffer, t.byteOffset, t.byteLength), "useUint8ArrayWithOffset"), Md = /* @__PURE__ */ o((t, e) => t.slice(0, e), "truncateArrayBufferChunk"),
Ud = /* @__PURE__ */ o((t, { contents: e, length: r }, n) => {
  let s = ui() ? Vd(e, n) : $d(e, n);
  return new Uint8Array(s).set(t, r), s;
}, "addArrayBufferChunk"), $d = /* @__PURE__ */ o((t, e) => {
  if (e <= t.byteLength)
    return t;
  let r = new ArrayBuffer(di(e));
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBufferSlow"), Vd = /* @__PURE__ */ o((t, e) => {
  if (e <= t.maxByteLength)
    return t.resize(e), t;
  let r = new ArrayBuffer(e, { maxByteLength: di(e) });
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBuffer"), di = /* @__PURE__ */ o((t) => ci ** Math.ceil(Math.log(t) / Math.log(ci)), "getNewContentsLength"), ci = 2, Fd = /* @__PURE__ */ o(
({ contents: t, length: e }) => ui() ? t : t.slice(0, e), "finalizeArrayBuffer"), ui = /* @__PURE__ */ o(() => "resize" in ArrayBuffer.prototype,
"hasArrayBufferResize"), Bd = {
  init: Rd,
  convertChunk: {
    string: Dd,
    buffer: oi,
    arrayBuffer: oi,
    dataView: ai,
    typedArray: ai,
    others: Et
  },
  getSize: jt,
  truncateChunk: Md,
  addChunk: Ud,
  getFinalChunk: jr,
  finalize: Fd
};

// node_modules/get-stream/source/buffer.js
async function At(t, e) {
  if (!("Buffer" in globalThis))
    throw new Error("getStreamAsBuffer() is only supported in Node.js");
  try {
    return li(await Or(t, e));
  } catch (r) {
    throw r.bufferedData !== void 0 && (r.bufferedData = li(r.bufferedData)), r;
  }
}
o(At, "getStreamAsBuffer");
var li = /* @__PURE__ */ o((t) => globalThis.Buffer.from(t), "arrayBufferToNodeBuffer");

// node_modules/get-stream/source/string.js
async function Zr(t, e) {
  return Ge(t, Jd, e);
}
o(Zr, "getStreamAsString");
var qd = /* @__PURE__ */ o(() => ({ contents: "", textDecoder: new TextDecoder() }), "initString"), Ot = /* @__PURE__ */ o((t, { textDecoder: e }) => e.
decode(t, { stream: !0 }), "useTextDecoder"), zd = /* @__PURE__ */ o((t, { contents: e }) => e + t, "addStringChunk"), Gd = /* @__PURE__ */ o(
(t, e) => t.slice(0, e), "truncateStringChunk"), Wd = /* @__PURE__ */ o(({ textDecoder: t }) => {
  let e = t.decode();
  return e === "" ? void 0 : e;
}, "getFinalStringChunk"), Jd = {
  init: qd,
  convertChunk: {
    string: Er,
    buffer: Ot,
    arrayBuffer: Ot,
    dataView: Ot,
    typedArray: Ot,
    others: Et
  },
  getSize: jt,
  truncateChunk: Gd,
  addChunk: zd,
  getFinalChunk: Wd,
  finalize: Ar
};

// node_modules/execa/lib/stream.js
var mi = H(fi(), 1);
var hi = /* @__PURE__ */ o((t) => {
  if (t !== void 0)
    throw new TypeError("The `input` and `inputFile` options cannot be both set.");
}, "validateInputOptions"), Qd = /* @__PURE__ */ o(({ input: t, inputFile: e }) => typeof e != "string" ? t : (hi(t), Yd(e)), "getInputSync"),
yi = /* @__PURE__ */ o((t) => {
  let e = Qd(t);
  if (Ct(e))
    throw new TypeError("The `input` option cannot be a stream in sync mode");
  return e;
}, "handleInputSync"), eu = /* @__PURE__ */ o(({ input: t, inputFile: e }) => typeof e != "string" ? t : (hi(t), Kd(e)), "getInput"), gi = /* @__PURE__ */ o(
(t, e) => {
  let r = eu(e);
  r !== void 0 && (Ct(r) ? r.pipe(t.stdin) : t.stdin.end(r));
}, "handleInput"), xi = /* @__PURE__ */ o((t, { all: e }) => {
  if (!e || !t.stdout && !t.stderr)
    return;
  let r = (0, mi.default)();
  return t.stdout && r.add(t.stdout), t.stderr && r.add(t.stderr), r;
}, "makeAllStream"), Nr = /* @__PURE__ */ o(async (t, e) => {
  if (!(!t || e === void 0)) {
    await Xd(0), t.destroy();
    try {
      return await e;
    } catch (r) {
      return r.bufferedData;
    }
  }
}, "getBufferedData"), Rr = /* @__PURE__ */ o((t, { encoding: e, buffer: r, maxBuffer: n }) => {
  if (!(!t || !r))
    return e === "utf8" || e === "utf-8" ? Zr(t, { maxBuffer: n }) : e === null || e === "buffer" ? At(t, { maxBuffer: n }) : tu(t, n, e);
}, "getStreamPromise"), tu = /* @__PURE__ */ o(async (t, e, r) => (await At(t, { maxBuffer: e })).toString(r), "applyEncoding"), vi = /* @__PURE__ */ o(
async ({ stdout: t, stderr: e, all: r }, { encoding: n, buffer: s, maxBuffer: i }, a) => {
  let c = Rr(t, { encoding: n, buffer: s, maxBuffer: i }), p = Rr(e, { encoding: n, buffer: s, maxBuffer: i }), l = Rr(r, { encoding: n, buffer: s,
  maxBuffer: i * 2 });
  try {
    return await Promise.all([a, c, p, l]);
  } catch (f) {
    return Promise.all([
      { error: f, signal: f.signal, timedOut: f.timedOut },
      Nr(t, c),
      Nr(e, p),
      Nr(r, l)
    ]);
  }
}, "getSpawnedResult");

// node_modules/execa/lib/promise.js
var ru = (async () => {
})().constructor.prototype, nu = ["then", "catch", "finally"].map((t) => [
  t,
  Reflect.getOwnPropertyDescriptor(ru, t)
]), Dr = /* @__PURE__ */ o((t, e) => {
  for (let [r, n] of nu) {
    let s = typeof e == "function" ? (...i) => Reflect.apply(n.value, e(), i) : n.value.bind(e);
    Reflect.defineProperty(t, r, { ...n, value: s });
  }
}, "mergePromise"), bi = /* @__PURE__ */ o((t) => new Promise((e, r) => {
  t.on("exit", (n, s) => {
    e({ exitCode: n, signal: s });
  }), t.on("error", (n) => {
    r(n);
  }), t.stdin && t.stdin.on("error", (n) => {
    r(n);
  });
}), "getSpawnedPromise");

// node_modules/execa/lib/command.js
import { Buffer as su } from "node:buffer";
import { ChildProcess as iu } from "node:child_process";
var ki = /* @__PURE__ */ o((t, e = []) => Array.isArray(e) ? [t, ...e] : [t], "normalizeArgs"), ou = /^[\w.-]+$/, au = /* @__PURE__ */ o((t) => typeof t !=
"string" || ou.test(t) ? t : `"${t.replaceAll('"', '\\"')}"`, "escapeArg"), Lr = /* @__PURE__ */ o((t, e) => ki(t, e).join(" "), "joinComman\
d"), Mr = /* @__PURE__ */ o((t, e) => ki(t, e).map((r) => au(r)).join(" "), "getEscapedCommand"), Ti = / +/g, Ii = /* @__PURE__ */ o((t) => {
  let e = [];
  for (let r of t.trim().split(Ti)) {
    let n = e.at(-1);
    n && n.endsWith("\\") ? e[e.length - 1] = `${n.slice(0, -1)} ${r}` : e.push(r);
  }
  return e;
}, "parseCommand"), _i = /* @__PURE__ */ o((t) => {
  let e = typeof t;
  if (e === "string")
    return t;
  if (e === "number")
    return String(t);
  if (e === "object" && t !== null && !(t instanceof iu) && "stdout" in t) {
    let r = typeof t.stdout;
    if (r === "string")
      return t.stdout;
    if (su.isBuffer(t.stdout))
      return t.stdout.toString();
    throw new TypeError(`Unexpected "${r}" stdout in template expression`);
  }
  throw new TypeError(`Unexpected "${e}" in template expression`);
}, "parseExpression"), wi = /* @__PURE__ */ o((t, e, r) => r || t.length === 0 || e.length === 0 ? [...t, ...e] : [
  ...t.slice(0, -1),
  `${t.at(-1)}${e[0]}`,
  ...e.slice(1)
], "concatTokens"), cu = /* @__PURE__ */ o(({ templates: t, expressions: e, tokens: r, index: n, template: s }) => {
  let i = s ?? t.raw[n], a = i.split(Ti).filter(Boolean), c = wi(
    r,
    a,
    i.startsWith(" ")
  );
  if (n === e.length)
    return c;
  let p = e[n], l = Array.isArray(p) ? p.map((f) => _i(f)) : [_i(p)];
  return wi(
    c,
    l,
    i.endsWith(" ")
  );
}, "parseTemplate"), Ur = /* @__PURE__ */ o((t, e) => {
  let r = [];
  for (let [n, s] of t.entries())
    r = cu({ templates: t, expressions: e, tokens: r, index: n, template: s });
  return r;
}, "parseTemplates");

// node_modules/execa/lib/verbose.js
import { debuglog as du } from "node:util";
import uu from "node:process";
var Si = du("execa").enabled, Zt = /* @__PURE__ */ o((t, e) => String(t).padStart(e, "0"), "padField"), lu = /* @__PURE__ */ o(() => {
  let t = /* @__PURE__ */ new Date();
  return `${Zt(t.getHours(), 2)}:${Zt(t.getMinutes(), 2)}:${Zt(t.getSeconds(), 2)}.${Zt(t.getMilliseconds(), 3)}`;
}, "getTimestamp"), $r = /* @__PURE__ */ o((t, { verbose: e }) => {
  e && uu.stderr.write(`[${lu()}] ${t}
`);
}, "logCommand");

// node_modules/execa/index.js
var mu = 1e3 * 1e3 * 100, hu = /* @__PURE__ */ o(({ env: t, extendEnv: e, preferLocal: r, localDir: n, execPath: s }) => {
  let i = e ? { ...Nt.env, ...t } : t;
  return r ? Fs({ env: i, cwd: n, execPath: s }) : i;
}, "getEnv"), Ei = /* @__PURE__ */ o((t, e, r = {}) => {
  let n = Pi.default._parse(t, e, r);
  return t = n.command, e = n.args, r = n.options, r = {
    maxBuffer: mu,
    buffer: !0,
    stripFinalNewline: !0,
    extendEnv: !0,
    preferLocal: !1,
    localDir: r.cwd || Nt.cwd(),
    execPath: Nt.execPath,
    encoding: "utf8",
    reject: !0,
    cleanup: !0,
    all: !1,
    windowsHide: !0,
    verbose: Si,
    ...r
  }, r.env = hu(r), r.stdio = Hs(r), Nt.platform === "win32" && fu.basename(t, ".exe") === "cmd" && e.unshift("/q"), { file: t, args: e, options: r,
  parsed: n };
}, "handleArguments"), We = /* @__PURE__ */ o((t, e, r) => typeof e != "string" && !pu.isBuffer(e) ? r === void 0 ? void 0 : "" : t.stripFinalNewline ?
gr(e) : e, "handleOutput");
function ji(t, e, r) {
  let n = Ei(t, e, r), s = Lr(t, e), i = Mr(t, e);
  $r(i, n.options), ei(n.options);
  let a;
  try {
    a = Vr.spawn(n.file, n.args, n.options);
  } catch (_) {
    let P = new Vr.ChildProcess(), S = Promise.reject(ze({
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
    return Dr(P, S), P;
  }
  let c = bi(a), p = Qs(a, n.options, c), l = ti(a, n.options, p), f = { isCanceled: !1 };
  a.kill = Ys.bind(null, a.kill.bind(a)), a.cancel = Xs.bind(null, a, f);
  let w = qs(/* @__PURE__ */ o(async () => {
    let [{ error: _, exitCode: P, signal: S, timedOut: E }, $, Ne, be] = await vi(a, n.options, l), Re = We(n.options, $), rt = We(n.options,
    Ne), nt = We(n.options, be);
    if (_ || P !== 0 || S !== null) {
      let k = ze({
        error: _,
        exitCode: P,
        signal: S,
        stdout: Re,
        stderr: rt,
        all: nt,
        command: s,
        escapedCommand: i,
        parsed: n,
        timedOut: E,
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
      stdout: Re,
      stderr: rt,
      all: nt,
      failed: !1,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    };
  }, "handlePromise"));
  return gi(a, n.options), a.all = xi(a, n.options), ri(a), Dr(a, w), a;
}
o(ji, "execa");
function yu(t, e, r) {
  let n = Ei(t, e, r), s = Lr(t, e), i = Mr(t, e);
  $r(i, n.options);
  let a = yi(n.options), c;
  try {
    c = Vr.spawnSync(n.file, n.args, { ...n.options, input: a });
  } catch (f) {
    throw ze({
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
  let p = We(n.options, c.stdout, c.error), l = We(n.options, c.stderr, c.error);
  if (c.error || c.status !== 0 || c.signal !== null) {
    let f = ze({
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
o(yu, "execaSync");
var gu = /* @__PURE__ */ o(({ input: t, inputFile: e, stdio: r }) => t === void 0 && e === void 0 && r === void 0 ? { stdin: "inherit" } : {},
"normalizeScriptStdin"), Ci = /* @__PURE__ */ o((t = {}) => ({
  preferLocal: !0,
  ...gu(t),
  ...t
}), "normalizeScriptOptions");
function Ai(t) {
  function e(r, ...n) {
    if (!Array.isArray(r))
      return Ai({ ...t, ...r });
    let [s, ...i] = Ur(r, n);
    return ji(s, i, Ci(t));
  }
  return o(e, "$"), e.sync = (r, ...n) => {
    if (!Array.isArray(r))
      throw new TypeError("Please use $(options).sync`command` instead of $.sync(options)`command`.");
    let [s, ...i] = Ur(r, n);
    return yu(s, i, Ci(t));
  }, e;
}
o(Ai, "create$");
var ch = Ai();
function Je(t, e) {
  let [r, ...n] = Ii(t);
  return ji(r, n, e);
}
o(Je, "execaCommand");

// src/telemetry/exec-command-count-lines.ts
async function Rt(t, e) {
  let r = Je(t, { shell: !0, buffer: !1, ...e });
  if (!r.stdout)
    throw new Error("Unexpected missing stdout");
  let n = 0, s = xu(r.stdout);
  return s.on("line", () => {
    n += 1;
  }), await r, s.close(), n;
}
o(Rt, "execCommandCountLines");

// src/common/utils/file-cache.ts
import { createHash as Zi, randomBytes as vu } from "node:crypto";
import { mkdirSync as Br, readFileSync as bu, readdirSync as _u, rmSync as Ni, writeFileSync as wu } from "node:fs";
import { readFile as Ri, readdir as Di, rm as Li, writeFile as ku } from "node:fs/promises";
import { tmpdir as Tu } from "node:os";
import { join as He } from "node:path";
var Dt = class {
  static {
    o(this, "FileSystemCache");
  }
  constructor(e = {}) {
    this.prefix = (e.ns || e.prefix || "") + "-", this.hash_alg = e.hash_alg || "sha256", this.cache_dir = e.basePath || He(Tu(), vu(15).toString(
    "base64").replace(/\//g, "-")), this.ttl = e.ttl || 0, Zi(this.hash_alg), Br(this.cache_dir, { recursive: !0 });
  }
  generateHash(e) {
    return He(this.cache_dir, this.prefix + Zi(this.hash_alg).update(e).digest("hex"));
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
      let n = await Ri(this.generateHash(e), "utf8");
      return this.parseCacheData(n, r);
    } catch {
      return r;
    }
  }
  getSync(e, r) {
    try {
      let n = bu(this.generateHash(e), "utf8");
      return this.parseCacheData(n, r);
    } catch {
      return r;
    }
  }
  async set(e, r, n = {}) {
    let s = typeof n == "number" ? { ttl: n } : n;
    Br(this.cache_dir, { recursive: !0 }), await ku(this.generateHash(e), this.parseSetData(e, r, s), {
      encoding: s.encoding || "utf8"
    });
  }
  setSync(e, r, n = {}) {
    let s = typeof n == "number" ? { ttl: n } : n;
    Br(this.cache_dir, { recursive: !0 }), wu(this.generateHash(e), this.parseSetData(e, r, s), {
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
    await Li(this.generateHash(e), { force: !0 });
  }
  removeSync(e) {
    Ni(this.generateHash(e), { force: !0 });
  }
  async clear() {
    let e = await Di(this.cache_dir);
    await Promise.all(
      e.filter((r) => r.startsWith(this.prefix)).map((r) => Li(He(this.cache_dir, r), { force: !0 }))
    );
  }
  clearSync() {
    _u(this.cache_dir).filter((e) => e.startsWith(this.prefix)).forEach((e) => Ni(He(this.cache_dir, e), { force: !0 }));
  }
  async getAll() {
    let e = Date.now(), r = await Di(this.cache_dir);
    return (await Promise.all(
      r.filter((s) => s.startsWith(this.prefix)).map((s) => Ri(He(this.cache_dir, s), "utf8"))
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
function qr(t) {
  return new Dt(t);
}
o(qr, "createFileSystemCache");

// src/common/utils/resolve-path-in-sb-cache.ts
import { join as eo } from "node:path";

// node_modules/find-cache-dir/index.js
var Qi = H(Ui(), 1);
import Ru from "node:process";
import Ye from "node:path";
import Vt from "node:fs";

// ../node_modules/pkg-dir/index.js
import Nu from "node:path";

// ../node_modules/pkg-dir/node_modules/find-up/index.js
import $t from "node:path";
import { fileURLToPath as ju } from "node:url";

// ../node_modules/locate-path/index.js
import Bi from "node:process";
import qi from "node:path";
import Vi, { promises as Fi } from "node:fs";
import { fileURLToPath as Eu } from "node:url";

// ../node_modules/locate-path/node_modules/p-limit/index.js
$i();
function Lt(t) {
  if (!((Number.isInteger(t) || t === Number.POSITIVE_INFINITY) && t > 0))
    throw new TypeError("Expected `concurrency` to be a number from 1 and up");
  let e = new Ke(), r = 0, n = /* @__PURE__ */ o(() => {
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
o(Lt, "pLimit");

// ../node_modules/locate-path/node_modules/p-locate/index.js
var Mt = class extends Error {
  static {
    o(this, "EndError");
  }
  constructor(e) {
    super(), this.value = e;
  }
}, Cu = /* @__PURE__ */ o(async (t, e) => e(await t), "testElement"), Pu = /* @__PURE__ */ o(async (t) => {
  let e = await Promise.all(t);
  if (e[1] === !0)
    throw new Mt(e[0]);
  return !1;
}, "finder");
async function Gr(t, e, {
  concurrency: r = Number.POSITIVE_INFINITY,
  preserveOrder: n = !0
} = {}) {
  let s = Lt(r), i = [...t].map((c) => [c, s(Cu, c, e)]), a = Lt(n ? 1 : Number.POSITIVE_INFINITY);
  try {
    await Promise.all(i.map((c) => a(Pu, c)));
  } catch (c) {
    if (c instanceof Mt)
      return c.value;
    throw c;
  }
}
o(Gr, "pLocate");

// ../node_modules/locate-path/index.js
var zi = {
  directory: "isDirectory",
  file: "isFile"
};
function Gi(t) {
  if (!Object.hasOwnProperty.call(zi, t))
    throw new Error(`Invalid type specified: ${t}`);
}
o(Gi, "checkType");
var Wi = /* @__PURE__ */ o((t, e) => e[zi[t]](), "matchType"), Ji = /* @__PURE__ */ o((t) => t instanceof URL ? Eu(t) : t, "toPath");
async function Ut(t, {
  cwd: e = Bi.cwd(),
  type: r = "file",
  allowSymlinks: n = !0,
  concurrency: s,
  preserveOrder: i
} = {}) {
  Gi(r), e = Ji(e);
  let a = n ? Fi.stat : Fi.lstat;
  return Gr(t, async (c) => {
    try {
      let p = await a(qi.resolve(e, c));
      return Wi(r, p);
    } catch {
      return !1;
    }
  }, { concurrency: s, preserveOrder: i });
}
o(Ut, "locatePath");
function Oe(t, {
  cwd: e = Bi.cwd(),
  type: r = "file",
  allowSymlinks: n = !0
} = {}) {
  Gi(r), e = Ji(e);
  let s = n ? Vi.statSync : Vi.lstatSync;
  for (let i of t)
    try {
      let a = s(qi.resolve(e, i), {
        throwIfNoEntry: !1
      });
      if (!a)
        continue;
      if (Wi(r, a))
        return i;
    } catch {
    }
}
o(Oe, "locatePathSync");

// ../node_modules/pkg-dir/node_modules/path-exists/index.js
import Fh, { promises as Bh } from "node:fs";

// ../node_modules/pkg-dir/node_modules/find-up/index.js
var Au = /* @__PURE__ */ o((t) => t instanceof URL ? ju(t) : t, "toPath"), Ou = Symbol("findUpStop");
function Zu(t, e = {}) {
  let r = $t.resolve(Au(e.cwd) || ""), { root: n } = $t.parse(r), s = e.stopAt || n, i = e.limit || Number.POSITIVE_INFINITY, a = [t].flat(),
  c = /* @__PURE__ */ o((l) => {
    if (typeof t != "function")
      return Oe(a, l);
    let f = t(l.cwd);
    return typeof f == "string" ? Oe([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = c({ ...e, cwd: r });
    if (l === Ou || (l && p.push($t.resolve(r, l)), r === s || p.length >= i))
      break;
    r = $t.dirname(r);
  }
  return p;
}
o(Zu, "findUpMultipleSync");
function Hi(t, e = {}) {
  return Zu(t, { ...e, limit: 1 })[0];
}
o(Hi, "findUpSync");

// ../node_modules/pkg-dir/index.js
function Ki({ cwd: t } = {}) {
  let e = Hi("package.json", { cwd: t });
  return e && Nu.dirname(e);
}
o(Ki, "packageDirectorySync");

// node_modules/find-cache-dir/index.js
var { env: Wr, cwd: Du } = Ru, Yi = /* @__PURE__ */ o((t) => {
  try {
    return Vt.accessSync(t, Vt.constants.W_OK), !0;
  } catch {
    return !1;
  }
}, "isWritable");
function Xi(t, e) {
  return e.create && Vt.mkdirSync(t, { recursive: !0 }), t;
}
o(Xi, "useDirectory");
function Lu(t) {
  let e = Ye.join(t, "node_modules");
  if (!(!Yi(e) && (Vt.existsSync(e) || !Yi(Ye.join(t)))))
    return e;
}
o(Lu, "getNodeModuleDirectory");
function Jr(t = {}) {
  if (Wr.CACHE_DIR && !["true", "false", "1", "0"].includes(Wr.CACHE_DIR))
    return Xi(Ye.join(Wr.CACHE_DIR, t.name), t);
  let { cwd: e = Du(), files: r } = t;
  if (r) {
    if (!Array.isArray(r))
      throw new TypeError(`Expected \`files\` option to be an array, got \`${typeof r}\`.`);
    e = (0, Qi.default)(r.map((s) => Ye.resolve(e, s)));
  }
  if (e = Ki({ cwd: e }), !(!e || !Lu(e)))
    return Xi(Ye.join(e, "node_modules", ".cache", t.name), t);
}
o(Jr, "findCacheDirectory");

// src/common/utils/resolve-path-in-sb-cache.ts
function to(t, e = "default") {
  let r = Jr({ name: "storybook" });
  return r ||= eo(process.cwd(), "node_modules", ".cache", "storybook"), eo(r, e, t);
}
o(to, "resolvePathInStorybookCache");

// ../node_modules/find-up/index.js
import q from "node:path";

// ../node_modules/find-up/node_modules/unicorn-magic/node.js
import { fileURLToPath as Mu } from "node:url";
function Xe(t) {
  return t instanceof URL ? Mu(t) : t;
}
o(Xe, "toPath");

// ../node_modules/find-up/node_modules/path-exists/index.js
import by, { promises as _y } from "node:fs";

// ../node_modules/find-up/index.js
var ro = Symbol("findUpStop");
async function Uu(t, e = {}) {
  let r = q.resolve(Xe(e.cwd) ?? ""), { root: n } = q.parse(r), s = q.resolve(r, Xe(e.stopAt ?? n)), i = e.limit ?? Number.POSITIVE_INFINITY,
  a = [t].flat(), c = /* @__PURE__ */ o(async (l) => {
    if (typeof t != "function")
      return Ut(a, l);
    let f = await t(l.cwd);
    return typeof f == "string" ? Ut([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = await c({ ...e, cwd: r });
    if (l === ro || (l && p.push(q.resolve(r, l)), r === s || p.length >= i))
      break;
    r = q.dirname(r);
  }
  return p;
}
o(Uu, "findUpMultiple");
function $u(t, e = {}) {
  let r = q.resolve(Xe(e.cwd) ?? ""), { root: n } = q.parse(r), s = q.resolve(r, Xe(e.stopAt) ?? n), i = e.limit ?? Number.POSITIVE_INFINITY,
  a = [t].flat(), c = /* @__PURE__ */ o((l) => {
    if (typeof t != "function")
      return Oe(a, l);
    let f = t(l.cwd);
    return typeof f == "string" ? Oe([f], l) : f;
  }, "runMatcher"), p = [];
  for (; ; ) {
    let l = c({ ...e, cwd: r });
    if (l === ro || (l && p.push(q.resolve(r, l)), r === s || p.length >= i))
      break;
    r = q.dirname(r);
  }
  return p;
}
o($u, "findUpMultipleSync");
async function no(t, e = {}) {
  return (await Uu(t, { ...e, limit: 1 }))[0];
}
o(no, "findUp");
function Qe(t, e = {}) {
  return $u(t, { ...e, limit: 1 })[0];
}
o(Qe, "findUpSync");

// src/common/utils/paths.ts
import { join as io, relative as Gu, resolve as Ny, sep as Ft } from "node:path";

// src/common/js-package-manager/constants.ts
var Vu = "package-lock.json", Fu = "pnpm-lock.yaml", Bu = "yarn.lock", qu = "bun.lock", zu = "bun.lockb", so = [
  Vu,
  Fu,
  Bu,
  qu,
  zu
];

// src/common/utils/paths.ts
var z, Bt = /* @__PURE__ */ o(() => {
  if (z)
    return z;
  if (process.env.STORYBOOK_PROJECT_ROOT)
    return process.env.STORYBOOK_PROJECT_ROOT;
  try {
    let t = Qe(".git", { type: "directory" }) || Qe(".svn", { type: "directory" }) || Qe(".hg", { type: "directory" });
    if (t)
      return z = io(t, ".."), z;
  } catch (t) {
    process.stdout.write(`
error searching for repository root: ${t}
`);
  }
  try {
    let t = Qe(so, { type: "file" });
    if (t)
      return z = io(t, ".."), z;
  } catch (t) {
    process.stdout.write(`
error searching for lock file: ${t}
`);
  }
  try {
    let [t, e] = __dirname.split(`${Ft}node_modules${Ft}`, 2);
    if (e && !t.includes(`${Ft}npm-cache${Ft}`) && !Gu(t, process.cwd()).startsWith(".."))
      return z = t, z;
  } catch (t) {
    process.stdout.write(`
error searching for splitDirname: ${t}
`);
  }
  return z = process.cwd(), z;
}, "getProjectRoot");

// src/telemetry/run-telemetry-operation.ts
var oo = qr({
  basePath: to("telemetry"),
  ns: "storybook",
  ttl: 24 * 60 * 60 * 1e3
  // 24h
}), qt = /* @__PURE__ */ o(async (t, e) => {
  let r = await oo.get(t);
  return r === void 0 && (r = await e(), r !== void 0 && await oo.set(t, r)), r;
}, "runTelemetryOperation");

// src/telemetry/get-application-file-count.ts
var Ju = ["page", "screen"], Hu = ["js", "jsx", "ts", "tsx"], Ku = /* @__PURE__ */ o(async (t) => {
  let r = Ju.flatMap((n) => [
    n,
    [n[0].toUpperCase(), ...n.slice(1)].join("")
  ]).flatMap(
    (n) => Hu.map((s) => `"${t}${Wu}*${n}*.${s}"`)
  );
  try {
    let n = `git ls-files -- ${r.join(" ")}`;
    return await Rt(n);
  } catch {
    return;
  }
}, "getApplicationFilesCountUncached"), ao = /* @__PURE__ */ o(async (t) => qt(
  "applicationFiles",
  async () => Ku(t)
), "getApplicationFileCount");

// src/telemetry/get-chromatic-version.ts
function co(t) {
  let e = t.dependencies?.chromatic || t.devDependencies?.chromatic || t.peerDependencies?.chromatic;
  return e || (t.scripts && Object.values(t.scripts).find((r) => r?.match(/chromatic/)) ? "latest" : void 0);
}
o(co, "getChromaticVersionSpecifier");

// src/telemetry/get-framework-info.ts
import { normalize as Qu } from "node:path";
import { frameworkPackages as el } from "storybook/internal/common";

// src/telemetry/package-json.ts
import { readFile as Yu } from "node:fs/promises";
import { join as Xu } from "node:path";
var Hr = /* @__PURE__ */ o(async (t) => {
  let e = Object.keys(t);
  return Promise.all(e.map(zt));
}, "getActualPackageVersions"), zt = /* @__PURE__ */ o(async (t) => {
  try {
    let e = await Kr(t);
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
}, "getActualPackageVersion"), Kr = /* @__PURE__ */ o(async (t) => {
  try {
    let e = await no("package.json", { cwd: O.resolve(t) });
    return e || (e = O.resolve(Xu(t, "package.json"), {
      paths: [process.cwd()]
    })), JSON.parse(await Yu(e, { encoding: "utf8" }));
  } catch {
    return;
  }
}, "getActualPackageJson");

// src/telemetry/get-framework-info.ts
var tl = [
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
], rl = ["builder-webpack5", "builder-vite"];
function uo(t, e) {
  let { name: r = "", version: n, dependencies: s, devDependencies: i, peerDependencies: a } = t, c = {
    // We include the framework itself because it may be a renderer too (e.g. angular)
    [r]: n,
    ...s,
    ...i,
    ...a
  };
  return e.map((p) => `@storybook/${p}`).find((p) => c[p]);
}
o(uo, "findMatchingPackage");
var nl = /* @__PURE__ */ o((t) => {
  let e = Qu(t).replace(new RegExp(/\\/, "g"), "/");
  return Object.keys(el).find((n) => e.endsWith(n)) || De(t).replace(/.*node_modules[\\/]/, "");
}, "getFrameworkPackageName");
async function lo(t) {
  if (!t?.framework)
    return {};
  let e = typeof t.framework == "string" ? t.framework : t.framework?.name;
  if (!e)
    return {};
  let r = await Kr(e);
  if (!r)
    return {};
  let n = uo(r, rl), s = uo(r, tl), i = nl(e), a = typeof t.framework == "object" ? t.framework.options : {};
  return {
    framework: {
      name: i,
      options: a
    },
    builder: n,
    renderer: s
  };
}
o(lo, "getFrameworkInfo");

// src/telemetry/get-has-router-package.ts
var sl = /* @__PURE__ */ new Set([
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
function po(t) {
  return Object.keys(t?.dependencies ?? {}).some(
    (e) => sl.has(e)
  );
}
o(po, "getHasRouterPackage");

// src/telemetry/get-monorepo-type.ts
import { existsSync as fo, readFileSync as il } from "node:fs";
import { join as Yr } from "node:path";
import { getProjectRoot as Xr } from "storybook/internal/common";
var mo = {
  Nx: "nx.json",
  Turborepo: "turbo.json",
  Lerna: "lerna.json",
  Rush: "rush.json",
  Lage: "lage.config.json"
}, ho = /* @__PURE__ */ o(() => {
  let e = Object.keys(mo).find((n) => {
    let s = Yr(Xr(), mo[n]);
    return fo(s);
  });
  if (e)
    return e;
  if (!fo(Yr(Xr(), "package.json")))
    return;
  if (JSON.parse(
    il(Yr(Xr(), "package.json"), { encoding: "utf8" })
  )?.workspaces)
    return "Workspaces";
}, "getMonorepoType");

// ../node_modules/package-manager-detector/dist/constants.mjs
var yo = [
  "npm",
  "yarn",
  "yarn@berry",
  "pnpm",
  "pnpm@6",
  "bun",
  "deno"
], Qr = {
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "deno.lock": "deno",
  "pnpm-lock.yaml": "pnpm",
  "pnpm-workspace.yaml": "pnpm",
  "yarn.lock": "yarn",
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm"
}, en = {
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
import xo from "node:fs/promises";
import xe from "node:path";
import ol from "node:process";
async function tn(t, e) {
  try {
    let r = await xo.stat(t);
    return e === "file" ? r.isFile() : r.isDirectory();
  } catch {
    return !1;
  }
}
o(tn, "pathExists");
function* al(t = ol.cwd()) {
  let e = xe.resolve(t), { root: r } = xe.parse(e);
  for (; e && e !== r; )
    yield e, e = xe.dirname(e);
}
o(al, "lookup");
async function go(t, e) {
  return !t || !tn(t, "file") ? null : await dl(t, e);
}
o(go, "parsePackageJson");
async function rn(t = {}) {
  let { cwd: e, strategies: r = ["lockfile", "packageManager-field", "devEngines-field"], onUnknown: n } = t;
  for (let s of al(e))
    for (let i of r)
      switch (i) {
        case "lockfile": {
          for (let a of Object.keys(Qr))
            if (await tn(xe.join(s, a), "file")) {
              let c = Qr[a], p = await go(xe.join(s, "package.json"), n);
              return p || { name: c, agent: c };
            }
          break;
        }
        case "packageManager-field":
        case "devEngines-field": {
          let a = await go(xe.join(s, "package.json"), n);
          if (a)
            return a;
          break;
        }
        case "install-metadata": {
          for (let a of Object.keys(en)) {
            let c = a.endsWith("/") ? "dir" : "file";
            if (await tn(xe.join(s, a), c)) {
              let p = en[a], l = p === "yarn" ? ul(a) ? "yarn" : "yarn@berry" : p;
              return { name: p, agent: l };
            }
          }
          break;
        }
      }
  return null;
}
o(rn, "detect");
function cl(t) {
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
o(cl, "getNameAndVer");
async function dl(t, e) {
  try {
    let r = JSON.parse(await xo.readFile(t, "utf8")), n, s = cl(r);
    if (s) {
      let i = s.name, a = s.ver, c = a;
      return i === "yarn" && a && Number.parseInt(a) > 1 ? (n = "yarn@berry", c = "berry", { name: i, agent: n, version: c }) : i === "pnpm" &&
      a && Number.parseInt(a) < 7 ? (n = "pnpm@6", { name: i, agent: n, version: c }) : yo.includes(i) ? (n = i, { name: i, agent: n, version: c }) :
      e?.(r.packageManager) ?? null;
    }
  } catch {
  }
  return null;
}
o(dl, "handlePackageManager");
function ul(t) {
  return t.endsWith(".yarn_integrity");
}
o(ul, "isMetadataYarnClassic");

// ../node_modules/package-manager-detector/dist/index.mjs
import "node:fs/promises";
import "node:path";
import "node:process";

// src/telemetry/get-package-manager-info.ts
var vo = /* @__PURE__ */ o(async () => {
  let t = await rn({ cwd: Bt() });
  if (!t)
    return;
  let e = "node_modules";
  if (t.name === "yarn")
    try {
      let { stdout: r } = await Je("yarn config get nodeLinker", {
        cwd: Bt()
      });
      e = r.trim();
    } catch {
    }
  if (t.name === "pnpm")
    try {
      let { stdout: r } = await Je("pnpm config get nodeLinker", {
        cwd: Bt()
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
var ll = /* @__PURE__ */ o(async (t) => {
  try {
    let e = "git grep -l composeStor" + (t ? ` -- ${t}` : "");
    return await Rt(e);
  } catch (e) {
    return e.exitCode === 1 ? 0 : void 0;
  }
}, "getPortableStoriesFileCountUncached"), bo = /* @__PURE__ */ o(async (t) => qt(
  "portableStories",
  async () => ll(t)
), "getPortableStoriesFileCount");

// src/telemetry/storybook-metadata.ts
var _o = {
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
}, wo = /* @__PURE__ */ o((t) => De(t).replace(/\/dist\/.*/, "").replace(/\.[mc]?[tj]?s[x]?$/, "").replace(/\/register$/, "").replace(/\/manager$/,
"").replace(/\/preset$/, ""), "sanitizeAddonName"), vl = /* @__PURE__ */ o(async ({
  packageJsonPath: t,
  packageJson: e,
  mainConfig: r,
  configDir: n
}) => {
  let s = hl() ? void 0 : await Xn(), i = {
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
  }, c = Object.keys(a).find((k) => !!_o[k]);
  if (c) {
    let { version: k } = await zt(c);
    i.metaFramework = {
      name: _o[c],
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
    (k) => p.find((j) => k.includes(j))
  );
  i.testPackages = Object.fromEntries(
    await Promise.all(
      l.map(async (k) => [k, (await zt(k))?.version])
    )
  ), i.hasRouterPackage = po(e);
  let f = ho();
  f && (i.monorepo = f), i.packageManager = await vo();
  let x = a.typescript ? "typescript" : "javascript";
  if (!r)
    return {
      ...i,
      storybookVersionSpecifier: gl.storybook,
      language: x
    };
  i.hasCustomBabel = !!r.babel, i.hasCustomWebpack = !!r.webpackFinal, i.hasStaticDirs = !!r.staticDirs, typeof r.typescript == "object" && (i.
  typescriptOptions = r.typescript);
  let w = await lo(r);
  typeof r.refs == "object" && (i.refCount = Object.keys(r.refs).length), typeof r.features == "object" && (i.features = r.features);
  let _ = {};
  r.addons && r.addons.forEach((k) => {
    let j, st;
    typeof k == "string" ? j = wo(k) : (k.name.includes("addon-essentials") && (st = k.options), j = wo(k.name)), _[j] = {
      options: st,
      version: void 0
    };
  });
  let P = co(e);
  P && (_.chromatic = {
    version: void 0,
    versionSpecifier: P,
    options: void 0
  }), (await Hr(_)).forEach(({ name: k, version: j }) => {
    _[k] = _[k] || {
      name: k,
      version: j
    }, _[k].version = j || void 0;
  });
  let E = Object.keys(_), $ = Object.keys(a).filter((k) => k.includes("storybook") && !E.includes(k)).reduce((k, j) => ({
    ...k,
    [j]: { version: void 0 }
  }), {});
  (await Hr($)).forEach(({ name: k, version: j }) => {
    $[k] = $[k] || {
      name: k,
      version: j
    }, $[k].version = j || void 0;
  });
  let be = !!a["eslint-plugin-storybook"], Re = ml(n);
  try {
    let { previewConfigPath: k } = Re;
    if (k) {
      let j = await xl(k), st = !!(j.getFieldNode(["globals"]) || j.getFieldNode(["globalTypes"]));
      i.preview = { ...i.preview, usesGlobals: st };
    }
  } catch {
  }
  let rt = await bo(), nt = await ao(pl(t));
  return {
    ...i,
    ...w,
    portableStoriesFileCount: rt,
    applicationFileCount: nt,
    storybookVersion: ut,
    storybookVersionSpecifier: Re.version,
    language: x,
    storybookPackages: $,
    addons: _,
    hasStorybookEslint: be
  };
}, "computeStorybookMetadata");
async function bl() {
  let t = await Xt(process.cwd());
  return t ? {
    packageJsonPath: t,
    packageJson: await kn(t) || {}
  } : {
    packageJsonPath: process.cwd(),
    packageJson: {}
  };
}
o(bl, "getPackageJsonDetails");
var Gt, ko = /* @__PURE__ */ o(async (t) => {
  if (Gt)
    return Gt;
  let { packageJson: e, packageJsonPath: r } = await bl(), n = (t || fl(
    String(e?.scripts?.storybook || ""),
    "-c",
    "--config-dir"
  )) ?? ".storybook", s = await yl({ configDir: n }).catch(() => {
  });
  return Gt = await vl({
    mainConfig: s,
    packageJson: e,
    packageJsonPath: r,
    configDir: n
  }), Gt;
}, "getStorybookMetadata");

// src/telemetry/telemetry.ts
var No = H(Io(), 1);
import * as Zo from "node:os";
import { isCI as Rl } from "storybook/internal/common";

// ../node_modules/nanoid/index.js
import { randomFillSync as Co } from "crypto";

// ../node_modules/nanoid/url-alphabet/index.js
var So = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// ../node_modules/nanoid/index.js
var _l = 128, ve, Ze, wl = /* @__PURE__ */ o((t) => {
  !ve || ve.length < t ? (ve = Buffer.allocUnsafe(t * _l), Co(ve), Ze = 0) : Ze + t > ve.length && (Co(ve), Ze = 0), Ze += t;
}, "fillPool");
var et = /* @__PURE__ */ o((t = 21) => {
  wl(t -= 0);
  let e = "";
  for (let r = Ze - t; r < Ze; r++)
    e += So[ve[r] & 63];
  return e;
}, "nanoid");

// src/telemetry/anonymous-id.ts
Oi();
import { relative as Tl } from "node:path";
import { getProjectRoot as Il } from "storybook/internal/common";
import { execSync as Sl } from "child_process";

// src/telemetry/one-way-hash.ts
import { createHash as kl } from "crypto";
var nn = /* @__PURE__ */ o((t) => {
  let e = kl("sha256");
  return e.update("storybook-telemetry-salt"), e.update(t), e.digest("hex");
}, "oneWayHash");

// src/telemetry/anonymous-id.ts
function Cl(t) {
  let n = t.trim().replace(/#.*$/, "").replace(/^.*@/, "").replace(/^.*\/\//, "");
  return (n.endsWith(".git") ? n : `${n}.git`).replace(":", "/");
}
o(Cl, "normalizeGitUrl");
function Pl(t, e) {
  return `${Cl(t)}${Fr(e)}`;
}
o(Pl, "unhashedProjectId");
var Jt, Po = /* @__PURE__ */ o(() => {
  if (Jt)
    return Jt;
  try {
    let t = Tl(Il(), process.cwd()), e = Sl("git config --local --get remote.origin.url", {
      timeout: 1e3,
      stdio: "pipe"
    });
    Jt = nn(Pl(String(e), t));
  } catch {
  }
  return Jt;
}, "getAnonymousProjectId");

// src/telemetry/event-cache.ts
import { cache as on } from "storybook/internal/common";
var sn = Promise.resolve(), El = /* @__PURE__ */ o(async (t, e) => {
  let r = await on.get("lastEvents") || {};
  r[t] = { body: e, timestamp: Date.now() }, await on.set("lastEvents", r);
}, "setHelper"), jo = /* @__PURE__ */ o(async (t, e) => (await sn, sn = El(t, e), sn), "set");
var jl = /* @__PURE__ */ o((t) => {
  let { body: e, timestamp: r } = t;
  return {
    timestamp: r,
    eventType: e?.eventType,
    eventId: e?.eventId,
    sessionId: e?.sessionId
  };
}, "upgradeFields"), Al = ["init", "upgrade"], Ol = ["build", "dev", "error"], Eo = /* @__PURE__ */ o((t, e) => {
  let r = e.map((n) => t?.[n]).filter(Boolean).sort((n, s) => s.timestamp - n.timestamp);
  return r.length > 0 ? r[0] : void 0;
}, "lastEvent"), Zl = /* @__PURE__ */ o(async (t = void 0) => {
  let e = t || await on.get("lastEvents") || {}, r = Eo(e, Al), n = Eo(e, Ol);
  if (r)
    return !n?.timestamp || r.timestamp > n.timestamp ? jl(r) : void 0;
}, "getPrecedingUpgrade");

// src/telemetry/fetch.ts
var Ao = global.fetch;

// src/telemetry/session-id.ts
import { cache as Oo } from "storybook/internal/common";
var Nl = 1e3 * 60 * 60 * 2, tt;
var an = /* @__PURE__ */ o(async () => {
  let t = Date.now();
  if (!tt) {
    let e = await Oo.get("session");
    e && e.lastUsed >= t - Nl ? tt = e.id : tt = et();
  }
  return await Oo.set("session", { id: tt, lastUsed: t }), tt;
}, "getSessionId");

// src/telemetry/telemetry.ts
var Dl = (0, No.default)(Ao), Ll = process.env.STORYBOOK_TELEMETRY_URL || "https://storybook.js.org/event-log", Ht = [], Ml = /* @__PURE__ */ o(
(t, e) => {
  cn[t] = e;
}, "addToGlobalContext"), Ul = /* @__PURE__ */ o(() => {
  try {
    let t = Zo.platform();
    return t === "win32" ? "Windows" : t === "darwin" ? "macOS" : t === "linux" ? "Linux" : `Other: ${t}`;
  } catch {
    return "Unknown";
  }
}, "getOperatingSystem"), cn = {
  inCI: Rl(),
  isTTY: process.stdout.isTTY,
  platform: Ul(),
  nodeVersion: process.versions.node,
  storybookVersion: ut
}, $l = /* @__PURE__ */ o(async (t, e, r) => {
  let { eventType: n, payload: s, metadata: i, ...a } = t, c = await an(), p = et(), l = { ...a, eventType: n, eventId: p, sessionId: c, metadata: i,
  payload: s, context: e };
  return Dl(Ll, {
    method: "post",
    body: JSON.stringify(l),
    headers: { "Content-Type": "application/json" },
    retries: 3,
    retryOn: [503, 504],
    retryDelay: /* @__PURE__ */ o((f) => 2 ** f * (typeof r?.retryDelay == "number" && !Number.isNaN(r?.retryDelay) ? r.retryDelay : 1e3), "\
retryDelay")
  });
}, "prepareRequest");
async function Ro(t, e = { retryDelay: 1e3, immediate: !1 }) {
  let { eventType: r, payload: n, metadata: s, ...i } = t, a = e.stripMetadata ? cn : {
    ...cn,
    anonymousId: Po()
  }, c;
  try {
    c = $l(t, a, e), Ht.push(c), e.immediate ? await Promise.all(Ht) : await c;
    let p = await an(), l = et(), f = { ...i, eventType: r, eventId: l, sessionId: p, metadata: s, payload: n, context: a };
    await jo(r, f);
  } catch {
  } finally {
    Ht = Ht.filter((p) => p !== c);
  }
}
o(Ro, "sendTelemetry");

// src/telemetry/index.ts
var Pv = /* @__PURE__ */ o((t) => t.startsWith("example-button--") || t.startsWith("example-header--") || t.startsWith("example-page--"), "i\
sExampleStoryId"), Ev = /* @__PURE__ */ o(async (t, e = {}, r = {}) => {
  t !== "boot" && r.notify !== !1 && await yn();
  let n = {
    eventType: t,
    payload: e
  };
  try {
    r?.stripMetadata || (n.metadata = await ko(r?.configDir));
  } catch (s) {
    n.payload.metadataErrorMessage = ct(s).message, r?.enableCrashReports && (n.payload.metadataError = ct(s));
  } finally {
    let { error: s } = n.payload;
    s && (n.payload.error = ct(s)), (!n.payload.error || r?.enableCrashReports) && (process.env?.STORYBOOK_TELEMETRY_DEBUG && (Do.info(`
[telemetry]`), Do.info(JSON.stringify(n, null, 2))), await Ro(n, r));
  }
}, "telemetry");
export {
  Ml as addToGlobalContext,
  De as cleanPaths,
  vl as computeStorybookMetadata,
  Zl as getPrecedingUpgrade,
  ko as getStorybookMetadata,
  Pv as isExampleStoryId,
  _o as metaFrameworks,
  nn as oneWayHash,
  xn as removeAnsiEscapeCodes,
  wo as sanitizeAddonName,
  ct as sanitizeError,
  Ev as telemetry
};
