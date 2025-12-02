var dr = Object.create;
var Ie = Object.defineProperty;
var Tr = Object.getOwnPropertyDescriptor;
var gr = Object.getOwnPropertyNames;
var xr = Object.getPrototypeOf, hr = Object.prototype.hasOwnProperty;
var r = (n, s) => Ie(n, "name", { value: s, configurable: !0 });
var Jr = (n, s) => () => (s || n((s = { exports: {} }).exports, s), s.exports);
var wr = (n, s, a, p) => {
  if (s && typeof s == "object" || typeof s == "function")
    for (let c of gr(s))
      !hr.call(n, c) && c !== a && Ie(n, c, { get: () => s[c], enumerable: !(p = Tr(s, c)) || p.enumerable });
  return n;
};
var Pr = (n, s, a) => (a = n != null ? dr(xr(n)) : {}, wr(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  s || !n || !n.__esModule ? Ie(a, "default", { value: n, enumerable: !0 }) : a,
  n
));

// ../node_modules/jsdoc-type-pratt-parser/dist/index.js
var dt = Jr((fe, yt) => {
  (function(n, s) {
    typeof fe == "object" && typeof yt < "u" ? s(fe) : typeof define == "function" && define.amd ? define(["exports"], s) : (n = typeof globalThis <
    "u" ? globalThis : n || self, s(n.jtpp = {}));
  })(fe, function(n) {
    "use strict";
    function s(e) {
      return e.text !== void 0 && e.text !== "" ? `'${e.type}' with value '${e.text}'` : `'${e.type}'`;
    }
    r(s, "tokenToString");
    let ne = class ne extends Error {
      constructor(t) {
        super(`No parslet found for token: ${s(t)}`), this.token = t, Object.setPrototypeOf(this, ne.prototype);
      }
      getToken() {
        return this.token;
      }
    };
    r(ne, "NoParsletFoundError");
    let a = ne, oe = class oe extends Error {
      constructor(t) {
        super(`The parsing ended early. The next token was: ${s(t)}`), this.token = t, Object.setPrototypeOf(this, oe.prototype);
      }
      getToken() {
        return this.token;
      }
    };
    r(oe, "EarlyEndOfParseError");
    let p = oe, se = class se extends Error {
      constructor(t, o) {
        let i = `Unexpected type: '${t.type}'.`;
        o !== void 0 && (i += ` Message: ${o}`), super(i), Object.setPrototypeOf(this, se.prototype);
      }
    };
    r(se, "UnexpectedTypeError");
    let c = se;
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
    let T = new RegExp("[$_\\p{ID_Start}]|\\\\u\\p{Hex_Digit}{4}|\\\\u\\{0*(?:\\p{Hex_Digit}{1,5}|10\\p{Hex_Digit}{4})\\}", "u"), g = new RegExp(
    "[$\\-\\p{ID_Continue}\\u200C\\u200D]|\\\\u\\p{Hex_Digit}{4}|\\\\u\\{0*(?:\\p{Hex_Digit}{1,5}|10\\p{Hex_Digit}{4})\\}", "u");
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
    function de(e) {
      var t, o;
      return (o = (t = b.exec(e)) === null || t === void 0 ? void 0 : t[0]) !== null && o !== void 0 ? o : null;
    }
    r(de, "getNumber");
    let q = /* @__PURE__ */ r((e) => {
      let t = P(e);
      return t == null ? null : {
        type: "Identifier",
        text: t
      };
    }, "identifierRule");
    function S(e) {
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
    r(S, "makeKeyWordRule");
    let z = /* @__PURE__ */ r((e) => {
      let t = m(e);
      return t == null ? null : {
        type: "StringValue",
        text: t
      };
    }, "stringValueRule"), Te = /* @__PURE__ */ r((e) => e.length > 0 ? null : {
      type: "EOF",
      text: ""
    }, "eofRule"), ge = /* @__PURE__ */ r((e) => {
      let t = de(e);
      return t === null ? null : {
        type: "Number",
        text: t
      };
    }, "numberRule"), Rt = [
      Te,
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
      S("undefined"),
      S("null"),
      S("function"),
      S("this"),
      S("new"),
      S("module"),
      S("event"),
      S("external"),
      S("typeof"),
      S("keyof"),
      S("readonly"),
      S("import"),
      S("is"),
      S("in"),
      S("asserts"),
      ge,
      q,
      z
    ], jt = /^\s*\n\s*/, U = class U {
      static create(t) {
        let o = this.read(t);
        t = o.text;
        let i = this.read(t);
        return t = i.text, new U(t, void 0, o.token, i.token);
      }
      constructor(t, o, i, l) {
        this.text = "", this.text = t, this.previous = o, this.current = i, this.next = l;
      }
      static read(t, o = !1) {
        o = o || jt.test(t), t = t.trim();
        for (let i of Rt) {
          let l = i(t);
          if (l !== null) {
            let f = Object.assign(Object.assign({}, l), { startOfLine: o });
            return t = t.slice(f.text.length), { text: t, token: f };
          }
        }
        throw new Error("Unexpected Token " + t);
      }
      advance() {
        let t = U.read(this.text);
        return new U(t.text, this.current, this.next, t.token);
      }
    };
    r(U, "Lexer");
    let xe = U;
    function J(e) {
      if (e === void 0)
        throw new Error("Unexpected undefined");
      if (e.type === "JsdocTypeKeyValue" || e.type === "JsdocTypeParameterList" || e.type === "JsdocTypeProperty" || e.type === "JsdocTypeRe\
adonlyProperty" || e.type === "JsdocTypeObjectField" || e.type === "JsdocTypeJsdocObjectField" || e.type === "JsdocTypeIndexSignature" || e.
      type === "JsdocTypeMappedType")
        throw new c(e);
      return e;
    }
    r(J, "assertRootResult");
    function he(e) {
      return e.type === "JsdocTypeKeyValue" ? H(e) : J(e);
    }
    r(he, "assertPlainKeyValueOrRootResult");
    function Ft(e) {
      return e.type === "JsdocTypeName" ? e : H(e);
    }
    r(Ft, "assertPlainKeyValueOrNameResult");
    function H(e) {
      if (e.type !== "JsdocTypeKeyValue")
        throw new c(e);
      return e;
    }
    r(H, "assertPlainKeyValueResult");
    function _t(e) {
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
    r(_t, "assertNumberOrVariadicNameResult");
    function Je(e) {
      return e.type === "JsdocTypeIndexSignature" || e.type === "JsdocTypeMappedType";
    }
    r(Je, "isSquaredProperty");
    var y;
    (function(e) {
      e[e.ALL = 0] = "ALL", e[e.PARAMETER_LIST = 1] = "PARAMETER_LIST", e[e.OBJECT = 2] = "OBJECT", e[e.KEY_VALUE = 3] = "KEY_VALUE", e[e.INDEX_BRACKETS =
      4] = "INDEX_BRACKETS", e[e.UNION = 5] = "UNION", e[e.INTERSECTION = 6] = "INTERSECTION", e[e.PREFIX = 7] = "PREFIX", e[e.INFIX = 8] = "\
INFIX", e[e.TUPLE = 9] = "TUPLE", e[e.SYMBOL = 10] = "SYMBOL", e[e.OPTIONAL = 11] = "OPTIONAL", e[e.NULLABLE = 12] = "NULLABLE", e[e.KEY_OF_TYPE_OF =
      13] = "KEY_OF_TYPE_OF", e[e.FUNCTION = 14] = "FUNCTION", e[e.ARROW = 15] = "ARROW", e[e.ARRAY_BRACKETS = 16] = "ARRAY_BRACKETS", e[e.GENERIC =
      17] = "GENERIC", e[e.NAME_PATH = 18] = "NAME_PATH", e[e.PARENTHESIS = 19] = "PARENTHESIS", e[e.SPECIAL_TYPES = 20] = "SPECIAL_TYPES";
    })(y || (y = {}));
    let Ae = class Ae {
      constructor(t, o, i) {
        this.grammar = t, typeof o == "string" ? this._lexer = xe.create(o) : this._lexer = o, this.baseParser = i;
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
        return J(this.parseIntermediateType(t));
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
    };
    r(Ae, "Parser");
    let I = Ae;
    function Ye(e) {
      return e === "EOF" || e === "|" || e === "," || e === ")" || e === ">";
    }
    r(Ye, "isQuestionMarkUnknownType");
    let we = /* @__PURE__ */ r((e, t, o) => {
      let i = e.lexer.current.type, l = e.lexer.next.type;
      return o == null && i === "?" && !Ye(l) || o != null && i === "?" ? (e.consume("?"), o == null ? {
        type: "JsdocTypeNullable",
        element: e.parseType(y.NULLABLE),
        meta: {
          position: "prefix"
        }
      } : {
        type: "JsdocTypeNullable",
        element: J(o),
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
    let Q = x({
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
        element: J(t),
        meta: {
          position: "suffix"
        }
      }), "parseInfix")
    }), Z = x({
      name: "numberParslet",
      accept: /* @__PURE__ */ r((e) => e === "Number", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => {
        let t = parseFloat(e.lexer.current.text);
        return e.consume("Number"), {
          type: "JsdocTypeNumber",
          value: t
        };
      }, "parsePrefix")
    }), Vt = x({
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
          element: J(t)
        };
      }, "parsePrefix")
    }), Lt = x({
      name: "specialTypesParslet",
      accept: /* @__PURE__ */ r((e, t) => e === "?" && Ye(t) || e === "null" || e === "undefined" || e === "*", "accept"),
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
    }), Ut = x({
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
        element: J(t),
        meta: {
          position: "suffix"
        }
      }), "parseInfix")
    });
    function Bt({ allowTrailingComma: e }) {
      return x({
        name: "parameterListParslet",
        accept: /* @__PURE__ */ r((t) => t === ",", "accept"),
        precedence: y.PARAMETER_LIST,
        parseInfix: /* @__PURE__ */ r((t, o) => {
          let i = [
            he(o)
          ];
          t.consume(",");
          do
            try {
              let l = t.parseIntermediateType(y.PARAMETER_LIST);
              i.push(he(l));
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
    r(Bt, "createParameterListParslet");
    let Ct = x({
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
          left: J(t),
          elements: i,
          meta: {
            brackets: "angle",
            dot: o
          }
        };
      }, "parseInfix")
    }), Mt = x({
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
          elements: [J(t), ...o]
        };
      }, "parseInfix")
    }), Pe = [
      we,
      Q,
      Z,
      Vt,
      Lt,
      Ut,
      Bt({
        allowTrailingComma: !0
      }),
      Ct,
      Mt,
      Q
    ];
    function ee({ allowSquareBracketsOnAnyType: e, allowJsdocNamePaths: t, pathGrammar: o }) {
      return /* @__PURE__ */ r(function(l, f, d) {
        if (d == null || f >= y.NAME_PATH)
          return null;
        let h = l.lexer.current.type, D = l.lexer.next.type;
        if (!(h === "." && D !== "<" || h === "[" && (e || d.type === "JsdocTypeName") || t && (h === "~" || h === "#")))
          return null;
        let O, ae = !1;
        l.consume(".") ? O = "property" : l.consume("[") ? (O = "property-brackets", ae = !0) : l.consume("~") ? O = "inner" : (l.consume("#"),
        O = "instance");
        let rt = o !== null ? new I(o, l.lexer, l) : l, k = rt.parseIntermediateType(y.NAME_PATH);
        l.acceptLexerState(rt);
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
        if (ae && !l.consume("]")) {
          let nt = l.lexer.current;
          throw new Error(`Unterminated square brackets. Next token is '${nt.type}' with text '${nt.text}'`);
        }
        return {
          type: "JsdocTypeNamePath",
          left: J(d),
          right: G,
          pathType: O
        };
      }, "namePathParslet");
    }
    r(ee, "createNamePathParslet");
    function R({ allowedAdditionalTokens: e }) {
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
    r(R, "createNameParslet");
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
    function te({ pathGrammar: e, allowedTypes: t }) {
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
            let D = "", E = ["Identifier", "@", "/"];
            for (; E.some((O) => o.consume(O)); )
              D += f.text, f = o.lexer.current;
            l = {
              type: "JsdocTypeSpecialNamePath",
              value: D,
              specialType: i,
              meta: {
                quote: void 0
              }
            };
          }
          let d = new I(e, o.lexer, o), h = d.parseInfixIntermediateType(l, y.ALL);
          return o.acceptLexerState(d), J(h);
        }, "parsePrefix")
      });
    }
    r(te, "createSpecialNamePathParslet");
    let We = [
      R({
        allowedAdditionalTokens: ["external", "module"]
      }),
      Y,
      Z,
      ee({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: null
      })
    ], L = [
      ...We,
      te({
        allowedTypes: ["event"],
        pathGrammar: We
      })
    ];
    function be(e) {
      let t;
      if (e.type === "JsdocTypeParameterList")
        t = e.elements;
      else if (e.type === "JsdocTypeParenthesis")
        t = [e.element];
      else
        throw new c(e);
      return t.map((o) => he(o));
    }
    r(be, "getParameters");
    function Kt(e) {
      let t = be(e);
      if (t.some((o) => o.type === "JsdocTypeKeyValue"))
        throw new Error("No parameter should be named");
      return t;
    }
    r(Kt, "getUnnamedParameters");
    function Se({ allowNamedParameters: e, allowNoReturnType: t, allowWithoutParenthesis: o, allowNewAsFunctionKeyword: i }) {
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
          }, D = l.parseIntermediateType(y.FUNCTION);
          if (e === void 0)
            h.parameters = Kt(D);
          else {
            if (f && D.type === "JsdocTypeFunction" && D.arrow)
              return h = D, h.constructor = !0, h;
            h.parameters = be(D);
            for (let E of h.parameters)
              if (E.type === "JsdocTypeKeyValue" && !e.includes(E.key))
                throw new Error(`only allowed named parameters are ${e.join(", ")} but got ${E.type}`);
          }
          if (l.consume(":"))
            h.returnType = l.parseType(y.PREFIX);
          else if (!t)
            throw new Error("function is missing return type");
          return h;
        }, "parsePrefix")
      });
    }
    r(Se, "createFunctionParslet");
    function Ee({ allowPostfix: e, allowEnclosingBrackets: t }) {
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
              element: J(l),
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
          element: J(i),
          meta: {
            position: "suffix",
            squareBrackets: !1
          }
        }) : void 0
      });
    }
    r(Ee, "createVariadicParslet");
    let Ge = x({
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
          if (o.element = _t(i), !e.consume(")"))
            throw new Error("Symbol does not end after value");
        }
        return o;
      }, "parseInfix")
    }), Xe = x({
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
          J(t)
        ],
        meta: {
          brackets: "square",
          dot: !1
        }
      }), "parseInfix")
    });
    function Ne({ objectFieldGrammar: e, allowKeyTypes: t }) {
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
            let l, f = new I(e, o.lexer, o);
            for (; ; ) {
              f.acceptLexerState(o);
              let d = f.parseIntermediateType(y.OBJECT);
              o.acceptLexerState(f), d === void 0 && t && (d = o.parseIntermediateType(y.OBJECT));
              let h = !1;
              if (d.type === "JsdocTypeNullable" && (h = !0, d = d.element), d.type === "JsdocTypeNumber" || d.type === "JsdocTypeName" || d.
              type === "JsdocTypeStringValue") {
                let E;
                d.type === "JsdocTypeStringValue" && (E = d.meta.quote), i.elements.push({
                  type: "JsdocTypeObjectField",
                  key: d.value.toString(),
                  right: void 0,
                  optional: h,
                  readonly: !1,
                  meta: {
                    quote: E
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
    r(Ne, "createObjectParslet");
    function De({ allowSquaredProperties: e, allowKeyTypes: t, allowReadonly: o, allowOptional: i }) {
      return x({
        name: "objectFieldParslet",
        precedence: y.KEY_VALUE,
        accept: /* @__PURE__ */ r((l) => l === ":", "accept"),
        parseInfix: /* @__PURE__ */ r((l, f) => {
          var d;
          let h = !1, D = !1;
          i && f.type === "JsdocTypeNullable" && (h = !0, f = f.element), o && f.type === "JsdocTypeReadonlyProperty" && (D = !0, f = f.element);
          let E = (d = l.baseParser) !== null && d !== void 0 ? d : l;
          if (E.acceptLexerState(l), f.type === "JsdocTypeNumber" || f.type === "JsdocTypeName" || f.type === "JsdocTypeStringValue" || Je(f)) {
            if (Je(f) && !e)
              throw new c(f);
            E.consume(":");
            let O;
            f.type === "JsdocTypeStringValue" && (O = f.meta.quote);
            let ae = E.parseType(y.KEY_VALUE);
            return l.acceptLexerState(E), {
              type: "JsdocTypeObjectField",
              key: Je(f) ? f : f.value.toString(),
              right: ae,
              optional: h,
              readonly: D,
              meta: {
                quote: O
              }
            };
          } else {
            if (!t)
              throw new c(f);
            E.consume(":");
            let O = E.parseType(y.KEY_VALUE);
            return l.acceptLexerState(E), {
              type: "JsdocTypeJsdocObjectField",
              left: J(f),
              right: O
            };
          }
        }, "parseInfix")
      });
    }
    r(De, "createObjectFieldParslet");
    function Oe({ allowOptional: e, allowVariadic: t }) {
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
    r(Oe, "createKeyValueParslet");
    let ze = [
      ...Pe,
      Se({
        allowWithoutParenthesis: !0,
        allowNamedParameters: ["this", "new"],
        allowNoReturnType: !0,
        allowNewAsFunctionKeyword: !1
      }),
      Y,
      te({
        allowedTypes: ["module", "external", "event"],
        pathGrammar: L
      }),
      Ee({
        allowEnclosingBrackets: !0,
        allowPostfix: !0
      }),
      R({
        allowedAdditionalTokens: ["keyof"]
      }),
      Ge,
      Xe,
      ee({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: L
      })
    ], $t = [
      ...ze,
      Ne({
        // jsdoc syntax allows full types as keys, so we need to pull in the full grammar here
        // we leave out the object type deliberately
        objectFieldGrammar: [
          R({
            allowedAdditionalTokens: ["module", "in"]
          }),
          De({
            allowSquaredProperties: !1,
            allowKeyTypes: !0,
            allowOptional: !1,
            allowReadonly: !1
          }),
          ...ze
        ],
        allowKeyTypes: !0
      }),
      Oe({
        allowOptional: !0,
        allowVariadic: !0
      })
    ], He = x({
      name: "typeOfParslet",
      accept: /* @__PURE__ */ r((e) => e === "typeof", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("typeof"), {
        type: "JsdocTypeTypeof",
        element: J(e.parseType(y.KEY_OF_TYPE_OF))
      }), "parsePrefix")
    }), qt = [
      R({
        allowedAdditionalTokens: ["module", "keyof", "event", "external", "in"]
      }),
      we,
      Q,
      Y,
      Z,
      De({
        allowSquaredProperties: !1,
        allowKeyTypes: !1,
        allowOptional: !1,
        allowReadonly: !1
      })
    ], Yt = [
      ...Pe,
      Ne({
        allowKeyTypes: !1,
        objectFieldGrammar: qt
      }),
      R({
        allowedAdditionalTokens: ["event", "external", "in"]
      }),
      He,
      Se({
        allowWithoutParenthesis: !1,
        allowNamedParameters: ["this", "new"],
        allowNoReturnType: !0,
        allowNewAsFunctionKeyword: !1
      }),
      Ee({
        allowEnclosingBrackets: !1,
        allowPostfix: !1
      }),
      // additional name parslet is needed for some special cases
      R({
        allowedAdditionalTokens: ["keyof"]
      }),
      te({
        allowedTypes: ["module"],
        pathGrammar: L
      }),
      ee({
        allowSquareBracketsOnAnyType: !1,
        allowJsdocNamePaths: !0,
        pathGrammar: L
      }),
      Oe({
        allowOptional: !1,
        allowVariadic: !1
      }),
      Ge
    ], Wt = x({
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
          right: J(e.parseIntermediateType(y.INFIX))
        };
      }, "parsePrefix")
    });
    function Gt({ allowQuestionMark: e }) {
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
          if (i.type === "JsdocTypeParameterList" ? i.elements[0].type === "JsdocTypeKeyValue" ? o.elements = i.elements.map(H) : o.elements =
          i.elements.map(J) : i.type === "JsdocTypeKeyValue" ? o.elements = [H(i)] : o.elements = [J(i)], !t.consume("]"))
            throw new Error("Unterminated '['");
          if (!e && o.elements.some((l) => l.type === "JsdocTypeUnknown"))
            throw new Error("Question mark in tuple not allowed");
          return o;
        }, "parsePrefix")
      });
    }
    r(Gt, "createTupleParslet");
    let Xt = x({
      name: "keyOfParslet",
      accept: /* @__PURE__ */ r((e) => e === "keyof", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("keyof"), {
        type: "JsdocTypeKeyof",
        element: J(e.parseType(y.KEY_OF_TYPE_OF))
      }), "parsePrefix")
    }), zt = x({
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
    }), Ht = x({
      name: "readonlyPropertyParslet",
      accept: /* @__PURE__ */ r((e) => e === "readonly", "accept"),
      parsePrefix: /* @__PURE__ */ r((e) => (e.consume("readonly"), {
        type: "JsdocTypeReadonlyProperty",
        element: e.parseType(y.KEY_VALUE)
      }), "parsePrefix")
    }), Qt = x({
      name: "arrowFunctionParslet",
      precedence: y.ARROW,
      accept: /* @__PURE__ */ r((e) => e === "=>", "accept"),
      parseInfix: /* @__PURE__ */ r((e, t) => (e.consume("=>"), {
        type: "JsdocTypeFunction",
        parameters: be(t).map(Ft),
        arrow: !0,
        constructor: !1,
        parenthesis: !0,
        returnType: e.parseType(y.OBJECT)
      }), "parseInfix")
    }), Zt = x({
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
          elements: [J(t), ...o]
        };
      }, "parseInfix")
    }), er = x({
      name: "predicateParslet",
      precedence: y.INFIX,
      accept: /* @__PURE__ */ r((e) => e === "is", "accept"),
      parseInfix: /* @__PURE__ */ r((e, t) => {
        if (t.type !== "JsdocTypeName")
          throw new c(t, "A typescript predicate always has to have a name on the left side.");
        return e.consume("is"), {
          type: "JsdocTypePredicate",
          left: t,
          right: J(e.parseIntermediateType(y.INFIX))
        };
      }, "parseInfix")
    }), tr = x({
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
    }), rr = [
      Ht,
      R({
        allowedAdditionalTokens: ["module", "event", "keyof", "event", "external", "in"]
      }),
      we,
      Q,
      Y,
      Z,
      De({
        allowSquaredProperties: !0,
        allowKeyTypes: !1,
        allowOptional: !0,
        allowReadonly: !0
      }),
      tr
    ], nr = [
      ...Pe,
      Ne({
        allowKeyTypes: !1,
        objectFieldGrammar: rr
      }),
      He,
      Xt,
      zt,
      Y,
      Se({
        allowWithoutParenthesis: !0,
        allowNoReturnType: !1,
        allowNamedParameters: ["this", "new", "args"],
        allowNewAsFunctionKeyword: !0
      }),
      Gt({
        allowQuestionMark: !1
      }),
      Ee({
        allowEnclosingBrackets: !1,
        allowPostfix: !1
      }),
      Wt,
      R({
        allowedAdditionalTokens: ["event", "external", "in"]
      }),
      te({
        allowedTypes: ["module"],
        pathGrammar: L
      }),
      Xe,
      Qt,
      ee({
        allowSquareBracketsOnAnyType: !0,
        allowJsdocNamePaths: !1,
        pathGrammar: L
      }),
      Zt,
      er,
      Oe({
        allowVariadic: !0,
        allowOptional: !0
      })
    ];
    function Qe(e, t) {
      switch (t) {
        case "closure":
          return new I(Yt, e).parse();
        case "jsdoc":
          return new I($t, e).parse();
        case "typescript":
          return new I(nr, e).parse();
      }
    }
    r(Qe, "parse");
    function or(e, t = ["typescript", "closure", "jsdoc"]) {
      let o;
      for (let i of t)
        try {
          return Qe(e, i);
        } catch (l) {
          o = l;
        }
      throw o;
    }
    r(or, "tryParse");
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
    function Ze(e) {
      let t = {
        params: []
      };
      for (let o of e.parameters)
        o.type === "JsdocTypeKeyValue" ? o.key === "this" ? t.this = o.right : o.key === "new" ? t.new = o.right : t.params.push(o) : t.params.
        push(o);
      return t;
    }
    r(Ze, "extractSpecialParams");
    function re(e, t, o) {
      return e === "prefix" ? o + t : t + o;
    }
    r(re, "applyPosition");
    function j(e, t) {
      switch (t) {
        case "double":
          return `"${e}"`;
        case "single":
          return `'${e}'`;
        case void 0:
          return e;
      }
    }
    r(j, "quote");
    function et() {
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
        JsdocTypeVariadic: /* @__PURE__ */ r((e, t) => e.meta.position === void 0 ? "..." : re(e.meta.position, t(e.element), "..."), "Jsdoc\
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
        JsdocTypeStringValue: /* @__PURE__ */ r((e) => j(e.value, e.meta.quote), "JsdocTypeStringValue"),
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
          return e.readonly && (o += "readonly "), typeof e.key == "string" ? o += j(e.key, e.meta.quote) : o += t(e.key), e.optional && (o +=
          "?"), e.right === void 0 ? o : o + `: ${t(e.right)}`;
        }, "JsdocTypeObjectField"),
        JsdocTypeJsdocObjectField: /* @__PURE__ */ r((e, t) => `${t(e.left)}: ${t(e.right)}`, "JsdocTypeJsdocObjectField"),
        JsdocTypeKeyValue: /* @__PURE__ */ r((e, t) => {
          let o = e.key;
          return e.optional && (o += "?"), e.variadic && (o = "..." + o), e.right === void 0 ? o : o + `: ${t(e.right)}`;
        }, "JsdocTypeKeyValue"),
        JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => `${e.specialType}:${j(e.value, e.meta.quote)}`, "JsdocTypeSpecialNamePath"),
        JsdocTypeNotNullable: /* @__PURE__ */ r((e, t) => re(e.meta.position, t(e.element), "!"), "JsdocTypeNotNullable"),
        JsdocTypeNull: /* @__PURE__ */ r(() => "null", "JsdocTypeNull"),
        JsdocTypeNullable: /* @__PURE__ */ r((e, t) => re(e.meta.position, t(e.element), "?"), "JsdocTypeNullable"),
        JsdocTypeNumber: /* @__PURE__ */ r((e) => e.value.toString(), "JsdocTypeNumber"),
        JsdocTypeObject: /* @__PURE__ */ r((e, t) => `{${e.elements.map(t).join((e.meta.separator === "comma" ? "," : ";") + " ")}}`, "Jsdoc\
TypeObject"),
        JsdocTypeOptional: /* @__PURE__ */ r((e, t) => re(e.meta.position, t(e.element), "="), "JsdocTypeOptional"),
        JsdocTypeSymbol: /* @__PURE__ */ r((e, t) => `${e.value}(${e.element !== void 0 ? t(e.element) : ""})`, "JsdocTypeSymbol"),
        JsdocTypeTypeof: /* @__PURE__ */ r((e, t) => `typeof ${t(e.element)}`, "JsdocTypeTypeof"),
        JsdocTypeUndefined: /* @__PURE__ */ r(() => "undefined", "JsdocTypeUndefined"),
        JsdocTypeUnion: /* @__PURE__ */ r((e, t) => e.elements.map(t).join(" | "), "JsdocTypeUnion"),
        JsdocTypeUnknown: /* @__PURE__ */ r(() => "?", "JsdocTypeUnknown"),
        JsdocTypeIntersection: /* @__PURE__ */ r((e, t) => e.elements.map(t).join(" & "), "JsdocTypeIntersection"),
        JsdocTypeProperty: /* @__PURE__ */ r((e) => j(e.value, e.meta.quote), "JsdocTypeProperty"),
        JsdocTypePredicate: /* @__PURE__ */ r((e, t) => `${t(e.left)} is ${t(e.right)}`, "JsdocTypePredicate"),
        JsdocTypeIndexSignature: /* @__PURE__ */ r((e, t) => `[${e.key}: ${t(e.right)}]`, "JsdocTypeIndexSignature"),
        JsdocTypeMappedType: /* @__PURE__ */ r((e, t) => `[${e.key} in ${t(e.right)}]`, "JsdocTypeMappedType"),
        JsdocTypeAsserts: /* @__PURE__ */ r((e, t) => `asserts ${t(e.left)} is ${t(e.right)}`, "JsdocTypeAsserts")
      };
    }
    r(et, "stringifyRules");
    let sr = et();
    function ar(e) {
      return W(sr, e);
    }
    r(ar, "stringify");
    let ir = [
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
    function F(e) {
      let t = {
        type: "NameExpression",
        name: e
      };
      return ir.includes(e) && (t.reservedWord = !0), t;
    }
    r(F, "makeName");
    let pr = {
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
      JsdocTypeStringValue: /* @__PURE__ */ r((e) => F(j(e.value, e.meta.quote)), "JsdocTypeStringValue"),
      JsdocTypeUndefined: /* @__PURE__ */ r(() => ({
        type: "UndefinedLiteral"
      }), "JsdocTypeUndefined"),
      JsdocTypeUnknown: /* @__PURE__ */ r(() => ({
        type: "UnknownLiteral"
      }), "JsdocTypeUnknown"),
      JsdocTypeFunction: /* @__PURE__ */ r((e, t) => {
        let o = Ze(e), i = {
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
      JsdocTypeSpecialNamePath: /* @__PURE__ */ r((e) => F(e.specialType + ":" + j(e.value, e.meta.quote)), "JsdocTypeSpecialNamePath"),
      JsdocTypeName: /* @__PURE__ */ r((e) => e.value !== "function" ? F(e.value) : {
        type: "FunctionType",
        params: []
      }, "JsdocTypeName"),
      JsdocTypeNumber: /* @__PURE__ */ r((e) => F(e.value.toString()), "JsdocTypeNumber"),
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
          key: F(j(e.key, e.meta.quote)),
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
        key: F(e.key),
        value: e.right === void 0 ? void 0 : t(e.right)
      }), "JsdocTypeKeyValue"),
      JsdocTypeNamePath: /* @__PURE__ */ r((e, t) => {
        let o = t(e.left), i;
        e.right.type === "JsdocTypeSpecialNamePath" ? i = t(e.right).name : i = j(e.right.value, e.right.meta.quote);
        let l = e.pathType === "inner" ? "~" : e.pathType === "instance" ? "#" : ".";
        return F(`${o.name}${l}${i}`);
      }, "JsdocTypeNamePath"),
      JsdocTypeSymbol: /* @__PURE__ */ r((e) => {
        let t = "", o = e.element, i = !1;
        return o?.type === "JsdocTypeVariadic" && (o.meta.position === "prefix" ? t = "..." : i = !0, o = o.element), o?.type === "JsdocType\
Name" ? t += o.value : o?.type === "JsdocTypeNumber" && (t += o.value.toString()), i && (t += "..."), F(`${e.value}(${t})`);
      }, "JsdocTypeSymbol"),
      JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => t(J(e.element)), "JsdocTypeParenthesis"),
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
    function cr(e) {
      return W(pr, e);
    }
    r(cr, "catharsisTransform");
    function V(e) {
      switch (e) {
        case void 0:
          return "none";
        case "single":
          return "single";
        case "double":
          return "double";
      }
    }
    r(V, "getQuoteStyle");
    function lr(e) {
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
    r(lr, "getMemberType");
    function ve(e, t) {
      return t.length === 2 ? {
        type: e,
        left: t[0],
        right: t[1]
      } : {
        type: e,
        left: t[0],
        right: ve(e, t.slice(1))
      };
    }
    r(ve, "nestResults");
    let ur = {
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
          quoteStyle: V(e.element.meta.quote),
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
        let o = Ze(e), i = {
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
            quoteStyle: V(e.meta.quote),
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
          quoteStyle: V(e.meta.quote),
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
            quoteStyle: V(e.meta.quote),
            path: e.value
          }
        };
      }, "JsdocTypeSpecialNamePath"),
      JsdocTypeNamePath: /* @__PURE__ */ r((e, t) => {
        let o = !1, i, l;
        e.right.type === "JsdocTypeSpecialNamePath" && e.right.specialType === "event" ? (o = !0, i = e.right.value, l = V(e.right.meta.quote)) :
        (i = e.right.value, l = V(e.right.meta.quote));
        let f = {
          type: lr(e.pathType),
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
      JsdocTypeUnion: /* @__PURE__ */ r((e, t) => ve("UNION", e.elements.map(t)), "JsdocTypeUnion"),
      JsdocTypeParenthesis: /* @__PURE__ */ r((e, t) => ({
        type: "PARENTHESIS",
        value: t(J(e.element))
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
        quoteStyle: V(e.meta.quote),
        string: e.value
      }), "JsdocTypeStringValue"),
      JsdocTypeIntersection: /* @__PURE__ */ r((e, t) => ve("INTERSECTION", e.elements.map(t)), "JsdocTypeIntersection"),
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
    function mr(e) {
      return W(ur, e);
    }
    r(mr, "jtpTransform");
    function fr() {
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
    r(fr, "identityTransformRules");
    let tt = {
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
    function ke(e, t, o, i, l) {
      i?.(e, t, o);
      let f = tt[e.type];
      for (let d of f) {
        let h = e[d];
        if (h !== void 0)
          if (Array.isArray(h))
            for (let D of h)
              ke(D, e, d, i, l);
          else
            ke(h, e, d, i, l);
      }
      l?.(e, t, o);
    }
    r(ke, "_traverse");
    function yr(e, t, o) {
      ke(e, void 0, void 0, t, o);
    }
    r(yr, "traverse"), n.catharsisTransform = cr, n.identityTransformRules = fr, n.jtpTransform = mr, n.parse = Qe, n.stringify = ar, n.stringifyRules =
    et, n.transform = W, n.traverse = yr, n.tryParse = or, n.visitorKeys = tt;
  });
});

// src/docs-tools/argTypes/convert/flow/convert.ts
import { UnknownArgTypesError as br } from "storybook/internal/preview-errors";
var Sr = /* @__PURE__ */ r((n) => n.name === "literal", "isLiteral"), Er = /* @__PURE__ */ r((n) => n.value.replace(/['|"]/g, ""), "toEnumOp\
tion"), Nr = /* @__PURE__ */ r((n) => {
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
      throw new br({ type: n, language: "Flow" });
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
      return { ...p, ...Nr(n) };
    case "union":
      return n.elements?.every(Sr) ? { ...p, name: "enum", value: n.elements?.map(Er) } : { ...p, name: s, value: n.elements?.map(B) };
    case "intersection":
      return { ...p, name: s, value: n.elements?.map(B) };
    default:
      return { ...p, name: "other", value: s };
  }
}, "convert");

// ../node_modules/es-toolkit/dist/predicate/isPlainObject.mjs
function X(n) {
  if (!n || typeof n != "object")
    return !1;
  let s = Object.getPrototypeOf(n);
  return s === null || s === Object.prototype || Object.getPrototypeOf(s) === null ? Object.prototype.toString.call(n) === "[object Object]" :
  !1;
}
r(X, "isPlainObject");

// ../node_modules/es-toolkit/dist/object/mapValues.mjs
function Re(n, s) {
  let a = {}, p = Object.keys(n);
  for (let c = 0; c < p.length; c++) {
    let u = p[c], m = n[u];
    a[u] = s(m, u, n);
  }
  return a;
}
r(Re, "mapValues");

// src/docs-tools/argTypes/convert/utils.ts
var ot = /^['"]|['"]$/g, Dr = /* @__PURE__ */ r((n) => n.replace(ot, ""), "trimQuotes"), Or = /* @__PURE__ */ r((n) => ot.test(n), "includes\
Quotes"), ie = /* @__PURE__ */ r((n) => {
  let s = Dr(n);
  return Or(n) || Number.isNaN(Number(s)) ? s : Number(s);
}, "parseLiteral");

// src/docs-tools/argTypes/convert/proptypes/convert.ts
var vr = /^\(.*\) => /, C = /* @__PURE__ */ r((n) => {
  let { name: s, raw: a, computed: p, value: c } = n, u = {};
  switch (typeof a < "u" && (u.raw = a), s) {
    case "enum": {
      let T = p ? c : c.map((g) => ie(g.value));
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
      let m = Re(c, (T) => C(T));
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
      let T = c ? `${s}(${c})` : s, g = vr.test(s) ? "function" : "other";
      return { ...u, name: g, value: T };
    }
  }
}, "convert");

// src/docs-tools/argTypes/convert/typescript/convert.ts
import { UnknownArgTypesError as kr } from "storybook/internal/preview-errors";
var Ar = /* @__PURE__ */ r((n) => {
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
      throw new kr({ type: n, language: "Typescript" });
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
      return { ...p, ...Ar(n) };
    case "union":
      let c;
      return n.elements?.every((u) => u.name === "literal") ? c = {
        ...p,
        name: "enum",
        // @ts-expect-error fix types
        value: n.elements?.map((u) => ie(u.value))
      } : c = { ...p, name: s, value: n.elements?.map(M) }, c;
    case "intersection":
      return { ...p, name: s, value: n.elements?.map(M) };
    default:
      return { ...p, name: "other", value: s };
  }
}, "convert");

// src/docs-tools/argTypes/convert/index.ts
var pe = /* @__PURE__ */ r((n) => {
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
var Ir = /* @__PURE__ */ ((c) => (c.JAVASCRIPT = "JavaScript", c.FLOW = "Flow", c.TYPESCRIPT = "TypeScript", c.UNKNOWN = "Unknown", c))(Ir ||
{});

// src/docs-tools/argTypes/docgen/utils/defaultValue.ts
var Rr = ["null", "undefined"];
function K(n) {
  return Rr.some((s) => s === n);
}
r(K, "isDefaultValueBlacklisted");

// src/docs-tools/argTypes/docgen/utils/string.ts
var st = /* @__PURE__ */ r((n) => {
  if (!n)
    return "";
  if (typeof n == "string")
    return n;
  throw new Error(`Description: expected string, got: ${JSON.stringify(n)}`);
}, "str");

// src/docs-tools/argTypes/docgen/utils/docgenInfo.ts
function at(n) {
  return !!n.__docgenInfo;
}
r(at, "hasDocgen");
function it(n) {
  return n != null && Object.keys(n).length > 0;
}
r(it, "isValidDocgenSection");
function pt(n, s) {
  return at(n) ? n.__docgenInfo[s] : null;
}
r(pt, "getDocgenSection");
function ct(n) {
  return at(n) ? st(n.__docgenInfo.description) : "";
}
r(ct, "getDocgenDescription");

// ../node_modules/comment-parser/es6/primitives.js
var v;
(function(n) {
  n.start = "/**", n.nostart = "/***", n.delim = "*", n.end = "*/";
})(v = v || (v = {}));

// ../node_modules/comment-parser/es6/util.js
function je(n) {
  return /^\s+$/.test(n);
}
r(je, "isSpace");
function lt(n) {
  let s = n.match(/\r+$/);
  return s == null ? ["", n] : [n.slice(-s[0].length), n.slice(0, -s[0].length)];
}
r(lt, "splitCR");
function A(n) {
  let s = n.match(/^\s+/);
  return s == null ? ["", n] : [n.slice(0, s[0].length), n.slice(s[0].length)];
}
r(A, "splitSpace");
function ut(n) {
  return n.split(/\n/);
}
r(ut, "splitLines");
function mt(n = {}) {
  return Object.assign({ tag: "", name: "", type: "", optional: !1, description: "", problems: [], source: [] }, n);
}
r(mt, "seedSpec");
function Fe(n = {}) {
  return Object.assign({ start: "", delimiter: "", postDelimiter: "", tag: "", postTag: "", name: "", postName: "", type: "", postType: "", description: "",
  end: "", lineEnd: "" }, n);
}
r(Fe, "seedTokens");

// ../node_modules/comment-parser/es6/parser/block-parser.js
var jr = /^@\S+/;
function _e({ fence: n = "```" } = {}) {
  let s = Fr(n), a = /* @__PURE__ */ r((p, c) => s(p) ? !c : c, "toggleFence");
  return /* @__PURE__ */ r(function(c) {
    let u = [[]], m = !1;
    for (let T of c)
      jr.test(T.tokens.description) && !m ? u.push([T]) : u[u.length - 1].push(T), m = a(T.tokens.description, m);
    return u;
  }, "parseBlock");
}
r(_e, "getParser");
function Fr(n) {
  return typeof n == "string" ? (s) => s.split(n).length % 2 === 0 : n;
}
r(Fr, "getFencer");

// ../node_modules/comment-parser/es6/parser/source-parser.js
function Ve({ startLine: n = 0, markers: s = v } = {}) {
  let a = null, p = n;
  return /* @__PURE__ */ r(function(u) {
    let m = u, T = Fe();
    if ([T.lineEnd, m] = lt(m), [T.start, m] = A(m), a === null && m.startsWith(s.start) && !m.startsWith(s.nostart) && (a = [], T.delimiter =
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
r(Ve, "getParser");

// ../node_modules/comment-parser/es6/parser/spec-parser.js
function Le({ tokenizers: n }) {
  return /* @__PURE__ */ r(function(a) {
    var p;
    let c = mt({ source: a });
    for (let u of n)
      if (c = u(c), !((p = c.problems[c.problems.length - 1]) === null || p === void 0) && p.critical)
        break;
    return c;
  }, "parseSpec");
}
r(Le, "getParser");

// ../node_modules/comment-parser/es6/parser/tokenizers/tag.js
function ce() {
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
r(ce, "tagTokenizer");

// ../node_modules/comment-parser/es6/parser/tokenizers/type.js
function le(n = "compact") {
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
r(le, "typeTokenizer");
var _r = /* @__PURE__ */ r((n) => n.trim(), "trim");
function Vr(n) {
  return n === "compact" ? (s) => s.map(_r).join("") : n === "preserve" ? (s) => s.join(`
`) : n;
}
r(Vr, "getJoiner");

// ../node_modules/comment-parser/es6/parser/tokenizers/name.js
var Lr = /* @__PURE__ */ r((n) => n && n.startsWith('"') && n.endsWith('"'), "isQuoted");
function ue() {
  let n = /* @__PURE__ */ r((s, { tokens: a }, p) => a.type === "" ? s : p, "typeEnd");
  return (s) => {
    let { tokens: a } = s.source[s.source.reduce(n, 0)], p = a.description.trimLeft(), c = p.split('"');
    if (c.length > 1 && c[0] === "" && c.length % 2 === 1)
      return s.name = c[1], a.name = `"${c[1]}"`, [a.postName, a.description] = A(p.slice(a.name.length)), s;
    let u = 0, m = "", T = !1, g;
    for (let b of p) {
      if (u === 0 && je(b))
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
r(ue, "nameTokenizer");

// ../node_modules/comment-parser/es6/parser/tokenizers/description.js
function me(n = "compact", s = v) {
  let a = Ue(n);
  return (p) => (p.description = a(p.source, s), p);
}
r(me, "descriptionTokenizer");
function Ue(n) {
  return n === "compact" ? Ur : n === "preserve" ? Mr : n;
}
r(Ue, "getJoiner");
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
function Be({ startLine: n = 0, fence: s = "```", spacing: a = "compact", markers: p = v, tokenizers: c = [
  ce(),
  le(a),
  ue(),
  me(a)
] } = {}) {
  if (n < 0 || n % 1 > 0)
    throw new Error("Invalid startLine");
  let u = Ve({ startLine: n, markers: p }), m = _e({ fence: s }), T = Le({ tokenizers: c }), g = Ue(a);
  return function(P) {
    let b = [];
    for (let de of ut(P)) {
      let q = u(de);
      if (q === null)
        continue;
      let S = m(q), z = S.slice(1).map(T);
      b.push({
        description: g(S[0], p),
        tags: z,
        source: q,
        problems: z.reduce((Te, ge) => Te.concat(ge.problems), [])
      });
    }
    return b;
  };
}
r(Be, "getParser");

// ../node_modules/comment-parser/es6/stringifier/index.js
function Kr(n) {
  return n.start + n.delimiter + n.postDelimiter + n.tag + n.postTag + n.type + n.postType + n.name + n.postName + n.description + n.end + n.
  lineEnd;
}
r(Kr, "join");
function Ce() {
  return (n) => n.source.map(({ tokens: s }) => Kr(s)).join(`
`);
}
r(Ce, "getStringifier");

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
var Wo = Object.keys($r);

// ../node_modules/comment-parser/es6/index.js
function ft(n, s = {}) {
  return Be(s)(n);
}
r(ft, "parse");
var ys = Ce();

// src/docs-tools/argTypes/jsdocParser.ts
var $ = Pr(dt(), 1);
function qr(n) {
  return n != null && n.includes("@");
}
r(qr, "containsJsDoc");
function Yr(n) {
  let p = `/**
` + (n ?? "").split(`
`).map((u) => ` * ${u}`).join(`
`) + `
*/`, c = ft(p, {
    spacing: "preserve"
  });
  if (!c || c.length === 0)
    throw new Error("Cannot parse JSDoc tags.");
  return c[0];
}
r(Yr, "parse");
var Wr = {
  tags: ["param", "arg", "argument", "returns", "ignore", "deprecated"]
}, Tt = /* @__PURE__ */ r((n, s = Wr) => {
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
  let s = ht(n.type);
  return {
    name: n.name,
    type: s,
    description: xt(n.description),
    getPrettyName: /* @__PURE__ */ r(() => Xr(n.name), "getPrettyName"),
    getTypeName: /* @__PURE__ */ r(() => s ? Jt(s) : null, "getTypeName")
  };
}
r(zr, "extractParam");
function Hr(n) {
  return n.name ? gt(n.name, n.description) : null;
}
r(Hr, "extractDeprecated");
function gt(n, s) {
  let a = n === "" ? s : `${n} ${s}`;
  return xt(a);
}
r(gt, "joinNameAndDescription");
function xt(n) {
  let s = n.replace(/^- /g, "").trim();
  return s === "" ? null : s;
}
r(xt, "normaliseDescription");
function Qr(n) {
  let s = ht(n.type);
  return s ? {
    type: s,
    description: gt(n.name, n.description),
    getTypeName: /* @__PURE__ */ r(() => Jt(s), "getTypeName")
  } : null;
}
r(Qr, "extractReturns");
var _ = (0, $.stringifyRules)(), Zr = _.JsdocTypeObject;
_.JsdocTypeAny = () => "any";
_.JsdocTypeObject = (n, s) => `(${Zr(n, s)})`;
_.JsdocTypeOptional = (n, s) => s(n.element);
_.JsdocTypeNullable = (n, s) => s(n.element);
_.JsdocTypeNotNullable = (n, s) => s(n.element);
_.JsdocTypeUnion = (n, s) => n.elements.map(s).join("|");
function ht(n) {
  try {
    return (0, $.parse)(n, "typescript");
  } catch {
    return null;
  }
}
r(ht, "extractType");
function Jt(n) {
  return (0, $.transform)(_, n);
}
r(Jt, "extractTypeName");

// src/docs-tools/argTypes/utils.ts
var bs = 90, Ss = 50;
function Ke(n) {
  return n.length > 90;
}
r(Ke, "isTooLongForTypeSummary");
function wt(n) {
  return n.length > 50;
}
r(wt, "isTooLongForDefaultValueSummary");
function w(n, s) {
  return n === s ? { summary: n } : { summary: n, detail: s };
}
r(w, "createSummaryValue");
var Es = /* @__PURE__ */ r((n) => n.replace(/\\r\\n/g, "\\n"), "normalizeNewlines");

// src/docs-tools/argTypes/docgen/flow/createDefaultValue.ts
function Pt(n, s) {
  if (n != null) {
    let { value: a } = n;
    if (!K(a))
      return wt(a) ? w(s?.name, a) : w(a);
  }
  return null;
}
r(Pt, "createDefaultValue");

// src/docs-tools/argTypes/docgen/flow/createType.ts
function bt({ name: n, value: s, elements: a, raw: p }) {
  return s ?? (a != null ? a.map(bt).join(" | ") : p ?? n);
}
r(bt, "generateUnionElement");
function en({ name: n, raw: s, elements: a }) {
  return a != null ? w(a.map(bt).join(" | ")) : s != null ? w(s.replace(/^\|\s*/, "")) : w(n);
}
r(en, "generateUnion");
function tn({ type: n, raw: s }) {
  return s != null ? w(s) : w(n);
}
r(tn, "generateFuncSignature");
function rn({ type: n, raw: s }) {
  return s != null ? Ke(s) ? w(n, s) : w(s) : w(n);
}
r(rn, "generateObjectSignature");
function nn(n) {
  let { type: s } = n;
  return s === "object" ? rn(n) : tn(n);
}
r(nn, "generateSignature");
function on({ name: n, raw: s }) {
  return s != null ? Ke(s) ? w(n, s) : w(s) : w(n);
}
r(on, "generateDefault");
function St(n) {
  if (n == null)
    return null;
  switch (n.name) {
    case "union":
      return en(n);
    case "signature":
      return nn(n);
    default:
      return on(n);
  }
}
r(St, "createType");

// src/docs-tools/argTypes/docgen/flow/createPropDef.ts
var Et = /* @__PURE__ */ r((n, s) => {
  let { flowType: a, description: p, required: c, defaultValue: u } = s;
  return {
    name: n,
    type: St(a),
    required: c,
    description: p,
    defaultValue: Pt(u ?? null, a ?? null)
  };
}, "createFlowPropDef");

// src/docs-tools/argTypes/docgen/typeScript/createDefaultValue.ts
function Nt({ defaultValue: n }) {
  if (n != null) {
    let { value: s } = n;
    if (!K(s))
      return w(s);
  }
  return null;
}
r(Nt, "createDefaultValue");

// src/docs-tools/argTypes/docgen/typeScript/createType.ts
function Dt({ tsType: n, required: s }) {
  if (n == null)
    return null;
  let a = n.name;
  return s || (a = a.replace(" | undefined", "")), w(
    ["Array", "Record", "signature"].includes(n.name) ? n.raw : a
  );
}
r(Dt, "createType");

// src/docs-tools/argTypes/docgen/typeScript/createPropDef.ts
var Ot = /* @__PURE__ */ r((n, s) => {
  let { description: a, required: p } = s;
  return {
    name: n,
    type: Dt(s),
    required: p,
    description: a,
    defaultValue: Nt(s)
  };
}, "createTsPropDef");

// src/docs-tools/argTypes/docgen/createPropDef.ts
function sn(n) {
  return n != null ? w(n.name) : null;
}
r(sn, "createType");
function an(n) {
  let { computed: s, func: a } = n;
  return typeof s > "u" && typeof a > "u";
}
r(an, "isReactDocgenTypescript");
function pn(n) {
  return n ? n.name === "string" ? !0 : n.name === "enum" ? Array.isArray(n.value) && n.value.every(
    ({ value: s }) => typeof s == "string" && s[0] === '"' && s[s.length - 1] === '"'
  ) : !1 : !1;
}
r(pn, "isStringValued");
function cn(n, s) {
  if (n != null) {
    let { value: a } = n;
    if (!K(a))
      return an(n) && pn(s) ? w(JSON.stringify(a)) : w(a);
  }
  return null;
}
r(cn, "createDefaultValue");
function vt(n, s, a) {
  let { description: p, required: c, defaultValue: u } = a;
  return {
    name: n,
    type: sn(s),
    required: c,
    description: p,
    defaultValue: cn(u, s)
  };
}
r(vt, "createBasicPropDef");
function ye(n, s) {
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
r(ye, "applyJsDocResult");
var ln = /* @__PURE__ */ r((n, s, a) => {
  let p = vt(n, s.type, s);
  return p.sbType = pe(s), ye(p, a);
}, "javaScriptFactory"), un = /* @__PURE__ */ r((n, s, a) => {
  let p = Ot(n, s);
  return p.sbType = pe(s), ye(p, a);
}, "tsFactory"), mn = /* @__PURE__ */ r((n, s, a) => {
  let p = Et(n, s);
  return p.sbType = pe(s), ye(p, a);
}, "flowFactory"), fn = /* @__PURE__ */ r((n, s, a) => {
  let p = vt(n, { name: "unknown" }, s);
  return ye(p, a);
}, "unknownFactory"), $e = /* @__PURE__ */ r((n) => {
  switch (n) {
    case "JavaScript":
      return ln;
    case "TypeScript":
      return un;
    case "Flow":
      return mn;
    default:
      return fn;
  }
}, "getPropDefFactory");

// src/docs-tools/argTypes/docgen/extractDocgenProps.ts
var kt = /* @__PURE__ */ r((n) => n.type != null ? "JavaScript" : n.flowType != null ? "Flow" : n.tsType != null ? "TypeScript" : "Unknown",
"getTypeSystem"), yn = /* @__PURE__ */ r((n) => {
  let s = kt(n[0]), a = $e(s);
  return n.map((p) => {
    let c = p;
    return p.type?.elements && (c = {
      ...p,
      type: {
        ...p.type,
        value: p.type.elements
      }
    }), At(c.name, c, s, a);
  });
}, "extractComponentSectionArray"), dn = /* @__PURE__ */ r((n) => {
  let s = Object.keys(n), a = kt(n[s[0]]), p = $e(a);
  return s.map((c) => {
    let u = n[c];
    return u != null ? At(c, u, a, p) : null;
  }).filter(Boolean);
}, "extractComponentSectionObject"), aa = /* @__PURE__ */ r((n, s) => {
  let a = pt(n, s);
  return it(a) ? Array.isArray(a) ? yn(a) : dn(a) : [];
}, "extractComponentProps");
function At(n, s, a, p) {
  let c = Tt(s.description);
  return c.includesJsDoc && c.ignore ? null : {
    propDef: p(n, s, c),
    jsDocTags: c.extractedTags,
    docgenInfo: s,
    typeSystem: a
  };
}
r(At, "extractProp");
function ia(n) {
  return n != null ? ct(n) : "";
}
r(ia, "extractComponentDescription");

// src/preview-api/modules/store/parameters.ts
var qe = /* @__PURE__ */ r((...n) => {
  let s = {}, a = n.filter(Boolean), p = a.reduce((c, u) => (Object.entries(u).forEach(([m, T]) => {
    let g = c[m];
    Array.isArray(T) || typeof g > "u" ? c[m] = T : X(T) && X(g) ? s[m] = !0 : typeof T < "u" && (c[m] = T);
  }), c), {});
  return Object.keys(s).forEach((c) => {
    let u = a.filter(Boolean).map((m) => m[c]).filter((m) => typeof m < "u");
    u.every((m) => X(m)) ? p[c] = qe(...u) : p[c] = u[u.length - 1];
  }), p;
}, "combineParameters");

// src/docs-tools/argTypes/enhanceArgTypes.ts
var ya = /* @__PURE__ */ r((n) => {
  let {
    component: s,
    argTypes: a,
    parameters: { docs: p = {} }
  } = n, { extractArgTypes: c } = p;
  if (!c || !s)
    return a;
  let u = c(s);
  return u ? qe(u, a) : a;
}, "enhanceArgTypes");

// src/docs-tools/shared.ts
var It = "storybook/docs", ga = `${It}/panel`, xa = "docs", ha = `${It}/snippet-rendered`, Tn = /* @__PURE__ */ ((p) => (p.AUTO = "auto", p.
CODE = "code", p.DYNAMIC = "dynamic", p))(Tn || {});
export {
  It as ADDON_ID,
  Ss as MAX_DEFAULT_VALUE_SUMMARY_LENGTH,
  bs as MAX_TYPE_SUMMARY_LENGTH,
  ga as PANEL_ID,
  xa as PARAM_KEY,
  ha as SNIPPET_RENDERED,
  Tn as SourceType,
  Ir as TypeSystem,
  pe as convert,
  w as createSummaryValue,
  ya as enhanceArgTypes,
  ia as extractComponentDescription,
  aa as extractComponentProps,
  yn as extractComponentSectionArray,
  dn as extractComponentSectionObject,
  ct as getDocgenDescription,
  pt as getDocgenSection,
  at as hasDocgen,
  K as isDefaultValueBlacklisted,
  wt as isTooLongForDefaultValueSummary,
  Ke as isTooLongForTypeSummary,
  it as isValidDocgenSection,
  Es as normalizeNewlines,
  Tt as parseJsDoc,
  st as str
};
