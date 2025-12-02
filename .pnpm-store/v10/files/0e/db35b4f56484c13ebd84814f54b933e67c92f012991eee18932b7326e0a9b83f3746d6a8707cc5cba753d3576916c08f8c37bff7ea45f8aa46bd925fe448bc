"use strict";
var gr = Object.create;
var X = Object.defineProperty;
var xr = Object.getOwnPropertyDescriptor;
var hr = Object.getOwnPropertyNames;
var Jr = Object.getPrototypeOf, wr = Object.prototype.hasOwnProperty;
var r = (n, s) => X(n, "name", { value: s, configurable: !0 });
var Pr = (n, s) => () => (s || n((s = { exports: {} }).exports, s), s.exports), br = (n, s) => {
  for (var a in s)
    X(n, a, { get: s[a], enumerable: !0 });
}, it = (n, s, a, p) => {
  if (s && typeof s == "object" || typeof s == "function")
    for (let c of hr(s))
      !wr.call(n, c) && c !== a && X(n, c, { get: () => s[c], enumerable: !(p = xr(s, c)) || p.enumerable });
  return n;
};
var Er = (n, s, a) => (a = n != null ? gr(Jr(n)) : {}, it(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  s || !n || !n.__esModule ? X(a, "default", { value: n, enumerable: !0 }) : a,
  n
)), Sr = (n) => it(X({}, "__esModule", { value: !0 }), n);

// ../node_modules/jsdoc-type-pratt-parser/dist/index.js
var gt = Pr((ue, Tt) => {
  (function(n, s) {
    typeof ue == "object" && typeof Tt < "u" ? s(ue) : typeof define == "function" && define.amd ? define(["exports"], s) : (n = typeof globalThis <
    "u" ? globalThis : n || self, s(n.jtpp = {}));
  })(ue, function(n) {
    "use strict";
    function s(e) {
      return e.text !== void 0 && e.text !== "" ? `'${e.type}' with value '${e.text}'` : `'${e.type}'`;
    }
    r(s, "tokenToString");
    class a extends Error {
      static {
        r(this, "NoParsletFoundError");
      }
      constructor(t) {
        super(`No parslet found for token: ${s(t)}`), this.token = t, Object.setPrototypeOf(this, a.prototype);
      }
      getToken() {
        return this.token;
      }
    }
    class p extends Error {
      static {
        r(this, "EarlyEndOfParseError");
      }
      constructor(t) {
        super(`The parsing ended early. The next token was: ${s(t)}`), this.token = t, Object.setPrototypeOf(this, p.prototype);
      }
      getToken() {
        return this.token;
      }
    }
    class c extends Error {
      static {
        r(this, "UnexpectedTypeError");
      }
      constructor(t, o) {
        let i = `Unexpected type: '${t.type}'.`;
        o !== void 0 && (i += ` Message: ${o}`), super(i), Object.setPrototypeOf(this, c.prototype);
      }
    }
    function u(e) {
      return (t) => t.startsWith(e) ? { type: e, text: e } : null;
    }
    r(u, "makePunctuationRule");
    function m(e) {
      let t = 0, o, i = e[0], l = !1;
      if (i !== "'" && i !== '"')
        return null;
      for (; t < e.length; ) {
        if (t++, o = e[t], !l && o === i) {
          t++;
          break;
        }
        l = !l && o === "\\";
      }
      if (o !== i)
        throw new Error("Unterminated String");
      return e.slice(0, t);
    }
    r(m, "getQuoted");
    let T = /[$_\p{ID_Start}]|\\u\p{Hex_Digit}{4}|\\u\{0*(?:\p{Hex_Digit}{1,5}|10\p{Hex_Digit}{4})\}/u, g = /[$\-\p{ID_Continue}\u200C\u200D]|\\u\p{Hex_Digit}{4}|\\u\{0*(?:\p{Hex_Digit}{1,5}|10\p{Hex_Digit}{4})\}/u;
    function P(e) {
      let t = e[0];
      if (!T.test(t))
        return null;
      let o = 1;
      do {
        if (t = e[o], !g.test(t))
          break;
        o++;
      } while (o < e.length);
      return e.slice(0, o);
    }
    r(P, "getIdentifier");
    let b = /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))/;
    function ye(e) {
      var t, o;
      return (o = (t = b.exec(e)) === null || t === void 0 ? void 0 : t[0]) !== null && o !== void 0 ? o : null;
    }
    r(ye, "getNumber");
    let $ = /* @__PURE__ */ r((e) => {
      let t = P(e);
      return t == null ? null : {
        type: "Identifier",
        text: t
      };
    }, "identifierRule");
    function E(e) {
      return (t) => {
        if (!t.startsWith(e))
          return null;
        let o = t[e.length];
        return o !== void 0 && g.test(o) ? null : {
          type: e,
          text: e
        };
      };
    }
    r(E, "makeKeyWordRule");
    let Q = /* @__PURE__ */ r((e) => {
      let t = m(e);
      return t == null ? null : {
        type: "StringValue",
        text: t
      };
    }, "stringValueRule"), de = /* @__PURE__ */ r((e) => e.length > 0 ? null : {
      type: "EOF",
      text: ""
    }, "eofRule"), Te = /* @__PURE__ */ r((e) => {
      let t = ye(e);
      return t === null ? null : {
        type: "Number",
        text: t
      };
    }, "numberRule"), Ft = [
      de,
      u("=>"),
      u("("),
      u(")"),
      u("{"),
      u("}"),
      u("["),
      u("]"),
      u("|"),
      u("&"),
      u("<"),
      u(">"),
      u(","),
      u(";"),
      u("*"),
      u("?"),
      u("!"),
      u("="),
      u(":"),
      u("..."),
      u("."),
      u("#"),
      u("~"),
      u("/"),
      u("@"),
      E("undefined"),
      E("null"),
      E("function"),
      E("this"),
      E("new"),
      E("module"),
      E("event"),
      E("external"),
      E("typeof"),
      E("keyof"),
      E("readonly"),
      E("import"),
      E("is"),
      E("in"),
      E("asserts"),
      Te,
      $,
      Q
    ], _t = /^\s*\n\s*/;
    class q {
      static {
        r(this, "Lexer");
      }
      static create(t) {
        let o = this.read(t);
        t = o.text;
        let i = this.read(t);
        return t = i.text, new q(t, void 0, o.token, i.token);
      }
      constructor(t, o, i, l) {
        this.text = "", this.text = t, this.previous = o, this.current = i, this.next = l;
      }
      static read(t, o = !1) {
        o = o || _t.test(t), t = t.trim();
        for (let i of Ft) {
          let l = i(t);
          if (l !== null) {
            let f = Object.assign(Object.assign({}, l), { startOfLine: o });
            return t = t.slice(f.text.length), { text: t, token: f };
          }
        }
        throw new Error("Unexpected Token " + t);
      }
      advance() {
        let t = q.read(this.text);
        return new q(t.text, this.current, this.next, t.token);
      }
    }
    function w(e) {
      if (e === void 0)
        throw new Error("Unexpected undefined");
      if (e.type === "JsdocTypeKeyValue" || e.type === "JsdocTypeParameterList" || e.type === "JsdocTypeProperty" || e.type === "JsdocTypeRe\
adonlyProperty" || e.type === "JsdocTypeObjectField" || e.type === "JsdocTypeJsdocObjectField" || e.type === "JsdocTypeIndexSignature" || e.
      type === "JsdocTypeMappedType")
        throw new c(e);
      return e;
    }
    r(w, "assertRootResult");
    function ge(e) {
      return e.type === "JsdocTypeKeyValue" ? Z(e) : w(e);
    }
    r(ge, "assertPlainKeyValueOrRootResult");
    function Vt(e) {
      return e.type === "JsdocTypeName" ? e : Z(e);
    }
    r(Vt, "assertPlainKeyValueOrNameResult");
    function Z(e) {
      if (e.type !== "JsdocTypeKeyValue")
        throw new c(e);
      return e;
    }
    r(Z, "assertPlainKeyValueResult");
    function Lt(e) {
      var t;
      if (e.type === "JsdocTypeVariadic") {
        if (((t = e.element) === null || t === void 0 ? void 0 : t.type) === "JsdocTypeName")
          return e;
        throw new c(e);
      }
      if (e.type !== "JsdocTypeNumber" && e.type !== "JsdocTypeName")
        throw new c(e);
      return e;
    }
    r(Lt, "assertNumberOrVariadicNameResult");
    function xe(e) {
      return e.type === "JsdocTypeIndexSignature" || e.type === "JsdocTypeMappedType";
    }
    r(xe, "isSquaredProperty");
    var y;
    (function(e) {
      e[e.ALL = 0] = "ALL", e[e.PARAMETER_LIST = 1] = "PARAMETER_LIST", e[e.OBJECT = 2] = "OBJECT", e[e.KEY_VALUE = 3] = "KEY_VALUE", e[e.INDEX_BRACKETS =
      4] = "INDEX_BRACKETS", e[e.UNION = 5] = "UNION", e[e.INTERSECTION = 6] = "INTERSECTION", e[e.PREFIX = 7] = "PREFIX", e[e.INFIX = 8] = "\
INFIX", e[e.TUPLE = 9] = "TUPLE", e[e.SYMBOL = 10] = "SYMBOL", e[e.OPTIONAL = 11] = "OPTIONAL", e[e.NULLABLE = 12] = "NULLABLE", e[e.KEY_OF_TYPE_OF =
      13] = "KEY_OF_TYPE_OF", e[e.FUNCTION = 14] = "FUNCTION", e[e.ARROW = 15] = "ARROW", e[e.ARRAY_BRACKETS = 16] = "ARRAY_BRACKETS", e[e.GENERIC =
      17] = "GENERIC", e[e.NAME_PATH = 18] = "NAME_PATH", e[e.PARENTHESIS = 19] = "PARENTHESIS", e[e.SPECIAL_TYPES = 20] = "SPECIAL_TYPES";
    })(y || (y = {}));
    class L {
      static {
        r(this, "Parser");
      }
      constructor(t, o, i) {
        this.grammar = t, typeof o == "string" ? this._lexer = q.create(o) : this._lexer = o, this.baseParser = i;
      }
      get lexer() {
        return this._lexer;
      }
      /**
       * Parses a given string and throws an error if the parse ended before the end of the string.
       */
      parse() {
        let t = this.parseType(y.ALL);
        if (this.lexer.current.type !== "EOF")
          throw new p(this.lexer.current);
        return t;
      }
      /**
       * Parses with the current lexer and asserts that the result is a {@link RootResult}.
       */
      parseType(t) {
        return w(this.parseIntermediateType(t));
      }
      /**
       * The main parsing function. First it tries to parse the current state in the prefix step, and then it continues
       * to parse the state in the infix step.
       */
      parseIntermediateType(t) {
        let o = this.tryParslets(null, t);
        if (o === null)
          throw new a(this.lexer.current);
        return this.parseInfixIntermediateType(o, t);
      }
      /**
       * In the infix parsing step the parser continues to parse the current state with all parslets until none returns
       * a result.
       */
      parseInfixIntermediateType(t, o) {
        let i = this.tryParslets(t, o);
        for (; i !== null; )
          t = i, i = this.tryParslets(t, o);
        return t;
      }
      /**
       * Tries to parse the current state with all parslets in the grammar and returns the first non null result.
       */
      tryParslets(t, o) {
        for (let i of this.grammar) {
          let l = i(this, o, t);
          if (l !== null)
            return l;
        }
        return null;
      }
      /**
       * If the given type equals the current type of the {@link Lexer} advance the lexer. Return true if the lexer was
       * advanced.
       */
      consume(t) {
        return Array.isArray(t) || (t = [t]), t.includes(this.lexer.current.type) ? (this._lexer = this.lexer.advance(), !0) : !1;
      }
      acceptLexerState(t) {
        this._lexer = t.lexer;
      }
    }
    function Xe(e) {
      return e === "EOF" || e === "|" || e === "," || e === ")" || e === ">";
    }
    r(Xe, "isQuestionMarkUnknownType");
    let he = /* @__PURE__ */ r((e, t, o) => {
      let i = e.lexer.current.type, l = e.lexer.next.type;
      return o == null && i === "?" && !Xe(l) || o != null && i === "?" ? (e.consume("?"), o == null ? {
        type: "JsdocTypeNullable",
        element: e.parseType(y.NULLABLE),
        meta: {
          position: "prefix"
        }
      } : {
        type: "JsdocTypeNullable",
        element: w(o),
        meta: {
          position: "suffix"
        }
      }) : null;
    }, "nullableParslet");
    function x(e) {
      let t = /* @__PURE__ */ r((o, i, l) => {
        let f = o.lexer.current.type, d = o.lexer.next.type;
        if (l === null) {
          if ("parsePrefix" in e && e.accept(f, d))
            return e.parsePrefix(o);
        } else if ("parseInfix" in e && e.precedence > i && e.accept(f, d))
          return e.parseInfix(o, l);
        return null;
      }, "parslet");
      return Object.defineProperty(t, "name", {
        value: e.name
      }), t;
    }
    r(x, "composeParslet");
    let ee = x({
      name: "optionalParslet",
      accept: /* @__PURE__ */ r((e) => e === "=", "accept"),
      precedence: y.OPTIONAL,
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("="), {
        type: "JsdocTypeOptional",
        element: e.parseType(y.OPTIONAL),
        meta: {
          position: "prefix"
        }
      }), "parsePrefix"),
      parseInfix: /* @__PURE__ */ r((e, t) => (e.consume("="), {
        type: "JsdocTypeOptional",
        element: w(t),
        meta: {
          position: "suffix"
        }
      }), "parseInfix")
    }), te = x({
      name: "numberParslet",
      accept: /* @__PURE__ */ r((e) => e === "Number", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        let t = parseFloat(e.lexer.current.text);
        return e.consume("Number"), {
          type: "JsdocTypeNumber",
          value: t
        };
      }, "parsePrefix")
    }), Ut = x({
      name: "parenthesisParslet",
      accept: /* @__PURE__ */ r((e) => e === "(", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        if (e.consume("("), e.consume(")"))
          return {
            type: "JsdocTypeParameterList",
            elements: []
          };
        let t = e.parseIntermediateType(y.ALL);
        if (!e.consume(")"))
          throw new Error("Unterminated parenthesis");
        return t.type === "JsdocTypeParameterList" ? t : t.type === "JsdocTypeKeyValue" ? {
          type: "JsdocTypeParameterList",
          elements: [t]
        } : {
          type: "JsdocTypeParenthesis",
          element: w(t)
        };
      }, "parsePrefix")
    }), Bt = x({
      name: "specialTypesParslet",
      accept: /* @__PURE__ */ r((e, t) => e === "?" && Xe(t) || e === "null" || e === "undefined" || e === "*", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        if (e.consume("null"))
          return {
            type: "JsdocTypeNull"
          };
        if (e.consume("undefined"))
          return {
            type: "JsdocTypeUndefined"
          };
        if (e.consume("*"))
          return {
            type: "JsdocTypeAny"
          };
        if (e.consume("?"))
          return {
            type: "JsdocTypeUnknown"
          };
        throw new Error("Unacceptable token: " + e.lexer.current.text);
      }, "parsePrefix")
    }), Ct = x({
      name: "notNullableParslet",
      accept: /* @__PURE__ */ r((e) => e === "!", "accept"),
      precedence: y.NULLABLE,
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("!"), {
        type: "JsdocTypeNotNullable",
        element: e.parseType(y.NULLABLE),
        meta: {
          position: "prefix"
        }
      }), "parsePrefix"),
      parseInfix: /* @__PURE__ */ r((e, t) => (e.consume("!"), {
        type: "JsdocTypeNotNullable",
        element: w(t),
        meta: {
          position: "suffix"
        }
      }), "parseInfix")
    });
    function Mt({ allowTrailingComma: e }) {
      return x({
        name: "parameterListParslet",
        accept: /* @__PURE__ */ r((t) => t === ",", "accept"),
        precedence: y.PARAMETER_LIST,
        parseInfix: /* @__PURE__ */ r((t, o) => {
          let i = [
            ge(o)
          ];
          t.consume(",");
          do
            try {
              let l = t.parseIntermediateType(y.PARAMETER_LIST);
              i.push(ge(l));
            } catch (l) {
              if (e && l instanceof a)
                break;
              throw l;
            }
          while (t.consume(","));
          if (i.length > 0 && i.slice(0, -1).some((l) => l.type === "JsdocTypeVariadic"))
            throw new Error("Only the last parameter may be a rest parameter");
          return {
            type: "JsdocTypeParameterList",
            elements: i
          };
        }, "parseInfix")
      });
    }
    r(Mt, "createParameterListParslet");
    let Kt = x({
      name: "genericParslet",
      accept: /* @__PURE__ */ r((e, t) => e === "<" || e === "." && t === "<", "accept"),
      precedence: y.GENERIC,
      parseInfix: /* @__PURE__ */ r((e, t) => {
        let o = e.consume(".");
        e.consume("<");
        let i = [];
        do
          i.push(e.parseType(y.PARAMETER_LIST));
        while (e.consume(","));
        if (!e.consume(">"))
          throw new Error("Unterminated generic parameter list");
        return {
          type: "JsdocTypeGeneric",
          left: w(t),
          elements: i,
          meta: {
            brackets: "angle",
            dot: o
          }
        };
      }, "parseInfix")
    }), $t = x({
      name: "unionParslet",
      accept: /* @__PURE__ */ r((e) => e === "|", "accept"),
      precedence: y.UNION,
      parseInfix: /* @__PURE__ */ r((e, t) => {
        e.consume("|");
        let o = [];
        do
          o.push(e.parseType(y.UNION));
        while (e.consume("|"));
        return {
          type: "JsdocTypeUnion",
          elements: [w(t), ...o]
        };
      }, "parseInfix")
    }), Je = [
      he,
      ee,
      te,
      Ut,
      Bt,
      Ct,
      Mt({
        allowTrailingComma: !0
      }),
      Kt,
      $t,
      ee
    ];
    function re({ allowSquareBracketsOnAnyType: e, allowJsdocNamePaths: t, pathGrammar: o }) {
      return /* @__PURE__ */ r(function(l, f, d) {
        if (d == null || f >= y.NAME_PATH)
          return null;
        let h = l.lexer.current.type, O = l.lexer.next.type;
        if (!(h === "." && O !== "<" || h === "[" && (e || d.type === "JsdocTypeName") || t && (h === "~" || h === "#")))
          return null;
        let D, se = !1;
        l.consume(".") ? D = "property" : l.consume("[") ? (D = "property-brackets", se = !0) : l.consume("~") ? D = "inner" : (l.consume("#"),
        D = "instance");
        let st = o !== null ? new L(o, l.lexer, l) : l, k = st.parseIntermediateType(y.NAME_PATH);
        l.acceptLexerState(st);
        let G;
        switch (k.type) {
          case "JsdocTypeName":
            G = {
              type: "JsdocTypeProperty",
              value: k.value,
              meta: {
                quote: void 0
              }
            };
            break;
          case "JsdocTypeNumber":
            G = {
              type: "JsdocTypeProperty",
              value: k.value.toString(10),
              meta: {
                quote: void 0
              }
            };
            break;
          case "JsdocTypeStringValue":
            G = {
              type: "JsdocTypeProperty",
              value: k.value,
              meta: {
                quote: k.meta.quote
              }
            };
            break;
          case "JsdocTypeSpecialNamePath":
            if (k.specialType === "event")
              G = k;
            else
              throw new c(k, "Type 'JsdocTypeSpecialNamePath' is only allowed with specialType 'event'");
            break;
          default:
            throw new c(k, "Expecting 'JsdocTypeName', 'JsdocTypeNumber', 'JsdocStringValue' or 'JsdocTypeSpecialNamePath'");
        }
        if (se && !l.consume("]")) {
          let at = l.lexer.current;
          throw new Error(`Unterminated square brackets. Next token is '${at.type}' with text '${at.text}'`);
        }
        return {
          type: "JsdocTypeNamePath",
          left: w(d),
          right: G,
          pathType: D
        };
      }, "namePathParslet");
    }
    r(re, "createNamePathParslet");
    function I({ allowedAdditionalTokens: e }) {
      return x({
        name: "nameParslet",
        accept: /* @__PURE__ */ r((t) => t === "Identifier" || t === "this" || t === "new" || e.includes(t), "accept"),
        parsePrefix: /* @__PURE__ */ r((t) => {
          let { type: o, text: i } = t.lexer.current;
          return t.consume(o), {
            type: "JsdocTypeName",
            value: i
          };
        }, "parsePrefix")
      });
    }
    r(I, "createNameParslet");
    let Y = x({
      name: "stringValueParslet",
      accept: /* @__PURE__ */ r((e) => e === "StringValue", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        let t = e.lexer.current.text;
        return e.consume("StringValue"), {
          type: "JsdocTypeStringValue",
          value: t.slice(1, -1),
          meta: {
            quote: t[0] === "'" ? "single" : "double"
          }
        };
      }, "parsePrefix")
    });
    function ne({ pathGrammar: e, allowedTypes: t }) {
      return x({
        name: "specialNamePathParslet",
        accept: /* @__PURE__ */ r((o) => t.includes(o), "accept"),
        parsePrefix: /* @__PURE__ */ r((o) => {
          let i = o.lexer.current.type;
          if (o.consume(i), !o.consume(":"))
            return {
              type: "JsdocTypeName",
              value: i
            };
          let l, f = o.lexer.current;
          if (o.consume("StringValue"))
            l = {
              type: "JsdocTypeSpecialNamePath",
              value: f.text.slice(1, -1),
              specialType: i,
              meta: {
                quote: f.text[0] === "'" ? "single" : "double"
              }
            };
          else {
            let O = "", S = ["Identifier", "@", "/"];
            for (; S.some((D) => o.consume(D)); )
              O += f.text, f = o.lexer.current;
            l = {
              type: "JsdocTypeSpecialNamePath",
              value: O,
              specialType: i,
              meta: {
                quote: void 0
              }
            };
          }
          let d = new L(e, o.lexer, o), h = d.parseInfixIntermediateType(l, y.ALL);
          return o.acceptLexerState(d), w(h);
        }, "parsePrefix")
      });
    }
    r(ne, "createSpecialNamePathParslet");
    let ze = [
      I({
        allowedAdditionalTokens: ["external", "module"]
      }),
      Y,
      te,
      re({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: null
      })
    ], U = [
      ...ze,
      ne({
        allowedTypes: ["event"],
        pathGrammar: ze
      })
    ];
    function we(e) {
      let t;
      if (e.type === "JsdocTypeParameterList")
        t = e.elements;
      else if (e.type === "JsdocTypeParenthesis")
        t = [e.element];
      else
        throw new c(e);
      return t.map((o) => ge(o));
    }
    r(we, "getParameters");
    function qt(e) {
      let t = we(e);
      if (t.some((o) => o.type === "JsdocTypeKeyValue"))
        throw new Error("No parameter should be named");
      return t;
    }
    r(qt, "getUnnamedParameters");
    function Pe({ allowNamedParameters: e, allowNoReturnType: t, allowWithoutParenthesis: o, allowNewAsFunctionKeyword: i }) {
      return x({
        name: "functionParslet",
        accept: /* @__PURE__ */ r((l, f) => l === "function" || i && l === "new" && f === "(", "accept"),
        parsePrefix: /* @__PURE__ */ r((l) => {
          let f = l.consume("new");
          l.consume("function");
          let d = l.lexer.current.type === "(";
          if (!d) {
            if (!o)
              throw new Error("function is missing parameter list");
            return {
              type: "JsdocTypeName",
              value: "function"
            };
          }
          let h = {
            type: "JsdocTypeFunction",
            parameters: [],
            arrow: !1,
            constructor: f,
            parenthesis: d
          }, O = l.parseIntermediateType(y.FUNCTION);
          if (e === void 0)
            h.parameters = qt(O);
          else {
            if (f && O.type === "JsdocTypeFunction" && O.arrow)
              return h = O, h.constructor = !0, h;
            h.parameters = we(O);
            for (let S of h.parameters)
              if (S.type === "JsdocTypeKeyValue" && !e.includes(S.key))
                throw new Error(`only allowed named parameters are ${e.join(", ")} but got ${S.type}`);
          }
          if (l.consume(":"))
            h.returnType = l.parseType(y.PREFIX);
          else if (!t)
            throw new Error("function is missing return type");
          return h;
        }, "parsePrefix")
      });
    }
    r(Pe, "createFunctionParslet");
    function be({ allowPostfix: e, allowEnclosingBrackets: t }) {
      return x({
        name: "variadicParslet",
        accept: /* @__PURE__ */ r((o) => o === "...", "accept"),
        precedence: y.PREFIX,
        parsePrefix: /* @__PURE__ */ r((o) => {
          o.consume("...");
          let i = t && o.consume("[");
          try {
            let l = o.parseType(y.PREFIX);
            if (i && !o.consume("]"))
              throw new Error("Unterminated variadic type. Missing ']'");
            return {
              type: "JsdocTypeVariadic",
              element: w(l),
              meta: {
                position: "prefix",
                squareBrackets: i
              }
            };
          } catch (l) {
            if (l instanceof a) {
              if (i)
                throw new Error("Empty square brackets for variadic are not allowed.");
              return {
                type: "JsdocTypeVariadic",
                meta: {
                  position: void 0,
                  squareBrackets: !1
                }
              };
            } else
              throw l;
          }
        }, "parsePrefix"),
        parseInfix: e ? (o, i) => (o.consume("..."), {
          type: "JsdocTypeVariadic",
          element: w(i),
          meta: {
            position: "suffix",
            squareBrackets: !1
          }
        }) : void 0
      });
    }
    r(be, "createVariadicParslet");
    let He = x({
      name: "symbolParslet",
      accept: /* @__PURE__ */ r((e) => e === "(", "accept"),
      precedence: y.SYMBOL,
      parseInfix: /* @__PURE__ */ r((e, t) => {
        if (t.type !== "JsdocTypeName")
          throw new Error("Symbol expects a name on the left side. (Reacting on '(')");
        e.consume("(");
        let o = {
          type: "JsdocTypeSymbol",
          value: t.value
        };
        if (!e.consume(")")) {
          let i = e.parseIntermediateType(y.SYMBOL);
          if (o.element = Lt(i), !e.consume(")"))
            throw new Error("Symbol does not end after value");
        }
        return o;
      }, "parseInfix")
    }), Qe = x({
      name: "arrayBracketsParslet",
      precedence: y.ARRAY_BRACKETS,
      accept: /* @__PURE__ */ r((e, t) => e === "[" && t === "]", "accept"),
      parseInfix: /* @__PURE__ */ r((e, t) => (e.consume("["), e.consume("]"), {
        type: "JsdocTypeGeneric",
        left: {
          type: "JsdocTypeName",
          value: "Array"
        },
        elements: [
          w(t)
        ],
        meta: {
          brackets: "square",
          dot: !1
        }
      }), "parseInfix")
    });
    function Ee({ objectFieldGrammar: e, allowKeyTypes: t }) {
      return x({
        name: "objectParslet",
        accept: /* @__PURE__ */ r((o) => o === "{", "accept"),
        parsePrefix: /* @__PURE__ */ r((o) => {
          o.consume("{");
          let i = {
            type: "JsdocTypeObject",
            meta: {
              separator: "comma"
            },
            elements: []
          };
          if (!o.consume("}")) {
            let l, f = new L(e, o.lexer, o);
            for (; ; ) {
              f.acceptLexerState(o);
              let d = f.parseIntermediateType(y.OBJECT);
              o.acceptLexerState(f), d === void 0 && t && (d = o.parseIntermediateType(y.OBJECT));
              let h = !1;
              if (d.type === "JsdocTypeNullable" && (h = !0, d = d.element), d.type === "JsdocTypeNumber" || d.type === "JsdocTypeName" || d.
              type === "JsdocTypeStringValue") {
                let S;
                d.type === "JsdocTypeStringValue" && (S = d.meta.quote), i.elements.push({
                  type: "JsdocTypeObjectField",
                  key: d.value.toString(),
                  right: void 0,
                  optional: h,
                  readonly: !1,
                  meta: {
                    quote: S
                  }
                });
              } else if (d.type === "JsdocTypeObjectField" || d.type === "JsdocTypeJsdocObjectField")
                i.elements.push(d);
              else
                throw new c(d);
              if (o.lexer.current.startOfLine)
                l = "linebreak";
              else if (o.consume(","))
                l = "comma";
              else if (o.consume(";"))
                l = "semicolon";
              else
                break;
              if (o.lexer.current.type === "}")
                break;
            }
            if (i.meta.separator = l ?? "comma", !o.consume("}"))
              throw new Error("Unterminated record type. Missing '}'");
          }
          return i;
        }, "parsePrefix")
      });
    }
    r(Ee, "createObjectParslet");
    function Se({ allowSquaredProperties: e, allowKeyTypes: t, allowReadonly: o, allowOptional: i }) {
      return x({
        name: "objectFieldParslet",
        precedence: y.KEY_VALUE,
        accept: /* @__PURE__ */ r((l) => l === ":", "accept"),
        parseInfix: /* @__PURE__ */ r((l, f) => {
          var d;
          let h = !1, O = !1;
          i && f.type === "JsdocTypeNullable" && (h = !0, f = f.element), o && f.type === "JsdocTypeReadonlyProperty" && (O = !0, f = f.element);
          let S = (d = l.baseParser) !== null && d !== void 0 ? d : l;
          if (S.acceptLexerState(l), f.type === "JsdocTypeNumber" || f.type === "JsdocTypeName" || f.type === "JsdocTypeStringValue" || xe(f)) {
            if (xe(f) && !e)
              throw new c(f);
            S.consume(":");
            let D;
            f.type === "JsdocTypeStringValue" && (D = f.meta.quote);
            let se = S.parseType(y.KEY_VALUE);
            return l.acceptLexerState(S), {
              type: "JsdocTypeObjectField",
              key: xe(f) ? f : f.value.toString(),
              right: se,
              optional: h,
              readonly: O,
              meta: {
                quote: D
              }
            };
          } else {
            if (!t)
              throw new c(f);
            S.consume(":");
            let D = S.parseType(y.KEY_VALUE);
            return l.acceptLexerState(S), {
              type: "JsdocTypeJsdocObjectField",
              left: w(f),
              right: D
            };
          }
        }, "parseInfix")
      });
    }
    r(Se, "createObjectFieldParslet");
    function Ne({ allowOptional: e, allowVariadic: t }) {
      return x({
        name: "keyValueParslet",
        precedence: y.KEY_VALUE,
        accept: /* @__PURE__ */ r((o) => o === ":", "accept"),
        parseInfix: /* @__PURE__ */ r((o, i) => {
          let l = !1, f = !1;
          if (e && i.type === "JsdocTypeNullable" && (l = !0, i = i.element), t && i.type === "JsdocTypeVariadic" && i.element !== void 0 &&
          (f = !0, i = i.element), i.type !== "JsdocTypeName")
            throw new c(i);
          o.consume(":");
          let d = o.parseType(y.KEY_VALUE);
          return {
            type: "JsdocTypeKeyValue",
            key: i.value,
            right: d,
            optional: l,
            variadic: f
          };
        }, "parseInfix")
      });
    }
    r(Ne, "createKeyValueParslet");
    let Ze = [
      ...Je,
      Pe({
        allowWithoutParenthesis: !0,
        allowNamedParameters: ["this", "new"],
        allowNoReturnType: !0,
        allowNewAsFunctionKeyword: !1
      }),
      Y,
      ne({
        allowedTypes: ["module", "external", "event"],
        pathGrammar: U
      }),
      be({
        allowEnclosingBrackets: !0,
        allowPostfix: !0
      }),
      I({
        allowedAdditionalTokens: ["keyof"]
      }),
      He,
      Qe,
      re({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: U
      })
    ], Yt = [
      ...Ze,
      Ee({
        // jsdoc syntax allows full types as keys, so we need to pull in the full grammar here
        // we leave out the object type deliberately
        objectFieldGrammar: [
          I({
            allowedAdditionalTokens: ["module", "in"]
          }),
          Se({
            allowSquaredProperties: !1,
            allowKeyTypes: !0,
            allowOptional: !1,
            allowReadonly: !1
          }),
          ...Ze
        ],
        allowKeyTypes: !0
      }),
      Ne({
        allowOptional: !0,
        allowVariadic: !0
      })
    ], et = x({
      name: "typeOfParslet",
      accept: /* @__PURE__ */ r((e) => e === "typeof", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("typeof"), {
        type: "JsdocTypeTypeof",
        element: w(e.parseType(y.KEY_OF_TYPE_OF))
      }), "parsePrefix")
    }), Wt = [
      I({
        allowedAdditionalTokens: ["module", "keyof", "event", "external", "in"]
      }),
      he,
      ee,
      Y,
      te,
      Se({
        allowSquaredProperties: !1,
        allowKeyTypes: !1,
        allowOptional: !1,
        allowReadonly: !1
      })
    ], Gt = [
      ...Je,
      Ee({
        allowKeyTypes: !1,
        objectFieldGrammar: Wt
      }),
      I({
        allowedAdditionalTokens: ["event", "external", "in"]
      }),
      et,
      Pe({
        allowWithoutParenthesis: !1,
        allowNamedParameters: ["this", "new"],
        allowNoReturnType: !0,
        allowNewAsFunctionKeyword: !1
      }),
      be({
        allowEnclosingBrackets: !1,
        allowPostfix: !1
      }),
      // additional name parslet is needed for some special cases
      I({
        allowedAdditionalTokens: ["keyof"]
      }),
      ne({
        allowedTypes: ["module"],
        pathGrammar: U
      }),
      re({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: U
      }),
      Ne({
        allowOptional: !1,
        allowVariadic: !1
      }),
      He
    ], Xt = x({
      name: "assertsParslet",
      accept: /* @__PURE__ */ r((e) => e === "asserts", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        e.consume("asserts");
        let t = e.parseIntermediateType(y.SYMBOL);
        if (t.type !== "JsdocTypeName")
          throw new c(t, "A typescript asserts always has to have a name on the left side.");
        return e.consume("is"), {
          type: "JsdocTypeAsserts",
          left: t,
          right: w(e.parseIntermediateType(y.INFIX))
        };
      }, "parsePrefix")
    });
    function zt({ allowQuestionMark: e }) {
      return x({
        name: "tupleParslet",
        accept: /* @__PURE__ */ r((t) => t === "[", "accept"),
        parsePrefix: /* @__PURE__ */ r((t) => {
          t.consume("[");
          let o = {
            type: "JsdocTypeTuple",
            elements: []
          };
          if (t.consume("]"))
            return o;
          let i = t.parseIntermediateType(y.ALL);
          if (i.type === "JsdocTypeParameterList" ? i.elements[0].type === "JsdocTypeKeyValue" ? o.elements = i.elements.map(Z) : o.elements =
          i.elements.map(w) : i.type === "JsdocTypeKeyValue" ? o.elements = [Z(i)] : o.elements = [w(i)], !t.consume("]"))
            throw new Error("Unterminated '['");
          if (!e && o.elements.some((l) => l.type === "JsdocTypeUnknown"))
            throw new Error("Question mark in tuple not allowed");
          return o;
        }, "parsePrefix")
      });
    }
    r(zt, "createTupleParslet");
    let Ht = x({
      name: "keyOfParslet",
      accept: /* @__PURE__ */ r((e) => e === "keyof", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("keyof"), {
        type: "JsdocTypeKeyof",
        element: w(e.parseType(y.KEY_OF_TYPE_OF))
      }), "parsePrefix")
    }), Qt = x({
      name: "importParslet",
      accept: /* @__PURE__ */ r((e) => e === "import", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        if (e.consume("import"), !e.consume("("))
          throw new Error("Missing parenthesis after import keyword");
        let t = e.parseType(y.PREFIX);
        if (t.type !== "JsdocTypeStringValue")
          throw new Error("Only string values are allowed as paths for imports");
        if (!e.consume(")"))
          throw new Error("Missing closing parenthesis after import keyword");
        return {
          type: "JsdocTypeImport",
          element: t
        };
      }, "parsePrefix")
    }), Zt = x({
      name: "readonlyPropertyParslet",
      accept: /* @__PURE__ */ r((e) => e === "readonly", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("readonly"), {
        type: "JsdocTypeReadonlyProperty",
        element: e.parseType(y.KEY_VALUE)
      }), "parsePrefix")
    }), er = x({
      name: "arrowFunctionParslet",
      precedence: y.ARROW,
      accept: /* @__PURE__ */ r((e) => e === "=>", "accept"),
      parseInfix: /* @__PURE__ */ r((e, t) => (e.consume("=>"), {
        type: "JsdocTypeFunction",
        parameters: we(t).map(Vt),
        arrow: !0,
        constructor: !1,
        parenthesis: !0,
        returnType: e.parseType(y.OBJECT)
      }), "parseInfix")
    }), tr = x({
      name: "intersectionParslet",
      accept: /* @__PURE__ */ r((e) => e === "&", "accept"),
      precedence: y.INTERSECTION,
      parseInfix: /* @__PURE__ */ r((e, t) => {
        e.consume("&");
        let o = [];
        do
          o.push(e.parseType(y.INTERSECTION));
        while (e.consume("&"));
        return {
          type: "JsdocTypeIntersection",
          elements: [w(t), ...o]
        };
      }, "parseInfix")
    }), rr = x({
      name: "predicateParslet",
      precedence: y.INFIX,
      accept: /* @__PURE__ */ r((e) => e === "is", "accept"),
      parseInfix: /* @__PURE__ */ r((e, t) => {
        if (t.type !== "JsdocTypeName")
          throw new c(t, "A typescript predicate always has to have a name on the left side.");
        return e.consume("is"), {
          type: "JsdocTypePredicate",
          left: t,
          right: w(e.parseIntermediateType(y.INFIX))
        };
      }, "parseInfix")
    }), nr = x({
      name: "objectSquareBracketPropertyParslet",
      accept: /* @__PURE__ */ r((e) => e === "[", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        if (e.baseParser === void 0)
          throw new Error("Only allowed inside object grammar");
        e.consume("[");
        let t = e.lexer.current.text;
        e.consume("Identifier");
        let o;
        if (e.consume(":")) {
          let i = e.baseParser;
          i.acceptLexerState(e), o = {
            type: "JsdocTypeIndexSignature",
            key: t,
            right: i.parseType(y.INDEX_BRACKETS)
          }, e.acceptLexerState(i);
        } else if (e.consume("in")) {
          let i = e.baseParser;
          i.acceptLexerState(e), o = {
            type: "JsdocTypeMappedType",
            key: t,
            right: i.parseType(y.ARRAY_BRACKETS)
          }, e.acceptLexerState(i);
        } else
          throw new Error("Missing ':' or 'in' inside square bracketed property.");
        if (!e.consume("]"))
          throw new Error("Unterminated square brackets");
        return o;
      }, "parsePrefix")
    }), or = [
      Zt,
      I({
        allowedAdditionalTokens: ["module", "event", "keyof", "event", "external", "in"]
      }),
      he,
      ee,
      Y,
      te,
      Se({
        allowSquaredProperties: !0,
        allowKeyTypes: !1,
        allowOptional: !0,
        allowReadonly: !0
      }),
      nr
    ], sr = [
      ...Je,
      Ee({
        allowKeyTypes: !1,
        objectFieldGrammar: or
      }),
      et,
      Ht,
      Qt,
      Y,
      Pe({
        allowWithoutParenthesis: !0,
        allowNoReturnType: !1,
        allowNamedParameters: ["this", "new", "args"],
        allowNewAsFunctionKeyword: !0
      }),
      zt({
        allowQuestionMark: !1
      }),
      be({
        allowEnclosingBrackets: !1,
        allowPostfix: !1
      }),
      Xt,
      I({
        allowedAdditionalTokens: ["event", "external", "in"]
      }),
      ne({
        allowedTypes: ["module"],
        pathGrammar: U
      }),
      Qe,
      er,
      re({
        allowSquareBracketsOnAnyType: !0,
        allowJsdocNamePaths: !1,
        pathGrammar: U
      }),
      tr,
      rr,
      Ne({
        allowVariadic: !0,
        allowOptional: !0
      })
    ];
    function tt(e, t) {
      switch (t) {
        case "closure":
          return new L(Gt, e).parse();
        case "jsdoc":
          return new L(Yt, e).parse();
        case "typescript":
          return new L(sr, e).parse();
      }
    }
    r(tt, "parse");
    function ar(e, t = ["typescript", "closure", "jsdoc"]) {
      let o;
      for (let i of t)
        try {
          return tt(e, i);
        } catch (l) {
          o = l;
        }
      throw o;
    }
    r(ar, "tryParse");
    function W(e, t) {
      let o = e[t.type];
      if (o === void 0)
        throw new Error(`In this set of transform rules exists no rule for type ${t.type}.`);
      return o(t, (i) => W(e, i));
    }
    r(W, "transform");
    function N(e) {
      throw new Error("This transform is not available. Are you trying the correct parsing mode?");
    }
    r(N, "notAvailableTransform");
    function rt(e) {
      let t = {
        params: []
      };
      for (let o of e.parameters)
        o.type === "JsdocTypeKeyValue" ? o.key === "this" ? t.this = o.right : o.key === "new" ? t.new = o.right : t.params.push(o) : t.params.
        push(o);
      return t;
    }
    r(rt, "extractSpecialParams");
    function oe(e, t, o) {
      return e === "prefix" ? o + t : t + o;
    }
    r(oe, "applyPosition");
    function R(e, t) {
      switch (t) {
        case "double":
          return `"${e}"`;
        case "single":
          return `'${e}'`;
        case void 0:
          return e;
      }
    }
    r(R, "quote");
    function nt() {
      return {
        JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => `(${e.element !== void 0 ? t(e.element) : ""})`, "JsdocTypeParenthesis"),
        JsdocTypeKeyof: /* @__PURE__ */ r((e, t) => `keyof ${t(e.element)}`, "JsdocTypeKeyof"),
        JsdocTypeFunction: /* @__PURE__ */ r((e, t) => {
          if (e.arrow) {
            if (e.returnType === void 0)
              throw new Error("Arrow function needs a return type.");
            let o = `(${e.parameters.map(t).join(", ")}) => ${t(e.returnType)}`;
            return e.constructor && (o = "new " + o), o;
          } else {
            let o = e.constructor ? "new" : "function";
            return e.parenthesis && (o += `(${e.parameters.map(t).join(", ")})`, e.returnType !== void 0 && (o += `: ${t(e.returnType)}`)), o;
          }
        }, "JsdocTypeFunction"),
        JsdocTypeName: /* @__PURE__ */ r((e) => e.value, "JsdocTypeName"),
        JsdocTypeTuple: /* @__PURE__ */ r((e, t) => `[${e.elements.map(t).join(", ")}]`, "JsdocTypeTuple"),
        JsdocTypeVariadic: /* @__PURE__ */ r((e, t) => e.meta.position === void 0 ? "..." : oe(e.meta.position, t(e.element), "..."), "Jsdoc\
TypeVariadic"),
        JsdocTypeNamePath: /* @__PURE__ */ r((e, t) => {
          let o = t(e.left), i = t(e.right);
          switch (e.pathType) {
            case "inner":
              return `${o}~${i}`;
            case "instance":
              return `${o}#${i}`;
            case "property":
              return `${o}.${i}`;
            case "property-brackets":
              return `${o}[${i}]`;
          }
        }, "JsdocTypeNamePath"),
        JsdocTypeStringValue: /* @__PURE__ */ r((e) => R(e.value, e.meta.quote), "JsdocTypeStringValue"),
        JsdocTypeAny: /* @__PURE__ */ r(() => "*", "JsdocTypeAny"),
        JsdocTypeGeneric: /* @__PURE__ */ r((e, t) => {
          if (e.meta.brackets === "square") {
            let o = e.elements[0], i = t(o);
            return o.type === "JsdocTypeUnion" || o.type === "JsdocTypeIntersection" ? `(${i})[]` : `${i}[]`;
          } else
            return `${t(e.left)}${e.meta.dot ? "." : ""}<${e.elements.map(t).join(", ")}>`;
        }, "JsdocTypeGeneric"),
        JsdocTypeImport: /* @__PURE__ */ r((e, t) => `import(${t(e.element)})`, "JsdocTypeImport"),
        JsdocTypeObjectField: /* @__PURE__ */ r((e, t) => {
          let o = "";
          return e.readonly && (o += "readonly "), typeof e.key == "string" ? o += R(e.key, e.meta.quote) : o += t(e.key), e.optional && (o +=
          "?"), e.right === void 0 ? o : o + `: ${t(e.right)}`;
        }, "JsdocTypeObjectField"),
        JsdocTypeJsdocObjectField: /* @__PURE__ */ r((e, t) => `${t(e.left)}: ${t(e.right)}`, "JsdocTypeJsdocObjectField"),
        JsdocTypeKeyValue: /* @__PURE__ */ r((e, t) => {
          let o = e.key;
          return e.optional && (o += "?"), e.variadic && (o = "..." + o), e.right === void 0 ? o : o + `: ${t(e.right)}`;
        }, "JsdocTypeKeyValue"),
        JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => `${e.specialType}:${R(e.value, e.meta.quote)}`, "JsdocTypeSpecialNamePath"),
        JsdocTypeNotNullable: /* @__PURE__ */ r((e, t) => oe(e.meta.position, t(e.element), "!"), "JsdocTypeNotNullable"),
        JsdocTypeNull: /* @__PURE__ */ r(() => "null", "JsdocTypeNull"),
        JsdocTypeNullable: /* @__PURE__ */ r((e, t) => oe(e.meta.position, t(e.element), "?"), "JsdocTypeNullable"),
        JsdocTypeNumber: /* @__PURE__ */ r((e) => e.value.toString(), "JsdocTypeNumber"),
        JsdocTypeObject: /* @__PURE__ */ r((e, t) => `{${e.elements.map(t).join((e.meta.separator === "comma" ? "," : ";") + " ")}}`, "Jsdoc\
TypeObject"),
        JsdocTypeOptional: /* @__PURE__ */ r((e, t) => oe(e.meta.position, t(e.element), "="), "JsdocTypeOptional"),
        JsdocTypeSymbol: /* @__PURE__ */ r((e, t) => `${e.value}(${e.element !== void 0 ? t(e.element) : ""})`, "JsdocTypeSymbol"),
        JsdocTypeTypeof: /* @__PURE__ */ r((e, t) => `typeof ${t(e.element)}`, "JsdocTypeTypeof"),
        JsdocTypeUndefined: /* @__PURE__ */ r(() => "undefined", "JsdocTypeUndefined"),
        JsdocTypeUnion: /* @__PURE__ */ r((e, t) => e.elements.map(t).join(" | "), "JsdocTypeUnion"),
        JsdocTypeUnknown: /* @__PURE__ */ r(() => "?", "JsdocTypeUnknown"),
        JsdocTypeIntersection: /* @__PURE__ */ r((e, t) => e.elements.map(t).join(" & "), "JsdocTypeIntersection"),
        JsdocTypeProperty: /* @__PURE__ */ r((e) => R(e.value, e.meta.quote), "JsdocTypeProperty"),
        JsdocTypePredicate: /* @__PURE__ */ r((e, t) => `${t(e.left)} is ${t(e.right)}`, "JsdocTypePredicate"),
        JsdocTypeIndexSignature: /* @__PURE__ */ r((e, t) => `[${e.key}: ${t(e.right)}]`, "JsdocTypeIndexSignature"),
        JsdocTypeMappedType: /* @__PURE__ */ r((e, t) => `[${e.key} in ${t(e.right)}]`, "JsdocTypeMappedType"),
        JsdocTypeAsserts: /* @__PURE__ */ r((e, t) => `asserts ${t(e.left)} is ${t(e.right)}`, "JsdocTypeAsserts")
      };
    }
    r(nt, "stringifyRules");
    let ir = nt();
    function pr(e) {
      return W(ir, e);
    }
    r(pr, "stringify");
    let cr = [
      "null",
      "true",
      "false",
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "debugger",
      "default",
      "delete",
      "do",
      "else",
      "export",
      "extends",
      "finally",
      "for",
      "function",
      "if",
      "import",
      "in",
      "instanceof",
      "new",
      "return",
      "super",
      "switch",
      "this",
      "throw",
      "try",
      "typeof",
      "var",
      "void",
      "while",
      "with",
      "yield"
    ];
    function j(e) {
      let t = {
        type: "NameExpression",
        name: e
      };
      return cr.includes(e) && (t.reservedWord = !0), t;
    }
    r(j, "makeName");
    let lr = {
      JsdocTypeOptional: /* @__PURE__ */ r((e, t) => {
        let o = t(e.element);
        return o.optional = !0, o;
      }, "JsdocTypeOptional"),
      JsdocTypeNullable: /* @__PURE__ */ r((e, t) => {
        let o = t(e.element);
        return o.nullable = !0, o;
      }, "JsdocTypeNullable"),
      JsdocTypeNotNullable: /* @__PURE__ */ r((e, t) => {
        let o = t(e.element);
        return o.nullable = !1, o;
      }, "JsdocTypeNotNullable"),
      JsdocTypeVariadic: /* @__PURE__ */ r((e, t) => {
        if (e.element === void 0)
          throw new Error("dots without value are not allowed in catharsis mode");
        let o = t(e.element);
        return o.repeatable = !0, o;
      }, "JsdocTypeVariadic"),
      JsdocTypeAny: /* @__PURE__ */ r(() => ({
        type: "AllLiteral"
      }), "JsdocTypeAny"),
      JsdocTypeNull: /* @__PURE__ */ r(() => ({
        type: "NullLiteral"
      }), "JsdocTypeNull"),
      JsdocTypeStringValue: /* @__PURE__ */ r((e) => j(R(e.value, e.meta.quote)), "JsdocTypeStringValue"),
      JsdocTypeUndefined: /* @__PURE__ */ r(() => ({
        type: "UndefinedLiteral"
      }), "JsdocTypeUndefined"),
      JsdocTypeUnknown: /* @__PURE__ */ r(() => ({
        type: "UnknownLiteral"
      }), "JsdocTypeUnknown"),
      JsdocTypeFunction: /* @__PURE__ */ r((e, t) => {
        let o = rt(e), i = {
          type: "FunctionType",
          params: o.params.map(t)
        };
        return o.this !== void 0 && (i.this = t(o.this)), o.new !== void 0 && (i.new = t(o.new)), e.returnType !== void 0 && (i.result = t(e.
        returnType)), i;
      }, "JsdocTypeFunction"),
      JsdocTypeGeneric: /* @__PURE__ */ r((e, t) => ({
        type: "TypeApplication",
        applications: e.elements.map((o) => t(o)),
        expression: t(e.left)
      }), "JsdocTypeGeneric"),
      JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => j(e.specialType + ":" + R(e.value, e.meta.quote)), "JsdocTypeSpecialNamePath"),
      JsdocTypeName: /* @__PURE__ */ r((e) => e.value !== "function" ? j(e.value) : {
        type: "FunctionType",
        params: []
      }, "JsdocTypeName"),
      JsdocTypeNumber: /* @__PURE__ */ r((e) => j(e.value.toString()), "JsdocTypeNumber"),
      JsdocTypeObject: /* @__PURE__ */ r((e, t) => {
        let o = {
          type: "RecordType",
          fields: []
        };
        for (let i of e.elements)
          i.type !== "JsdocTypeObjectField" && i.type !== "JsdocTypeJsdocObjectField" ? o.fields.push({
            type: "FieldType",
            key: t(i),
            value: void 0
          }) : o.fields.push(t(i));
        return o;
      }, "JsdocTypeObject"),
      JsdocTypeObjectField: /* @__PURE__ */ r((e, t) => {
        if (typeof e.key != "string")
          throw new Error("Index signatures and mapped types are not supported");
        return {
          type: "FieldType",
          key: j(R(e.key, e.meta.quote)),
          value: e.right === void 0 ? void 0 : t(e.right)
        };
      }, "JsdocTypeObjectField"),
      JsdocTypeJsdocObjectField: /* @__PURE__ */ r((e, t) => ({
        type: "FieldType",
        key: t(e.left),
        value: t(e.right)
      }), "JsdocTypeJsdocObjectField"),
      JsdocTypeUnion: /* @__PURE__ */ r((e, t) => ({
        type: "TypeUnion",
        elements: e.elements.map((o) => t(o))
      }), "JsdocTypeUnion"),
      JsdocTypeKeyValue: /* @__PURE__ */ r((e, t) => ({
        type: "FieldType",
        key: j(e.key),
        value: e.right === void 0 ? void 0 : t(e.right)
      }), "JsdocTypeKeyValue"),
      JsdocTypeNamePath: /* @__PURE__ */ r((e, t) => {
        let o = t(e.left), i;
        e.right.type === "JsdocTypeSpecialNamePath" ? i = t(e.right).name : i = R(e.right.value, e.right.meta.quote);
        let l = e.pathType === "inner" ? "~" : e.pathType === "instance" ? "#" : ".";
        return j(`${o.name}${l}${i}`);
      }, "JsdocTypeNamePath"),
      JsdocTypeSymbol: /* @__PURE__ */ r((e) => {
        let t = "", o = e.element, i = !1;
        return o?.type === "JsdocTypeVariadic" && (o.meta.position === "prefix" ? t = "..." : i = !0, o = o.element), o?.type === "JsdocType\
Name" ? t += o.value : o?.type === "JsdocTypeNumber" && (t += o.value.toString()), i && (t += "..."), j(`${e.value}(${t})`);
      }, "JsdocTypeSymbol"),
      JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => t(w(e.element)), "JsdocTypeParenthesis"),
      JsdocTypeMappedType: N,
      JsdocTypeIndexSignature: N,
      JsdocTypeImport: N,
      JsdocTypeKeyof: N,
      JsdocTypeTuple: N,
      JsdocTypeTypeof: N,
      JsdocTypeIntersection: N,
      JsdocTypeProperty: N,
      JsdocTypePredicate: N,
      JsdocTypeAsserts: N
    };
    function ur(e) {
      return W(lr, e);
    }
    r(ur, "catharsisTransform");
    function _(e) {
      switch (e) {
        case void 0:
          return "none";
        case "single":
          return "single";
        case "double":
          return "double";
      }
    }
    r(_, "getQuoteStyle");
    function mr(e) {
      switch (e) {
        case "inner":
          return "INNER_MEMBER";
        case "instance":
          return "INSTANCE_MEMBER";
        case "property":
          return "MEMBER";
        case "property-brackets":
          return "MEMBER";
      }
    }
    r(mr, "getMemberType");
    function Oe(e, t) {
      return t.length === 2 ? {
        type: e,
        left: t[0],
        right: t[1]
      } : {
        type: e,
        left: t[0],
        right: Oe(e, t.slice(1))
      };
    }
    r(Oe, "nestResults");
    let fr = {
      JsdocTypeOptional: /* @__PURE__ */ r((e, t) => ({
        type: "OPTIONAL",
        value: t(e.element),
        meta: {
          syntax: e.meta.position === "prefix" ? "PREFIX_EQUAL_SIGN" : "SUFFIX_EQUALS_SIGN"
        }
      }), "JsdocTypeOptional"),
      JsdocTypeNullable: /* @__PURE__ */ r((e, t) => ({
        type: "NULLABLE",
        value: t(e.element),
        meta: {
          syntax: e.meta.position === "prefix" ? "PREFIX_QUESTION_MARK" : "SUFFIX_QUESTION_MARK"
        }
      }), "JsdocTypeNullable"),
      JsdocTypeNotNullable: /* @__PURE__ */ r((e, t) => ({
        type: "NOT_NULLABLE",
        value: t(e.element),
        meta: {
          syntax: e.meta.position === "prefix" ? "PREFIX_BANG" : "SUFFIX_BANG"
        }
      }), "JsdocTypeNotNullable"),
      JsdocTypeVariadic: /* @__PURE__ */ r((e, t) => {
        let o = {
          type: "VARIADIC",
          meta: {
            syntax: e.meta.position === "prefix" ? "PREFIX_DOTS" : e.meta.position === "suffix" ? "SUFFIX_DOTS" : "ONLY_DOTS"
          }
        };
        return e.element !== void 0 && (o.value = t(e.element)), o;
      }, "JsdocTypeVariadic"),
      JsdocTypeName: /* @__PURE__ */ r((e) => ({
        type: "NAME",
        name: e.value
      }), "JsdocTypeName"),
      JsdocTypeTypeof: /* @__PURE__ */ r((e, t) => ({
        type: "TYPE_QUERY",
        name: t(e.element)
      }), "JsdocTypeTypeof"),
      JsdocTypeTuple: /* @__PURE__ */ r((e, t) => ({
        type: "TUPLE",
        entries: e.elements.map(t)
      }), "JsdocTypeTuple"),
      JsdocTypeKeyof: /* @__PURE__ */ r((e, t) => ({
        type: "KEY_QUERY",
        value: t(e.element)
      }), "JsdocTypeKeyof"),
      JsdocTypeImport: /* @__PURE__ */ r((e) => ({
        type: "IMPORT",
        path: {
          type: "STRING_VALUE",
          quoteStyle: _(e.element.meta.quote),
          string: e.element.value
        }
      }), "JsdocTypeImport"),
      JsdocTypeUndefined: /* @__PURE__ */ r(() => ({
        type: "NAME",
        name: "undefined"
      }), "JsdocTypeUndefined"),
      JsdocTypeAny: /* @__PURE__ */ r(() => ({
        type: "ANY"
      }), "JsdocTypeAny"),
      JsdocTypeFunction: /* @__PURE__ */ r((e, t) => {
        let o = rt(e), i = {
          type: e.arrow ? "ARROW" : "FUNCTION",
          params: o.params.map((l) => {
            if (l.type === "JsdocTypeKeyValue") {
              if (l.right === void 0)
                throw new Error("Function parameter without ':' is not expected to be 'KEY_VALUE'");
              return {
                type: "NAMED_PARAMETER",
                name: l.key,
                typeName: t(l.right)
              };
            } else
              return t(l);
          }),
          new: null,
          returns: null
        };
        return o.this !== void 0 ? i.this = t(o.this) : e.arrow || (i.this = null), o.new !== void 0 && (i.new = t(o.new)), e.returnType !==
        void 0 && (i.returns = t(e.returnType)), i;
      }, "JsdocTypeFunction"),
      JsdocTypeGeneric: /* @__PURE__ */ r((e, t) => {
        let o = {
          type: "GENERIC",
          subject: t(e.left),
          objects: e.elements.map(t),
          meta: {
            syntax: e.meta.brackets === "square" ? "SQUARE_BRACKET" : e.meta.dot ? "ANGLE_BRACKET_WITH_DOT" : "ANGLE_BRACKET"
          }
        };
        return e.meta.brackets === "square" && e.elements[0].type === "JsdocTypeFunction" && !e.elements[0].parenthesis && (o.objects[0] = {
          type: "NAME",
          name: "function"
        }), o;
      }, "JsdocTypeGeneric"),
      JsdocTypeObjectField: /* @__PURE__ */ r((e, t) => {
        if (typeof e.key != "string")
          throw new Error("Index signatures and mapped types are not supported");
        if (e.right === void 0)
          return {
            type: "RECORD_ENTRY",
            key: e.key,
            quoteStyle: _(e.meta.quote),
            value: null,
            readonly: !1
          };
        let o = t(e.right);
        return e.optional && (o = {
          type: "OPTIONAL",
          value: o,
          meta: {
            syntax: "SUFFIX_KEY_QUESTION_MARK"
          }
        }), {
          type: "RECORD_ENTRY",
          key: e.key.toString(),
          quoteStyle: _(e.meta.quote),
          value: o,
          readonly: !1
        };
      }, "JsdocTypeObjectField"),
      JsdocTypeJsdocObjectField: /* @__PURE__ */ r(() => {
        throw new Error("Keys may not be typed in jsdoctypeparser.");
      }, "JsdocTypeJsdocObjectField"),
      JsdocTypeKeyValue: /* @__PURE__ */ r((e, t) => {
        if (e.right === void 0)
          return {
            type: "RECORD_ENTRY",
            key: e.key,
            quoteStyle: "none",
            value: null,
            readonly: !1
          };
        let o = t(e.right);
        return e.optional && (o = {
          type: "OPTIONAL",
          value: o,
          meta: {
            syntax: "SUFFIX_KEY_QUESTION_MARK"
          }
        }), {
          type: "RECORD_ENTRY",
          key: e.key,
          quoteStyle: "none",
          value: o,
          readonly: !1
        };
      }, "JsdocTypeKeyValue"),
      JsdocTypeObject: /* @__PURE__ */ r((e, t) => {
        let o = [];
        for (let i of e.elements)
          (i.type === "JsdocTypeObjectField" || i.type === "JsdocTypeJsdocObjectField") && o.push(t(i));
        return {
          type: "RECORD",
          entries: o
        };
      }, "JsdocTypeObject"),
      JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => {
        if (e.specialType !== "module")
          throw new Error(`jsdoctypeparser does not support type ${e.specialType} at this point.`);
        return {
          type: "MODULE",
          value: {
            type: "FILE_PATH",
            quoteStyle: _(e.meta.quote),
            path: e.value
          }
        };
      }, "JsdocTypeSpecialNamePath"),
      JsdocTypeNamePath: /* @__PURE__ */ r((e, t) => {
        let o = !1, i, l;
        e.right.type === "JsdocTypeSpecialNamePath" && e.right.specialType === "event" ? (o = !0, i = e.right.value, l = _(e.right.meta.quote)) :
        (i = e.right.value, l = _(e.right.meta.quote));
        let f = {
          type: mr(e.pathType),
          owner: t(e.left),
          name: i,
          quoteStyle: l,
          hasEventPrefix: o
        };
        if (f.owner.type === "MODULE") {
          let d = f.owner;
          return f.owner = f.owner.value, d.value = f, d;
        } else
          return f;
      }, "JsdocTypeNamePath"),
      JsdocTypeUnion: /* @__PURE__ */ r((e, t) => Oe("UNION", e.elements.map(t)), "JsdocTypeUnion"),
      JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => ({
        type: "PARENTHESIS",
        value: t(w(e.element))
      }), "JsdocTypeParenthesis"),
      JsdocTypeNull: /* @__PURE__ */ r(() => ({
        type: "NAME",
        name: "null"
      }), "JsdocTypeNull"),
      JsdocTypeUnknown: /* @__PURE__ */ r(() => ({
        type: "UNKNOWN"
      }), "JsdocTypeUnknown"),
      JsdocTypeStringValue: /* @__PURE__ */ r((e) => ({
        type: "STRING_VALUE",
        quoteStyle: _(e.meta.quote),
        string: e.value
      }), "JsdocTypeStringValue"),
      JsdocTypeIntersection: /* @__PURE__ */ r((e, t) => Oe("INTERSECTION", e.elements.map(t)), "JsdocTypeIntersection"),
      JsdocTypeNumber: /* @__PURE__ */ r((e) => ({
        type: "NUMBER_VALUE",
        number: e.value.toString()
      }), "JsdocTypeNumber"),
      JsdocTypeSymbol: N,
      JsdocTypeProperty: N,
      JsdocTypePredicate: N,
      JsdocTypeMappedType: N,
      JsdocTypeIndexSignature: N,
      JsdocTypeAsserts: N
    };
    function yr(e) {
      return W(fr, e);
    }
    r(yr, "jtpTransform");
    function dr() {
      return {
        JsdocTypeIntersection: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeIntersection",
          elements: e.elements.map(t)
        }), "JsdocTypeIntersection"),
        JsdocTypeGeneric: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeGeneric",
          left: t(e.left),
          elements: e.elements.map(t),
          meta: {
            dot: e.meta.dot,
            brackets: e.meta.brackets
          }
        }), "JsdocTypeGeneric"),
        JsdocTypeNullable: /* @__PURE__ */ r((e) => e, "JsdocTypeNullable"),
        JsdocTypeUnion: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeUnion",
          elements: e.elements.map(t)
        }), "JsdocTypeUnion"),
        JsdocTypeUnknown: /* @__PURE__ */ r((e) => e, "JsdocTypeUnknown"),
        JsdocTypeUndefined: /* @__PURE__ */ r((e) => e, "JsdocTypeUndefined"),
        JsdocTypeTypeof: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeTypeof",
          element: t(e.element)
        }), "JsdocTypeTypeof"),
        JsdocTypeSymbol: /* @__PURE__ */ r((e, t) => {
          let o = {
            type: "JsdocTypeSymbol",
            value: e.value
          };
          return e.element !== void 0 && (o.element = t(e.element)), o;
        }, "JsdocTypeSymbol"),
        JsdocTypeOptional: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeOptional",
          element: t(e.element),
          meta: {
            position: e.meta.position
          }
        }), "JsdocTypeOptional"),
        JsdocTypeObject: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeObject",
          meta: {
            separator: "comma"
          },
          elements: e.elements.map(t)
        }), "JsdocTypeObject"),
        JsdocTypeNumber: /* @__PURE__ */ r((e) => e, "JsdocTypeNumber"),
        JsdocTypeNull: /* @__PURE__ */ r((e) => e, "JsdocTypeNull"),
        JsdocTypeNotNullable: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeNotNullable",
          element: t(e.element),
          meta: {
            position: e.meta.position
          }
        }), "JsdocTypeNotNullable"),
        JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => e, "JsdocTypeSpecialNamePath"),
        JsdocTypeObjectField: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeObjectField",
          key: e.key,
          right: e.right === void 0 ? void 0 : t(e.right),
          optional: e.optional,
          readonly: e.readonly,
          meta: e.meta
        }), "JsdocTypeObjectField"),
        JsdocTypeJsdocObjectField: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeJsdocObjectField",
          left: t(e.left),
          right: t(e.right)
        }), "JsdocTypeJsdocObjectField"),
        JsdocTypeKeyValue: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeKeyValue",
          key: e.key,
          right: e.right === void 0 ? void 0 : t(e.right),
          optional: e.optional,
          variadic: e.variadic
        }), "JsdocTypeKeyValue"),
        JsdocTypeImport: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeImport",
          element: t(e.element)
        }), "JsdocTypeImport"),
        JsdocTypeAny: /* @__PURE__ */ r((e) => e, "JsdocTypeAny"),
        JsdocTypeStringValue: /* @__PURE__ */ r((e) => e, "JsdocTypeStringValue"),
        JsdocTypeNamePath: /* @__PURE__ */ r((e) => e, "JsdocTypeNamePath"),
        JsdocTypeVariadic: /* @__PURE__ */ r((e, t) => {
          let o = {
            type: "JsdocTypeVariadic",
            meta: {
              position: e.meta.position,
              squareBrackets: e.meta.squareBrackets
            }
          };
          return e.element !== void 0 && (o.element = t(e.element)), o;
        }, "JsdocTypeVariadic"),
        JsdocTypeTuple: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeTuple",
          elements: e.elements.map(t)
        }), "JsdocTypeTuple"),
        JsdocTypeName: /* @__PURE__ */ r((e) => e, "JsdocTypeName"),
        JsdocTypeFunction: /* @__PURE__ */ r((e, t) => {
          let o = {
            type: "JsdocTypeFunction",
            arrow: e.arrow,
            parameters: e.parameters.map(t),
            constructor: e.constructor,
            parenthesis: e.parenthesis
          };
          return e.returnType !== void 0 && (o.returnType = t(e.returnType)), o;
        }, "JsdocTypeFunction"),
        JsdocTypeKeyof: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeKeyof",
          element: t(e.element)
        }), "JsdocTypeKeyof"),
        JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeParenthesis",
          element: t(e.element)
        }), "JsdocTypeParenthesis"),
        JsdocTypeProperty: /* @__PURE__ */ r((e) => e, "JsdocTypeProperty"),
        JsdocTypePredicate: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypePredicate",
          left: t(e.left),
          right: t(e.right)
        }), "JsdocTypePredicate"),
        JsdocTypeIndexSignature: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeIndexSignature",
          key: e.key,
          right: t(e.right)
        }), "JsdocTypeIndexSignature"),
        JsdocTypeMappedType: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeMappedType",
          key: e.key,
          right: t(e.right)
        }), "JsdocTypeMappedType"),
        JsdocTypeAsserts: /* @__PURE__ */ r((e, t) => ({
          type: "JsdocTypeAsserts",
          left: t(e.left),
          right: t(e.right)
        }), "JsdocTypeAsserts")
      };
    }
    r(dr, "identityTransformRules");
    let ot = {
      JsdocTypeAny: [],
      JsdocTypeFunction: ["parameters", "returnType"],
      JsdocTypeGeneric: ["left", "elements"],
      JsdocTypeImport: [],
      JsdocTypeIndexSignature: ["right"],
      JsdocTypeIntersection: ["elements"],
      JsdocTypeKeyof: ["element"],
      JsdocTypeKeyValue: ["right"],
      JsdocTypeMappedType: ["right"],
      JsdocTypeName: [],
      JsdocTypeNamePath: ["left", "right"],
      JsdocTypeNotNullable: ["element"],
      JsdocTypeNull: [],
      JsdocTypeNullable: ["element"],
      JsdocTypeNumber: [],
      JsdocTypeObject: ["elements"],
      JsdocTypeObjectField: ["right"],
      JsdocTypeJsdocObjectField: ["left", "right"],
      JsdocTypeOptional: ["element"],
      JsdocTypeParenthesis: ["element"],
      JsdocTypeSpecialNamePath: [],
      JsdocTypeStringValue: [],
      JsdocTypeSymbol: ["element"],
      JsdocTypeTuple: ["elements"],
      JsdocTypeTypeof: ["element"],
      JsdocTypeUndefined: [],
      JsdocTypeUnion: ["elements"],
      JsdocTypeUnknown: [],
      JsdocTypeVariadic: ["element"],
      JsdocTypeProperty: [],
      JsdocTypePredicate: ["left", "right"],
      JsdocTypeAsserts: ["left", "right"]
    };
    function De(e, t, o, i, l) {
      i?.(e, t, o);
      let f = ot[e.type];
      for (let d of f) {
        let h = e[d];
        if (h !== void 0)
          if (Array.isArray(h))
            for (let O of h)
              De(O, e, d, i, l);
          else
            De(h, e, d, i, l);
      }
      l?.(e, t, o);
    }
    r(De, "_traverse");
    function Tr(e, t, o) {
      De(e, void 0, void 0, t, o);
    }
    r(Tr, "traverse"), n.catharsisTransform = ur, n.identityTransformRules = dr, n.jtpTransform = yr, n.parse = tt, n.stringify = pr, n.stringifyRules =
    nt, n.transform = W, n.traverse = Tr, n.tryParse = ar, n.visitorKeys = ot;
  });
});

// src/docs-tools/index.ts
var bn = {};
br(bn, {
  ADDON_ID: () => Ge,
  MAX_DEFAULT_VALUE_SUMMARY_LENGTH: () => tn,
  MAX_TYPE_SUMMARY_LENGTH: () => en,
  PANEL_ID: () => Jn,
  PARAM_KEY: () => wn,
  SNIPPET_RENDERED: () => Pn,
  SourceType: () => jt,
  TypeSystem: () => ut,
  convert: () => H,
  createSummaryValue: () => J,
  enhanceArgTypes: () => hn,
  extractComponentDescription: () => xn,
  extractComponentProps: () => gn,
  extractComponentSectionArray: () => At,
  extractComponentSectionObject: () => It,
  getDocgenDescription: () => je,
  getDocgenSection: () => Re,
  hasDocgen: () => Ae,
  isDefaultValueBlacklisted: () => V,
  isTooLongForDefaultValueSummary: () => qe,
  isTooLongForTypeSummary: () => me,
  isValidDocgenSection: () => Ie,
  normalizeNewlines: () => rn,
  parseJsDoc: () => $e,
  str: () => ke
});
module.exports = Sr(bn);

// src/docs-tools/argTypes/convert/flow/convert.ts
var pt = require("storybook/internal/preview-errors");
var Nr = /* @__PURE__ */ r((n) => n.name === "literal", "isLiteral"), Or = /* @__PURE__ */ r((n) => n.value.replace(/['|"]/g, ""), "toEnumOp\
tion"), Dr = /* @__PURE__ */ r((n) => {
  switch (n.type) {
    case "function":
      return { name: "function" };
    case "object":
      let s = {};
      return n.signature.properties.forEach((a) => {
        s[a.key] = B(a.value);
      }), {
        name: "object",
        value: s
      };
    default:
      throw new pt.UnknownArgTypesError({ type: n, language: "Flow" });
  }
}, "convertSig"), B = /* @__PURE__ */ r((n) => {
  let { name: s, raw: a } = n, p = {};
  switch (typeof a < "u" && (p.raw = a), n.name) {
    case "literal":
      return { ...p, name: "other", value: n.value };
    case "string":
    case "number":
    case "symbol":
    case "boolean":
      return { ...p, name: s };
    case "Array":
      return { ...p, name: "array", value: n.elements.map(B) };
    case "signature":
      return { ...p, ...Dr(n) };
    case "union":
      return n.elements?.every(Nr) ? { ...p, name: "enum", value: n.elements?.map(Or) } : { ...p, name: s, value: n.elements?.map(B) };
    case "intersection":
      return { ...p, name: s, value: n.elements?.map(B) };
    default:
      return { ...p, name: "other", value: s };
  }
}, "convert");

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function z(n) {
  if (!n || typeof n != "object")
    return !1;
  let s = Object.getPrototypeOf(n);
  return s === null || s === Object.prototype || Object.getPrototypeOf(s) === null ? Object.prototype.toString.call(n) === "[object Object]" :
  !1;
}
r(z, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function ve(n, s) {
  let a = {}, p = Object.keys(n);
  for (let c = 0; c < p.length; c++) {
    let u = p[c], m = n[u];
    a[u] = s(m, u, n);
  }
  return a;
}
r(ve, "mapValues");

// src/docs-tools/argTypes/convert/utils.ts
var ct = /^['"]|['"]$/g, vr = /* @__PURE__ */ r((n) => n.replace(ct, ""), "trimQuotes"), kr = /* @__PURE__ */ r((n) => ct.test(n), "includes\
Quotes"), ae = /* @__PURE__ */ r((n) => {
  let s = vr(n);
  return kr(n) || Number.isNaN(Number(s)) ? s : Number(s);
}, "parseLiteral");

// src/docs-tools/argTypes/convert/proptypes/convert.ts
var Ar = /^\(.*\) => /, C = /* @__PURE__ */ r((n) => {
  let { name: s, raw: a, computed: p, value: c } = n, u = {};
  switch (typeof a < "u" && (u.raw = a), s) {
    case "enum": {
      let T = p ? c : c.map((g) => ae(g.value));
      return { ...u, name: s, value: T };
    }
    case "string":
    case "number":
    case "symbol":
      return { ...u, name: s };
    case "func":
      return { ...u, name: "function" };
    case "bool":
    case "boolean":
      return { ...u, name: "boolean" };
    case "arrayOf":
    case "array":
      return { ...u, name: "array", value: c && C(c) };
    case "object":
      return { ...u, name: s };
    case "objectOf":
      return { ...u, name: s, value: C(c) };
    case "shape":
    case "exact":
      let m = ve(c, (T) => C(T));
      return { ...u, name: "object", value: m };
    case "union":
      return { ...u, name: "union", value: c.map((T) => C(T)) };
    case "instanceOf":
    case "element":
    case "elementType":
    default: {
      if (s?.indexOf("|") > 0)
        try {
          let P = s.split("|").map((b) => JSON.parse(b));
          return { ...u, name: "enum", value: P };
        } catch {
        }
      let T = c ? `${s}(${c})` : s, g = Ar.test(s) ? "function" : "other";
      return { ...u, name: g, value: T };
    }
  }
}, "convert");

// src/docs-tools/argTypes/convert/typescript/convert.ts
var lt = require("storybook/internal/preview-errors");
var Ir = /* @__PURE__ */ r((n) => {
  switch (n.type) {
    case "function":
      return { name: "function" };
    case "object":
      let s = {};
      return n.signature.properties.forEach((a) => {
        s[a.key] = M(a.value);
      }), {
        name: "object",
        value: s
      };
    default:
      throw new lt.UnknownArgTypesError({ type: n, language: "Typescript" });
  }
}, "convertSig"), M = /* @__PURE__ */ r((n) => {
  let { name: s, raw: a } = n, p = {};
  switch (typeof a < "u" && (p.raw = a), n.name) {
    case "string":
    case "number":
    case "symbol":
    case "boolean":
      return { ...p, name: s };
    case "Array":
      return { ...p, name: "array", value: n.elements.map(M) };
    case "signature":
      return { ...p, ...Ir(n) };
    case "union":
      let c;
      return n.elements?.every((u) => u.name === "literal") ? c = {
        ...p,
        name: "enum",
        // @ts-expect-error fix types
        value: n.elements?.map((u) => ae(u.value))
      } : c = { ...p, name: s, value: n.elements?.map(M) }, c;
    case "intersection":
      return { ...p, name: s, value: n.elements?.map(M) };
    default:
      return { ...p, name: "other", value: s };
  }
}, "convert");

// src/docs-tools/argTypes/convert/index.ts
var H = /* @__PURE__ */ r((n) => {
  let { type: s, tsType: a, flowType: p } = n;
  try {
    if (s != null)
      return C(s);
    if (a != null)
      return M(a);
    if (p != null)
      return B(p);
  } catch (c) {
    console.error(c);
  }
  return null;
}, "convert");

// src/docs-tools/argTypes/docgen/types.ts
var ut = /* @__PURE__ */ ((c) => (c.JAVASCRIPT = "JavaScript", c.FLOW = "Flow", c.TYPESCRIPT = "TypeScript", c.UNKNOWN = "Unknown", c))(ut ||
{});

// src/docs-tools/argTypes/docgen/utils/defaultValue.ts
var Rr = ["null", "undefined"];
function V(n) {
  return Rr.some((s) => s === n);
}
r(V, "isDefaultValueBlacklisted");

// src/docs-tools/argTypes/docgen/utils/string.ts
var ke = /* @__PURE__ */ r((n) => {
  if (!n)
    return "";
  if (typeof n == "string")
    return n;
  throw new Error(`Description: expected string, got: ${JSON.stringify(n)}`);
}, "str");

// src/docs-tools/argTypes/docgen/utils/docgenInfo.ts
function Ae(n) {
  return !!n.__docgenInfo;
}
r(Ae, "hasDocgen");
function Ie(n) {
  return n != null && Object.keys(n).length > 0;
}
r(Ie, "isValidDocgenSection");
function Re(n, s) {
  return Ae(n) ? n.__docgenInfo[s] : null;
}
r(Re, "getDocgenSection");
function je(n) {
  return Ae(n) ? ke(n.__docgenInfo.description) : "";
}
r(je, "getDocgenDescription");

// ../node_modules/comment-parser/es6/primitives.js
var v;
(function(n) {
  n.start = "/**", n.nostart = "/***", n.delim = "*", n.end = "*/";
})(v = v || (v = {}));

// ../node_modules/comment-parser/es6/util.js
function Fe(n) {
  return /^\s+$/.test(n);
}
r(Fe, "isSpace");
function mt(n) {
  let s = n.match(/\r+$/);
  return s == null ? ["", n] : [n.slice(-s[0].length), n.slice(0, -s[0].length)];
}
r(mt, "splitCR");
function A(n) {
  let s = n.match(/^\s+/);
  return s == null ? ["", n] : [n.slice(0, s[0].length), n.slice(s[0].length)];
}
r(A, "splitSpace");
function ft(n) {
  return n.split(/\n/);
}
r(ft, "splitLines");
function yt(n = {}) {
  return Object.assign({ tag: "", name: "", type: "", optional: !1, description: "", problems: [], source: [] }, n);
}
r(yt, "seedSpec");
function _e(n = {}) {
  return Object.assign({ start: "", delimiter: "", postDelimiter: "", tag: "", postTag: "", name: "", postName: "", type: "", postType: "", description: "",
  end: "", lineEnd: "" }, n);
}
r(_e, "seedTokens");

// ../node_modules/comment-parser/es6/parser/block-parser.js
var jr = /^@\S+/;
function Ve({ fence: n = "```" } = {}) {
  let s = Fr(n), a = /* @__PURE__ */ r((p, c) => s(p) ? !c : c, "toggleFence");
  return /* @__PURE__ */ r(function(c) {
    let u = [[]], m = !1;
    for (let T of c)
      jr.test(T.tokens.description) && !m ? u.push([T]) : u[u.length - 1].push(T), m = a(T.tokens.description, m);
    return u;
  }, "parseBlock");
}
r(Ve, "getParser");
function Fr(n) {
  return typeof n == "string" ? (s) => s.split(n).length % 2 === 0 : n;
}
r(Fr, "getFencer");

// ../node_modules/comment-parser/es6/parser/source-parser.js
function Le({ startLine: n = 0, markers: s = v } = {}) {
  let a = null, p = n;
  return /* @__PURE__ */ r(function(u) {
    let m = u, T = _e();
    if ([T.lineEnd, m] = mt(m), [T.start, m] = A(m), a === null && m.startsWith(s.start) && !m.startsWith(s.nostart) && (a = [], T.delimiter =
    m.slice(0, s.start.length), m = m.slice(s.start.length), [T.postDelimiter, m] = A(m)), a === null)
      return p++, null;
    let g = m.trimRight().endsWith(s.end);
    if (T.delimiter === "" && m.startsWith(s.delim) && !m.startsWith(s.end) && (T.delimiter = s.delim, m = m.slice(s.delim.length), [T.postDelimiter,
    m] = A(m)), g) {
      let P = m.trimRight();
      T.end = m.slice(P.length - s.end.length), m = P.slice(0, -s.end.length);
    }
    if (T.description = m, a.push({ number: p, source: u, tokens: T }), p++, g) {
      let P = a.slice();
      return a = null, P;
    }
    return null;
  }, "parseSource");
}
r(Le, "getParser");

// ../node_modules/comment-parser/es6/parser/spec-parser.js
function Ue({ tokenizers: n }) {
  return /* @__PURE__ */ r(function(a) {
    var p;
    let c = yt({ source: a });
    for (let u of n)
      if (c = u(c), !((p = c.problems[c.problems.length - 1]) === null || p === void 0) && p.critical)
        break;
    return c;
  }, "parseSpec");
}
r(Ue, "getParser");

// ../node_modules/comment-parser/es6/parser/tokenizers/tag.js
function ie() {
  return (n) => {
    let { tokens: s } = n.source[0], a = s.description.match(/\s*(@(\S+))(\s*)/);
    return a === null ? (n.problems.push({
      code: "spec:tag:prefix",
      message: 'tag should start with "@" symbol',
      line: n.source[0].number,
      critical: !0
    }), n) : (s.tag = a[1], s.postTag = a[3], s.description = s.description.slice(a[0].length), n.tag = a[2], n);
  };
}
r(ie, "tagTokenizer");

// ../node_modules/comment-parser/es6/parser/tokenizers/type.js
function pe(n = "compact") {
  let s = Vr(n);
  return (a) => {
    let p = 0, c = [];
    for (let [T, { tokens: g }] of a.source.entries()) {
      let P = "";
      if (T === 0 && g.description[0] !== "{")
        return a;
      for (let b of g.description)
        if (b === "{" && p++, b === "}" && p--, P += b, p === 0)
          break;
      if (c.push([g, P]), p === 0)
        break;
    }
    if (p !== 0)
      return a.problems.push({
        code: "spec:type:unpaired-curlies",
        message: "unpaired curlies",
        line: a.source[0].number,
        critical: !0
      }), a;
    let u = [], m = c[0][0].postDelimiter.length;
    for (let [T, [g, P]] of c.entries())
      g.type = P, T > 0 && (g.type = g.postDelimiter.slice(m) + P, g.postDelimiter = g.postDelimiter.slice(0, m)), [g.postType, g.description] =
      A(g.description.slice(P.length)), u.push(g.type);
    return u[0] = u[0].slice(1), u[u.length - 1] = u[u.length - 1].slice(0, -1), a.type = s(u), a;
  };
}
r(pe, "typeTokenizer");
var _r = /* @__PURE__ */ r((n) => n.trim(), "trim");
function Vr(n) {
  return n === "compact" ? (s) => s.map(_r).join("") : n === "preserve" ? (s) => s.join(`
`) : n;
}
r(Vr, "getJoiner");

// ../node_modules/comment-parser/es6/parser/tokenizers/name.js
var Lr = /* @__PURE__ */ r((n) => n && n.startsWith('"') && n.endsWith('"'), "isQuoted");
function ce() {
  let n = /* @__PURE__ */ r((s, { tokens: a }, p) => a.type === "" ? s : p, "typeEnd");
  return (s) => {
    let { tokens: a } = s.source[s.source.reduce(n, 0)], p = a.description.trimLeft(), c = p.split('"');
    if (c.length > 1 && c[0] === "" && c.length % 2 === 1)
      return s.name = c[1], a.name = `"${c[1]}"`, [a.postName, a.description] = A(p.slice(a.name.length)), s;
    let u = 0, m = "", T = !1, g;
    for (let b of p) {
      if (u === 0 && Fe(b))
        break;
      b === "[" && u++, b === "]" && u--, m += b;
    }
    if (u !== 0)
      return s.problems.push({
        code: "spec:name:unpaired-brackets",
        message: "unpaired brackets",
        line: s.source[0].number,
        critical: !0
      }), s;
    let P = m;
    if (m[0] === "[" && m[m.length - 1] === "]") {
      T = !0, m = m.slice(1, -1);
      let b = m.split("=");
      if (m = b[0].trim(), b[1] !== void 0 && (g = b.slice(1).join("=").trim()), m === "")
        return s.problems.push({
          code: "spec:name:empty-name",
          message: "empty name",
          line: s.source[0].number,
          critical: !0
        }), s;
      if (g === "")
        return s.problems.push({
          code: "spec:name:empty-default",
          message: "empty default value",
          line: s.source[0].number,
          critical: !0
        }), s;
      if (!Lr(g) && /=(?!>)/.test(g))
        return s.problems.push({
          code: "spec:name:invalid-default",
          message: "invalid default value syntax",
          line: s.source[0].number,
          critical: !0
        }), s;
    }
    return s.optional = T, s.name = m, a.name = P, g !== void 0 && (s.default = g), [a.postName, a.description] = A(p.slice(a.name.length)),
    s;
  };
}
r(ce, "nameTokenizer");

// ../node_modules/comment-parser/es6/parser/tokenizers/description.js
function le(n = "compact", s = v) {
  let a = Be(n);
  return (p) => (p.description = a(p.source, s), p);
}
r(le, "descriptionTokenizer");
function Be(n) {
  return n === "compact" ? Ur : n === "preserve" ? Mr : n;
}
r(Be, "getJoiner");
function Ur(n, s = v) {
  return n.map(({ tokens: { description: a } }) => a.trim()).filter((a) => a !== "").join(" ");
}
r(Ur, "compactJoiner");
var Br = /* @__PURE__ */ r((n, { tokens: s }, a) => s.type === "" ? n : a, "lineNo"), Cr = /* @__PURE__ */ r(({ tokens: n }) => (n.delimiter ===
"" ? n.start : n.postDelimiter.slice(1)) + n.description, "getDescription");
function Mr(n, s = v) {
  if (n.length === 0)
    return "";
  n[0].tokens.description === "" && n[0].tokens.delimiter === s.start && (n = n.slice(1));
  let a = n[n.length - 1];
  return a !== void 0 && a.tokens.description === "" && a.tokens.end.endsWith(s.end) && (n = n.slice(0, -1)), n = n.slice(n.reduce(Br, 0)), n.
  map(Cr).join(`
`);
}
r(Mr, "preserveJoiner");

// ../node_modules/comment-parser/es6/parser/index.js
function Ce({ startLine: n = 0, fence: s = "```", spacing: a = "compact", markers: p = v, tokenizers: c = [
  ie(),
  pe(a),
  ce(),
  le(a)
] } = {}) {
  if (n < 0 || n % 1 > 0)
    throw new Error("Invalid startLine");
  let u = Le({ startLine: n, markers: p }), m = Ve({ fence: s }), T = Ue({ tokenizers: c }), g = Be(a);
  return function(P) {
    let b = [];
    for (let ye of ft(P)) {
      let $ = u(ye);
      if ($ === null)
        continue;
      let E = m($), Q = E.slice(1).map(T);
      b.push({
        description: g(E[0], p),
        tags: Q,
        source: $,
        problems: Q.reduce((de, Te) => de.concat(Te.problems), [])
      });
    }
    return b;
  };
}
r(Ce, "getParser");

// ../node_modules/comment-parser/es6/stringifier/index.js
function Kr(n) {
  return n.start + n.delimiter + n.postDelimiter + n.tag + n.postTag + n.type + n.postType + n.name + n.postName + n.description + n.end + n.
  lineEnd;
}
r(Kr, "join");
function Me() {
  return (n) => n.source.map(({ tokens: s }) => Kr(s)).join(`
`);
}
r(Me, "getStringifier");

// ../node_modules/comment-parser/es6/stringifier/inspect.js
var $r = {
  line: 0,
  start: 0,
  delimiter: 0,
  postDelimiter: 0,
  tag: 0,
  postTag: 0,
  name: 0,
  postName: 0,
  type: 0,
  postType: 0,
  description: 0,
  end: 0,
  lineEnd: 0
};
var Qo = Object.keys($r);

// ../node_modules/comment-parser/es6/index.js
function dt(n, s = {}) {
  return Ce(s)(n);
}
r(dt, "parse");
var hs = Me();

// src/docs-tools/argTypes/jsdocParser.ts
var K = Er(gt(), 1);
function qr(n) {
  return n != null && n.includes("@");
}
r(qr, "containsJsDoc");
function Yr(n) {
  let p = `/**
` + (n ?? "").split(`
`).map((u) => ` * ${u}`).join(`
`) + `
*/`, c = dt(p, {
    spacing: "preserve"
  });
  if (!c || c.length === 0)
    throw new Error("Cannot parse JSDoc tags.");
  return c[0];
}
r(Yr, "parse");
var Wr = {
  tags: ["param", "arg", "argument", "returns", "ignore", "deprecated"]
}, $e = /* @__PURE__ */ r((n, s = Wr) => {
  if (!qr(n))
    return {
      includesJsDoc: !1,
      ignore: !1
    };
  let a = Yr(n), p = Gr(a, s.tags);
  return p.ignore ? {
    includesJsDoc: !0,
    ignore: !0
  } : {
    includesJsDoc: !0,
    ignore: !1,
    // Always use the parsed description to ensure JSDoc is removed from the description.
    description: a.description.trim(),
    extractedTags: p
  };
}, "parseJsDoc");
function Gr(n, s) {
  let a = {
    params: null,
    deprecated: null,
    returns: null,
    ignore: !1
  };
  for (let p of n.tags)
    if (!(s !== void 0 && !s.includes(p.tag)))
      if (p.tag === "ignore") {
        a.ignore = !0;
        break;
      } else
        switch (p.tag) {
          // arg & argument are aliases for param.
          case "param":
          case "arg":
          case "argument": {
            let c = zr(p);
            c != null && (a.params == null && (a.params = []), a.params.push(c));
            break;
          }
          case "deprecated": {
            let c = Hr(p);
            c != null && (a.deprecated = c);
            break;
          }
          case "returns": {
            let c = Qr(p);
            c != null && (a.returns = c);
            break;
          }
          default:
            break;
        }
  return a;
}
r(Gr, "extractJsDocTags");
function Xr(n) {
  return n.replace(/[\.-]$/, "");
}
r(Xr, "normaliseParamName");
function zr(n) {
  if (!n.name || n.name === "-")
    return null;
  let s = Jt(n.type);
  return {
    name: n.name,
    type: s,
    description: ht(n.description),
    getPrettyName: /* @__PURE__ */ r(() => Xr(n.name), "getPrettyName"),
    getTypeName: /* @__PURE__ */ r(() => s ? wt(s) : null, "getTypeName")
  };
}
r(zr, "extractParam");
function Hr(n) {
  return n.name ? xt(n.name, n.description) : null;
}
r(Hr, "extractDeprecated");
function xt(n, s) {
  let a = n === "" ? s : `${n} ${s}`;
  return ht(a);
}
r(xt, "joinNameAndDescription");
function ht(n) {
  let s = n.replace(/^- /g, "").trim();
  return s === "" ? null : s;
}
r(ht, "normaliseDescription");
function Qr(n) {
  let s = Jt(n.type);
  return s ? {
    type: s,
    description: xt(n.name, n.description),
    getTypeName: /* @__PURE__ */ r(() => wt(s), "getTypeName")
  } : null;
}
r(Qr, "extractReturns");
var F = (0, K.stringifyRules)(), Zr = F.JsdocTypeObject;
F.JsdocTypeAny = () => "any";
F.JsdocTypeObject = (n, s) => `(${Zr(n, s)})`;
F.JsdocTypeOptional = (n, s) => s(n.element);
F.JsdocTypeNullable = (n, s) => s(n.element);
F.JsdocTypeNotNullable = (n, s) => s(n.element);
F.JsdocTypeUnion = (n, s) => n.elements.map(s).join("|");
function Jt(n) {
  try {
    return (0, K.parse)(n, "typescript");
  } catch {
    return null;
  }
}
r(Jt, "extractType");
function wt(n) {
  return (0, K.transform)(F, n);
}
r(wt, "extractTypeName");

// src/docs-tools/argTypes/utils.ts
var en = 90, tn = 50;
function me(n) {
  return n.length > 90;
}
r(me, "isTooLongForTypeSummary");
function qe(n) {
  return n.length > 50;
}
r(qe, "isTooLongForDefaultValueSummary");
function J(n, s) {
  return n === s ? { summary: n } : { summary: n, detail: s };
}
r(J, "createSummaryValue");
var rn = /* @__PURE__ */ r((n) => n.replace(/\\r\\n/g, "\\n"), "normalizeNewlines");

// src/docs-tools/argTypes/docgen/flow/createDefaultValue.ts
function Pt(n, s) {
  if (n != null) {
    let { value: a } = n;
    if (!V(a))
      return qe(a) ? J(s?.name, a) : J(a);
  }
  return null;
}
r(Pt, "createDefaultValue");

// src/docs-tools/argTypes/docgen/flow/createType.ts
function bt({ name: n, value: s, elements: a, raw: p }) {
  return s ?? (a != null ? a.map(bt).join(" | ") : p ?? n);
}
r(bt, "generateUnionElement");
function nn({ name: n, raw: s, elements: a }) {
  return a != null ? J(a.map(bt).join(" | ")) : s != null ? J(s.replace(/^\|\s*/, "")) : J(n);
}
r(nn, "generateUnion");
function on({ type: n, raw: s }) {
  return s != null ? J(s) : J(n);
}
r(on, "generateFuncSignature");
function sn({ type: n, raw: s }) {
  return s != null ? me(s) ? J(n, s) : J(s) : J(n);
}
r(sn, "generateObjectSignature");
function an(n) {
  let { type: s } = n;
  return s === "object" ? sn(n) : on(n);
}
r(an, "generateSignature");
function pn({ name: n, raw: s }) {
  return s != null ? me(s) ? J(n, s) : J(s) : J(n);
}
r(pn, "generateDefault");
function Et(n) {
  if (n == null)
    return null;
  switch (n.name) {
    case "union":
      return nn(n);
    case "signature":
      return an(n);
    default:
      return pn(n);
  }
}
r(Et, "createType");

// src/docs-tools/argTypes/docgen/flow/createPropDef.ts
var St = /* @__PURE__ */ r((n, s) => {
  let { flowType: a, description: p, required: c, defaultValue: u } = s;
  return {
    name: n,
    type: Et(a),
    required: c,
    description: p,
    defaultValue: Pt(u ?? null, a ?? null)
  };
}, "createFlowPropDef");

// src/docs-tools/argTypes/docgen/typeScript/createDefaultValue.ts
function Nt({ defaultValue: n }) {
  if (n != null) {
    let { value: s } = n;
    if (!V(s))
      return J(s);
  }
  return null;
}
r(Nt, "createDefaultValue");

// src/docs-tools/argTypes/docgen/typeScript/createType.ts
function Ot({ tsType: n, required: s }) {
  if (n == null)
    return null;
  let a = n.name;
  return s || (a = a.replace(" | undefined", "")), J(
    ["Array", "Record", "signature"].includes(n.name) ? n.raw : a
  );
}
r(Ot, "createType");

// src/docs-tools/argTypes/docgen/typeScript/createPropDef.ts
var Dt = /* @__PURE__ */ r((n, s) => {
  let { description: a, required: p } = s;
  return {
    name: n,
    type: Ot(s),
    required: p,
    description: a,
    defaultValue: Nt(s)
  };
}, "createTsPropDef");

// src/docs-tools/argTypes/docgen/createPropDef.ts
function cn(n) {
  return n != null ? J(n.name) : null;
}
r(cn, "createType");
function ln(n) {
  let { computed: s, func: a } = n;
  return typeof s > "u" && typeof a > "u";
}
r(ln, "isReactDocgenTypescript");
function un(n) {
  return n ? n.name === "string" ? !0 : n.name === "enum" ? Array.isArray(n.value) && n.value.every(
    ({ value: s }) => typeof s == "string" && s[0] === '"' && s[s.length - 1] === '"'
  ) : !1 : !1;
}
r(un, "isStringValued");
function mn(n, s) {
  if (n != null) {
    let { value: a } = n;
    if (!V(a))
      return ln(n) && un(s) ? J(JSON.stringify(a)) : J(a);
  }
  return null;
}
r(mn, "createDefaultValue");
function vt(n, s, a) {
  let { description: p, required: c, defaultValue: u } = a;
  return {
    name: n,
    type: cn(s),
    required: c,
    description: p,
    defaultValue: mn(u, s)
  };
}
r(vt, "createBasicPropDef");
function fe(n, s) {
  if (s?.includesJsDoc) {
    let { description: a, extractedTags: p } = s;
    a != null && (n.description = s.description);
    let c = {
      ...p,
      params: p?.params?.map(
        (u) => ({
          name: u.getPrettyName(),
          description: u.description
        })
      )
    };
    Object.values(c).filter(Boolean).length > 0 && (n.jsDocTags = c);
  }
  return n;
}
r(fe, "applyJsDocResult");
var fn = /* @__PURE__ */ r((n, s, a) => {
  let p = vt(n, s.type, s);
  return p.sbType = H(s), fe(p, a);
}, "javaScriptFactory"), yn = /* @__PURE__ */ r((n, s, a) => {
  let p = Dt(n, s);
  return p.sbType = H(s), fe(p, a);
}, "tsFactory"), dn = /* @__PURE__ */ r((n, s, a) => {
  let p = St(n, s);
  return p.sbType = H(s), fe(p, a);
}, "flowFactory"), Tn = /* @__PURE__ */ r((n, s, a) => {
  let p = vt(n, { name: "unknown" }, s);
  return fe(p, a);
}, "unknownFactory"), Ye = /* @__PURE__ */ r((n) => {
  switch (n) {
    case "JavaScript":
      return fn;
    case "TypeScript":
      return yn;
    case "Flow":
      return dn;
    default:
      return Tn;
  }
}, "getPropDefFactory");

// src/docs-tools/argTypes/docgen/extractDocgenProps.ts
var kt = /* @__PURE__ */ r((n) => n.type != null ? "JavaScript" : n.flowType != null ? "Flow" : n.tsType != null ? "TypeScript" : "Unknown",
"getTypeSystem"), At = /* @__PURE__ */ r((n) => {
  let s = kt(n[0]), a = Ye(s);
  return n.map((p) => {
    let c = p;
    return p.type?.elements && (c = {
      ...p,
      type: {
        ...p.type,
        value: p.type.elements
      }
    }), Rt(c.name, c, s, a);
  });
}, "extractComponentSectionArray"), It = /* @__PURE__ */ r((n) => {
  let s = Object.keys(n), a = kt(n[s[0]]), p = Ye(a);
  return s.map((c) => {
    let u = n[c];
    return u != null ? Rt(c, u, a, p) : null;
  }).filter(Boolean);
}, "extractComponentSectionObject"), gn = /* @__PURE__ */ r((n, s) => {
  let a = Re(n, s);
  return Ie(a) ? Array.isArray(a) ? At(a) : It(a) : [];
}, "extractComponentProps");
function Rt(n, s, a, p) {
  let c = $e(s.description);
  return c.includesJsDoc && c.ignore ? null : {
    propDef: p(n, s, c),
    jsDocTags: c.extractedTags,
    docgenInfo: s,
    typeSystem: a
  };
}
r(Rt, "extractProp");
function xn(n) {
  return n != null ? je(n) : "";
}
r(xn, "extractComponentDescription");

// src/preview-api/modules/store/parameters.ts
var We = /* @__PURE__ */ r((...n) => {
  let s = {}, a = n.filter(Boolean), p = a.reduce((c, u) => (Object.entries(u).forEach(([m, T]) => {
    let g = c[m];
    Array.isArray(T) || typeof g > "u" ? c[m] = T : z(T) && z(g) ? s[m] = !0 : typeof T < "u" && (c[m] = T);
  }), c), {});
  return Object.keys(s).forEach((c) => {
    let u = a.filter(Boolean).map((m) => m[c]).filter((m) => typeof m < "u");
    u.every((m) => z(m)) ? p[c] = We(...u) : p[c] = u[u.length - 1];
  }), p;
}, "combineParameters");

// src/docs-tools/argTypes/enhanceArgTypes.ts
var hn = /* @__PURE__ */ r((n) => {
  let {
    component: s,
    argTypes: a,
    parameters: { docs: p = {} }
  } = n, { extractArgTypes: c } = p;
  if (!c || !s)
    return a;
  let u = c(s);
  return u ? We(u, a) : a;
}, "enhanceArgTypes");

// src/docs-tools/shared.ts
var Ge = "storybook/docs", Jn = `${Ge}/panel`, wn = "docs", Pn = `${Ge}/snippet-rendered`, jt = /* @__PURE__ */ ((p) => (p.AUTO = "auto", p.
CODE = "code", p.DYNAMIC = "dynamic", p))(jt || {});
