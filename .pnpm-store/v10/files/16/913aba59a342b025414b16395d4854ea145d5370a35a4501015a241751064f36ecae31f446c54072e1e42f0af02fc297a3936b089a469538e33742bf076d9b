var KI = Object.create;
var On = Object.defineProperty;
var YI = Object.getOwnPropertyDescriptor;
var XI = Object.getOwnPropertyNames;
var JI = Object.getPrototypeOf, QI = Object.prototype.hasOwnProperty;
var o = (e, t) => On(e, "name", { value: t, configurable: !0 });
var ZI = (e, t) => () => (e && (t = e(e = 0)), t);
var p = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), Wo = (e, t) => {
  for (var r in t)
    On(e, r, { get: t[r], enumerable: !0 });
}, mg = (e, t, r, n) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let i of XI(t))
      !QI.call(e, i) && i !== r && On(e, i, { get: () => t[i], enumerable: !(n = YI(t, i)) || n.enumerable });
  return e;
};
var ze = (e, t, r) => (r = e != null ? KI(JI(e)) : {}, mg(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  t || !e || !e.__esModule ? On(r, "default", { value: e, enumerable: !0 }) : r,
  e
)), ej = (e) => mg(On({}, "__esModule", { value: !0 }), e);

// ../node_modules/min-indent/index.js
var pv = p((qne, fv) => {
  "use strict";
  fv.exports = (e) => {
    let t = e.match(/^[ \t]*(?=\S)/gm);
    return t ? t.reduce((r, n) => Math.min(r, n.length), 1 / 0) : 0;
  };
});

// ../node_modules/strip-indent/index.js
var hv = p((Rne, mv) => {
  "use strict";
  var Pj = pv();
  mv.exports = (e) => {
    let t = Pj(e);
    if (t === 0)
      return e;
    let r = new RegExp(`^[ \\t]{${t}}`, "gm");
    return e.replace(r, "");
  };
});

// ../node_modules/indent-string/index.js
var yv = p((Tne, bv) => {
  "use strict";
  bv.exports = (e, t = 1, r) => {
    if (r = {
      indent: " ",
      includeEmptyLines: !1,
      ...r
    }, typeof e != "string")
      throw new TypeError(
        `Expected \`input\` to be a \`string\`, got \`${typeof e}\``
      );
    if (typeof t != "number")
      throw new TypeError(
        `Expected \`count\` to be a \`number\`, got \`${typeof t}\``
      );
    if (typeof r.indent != "string")
      throw new TypeError(
        `Expected \`options.indent\` to be a \`string\`, got \`${typeof r.indent}\``
      );
    if (t === 0)
      return e;
    let n = r.includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;
    return e.replace(n, r.indent.repeat(t));
  };
});

// ../node_modules/redent/index.js
var Xp = p((One, gv) => {
  "use strict";
  var qj = hv(), Rj = yv();
  gv.exports = (e, t = 0, r) => Rj(qj(e), t, r);
});

// ../node_modules/aria-query/lib/util/iteratorProxy.js
var zv = p((mi) => {
  "use strict";
  Object.defineProperty(mi, "__esModule", {
    value: !0
  });
  mi.default = void 0;
  function lk() {
    var e = this, t = 0, r = {
      "@@iterator": /* @__PURE__ */ o(function() {
        return r;
      }, "iterator"),
      next: /* @__PURE__ */ o(function() {
        if (t < e.length) {
          var i = e[t];
          return t = t + 1, {
            done: !1,
            value: i
          };
        } else
          return {
            done: !0
          };
      }, "next")
    };
    return r;
  }
  o(lk, "iteratorProxy");
  var moe = mi.default = lk;
});

// ../node_modules/aria-query/lib/util/iterationDecorator.js
var Hr = p((am) => {
  "use strict";
  Object.defineProperty(am, "__esModule", {
    value: !0
  });
  am.default = dk;
  var uk = ck(zv());
  function ck(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(ck, "_interopRequireDefault");
  function im(e) {
    "@babel/helpers - typeof";
    return im = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
      return typeof t;
    } : function(t) {
      return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
    }, im(e);
  }
  o(im, "_typeof");
  function dk(e, t) {
    return typeof Symbol == "function" && im(Symbol.iterator) === "symbol" && Object.defineProperty(e, Symbol.iterator, {
      value: uk.default.bind(t)
    }), e;
  }
  o(dk, "iterationDecorator");
});

// ../node_modules/aria-query/lib/ariaPropsMap.js
var Gv = p((hi) => {
  "use strict";
  Object.defineProperty(hi, "__esModule", {
    value: !0
  });
  hi.default = void 0;
  var fk = pk(Hr());
  function pk(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(pk, "_interopRequireDefault");
  function sm(e, t) {
    return yk(e) || bk(e, t) || hk(e, t) || mk();
  }
  o(sm, "_slicedToArray");
  function mk() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(mk, "_nonIterableRest");
  function hk(e, t) {
    if (e) {
      if (typeof e == "string") return Wv(e, t);
      var r = {}.toString.call(e).slice(8, -1);
      return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
      test(r) ? Wv(e, t) : void 0;
    }
  }
  o(hk, "_unsupportedIterableToArray");
  function Wv(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  o(Wv, "_arrayLikeToArray");
  function bk(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n, i, a, s, l = [], c = !0, u = !1;
      try {
        if (a = (r = r.call(e)).next, t === 0) {
          if (Object(r) !== r) return;
          c = !1;
        } else for (; !(c = (n = a.call(r)).done) && (l.push(n.value), l.length !== t); c = !0) ;
      } catch (d) {
        u = !0, i = d;
      } finally {
        try {
          if (!c && r.return != null && (s = r.return(), Object(s) !== s)) return;
        } finally {
          if (u) throw i;
        }
      }
      return l;
    }
  }
  o(bk, "_iterableToArrayLimit");
  function yk(e) {
    if (Array.isArray(e)) return e;
  }
  o(yk, "_arrayWithHoles");
  var Vr = [["aria-activedescendant", {
    type: "id"
  }], ["aria-atomic", {
    type: "boolean"
  }], ["aria-autocomplete", {
    type: "token",
    values: ["inline", "list", "both", "none"]
  }], ["aria-braillelabel", {
    type: "string"
  }], ["aria-brailleroledescription", {
    type: "string"
  }], ["aria-busy", {
    type: "boolean"
  }], ["aria-checked", {
    type: "tristate"
  }], ["aria-colcount", {
    type: "integer"
  }], ["aria-colindex", {
    type: "integer"
  }], ["aria-colspan", {
    type: "integer"
  }], ["aria-controls", {
    type: "idlist"
  }], ["aria-current", {
    type: "token",
    values: ["page", "step", "location", "date", "time", !0, !1]
  }], ["aria-describedby", {
    type: "idlist"
  }], ["aria-description", {
    type: "string"
  }], ["aria-details", {
    type: "id"
  }], ["aria-disabled", {
    type: "boolean"
  }], ["aria-dropeffect", {
    type: "tokenlist",
    values: ["copy", "execute", "link", "move", "none", "popup"]
  }], ["aria-errormessage", {
    type: "id"
  }], ["aria-expanded", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-flowto", {
    type: "idlist"
  }], ["aria-grabbed", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-haspopup", {
    type: "token",
    values: [!1, !0, "menu", "listbox", "tree", "grid", "dialog"]
  }], ["aria-hidden", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-invalid", {
    type: "token",
    values: ["grammar", !1, "spelling", !0]
  }], ["aria-keyshortcuts", {
    type: "string"
  }], ["aria-label", {
    type: "string"
  }], ["aria-labelledby", {
    type: "idlist"
  }], ["aria-level", {
    type: "integer"
  }], ["aria-live", {
    type: "token",
    values: ["assertive", "off", "polite"]
  }], ["aria-modal", {
    type: "boolean"
  }], ["aria-multiline", {
    type: "boolean"
  }], ["aria-multiselectable", {
    type: "boolean"
  }], ["aria-orientation", {
    type: "token",
    values: ["vertical", "undefined", "horizontal"]
  }], ["aria-owns", {
    type: "idlist"
  }], ["aria-placeholder", {
    type: "string"
  }], ["aria-posinset", {
    type: "integer"
  }], ["aria-pressed", {
    type: "tristate"
  }], ["aria-readonly", {
    type: "boolean"
  }], ["aria-relevant", {
    type: "tokenlist",
    values: ["additions", "all", "removals", "text"]
  }], ["aria-required", {
    type: "boolean"
  }], ["aria-roledescription", {
    type: "string"
  }], ["aria-rowcount", {
    type: "integer"
  }], ["aria-rowindex", {
    type: "integer"
  }], ["aria-rowspan", {
    type: "integer"
  }], ["aria-selected", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-setsize", {
    type: "integer"
  }], ["aria-sort", {
    type: "token",
    values: ["ascending", "descending", "none", "other"]
  }], ["aria-valuemax", {
    type: "number"
  }], ["aria-valuemin", {
    type: "number"
  }], ["aria-valuenow", {
    type: "number"
  }], ["aria-valuetext", {
    type: "string"
  }]], lm = {
    entries: /* @__PURE__ */ o(function() {
      return Vr;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      for (var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = Vr; n < i.length; n++) {
        var a = sm(i[n], 2), s = a[0], l = a[1];
        t.call(r, l, s, Vr);
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = Vr.filter(function(n) {
        return n[0] === t;
      })[0];
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!lm.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return Vr.map(function(t) {
        var r = sm(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return Vr.map(function(t) {
        var r = sm(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, voe = hi.default = (0, fk.default)(lm, lm.entries());
});

// ../node_modules/aria-query/lib/domMap.js
var Yv = p((bi) => {
  "use strict";
  Object.defineProperty(bi, "__esModule", {
    value: !0
  });
  bi.default = void 0;
  var gk = vk(Hr());
  function vk(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(vk, "_interopRequireDefault");
  function um(e, t) {
    return xk(e) || Ck(e, t) || Ek(e, t) || wk();
  }
  o(um, "_slicedToArray");
  function wk() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(wk, "_nonIterableRest");
  function Ek(e, t) {
    if (e) {
      if (typeof e == "string") return Kv(e, t);
      var r = {}.toString.call(e).slice(8, -1);
      return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
      test(r) ? Kv(e, t) : void 0;
    }
  }
  o(Ek, "_unsupportedIterableToArray");
  function Kv(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  o(Kv, "_arrayLikeToArray");
  function Ck(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n, i, a, s, l = [], c = !0, u = !1;
      try {
        if (a = (r = r.call(e)).next, t === 0) {
          if (Object(r) !== r) return;
          c = !1;
        } else for (; !(c = (n = a.call(r)).done) && (l.push(n.value), l.length !== t); c = !0) ;
      } catch (d) {
        u = !0, i = d;
      } finally {
        try {
          if (!c && r.return != null && (s = r.return(), Object(s) !== s)) return;
        } finally {
          if (u) throw i;
        }
      }
      return l;
    }
  }
  o(Ck, "_iterableToArrayLimit");
  function xk(e) {
    if (Array.isArray(e)) return e;
  }
  o(xk, "_arrayWithHoles");
  var zr = [["a", {
    reserved: !1
  }], ["abbr", {
    reserved: !1
  }], ["acronym", {
    reserved: !1
  }], ["address", {
    reserved: !1
  }], ["applet", {
    reserved: !1
  }], ["area", {
    reserved: !1
  }], ["article", {
    reserved: !1
  }], ["aside", {
    reserved: !1
  }], ["audio", {
    reserved: !1
  }], ["b", {
    reserved: !1
  }], ["base", {
    reserved: !0
  }], ["bdi", {
    reserved: !1
  }], ["bdo", {
    reserved: !1
  }], ["big", {
    reserved: !1
  }], ["blink", {
    reserved: !1
  }], ["blockquote", {
    reserved: !1
  }], ["body", {
    reserved: !1
  }], ["br", {
    reserved: !1
  }], ["button", {
    reserved: !1
  }], ["canvas", {
    reserved: !1
  }], ["caption", {
    reserved: !1
  }], ["center", {
    reserved: !1
  }], ["cite", {
    reserved: !1
  }], ["code", {
    reserved: !1
  }], ["col", {
    reserved: !0
  }], ["colgroup", {
    reserved: !0
  }], ["content", {
    reserved: !1
  }], ["data", {
    reserved: !1
  }], ["datalist", {
    reserved: !1
  }], ["dd", {
    reserved: !1
  }], ["del", {
    reserved: !1
  }], ["details", {
    reserved: !1
  }], ["dfn", {
    reserved: !1
  }], ["dialog", {
    reserved: !1
  }], ["dir", {
    reserved: !1
  }], ["div", {
    reserved: !1
  }], ["dl", {
    reserved: !1
  }], ["dt", {
    reserved: !1
  }], ["em", {
    reserved: !1
  }], ["embed", {
    reserved: !1
  }], ["fieldset", {
    reserved: !1
  }], ["figcaption", {
    reserved: !1
  }], ["figure", {
    reserved: !1
  }], ["font", {
    reserved: !1
  }], ["footer", {
    reserved: !1
  }], ["form", {
    reserved: !1
  }], ["frame", {
    reserved: !1
  }], ["frameset", {
    reserved: !1
  }], ["h1", {
    reserved: !1
  }], ["h2", {
    reserved: !1
  }], ["h3", {
    reserved: !1
  }], ["h4", {
    reserved: !1
  }], ["h5", {
    reserved: !1
  }], ["h6", {
    reserved: !1
  }], ["head", {
    reserved: !0
  }], ["header", {
    reserved: !1
  }], ["hgroup", {
    reserved: !1
  }], ["hr", {
    reserved: !1
  }], ["html", {
    reserved: !0
  }], ["i", {
    reserved: !1
  }], ["iframe", {
    reserved: !1
  }], ["img", {
    reserved: !1
  }], ["input", {
    reserved: !1
  }], ["ins", {
    reserved: !1
  }], ["kbd", {
    reserved: !1
  }], ["keygen", {
    reserved: !1
  }], ["label", {
    reserved: !1
  }], ["legend", {
    reserved: !1
  }], ["li", {
    reserved: !1
  }], ["link", {
    reserved: !0
  }], ["main", {
    reserved: !1
  }], ["map", {
    reserved: !1
  }], ["mark", {
    reserved: !1
  }], ["marquee", {
    reserved: !1
  }], ["menu", {
    reserved: !1
  }], ["menuitem", {
    reserved: !1
  }], ["meta", {
    reserved: !0
  }], ["meter", {
    reserved: !1
  }], ["nav", {
    reserved: !1
  }], ["noembed", {
    reserved: !0
  }], ["noscript", {
    reserved: !0
  }], ["object", {
    reserved: !1
  }], ["ol", {
    reserved: !1
  }], ["optgroup", {
    reserved: !1
  }], ["option", {
    reserved: !1
  }], ["output", {
    reserved: !1
  }], ["p", {
    reserved: !1
  }], ["param", {
    reserved: !0
  }], ["picture", {
    reserved: !0
  }], ["pre", {
    reserved: !1
  }], ["progress", {
    reserved: !1
  }], ["q", {
    reserved: !1
  }], ["rp", {
    reserved: !1
  }], ["rt", {
    reserved: !1
  }], ["rtc", {
    reserved: !1
  }], ["ruby", {
    reserved: !1
  }], ["s", {
    reserved: !1
  }], ["samp", {
    reserved: !1
  }], ["script", {
    reserved: !0
  }], ["section", {
    reserved: !1
  }], ["select", {
    reserved: !1
  }], ["small", {
    reserved: !1
  }], ["source", {
    reserved: !0
  }], ["spacer", {
    reserved: !1
  }], ["span", {
    reserved: !1
  }], ["strike", {
    reserved: !1
  }], ["strong", {
    reserved: !1
  }], ["style", {
    reserved: !0
  }], ["sub", {
    reserved: !1
  }], ["summary", {
    reserved: !1
  }], ["sup", {
    reserved: !1
  }], ["table", {
    reserved: !1
  }], ["tbody", {
    reserved: !1
  }], ["td", {
    reserved: !1
  }], ["textarea", {
    reserved: !1
  }], ["tfoot", {
    reserved: !1
  }], ["th", {
    reserved: !1
  }], ["thead", {
    reserved: !1
  }], ["time", {
    reserved: !1
  }], ["title", {
    reserved: !0
  }], ["tr", {
    reserved: !1
  }], ["track", {
    reserved: !0
  }], ["tt", {
    reserved: !1
  }], ["u", {
    reserved: !1
  }], ["ul", {
    reserved: !1
  }], ["var", {
    reserved: !1
  }], ["video", {
    reserved: !1
  }], ["wbr", {
    reserved: !1
  }], ["xmp", {
    reserved: !1
  }]], cm = {
    entries: /* @__PURE__ */ o(function() {
      return zr;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      for (var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = zr; n < i.length; n++) {
        var a = um(i[n], 2), s = a[0], l = a[1];
        t.call(r, l, s, zr);
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = zr.filter(function(n) {
        return n[0] === t;
      })[0];
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!cm.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return zr.map(function(t) {
        var r = um(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return zr.map(function(t) {
        var r = um(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, Coe = bi.default = (0, gk.default)(cm, cm.entries());
});

// ../node_modules/aria-query/lib/etc/roles/abstract/commandRole.js
var Xv = p((yi) => {
  "use strict";
  Object.defineProperty(yi, "__esModule", {
    value: !0
  });
  yi.default = void 0;
  var _k = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, Poe = yi.default = _k;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/compositeRole.js
var Jv = p((gi) => {
  "use strict";
  Object.defineProperty(gi, "__esModule", {
    value: !0
  });
  gi.default = void 0;
  var Pk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, Roe = gi.default = Pk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/inputRole.js
var Qv = p((vi) => {
  "use strict";
  Object.defineProperty(vi, "__esModule", {
    value: !0
  });
  vi.default = void 0;
  var qk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null
    },
    relatedConcepts: [{
      concept: {
        name: "input"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, Ooe = vi.default = qk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/landmarkRole.js
var Zv = p((wi) => {
  "use strict";
  Object.defineProperty(wi, "__esModule", {
    value: !0
  });
  wi.default = void 0;
  var Rk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Moe = wi.default = Rk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/rangeRole.js
var ew = p((Ei) => {
  "use strict";
  Object.defineProperty(Ei, "__esModule", {
    value: !0
  });
  Ei.default = void 0;
  var Tk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuemax": null,
      "aria-valuemin": null,
      "aria-valuenow": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, Noe = Ei.default = Tk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/roletypeRole.js
var tw = p((Ci) => {
  "use strict";
  Object.defineProperty(Ci, "__esModule", {
    value: !0
  });
  Ci.default = void 0;
  var Ok = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {
      "aria-atomic": null,
      "aria-busy": null,
      "aria-controls": null,
      "aria-current": null,
      "aria-describedby": null,
      "aria-details": null,
      "aria-dropeffect": null,
      "aria-flowto": null,
      "aria-grabbed": null,
      "aria-hidden": null,
      "aria-keyshortcuts": null,
      "aria-label": null,
      "aria-labelledby": null,
      "aria-live": null,
      "aria-owns": null,
      "aria-relevant": null,
      "aria-roledescription": null
    },
    relatedConcepts: [{
      concept: {
        name: "role"
      },
      module: "XHTML"
    }, {
      concept: {
        name: "type"
      },
      module: "Dublin Core"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: []
  }, joe = Ci.default = Ok;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/sectionRole.js
var rw = p((xi) => {
  "use strict";
  Object.defineProperty(xi, "__esModule", {
    value: !0
  });
  xi.default = void 0;
  var Sk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "frontmatter"
      },
      module: "DTB"
    }, {
      concept: {
        name: "level"
      },
      module: "DTB"
    }, {
      concept: {
        name: "level"
      },
      module: "SMIL"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, Loe = xi.default = Sk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/sectionheadRole.js
var nw = p((_i) => {
  "use strict";
  Object.defineProperty(_i, "__esModule", {
    value: !0
  });
  _i.default = void 0;
  var Mk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, Boe = _i.default = Mk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/selectRole.js
var ow = p((Pi) => {
  "use strict";
  Object.defineProperty(Pi, "__esModule", {
    value: !0
  });
  Pi.default = void 0;
  var Ak = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "structure", "section", "group"]]
  }, Foe = Pi.default = Ak;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/structureRole.js
var iw = p((qi) => {
  "use strict";
  Object.defineProperty(qi, "__esModule", {
    value: !0
  });
  qi.default = void 0;
  var Nk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, Hoe = qi.default = Nk;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/widgetRole.js
var aw = p((Ri) => {
  "use strict";
  Object.defineProperty(Ri, "__esModule", {
    value: !0
  });
  Ri.default = void 0;
  var Ik = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, zoe = Ri.default = Ik;
});

// ../node_modules/aria-query/lib/etc/roles/abstract/windowRole.js
var sw = p((Ti) => {
  "use strict";
  Object.defineProperty(Ti, "__esModule", {
    value: !0
  });
  Ti.default = void 0;
  var jk = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-modal": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, Goe = Ti.default = jk;
});

// ../node_modules/aria-query/lib/etc/roles/ariaAbstractRoles.js
var lw = p((Oi) => {
  "use strict";
  Object.defineProperty(Oi, "__esModule", {
    value: !0
  });
  Oi.default = void 0;
  var kk = Ze(Xv()), Lk = Ze(Jv()), $k = Ze(Qv()), Bk = Ze(Zv()), Dk = Ze(ew()), Fk = Ze(tw()), Uk = Ze(rw()), Hk = Ze(nw()), Vk = Ze(ow()),
  zk = Ze(iw()), Wk = Ze(aw()), Gk = Ze(sw());
  function Ze(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Ze, "_interopRequireDefault");
  var Kk = [["command", kk.default], ["composite", Lk.default], ["input", $k.default], ["landmark", Bk.default], ["range", Dk.default], ["ro\
letype", Fk.default], ["section", Uk.default], ["sectionhead", Hk.default], ["select", Vk.default], ["structure", zk.default], ["widget", Wk.
  default], ["window", Gk.default]], Yoe = Oi.default = Kk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/alertRole.js
var uw = p((Si) => {
  "use strict";
  Object.defineProperty(Si, "__esModule", {
    value: !0
  });
  Si.default = void 0;
  var Yk = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-atomic": "true",
      "aria-live": "assertive"
    },
    relatedConcepts: [{
      concept: {
        name: "alert"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Qoe = Si.default = Yk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/alertdialogRole.js
var cw = p((Mi) => {
  "use strict";
  Object.defineProperty(Mi, "__esModule", {
    value: !0
  });
  Mi.default = void 0;
  var Xk = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "alert"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "alert"], ["roletype", "window", "dialog"]]
  }, eie = Mi.default = Xk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/applicationRole.js
var dw = p((Ai) => {
  "use strict";
  Object.defineProperty(Ai, "__esModule", {
    value: !0
  });
  Ai.default = void 0;
  var Jk = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "Device Independence Delivery Unit"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, rie = Ai.default = Jk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/articleRole.js
var fw = p((Ni) => {
  "use strict";
  Object.defineProperty(Ni, "__esModule", {
    value: !0
  });
  Ni.default = void 0;
  var Qk = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "article"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "document"]]
  }, oie = Ni.default = Qk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/bannerRole.js
var pw = p((Ii) => {
  "use strict";
  Object.defineProperty(Ii, "__esModule", {
    value: !0
  });
  Ii.default = void 0;
  var Zk = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        constraints: ["scoped to the body element"],
        name: "header"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, aie = Ii.default = Zk;
});

// ../node_modules/aria-query/lib/etc/roles/literal/blockquoteRole.js
var mw = p((ji) => {
  "use strict";
  Object.defineProperty(ji, "__esModule", {
    value: !0
  });
  ji.default = void 0;
  var eL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "blockquote"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, lie = ji.default = eL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/buttonRole.js
var hw = p((ki) => {
  "use strict";
  Object.defineProperty(ki, "__esModule", {
    value: !0
  });
  ki.default = void 0;
  var tL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-pressed": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "button"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "image"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "reset"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "submit"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "button"
      },
      module: "HTML"
    }, {
      concept: {
        name: "trigger"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, cie = ki.default = tL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/captionRole.js
var bw = p((Li) => {
  "use strict";
  Object.defineProperty(Li, "__esModule", {
    value: !0
  });
  Li.default = void 0;
  var rL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "caption"
      },
      module: "HTML"
    }],
    requireContextRole: ["figure", "grid", "table"],
    requiredContextRole: ["figure", "grid", "table"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, fie = Li.default = rL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/cellRole.js
var yw = p(($i) => {
  "use strict";
  Object.defineProperty($i, "__esModule", {
    value: !0
  });
  $i.default = void 0;
  var nL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-colindex": null,
      "aria-colspan": null,
      "aria-rowindex": null,
      "aria-rowspan": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["ancestor table element has table role"],
        name: "td"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, mie = $i.default = nL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/checkboxRole.js
var gw = p((Bi) => {
  "use strict";
  Object.defineProperty(Bi, "__esModule", {
    value: !0
  });
  Bi.default = void 0;
  var oL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "checkbox"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "option"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input"]]
  }, bie = Bi.default = oL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/codeRole.js
var vw = p((Di) => {
  "use strict";
  Object.defineProperty(Di, "__esModule", {
    value: !0
  });
  Di.default = void 0;
  var iL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "code"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, gie = Di.default = iL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/columnheaderRole.js
var ww = p((Fi) => {
  "use strict";
  Object.defineProperty(Fi, "__esModule", {
    value: !0
  });
  Fi.default = void 0;
  var aL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-sort": null
    },
    relatedConcepts: [{
      concept: {
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "col"
        }],
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "colgroup"
        }],
        name: "th"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "structure", "section", "cell", "gridcell"], ["roletype", "widge\
t", "gridcell"], ["roletype", "structure", "sectionhead"]]
  }, wie = Fi.default = aL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/comboboxRole.js
var Ew = p((Ui) => {
  "use strict";
  Object.defineProperty(Ui, "__esModule", {
    value: !0
  });
  Ui.default = void 0;
  var sL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-autocomplete": null,
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-expanded": "false",
      "aria-haspopup": "listbox"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "email"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "search"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "tel"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "text"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "multiple"
        }, {
          constraints: ["undefined"],
          name: "size"
        }],
        constraints: ["the multiple attribute is not set and the size attribute does not have a value greater than 1"],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-controls": null,
      "aria-expanded": "false"
    },
    superClass: [["roletype", "widget", "input"]]
  }, Cie = Ui.default = sL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/complementaryRole.js
var Cw = p((Hi) => {
  "use strict";
  Object.defineProperty(Hi, "__esModule", {
    value: !0
  });
  Hi.default = void 0;
  var lL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        constraints: ["scoped to the body element", "scoped to the main element"],
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
        name: "aside"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, _ie = Hi.default = lL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/contentinfoRole.js
var xw = p((Vi) => {
  "use strict";
  Object.defineProperty(Vi, "__esModule", {
    value: !0
  });
  Vi.default = void 0;
  var uL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        constraints: ["scoped to the body element"],
        name: "footer"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, qie = Vi.default = uL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/definitionRole.js
var _w = p((zi) => {
  "use strict";
  Object.defineProperty(zi, "__esModule", {
    value: !0
  });
  zi.default = void 0;
  var cL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dd"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Tie = zi.default = cL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/deletionRole.js
var Pw = p((Wi) => {
  "use strict";
  Object.defineProperty(Wi, "__esModule", {
    value: !0
  });
  Wi.default = void 0;
  var dL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "del"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Sie = Wi.default = dL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/dialogRole.js
var qw = p((Gi) => {
  "use strict";
  Object.defineProperty(Gi, "__esModule", {
    value: !0
  });
  Gi.default = void 0;
  var fL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dialog"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "window"]]
  }, Aie = Gi.default = fL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/directoryRole.js
var Rw = p((Ki) => {
  "use strict";
  Object.defineProperty(Ki, "__esModule", {
    value: !0
  });
  Ki.default = void 0;
  var pL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      module: "DAISY Guide"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "list"]]
  }, Iie = Ki.default = pL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/documentRole.js
var Tw = p((Yi) => {
  "use strict";
  Object.defineProperty(Yi, "__esModule", {
    value: !0
  });
  Yi.default = void 0;
  var mL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "Device Independence Delivery Unit"
      }
    }, {
      concept: {
        name: "html"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, kie = Yi.default = mL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/emphasisRole.js
var Ow = p((Xi) => {
  "use strict";
  Object.defineProperty(Xi, "__esModule", {
    value: !0
  });
  Xi.default = void 0;
  var hL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "em"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, $ie = Xi.default = hL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/feedRole.js
var Sw = p((Ji) => {
  "use strict";
  Object.defineProperty(Ji, "__esModule", {
    value: !0
  });
  Ji.default = void 0;
  var bL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["article"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "list"]]
  }, Die = Ji.default = bL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/figureRole.js
var Mw = p((Qi) => {
  "use strict";
  Object.defineProperty(Qi, "__esModule", {
    value: !0
  });
  Qi.default = void 0;
  var yL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "figure"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Uie = Qi.default = yL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/formRole.js
var Aw = p((Zi) => {
  "use strict";
  Object.defineProperty(Zi, "__esModule", {
    value: !0
  });
  Zi.default = void 0;
  var gL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        name: "form"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        name: "form"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "name"
        }],
        name: "form"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Vie = Zi.default = gL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/genericRole.js
var Nw = p((ea) => {
  "use strict";
  Object.defineProperty(ea, "__esModule", {
    value: !0
  });
  ea.default = void 0;
  var vL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "a"
      },
      module: "HTML"
    }, {
      concept: {
        name: "area"
      },
      module: "HTML"
    }, {
      concept: {
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        name: "b"
      },
      module: "HTML"
    }, {
      concept: {
        name: "bdo"
      },
      module: "HTML"
    }, {
      concept: {
        name: "body"
      },
      module: "HTML"
    }, {
      concept: {
        name: "data"
      },
      module: "HTML"
    }, {
      concept: {
        name: "div"
      },
      module: "HTML"
    }, {
      concept: {
        constraints: ["scoped to the main element", "scoped to a sectioning content element", "scoped to a sectioning root element other tha\
n body"],
        name: "footer"
      },
      module: "HTML"
    }, {
      concept: {
        constraints: ["scoped to the main element", "scoped to a sectioning content element", "scoped to a sectioning root element other tha\
n body"],
        name: "header"
      },
      module: "HTML"
    }, {
      concept: {
        name: "hgroup"
      },
      module: "HTML"
    }, {
      concept: {
        name: "i"
      },
      module: "HTML"
    }, {
      concept: {
        name: "pre"
      },
      module: "HTML"
    }, {
      concept: {
        name: "q"
      },
      module: "HTML"
    }, {
      concept: {
        name: "samp"
      },
      module: "HTML"
    }, {
      concept: {
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        name: "small"
      },
      module: "HTML"
    }, {
      concept: {
        name: "span"
      },
      module: "HTML"
    }, {
      concept: {
        name: "u"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, Wie = ea.default = vL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/gridRole.js
var Iw = p((ta) => {
  "use strict";
  Object.defineProperty(ta, "__esModule", {
    value: !0
  });
  ta.default = void 0;
  var wL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-multiselectable": null,
      "aria-readonly": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "structure", "section", "table"]]
  }, Kie = ta.default = wL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/gridcellRole.js
var jw = p((ra) => {
  "use strict";
  Object.defineProperty(ra, "__esModule", {
    value: !0
  });
  ra.default = void 0;
  var EL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-selected": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["ancestor table element has grid role", "ancestor table element has treegrid role"],
        name: "td"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "widget"]]
  }, Xie = ra.default = EL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/groupRole.js
var kw = p((na) => {
  "use strict";
  Object.defineProperty(na, "__esModule", {
    value: !0
  });
  na.default = void 0;
  var CL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null
    },
    relatedConcepts: [{
      concept: {
        name: "details"
      },
      module: "HTML"
    }, {
      concept: {
        name: "fieldset"
      },
      module: "HTML"
    }, {
      concept: {
        name: "optgroup"
      },
      module: "HTML"
    }, {
      concept: {
        name: "address"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Qie = na.default = CL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/headingRole.js
var Lw = p((oa) => {
  "use strict";
  Object.defineProperty(oa, "__esModule", {
    value: !0
  });
  oa.default = void 0;
  var xL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-level": "2"
    },
    relatedConcepts: [{
      concept: {
        name: "h1"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h2"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h3"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h4"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h5"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h6"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-level": "2"
    },
    superClass: [["roletype", "structure", "sectionhead"]]
  }, eae = oa.default = xL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/imgRole.js
var $w = p((ia) => {
  "use strict";
  Object.defineProperty(ia, "__esModule", {
    value: !0
  });
  ia.default = void 0;
  var _L = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "alt"
        }],
        name: "img"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "alt"
        }],
        name: "img"
      },
      module: "HTML"
    }, {
      concept: {
        name: "imggroup"
      },
      module: "DTB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, rae = ia.default = _L;
});

// ../node_modules/aria-query/lib/etc/roles/literal/insertionRole.js
var Bw = p((aa) => {
  "use strict";
  Object.defineProperty(aa, "__esModule", {
    value: !0
  });
  aa.default = void 0;
  var PL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "ins"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, oae = aa.default = PL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/linkRole.js
var Dw = p((sa) => {
  "use strict";
  Object.defineProperty(sa, "__esModule", {
    value: !0
  });
  sa.default = void 0;
  var qL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "href"
        }],
        name: "a"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "href"
        }],
        name: "area"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, aae = sa.default = qL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/listRole.js
var Fw = p((la) => {
  "use strict";
  Object.defineProperty(la, "__esModule", {
    value: !0
  });
  la.default = void 0;
  var RL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menu"
      },
      module: "HTML"
    }, {
      concept: {
        name: "ol"
      },
      module: "HTML"
    }, {
      concept: {
        name: "ul"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["listitem"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, lae = la.default = RL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/listboxRole.js
var Uw = p((ua) => {
  "use strict";
  Object.defineProperty(ua, "__esModule", {
    value: !0
  });
  ua.default = void 0;
  var TL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-invalid": null,
      "aria-multiselectable": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-orientation": "vertical"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: [">1"],
          name: "size"
        }],
        constraints: ["the size attribute value is greater than 1"],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "multiple"
        }],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        name: "datalist"
      },
      module: "HTML"
    }, {
      concept: {
        name: "list"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["option", "group"], ["option"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, cae = ua.default = TL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/listitemRole.js
var Hw = p((ca) => {
  "use strict";
  Object.defineProperty(ca, "__esModule", {
    value: !0
  });
  ca.default = void 0;
  var OL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-level": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["direct descendant of ol", "direct descendant of ul", "direct descendant of menu"],
        name: "li"
      },
      module: "HTML"
    }, {
      concept: {
        name: "item"
      },
      module: "XForms"
    }],
    requireContextRole: ["directory", "list"],
    requiredContextRole: ["directory", "list"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, fae = ca.default = OL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/logRole.js
var Vw = p((da) => {
  "use strict";
  Object.defineProperty(da, "__esModule", {
    value: !0
  });
  da.default = void 0;
  var SL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-live": "polite"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, mae = da.default = SL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/mainRole.js
var zw = p((fa) => {
  "use strict";
  Object.defineProperty(fa, "__esModule", {
    value: !0
  });
  fa.default = void 0;
  var ML = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "main"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, bae = fa.default = ML;
});

// ../node_modules/aria-query/lib/etc/roles/literal/markRole.js
var Ww = p((pa) => {
  "use strict";
  Object.defineProperty(pa, "__esModule", {
    value: !0
  });
  pa.default = void 0;
  var AL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: [],
    props: {
      "aria-braillelabel": null,
      "aria-brailleroledescription": null,
      "aria-description": null
    },
    relatedConcepts: [{
      concept: {
        name: "mark"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, gae = pa.default = AL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/marqueeRole.js
var Gw = p((ma) => {
  "use strict";
  Object.defineProperty(ma, "__esModule", {
    value: !0
  });
  ma.default = void 0;
  var NL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, wae = ma.default = NL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/mathRole.js
var Kw = p((ha) => {
  "use strict";
  Object.defineProperty(ha, "__esModule", {
    value: !0
  });
  ha.default = void 0;
  var IL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "math"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Cae = ha.default = IL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/menuRole.js
var Yw = p((ba) => {
  "use strict";
  Object.defineProperty(ba, "__esModule", {
    value: !0
  });
  ba.default = void 0;
  var jL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "vertical"
    },
    relatedConcepts: [{
      concept: {
        name: "MENU"
      },
      module: "JAPI"
    }, {
      concept: {
        name: "list"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }, {
      concept: {
        name: "sidebar"
      },
      module: "DTB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["menuitem", "group"], ["menuitemradio", "group"], ["menuitemcheckbox", "group"], ["menuitem"], ["menuitemcheckb\
ox"], ["menuitemradio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, _ae = ba.default = jL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/menubarRole.js
var Xw = p((ya) => {
  "use strict";
  Object.defineProperty(ya, "__esModule", {
    value: !0
  });
  ya.default = void 0;
  var kL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      concept: {
        name: "toolbar"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["menuitem", "group"], ["menuitemradio", "group"], ["menuitemcheckbox", "group"], ["menuitem"], ["menuitemcheckb\
ox"], ["menuitemradio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select", "menu"], ["roletype", "structure", "section", "group", "select", "menu"]]
  }, qae = ya.default = kL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/menuitemRole.js
var Jw = p((ga) => {
  "use strict";
  Object.defineProperty(ga, "__esModule", {
    value: !0
  });
  ga.default = void 0;
  var LL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "MENU_ITEM"
      },
      module: "JAPI"
    }, {
      concept: {
        name: "listitem"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "option"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, Tae = ga.default = LL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/menuitemcheckboxRole.js
var Qw = p((va) => {
  "use strict";
  Object.defineProperty(va, "__esModule", {
    value: !0
  });
  va.default = void 0;
  var $L = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menuitem"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox"], ["roletype", "widget", "command", "menuitem"]]
  }, Sae = va.default = $L;
});

// ../node_modules/aria-query/lib/etc/roles/literal/menuitemradioRole.js
var Zw = p((wa) => {
  "use strict";
  Object.defineProperty(wa, "__esModule", {
    value: !0
  });
  wa.default = void 0;
  var BL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menuitem"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox", "menuitemcheckbox"], ["roletype", "widget", "command", "menuitem", "menuitemche\
ckbox"], ["roletype", "widget", "input", "radio"]]
  }, Aae = wa.default = BL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/meterRole.js
var eE = p((Ea) => {
  "use strict";
  Object.defineProperty(Ea, "__esModule", {
    value: !0
  });
  Ea.default = void 0;
  var DL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuetext": null,
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [{
      concept: {
        name: "meter"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-valuenow": null
    },
    superClass: [["roletype", "structure", "range"]]
  }, Iae = Ea.default = DL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/navigationRole.js
var tE = p((Ca) => {
  "use strict";
  Object.defineProperty(Ca, "__esModule", {
    value: !0
  });
  Ca.default = void 0;
  var FL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "nav"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, kae = Ca.default = FL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/noneRole.js
var rE = p((xa) => {
  "use strict";
  Object.defineProperty(xa, "__esModule", {
    value: !0
  });
  xa.default = void 0;
  var UL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: []
  }, $ae = xa.default = UL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/noteRole.js
var nE = p((_a) => {
  "use strict";
  Object.defineProperty(_a, "__esModule", {
    value: !0
  });
  _a.default = void 0;
  var HL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Dae = _a.default = HL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/optionRole.js
var oE = p((Pa) => {
  "use strict";
  Object.defineProperty(Pa, "__esModule", {
    value: !0
  });
  Pa.default = void 0;
  var VL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-posinset": null,
      "aria-setsize": null,
      "aria-selected": "false"
    },
    relatedConcepts: [{
      concept: {
        name: "item"
      },
      module: "XForms"
    }, {
      concept: {
        name: "listitem"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "option"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-selected": "false"
    },
    superClass: [["roletype", "widget", "input"]]
  }, Uae = Pa.default = VL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/paragraphRole.js
var iE = p((qa) => {
  "use strict";
  Object.defineProperty(qa, "__esModule", {
    value: !0
  });
  qa.default = void 0;
  var zL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "p"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Vae = qa.default = zL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/presentationRole.js
var aE = p((Ra) => {
  "use strict";
  Object.defineProperty(Ra, "__esModule", {
    value: !0
  });
  Ra.default = void 0;
  var WL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "alt",
          value: ""
        }],
        name: "img"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, Wae = Ra.default = WL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/progressbarRole.js
var sE = p((Ta) => {
  "use strict";
  Object.defineProperty(Ta, "__esModule", {
    value: !0
  });
  Ta.default = void 0;
  var GL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuetext": null
    },
    relatedConcepts: [{
      concept: {
        name: "progress"
      },
      module: "HTML"
    }, {
      concept: {
        name: "status"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "range"], ["roletype", "widget"]]
  }, Kae = Ta.default = GL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/radioRole.js
var lE = p((Oa) => {
  "use strict";
  Object.defineProperty(Oa, "__esModule", {
    value: !0
  });
  Oa.default = void 0;
  var KL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "radio"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input"]]
  }, Xae = Oa.default = KL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/radiogroupRole.js
var uE = p((Sa) => {
  "use strict";
  Object.defineProperty(Sa, "__esModule", {
    value: !0
  });
  Sa.default = void 0;
  var YL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        name: "list"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["radio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, Qae = Sa.default = YL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/regionRole.js
var cE = p((Ma) => {
  "use strict";
  Object.defineProperty(Ma, "__esModule", {
    value: !0
  });
  Ma.default = void 0;
  var XL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        name: "Device Independence Glossart perceivable unit"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, ese = Ma.default = XL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/rowRole.js
var dE = p((Aa) => {
  "use strict";
  Object.defineProperty(Aa, "__esModule", {
    value: !0
  });
  Aa.default = void 0;
  var JL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-colindex": null,
      "aria-expanded": null,
      "aria-level": null,
      "aria-posinset": null,
      "aria-rowindex": null,
      "aria-selected": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "tr"
      },
      module: "HTML"
    }],
    requireContextRole: ["grid", "rowgroup", "table", "treegrid"],
    requiredContextRole: ["grid", "rowgroup", "table", "treegrid"],
    requiredOwnedElements: [["cell"], ["columnheader"], ["gridcell"], ["rowheader"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"], ["roletype", "widget"]]
  }, rse = Aa.default = JL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/rowgroupRole.js
var fE = p((Na) => {
  "use strict";
  Object.defineProperty(Na, "__esModule", {
    value: !0
  });
  Na.default = void 0;
  var QL = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "tbody"
      },
      module: "HTML"
    }, {
      concept: {
        name: "tfoot"
      },
      module: "HTML"
    }, {
      concept: {
        name: "thead"
      },
      module: "HTML"
    }],
    requireContextRole: ["grid", "table", "treegrid"],
    requiredContextRole: ["grid", "table", "treegrid"],
    requiredOwnedElements: [["row"]],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, ose = Na.default = QL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/rowheaderRole.js
var pE = p((Ia) => {
  "use strict";
  Object.defineProperty(Ia, "__esModule", {
    value: !0
  });
  Ia.default = void 0;
  var ZL = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-sort": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "scope",
          value: "row"
        }],
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "rowgroup"
        }],
        name: "th"
      },
      module: "HTML"
    }],
    requireContextRole: ["row", "rowgroup"],
    requiredContextRole: ["row", "rowgroup"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "structure", "section", "cell", "gridcell"], ["roletype", "widge\
t", "gridcell"], ["roletype", "structure", "sectionhead"]]
  }, ase = Ia.default = ZL;
});

// ../node_modules/aria-query/lib/etc/roles/literal/scrollbarRole.js
var mE = p((ja) => {
  "use strict";
  Object.defineProperty(ja, "__esModule", {
    value: !0
  });
  ja.default = void 0;
  var e$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-valuetext": null,
      "aria-orientation": "vertical",
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-controls": null,
      "aria-valuenow": null
    },
    superClass: [["roletype", "structure", "range"], ["roletype", "widget"]]
  }, lse = ja.default = e$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/searchRole.js
var hE = p((ka) => {
  "use strict";
  Object.defineProperty(ka, "__esModule", {
    value: !0
  });
  ka.default = void 0;
  var t$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, cse = ka.default = t$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/searchboxRole.js
var bE = p((La) => {
  "use strict";
  Object.defineProperty(La, "__esModule", {
    value: !0
  });
  La.default = void 0;
  var r$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "search"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "input", "textbox"]]
  }, fse = La.default = r$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/separatorRole.js
var yE = p(($a) => {
  "use strict";
  Object.defineProperty($a, "__esModule", {
    value: !0
  });
  $a.default = void 0;
  var n$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-orientation": "horizontal",
      "aria-valuemax": "100",
      "aria-valuemin": "0",
      "aria-valuenow": null,
      "aria-valuetext": null
    },
    relatedConcepts: [{
      concept: {
        name: "hr"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, mse = $a.default = n$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/sliderRole.js
var gE = p((Ba) => {
  "use strict";
  Object.defineProperty(Ba, "__esModule", {
    value: !0
  });
  Ba.default = void 0;
  var o$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-valuetext": null,
      "aria-orientation": "horizontal",
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "range"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-valuenow": null
    },
    superClass: [["roletype", "widget", "input"], ["roletype", "structure", "range"]]
  }, bse = Ba.default = o$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/spinbuttonRole.js
var vE = p((Da) => {
  "use strict";
  Object.defineProperty(Da, "__esModule", {
    value: !0
  });
  Da.default = void 0;
  var i$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-valuetext": null,
      "aria-valuenow": "0"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "number"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "widget", "input"], ["roletype", "structure", "range"]]
  }, gse = Da.default = i$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/statusRole.js
var wE = p((Fa) => {
  "use strict";
  Object.defineProperty(Fa, "__esModule", {
    value: !0
  });
  Fa.default = void 0;
  var a$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-atomic": "true",
      "aria-live": "polite"
    },
    relatedConcepts: [{
      concept: {
        name: "output"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, wse = Fa.default = a$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/strongRole.js
var EE = p((Ua) => {
  "use strict";
  Object.defineProperty(Ua, "__esModule", {
    value: !0
  });
  Ua.default = void 0;
  var s$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "strong"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Cse = Ua.default = s$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/subscriptRole.js
var CE = p((Ha) => {
  "use strict";
  Object.defineProperty(Ha, "__esModule", {
    value: !0
  });
  Ha.default = void 0;
  var l$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "sub"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, _se = Ha.default = l$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/superscriptRole.js
var xE = p((Va) => {
  "use strict";
  Object.defineProperty(Va, "__esModule", {
    value: !0
  });
  Va.default = void 0;
  var u$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "sup"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, qse = Va.default = u$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/switchRole.js
var _E = p((za) => {
  "use strict";
  Object.defineProperty(za, "__esModule", {
    value: !0
  });
  za.default = void 0;
  var c$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "button"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox"]]
  }, Tse = za.default = c$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/tabRole.js
var PE = p((Wa) => {
  "use strict";
  Object.defineProperty(Wa, "__esModule", {
    value: !0
  });
  Wa.default = void 0;
  var d$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-posinset": null,
      "aria-setsize": null,
      "aria-selected": "false"
    },
    relatedConcepts: [],
    requireContextRole: ["tablist"],
    requiredContextRole: ["tablist"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "sectionhead"], ["roletype", "widget"]]
  }, Sse = Wa.default = d$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/tableRole.js
var qE = p((Ga) => {
  "use strict";
  Object.defineProperty(Ga, "__esModule", {
    value: !0
  });
  Ga.default = void 0;
  var f$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-colcount": null,
      "aria-rowcount": null
    },
    relatedConcepts: [{
      concept: {
        name: "table"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Ase = Ga.default = f$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/tablistRole.js
var RE = p((Ka) => {
  "use strict";
  Object.defineProperty(Ka, "__esModule", {
    value: !0
  });
  Ka.default = void 0;
  var p$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-level": null,
      "aria-multiselectable": null,
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      module: "DAISY",
      concept: {
        name: "guide"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["tab"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"]]
  }, Ise = Ka.default = p$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/tabpanelRole.js
var TE = p((Ya) => {
  "use strict";
  Object.defineProperty(Ya, "__esModule", {
    value: !0
  });
  Ya.default = void 0;
  var m$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, kse = Ya.default = m$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/termRole.js
var OE = p((Xa) => {
  "use strict";
  Object.defineProperty(Xa, "__esModule", {
    value: !0
  });
  Xa.default = void 0;
  var h$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dfn"
      },
      module: "HTML"
    }, {
      concept: {
        name: "dt"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, $se = Xa.default = h$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/textboxRole.js
var SE = p((Ja) => {
  "use strict";
  Object.defineProperty(Ja, "__esModule", {
    value: !0
  });
  Ja.default = void 0;
  var b$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-autocomplete": null,
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-multiline": null,
      "aria-placeholder": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "type"
        }, {
          constraints: ["undefined"],
          name: "list"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "email"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "tel"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "text"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "input"
      },
      module: "XForms"
    }, {
      concept: {
        name: "textarea"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "input"]]
  }, Dse = Ja.default = b$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/timeRole.js
var ME = p((Qa) => {
  "use strict";
  Object.defineProperty(Qa, "__esModule", {
    value: !0
  });
  Qa.default = void 0;
  var y$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "time"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Use = Qa.default = y$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/timerRole.js
var AE = p((Za) => {
  "use strict";
  Object.defineProperty(Za, "__esModule", {
    value: !0
  });
  Za.default = void 0;
  var g$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "status"]]
  }, Vse = Za.default = g$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/toolbarRole.js
var NE = p((es) => {
  "use strict";
  Object.defineProperty(es, "__esModule", {
    value: !0
  });
  es.default = void 0;
  var v$ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      concept: {
        name: "menubar"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"]]
  }, Wse = es.default = v$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/tooltipRole.js
var IE = p((ts) => {
  "use strict";
  Object.defineProperty(ts, "__esModule", {
    value: !0
  });
  ts.default = void 0;
  var w$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Kse = ts.default = w$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/treeRole.js
var jE = p((rs) => {
  "use strict";
  Object.defineProperty(rs, "__esModule", {
    value: !0
  });
  rs.default = void 0;
  var E$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-multiselectable": null,
      "aria-required": null,
      "aria-orientation": "vertical"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["treeitem", "group"], ["treeitem"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, Xse = rs.default = E$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/treegridRole.js
var kE = p((ns) => {
  "use strict";
  Object.defineProperty(ns, "__esModule", {
    value: !0
  });
  ns.default = void 0;
  var C$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "grid"], ["roletype", "structure", "section", "table", "grid"], ["roletype", "widget", "\
composite", "select", "tree"], ["roletype", "structure", "section", "group", "select", "tree"]]
  }, Qse = ns.default = C$;
});

// ../node_modules/aria-query/lib/etc/roles/literal/treeitemRole.js
var LE = p((os) => {
  "use strict";
  Object.defineProperty(os, "__esModule", {
    value: !0
  });
  os.default = void 0;
  var x$ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-expanded": null,
      "aria-haspopup": null
    },
    relatedConcepts: [],
    requireContextRole: ["group", "tree"],
    requiredContextRole: ["group", "tree"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-selected": null
    },
    superClass: [["roletype", "structure", "section", "listitem"], ["roletype", "widget", "input", "option"]]
  }, ele = os.default = x$;
});

// ../node_modules/aria-query/lib/etc/roles/ariaLiteralRoles.js
var $E = p((is) => {
  "use strict";
  Object.defineProperty(is, "__esModule", {
    value: !0
  });
  is.default = void 0;
  var _$ = k(uw()), P$ = k(cw()), q$ = k(dw()), R$ = k(fw()), T$ = k(pw()), O$ = k(mw()), S$ = k(hw()), M$ = k(bw()), A$ = k(yw()), N$ = k(gw()),
  I$ = k(vw()), j$ = k(ww()), k$ = k(Ew()), L$ = k(Cw()), $$ = k(xw()), B$ = k(_w()), D$ = k(Pw()), F$ = k(qw()), U$ = k(Rw()), H$ = k(Tw()),
  V$ = k(Ow()), z$ = k(Sw()), W$ = k(Mw()), G$ = k(Aw()), K$ = k(Nw()), Y$ = k(Iw()), X$ = k(jw()), J$ = k(kw()), Q$ = k(Lw()), Z$ = k($w()),
  eB = k(Bw()), tB = k(Dw()), rB = k(Fw()), nB = k(Uw()), oB = k(Hw()), iB = k(Vw()), aB = k(zw()), sB = k(Ww()), lB = k(Gw()), uB = k(Kw()),
  cB = k(Yw()), dB = k(Xw()), fB = k(Jw()), pB = k(Qw()), mB = k(Zw()), hB = k(eE()), bB = k(tE()), yB = k(rE()), gB = k(nE()), vB = k(oE()),
  wB = k(iE()), EB = k(aE()), CB = k(sE()), xB = k(lE()), _B = k(uE()), PB = k(cE()), qB = k(dE()), RB = k(fE()), TB = k(pE()), OB = k(mE()),
  SB = k(hE()), MB = k(bE()), AB = k(yE()), NB = k(gE()), IB = k(vE()), jB = k(wE()), kB = k(EE()), LB = k(CE()), $B = k(xE()), BB = k(_E()),
  DB = k(PE()), FB = k(qE()), UB = k(RE()), HB = k(TE()), VB = k(OE()), zB = k(SE()), WB = k(ME()), GB = k(AE()), KB = k(NE()), YB = k(IE()),
  XB = k(jE()), JB = k(kE()), QB = k(LE());
  function k(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(k, "_interopRequireDefault");
  var ZB = [["alert", _$.default], ["alertdialog", P$.default], ["application", q$.default], ["article", R$.default], ["banner", T$.default],
  ["blockquote", O$.default], ["button", S$.default], ["caption", M$.default], ["cell", A$.default], ["checkbox", N$.default], ["code", I$.default],
  ["columnheader", j$.default], ["combobox", k$.default], ["complementary", L$.default], ["contentinfo", $$.default], ["definition", B$.default],
  ["deletion", D$.default], ["dialog", F$.default], ["directory", U$.default], ["document", H$.default], ["emphasis", V$.default], ["feed", z$.
  default], ["figure", W$.default], ["form", G$.default], ["generic", K$.default], ["grid", Y$.default], ["gridcell", X$.default], ["group",
  J$.default], ["heading", Q$.default], ["img", Z$.default], ["insertion", eB.default], ["link", tB.default], ["list", rB.default], ["listbo\
x", nB.default], ["listitem", oB.default], ["log", iB.default], ["main", aB.default], ["mark", sB.default], ["marquee", lB.default], ["math",
  uB.default], ["menu", cB.default], ["menubar", dB.default], ["menuitem", fB.default], ["menuitemcheckbox", pB.default], ["menuitemradio", mB.
  default], ["meter", hB.default], ["navigation", bB.default], ["none", yB.default], ["note", gB.default], ["option", vB.default], ["paragra\
ph", wB.default], ["presentation", EB.default], ["progressbar", CB.default], ["radio", xB.default], ["radiogroup", _B.default], ["region", PB.
  default], ["row", qB.default], ["rowgroup", RB.default], ["rowheader", TB.default], ["scrollbar", OB.default], ["search", SB.default], ["s\
earchbox", MB.default], ["separator", AB.default], ["slider", NB.default], ["spinbutton", IB.default], ["status", jB.default], ["strong", kB.
  default], ["subscript", LB.default], ["superscript", $B.default], ["switch", BB.default], ["tab", DB.default], ["table", FB.default], ["ta\
blist", UB.default], ["tabpanel", HB.default], ["term", VB.default], ["textbox", zB.default], ["time", WB.default], ["timer", GB.default], [
  "toolbar", KB.default], ["tooltip", YB.default], ["tree", XB.default], ["treegrid", JB.default], ["treeitem", QB.default]], rle = is.default =
  ZB;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docAbstractRole.js
var BE = p((as) => {
  "use strict";
  Object.defineProperty(as, "__esModule", {
    value: !0
  });
  as.default = void 0;
  var eD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "abstract [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, ile = as.default = eD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docAcknowledgmentsRole.js
var DE = p((ss) => {
  "use strict";
  Object.defineProperty(ss, "__esModule", {
    value: !0
  });
  ss.default = void 0;
  var tD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "acknowledgments [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, sle = ss.default = tD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docAfterwordRole.js
var FE = p((ls) => {
  "use strict";
  Object.defineProperty(ls, "__esModule", {
    value: !0
  });
  ls.default = void 0;
  var rD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "afterword [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, ule = ls.default = rD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docAppendixRole.js
var UE = p((us) => {
  "use strict";
  Object.defineProperty(us, "__esModule", {
    value: !0
  });
  us.default = void 0;
  var nD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "appendix [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, dle = us.default = nD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docBacklinkRole.js
var HE = p((cs) => {
  "use strict";
  Object.defineProperty(cs, "__esModule", {
    value: !0
  });
  cs.default = void 0;
  var oD = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "referrer [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, ple = cs.default = oD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docBiblioentryRole.js
var VE = p((ds) => {
  "use strict";
  Object.defineProperty(ds, "__esModule", {
    value: !0
  });
  ds.default = void 0;
  var iD = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "EPUB biblioentry [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: ["doc-bibliography"],
    requiredContextRole: ["doc-bibliography"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "listitem"]]
  }, hle = ds.default = iD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docBibliographyRole.js
var zE = p((fs) => {
  "use strict";
  Object.defineProperty(fs, "__esModule", {
    value: !0
  });
  fs.default = void 0;
  var aD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "bibliography [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["doc-biblioentry"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, yle = fs.default = aD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docBibliorefRole.js
var WE = p((ps) => {
  "use strict";
  Object.defineProperty(ps, "__esModule", {
    value: !0
  });
  ps.default = void 0;
  var sD = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "biblioref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, vle = ps.default = sD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docChapterRole.js
var GE = p((ms) => {
  "use strict";
  Object.defineProperty(ms, "__esModule", {
    value: !0
  });
  ms.default = void 0;
  var lD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "chapter [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Ele = ms.default = lD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docColophonRole.js
var KE = p((hs) => {
  "use strict";
  Object.defineProperty(hs, "__esModule", {
    value: !0
  });
  hs.default = void 0;
  var uD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "colophon [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, xle = hs.default = uD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docConclusionRole.js
var YE = p((bs) => {
  "use strict";
  Object.defineProperty(bs, "__esModule", {
    value: !0
  });
  bs.default = void 0;
  var cD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "conclusion [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Ple = bs.default = cD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docCoverRole.js
var XE = p((ys) => {
  "use strict";
  Object.defineProperty(ys, "__esModule", {
    value: !0
  });
  ys.default = void 0;
  var dD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "cover [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "img"]]
  }, Rle = ys.default = dD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docCreditRole.js
var JE = p((gs) => {
  "use strict";
  Object.defineProperty(gs, "__esModule", {
    value: !0
  });
  gs.default = void 0;
  var fD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "credit [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Ole = gs.default = fD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docCreditsRole.js
var QE = p((vs) => {
  "use strict";
  Object.defineProperty(vs, "__esModule", {
    value: !0
  });
  vs.default = void 0;
  var pD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "credits [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Mle = vs.default = pD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docDedicationRole.js
var ZE = p((ws) => {
  "use strict";
  Object.defineProperty(ws, "__esModule", {
    value: !0
  });
  ws.default = void 0;
  var mD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "dedication [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Nle = ws.default = mD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docEndnoteRole.js
var eC = p((Es) => {
  "use strict";
  Object.defineProperty(Es, "__esModule", {
    value: !0
  });
  Es.default = void 0;
  var hD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "rearnote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: ["doc-endnotes"],
    requiredContextRole: ["doc-endnotes"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "listitem"]]
  }, jle = Es.default = hD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docEndnotesRole.js
var tC = p((Cs) => {
  "use strict";
  Object.defineProperty(Cs, "__esModule", {
    value: !0
  });
  Cs.default = void 0;
  var bD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "rearnotes [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["doc-endnote"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Lle = Cs.default = bD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docEpigraphRole.js
var rC = p((xs) => {
  "use strict";
  Object.defineProperty(xs, "__esModule", {
    value: !0
  });
  xs.default = void 0;
  var yD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "epigraph [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Ble = xs.default = yD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docEpilogueRole.js
var nC = p((_s) => {
  "use strict";
  Object.defineProperty(_s, "__esModule", {
    value: !0
  });
  _s.default = void 0;
  var gD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "epilogue [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Fle = _s.default = gD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docErrataRole.js
var oC = p((Ps) => {
  "use strict";
  Object.defineProperty(Ps, "__esModule", {
    value: !0
  });
  Ps.default = void 0;
  var vD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "errata [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Hle = Ps.default = vD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docExampleRole.js
var iC = p((qs) => {
  "use strict";
  Object.defineProperty(qs, "__esModule", {
    value: !0
  });
  qs.default = void 0;
  var wD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, zle = qs.default = wD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docFootnoteRole.js
var aC = p((Rs) => {
  "use strict";
  Object.defineProperty(Rs, "__esModule", {
    value: !0
  });
  Rs.default = void 0;
  var ED = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "footnote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Gle = Rs.default = ED;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docForewordRole.js
var sC = p((Ts) => {
  "use strict";
  Object.defineProperty(Ts, "__esModule", {
    value: !0
  });
  Ts.default = void 0;
  var CD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "foreword [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Yle = Ts.default = CD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docGlossaryRole.js
var lC = p((Os) => {
  "use strict";
  Object.defineProperty(Os, "__esModule", {
    value: !0
  });
  Os.default = void 0;
  var xD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "glossary [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["definition"], ["term"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Jle = Os.default = xD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docGlossrefRole.js
var uC = p((Ss) => {
  "use strict";
  Object.defineProperty(Ss, "__esModule", {
    value: !0
  });
  Ss.default = void 0;
  var _D = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "glossref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, Zle = Ss.default = _D;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docIndexRole.js
var cC = p((Ms) => {
  "use strict";
  Object.defineProperty(Ms, "__esModule", {
    value: !0
  });
  Ms.default = void 0;
  var PD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "index [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, tue = Ms.default = PD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docIntroductionRole.js
var dC = p((As) => {
  "use strict";
  Object.defineProperty(As, "__esModule", {
    value: !0
  });
  As.default = void 0;
  var qD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "introduction [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, nue = As.default = qD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docNoterefRole.js
var fC = p((Ns) => {
  "use strict";
  Object.defineProperty(Ns, "__esModule", {
    value: !0
  });
  Ns.default = void 0;
  var RD = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "noteref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, iue = Ns.default = RD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docNoticeRole.js
var pC = p((Is) => {
  "use strict";
  Object.defineProperty(Is, "__esModule", {
    value: !0
  });
  Is.default = void 0;
  var TD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "notice [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "note"]]
  }, sue = Is.default = TD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPagebreakRole.js
var mC = p((js) => {
  "use strict";
  Object.defineProperty(js, "__esModule", {
    value: !0
  });
  js.default = void 0;
  var OD = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "pagebreak [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "separator"]]
  }, uue = js.default = OD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPagefooterRole.js
var hC = p((ks) => {
  "use strict";
  Object.defineProperty(ks, "__esModule", {
    value: !0
  });
  ks.default = void 0;
  var SD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: [],
    props: {
      "aria-braillelabel": null,
      "aria-brailleroledescription": null,
      "aria-description": null,
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, due = ks.default = SD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPageheaderRole.js
var bC = p((Ls) => {
  "use strict";
  Object.defineProperty(Ls, "__esModule", {
    value: !0
  });
  Ls.default = void 0;
  var MD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: [],
    props: {
      "aria-braillelabel": null,
      "aria-brailleroledescription": null,
      "aria-description": null,
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, pue = Ls.default = MD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPagelistRole.js
var yC = p(($s) => {
  "use strict";
  Object.defineProperty($s, "__esModule", {
    value: !0
  });
  $s.default = void 0;
  var AD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "page-list [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, hue = $s.default = AD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPartRole.js
var gC = p((Bs) => {
  "use strict";
  Object.defineProperty(Bs, "__esModule", {
    value: !0
  });
  Bs.default = void 0;
  var ND = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "part [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, yue = Bs.default = ND;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPrefaceRole.js
var vC = p((Ds) => {
  "use strict";
  Object.defineProperty(Ds, "__esModule", {
    value: !0
  });
  Ds.default = void 0;
  var ID = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "preface [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, vue = Ds.default = ID;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPrologueRole.js
var wC = p((Fs) => {
  "use strict";
  Object.defineProperty(Fs, "__esModule", {
    value: !0
  });
  Fs.default = void 0;
  var jD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "prologue [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Eue = Fs.default = jD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docPullquoteRole.js
var EC = p((Us) => {
  "use strict";
  Object.defineProperty(Us, "__esModule", {
    value: !0
  });
  Us.default = void 0;
  var kD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "pullquote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["none"]]
  }, xue = Us.default = kD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docQnaRole.js
var CC = p((Hs) => {
  "use strict";
  Object.defineProperty(Hs, "__esModule", {
    value: !0
  });
  Hs.default = void 0;
  var LD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "qna [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, Pue = Hs.default = LD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docSubtitleRole.js
var xC = p((Vs) => {
  "use strict";
  Object.defineProperty(Vs, "__esModule", {
    value: !0
  });
  Vs.default = void 0;
  var $D = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "subtitle [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "sectionhead"]]
  }, Rue = Vs.default = $D;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docTipRole.js
var _C = p((zs) => {
  "use strict";
  Object.defineProperty(zs, "__esModule", {
    value: !0
  });
  zs.default = void 0;
  var BD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "help [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "note"]]
  }, Oue = zs.default = BD;
});

// ../node_modules/aria-query/lib/etc/roles/dpub/docTocRole.js
var PC = p((Ws) => {
  "use strict";
  Object.defineProperty(Ws, "__esModule", {
    value: !0
  });
  Ws.default = void 0;
  var DD = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "toc [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, Mue = Ws.default = DD;
});

// ../node_modules/aria-query/lib/etc/roles/ariaDpubRoles.js
var qC = p((Gs) => {
  "use strict";
  Object.defineProperty(Gs, "__esModule", {
    value: !0
  });
  Gs.default = void 0;
  var FD = X(BE()), UD = X(DE()), HD = X(FE()), VD = X(UE()), zD = X(HE()), WD = X(VE()), GD = X(zE()), KD = X(WE()), YD = X(GE()), XD = X(KE()),
  JD = X(YE()), QD = X(XE()), ZD = X(JE()), e2 = X(QE()), t2 = X(ZE()), r2 = X(eC()), n2 = X(tC()), o2 = X(rC()), i2 = X(nC()), a2 = X(oC()),
  s2 = X(iC()), l2 = X(aC()), u2 = X(sC()), c2 = X(lC()), d2 = X(uC()), f2 = X(cC()), p2 = X(dC()), m2 = X(fC()), h2 = X(pC()), b2 = X(mC()),
  y2 = X(hC()), g2 = X(bC()), v2 = X(yC()), w2 = X(gC()), E2 = X(vC()), C2 = X(wC()), x2 = X(EC()), _2 = X(CC()), P2 = X(xC()), q2 = X(_C()),
  R2 = X(PC());
  function X(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(X, "_interopRequireDefault");
  var T2 = [["doc-abstract", FD.default], ["doc-acknowledgments", UD.default], ["doc-afterword", HD.default], ["doc-appendix", VD.default], [
  "doc-backlink", zD.default], ["doc-biblioentry", WD.default], ["doc-bibliography", GD.default], ["doc-biblioref", KD.default], ["doc-chapt\
er", YD.default], ["doc-colophon", XD.default], ["doc-conclusion", JD.default], ["doc-cover", QD.default], ["doc-credit", ZD.default], ["doc\
-credits", e2.default], ["doc-dedication", t2.default], ["doc-endnote", r2.default], ["doc-endnotes", n2.default], ["doc-epigraph", o2.default],
  ["doc-epilogue", i2.default], ["doc-errata", a2.default], ["doc-example", s2.default], ["doc-footnote", l2.default], ["doc-foreword", u2.default],
  ["doc-glossary", c2.default], ["doc-glossref", d2.default], ["doc-index", f2.default], ["doc-introduction", p2.default], ["doc-noteref", m2.
  default], ["doc-notice", h2.default], ["doc-pagebreak", b2.default], ["doc-pagefooter", y2.default], ["doc-pageheader", g2.default], ["doc\
-pagelist", v2.default], ["doc-part", w2.default], ["doc-preface", E2.default], ["doc-prologue", C2.default], ["doc-pullquote", x2.default],
  ["doc-qna", _2.default], ["doc-subtitle", P2.default], ["doc-tip", q2.default], ["doc-toc", R2.default]], Nue = Gs.default = T2;
});

// ../node_modules/aria-query/lib/etc/roles/graphics/graphicsDocumentRole.js
var RC = p((Ks) => {
  "use strict";
  Object.defineProperty(Ks, "__esModule", {
    value: !0
  });
  Ks.default = void 0;
  var O2 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      module: "GRAPHICS",
      concept: {
        name: "graphics-object"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "img"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "article"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "document"]]
  }, kue = Ks.default = O2;
});

// ../node_modules/aria-query/lib/etc/roles/graphics/graphicsObjectRole.js
var TC = p((Ys) => {
  "use strict";
  Object.defineProperty(Ys, "__esModule", {
    value: !0
  });
  Ys.default = void 0;
  var S2 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      module: "GRAPHICS",
      concept: {
        name: "graphics-document"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "group"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "img"
      }
    }, {
      module: "GRAPHICS",
      concept: {
        name: "graphics-symbol"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"]]
  }, $ue = Ys.default = S2;
});

// ../node_modules/aria-query/lib/etc/roles/graphics/graphicsSymbolRole.js
var OC = p((Xs) => {
  "use strict";
  Object.defineProperty(Xs, "__esModule", {
    value: !0
  });
  Xs.default = void 0;
  var M2 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "img"]]
  }, Due = Xs.default = M2;
});

// ../node_modules/aria-query/lib/etc/roles/ariaGraphicsRoles.js
var SC = p((Js) => {
  "use strict";
  Object.defineProperty(Js, "__esModule", {
    value: !0
  });
  Js.default = void 0;
  var A2 = dm(RC()), N2 = dm(TC()), I2 = dm(OC());
  function dm(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(dm, "_interopRequireDefault");
  var j2 = [["graphics-document", A2.default], ["graphics-object", N2.default], ["graphics-symbol", I2.default]], Uue = Js.default = j2;
});

// ../node_modules/aria-query/lib/rolesMap.js
var Zs = p((Qs) => {
  "use strict";
  Object.defineProperty(Qs, "__esModule", {
    value: !0
  });
  Qs.default = void 0;
  var k2 = Un(lw()), L2 = Un($E()), $2 = Un(qC()), B2 = Un(SC()), D2 = Un(Hr());
  function Un(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Un, "_interopRequireDefault");
  function fm(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = AC(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a, s = !0, l = !1;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return s = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      l = !0, a = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        s || r.return == null || r.return();
      } finally {
        if (l) throw a;
      }
    }, "f") };
  }
  o(fm, "_createForOfIteratorHelper");
  function Fn(e, t) {
    return H2(e) || U2(e, t) || AC(e, t) || F2();
  }
  o(Fn, "_slicedToArray");
  function F2() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(F2, "_nonIterableRest");
  function AC(e, t) {
    if (e) {
      if (typeof e == "string") return MC(e, t);
      var r = {}.toString.call(e).slice(8, -1);
      return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
      test(r) ? MC(e, t) : void 0;
    }
  }
  o(AC, "_unsupportedIterableToArray");
  function MC(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  o(MC, "_arrayLikeToArray");
  function U2(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n, i, a, s, l = [], c = !0, u = !1;
      try {
        if (a = (r = r.call(e)).next, t === 0) {
          if (Object(r) !== r) return;
          c = !1;
        } else for (; !(c = (n = a.call(r)).done) && (l.push(n.value), l.length !== t); c = !0) ;
      } catch (d) {
        u = !0, i = d;
      } finally {
        try {
          if (!c && r.return != null && (s = r.return(), Object(s) !== s)) return;
        } finally {
          if (u) throw i;
        }
      }
      return l;
    }
  }
  o(U2, "_iterableToArrayLimit");
  function H2(e) {
    if (Array.isArray(e)) return e;
  }
  o(H2, "_arrayWithHoles");
  var $t = [].concat(k2.default, L2.default, $2.default, B2.default);
  $t.forEach(function(e) {
    var t = Fn(e, 2), r = t[1], n = fm(r.superClass), i;
    try {
      for (n.s(); !(i = n.n()).done; ) {
        var a = i.value, s = fm(a), l;
        try {
          var c = /* @__PURE__ */ o(function() {
            var d = l.value, f = $t.filter(function(x) {
              var b = Fn(x, 1), E = b[0];
              return E === d;
            })[0];
            if (f)
              for (var h = f[1], m = 0, y = Object.keys(h.props); m < y.length; m++) {
                var g = y[m];
                Object.prototype.hasOwnProperty.call(r.props, g) || (r.props[g] = h.props[g]);
              }
          }, "_loop");
          for (s.s(); !(l = s.n()).done; )
            c();
        } catch (u) {
          s.e(u);
        } finally {
          s.f();
        }
      }
    } catch (u) {
      n.e(u);
    } finally {
      n.f();
    }
  });
  var pm = {
    entries: /* @__PURE__ */ o(function() {
      return $t;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = fm($t), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = Fn(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, $t);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = $t.filter(function(n) {
        return n[0] === t;
      })[0];
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!pm.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return $t.map(function(t) {
        var r = Fn(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return $t.map(function(t) {
        var r = Fn(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, zue = Qs.default = (0, D2.default)(pm, pm.entries());
});

// ../node_modules/aria-query/lib/elementRoleMap.js
var BC = p((ol) => {
  "use strict";
  Object.defineProperty(ol, "__esModule", {
    value: !0
  });
  ol.default = void 0;
  var V2 = LC(Hr()), kC = LC(Zs());
  function LC(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(LC, "_interopRequireDefault");
  function mm(e, t) {
    return K2(e) || G2(e, t) || W2(e, t) || z2();
  }
  o(mm, "_slicedToArray");
  function z2() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(z2, "_nonIterableRest");
  function W2(e, t) {
    if (e) {
      if (typeof e == "string") return NC(e, t);
      var r = {}.toString.call(e).slice(8, -1);
      return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
      test(r) ? NC(e, t) : void 0;
    }
  }
  o(W2, "_unsupportedIterableToArray");
  function NC(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  o(NC, "_arrayLikeToArray");
  function G2(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n, i, a, s, l = [], c = !0, u = !1;
      try {
        if (a = (r = r.call(e)).next, t === 0) {
          if (Object(r) !== r) return;
          c = !1;
        } else for (; !(c = (n = a.call(r)).done) && (l.push(n.value), l.length !== t); c = !0) ;
      } catch (d) {
        u = !0, i = d;
      } finally {
        try {
          if (!c && r.return != null && (s = r.return(), Object(s) !== s)) return;
        } finally {
          if (u) throw i;
        }
      }
      return l;
    }
  }
  o(G2, "_iterableToArrayLimit");
  function K2(e) {
    if (Array.isArray(e)) return e;
  }
  o(K2, "_arrayWithHoles");
  var Bt = [], IC = kC.default.keys();
  for (el = 0; el < IC.length; el++)
    if (tl = IC[el], rl = kC.default.get(tl), rl)
      for (hm = [].concat(rl.baseConcepts, rl.relatedConcepts), jC = /* @__PURE__ */ o(function() {
        var t = hm[nl];
        if (t.module === "HTML") {
          var r = t.concept;
          if (r) {
            var n = Bt.filter(function(l) {
              return Y2(l[0], r);
            })[0], i;
            n ? i = n[1] : i = [];
            for (var a = !0, s = 0; s < i.length; s++)
              if (i[s] === tl) {
                a = !1;
                break;
              }
            a && i.push(tl), n || Bt.push([r, i]);
          }
        }
      }, "_loop"), nl = 0; nl < hm.length; nl++)
        jC();
  var tl, rl, hm, jC, nl, el, bm = {
    entries: /* @__PURE__ */ o(function() {
      return Bt;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      for (var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = Bt; n < i.length; n++) {
        var a = mm(i[n], 2), s = a[0], l = a[1];
        t.call(r, l, s, Bt);
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = Bt.filter(function(n) {
        return t.name === n[0].name && $C(t.attributes, n[0].attributes);
      })[0];
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!bm.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return Bt.map(function(t) {
        var r = mm(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return Bt.map(function(t) {
        var r = mm(t, 2), n = r[1];
        return n;
      });
    }, "values")
  };
  function Y2(e, t) {
    return e.name === t.name && X2(e.constraints, t.constraints) && $C(e.attributes, t.attributes);
  }
  o(Y2, "ariaRoleRelationConceptEquals");
  function X2(e, t) {
    if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0)
      return !1;
    if (e !== void 0 && t !== void 0) {
      if (e.length !== t.length)
        return !1;
      for (var r = 0; r < e.length; r++)
        if (e[r] !== t[r])
          return !1;
    }
    return !0;
  }
  o(X2, "ariaRoleRelationConstraintsEquals");
  function $C(e, t) {
    if (e === void 0 && t !== void 0 || e !== void 0 && t === void 0)
      return !1;
    if (e !== void 0 && t !== void 0) {
      if (e.length !== t.length)
        return !1;
      for (var r = 0; r < e.length; r++) {
        if (e[r].name !== t[r].name || e[r].value !== t[r].value || e[r].constraints === void 0 && t[r].constraints !== void 0 || e[r].constraints !==
        void 0 && t[r].constraints === void 0)
          return !1;
        if (e[r].constraints !== void 0 && t[r].constraints !== void 0) {
          if (e[r].constraints.length !== t[r].constraints.length)
            return !1;
          for (var n = 0; n < e[r].constraints.length; n++)
            if (e[r].constraints[n] !== t[r].constraints[n])
              return !1;
        }
      }
    }
    return !0;
  }
  o($C, "ariaRoleRelationConceptAttributeEquals");
  var Kue = ol.default = (0, V2.default)(bm, bm.entries());
});

// ../node_modules/aria-query/lib/roleElementMap.js
var VC = p((ul) => {
  "use strict";
  Object.defineProperty(ul, "__esModule", {
    value: !0
  });
  ul.default = void 0;
  var J2 = HC(Hr()), UC = HC(Zs());
  function HC(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(HC, "_interopRequireDefault");
  function ym(e, t) {
    return tF(e) || eF(e, t) || Z2(e, t) || Q2();
  }
  o(ym, "_slicedToArray");
  function Q2() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(Q2, "_nonIterableRest");
  function Z2(e, t) {
    if (e) {
      if (typeof e == "string") return DC(e, t);
      var r = {}.toString.call(e).slice(8, -1);
      return r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set" ? Array.from(e) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.
      test(r) ? DC(e, t) : void 0;
    }
  }
  o(Z2, "_unsupportedIterableToArray");
  function DC(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = Array(t); r < t; r++) n[r] = e[r];
    return n;
  }
  o(DC, "_arrayLikeToArray");
  function eF(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n, i, a, s, l = [], c = !0, u = !1;
      try {
        if (a = (r = r.call(e)).next, t === 0) {
          if (Object(r) !== r) return;
          c = !1;
        } else for (; !(c = (n = a.call(r)).done) && (l.push(n.value), l.length !== t); c = !0) ;
      } catch (d) {
        u = !0, i = d;
      } finally {
        try {
          if (!c && r.return != null && (s = r.return(), Object(s) !== s)) return;
        } finally {
          if (u) throw i;
        }
      }
      return l;
    }
  }
  o(eF, "_iterableToArrayLimit");
  function tF(e) {
    if (Array.isArray(e)) return e;
  }
  o(tF, "_arrayWithHoles");
  var mr = [], FC = UC.default.keys();
  for (il = 0; il < FC.length; il++)
    if (gm = FC[il], al = UC.default.get(gm), sl = [], al) {
      for (vm = [].concat(al.baseConcepts, al.relatedConcepts), ll = 0; ll < vm.length; ll++)
        wm = vm[ll], wm.module === "HTML" && (Em = wm.concept, Em != null && sl.push(Em));
      sl.length > 0 && mr.push([gm, sl]);
    }
  var gm, al, sl, vm, wm, Em, ll, il, Cm = {
    entries: /* @__PURE__ */ o(function() {
      return mr;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      for (var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = 0, i = mr; n < i.length; n++) {
        var a = ym(i[n], 2), s = a[0], l = a[1];
        t.call(r, l, s, mr);
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = mr.filter(function(n) {
        return n[0] === t;
      })[0];
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!Cm.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return mr.map(function(t) {
        var r = ym(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return mr.map(function(t) {
        var r = ym(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, Jue = ul.default = (0, J2.default)(Cm, Cm.entries());
});

// ../node_modules/aria-query/lib/index.js
var xm = p((et) => {
  "use strict";
  Object.defineProperty(et, "__esModule", {
    value: !0
  });
  et.roles = et.roleElements = et.elementRoles = et.dom = et.aria = void 0;
  var rF = Hn(Gv()), nF = Hn(Yv()), oF = Hn(Zs()), iF = Hn(BC()), aF = Hn(VC());
  function Hn(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Hn, "_interopRequireDefault");
  var ece = et.aria = rF.default, tce = et.dom = nF.default, rce = et.roles = oF.default, nce = et.elementRoles = iF.default, oce = et.roleElements =
  aF.default;
});

// ../node_modules/color-name/index.js
var WC = p((sce, zC) => {
  "use strict";
  zC.exports = {
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    grey: [128, 128, 128],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50]
  };
});

// ../node_modules/color-convert/conversions.js
var _m = p((lce, KC) => {
  var Vn = WC(), GC = {};
  for (let e of Object.keys(Vn))
    GC[Vn[e]] = e;
  var D = {
    rgb: { channels: 3, labels: "rgb" },
    hsl: { channels: 3, labels: "hsl" },
    hsv: { channels: 3, labels: "hsv" },
    hwb: { channels: 3, labels: "hwb" },
    cmyk: { channels: 4, labels: "cmyk" },
    xyz: { channels: 3, labels: "xyz" },
    lab: { channels: 3, labels: "lab" },
    lch: { channels: 3, labels: "lch" },
    hex: { channels: 1, labels: ["hex"] },
    keyword: { channels: 1, labels: ["keyword"] },
    ansi16: { channels: 1, labels: ["ansi16"] },
    ansi256: { channels: 1, labels: ["ansi256"] },
    hcg: { channels: 3, labels: ["h", "c", "g"] },
    apple: { channels: 3, labels: ["r16", "g16", "b16"] },
    gray: { channels: 1, labels: ["gray"] }
  };
  KC.exports = D;
  for (let e of Object.keys(D)) {
    if (!("channels" in D[e]))
      throw new Error("missing channels property: " + e);
    if (!("labels" in D[e]))
      throw new Error("missing channel labels property: " + e);
    if (D[e].labels.length !== D[e].channels)
      throw new Error("channel and label counts mismatch: " + e);
    let { channels: t, labels: r } = D[e];
    delete D[e].channels, delete D[e].labels, Object.defineProperty(D[e], "channels", { value: t }), Object.defineProperty(D[e], "labels", {
    value: r });
  }
  D.rgb.hsl = function(e) {
    let t = e[0] / 255, r = e[1] / 255, n = e[2] / 255, i = Math.min(t, r, n), a = Math.max(t, r, n), s = a - i, l, c;
    a === i ? l = 0 : t === a ? l = (r - n) / s : r === a ? l = 2 + (n - t) / s : n === a && (l = 4 + (t - r) / s), l = Math.min(l * 60, 360),
    l < 0 && (l += 360);
    let u = (i + a) / 2;
    return a === i ? c = 0 : u <= 0.5 ? c = s / (a + i) : c = s / (2 - a - i), [l, c * 100, u * 100];
  };
  D.rgb.hsv = function(e) {
    let t, r, n, i, a, s = e[0] / 255, l = e[1] / 255, c = e[2] / 255, u = Math.max(s, l, c), d = u - Math.min(s, l, c), f = /* @__PURE__ */ o(
    function(h) {
      return (u - h) / 6 / d + 1 / 2;
    }, "diffc");
    return d === 0 ? (i = 0, a = 0) : (a = d / u, t = f(s), r = f(l), n = f(c), s === u ? i = n - r : l === u ? i = 1 / 3 + t - n : c === u &&
    (i = 2 / 3 + r - t), i < 0 ? i += 1 : i > 1 && (i -= 1)), [
      i * 360,
      a * 100,
      u * 100
    ];
  };
  D.rgb.hwb = function(e) {
    let t = e[0], r = e[1], n = e[2], i = D.rgb.hsl(e)[0], a = 1 / 255 * Math.min(t, Math.min(r, n));
    return n = 1 - 1 / 255 * Math.max(t, Math.max(r, n)), [i, a * 100, n * 100];
  };
  D.rgb.cmyk = function(e) {
    let t = e[0] / 255, r = e[1] / 255, n = e[2] / 255, i = Math.min(1 - t, 1 - r, 1 - n), a = (1 - t - i) / (1 - i) || 0, s = (1 - r - i) /
    (1 - i) || 0, l = (1 - n - i) / (1 - i) || 0;
    return [a * 100, s * 100, l * 100, i * 100];
  };
  function sF(e, t) {
    return (e[0] - t[0]) ** 2 + (e[1] - t[1]) ** 2 + (e[2] - t[2]) ** 2;
  }
  o(sF, "comparativeDistance");
  D.rgb.keyword = function(e) {
    let t = GC[e];
    if (t)
      return t;
    let r = 1 / 0, n;
    for (let i of Object.keys(Vn)) {
      let a = Vn[i], s = sF(e, a);
      s < r && (r = s, n = i);
    }
    return n;
  };
  D.keyword.rgb = function(e) {
    return Vn[e];
  };
  D.rgb.xyz = function(e) {
    let t = e[0] / 255, r = e[1] / 255, n = e[2] / 255;
    t = t > 0.04045 ? ((t + 0.055) / 1.055) ** 2.4 : t / 12.92, r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92, n = n > 0.04045 ?
    ((n + 0.055) / 1.055) ** 2.4 : n / 12.92;
    let i = t * 0.4124 + r * 0.3576 + n * 0.1805, a = t * 0.2126 + r * 0.7152 + n * 0.0722, s = t * 0.0193 + r * 0.1192 + n * 0.9505;
    return [i * 100, a * 100, s * 100];
  };
  D.rgb.lab = function(e) {
    let t = D.rgb.xyz(e), r = t[0], n = t[1], i = t[2];
    r /= 95.047, n /= 100, i /= 108.883, r = r > 8856e-6 ? r ** (1 / 3) : 7.787 * r + 16 / 116, n = n > 8856e-6 ? n ** (1 / 3) : 7.787 * n +
    16 / 116, i = i > 8856e-6 ? i ** (1 / 3) : 7.787 * i + 16 / 116;
    let a = 116 * n - 16, s = 500 * (r - n), l = 200 * (n - i);
    return [a, s, l];
  };
  D.hsl.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, n = e[2] / 100, i, a, s;
    if (r === 0)
      return s = n * 255, [s, s, s];
    n < 0.5 ? i = n * (1 + r) : i = n + r - n * r;
    let l = 2 * n - i, c = [0, 0, 0];
    for (let u = 0; u < 3; u++)
      a = t + 1 / 3 * -(u - 1), a < 0 && a++, a > 1 && a--, 6 * a < 1 ? s = l + (i - l) * 6 * a : 2 * a < 1 ? s = i : 3 * a < 2 ? s = l + (i -
      l) * (2 / 3 - a) * 6 : s = l, c[u] = s * 255;
    return c;
  };
  D.hsl.hsv = function(e) {
    let t = e[0], r = e[1] / 100, n = e[2] / 100, i = r, a = Math.max(n, 0.01);
    n *= 2, r *= n <= 1 ? n : 2 - n, i *= a <= 1 ? a : 2 - a;
    let s = (n + r) / 2, l = n === 0 ? 2 * i / (a + i) : 2 * r / (n + r);
    return [t, l * 100, s * 100];
  };
  D.hsv.rgb = function(e) {
    let t = e[0] / 60, r = e[1] / 100, n = e[2] / 100, i = Math.floor(t) % 6, a = t - Math.floor(t), s = 255 * n * (1 - r), l = 255 * n * (1 -
    r * a), c = 255 * n * (1 - r * (1 - a));
    switch (n *= 255, i) {
      case 0:
        return [n, c, s];
      case 1:
        return [l, n, s];
      case 2:
        return [s, n, c];
      case 3:
        return [s, l, n];
      case 4:
        return [c, s, n];
      case 5:
        return [n, s, l];
    }
  };
  D.hsv.hsl = function(e) {
    let t = e[0], r = e[1] / 100, n = e[2] / 100, i = Math.max(n, 0.01), a, s;
    s = (2 - r) * n;
    let l = (2 - r) * i;
    return a = r * i, a /= l <= 1 ? l : 2 - l, a = a || 0, s /= 2, [t, a * 100, s * 100];
  };
  D.hwb.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, n = e[2] / 100, i = r + n, a;
    i > 1 && (r /= i, n /= i);
    let s = Math.floor(6 * t), l = 1 - n;
    a = 6 * t - s, (s & 1) !== 0 && (a = 1 - a);
    let c = r + a * (l - r), u, d, f;
    switch (s) {
      default:
      case 6:
      case 0:
        u = l, d = c, f = r;
        break;
      case 1:
        u = c, d = l, f = r;
        break;
      case 2:
        u = r, d = l, f = c;
        break;
      case 3:
        u = r, d = c, f = l;
        break;
      case 4:
        u = c, d = r, f = l;
        break;
      case 5:
        u = l, d = r, f = c;
        break;
    }
    return [u * 255, d * 255, f * 255];
  };
  D.cmyk.rgb = function(e) {
    let t = e[0] / 100, r = e[1] / 100, n = e[2] / 100, i = e[3] / 100, a = 1 - Math.min(1, t * (1 - i) + i), s = 1 - Math.min(1, r * (1 - i) +
    i), l = 1 - Math.min(1, n * (1 - i) + i);
    return [a * 255, s * 255, l * 255];
  };
  D.xyz.rgb = function(e) {
    let t = e[0] / 100, r = e[1] / 100, n = e[2] / 100, i, a, s;
    return i = t * 3.2406 + r * -1.5372 + n * -0.4986, a = t * -0.9689 + r * 1.8758 + n * 0.0415, s = t * 0.0557 + r * -0.204 + n * 1.057, i =
    i > 31308e-7 ? 1.055 * i ** (1 / 2.4) - 0.055 : i * 12.92, a = a > 31308e-7 ? 1.055 * a ** (1 / 2.4) - 0.055 : a * 12.92, s = s > 31308e-7 ?
    1.055 * s ** (1 / 2.4) - 0.055 : s * 12.92, i = Math.min(Math.max(0, i), 1), a = Math.min(Math.max(0, a), 1), s = Math.min(Math.max(0, s),
    1), [i * 255, a * 255, s * 255];
  };
  D.xyz.lab = function(e) {
    let t = e[0], r = e[1], n = e[2];
    t /= 95.047, r /= 100, n /= 108.883, t = t > 8856e-6 ? t ** (1 / 3) : 7.787 * t + 16 / 116, r = r > 8856e-6 ? r ** (1 / 3) : 7.787 * r +
    16 / 116, n = n > 8856e-6 ? n ** (1 / 3) : 7.787 * n + 16 / 116;
    let i = 116 * r - 16, a = 500 * (t - r), s = 200 * (r - n);
    return [i, a, s];
  };
  D.lab.xyz = function(e) {
    let t = e[0], r = e[1], n = e[2], i, a, s;
    a = (t + 16) / 116, i = r / 500 + a, s = a - n / 200;
    let l = a ** 3, c = i ** 3, u = s ** 3;
    return a = l > 8856e-6 ? l : (a - 16 / 116) / 7.787, i = c > 8856e-6 ? c : (i - 16 / 116) / 7.787, s = u > 8856e-6 ? u : (s - 16 / 116) /
    7.787, i *= 95.047, a *= 100, s *= 108.883, [i, a, s];
  };
  D.lab.lch = function(e) {
    let t = e[0], r = e[1], n = e[2], i;
    i = Math.atan2(n, r) * 360 / 2 / Math.PI, i < 0 && (i += 360);
    let s = Math.sqrt(r * r + n * n);
    return [t, s, i];
  };
  D.lch.lab = function(e) {
    let t = e[0], r = e[1], i = e[2] / 360 * 2 * Math.PI, a = r * Math.cos(i), s = r * Math.sin(i);
    return [t, a, s];
  };
  D.rgb.ansi16 = function(e, t = null) {
    let [r, n, i] = e, a = t === null ? D.rgb.hsv(e)[2] : t;
    if (a = Math.round(a / 50), a === 0)
      return 30;
    let s = 30 + (Math.round(i / 255) << 2 | Math.round(n / 255) << 1 | Math.round(r / 255));
    return a === 2 && (s += 60), s;
  };
  D.hsv.ansi16 = function(e) {
    return D.rgb.ansi16(D.hsv.rgb(e), e[2]);
  };
  D.rgb.ansi256 = function(e) {
    let t = e[0], r = e[1], n = e[2];
    return t === r && r === n ? t < 8 ? 16 : t > 248 ? 231 : Math.round((t - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(t / 255 * 5) + 6 * Math.
    round(r / 255 * 5) + Math.round(n / 255 * 5);
  };
  D.ansi16.rgb = function(e) {
    let t = e % 10;
    if (t === 0 || t === 7)
      return e > 50 && (t += 3.5), t = t / 10.5 * 255, [t, t, t];
    let r = (~~(e > 50) + 1) * 0.5, n = (t & 1) * r * 255, i = (t >> 1 & 1) * r * 255, a = (t >> 2 & 1) * r * 255;
    return [n, i, a];
  };
  D.ansi256.rgb = function(e) {
    if (e >= 232) {
      let a = (e - 232) * 10 + 8;
      return [a, a, a];
    }
    e -= 16;
    let t, r = Math.floor(e / 36) / 5 * 255, n = Math.floor((t = e % 36) / 6) / 5 * 255, i = t % 6 / 5 * 255;
    return [r, n, i];
  };
  D.rgb.hex = function(e) {
    let r = (((Math.round(e[0]) & 255) << 16) + ((Math.round(e[1]) & 255) << 8) + (Math.round(e[2]) & 255)).toString(16).toUpperCase();
    return "000000".substring(r.length) + r;
  };
  D.hex.rgb = function(e) {
    let t = e.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
    if (!t)
      return [0, 0, 0];
    let r = t[0];
    t[0].length === 3 && (r = r.split("").map((l) => l + l).join(""));
    let n = parseInt(r, 16), i = n >> 16 & 255, a = n >> 8 & 255, s = n & 255;
    return [i, a, s];
  };
  D.rgb.hcg = function(e) {
    let t = e[0] / 255, r = e[1] / 255, n = e[2] / 255, i = Math.max(Math.max(t, r), n), a = Math.min(Math.min(t, r), n), s = i - a, l, c;
    return s < 1 ? l = a / (1 - s) : l = 0, s <= 0 ? c = 0 : i === t ? c = (r - n) / s % 6 : i === r ? c = 2 + (n - t) / s : c = 4 + (t - r) /
    s, c /= 6, c %= 1, [c * 360, s * 100, l * 100];
  };
  D.hsl.hcg = function(e) {
    let t = e[1] / 100, r = e[2] / 100, n = r < 0.5 ? 2 * t * r : 2 * t * (1 - r), i = 0;
    return n < 1 && (i = (r - 0.5 * n) / (1 - n)), [e[0], n * 100, i * 100];
  };
  D.hsv.hcg = function(e) {
    let t = e[1] / 100, r = e[2] / 100, n = t * r, i = 0;
    return n < 1 && (i = (r - n) / (1 - n)), [e[0], n * 100, i * 100];
  };
  D.hcg.rgb = function(e) {
    let t = e[0] / 360, r = e[1] / 100, n = e[2] / 100;
    if (r === 0)
      return [n * 255, n * 255, n * 255];
    let i = [0, 0, 0], a = t % 1 * 6, s = a % 1, l = 1 - s, c = 0;
    switch (Math.floor(a)) {
      case 0:
        i[0] = 1, i[1] = s, i[2] = 0;
        break;
      case 1:
        i[0] = l, i[1] = 1, i[2] = 0;
        break;
      case 2:
        i[0] = 0, i[1] = 1, i[2] = s;
        break;
      case 3:
        i[0] = 0, i[1] = l, i[2] = 1;
        break;
      case 4:
        i[0] = s, i[1] = 0, i[2] = 1;
        break;
      default:
        i[0] = 1, i[1] = 0, i[2] = l;
    }
    return c = (1 - r) * n, [
      (r * i[0] + c) * 255,
      (r * i[1] + c) * 255,
      (r * i[2] + c) * 255
    ];
  };
  D.hcg.hsv = function(e) {
    let t = e[1] / 100, r = e[2] / 100, n = t + r * (1 - t), i = 0;
    return n > 0 && (i = t / n), [e[0], i * 100, n * 100];
  };
  D.hcg.hsl = function(e) {
    let t = e[1] / 100, n = e[2] / 100 * (1 - t) + 0.5 * t, i = 0;
    return n > 0 && n < 0.5 ? i = t / (2 * n) : n >= 0.5 && n < 1 && (i = t / (2 * (1 - n))), [e[0], i * 100, n * 100];
  };
  D.hcg.hwb = function(e) {
    let t = e[1] / 100, r = e[2] / 100, n = t + r * (1 - t);
    return [e[0], (n - t) * 100, (1 - n) * 100];
  };
  D.hwb.hcg = function(e) {
    let t = e[1] / 100, n = 1 - e[2] / 100, i = n - t, a = 0;
    return i < 1 && (a = (n - i) / (1 - i)), [e[0], i * 100, a * 100];
  };
  D.apple.rgb = function(e) {
    return [e[0] / 65535 * 255, e[1] / 65535 * 255, e[2] / 65535 * 255];
  };
  D.rgb.apple = function(e) {
    return [e[0] / 255 * 65535, e[1] / 255 * 65535, e[2] / 255 * 65535];
  };
  D.gray.rgb = function(e) {
    return [e[0] / 100 * 255, e[0] / 100 * 255, e[0] / 100 * 255];
  };
  D.gray.hsl = function(e) {
    return [0, 0, e[0]];
  };
  D.gray.hsv = D.gray.hsl;
  D.gray.hwb = function(e) {
    return [0, 100, e[0]];
  };
  D.gray.cmyk = function(e) {
    return [0, 0, 0, e[0]];
  };
  D.gray.lab = function(e) {
    return [e[0], 0, 0];
  };
  D.gray.hex = function(e) {
    let t = Math.round(e[0] / 100 * 255) & 255, n = ((t << 16) + (t << 8) + t).toString(16).toUpperCase();
    return "000000".substring(n.length) + n;
  };
  D.rgb.gray = function(e) {
    return [(e[0] + e[1] + e[2]) / 3 / 255 * 100];
  };
});

// ../node_modules/color-convert/route.js
var XC = p((cce, YC) => {
  var cl = _m();
  function lF() {
    let e = {}, t = Object.keys(cl);
    for (let r = t.length, n = 0; n < r; n++)
      e[t[n]] = {
        // http://jsperf.com/1-vs-infinity
        // micro-opt, but this is simple.
        distance: -1,
        parent: null
      };
    return e;
  }
  o(lF, "buildGraph");
  function uF(e) {
    let t = lF(), r = [e];
    for (t[e].distance = 0; r.length; ) {
      let n = r.pop(), i = Object.keys(cl[n]);
      for (let a = i.length, s = 0; s < a; s++) {
        let l = i[s], c = t[l];
        c.distance === -1 && (c.distance = t[n].distance + 1, c.parent = n, r.unshift(l));
      }
    }
    return t;
  }
  o(uF, "deriveBFS");
  function cF(e, t) {
    return function(r) {
      return t(e(r));
    };
  }
  o(cF, "link");
  function dF(e, t) {
    let r = [t[e].parent, e], n = cl[t[e].parent][e], i = t[e].parent;
    for (; t[i].parent; )
      r.unshift(t[i].parent), n = cF(cl[t[i].parent][i], n), i = t[i].parent;
    return n.conversion = r, n;
  }
  o(dF, "wrapConversion");
  YC.exports = function(e) {
    let t = uF(e), r = {}, n = Object.keys(t);
    for (let i = n.length, a = 0; a < i; a++) {
      let s = n[a];
      t[s].parent !== null && (r[s] = dF(s, t));
    }
    return r;
  };
});

// ../node_modules/color-convert/index.js
var QC = p((fce, JC) => {
  var Pm = _m(), fF = XC(), Wr = {}, pF = Object.keys(Pm);
  function mF(e) {
    let t = /* @__PURE__ */ o(function(...r) {
      let n = r[0];
      return n == null ? n : (n.length > 1 && (r = n), e(r));
    }, "wrappedFn");
    return "conversion" in e && (t.conversion = e.conversion), t;
  }
  o(mF, "wrapRaw");
  function hF(e) {
    let t = /* @__PURE__ */ o(function(...r) {
      let n = r[0];
      if (n == null)
        return n;
      n.length > 1 && (r = n);
      let i = e(r);
      if (typeof i == "object")
        for (let a = i.length, s = 0; s < a; s++)
          i[s] = Math.round(i[s]);
      return i;
    }, "wrappedFn");
    return "conversion" in e && (t.conversion = e.conversion), t;
  }
  o(hF, "wrapRounded");
  pF.forEach((e) => {
    Wr[e] = {}, Object.defineProperty(Wr[e], "channels", { value: Pm[e].channels }), Object.defineProperty(Wr[e], "labels", { value: Pm[e].labels });
    let t = fF(e);
    Object.keys(t).forEach((n) => {
      let i = t[n];
      Wr[e][n] = hF(i), Wr[e][n].raw = mF(i);
    });
  });
  JC.exports = Wr;
});

// ../node_modules/ansi-styles/index.js
var ox = p((mce, nx) => {
  "use strict";
  var ZC = /* @__PURE__ */ o((e, t) => (...r) => `\x1B[${e(...r) + t}m`, "wrapAnsi16"), ex = /* @__PURE__ */ o((e, t) => (...r) => {
    let n = e(...r);
    return `\x1B[${38 + t};5;${n}m`;
  }, "wrapAnsi256"), tx = /* @__PURE__ */ o((e, t) => (...r) => {
    let n = e(...r);
    return `\x1B[${38 + t};2;${n[0]};${n[1]};${n[2]}m`;
  }, "wrapAnsi16m"), dl = /* @__PURE__ */ o((e) => e, "ansi2ansi"), rx = /* @__PURE__ */ o((e, t, r) => [e, t, r], "rgb2rgb"), Gr = /* @__PURE__ */ o(
  (e, t, r) => {
    Object.defineProperty(e, t, {
      get: /* @__PURE__ */ o(() => {
        let n = r();
        return Object.defineProperty(e, t, {
          value: n,
          enumerable: !0,
          configurable: !0
        }), n;
      }, "get"),
      enumerable: !0,
      configurable: !0
    });
  }, "setLazyProperty"), qm, Kr = /* @__PURE__ */ o((e, t, r, n) => {
    qm === void 0 && (qm = QC());
    let i = n ? 10 : 0, a = {};
    for (let [s, l] of Object.entries(qm)) {
      let c = s === "ansi16" ? "ansi" : s;
      s === t ? a[c] = e(r, i) : typeof l == "object" && (a[c] = e(l[t], i));
    }
    return a;
  }, "makeDynamicStyles");
  function bF() {
    let e = /* @__PURE__ */ new Map(), t = {
      modifier: {
        reset: [0, 0],
        // 21 isn't widely supported and 22 does the same thing
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29]
      },
      color: {
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],
        // Bright color
        blackBright: [90, 39],
        redBright: [91, 39],
        greenBright: [92, 39],
        yellowBright: [93, 39],
        blueBright: [94, 39],
        magentaBright: [95, 39],
        cyanBright: [96, 39],
        whiteBright: [97, 39]
      },
      bgColor: {
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49],
        // Bright color
        bgBlackBright: [100, 49],
        bgRedBright: [101, 49],
        bgGreenBright: [102, 49],
        bgYellowBright: [103, 49],
        bgBlueBright: [104, 49],
        bgMagentaBright: [105, 49],
        bgCyanBright: [106, 49],
        bgWhiteBright: [107, 49]
      }
    };
    t.color.gray = t.color.blackBright, t.bgColor.bgGray = t.bgColor.bgBlackBright, t.color.grey = t.color.blackBright, t.bgColor.bgGrey = t.
    bgColor.bgBlackBright;
    for (let [r, n] of Object.entries(t)) {
      for (let [i, a] of Object.entries(n))
        t[i] = {
          open: `\x1B[${a[0]}m`,
          close: `\x1B[${a[1]}m`
        }, n[i] = t[i], e.set(a[0], a[1]);
      Object.defineProperty(t, r, {
        value: n,
        enumerable: !1
      });
    }
    return Object.defineProperty(t, "codes", {
      value: e,
      enumerable: !1
    }), t.color.close = "\x1B[39m", t.bgColor.close = "\x1B[49m", Gr(t.color, "ansi", () => Kr(ZC, "ansi16", dl, !1)), Gr(t.color, "ansi256",
    () => Kr(ex, "ansi256", dl, !1)), Gr(t.color, "ansi16m", () => Kr(tx, "rgb", rx, !1)), Gr(t.bgColor, "ansi", () => Kr(ZC, "ansi16", dl, !0)),
    Gr(t.bgColor, "ansi256", () => Kr(ex, "ansi256", dl, !0)), Gr(t.bgColor, "ansi16m", () => Kr(tx, "rgb", rx, !0)), t;
  }
  o(bF, "assembleStyles");
  Object.defineProperty(nx, "exports", {
    enumerable: !0,
    get: bF
  });
});

// ../node_modules/supports-color/browser.js
var ax = p((bce, ix) => {
  "use strict";
  ix.exports = {
    stdout: !1,
    stderr: !1
  };
});

// ../node_modules/@testing-library/jest-dom/node_modules/chalk/source/util.js
var lx = p((yce, sx) => {
  "use strict";
  var yF = /* @__PURE__ */ o((e, t, r) => {
    let n = e.indexOf(t);
    if (n === -1)
      return e;
    let i = t.length, a = 0, s = "";
    do
      s += e.substr(a, n - a) + t + r, a = n + i, n = e.indexOf(t, a);
    while (n !== -1);
    return s += e.substr(a), s;
  }, "stringReplaceAll"), gF = /* @__PURE__ */ o((e, t, r, n) => {
    let i = 0, a = "";
    do {
      let s = e[n - 1] === "\r";
      a += e.substr(i, (s ? n - 1 : n) - i) + t + (s ? `\r
` : `
`) + r, i = n + 1, n = e.indexOf(`
`, i);
    } while (n !== -1);
    return a += e.substr(i), a;
  }, "stringEncaseCRLFWithFirstIndex");
  sx.exports = {
    stringReplaceAll: yF,
    stringEncaseCRLFWithFirstIndex: gF
  };
});

// ../node_modules/@testing-library/jest-dom/node_modules/chalk/source/templates.js
var px = p((vce, fx) => {
  "use strict";
  var vF = /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi,
  ux = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g, wF = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/, EF = /\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.)|([^\\])/gi,
  CF = /* @__PURE__ */ new Map([
    ["n", `
`],
    ["r", "\r"],
    ["t", "	"],
    ["b", "\b"],
    ["f", "\f"],
    ["v", "\v"],
    ["0", "\0"],
    ["\\", "\\"],
    ["e", "\x1B"],
    ["a", "\x07"]
  ]);
  function dx(e) {
    let t = e[0] === "u", r = e[1] === "{";
    return t && !r && e.length === 5 || e[0] === "x" && e.length === 3 ? String.fromCharCode(parseInt(e.slice(1), 16)) : t && r ? String.fromCodePoint(
    parseInt(e.slice(2, -1), 16)) : CF.get(e) || e;
  }
  o(dx, "unescape");
  function xF(e, t) {
    let r = [], n = t.trim().split(/\s*,\s*/g), i;
    for (let a of n) {
      let s = Number(a);
      if (!Number.isNaN(s))
        r.push(s);
      else if (i = a.match(wF))
        r.push(i[2].replace(EF, (l, c, u) => c ? dx(c) : u));
      else
        throw new Error(`Invalid Chalk template style argument: ${a} (in style '${e}')`);
    }
    return r;
  }
  o(xF, "parseArguments");
  function _F(e) {
    ux.lastIndex = 0;
    let t = [], r;
    for (; (r = ux.exec(e)) !== null; ) {
      let n = r[1];
      if (r[2]) {
        let i = xF(n, r[2]);
        t.push([n].concat(i));
      } else
        t.push([n]);
    }
    return t;
  }
  o(_F, "parseStyle");
  function cx(e, t) {
    let r = {};
    for (let i of t)
      for (let a of i.styles)
        r[a[0]] = i.inverse ? null : a.slice(1);
    let n = e;
    for (let [i, a] of Object.entries(r))
      if (Array.isArray(a)) {
        if (!(i in n))
          throw new Error(`Unknown Chalk style: ${i}`);
        n = a.length > 0 ? n[i](...a) : n[i];
      }
    return n;
  }
  o(cx, "buildStyle");
  fx.exports = (e, t) => {
    let r = [], n = [], i = [];
    if (t.replace(vF, (a, s, l, c, u, d) => {
      if (s)
        i.push(dx(s));
      else if (c) {
        let f = i.join("");
        i = [], n.push(r.length === 0 ? f : cx(e, r)(f)), r.push({ inverse: l, styles: _F(c) });
      } else if (u) {
        if (r.length === 0)
          throw new Error("Found extraneous } in Chalk template literal");
        n.push(cx(e, r)(i.join(""))), i = [], r.pop();
      } else
        i.push(d);
    }), n.push(i.join("")), r.length > 0) {
      let a = `Chalk template literal is missing ${r.length} closing bracket${r.length === 1 ? "" : "s"} (\`}\`)`;
      throw new Error(a);
    }
    return n.join("");
  };
});

// ../node_modules/@testing-library/jest-dom/node_modules/chalk/source/index.js
var Nm = p((Ece, yx) => {
  "use strict";
  var zn = ox(), { stdout: Tm, stderr: Om } = ax(), {
    stringReplaceAll: PF,
    stringEncaseCRLFWithFirstIndex: qF
  } = lx(), mx = [
    "ansi",
    "ansi",
    "ansi256",
    "ansi16m"
  ], Yr = /* @__PURE__ */ Object.create(null), RF = /* @__PURE__ */ o((e, t = {}) => {
    if (t.level > 3 || t.level < 0)
      throw new Error("The `level` option should be an integer from 0 to 3");
    let r = Tm ? Tm.level : 0;
    e.level = t.level === void 0 ? r : t.level;
  }, "applyOptions"), Am = class Am {
    constructor(t) {
      return hx(t);
    }
  };
  o(Am, "ChalkClass");
  var Sm = Am, hx = /* @__PURE__ */ o((e) => {
    let t = {};
    return RF(t, e), t.template = (...r) => SF(t.template, ...r), Object.setPrototypeOf(t, fl.prototype), Object.setPrototypeOf(t.template, t),
    t.template.constructor = () => {
      throw new Error("`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.");
    }, t.template.Instance = Sm, t.template;
  }, "chalkFactory");
  function fl(e) {
    return hx(e);
  }
  o(fl, "Chalk");
  for (let [e, t] of Object.entries(zn))
    Yr[e] = {
      get() {
        let r = pl(this, Mm(t.open, t.close, this._styler), this._isEmpty);
        return Object.defineProperty(this, e, { value: r }), r;
      }
    };
  Yr.visible = {
    get() {
      let e = pl(this, this._styler, !0);
      return Object.defineProperty(this, "visible", { value: e }), e;
    }
  };
  var bx = ["rgb", "hex", "keyword", "hsl", "hsv", "hwb", "ansi", "ansi256"];
  for (let e of bx)
    Yr[e] = {
      get() {
        let { level: t } = this;
        return function(...r) {
          let n = Mm(zn.color[mx[t]][e](...r), zn.color.close, this._styler);
          return pl(this, n, this._isEmpty);
        };
      }
    };
  for (let e of bx) {
    let t = "bg" + e[0].toUpperCase() + e.slice(1);
    Yr[t] = {
      get() {
        let { level: r } = this;
        return function(...n) {
          let i = Mm(zn.bgColor[mx[r]][e](...n), zn.bgColor.close, this._styler);
          return pl(this, i, this._isEmpty);
        };
      }
    };
  }
  var TF = Object.defineProperties(() => {
  }, {
    ...Yr,
    level: {
      enumerable: !0,
      get() {
        return this._generator.level;
      },
      set(e) {
        this._generator.level = e;
      }
    }
  }), Mm = /* @__PURE__ */ o((e, t, r) => {
    let n, i;
    return r === void 0 ? (n = e, i = t) : (n = r.openAll + e, i = t + r.closeAll), {
      open: e,
      close: t,
      openAll: n,
      closeAll: i,
      parent: r
    };
  }, "createStyler"), pl = /* @__PURE__ */ o((e, t, r) => {
    let n = /* @__PURE__ */ o((...i) => OF(n, i.length === 1 ? "" + i[0] : i.join(" ")), "builder");
    return n.__proto__ = TF, n._generator = e, n._styler = t, n._isEmpty = r, n;
  }, "createBuilder"), OF = /* @__PURE__ */ o((e, t) => {
    if (e.level <= 0 || !t)
      return e._isEmpty ? "" : t;
    let r = e._styler;
    if (r === void 0)
      return t;
    let { openAll: n, closeAll: i } = r;
    if (t.indexOf("\x1B") !== -1)
      for (; r !== void 0; )
        t = PF(t, r.close, r.open), r = r.parent;
    let a = t.indexOf(`
`);
    return a !== -1 && (t = qF(t, i, n, a)), n + t + i;
  }, "applyStyle"), Rm, SF = /* @__PURE__ */ o((e, ...t) => {
    let [r] = t;
    if (!Array.isArray(r))
      return t.join(" ");
    let n = t.slice(1), i = [r.raw[0]];
    for (let a = 1; a < r.length; a++)
      i.push(
        String(n[a - 1]).replace(/[{}\\]/g, "\\$&"),
        String(r.raw[a])
      );
    return Rm === void 0 && (Rm = px()), Rm(e, i.join(""));
  }, "chalkTag");
  Object.defineProperties(fl.prototype, Yr);
  var Wn = fl();
  Wn.supportsColor = Tm;
  Wn.stderr = fl({ level: Om ? Om.level : 0 });
  Wn.stderr.supportsColor = Om;
  Wn.Level = {
    None: 0,
    Basic: 1,
    Ansi256: 2,
    TrueColor: 3,
    0: "None",
    1: "Basic",
    2: "Ansi256",
    3: "TrueColor"
  };
  yx.exports = Wn;
});

// ../node_modules/lodash/_listCacheClear.js
var vx = p((xce, gx) => {
  function MF() {
    this.__data__ = [], this.size = 0;
  }
  o(MF, "listCacheClear");
  gx.exports = MF;
});

// ../node_modules/lodash/eq.js
var Im = p((Pce, wx) => {
  function AF(e, t) {
    return e === t || e !== e && t !== t;
  }
  o(AF, "eq");
  wx.exports = AF;
});

// ../node_modules/lodash/_assocIndexOf.js
var Gn = p((Rce, Ex) => {
  var NF = Im();
  function IF(e, t) {
    for (var r = e.length; r--; )
      if (NF(e[r][0], t))
        return r;
    return -1;
  }
  o(IF, "assocIndexOf");
  Ex.exports = IF;
});

// ../node_modules/lodash/_listCacheDelete.js
var xx = p((Oce, Cx) => {
  var jF = Gn(), kF = Array.prototype, LF = kF.splice;
  function $F(e) {
    var t = this.__data__, r = jF(t, e);
    if (r < 0)
      return !1;
    var n = t.length - 1;
    return r == n ? t.pop() : LF.call(t, r, 1), --this.size, !0;
  }
  o($F, "listCacheDelete");
  Cx.exports = $F;
});

// ../node_modules/lodash/_listCacheGet.js
var Px = p((Mce, _x) => {
  var BF = Gn();
  function DF(e) {
    var t = this.__data__, r = BF(t, e);
    return r < 0 ? void 0 : t[r][1];
  }
  o(DF, "listCacheGet");
  _x.exports = DF;
});

// ../node_modules/lodash/_listCacheHas.js
var Rx = p((Nce, qx) => {
  var FF = Gn();
  function UF(e) {
    return FF(this.__data__, e) > -1;
  }
  o(UF, "listCacheHas");
  qx.exports = UF;
});

// ../node_modules/lodash/_listCacheSet.js
var Ox = p((jce, Tx) => {
  var HF = Gn();
  function VF(e, t) {
    var r = this.__data__, n = HF(r, e);
    return n < 0 ? (++this.size, r.push([e, t])) : r[n][1] = t, this;
  }
  o(VF, "listCacheSet");
  Tx.exports = VF;
});

// ../node_modules/lodash/_ListCache.js
var Kn = p((Lce, Sx) => {
  var zF = vx(), WF = xx(), GF = Px(), KF = Rx(), YF = Ox();
  function Xr(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var n = e[t];
      this.set(n[0], n[1]);
    }
  }
  o(Xr, "ListCache");
  Xr.prototype.clear = zF;
  Xr.prototype.delete = WF;
  Xr.prototype.get = GF;
  Xr.prototype.has = KF;
  Xr.prototype.set = YF;
  Sx.exports = Xr;
});

// ../node_modules/lodash/_stackClear.js
var Ax = p((Bce, Mx) => {
  var XF = Kn();
  function JF() {
    this.__data__ = new XF(), this.size = 0;
  }
  o(JF, "stackClear");
  Mx.exports = JF;
});

// ../node_modules/lodash/_stackDelete.js
var Ix = p((Fce, Nx) => {
  function QF(e) {
    var t = this.__data__, r = t.delete(e);
    return this.size = t.size, r;
  }
  o(QF, "stackDelete");
  Nx.exports = QF;
});

// ../node_modules/lodash/_stackGet.js
var kx = p((Hce, jx) => {
  function ZF(e) {
    return this.__data__.get(e);
  }
  o(ZF, "stackGet");
  jx.exports = ZF;
});

// ../node_modules/lodash/_stackHas.js
var $x = p((zce, Lx) => {
  function e5(e) {
    return this.__data__.has(e);
  }
  o(e5, "stackHas");
  Lx.exports = e5;
});

// ../node_modules/lodash/_freeGlobal.js
var jm = p((Gce, Bx) => {
  var t5 = typeof global == "object" && global && global.Object === Object && global;
  Bx.exports = t5;
});

// ../node_modules/lodash/_root.js
var wt = p((Kce, Dx) => {
  var r5 = jm(), n5 = typeof self == "object" && self && self.Object === Object && self, o5 = r5 || n5 || Function("return this")();
  Dx.exports = o5;
});

// ../node_modules/lodash/_Symbol.js
var ml = p((Yce, Fx) => {
  var i5 = wt(), a5 = i5.Symbol;
  Fx.exports = a5;
});

// ../node_modules/lodash/_getRawTag.js
var zx = p((Xce, Vx) => {
  var Ux = ml(), Hx = Object.prototype, s5 = Hx.hasOwnProperty, l5 = Hx.toString, Yn = Ux ? Ux.toStringTag : void 0;
  function u5(e) {
    var t = s5.call(e, Yn), r = e[Yn];
    try {
      e[Yn] = void 0;
      var n = !0;
    } catch {
    }
    var i = l5.call(e);
    return n && (t ? e[Yn] = r : delete e[Yn]), i;
  }
  o(u5, "getRawTag");
  Vx.exports = u5;
});

// ../node_modules/lodash/_objectToString.js
var Gx = p((Qce, Wx) => {
  var c5 = Object.prototype, d5 = c5.toString;
  function f5(e) {
    return d5.call(e);
  }
  o(f5, "objectToString");
  Wx.exports = f5;
});

// ../node_modules/lodash/_baseGetTag.js
var Xn = p((ede, Xx) => {
  var Kx = ml(), p5 = zx(), m5 = Gx(), h5 = "[object Null]", b5 = "[object Undefined]", Yx = Kx ? Kx.toStringTag : void 0;
  function y5(e) {
    return e == null ? e === void 0 ? b5 : h5 : Yx && Yx in Object(e) ? p5(e) : m5(e);
  }
  o(y5, "baseGetTag");
  Xx.exports = y5;
});

// ../node_modules/lodash/isObject.js
var km = p((rde, Jx) => {
  function g5(e) {
    var t = typeof e;
    return e != null && (t == "object" || t == "function");
  }
  o(g5, "isObject");
  Jx.exports = g5;
});

// ../node_modules/lodash/isFunction.js
var Lm = p((ode, Qx) => {
  var v5 = Xn(), w5 = km(), E5 = "[object AsyncFunction]", C5 = "[object Function]", x5 = "[object GeneratorFunction]", _5 = "[object Proxy]";
  function P5(e) {
    if (!w5(e))
      return !1;
    var t = v5(e);
    return t == C5 || t == x5 || t == E5 || t == _5;
  }
  o(P5, "isFunction");
  Qx.exports = P5;
});

// ../node_modules/lodash/_coreJsData.js
var e_ = p((ade, Zx) => {
  var q5 = wt(), R5 = q5["__core-js_shared__"];
  Zx.exports = R5;
});

// ../node_modules/lodash/_isMasked.js
var n_ = p((sde, r_) => {
  var $m = e_(), t_ = function() {
    var e = /[^.]+$/.exec($m && $m.keys && $m.keys.IE_PROTO || "");
    return e ? "Symbol(src)_1." + e : "";
  }();
  function T5(e) {
    return !!t_ && t_ in e;
  }
  o(T5, "isMasked");
  r_.exports = T5;
});

// ../node_modules/lodash/_toSource.js
var Bm = p((ude, o_) => {
  var O5 = Function.prototype, S5 = O5.toString;
  function M5(e) {
    if (e != null) {
      try {
        return S5.call(e);
      } catch {
      }
      try {
        return e + "";
      } catch {
      }
    }
    return "";
  }
  o(M5, "toSource");
  o_.exports = M5;
});

// ../node_modules/lodash/_baseIsNative.js
var a_ = p((dde, i_) => {
  var A5 = Lm(), N5 = n_(), I5 = km(), j5 = Bm(), k5 = /[\\^$.*+?()[\]{}|]/g, L5 = /^\[object .+?Constructor\]$/, $5 = Function.prototype, B5 = Object.
  prototype, D5 = $5.toString, F5 = B5.hasOwnProperty, U5 = RegExp(
    "^" + D5.call(F5).replace(k5, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  function H5(e) {
    if (!I5(e) || N5(e))
      return !1;
    var t = A5(e) ? U5 : L5;
    return t.test(j5(e));
  }
  o(H5, "baseIsNative");
  i_.exports = H5;
});

// ../node_modules/lodash/_getValue.js
var l_ = p((pde, s_) => {
  function V5(e, t) {
    return e?.[t];
  }
  o(V5, "getValue");
  s_.exports = V5;
});

// ../node_modules/lodash/_getNative.js
var hr = p((hde, u_) => {
  var z5 = a_(), W5 = l_();
  function G5(e, t) {
    var r = W5(e, t);
    return z5(r) ? r : void 0;
  }
  o(G5, "getNative");
  u_.exports = G5;
});

// ../node_modules/lodash/_Map.js
var hl = p((yde, c_) => {
  var K5 = hr(), Y5 = wt(), X5 = K5(Y5, "Map");
  c_.exports = X5;
});

// ../node_modules/lodash/_nativeCreate.js
var Jn = p((gde, d_) => {
  var J5 = hr(), Q5 = J5(Object, "create");
  d_.exports = Q5;
});

// ../node_modules/lodash/_hashClear.js
var m_ = p((vde, p_) => {
  var f_ = Jn();
  function Z5() {
    this.__data__ = f_ ? f_(null) : {}, this.size = 0;
  }
  o(Z5, "hashClear");
  p_.exports = Z5;
});

// ../node_modules/lodash/_hashDelete.js
var b_ = p((Ede, h_) => {
  function eU(e) {
    var t = this.has(e) && delete this.__data__[e];
    return this.size -= t ? 1 : 0, t;
  }
  o(eU, "hashDelete");
  h_.exports = eU;
});

// ../node_modules/lodash/_hashGet.js
var g_ = p((xde, y_) => {
  var tU = Jn(), rU = "__lodash_hash_undefined__", nU = Object.prototype, oU = nU.hasOwnProperty;
  function iU(e) {
    var t = this.__data__;
    if (tU) {
      var r = t[e];
      return r === rU ? void 0 : r;
    }
    return oU.call(t, e) ? t[e] : void 0;
  }
  o(iU, "hashGet");
  y_.exports = iU;
});

// ../node_modules/lodash/_hashHas.js
var w_ = p((Pde, v_) => {
  var aU = Jn(), sU = Object.prototype, lU = sU.hasOwnProperty;
  function uU(e) {
    var t = this.__data__;
    return aU ? t[e] !== void 0 : lU.call(t, e);
  }
  o(uU, "hashHas");
  v_.exports = uU;
});

// ../node_modules/lodash/_hashSet.js
var C_ = p((Rde, E_) => {
  var cU = Jn(), dU = "__lodash_hash_undefined__";
  function fU(e, t) {
    var r = this.__data__;
    return this.size += this.has(e) ? 0 : 1, r[e] = cU && t === void 0 ? dU : t, this;
  }
  o(fU, "hashSet");
  E_.exports = fU;
});

// ../node_modules/lodash/_Hash.js
var __ = p((Ode, x_) => {
  var pU = m_(), mU = b_(), hU = g_(), bU = w_(), yU = C_();
  function Jr(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var n = e[t];
      this.set(n[0], n[1]);
    }
  }
  o(Jr, "Hash");
  Jr.prototype.clear = pU;
  Jr.prototype.delete = mU;
  Jr.prototype.get = hU;
  Jr.prototype.has = bU;
  Jr.prototype.set = yU;
  x_.exports = Jr;
});

// ../node_modules/lodash/_mapCacheClear.js
var R_ = p((Mde, q_) => {
  var P_ = __(), gU = Kn(), vU = hl();
  function wU() {
    this.size = 0, this.__data__ = {
      hash: new P_(),
      map: new (vU || gU)(),
      string: new P_()
    };
  }
  o(wU, "mapCacheClear");
  q_.exports = wU;
});

// ../node_modules/lodash/_isKeyable.js
var O_ = p((Nde, T_) => {
  function EU(e) {
    var t = typeof e;
    return t == "string" || t == "number" || t == "symbol" || t == "boolean" ? e !== "__proto__" : e === null;
  }
  o(EU, "isKeyable");
  T_.exports = EU;
});

// ../node_modules/lodash/_getMapData.js
var Qn = p((jde, S_) => {
  var CU = O_();
  function xU(e, t) {
    var r = e.__data__;
    return CU(t) ? r[typeof t == "string" ? "string" : "hash"] : r.map;
  }
  o(xU, "getMapData");
  S_.exports = xU;
});

// ../node_modules/lodash/_mapCacheDelete.js
var A_ = p((Lde, M_) => {
  var _U = Qn();
  function PU(e) {
    var t = _U(this, e).delete(e);
    return this.size -= t ? 1 : 0, t;
  }
  o(PU, "mapCacheDelete");
  M_.exports = PU;
});

// ../node_modules/lodash/_mapCacheGet.js
var I_ = p((Bde, N_) => {
  var qU = Qn();
  function RU(e) {
    return qU(this, e).get(e);
  }
  o(RU, "mapCacheGet");
  N_.exports = RU;
});

// ../node_modules/lodash/_mapCacheHas.js
var k_ = p((Fde, j_) => {
  var TU = Qn();
  function OU(e) {
    return TU(this, e).has(e);
  }
  o(OU, "mapCacheHas");
  j_.exports = OU;
});

// ../node_modules/lodash/_mapCacheSet.js
var $_ = p((Hde, L_) => {
  var SU = Qn();
  function MU(e, t) {
    var r = SU(this, e), n = r.size;
    return r.set(e, t), this.size += r.size == n ? 0 : 1, this;
  }
  o(MU, "mapCacheSet");
  L_.exports = MU;
});

// ../node_modules/lodash/_MapCache.js
var Dm = p((zde, B_) => {
  var AU = R_(), NU = A_(), IU = I_(), jU = k_(), kU = $_();
  function Qr(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.clear(); ++t < r; ) {
      var n = e[t];
      this.set(n[0], n[1]);
    }
  }
  o(Qr, "MapCache");
  Qr.prototype.clear = AU;
  Qr.prototype.delete = NU;
  Qr.prototype.get = IU;
  Qr.prototype.has = jU;
  Qr.prototype.set = kU;
  B_.exports = Qr;
});

// ../node_modules/lodash/_stackSet.js
var F_ = p((Gde, D_) => {
  var LU = Kn(), $U = hl(), BU = Dm(), DU = 200;
  function FU(e, t) {
    var r = this.__data__;
    if (r instanceof LU) {
      var n = r.__data__;
      if (!$U || n.length < DU - 1)
        return n.push([e, t]), this.size = ++r.size, this;
      r = this.__data__ = new BU(n);
    }
    return r.set(e, t), this.size = r.size, this;
  }
  o(FU, "stackSet");
  D_.exports = FU;
});

// ../node_modules/lodash/_Stack.js
var H_ = p((Yde, U_) => {
  var UU = Kn(), HU = Ax(), VU = Ix(), zU = kx(), WU = $x(), GU = F_();
  function Zr(e) {
    var t = this.__data__ = new UU(e);
    this.size = t.size;
  }
  o(Zr, "Stack");
  Zr.prototype.clear = HU;
  Zr.prototype.delete = VU;
  Zr.prototype.get = zU;
  Zr.prototype.has = WU;
  Zr.prototype.set = GU;
  U_.exports = Zr;
});

// ../node_modules/lodash/_setCacheAdd.js
var z_ = p((Jde, V_) => {
  var KU = "__lodash_hash_undefined__";
  function YU(e) {
    return this.__data__.set(e, KU), this;
  }
  o(YU, "setCacheAdd");
  V_.exports = YU;
});

// ../node_modules/lodash/_setCacheHas.js
var G_ = p((Zde, W_) => {
  function XU(e) {
    return this.__data__.has(e);
  }
  o(XU, "setCacheHas");
  W_.exports = XU;
});

// ../node_modules/lodash/_SetCache.js
var Y_ = p((tfe, K_) => {
  var JU = Dm(), QU = z_(), ZU = G_();
  function bl(e) {
    var t = -1, r = e == null ? 0 : e.length;
    for (this.__data__ = new JU(); ++t < r; )
      this.add(e[t]);
  }
  o(bl, "SetCache");
  bl.prototype.add = bl.prototype.push = QU;
  bl.prototype.has = ZU;
  K_.exports = bl;
});

// ../node_modules/lodash/_arraySome.js
var J_ = p((nfe, X_) => {
  function eH(e, t) {
    for (var r = -1, n = e == null ? 0 : e.length; ++r < n; )
      if (t(e[r], r, e))
        return !0;
    return !1;
  }
  o(eH, "arraySome");
  X_.exports = eH;
});

// ../node_modules/lodash/_cacheHas.js
var Z_ = p((ife, Q_) => {
  function tH(e, t) {
    return e.has(t);
  }
  o(tH, "cacheHas");
  Q_.exports = tH;
});

// ../node_modules/lodash/_equalArrays.js
var Fm = p((sfe, e0) => {
  var rH = Y_(), nH = J_(), oH = Z_(), iH = 1, aH = 2;
  function sH(e, t, r, n, i, a) {
    var s = r & iH, l = e.length, c = t.length;
    if (l != c && !(s && c > l))
      return !1;
    var u = a.get(e), d = a.get(t);
    if (u && d)
      return u == t && d == e;
    var f = -1, h = !0, m = r & aH ? new rH() : void 0;
    for (a.set(e, t), a.set(t, e); ++f < l; ) {
      var y = e[f], g = t[f];
      if (n)
        var x = s ? n(g, y, f, t, e, a) : n(y, g, f, e, t, a);
      if (x !== void 0) {
        if (x)
          continue;
        h = !1;
        break;
      }
      if (m) {
        if (!nH(t, function(b, E) {
          if (!oH(m, E) && (y === b || i(y, b, r, n, a)))
            return m.push(E);
        })) {
          h = !1;
          break;
        }
      } else if (!(y === g || i(y, g, r, n, a))) {
        h = !1;
        break;
      }
    }
    return a.delete(e), a.delete(t), h;
  }
  o(sH, "equalArrays");
  e0.exports = sH;
});

// ../node_modules/lodash/_Uint8Array.js
var r0 = p((ufe, t0) => {
  var lH = wt(), uH = lH.Uint8Array;
  t0.exports = uH;
});

// ../node_modules/lodash/_mapToArray.js
var o0 = p((cfe, n0) => {
  function cH(e) {
    var t = -1, r = Array(e.size);
    return e.forEach(function(n, i) {
      r[++t] = [i, n];
    }), r;
  }
  o(cH, "mapToArray");
  n0.exports = cH;
});

// ../node_modules/lodash/_setToArray.js
var a0 = p((ffe, i0) => {
  function dH(e) {
    var t = -1, r = Array(e.size);
    return e.forEach(function(n) {
      r[++t] = n;
    }), r;
  }
  o(dH, "setToArray");
  i0.exports = dH;
});

// ../node_modules/lodash/_equalByTag.js
var d0 = p((mfe, c0) => {
  var s0 = ml(), l0 = r0(), fH = Im(), pH = Fm(), mH = o0(), hH = a0(), bH = 1, yH = 2, gH = "[object Boolean]", vH = "[object Date]", wH = "\
[object Error]", EH = "[object Map]", CH = "[object Number]", xH = "[object RegExp]", _H = "[object Set]", PH = "[object String]", qH = "[ob\
ject Symbol]", RH = "[object ArrayBuffer]", TH = "[object DataView]", u0 = s0 ? s0.prototype : void 0, Um = u0 ? u0.valueOf : void 0;
  function OH(e, t, r, n, i, a, s) {
    switch (r) {
      case TH:
        if (e.byteLength != t.byteLength || e.byteOffset != t.byteOffset)
          return !1;
        e = e.buffer, t = t.buffer;
      case RH:
        return !(e.byteLength != t.byteLength || !a(new l0(e), new l0(t)));
      case gH:
      case vH:
      case CH:
        return fH(+e, +t);
      case wH:
        return e.name == t.name && e.message == t.message;
      case xH:
      case PH:
        return e == t + "";
      case EH:
        var l = mH;
      case _H:
        var c = n & bH;
        if (l || (l = hH), e.size != t.size && !c)
          return !1;
        var u = s.get(e);
        if (u)
          return u == t;
        n |= yH, s.set(e, t);
        var d = pH(l(e), l(t), n, i, a, s);
        return s.delete(e), d;
      case qH:
        if (Um)
          return Um.call(e) == Um.call(t);
    }
    return !1;
  }
  o(OH, "equalByTag");
  c0.exports = OH;
});

// ../node_modules/lodash/_arrayPush.js
var p0 = p((bfe, f0) => {
  function SH(e, t) {
    for (var r = -1, n = t.length, i = e.length; ++r < n; )
      e[i + r] = t[r];
    return e;
  }
  o(SH, "arrayPush");
  f0.exports = SH;
});

// ../node_modules/lodash/isArray.js
var yl = p((gfe, m0) => {
  var MH = Array.isArray;
  m0.exports = MH;
});

// ../node_modules/lodash/_baseGetAllKeys.js
var b0 = p((vfe, h0) => {
  var AH = p0(), NH = yl();
  function IH(e, t, r) {
    var n = t(e);
    return NH(e) ? n : AH(n, r(e));
  }
  o(IH, "baseGetAllKeys");
  h0.exports = IH;
});

// ../node_modules/lodash/_arrayFilter.js
var g0 = p((Efe, y0) => {
  function jH(e, t) {
    for (var r = -1, n = e == null ? 0 : e.length, i = 0, a = []; ++r < n; ) {
      var s = e[r];
      t(s, r, e) && (a[i++] = s);
    }
    return a;
  }
  o(jH, "arrayFilter");
  y0.exports = jH;
});

// ../node_modules/lodash/stubArray.js
var w0 = p((xfe, v0) => {
  function kH() {
    return [];
  }
  o(kH, "stubArray");
  v0.exports = kH;
});

// ../node_modules/lodash/_getSymbols.js
var x0 = p((Pfe, C0) => {
  var LH = g0(), $H = w0(), BH = Object.prototype, DH = BH.propertyIsEnumerable, E0 = Object.getOwnPropertySymbols, FH = E0 ? function(e) {
    return e == null ? [] : (e = Object(e), LH(E0(e), function(t) {
      return DH.call(e, t);
    }));
  } : $H;
  C0.exports = FH;
});

// ../node_modules/lodash/_baseTimes.js
var P0 = p((qfe, _0) => {
  function UH(e, t) {
    for (var r = -1, n = Array(e); ++r < e; )
      n[r] = t(r);
    return n;
  }
  o(UH, "baseTimes");
  _0.exports = UH;
});

// ../node_modules/lodash/isObjectLike.js
var Zn = p((Tfe, q0) => {
  function HH(e) {
    return e != null && typeof e == "object";
  }
  o(HH, "isObjectLike");
  q0.exports = HH;
});

// ../node_modules/lodash/_baseIsArguments.js
var T0 = p((Sfe, R0) => {
  var VH = Xn(), zH = Zn(), WH = "[object Arguments]";
  function GH(e) {
    return zH(e) && VH(e) == WH;
  }
  o(GH, "baseIsArguments");
  R0.exports = GH;
});

// ../node_modules/lodash/isArguments.js
var A0 = p((Afe, M0) => {
  var O0 = T0(), KH = Zn(), S0 = Object.prototype, YH = S0.hasOwnProperty, XH = S0.propertyIsEnumerable, JH = O0(/* @__PURE__ */ function() {
    return arguments;
  }()) ? O0 : function(e) {
    return KH(e) && YH.call(e, "callee") && !XH.call(e, "callee");
  };
  M0.exports = JH;
});

// ../node_modules/lodash/stubFalse.js
var I0 = p((Nfe, N0) => {
  function QH() {
    return !1;
  }
  o(QH, "stubFalse");
  N0.exports = QH;
});

// ../node_modules/lodash/isBuffer.js
var Hm = p((eo, en) => {
  var ZH = wt(), e3 = I0(), L0 = typeof eo == "object" && eo && !eo.nodeType && eo, j0 = L0 && typeof en == "object" && en && !en.nodeType &&
  en, t3 = j0 && j0.exports === L0, k0 = t3 ? ZH.Buffer : void 0, r3 = k0 ? k0.isBuffer : void 0, n3 = r3 || e3;
  en.exports = n3;
});

// ../node_modules/lodash/_isIndex.js
var B0 = p((jfe, $0) => {
  var o3 = 9007199254740991, i3 = /^(?:0|[1-9]\d*)$/;
  function a3(e, t) {
    var r = typeof e;
    return t = t ?? o3, !!t && (r == "number" || r != "symbol" && i3.test(e)) && e > -1 && e % 1 == 0 && e < t;
  }
  o(a3, "isIndex");
  $0.exports = a3;
});

// ../node_modules/lodash/isLength.js
var Vm = p((Lfe, D0) => {
  var s3 = 9007199254740991;
  function l3(e) {
    return typeof e == "number" && e > -1 && e % 1 == 0 && e <= s3;
  }
  o(l3, "isLength");
  D0.exports = l3;
});

// ../node_modules/lodash/_baseIsTypedArray.js
var U0 = p((Bfe, F0) => {
  var u3 = Xn(), c3 = Vm(), d3 = Zn(), f3 = "[object Arguments]", p3 = "[object Array]", m3 = "[object Boolean]", h3 = "[object Date]", b3 = "\
[object Error]", y3 = "[object Function]", g3 = "[object Map]", v3 = "[object Number]", w3 = "[object Object]", E3 = "[object RegExp]", C3 = "\
[object Set]", x3 = "[object String]", _3 = "[object WeakMap]", P3 = "[object ArrayBuffer]", q3 = "[object DataView]", R3 = "[object Float32\
Array]", T3 = "[object Float64Array]", O3 = "[object Int8Array]", S3 = "[object Int16Array]", M3 = "[object Int32Array]", A3 = "[object Uint\
8Array]", N3 = "[object Uint8ClampedArray]", I3 = "[object Uint16Array]", j3 = "[object Uint32Array]", he = {};
  he[R3] = he[T3] = he[O3] = he[S3] = he[M3] = he[A3] = he[N3] = he[I3] = he[j3] = !0;
  he[f3] = he[p3] = he[P3] = he[m3] = he[q3] = he[h3] = he[b3] = he[y3] = he[g3] = he[v3] = he[w3] = he[E3] = he[C3] = he[x3] = he[_3] = !1;
  function k3(e) {
    return d3(e) && c3(e.length) && !!he[u3(e)];
  }
  o(k3, "baseIsTypedArray");
  F0.exports = k3;
});

// ../node_modules/lodash/_baseUnary.js
var V0 = p((Ffe, H0) => {
  function L3(e) {
    return function(t) {
      return e(t);
    };
  }
  o(L3, "baseUnary");
  H0.exports = L3;
});

// ../node_modules/lodash/_nodeUtil.js
var W0 = p((to, tn) => {
  var $3 = jm(), z0 = typeof to == "object" && to && !to.nodeType && to, ro = z0 && typeof tn == "object" && tn && !tn.nodeType && tn, B3 = ro &&
  ro.exports === z0, zm = B3 && $3.process, D3 = function() {
    try {
      var e = ro && ro.require && ro.require("util").types;
      return e || zm && zm.binding && zm.binding("util");
    } catch {
    }
  }();
  tn.exports = D3;
});

// ../node_modules/lodash/isTypedArray.js
var Wm = p((Hfe, Y0) => {
  var F3 = U0(), U3 = V0(), G0 = W0(), K0 = G0 && G0.isTypedArray, H3 = K0 ? U3(K0) : F3;
  Y0.exports = H3;
});

// ../node_modules/lodash/_arrayLikeKeys.js
var J0 = p((Vfe, X0) => {
  var V3 = P0(), z3 = A0(), W3 = yl(), G3 = Hm(), K3 = B0(), Y3 = Wm(), X3 = Object.prototype, J3 = X3.hasOwnProperty;
  function Q3(e, t) {
    var r = W3(e), n = !r && z3(e), i = !r && !n && G3(e), a = !r && !n && !i && Y3(e), s = r || n || i || a, l = s ? V3(e.length, String) :
    [], c = l.length;
    for (var u in e)
      (t || J3.call(e, u)) && !(s && // Safari 9 has enumerable `arguments.length` in strict mode.
      (u == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      i && (u == "offset" || u == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      a && (u == "buffer" || u == "byteLength" || u == "byteOffset") || // Skip index properties.
      K3(u, c))) && l.push(u);
    return l;
  }
  o(Q3, "arrayLikeKeys");
  X0.exports = Q3;
});

// ../node_modules/lodash/_isPrototype.js
var Z0 = p((Wfe, Q0) => {
  var Z3 = Object.prototype;
  function eV(e) {
    var t = e && e.constructor, r = typeof t == "function" && t.prototype || Z3;
    return e === r;
  }
  o(eV, "isPrototype");
  Q0.exports = eV;
});

// ../node_modules/lodash/_overArg.js
var tP = p((Kfe, eP) => {
  function tV(e, t) {
    return function(r) {
      return e(t(r));
    };
  }
  o(tV, "overArg");
  eP.exports = tV;
});

// ../node_modules/lodash/_nativeKeys.js
var nP = p((Xfe, rP) => {
  var rV = tP(), nV = rV(Object.keys, Object);
  rP.exports = nV;
});

// ../node_modules/lodash/_baseKeys.js
var iP = p((Jfe, oP) => {
  var oV = Z0(), iV = nP(), aV = Object.prototype, sV = aV.hasOwnProperty;
  function lV(e) {
    if (!oV(e))
      return iV(e);
    var t = [];
    for (var r in Object(e))
      sV.call(e, r) && r != "constructor" && t.push(r);
    return t;
  }
  o(lV, "baseKeys");
  oP.exports = lV;
});

// ../node_modules/lodash/isArrayLike.js
var sP = p((Zfe, aP) => {
  var uV = Lm(), cV = Vm();
  function dV(e) {
    return e != null && cV(e.length) && !uV(e);
  }
  o(dV, "isArrayLike");
  aP.exports = dV;
});

// ../node_modules/lodash/keys.js
var uP = p((tpe, lP) => {
  var fV = J0(), pV = iP(), mV = sP();
  function hV(e) {
    return mV(e) ? fV(e) : pV(e);
  }
  o(hV, "keys");
  lP.exports = hV;
});

// ../node_modules/lodash/_getAllKeys.js
var dP = p((npe, cP) => {
  var bV = b0(), yV = x0(), gV = uP();
  function vV(e) {
    return bV(e, gV, yV);
  }
  o(vV, "getAllKeys");
  cP.exports = vV;
});

// ../node_modules/lodash/_equalObjects.js
var mP = p((ipe, pP) => {
  var fP = dP(), wV = 1, EV = Object.prototype, CV = EV.hasOwnProperty;
  function xV(e, t, r, n, i, a) {
    var s = r & wV, l = fP(e), c = l.length, u = fP(t), d = u.length;
    if (c != d && !s)
      return !1;
    for (var f = c; f--; ) {
      var h = l[f];
      if (!(s ? h in t : CV.call(t, h)))
        return !1;
    }
    var m = a.get(e), y = a.get(t);
    if (m && y)
      return m == t && y == e;
    var g = !0;
    a.set(e, t), a.set(t, e);
    for (var x = s; ++f < c; ) {
      h = l[f];
      var b = e[h], E = t[h];
      if (n)
        var q = s ? n(E, b, h, t, e, a) : n(b, E, h, e, t, a);
      if (!(q === void 0 ? b === E || i(b, E, r, n, a) : q)) {
        g = !1;
        break;
      }
      x || (x = h == "constructor");
    }
    if (g && !x) {
      var C = e.constructor, P = t.constructor;
      C != P && "constructor" in e && "constructor" in t && !(typeof C == "function" && C instanceof C && typeof P == "function" && P instanceof
      P) && (g = !1);
    }
    return a.delete(e), a.delete(t), g;
  }
  o(xV, "equalObjects");
  pP.exports = xV;
});

// ../node_modules/lodash/_DataView.js
var bP = p((spe, hP) => {
  var _V = hr(), PV = wt(), qV = _V(PV, "DataView");
  hP.exports = qV;
});

// ../node_modules/lodash/_Promise.js
var gP = p((lpe, yP) => {
  var RV = hr(), TV = wt(), OV = RV(TV, "Promise");
  yP.exports = OV;
});

// ../node_modules/lodash/_Set.js
var wP = p((upe, vP) => {
  var SV = hr(), MV = wt(), AV = SV(MV, "Set");
  vP.exports = AV;
});

// ../node_modules/lodash/_WeakMap.js
var CP = p((cpe, EP) => {
  var NV = hr(), IV = wt(), jV = NV(IV, "WeakMap");
  EP.exports = jV;
});

// ../node_modules/lodash/_getTag.js
var SP = p((dpe, OP) => {
  var Gm = bP(), Km = hl(), Ym = gP(), Xm = wP(), Jm = CP(), TP = Xn(), rn = Bm(), xP = "[object Map]", kV = "[object Object]", _P = "[objec\
t Promise]", PP = "[object Set]", qP = "[object WeakMap]", RP = "[object DataView]", LV = rn(Gm), $V = rn(Km), BV = rn(Ym), DV = rn(Xm), FV = rn(
  Jm), br = TP;
  (Gm && br(new Gm(new ArrayBuffer(1))) != RP || Km && br(new Km()) != xP || Ym && br(Ym.resolve()) != _P || Xm && br(new Xm()) != PP || Jm &&
  br(new Jm()) != qP) && (br = /* @__PURE__ */ o(function(e) {
    var t = TP(e), r = t == kV ? e.constructor : void 0, n = r ? rn(r) : "";
    if (n)
      switch (n) {
        case LV:
          return RP;
        case $V:
          return xP;
        case BV:
          return _P;
        case DV:
          return PP;
        case FV:
          return qP;
      }
    return t;
  }, "getTag"));
  OP.exports = br;
});

// ../node_modules/lodash/_baseIsEqualDeep.js
var $P = p((ppe, LP) => {
  var Qm = H_(), UV = Fm(), HV = d0(), VV = mP(), MP = SP(), AP = yl(), NP = Hm(), zV = Wm(), WV = 1, IP = "[object Arguments]", jP = "[obje\
ct Array]", gl = "[object Object]", GV = Object.prototype, kP = GV.hasOwnProperty;
  function KV(e, t, r, n, i, a) {
    var s = AP(e), l = AP(t), c = s ? jP : MP(e), u = l ? jP : MP(t);
    c = c == IP ? gl : c, u = u == IP ? gl : u;
    var d = c == gl, f = u == gl, h = c == u;
    if (h && NP(e)) {
      if (!NP(t))
        return !1;
      s = !0, d = !1;
    }
    if (h && !d)
      return a || (a = new Qm()), s || zV(e) ? UV(e, t, r, n, i, a) : HV(e, t, c, r, n, i, a);
    if (!(r & WV)) {
      var m = d && kP.call(e, "__wrapped__"), y = f && kP.call(t, "__wrapped__");
      if (m || y) {
        var g = m ? e.value() : e, x = y ? t.value() : t;
        return a || (a = new Qm()), i(g, x, r, n, a);
      }
    }
    return h ? (a || (a = new Qm()), VV(e, t, r, n, i, a)) : !1;
  }
  o(KV, "baseIsEqualDeep");
  LP.exports = KV;
});

// ../node_modules/lodash/_baseIsEqual.js
var UP = p((hpe, FP) => {
  var YV = $P(), BP = Zn();
  function DP(e, t, r, n, i) {
    return e === t ? !0 : e == null || t == null || !BP(e) && !BP(t) ? e !== e && t !== t : YV(e, t, r, n, DP, i);
  }
  o(DP, "baseIsEqual");
  FP.exports = DP;
});

// ../node_modules/lodash/isEqualWith.js
var Zm = p((ype, HP) => {
  var XV = UP();
  function JV(e, t, r) {
    r = typeof r == "function" ? r : void 0;
    var n = r ? r(e, t) : void 0;
    return n === void 0 ? XV(e, t, void 0, r) : !!n;
  }
  o(JV, "isEqualWith");
  HP.exports = JV;
});

// ../node_modules/css.escape/css.escape.js
var th = p((eh, VP) => {
  (function(e, t) {
    typeof eh == "object" ? VP.exports = t(e) : typeof define == "function" && define.amd ? define([], t.bind(e, e)) : t(e);
  })(typeof global < "u" ? global : eh, function(e) {
    if (e.CSS && e.CSS.escape)
      return e.CSS.escape;
    var t = /* @__PURE__ */ o(function(r) {
      if (arguments.length == 0)
        throw new TypeError("`CSS.escape` requires an argument.");
      for (var n = String(r), i = n.length, a = -1, s, l = "", c = n.charCodeAt(0); ++a < i; ) {
        if (s = n.charCodeAt(a), s == 0) {
          l += "\uFFFD";
          continue;
        }
        if (
          // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
          // U+007F, […]
          s >= 1 && s <= 31 || s == 127 || // If the character is the first character and is in the range [0-9]
          // (U+0030 to U+0039), […]
          a == 0 && s >= 48 && s <= 57 || // If the character is the second character and is in the range [0-9]
          // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
          a == 1 && s >= 48 && s <= 57 && c == 45
        ) {
          l += "\\" + s.toString(16) + " ";
          continue;
        }
        if (
          // If the character is the first character and is a `-` (U+002D), and
          // there is no second character, […]
          a == 0 && i == 1 && s == 45
        ) {
          l += "\\" + n.charAt(a);
          continue;
        }
        if (s >= 128 || s == 45 || s == 95 || s >= 48 && s <= 57 || s >= 65 && s <= 90 || s >= 97 && s <= 122) {
          l += n.charAt(a);
          continue;
        }
        l += "\\" + n.charAt(a);
      }
      return l;
    }, "cssEscape");
    return e.CSS || (e.CSS = {}), e.CSS.escape = t, t;
  });
});

// ../node_modules/pretty-format/node_modules/ansi-styles/index.js
var Db = p((hbe, iT) => {
  "use strict";
  var nT = /* @__PURE__ */ o((e = 0) => (t) => `\x1B[${38 + e};5;${t}m`, "wrapAnsi256"), oT = /* @__PURE__ */ o((e = 0) => (t, r, n) => `\x1B[${38 +
  e};2;${t};${r};${n}m`, "wrapAnsi16m");
  function c8() {
    let e = /* @__PURE__ */ new Map(), t = {
      modifier: {
        reset: [0, 0],
        // 21 isn't widely supported and 22 does the same thing
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        overline: [53, 55],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29]
      },
      color: {
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],
        // Bright color
        blackBright: [90, 39],
        redBright: [91, 39],
        greenBright: [92, 39],
        yellowBright: [93, 39],
        blueBright: [94, 39],
        magentaBright: [95, 39],
        cyanBright: [96, 39],
        whiteBright: [97, 39]
      },
      bgColor: {
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49],
        // Bright color
        bgBlackBright: [100, 49],
        bgRedBright: [101, 49],
        bgGreenBright: [102, 49],
        bgYellowBright: [103, 49],
        bgBlueBright: [104, 49],
        bgMagentaBright: [105, 49],
        bgCyanBright: [106, 49],
        bgWhiteBright: [107, 49]
      }
    };
    t.color.gray = t.color.blackBright, t.bgColor.bgGray = t.bgColor.bgBlackBright, t.color.grey = t.color.blackBright, t.bgColor.bgGrey = t.
    bgColor.bgBlackBright;
    for (let [r, n] of Object.entries(t)) {
      for (let [i, a] of Object.entries(n))
        t[i] = {
          open: `\x1B[${a[0]}m`,
          close: `\x1B[${a[1]}m`
        }, n[i] = t[i], e.set(a[0], a[1]);
      Object.defineProperty(t, r, {
        value: n,
        enumerable: !1
      });
    }
    return Object.defineProperty(t, "codes", {
      value: e,
      enumerable: !1
    }), t.color.close = "\x1B[39m", t.bgColor.close = "\x1B[49m", t.color.ansi256 = nT(), t.color.ansi16m = oT(), t.bgColor.ansi256 = nT(10),
    t.bgColor.ansi16m = oT(10), Object.defineProperties(t, {
      rgbToAnsi256: {
        value: /* @__PURE__ */ o((r, n, i) => r === n && n === i ? r < 8 ? 16 : r > 248 ? 231 : Math.round((r - 8) / 247 * 24) + 232 : 16 + 36 *
        Math.round(r / 255 * 5) + 6 * Math.round(n / 255 * 5) + Math.round(i / 255 * 5), "value"),
        enumerable: !1
      },
      hexToRgb: {
        value: /* @__PURE__ */ o((r) => {
          let n = /(?<colorString>[a-f\d]{6}|[a-f\d]{3})/i.exec(r.toString(16));
          if (!n)
            return [0, 0, 0];
          let { colorString: i } = n.groups;
          i.length === 3 && (i = i.split("").map((s) => s + s).join(""));
          let a = Number.parseInt(i, 16);
          return [
            a >> 16 & 255,
            a >> 8 & 255,
            a & 255
          ];
        }, "value"),
        enumerable: !1
      },
      hexToAnsi256: {
        value: /* @__PURE__ */ o((r) => t.rgbToAnsi256(...t.hexToRgb(r)), "value"),
        enumerable: !1
      }
    }), t;
  }
  o(c8, "assembleStyles");
  Object.defineProperty(iT, "exports", {
    enumerable: !0,
    get: c8
  });
});

// ../node_modules/pretty-format/build/collections.js
var yo = p((dn) => {
  "use strict";
  Object.defineProperty(dn, "__esModule", {
    value: !0
  });
  dn.printIteratorEntries = f8;
  dn.printIteratorValues = p8;
  dn.printListItems = m8;
  dn.printObjectProperties = h8;
  var d8 = /* @__PURE__ */ o((e, t) => {
    let r = Object.keys(e).sort(t);
    return Object.getOwnPropertySymbols && Object.getOwnPropertySymbols(e).forEach((n) => {
      Object.getOwnPropertyDescriptor(e, n).enumerable && r.push(n);
    }), r;
  }, "getKeysOfEnumerableProperties");
  function f8(e, t, r, n, i, a, s = ": ") {
    let l = "", c = e.next();
    if (!c.done) {
      l += t.spacingOuter;
      let u = r + t.indent;
      for (; !c.done; ) {
        let d = a(
          c.value[0],
          t,
          u,
          n,
          i
        ), f = a(
          c.value[1],
          t,
          u,
          n,
          i
        );
        l += u + d + s + f, c = e.next(), c.done ? t.min || (l += ",") : l += "," + t.spacingInner;
      }
      l += t.spacingOuter + r;
    }
    return l;
  }
  o(f8, "printIteratorEntries");
  function p8(e, t, r, n, i, a) {
    let s = "", l = e.next();
    if (!l.done) {
      s += t.spacingOuter;
      let c = r + t.indent;
      for (; !l.done; )
        s += c + a(l.value, t, c, n, i), l = e.next(), l.done ? t.min || (s += ",") : s += "," + t.spacingInner;
      s += t.spacingOuter + r;
    }
    return s;
  }
  o(p8, "printIteratorValues");
  function m8(e, t, r, n, i, a) {
    let s = "";
    if (e.length) {
      s += t.spacingOuter;
      let l = r + t.indent;
      for (let c = 0; c < e.length; c++)
        s += l, c in e && (s += a(e[c], t, l, n, i)), c < e.length - 1 ? s += "," + t.spacingInner : t.min || (s += ",");
      s += t.spacingOuter + r;
    }
    return s;
  }
  o(m8, "printListItems");
  function h8(e, t, r, n, i, a) {
    let s = "", l = d8(e, t.compareKeys);
    if (l.length) {
      s += t.spacingOuter;
      let c = r + t.indent;
      for (let u = 0; u < l.length; u++) {
        let d = l[u], f = a(d, t, c, n, i), h = a(e[d], t, c, n, i);
        s += c + f + ": " + h, u < l.length - 1 ? s += "," + t.spacingInner : t.min || (s += ",");
      }
      s += t.spacingOuter + r;
    }
    return s;
  }
  o(h8, "printObjectProperties");
});

// ../node_modules/pretty-format/build/plugins/AsymmetricMatcher.js
var uT = p((zt) => {
  "use strict";
  Object.defineProperty(zt, "__esModule", {
    value: !0
  });
  zt.test = zt.serialize = zt.default = void 0;
  var aT = yo(), mu = function() {
    return typeof globalThis < "u" ? globalThis : typeof mu < "u" ? mu : typeof self < "u" ? self : typeof window < "u" ? window : Function(
    "return this")();
  }(), Fb = mu["jest-symbol-do-not-touch"] || mu.Symbol, b8 = typeof Fb == "function" && Fb.for ? Fb.for("jest.asymmetricMatcher") : 1267621,
  pu = " ", sT = /* @__PURE__ */ o((e, t, r, n, i, a) => {
    let s = e.toString();
    return s === "ArrayContaining" || s === "ArrayNotContaining" ? ++n > t.maxDepth ? "[" + s + "]" : s + pu + "[" + (0, aT.printListItems)(
      e.sample,
      t,
      r,
      n,
      i,
      a
    ) + "]" : s === "ObjectContaining" || s === "ObjectNotContaining" ? ++n > t.maxDepth ? "[" + s + "]" : s + pu + "{" + (0, aT.printObjectProperties)(
      e.sample,
      t,
      r,
      n,
      i,
      a
    ) + "}" : s === "StringMatching" || s === "StringNotMatching" || s === "StringContaining" || s === "StringNotContaining" ? s + pu + a(e.
    sample, t, r, n, i) : e.toAsymmetricMatcher();
  }, "serialize");
  zt.serialize = sT;
  var lT = /* @__PURE__ */ o((e) => e && e.$$typeof === b8, "test");
  zt.test = lT;
  var y8 = {
    serialize: sT,
    test: lT
  }, g8 = y8;
  zt.default = g8;
});

// ../node_modules/pretty-format/node_modules/ansi-regex/index.js
var dT = p((Ebe, cT) => {
  "use strict";
  cT.exports = ({ onlyFirst: e = !1 } = {}) => {
    let t = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
    ].join("|");
    return new RegExp(t, e ? void 0 : "g");
  };
});

// ../node_modules/pretty-format/build/plugins/ConvertAnsi.js
var bT = p((Wt) => {
  "use strict";
  Object.defineProperty(Wt, "__esModule", {
    value: !0
  });
  Wt.test = Wt.serialize = Wt.default = void 0;
  var fT = pT(dT()), fe = pT(Db());
  function pT(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(pT, "_interopRequireDefault");
  var v8 = /* @__PURE__ */ o((e) => e.replace((0, fT.default)(), (t) => {
    switch (t) {
      case fe.default.red.close:
      case fe.default.green.close:
      case fe.default.cyan.close:
      case fe.default.gray.close:
      case fe.default.white.close:
      case fe.default.yellow.close:
      case fe.default.bgRed.close:
      case fe.default.bgGreen.close:
      case fe.default.bgYellow.close:
      case fe.default.inverse.close:
      case fe.default.dim.close:
      case fe.default.bold.close:
      case fe.default.reset.open:
      case fe.default.reset.close:
        return "</>";
      case fe.default.red.open:
        return "<red>";
      case fe.default.green.open:
        return "<green>";
      case fe.default.cyan.open:
        return "<cyan>";
      case fe.default.gray.open:
        return "<gray>";
      case fe.default.white.open:
        return "<white>";
      case fe.default.yellow.open:
        return "<yellow>";
      case fe.default.bgRed.open:
        return "<bgRed>";
      case fe.default.bgGreen.open:
        return "<bgGreen>";
      case fe.default.bgYellow.open:
        return "<bgYellow>";
      case fe.default.inverse.open:
        return "<inverse>";
      case fe.default.dim.open:
        return "<dim>";
      case fe.default.bold.open:
        return "<bold>";
      default:
        return "";
    }
  }), "toHumanReadableAnsi"), mT = /* @__PURE__ */ o((e) => typeof e == "string" && !!e.match((0, fT.default)()), "test");
  Wt.test = mT;
  var hT = /* @__PURE__ */ o((e, t, r, n, i, a) => a(v8(e), t, r, n, i), "serialize");
  Wt.serialize = hT;
  var w8 = {
    serialize: hT,
    test: mT
  }, E8 = w8;
  Wt.default = E8;
});

// ../node_modules/pretty-format/build/plugins/DOMCollection.js
var ET = p((Gt) => {
  "use strict";
  Object.defineProperty(Gt, "__esModule", {
    value: !0
  });
  Gt.test = Gt.serialize = Gt.default = void 0;
  var yT = yo(), C8 = " ", gT = ["DOMStringMap", "NamedNodeMap"], x8 = /^(HTML\w*Collection|NodeList)$/, _8 = /* @__PURE__ */ o((e) => gT.indexOf(
  e) !== -1 || x8.test(e), "testName"), vT = /* @__PURE__ */ o((e) => e && e.constructor && !!e.constructor.name && _8(e.constructor.name), "\
test");
  Gt.test = vT;
  var P8 = /* @__PURE__ */ o((e) => e.constructor.name === "NamedNodeMap", "isNamedNodeMap"), wT = /* @__PURE__ */ o((e, t, r, n, i, a) => {
    let s = e.constructor.name;
    return ++n > t.maxDepth ? "[" + s + "]" : (t.min ? "" : s + C8) + (gT.indexOf(s) !== -1 ? "{" + (0, yT.printObjectProperties)(
      P8(e) ? Array.from(e).reduce((l, c) => (l[c.name] = c.value, l), {}) : { ...e },
      t,
      r,
      n,
      i,
      a
    ) + "}" : "[" + (0, yT.printListItems)(
      Array.from(e),
      t,
      r,
      n,
      i,
      a
    ) + "]");
  }, "serialize");
  Gt.serialize = wT;
  var q8 = {
    serialize: wT,
    test: vT
  }, R8 = q8;
  Gt.default = R8;
});

// ../node_modules/pretty-format/build/plugins/lib/escapeHTML.js
var CT = p((Ub) => {
  "use strict";
  Object.defineProperty(Ub, "__esModule", {
    value: !0
  });
  Ub.default = T8;
  function T8(e) {
    return e.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  o(T8, "escapeHTML");
});

// ../node_modules/pretty-format/build/plugins/lib/markup.js
var hu = p((Ue) => {
  "use strict";
  Object.defineProperty(Ue, "__esModule", {
    value: !0
  });
  Ue.printText = Ue.printProps = Ue.printElementAsLeaf = Ue.printElement = Ue.printComment = Ue.printChildren = void 0;
  var xT = O8(CT());
  function O8(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(O8, "_interopRequireDefault");
  var S8 = /* @__PURE__ */ o((e, t, r, n, i, a, s) => {
    let l = n + r.indent, c = r.colors;
    return e.map((u) => {
      let d = t[u], f = s(d, r, l, i, a);
      return typeof d != "string" && (f.indexOf(`
`) !== -1 && (f = r.spacingOuter + l + f + r.spacingOuter + n), f = "{" + f + "}"), r.spacingInner + n + c.prop.open + u + c.prop.close + "=" +
      c.value.open + f + c.value.close;
    }).join("");
  }, "printProps");
  Ue.printProps = S8;
  var M8 = /* @__PURE__ */ o((e, t, r, n, i, a) => e.map(
    (s) => t.spacingOuter + r + (typeof s == "string" ? _T(s, t) : a(s, t, r, n, i))
  ).join(""), "printChildren");
  Ue.printChildren = M8;
  var _T = /* @__PURE__ */ o((e, t) => {
    let r = t.colors.content;
    return r.open + (0, xT.default)(e) + r.close;
  }, "printText");
  Ue.printText = _T;
  var A8 = /* @__PURE__ */ o((e, t) => {
    let r = t.colors.comment;
    return r.open + "<!--" + (0, xT.default)(e) + "-->" + r.close;
  }, "printComment");
  Ue.printComment = A8;
  var N8 = /* @__PURE__ */ o((e, t, r, n, i) => {
    let a = n.colors.tag;
    return a.open + "<" + e + (t && a.close + t + n.spacingOuter + i + a.open) + (r ? ">" + a.close + r + n.spacingOuter + i + a.open + "</" +
    e : (t && !n.min ? "" : " ") + "/") + ">" + a.close;
  }, "printElement");
  Ue.printElement = N8;
  var I8 = /* @__PURE__ */ o((e, t) => {
    let r = t.colors.tag;
    return r.open + "<" + e + r.close + " \u2026" + r.open + " />" + r.close;
  }, "printElementAsLeaf");
  Ue.printElementAsLeaf = I8;
});

// ../node_modules/pretty-format/build/plugins/DOMElement.js
var ST = p((Kt) => {
  "use strict";
  Object.defineProperty(Kt, "__esModule", {
    value: !0
  });
  Kt.test = Kt.serialize = Kt.default = void 0;
  var fn = hu(), j8 = 1, PT = 3, qT = 8, RT = 11, k8 = /^((HTML|SVG)\w*)?Element$/, L8 = /* @__PURE__ */ o((e) => {
    try {
      return typeof e.hasAttribute == "function" && e.hasAttribute("is");
    } catch {
      return !1;
    }
  }, "testHasAttribute"), $8 = /* @__PURE__ */ o((e) => {
    let t = e.constructor.name, { nodeType: r, tagName: n } = e, i = typeof n == "string" && n.includes("-") || L8(e);
    return r === j8 && (k8.test(t) || i) || r === PT && t === "Text" || r === qT && t === "Comment" || r === RT && t === "DocumentFragment";
  }, "testNode"), TT = /* @__PURE__ */ o((e) => {
    var t;
    return (e == null || (t = e.constructor) === null || t === void 0 ? void 0 : t.name) && $8(e);
  }, "test");
  Kt.test = TT;
  function B8(e) {
    return e.nodeType === PT;
  }
  o(B8, "nodeIsText");
  function D8(e) {
    return e.nodeType === qT;
  }
  o(D8, "nodeIsComment");
  function Hb(e) {
    return e.nodeType === RT;
  }
  o(Hb, "nodeIsFragment");
  var OT = /* @__PURE__ */ o((e, t, r, n, i, a) => {
    if (B8(e))
      return (0, fn.printText)(e.data, t);
    if (D8(e))
      return (0, fn.printComment)(e.data, t);
    let s = Hb(e) ? "DocumentFragment" : e.tagName.toLowerCase();
    return ++n > t.maxDepth ? (0, fn.printElementAsLeaf)(s, t) : (0, fn.printElement)(
      s,
      (0, fn.printProps)(
        Hb(e) ? [] : Array.from(e.attributes).map((l) => l.name).sort(),
        Hb(e) ? {} : Array.from(e.attributes).reduce((l, c) => (l[c.name] = c.value, l), {}),
        t,
        r + t.indent,
        n,
        i,
        a
      ),
      (0, fn.printChildren)(
        Array.prototype.slice.call(e.childNodes || e.children),
        t,
        r + t.indent,
        n,
        i,
        a
      ),
      t,
      r
    );
  }, "serialize");
  Kt.serialize = OT;
  var F8 = {
    serialize: OT,
    test: TT
  }, U8 = F8;
  Kt.default = U8;
});

// ../node_modules/pretty-format/build/plugins/Immutable.js
var jT = p((Yt) => {
  "use strict";
  Object.defineProperty(Yt, "__esModule", {
    value: !0
  });
  Yt.test = Yt.serialize = Yt.default = void 0;
  var go = yo(), H8 = "@@__IMMUTABLE_ITERABLE__@@", V8 = "@@__IMMUTABLE_LIST__@@", z8 = "@@__IMMUTABLE_KEYED__@@", W8 = "@@__IMMUTABLE_MAP__\
@@", MT = "@@__IMMUTABLE_ORDERED__@@", G8 = "@@__IMMUTABLE_RECORD__@@", K8 = "@@__IMMUTABLE_SEQ__@@", Y8 = "@@__IMMUTABLE_SET__@@", X8 = "@@\
__IMMUTABLE_STACK__@@", pn = /* @__PURE__ */ o((e) => "Immutable." + e, "getImmutableName"), bu = /* @__PURE__ */ o((e) => "[" + e + "]", "p\
rintAsLeaf"), vo = " ", AT = "\u2026", J8 = /* @__PURE__ */ o((e, t, r, n, i, a, s) => ++n > t.maxDepth ? bu(pn(s)) : pn(s) + vo + "{" + (0, go.
  printIteratorEntries)(
    e.entries(),
    t,
    r,
    n,
    i,
    a
  ) + "}", "printImmutableEntries");
  function Q8(e) {
    let t = 0;
    return {
      next() {
        if (t < e._keys.length) {
          let r = e._keys[t++];
          return {
            done: !1,
            value: [r, e.get(r)]
          };
        }
        return {
          done: !0,
          value: void 0
        };
      }
    };
  }
  o(Q8, "getRecordEntries");
  var Z8 = /* @__PURE__ */ o((e, t, r, n, i, a) => {
    let s = pn(e._name || "Record");
    return ++n > t.maxDepth ? bu(s) : s + vo + "{" + (0, go.printIteratorEntries)(
      Q8(e),
      t,
      r,
      n,
      i,
      a
    ) + "}";
  }, "printImmutableRecord"), eW = /* @__PURE__ */ o((e, t, r, n, i, a) => {
    let s = pn("Seq");
    return ++n > t.maxDepth ? bu(s) : e[z8] ? s + vo + "{" + // from Immutable collection of entries or from ECMAScript object
    (e._iter || e._object ? (0, go.printIteratorEntries)(
      e.entries(),
      t,
      r,
      n,
      i,
      a
    ) : AT) + "}" : s + vo + "[" + (e._iter || // from Immutable collection of values
    e._array || // from ECMAScript array
    e._collection || // from ECMAScript collection in immutable v4
    e._iterable ? (0, go.printIteratorValues)(
      e.values(),
      t,
      r,
      n,
      i,
      a
    ) : AT) + "]";
  }, "printImmutableSeq"), Vb = /* @__PURE__ */ o((e, t, r, n, i, a, s) => ++n > t.maxDepth ? bu(pn(s)) : pn(s) + vo + "[" + (0, go.printIteratorValues)(
    e.values(),
    t,
    r,
    n,
    i,
    a
  ) + "]", "printImmutableValues"), NT = /* @__PURE__ */ o((e, t, r, n, i, a) => e[W8] ? J8(
    e,
    t,
    r,
    n,
    i,
    a,
    e[MT] ? "OrderedMap" : "Map"
  ) : e[V8] ? Vb(
    e,
    t,
    r,
    n,
    i,
    a,
    "List"
  ) : e[Y8] ? Vb(
    e,
    t,
    r,
    n,
    i,
    a,
    e[MT] ? "OrderedSet" : "Set"
  ) : e[X8] ? Vb(
    e,
    t,
    r,
    n,
    i,
    a,
    "Stack"
  ) : e[K8] ? eW(e, t, r, n, i, a) : Z8(e, t, r, n, i, a), "serialize");
  Yt.serialize = NT;
  var IT = /* @__PURE__ */ o((e) => e && (e[H8] === !0 || e[G8] === !0), "test");
  Yt.test = IT;
  var tW = {
    serialize: NT,
    test: IT
  }, rW = tW;
  Yt.default = rW;
});

// ../node_modules/pretty-format/node_modules/react-is/cjs/react-is.development.js
var kT = p((ce) => {
  "use strict";
  (function() {
    "use strict";
    var e = 60103, t = 60106, r = 60107, n = 60108, i = 60114, a = 60109, s = 60110, l = 60112, c = 60113, u = 60120, d = 60115, f = 60116, h = 60121,
    m = 60122, y = 60117, g = 60119, x = 60128, b = 60129, E = 60130, q = 60131;
    if (typeof Symbol == "function" && Symbol.for) {
      var C = Symbol.for;
      e = C("react.element"), t = C("react.portal"), r = C("react.fragment"), n = C("react.strict_mode"), i = C("react.profiler"), a = C("re\
act.provider"), s = C("react.context"), l = C("react.forward_ref"), c = C("react.suspense"), u = C("react.suspense_list"), d = C("react.memo"),
      f = C("react.lazy"), h = C("react.block"), m = C("react.server.block"), y = C("react.fundamental"), g = C("react.scope"), x = C("react\
.opaque.id"), b = C("react.debug_trace_mode"), E = C("react.offscreen"), q = C("react.legacy_hidden");
    }
    var P = !1;
    function O(N) {
      return !!(typeof N == "string" || typeof N == "function" || N === r || N === i || N === b || N === n || N === c || N === u || N === q ||
      P || typeof N == "object" && N !== null && (N.$$typeof === f || N.$$typeof === d || N.$$typeof === a || N.$$typeof === s || N.$$typeof ===
      l || N.$$typeof === y || N.$$typeof === h || N[0] === m));
    }
    o(O, "isValidElementType");
    function R(N) {
      if (typeof N == "object" && N !== null) {
        var dr = N.$$typeof;
        switch (dr) {
          case e:
            var Ct = N.type;
            switch (Ct) {
              case r:
              case i:
              case n:
              case c:
              case u:
                return Ct;
              default:
                var Tn = Ct && Ct.$$typeof;
                switch (Tn) {
                  case s:
                  case l:
                  case f:
                  case d:
                  case a:
                    return Tn;
                  default:
                    return dr;
                }
            }
          case t:
            return dr;
        }
      }
    }
    o(R, "typeOf");
    var A = s, j = a, J = e, S = l, G = r, ne = f, B = d, H = t, $ = i, W = n, V = c, ee = !1, pe = !1;
    function Ce(N) {
      return ee || (ee = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    o(Ce, "isAsyncMode");
    function I(N) {
      return pe || (pe = !0, console.warn("The ReactIs.isConcurrentMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    o(I, "isConcurrentMode");
    function M(N) {
      return R(N) === s;
    }
    o(M, "isContextConsumer");
    function F(N) {
      return R(N) === a;
    }
    o(F, "isContextProvider");
    function U(N) {
      return typeof N == "object" && N !== null && N.$$typeof === e;
    }
    o(U, "isElement");
    function K(N) {
      return R(N) === l;
    }
    o(K, "isForwardRef");
    function se(N) {
      return R(N) === r;
    }
    o(se, "isFragment");
    function ge(N) {
      return R(N) === f;
    }
    o(ge, "isLazy");
    function Re(N) {
      return R(N) === d;
    }
    o(Re, "isMemo");
    function cr(N) {
      return R(N) === t;
    }
    o(cr, "isPortal");
    function kr(N) {
      return R(N) === i;
    }
    o(kr, "isProfiler");
    function Lr(N) {
      return R(N) === n;
    }
    o(Lr, "isStrictMode");
    function Jf(N) {
      return R(N) === c;
    }
    o(Jf, "isSuspense"), ce.ContextConsumer = A, ce.ContextProvider = j, ce.Element = J, ce.ForwardRef = S, ce.Fragment = G, ce.Lazy = ne, ce.
    Memo = B, ce.Portal = H, ce.Profiler = $, ce.StrictMode = W, ce.Suspense = V, ce.isAsyncMode = Ce, ce.isConcurrentMode = I, ce.isContextConsumer =
    M, ce.isContextProvider = F, ce.isElement = U, ce.isForwardRef = K, ce.isFragment = se, ce.isLazy = ge, ce.isMemo = Re, ce.isPortal = cr,
    ce.isProfiler = kr, ce.isStrictMode = Lr, ce.isSuspense = Jf, ce.isValidElementType = O, ce.typeOf = R;
  })();
});

// ../node_modules/pretty-format/node_modules/react-is/index.js
var $T = p((kbe, LT) => {
  "use strict";
  LT.exports = kT();
});

// ../node_modules/pretty-format/build/plugins/ReactElement.js
var VT = p((Xt) => {
  "use strict";
  Object.defineProperty(Xt, "__esModule", {
    value: !0
  });
  Xt.test = Xt.serialize = Xt.default = void 0;
  var Cr = nW($T()), yu = hu();
  function DT(e) {
    if (typeof WeakMap != "function") return null;
    var t = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap();
    return (DT = /* @__PURE__ */ o(function(n) {
      return n ? r : t;
    }, "_getRequireWildcardCache"))(e);
  }
  o(DT, "_getRequireWildcardCache");
  function nW(e, t) {
    if (!t && e && e.__esModule)
      return e;
    if (e === null || typeof e != "object" && typeof e != "function")
      return { default: e };
    var r = DT(t);
    if (r && r.has(e))
      return r.get(e);
    var n = {}, i = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var a in e)
      if (a !== "default" && Object.prototype.hasOwnProperty.call(e, a)) {
        var s = i ? Object.getOwnPropertyDescriptor(e, a) : null;
        s && (s.get || s.set) ? Object.defineProperty(n, a, s) : n[a] = e[a];
      }
    return n.default = e, r && r.set(e, n), n;
  }
  o(nW, "_interopRequireWildcard");
  var FT = /* @__PURE__ */ o((e, t = []) => (Array.isArray(e) ? e.forEach((r) => {
    FT(r, t);
  }) : e != null && e !== !1 && t.push(e), t), "getChildren"), BT = /* @__PURE__ */ o((e) => {
    let t = e.type;
    if (typeof t == "string")
      return t;
    if (typeof t == "function")
      return t.displayName || t.name || "Unknown";
    if (Cr.isFragment(e))
      return "React.Fragment";
    if (Cr.isSuspense(e))
      return "React.Suspense";
    if (typeof t == "object" && t !== null) {
      if (Cr.isContextProvider(e))
        return "Context.Provider";
      if (Cr.isContextConsumer(e))
        return "Context.Consumer";
      if (Cr.isForwardRef(e)) {
        if (t.displayName)
          return t.displayName;
        let r = t.render.displayName || t.render.name || "";
        return r !== "" ? "ForwardRef(" + r + ")" : "ForwardRef";
      }
      if (Cr.isMemo(e)) {
        let r = t.displayName || t.type.displayName || t.type.name || "";
        return r !== "" ? "Memo(" + r + ")" : "Memo";
      }
    }
    return "UNDEFINED";
  }, "getType"), oW = /* @__PURE__ */ o((e) => {
    let { props: t } = e;
    return Object.keys(t).filter((r) => r !== "children" && t[r] !== void 0).sort();
  }, "getPropKeys"), UT = /* @__PURE__ */ o((e, t, r, n, i, a) => ++n > t.maxDepth ? (0, yu.printElementAsLeaf)(BT(e), t) : (0, yu.printElement)(
    BT(e),
    (0, yu.printProps)(
      oW(e),
      e.props,
      t,
      r + t.indent,
      n,
      i,
      a
    ),
    (0, yu.printChildren)(
      FT(e.props.children),
      t,
      r + t.indent,
      n,
      i,
      a
    ),
    t,
    r
  ), "serialize");
  Xt.serialize = UT;
  var HT = /* @__PURE__ */ o((e) => e != null && Cr.isElement(e), "test");
  Xt.test = HT;
  var iW = {
    serialize: UT,
    test: HT
  }, aW = iW;
  Xt.default = aW;
});

// ../node_modules/pretty-format/build/plugins/ReactTestComponent.js
var GT = p((Jt) => {
  "use strict";
  Object.defineProperty(Jt, "__esModule", {
    value: !0
  });
  Jt.test = Jt.serialize = Jt.default = void 0;
  var gu = hu(), vu = function() {
    return typeof globalThis < "u" ? globalThis : typeof vu < "u" ? vu : typeof self < "u" ? self : typeof window < "u" ? window : Function(
    "return this")();
  }(), zb = vu["jest-symbol-do-not-touch"] || vu.Symbol, sW = typeof zb == "function" && zb.for ? zb.for("react.test.json") : 245830487, lW = /* @__PURE__ */ o(
  (e) => {
    let { props: t } = e;
    return t ? Object.keys(t).filter((r) => t[r] !== void 0).sort() : [];
  }, "getPropKeys"), zT = /* @__PURE__ */ o((e, t, r, n, i, a) => ++n > t.maxDepth ? (0, gu.printElementAsLeaf)(e.type, t) : (0, gu.printElement)(
    e.type,
    e.props ? (0, gu.printProps)(
      lW(e),
      e.props,
      t,
      r + t.indent,
      n,
      i,
      a
    ) : "",
    e.children ? (0, gu.printChildren)(
      e.children,
      t,
      r + t.indent,
      n,
      i,
      a
    ) : "",
    t,
    r
  ), "serialize");
  Jt.serialize = zT;
  var WT = /* @__PURE__ */ o((e) => e && e.$$typeof === sW, "test");
  Jt.test = WT;
  var uW = {
    serialize: zT,
    test: WT
  }, cW = uW;
  Jt.default = cW;
});

// ../node_modules/pretty-format/build/index.js
var uO = p((qt) => {
  "use strict";
  Object.defineProperty(qt, "__esModule", {
    value: !0
  });
  qt.default = qt.DEFAULT_OPTIONS = void 0;
  qt.format = lO;
  qt.plugins = void 0;
  var dW = Zt(Db()), wo = yo(), fW = Zt(
    uT()
  ), pW = Zt(bT()), mW = Zt(ET()), hW = Zt(ST()), bW = Zt(jT()), yW = Zt(VT()), gW = Zt(
    GT()
  );
  function Zt(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Zt, "_interopRequireDefault");
  var ZT = Object.prototype.toString, vW = Date.prototype.toISOString, wW = Error.prototype.toString, KT = RegExp.prototype.toString, Wb = /* @__PURE__ */ o(
  (e) => typeof e.constructor == "function" && e.constructor.name || "Object", "getConstructorName"), EW = /* @__PURE__ */ o((e) => typeof window <
  "u" && e === window, "isWindow"), CW = /^Symbol\((.*)\)(.*)$/, xW = /\n/gi, Kb = class Kb extends Error {
    constructor(t, r) {
      super(t), this.stack = r, this.name = this.constructor.name;
    }
  };
  o(Kb, "PrettyFormatPluginError");
  var wu = Kb;
  function _W(e) {
    return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[o\
bject Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Arra\
y]" || e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
  }
  o(_W, "isToStringedArrayType");
  function PW(e) {
    return Object.is(e, -0) ? "-0" : String(e);
  }
  o(PW, "printNumber");
  function qW(e) {
    return `${e}n`;
  }
  o(qW, "printBigInt");
  function YT(e, t) {
    return t ? "[Function " + (e.name || "anonymous") + "]" : "[Function]";
  }
  o(YT, "printFunction");
  function XT(e) {
    return String(e).replace(CW, "Symbol($1)");
  }
  o(XT, "printSymbol");
  function JT(e) {
    return "[" + wW.call(e) + "]";
  }
  o(JT, "printError");
  function eO(e, t, r, n) {
    if (e === !0 || e === !1)
      return "" + e;
    if (e === void 0)
      return "undefined";
    if (e === null)
      return "null";
    let i = typeof e;
    if (i === "number")
      return PW(e);
    if (i === "bigint")
      return qW(e);
    if (i === "string")
      return n ? '"' + e.replace(/"|\\/g, "\\$&") + '"' : '"' + e + '"';
    if (i === "function")
      return YT(e, t);
    if (i === "symbol")
      return XT(e);
    let a = ZT.call(e);
    return a === "[object WeakMap]" ? "WeakMap {}" : a === "[object WeakSet]" ? "WeakSet {}" : a === "[object Function]" || a === "[object G\
eneratorFunction]" ? YT(e, t) : a === "[object Symbol]" ? XT(e) : a === "[object Date]" ? isNaN(+e) ? "Date { NaN }" : vW.call(e) : a === "[\
object Error]" ? JT(e) : a === "[object RegExp]" ? r ? KT.call(e).replace(/[\\^$*+?.()|[\]{}]/g, "\\$&") : KT.call(e) : e instanceof Error ?
    JT(e) : null;
  }
  o(eO, "printBasicValue");
  function tO(e, t, r, n, i, a) {
    if (i.indexOf(e) !== -1)
      return "[Circular]";
    i = i.slice(), i.push(e);
    let s = ++n > t.maxDepth, l = t.min;
    if (t.callToJSON && !s && e.toJSON && typeof e.toJSON == "function" && !a)
      return Qt(e.toJSON(), t, r, n, i, !0);
    let c = ZT.call(e);
    return c === "[object Arguments]" ? s ? "[Arguments]" : (l ? "" : "Arguments ") + "[" + (0, wo.printListItems)(
      e,
      t,
      r,
      n,
      i,
      Qt
    ) + "]" : _W(c) ? s ? "[" + e.constructor.name + "]" : (l || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : e.constructor.
    name + " ") + "[" + (0, wo.printListItems)(
      e,
      t,
      r,
      n,
      i,
      Qt
    ) + "]" : c === "[object Map]" ? s ? "[Map]" : "Map {" + (0, wo.printIteratorEntries)(
      e.entries(),
      t,
      r,
      n,
      i,
      Qt,
      " => "
    ) + "}" : c === "[object Set]" ? s ? "[Set]" : "Set {" + (0, wo.printIteratorValues)(
      e.values(),
      t,
      r,
      n,
      i,
      Qt
    ) + "}" : s || EW(e) ? "[" + Wb(e) + "]" : (l || !t.printBasicPrototype && Wb(e) === "Object" ? "" : Wb(e) + " ") + "{" + (0, wo.printObjectProperties)(
      e,
      t,
      r,
      n,
      i,
      Qt
    ) + "}";
  }
  o(tO, "printComplexValue");
  function RW(e) {
    return e.serialize != null;
  }
  o(RW, "isNewPlugin");
  function rO(e, t, r, n, i, a) {
    let s;
    try {
      s = RW(e) ? e.serialize(t, r, n, i, a, Qt) : e.print(
        t,
        (l) => Qt(l, r, n, i, a),
        (l) => {
          let c = n + r.indent;
          return c + l.replace(xW, `
` + c);
        },
        {
          edgeSpacing: r.spacingOuter,
          min: r.min,
          spacing: r.spacingInner
        },
        r.colors
      );
    } catch (l) {
      throw new wu(l.message, l.stack);
    }
    if (typeof s != "string")
      throw new Error(
        `pretty-format: Plugin must return type "string" but instead returned "${typeof s}".`
      );
    return s;
  }
  o(rO, "printPlugin");
  function nO(e, t) {
    for (let r = 0; r < e.length; r++)
      try {
        if (e[r].test(t))
          return e[r];
      } catch (n) {
        throw new wu(n.message, n.stack);
      }
    return null;
  }
  o(nO, "findPlugin");
  function Qt(e, t, r, n, i, a) {
    let s = nO(t.plugins, e);
    if (s !== null)
      return rO(s, e, t, r, n, i);
    let l = eO(
      e,
      t.printFunctionName,
      t.escapeRegex,
      t.escapeString
    );
    return l !== null ? l : tO(
      e,
      t,
      r,
      n,
      i,
      a
    );
  }
  o(Qt, "printer");
  var Gb = {
    comment: "gray",
    content: "reset",
    prop: "yellow",
    tag: "cyan",
    value: "green"
  }, oO = Object.keys(Gb), ft = {
    callToJSON: !0,
    compareKeys: void 0,
    escapeRegex: !1,
    escapeString: !0,
    highlight: !1,
    indent: 2,
    maxDepth: 1 / 0,
    min: !1,
    plugins: [],
    printBasicPrototype: !0,
    printFunctionName: !0,
    theme: Gb
  };
  qt.DEFAULT_OPTIONS = ft;
  function TW(e) {
    if (Object.keys(e).forEach((t) => {
      if (!ft.hasOwnProperty(t))
        throw new Error(`pretty-format: Unknown option "${t}".`);
    }), e.min && e.indent !== void 0 && e.indent !== 0)
      throw new Error(
        'pretty-format: Options "min" and "indent" cannot be used together.'
      );
    if (e.theme !== void 0) {
      if (e.theme === null)
        throw new Error('pretty-format: Option "theme" must not be null.');
      if (typeof e.theme != "object")
        throw new Error(
          `pretty-format: Option "theme" must be of type "object" but instead received "${typeof e.theme}".`
        );
    }
  }
  o(TW, "validateOptions");
  var OW = /* @__PURE__ */ o((e) => oO.reduce((t, r) => {
    let n = e.theme && e.theme[r] !== void 0 ? e.theme[r] : Gb[r], i = n && dW.default[n];
    if (i && typeof i.close == "string" && typeof i.open == "string")
      t[r] = i;
    else
      throw new Error(
        `pretty-format: Option "theme" has a key "${r}" whose value "${n}" is undefined in ansi-styles.`
      );
    return t;
  }, /* @__PURE__ */ Object.create(null)), "getColorsHighlight"), SW = /* @__PURE__ */ o(() => oO.reduce((e, t) => (e[t] = {
    close: "",
    open: ""
  }, e), /* @__PURE__ */ Object.create(null)), "getColorsEmpty"), iO = /* @__PURE__ */ o((e) => e && e.printFunctionName !== void 0 ? e.printFunctionName :
  ft.printFunctionName, "getPrintFunctionName"), aO = /* @__PURE__ */ o((e) => e && e.escapeRegex !== void 0 ? e.escapeRegex : ft.escapeRegex,
  "getEscapeRegex"), sO = /* @__PURE__ */ o((e) => e && e.escapeString !== void 0 ? e.escapeString : ft.escapeString, "getEscapeString"), QT = /* @__PURE__ */ o(
  (e) => {
    var t;
    return {
      callToJSON: e && e.callToJSON !== void 0 ? e.callToJSON : ft.callToJSON,
      colors: e && e.highlight ? OW(e) : SW(),
      compareKeys: e && typeof e.compareKeys == "function" ? e.compareKeys : ft.compareKeys,
      escapeRegex: aO(e),
      escapeString: sO(e),
      indent: e && e.min ? "" : MW(
        e && e.indent !== void 0 ? e.indent : ft.indent
      ),
      maxDepth: e && e.maxDepth !== void 0 ? e.maxDepth : ft.maxDepth,
      min: e && e.min !== void 0 ? e.min : ft.min,
      plugins: e && e.plugins !== void 0 ? e.plugins : ft.plugins,
      printBasicPrototype: (t = e?.printBasicPrototype) !== null && t !== void 0 ? t : !0,
      printFunctionName: iO(e),
      spacingInner: e && e.min ? " " : `
`,
      spacingOuter: e && e.min ? "" : `
`
    };
  }, "getConfig");
  function MW(e) {
    return new Array(e + 1).join(" ");
  }
  o(MW, "createIndent");
  function lO(e, t) {
    if (t && (TW(t), t.plugins)) {
      let n = nO(t.plugins, e);
      if (n !== null)
        return rO(n, e, QT(t), "", 0, []);
    }
    let r = eO(
      e,
      iO(t),
      aO(t),
      sO(t)
    );
    return r !== null ? r : tO(e, QT(t), "", 0, []);
  }
  o(lO, "format");
  var AW = {
    AsymmetricMatcher: fW.default,
    ConvertAnsi: pW.default,
    DOMCollection: mW.default,
    DOMElement: hW.default,
    Immutable: bW.default,
    ReactElement: yW.default,
    ReactTestComponent: gW.default
  };
  qt.plugins = AW;
  var NW = lO;
  qt.default = NW;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/util/iteratorProxy.js
var AO = p((_u) => {
  "use strict";
  Object.defineProperty(_u, "__esModule", {
    value: !0
  });
  _u.default = void 0;
  function dG() {
    var e = this, t = 0, r = {
      "@@iterator": /* @__PURE__ */ o(function() {
        return r;
      }, "iterator"),
      next: /* @__PURE__ */ o(function() {
        if (t < e.length) {
          var i = e[t];
          return t = t + 1, {
            done: !1,
            value: i
          };
        } else
          return {
            done: !0
          };
      }, "next")
    };
    return r;
  }
  o(dG, "iteratorProxy");
  var fG = dG;
  _u.default = fG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/util/iterationDecorator.js
var hn = p((Jb) => {
  "use strict";
  Object.defineProperty(Jb, "__esModule", {
    value: !0
  });
  Jb.default = hG;
  var pG = mG(AO());
  function mG(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(mG, "_interopRequireDefault");
  function Xb(e) {
    "@babel/helpers - typeof";
    return Xb = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
      return typeof t;
    } : function(t) {
      return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
    }, Xb(e);
  }
  o(Xb, "_typeof");
  function hG(e, t) {
    return typeof Symbol == "function" && Xb(Symbol.iterator) === "symbol" && Object.defineProperty(e, Symbol.iterator, {
      value: pG.default.bind(t)
    }), e;
  }
  o(hG, "iterationDecorator");
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/ariaPropsMap.js
var jO = p((Pu) => {
  "use strict";
  Object.defineProperty(Pu, "__esModule", {
    value: !0
  });
  Pu.default = void 0;
  var bG = yG(hn());
  function yG(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(yG, "_interopRequireDefault");
  function Qb(e, t) {
    return wG(e) || vG(e, t) || IO(e, t) || gG();
  }
  o(Qb, "_slicedToArray");
  function gG() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(gG, "_nonIterableRest");
  function vG(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n = [], i = !0, a = !1, s, l;
      try {
        for (r = r.call(e); !(i = (s = r.next()).done) && (n.push(s.value), !(t && n.length === t)); i = !0)
          ;
      } catch (c) {
        a = !0, l = c;
      } finally {
        try {
          !i && r.return != null && r.return();
        } finally {
          if (a) throw l;
        }
      }
      return n;
    }
  }
  o(vG, "_iterableToArrayLimit");
  function wG(e) {
    if (Array.isArray(e)) return e;
  }
  o(wG, "_arrayWithHoles");
  function EG(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = IO(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a = !0, s = !1, l;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return a = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        !a && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  o(EG, "_createForOfIteratorHelper");
  function IO(e, t) {
    if (e) {
      if (typeof e == "string") return NO(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return NO(e, t);
    }
  }
  o(IO, "_unsupportedIterableToArray");
  function NO(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++)
      n[r] = e[r];
    return n;
  }
  o(NO, "_arrayLikeToArray");
  var bn = [["aria-activedescendant", {
    type: "id"
  }], ["aria-atomic", {
    type: "boolean"
  }], ["aria-autocomplete", {
    type: "token",
    values: ["inline", "list", "both", "none"]
  }], ["aria-braillelabel", {
    type: "string"
  }], ["aria-brailleroledescription", {
    type: "string"
  }], ["aria-busy", {
    type: "boolean"
  }], ["aria-checked", {
    type: "tristate"
  }], ["aria-colcount", {
    type: "integer"
  }], ["aria-colindex", {
    type: "integer"
  }], ["aria-colspan", {
    type: "integer"
  }], ["aria-controls", {
    type: "idlist"
  }], ["aria-current", {
    type: "token",
    values: ["page", "step", "location", "date", "time", !0, !1]
  }], ["aria-describedby", {
    type: "idlist"
  }], ["aria-description", {
    type: "string"
  }], ["aria-details", {
    type: "id"
  }], ["aria-disabled", {
    type: "boolean"
  }], ["aria-dropeffect", {
    type: "tokenlist",
    values: ["copy", "execute", "link", "move", "none", "popup"]
  }], ["aria-errormessage", {
    type: "id"
  }], ["aria-expanded", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-flowto", {
    type: "idlist"
  }], ["aria-grabbed", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-haspopup", {
    type: "token",
    values: [!1, !0, "menu", "listbox", "tree", "grid", "dialog"]
  }], ["aria-hidden", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-invalid", {
    type: "token",
    values: ["grammar", !1, "spelling", !0]
  }], ["aria-keyshortcuts", {
    type: "string"
  }], ["aria-label", {
    type: "string"
  }], ["aria-labelledby", {
    type: "idlist"
  }], ["aria-level", {
    type: "integer"
  }], ["aria-live", {
    type: "token",
    values: ["assertive", "off", "polite"]
  }], ["aria-modal", {
    type: "boolean"
  }], ["aria-multiline", {
    type: "boolean"
  }], ["aria-multiselectable", {
    type: "boolean"
  }], ["aria-orientation", {
    type: "token",
    values: ["vertical", "undefined", "horizontal"]
  }], ["aria-owns", {
    type: "idlist"
  }], ["aria-placeholder", {
    type: "string"
  }], ["aria-posinset", {
    type: "integer"
  }], ["aria-pressed", {
    type: "tristate"
  }], ["aria-readonly", {
    type: "boolean"
  }], ["aria-relevant", {
    type: "tokenlist",
    values: ["additions", "all", "removals", "text"]
  }], ["aria-required", {
    type: "boolean"
  }], ["aria-roledescription", {
    type: "string"
  }], ["aria-rowcount", {
    type: "integer"
  }], ["aria-rowindex", {
    type: "integer"
  }], ["aria-rowspan", {
    type: "integer"
  }], ["aria-selected", {
    type: "boolean",
    allowundefined: !0
  }], ["aria-setsize", {
    type: "integer"
  }], ["aria-sort", {
    type: "token",
    values: ["ascending", "descending", "none", "other"]
  }], ["aria-valuemax", {
    type: "number"
  }], ["aria-valuemin", {
    type: "number"
  }], ["aria-valuenow", {
    type: "number"
  }], ["aria-valuetext", {
    type: "string"
  }]], Zb = {
    entries: /* @__PURE__ */ o(function() {
      return bn;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = EG(bn), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = Qb(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, bn);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = bn.find(function(n) {
        return n[0] === t;
      });
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!Zb.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return bn.map(function(t) {
        var r = Qb(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return bn.map(function(t) {
        var r = Qb(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, CG = (0, bG.default)(Zb, Zb.entries());
  Pu.default = CG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/domMap.js
var $O = p((qu) => {
  "use strict";
  Object.defineProperty(qu, "__esModule", {
    value: !0
  });
  qu.default = void 0;
  var xG = _G(hn());
  function _G(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(_G, "_interopRequireDefault");
  function ey(e, t) {
    return RG(e) || qG(e, t) || LO(e, t) || PG();
  }
  o(ey, "_slicedToArray");
  function PG() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(PG, "_nonIterableRest");
  function qG(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n = [], i = !0, a = !1, s, l;
      try {
        for (r = r.call(e); !(i = (s = r.next()).done) && (n.push(s.value), !(t && n.length === t)); i = !0)
          ;
      } catch (c) {
        a = !0, l = c;
      } finally {
        try {
          !i && r.return != null && r.return();
        } finally {
          if (a) throw l;
        }
      }
      return n;
    }
  }
  o(qG, "_iterableToArrayLimit");
  function RG(e) {
    if (Array.isArray(e)) return e;
  }
  o(RG, "_arrayWithHoles");
  function TG(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = LO(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a = !0, s = !1, l;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return a = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        !a && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  o(TG, "_createForOfIteratorHelper");
  function LO(e, t) {
    if (e) {
      if (typeof e == "string") return kO(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return kO(e, t);
    }
  }
  o(LO, "_unsupportedIterableToArray");
  function kO(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++)
      n[r] = e[r];
    return n;
  }
  o(kO, "_arrayLikeToArray");
  var yn = [["a", {
    reserved: !1
  }], ["abbr", {
    reserved: !1
  }], ["acronym", {
    reserved: !1
  }], ["address", {
    reserved: !1
  }], ["applet", {
    reserved: !1
  }], ["area", {
    reserved: !1
  }], ["article", {
    reserved: !1
  }], ["aside", {
    reserved: !1
  }], ["audio", {
    reserved: !1
  }], ["b", {
    reserved: !1
  }], ["base", {
    reserved: !0
  }], ["bdi", {
    reserved: !1
  }], ["bdo", {
    reserved: !1
  }], ["big", {
    reserved: !1
  }], ["blink", {
    reserved: !1
  }], ["blockquote", {
    reserved: !1
  }], ["body", {
    reserved: !1
  }], ["br", {
    reserved: !1
  }], ["button", {
    reserved: !1
  }], ["canvas", {
    reserved: !1
  }], ["caption", {
    reserved: !1
  }], ["center", {
    reserved: !1
  }], ["cite", {
    reserved: !1
  }], ["code", {
    reserved: !1
  }], ["col", {
    reserved: !0
  }], ["colgroup", {
    reserved: !0
  }], ["content", {
    reserved: !1
  }], ["data", {
    reserved: !1
  }], ["datalist", {
    reserved: !1
  }], ["dd", {
    reserved: !1
  }], ["del", {
    reserved: !1
  }], ["details", {
    reserved: !1
  }], ["dfn", {
    reserved: !1
  }], ["dialog", {
    reserved: !1
  }], ["dir", {
    reserved: !1
  }], ["div", {
    reserved: !1
  }], ["dl", {
    reserved: !1
  }], ["dt", {
    reserved: !1
  }], ["em", {
    reserved: !1
  }], ["embed", {
    reserved: !1
  }], ["fieldset", {
    reserved: !1
  }], ["figcaption", {
    reserved: !1
  }], ["figure", {
    reserved: !1
  }], ["font", {
    reserved: !1
  }], ["footer", {
    reserved: !1
  }], ["form", {
    reserved: !1
  }], ["frame", {
    reserved: !1
  }], ["frameset", {
    reserved: !1
  }], ["h1", {
    reserved: !1
  }], ["h2", {
    reserved: !1
  }], ["h3", {
    reserved: !1
  }], ["h4", {
    reserved: !1
  }], ["h5", {
    reserved: !1
  }], ["h6", {
    reserved: !1
  }], ["head", {
    reserved: !0
  }], ["header", {
    reserved: !1
  }], ["hgroup", {
    reserved: !1
  }], ["hr", {
    reserved: !1
  }], ["html", {
    reserved: !0
  }], ["i", {
    reserved: !1
  }], ["iframe", {
    reserved: !1
  }], ["img", {
    reserved: !1
  }], ["input", {
    reserved: !1
  }], ["ins", {
    reserved: !1
  }], ["kbd", {
    reserved: !1
  }], ["keygen", {
    reserved: !1
  }], ["label", {
    reserved: !1
  }], ["legend", {
    reserved: !1
  }], ["li", {
    reserved: !1
  }], ["link", {
    reserved: !0
  }], ["main", {
    reserved: !1
  }], ["map", {
    reserved: !1
  }], ["mark", {
    reserved: !1
  }], ["marquee", {
    reserved: !1
  }], ["menu", {
    reserved: !1
  }], ["menuitem", {
    reserved: !1
  }], ["meta", {
    reserved: !0
  }], ["meter", {
    reserved: !1
  }], ["nav", {
    reserved: !1
  }], ["noembed", {
    reserved: !0
  }], ["noscript", {
    reserved: !0
  }], ["object", {
    reserved: !1
  }], ["ol", {
    reserved: !1
  }], ["optgroup", {
    reserved: !1
  }], ["option", {
    reserved: !1
  }], ["output", {
    reserved: !1
  }], ["p", {
    reserved: !1
  }], ["param", {
    reserved: !0
  }], ["picture", {
    reserved: !0
  }], ["pre", {
    reserved: !1
  }], ["progress", {
    reserved: !1
  }], ["q", {
    reserved: !1
  }], ["rp", {
    reserved: !1
  }], ["rt", {
    reserved: !1
  }], ["rtc", {
    reserved: !1
  }], ["ruby", {
    reserved: !1
  }], ["s", {
    reserved: !1
  }], ["samp", {
    reserved: !1
  }], ["script", {
    reserved: !0
  }], ["section", {
    reserved: !1
  }], ["select", {
    reserved: !1
  }], ["small", {
    reserved: !1
  }], ["source", {
    reserved: !0
  }], ["spacer", {
    reserved: !1
  }], ["span", {
    reserved: !1
  }], ["strike", {
    reserved: !1
  }], ["strong", {
    reserved: !1
  }], ["style", {
    reserved: !0
  }], ["sub", {
    reserved: !1
  }], ["summary", {
    reserved: !1
  }], ["sup", {
    reserved: !1
  }], ["table", {
    reserved: !1
  }], ["tbody", {
    reserved: !1
  }], ["td", {
    reserved: !1
  }], ["textarea", {
    reserved: !1
  }], ["tfoot", {
    reserved: !1
  }], ["th", {
    reserved: !1
  }], ["thead", {
    reserved: !1
  }], ["time", {
    reserved: !1
  }], ["title", {
    reserved: !0
  }], ["tr", {
    reserved: !1
  }], ["track", {
    reserved: !0
  }], ["tt", {
    reserved: !1
  }], ["u", {
    reserved: !1
  }], ["ul", {
    reserved: !1
  }], ["var", {
    reserved: !1
  }], ["video", {
    reserved: !1
  }], ["wbr", {
    reserved: !1
  }], ["xmp", {
    reserved: !1
  }]], ty = {
    entries: /* @__PURE__ */ o(function() {
      return yn;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = TG(yn), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = ey(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, yn);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = yn.find(function(n) {
        return n[0] === t;
      });
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!ty.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return yn.map(function(t) {
        var r = ey(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return yn.map(function(t) {
        var r = ey(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, OG = (0, xG.default)(ty, ty.entries());
  qu.default = OG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/commandRole.js
var BO = p((Ru) => {
  "use strict";
  Object.defineProperty(Ru, "__esModule", {
    value: !0
  });
  Ru.default = void 0;
  var SG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, MG = SG;
  Ru.default = MG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/compositeRole.js
var DO = p((Tu) => {
  "use strict";
  Object.defineProperty(Tu, "__esModule", {
    value: !0
  });
  Tu.default = void 0;
  var AG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, NG = AG;
  Tu.default = NG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/inputRole.js
var FO = p((Ou) => {
  "use strict";
  Object.defineProperty(Ou, "__esModule", {
    value: !0
  });
  Ou.default = void 0;
  var IG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null
    },
    relatedConcepts: [{
      concept: {
        name: "input"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget"]]
  }, jG = IG;
  Ou.default = jG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/landmarkRole.js
var UO = p((Su) => {
  "use strict";
  Object.defineProperty(Su, "__esModule", {
    value: !0
  });
  Su.default = void 0;
  var kG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, LG = kG;
  Su.default = LG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/rangeRole.js
var HO = p((Mu) => {
  "use strict";
  Object.defineProperty(Mu, "__esModule", {
    value: !0
  });
  Mu.default = void 0;
  var $G = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuemax": null,
      "aria-valuemin": null,
      "aria-valuenow": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, BG = $G;
  Mu.default = BG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/roletypeRole.js
var VO = p((Au) => {
  "use strict";
  Object.defineProperty(Au, "__esModule", {
    value: !0
  });
  Au.default = void 0;
  var DG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {
      "aria-atomic": null,
      "aria-busy": null,
      "aria-controls": null,
      "aria-current": null,
      "aria-describedby": null,
      "aria-details": null,
      "aria-dropeffect": null,
      "aria-flowto": null,
      "aria-grabbed": null,
      "aria-hidden": null,
      "aria-keyshortcuts": null,
      "aria-label": null,
      "aria-labelledby": null,
      "aria-live": null,
      "aria-owns": null,
      "aria-relevant": null,
      "aria-roledescription": null
    },
    relatedConcepts: [{
      concept: {
        name: "role"
      },
      module: "XHTML"
    }, {
      concept: {
        name: "type"
      },
      module: "Dublin Core"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: []
  }, FG = DG;
  Au.default = FG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/sectionRole.js
var zO = p((Nu) => {
  "use strict";
  Object.defineProperty(Nu, "__esModule", {
    value: !0
  });
  Nu.default = void 0;
  var UG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "frontmatter"
      },
      module: "DTB"
    }, {
      concept: {
        name: "level"
      },
      module: "DTB"
    }, {
      concept: {
        name: "level"
      },
      module: "SMIL"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, HG = UG;
  Nu.default = HG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/sectionheadRole.js
var WO = p((Iu) => {
  "use strict";
  Object.defineProperty(Iu, "__esModule", {
    value: !0
  });
  Iu.default = void 0;
  var VG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, zG = VG;
  Iu.default = zG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/selectRole.js
var GO = p((ju) => {
  "use strict";
  Object.defineProperty(ju, "__esModule", {
    value: !0
  });
  ju.default = void 0;
  var WG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "structure", "section", "group"]]
  }, GG = WG;
  ju.default = GG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/structureRole.js
var KO = p((ku) => {
  "use strict";
  Object.defineProperty(ku, "__esModule", {
    value: !0
  });
  ku.default = void 0;
  var KG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, YG = KG;
  ku.default = YG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/widgetRole.js
var YO = p((Lu) => {
  "use strict";
  Object.defineProperty(Lu, "__esModule", {
    value: !0
  });
  Lu.default = void 0;
  var XG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, JG = XG;
  Lu.default = JG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/abstract/windowRole.js
var XO = p(($u) => {
  "use strict";
  Object.defineProperty($u, "__esModule", {
    value: !0
  });
  $u.default = void 0;
  var QG = {
    abstract: !0,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-modal": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype"]]
  }, ZG = QG;
  $u.default = ZG;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/ariaAbstractRoles.js
var JO = p((Bu) => {
  "use strict";
  Object.defineProperty(Bu, "__esModule", {
    value: !0
  });
  Bu.default = void 0;
  var eK = nt(BO()), tK = nt(DO()), rK = nt(FO()), nK = nt(UO()), oK = nt(HO()), iK = nt(VO()), aK = nt(zO()), sK = nt(WO()), lK = nt(GO()),
  uK = nt(KO()), cK = nt(YO()), dK = nt(XO());
  function nt(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(nt, "_interopRequireDefault");
  var fK = [["command", eK.default], ["composite", tK.default], ["input", rK.default], ["landmark", nK.default], ["range", oK.default], ["ro\
letype", iK.default], ["section", aK.default], ["sectionhead", sK.default], ["select", lK.default], ["structure", uK.default], ["widget", cK.
  default], ["window", dK.default]], pK = fK;
  Bu.default = pK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/alertRole.js
var QO = p((Du) => {
  "use strict";
  Object.defineProperty(Du, "__esModule", {
    value: !0
  });
  Du.default = void 0;
  var mK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-atomic": "true",
      "aria-live": "assertive"
    },
    relatedConcepts: [{
      concept: {
        name: "alert"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, hK = mK;
  Du.default = hK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/alertdialogRole.js
var ZO = p((Fu) => {
  "use strict";
  Object.defineProperty(Fu, "__esModule", {
    value: !0
  });
  Fu.default = void 0;
  var bK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "alert"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "alert"], ["roletype", "window", "dialog"]]
  }, yK = bK;
  Fu.default = yK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/applicationRole.js
var eS = p((Uu) => {
  "use strict";
  Object.defineProperty(Uu, "__esModule", {
    value: !0
  });
  Uu.default = void 0;
  var gK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "Device Independence Delivery Unit"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, vK = gK;
  Uu.default = vK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/articleRole.js
var tS = p((Hu) => {
  "use strict";
  Object.defineProperty(Hu, "__esModule", {
    value: !0
  });
  Hu.default = void 0;
  var wK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "article"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "document"]]
  }, EK = wK;
  Hu.default = EK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/bannerRole.js
var rS = p((Vu) => {
  "use strict";
  Object.defineProperty(Vu, "__esModule", {
    value: !0
  });
  Vu.default = void 0;
  var CK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        constraints: ["scoped to the body element"],
        name: "header"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, xK = CK;
  Vu.default = xK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/blockquoteRole.js
var nS = p((zu) => {
  "use strict";
  Object.defineProperty(zu, "__esModule", {
    value: !0
  });
  zu.default = void 0;
  var _K = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "blockquote"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, PK = _K;
  zu.default = PK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/buttonRole.js
var oS = p((Wu) => {
  "use strict";
  Object.defineProperty(Wu, "__esModule", {
    value: !0
  });
  Wu.default = void 0;
  var qK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-pressed": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "button"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "image"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "reset"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "type",
          value: "submit"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "button"
      },
      module: "HTML"
    }, {
      concept: {
        name: "trigger"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, RK = qK;
  Wu.default = RK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/captionRole.js
var iS = p((Gu) => {
  "use strict";
  Object.defineProperty(Gu, "__esModule", {
    value: !0
  });
  Gu.default = void 0;
  var TK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "caption"
      },
      module: "HTML"
    }],
    requireContextRole: ["figure", "grid", "table"],
    requiredContextRole: ["figure", "grid", "table"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, OK = TK;
  Gu.default = OK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/cellRole.js
var aS = p((Ku) => {
  "use strict";
  Object.defineProperty(Ku, "__esModule", {
    value: !0
  });
  Ku.default = void 0;
  var SK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-colindex": null,
      "aria-colspan": null,
      "aria-rowindex": null,
      "aria-rowspan": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["ancestor table element has table role"],
        name: "td"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, MK = SK;
  Ku.default = MK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/checkboxRole.js
var sS = p((Yu) => {
  "use strict";
  Object.defineProperty(Yu, "__esModule", {
    value: !0
  });
  Yu.default = void 0;
  var AK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "checkbox"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "option"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input"]]
  }, NK = AK;
  Yu.default = NK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/codeRole.js
var lS = p((Xu) => {
  "use strict";
  Object.defineProperty(Xu, "__esModule", {
    value: !0
  });
  Xu.default = void 0;
  var IK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "code"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, jK = IK;
  Xu.default = jK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/columnheaderRole.js
var uS = p((Ju) => {
  "use strict";
  Object.defineProperty(Ju, "__esModule", {
    value: !0
  });
  Ju.default = void 0;
  var kK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-sort": null
    },
    relatedConcepts: [{
      concept: {
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "col"
        }],
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "colgroup"
        }],
        name: "th"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "structure", "section", "cell", "gridcell"], ["roletype", "widge\
t", "gridcell"], ["roletype", "structure", "sectionhead"]]
  }, LK = kK;
  Ju.default = LK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/comboboxRole.js
var cS = p((Qu) => {
  "use strict";
  Object.defineProperty(Qu, "__esModule", {
    value: !0
  });
  Qu.default = void 0;
  var $K = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-autocomplete": null,
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-expanded": "false",
      "aria-haspopup": "listbox"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "email"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "search"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "tel"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "text"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "multiple"
        }, {
          constraints: ["undefined"],
          name: "size"
        }],
        constraints: ["the multiple attribute is not set and the size attribute does not have a value greater than 1"],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-controls": null,
      "aria-expanded": "false"
    },
    superClass: [["roletype", "widget", "input"]]
  }, BK = $K;
  Qu.default = BK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/complementaryRole.js
var dS = p((Zu) => {
  "use strict";
  Object.defineProperty(Zu, "__esModule", {
    value: !0
  });
  Zu.default = void 0;
  var DK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        constraints: ["scoped to a sectioning content element", "scoped to a sectioning root element other than body"],
        name: "aside"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, FK = DK;
  Zu.default = FK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/contentinfoRole.js
var fS = p((ec) => {
  "use strict";
  Object.defineProperty(ec, "__esModule", {
    value: !0
  });
  ec.default = void 0;
  var UK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        constraints: ["scoped to the body element"],
        name: "footer"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, HK = UK;
  ec.default = HK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/definitionRole.js
var pS = p((tc) => {
  "use strict";
  Object.defineProperty(tc, "__esModule", {
    value: !0
  });
  tc.default = void 0;
  var VK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dd"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, zK = VK;
  tc.default = zK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/deletionRole.js
var mS = p((rc) => {
  "use strict";
  Object.defineProperty(rc, "__esModule", {
    value: !0
  });
  rc.default = void 0;
  var WK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "del"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, GK = WK;
  rc.default = GK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/dialogRole.js
var hS = p((nc) => {
  "use strict";
  Object.defineProperty(nc, "__esModule", {
    value: !0
  });
  nc.default = void 0;
  var KK = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dialog"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "window"]]
  }, YK = KK;
  nc.default = YK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/directoryRole.js
var bS = p((oc) => {
  "use strict";
  Object.defineProperty(oc, "__esModule", {
    value: !0
  });
  oc.default = void 0;
  var XK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      module: "DAISY Guide"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "list"]]
  }, JK = XK;
  oc.default = JK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/documentRole.js
var yS = p((ic) => {
  "use strict";
  Object.defineProperty(ic, "__esModule", {
    value: !0
  });
  ic.default = void 0;
  var QK = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "Device Independence Delivery Unit"
      }
    }, {
      concept: {
        name: "html"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, ZK = QK;
  ic.default = ZK;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/emphasisRole.js
var gS = p((ac) => {
  "use strict";
  Object.defineProperty(ac, "__esModule", {
    value: !0
  });
  ac.default = void 0;
  var e7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "em"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, t7 = e7;
  ac.default = t7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/feedRole.js
var vS = p((sc) => {
  "use strict";
  Object.defineProperty(sc, "__esModule", {
    value: !0
  });
  sc.default = void 0;
  var r7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["article"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "list"]]
  }, n7 = r7;
  sc.default = n7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/figureRole.js
var wS = p((lc) => {
  "use strict";
  Object.defineProperty(lc, "__esModule", {
    value: !0
  });
  lc.default = void 0;
  var o7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "figure"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, i7 = o7;
  lc.default = i7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/formRole.js
var ES = p((uc) => {
  "use strict";
  Object.defineProperty(uc, "__esModule", {
    value: !0
  });
  uc.default = void 0;
  var a7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        name: "form"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        name: "form"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "name"
        }],
        name: "form"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, s7 = a7;
  uc.default = s7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/genericRole.js
var CS = p((cc) => {
  "use strict";
  Object.defineProperty(cc, "__esModule", {
    value: !0
  });
  cc.default = void 0;
  var l7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "a"
      },
      module: "HTML"
    }, {
      concept: {
        name: "area"
      },
      module: "HTML"
    }, {
      concept: {
        name: "aside"
      },
      module: "HTML"
    }, {
      concept: {
        name: "b"
      },
      module: "HTML"
    }, {
      concept: {
        name: "bdo"
      },
      module: "HTML"
    }, {
      concept: {
        name: "body"
      },
      module: "HTML"
    }, {
      concept: {
        name: "data"
      },
      module: "HTML"
    }, {
      concept: {
        name: "div"
      },
      module: "HTML"
    }, {
      concept: {
        constraints: ["scoped to the main element", "scoped to a sectioning content element", "scoped to a sectioning root element other tha\
n body"],
        name: "footer"
      },
      module: "HTML"
    }, {
      concept: {
        constraints: ["scoped to the main element", "scoped to a sectioning content element", "scoped to a sectioning root element other tha\
n body"],
        name: "header"
      },
      module: "HTML"
    }, {
      concept: {
        name: "hgroup"
      },
      module: "HTML"
    }, {
      concept: {
        name: "i"
      },
      module: "HTML"
    }, {
      concept: {
        name: "pre"
      },
      module: "HTML"
    }, {
      concept: {
        name: "q"
      },
      module: "HTML"
    }, {
      concept: {
        name: "samp"
      },
      module: "HTML"
    }, {
      concept: {
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        name: "small"
      },
      module: "HTML"
    }, {
      concept: {
        name: "span"
      },
      module: "HTML"
    }, {
      concept: {
        name: "u"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, u7 = l7;
  cc.default = u7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/gridRole.js
var xS = p((dc) => {
  "use strict";
  Object.defineProperty(dc, "__esModule", {
    value: !0
  });
  dc.default = void 0;
  var c7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-multiselectable": null,
      "aria-readonly": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "structure", "section", "table"]]
  }, d7 = c7;
  dc.default = d7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/gridcellRole.js
var _S = p((fc) => {
  "use strict";
  Object.defineProperty(fc, "__esModule", {
    value: !0
  });
  fc.default = void 0;
  var f7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-selected": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["ancestor table element has grid role", "ancestor table element has treegrid role"],
        name: "td"
      },
      module: "HTML"
    }],
    requireContextRole: ["row"],
    requiredContextRole: ["row"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "widget"]]
  }, p7 = f7;
  fc.default = p7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/groupRole.js
var PS = p((pc) => {
  "use strict";
  Object.defineProperty(pc, "__esModule", {
    value: !0
  });
  pc.default = void 0;
  var m7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-disabled": null
    },
    relatedConcepts: [{
      concept: {
        name: "details"
      },
      module: "HTML"
    }, {
      concept: {
        name: "fieldset"
      },
      module: "HTML"
    }, {
      concept: {
        name: "optgroup"
      },
      module: "HTML"
    }, {
      concept: {
        name: "address"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, h7 = m7;
  pc.default = h7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/headingRole.js
var qS = p((mc) => {
  "use strict";
  Object.defineProperty(mc, "__esModule", {
    value: !0
  });
  mc.default = void 0;
  var b7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-level": "2"
    },
    relatedConcepts: [{
      concept: {
        name: "h1"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h2"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h3"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h4"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h5"
      },
      module: "HTML"
    }, {
      concept: {
        name: "h6"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-level": "2"
    },
    superClass: [["roletype", "structure", "sectionhead"]]
  }, y7 = b7;
  mc.default = y7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/imgRole.js
var RS = p((hc) => {
  "use strict";
  Object.defineProperty(hc, "__esModule", {
    value: !0
  });
  hc.default = void 0;
  var g7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "alt"
        }],
        name: "img"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "alt"
        }],
        name: "img"
      },
      module: "HTML"
    }, {
      concept: {
        name: "imggroup"
      },
      module: "DTB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, v7 = g7;
  hc.default = v7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/insertionRole.js
var TS = p((bc) => {
  "use strict";
  Object.defineProperty(bc, "__esModule", {
    value: !0
  });
  bc.default = void 0;
  var w7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "ins"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, E7 = w7;
  bc.default = E7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/linkRole.js
var OS = p((yc) => {
  "use strict";
  Object.defineProperty(yc, "__esModule", {
    value: !0
  });
  yc.default = void 0;
  var C7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "href"
        }],
        name: "a"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "href"
        }],
        name: "area"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, x7 = C7;
  yc.default = x7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/listRole.js
var SS = p((gc) => {
  "use strict";
  Object.defineProperty(gc, "__esModule", {
    value: !0
  });
  gc.default = void 0;
  var _7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menu"
      },
      module: "HTML"
    }, {
      concept: {
        name: "ol"
      },
      module: "HTML"
    }, {
      concept: {
        name: "ul"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["listitem"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, P7 = _7;
  gc.default = P7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/listboxRole.js
var MS = p((vc) => {
  "use strict";
  Object.defineProperty(vc, "__esModule", {
    value: !0
  });
  vc.default = void 0;
  var q7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-invalid": null,
      "aria-multiselectable": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-orientation": "vertical"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: [">1"],
          name: "size"
        }],
        constraints: ["the size attribute value is greater than 1"],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "multiple"
        }],
        name: "select"
      },
      module: "HTML"
    }, {
      concept: {
        name: "datalist"
      },
      module: "HTML"
    }, {
      concept: {
        name: "list"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["option", "group"], ["option"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, R7 = q7;
  vc.default = R7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/listitemRole.js
var AS = p((wc) => {
  "use strict";
  Object.defineProperty(wc, "__esModule", {
    value: !0
  });
  wc.default = void 0;
  var T7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-level": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        constraints: ["direct descendant of ol", "direct descendant of ul", "direct descendant of menu"],
        name: "li"
      },
      module: "HTML"
    }, {
      concept: {
        name: "item"
      },
      module: "XForms"
    }],
    requireContextRole: ["directory", "list"],
    requiredContextRole: ["directory", "list"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, O7 = T7;
  wc.default = O7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/logRole.js
var NS = p((Ec) => {
  "use strict";
  Object.defineProperty(Ec, "__esModule", {
    value: !0
  });
  Ec.default = void 0;
  var S7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-live": "polite"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, M7 = S7;
  Ec.default = M7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/mainRole.js
var IS = p((Cc) => {
  "use strict";
  Object.defineProperty(Cc, "__esModule", {
    value: !0
  });
  Cc.default = void 0;
  var A7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "main"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, N7 = A7;
  Cc.default = N7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/markRole.js
var jS = p((xc) => {
  "use strict";
  Object.defineProperty(xc, "__esModule", {
    value: !0
  });
  xc.default = void 0;
  var I7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: [],
    props: {
      "aria-braillelabel": null,
      "aria-brailleroledescription": null,
      "aria-description": null
    },
    relatedConcepts: [{
      concept: {
        name: "mark"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, j7 = I7;
  xc.default = j7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/marqueeRole.js
var kS = p((_c) => {
  "use strict";
  Object.defineProperty(_c, "__esModule", {
    value: !0
  });
  _c.default = void 0;
  var k7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, L7 = k7;
  _c.default = L7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/mathRole.js
var LS = p((Pc) => {
  "use strict";
  Object.defineProperty(Pc, "__esModule", {
    value: !0
  });
  Pc.default = void 0;
  var $7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "math"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, B7 = $7;
  Pc.default = B7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/menuRole.js
var $S = p((qc) => {
  "use strict";
  Object.defineProperty(qc, "__esModule", {
    value: !0
  });
  qc.default = void 0;
  var D7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "vertical"
    },
    relatedConcepts: [{
      concept: {
        name: "MENU"
      },
      module: "JAPI"
    }, {
      concept: {
        name: "list"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "select"
      },
      module: "XForms"
    }, {
      concept: {
        name: "sidebar"
      },
      module: "DTB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["menuitem", "group"], ["menuitemradio", "group"], ["menuitemcheckbox", "group"], ["menuitem"], ["menuitemcheckb\
ox"], ["menuitemradio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, F7 = D7;
  qc.default = F7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/menubarRole.js
var BS = p((Rc) => {
  "use strict";
  Object.defineProperty(Rc, "__esModule", {
    value: !0
  });
  Rc.default = void 0;
  var U7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      concept: {
        name: "toolbar"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["menuitem", "group"], ["menuitemradio", "group"], ["menuitemcheckbox", "group"], ["menuitem"], ["menuitemcheckb\
ox"], ["menuitemradio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select", "menu"], ["roletype", "structure", "section", "group", "select", "menu"]]
  }, H7 = U7;
  Rc.default = H7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/menuitemRole.js
var DS = p((Tc) => {
  "use strict";
  Object.defineProperty(Tc, "__esModule", {
    value: !0
  });
  Tc.default = void 0;
  var V7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "MENU_ITEM"
      },
      module: "JAPI"
    }, {
      concept: {
        name: "listitem"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "option"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command"]]
  }, z7 = V7;
  Tc.default = z7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/menuitemcheckboxRole.js
var FS = p((Oc) => {
  "use strict";
  Object.defineProperty(Oc, "__esModule", {
    value: !0
  });
  Oc.default = void 0;
  var W7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menuitem"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox"], ["roletype", "widget", "command", "menuitem"]]
  }, G7 = W7;
  Oc.default = G7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/menuitemradioRole.js
var US = p((Sc) => {
  "use strict";
  Object.defineProperty(Sc, "__esModule", {
    value: !0
  });
  Sc.default = void 0;
  var K7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "menuitem"
      },
      module: "ARIA"
    }],
    requireContextRole: ["group", "menu", "menubar"],
    requiredContextRole: ["group", "menu", "menubar"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox", "menuitemcheckbox"], ["roletype", "widget", "command", "menuitem", "menuitemche\
ckbox"], ["roletype", "widget", "input", "radio"]]
  }, Y7 = K7;
  Sc.default = Y7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/meterRole.js
var HS = p((Mc) => {
  "use strict";
  Object.defineProperty(Mc, "__esModule", {
    value: !0
  });
  Mc.default = void 0;
  var X7 = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuetext": null,
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [{
      concept: {
        name: "meter"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-valuenow": null
    },
    superClass: [["roletype", "structure", "range"]]
  }, J7 = X7;
  Mc.default = J7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/navigationRole.js
var VS = p((Ac) => {
  "use strict";
  Object.defineProperty(Ac, "__esModule", {
    value: !0
  });
  Ac.default = void 0;
  var Q7 = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "nav"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, Z7 = Q7;
  Ac.default = Z7;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/noneRole.js
var zS = p((Nc) => {
  "use strict";
  Object.defineProperty(Nc, "__esModule", {
    value: !0
  });
  Nc.default = void 0;
  var eY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: [],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: []
  }, tY = eY;
  Nc.default = tY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/noteRole.js
var WS = p((Ic) => {
  "use strict";
  Object.defineProperty(Ic, "__esModule", {
    value: !0
  });
  Ic.default = void 0;
  var rY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, nY = rY;
  Ic.default = nY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/optionRole.js
var GS = p((jc) => {
  "use strict";
  Object.defineProperty(jc, "__esModule", {
    value: !0
  });
  jc.default = void 0;
  var oY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-posinset": null,
      "aria-setsize": null,
      "aria-selected": "false"
    },
    relatedConcepts: [{
      concept: {
        name: "item"
      },
      module: "XForms"
    }, {
      concept: {
        name: "listitem"
      },
      module: "ARIA"
    }, {
      concept: {
        name: "option"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-selected": "false"
    },
    superClass: [["roletype", "widget", "input"]]
  }, iY = oY;
  jc.default = iY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/paragraphRole.js
var KS = p((kc) => {
  "use strict";
  Object.defineProperty(kc, "__esModule", {
    value: !0
  });
  kc.default = void 0;
  var aY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "p"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, sY = aY;
  kc.default = sY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/presentationRole.js
var YS = p((Lc) => {
  "use strict";
  Object.defineProperty(Lc, "__esModule", {
    value: !0
  });
  Lc.default = void 0;
  var lY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "alt",
          value: ""
        }],
        name: "img"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, uY = lY;
  Lc.default = uY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/progressbarRole.js
var XS = p(($c) => {
  "use strict";
  Object.defineProperty($c, "__esModule", {
    value: !0
  });
  $c.default = void 0;
  var cY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-valuetext": null
    },
    relatedConcepts: [{
      concept: {
        name: "progress"
      },
      module: "HTML"
    }, {
      concept: {
        name: "status"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "range"], ["roletype", "widget"]]
  }, dY = cY;
  $c.default = dY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/radioRole.js
var JS = p((Bc) => {
  "use strict";
  Object.defineProperty(Bc, "__esModule", {
    value: !0
  });
  Bc.default = void 0;
  var fY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-checked": null,
      "aria-posinset": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "radio"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input"]]
  }, pY = fY;
  Bc.default = pY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/radiogroupRole.js
var QS = p((Dc) => {
  "use strict";
  Object.defineProperty(Dc, "__esModule", {
    value: !0
  });
  Dc.default = void 0;
  var mY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        name: "list"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["radio"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, hY = mY;
  Dc.default = hY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/regionRole.js
var ZS = p((Fc) => {
  "use strict";
  Object.defineProperty(Fc, "__esModule", {
    value: !0
  });
  Fc.default = void 0;
  var bY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-label"
        }],
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["set"],
          name: "aria-labelledby"
        }],
        name: "section"
      },
      module: "HTML"
    }, {
      concept: {
        name: "Device Independence Glossart perceivable unit"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, yY = bY;
  Fc.default = yY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/rowRole.js
var e1 = p((Uc) => {
  "use strict";
  Object.defineProperty(Uc, "__esModule", {
    value: !0
  });
  Uc.default = void 0;
  var gY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-colindex": null,
      "aria-expanded": null,
      "aria-level": null,
      "aria-posinset": null,
      "aria-rowindex": null,
      "aria-selected": null,
      "aria-setsize": null
    },
    relatedConcepts: [{
      concept: {
        name: "tr"
      },
      module: "HTML"
    }],
    requireContextRole: ["grid", "rowgroup", "table", "treegrid"],
    requiredContextRole: ["grid", "rowgroup", "table", "treegrid"],
    requiredOwnedElements: [["cell"], ["columnheader"], ["gridcell"], ["rowheader"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"], ["roletype", "widget"]]
  }, vY = gY;
  Uc.default = vY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/rowgroupRole.js
var t1 = p((Hc) => {
  "use strict";
  Object.defineProperty(Hc, "__esModule", {
    value: !0
  });
  Hc.default = void 0;
  var wY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "tbody"
      },
      module: "HTML"
    }, {
      concept: {
        name: "tfoot"
      },
      module: "HTML"
    }, {
      concept: {
        name: "thead"
      },
      module: "HTML"
    }],
    requireContextRole: ["grid", "table", "treegrid"],
    requiredContextRole: ["grid", "table", "treegrid"],
    requiredOwnedElements: [["row"]],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, EY = wY;
  Hc.default = EY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/rowheaderRole.js
var r1 = p((Vc) => {
  "use strict";
  Object.defineProperty(Vc, "__esModule", {
    value: !0
  });
  Vc.default = void 0;
  var CY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-sort": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "scope",
          value: "row"
        }],
        name: "th"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          name: "scope",
          value: "rowgroup"
        }],
        name: "th"
      },
      module: "HTML"
    }],
    requireContextRole: ["row", "rowgroup"],
    requiredContextRole: ["row", "rowgroup"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "cell"], ["roletype", "structure", "section", "cell", "gridcell"], ["roletype", "widge\
t", "gridcell"], ["roletype", "structure", "sectionhead"]]
  }, xY = CY;
  Vc.default = xY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/scrollbarRole.js
var n1 = p((zc) => {
  "use strict";
  Object.defineProperty(zc, "__esModule", {
    value: !0
  });
  zc.default = void 0;
  var _Y = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-valuetext": null,
      "aria-orientation": "vertical",
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-controls": null,
      "aria-valuenow": null
    },
    superClass: [["roletype", "structure", "range"], ["roletype", "widget"]]
  }, PY = _Y;
  zc.default = PY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/searchRole.js
var o1 = p((Wc) => {
  "use strict";
  Object.defineProperty(Wc, "__esModule", {
    value: !0
  });
  Wc.default = void 0;
  var qY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, RY = qY;
  Wc.default = RY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/searchboxRole.js
var i1 = p((Gc) => {
  "use strict";
  Object.defineProperty(Gc, "__esModule", {
    value: !0
  });
  Gc.default = void 0;
  var TY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "search"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "input", "textbox"]]
  }, OY = TY;
  Gc.default = OY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/separatorRole.js
var a1 = p((Kc) => {
  "use strict";
  Object.defineProperty(Kc, "__esModule", {
    value: !0
  });
  Kc.default = void 0;
  var SY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-orientation": "horizontal",
      "aria-valuemax": "100",
      "aria-valuemin": "0",
      "aria-valuenow": null,
      "aria-valuetext": null
    },
    relatedConcepts: [{
      concept: {
        name: "hr"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure"]]
  }, MY = SY;
  Kc.default = MY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/sliderRole.js
var s1 = p((Yc) => {
  "use strict";
  Object.defineProperty(Yc, "__esModule", {
    value: !0
  });
  Yc.default = void 0;
  var AY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-valuetext": null,
      "aria-orientation": "horizontal",
      "aria-valuemax": "100",
      "aria-valuemin": "0"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "range"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-valuenow": null
    },
    superClass: [["roletype", "widget", "input"], ["roletype", "structure", "range"]]
  }, NY = AY;
  Yc.default = NY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/spinbuttonRole.js
var l1 = p((Xc) => {
  "use strict";
  Object.defineProperty(Xc, "__esModule", {
    value: !0
  });
  Xc.default = void 0;
  var IY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-readonly": null,
      "aria-required": null,
      "aria-valuetext": null,
      "aria-valuenow": "0"
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          name: "type",
          value: "number"
        }],
        name: "input"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"], ["roletype", "widget", "input"], ["roletype", "structure", "range"]]
  }, jY = IY;
  Xc.default = jY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/statusRole.js
var u1 = p((Jc) => {
  "use strict";
  Object.defineProperty(Jc, "__esModule", {
    value: !0
  });
  Jc.default = void 0;
  var kY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-atomic": "true",
      "aria-live": "polite"
    },
    relatedConcepts: [{
      concept: {
        name: "output"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, LY = kY;
  Jc.default = LY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/strongRole.js
var c1 = p((Qc) => {
  "use strict";
  Object.defineProperty(Qc, "__esModule", {
    value: !0
  });
  Qc.default = void 0;
  var $Y = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "strong"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, BY = $Y;
  Qc.default = BY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/subscriptRole.js
var d1 = p((Zc) => {
  "use strict";
  Object.defineProperty(Zc, "__esModule", {
    value: !0
  });
  Zc.default = void 0;
  var DY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "sub"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, FY = DY;
  Zc.default = FY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/superscriptRole.js
var f1 = p((ed) => {
  "use strict";
  Object.defineProperty(ed, "__esModule", {
    value: !0
  });
  ed.default = void 0;
  var UY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["prohibited"],
    prohibitedProps: ["aria-label", "aria-labelledby"],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "sup"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, HY = UY;
  ed.default = HY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/switchRole.js
var p1 = p((td) => {
  "use strict";
  Object.defineProperty(td, "__esModule", {
    value: !0
  });
  td.default = void 0;
  var VY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "button"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-checked": null
    },
    superClass: [["roletype", "widget", "input", "checkbox"]]
  }, zY = VY;
  td.default = zY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/tabRole.js
var m1 = p((rd) => {
  "use strict";
  Object.defineProperty(rd, "__esModule", {
    value: !0
  });
  rd.default = void 0;
  var WY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-posinset": null,
      "aria-setsize": null,
      "aria-selected": "false"
    },
    relatedConcepts: [],
    requireContextRole: ["tablist"],
    requiredContextRole: ["tablist"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "sectionhead"], ["roletype", "widget"]]
  }, GY = WY;
  rd.default = GY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/tableRole.js
var h1 = p((nd) => {
  "use strict";
  Object.defineProperty(nd, "__esModule", {
    value: !0
  });
  nd.default = void 0;
  var KY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-colcount": null,
      "aria-rowcount": null
    },
    relatedConcepts: [{
      concept: {
        name: "table"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, YY = KY;
  nd.default = YY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/tablistRole.js
var b1 = p((od) => {
  "use strict";
  Object.defineProperty(od, "__esModule", {
    value: !0
  });
  od.default = void 0;
  var XY = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-level": null,
      "aria-multiselectable": null,
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      module: "DAISY",
      concept: {
        name: "guide"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["tab"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite"]]
  }, JY = XY;
  od.default = JY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/tabpanelRole.js
var y1 = p((id) => {
  "use strict";
  Object.defineProperty(id, "__esModule", {
    value: !0
  });
  id.default = void 0;
  var QY = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, ZY = QY;
  id.default = ZY;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/termRole.js
var g1 = p((ad) => {
  "use strict";
  Object.defineProperty(ad, "__esModule", {
    value: !0
  });
  ad.default = void 0;
  var eX = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "dfn"
      },
      module: "HTML"
    }, {
      concept: {
        name: "dt"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, tX = eX;
  ad.default = tX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/textboxRole.js
var v1 = p((sd) => {
  "use strict";
  Object.defineProperty(sd, "__esModule", {
    value: !0
  });
  sd.default = void 0;
  var rX = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-activedescendant": null,
      "aria-autocomplete": null,
      "aria-errormessage": null,
      "aria-haspopup": null,
      "aria-invalid": null,
      "aria-multiline": null,
      "aria-placeholder": null,
      "aria-readonly": null,
      "aria-required": null
    },
    relatedConcepts: [{
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "type"
        }, {
          constraints: ["undefined"],
          name: "list"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "email"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "tel"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "text"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        attributes: [{
          constraints: ["undefined"],
          name: "list"
        }, {
          name: "type",
          value: "url"
        }],
        constraints: ["the list attribute is not set"],
        name: "input"
      },
      module: "HTML"
    }, {
      concept: {
        name: "input"
      },
      module: "XForms"
    }, {
      concept: {
        name: "textarea"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "input"]]
  }, nX = rX;
  sd.default = nX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/timeRole.js
var w1 = p((ld) => {
  "use strict";
  Object.defineProperty(ld, "__esModule", {
    value: !0
  });
  ld.default = void 0;
  var oX = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "time"
      },
      module: "HTML"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, iX = oX;
  ld.default = iX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/timerRole.js
var E1 = p((ud) => {
  "use strict";
  Object.defineProperty(ud, "__esModule", {
    value: !0
  });
  ud.default = void 0;
  var aX = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "status"]]
  }, sX = aX;
  ud.default = sX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/toolbarRole.js
var C1 = p((cd) => {
  "use strict";
  Object.defineProperty(cd, "__esModule", {
    value: !0
  });
  cd.default = void 0;
  var lX = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-orientation": "horizontal"
    },
    relatedConcepts: [{
      concept: {
        name: "menubar"
      },
      module: "ARIA"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"]]
  }, uX = lX;
  cd.default = uX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/tooltipRole.js
var x1 = p((dd) => {
  "use strict";
  Object.defineProperty(dd, "__esModule", {
    value: !0
  });
  dd.default = void 0;
  var cX = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, dX = cX;
  dd.default = dX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/treeRole.js
var _1 = p((fd) => {
  "use strict";
  Object.defineProperty(fd, "__esModule", {
    value: !0
  });
  fd.default = void 0;
  var fX = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null,
      "aria-multiselectable": null,
      "aria-required": null,
      "aria-orientation": "vertical"
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["treeitem", "group"], ["treeitem"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "select"], ["roletype", "structure", "section", "group", "select"]]
  }, pX = fX;
  fd.default = pX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/treegridRole.js
var P1 = p((pd) => {
  "use strict";
  Object.defineProperty(pd, "__esModule", {
    value: !0
  });
  pd.default = void 0;
  var mX = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["row"], ["row", "rowgroup"]],
    requiredProps: {},
    superClass: [["roletype", "widget", "composite", "grid"], ["roletype", "structure", "section", "table", "grid"], ["roletype", "widget", "\
composite", "select", "tree"], ["roletype", "structure", "section", "group", "select", "tree"]]
  }, hX = mX;
  pd.default = hX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/literal/treeitemRole.js
var q1 = p((md) => {
  "use strict";
  Object.defineProperty(md, "__esModule", {
    value: !0
  });
  md.default = void 0;
  var bX = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-expanded": null,
      "aria-haspopup": null
    },
    relatedConcepts: [],
    requireContextRole: ["group", "tree"],
    requiredContextRole: ["group", "tree"],
    requiredOwnedElements: [],
    requiredProps: {
      "aria-selected": null
    },
    superClass: [["roletype", "structure", "section", "listitem"], ["roletype", "widget", "input", "option"]]
  }, yX = bX;
  md.default = yX;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/ariaLiteralRoles.js
var R1 = p((hd) => {
  "use strict";
  Object.defineProperty(hd, "__esModule", {
    value: !0
  });
  hd.default = void 0;
  var gX = L(QO()), vX = L(ZO()), wX = L(eS()), EX = L(tS()), CX = L(rS()), xX = L(nS()), _X = L(oS()), PX = L(iS()), qX = L(aS()), RX = L(sS()),
  TX = L(lS()), OX = L(uS()), SX = L(cS()), MX = L(dS()), AX = L(fS()), NX = L(pS()), IX = L(mS()), jX = L(hS()), kX = L(bS()), LX = L(yS()),
  $X = L(gS()), BX = L(vS()), DX = L(wS()), FX = L(ES()), UX = L(CS()), HX = L(xS()), VX = L(_S()), zX = L(PS()), WX = L(qS()), GX = L(RS()),
  KX = L(TS()), YX = L(OS()), XX = L(SS()), JX = L(MS()), QX = L(AS()), ZX = L(NS()), eJ = L(IS()), tJ = L(jS()), rJ = L(kS()), nJ = L(LS()),
  oJ = L($S()), iJ = L(BS()), aJ = L(DS()), sJ = L(FS()), lJ = L(US()), uJ = L(HS()), cJ = L(VS()), dJ = L(zS()), fJ = L(WS()), pJ = L(GS()),
  mJ = L(KS()), hJ = L(YS()), bJ = L(XS()), yJ = L(JS()), gJ = L(QS()), vJ = L(ZS()), wJ = L(e1()), EJ = L(t1()), CJ = L(r1()), xJ = L(n1()),
  _J = L(o1()), PJ = L(i1()), qJ = L(a1()), RJ = L(s1()), TJ = L(l1()), OJ = L(u1()), SJ = L(c1()), MJ = L(d1()), AJ = L(f1()), NJ = L(p1()),
  IJ = L(m1()), jJ = L(h1()), kJ = L(b1()), LJ = L(y1()), $J = L(g1()), BJ = L(v1()), DJ = L(w1()), FJ = L(E1()), UJ = L(C1()), HJ = L(x1()),
  VJ = L(_1()), zJ = L(P1()), WJ = L(q1());
  function L(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(L, "_interopRequireDefault");
  var GJ = [["alert", gX.default], ["alertdialog", vX.default], ["application", wX.default], ["article", EX.default], ["banner", CX.default],
  ["blockquote", xX.default], ["button", _X.default], ["caption", PX.default], ["cell", qX.default], ["checkbox", RX.default], ["code", TX.default],
  ["columnheader", OX.default], ["combobox", SX.default], ["complementary", MX.default], ["contentinfo", AX.default], ["definition", NX.default],
  ["deletion", IX.default], ["dialog", jX.default], ["directory", kX.default], ["document", LX.default], ["emphasis", $X.default], ["feed", BX.
  default], ["figure", DX.default], ["form", FX.default], ["generic", UX.default], ["grid", HX.default], ["gridcell", VX.default], ["group",
  zX.default], ["heading", WX.default], ["img", GX.default], ["insertion", KX.default], ["link", YX.default], ["list", XX.default], ["listbo\
x", JX.default], ["listitem", QX.default], ["log", ZX.default], ["main", eJ.default], ["mark", tJ.default], ["marquee", rJ.default], ["math",
  nJ.default], ["menu", oJ.default], ["menubar", iJ.default], ["menuitem", aJ.default], ["menuitemcheckbox", sJ.default], ["menuitemradio", lJ.
  default], ["meter", uJ.default], ["navigation", cJ.default], ["none", dJ.default], ["note", fJ.default], ["option", pJ.default], ["paragra\
ph", mJ.default], ["presentation", hJ.default], ["progressbar", bJ.default], ["radio", yJ.default], ["radiogroup", gJ.default], ["region", vJ.
  default], ["row", wJ.default], ["rowgroup", EJ.default], ["rowheader", CJ.default], ["scrollbar", xJ.default], ["search", _J.default], ["s\
earchbox", PJ.default], ["separator", qJ.default], ["slider", RJ.default], ["spinbutton", TJ.default], ["status", OJ.default], ["strong", SJ.
  default], ["subscript", MJ.default], ["superscript", AJ.default], ["switch", NJ.default], ["tab", IJ.default], ["table", jJ.default], ["ta\
blist", kJ.default], ["tabpanel", LJ.default], ["term", $J.default], ["textbox", BJ.default], ["time", DJ.default], ["timer", FJ.default], [
  "toolbar", UJ.default], ["tooltip", HJ.default], ["tree", VJ.default], ["treegrid", zJ.default], ["treeitem", WJ.default]], KJ = GJ;
  hd.default = KJ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docAbstractRole.js
var T1 = p((bd) => {
  "use strict";
  Object.defineProperty(bd, "__esModule", {
    value: !0
  });
  bd.default = void 0;
  var YJ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "abstract [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, XJ = YJ;
  bd.default = XJ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docAcknowledgmentsRole.js
var O1 = p((yd) => {
  "use strict";
  Object.defineProperty(yd, "__esModule", {
    value: !0
  });
  yd.default = void 0;
  var JJ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "acknowledgments [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, QJ = JJ;
  yd.default = QJ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docAfterwordRole.js
var S1 = p((gd) => {
  "use strict";
  Object.defineProperty(gd, "__esModule", {
    value: !0
  });
  gd.default = void 0;
  var ZJ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "afterword [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, eQ = ZJ;
  gd.default = eQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docAppendixRole.js
var M1 = p((vd) => {
  "use strict";
  Object.defineProperty(vd, "__esModule", {
    value: !0
  });
  vd.default = void 0;
  var tQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "appendix [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, rQ = tQ;
  vd.default = rQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docBacklinkRole.js
var A1 = p((wd) => {
  "use strict";
  Object.defineProperty(wd, "__esModule", {
    value: !0
  });
  wd.default = void 0;
  var nQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "referrer [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, oQ = nQ;
  wd.default = oQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docBiblioentryRole.js
var N1 = p((Ed) => {
  "use strict";
  Object.defineProperty(Ed, "__esModule", {
    value: !0
  });
  Ed.default = void 0;
  var iQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "EPUB biblioentry [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: ["doc-bibliography"],
    requiredContextRole: ["doc-bibliography"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "listitem"]]
  }, aQ = iQ;
  Ed.default = aQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docBibliographyRole.js
var I1 = p((Cd) => {
  "use strict";
  Object.defineProperty(Cd, "__esModule", {
    value: !0
  });
  Cd.default = void 0;
  var sQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "bibliography [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["doc-biblioentry"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, lQ = sQ;
  Cd.default = lQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docBibliorefRole.js
var j1 = p((xd) => {
  "use strict";
  Object.defineProperty(xd, "__esModule", {
    value: !0
  });
  xd.default = void 0;
  var uQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "biblioref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, cQ = uQ;
  xd.default = cQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docChapterRole.js
var k1 = p((_d) => {
  "use strict";
  Object.defineProperty(_d, "__esModule", {
    value: !0
  });
  _d.default = void 0;
  var dQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "chapter [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, fQ = dQ;
  _d.default = fQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docColophonRole.js
var L1 = p((Pd) => {
  "use strict";
  Object.defineProperty(Pd, "__esModule", {
    value: !0
  });
  Pd.default = void 0;
  var pQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "colophon [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, mQ = pQ;
  Pd.default = mQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docConclusionRole.js
var $1 = p((qd) => {
  "use strict";
  Object.defineProperty(qd, "__esModule", {
    value: !0
  });
  qd.default = void 0;
  var hQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "conclusion [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, bQ = hQ;
  qd.default = bQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docCoverRole.js
var B1 = p((Rd) => {
  "use strict";
  Object.defineProperty(Rd, "__esModule", {
    value: !0
  });
  Rd.default = void 0;
  var yQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "cover [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "img"]]
  }, gQ = yQ;
  Rd.default = gQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docCreditRole.js
var D1 = p((Td) => {
  "use strict";
  Object.defineProperty(Td, "__esModule", {
    value: !0
  });
  Td.default = void 0;
  var vQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "credit [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, wQ = vQ;
  Td.default = wQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docCreditsRole.js
var F1 = p((Od) => {
  "use strict";
  Object.defineProperty(Od, "__esModule", {
    value: !0
  });
  Od.default = void 0;
  var EQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "credits [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, CQ = EQ;
  Od.default = CQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docDedicationRole.js
var U1 = p((Sd) => {
  "use strict";
  Object.defineProperty(Sd, "__esModule", {
    value: !0
  });
  Sd.default = void 0;
  var xQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "dedication [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, _Q = xQ;
  Sd.default = _Q;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docEndnoteRole.js
var H1 = p((Md) => {
  "use strict";
  Object.defineProperty(Md, "__esModule", {
    value: !0
  });
  Md.default = void 0;
  var PQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "rearnote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: ["doc-endnotes"],
    requiredContextRole: ["doc-endnotes"],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "listitem"]]
  }, qQ = PQ;
  Md.default = qQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docEndnotesRole.js
var V1 = p((Ad) => {
  "use strict";
  Object.defineProperty(Ad, "__esModule", {
    value: !0
  });
  Ad.default = void 0;
  var RQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "rearnotes [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["doc-endnote"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, TQ = RQ;
  Ad.default = TQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docEpigraphRole.js
var z1 = p((Nd) => {
  "use strict";
  Object.defineProperty(Nd, "__esModule", {
    value: !0
  });
  Nd.default = void 0;
  var OQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "epigraph [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, SQ = OQ;
  Nd.default = SQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docEpilogueRole.js
var W1 = p((Id) => {
  "use strict";
  Object.defineProperty(Id, "__esModule", {
    value: !0
  });
  Id.default = void 0;
  var MQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "epilogue [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, AQ = MQ;
  Id.default = AQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docErrataRole.js
var G1 = p((jd) => {
  "use strict";
  Object.defineProperty(jd, "__esModule", {
    value: !0
  });
  jd.default = void 0;
  var NQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "errata [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, IQ = NQ;
  jd.default = IQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docExampleRole.js
var K1 = p((kd) => {
  "use strict";
  Object.defineProperty(kd, "__esModule", {
    value: !0
  });
  kd.default = void 0;
  var jQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, kQ = jQ;
  kd.default = kQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docFootnoteRole.js
var Y1 = p((Ld) => {
  "use strict";
  Object.defineProperty(Ld, "__esModule", {
    value: !0
  });
  Ld.default = void 0;
  var LQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "footnote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, $Q = LQ;
  Ld.default = $Q;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docForewordRole.js
var X1 = p(($d) => {
  "use strict";
  Object.defineProperty($d, "__esModule", {
    value: !0
  });
  $d.default = void 0;
  var BQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "foreword [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, DQ = BQ;
  $d.default = DQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docGlossaryRole.js
var J1 = p((Bd) => {
  "use strict";
  Object.defineProperty(Bd, "__esModule", {
    value: !0
  });
  Bd.default = void 0;
  var FQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "glossary [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [["definition"], ["term"]],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, UQ = FQ;
  Bd.default = UQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docGlossrefRole.js
var Q1 = p((Dd) => {
  "use strict";
  Object.defineProperty(Dd, "__esModule", {
    value: !0
  });
  Dd.default = void 0;
  var HQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "glossref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, VQ = HQ;
  Dd.default = VQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docIndexRole.js
var Z1 = p((Fd) => {
  "use strict";
  Object.defineProperty(Fd, "__esModule", {
    value: !0
  });
  Fd.default = void 0;
  var zQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "index [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, WQ = zQ;
  Fd.default = WQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docIntroductionRole.js
var eM = p((Ud) => {
  "use strict";
  Object.defineProperty(Ud, "__esModule", {
    value: !0
  });
  Ud.default = void 0;
  var GQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "introduction [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, KQ = GQ;
  Ud.default = KQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docNoterefRole.js
var tM = p((Hd) => {
  "use strict";
  Object.defineProperty(Hd, "__esModule", {
    value: !0
  });
  Hd.default = void 0;
  var YQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "noteref [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "widget", "command", "link"]]
  }, XQ = YQ;
  Hd.default = XQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docNoticeRole.js
var rM = p((Vd) => {
  "use strict";
  Object.defineProperty(Vd, "__esModule", {
    value: !0
  });
  Vd.default = void 0;
  var JQ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "notice [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "note"]]
  }, QQ = JQ;
  Vd.default = QQ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPagebreakRole.js
var nM = p((zd) => {
  "use strict";
  Object.defineProperty(zd, "__esModule", {
    value: !0
  });
  zd.default = void 0;
  var ZQ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "pagebreak [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "separator"]]
  }, eZ = ZQ;
  zd.default = eZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPagelistRole.js
var oM = p((Wd) => {
  "use strict";
  Object.defineProperty(Wd, "__esModule", {
    value: !0
  });
  Wd.default = void 0;
  var tZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "page-list [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, rZ = tZ;
  Wd.default = rZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPartRole.js
var iM = p((Gd) => {
  "use strict";
  Object.defineProperty(Gd, "__esModule", {
    value: !0
  });
  Gd.default = void 0;
  var nZ = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "part [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, oZ = nZ;
  Gd.default = oZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPrefaceRole.js
var aM = p((Kd) => {
  "use strict";
  Object.defineProperty(Kd, "__esModule", {
    value: !0
  });
  Kd.default = void 0;
  var iZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "preface [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, aZ = iZ;
  Kd.default = aZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPrologueRole.js
var sM = p((Yd) => {
  "use strict";
  Object.defineProperty(Yd, "__esModule", {
    value: !0
  });
  Yd.default = void 0;
  var sZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "prologue [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark"]]
  }, lZ = sZ;
  Yd.default = lZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docPullquoteRole.js
var lM = p((Xd) => {
  "use strict";
  Object.defineProperty(Xd, "__esModule", {
    value: !0
  });
  Xd.default = void 0;
  var uZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {},
    relatedConcepts: [{
      concept: {
        name: "pullquote [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["none"]]
  }, cZ = uZ;
  Xd.default = cZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docQnaRole.js
var uM = p((Jd) => {
  "use strict";
  Object.defineProperty(Jd, "__esModule", {
    value: !0
  });
  Jd.default = void 0;
  var dZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "qna [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section"]]
  }, fZ = dZ;
  Jd.default = fZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docSubtitleRole.js
var cM = p((Qd) => {
  "use strict";
  Object.defineProperty(Qd, "__esModule", {
    value: !0
  });
  Qd.default = void 0;
  var pZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "subtitle [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "sectionhead"]]
  }, mZ = pZ;
  Qd.default = mZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docTipRole.js
var dM = p((Zd) => {
  "use strict";
  Object.defineProperty(Zd, "__esModule", {
    value: !0
  });
  Zd.default = void 0;
  var hZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "help [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "note"]]
  }, bZ = hZ;
  Zd.default = bZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/dpub/docTocRole.js
var fM = p((ef) => {
  "use strict";
  Object.defineProperty(ef, "__esModule", {
    value: !0
  });
  ef.default = void 0;
  var yZ = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      concept: {
        name: "toc [EPUB-SSV]"
      },
      module: "EPUB"
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "landmark", "navigation"]]
  }, gZ = yZ;
  ef.default = gZ;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/ariaDpubRoles.js
var pM = p((tf) => {
  "use strict";
  Object.defineProperty(tf, "__esModule", {
    value: !0
  });
  tf.default = void 0;
  var vZ = Q(T1()), wZ = Q(O1()), EZ = Q(S1()), CZ = Q(M1()), xZ = Q(A1()), _Z = Q(N1()), PZ = Q(I1()), qZ = Q(j1()), RZ = Q(k1()), TZ = Q(L1()),
  OZ = Q($1()), SZ = Q(B1()), MZ = Q(D1()), AZ = Q(F1()), NZ = Q(U1()), IZ = Q(H1()), jZ = Q(V1()), kZ = Q(z1()), LZ = Q(W1()), $Z = Q(G1()),
  BZ = Q(K1()), DZ = Q(Y1()), FZ = Q(X1()), UZ = Q(J1()), HZ = Q(Q1()), VZ = Q(Z1()), zZ = Q(eM()), WZ = Q(tM()), GZ = Q(rM()), KZ = Q(nM()),
  YZ = Q(oM()), XZ = Q(iM()), JZ = Q(aM()), QZ = Q(sM()), ZZ = Q(lM()), eee = Q(uM()), tee = Q(cM()), ree = Q(dM()), nee = Q(fM());
  function Q(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Q, "_interopRequireDefault");
  var oee = [["doc-abstract", vZ.default], ["doc-acknowledgments", wZ.default], ["doc-afterword", EZ.default], ["doc-appendix", CZ.default],
  ["doc-backlink", xZ.default], ["doc-biblioentry", _Z.default], ["doc-bibliography", PZ.default], ["doc-biblioref", qZ.default], ["doc-chap\
ter", RZ.default], ["doc-colophon", TZ.default], ["doc-conclusion", OZ.default], ["doc-cover", SZ.default], ["doc-credit", MZ.default], ["do\
c-credits", AZ.default], ["doc-dedication", NZ.default], ["doc-endnote", IZ.default], ["doc-endnotes", jZ.default], ["doc-epigraph", kZ.default],
  ["doc-epilogue", LZ.default], ["doc-errata", $Z.default], ["doc-example", BZ.default], ["doc-footnote", DZ.default], ["doc-foreword", FZ.default],
  ["doc-glossary", UZ.default], ["doc-glossref", HZ.default], ["doc-index", VZ.default], ["doc-introduction", zZ.default], ["doc-noteref", WZ.
  default], ["doc-notice", GZ.default], ["doc-pagebreak", KZ.default], ["doc-pagelist", YZ.default], ["doc-part", XZ.default], ["doc-preface",
  JZ.default], ["doc-prologue", QZ.default], ["doc-pullquote", ZZ.default], ["doc-qna", eee.default], ["doc-subtitle", tee.default], ["doc-t\
ip", ree.default], ["doc-toc", nee.default]], iee = oee;
  tf.default = iee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/graphics/graphicsDocumentRole.js
var mM = p((rf) => {
  "use strict";
  Object.defineProperty(rf, "__esModule", {
    value: !0
  });
  rf.default = void 0;
  var aee = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      module: "GRAPHICS",
      concept: {
        name: "graphics-object"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "img"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "article"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "document"]]
  }, see = aee;
  rf.default = see;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/graphics/graphicsObjectRole.js
var hM = p((nf) => {
  "use strict";
  Object.defineProperty(nf, "__esModule", {
    value: !0
  });
  nf.default = void 0;
  var lee = {
    abstract: !1,
    accessibleNameRequired: !1,
    baseConcepts: [],
    childrenPresentational: !1,
    nameFrom: ["author", "contents"],
    prohibitedProps: [],
    props: {
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [{
      module: "GRAPHICS",
      concept: {
        name: "graphics-document"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "group"
      }
    }, {
      module: "ARIA",
      concept: {
        name: "img"
      }
    }, {
      module: "GRAPHICS",
      concept: {
        name: "graphics-symbol"
      }
    }],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "group"]]
  }, uee = lee;
  nf.default = uee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/graphics/graphicsSymbolRole.js
var bM = p((of) => {
  "use strict";
  Object.defineProperty(of, "__esModule", {
    value: !0
  });
  of.default = void 0;
  var cee = {
    abstract: !1,
    accessibleNameRequired: !0,
    baseConcepts: [],
    childrenPresentational: !0,
    nameFrom: ["author"],
    prohibitedProps: [],
    props: {
      "aria-disabled": null,
      "aria-errormessage": null,
      "aria-expanded": null,
      "aria-haspopup": null,
      "aria-invalid": null
    },
    relatedConcepts: [],
    requireContextRole: [],
    requiredContextRole: [],
    requiredOwnedElements: [],
    requiredProps: {},
    superClass: [["roletype", "structure", "section", "img"]]
  }, dee = cee;
  of.default = dee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/etc/roles/ariaGraphicsRoles.js
var yM = p((af) => {
  "use strict";
  Object.defineProperty(af, "__esModule", {
    value: !0
  });
  af.default = void 0;
  var fee = ry(mM()), pee = ry(hM()), mee = ry(bM());
  function ry(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(ry, "_interopRequireDefault");
  var hee = [["graphics-document", fee.default], ["graphics-object", pee.default], ["graphics-symbol", mee.default]], bee = hee;
  af.default = bee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/rolesMap.js
var lf = p((sf) => {
  "use strict";
  Object.defineProperty(sf, "__esModule", {
    value: !0
  });
  sf.default = void 0;
  var yee = qo(JO()), gee = qo(R1()), vee = qo(pM()), wee = qo(yM()), Eee = qo(hn());
  function qo(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(qo, "_interopRequireDefault");
  function Cee(e, t, r) {
    return t in e ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = r, e;
  }
  o(Cee, "_defineProperty");
  function ny(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = vM(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a = !0, s = !1, l;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return a = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        !a && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  o(ny, "_createForOfIteratorHelper");
  function Po(e, t) {
    return Pee(e) || _ee(e, t) || vM(e, t) || xee();
  }
  o(Po, "_slicedToArray");
  function xee() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(xee, "_nonIterableRest");
  function vM(e, t) {
    if (e) {
      if (typeof e == "string") return gM(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return gM(e, t);
    }
  }
  o(vM, "_unsupportedIterableToArray");
  function gM(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++)
      n[r] = e[r];
    return n;
  }
  o(gM, "_arrayLikeToArray");
  function _ee(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n = [], i = !0, a = !1, s, l;
      try {
        for (r = r.call(e); !(i = (s = r.next()).done) && (n.push(s.value), !(t && n.length === t)); i = !0)
          ;
      } catch (c) {
        a = !0, l = c;
      } finally {
        try {
          !i && r.return != null && r.return();
        } finally {
          if (a) throw l;
        }
      }
      return n;
    }
  }
  o(_ee, "_iterableToArrayLimit");
  function Pee(e) {
    if (Array.isArray(e)) return e;
  }
  o(Pee, "_arrayWithHoles");
  var er = [].concat(yee.default, gee.default, vee.default, wee.default);
  er.forEach(function(e) {
    var t = Po(e, 2), r = t[1], n = ny(r.superClass), i;
    try {
      for (n.s(); !(i = n.n()).done; ) {
        var a = i.value, s = ny(a), l;
        try {
          var c = /* @__PURE__ */ o(function() {
            var d = l.value, f = er.find(function(x) {
              var b = Po(x, 1), E = b[0];
              return E === d;
            });
            if (f)
              for (var h = f[1], m = 0, y = Object.keys(h.props); m < y.length; m++) {
                var g = y[m];
                Object.prototype.hasOwnProperty.call(r.props, g) || Object.assign(r.props, Cee({}, g, h.props[g]));
              }
          }, "_loop");
          for (s.s(); !(l = s.n()).done; )
            c();
        } catch (u) {
          s.e(u);
        } finally {
          s.f();
        }
      }
    } catch (u) {
      n.e(u);
    } finally {
      n.f();
    }
  });
  var oy = {
    entries: /* @__PURE__ */ o(function() {
      return er;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = ny(er), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = Po(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, er);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = er.find(function(n) {
        return n[0] === t;
      });
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!oy.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return er.map(function(t) {
        var r = Po(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return er.map(function(t) {
        var r = Po(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, qee = (0, Eee.default)(oy, oy.entries());
  sf.default = qee;
});

// ../node_modules/dequal/lite/index.mjs
var EM = {};
Wo(EM, {
  dequal: () => iy
});
function iy(e, t) {
  var r, n;
  if (e === t) return !0;
  if (e && t && (r = e.constructor) === t.constructor) {
    if (r === Date) return e.getTime() === t.getTime();
    if (r === RegExp) return e.toString() === t.toString();
    if (r === Array) {
      if ((n = e.length) === t.length)
        for (; n-- && iy(e[n], t[n]); ) ;
      return n === -1;
    }
    if (!r || typeof e == "object") {
      n = 0;
      for (r in e)
        if (wM.call(e, r) && ++n && !wM.call(t, r) || !(r in t) || !iy(e[r], t[r])) return !1;
      return Object.keys(t).length === n;
    }
  }
  return e !== e && t !== t;
}
var wM, CM = ZI(() => {
  wM = Object.prototype.hasOwnProperty;
  o(iy, "dequal");
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/elementRoleMap.js
var OM = p((pf) => {
  "use strict";
  Object.defineProperty(pf, "__esModule", {
    value: !0
  });
  pf.default = void 0;
  var PM = (CM(), ej(EM)), Ree = RM(hn()), qM = RM(lf());
  function RM(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(RM, "_interopRequireDefault");
  function ay(e, t) {
    return See(e) || Oee(e, t) || TM(e, t) || Tee();
  }
  o(ay, "_slicedToArray");
  function Tee() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(Tee, "_nonIterableRest");
  function Oee(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n = [], i = !0, a = !1, s, l;
      try {
        for (r = r.call(e); !(i = (s = r.next()).done) && (n.push(s.value), !(t && n.length === t)); i = !0)
          ;
      } catch (c) {
        a = !0, l = c;
      } finally {
        try {
          !i && r.return != null && r.return();
        } finally {
          if (a) throw l;
        }
      }
      return n;
    }
  }
  o(Oee, "_iterableToArrayLimit");
  function See(e) {
    if (Array.isArray(e)) return e;
  }
  o(See, "_arrayWithHoles");
  function Mee(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = TM(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a = !0, s = !1, l;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return a = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        !a && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  o(Mee, "_createForOfIteratorHelper");
  function TM(e, t) {
    if (e) {
      if (typeof e == "string") return xM(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return xM(e, t);
    }
  }
  o(TM, "_unsupportedIterableToArray");
  function xM(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++)
      n[r] = e[r];
    return n;
  }
  o(xM, "_arrayLikeToArray");
  var tr = [], _M = qM.default.keys();
  for (uf = 0; uf < _M.length; uf++)
    if (cf = _M[uf], df = qM.default.get(cf), df)
      for (sy = [].concat(df.baseConcepts, df.relatedConcepts), ff = 0; ff < sy.length; ff++)
        ly = sy[ff], ly.module === "HTML" && function() {
          var e = ly.concept;
          if (e) {
            var t = tr.find(function(a) {
              return (0, PM.dequal)(a, e);
            }), r;
            t ? r = t[1] : r = [];
            for (var n = !0, i = 0; i < r.length; i++)
              if (r[i] === cf) {
                n = !1;
                break;
              }
            n && r.push(cf), tr.push([e, r]);
          }
        }();
  var cf, df, sy, ly, ff, uf, uy = {
    entries: /* @__PURE__ */ o(function() {
      return tr;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = Mee(tr), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = ay(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, tr);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = tr.find(function(n) {
        return t.name === n[0].name && (0, PM.dequal)(t.attributes, n[0].attributes);
      });
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!uy.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return tr.map(function(t) {
        var r = ay(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return tr.map(function(t) {
        var r = ay(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, Aee = (0, Ree.default)(uy, uy.entries());
  pf.default = Aee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/roleElementMap.js
var jM = p((gf) => {
  "use strict";
  Object.defineProperty(gf, "__esModule", {
    value: !0
  });
  gf.default = void 0;
  var Nee = NM(hn()), AM = NM(lf());
  function NM(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(NM, "_interopRequireDefault");
  function cy(e, t) {
    return kee(e) || jee(e, t) || IM(e, t) || Iee();
  }
  o(cy, "_slicedToArray");
  function Iee() {
    throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  o(Iee, "_nonIterableRest");
  function jee(e, t) {
    var r = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (r != null) {
      var n = [], i = !0, a = !1, s, l;
      try {
        for (r = r.call(e); !(i = (s = r.next()).done) && (n.push(s.value), !(t && n.length === t)); i = !0)
          ;
      } catch (c) {
        a = !0, l = c;
      } finally {
        try {
          !i && r.return != null && r.return();
        } finally {
          if (a) throw l;
        }
      }
      return n;
    }
  }
  o(jee, "_iterableToArrayLimit");
  function kee(e) {
    if (Array.isArray(e)) return e;
  }
  o(kee, "_arrayWithHoles");
  function Lee(e, t) {
    var r = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (!r) {
      if (Array.isArray(e) || (r = IM(e)) || t && e && typeof e.length == "number") {
        r && (e = r);
        var n = 0, i = /* @__PURE__ */ o(function() {
        }, "F");
        return { s: i, n: /* @__PURE__ */ o(function() {
          return n >= e.length ? { done: !0 } : { done: !1, value: e[n++] };
        }, "n"), e: /* @__PURE__ */ o(function(u) {
          throw u;
        }, "e"), f: i };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var a = !0, s = !1, l;
    return { s: /* @__PURE__ */ o(function() {
      r = r.call(e);
    }, "s"), n: /* @__PURE__ */ o(function() {
      var u = r.next();
      return a = u.done, u;
    }, "n"), e: /* @__PURE__ */ o(function(u) {
      s = !0, l = u;
    }, "e"), f: /* @__PURE__ */ o(function() {
      try {
        !a && r.return != null && r.return();
      } finally {
        if (s) throw l;
      }
    }, "f") };
  }
  o(Lee, "_createForOfIteratorHelper");
  function IM(e, t) {
    if (e) {
      if (typeof e == "string") return SM(e, t);
      var r = Object.prototype.toString.call(e).slice(8, -1);
      if (r === "Object" && e.constructor && (r = e.constructor.name), r === "Map" || r === "Set") return Array.from(e);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return SM(e, t);
    }
  }
  o(IM, "_unsupportedIterableToArray");
  function SM(e, t) {
    (t == null || t > e.length) && (t = e.length);
    for (var r = 0, n = new Array(t); r < t; r++)
      n[r] = e[r];
    return n;
  }
  o(SM, "_arrayLikeToArray");
  var xr = [], MM = AM.default.keys();
  for (mf = 0; mf < MM.length; mf++)
    if (dy = MM[mf], hf = AM.default.get(dy), bf = [], hf) {
      for (fy = [].concat(hf.baseConcepts, hf.relatedConcepts), yf = 0; yf < fy.length; yf++)
        py = fy[yf], py.module === "HTML" && (my = py.concept, my != null && bf.push(my));
      bf.length > 0 && xr.push([dy, bf]);
    }
  var dy, hf, bf, fy, py, my, yf, mf, hy = {
    entries: /* @__PURE__ */ o(function() {
      return xr;
    }, "entries"),
    forEach: /* @__PURE__ */ o(function(t) {
      var r = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null, n = Lee(xr), i;
      try {
        for (n.s(); !(i = n.n()).done; ) {
          var a = cy(i.value, 2), s = a[0], l = a[1];
          t.call(r, l, s, xr);
        }
      } catch (c) {
        n.e(c);
      } finally {
        n.f();
      }
    }, "forEach"),
    get: /* @__PURE__ */ o(function(t) {
      var r = xr.find(function(n) {
        return n[0] === t;
      });
      return r && r[1];
    }, "get"),
    has: /* @__PURE__ */ o(function(t) {
      return !!hy.get(t);
    }, "has"),
    keys: /* @__PURE__ */ o(function() {
      return xr.map(function(t) {
        var r = cy(t, 1), n = r[0];
        return n;
      });
    }, "keys"),
    values: /* @__PURE__ */ o(function() {
      return xr.map(function(t) {
        var r = cy(t, 2), n = r[1];
        return n;
      });
    }, "values")
  }, $ee = (0, Nee.default)(hy, hy.entries());
  gf.default = $ee;
});

// ../node_modules/@testing-library/dom/node_modules/aria-query/lib/index.js
var kM = p((ot) => {
  "use strict";
  Object.defineProperty(ot, "__esModule", {
    value: !0
  });
  ot.roles = ot.roleElements = ot.elementRoles = ot.dom = ot.aria = void 0;
  var Bee = Ro(jO()), Dee = Ro($O()), Fee = Ro(lf()), Uee = Ro(OM()), Hee = Ro(jM());
  function Ro(e) {
    return e && e.__esModule ? e : { default: e };
  }
  o(Ro, "_interopRequireDefault");
  var Vee = Bee.default;
  ot.aria = Vee;
  var zee = Dee.default;
  ot.dom = zee;
  var Wee = Fee.default;
  ot.roles = Wee;
  var Gee = Uee.default;
  ot.elementRoles = Gee;
  var Kee = Hee.default;
  ot.roleElements = Kee;
});

// ../node_modules/lz-string/libs/lz-string.js
var LM = p((vwe, vf) => {
  var by = function() {
    var e = String.fromCharCode, t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabc\
defghijklmnopqrstuvwxyz0123456789+-$", n = {};
    function i(s, l) {
      if (!n[s]) {
        n[s] = {};
        for (var c = 0; c < s.length; c++)
          n[s][s.charAt(c)] = c;
      }
      return n[s][l];
    }
    o(i, "getBaseValue");
    var a = {
      compressToBase64: /* @__PURE__ */ o(function(s) {
        if (s == null) return "";
        var l = a._compress(s, 6, function(c) {
          return t.charAt(c);
        });
        switch (l.length % 4) {
          // To produce valid Base64
          default:
          // When could this happen ?
          case 0:
            return l;
          case 1:
            return l + "===";
          case 2:
            return l + "==";
          case 3:
            return l + "=";
        }
      }, "compressToBase64"),
      decompressFromBase64: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : s == "" ? null : a._decompress(s.length, 32, function(l) {
          return i(t, s.charAt(l));
        });
      }, "decompressFromBase64"),
      compressToUTF16: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : a._compress(s, 15, function(l) {
          return e(l + 32);
        }) + " ";
      }, "compressToUTF16"),
      decompressFromUTF16: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : s == "" ? null : a._decompress(s.length, 16384, function(l) {
          return s.charCodeAt(l) - 32;
        });
      }, "decompressFromUTF16"),
      //compress into uint8array (UCS-2 big endian format)
      compressToUint8Array: /* @__PURE__ */ o(function(s) {
        for (var l = a.compress(s), c = new Uint8Array(l.length * 2), u = 0, d = l.length; u < d; u++) {
          var f = l.charCodeAt(u);
          c[u * 2] = f >>> 8, c[u * 2 + 1] = f % 256;
        }
        return c;
      }, "compressToUint8Array"),
      //decompress from uint8array (UCS-2 big endian format)
      decompressFromUint8Array: /* @__PURE__ */ o(function(s) {
        if (s == null)
          return a.decompress(s);
        for (var l = new Array(s.length / 2), c = 0, u = l.length; c < u; c++)
          l[c] = s[c * 2] * 256 + s[c * 2 + 1];
        var d = [];
        return l.forEach(function(f) {
          d.push(e(f));
        }), a.decompress(d.join(""));
      }, "decompressFromUint8Array"),
      //compress into a string that is already URI encoded
      compressToEncodedURIComponent: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : a._compress(s, 6, function(l) {
          return r.charAt(l);
        });
      }, "compressToEncodedURIComponent"),
      //decompress from an output of compressToEncodedURIComponent
      decompressFromEncodedURIComponent: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : s == "" ? null : (s = s.replace(/ /g, "+"), a._decompress(s.length, 32, function(l) {
          return i(r, s.charAt(l));
        }));
      }, "decompressFromEncodedURIComponent"),
      compress: /* @__PURE__ */ o(function(s) {
        return a._compress(s, 16, function(l) {
          return e(l);
        });
      }, "compress"),
      _compress: /* @__PURE__ */ o(function(s, l, c) {
        if (s == null) return "";
        var u, d, f = {}, h = {}, m = "", y = "", g = "", x = 2, b = 3, E = 2, q = [], C = 0, P = 0, O;
        for (O = 0; O < s.length; O += 1)
          if (m = s.charAt(O), Object.prototype.hasOwnProperty.call(f, m) || (f[m] = b++, h[m] = !0), y = g + m, Object.prototype.hasOwnProperty.
          call(f, y))
            g = y;
          else {
            if (Object.prototype.hasOwnProperty.call(h, g)) {
              if (g.charCodeAt(0) < 256) {
                for (u = 0; u < E; u++)
                  C = C << 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++;
                for (d = g.charCodeAt(0), u = 0; u < 8; u++)
                  C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
              } else {
                for (d = 1, u = 0; u < E; u++)
                  C = C << 1 | d, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = 0;
                for (d = g.charCodeAt(0), u = 0; u < 16; u++)
                  C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
              }
              x--, x == 0 && (x = Math.pow(2, E), E++), delete h[g];
            } else
              for (d = f[g], u = 0; u < E; u++)
                C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
            x--, x == 0 && (x = Math.pow(2, E), E++), f[y] = b++, g = String(m);
          }
        if (g !== "") {
          if (Object.prototype.hasOwnProperty.call(h, g)) {
            if (g.charCodeAt(0) < 256) {
              for (u = 0; u < E; u++)
                C = C << 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++;
              for (d = g.charCodeAt(0), u = 0; u < 8; u++)
                C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
            } else {
              for (d = 1, u = 0; u < E; u++)
                C = C << 1 | d, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = 0;
              for (d = g.charCodeAt(0), u = 0; u < 16; u++)
                C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
            }
            x--, x == 0 && (x = Math.pow(2, E), E++), delete h[g];
          } else
            for (d = f[g], u = 0; u < E; u++)
              C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
          x--, x == 0 && (x = Math.pow(2, E), E++);
        }
        for (d = 2, u = 0; u < E; u++)
          C = C << 1 | d & 1, P == l - 1 ? (P = 0, q.push(c(C)), C = 0) : P++, d = d >> 1;
        for (; ; )
          if (C = C << 1, P == l - 1) {
            q.push(c(C));
            break;
          } else P++;
        return q.join("");
      }, "_compress"),
      decompress: /* @__PURE__ */ o(function(s) {
        return s == null ? "" : s == "" ? null : a._decompress(s.length, 32768, function(l) {
          return s.charCodeAt(l);
        });
      }, "decompress"),
      _decompress: /* @__PURE__ */ o(function(s, l, c) {
        var u = [], d, f = 4, h = 4, m = 3, y = "", g = [], x, b, E, q, C, P, O, R = { val: c(0), position: l, index: 1 };
        for (x = 0; x < 3; x += 1)
          u[x] = x;
        for (E = 0, C = Math.pow(2, 2), P = 1; P != C; )
          q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P, P <<=
          1;
        switch (d = E) {
          case 0:
            for (E = 0, C = Math.pow(2, 8), P = 1; P != C; )
              q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P,
              P <<= 1;
            O = e(E);
            break;
          case 1:
            for (E = 0, C = Math.pow(2, 16), P = 1; P != C; )
              q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P,
              P <<= 1;
            O = e(E);
            break;
          case 2:
            return "";
        }
        for (u[3] = O, b = O, g.push(O); ; ) {
          if (R.index > s)
            return "";
          for (E = 0, C = Math.pow(2, m), P = 1; P != C; )
            q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P, P <<=
            1;
          switch (O = E) {
            case 0:
              for (E = 0, C = Math.pow(2, 8), P = 1; P != C; )
                q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P,
                P <<= 1;
              u[h++] = e(E), O = h - 1, f--;
              break;
            case 1:
              for (E = 0, C = Math.pow(2, 16), P = 1; P != C; )
                q = R.val & R.position, R.position >>= 1, R.position == 0 && (R.position = l, R.val = c(R.index++)), E |= (q > 0 ? 1 : 0) * P,
                P <<= 1;
              u[h++] = e(E), O = h - 1, f--;
              break;
            case 2:
              return g.join("");
          }
          if (f == 0 && (f = Math.pow(2, m), m++), u[O])
            y = u[O];
          else if (O === h)
            y = b + b.charAt(0);
          else
            return null;
          g.push(y), u[h++] = b + y.charAt(0), f--, b = y, f == 0 && (f = Math.pow(2, m), m++);
        }
      }, "_decompress")
    };
    return a;
  }();
  typeof define == "function" && define.amd ? define(function() {
    return by;
  }) : typeof vf < "u" && vf != null ? vf.exports = by : typeof angular < "u" && angular != null && angular.module("LZString", []).factory("\
LZString", function() {
    return by;
  });
});

// src/test/index.ts
import { instrument as xne } from "storybook/internal/instrumenter";

// ../node_modules/chai/chai.js
var _g = Object.defineProperty, tj = Object.getOwnPropertyNames, T = /* @__PURE__ */ o((e, t) => _g(e, "name", { value: t, configurable: !0 }),
"__name"), rj = /* @__PURE__ */ o((e, t) => /* @__PURE__ */ o(function() {
  return t || (0, e[tj(e)[0]])((t = { exports: {} }).exports, t), t.exports;
}, "__require"), "__commonJS"), mp = /* @__PURE__ */ o((e, t) => {
  for (var r in t)
    _g(e, r, { get: t[r], enumerable: !0 });
}, "__export"), nj = rj({
  "(disabled):util"() {
  }
}), Xe = {};
mp(Xe, {
  addChainableMethod: /* @__PURE__ */ o(() => qp, "addChainableMethod"),
  addLengthGuard: /* @__PURE__ */ o(() => In, "addLengthGuard"),
  addMethod: /* @__PURE__ */ o(() => xp, "addMethod"),
  addProperty: /* @__PURE__ */ o(() => Cp, "addProperty"),
  checkError: /* @__PURE__ */ o(() => We, "checkError"),
  compareByInspect: /* @__PURE__ */ o(() => Xo, "compareByInspect"),
  eql: /* @__PURE__ */ o(() => Jg, "eql"),
  expectTypes: /* @__PURE__ */ o(() => Mg, "expectTypes"),
  flag: /* @__PURE__ */ o(() => Y, "flag"),
  getActual: /* @__PURE__ */ o(() => ti, "getActual"),
  getMessage: /* @__PURE__ */ o(() => yp, "getMessage"),
  getName: /* @__PURE__ */ o(() => ni, "getName"),
  getOperator: /* @__PURE__ */ o(() => Sp, "getOperator"),
  getOwnEnumerableProperties: /* @__PURE__ */ o(() => Op, "getOwnEnumerableProperties"),
  getOwnEnumerablePropertySymbols: /* @__PURE__ */ o(() => Tp, "getOwnEnumerablePropertySymbols"),
  getPathInfo: /* @__PURE__ */ o(() => Ep, "getPathInfo"),
  hasProperty: /* @__PURE__ */ o(() => ri, "hasProperty"),
  inspect: /* @__PURE__ */ o(() => te, "inspect"),
  isNaN: /* @__PURE__ */ o(() => Jo, "isNaN"),
  isNumeric: /* @__PURE__ */ o(() => Te, "isNumeric"),
  isProxyEnabled: /* @__PURE__ */ o(() => Nn, "isProxyEnabled"),
  isRegExp: /* @__PURE__ */ o(() => Qo, "isRegExp"),
  objDisplay: /* @__PURE__ */ o(() => fr, "objDisplay"),
  overwriteChainableMethod: /* @__PURE__ */ o(() => Rp, "overwriteChainableMethod"),
  overwriteMethod: /* @__PURE__ */ o(() => Pp, "overwriteMethod"),
  overwriteProperty: /* @__PURE__ */ o(() => _p, "overwriteProperty"),
  proxify: /* @__PURE__ */ o(() => Fr, "proxify"),
  test: /* @__PURE__ */ o(() => hp, "test"),
  transferFlags: /* @__PURE__ */ o(() => it, "transferFlags"),
  type: /* @__PURE__ */ o(() => le, "type")
});
var We = {};
mp(We, {
  compatibleConstructor: /* @__PURE__ */ o(() => Rg, "compatibleConstructor"),
  compatibleInstance: /* @__PURE__ */ o(() => qg, "compatibleInstance"),
  compatibleMessage: /* @__PURE__ */ o(() => Tg, "compatibleMessage"),
  getConstructorName: /* @__PURE__ */ o(() => Og, "getConstructorName"),
  getMessage: /* @__PURE__ */ o(() => Sg, "getMessage")
});
function ei(e) {
  return e instanceof Error || Object.prototype.toString.call(e) === "[object Error]";
}
o(ei, "isErrorInstance");
T(ei, "isErrorInstance");
function Pg(e) {
  return Object.prototype.toString.call(e) === "[object RegExp]";
}
o(Pg, "isRegExp");
T(Pg, "isRegExp");
function qg(e, t) {
  return ei(t) && e === t;
}
o(qg, "compatibleInstance");
T(qg, "compatibleInstance");
function Rg(e, t) {
  return ei(t) ? e.constructor === t.constructor || e instanceof t.constructor : (typeof t == "object" || typeof t == "function") && t.prototype ?
  e.constructor === t || e instanceof t : !1;
}
o(Rg, "compatibleConstructor");
T(Rg, "compatibleConstructor");
function Tg(e, t) {
  let r = typeof e == "string" ? e : e.message;
  return Pg(t) ? t.test(r) : typeof t == "string" ? r.indexOf(t) !== -1 : !1;
}
o(Tg, "compatibleMessage");
T(Tg, "compatibleMessage");
function Og(e) {
  let t = e;
  return ei(e) ? t = e.constructor.name : typeof e == "function" && (t = e.name, t === "" && (t = new e().name || t)), t;
}
o(Og, "getConstructorName");
T(Og, "getConstructorName");
function Sg(e) {
  let t = "";
  return e && e.message ? t = e.message : typeof e == "string" && (t = e), t;
}
o(Sg, "getMessage");
T(Sg, "getMessage");
function Y(e, t, r) {
  var n = e.__flags || (e.__flags = /* @__PURE__ */ Object.create(null));
  if (arguments.length === 3)
    n[t] = r;
  else
    return n[t];
}
o(Y, "flag");
T(Y, "flag");
function hp(e, t) {
  var r = Y(e, "negate"), n = t[0];
  return r ? !n : n;
}
o(hp, "test");
T(hp, "test");
function le(e) {
  if (typeof e > "u")
    return "undefined";
  if (e === null)
    return "null";
  let t = e[Symbol.toStringTag];
  return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
o(le, "type");
T(le, "type");
var oj = "captureStackTrace" in Error, jt, re = (jt = class extends Error {
  message;
  get name() {
    return "AssertionError";
  }
  get ok() {
    return !1;
  }
  constructor(t = "Unspecified AssertionError", r, n) {
    super(t), this.message = t, oj && Error.captureStackTrace(this, n || jt);
    for (let i in r)
      i in this || (this[i] = r[i]);
  }
  toJSON(t) {
    return {
      ...this,
      name: this.name,
      message: this.message,
      ok: !1,
      stack: t !== !1 ? this.stack : void 0
    };
  }
}, o(jt, "_AssertionError"), T(jt, "AssertionError"), jt);
function Mg(e, t) {
  var r = Y(e, "message"), n = Y(e, "ssfi");
  r = r ? r + ": " : "", e = Y(e, "object"), t = t.map(function(s) {
    return s.toLowerCase();
  }), t.sort();
  var i = t.map(function(s, l) {
    var c = ~["a", "e", "i", "o", "u"].indexOf(s.charAt(0)) ? "an" : "a", u = t.length > 1 && l === t.length - 1 ? "or " : "";
    return u + c + " " + s;
  }).join(", "), a = le(e).toLowerCase();
  if (!t.some(function(s) {
    return a === s;
  }))
    throw new re(
      r + "object tested must be " + i + ", but " + a + " given",
      void 0,
      n
    );
}
o(Mg, "expectTypes");
T(Mg, "expectTypes");
function ti(e, t) {
  return t.length > 4 ? t[4] : e._obj;
}
o(ti, "getActual");
T(ti, "getActual");
var hg = {
  bold: ["1", "22"],
  dim: ["2", "22"],
  italic: ["3", "23"],
  underline: ["4", "24"],
  // 5 & 6 are blinking
  inverse: ["7", "27"],
  hidden: ["8", "28"],
  strike: ["9", "29"],
  // 10-20 are fonts
  // 21-29 are resets for 1-9
  black: ["30", "39"],
  red: ["31", "39"],
  green: ["32", "39"],
  yellow: ["33", "39"],
  blue: ["34", "39"],
  magenta: ["35", "39"],
  cyan: ["36", "39"],
  white: ["37", "39"],
  brightblack: ["30;1", "39"],
  brightred: ["31;1", "39"],
  brightgreen: ["32;1", "39"],
  brightyellow: ["33;1", "39"],
  brightblue: ["34;1", "39"],
  brightmagenta: ["35;1", "39"],
  brightcyan: ["36;1", "39"],
  brightwhite: ["37;1", "39"],
  grey: ["90", "39"]
}, ij = {
  special: "cyan",
  number: "yellow",
  bigint: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  symbol: "green",
  date: "magenta",
  regexp: "red"
}, Br = "\u2026";
function Ag(e, t) {
  let r = hg[ij[t]] || hg[t] || "";
  return r ? `\x1B[${r[0]}m${String(e)}\x1B[${r[1]}m` : String(e);
}
o(Ag, "colorise");
T(Ag, "colorise");
function Ng({
  showHidden: e = !1,
  depth: t = 2,
  colors: r = !1,
  customInspect: n = !0,
  showProxy: i = !1,
  maxArrayLength: a = 1 / 0,
  breakLength: s = 1 / 0,
  seen: l = [],
  // eslint-disable-next-line no-shadow
  truncate: c = 1 / 0,
  stylize: u = String
} = {}, d) {
  let f = {
    showHidden: !!e,
    depth: Number(t),
    colors: !!r,
    customInspect: !!n,
    showProxy: !!i,
    maxArrayLength: Number(a),
    breakLength: Number(s),
    truncate: Number(c),
    seen: l,
    inspect: d,
    stylize: u
  };
  return f.colors && (f.stylize = Ag), f;
}
o(Ng, "normaliseOptions");
T(Ng, "normaliseOptions");
function Ig(e) {
  return e >= "\uD800" && e <= "\uDBFF";
}
o(Ig, "isHighSurrogate");
T(Ig, "isHighSurrogate");
function xt(e, t, r = Br) {
  e = String(e);
  let n = r.length, i = e.length;
  if (n > t && i > n)
    return r;
  if (i > t && i > n) {
    let a = t - n;
    return a > 0 && Ig(e[a - 1]) && (a = a - 1), `${e.slice(0, a)}${r}`;
  }
  return e;
}
o(xt, "truncate");
T(xt, "truncate");
function Je(e, t, r, n = ", ") {
  r = r || t.inspect;
  let i = e.length;
  if (i === 0)
    return "";
  let a = t.truncate, s = "", l = "", c = "";
  for (let u = 0; u < i; u += 1) {
    let d = u + 1 === e.length, f = u + 2 === e.length;
    c = `${Br}(${e.length - u})`;
    let h = e[u];
    t.truncate = a - s.length - (d ? 0 : n.length);
    let m = l || r(h, t) + (d ? "" : n), y = s.length + m.length, g = y + c.length;
    if (d && y > a && s.length + c.length <= a || !d && !f && g > a || (l = d ? "" : r(e[u + 1], t) + (f ? "" : n), !d && f && g > a && y + l.
    length > a))
      break;
    if (s += m, !d && !f && y + l.length >= a) {
      c = `${Br}(${e.length - u - 1})`;
      break;
    }
    c = "";
  }
  return `${s}${c}`;
}
o(Je, "inspectList");
T(Je, "inspectList");
function jg(e) {
  return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
}
o(jg, "quoteComplexKey");
T(jg, "quoteComplexKey");
function Dr([e, t], r) {
  return r.truncate -= 2, typeof e == "string" ? e = jg(e) : typeof e != "number" && (e = `[${r.inspect(e, r)}]`), r.truncate -= e.length, t =
  r.inspect(t, r), `${e}: ${t}`;
}
o(Dr, "inspectProperty");
T(Dr, "inspectProperty");
function kg(e, t) {
  let r = Object.keys(e).slice(e.length);
  if (!e.length && !r.length)
    return "[]";
  t.truncate -= 4;
  let n = Je(e, t);
  t.truncate -= n.length;
  let i = "";
  return r.length && (i = Je(r.map((a) => [a, e[a]]), t, Dr)), `[ ${n}${i ? `, ${i}` : ""} ]`;
}
o(kg, "inspectArray");
T(kg, "inspectArray");
var aj = /* @__PURE__ */ T((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] :
e.constructor.name, "getArrayName");
function vt(e, t) {
  let r = aj(e);
  t.truncate -= r.length + 4;
  let n = Object.keys(e).slice(e.length);
  if (!e.length && !n.length)
    return `${r}[]`;
  let i = "";
  for (let s = 0; s < e.length; s++) {
    let l = `${t.stylize(xt(e[s], t.truncate), "number")}${s === e.length - 1 ? "" : ", "}`;
    if (t.truncate -= l.length, e[s] !== e.length && t.truncate <= 3) {
      i += `${Br}(${e.length - e[s] + 1})`;
      break;
    }
    i += l;
  }
  let a = "";
  return n.length && (a = Je(n.map((s) => [s, e[s]]), t, Dr)), `${r}[ ${i}${a ? `, ${a}` : ""} ]`;
}
o(vt, "inspectTypedArray");
T(vt, "inspectTypedArray");
function Lg(e, t) {
  let r = e.toJSON();
  if (r === null)
    return "Invalid Date";
  let n = r.split("T"), i = n[0];
  return t.stylize(`${i}T${xt(n[1], t.truncate - i.length - 1)}`, "date");
}
o(Lg, "inspectDate");
T(Lg, "inspectDate");
function ep(e, t) {
  let r = e[Symbol.toStringTag] || "Function", n = e.name;
  return n ? t.stylize(`[${r} ${xt(n, t.truncate - 11)}]`, "special") : t.stylize(`[${r}]`, "special");
}
o(ep, "inspectFunction");
T(ep, "inspectFunction");
function $g([e, t], r) {
  return r.truncate -= 4, e = r.inspect(e, r), r.truncate -= e.length, t = r.inspect(t, r), `${e} => ${t}`;
}
o($g, "inspectMapEntry");
T($g, "inspectMapEntry");
function Bg(e) {
  let t = [];
  return e.forEach((r, n) => {
    t.push([n, r]);
  }), t;
}
o(Bg, "mapToEntries");
T(Bg, "mapToEntries");
function Dg(e, t) {
  return e.size - 1 <= 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${Je(Bg(e), t, $g)} }`);
}
o(Dg, "inspectMap");
T(Dg, "inspectMap");
var sj = Number.isNaN || ((e) => e !== e);
function tp(e, t) {
  return sj(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") :
  e === 0 ? t.stylize(1 / e === 1 / 0 ? "+0" : "-0", "number") : t.stylize(xt(String(e), t.truncate), "number");
}
o(tp, "inspectNumber");
T(tp, "inspectNumber");
function rp(e, t) {
  let r = xt(e.toString(), t.truncate - 1);
  return r !== Br && (r += "n"), t.stylize(r, "bigint");
}
o(rp, "inspectBigInt");
T(rp, "inspectBigInt");
function Fg(e, t) {
  let r = e.toString().split("/")[2], n = t.truncate - (2 + r.length), i = e.source;
  return t.stylize(`/${xt(i, n)}/${r}`, "regexp");
}
o(Fg, "inspectRegExp");
T(Fg, "inspectRegExp");
function Ug(e) {
  let t = [];
  return e.forEach((r) => {
    t.push(r);
  }), t;
}
o(Ug, "arrayFromSet");
T(Ug, "arrayFromSet");
function Hg(e, t) {
  return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${Je(Ug(e), t)} }`);
}
o(Hg, "inspectSet");
T(Hg, "inspectSet");
var bg = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\u\
ffff]", "g"), lj = {
  "\b": "\\b",
  "	": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "'": "\\'",
  "\\": "\\\\"
}, uj = 16, cj = 4;
function Vg(e) {
  return lj[e] || `\\u${`0000${e.charCodeAt(0).toString(uj)}`.slice(-cj)}`;
}
o(Vg, "escape");
T(Vg, "escape");
function np(e, t) {
  return bg.test(e) && (e = e.replace(bg, Vg)), t.stylize(`'${xt(e, t.truncate - 2)}'`, "string");
}
o(np, "inspectString");
T(np, "inspectString");
function op(e) {
  return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
o(op, "inspectSymbol");
T(op, "inspectSymbol");
var zg = /* @__PURE__ */ T(() => "Promise{\u2026}", "getPromiseValue");
try {
  let { getPromiseDetails: e, kPending: t, kRejected: r } = process.binding("util");
  Array.isArray(e(Promise.resolve())) && (zg = /* @__PURE__ */ T((n, i) => {
    let [a, s] = e(n);
    return a === t ? "Promise{<pending>}" : `Promise${a === r ? "!" : ""}{${i.inspect(s, i)}}`;
  }, "getPromiseValue"));
} catch {
}
var dj = zg;
function Mn(e, t) {
  let r = Object.getOwnPropertyNames(e), n = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
  if (r.length === 0 && n.length === 0)
    return "{}";
  if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let i = Je(r.map((l) => [l, e[l]]), t, Dr), a = Je(n.map((l) => [l, e[l]]), t, Dr);
  t.seen.pop();
  let s = "";
  return i && a && (s = ", "), `{ ${i}${s}${a} }`;
}
o(Mn, "inspectObject");
T(Mn, "inspectObject");
var Qf = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function Wg(e, t) {
  let r = "";
  return Qf && Qf in e && (r = e[Qf]), r = r || e.constructor.name, (!r || r === "_class") && (r = "<Anonymous Class>"), t.truncate -= r.length,
  `${r}${Mn(e, t)}`;
}
o(Wg, "inspectClass");
T(Wg, "inspectClass");
function Gg(e, t) {
  return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${Je(e, t)} ]`);
}
o(Gg, "inspectArguments");
T(Gg, "inspectArguments");
var fj = [
  "stack",
  "line",
  "column",
  "name",
  "message",
  "fileName",
  "lineNumber",
  "columnNumber",
  "number",
  "description",
  "cause"
];
function Kg(e, t) {
  let r = Object.getOwnPropertyNames(e).filter((s) => fj.indexOf(s) === -1), n = e.name;
  t.truncate -= n.length;
  let i = "";
  if (typeof e.message == "string" ? i = xt(e.message, t.truncate) : r.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5,
  t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let a = Je(r.map((s) => [s, e[s]]), t, Dr);
  return `${n}${i}${a ? ` { ${a} }` : ""}`;
}
o(Kg, "inspectObject2");
T(Kg, "inspectObject");
function Yg([e, t], r) {
  return r.truncate -= 3, t ? `${r.stylize(String(e), "yellow")}=${r.stylize(`"${t}"`, "string")}` : `${r.stylize(String(e), "yellow")}`;
}
o(Yg, "inspectAttribute");
T(Yg, "inspectAttribute");
function Go(e, t) {
  return Je(e, t, bp, `
`);
}
o(Go, "inspectHTMLCollection");
T(Go, "inspectHTMLCollection");
function bp(e, t) {
  let r = e.getAttributeNames(), n = e.tagName.toLowerCase(), i = t.stylize(`<${n}`, "special"), a = t.stylize(">", "special"), s = t.stylize(
  `</${n}>`, "special");
  t.truncate -= n.length * 2 + 5;
  let l = "";
  r.length > 0 && (l += " ", l += Je(r.map((d) => [d, e.getAttribute(d)]), t, Yg, " ")), t.truncate -= l.length;
  let c = t.truncate, u = Go(e.children, t);
  return u && u.length > c && (u = `${Br}(${e.children.length})`), `${i}${l}${a}${u}${s}`;
}
o(bp, "inspectHTML");
T(bp, "inspectHTML");
var pj = typeof Symbol == "function" && typeof Symbol.for == "function", Zf = pj ? Symbol.for("chai/inspect") : "@@chai/inspect", $r = !1;
try {
  let e = nj();
  $r = e.inspect ? e.inspect.custom : !1;
} catch {
  $r = !1;
}
var yg = /* @__PURE__ */ new WeakMap(), gg = {}, vg = {
  undefined: /* @__PURE__ */ o((e, t) => t.stylize("undefined", "undefined"), "undefined"),
  null: /* @__PURE__ */ o((e, t) => t.stylize("null", "null"), "null"),
  boolean: /* @__PURE__ */ o((e, t) => t.stylize(String(e), "boolean"), "boolean"),
  Boolean: /* @__PURE__ */ o((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
  number: tp,
  Number: tp,
  bigint: rp,
  BigInt: rp,
  string: np,
  String: np,
  function: ep,
  Function: ep,
  symbol: op,
  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
  Symbol: op,
  Array: kg,
  Date: Lg,
  Map: Dg,
  Set: Hg,
  RegExp: Fg,
  Promise: dj,
  // WeakSet, WeakMap are totally opaque to us
  WeakSet: /* @__PURE__ */ o((e, t) => t.stylize("WeakSet{\u2026}", "special"), "WeakSet"),
  WeakMap: /* @__PURE__ */ o((e, t) => t.stylize("WeakMap{\u2026}", "special"), "WeakMap"),
  Arguments: Gg,
  Int8Array: vt,
  Uint8Array: vt,
  Uint8ClampedArray: vt,
  Int16Array: vt,
  Uint16Array: vt,
  Int32Array: vt,
  Uint32Array: vt,
  Float32Array: vt,
  Float64Array: vt,
  Generator: /* @__PURE__ */ o(() => "", "Generator"),
  DataView: /* @__PURE__ */ o(() => "", "DataView"),
  ArrayBuffer: /* @__PURE__ */ o(() => "", "ArrayBuffer"),
  Error: Kg,
  HTMLCollection: Go,
  NodeList: Go
}, mj = /* @__PURE__ */ T((e, t, r) => Zf in e && typeof e[Zf] == "function" ? e[Zf](t) : $r && $r in e && typeof e[$r] == "function" ? e[$r](
t.depth, t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && yg.has(e.constructor) ? yg.get(
e.constructor)(e, t) : gg[r] ? gg[r](e, t) : "", "inspectCustom"), hj = Object.prototype.toString;
function Ko(e, t = {}) {
  let r = Ng(t, Ko), { customInspect: n } = r, i = e === null ? "null" : typeof e;
  if (i === "object" && (i = hj.call(e).slice(8, -1)), i in vg)
    return vg[i](e, r);
  if (n && e) {
    let s = mj(e, r, i);
    if (s)
      return typeof s == "string" ? s : Ko(s, r);
  }
  let a = e ? Object.getPrototypeOf(e) : !1;
  return a === Object.prototype || a === null ? Mn(e, r) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? bp(e, r) : "c\
onstructor" in e ? e.constructor !== Object ? Wg(e, r) : Mn(e, r) : e === Object(e) ? Mn(e, r) : r.stylize(String(e), i);
}
o(Ko, "inspect");
T(Ko, "inspect");
var Be = {
  /**
   * ### config.includeStack
   *
   * User configurable property, influences whether stack trace
   * is included in Assertion error message. Default of false
   * suppresses stack trace in the error message.
   *
   *     chai.config.includeStack = true;  // enable stack on error
   *
   * @param {boolean}
   * @public
   */
  includeStack: !1,
  /**
   * ### config.showDiff
   *
   * User configurable property, influences whether or not
   * the `showDiff` flag should be included in the thrown
   * AssertionErrors. `false` will always be `false`; `true`
   * will be true when the assertion has requested a diff
   * be shown.
   *
   * @param {boolean}
   * @public
   */
  showDiff: !0,
  /**
   * ### config.truncateThreshold
   *
   * User configurable property, sets length threshold for actual and
   * expected values in assertion errors. If this threshold is exceeded, for
   * example for large data structures, the value is replaced with something
   * like `[ Array(3) ]` or `{ Object (prop1, prop2) }`.
   *
   * Set it to zero if you want to disable truncating altogether.
   *
   * This is especially userful when doing assertions on arrays: having this
   * set to a reasonable large value makes the failure messages readily
   * inspectable.
   *
   *     chai.config.truncateThreshold = 0;  // disable truncating
   *
   * @param {number}
   * @public
   */
  truncateThreshold: 40,
  /**
   * ### config.useProxy
   *
   * User configurable property, defines if chai will use a Proxy to throw
   * an error when a non-existent property is read, which protects users
   * from typos when using property-based assertions.
   *
   * Set it to false if you want to disable this feature.
   *
   *     chai.config.useProxy = false;  // disable use of Proxy
   *
   * This feature is automatically disabled regardless of this config value
   * in environments that don't support proxies.
   *
   * @param {boolean}
   * @public
   */
  useProxy: !0,
  /**
   * ### config.proxyExcludedKeys
   *
   * User configurable property, defines which properties should be ignored
   * instead of throwing an error if they do not exist on the assertion.
   * This is only applied if the environment Chai is running in supports proxies and
   * if the `useProxy` configuration setting is enabled.
   * By default, `then` and `inspect` will not throw an error if they do not exist on the
   * assertion object because the `.inspect` property is read by `util.inspect` (for example, when
   * using `console.log` on the assertion object) and `.then` is necessary for promise type-checking.
   *
   *     // By default these keys will not throw an error if they do not exist on the assertion object
   *     chai.config.proxyExcludedKeys = ['then', 'inspect'];
   *
   * @param {Array}
   * @public
   */
  proxyExcludedKeys: ["then", "catch", "inspect", "toJSON"],
  /**
   * ### config.deepEqual
   *
   * User configurable property, defines which a custom function to use for deepEqual
   * comparisons.
   * By default, the function used is the one from the `deep-eql` package without custom comparator.
   *
   *     // use a custom comparator
   *     chai.config.deepEqual = (expected, actual) => {
   *         return chai.util.eql(expected, actual, {
   *             comparator: (expected, actual) => {
   *                 // for non number comparison, use the default behavior
   *                 if(typeof expected !== 'number') return null;
   *                 // allow a difference of 10 between compared numbers
   *                 return typeof actual === 'number' && Math.abs(actual - expected) < 10
   *             }
   *         })
   *     };
   *
   * @param {Function}
   * @public
   */
  deepEqual: null
};
function te(e, t, r, n) {
  var i = {
    colors: n,
    depth: typeof r > "u" ? 2 : r,
    showHidden: t,
    truncate: Be.truncateThreshold ? Be.truncateThreshold : 1 / 0
  };
  return Ko(e, i);
}
o(te, "inspect2");
T(te, "inspect");
function fr(e) {
  var t = te(e), r = Object.prototype.toString.call(e);
  if (Be.truncateThreshold && t.length >= Be.truncateThreshold) {
    if (r === "[object Function]")
      return !e.name || e.name === "" ? "[Function]" : "[Function: " + e.name + "]";
    if (r === "[object Array]")
      return "[ Array(" + e.length + ") ]";
    if (r === "[object Object]") {
      var n = Object.keys(e), i = n.length > 2 ? n.splice(0, 2).join(", ") + ", ..." : n.join(", ");
      return "{ Object (" + i + ") }";
    } else
      return t;
  } else
    return t;
}
o(fr, "objDisplay");
T(fr, "objDisplay");
function yp(e, t) {
  var r = Y(e, "negate"), n = Y(e, "object"), i = t[3], a = ti(e, t), s = r ? t[2] : t[1], l = Y(e, "message");
  return typeof s == "function" && (s = s()), s = s || "", s = s.replace(/#\{this\}/g, function() {
    return fr(n);
  }).replace(/#\{act\}/g, function() {
    return fr(a);
  }).replace(/#\{exp\}/g, function() {
    return fr(i);
  }), l ? l + ": " + s : s;
}
o(yp, "getMessage2");
T(yp, "getMessage");
function it(e, t, r) {
  var n = e.__flags || (e.__flags = /* @__PURE__ */ Object.create(null));
  t.__flags || (t.__flags = /* @__PURE__ */ Object.create(null)), r = arguments.length === 3 ? r : !0;
  for (var i in n)
    (r || i !== "object" && i !== "ssfi" && i !== "lockSsfi" && i != "message") && (t.__flags[i] = n[i]);
}
o(it, "transferFlags");
T(it, "transferFlags");
function ip(e) {
  if (typeof e > "u")
    return "undefined";
  if (e === null)
    return "null";
  let t = e[Symbol.toStringTag];
  return typeof t == "string" ? t : Object.prototype.toString.call(e).slice(8, -1);
}
o(ip, "type2");
T(ip, "type");
function gp() {
  this._key = "chai/deep-eql__" + Math.random() + Date.now();
}
o(gp, "FakeMap");
T(gp, "FakeMap");
gp.prototype = {
  get: /* @__PURE__ */ T(/* @__PURE__ */ o(function(t) {
    return t[this._key];
  }, "get"), "get"),
  set: /* @__PURE__ */ T(/* @__PURE__ */ o(function(t, r) {
    Object.isExtensible(t) && Object.defineProperty(t, this._key, {
      value: r,
      configurable: !0
    });
  }, "set"), "set")
};
var Xg = typeof WeakMap == "function" ? WeakMap : gp;
function ap(e, t, r) {
  if (!r || pr(e) || pr(t))
    return null;
  var n = r.get(e);
  if (n) {
    var i = n.get(t);
    if (typeof i == "boolean")
      return i;
  }
  return null;
}
o(ap, "memoizeCompare");
T(ap, "memoizeCompare");
function Sn(e, t, r, n) {
  if (!(!r || pr(e) || pr(t))) {
    var i = r.get(e);
    i ? i.set(t, n) : (i = new Xg(), i.set(t, n), r.set(e, i));
  }
}
o(Sn, "memoizeSet");
T(Sn, "memoizeSet");
var Jg = An;
function An(e, t, r) {
  if (r && r.comparator)
    return sp(e, t, r);
  var n = vp(e, t);
  return n !== null ? n : sp(e, t, r);
}
o(An, "deepEqual");
T(An, "deepEqual");
function vp(e, t) {
  return e === t ? e !== 0 || 1 / e === 1 / t : e !== e && // eslint-disable-line no-self-compare
  t !== t ? !0 : pr(e) || pr(t) ? !1 : null;
}
o(vp, "simpleEqual");
T(vp, "simpleEqual");
function sp(e, t, r) {
  r = r || {}, r.memoize = r.memoize === !1 ? !1 : r.memoize || new Xg();
  var n = r && r.comparator, i = ap(e, t, r.memoize);
  if (i !== null)
    return i;
  var a = ap(t, e, r.memoize);
  if (a !== null)
    return a;
  if (n) {
    var s = n(e, t);
    if (s === !1 || s === !0)
      return Sn(e, t, r.memoize, s), s;
    var l = vp(e, t);
    if (l !== null)
      return l;
  }
  var c = ip(e);
  if (c !== ip(t))
    return Sn(e, t, r.memoize, !1), !1;
  Sn(e, t, r.memoize, !0);
  var u = Qg(e, t, c, r);
  return Sn(e, t, r.memoize, u), u;
}
o(sp, "extensiveDeepEqual");
T(sp, "extensiveDeepEqual");
function Qg(e, t, r, n) {
  switch (r) {
    case "String":
    case "Number":
    case "Boolean":
    case "Date":
      return An(e.valueOf(), t.valueOf());
    case "Promise":
    case "Symbol":
    case "function":
    case "WeakMap":
    case "WeakSet":
      return e === t;
    case "Error":
      return wp(e, t, ["name", "message", "code"], n);
    case "Arguments":
    case "Int8Array":
    case "Uint8Array":
    case "Uint8ClampedArray":
    case "Int16Array":
    case "Uint16Array":
    case "Int32Array":
    case "Uint32Array":
    case "Float32Array":
    case "Float64Array":
    case "Array":
      return It(e, t, n);
    case "RegExp":
      return Zg(e, t);
    case "Generator":
      return ev(e, t, n);
    case "DataView":
      return It(new Uint8Array(e.buffer), new Uint8Array(t.buffer), n);
    case "ArrayBuffer":
      return It(new Uint8Array(e), new Uint8Array(t), n);
    case "Set":
      return lp(e, t, n);
    case "Map":
      return lp(e, t, n);
    case "Temporal.PlainDate":
    case "Temporal.PlainTime":
    case "Temporal.PlainDateTime":
    case "Temporal.Instant":
    case "Temporal.ZonedDateTime":
    case "Temporal.PlainYearMonth":
    case "Temporal.PlainMonthDay":
      return e.equals(t);
    case "Temporal.Duration":
      return e.total("nanoseconds") === t.total("nanoseconds");
    case "Temporal.TimeZone":
    case "Temporal.Calendar":
      return e.toString() === t.toString();
    default:
      return rv(e, t, n);
  }
}
o(Qg, "extensiveDeepEqualByType");
T(Qg, "extensiveDeepEqualByType");
function Zg(e, t) {
  return e.toString() === t.toString();
}
o(Zg, "regexpEqual");
T(Zg, "regexpEqual");
function lp(e, t, r) {
  try {
    if (e.size !== t.size)
      return !1;
    if (e.size === 0)
      return !0;
  } catch {
    return !1;
  }
  var n = [], i = [];
  return e.forEach(/* @__PURE__ */ T(/* @__PURE__ */ o(function(s, l) {
    n.push([s, l]);
  }, "gatherEntries"), "gatherEntries")), t.forEach(/* @__PURE__ */ T(/* @__PURE__ */ o(function(s, l) {
    i.push([s, l]);
  }, "gatherEntries"), "gatherEntries")), It(n.sort(), i.sort(), r);
}
o(lp, "entriesEqual");
T(lp, "entriesEqual");
function It(e, t, r) {
  var n = e.length;
  if (n !== t.length)
    return !1;
  if (n === 0)
    return !0;
  for (var i = -1; ++i < n; )
    if (An(e[i], t[i], r) === !1)
      return !1;
  return !0;
}
o(It, "iterableEqual");
T(It, "iterableEqual");
function ev(e, t, r) {
  return It(Yo(e), Yo(t), r);
}
o(ev, "generatorEqual");
T(ev, "generatorEqual");
function tv(e) {
  return typeof Symbol < "u" && typeof e == "object" && typeof Symbol.iterator < "u" && typeof e[Symbol.iterator] == "function";
}
o(tv, "hasIteratorFunction");
T(tv, "hasIteratorFunction");
function up(e) {
  if (tv(e))
    try {
      return Yo(e[Symbol.iterator]());
    } catch {
      return [];
    }
  return [];
}
o(up, "getIteratorEntries");
T(up, "getIteratorEntries");
function Yo(e) {
  for (var t = e.next(), r = [t.value]; t.done === !1; )
    t = e.next(), r.push(t.value);
  return r;
}
o(Yo, "getGeneratorEntries");
T(Yo, "getGeneratorEntries");
function cp(e) {
  var t = [];
  for (var r in e)
    t.push(r);
  return t;
}
o(cp, "getEnumerableKeys");
T(cp, "getEnumerableKeys");
function dp(e) {
  for (var t = [], r = Object.getOwnPropertySymbols(e), n = 0; n < r.length; n += 1) {
    var i = r[n];
    Object.getOwnPropertyDescriptor(e, i).enumerable && t.push(i);
  }
  return t;
}
o(dp, "getEnumerableSymbols");
T(dp, "getEnumerableSymbols");
function wp(e, t, r, n) {
  var i = r.length;
  if (i === 0)
    return !0;
  for (var a = 0; a < i; a += 1)
    if (An(e[r[a]], t[r[a]], n) === !1)
      return !1;
  return !0;
}
o(wp, "keysEqual");
T(wp, "keysEqual");
function rv(e, t, r) {
  var n = cp(e), i = cp(t), a = dp(e), s = dp(t);
  if (n = n.concat(a), i = i.concat(s), n.length && n.length === i.length)
    return It(fp(n).sort(), fp(i).sort()) === !1 ? !1 : wp(e, t, n, r);
  var l = up(e), c = up(t);
  return l.length && l.length === c.length ? (l.sort(), c.sort(), It(l, c, r)) : n.length === 0 && l.length === 0 && i.length === 0 && c.length ===
  0;
}
o(rv, "objectEqual");
T(rv, "objectEqual");
function pr(e) {
  return e === null || typeof e != "object";
}
o(pr, "isPrimitive");
T(pr, "isPrimitive");
function fp(e) {
  return e.map(/* @__PURE__ */ T(/* @__PURE__ */ o(function(r) {
    return typeof r == "symbol" ? r.toString() : r;
  }, "mapSymbol"), "mapSymbol"));
}
o(fp, "mapSymbols");
T(fp, "mapSymbols");
function ri(e, t) {
  return typeof e > "u" || e === null ? !1 : t in Object(e);
}
o(ri, "hasProperty");
T(ri, "hasProperty");
function nv(e) {
  return e.replace(/([^\\])\[/g, "$1.[").match(/(\\\.|[^.]+?)+/g).map((n) => {
    if (n === "constructor" || n === "__proto__" || n === "prototype")
      return {};
    let a = /^\[(\d+)\]$/.exec(n), s = null;
    return a ? s = { i: parseFloat(a[1]) } : s = { p: n.replace(/\\([.[\]])/g, "$1") }, s;
  });
}
o(nv, "parsePath");
T(nv, "parsePath");
function pp(e, t, r) {
  let n = e, i = null;
  r = typeof r > "u" ? t.length : r;
  for (let a = 0; a < r; a++) {
    let s = t[a];
    n && (typeof s.p > "u" ? n = n[s.i] : n = n[s.p], a === r - 1 && (i = n));
  }
  return i;
}
o(pp, "internalGetPathValue");
T(pp, "internalGetPathValue");
function Ep(e, t) {
  let r = nv(t), n = r[r.length - 1], i = {
    parent: r.length > 1 ? pp(e, r, r.length - 1) : e,
    name: n.p || n.i,
    value: pp(e, r)
  };
  return i.exists = ri(i.parent, i.name), i;
}
o(Ep, "getPathInfo");
T(Ep, "getPathInfo");
function w(e, t, r, n) {
  return Y(this, "ssfi", r || w), Y(this, "lockSsfi", n), Y(this, "object", e), Y(this, "message", t), Y(this, "eql", Be.deepEqual || Jg), Fr(
  this);
}
o(w, "Assertion");
T(w, "Assertion");
Object.defineProperty(w, "includeStack", {
  get: /* @__PURE__ */ o(function() {
    return console.warn(
      "Assertion.includeStack is deprecated, use chai.config.includeStack instead."
    ), Be.includeStack;
  }, "get"),
  set: /* @__PURE__ */ o(function(e) {
    console.warn(
      "Assertion.includeStack is deprecated, use chai.config.includeStack instead."
    ), Be.includeStack = e;
  }, "set")
});
Object.defineProperty(w, "showDiff", {
  get: /* @__PURE__ */ o(function() {
    return console.warn(
      "Assertion.showDiff is deprecated, use chai.config.showDiff instead."
    ), Be.showDiff;
  }, "get"),
  set: /* @__PURE__ */ o(function(e) {
    console.warn(
      "Assertion.showDiff is deprecated, use chai.config.showDiff instead."
    ), Be.showDiff = e;
  }, "set")
});
w.addProperty = function(e, t) {
  Cp(this.prototype, e, t);
};
w.addMethod = function(e, t) {
  xp(this.prototype, e, t);
};
w.addChainableMethod = function(e, t, r) {
  qp(this.prototype, e, t, r);
};
w.overwriteProperty = function(e, t) {
  _p(this.prototype, e, t);
};
w.overwriteMethod = function(e, t) {
  Pp(this.prototype, e, t);
};
w.overwriteChainableMethod = function(e, t, r) {
  Rp(this.prototype, e, t, r);
};
w.prototype.assert = function(e, t, r, n, i, a) {
  var s = hp(this, arguments);
  if (a !== !1 && (a = !0), n === void 0 && i === void 0 && (a = !1), Be.showDiff !== !0 && (a = !1), !s) {
    t = yp(this, arguments);
    var l = ti(this, arguments), c = {
      actual: l,
      expected: n,
      showDiff: a
    }, u = Sp(this, arguments);
    throw u && (c.operator = u), new re(
      t,
      c,
      Be.includeStack ? this.assert : Y(this, "ssfi")
    );
  }
};
Object.defineProperty(w.prototype, "_obj", {
  get: /* @__PURE__ */ o(function() {
    return Y(this, "object");
  }, "get"),
  set: /* @__PURE__ */ o(function(e) {
    Y(this, "object", e);
  }, "set")
});
function Nn() {
  return Be.useProxy && typeof Proxy < "u" && typeof Reflect < "u";
}
o(Nn, "isProxyEnabled");
T(Nn, "isProxyEnabled");
function Cp(e, t, r) {
  r = r === void 0 ? function() {
  } : r, Object.defineProperty(e, t, {
    get: /* @__PURE__ */ T(/* @__PURE__ */ o(function n() {
      !Nn() && !Y(this, "lockSsfi") && Y(this, "ssfi", n);
      var i = r.call(this);
      if (i !== void 0)
        return i;
      var a = new w();
      return it(this, a), a;
    }, "propertyGetter"), "propertyGetter"),
    configurable: !0
  });
}
o(Cp, "addProperty");
T(Cp, "addProperty");
var bj = Object.getOwnPropertyDescriptor(function() {
}, "length");
function In(e, t, r) {
  return bj.configurable && Object.defineProperty(e, "length", {
    get: /* @__PURE__ */ o(function() {
      throw Error(
        r ? "Invalid Chai property: " + t + '.length. Due to a compatibility issue, "length" cannot directly follow "' + t + '". Use "' + t +
        '.lengthOf" instead.' : "Invalid Chai property: " + t + '.length. See docs for proper usage of "' + t + '".'
      );
    }, "get")
  }), e;
}
o(In, "addLengthGuard");
T(In, "addLengthGuard");
function ov(e) {
  var t = Object.getOwnPropertyNames(e);
  function r(i) {
    t.indexOf(i) === -1 && t.push(i);
  }
  o(r, "addProperty2"), T(r, "addProperty");
  for (var n = Object.getPrototypeOf(e); n !== null; )
    Object.getOwnPropertyNames(n).forEach(r), n = Object.getPrototypeOf(n);
  return t;
}
o(ov, "getProperties");
T(ov, "getProperties");
var wg = ["__flags", "__methods", "_obj", "assert"];
function Fr(e, t) {
  return Nn() ? new Proxy(e, {
    get: /* @__PURE__ */ T(/* @__PURE__ */ o(function r(n, i) {
      if (typeof i == "string" && Be.proxyExcludedKeys.indexOf(i) === -1 && !Reflect.has(n, i)) {
        if (t)
          throw Error(
            "Invalid Chai property: " + t + "." + i + '. See docs for proper usage of "' + t + '".'
          );
        var a = null, s = 4;
        throw ov(n).forEach(function(l) {
          if (
            // we actually mean to check `Object.prototype` here
            // eslint-disable-next-line no-prototype-builtins
            !Object.prototype.hasOwnProperty(l) && wg.indexOf(l) === -1
          ) {
            var c = iv(i, l, s);
            c < s && (a = l, s = c);
          }
        }), Error(
          a !== null ? "Invalid Chai property: " + i + '. Did you mean "' + a + '"?' : "Invalid Chai property: " + i
        );
      }
      return wg.indexOf(i) === -1 && !Y(n, "lockSsfi") && Y(n, "ssfi", r), Reflect.get(n, i);
    }, "proxyGetter"), "proxyGetter")
  }) : e;
}
o(Fr, "proxify");
T(Fr, "proxify");
function iv(e, t, r) {
  if (Math.abs(e.length - t.length) >= r)
    return r;
  var n = [];
  for (let a = 0; a <= e.length; a++)
    n[a] = Array(t.length + 1).fill(0), n[a][0] = a;
  for (let a = 0; a < t.length; a++)
    n[0][a] = a;
  for (let a = 1; a <= e.length; a++) {
    var i = e.charCodeAt(a - 1);
    for (let s = 1; s <= t.length; s++) {
      if (Math.abs(a - s) >= r) {
        n[a][s] = r;
        continue;
      }
      n[a][s] = Math.min(
        n[a - 1][s] + 1,
        n[a][s - 1] + 1,
        n[a - 1][s - 1] + (i === t.charCodeAt(s - 1) ? 0 : 1)
      );
    }
  }
  return n[e.length][t.length];
}
o(iv, "stringDistanceCapped");
T(iv, "stringDistanceCapped");
function xp(e, t, r) {
  var n = /* @__PURE__ */ T(function() {
    Y(this, "lockSsfi") || Y(this, "ssfi", n);
    var i = r.apply(this, arguments);
    if (i !== void 0)
      return i;
    var a = new w();
    return it(this, a), a;
  }, "methodWrapper");
  In(n, t, !1), e[t] = Fr(n, t);
}
o(xp, "addMethod");
T(xp, "addMethod");
function _p(e, t, r) {
  var n = Object.getOwnPropertyDescriptor(e, t), i = /* @__PURE__ */ T(function() {
  }, "_super");
  n && typeof n.get == "function" && (i = n.get), Object.defineProperty(e, t, {
    get: /* @__PURE__ */ T(/* @__PURE__ */ o(function a() {
      !Nn() && !Y(this, "lockSsfi") && Y(this, "ssfi", a);
      var s = Y(this, "lockSsfi");
      Y(this, "lockSsfi", !0);
      var l = r(i).call(this);
      if (Y(this, "lockSsfi", s), l !== void 0)
        return l;
      var c = new w();
      return it(this, c), c;
    }, "overwritingPropertyGetter"), "overwritingPropertyGetter"),
    configurable: !0
  });
}
o(_p, "overwriteProperty");
T(_p, "overwriteProperty");
function Pp(e, t, r) {
  var n = e[t], i = /* @__PURE__ */ T(function() {
    throw new Error(t + " is not a function");
  }, "_super");
  n && typeof n == "function" && (i = n);
  var a = /* @__PURE__ */ T(function() {
    Y(this, "lockSsfi") || Y(this, "ssfi", a);
    var s = Y(this, "lockSsfi");
    Y(this, "lockSsfi", !0);
    var l = r(i).apply(this, arguments);
    if (Y(this, "lockSsfi", s), l !== void 0)
      return l;
    var c = new w();
    return it(this, c), c;
  }, "overwritingMethodWrapper");
  In(a, t, !1), e[t] = Fr(a, t);
}
o(Pp, "overwriteMethod");
T(Pp, "overwriteMethod");
var yj = typeof Object.setPrototypeOf == "function", Eg = /* @__PURE__ */ T(function() {
}, "testFn"), gj = Object.getOwnPropertyNames(Eg).filter(function(e) {
  var t = Object.getOwnPropertyDescriptor(Eg, e);
  return typeof t != "object" ? !0 : !t.configurable;
}), vj = Function.prototype.call, wj = Function.prototype.apply;
function qp(e, t, r, n) {
  typeof n != "function" && (n = /* @__PURE__ */ T(function() {
  }, "chainingBehavior"));
  var i = {
    method: r,
    chainingBehavior: n
  };
  e.__methods || (e.__methods = {}), e.__methods[t] = i, Object.defineProperty(e, t, {
    get: /* @__PURE__ */ T(/* @__PURE__ */ o(function() {
      i.chainingBehavior.call(this);
      var s = /* @__PURE__ */ T(function() {
        Y(this, "lockSsfi") || Y(this, "ssfi", s);
        var u = i.method.apply(this, arguments);
        if (u !== void 0)
          return u;
        var d = new w();
        return it(this, d), d;
      }, "chainableMethodWrapper");
      if (In(s, t, !0), yj) {
        var l = Object.create(this);
        l.call = vj, l.apply = wj, Object.setPrototypeOf(s, l);
      } else {
        var c = Object.getOwnPropertyNames(e);
        c.forEach(function(u) {
          if (gj.indexOf(u) === -1) {
            var d = Object.getOwnPropertyDescriptor(e, u);
            Object.defineProperty(s, u, d);
          }
        });
      }
      return it(this, s), Fr(s);
    }, "chainableMethodGetter"), "chainableMethodGetter"),
    configurable: !0
  });
}
o(qp, "addChainableMethod");
T(qp, "addChainableMethod");
function Rp(e, t, r, n) {
  var i = e.__methods[t], a = i.chainingBehavior;
  i.chainingBehavior = /* @__PURE__ */ T(/* @__PURE__ */ o(function() {
    var c = n(a).call(this);
    if (c !== void 0)
      return c;
    var u = new w();
    return it(this, u), u;
  }, "overwritingChainableMethodGetter"), "overwritingChainableMethodGetter");
  var s = i.method;
  i.method = /* @__PURE__ */ T(/* @__PURE__ */ o(function() {
    var c = r(s).apply(this, arguments);
    if (c !== void 0)
      return c;
    var u = new w();
    return it(this, u), u;
  }, "overwritingChainableMethodWrapper"), "overwritingChainableMethodWrapper");
}
o(Rp, "overwriteChainableMethod");
T(Rp, "overwriteChainableMethod");
function Xo(e, t) {
  return te(e) < te(t) ? -1 : 1;
}
o(Xo, "compareByInspect");
T(Xo, "compareByInspect");
function Tp(e) {
  return typeof Object.getOwnPropertySymbols != "function" ? [] : Object.getOwnPropertySymbols(e).filter(function(t) {
    return Object.getOwnPropertyDescriptor(e, t).enumerable;
  });
}
o(Tp, "getOwnEnumerablePropertySymbols");
T(Tp, "getOwnEnumerablePropertySymbols");
function Op(e) {
  return Object.keys(e).concat(Tp(e));
}
o(Op, "getOwnEnumerableProperties");
T(Op, "getOwnEnumerableProperties");
var Jo = Number.isNaN;
function av(e) {
  var t = le(e), r = ["Array", "Object", "Function"];
  return r.indexOf(t) !== -1;
}
o(av, "isObjectType");
T(av, "isObjectType");
function Sp(e, t) {
  var r = Y(e, "operator"), n = Y(e, "negate"), i = t[3], a = n ? t[2] : t[1];
  if (r)
    return r;
  if (typeof a == "function" && (a = a()), a = a || "", !!a && !/\shave\s/.test(a)) {
    var s = av(i);
    return /\snot\s/.test(a) ? s ? "notDeepStrictEqual" : "notStrictEqual" : s ? "deepStrictEqual" : "strictEqual";
  }
}
o(Sp, "getOperator");
T(Sp, "getOperator");
function ni(e) {
  return e.name;
}
o(ni, "getName");
T(ni, "getName");
function Qo(e) {
  return Object.prototype.toString.call(e) === "[object RegExp]";
}
o(Qo, "isRegExp2");
T(Qo, "isRegExp");
function Te(e) {
  return ["Number", "BigInt"].includes(le(e));
}
o(Te, "isNumeric");
T(Te, "isNumeric");
var { flag: _ } = Xe;
[
  "to",
  "be",
  "been",
  "is",
  "and",
  "has",
  "have",
  "with",
  "that",
  "which",
  "at",
  "of",
  "same",
  "but",
  "does",
  "still",
  "also"
].forEach(function(e) {
  w.addProperty(e);
});
w.addProperty("not", function() {
  _(this, "negate", !0);
});
w.addProperty("deep", function() {
  _(this, "deep", !0);
});
w.addProperty("nested", function() {
  _(this, "nested", !0);
});
w.addProperty("own", function() {
  _(this, "own", !0);
});
w.addProperty("ordered", function() {
  _(this, "ordered", !0);
});
w.addProperty("any", function() {
  _(this, "any", !0), _(this, "all", !1);
});
w.addProperty("all", function() {
  _(this, "all", !0), _(this, "any", !1);
});
var Cg = {
  function: [
    "function",
    "asyncfunction",
    "generatorfunction",
    "asyncgeneratorfunction"
  ],
  asyncfunction: ["asyncfunction", "asyncgeneratorfunction"],
  generatorfunction: ["generatorfunction", "asyncgeneratorfunction"],
  asyncgeneratorfunction: ["asyncgeneratorfunction"]
};
function Mp(e, t) {
  t && _(this, "message", t), e = e.toLowerCase();
  var r = _(this, "object"), n = ~["a", "e", "i", "o", "u"].indexOf(e.charAt(0)) ? "an " : "a ";
  let i = le(r).toLowerCase();
  Cg.function.includes(e) ? this.assert(
    Cg[e].includes(i),
    "expected #{this} to be " + n + e,
    "expected #{this} not to be " + n + e
  ) : this.assert(
    e === i,
    "expected #{this} to be " + n + e,
    "expected #{this} not to be " + n + e
  );
}
o(Mp, "an");
T(Mp, "an");
w.addChainableMethod("an", Mp);
w.addChainableMethod("a", Mp);
function sv(e, t) {
  return Jo(e) && Jo(t) || e === t;
}
o(sv, "SameValueZero");
T(sv, "SameValueZero");
function jn() {
  _(this, "contains", !0);
}
o(jn, "includeChainingBehavior");
T(jn, "includeChainingBehavior");
function kn(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = le(r).toLowerCase(), i = _(this, "message"), a = _(this, "negate"), s = _(this, "ssfi"), l = _(this, "deep"),
  c = l ? "deep " : "", u = l ? _(this, "eql") : sv;
  i = i ? i + ": " : "";
  var d = !1;
  switch (n) {
    case "string":
      d = r.indexOf(e) !== -1;
      break;
    case "weakset":
      if (l)
        throw new re(
          i + "unable to use .deep.include with WeakSet",
          void 0,
          s
        );
      d = r.has(e);
      break;
    case "map":
      r.forEach(function(y) {
        d = d || u(y, e);
      });
      break;
    case "set":
      l ? r.forEach(function(y) {
        d = d || u(y, e);
      }) : d = r.has(e);
      break;
    case "array":
      l ? d = r.some(function(y) {
        return u(y, e);
      }) : d = r.indexOf(e) !== -1;
      break;
    default:
      if (e !== Object(e))
        throw new re(
          i + "the given combination of arguments (" + n + " and " + le(e).toLowerCase() + ") is invalid for this assertion. You can use an \
array, a map, an object, a set, a string, or a weakset instead of a " + le(e).toLowerCase(),
          void 0,
          s
        );
      var f = Object.keys(e), h = null, m = 0;
      if (f.forEach(function(y) {
        var g = new w(r);
        if (it(this, g, !0), _(g, "lockSsfi", !0), !a || f.length === 1) {
          g.property(y, e[y]);
          return;
        }
        try {
          g.property(y, e[y]);
        } catch (x) {
          if (!We.compatibleConstructor(x, re))
            throw x;
          h === null && (h = x), m++;
        }
      }, this), a && f.length > 1 && m === f.length)
        throw h;
      return;
  }
  this.assert(
    d,
    "expected #{this} to " + c + "include " + te(e),
    "expected #{this} to not " + c + "include " + te(e)
  );
}
o(kn, "include");
T(kn, "include");
w.addChainableMethod("include", kn, jn);
w.addChainableMethod("contain", kn, jn);
w.addChainableMethod("contains", kn, jn);
w.addChainableMethod("includes", kn, jn);
w.addProperty("ok", function() {
  this.assert(
    _(this, "object"),
    "expected #{this} to be truthy",
    "expected #{this} to be falsy"
  );
});
w.addProperty("true", function() {
  this.assert(
    _(this, "object") === !0,
    "expected #{this} to be true",
    "expected #{this} to be false",
    !_(this, "negate")
  );
});
w.addProperty("numeric", function() {
  let e = _(this, "object");
  this.assert(
    ["Number", "BigInt"].includes(le(e)),
    "expected #{this} to be numeric",
    "expected #{this} to not be numeric",
    !_(this, "negate")
  );
});
w.addProperty("callable", function() {
  let e = _(this, "object"), t = _(this, "ssfi"), r = _(this, "message"), n = r ? `${r}: ` : "", i = _(this, "negate"), a = i ? `${n}expecte\
d ${te(e)} not to be a callable function` : `${n}expected ${te(e)} to be a callable function`, s = [
    "Function",
    "AsyncFunction",
    "GeneratorFunction",
    "AsyncGeneratorFunction"
  ].includes(le(e));
  if (s && i || !s && !i)
    throw new re(a, void 0, t);
});
w.addProperty("false", function() {
  this.assert(
    _(this, "object") === !1,
    "expected #{this} to be false",
    "expected #{this} to be true",
    !!_(this, "negate")
  );
});
w.addProperty("null", function() {
  this.assert(
    _(this, "object") === null,
    "expected #{this} to be null",
    "expected #{this} not to be null"
  );
});
w.addProperty("undefined", function() {
  this.assert(
    _(this, "object") === void 0,
    "expected #{this} to be undefined",
    "expected #{this} not to be undefined"
  );
});
w.addProperty("NaN", function() {
  this.assert(
    Jo(_(this, "object")),
    "expected #{this} to be NaN",
    "expected #{this} not to be NaN"
  );
});
function Ap() {
  var e = _(this, "object");
  this.assert(
    e != null,
    "expected #{this} to exist",
    "expected #{this} to not exist"
  );
}
o(Ap, "assertExist");
T(Ap, "assertExist");
w.addProperty("exist", Ap);
w.addProperty("exists", Ap);
w.addProperty("empty", function() {
  var e = _(this, "object"), t = _(this, "ssfi"), r = _(this, "message"), n;
  switch (r = r ? r + ": " : "", le(e).toLowerCase()) {
    case "array":
    case "string":
      n = e.length;
      break;
    case "map":
    case "set":
      n = e.size;
      break;
    case "weakmap":
    case "weakset":
      throw new re(
        r + ".empty was passed a weak collection",
        void 0,
        t
      );
    case "function":
      var i = r + ".empty was passed a function " + ni(e);
      throw new re(i.trim(), void 0, t);
    default:
      if (e !== Object(e))
        throw new re(
          r + ".empty was passed non-string primitive " + te(e),
          void 0,
          t
        );
      n = Object.keys(e).length;
  }
  this.assert(
    n === 0,
    "expected #{this} to be empty",
    "expected #{this} not to be empty"
  );
});
function Np() {
  var e = _(this, "object"), t = le(e);
  this.assert(
    t === "Arguments",
    "expected #{this} to be arguments but got " + t,
    "expected #{this} to not be arguments"
  );
}
o(Np, "checkArguments");
T(Np, "checkArguments");
w.addProperty("arguments", Np);
w.addProperty("Arguments", Np);
function oi(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object");
  if (_(this, "deep")) {
    var n = _(this, "lockSsfi");
    _(this, "lockSsfi", !0), this.eql(e), _(this, "lockSsfi", n);
  } else
    this.assert(
      e === r,
      "expected #{this} to equal #{exp}",
      "expected #{this} to not equal #{exp}",
      e,
      this._obj,
      !0
    );
}
o(oi, "assertEqual");
T(oi, "assertEqual");
w.addMethod("equal", oi);
w.addMethod("equals", oi);
w.addMethod("eq", oi);
function Ip(e, t) {
  t && _(this, "message", t);
  var r = _(this, "eql");
  this.assert(
    r(e, _(this, "object")),
    "expected #{this} to deeply equal #{exp}",
    "expected #{this} to not deeply equal #{exp}",
    e,
    this._obj,
    !0
  );
}
o(Ip, "assertEql");
T(Ip, "assertEql");
w.addMethod("eql", Ip);
w.addMethod("eqls", Ip);
function ii(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "doLength"), i = _(this, "message"), a = i ? i + ": " : "", s = _(this, "ssfi"), l = le(r).toLowerCase(),
  c = le(e).toLowerCase();
  if (n && l !== "map" && l !== "set" && new w(r, i, s, !0).to.have.property("length"), !n && l === "date" && c !== "date")
    throw new re(
      a + "the argument to above must be a date",
      void 0,
      s
    );
  if (!Te(e) && (n || Te(r)))
    throw new re(
      a + "the argument to above must be a number",
      void 0,
      s
    );
  if (!n && l !== "date" && !Te(r)) {
    var u = l === "string" ? "'" + r + "'" : r;
    throw new re(
      a + "expected " + u + " to be a number or a date",
      void 0,
      s
    );
  }
  if (n) {
    var d = "length", f;
    l === "map" || l === "set" ? (d = "size", f = r.size) : f = r.length, this.assert(
      f > e,
      "expected #{this} to have a " + d + " above #{exp} but got #{act}",
      "expected #{this} to not have a " + d + " above #{exp}",
      e,
      f
    );
  } else
    this.assert(
      r > e,
      "expected #{this} to be above #{exp}",
      "expected #{this} to be at most #{exp}",
      e
    );
}
o(ii, "assertAbove");
T(ii, "assertAbove");
w.addMethod("above", ii);
w.addMethod("gt", ii);
w.addMethod("greaterThan", ii);
function ai(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "doLength"), i = _(this, "message"), a = i ? i + ": " : "", s = _(this, "ssfi"), l = le(r).toLowerCase(),
  c = le(e).toLowerCase(), u, d = !0;
  if (n && l !== "map" && l !== "set" && new w(r, i, s, !0).to.have.property("length"), !n && l === "date" && c !== "date")
    u = a + "the argument to least must be a date";
  else if (!Te(e) && (n || Te(r)))
    u = a + "the argument to least must be a number";
  else if (!n && l !== "date" && !Te(r)) {
    var f = l === "string" ? "'" + r + "'" : r;
    u = a + "expected " + f + " to be a number or a date";
  } else
    d = !1;
  if (d)
    throw new re(u, void 0, s);
  if (n) {
    var h = "length", m;
    l === "map" || l === "set" ? (h = "size", m = r.size) : m = r.length, this.assert(
      m >= e,
      "expected #{this} to have a " + h + " at least #{exp} but got #{act}",
      "expected #{this} to have a " + h + " below #{exp}",
      e,
      m
    );
  } else
    this.assert(
      r >= e,
      "expected #{this} to be at least #{exp}",
      "expected #{this} to be below #{exp}",
      e
    );
}
o(ai, "assertLeast");
T(ai, "assertLeast");
w.addMethod("least", ai);
w.addMethod("gte", ai);
w.addMethod("greaterThanOrEqual", ai);
function si(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "doLength"), i = _(this, "message"), a = i ? i + ": " : "", s = _(this, "ssfi"), l = le(r).toLowerCase(),
  c = le(e).toLowerCase(), u, d = !0;
  if (n && l !== "map" && l !== "set" && new w(r, i, s, !0).to.have.property("length"), !n && l === "date" && c !== "date")
    u = a + "the argument to below must be a date";
  else if (!Te(e) && (n || Te(r)))
    u = a + "the argument to below must be a number";
  else if (!n && l !== "date" && !Te(r)) {
    var f = l === "string" ? "'" + r + "'" : r;
    u = a + "expected " + f + " to be a number or a date";
  } else
    d = !1;
  if (d)
    throw new re(u, void 0, s);
  if (n) {
    var h = "length", m;
    l === "map" || l === "set" ? (h = "size", m = r.size) : m = r.length, this.assert(
      m < e,
      "expected #{this} to have a " + h + " below #{exp} but got #{act}",
      "expected #{this} to not have a " + h + " below #{exp}",
      e,
      m
    );
  } else
    this.assert(
      r < e,
      "expected #{this} to be below #{exp}",
      "expected #{this} to be at least #{exp}",
      e
    );
}
o(si, "assertBelow");
T(si, "assertBelow");
w.addMethod("below", si);
w.addMethod("lt", si);
w.addMethod("lessThan", si);
function li(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "doLength"), i = _(this, "message"), a = i ? i + ": " : "", s = _(this, "ssfi"), l = le(r).toLowerCase(),
  c = le(e).toLowerCase(), u, d = !0;
  if (n && l !== "map" && l !== "set" && new w(r, i, s, !0).to.have.property("length"), !n && l === "date" && c !== "date")
    u = a + "the argument to most must be a date";
  else if (!Te(e) && (n || Te(r)))
    u = a + "the argument to most must be a number";
  else if (!n && l !== "date" && !Te(r)) {
    var f = l === "string" ? "'" + r + "'" : r;
    u = a + "expected " + f + " to be a number or a date";
  } else
    d = !1;
  if (d)
    throw new re(u, void 0, s);
  if (n) {
    var h = "length", m;
    l === "map" || l === "set" ? (h = "size", m = r.size) : m = r.length, this.assert(
      m <= e,
      "expected #{this} to have a " + h + " at most #{exp} but got #{act}",
      "expected #{this} to have a " + h + " above #{exp}",
      e,
      m
    );
  } else
    this.assert(
      r <= e,
      "expected #{this} to be at most #{exp}",
      "expected #{this} to be above #{exp}",
      e
    );
}
o(li, "assertMost");
T(li, "assertMost");
w.addMethod("most", li);
w.addMethod("lte", li);
w.addMethod("lessThanOrEqual", li);
w.addMethod("within", function(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "doLength"), a = _(this, "message"), s = a ? a + ": " : "", l = _(this, "ssfi"), c = le(n).toLowerCase(),
  u = le(e).toLowerCase(), d = le(t).toLowerCase(), f, h = !0, m = u === "date" && d === "date" ? e.toISOString() + ".." + t.toISOString() :
  e + ".." + t;
  if (i && c !== "map" && c !== "set" && new w(n, a, l, !0).to.have.property("length"), !i && c === "date" && (u !== "date" || d !== "date"))
    f = s + "the arguments to within must be dates";
  else if ((!Te(e) || !Te(t)) && (i || Te(n)))
    f = s + "the arguments to within must be numbers";
  else if (!i && c !== "date" && !Te(n)) {
    var y = c === "string" ? "'" + n + "'" : n;
    f = s + "expected " + y + " to be a number or a date";
  } else
    h = !1;
  if (h)
    throw new re(f, void 0, l);
  if (i) {
    var g = "length", x;
    c === "map" || c === "set" ? (g = "size", x = n.size) : x = n.length, this.assert(
      x >= e && x <= t,
      "expected #{this} to have a " + g + " within " + m,
      "expected #{this} to not have a " + g + " within " + m
    );
  } else
    this.assert(
      n >= e && n <= t,
      "expected #{this} to be within " + m,
      "expected #{this} to not be within " + m
    );
});
function jp(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "ssfi"), i = _(this, "message");
  try {
    var a = r instanceof e;
  } catch (l) {
    throw l instanceof TypeError ? (i = i ? i + ": " : "", new re(
      i + "The instanceof assertion needs a constructor but " + le(e) + " was given.",
      void 0,
      n
    )) : l;
  }
  var s = ni(e);
  s == null && (s = "an unnamed constructor"), this.assert(
    a,
    "expected #{this} to be an instance of " + s,
    "expected #{this} to not be an instance of " + s
  );
}
o(jp, "assertInstanceOf");
T(jp, "assertInstanceOf");
w.addMethod("instanceof", jp);
w.addMethod("instanceOf", jp);
function kp(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "nested"), i = _(this, "own"), a = _(this, "message"), s = _(this, "object"), l = _(this, "ssfi"), c = typeof e;
  if (a = a ? a + ": " : "", n) {
    if (c !== "string")
      throw new re(
        a + "the argument to property must be a string when using nested syntax",
        void 0,
        l
      );
  } else if (c !== "string" && c !== "number" && c !== "symbol")
    throw new re(
      a + "the argument to property must be a string, number, or symbol",
      void 0,
      l
    );
  if (n && i)
    throw new re(
      a + 'The "nested" and "own" flags cannot be combined.',
      void 0,
      l
    );
  if (s == null)
    throw new re(
      a + "Target cannot be null or undefined.",
      void 0,
      l
    );
  var u = _(this, "deep"), d = _(this, "negate"), f = n ? Ep(s, e) : null, h = n ? f.value : s[e], m = u ? _(this, "eql") : (x, b) => x === b,
  y = "";
  u && (y += "deep "), i && (y += "own "), n && (y += "nested "), y += "property ";
  var g;
  i ? g = Object.prototype.hasOwnProperty.call(s, e) : n ? g = f.exists : g = ri(s, e), (!d || arguments.length === 1) && this.assert(
    g,
    "expected #{this} to have " + y + te(e),
    "expected #{this} to not have " + y + te(e)
  ), arguments.length > 1 && this.assert(
    g && m(t, h),
    "expected #{this} to have " + y + te(e) + " of #{exp}, but got #{act}",
    "expected #{this} to not have " + y + te(e) + " of #{act}",
    t,
    h
  ), _(this, "object", h);
}
o(kp, "assertProperty");
T(kp, "assertProperty");
w.addMethod("property", kp);
function Lp(e, t, r) {
  _(this, "own", !0), kp.apply(this, arguments);
}
o(Lp, "assertOwnProperty");
T(Lp, "assertOwnProperty");
w.addMethod("ownProperty", Lp);
w.addMethod("haveOwnProperty", Lp);
function $p(e, t, r) {
  typeof t == "string" && (r = t, t = null), r && _(this, "message", r);
  var n = _(this, "object"), i = Object.getOwnPropertyDescriptor(Object(n), e), a = _(this, "eql");
  i && t ? this.assert(
    a(t, i),
    "expected the own property descriptor for " + te(e) + " on #{this} to match " + te(t) + ", got " + te(i),
    "expected the own property descriptor for " + te(e) + " on #{this} to not match " + te(t),
    t,
    i,
    !0
  ) : this.assert(
    i,
    "expected #{this} to have an own property descriptor for " + te(e),
    "expected #{this} to not have an own property descriptor for " + te(e)
  ), _(this, "object", i);
}
o($p, "assertOwnPropertyDescriptor");
T($p, "assertOwnPropertyDescriptor");
w.addMethod("ownPropertyDescriptor", $p);
w.addMethod("haveOwnPropertyDescriptor", $p);
function Bp() {
  _(this, "doLength", !0);
}
o(Bp, "assertLengthChain");
T(Bp, "assertLengthChain");
function Dp(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = le(r).toLowerCase(), i = _(this, "message"), a = _(this, "ssfi"), s = "length", l;
  switch (n) {
    case "map":
    case "set":
      s = "size", l = r.size;
      break;
    default:
      new w(r, i, a, !0).to.have.property("length"), l = r.length;
  }
  this.assert(
    l == e,
    "expected #{this} to have a " + s + " of #{exp} but got #{act}",
    "expected #{this} to not have a " + s + " of #{act}",
    e,
    l
  );
}
o(Dp, "assertLength");
T(Dp, "assertLength");
w.addChainableMethod("length", Dp, Bp);
w.addChainableMethod("lengthOf", Dp, Bp);
function Fp(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object");
  this.assert(
    e.exec(r),
    "expected #{this} to match " + e,
    "expected #{this} not to match " + e
  );
}
o(Fp, "assertMatch");
T(Fp, "assertMatch");
w.addMethod("match", Fp);
w.addMethod("matches", Fp);
w.addMethod("string", function(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "message"), i = _(this, "ssfi");
  new w(r, n, i, !0).is.a("string"), this.assert(
    ~r.indexOf(e),
    "expected #{this} to contain " + te(e),
    "expected #{this} to not contain " + te(e)
  );
});
function Up(e) {
  var t = _(this, "object"), r = le(t), n = le(e), i = _(this, "ssfi"), a = _(this, "deep"), s, l = "", c, u = !0, d = _(this, "message");
  d = d ? d + ": " : "";
  var f = d + "when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String argume\
nts";
  if (r === "Map" || r === "Set")
    l = a ? "deeply " : "", c = [], t.forEach(function(E, q) {
      c.push(q);
    }), n !== "Array" && (e = Array.prototype.slice.call(arguments));
  else {
    switch (c = Op(t), n) {
      case "Array":
        if (arguments.length > 1)
          throw new re(f, void 0, i);
        break;
      case "Object":
        if (arguments.length > 1)
          throw new re(f, void 0, i);
        e = Object.keys(e);
        break;
      default:
        e = Array.prototype.slice.call(arguments);
    }
    e = e.map(function(E) {
      return typeof E == "symbol" ? E : String(E);
    });
  }
  if (!e.length)
    throw new re(d + "keys required", void 0, i);
  var h = e.length, m = _(this, "any"), y = _(this, "all"), g = e, x = a ? _(this, "eql") : (E, q) => E === q;
  if (!m && !y && (y = !0), m && (u = g.some(function(E) {
    return c.some(function(q) {
      return x(E, q);
    });
  })), y && (u = g.every(function(E) {
    return c.some(function(q) {
      return x(E, q);
    });
  }), _(this, "contains") || (u = u && e.length == c.length)), h > 1) {
    e = e.map(function(E) {
      return te(E);
    });
    var b = e.pop();
    y && (s = e.join(", ") + ", and " + b), m && (s = e.join(", ") + ", or " + b);
  } else
    s = te(e[0]);
  s = (h > 1 ? "keys " : "key ") + s, s = (_(this, "contains") ? "contain " : "have ") + s, this.assert(
    u,
    "expected #{this} to " + l + s,
    "expected #{this} to not " + l + s,
    g.slice(0).sort(Xo),
    c.sort(Xo),
    !0
  );
}
o(Up, "assertKeys");
T(Up, "assertKeys");
w.addMethod("keys", Up);
w.addMethod("key", Up);
function ui(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "ssfi"), a = _(this, "message"), s = _(this, "negate") || !1;
  new w(n, a, i, !0).is.a("function"), (Qo(e) || typeof e == "string") && (t = e, e = null);
  let l, c = !1;
  try {
    n();
  } catch (E) {
    c = !0, l = E;
  }
  var u = e === void 0 && t === void 0, d = !!(e && t), f = !1, h = !1;
  if (u || !u && !s) {
    var m = "an error";
    e instanceof Error ? m = "#{exp}" : e && (m = We.getConstructorName(e));
    let E = l;
    if (l instanceof Error)
      E = l.toString();
    else if (typeof l == "string")
      E = l;
    else if (l && (typeof l == "object" || typeof l == "function"))
      try {
        E = We.getConstructorName(l);
      } catch {
      }
    this.assert(
      c,
      "expected #{this} to throw " + m,
      "expected #{this} to not throw an error but #{act} was thrown",
      e && e.toString(),
      E
    );
  }
  if (e && l) {
    if (e instanceof Error) {
      var y = We.compatibleInstance(
        l,
        e
      );
      y === s && (d && s ? f = !0 : this.assert(
        s,
        "expected #{this} to throw #{exp} but #{act} was thrown",
        "expected #{this} to not throw #{exp}" + (l && !s ? " but #{act} was thrown" : ""),
        e.toString(),
        l.toString()
      ));
    }
    var g = We.compatibleConstructor(
      l,
      e
    );
    g === s && (d && s ? f = !0 : this.assert(
      s,
      "expected #{this} to throw #{exp} but #{act} was thrown",
      "expected #{this} to not throw #{exp}" + (l ? " but #{act} was thrown" : ""),
      e instanceof Error ? e.toString() : e && We.getConstructorName(e),
      l instanceof Error ? l.toString() : l && We.getConstructorName(l)
    ));
  }
  if (l && t !== void 0 && t !== null) {
    var x = "including";
    Qo(t) && (x = "matching");
    var b = We.compatibleMessage(
      l,
      t
    );
    b === s && (d && s ? h = !0 : this.assert(
      s,
      "expected #{this} to throw error " + x + " #{exp} but got #{act}",
      "expected #{this} to throw error not " + x + " #{exp}",
      t,
      We.getMessage(l)
    ));
  }
  f && h && this.assert(
    s,
    "expected #{this} to throw #{exp} but #{act} was thrown",
    "expected #{this} to not throw #{exp}" + (l ? " but #{act} was thrown" : ""),
    e instanceof Error ? e.toString() : e && We.getConstructorName(e),
    l instanceof Error ? l.toString() : l && We.getConstructorName(l)
  ), _(this, "object", l);
}
o(ui, "assertThrows");
T(ui, "assertThrows");
w.addMethod("throw", ui);
w.addMethod("throws", ui);
w.addMethod("Throw", ui);
function Hp(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "itself"), i = typeof r == "function" && !n ? r.prototype[e] : r[e];
  this.assert(
    typeof i == "function",
    "expected #{this} to respond to " + te(e),
    "expected #{this} to not respond to " + te(e)
  );
}
o(Hp, "respondTo");
T(Hp, "respondTo");
w.addMethod("respondTo", Hp);
w.addMethod("respondsTo", Hp);
w.addProperty("itself", function() {
  _(this, "itself", !0);
});
function Vp(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = e(r);
  this.assert(
    n,
    "expected #{this} to satisfy " + fr(e),
    "expected #{this} to not satisfy" + fr(e),
    !_(this, "negate"),
    n
  );
}
o(Vp, "satisfy");
T(Vp, "satisfy");
w.addMethod("satisfy", Vp);
w.addMethod("satisfies", Vp);
function zp(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "message"), a = _(this, "ssfi");
  new w(n, i, a, !0).is.numeric;
  let s = "A `delta` value is required for `closeTo`";
  if (t == null)
    throw new re(
      i ? `${i}: ${s}` : s,
      void 0,
      a
    );
  if (new w(t, i, a, !0).is.numeric, s = "A `expected` value is required for `closeTo`", e == null)
    throw new re(
      i ? `${i}: ${s}` : s,
      void 0,
      a
    );
  new w(e, i, a, !0).is.numeric;
  let l = /* @__PURE__ */ T((u) => u < 0n ? -u : u, "abs"), c = /* @__PURE__ */ T((u) => parseFloat(parseFloat(u).toPrecision(12)), "strip");
  this.assert(
    c(l(n - e)) <= t,
    "expected #{this} to be close to " + e + " +/- " + t,
    "expected #{this} not to be close to " + e + " +/- " + t
  );
}
o(zp, "closeTo");
T(zp, "closeTo");
w.addMethod("closeTo", zp);
w.addMethod("approximately", zp);
function lv(e, t, r, n, i) {
  let a = Array.from(t), s = Array.from(e);
  if (!n) {
    if (s.length !== a.length)
      return !1;
    a = a.slice();
  }
  return s.every(function(l, c) {
    if (i)
      return r ? r(l, a[c]) : l === a[c];
    if (!r) {
      var u = a.indexOf(l);
      return u === -1 ? !1 : (n || a.splice(u, 1), !0);
    }
    return a.some(function(d, f) {
      return r(l, d) ? (n || a.splice(f, 1), !0) : !1;
    });
  });
}
o(lv, "isSubsetOf");
T(lv, "isSubsetOf");
w.addMethod("members", function(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "message"), i = _(this, "ssfi");
  new w(r, n, i, !0).to.be.iterable, new w(e, n, i, !0).to.be.iterable;
  var a = _(this, "contains"), s = _(this, "ordered"), l, c, u;
  a ? (l = s ? "an ordered superset" : "a superset", c = "expected #{this} to be " + l + " of #{exp}", u = "expected #{this} to not be " + l +
  " of #{exp}") : (l = s ? "ordered members" : "members", c = "expected #{this} to have the same " + l + " as #{exp}", u = "expected #{this}\
 to not have the same " + l + " as #{exp}");
  var d = _(this, "deep") ? _(this, "eql") : void 0;
  this.assert(
    lv(e, r, d, a, s),
    c,
    u,
    e,
    r,
    !0
  );
});
w.addProperty("iterable", function(e) {
  e && _(this, "message", e);
  var t = _(this, "object");
  this.assert(
    t != null && t[Symbol.iterator],
    "expected #{this} to be an iterable",
    "expected #{this} to not be an iterable",
    t
  );
});
function uv(e, t) {
  t && _(this, "message", t);
  var r = _(this, "object"), n = _(this, "message"), i = _(this, "ssfi"), a = _(this, "contains"), s = _(this, "deep"), l = _(this, "eql");
  new w(e, n, i, !0).to.be.an("array"), a ? this.assert(
    e.some(function(c) {
      return r.indexOf(c) > -1;
    }),
    "expected #{this} to contain one of #{exp}",
    "expected #{this} to not contain one of #{exp}",
    e,
    r
  ) : s ? this.assert(
    e.some(function(c) {
      return l(r, c);
    }),
    "expected #{this} to deeply equal one of #{exp}",
    "expected #{this} to deeply equal one of #{exp}",
    e,
    r
  ) : this.assert(
    e.indexOf(r) > -1,
    "expected #{this} to be one of #{exp}",
    "expected #{this} to not be one of #{exp}",
    e,
    r
  );
}
o(uv, "oneOf");
T(uv, "oneOf");
w.addMethod("oneOf", uv);
function Wp(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "message"), a = _(this, "ssfi");
  new w(n, i, a, !0).is.a("function");
  var s;
  t ? (new w(e, i, a, !0).to.have.property(t), s = e[t]) : (new w(e, i, a, !0).is.a("function"), s = e()), n();
  var l = t == null ? e() : e[t], c = t == null ? s : "." + t;
  _(this, "deltaMsgObj", c), _(this, "initialDeltaValue", s), _(this, "finalDeltaValue", l), _(this, "deltaBehavior", "change"), _(this, "re\
alDelta", l !== s), this.assert(
    s !== l,
    "expected " + c + " to change",
    "expected " + c + " to not change"
  );
}
o(Wp, "assertChanges");
T(Wp, "assertChanges");
w.addMethod("change", Wp);
w.addMethod("changes", Wp);
function Gp(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "message"), a = _(this, "ssfi");
  new w(n, i, a, !0).is.a("function");
  var s;
  t ? (new w(e, i, a, !0).to.have.property(t), s = e[t]) : (new w(e, i, a, !0).is.a("function"), s = e()), new w(s, i, a, !0).is.a("number"),
  n();
  var l = t == null ? e() : e[t], c = t == null ? s : "." + t;
  _(this, "deltaMsgObj", c), _(this, "initialDeltaValue", s), _(this, "finalDeltaValue", l), _(this, "deltaBehavior", "increase"), _(this, "\
realDelta", l - s), this.assert(
    l - s > 0,
    "expected " + c + " to increase",
    "expected " + c + " to not increase"
  );
}
o(Gp, "assertIncreases");
T(Gp, "assertIncreases");
w.addMethod("increase", Gp);
w.addMethod("increases", Gp);
function Kp(e, t, r) {
  r && _(this, "message", r);
  var n = _(this, "object"), i = _(this, "message"), a = _(this, "ssfi");
  new w(n, i, a, !0).is.a("function");
  var s;
  t ? (new w(e, i, a, !0).to.have.property(t), s = e[t]) : (new w(e, i, a, !0).is.a("function"), s = e()), new w(s, i, a, !0).is.a("number"),
  n();
  var l = t == null ? e() : e[t], c = t == null ? s : "." + t;
  _(this, "deltaMsgObj", c), _(this, "initialDeltaValue", s), _(this, "finalDeltaValue", l), _(this, "deltaBehavior", "decrease"), _(this, "\
realDelta", s - l), this.assert(
    l - s < 0,
    "expected " + c + " to decrease",
    "expected " + c + " to not decrease"
  );
}
o(Kp, "assertDecreases");
T(Kp, "assertDecreases");
w.addMethod("decrease", Kp);
w.addMethod("decreases", Kp);
function cv(e, t) {
  t && _(this, "message", t);
  var r = _(this, "deltaMsgObj"), n = _(this, "initialDeltaValue"), i = _(this, "finalDeltaValue"), a = _(this, "deltaBehavior"), s = _(this,
  "realDelta"), l;
  a === "change" ? l = Math.abs(i - n) === Math.abs(e) : l = s === Math.abs(e), this.assert(
    l,
    "expected " + r + " to " + a + " by " + e,
    "expected " + r + " to not " + a + " by " + e
  );
}
o(cv, "assertDelta");
T(cv, "assertDelta");
w.addMethod("by", cv);
w.addProperty("extensible", function() {
  var e = _(this, "object"), t = e === Object(e) && Object.isExtensible(e);
  this.assert(
    t,
    "expected #{this} to be extensible",
    "expected #{this} to not be extensible"
  );
});
w.addProperty("sealed", function() {
  var e = _(this, "object"), t = e === Object(e) ? Object.isSealed(e) : !0;
  this.assert(
    t,
    "expected #{this} to be sealed",
    "expected #{this} to not be sealed"
  );
});
w.addProperty("frozen", function() {
  var e = _(this, "object"), t = e === Object(e) ? Object.isFrozen(e) : !0;
  this.assert(
    t,
    "expected #{this} to be frozen",
    "expected #{this} to not be frozen"
  );
});
w.addProperty("finite", function(e) {
  var t = _(this, "object");
  this.assert(
    typeof t == "number" && isFinite(t),
    "expected #{this} to be a finite number",
    "expected #{this} to not be a finite number"
  );
});
function Zo(e, t) {
  return e === t ? !0 : typeof t != typeof e ? !1 : typeof e != "object" || e === null ? e === t : t ? Array.isArray(e) ? Array.isArray(t) ?
  e.every(function(r) {
    return t.some(function(n) {
      return Zo(r, n);
    });
  }) : !1 : e instanceof Date ? t instanceof Date ? e.getTime() === t.getTime() : !1 : Object.keys(e).every(function(r) {
    var n = e[r], i = t[r];
    return typeof n == "object" && n !== null && i !== null ? Zo(n, i) : typeof n == "function" ? n(i) : i === n;
  }) : !1;
}
o(Zo, "compareSubset");
T(Zo, "compareSubset");
w.addMethod("containSubset", function(e) {
  let t = Y(this, "object"), r = Be.showDiff;
  this.assert(
    Zo(e, t),
    "expected #{act} to contain subset #{exp}",
    "expected #{act} to not contain subset #{exp}",
    e,
    t,
    r
  );
});
function kt(e, t) {
  return new w(e, t);
}
o(kt, "expect");
T(kt, "expect");
kt.fail = function(e, t, r, n) {
  throw arguments.length < 2 && (r = e, e = void 0), r = r || "expect.fail()", new re(
    r,
    {
      actual: e,
      expected: t,
      operator: n
    },
    kt.fail
  );
};
var dv = {};
mp(dv, {
  Should: /* @__PURE__ */ o(() => Cj, "Should"),
  should: /* @__PURE__ */ o(() => Ej, "should")
});
function Yp() {
  function e() {
    return this instanceof String || this instanceof Number || this instanceof Boolean || typeof Symbol == "function" && this instanceof Symbol ||
    typeof BigInt == "function" && this instanceof BigInt ? new w(this.valueOf(), null, e) : new w(this, null, e);
  }
  o(e, "shouldGetter"), T(e, "shouldGetter");
  function t(n) {
    Object.defineProperty(this, "should", {
      value: n,
      enumerable: !0,
      configurable: !0,
      writable: !0
    });
  }
  o(t, "shouldSetter"), T(t, "shouldSetter"), Object.defineProperty(Object.prototype, "should", {
    set: t,
    get: e,
    configurable: !0
  });
  var r = {};
  return r.fail = function(n, i, a, s) {
    throw arguments.length < 2 && (a = n, n = void 0), a = a || "should.fail()", new re(
      a,
      {
        actual: n,
        expected: i,
        operator: s
      },
      r.fail
    );
  }, r.equal = function(n, i, a) {
    new w(n, a).to.equal(i);
  }, r.Throw = function(n, i, a, s) {
    new w(n, s).to.Throw(i, a);
  }, r.exist = function(n, i) {
    new w(n, i).to.exist;
  }, r.not = {}, r.not.equal = function(n, i, a) {
    new w(n, a).to.not.equal(i);
  }, r.not.Throw = function(n, i, a, s) {
    new w(n, s).to.not.Throw(i, a);
  }, r.not.exist = function(n, i) {
    new w(n, i).to.not.exist;
  }, r.throw = r.Throw, r.not.throw = r.not.Throw, r;
}
o(Yp, "loadShould");
T(Yp, "loadShould");
var Ej = Yp, Cj = Yp;
function v(e, t) {
  var r = new w(null, null, v, !0);
  r.assert(e, t, "[ negation message unavailable ]");
}
o(v, "assert");
T(v, "assert");
v.fail = function(e, t, r, n) {
  throw arguments.length < 2 && (r = e, e = void 0), r = r || "assert.fail()", new re(
    r,
    {
      actual: e,
      expected: t,
      operator: n
    },
    v.fail
  );
};
v.isOk = function(e, t) {
  new w(e, t, v.isOk, !0).is.ok;
};
v.isNotOk = function(e, t) {
  new w(e, t, v.isNotOk, !0).is.not.ok;
};
v.equal = function(e, t, r) {
  var n = new w(e, r, v.equal, !0);
  n.assert(
    t == Y(n, "object"),
    "expected #{this} to equal #{exp}",
    "expected #{this} to not equal #{act}",
    t,
    e,
    !0
  );
};
v.notEqual = function(e, t, r) {
  var n = new w(e, r, v.notEqual, !0);
  n.assert(
    t != Y(n, "object"),
    "expected #{this} to not equal #{exp}",
    "expected #{this} to equal #{act}",
    t,
    e,
    !0
  );
};
v.strictEqual = function(e, t, r) {
  new w(e, r, v.strictEqual, !0).to.equal(t);
};
v.notStrictEqual = function(e, t, r) {
  new w(e, r, v.notStrictEqual, !0).to.not.equal(t);
};
v.deepEqual = v.deepStrictEqual = function(e, t, r) {
  new w(e, r, v.deepEqual, !0).to.eql(t);
};
v.notDeepEqual = function(e, t, r) {
  new w(e, r, v.notDeepEqual, !0).to.not.eql(t);
};
v.isAbove = function(e, t, r) {
  new w(e, r, v.isAbove, !0).to.be.above(t);
};
v.isAtLeast = function(e, t, r) {
  new w(e, r, v.isAtLeast, !0).to.be.least(t);
};
v.isBelow = function(e, t, r) {
  new w(e, r, v.isBelow, !0).to.be.below(t);
};
v.isAtMost = function(e, t, r) {
  new w(e, r, v.isAtMost, !0).to.be.most(t);
};
v.isTrue = function(e, t) {
  new w(e, t, v.isTrue, !0).is.true;
};
v.isNotTrue = function(e, t) {
  new w(e, t, v.isNotTrue, !0).to.not.equal(!0);
};
v.isFalse = function(e, t) {
  new w(e, t, v.isFalse, !0).is.false;
};
v.isNotFalse = function(e, t) {
  new w(e, t, v.isNotFalse, !0).to.not.equal(!1);
};
v.isNull = function(e, t) {
  new w(e, t, v.isNull, !0).to.equal(null);
};
v.isNotNull = function(e, t) {
  new w(e, t, v.isNotNull, !0).to.not.equal(null);
};
v.isNaN = function(e, t) {
  new w(e, t, v.isNaN, !0).to.be.NaN;
};
v.isNotNaN = function(e, t) {
  new w(e, t, v.isNotNaN, !0).not.to.be.NaN;
};
v.exists = function(e, t) {
  new w(e, t, v.exists, !0).to.exist;
};
v.notExists = function(e, t) {
  new w(e, t, v.notExists, !0).to.not.exist;
};
v.isUndefined = function(e, t) {
  new w(e, t, v.isUndefined, !0).to.equal(void 0);
};
v.isDefined = function(e, t) {
  new w(e, t, v.isDefined, !0).to.not.equal(void 0);
};
v.isCallable = function(e, t) {
  new w(e, t, v.isCallable, !0).is.callable;
};
v.isNotCallable = function(e, t) {
  new w(e, t, v.isNotCallable, !0).is.not.callable;
};
v.isObject = function(e, t) {
  new w(e, t, v.isObject, !0).to.be.a("object");
};
v.isNotObject = function(e, t) {
  new w(e, t, v.isNotObject, !0).to.not.be.a("object");
};
v.isArray = function(e, t) {
  new w(e, t, v.isArray, !0).to.be.an("array");
};
v.isNotArray = function(e, t) {
  new w(e, t, v.isNotArray, !0).to.not.be.an("array");
};
v.isString = function(e, t) {
  new w(e, t, v.isString, !0).to.be.a("string");
};
v.isNotString = function(e, t) {
  new w(e, t, v.isNotString, !0).to.not.be.a("string");
};
v.isNumber = function(e, t) {
  new w(e, t, v.isNumber, !0).to.be.a("number");
};
v.isNotNumber = function(e, t) {
  new w(e, t, v.isNotNumber, !0).to.not.be.a("number");
};
v.isNumeric = function(e, t) {
  new w(e, t, v.isNumeric, !0).is.numeric;
};
v.isNotNumeric = function(e, t) {
  new w(e, t, v.isNotNumeric, !0).is.not.numeric;
};
v.isFinite = function(e, t) {
  new w(e, t, v.isFinite, !0).to.be.finite;
};
v.isBoolean = function(e, t) {
  new w(e, t, v.isBoolean, !0).to.be.a("boolean");
};
v.isNotBoolean = function(e, t) {
  new w(e, t, v.isNotBoolean, !0).to.not.be.a("boolean");
};
v.typeOf = function(e, t, r) {
  new w(e, r, v.typeOf, !0).to.be.a(t);
};
v.notTypeOf = function(e, t, r) {
  new w(e, r, v.notTypeOf, !0).to.not.be.a(t);
};
v.instanceOf = function(e, t, r) {
  new w(e, r, v.instanceOf, !0).to.be.instanceOf(t);
};
v.notInstanceOf = function(e, t, r) {
  new w(e, r, v.notInstanceOf, !0).to.not.be.instanceOf(
    t
  );
};
v.include = function(e, t, r) {
  new w(e, r, v.include, !0).include(t);
};
v.notInclude = function(e, t, r) {
  new w(e, r, v.notInclude, !0).not.include(t);
};
v.deepInclude = function(e, t, r) {
  new w(e, r, v.deepInclude, !0).deep.include(t);
};
v.notDeepInclude = function(e, t, r) {
  new w(e, r, v.notDeepInclude, !0).not.deep.include(t);
};
v.nestedInclude = function(e, t, r) {
  new w(e, r, v.nestedInclude, !0).nested.include(t);
};
v.notNestedInclude = function(e, t, r) {
  new w(e, r, v.notNestedInclude, !0).not.nested.include(
    t
  );
};
v.deepNestedInclude = function(e, t, r) {
  new w(e, r, v.deepNestedInclude, !0).deep.nested.include(
    t
  );
};
v.notDeepNestedInclude = function(e, t, r) {
  new w(
    e,
    r,
    v.notDeepNestedInclude,
    !0
  ).not.deep.nested.include(t);
};
v.ownInclude = function(e, t, r) {
  new w(e, r, v.ownInclude, !0).own.include(t);
};
v.notOwnInclude = function(e, t, r) {
  new w(e, r, v.notOwnInclude, !0).not.own.include(t);
};
v.deepOwnInclude = function(e, t, r) {
  new w(e, r, v.deepOwnInclude, !0).deep.own.include(t);
};
v.notDeepOwnInclude = function(e, t, r) {
  new w(e, r, v.notDeepOwnInclude, !0).not.deep.own.include(
    t
  );
};
v.match = function(e, t, r) {
  new w(e, r, v.match, !0).to.match(t);
};
v.notMatch = function(e, t, r) {
  new w(e, r, v.notMatch, !0).to.not.match(t);
};
v.property = function(e, t, r) {
  new w(e, r, v.property, !0).to.have.property(t);
};
v.notProperty = function(e, t, r) {
  new w(e, r, v.notProperty, !0).to.not.have.property(t);
};
v.propertyVal = function(e, t, r, n) {
  new w(e, n, v.propertyVal, !0).to.have.property(t, r);
};
v.notPropertyVal = function(e, t, r, n) {
  new w(e, n, v.notPropertyVal, !0).to.not.have.property(
    t,
    r
  );
};
v.deepPropertyVal = function(e, t, r, n) {
  new w(e, n, v.deepPropertyVal, !0).to.have.deep.property(
    t,
    r
  );
};
v.notDeepPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.notDeepPropertyVal,
    !0
  ).to.not.have.deep.property(t, r);
};
v.ownProperty = function(e, t, r) {
  new w(e, r, v.ownProperty, !0).to.have.own.property(t);
};
v.notOwnProperty = function(e, t, r) {
  new w(e, r, v.notOwnProperty, !0).to.not.have.own.property(
    t
  );
};
v.ownPropertyVal = function(e, t, r, n) {
  new w(e, n, v.ownPropertyVal, !0).to.have.own.property(
    t,
    r
  );
};
v.notOwnPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.notOwnPropertyVal,
    !0
  ).to.not.have.own.property(t, r);
};
v.deepOwnPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.deepOwnPropertyVal,
    !0
  ).to.have.deep.own.property(t, r);
};
v.notDeepOwnPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.notDeepOwnPropertyVal,
    !0
  ).to.not.have.deep.own.property(t, r);
};
v.nestedProperty = function(e, t, r) {
  new w(e, r, v.nestedProperty, !0).to.have.nested.property(
    t
  );
};
v.notNestedProperty = function(e, t, r) {
  new w(
    e,
    r,
    v.notNestedProperty,
    !0
  ).to.not.have.nested.property(t);
};
v.nestedPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.nestedPropertyVal,
    !0
  ).to.have.nested.property(t, r);
};
v.notNestedPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.notNestedPropertyVal,
    !0
  ).to.not.have.nested.property(t, r);
};
v.deepNestedPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.deepNestedPropertyVal,
    !0
  ).to.have.deep.nested.property(t, r);
};
v.notDeepNestedPropertyVal = function(e, t, r, n) {
  new w(
    e,
    n,
    v.notDeepNestedPropertyVal,
    !0
  ).to.not.have.deep.nested.property(t, r);
};
v.lengthOf = function(e, t, r) {
  new w(e, r, v.lengthOf, !0).to.have.lengthOf(t);
};
v.hasAnyKeys = function(e, t, r) {
  new w(e, r, v.hasAnyKeys, !0).to.have.any.keys(t);
};
v.hasAllKeys = function(e, t, r) {
  new w(e, r, v.hasAllKeys, !0).to.have.all.keys(t);
};
v.containsAllKeys = function(e, t, r) {
  new w(e, r, v.containsAllKeys, !0).to.contain.all.keys(
    t
  );
};
v.doesNotHaveAnyKeys = function(e, t, r) {
  new w(e, r, v.doesNotHaveAnyKeys, !0).to.not.have.any.keys(
    t
  );
};
v.doesNotHaveAllKeys = function(e, t, r) {
  new w(e, r, v.doesNotHaveAllKeys, !0).to.not.have.all.keys(
    t
  );
};
v.hasAnyDeepKeys = function(e, t, r) {
  new w(e, r, v.hasAnyDeepKeys, !0).to.have.any.deep.keys(
    t
  );
};
v.hasAllDeepKeys = function(e, t, r) {
  new w(e, r, v.hasAllDeepKeys, !0).to.have.all.deep.keys(
    t
  );
};
v.containsAllDeepKeys = function(e, t, r) {
  new w(
    e,
    r,
    v.containsAllDeepKeys,
    !0
  ).to.contain.all.deep.keys(t);
};
v.doesNotHaveAnyDeepKeys = function(e, t, r) {
  new w(
    e,
    r,
    v.doesNotHaveAnyDeepKeys,
    !0
  ).to.not.have.any.deep.keys(t);
};
v.doesNotHaveAllDeepKeys = function(e, t, r) {
  new w(
    e,
    r,
    v.doesNotHaveAllDeepKeys,
    !0
  ).to.not.have.all.deep.keys(t);
};
v.throws = function(e, t, r, n) {
  (typeof t == "string" || t instanceof RegExp) && (r = t, t = null);
  var i = new w(e, n, v.throws, !0).to.throw(
    t,
    r
  );
  return Y(i, "object");
};
v.doesNotThrow = function(e, t, r, n) {
  (typeof t == "string" || t instanceof RegExp) && (r = t, t = null), new w(e, n, v.doesNotThrow, !0).to.not.throw(
    t,
    r
  );
};
v.operator = function(e, t, r, n) {
  var i;
  switch (t) {
    case "==":
      i = e == r;
      break;
    case "===":
      i = e === r;
      break;
    case ">":
      i = e > r;
      break;
    case ">=":
      i = e >= r;
      break;
    case "<":
      i = e < r;
      break;
    case "<=":
      i = e <= r;
      break;
    case "!=":
      i = e != r;
      break;
    case "!==":
      i = e !== r;
      break;
    default:
      throw n = n && n + ": ", new re(
        n + 'Invalid operator "' + t + '"',
        void 0,
        v.operator
      );
  }
  var a = new w(i, n, v.operator, !0);
  a.assert(
    Y(a, "object") === !0,
    "expected " + te(e) + " to be " + t + " " + te(r),
    "expected " + te(e) + " to not be " + t + " " + te(r)
  );
};
v.closeTo = function(e, t, r, n) {
  new w(e, n, v.closeTo, !0).to.be.closeTo(t, r);
};
v.approximately = function(e, t, r, n) {
  new w(e, n, v.approximately, !0).to.be.approximately(
    t,
    r
  );
};
v.sameMembers = function(e, t, r) {
  new w(e, r, v.sameMembers, !0).to.have.same.members(t);
};
v.notSameMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notSameMembers,
    !0
  ).to.not.have.same.members(t);
};
v.sameDeepMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.sameDeepMembers,
    !0
  ).to.have.same.deep.members(t);
};
v.notSameDeepMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notSameDeepMembers,
    !0
  ).to.not.have.same.deep.members(t);
};
v.sameOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.sameOrderedMembers,
    !0
  ).to.have.same.ordered.members(t);
};
v.notSameOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notSameOrderedMembers,
    !0
  ).to.not.have.same.ordered.members(t);
};
v.sameDeepOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.sameDeepOrderedMembers,
    !0
  ).to.have.same.deep.ordered.members(t);
};
v.notSameDeepOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notSameDeepOrderedMembers,
    !0
  ).to.not.have.same.deep.ordered.members(t);
};
v.includeMembers = function(e, t, r) {
  new w(e, r, v.includeMembers, !0).to.include.members(
    t
  );
};
v.notIncludeMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notIncludeMembers,
    !0
  ).to.not.include.members(t);
};
v.includeDeepMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.includeDeepMembers,
    !0
  ).to.include.deep.members(t);
};
v.notIncludeDeepMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notIncludeDeepMembers,
    !0
  ).to.not.include.deep.members(t);
};
v.includeOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.includeOrderedMembers,
    !0
  ).to.include.ordered.members(t);
};
v.notIncludeOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notIncludeOrderedMembers,
    !0
  ).to.not.include.ordered.members(t);
};
v.includeDeepOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.includeDeepOrderedMembers,
    !0
  ).to.include.deep.ordered.members(t);
};
v.notIncludeDeepOrderedMembers = function(e, t, r) {
  new w(
    e,
    r,
    v.notIncludeDeepOrderedMembers,
    !0
  ).to.not.include.deep.ordered.members(t);
};
v.oneOf = function(e, t, r) {
  new w(e, r, v.oneOf, !0).to.be.oneOf(t);
};
v.isIterable = function(e, t) {
  if (e == null || !e[Symbol.iterator])
    throw t = t ? `${t} expected ${te(e)} to be an iterable` : `expected ${te(e)} to be an iterable`, new re(t, void 0, v.isIterable);
};
v.changes = function(e, t, r, n) {
  arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.changes, !0).to.change(t, r);
};
v.changesBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.changesBy, !0).to.change(t, r).by(n);
};
v.doesNotChange = function(e, t, r, n) {
  return arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.doesNotChange, !0).to.not.change(
    t,
    r
  );
};
v.changesButNotBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.changesButNotBy, !0).to.change(t, r).but.not.by(n);
};
v.increases = function(e, t, r, n) {
  return arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.increases, !0).to.increase(t, r);
};
v.increasesBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.increasesBy, !0).to.increase(t, r).by(n);
};
v.doesNotIncrease = function(e, t, r, n) {
  return arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.doesNotIncrease, !0).to.not.increase(
    t,
    r
  );
};
v.increasesButNotBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.increasesButNotBy, !0).to.increase(t, r).but.not.by(n);
};
v.decreases = function(e, t, r, n) {
  return arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.decreases, !0).to.decrease(t, r);
};
v.decreasesBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.decreasesBy, !0).to.decrease(t, r).by(n);
};
v.doesNotDecrease = function(e, t, r, n) {
  return arguments.length === 3 && typeof t == "function" && (n = r, r = null), new w(e, n, v.doesNotDecrease, !0).to.not.decrease(
    t,
    r
  );
};
v.doesNotDecreaseBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  return new w(e, i, v.doesNotDecreaseBy, !0).to.not.decrease(t, r).by(n);
};
v.decreasesButNotBy = function(e, t, r, n, i) {
  if (arguments.length === 4 && typeof t == "function") {
    var a = n;
    n = r, i = a;
  } else arguments.length === 3 && (n = r, r = null);
  new w(e, i, v.decreasesButNotBy, !0).to.decrease(t, r).but.not.by(n);
};
v.ifError = function(e) {
  if (e)
    throw e;
};
v.isExtensible = function(e, t) {
  new w(e, t, v.isExtensible, !0).to.be.extensible;
};
v.isNotExtensible = function(e, t) {
  new w(e, t, v.isNotExtensible, !0).to.not.be.extensible;
};
v.isSealed = function(e, t) {
  new w(e, t, v.isSealed, !0).to.be.sealed;
};
v.isNotSealed = function(e, t) {
  new w(e, t, v.isNotSealed, !0).to.not.be.sealed;
};
v.isFrozen = function(e, t) {
  new w(e, t, v.isFrozen, !0).to.be.frozen;
};
v.isNotFrozen = function(e, t) {
  new w(e, t, v.isNotFrozen, !0).to.not.be.frozen;
};
v.isEmpty = function(e, t) {
  new w(e, t, v.isEmpty, !0).to.be.empty;
};
v.isNotEmpty = function(e, t) {
  new w(e, t, v.isNotEmpty, !0).to.not.be.empty;
};
v.containsSubset = function(e, t, r) {
  new w(e, r).to.containSubset(t);
};
v.doesNotContainSubset = function(e, t, r) {
  new w(e, r).to.not.containSubset(t);
};
var xj = [
  ["isOk", "ok"],
  ["isNotOk", "notOk"],
  ["throws", "throw"],
  ["throws", "Throw"],
  ["isExtensible", "extensible"],
  ["isNotExtensible", "notExtensible"],
  ["isSealed", "sealed"],
  ["isNotSealed", "notSealed"],
  ["isFrozen", "frozen"],
  ["isNotFrozen", "notFrozen"],
  ["isEmpty", "empty"],
  ["isNotEmpty", "notEmpty"],
  ["isCallable", "isFunction"],
  ["isNotCallable", "isNotFunction"],
  ["containsSubset", "containSubset"]
];
for (let [e, t] of xj)
  v[t] = v[e];
var xg = [];
function Lt(e) {
  let t = {
    use: Lt,
    AssertionError: re,
    util: Xe,
    config: Be,
    expect: kt,
    assert: v,
    Assertion: w,
    ...dv
  };
  return ~xg.indexOf(e) || (e(t, Xe), xg.push(e)), t;
}
o(Lt, "use");
T(Lt, "use");

// ../node_modules/@testing-library/jest-dom/dist/matchers.mjs
var Ah = {};
Wo(Ah, {
  toBeChecked: () => xh,
  toBeDisabled: () => bh,
  toBeEmpty: () => ah,
  toBeEmptyDOMElement: () => sh,
  toBeEnabled: () => yh,
  toBeInTheDOM: () => Cl,
  toBeInTheDocument: () => ih,
  toBeInvalid: () => vh,
  toBePartiallyChecked: () => _h,
  toBeRequired: () => gh,
  toBeValid: () => wh,
  toBeVisible: () => hh,
  toContainElement: () => xl,
  toContainHTML: () => lh,
  toHaveAccessibleDescription: () => _l,
  toHaveAccessibleErrorMessage: () => ch,
  toHaveAccessibleName: () => ql,
  toHaveAttribute: () => dh,
  toHaveClass: () => fh,
  toHaveDescription: () => Ph,
  toHaveDisplayValue: () => Ch,
  toHaveErrorMessage: () => qh,
  toHaveFocus: () => ph,
  toHaveFormValues: () => mh,
  toHaveRole: () => Pl,
  toHaveSelection: () => Rh,
  toHaveStyle: () => Rl,
  toHaveTextContent: () => uh,
  toHaveValue: () => Eh
});

// ../node_modules/@testing-library/jest-dom/dist/matchers-c85aadf8.mjs
var rh = ze(Xp(), 1);

// ../node_modules/@adobe/css-tools/dist/index.mjs
function vv(e) {
  Object.defineProperty(e, "__esModule", { value: !0, configurable: !0 });
}
o(vv, "$parcel$defineInteropFlag");
function Zp(e, t, r, n) {
  Object.defineProperty(e, t, { get: r, set: n, enumerable: !0, configurable: !0 });
}
o(Zp, "$parcel$export");
var wv = {};
vv(wv);
Zp(wv, "default", () => ci);
var em = class em extends Error {
  constructor(t, r, n, i, a) {
    super(t + ":" + n + ":" + i + ": " + r), this.reason = r, this.filename = t, this.line = n, this.column = i, this.source = a;
  }
};
o(em, "$009ddb00d3ec72b8$export$2e2bcd8739ae039");
var ci = em, Ev = {};
vv(Ev);
Zp(Ev, "default", () => di);
var tm = class tm {
  constructor(t, r, n) {
    this.start = t, this.end = r, this.source = n;
  }
};
o(tm, "$0865a9fb4cc365fe$export$2e2bcd8739ae039");
var di = tm, Tj = {};
Zp(Tj, "CssTypes", () => Oe);
var Oe = /* @__PURE__ */ function(e) {
  return e.stylesheet = "stylesheet", e.rule = "rule", e.declaration = "declaration", e.comment = "comment", e.container = "container", e.charset =
  "charset", e.document = "document", e.customMedia = "custom-media", e.fontFace = "font-face", e.host = "host", e.import = "import", e.keyframes =
  "keyframes", e.keyframe = "keyframe", e.layer = "layer", e.media = "media", e.namespace = "namespace", e.page = "page", e.startingStyle = "\
starting-style", e.supports = "supports", e;
}({}), Jp = /\/\*[^]*?(?:\*\/|$)/g, Oj = /* @__PURE__ */ o((e, t) => {
  t = t || {};
  let r = 1, n = 1;
  function i(I) {
    let M = I.match(/\n/g);
    M && (r += M.length);
    let F = I.lastIndexOf(`
`);
    n = ~F ? I.length - F : n + I.length;
  }
  o(i, "updatePosition");
  function a() {
    let I = {
      line: r,
      column: n
    };
    return function(M) {
      return M.position = new di(I, {
        line: r,
        column: n
      }, t?.source || ""), m(), M;
    };
  }
  o(a, "position");
  let s = [];
  function l(I) {
    let M = new ci(t?.source || "", I, r, n, e);
    if (t?.silent) s.push(M);
    else throw M;
  }
  o(l, "error");
  function c() {
    let I = f();
    return {
      type: Oe.stylesheet,
      stylesheet: {
        source: t?.source,
        rules: I,
        parsingErrors: s
      }
    };
  }
  o(c, "stylesheet");
  function u() {
    return h(/^{\s*/);
  }
  o(u, "open");
  function d() {
    return h(/^}/);
  }
  o(d, "close");
  function f() {
    let I, M = [];
    for (m(), y(M); e.length && e.charAt(0) !== "}" && (I = pe() || Ce()); ) I && (M.push(I), y(M));
    return M;
  }
  o(f, "rules");
  function h(I) {
    let M = I.exec(e);
    if (!M) return;
    let F = M[0];
    return i(F), e = e.slice(F.length), M;
  }
  o(h, "match");
  function m() {
    h(/^\s*/);
  }
  o(m, "whitespace");
  function y(I) {
    let M;
    for (I = I || []; M = g(); ) M && I.push(M);
    return I;
  }
  o(y, "comments");
  function g() {
    let I = a();
    if (e.charAt(0) !== "/" || e.charAt(1) !== "*") return;
    let M = h(/^\/\*[^]*?\*\//);
    return M ? I({
      type: Oe.comment,
      comment: M[0].slice(2, -2)
    }) : l("End of comment missing");
  }
  o(g, "comment");
  function x(I, M, F) {
    let U = M + 1, K = !1, se = I.indexOf(")", U);
    for (; !K && se !== -1; ) {
      let ge = I.indexOf("(", U);
      ge !== -1 && ge < se ? (U = x(I, ge + 1, F + 1) + 1, se = I.indexOf(")", U)) : K = !0;
    }
    return K && se !== -1 ? se : -1;
  }
  o(x, "findClosingParenthese");
  function b() {
    let I = h(/^([^{]+)/);
    if (!I) return;
    let M = Qe(I[0]).replace(Jp, "");
    if (M.indexOf(",") === -1) return [
      M
    ];
    let F = 0, U = M.indexOf("(", F);
    for (; U !== -1; ) {
      let K = x(M, U, 0);
      if (K === -1) break;
      F = K + 1, M = M.substring(0, U) + M.substring(U, K).replace(/,/g, "\u200C") + M.substring(K), U = M.indexOf("(", F);
    }
    return M = M.replace(/("|')(?:\\\1|.)*?\1/g, (K) => K.replace(/,/g, "\u200C")), M.split(",").map((K) => Qe(K.replace(/\u200C/g, ",")));
  }
  o(b, "selector");
  function E() {
    let I = a(), M = h(/^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
    if (!M) return;
    let F = Qe(M[0]);
    if (!h(/^:\s*/)) return l("property missing ':'");
    let U = h(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|[^)])*?\)|[^};])+)/), K = I({
      type: Oe.declaration,
      property: F.replace(Jp, ""),
      value: U ? Qe(U[0]).replace(Jp, "") : ""
    });
    return h(/^[;\s]*/), K;
  }
  o(E, "declaration");
  function q() {
    let I = [];
    if (!u()) return l("missing '{'");
    y(I);
    let M;
    for (; M = E(); ) M && (I.push(M), y(I));
    return d() ? I : l("missing '}'");
  }
  o(q, "declarations");
  function C() {
    let I, M = [], F = a();
    for (; I = h(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/); )
      M.push(I[1]), h(/^,\s*/);
    if (M.length)
      return F({
        type: Oe.keyframe,
        values: M,
        declarations: q() || []
      });
  }
  o(C, "keyframe");
  function P() {
    let I = a(), M = h(/^@([-\w]+)?keyframes\s*/);
    if (!M) return;
    let F = M[1], U = h(/^([-\w]+)\s*/);
    if (!U) return l("@keyframes missing name");
    let K = U[1];
    if (!u()) return l("@keyframes missing '{'");
    let se, ge = y();
    for (; se = C(); )
      ge.push(se), ge = ge.concat(y());
    return d() ? I({
      type: Oe.keyframes,
      name: K,
      vendor: F,
      keyframes: ge
    }) : l("@keyframes missing '}'");
  }
  o(P, "atkeyframes");
  function O() {
    let I = a(), M = h(/^@supports *([^{]+)/);
    if (!M) return;
    let F = Qe(M[1]);
    if (!u()) return l("@supports missing '{'");
    let U = y().concat(f());
    return d() ? I({
      type: Oe.supports,
      supports: F,
      rules: U
    }) : l("@supports missing '}'");
  }
  o(O, "atsupports");
  function R() {
    let I = a();
    if (!h(/^@host\s*/)) return;
    if (!u()) return l("@host missing '{'");
    let F = y().concat(f());
    return d() ? I({
      type: Oe.host,
      rules: F
    }) : l("@host missing '}'");
  }
  o(R, "athost");
  function A() {
    let I = a(), M = h(/^@container *([^{]+)/);
    if (!M) return;
    let F = Qe(M[1]);
    if (!u()) return l("@container missing '{'");
    let U = y().concat(f());
    return d() ? I({
      type: Oe.container,
      container: F,
      rules: U
    }) : l("@container missing '}'");
  }
  o(A, "atcontainer");
  function j() {
    let I = a(), M = h(/^@layer *([^{;@]+)/);
    if (!M) return;
    let F = Qe(M[1]);
    if (!u())
      return h(/^[;\s]*/), I({
        type: Oe.layer,
        layer: F
      });
    let U = y().concat(f());
    return d() ? I({
      type: Oe.layer,
      layer: F,
      rules: U
    }) : l("@layer missing '}'");
  }
  o(j, "atlayer");
  function J() {
    let I = a(), M = h(/^@media *([^{]+)/);
    if (!M) return;
    let F = Qe(M[1]);
    if (!u()) return l("@media missing '{'");
    let U = y().concat(f());
    return d() ? I({
      type: Oe.media,
      media: F,
      rules: U
    }) : l("@media missing '}'");
  }
  o(J, "atmedia");
  function S() {
    let I = a(), M = h(/^@custom-media\s+(--\S+)\s*([^{;\s][^{;]*);/);
    if (M)
      return I({
        type: Oe.customMedia,
        name: Qe(M[1]),
        media: Qe(M[2])
      });
  }
  o(S, "atcustommedia");
  function G() {
    let I = a();
    if (!h(/^@page */)) return;
    let F = b() || [];
    if (!u()) return l("@page missing '{'");
    let U = y(), K;
    for (; K = E(); )
      U.push(K), U = U.concat(y());
    return d() ? I({
      type: Oe.page,
      selectors: F,
      declarations: U
    }) : l("@page missing '}'");
  }
  o(G, "atpage");
  function ne() {
    let I = a(), M = h(/^@([-\w]+)?document *([^{]+)/);
    if (!M) return;
    let F = Qe(M[1]), U = Qe(M[2]);
    if (!u()) return l("@document missing '{'");
    let K = y().concat(f());
    return d() ? I({
      type: Oe.document,
      document: U,
      vendor: F,
      rules: K
    }) : l("@document missing '}'");
  }
  o(ne, "atdocument");
  function B() {
    let I = a();
    if (!h(/^@font-face\s*/)) return;
    if (!u()) return l("@font-face missing '{'");
    let F = y(), U;
    for (; U = E(); )
      F.push(U), F = F.concat(y());
    return d() ? I({
      type: Oe.fontFace,
      declarations: F
    }) : l("@font-face missing '}'");
  }
  o(B, "atfontface");
  function H() {
    let I = a();
    if (!h(/^@starting-style\s*/)) return;
    if (!u()) return l("@starting-style missing '{'");
    let F = y().concat(f());
    return d() ? I({
      type: Oe.startingStyle,
      rules: F
    }) : l("@starting-style missing '}'");
  }
  o(H, "atstartingstyle");
  let $ = ee("import"), W = ee("charset"), V = ee("namespace");
  function ee(I) {
    let M = new RegExp("^@" + I + `\\s*((?::?[^;'"]|"(?:\\\\"|[^"])*?"|'(?:\\\\'|[^'])*?')+)(?:;|$)`);
    return function() {
      let F = a(), U = h(M);
      if (!U) return;
      let K = {
        type: I
      };
      return K[I] = U[1].trim(), F(K);
    };
  }
  o(ee, "_compileAtrule");
  function pe() {
    if (e[0] === "@")
      return P() || J() || S() || O() || $() || W() || V() || ne() || G() || R() || B() || A() || H() || j();
  }
  o(pe, "atrule");
  function Ce() {
    let I = a(), M = b();
    return M ? (y(), I({
      type: Oe.rule,
      selectors: M,
      declarations: q() || []
    })) : l("selector missing");
  }
  return o(Ce, "rule"), Qp(c());
}, "$d708735ed1303b43$export$98e6a39c04603d36");
function Qe(e) {
  return e ? e.trim() : "";
}
o(Qe, "$d708735ed1303b43$var$trim");
function Qp(e, t) {
  let r = e && typeof e.type == "string", n = r ? e : t;
  for (let i in e) {
    let a = e[i];
    Array.isArray(a) ? a.forEach((s) => {
      Qp(s, n);
    }) : a && typeof a == "object" && Qp(a, n);
  }
  return r && Object.defineProperty(e, "parent", {
    configurable: !0,
    writable: !0,
    enumerable: !1,
    value: t || null
  }), e;
}
o(Qp, "$d708735ed1303b43$var$addParent");
var Sj = Oj;
var Cv = Sj;

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/polyfills/array.from.mjs
var Mj = Object.prototype.toString;
function xv(e) {
  return typeof e == "function" || Mj.call(e) === "[object Function]";
}
o(xv, "isCallable");
function Aj(e) {
  var t = Number(e);
  return isNaN(t) ? 0 : t === 0 || !isFinite(t) ? t : (t > 0 ? 1 : -1) * Math.floor(Math.abs(t));
}
o(Aj, "toInteger");
var Nj = Math.pow(2, 53) - 1;
function Ij(e) {
  var t = Aj(e);
  return Math.min(Math.max(t, 0), Nj);
}
o(Ij, "toLength");
function Ge(e, t) {
  var r = Array, n = Object(e);
  if (e == null)
    throw new TypeError("Array.from requires an array-like object - not null or undefined");
  if (typeof t < "u" && !xv(t))
    throw new TypeError("Array.from: when provided, the second argument must be a function");
  for (var i = Ij(n.length), a = xv(r) ? Object(new r(i)) : new Array(i), s = 0, l; s < i; )
    l = n[s], t ? a[s] = t(l, s) : a[s] = l, s += 1;
  return a.length = i, a;
}
o(Ge, "arrayFrom");

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/polyfills/SetLike.mjs
function Ln(e) {
  "@babel/helpers - typeof";
  return Ln = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Ln(e);
}
o(Ln, "_typeof");
function jj(e, t) {
  if (!(e instanceof t))
    throw new TypeError("Cannot call a class as a function");
}
o(jj, "_classCallCheck");
function _v(e, t) {
  for (var r = 0; r < t.length; r++) {
    var n = t[r];
    n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, Pv(n.key), n);
  }
}
o(_v, "_defineProperties");
function kj(e, t, r) {
  return t && _v(e.prototype, t), r && _v(e, r), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
o(kj, "_createClass");
function Lj(e, t, r) {
  return t = Pv(t), t in e ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = r, e;
}
o(Lj, "_defineProperty");
function Pv(e) {
  var t = $j(e, "string");
  return Ln(t) === "symbol" ? t : String(t);
}
o(Pv, "_toPropertyKey");
function $j(e, t) {
  if (Ln(e) !== "object" || e === null) return e;
  var r = e[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(e, t || "default");
    if (Ln(n) !== "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
o($j, "_toPrimitive");
var Bj = /* @__PURE__ */ function() {
  function e() {
    var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
    jj(this, e), Lj(this, "items", void 0), this.items = t;
  }
  return o(e, "SetLike"), kj(e, [{
    key: "add",
    value: /* @__PURE__ */ o(function(r) {
      return this.has(r) === !1 && this.items.push(r), this;
    }, "add")
  }, {
    key: "clear",
    value: /* @__PURE__ */ o(function() {
      this.items = [];
    }, "clear")
  }, {
    key: "delete",
    value: /* @__PURE__ */ o(function(r) {
      var n = this.items.length;
      return this.items = this.items.filter(function(i) {
        return i !== r;
      }), n !== this.items.length;
    }, "_delete")
  }, {
    key: "forEach",
    value: /* @__PURE__ */ o(function(r) {
      var n = this;
      this.items.forEach(function(i) {
        r(i, i, n);
      });
    }, "forEach")
  }, {
    key: "has",
    value: /* @__PURE__ */ o(function(r) {
      return this.items.indexOf(r) !== -1;
    }, "has")
  }, {
    key: "size",
    get: /* @__PURE__ */ o(function() {
      return this.items.length;
    }, "get")
  }]), e;
}(), qv = typeof Set > "u" ? Set : Bj;

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/getRole.mjs
function xe(e) {
  var t;
  return (
    // eslint-disable-next-line no-restricted-properties -- actual guard for environments without localName
    (t = e.localName) !== null && t !== void 0 ? t : (
      // eslint-disable-next-line no-restricted-properties -- required for the fallback
      e.tagName.toLowerCase()
    )
  );
}
o(xe, "getLocalName");
var Dj = {
  article: "article",
  aside: "complementary",
  button: "button",
  datalist: "listbox",
  dd: "definition",
  details: "group",
  dialog: "dialog",
  dt: "term",
  fieldset: "group",
  figure: "figure",
  // WARNING: Only with an accessible name
  form: "form",
  footer: "contentinfo",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  header: "banner",
  hr: "separator",
  html: "document",
  legend: "legend",
  li: "listitem",
  math: "math",
  main: "main",
  menu: "list",
  nav: "navigation",
  ol: "list",
  optgroup: "group",
  // WARNING: Only in certain context
  option: "option",
  output: "status",
  progress: "progressbar",
  // WARNING: Only with an accessible name
  section: "region",
  summary: "button",
  table: "table",
  tbody: "rowgroup",
  textarea: "textbox",
  tfoot: "rowgroup",
  // WARNING: Only in certain context
  td: "cell",
  th: "columnheader",
  thead: "rowgroup",
  tr: "row",
  ul: "list"
}, Fj = {
  caption: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  code: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  deletion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  emphasis: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  generic: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby", "aria-roledescription"]),
  insertion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  none: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function Uj(e, t) {
  return [
    "aria-atomic",
    "aria-busy",
    "aria-controls",
    "aria-current",
    "aria-description",
    "aria-describedby",
    "aria-details",
    // "disabled",
    "aria-dropeffect",
    // "errormessage",
    "aria-flowto",
    "aria-grabbed",
    // "haspopup",
    "aria-hidden",
    // "invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-live",
    "aria-owns",
    "aria-relevant",
    "aria-roledescription"
  ].some(function(r) {
    var n;
    return e.hasAttribute(r) && !((n = Fj[t]) !== null && n !== void 0 && n.has(r));
  });
}
o(Uj, "hasGlobalAriaAttributes");
function Rv(e, t) {
  return Uj(e, t);
}
o(Rv, "ignorePresentationalRole");
function fi(e) {
  var t = Vj(e);
  if (t === null || $n.indexOf(t) !== -1) {
    var r = Hj(e);
    if ($n.indexOf(t || "") === -1 || Rv(e, r || ""))
      return r;
  }
  return t;
}
o(fi, "getRole");
function Hj(e) {
  var t = Dj[xe(e)];
  if (t !== void 0)
    return t;
  switch (xe(e)) {
    case "a":
    case "area":
    case "link":
      if (e.hasAttribute("href"))
        return "link";
      break;
    case "img":
      return e.getAttribute("alt") === "" && !Rv(e, "img") ? "presentation" : "img";
    case "input": {
      var r = e, n = r.type;
      switch (n) {
        case "button":
        case "image":
        case "reset":
        case "submit":
          return "button";
        case "checkbox":
        case "radio":
          return n;
        case "range":
          return "slider";
        case "email":
        case "tel":
        case "text":
        case "url":
          return e.hasAttribute("list") ? "combobox" : "textbox";
        case "search":
          return e.hasAttribute("list") ? "combobox" : "searchbox";
        case "number":
          return "spinbutton";
        default:
          return null;
      }
    }
    case "select":
      return e.hasAttribute("multiple") || e.size > 1 ? "listbox" : "combobox";
  }
  return null;
}
o(Hj, "getImplicitRole");
function Vj(e) {
  var t = e.getAttribute("role");
  if (t !== null) {
    var r = t.trim().split(" ")[0];
    if (r.length > 0)
      return r;
  }
  return null;
}
o(Vj, "getExplicitRole");

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/util.mjs
var $n = ["presentation", "none"];
function me(e) {
  return e !== null && e.nodeType === e.ELEMENT_NODE;
}
o(me, "isElement");
function rm(e) {
  return me(e) && xe(e) === "caption";
}
o(rm, "isHTMLTableCaptionElement");
function Bn(e) {
  return me(e) && xe(e) === "input";
}
o(Bn, "isHTMLInputElement");
function Tv(e) {
  return me(e) && xe(e) === "optgroup";
}
o(Tv, "isHTMLOptGroupElement");
function Ov(e) {
  return me(e) && xe(e) === "select";
}
o(Ov, "isHTMLSelectElement");
function Sv(e) {
  return me(e) && xe(e) === "table";
}
o(Sv, "isHTMLTableElement");
function Mv(e) {
  return me(e) && xe(e) === "textarea";
}
o(Mv, "isHTMLTextAreaElement");
function Av(e) {
  var t = e.ownerDocument === null ? e : e.ownerDocument, r = t.defaultView;
  if (r === null)
    throw new TypeError("no window available");
  return r;
}
o(Av, "safeWindow");
function Nv(e) {
  return me(e) && xe(e) === "fieldset";
}
o(Nv, "isHTMLFieldSetElement");
function Iv(e) {
  return me(e) && xe(e) === "legend";
}
o(Iv, "isHTMLLegendElement");
function jv(e) {
  return me(e) && xe(e) === "slot";
}
o(jv, "isHTMLSlotElement");
function zj(e) {
  return me(e) && e.ownerSVGElement !== void 0;
}
o(zj, "isSVGElement");
function kv(e) {
  return me(e) && xe(e) === "svg";
}
o(kv, "isSVGSVGElement");
function Lv(e) {
  return zj(e) && xe(e) === "title";
}
o(Lv, "isSVGTitleElement");
function Ur(e, t) {
  if (me(e) && e.hasAttribute(t)) {
    var r = e.getAttribute(t).split(" "), n = e.getRootNode ? e.getRootNode() : e.ownerDocument;
    return r.map(function(i) {
      return n.getElementById(i);
    }).filter(
      function(i) {
        return i !== null;
      }
      // TODO: why does this not narrow?
    );
  }
  return [];
}
o(Ur, "queryIdRefs");
function at(e, t) {
  return me(e) ? t.indexOf(fi(e)) !== -1 : !1;
}
o(at, "hasAnyConcreteRoles");

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/accessible-name-and-description.mjs
function Wj(e) {
  return e.trim().replace(/\s\s+/g, " ");
}
o(Wj, "asFlatString");
function Gj(e, t) {
  if (!me(e))
    return !1;
  if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true")
    return !0;
  var r = t(e);
  return r.getPropertyValue("display") === "none" || r.getPropertyValue("visibility") === "hidden";
}
o(Gj, "isHidden");
function Kj(e) {
  return at(e, ["button", "combobox", "listbox", "textbox"]) || Dv(e, "range");
}
o(Kj, "isControl");
function Dv(e, t) {
  if (!me(e))
    return !1;
  switch (t) {
    case "range":
      return at(e, ["meter", "progressbar", "scrollbar", "slider", "spinbutton"]);
    default:
      throw new TypeError("No knowledge about abstract role '".concat(t, "'. This is likely a bug :("));
  }
}
o(Dv, "hasAbstractRole");
function $v(e, t) {
  var r = Ge(e.querySelectorAll(t));
  return Ur(e, "aria-owns").forEach(function(n) {
    r.push.apply(r, Ge(n.querySelectorAll(t)));
  }), r;
}
o($v, "querySelectorAllSubtree");
function Yj(e) {
  return Ov(e) ? e.selectedOptions || $v(e, "[selected]") : $v(e, '[aria-selected="true"]');
}
o(Yj, "querySelectedOptions");
function Xj(e) {
  return at(e, $n);
}
o(Xj, "isMarkedPresentational");
function Jj(e) {
  return rm(e);
}
o(Jj, "isNativeHostLanguageTextAlternativeElement");
function Qj(e) {
  return at(e, ["button", "cell", "checkbox", "columnheader", "gridcell", "heading", "label", "legend", "link", "menuitem", "menuitemcheckbo\
x", "menuitemradio", "option", "radio", "row", "rowheader", "switch", "tab", "tooltip", "treeitem"]);
}
o(Qj, "allowsNameFromContent");
function Zj(e) {
  return !1;
}
o(Zj, "isDescendantOfNativeHostLanguageTextAlternativeElement");
function ek(e) {
  return Bn(e) || Mv(e) ? e.value : e.textContent || "";
}
o(ek, "getValueOfTextbox");
function Bv(e) {
  var t = e.getPropertyValue("content");
  return /^["'].*["']$/.test(t) ? t.slice(1, -1) : "";
}
o(Bv, "getTextualContent");
function Fv(e) {
  var t = xe(e);
  return t === "button" || t === "input" && e.getAttribute("type") !== "hidden" || t === "meter" || t === "output" || t === "progress" || t ===
  "select" || t === "textarea";
}
o(Fv, "isLabelableElement");
function Uv(e) {
  if (Fv(e))
    return e;
  var t = null;
  return e.childNodes.forEach(function(r) {
    if (t === null && me(r)) {
      var n = Uv(r);
      n !== null && (t = n);
    }
  }), t;
}
o(Uv, "findLabelableElement");
function tk(e) {
  if (e.control !== void 0)
    return e.control;
  var t = e.getAttribute("for");
  return t !== null ? e.ownerDocument.getElementById(t) : Uv(e);
}
o(tk, "getControlOfLabel");
function rk(e) {
  var t = e.labels;
  if (t === null)
    return t;
  if (t !== void 0)
    return Ge(t);
  if (!Fv(e))
    return null;
  var r = e.ownerDocument;
  return Ge(r.querySelectorAll("label")).filter(function(n) {
    return tk(n) === e;
  });
}
o(rk, "getLabels");
function nk(e) {
  var t = e.assignedNodes();
  return t.length === 0 ? Ge(e.childNodes) : t;
}
o(nk, "getSlotContents");
function pi(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, r = new qv(), n = Av(e), i = t.compute, a = i === void 0 ? "n\
ame" : i, s = t.computedStyleSupportsPseudoElements, l = s === void 0 ? t.getComputedStyle !== void 0 : s, c = t.getComputedStyle, u = c ===
  void 0 ? n.getComputedStyle.bind(n) : c, d = t.hidden, f = d === void 0 ? !1 : d;
  function h(b, E) {
    var q = "";
    if (me(b) && l) {
      var C = u(b, "::before"), P = Bv(C);
      q = "".concat(P, " ").concat(q);
    }
    var O = jv(b) ? nk(b) : Ge(b.childNodes).concat(Ur(b, "aria-owns"));
    if (O.forEach(function(j) {
      var J = x(j, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1,
        recursion: !0
      }), S = me(j) ? u(j).getPropertyValue("display") : "inline", G = S !== "inline" ? " " : "";
      q += "".concat(G).concat(J).concat(G);
    }), me(b) && l) {
      var R = u(b, "::after"), A = Bv(R);
      q = "".concat(q, " ").concat(A);
    }
    return q.trim();
  }
  o(h, "computeMiscTextAlternative");
  function m(b, E) {
    var q = b.getAttributeNode(E);
    return q !== null && !r.has(q) && q.value.trim() !== "" ? (r.add(q), q.value) : null;
  }
  o(m, "useAttribute");
  function y(b) {
    return me(b) ? m(b, "title") : null;
  }
  o(y, "computeTooltipAttributeValue");
  function g(b) {
    if (!me(b))
      return null;
    if (Nv(b)) {
      r.add(b);
      for (var E = Ge(b.childNodes), q = 0; q < E.length; q += 1) {
        var C = E[q];
        if (Iv(C))
          return x(C, {
            isEmbeddedInLabel: !1,
            isReferenced: !1,
            recursion: !1
          });
      }
    } else if (Sv(b)) {
      r.add(b);
      for (var P = Ge(b.childNodes), O = 0; O < P.length; O += 1) {
        var R = P[O];
        if (rm(R))
          return x(R, {
            isEmbeddedInLabel: !1,
            isReferenced: !1,
            recursion: !1
          });
      }
    } else if (kv(b)) {
      r.add(b);
      for (var A = Ge(b.childNodes), j = 0; j < A.length; j += 1) {
        var J = A[j];
        if (Lv(J))
          return J.textContent;
      }
      return null;
    } else if (xe(b) === "img" || xe(b) === "area") {
      var S = m(b, "alt");
      if (S !== null)
        return S;
    } else if (Tv(b)) {
      var G = m(b, "label");
      if (G !== null)
        return G;
    }
    if (Bn(b) && (b.type === "button" || b.type === "submit" || b.type === "reset")) {
      var ne = m(b, "value");
      if (ne !== null)
        return ne;
      if (b.type === "submit")
        return "Submit";
      if (b.type === "reset")
        return "Reset";
    }
    var B = rk(b);
    if (B !== null && B.length !== 0)
      return r.add(b), Ge(B).map(function(V) {
        return x(V, {
          isEmbeddedInLabel: !0,
          isReferenced: !1,
          recursion: !0
        });
      }).filter(function(V) {
        return V.length > 0;
      }).join(" ");
    if (Bn(b) && b.type === "image") {
      var H = m(b, "alt");
      if (H !== null)
        return H;
      var $ = m(b, "title");
      return $ !== null ? $ : "Submit Query";
    }
    if (at(b, ["button"])) {
      var W = h(b, {
        isEmbeddedInLabel: !1,
        isReferenced: !1
      });
      if (W !== "")
        return W;
    }
    return null;
  }
  o(g, "computeElementTextAlternative");
  function x(b, E) {
    if (r.has(b))
      return "";
    if (!f && Gj(b, u) && !E.isReferenced)
      return r.add(b), "";
    var q = me(b) ? b.getAttributeNode("aria-labelledby") : null, C = q !== null && !r.has(q) ? Ur(b, "aria-labelledby") : [];
    if (a === "name" && !E.isReferenced && C.length > 0)
      return r.add(q), C.map(function(S) {
        return x(S, {
          isEmbeddedInLabel: E.isEmbeddedInLabel,
          isReferenced: !0,
          // this isn't recursion as specified, otherwise we would skip
          // `aria-label` in
          // <input id="myself" aria-label="foo" aria-labelledby="myself"
          recursion: !1
        });
      }).join(" ");
    var P = E.recursion && Kj(b) && a === "name";
    if (!P) {
      var O = (me(b) && b.getAttribute("aria-label") || "").trim();
      if (O !== "" && a === "name")
        return r.add(b), O;
      if (!Xj(b)) {
        var R = g(b);
        if (R !== null)
          return r.add(b), R;
      }
    }
    if (at(b, ["menu"]))
      return r.add(b), "";
    if (P || E.isEmbeddedInLabel || E.isReferenced) {
      if (at(b, ["combobox", "listbox"])) {
        r.add(b);
        var A = Yj(b);
        return A.length === 0 ? Bn(b) ? b.value : "" : Ge(A).map(function(S) {
          return x(S, {
            isEmbeddedInLabel: E.isEmbeddedInLabel,
            isReferenced: !1,
            recursion: !0
          });
        }).join(" ");
      }
      if (Dv(b, "range"))
        return r.add(b), b.hasAttribute("aria-valuetext") ? b.getAttribute("aria-valuetext") : b.hasAttribute("aria-valuenow") ? b.getAttribute(
        "aria-valuenow") : b.getAttribute("value") || "";
      if (at(b, ["textbox"]))
        return r.add(b), ek(b);
    }
    if (Qj(b) || me(b) && E.isReferenced || Jj(b) || Zj(b)) {
      var j = h(b, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1
      });
      if (j !== "")
        return r.add(b), j;
    }
    if (b.nodeType === b.TEXT_NODE)
      return r.add(b), b.textContent || "";
    if (E.recursion)
      return r.add(b), h(b, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1
      });
    var J = y(b);
    return J !== null ? (r.add(b), J) : (r.add(b), "");
  }
  return o(x, "computeTextAlternative"), Wj(x(e, {
    isEmbeddedInLabel: !1,
    // by spec computeAccessibleDescription starts with the referenced elements as roots
    isReferenced: a === "description",
    recursion: !1
  }));
}
o(pi, "computeTextAlternative");

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/accessible-description.mjs
function Dn(e) {
  "@babel/helpers - typeof";
  return Dn = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Dn(e);
}
o(Dn, "_typeof");
function Hv(e, t) {
  var r = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    t && (n = n.filter(function(i) {
      return Object.getOwnPropertyDescriptor(e, i).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
o(Hv, "ownKeys");
function Vv(e) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Hv(Object(r), !0).forEach(function(n) {
      ok(e, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : Hv(Object(r)).forEach(function(n) {
      Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return e;
}
o(Vv, "_objectSpread");
function ok(e, t, r) {
  return t = ik(t), t in e ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = r, e;
}
o(ok, "_defineProperty");
function ik(e) {
  var t = ak(e, "string");
  return Dn(t) === "symbol" ? t : String(t);
}
o(ik, "_toPropertyKey");
function ak(e, t) {
  if (Dn(e) !== "object" || e === null) return e;
  var r = e[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(e, t || "default");
    if (Dn(n) !== "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
o(ak, "_toPrimitive");
function nm(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, r = Ur(e, "aria-describedby").map(function(a) {
    return pi(a, Vv(Vv({}, t), {}, {
      compute: "description"
    }));
  }).join(" ");
  if (r === "") {
    var n = e.getAttribute("aria-description");
    r = n === null ? "" : n;
  }
  if (r === "") {
    var i = e.getAttribute("title");
    r = i === null ? "" : i;
  }
  return r;
}
o(nm, "computeAccessibleDescription");

// ../node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api/dist/accessible-name.mjs
function sk(e) {
  return at(e, ["caption", "code", "deletion", "emphasis", "generic", "insertion", "none", "paragraph", "presentation", "strong", "subscript",
  "superscript"]);
}
o(sk, "prohibitsNaming");
function om(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  return sk(e) ? "" : pi(e, t);
}
o(om, "computeAccessibleName");

// ../node_modules/@testing-library/jest-dom/dist/matchers-c85aadf8.mjs
var oo = ze(xm(), 1), XP = ze(Nm(), 1), Tl = ze(Zm(), 1), JP = ze(th(), 1);
var Th = class Th extends Error {
  constructor(t, r, n, i) {
    super(), Error.captureStackTrace && Error.captureStackTrace(this, n);
    let a = "";
    try {
      a = i.utils.printWithType(
        "Received",
        r,
        i.utils.printReceived
      );
    } catch {
    }
    this.message = [
      i.utils.matcherHint(
        `${i.isNot ? ".not" : ""}.${n.name}`,
        "received",
        ""
      ),
      "",
      // eslint-disable-next-line new-cap
      `${i.utils.RECEIVED_COLOR(
        "received"
      )} value must ${t}.`,
      a
    ].join(`
`);
  }
};
o(Th, "GenericTypeError");
var vl = Th, Oh = class Oh extends vl {
  constructor(...t) {
    super("be an HTMLElement or an SVGElement", ...t);
  }
};
o(Oh, "HtmlElementTypeError");
var wl = Oh, Sh = class Sh extends vl {
  constructor(...t) {
    super("be a Node", ...t);
  }
};
o(Sh, "NodeTypeError");
var El = Sh;
function QP(e, t, ...r) {
  if (!e || !e.ownerDocument || !e.ownerDocument.defaultView)
    throw new t(e, ...r);
}
o(QP, "checkHasWindow");
function QV(e, ...t) {
  QP(e, El, ...t);
  let r = e.ownerDocument.defaultView;
  if (!(e instanceof r.Node))
    throw new El(e, ...t);
}
o(QV, "checkNode");
function ie(e, ...t) {
  QP(e, wl, ...t);
  let r = e.ownerDocument.defaultView;
  if (!(e instanceof r.HTMLElement) && !(e instanceof r.SVGElement))
    throw new wl(e, ...t);
}
o(ie, "checkHtmlElement");
var Mh = class Mh extends Error {
  constructor(t, r, n) {
    super(), Error.captureStackTrace && Error.captureStackTrace(this, r), this.message = [
      t.message,
      "",
      // eslint-disable-next-line new-cap
      n.utils.RECEIVED_COLOR("Failing css:"),
      // eslint-disable-next-line new-cap
      n.utils.RECEIVED_COLOR(`${t.css}`)
    ].join(`
`);
  }
};
o(Mh, "InvalidCSSError");
var nh = Mh;
function ZV(e, ...t) {
  let r = Cv(`selector { ${e} }`, { silent: !0 }).stylesheet;
  if (r.parsingErrors && r.parsingErrors.length > 0) {
    let { reason: i, line: a } = r.parsingErrors[0];
    throw new nh(
      {
        css: e,
        message: `Syntax error parsing expected css: ${i} on line: ${a}`
      },
      ...t
    );
  }
  return r.rules[0].declarations.filter((i) => i.type === "declaration").reduce(
    (i, { property: a, value: s }) => Object.assign(i, { [a]: s }),
    {}
  );
}
o(ZV, "parseCSS");
function zP(e, t) {
  return typeof t == "string" ? t : e.utils.stringify(t);
}
o(zP, "display");
function Me(e, t, r, n, i, a) {
  return [
    `${t}
`,
    // eslint-disable-next-line new-cap
    `${r}:
${e.utils.EXPECTED_COLOR(
      (0, rh.default)(zP(e, n), 2)
    )}`,
    // eslint-disable-next-line new-cap
    `${i}:
${e.utils.RECEIVED_COLOR(
      (0, rh.default)(zP(e, a), 2)
    )}`
  ].join(`
`);
}
o(Me, "getMessage");
function ez(e, t) {
  return t instanceof RegExp ? t.test(e) : e.includes(String(t));
}
o(ez, "matches");
function Ol(e, t) {
  console.warn(
    `Warning: ${e} has been deprecated and will be removed in future updates.`,
    t
  );
}
o(Ol, "deprecate");
function Sl(e) {
  return e.replace(/\s+/g, " ").trim();
}
o(Sl, "normalize");
function Dt(e) {
  return e.tagName && e.tagName.toLowerCase();
}
o(Dt, "getTag");
function tz({ multiple: e, options: t }) {
  let r = [...t].filter((n) => n.selected);
  if (e)
    return [...r].map((n) => n.value);
  if (r.length !== 0)
    return r[0].value;
}
o(tz, "getSelectValue");
function rz(e) {
  switch (e.type) {
    case "number":
      return e.value === "" ? null : Number(e.value);
    case "checkbox":
      return e.checked;
    default:
      return e.value;
  }
}
o(rz, "getInputValue");
var nz = ["meter", "progressbar", "slider", "spinbutton"];
function oz(e) {
  if (nz.includes(e.getAttribute("role")))
    return Number(e.getAttribute("aria-valuenow"));
}
o(oz, "getAccessibleValue");
function ZP(e) {
  if (e)
    switch (e.tagName.toLowerCase()) {
      case "input":
        return rz(e);
      case "select":
        return tz(e);
      default:
        return e.value ?? oz(e);
    }
}
o(ZP, "getSingleElementValue");
function iz(e, { wordConnector: t = ", ", lastWordConnector: r = " and " } = {}) {
  return [e.slice(0, -1).join(t), e[e.length - 1]].join(
    e.length > 1 ? r : ""
  );
}
o(iz, "toSentence");
function oh(e, t) {
  if (Array.isArray(e) && Array.isArray(t))
    return [...new Set(e)].every((r) => new Set(t).has(r));
}
o(oh, "compareArraysAsSet");
function Cl(e, t) {
  return Ol(
    "toBeInTheDOM",
    "Please use toBeInTheDocument for searching the entire document and toContainElement for searching a specific container."
  ), e && ie(e, Cl, this), t && ie(t, Cl, this), {
    pass: t ? t.contains(e) : !!e,
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBeInTheDOM`,
        "element",
        ""
      ),
      "",
      "Received:",
      `  ${this.utils.printReceived(
        e && e.cloneNode(!1)
      )}`
    ].join(`
`), "message")
  };
}
o(Cl, "toBeInTheDOM");
function ih(e) {
  (e !== null || !this.isNot) && ie(e, ih, this);
  let t = e === null ? !1 : e.ownerDocument === e.getRootNode({ composed: !0 }), r = /* @__PURE__ */ o(() => `expected document not to conta\
in element, found ${this.utils.stringify(
    e.cloneNode(!0)
  )} instead`, "errorFound"), n = /* @__PURE__ */ o(() => "element could not be found in the document", "errorNotFound");
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBeInTheDocument`,
        "element",
        ""
      ),
      "",
      // eslint-disable-next-line new-cap
      this.utils.RECEIVED_COLOR(this.isNot ? r() : n())
    ].join(`
`), "message")
  };
}
o(ih, "toBeInTheDocument");
function ah(e) {
  return Ol(
    "toBeEmpty",
    "Please use instead toBeEmptyDOMElement for finding empty nodes in the DOM."
  ), ie(e, ah, this), {
    pass: e.innerHTML === "",
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBeEmpty`,
        "element",
        ""
      ),
      "",
      "Received:",
      `  ${this.utils.printReceived(e.innerHTML)}`
    ].join(`
`), "message")
  };
}
o(ah, "toBeEmpty");
function sh(e) {
  return ie(e, sh, this), {
    pass: az(e),
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBeEmptyDOMElement`,
        "element",
        ""
      ),
      "",
      "Received:",
      `  ${this.utils.printReceived(e.innerHTML)}`
    ].join(`
`), "message")
  };
}
o(sh, "toBeEmptyDOMElement");
function az(e) {
  return [...e.childNodes].filter((r) => r.nodeType !== 8).length === 0;
}
o(az, "isEmptyElement");
function xl(e, t) {
  return ie(e, xl, this), t !== null && ie(t, xl, this), {
    pass: e.contains(t),
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toContainElement`,
        "element",
        "element"
      ),
      "",
      // eslint-disable-next-line new-cap
      this.utils.RECEIVED_COLOR(`${this.utils.stringify(
        e.cloneNode(!1)
      )} ${this.isNot ? "contains:" : "does not contain:"} ${this.utils.stringify(t && t.cloneNode(!1))}
        `)
    ].join(`
`), "message")
  };
}
o(xl, "toContainElement");
function sz(e, t) {
  let r = e.ownerDocument.createElement("div");
  return r.innerHTML = t, r.innerHTML;
}
o(sz, "getNormalizedHtml");
function lh(e, t) {
  if (ie(e, lh, this), typeof t != "string")
    throw new Error(`.toContainHTML() expects a string value, got ${t}`);
  return {
    pass: e.outerHTML.includes(sz(e, t)),
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toContainHTML`,
        "element",
        ""
      ),
      "Expected:",
      // eslint-disable-next-line new-cap
      `  ${this.utils.EXPECTED_COLOR(t)}`,
      "Received:",
      `  ${this.utils.printReceived(e.cloneNode(!0))}`
    ].join(`
`), "message")
  };
}
o(lh, "toContainHTML");
function uh(e, t, r = { normalizeWhitespace: !0 }) {
  QV(e, uh, this);
  let n = r.normalizeWhitespace ? Sl(e.textContent) : e.textContent.replace(/\u00a0/g, " "), i = n !== "" && t === "";
  return {
    pass: !i && ez(n, t),
    message: /* @__PURE__ */ o(() => {
      let a = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveTextContent`,
          "element",
          ""
        ),
        i ? "Checking with empty string will always match, use .toBeEmptyDOMElement() instead" : `Expected element ${a} have text content`,
        t,
        "Received",
        n
      );
    }, "message")
  };
}
o(uh, "toHaveTextContent");
function _l(e, t) {
  ie(e, _l, this);
  let r = nm(e), n = arguments.length === 1, i = !1;
  return n ? i = r !== "" : i = t instanceof RegExp ? t.test(r) : this.equals(
    r,
    t
  ), {
    pass: i,
    message: /* @__PURE__ */ o(() => {
      let a = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${_l.name}`,
          "element",
          ""
        ),
        `Expected element ${a} have accessible description`,
        t,
        "Received",
        r
      );
    }, "message")
  };
}
o(_l, "toHaveAccessibleDescription");
var no = "aria-invalid", lz = ["false"];
function ch(e, t) {
  ie(e, ch, this);
  let r = this.isNot ? "not to" : "to", n = this.isNot ? ".not.toHaveAccessibleErrorMessage" : ".toHaveAccessibleErrorMessage", i = e.getAttribute(
  "aria-errormessage");
  if (!!i && /\s+/.test(i))
    return {
      pass: !1,
      message: /* @__PURE__ */ o(() => Me(
        this,
        this.utils.matcherHint(n, "element"),
        "Expected element's `aria-errormessage` attribute to be empty or a single, valid ID",
        "",
        "Received",
        `aria-errormessage="${i}"`
      ), "message")
    };
  let s = e.getAttribute(no);
  if (!e.hasAttribute(no) || lz.includes(s))
    return {
      pass: !1,
      message: /* @__PURE__ */ o(() => Me(
        this,
        this.utils.matcherHint(n, "element"),
        "Expected element to be marked as invalid with attribute",
        `${no}="${String(!0)}"`,
        "Received",
        e.hasAttribute("aria-invalid") ? `${no}="${e.getAttribute(no)}` : null
      ), "message")
    };
  let c = Sl(
    e.ownerDocument.getElementById(i)?.textContent ?? ""
  );
  return {
    pass: t === void 0 ? !!c : t instanceof RegExp ? t.test(c) : this.equals(c, t),
    message: /* @__PURE__ */ o(() => Me(
      this,
      this.utils.matcherHint(n, "element"),
      `Expected element ${r} have accessible error message`,
      t ?? "",
      "Received",
      c
    ), "message")
  };
}
o(ch, "toHaveAccessibleErrorMessage");
var uz = fz(oo.elementRoles);
function Pl(e, t) {
  ie(e, Pl, this);
  let r = cz(e);
  return {
    pass: r.some((i) => i === t),
    message: /* @__PURE__ */ o(() => {
      let i = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${Pl.name}`,
          "element",
          ""
        ),
        `Expected element ${i} have role`,
        t,
        "Received",
        r.join(", ")
      );
    }, "message")
  };
}
o(Pl, "toHaveRole");
function cz(e) {
  return e.hasAttribute("role") ? e.getAttribute("role").split(" ").filter(Boolean) : dz(e);
}
o(cz, "getExplicitOrImplicitRoles");
function dz(e) {
  for (let { match: t, roles: r } of uz)
    if (t(e))
      return [...r];
  return [];
}
o(dz, "getImplicitAriaRoles");
function fz(e) {
  function t({ name: s, attributes: l }) {
    return `${s}${l.map(({ name: c, value: u, constraints: d = [] }) => d.indexOf("undefined") !== -1 ? `:not([${c}])` : u ? `[${c}="${u}"]` :
    `[${c}]`).join("")}`;
  }
  o(t, "makeElementSelector");
  function r({ attributes: s = [] }) {
    return s.length;
  }
  o(r, "getSelectorSpecificity");
  function n({ specificity: s }, { specificity: l }) {
    return l - s;
  }
  o(n, "bySelectorSpecificity");
  function i(s) {
    let { attributes: l = [] } = s, c = l.findIndex(
      (d) => d.value && d.name === "type" && d.value === "text"
    );
    c >= 0 && (l = [
      ...l.slice(0, c),
      ...l.slice(c + 1)
    ]);
    let u = t({ ...s, attributes: l });
    return (d) => c >= 0 && d.type !== "text" ? !1 : d.matches(u);
  }
  o(i, "match");
  let a = [];
  for (let [s, l] of e.entries())
    a = [
      ...a,
      {
        match: i(s),
        roles: Array.from(l),
        specificity: r(s)
      }
    ];
  return a.sort(n);
}
o(fz, "buildElementRoleList");
function ql(e, t) {
  ie(e, ql, this);
  let r = om(e), n = arguments.length === 1, i = !1;
  return n ? i = r !== "" : i = t instanceof RegExp ? t.test(r) : this.equals(r, t), {
    pass: i,
    message: /* @__PURE__ */ o(() => {
      let a = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${ql.name}`,
          "element",
          ""
        ),
        `Expected element ${a} have accessible name`,
        t,
        "Received",
        r
      );
    }, "message")
  };
}
o(ql, "toHaveAccessibleName");
function WP(e, t, r) {
  return r === void 0 ? t : `${t}=${e(r)}`;
}
o(WP, "printAttribute");
function pz(e, t, r) {
  return r === void 0 ? `element.hasAttribute(${e(t)})` : `element.getAttribute(${e(t)}) === ${e(r)}`;
}
o(pz, "getAttributeComment");
function dh(e, t, r) {
  ie(e, dh, this);
  let n = r !== void 0, i = e.hasAttribute(t), a = e.getAttribute(t);
  return {
    pass: n ? i && this.equals(a, r) : i,
    message: /* @__PURE__ */ o(() => {
      let s = this.isNot ? "not to" : "to", l = i ? WP(this.utils.stringify, t, a) : null, c = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveAttribute`,
        "element",
        this.utils.printExpected(t),
        {
          secondArgument: n ? this.utils.printExpected(r) : void 0,
          comment: pz(
            this.utils.stringify,
            t,
            r
          )
        }
      );
      return Me(
        this,
        c,
        `Expected the element ${s} have attribute`,
        WP(this.utils.stringify, t, r),
        "Received",
        l
      );
    }, "message")
  };
}
o(dh, "toHaveAttribute");
function mz(e) {
  let t = e.pop(), r, n;
  return typeof t == "object" && !(t instanceof RegExp) ? (r = e, n = t) : (r = e.concat(t), n = { exact: !1 }), { expectedClassNames: r, options: n };
}
o(mz, "getExpectedClassNamesAndOptions");
function GP(e) {
  return e ? e.split(/\s+/).filter((t) => t.length > 0) : [];
}
o(GP, "splitClassNames");
function KP(e, t) {
  return e.every(
    (r) => typeof r == "string" ? t.includes(r) : t.some((n) => r.test(n))
  );
}
o(KP, "isSubset$1");
function fh(e, ...t) {
  ie(e, fh, this);
  let { expectedClassNames: r, options: n } = mz(t), i = GP(e.getAttribute("class")), a = r.reduce(
    (l, c) => l.concat(
      typeof c == "string" || !c ? GP(c) : c
    ),
    []
  ), s = a.some((l) => l instanceof RegExp);
  if (n.exact && s)
    throw new Error("Exact option does not support RegExp expected class names");
  return n.exact ? {
    pass: KP(a, i) && a.length === i.length,
    message: /* @__PURE__ */ o(() => {
      let l = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveClass`,
          "element",
          this.utils.printExpected(a.join(" "))
        ),
        `Expected the element ${l} have EXACTLY defined classes`,
        a.join(" "),
        "Received",
        i.join(" ")
      );
    }, "message")
  } : a.length > 0 ? {
    pass: KP(a, i),
    message: /* @__PURE__ */ o(() => {
      let l = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveClass`,
          "element",
          this.utils.printExpected(a.join(" "))
        ),
        `Expected the element ${l} have class`,
        a.join(" "),
        "Received",
        i.join(" ")
      );
    }, "message")
  } : {
    pass: this.isNot ? i.length > 0 : !1,
    message: /* @__PURE__ */ o(() => this.isNot ? Me(
      this,
      this.utils.matcherHint(".not.toHaveClass", "element", ""),
      "Expected the element to have classes",
      "(none)",
      "Received",
      i.join(" ")
    ) : [
      this.utils.matcherHint(".toHaveClass", "element"),
      "At least one expected class must be provided."
    ].join(`
`), "message")
  };
}
o(fh, "toHaveClass");
function hz(e, t) {
  let r = {}, n = e.createElement("div");
  return Object.keys(t).forEach((i) => {
    n.style[i] = t[i], r[i] = n.style[i];
  }), r;
}
o(hz, "getStyleDeclaration");
function bz(e, t) {
  return !!Object.keys(e).length && Object.entries(e).every(([r, n]) => {
    let i = r.startsWith("--"), a = [r];
    return i || a.push(r.toLowerCase()), a.some(
      (s) => t[s] === n || t.getPropertyValue(s) === n
    );
  });
}
o(bz, "isSubset");
function YP(e) {
  return Object.keys(e).sort().map((t) => `${t}: ${e[t]};`).join(`
`);
}
o(YP, "printoutStyles");
function yz(e, t, r) {
  let n = Array.from(r).filter((a) => t[a] !== void 0).reduce(
    (a, s) => Object.assign(a, { [s]: r.getPropertyValue(s) }),
    {}
  );
  return e(YP(t), YP(n)).replace(`${XP.default.red("+ Received")}
`, "");
}
o(yz, "expectedDiff");
function Rl(e, t) {
  ie(e, Rl, this);
  let r = typeof t == "object" ? t : ZV(t, Rl, this), { getComputedStyle: n } = e.ownerDocument.defaultView, i = hz(e.ownerDocument, r), a = n(
  e);
  return {
    pass: bz(i, a),
    message: /* @__PURE__ */ o(() => {
      let s = `${this.isNot ? ".not" : ""}.toHaveStyle`;
      return [
        this.utils.matcherHint(s, "element", ""),
        yz(this.utils.diff, i, a)
      ].join(`

`);
    }, "message")
  };
}
o(Rl, "toHaveStyle");
function ph(e) {
  return ie(e, ph, this), {
    pass: e.ownerDocument.activeElement === e,
    message: /* @__PURE__ */ o(() => [
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveFocus`,
        "element",
        ""
      ),
      "",
      ...this.isNot ? [
        "Received element is focused:",
        `  ${this.utils.printReceived(e)}`
      ] : [
        "Expected element with focus:",
        `  ${this.utils.printExpected(e)}`,
        "Received element with focus:",
        `  ${this.utils.printReceived(
          e.ownerDocument.activeElement
        )}`
      ]
    ].join(`
`), "message")
  };
}
o(ph, "toHaveFocus");
function gz(e) {
  let t = [...new Set(e.map((r) => r.type))];
  if (t.length !== 1)
    throw new Error(
      "Multiple form elements with the same name must be of the same type"
    );
  switch (t[0]) {
    case "radio": {
      let r = e.find((n) => n.checked);
      return r ? r.value : void 0;
    }
    case "checkbox":
      return e.filter((r) => r.checked).map((r) => r.value);
    default:
      return e.map((r) => r.value);
  }
}
o(gz, "getMultiElementValue");
function vz(e, t) {
  let r = [...e.querySelectorAll(`[name="${(0, JP.default)(t)}"]`)];
  if (r.length !== 0)
    switch (r.length) {
      case 1:
        return ZP(r[0]);
      default:
        return gz(r);
    }
}
o(vz, "getFormValue");
function wz(e) {
  return /\[\]$/.test(e) ? e.slice(0, -2) : e;
}
o(wz, "getPureName");
function Ez(e) {
  return Array.from(e.elements).map((r) => r.name).reduce(
    (r, n) => ({
      ...r,
      [wz(n)]: vz(e, n)
    }),
    {}
  );
}
o(Ez, "getAllFormValues");
function mh(e, t) {
  if (ie(e, mh, this), !e.elements)
    throw new Error("toHaveFormValues must be called on a form or a fieldset");
  let r = Ez(e);
  return {
    pass: Object.entries(t).every(
      ([n, i]) => (0, Tl.default)(r[n], i, oh)
    ),
    message: /* @__PURE__ */ o(() => {
      let n = this.isNot ? "not to" : "to", i = `${this.isNot ? ".not" : ""}.toHaveFormValues`, a = Object.keys(r).filter((s) => t.hasOwnProperty(
      s)).reduce((s, l) => ({ ...s, [l]: r[l] }), {});
      return [
        this.utils.matcherHint(i, "element", ""),
        `Expected the element ${n} have form values`,
        this.utils.diff(t, a)
      ].join(`

`);
    }, "message")
  };
}
o(mh, "toHaveFormValues");
function Cz(e) {
  let { getComputedStyle: t } = e.ownerDocument.defaultView, { display: r, visibility: n, opacity: i } = t(e);
  return r !== "none" && n !== "hidden" && n !== "collapse" && i !== "0" && i !== 0;
}
o(Cz, "isStyleVisible");
function xz(e, t) {
  let r;
  return t ? r = e.nodeName === "DETAILS" && t.nodeName !== "SUMMARY" ? e.hasAttribute("open") : !0 : r = e.nodeName === "DETAILS" ? e.hasAttribute(
  "open") : !0, !e.hasAttribute("hidden") && r;
}
o(xz, "isAttributeVisible");
function eq(e, t) {
  return Cz(e) && xz(e, t) && (!e.parentElement || eq(e.parentElement, e));
}
o(eq, "isElementVisible");
function hh(e) {
  ie(e, hh, this);
  let t = e.ownerDocument === e.getRootNode({ composed: !0 }), r = t && eq(e);
  return {
    pass: r,
    message: /* @__PURE__ */ o(() => {
      let n = r ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeVisible`,
          "element",
          ""
        ),
        "",
        `Received element ${n} visible${t ? "" : " (element is not in the document)"}:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(hh, "toBeVisible");
var _z = [
  "fieldset",
  "input",
  "select",
  "optgroup",
  "option",
  "button",
  "textarea"
];
function Pz(e, t) {
  return Dt(e) === "legend" && Dt(t) === "fieldset" && e.isSameNode(
    Array.from(t.children).find((r) => Dt(r) === "legend")
  );
}
o(Pz, "isFirstLegendChildOfFieldset");
function qz(e, t) {
  return rq(t) && !Pz(e, t);
}
o(qz, "isElementDisabledByParent");
function Rz(e) {
  return e.includes("-");
}
o(Rz, "isCustomElement");
function tq(e) {
  let t = Dt(e);
  return _z.includes(t) || Rz(t);
}
o(tq, "canElementBeDisabled");
function rq(e) {
  return tq(e) && e.hasAttribute("disabled");
}
o(rq, "isElementDisabled");
function nq(e) {
  let t = e.parentElement;
  return !!t && (qz(e, t) || nq(t));
}
o(nq, "isAncestorDisabled");
function oq(e) {
  return tq(e) && (rq(e) || nq(e));
}
o(oq, "isElementOrAncestorDisabled");
function bh(e) {
  ie(e, bh, this);
  let t = oq(e);
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => {
      let r = t ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeDisabled`,
          "element",
          ""
        ),
        "",
        `Received element ${r} disabled:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(bh, "toBeDisabled");
function yh(e) {
  ie(e, yh, this);
  let t = !oq(e);
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => {
      let r = t ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeEnabled`,
          "element",
          ""
        ),
        "",
        `Received element ${r} enabled:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(yh, "toBeEnabled");
var Tz = ["select", "textarea"], Oz = ["input", "select", "textarea"], Sz = [
  "color",
  "hidden",
  "range",
  "submit",
  "image",
  "reset"
], Mz = [
  "checkbox",
  "combobox",
  "gridcell",
  "listbox",
  "radiogroup",
  "spinbutton",
  "textbox",
  "tree"
];
function Az(e) {
  return Tz.includes(Dt(e)) && e.hasAttribute("required");
}
o(Az, "isRequiredOnFormTagsExceptInput");
function Nz(e) {
  return Dt(e) === "input" && e.hasAttribute("required") && (e.hasAttribute("type") && !Sz.includes(e.getAttribute("type")) || !e.hasAttribute(
  "type"));
}
o(Nz, "isRequiredOnSupportedInput");
function Iz(e) {
  return e.hasAttribute("aria-required") && e.getAttribute("aria-required") === "true" && (Oz.includes(Dt(e)) || e.hasAttribute("role") && Mz.
  includes(e.getAttribute("role")));
}
o(Iz, "isElementRequiredByARIA");
function gh(e) {
  ie(e, gh, this);
  let t = Az(e) || Nz(e) || Iz(e);
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => {
      let r = t ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeRequired`,
          "element",
          ""
        ),
        "",
        `Received element ${r} required:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(gh, "toBeRequired");
var jz = ["form", "input", "select", "textarea"];
function kz(e) {
  return e.hasAttribute("aria-invalid") && e.getAttribute("aria-invalid") !== "false";
}
o(kz, "isElementHavingAriaInvalid");
function Lz(e) {
  return jz.includes(Dt(e));
}
o(Lz, "isSupportsValidityMethod");
function iq(e) {
  let t = kz(e);
  return Lz(e) ? t || !e.checkValidity() : t;
}
o(iq, "isElementInvalid");
function vh(e) {
  ie(e, vh, this);
  let t = iq(e);
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => {
      let r = t ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeInvalid`,
          "element",
          ""
        ),
        "",
        `Received element ${r} currently invalid:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(vh, "toBeInvalid");
function wh(e) {
  ie(e, wh, this);
  let t = !iq(e);
  return {
    pass: t,
    message: /* @__PURE__ */ o(() => {
      let r = t ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeValid`,
          "element",
          ""
        ),
        "",
        `Received element ${r} currently valid:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(wh, "toBeValid");
function Eh(e, t) {
  if (ie(e, Eh, this), e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type))
    throw new Error(
      "input with type=checkbox or type=radio cannot be used with .toHaveValue(). Use .toBeChecked() for type=checkbox or .toHaveFormValues(\
) instead"
    );
  let r = ZP(e), n = t !== void 0, i = t, a = r;
  return t == r && t !== r && (i = `${t} (${typeof t})`, a = `${r} (${typeof r})`), {
    pass: n ? (0, Tl.default)(r, t, oh) : !!r,
    message: /* @__PURE__ */ o(() => {
      let s = this.isNot ? "not to" : "to", l = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveValue`,
        "element",
        t
      );
      return Me(
        this,
        l,
        `Expected the element ${s} have value`,
        n ? i : "(any)",
        "Received",
        a
      );
    }, "message")
  };
}
o(Eh, "toHaveValue");
function Ch(e, t) {
  ie(e, Ch, this);
  let r = e.tagName.toLowerCase();
  if (!["select", "input", "textarea"].includes(r))
    throw new Error(
      ".toHaveDisplayValue() currently supports only input, textarea or select elements, try with another matcher instead."
    );
  if (r === "input" && ["radio", "checkbox"].includes(e.type))
    throw new Error(
      `.toHaveDisplayValue() currently does not support input[type="${e.type}"], try with another matcher instead.`
    );
  let n = $z(r, e), i = Bz(t), a = i.filter(
    (c) => n.some(
      (u) => c instanceof RegExp ? c.test(u) : this.equals(u, String(c))
    )
  ).length, s = a === n.length, l = a === i.length;
  return {
    pass: s && l,
    message: /* @__PURE__ */ o(() => Me(
      this,
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveDisplayValue`,
        "element",
        ""
      ),
      `Expected element ${this.isNot ? "not " : ""}to have display value`,
      t,
      "Received",
      n
    ), "message")
  };
}
o(Ch, "toHaveDisplayValue");
function $z(e, t) {
  return e === "select" ? Array.from(t).filter((r) => r.selected).map((r) => r.textContent) : [t.value];
}
o($z, "getValues");
function Bz(e) {
  return e instanceof Array ? e : [e];
}
o(Bz, "getExpectedValues");
function xh(e) {
  ie(e, xh, this);
  let t = /* @__PURE__ */ o(() => e.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(e.type), "isValidInput"), r = /* @__PURE__ */ o(
  () => aq(e.getAttribute("role")) && ["true", "false"].includes(e.getAttribute("aria-checked")), "isValidAriaElement");
  if (!t() && !r())
    return {
      pass: !1,
      message: /* @__PURE__ */ o(() => `only inputs with type="checkbox" or type="radio" or elements with ${Dz()} and a valid aria-checked a\
ttribute can be used with .toBeChecked(). Use .toHaveValue() instead`, "message")
    };
  let n = /* @__PURE__ */ o(() => t() ? e.checked : e.getAttribute("aria-checked") === "true", "isChecked");
  return {
    pass: n(),
    message: /* @__PURE__ */ o(() => {
      let i = n() ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeChecked`,
          "element",
          ""
        ),
        "",
        `Received element ${i} checked:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(xh, "toBeChecked");
function Dz() {
  return iz(
    Fz().map((e) => `role="${e}"`),
    { lastWordConnector: " or " }
  );
}
o(Dz, "supportedRolesSentence");
function Fz() {
  return oo.roles.keys().filter(aq);
}
o(Fz, "supportedRoles");
function aq(e) {
  return oo.roles.get(e)?.props["aria-checked"] !== void 0;
}
o(aq, "roleSupportsChecked");
function _h(e) {
  ie(e, _h, this);
  let t = /* @__PURE__ */ o(() => e.tagName.toLowerCase() === "input" && e.type === "checkbox", "isValidInput"), r = /* @__PURE__ */ o(() => e.
  getAttribute("role") === "checkbox", "isValidAriaElement");
  if (!t() && !r())
    return {
      pass: !1,
      message: /* @__PURE__ */ o(() => 'only inputs with type="checkbox" or elements with role="checkbox" and a valid aria-checked attribute\
 can be used with .toBePartiallyChecked(). Use .toHaveValue() instead', "message")
    };
  let n = /* @__PURE__ */ o(() => {
    let i = e.getAttribute("aria-checked") === "mixed";
    return t() && e.indeterminate || i;
  }, "isPartiallyChecked");
  return {
    pass: n(),
    message: /* @__PURE__ */ o(() => {
      let i = n() ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBePartiallyChecked`,
          "element",
          ""
        ),
        "",
        `Received element ${i} partially checked:`,
        `  ${this.utils.printReceived(e.cloneNode(!1))}`
      ].join(`
`);
    }, "message")
  };
}
o(_h, "toBePartiallyChecked");
function Ph(e, t) {
  Ol(
    "toHaveDescription",
    "Please use toHaveAccessibleDescription."
  ), ie(e, Ph, this);
  let r = t !== void 0, i = (e.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean), a = "";
  if (i.length > 0) {
    let s = e.ownerDocument, l = i.map((c) => s.getElementById(c)).filter(Boolean);
    a = Sl(l.map((c) => c.textContent).join(" "));
  }
  return {
    pass: r ? t instanceof RegExp ? t.test(a) : this.equals(a, t) : !!a,
    message: /* @__PURE__ */ o(() => {
      let s = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveDescription`,
          "element",
          ""
        ),
        `Expected the element ${s} have description`,
        this.utils.printExpected(t),
        "Received",
        this.utils.printReceived(a)
      );
    }, "message")
  };
}
o(Ph, "toHaveDescription");
function qh(e, t) {
  if (Ol("toHaveErrorMessage", "Please use toHaveAccessibleErrorMessage."), ie(e, qh, this), !e.hasAttribute("aria-invalid") || e.getAttribute(
  "aria-invalid") === "false") {
    let s = this.isNot ? ".not" : "";
    return {
      pass: !1,
      message: /* @__PURE__ */ o(() => Me(
        this,
        this.utils.matcherHint(`${s}.toHaveErrorMessage`, "element", ""),
        "Expected the element to have invalid state indicated by",
        'aria-invalid="true"',
        "Received",
        e.hasAttribute("aria-invalid") ? `aria-invalid="${e.getAttribute("aria-invalid")}"` : this.utils.printReceived("")
      ), "message")
    };
  }
  let r = t !== void 0, i = (e.getAttribute("aria-errormessage") || "").split(/\s+/).filter(Boolean), a = "";
  if (i.length > 0) {
    let s = e.ownerDocument, l = i.map((c) => s.getElementById(c)).filter(Boolean);
    a = Sl(
      l.map((c) => c.textContent).join(" ")
    );
  }
  return {
    pass: r ? t instanceof RegExp ? t.test(a) : this.equals(a, t) : !!a,
    message: /* @__PURE__ */ o(() => {
      let s = this.isNot ? "not to" : "to";
      return Me(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveErrorMessage`,
          "element",
          ""
        ),
        `Expected the element ${s} have error message`,
        this.utils.printExpected(t),
        "Received",
        this.utils.printReceived(a)
      );
    }, "message")
  };
}
o(qh, "toHaveErrorMessage");
function Uz(e) {
  let t = e.ownerDocument.getSelection();
  if (["input", "textarea"].includes(e.tagName.toLowerCase()))
    return ["radio", "checkbox"].includes(e.type) ? "" : e.value.toString().substring(e.selectionStart, e.selectionEnd);
  if (t.anchorNode === null || t.focusNode === null)
    return "";
  let r = t.getRangeAt(0), n = e.ownerDocument.createRange();
  if (t.containsNode(e, !1))
    n.selectNodeContents(e), t.removeAllRanges(), t.addRange(n);
  else if (!(e.contains(t.anchorNode) && e.contains(t.focusNode))) {
    let a = e === r.startContainer || e.contains(r.startContainer), s = e === r.endContainer || e.contains(r.endContainer);
    t.removeAllRanges(), (a || s) && (n.selectNodeContents(e), a && n.setStart(
      r.startContainer,
      r.startOffset
    ), s && n.setEnd(
      r.endContainer,
      r.endOffset
    ), t.addRange(n));
  }
  let i = t.toString();
  return t.removeAllRanges(), t.addRange(r), i;
}
o(Uz, "getSelection");
function Rh(e, t) {
  ie(e, Rh, this);
  let r = t !== void 0;
  if (r && typeof t != "string")
    throw new Error("expected selection must be a string or undefined");
  let n = Uz(e);
  return {
    pass: r ? (0, Tl.default)(n, t, oh) : !!n,
    message: /* @__PURE__ */ o(() => {
      let i = this.isNot ? "not to" : "to", a = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveSelection`,
        "element",
        t
      );
      return Me(
        this,
        a,
        `Expected the element ${i} have selection`,
        r ? t : "(any)",
        "Received",
        n
      );
    }, "message")
  };
}
o(Rh, "toHaveSelection");

// ../node_modules/@testing-library/jest-dom/dist/matchers.mjs
var _pe = ze(Xp(), 1);
var Rpe = ze(xm(), 1), Tpe = ze(Nm(), 1), Ope = ze(Zm(), 1), Spe = ze(th(), 1);

// ../node_modules/tinyrainbow/dist/chunk-BVHSVHOK.js
var Hz = {
  reset: [0, 0],
  bold: [1, 22, "\x1B[22m\x1B[1m"],
  dim: [2, 22, "\x1B[22m\x1B[2m"],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  blackBright: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
  bgBlackBright: [100, 49],
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49]
}, Vz = Object.entries(Hz);
function Nh(e) {
  return String(e);
}
o(Nh, "a");
Nh.open = "";
Nh.close = "";
function sq(e = !1) {
  let t = typeof process < "u" ? process : void 0, r = t?.env || {}, n = t?.argv || [];
  return !("NO_COLOR" in r || n.includes("--no-color")) && ("FORCE_COLOR" in r || n.includes("--color") || t?.platform === "win32" || e && r.
  TERM !== "dumb" || "CI" in r) || typeof window < "u" && !!window.chrome;
}
o(sq, "C");
function lq(e = !1) {
  let t = sq(e), r = /* @__PURE__ */ o((s, l, c, u) => {
    let d = "", f = 0;
    do
      d += s.substring(f, u) + c, f = u + l.length, u = s.indexOf(l, f);
    while (~u);
    return d + s.substring(f);
  }, "i"), n = /* @__PURE__ */ o((s, l, c = s) => {
    let u = /* @__PURE__ */ o((d) => {
      let f = String(d), h = f.indexOf(l, s.length);
      return ~h ? s + r(f, l, c, h) + l : s + f + l;
    }, "o");
    return u.open = s, u.close = l, u;
  }, "g"), i = {
    isColorSupported: t
  }, a = /* @__PURE__ */ o((s) => `\x1B[${s}m`, "d");
  for (let [s, l] of Vz)
    i[s] = t ? n(
      a(l[0]),
      a(l[1]),
      l[2]
    ) : Nh;
  return i;
}
o(lq, "p");

// ../node_modules/tinyrainbow/dist/browser.js
var de = lq();

// ../node_modules/@vitest/pretty-format/dist/index.js
function Eq(e, t) {
  return t.forEach(function(r) {
    r && typeof r != "string" && !Array.isArray(r) && Object.keys(r).forEach(function(n) {
      if (n !== "default" && !(n in e)) {
        var i = Object.getOwnPropertyDescriptor(r, n);
        Object.defineProperty(e, n, i.get ? i : {
          enumerable: !0,
          get: /* @__PURE__ */ o(function() {
            return r[n];
          }, "get")
        });
      }
    });
  }), Object.freeze(e);
}
o(Eq, "_mergeNamespaces");
function zz(e, t) {
  let r = Object.keys(e), n = t === null ? r : r.sort(t);
  if (Object.getOwnPropertySymbols)
    for (let i of Object.getOwnPropertySymbols(e))
      Object.getOwnPropertyDescriptor(e, i).enumerable && n.push(i);
  return n;
}
o(zz, "getKeysOfEnumerableProperties");
function ao(e, t, r, n, i, a, s = ": ") {
  let l = "", c = 0, u = e.next();
  if (!u.done) {
    l += t.spacingOuter;
    let d = r + t.indent;
    for (; !u.done; ) {
      if (l += d, c++ === t.maxWidth) {
        l += "\u2026";
        break;
      }
      let f = a(u.value[0], t, d, n, i), h = a(u.value[1], t, d, n, i);
      l += f + s + h, u = e.next(), u.done ? t.min || (l += ",") : l += `,${t.spacingInner}`;
    }
    l += t.spacingOuter + r;
  }
  return l;
}
o(ao, "printIteratorEntries");
function $h(e, t, r, n, i, a) {
  let s = "", l = 0, c = e.next();
  if (!c.done) {
    s += t.spacingOuter;
    let u = r + t.indent;
    for (; !c.done; ) {
      if (s += u, l++ === t.maxWidth) {
        s += "\u2026";
        break;
      }
      s += a(c.value, t, u, n, i), c = e.next(), c.done ? t.min || (s += ",") : s += `,${t.spacingInner}`;
    }
    s += t.spacingOuter + r;
  }
  return s;
}
o($h, "printIteratorValues");
function Nl(e, t, r, n, i, a) {
  let s = "";
  e = e instanceof ArrayBuffer ? new DataView(e) : e;
  let l = /* @__PURE__ */ o((u) => u instanceof DataView, "isDataView"), c = l(e) ? e.byteLength : e.length;
  if (c > 0) {
    s += t.spacingOuter;
    let u = r + t.indent;
    for (let d = 0; d < c; d++) {
      if (s += u, d === t.maxWidth) {
        s += "\u2026";
        break;
      }
      (l(e) || d in e) && (s += a(l(e) ? e.getInt8(d) : e[d], t, u, n, i)), d < c - 1 ? s += `,${t.spacingInner}` : t.min || (s += ",");
    }
    s += t.spacingOuter + r;
  }
  return s;
}
o(Nl, "printListItems");
function Bh(e, t, r, n, i, a) {
  let s = "", l = zz(e, t.compareKeys);
  if (l.length > 0) {
    s += t.spacingOuter;
    let c = r + t.indent;
    for (let u = 0; u < l.length; u++) {
      let d = l[u], f = a(d, t, c, n, i), h = a(e[d], t, c, n, i);
      s += `${c + f}: ${h}`, u < l.length - 1 ? s += `,${t.spacingInner}` : t.min || (s += ",");
    }
    s += t.spacingOuter + r;
  }
  return s;
}
o(Bh, "printObjectProperties");
var Wz = typeof Symbol == "function" && Symbol.for ? Symbol.for("jest.asymmetricMatcher") : 1267621, Ml = " ", Gz = /* @__PURE__ */ o((e, t, r, n, i, a) => {
  let s = e.toString();
  if (s === "ArrayContaining" || s === "ArrayNotContaining")
    return ++n > t.maxDepth ? `[${s}]` : `${s + Ml}[${Nl(e.sample, t, r, n, i, a)}]`;
  if (s === "ObjectContaining" || s === "ObjectNotContaining")
    return ++n > t.maxDepth ? `[${s}]` : `${s + Ml}{${Bh(e.sample, t, r, n, i, a)}}`;
  if (s === "StringMatching" || s === "StringNotMatching" || s === "StringContaining" || s === "StringNotContaining")
    return s + Ml + a(e.sample, t, r, n, i);
  if (typeof e.toAsymmetricMatcher != "function")
    throw new TypeError(`Asymmetric matcher ${e.constructor.name} does not implement toAsymmetricMatcher()`);
  return e.toAsymmetricMatcher();
}, "serialize$5"), Kz = /* @__PURE__ */ o((e) => e && e.$$typeof === Wz, "test$5"), Yz = {
  serialize: Gz,
  test: Kz
}, Xz = " ", Cq = /* @__PURE__ */ new Set(["DOMStringMap", "NamedNodeMap"]), Jz = /^(?:HTML\w*Collection|NodeList)$/;
function Qz(e) {
  return Cq.has(e) || Jz.test(e);
}
o(Qz, "testName");
var Zz = /* @__PURE__ */ o((e) => e && e.constructor && !!e.constructor.name && Qz(e.constructor.name), "test$4");
function e4(e) {
  return e.constructor.name === "NamedNodeMap";
}
o(e4, "isNamedNodeMap");
var t4 = /* @__PURE__ */ o((e, t, r, n, i, a) => {
  let s = e.constructor.name;
  return ++n > t.maxDepth ? `[${s}]` : (t.min ? "" : s + Xz) + (Cq.has(s) ? `{${Bh(e4(e) ? [...e].reduce((l, c) => (l[c.name] = c.value, l),
  {}) : { ...e }, t, r, n, i, a)}}` : `[${Nl([...e], t, r, n, i, a)}]`);
}, "serialize$4"), r4 = {
  serialize: t4,
  test: Zz
};
function xq(e) {
  return e.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
o(xq, "escapeHTML");
function Dh(e, t, r, n, i, a, s) {
  let l = n + r.indent, c = r.colors;
  return e.map((u) => {
    let d = t[u], f = s(d, r, l, i, a);
    return typeof d != "string" && (f.includes(`
`) && (f = r.spacingOuter + l + f + r.spacingOuter + n), f = `{${f}}`), `${r.spacingInner + n + c.prop.open + u + c.prop.close}=${c.value.open}${f}${c.
    value.close}`;
  }).join("");
}
o(Dh, "printProps");
function Fh(e, t, r, n, i, a) {
  return e.map((s) => t.spacingOuter + r + (typeof s == "string" ? _q(s, t) : a(s, t, r, n, i))).join("");
}
o(Fh, "printChildren");
function _q(e, t) {
  let r = t.colors.content;
  return r.open + xq(e) + r.close;
}
o(_q, "printText");
function n4(e, t) {
  let r = t.colors.comment;
  return `${r.open}<!--${xq(e)}-->${r.close}`;
}
o(n4, "printComment");
function Uh(e, t, r, n, i) {
  let a = n.colors.tag;
  return `${a.open}<${e}${t && a.close + t + n.spacingOuter + i + a.open}${r ? `>${a.close}${r}${n.spacingOuter}${i}${a.open}</${e}` : `${t &&
  !n.min ? "" : " "}/`}>${a.close}`;
}
o(Uh, "printElement");
function Hh(e, t) {
  let r = t.colors.tag;
  return `${r.open}<${e}${r.close} \u2026${r.open} />${r.close}`;
}
o(Hh, "printElementAsLeaf");
var o4 = 1, Pq = 3, qq = 8, Rq = 11, i4 = /^(?:(?:HTML|SVG)\w*)?Element$/;
function a4(e) {
  try {
    return typeof e.hasAttribute == "function" && e.hasAttribute("is");
  } catch {
    return !1;
  }
}
o(a4, "testHasAttribute");
function s4(e) {
  let t = e.constructor.name, { nodeType: r, tagName: n } = e, i = typeof n == "string" && n.includes("-") || a4(e);
  return r === o4 && (i4.test(t) || i) || r === Pq && t === "Text" || r === qq && t === "Comment" || r === Rq && t === "DocumentFragment";
}
o(s4, "testNode");
var l4 = /* @__PURE__ */ o((e) => {
  var t;
  return (e == null || (t = e.constructor) === null || t === void 0 ? void 0 : t.name) && s4(e);
}, "test$3");
function u4(e) {
  return e.nodeType === Pq;
}
o(u4, "nodeIsText");
function c4(e) {
  return e.nodeType === qq;
}
o(c4, "nodeIsComment");
function Ih(e) {
  return e.nodeType === Rq;
}
o(Ih, "nodeIsFragment");
var d4 = /* @__PURE__ */ o((e, t, r, n, i, a) => {
  if (u4(e))
    return _q(e.data, t);
  if (c4(e))
    return n4(e.data, t);
  let s = Ih(e) ? "DocumentFragment" : e.tagName.toLowerCase();
  return ++n > t.maxDepth ? Hh(s, t) : Uh(s, Dh(Ih(e) ? [] : Array.from(e.attributes, (l) => l.name).sort(), Ih(e) ? {} : [...e.attributes].
  reduce((l, c) => (l[c.name] = c.value, l), {}), t, r + t.indent, n, i, a), Fh(Array.prototype.slice.call(e.childNodes || e.children), t, r +
  t.indent, n, i, a), t, r);
}, "serialize$3"), f4 = {
  serialize: d4,
  test: l4
}, p4 = "@@__IMMUTABLE_ITERABLE__@@", m4 = "@@__IMMUTABLE_LIST__@@", h4 = "@@__IMMUTABLE_KEYED__@@", b4 = "@@__IMMUTABLE_MAP__@@", uq = "@@_\
_IMMUTABLE_ORDERED__@@", y4 = "@@__IMMUTABLE_RECORD__@@", g4 = "@@__IMMUTABLE_SEQ__@@", v4 = "@@__IMMUTABLE_SET__@@", w4 = "@@__IMMUTABLE_ST\
ACK__@@", nn = /* @__PURE__ */ o((e) => `Immutable.${e}`, "getImmutableName"), jl = /* @__PURE__ */ o((e) => `[${e}]`, "printAsLeaf"), io = "\
 ", cq = "\u2026";
function E4(e, t, r, n, i, a, s) {
  return ++n > t.maxDepth ? jl(nn(s)) : `${nn(s) + io}{${ao(e.entries(), t, r, n, i, a)}}`;
}
o(E4, "printImmutableEntries");
function C4(e) {
  let t = 0;
  return { next() {
    if (t < e._keys.length) {
      let r = e._keys[t++];
      return {
        done: !1,
        value: [r, e.get(r)]
      };
    }
    return {
      done: !0,
      value: void 0
    };
  } };
}
o(C4, "getRecordEntries");
function x4(e, t, r, n, i, a) {
  let s = nn(e._name || "Record");
  return ++n > t.maxDepth ? jl(s) : `${s + io}{${ao(C4(e), t, r, n, i, a)}}`;
}
o(x4, "printImmutableRecord");
function _4(e, t, r, n, i, a) {
  let s = nn("Seq");
  return ++n > t.maxDepth ? jl(s) : e[h4] ? `${s + io}{${e._iter || e._object ? ao(e.entries(), t, r, n, i, a) : cq}}` : `${s + io}[${e._iter ||
  e._array || e._collection || e._iterable ? $h(e.values(), t, r, n, i, a) : cq}]`;
}
o(_4, "printImmutableSeq");
function jh(e, t, r, n, i, a, s) {
  return ++n > t.maxDepth ? jl(nn(s)) : `${nn(s) + io}[${$h(e.values(), t, r, n, i, a)}]`;
}
o(jh, "printImmutableValues");
var P4 = /* @__PURE__ */ o((e, t, r, n, i, a) => e[b4] ? E4(e, t, r, n, i, a, e[uq] ? "OrderedMap" : "Map") : e[m4] ? jh(e, t, r, n, i, a, "\
List") : e[v4] ? jh(e, t, r, n, i, a, e[uq] ? "OrderedSet" : "Set") : e[w4] ? jh(e, t, r, n, i, a, "Stack") : e[g4] ? _4(e, t, r, n, i, a) :
x4(e, t, r, n, i, a), "serialize$2"), q4 = /* @__PURE__ */ o((e) => e && (e[p4] === !0 || e[y4] === !0), "test$2"), R4 = {
  serialize: P4,
  test: q4
};
function Tq(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
o(Tq, "getDefaultExportFromCjs");
var kh = { exports: {} };
var ue = {};
var dq;
function T4() {
  return dq || (dq = 1, function() {
    function e(g) {
      if (typeof g == "object" && g !== null) {
        var x = g.$$typeof;
        switch (x) {
          case t:
            switch (g = g.type, g) {
              case n:
              case a:
              case i:
              case u:
              case d:
              case m:
                return g;
              default:
                switch (g = g && g.$$typeof, g) {
                  case l:
                  case c:
                  case h:
                  case f:
                    return g;
                  case s:
                    return g;
                  default:
                    return x;
                }
            }
          case r:
            return x;
        }
      }
    }
    o(e, "typeOf");
    var t = Symbol.for("react.transitional.element"), r = Symbol.for("react.portal"), n = Symbol.for("react.fragment"), i = Symbol.for("reac\
t.strict_mode"), a = Symbol.for("react.profiler"), s = Symbol.for("react.consumer"), l = Symbol.for("react.context"), c = Symbol.for("react.\
forward_ref"), u = Symbol.for("react.suspense"), d = Symbol.for("react.suspense_list"), f = Symbol.for("react.memo"), h = Symbol.for("react.\
lazy"), m = Symbol.for("react.view_transition"), y = Symbol.for("react.client.reference");
    ue.ContextConsumer = s, ue.ContextProvider = l, ue.Element = t, ue.ForwardRef = c, ue.Fragment = n, ue.Lazy = h, ue.Memo = f, ue.Portal =
    r, ue.Profiler = a, ue.StrictMode = i, ue.Suspense = u, ue.SuspenseList = d, ue.isContextConsumer = function(g) {
      return e(g) === s;
    }, ue.isContextProvider = function(g) {
      return e(g) === l;
    }, ue.isElement = function(g) {
      return typeof g == "object" && g !== null && g.$$typeof === t;
    }, ue.isForwardRef = function(g) {
      return e(g) === c;
    }, ue.isFragment = function(g) {
      return e(g) === n;
    }, ue.isLazy = function(g) {
      return e(g) === h;
    }, ue.isMemo = function(g) {
      return e(g) === f;
    }, ue.isPortal = function(g) {
      return e(g) === r;
    }, ue.isProfiler = function(g) {
      return e(g) === a;
    }, ue.isStrictMode = function(g) {
      return e(g) === i;
    }, ue.isSuspense = function(g) {
      return e(g) === u;
    }, ue.isSuspenseList = function(g) {
      return e(g) === d;
    }, ue.isValidElementType = function(g) {
      return typeof g == "string" || typeof g == "function" || g === n || g === a || g === i || g === u || g === d || typeof g == "object" &&
      g !== null && (g.$$typeof === h || g.$$typeof === f || g.$$typeof === l || g.$$typeof === s || g.$$typeof === c || g.$$typeof === y ||
      g.getModuleId !== void 0);
    }, ue.typeOf = e;
  }()), ue;
}
o(T4, "requireReactIs_development$1");
var fq;
function O4() {
  return fq || (fq = 1, kh.exports = T4()), kh.exports;
}
o(O4, "requireReactIs$1");
var Oq = O4(), S4 = /* @__PURE__ */ Tq(Oq), M4 = /* @__PURE__ */ Eq({
  __proto__: null,
  default: S4
}, [Oq]), Lh = { exports: {} };
var ae = {};
var pq;
function A4() {
  return pq || (pq = 1, function() {
    var e = Symbol.for("react.element"), t = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), n = Symbol.for("react.strict_mode"),
    i = Symbol.for("react.profiler"), a = Symbol.for("react.provider"), s = Symbol.for("react.context"), l = Symbol.for("react.server_contex\
t"), c = Symbol.for("react.forward_ref"), u = Symbol.for("react.suspense"), d = Symbol.for("react.suspense_list"), f = Symbol.for("react.mem\
o"), h = Symbol.for("react.lazy"), m = Symbol.for("react.offscreen"), y = !1, g = !1, x = !1, b = !1, E = !1, q;
    q = Symbol.for("react.module.reference");
    function C(N) {
      return !!(typeof N == "string" || typeof N == "function" || N === r || N === i || E || N === n || N === u || N === d || b || N === m ||
      y || g || x || typeof N == "object" && N !== null && (N.$$typeof === h || N.$$typeof === f || N.$$typeof === a || N.$$typeof === s || N.
      $$typeof === c || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      N.$$typeof === q || N.getModuleId !== void 0));
    }
    o(C, "isValidElementType");
    function P(N) {
      if (typeof N == "object" && N !== null) {
        var dr = N.$$typeof;
        switch (dr) {
          case e:
            var Ct = N.type;
            switch (Ct) {
              case r:
              case i:
              case n:
              case u:
              case d:
                return Ct;
              default:
                var Tn = Ct && Ct.$$typeof;
                switch (Tn) {
                  case l:
                  case s:
                  case c:
                  case h:
                  case f:
                  case a:
                    return Tn;
                  default:
                    return dr;
                }
            }
          case t:
            return dr;
        }
      }
    }
    o(P, "typeOf");
    var O = s, R = a, A = e, j = c, J = r, S = h, G = f, ne = t, B = i, H = n, $ = u, W = d, V = !1, ee = !1;
    function pe(N) {
      return V || (V = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    o(pe, "isAsyncMode");
    function Ce(N) {
      return ee || (ee = !0, console.warn("The ReactIs.isConcurrentMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    o(Ce, "isConcurrentMode");
    function I(N) {
      return P(N) === s;
    }
    o(I, "isContextConsumer");
    function M(N) {
      return P(N) === a;
    }
    o(M, "isContextProvider");
    function F(N) {
      return typeof N == "object" && N !== null && N.$$typeof === e;
    }
    o(F, "isElement");
    function U(N) {
      return P(N) === c;
    }
    o(U, "isForwardRef");
    function K(N) {
      return P(N) === r;
    }
    o(K, "isFragment");
    function se(N) {
      return P(N) === h;
    }
    o(se, "isLazy");
    function ge(N) {
      return P(N) === f;
    }
    o(ge, "isMemo");
    function Re(N) {
      return P(N) === t;
    }
    o(Re, "isPortal");
    function cr(N) {
      return P(N) === i;
    }
    o(cr, "isProfiler");
    function kr(N) {
      return P(N) === n;
    }
    o(kr, "isStrictMode");
    function Lr(N) {
      return P(N) === u;
    }
    o(Lr, "isSuspense");
    function Jf(N) {
      return P(N) === d;
    }
    o(Jf, "isSuspenseList"), ae.ContextConsumer = O, ae.ContextProvider = R, ae.Element = A, ae.ForwardRef = j, ae.Fragment = J, ae.Lazy = S,
    ae.Memo = G, ae.Portal = ne, ae.Profiler = B, ae.StrictMode = H, ae.Suspense = $, ae.SuspenseList = W, ae.isAsyncMode = pe, ae.isConcurrentMode =
    Ce, ae.isContextConsumer = I, ae.isContextProvider = M, ae.isElement = F, ae.isForwardRef = U, ae.isFragment = K, ae.isLazy = se, ae.isMemo =
    ge, ae.isPortal = Re, ae.isProfiler = cr, ae.isStrictMode = kr, ae.isSuspense = Lr, ae.isSuspenseList = Jf, ae.isValidElementType = C, ae.
    typeOf = P;
  }()), ae;
}
o(A4, "requireReactIs_development");
var mq;
function N4() {
  return mq || (mq = 1, Lh.exports = A4()), Lh.exports;
}
o(N4, "requireReactIs");
var Sq = N4(), I4 = /* @__PURE__ */ Tq(Sq), j4 = /* @__PURE__ */ Eq({
  __proto__: null,
  default: I4
}, [Sq]), k4 = [
  "isAsyncMode",
  "isConcurrentMode",
  "isContextConsumer",
  "isContextProvider",
  "isElement",
  "isForwardRef",
  "isFragment",
  "isLazy",
  "isMemo",
  "isPortal",
  "isProfiler",
  "isStrictMode",
  "isSuspense",
  "isSuspenseList",
  "isValidElementType"
], yr = Object.fromEntries(k4.map((e) => [e, (t) => j4[e](t) || M4[e](t)]));
function Mq(e, t = []) {
  if (Array.isArray(e))
    for (let r of e)
      Mq(r, t);
  else e != null && e !== !1 && e !== "" && t.push(e);
  return t;
}
o(Mq, "getChildren");
function hq(e) {
  let t = e.type;
  if (typeof t == "string")
    return t;
  if (typeof t == "function")
    return t.displayName || t.name || "Unknown";
  if (yr.isFragment(e))
    return "React.Fragment";
  if (yr.isSuspense(e))
    return "React.Suspense";
  if (typeof t == "object" && t !== null) {
    if (yr.isContextProvider(e))
      return "Context.Provider";
    if (yr.isContextConsumer(e))
      return "Context.Consumer";
    if (yr.isForwardRef(e)) {
      if (t.displayName)
        return t.displayName;
      let r = t.render.displayName || t.render.name || "";
      return r === "" ? "ForwardRef" : `ForwardRef(${r})`;
    }
    if (yr.isMemo(e)) {
      let r = t.displayName || t.type.displayName || t.type.name || "";
      return r === "" ? "Memo" : `Memo(${r})`;
    }
  }
  return "UNDEFINED";
}
o(hq, "getType");
function L4(e) {
  let { props: t } = e;
  return Object.keys(t).filter((r) => r !== "children" && t[r] !== void 0).sort();
}
o(L4, "getPropKeys$1");
var $4 = /* @__PURE__ */ o((e, t, r, n, i, a) => ++n > t.maxDepth ? Hh(hq(e), t) : Uh(hq(e), Dh(L4(e), e.props, t, r + t.indent, n, i, a), Fh(
Mq(e.props.children), t, r + t.indent, n, i, a), t, r), "serialize$1"), B4 = /* @__PURE__ */ o((e) => e != null && yr.isElement(e), "test$1"),
D4 = {
  serialize: $4,
  test: B4
}, F4 = typeof Symbol == "function" && Symbol.for ? Symbol.for("react.test.json") : 245830487;
function U4(e) {
  let { props: t } = e;
  return t ? Object.keys(t).filter((r) => t[r] !== void 0).sort() : [];
}
o(U4, "getPropKeys");
var H4 = /* @__PURE__ */ o((e, t, r, n, i, a) => ++n > t.maxDepth ? Hh(e.type, t) : Uh(e.type, e.props ? Dh(U4(e), e.props, t, r + t.indent,
n, i, a) : "", e.children ? Fh(e.children, t, r + t.indent, n, i, a) : "", t, r), "serialize"), V4 = /* @__PURE__ */ o((e) => e && e.$$typeof ===
F4, "test"), z4 = {
  serialize: H4,
  test: V4
}, Aq = Object.prototype.toString, W4 = Date.prototype.toISOString, G4 = Error.prototype.toString, bq = RegExp.prototype.toString;
function Al(e) {
  return typeof e.constructor == "function" && e.constructor.name || "Object";
}
o(Al, "getConstructorName");
function K4(e) {
  return typeof window < "u" && e === window;
}
o(K4, "isWindow");
var Y4 = /^Symbol\((.*)\)(.*)$/, X4 = /\n/g, zh = class zh extends Error {
  constructor(t, r) {
    super(t), this.stack = r, this.name = this.constructor.name;
  }
};
o(zh, "PrettyFormatPluginError");
var Il = zh;
function J4(e) {
  return e === "[object Array]" || e === "[object ArrayBuffer]" || e === "[object DataView]" || e === "[object Float32Array]" || e === "[obj\
ect Float64Array]" || e === "[object Int8Array]" || e === "[object Int16Array]" || e === "[object Int32Array]" || e === "[object Uint8Array]" ||
  e === "[object Uint8ClampedArray]" || e === "[object Uint16Array]" || e === "[object Uint32Array]";
}
o(J4, "isToStringedArrayType");
function Q4(e) {
  return Object.is(e, -0) ? "-0" : String(e);
}
o(Q4, "printNumber");
function Z4(e) {
  return `${e}n`;
}
o(Z4, "printBigInt");
function yq(e, t) {
  return t ? `[Function ${e.name || "anonymous"}]` : "[Function]";
}
o(yq, "printFunction");
function gq(e) {
  return String(e).replace(Y4, "Symbol($1)");
}
o(gq, "printSymbol");
function vq(e) {
  return `[${G4.call(e)}]`;
}
o(vq, "printError");
function Nq(e, t, r, n) {
  if (e === !0 || e === !1)
    return `${e}`;
  if (e === void 0)
    return "undefined";
  if (e === null)
    return "null";
  let i = typeof e;
  if (i === "number")
    return Q4(e);
  if (i === "bigint")
    return Z4(e);
  if (i === "string")
    return n ? `"${e.replaceAll(/"|\\/g, "\\$&")}"` : `"${e}"`;
  if (i === "function")
    return yq(e, t);
  if (i === "symbol")
    return gq(e);
  let a = Aq.call(e);
  return a === "[object WeakMap]" ? "WeakMap {}" : a === "[object WeakSet]" ? "WeakSet {}" : a === "[object Function]" || a === "[object Gen\
eratorFunction]" ? yq(e, t) : a === "[object Symbol]" ? gq(e) : a === "[object Date]" ? Number.isNaN(+e) ? "Date { NaN }" : W4.call(e) : a ===
  "[object Error]" ? vq(e) : a === "[object RegExp]" ? r ? bq.call(e).replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&") : bq.call(e) : e instanceof Error ?
  vq(e) : null;
}
o(Nq, "printBasicValue");
function Iq(e, t, r, n, i, a) {
  if (i.includes(e))
    return "[Circular]";
  i = [...i], i.push(e);
  let s = ++n > t.maxDepth, l = t.min;
  if (t.callToJSON && !s && e.toJSON && typeof e.toJSON == "function" && !a)
    return Ft(e.toJSON(), t, r, n, i, !0);
  let c = Aq.call(e);
  return c === "[object Arguments]" ? s ? "[Arguments]" : `${l ? "" : "Arguments "}[${Nl(e, t, r, n, i, Ft)}]` : J4(c) ? s ? `[${e.constructor.
  name}]` : `${l || !t.printBasicPrototype && e.constructor.name === "Array" ? "" : `${e.constructor.name} `}[${Nl(e, t, r, n, i, Ft)}]` : c ===
  "[object Map]" ? s ? "[Map]" : `Map {${ao(e.entries(), t, r, n, i, Ft, " => ")}}` : c === "[object Set]" ? s ? "[Set]" : `Set {${$h(e.values(),
  t, r, n, i, Ft)}}` : s || K4(e) ? `[${Al(e)}]` : `${l || !t.printBasicPrototype && Al(e) === "Object" ? "" : `${Al(e)} `}{${Bh(e, t, r, n,
  i, Ft)}}`;
}
o(Iq, "printComplexValue");
var e6 = {
  test: /* @__PURE__ */ o((e) => e && e instanceof Error, "test"),
  serialize(e, t, r, n, i, a) {
    if (i.includes(e))
      return "[Circular]";
    i = [...i, e];
    let s = ++n > t.maxDepth, { message: l, cause: c, ...u } = e, d = {
      message: l,
      ...typeof c < "u" ? { cause: c } : {},
      ...e instanceof AggregateError ? { errors: e.errors } : {},
      ...u
    }, f = e.name !== "Error" ? e.name : Al(e);
    return s ? `[${f}]` : `${f} {${ao(Object.entries(d).values(), t, r, n, i, a)}}`;
  }
};
function t6(e) {
  return e.serialize != null;
}
o(t6, "isNewPlugin");
function jq(e, t, r, n, i, a) {
  let s;
  try {
    s = t6(e) ? e.serialize(t, r, n, i, a, Ft) : e.print(t, (l) => Ft(l, r, n, i, a), (l) => {
      let c = n + r.indent;
      return c + l.replaceAll(X4, `
${c}`);
    }, {
      edgeSpacing: r.spacingOuter,
      min: r.min,
      spacing: r.spacingInner
    }, r.colors);
  } catch (l) {
    throw new Il(l.message, l.stack);
  }
  if (typeof s != "string")
    throw new TypeError(`pretty-format: Plugin must return type "string" but instead returned "${typeof s}".`);
  return s;
}
o(jq, "printPlugin");
function kq(e, t) {
  for (let r of e)
    try {
      if (r.test(t))
        return r;
    } catch (n) {
      throw new Il(n.message, n.stack);
    }
  return null;
}
o(kq, "findPlugin");
function Ft(e, t, r, n, i, a) {
  let s = kq(t.plugins, e);
  if (s !== null)
    return jq(s, e, t, r, n, i);
  let l = Nq(e, t.printFunctionName, t.escapeRegex, t.escapeString);
  return l !== null ? l : Iq(e, t, r, n, i, a);
}
o(Ft, "printer");
var Vh = {
  comment: "gray",
  content: "reset",
  prop: "yellow",
  tag: "cyan",
  value: "green"
}, Lq = Object.keys(Vh), st = {
  callToJSON: !0,
  compareKeys: void 0,
  escapeRegex: !1,
  escapeString: !0,
  highlight: !1,
  indent: 2,
  maxDepth: Number.POSITIVE_INFINITY,
  maxWidth: Number.POSITIVE_INFINITY,
  min: !1,
  plugins: [],
  printBasicPrototype: !0,
  printFunctionName: !0,
  theme: Vh
};
function r6(e) {
  for (let t of Object.keys(e))
    if (!Object.prototype.hasOwnProperty.call(st, t))
      throw new Error(`pretty-format: Unknown option "${t}".`);
  if (e.min && e.indent !== void 0 && e.indent !== 0)
    throw new Error('pretty-format: Options "min" and "indent" cannot be used together.');
}
o(r6, "validateOptions");
function n6() {
  return Lq.reduce((e, t) => {
    let r = Vh[t], n = r && de[r];
    if (n && typeof n.close == "string" && typeof n.open == "string")
      e[t] = n;
    else
      throw new Error(`pretty-format: Option "theme" has a key "${t}" whose value "${r}" is undefined in ansi-styles.`);
    return e;
  }, /* @__PURE__ */ Object.create(null));
}
o(n6, "getColorsHighlight");
function o6() {
  return Lq.reduce((e, t) => (e[t] = {
    close: "",
    open: ""
  }, e), /* @__PURE__ */ Object.create(null));
}
o(o6, "getColorsEmpty");
function $q(e) {
  return e?.printFunctionName ?? st.printFunctionName;
}
o($q, "getPrintFunctionName");
function Bq(e) {
  return e?.escapeRegex ?? st.escapeRegex;
}
o(Bq, "getEscapeRegex");
function Dq(e) {
  return e?.escapeString ?? st.escapeString;
}
o(Dq, "getEscapeString");
function wq(e) {
  return {
    callToJSON: e?.callToJSON ?? st.callToJSON,
    colors: e?.highlight ? n6() : o6(),
    compareKeys: typeof e?.compareKeys == "function" || e?.compareKeys === null ? e.compareKeys : st.compareKeys,
    escapeRegex: Bq(e),
    escapeString: Dq(e),
    indent: e?.min ? "" : i6(e?.indent ?? st.indent),
    maxDepth: e?.maxDepth ?? st.maxDepth,
    maxWidth: e?.maxWidth ?? st.maxWidth,
    min: e?.min ?? st.min,
    plugins: e?.plugins ?? st.plugins,
    printBasicPrototype: e?.printBasicPrototype ?? !0,
    printFunctionName: $q(e),
    spacingInner: e?.min ? " " : `
`,
    spacingOuter: e?.min ? "" : `
`
  };
}
o(wq, "getConfig");
function i6(e) {
  return Array.from({ length: e + 1 }).join(" ");
}
o(i6, "createIndent");
function tt(e, t) {
  if (t && (r6(t), t.plugins)) {
    let n = kq(t.plugins, e);
    if (n !== null)
      return jq(n, e, wq(t), "", 0, []);
  }
  let r = Nq(e, $q(t), Bq(t), Dq(t));
  return r !== null ? r : Iq(e, wq(t), "", 0, []);
}
o(tt, "format");
var so = {
  AsymmetricMatcher: Yz,
  DOMCollection: r4,
  DOMElement: f4,
  Immutable: R4,
  ReactElement: D4,
  ReactTestComponent: z4,
  Error: e6
};

// ../node_modules/loupe/lib/helpers.js
var Fq = {
  bold: ["1", "22"],
  dim: ["2", "22"],
  italic: ["3", "23"],
  underline: ["4", "24"],
  // 5 & 6 are blinking
  inverse: ["7", "27"],
  hidden: ["8", "28"],
  strike: ["9", "29"],
  // 10-20 are fonts
  // 21-29 are resets for 1-9
  black: ["30", "39"],
  red: ["31", "39"],
  green: ["32", "39"],
  yellow: ["33", "39"],
  blue: ["34", "39"],
  magenta: ["35", "39"],
  cyan: ["36", "39"],
  white: ["37", "39"],
  brightblack: ["30;1", "39"],
  brightred: ["31;1", "39"],
  brightgreen: ["32;1", "39"],
  brightyellow: ["33;1", "39"],
  brightblue: ["34;1", "39"],
  brightmagenta: ["35;1", "39"],
  brightcyan: ["36;1", "39"],
  brightwhite: ["37;1", "39"],
  grey: ["90", "39"]
}, a6 = {
  special: "cyan",
  number: "yellow",
  bigint: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  symbol: "green",
  date: "magenta",
  regexp: "red"
}, _t = "\u2026";
function s6(e, t) {
  let r = Fq[a6[t]] || Fq[t] || "";
  return r ? `\x1B[${r[0]}m${String(e)}\x1B[${r[1]}m` : String(e);
}
o(s6, "colorise");
function Uq({
  showHidden: e = !1,
  depth: t = 2,
  colors: r = !1,
  customInspect: n = !0,
  showProxy: i = !1,
  maxArrayLength: a = 1 / 0,
  breakLength: s = 1 / 0,
  seen: l = [],
  // eslint-disable-next-line no-shadow
  truncate: c = 1 / 0,
  stylize: u = String
} = {}, d) {
  let f = {
    showHidden: !!e,
    depth: Number(t),
    colors: !!r,
    customInspect: !!n,
    showProxy: !!i,
    maxArrayLength: Number(a),
    breakLength: Number(s),
    truncate: Number(c),
    seen: l,
    inspect: d,
    stylize: u
  };
  return f.colors && (f.stylize = s6), f;
}
o(Uq, "normaliseOptions");
function l6(e) {
  return e >= "\uD800" && e <= "\uDBFF";
}
o(l6, "isHighSurrogate");
function je(e, t, r = _t) {
  e = String(e);
  let n = r.length, i = e.length;
  if (n > t && i > n)
    return r;
  if (i > t && i > n) {
    let a = t - n;
    return a > 0 && l6(e[a - 1]) && (a = a - 1), `${e.slice(0, a)}${r}`;
  }
  return e;
}
o(je, "truncate");
function _e(e, t, r, n = ", ") {
  r = r || t.inspect;
  let i = e.length;
  if (i === 0)
    return "";
  let a = t.truncate, s = "", l = "", c = "";
  for (let u = 0; u < i; u += 1) {
    let d = u + 1 === e.length, f = u + 2 === e.length;
    c = `${_t}(${e.length - u})`;
    let h = e[u];
    t.truncate = a - s.length - (d ? 0 : n.length);
    let m = l || r(h, t) + (d ? "" : n), y = s.length + m.length, g = y + c.length;
    if (d && y > a && s.length + c.length <= a || !d && !f && g > a || (l = d ? "" : r(e[u + 1], t) + (f ? "" : n), !d && f && g > a && y + l.
    length > a))
      break;
    if (s += m, !d && !f && y + l.length >= a) {
      c = `${_t}(${e.length - u - 1})`;
      break;
    }
    c = "";
  }
  return `${s}${c}`;
}
o(_e, "inspectList");
function u6(e) {
  return e.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? e : JSON.stringify(e).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
}
o(u6, "quoteComplexKey");
function Pt([e, t], r) {
  return r.truncate -= 2, typeof e == "string" ? e = u6(e) : typeof e != "number" && (e = `[${r.inspect(e, r)}]`), r.truncate -= e.length, t =
  r.inspect(t, r), `${e}: ${t}`;
}
o(Pt, "inspectProperty");

// ../node_modules/loupe/lib/array.js
function Wh(e, t) {
  let r = Object.keys(e).slice(e.length);
  if (!e.length && !r.length)
    return "[]";
  t.truncate -= 4;
  let n = _e(e, t);
  t.truncate -= n.length;
  let i = "";
  return r.length && (i = _e(r.map((a) => [a, e[a]]), t, Pt)), `[ ${n}${i ? `, ${i}` : ""} ]`;
}
o(Wh, "inspectArray");

// ../node_modules/loupe/lib/typedarray.js
var c6 = /* @__PURE__ */ o((e) => typeof Buffer == "function" && e instanceof Buffer ? "Buffer" : e[Symbol.toStringTag] ? e[Symbol.toStringTag] :
e.constructor.name, "getArrayName");
function lt(e, t) {
  let r = c6(e);
  t.truncate -= r.length + 4;
  let n = Object.keys(e).slice(e.length);
  if (!e.length && !n.length)
    return `${r}[]`;
  let i = "";
  for (let s = 0; s < e.length; s++) {
    let l = `${t.stylize(je(e[s], t.truncate), "number")}${s === e.length - 1 ? "" : ", "}`;
    if (t.truncate -= l.length, e[s] !== e.length && t.truncate <= 3) {
      i += `${_t}(${e.length - e[s] + 1})`;
      break;
    }
    i += l;
  }
  let a = "";
  return n.length && (a = _e(n.map((s) => [s, e[s]]), t, Pt)), `${r}[ ${i}${a ? `, ${a}` : ""} ]`;
}
o(lt, "inspectTypedArray");

// ../node_modules/loupe/lib/date.js
function Gh(e, t) {
  let r = e.toJSON();
  if (r === null)
    return "Invalid Date";
  let n = r.split("T"), i = n[0];
  return t.stylize(`${i}T${je(n[1], t.truncate - i.length - 1)}`, "date");
}
o(Gh, "inspectDate");

// ../node_modules/loupe/lib/function.js
function kl(e, t) {
  let r = e[Symbol.toStringTag] || "Function", n = e.name;
  return n ? t.stylize(`[${r} ${je(n, t.truncate - 11)}]`, "special") : t.stylize(`[${r}]`, "special");
}
o(kl, "inspectFunction");

// ../node_modules/loupe/lib/map.js
function d6([e, t], r) {
  return r.truncate -= 4, e = r.inspect(e, r), r.truncate -= e.length, t = r.inspect(t, r), `${e} => ${t}`;
}
o(d6, "inspectMapEntry");
function f6(e) {
  let t = [];
  return e.forEach((r, n) => {
    t.push([n, r]);
  }), t;
}
o(f6, "mapToEntries");
function Kh(e, t) {
  return e.size === 0 ? "Map{}" : (t.truncate -= 7, `Map{ ${_e(f6(e), t, d6)} }`);
}
o(Kh, "inspectMap");

// ../node_modules/loupe/lib/number.js
var p6 = Number.isNaN || ((e) => e !== e);
function Ll(e, t) {
  return p6(e) ? t.stylize("NaN", "number") : e === 1 / 0 ? t.stylize("Infinity", "number") : e === -1 / 0 ? t.stylize("-Infinity", "number") :
  e === 0 ? t.stylize(1 / e === 1 / 0 ? "+0" : "-0", "number") : t.stylize(je(String(e), t.truncate), "number");
}
o(Ll, "inspectNumber");

// ../node_modules/loupe/lib/bigint.js
function $l(e, t) {
  let r = je(e.toString(), t.truncate - 1);
  return r !== _t && (r += "n"), t.stylize(r, "bigint");
}
o($l, "inspectBigInt");

// ../node_modules/loupe/lib/regexp.js
function Yh(e, t) {
  let r = e.toString().split("/")[2], n = t.truncate - (2 + r.length), i = e.source;
  return t.stylize(`/${je(i, n)}/${r}`, "regexp");
}
o(Yh, "inspectRegExp");

// ../node_modules/loupe/lib/set.js
function m6(e) {
  let t = [];
  return e.forEach((r) => {
    t.push(r);
  }), t;
}
o(m6, "arrayFromSet");
function Xh(e, t) {
  return e.size === 0 ? "Set{}" : (t.truncate -= 7, `Set{ ${_e(m6(e), t)} }`);
}
o(Xh, "inspectSet");

// ../node_modules/loupe/lib/string.js
var Hq = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\u\
ffff]", "g"), h6 = {
  "\b": "\\b",
  "	": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "'": "\\'",
  "\\": "\\\\"
}, b6 = 16, y6 = 4;
function g6(e) {
  return h6[e] || `\\u${`0000${e.charCodeAt(0).toString(b6)}`.slice(-y6)}`;
}
o(g6, "escape");
function Bl(e, t) {
  return Hq.test(e) && (e = e.replace(Hq, g6)), t.stylize(`'${je(e, t.truncate - 2)}'`, "string");
}
o(Bl, "inspectString");

// ../node_modules/loupe/lib/symbol.js
function Dl(e) {
  return "description" in Symbol.prototype ? e.description ? `Symbol(${e.description})` : "Symbol()" : e.toString();
}
o(Dl, "inspectSymbol");

// ../node_modules/loupe/lib/promise.js
var Vq = /* @__PURE__ */ o(() => "Promise{\u2026}", "getPromiseValue");
try {
  let { getPromiseDetails: e, kPending: t, kRejected: r } = process.binding("util");
  Array.isArray(e(Promise.resolve())) && (Vq = /* @__PURE__ */ o((n, i) => {
    let [a, s] = e(n);
    return a === t ? "Promise{<pending>}" : `Promise${a === r ? "!" : ""}{${i.inspect(s, i)}}`;
  }, "getPromiseValue"));
} catch {
}
var zq = Vq;

// ../node_modules/loupe/lib/object.js
function gr(e, t) {
  let r = Object.getOwnPropertyNames(e), n = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(e) : [];
  if (r.length === 0 && n.length === 0)
    return "{}";
  if (t.truncate -= 4, t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let i = _e(r.map((l) => [l, e[l]]), t, Pt), a = _e(n.map((l) => [l, e[l]]), t, Pt);
  t.seen.pop();
  let s = "";
  return i && a && (s = ", "), `{ ${i}${s}${a} }`;
}
o(gr, "inspectObject");

// ../node_modules/loupe/lib/class.js
var Jh = typeof Symbol < "u" && Symbol.toStringTag ? Symbol.toStringTag : !1;
function Qh(e, t) {
  let r = "";
  return Jh && Jh in e && (r = e[Jh]), r = r || e.constructor.name, (!r || r === "_class") && (r = "<Anonymous Class>"), t.truncate -= r.length,
  `${r}${gr(e, t)}`;
}
o(Qh, "inspectClass");

// ../node_modules/loupe/lib/arguments.js
function Zh(e, t) {
  return e.length === 0 ? "Arguments[]" : (t.truncate -= 13, `Arguments[ ${_e(e, t)} ]`);
}
o(Zh, "inspectArguments");

// ../node_modules/loupe/lib/error.js
var v6 = [
  "stack",
  "line",
  "column",
  "name",
  "message",
  "fileName",
  "lineNumber",
  "columnNumber",
  "number",
  "description",
  "cause"
];
function eb(e, t) {
  let r = Object.getOwnPropertyNames(e).filter((s) => v6.indexOf(s) === -1), n = e.name;
  t.truncate -= n.length;
  let i = "";
  if (typeof e.message == "string" ? i = je(e.message, t.truncate) : r.unshift("message"), i = i ? `: ${i}` : "", t.truncate -= i.length + 5,
  t.seen = t.seen || [], t.seen.includes(e))
    return "[Circular]";
  t.seen.push(e);
  let a = _e(r.map((s) => [s, e[s]]), t, Pt);
  return `${n}${i}${a ? ` { ${a} }` : ""}`;
}
o(eb, "inspectObject");

// ../node_modules/loupe/lib/html.js
function w6([e, t], r) {
  return r.truncate -= 3, t ? `${r.stylize(String(e), "yellow")}=${r.stylize(`"${t}"`, "string")}` : `${r.stylize(String(e), "yellow")}`;
}
o(w6, "inspectAttribute");
function Fl(e, t) {
  return _e(e, t, E6, `
`);
}
o(Fl, "inspectNodeCollection");
function E6(e, t) {
  switch (e.nodeType) {
    case 1:
      return Ul(e, t);
    case 3:
      return t.inspect(e.data, t);
    default:
      return t.inspect(e, t);
  }
}
o(E6, "inspectNode");
function Ul(e, t) {
  let r = e.getAttributeNames(), n = e.tagName.toLowerCase(), i = t.stylize(`<${n}`, "special"), a = t.stylize(">", "special"), s = t.stylize(
  `</${n}>`, "special");
  t.truncate -= n.length * 2 + 5;
  let l = "";
  r.length > 0 && (l += " ", l += _e(r.map((d) => [d, e.getAttribute(d)]), t, w6, " ")), t.truncate -= l.length;
  let c = t.truncate, u = Fl(e.children, t);
  return u && u.length > c && (u = `${_t}(${e.children.length})`), `${i}${l}${a}${u}${s}`;
}
o(Ul, "inspectHTML");

// ../node_modules/loupe/lib/index.js
var C6 = typeof Symbol == "function" && typeof Symbol.for == "function", tb = C6 ? Symbol.for("chai/inspect") : "@@chai/inspect", rb = Symbol.
for("nodejs.util.inspect.custom"), Wq = /* @__PURE__ */ new WeakMap(), Gq = {}, Kq = {
  undefined: /* @__PURE__ */ o((e, t) => t.stylize("undefined", "undefined"), "undefined"),
  null: /* @__PURE__ */ o((e, t) => t.stylize("null", "null"), "null"),
  boolean: /* @__PURE__ */ o((e, t) => t.stylize(String(e), "boolean"), "boolean"),
  Boolean: /* @__PURE__ */ o((e, t) => t.stylize(String(e), "boolean"), "Boolean"),
  number: Ll,
  Number: Ll,
  bigint: $l,
  BigInt: $l,
  string: Bl,
  String: Bl,
  function: kl,
  Function: kl,
  symbol: Dl,
  // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
  Symbol: Dl,
  Array: Wh,
  Date: Gh,
  Map: Kh,
  Set: Xh,
  RegExp: Yh,
  Promise: zq,
  // WeakSet, WeakMap are totally opaque to us
  WeakSet: /* @__PURE__ */ o((e, t) => t.stylize("WeakSet{\u2026}", "special"), "WeakSet"),
  WeakMap: /* @__PURE__ */ o((e, t) => t.stylize("WeakMap{\u2026}", "special"), "WeakMap"),
  Arguments: Zh,
  Int8Array: lt,
  Uint8Array: lt,
  Uint8ClampedArray: lt,
  Int16Array: lt,
  Uint16Array: lt,
  Int32Array: lt,
  Uint32Array: lt,
  Float32Array: lt,
  Float64Array: lt,
  Generator: /* @__PURE__ */ o(() => "", "Generator"),
  DataView: /* @__PURE__ */ o(() => "", "DataView"),
  ArrayBuffer: /* @__PURE__ */ o(() => "", "ArrayBuffer"),
  Error: eb,
  HTMLCollection: Fl,
  NodeList: Fl
}, x6 = /* @__PURE__ */ o((e, t, r) => tb in e && typeof e[tb] == "function" ? e[tb](t) : rb in e && typeof e[rb] == "function" ? e[rb](t.depth,
t) : "inspect" in e && typeof e.inspect == "function" ? e.inspect(t.depth, t) : "constructor" in e && Wq.has(e.constructor) ? Wq.get(e.constructor)(
e, t) : Gq[r] ? Gq[r](e, t) : "", "inspectCustom"), _6 = Object.prototype.toString;
function Hl(e, t = {}) {
  let r = Uq(t, Hl), { customInspect: n } = r, i = e === null ? "null" : typeof e;
  if (i === "object" && (i = _6.call(e).slice(8, -1)), i in Kq)
    return Kq[i](e, r);
  if (n && e) {
    let s = x6(e, r, i);
    if (s)
      return typeof s == "string" ? s : Hl(s, r);
  }
  let a = e ? Object.getPrototypeOf(e) : !1;
  return a === Object.prototype || a === null ? gr(e, r) : e && typeof HTMLElement == "function" && e instanceof HTMLElement ? Ul(e, r) : "c\
onstructor" in e ? e.constructor !== Object ? Qh(e, r) : gr(e, r) : e === Object(e) ? gr(e, r) : r.stylize(String(e), i);
}
o(Hl, "inspect");

// ../node_modules/@vitest/utils/dist/chunk-_commonjsHelpers.js
var { AsymmetricMatcher: q6, DOMCollection: R6, DOMElement: T6, Immutable: O6, ReactElement: S6, ReactTestComponent: M6 } = so, Yq = [
  M6,
  S6,
  T6,
  R6,
  O6,
  q6
];
function Ae(e, t = 10, { maxLength: r, ...n } = {}) {
  let i = r ?? 1e4, a;
  try {
    a = tt(e, {
      maxDepth: t,
      escapeString: !1,
      plugins: Yq,
      ...n
    });
  } catch {
    a = tt(e, {
      callToJSON: !1,
      maxDepth: t,
      escapeString: !1,
      plugins: Yq,
      ...n
    });
  }
  return a.length >= i && t > 1 ? Ae(e, Math.floor(Math.min(t, Number.MAX_SAFE_INTEGER) / 2), {
    maxLength: r,
    ...n
  }) : a;
}
o(Ae, "stringify");
var A6 = /%[sdjifoOc%]/g;
function nb(...e) {
  if (typeof e[0] != "string") {
    let a = [];
    for (let s = 0; s < e.length; s++)
      a.push(on(e[s], {
        depth: 0,
        colors: !1
      }));
    return a.join(" ");
  }
  let t = e.length, r = 1, n = e[0], i = String(n).replace(A6, (a) => {
    if (a === "%%")
      return "%";
    if (r >= t)
      return a;
    switch (a) {
      case "%s": {
        let s = e[r++];
        return typeof s == "bigint" ? `${s.toString()}n` : typeof s == "number" && s === 0 && 1 / s < 0 ? "-0" : typeof s == "object" && s !==
        null ? typeof s.toString == "function" && s.toString !== Object.prototype.toString ? s.toString() : on(s, {
          depth: 0,
          colors: !1
        }) : String(s);
      }
      case "%d": {
        let s = e[r++];
        return typeof s == "bigint" ? `${s.toString()}n` : Number(s).toString();
      }
      case "%i": {
        let s = e[r++];
        return typeof s == "bigint" ? `${s.toString()}n` : Number.parseInt(String(s)).toString();
      }
      case "%f":
        return Number.parseFloat(String(e[r++])).toString();
      case "%o":
        return on(e[r++], {
          showHidden: !0,
          showProxy: !0
        });
      case "%O":
        return on(e[r++]);
      case "%c":
        return r++, "";
      case "%j":
        try {
          return JSON.stringify(e[r++]);
        } catch (s) {
          let l = s.message;
          if (l.includes("circular structure") || l.includes("cyclic structures") || l.includes("cyclic object"))
            return "[Circular]";
          throw s;
        }
      default:
        return a;
    }
  });
  for (let a = e[r]; r < t; a = e[++r])
    a === null || typeof a != "object" ? i += ` ${a}` : i += ` ${on(a)}`;
  return i;
}
o(nb, "format");
function on(e, t = {}) {
  return t.truncate === 0 && (t.truncate = Number.POSITIVE_INFINITY), Hl(e, t);
}
o(on, "inspect");
function Xq(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
o(Xq, "getDefaultExportFromCjs");

// ../node_modules/@vitest/utils/dist/helpers.js
function ut(e, t, r) {
  let n = typeof e;
  if (!r.includes(n))
    throw new TypeError(`${t} value must be ${r.join(" or ")}, received "${n}"`);
}
o(ut, "assertTypes");
function an(e) {
  return e != null && typeof e == "object" && !Array.isArray(e);
}
o(an, "isObject");
function N6(e) {
  return e === Object.prototype || e === Function.prototype || e === RegExp.prototype;
}
o(N6, "isFinalObj");
function vr(e) {
  return Object.prototype.toString.apply(e).slice(8, -1);
}
o(vr, "getType");
function I6(e, t) {
  let r = typeof t == "function" ? t : (n) => t.add(n);
  Object.getOwnPropertyNames(e).forEach(r), Object.getOwnPropertySymbols(e).forEach(r);
}
o(I6, "collectOwnProperties");
function zl(e) {
  let t = /* @__PURE__ */ new Set();
  return N6(e) ? [] : (I6(e, t), Array.from(t));
}
o(zl, "getOwnProperties");
var Jq = { forceWritable: !1 };
function Wl(e, t = Jq) {
  return Vl(e, /* @__PURE__ */ new WeakMap(), t);
}
o(Wl, "deepClone");
function Vl(e, t, r = Jq) {
  let n, i;
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    for (i = Array.from({ length: n = e.length }), t.set(e, i); n--; )
      i[n] = Vl(e[n], t, r);
    return i;
  }
  if (Object.prototype.toString.call(e) === "[object Object]") {
    i = Object.create(Object.getPrototypeOf(e)), t.set(e, i);
    let a = zl(e);
    for (let s of a) {
      let l = Object.getOwnPropertyDescriptor(e, s);
      if (!l)
        continue;
      let c = Vl(e[s], t, r);
      r.forceWritable ? Object.defineProperty(i, s, {
        enumerable: l.enumerable,
        configurable: !0,
        writable: !0,
        value: c
      }) : "get" in l ? Object.defineProperty(i, s, {
        ...l,
        get() {
          return c;
        }
      }) : Object.defineProperty(i, s, {
        ...l,
        value: c
      });
    }
    return i;
  }
  return e;
}
o(Vl, "clone");
function ob() {
}
o(ob, "noop");

// ../node_modules/@vitest/utils/dist/index.js
var ib, Qq;
function j6() {
  if (Qq) return ib;
  Qq = 1;
  var e, t, r, n, i, a, s, l, c, u, d, f, h, m, y, g, x, b, E;
  return h = /\/(?![*\/])(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\\]).|\\.)*(\/[$_\u200C\u200D\p{ID_Continue}]*|\\)?/yu, f = /--|\+\+|=>|\.{3}|\??\.(?!\d)|(?:&&|\|\||\?\?|[+\-%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2}|\/(?![\/*]))=?|[?~,:;[\](){}]/y,
  e = /(\x23?)(?=[$_\p{ID_Start}\\])(?:[$_\u200C\u200D\p{ID_Continue}]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+/yu, y = /(['"])(?:(?!\1)[^\\\n\r]|\\(?:\r\n|[^]))*(\1)?/y,
  d = /(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)n?|0n|[1-9](?:_?\d)*n|(?:(?:0(?!\d)|0\d*[89]\d*|[1-9](?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?|0[0-7]+/y,
  g = /[`}](?:[^`\\$]|\\[^]|\$(?!\{))*(`|\$\{)?/y, E = /[\t\v\f\ufeff\p{Zs}]+/yu, l = /\r?\n|[\r\u2028\u2029]/y, c = /\/\*(?:[^*]|\*(?!\/))*(\*\/)?/y,
  m = /\/\/.*/y, r = /[<>.:={}]|\/(?![\/*])/y, t = /[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}-]*/yu, n = /(['"])(?:(?!\1)[^])*(\1)?/y, i =
  /[^<>{}]+/y, b = /^(?:[\/+-]|\.{3}|\?(?:InterpolationIn(?:JSX|Template)|NoLineTerminatorHere|NonExpressionParenEnd|UnaryIncDec))?$|[{}([,;<>=*%&|^!~?:]$/,
  x = /^(?:=>|[;\]){}]|else|\?(?:NoLineTerminatorHere|NonExpressionParenEnd))?$/, a = /^(?:await|case|default|delete|do|else|instanceof|new|return|throw|typeof|void|yield)$/,
  s = /^(?:return|throw|yield)$/, u = RegExp(l.source), ib = /* @__PURE__ */ o(function* (q, { jsx: C = !1 } = {}) {
    var P, O, R, A, j, J, S, G, ne, B, H, $, W, V;
    for ({ length: J } = q, A = 0, j = "", V = [
      { tag: "JS" }
    ], P = [], H = 0, $ = !1; A < J; ) {
      switch (G = V[V.length - 1], G.tag) {
        case "JS":
        case "JSNonExpressionParen":
        case "InterpolationInTemplate":
        case "InterpolationInJSX":
          if (q[A] === "/" && (b.test(j) || a.test(j)) && (h.lastIndex = A, S = h.exec(q))) {
            A = h.lastIndex, j = S[0], $ = !0, yield {
              type: "RegularExpressionLiteral",
              value: S[0],
              closed: S[1] !== void 0 && S[1] !== "\\"
            };
            continue;
          }
          if (f.lastIndex = A, S = f.exec(q)) {
            switch (W = S[0], ne = f.lastIndex, B = W, W) {
              case "(":
                j === "?NonExpressionParenKeyword" && V.push({
                  tag: "JSNonExpressionParen",
                  nesting: H
                }), H++, $ = !1;
                break;
              case ")":
                H--, $ = !0, G.tag === "JSNonExpressionParen" && H === G.nesting && (V.pop(), B = "?NonExpressionParenEnd", $ = !1);
                break;
              case "{":
                f.lastIndex = 0, R = !x.test(j) && (b.test(j) || a.test(j)), P.push(R), $ = !1;
                break;
              case "}":
                switch (G.tag) {
                  case "InterpolationInTemplate":
                    if (P.length === G.nesting) {
                      g.lastIndex = A, S = g.exec(q), A = g.lastIndex, j = S[0], S[1] === "${" ? (j = "?InterpolationInTemplate", $ = !1, yield {
                        type: "TemplateMiddle",
                        value: S[0]
                      }) : (V.pop(), $ = !0, yield {
                        type: "TemplateTail",
                        value: S[0],
                        closed: S[1] === "`"
                      });
                      continue;
                    }
                    break;
                  case "InterpolationInJSX":
                    if (P.length === G.nesting) {
                      V.pop(), A += 1, j = "}", yield {
                        type: "JSXPunctuator",
                        value: "}"
                      };
                      continue;
                    }
                }
                $ = P.pop(), B = $ ? "?ExpressionBraceEnd" : "}";
                break;
              case "]":
                $ = !0;
                break;
              case "++":
              case "--":
                B = $ ? "?PostfixIncDec" : "?UnaryIncDec";
                break;
              case "<":
                if (C && (b.test(j) || a.test(j))) {
                  V.push({ tag: "JSXTag" }), A += 1, j = "<", yield {
                    type: "JSXPunctuator",
                    value: W
                  };
                  continue;
                }
                $ = !1;
                break;
              default:
                $ = !1;
            }
            A = ne, j = B, yield {
              type: "Punctuator",
              value: W
            };
            continue;
          }
          if (e.lastIndex = A, S = e.exec(q)) {
            switch (A = e.lastIndex, B = S[0], S[0]) {
              case "for":
              case "if":
              case "while":
              case "with":
                j !== "." && j !== "?." && (B = "?NonExpressionParenKeyword");
            }
            j = B, $ = !a.test(S[0]), yield {
              type: S[1] === "#" ? "PrivateIdentifier" : "IdentifierName",
              value: S[0]
            };
            continue;
          }
          if (y.lastIndex = A, S = y.exec(q)) {
            A = y.lastIndex, j = S[0], $ = !0, yield {
              type: "StringLiteral",
              value: S[0],
              closed: S[2] !== void 0
            };
            continue;
          }
          if (d.lastIndex = A, S = d.exec(q)) {
            A = d.lastIndex, j = S[0], $ = !0, yield {
              type: "NumericLiteral",
              value: S[0]
            };
            continue;
          }
          if (g.lastIndex = A, S = g.exec(q)) {
            A = g.lastIndex, j = S[0], S[1] === "${" ? (j = "?InterpolationInTemplate", V.push({
              tag: "InterpolationInTemplate",
              nesting: P.length
            }), $ = !1, yield {
              type: "TemplateHead",
              value: S[0]
            }) : ($ = !0, yield {
              type: "NoSubstitutionTemplate",
              value: S[0],
              closed: S[1] === "`"
            });
            continue;
          }
          break;
        case "JSXTag":
        case "JSXTagEnd":
          if (r.lastIndex = A, S = r.exec(q)) {
            switch (A = r.lastIndex, B = S[0], S[0]) {
              case "<":
                V.push({ tag: "JSXTag" });
                break;
              case ">":
                V.pop(), j === "/" || G.tag === "JSXTagEnd" ? (B = "?JSX", $ = !0) : V.push({ tag: "JSXChildren" });
                break;
              case "{":
                V.push({
                  tag: "InterpolationInJSX",
                  nesting: P.length
                }), B = "?InterpolationInJSX", $ = !1;
                break;
              case "/":
                j === "<" && (V.pop(), V[V.length - 1].tag === "JSXChildren" && V.pop(), V.push({ tag: "JSXTagEnd" }));
            }
            j = B, yield {
              type: "JSXPunctuator",
              value: S[0]
            };
            continue;
          }
          if (t.lastIndex = A, S = t.exec(q)) {
            A = t.lastIndex, j = S[0], yield {
              type: "JSXIdentifier",
              value: S[0]
            };
            continue;
          }
          if (n.lastIndex = A, S = n.exec(q)) {
            A = n.lastIndex, j = S[0], yield {
              type: "JSXString",
              value: S[0],
              closed: S[2] !== void 0
            };
            continue;
          }
          break;
        case "JSXChildren":
          if (i.lastIndex = A, S = i.exec(q)) {
            A = i.lastIndex, j = S[0], yield {
              type: "JSXText",
              value: S[0]
            };
            continue;
          }
          switch (q[A]) {
            case "<":
              V.push({ tag: "JSXTag" }), A++, j = "<", yield {
                type: "JSXPunctuator",
                value: "<"
              };
              continue;
            case "{":
              V.push({
                tag: "InterpolationInJSX",
                nesting: P.length
              }), A++, j = "?InterpolationInJSX", $ = !1, yield {
                type: "JSXPunctuator",
                value: "{"
              };
              continue;
          }
      }
      if (E.lastIndex = A, S = E.exec(q)) {
        A = E.lastIndex, yield {
          type: "WhiteSpace",
          value: S[0]
        };
        continue;
      }
      if (l.lastIndex = A, S = l.exec(q)) {
        A = l.lastIndex, $ = !1, s.test(j) && (j = "?NoLineTerminatorHere"), yield {
          type: "LineTerminatorSequence",
          value: S[0]
        };
        continue;
      }
      if (c.lastIndex = A, S = c.exec(q)) {
        A = c.lastIndex, u.test(S[0]) && ($ = !1, s.test(j) && (j = "?NoLineTerminatorHere")), yield {
          type: "MultiLineComment",
          value: S[0],
          closed: S[1] !== void 0
        };
        continue;
      }
      if (m.lastIndex = A, S = m.exec(q)) {
        A = m.lastIndex, $ = !1, yield {
          type: "SingleLineComment",
          value: S[0]
        };
        continue;
      }
      O = String.fromCodePoint(q.codePointAt(A)), A += O.length, j = O, $ = !1, yield {
        type: G.tag.startsWith("JSX") ? "JSXInvalid" : "Invalid",
        value: O
      };
    }
  }, "jsTokens_1"), ib;
}
o(j6, "requireJsTokens");
var Che = j6();
var Zq = {
  keyword: [
    "break",
    "case",
    "catch",
    "continue",
    "debugger",
    "default",
    "do",
    "else",
    "finally",
    "for",
    "function",
    "if",
    "return",
    "switch",
    "throw",
    "try",
    "var",
    "const",
    "while",
    "with",
    "new",
    "this",
    "super",
    "class",
    "extends",
    "export",
    "import",
    "null",
    "true",
    "false",
    "in",
    "instanceof",
    "typeof",
    "void",
    "delete"
  ],
  strict: [
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield"
  ]
}, xhe = new Set(Zq.keyword), _he = new Set(Zq.strict);
var Phe = Symbol("vitest:SAFE_TIMERS");

// ../node_modules/@vitest/utils/dist/diff.js
var ke = -1, Ne = 1, we = 0, mb = class mb {
  0;
  1;
  constructor(t, r) {
    this[0] = t, this[1] = r;
  }
};
o(mb, "Diff");
var be = mb;
function k6(e, t) {
  if (!e || !t || e.charAt(0) !== t.charAt(0))
    return 0;
  let r = 0, n = Math.min(e.length, t.length), i = n, a = 0;
  for (; r < i; )
    e.substring(a, i) === t.substring(a, i) ? (r = i, a = r) : n = i, i = Math.floor((n - r) / 2 + r);
  return i;
}
o(k6, "diff_commonPrefix");
function hR(e, t) {
  if (!e || !t || e.charAt(e.length - 1) !== t.charAt(t.length - 1))
    return 0;
  let r = 0, n = Math.min(e.length, t.length), i = n, a = 0;
  for (; r < i; )
    e.substring(e.length - i, e.length - a) === t.substring(t.length - i, t.length - a) ? (r = i, a = r) : n = i, i = Math.floor((n - r) / 2 +
    r);
  return i;
}
o(hR, "diff_commonSuffix");
function eR(e, t) {
  let r = e.length, n = t.length;
  if (r === 0 || n === 0)
    return 0;
  r > n ? e = e.substring(r - n) : r < n && (t = t.substring(0, r));
  let i = Math.min(r, n);
  if (e === t)
    return i;
  let a = 0, s = 1;
  for (; ; ) {
    let l = e.substring(i - s), c = t.indexOf(l);
    if (c === -1)
      return a;
    s += c, (c === 0 || e.substring(i - s) === t.substring(0, s)) && (a = s, s++);
  }
}
o(eR, "diff_commonOverlap_");
function L6(e) {
  let t = !1, r = [], n = 0, i = null, a = 0, s = 0, l = 0, c = 0, u = 0;
  for (; a < e.length; )
    e[a][0] === we ? (r[n++] = a, s = c, l = u, c = 0, u = 0, i = e[a][1]) : (e[a][0] === Ne ? c += e[a][1].length : u += e[a][1].length, i &&
    i.length <= Math.max(s, l) && i.length <= Math.max(c, u) && (e.splice(r[n - 1], 0, new be(ke, i)), e[r[n - 1] + 1][0] = Ne, n--, n--, a =
    n > 0 ? r[n - 1] : -1, s = 0, l = 0, c = 0, u = 0, i = null, t = !0)), a++;
  for (t && bR(e), D6(e), a = 1; a < e.length; ) {
    if (e[a - 1][0] === ke && e[a][0] === Ne) {
      let d = e[a - 1][1], f = e[a][1], h = eR(d, f), m = eR(f, d);
      h >= m ? (h >= d.length / 2 || h >= f.length / 2) && (e.splice(a, 0, new be(we, f.substring(0, h))), e[a - 1][1] = d.substring(0, d.length -
      h), e[a + 1][1] = f.substring(h), a++) : (m >= d.length / 2 || m >= f.length / 2) && (e.splice(a, 0, new be(we, d.substring(0, m))), e[a -
      1][0] = Ne, e[a - 1][1] = f.substring(0, f.length - m), e[a + 1][0] = ke, e[a + 1][1] = d.substring(m), a++), a++;
    }
    a++;
  }
}
o(L6, "diff_cleanupSemantic");
var tR = /[^a-z0-9]/i, rR = /\s/, nR = /[\r\n]/, $6 = /\n\r?\n$/, B6 = /^\r?\n\r?\n/;
function D6(e) {
  let t = 1;
  for (; t < e.length - 1; ) {
    if (e[t - 1][0] === we && e[t + 1][0] === we) {
      let r = e[t - 1][1], n = e[t][1], i = e[t + 1][1], a = hR(r, n);
      if (a) {
        let d = n.substring(n.length - a);
        r = r.substring(0, r.length - a), n = d + n.substring(0, n.length - a), i = d + i;
      }
      let s = r, l = n, c = i, u = Gl(r, n) + Gl(n, i);
      for (; n.charAt(0) === i.charAt(0); ) {
        r += n.charAt(0), n = n.substring(1) + i.charAt(0), i = i.substring(1);
        let d = Gl(r, n) + Gl(n, i);
        d >= u && (u = d, s = r, l = n, c = i);
      }
      e[t - 1][1] !== s && (s ? e[t - 1][1] = s : (e.splice(t - 1, 1), t--), e[t][1] = l, c ? e[t + 1][1] = c : (e.splice(t + 1, 1), t--));
    }
    t++;
  }
}
o(D6, "diff_cleanupSemanticLossless");
function bR(e) {
  e.push(new be(we, ""));
  let t = 0, r = 0, n = 0, i = "", a = "", s;
  for (; t < e.length; )
    switch (e[t][0]) {
      case Ne:
        n++, a += e[t][1], t++;
        break;
      case ke:
        r++, i += e[t][1], t++;
        break;
      case we:
        r + n > 1 ? (r !== 0 && n !== 0 && (s = k6(a, i), s !== 0 && (t - r - n > 0 && e[t - r - n - 1][0] === we ? e[t - r - n - 1][1] += a.
        substring(0, s) : (e.splice(0, 0, new be(we, a.substring(0, s))), t++), a = a.substring(s), i = i.substring(s)), s = hR(a, i), s !==
        0 && (e[t][1] = a.substring(a.length - s) + e[t][1], a = a.substring(0, a.length - s), i = i.substring(0, i.length - s))), t -= r + n,
        e.splice(t, r + n), i.length && (e.splice(t, 0, new be(ke, i)), t++), a.length && (e.splice(t, 0, new be(Ne, a)), t++), t++) : t !==
        0 && e[t - 1][0] === we ? (e[t - 1][1] += e[t][1], e.splice(t, 1)) : t++, n = 0, r = 0, i = "", a = "";
        break;
    }
  e[e.length - 1][1] === "" && e.pop();
  let l = !1;
  for (t = 1; t < e.length - 1; )
    e[t - 1][0] === we && e[t + 1][0] === we && (e[t][1].substring(e[t][1].length - e[t - 1][1].length) === e[t - 1][1] ? (e[t][1] = e[t - 1][1] +
    e[t][1].substring(0, e[t][1].length - e[t - 1][1].length), e[t + 1][1] = e[t - 1][1] + e[t + 1][1], e.splice(t - 1, 1), l = !0) : e[t][1].
    substring(0, e[t + 1][1].length) === e[t + 1][1] && (e[t - 1][1] += e[t + 1][1], e[t][1] = e[t][1].substring(e[t + 1][1].length) + e[t +
    1][1], e.splice(t + 1, 1), l = !0)), t++;
  l && bR(e);
}
o(bR, "diff_cleanupMerge");
function Gl(e, t) {
  if (!e || !t)
    return 6;
  let r = e.charAt(e.length - 1), n = t.charAt(0), i = r.match(tR), a = n.match(tR), s = i && r.match(rR), l = a && n.match(rR), c = s && r.
  match(nR), u = l && n.match(nR), d = c && e.match($6), f = u && t.match(B6);
  return d || f ? 5 : c || u ? 4 : i && !s && l ? 3 : s || l ? 2 : i || a ? 1 : 0;
}
o(Gl, "diff_cleanupSemanticScore_");
var yR = "Compared values have no visual difference.", F6 = "Compared values serialize to the same structure.\nPrinting internal object struc\
ture without calling `toJSON` instead.", Kl = {}, oR;
function U6() {
  if (oR) return Kl;
  oR = 1, Object.defineProperty(Kl, "__esModule", {
    value: !0
  }), Kl.default = h;
  let e = "diff-sequences", t = 0, r = /* @__PURE__ */ o((m, y, g, x, b) => {
    let E = 0;
    for (; m < y && g < x && b(m, g); )
      m += 1, g += 1, E += 1;
    return E;
  }, "countCommonItemsF"), n = /* @__PURE__ */ o((m, y, g, x, b) => {
    let E = 0;
    for (; m <= y && g <= x && b(y, x); )
      y -= 1, x -= 1, E += 1;
    return E;
  }, "countCommonItemsR"), i = /* @__PURE__ */ o((m, y, g, x, b, E, q) => {
    let C = 0, P = -m, O = E[C], R = O;
    E[C] += r(
      O + 1,
      y,
      x + O - P + 1,
      g,
      b
    );
    let A = m < q ? m : q;
    for (C += 1, P += 2; C <= A; C += 1, P += 2) {
      if (C !== m && R < E[C])
        O = E[C];
      else if (O = R + 1, y <= O)
        return C - 1;
      R = E[C], E[C] = O + r(O + 1, y, x + O - P + 1, g, b);
    }
    return q;
  }, "extendPathsF"), a = /* @__PURE__ */ o((m, y, g, x, b, E, q) => {
    let C = 0, P = m, O = E[C], R = O;
    E[C] -= n(
      y,
      O - 1,
      g,
      x + O - P - 1,
      b
    );
    let A = m < q ? m : q;
    for (C += 1, P -= 2; C <= A; C += 1, P -= 2) {
      if (C !== m && E[C] < R)
        O = E[C];
      else if (O = R - 1, O < y)
        return C - 1;
      R = E[C], E[C] = O - n(
        y,
        O - 1,
        g,
        x + O - P - 1,
        b
      );
    }
    return q;
  }, "extendPathsR"), s = /* @__PURE__ */ o((m, y, g, x, b, E, q, C, P, O, R) => {
    let A = x - y, j = g - y, S = b - x - j, G = -S - (m - 1), ne = -S + (m - 1), B = t, H = m < C ? m : C;
    for (let $ = 0, W = -m; $ <= H; $ += 1, W += 2) {
      let V = $ === 0 || $ !== m && B < q[$], ee = V ? q[$] : B, pe = V ? ee : ee + 1, Ce = A + pe - W, I = r(
        pe + 1,
        g,
        Ce + 1,
        b,
        E
      ), M = pe + I;
      if (B = q[$], q[$] = M, G <= W && W <= ne) {
        let F = (m - 1 - (W + S)) / 2;
        if (F <= O && P[F] - 1 <= M) {
          let U = A + ee - (V ? W + 1 : W - 1), K = n(
            y,
            ee,
            x,
            U,
            E
          ), se = ee - K, ge = U - K, Re = se + 1, cr = ge + 1;
          R.nChangePreceding = m - 1, m - 1 === Re + cr - y - x ? (R.aEndPreceding = y, R.bEndPreceding = x) : (R.aEndPreceding = Re, R.bEndPreceding =
          cr), R.nCommonPreceding = K, K !== 0 && (R.aCommonPreceding = Re, R.bCommonPreceding = cr), R.nCommonFollowing = I, I !== 0 && (R.
          aCommonFollowing = pe + 1, R.bCommonFollowing = Ce + 1);
          let kr = M + 1, Lr = Ce + I + 1;
          return R.nChangeFollowing = m - 1, m - 1 === g + b - kr - Lr ? (R.aStartFollowing = g, R.bStartFollowing = b) : (R.aStartFollowing =
          kr, R.bStartFollowing = Lr), !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsF"), l = /* @__PURE__ */ o((m, y, g, x, b, E, q, C, P, O, R) => {
    let A = b - g, j = g - y, S = b - x - j, G = S - m, ne = S + m, B = t, H = m < O ? m : O;
    for (let $ = 0, W = m; $ <= H; $ += 1, W -= 2) {
      let V = $ === 0 || $ !== m && P[$] < B, ee = V ? P[$] : B, pe = V ? ee : ee - 1, Ce = A + pe - W, I = n(
        y,
        pe - 1,
        x,
        Ce - 1,
        E
      ), M = pe - I;
      if (B = P[$], P[$] = M, G <= W && W <= ne) {
        let F = (m + (W - S)) / 2;
        if (F <= C && M - 1 <= q[F]) {
          let U = Ce - I;
          if (R.nChangePreceding = m, m === M + U - y - x ? (R.aEndPreceding = y, R.bEndPreceding = x) : (R.aEndPreceding = M, R.bEndPreceding =
          U), R.nCommonPreceding = I, I !== 0 && (R.aCommonPreceding = M, R.bCommonPreceding = U), R.nChangeFollowing = m - 1, m === 1)
            R.nCommonFollowing = 0, R.aStartFollowing = g, R.bStartFollowing = b;
          else {
            let K = A + ee - (V ? W - 1 : W + 1), se = r(
              ee,
              g,
              K,
              b,
              E
            );
            R.nCommonFollowing = se, se !== 0 && (R.aCommonFollowing = ee, R.bCommonFollowing = K);
            let ge = ee + se, Re = K + se;
            m - 1 === g + b - ge - Re ? (R.aStartFollowing = g, R.bStartFollowing = b) : (R.aStartFollowing = ge, R.bStartFollowing = Re);
          }
          return !0;
        }
      }
    }
    return !1;
  }, "extendOverlappablePathsR"), c = /* @__PURE__ */ o((m, y, g, x, b, E, q, C, P) => {
    let O = x - y, R = b - g, A = g - y, j = b - x, J = j - A, S = A, G = A;
    if (q[0] = y - 1, C[0] = g, J % 2 === 0) {
      let ne = (m || J) / 2, B = (A + j) / 2;
      for (let H = 1; H <= B; H += 1)
        if (S = i(H, g, b, O, E, q, S), H < ne)
          G = a(H, y, x, R, E, C, G);
        else if (
          // If a reverse path overlaps a forward path in the same diagonal,
          // return a division of the index intervals at the middle change.
          l(
            H,
            y,
            g,
            x,
            b,
            E,
            q,
            S,
            C,
            G,
            P
          )
        )
          return;
    } else {
      let ne = ((m || J) + 1) / 2, B = (A + j + 1) / 2, H = 1;
      for (S = i(H, g, b, O, E, q, S), H += 1; H <= B; H += 1)
        if (G = a(
          H - 1,
          y,
          x,
          R,
          E,
          C,
          G
        ), H < ne)
          S = i(H, g, b, O, E, q, S);
        else if (
          // If a forward path overlaps a reverse path in the same diagonal,
          // return a division of the index intervals at the middle change.
          s(
            H,
            y,
            g,
            x,
            b,
            E,
            q,
            S,
            C,
            G,
            P
          )
        )
          return;
    }
    throw new Error(
      `${e}: no overlap aStart=${y} aEnd=${g} bStart=${x} bEnd=${b}`
    );
  }, "divide"), u = /* @__PURE__ */ o((m, y, g, x, b, E, q, C, P, O) => {
    if (b - x < g - y) {
      if (E = !E, E && q.length === 1) {
        let { foundSubsequence: M, isCommon: F } = q[0];
        q[1] = {
          foundSubsequence: /* @__PURE__ */ o((U, K, se) => {
            M(U, se, K);
          }, "foundSubsequence"),
          isCommon: /* @__PURE__ */ o((U, K) => F(K, U), "isCommon")
        };
      }
      let Ce = y, I = g;
      y = x, g = b, x = Ce, b = I;
    }
    let { foundSubsequence: R, isCommon: A } = q[E ? 1 : 0];
    c(
      m,
      y,
      g,
      x,
      b,
      A,
      C,
      P,
      O
    );
    let {
      nChangePreceding: j,
      aEndPreceding: J,
      bEndPreceding: S,
      nCommonPreceding: G,
      aCommonPreceding: ne,
      bCommonPreceding: B,
      nCommonFollowing: H,
      aCommonFollowing: $,
      bCommonFollowing: W,
      nChangeFollowing: V,
      aStartFollowing: ee,
      bStartFollowing: pe
    } = O;
    y < J && x < S && u(
      j,
      y,
      J,
      x,
      S,
      E,
      q,
      C,
      P,
      O
    ), G !== 0 && R(G, ne, B), H !== 0 && R(H, $, W), ee < g && pe < b && u(
      V,
      ee,
      g,
      pe,
      b,
      E,
      q,
      C,
      P,
      O
    );
  }, "findSubsequences"), d = /* @__PURE__ */ o((m, y) => {
    if (typeof y != "number")
      throw new TypeError(`${e}: ${m} typeof ${typeof y} is not a number`);
    if (!Number.isSafeInteger(y))
      throw new RangeError(`${e}: ${m} value ${y} is not a safe integer`);
    if (y < 0)
      throw new RangeError(`${e}: ${m} value ${y} is a negative integer`);
  }, "validateLength"), f = /* @__PURE__ */ o((m, y) => {
    let g = typeof y;
    if (g !== "function")
      throw new TypeError(`${e}: ${m} typeof ${g} is not a function`);
  }, "validateCallback");
  function h(m, y, g, x) {
    d("aLength", m), d("bLength", y), f("isCommon", g), f("foundSubsequence", x);
    let b = r(0, m, 0, y, g);
    if (b !== 0 && x(b, 0, 0), m !== b || y !== b) {
      let E = b, q = b, C = n(
        E,
        m - 1,
        q,
        y - 1,
        g
      ), P = m - C, O = y - C, R = b + C;
      m !== R && y !== R && u(
        0,
        E,
        P,
        q,
        O,
        !1,
        [
          {
            foundSubsequence: x,
            isCommon: g
          }
        ],
        [t],
        [t],
        {
          aCommonFollowing: t,
          aCommonPreceding: t,
          aEndPreceding: t,
          aStartFollowing: t,
          bCommonFollowing: t,
          bCommonPreceding: t,
          bEndPreceding: t,
          bStartFollowing: t,
          nChangeFollowing: t,
          nChangePreceding: t,
          nCommonFollowing: t,
          nCommonPreceding: t
        }
      ), C !== 0 && x(C, P, O);
    }
  }
  return o(h, "diffSequence"), Kl;
}
o(U6, "requireBuild");
var H6 = U6(), gR = /* @__PURE__ */ Xq(H6);
function V6(e, t) {
  return e.replace(/\s+$/, (r) => t(r));
}
o(V6, "formatTrailingSpaces");
function fb(e, t, r, n, i, a) {
  return e.length !== 0 ? r(`${n} ${V6(e, i)}`) : n !== " " ? r(n) : t && a.length !== 0 ? r(`${n} ${a}`) : "";
}
o(fb, "printDiffLine");
function vR(e, t, { aColor: r, aIndicator: n, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
  return fb(e, t, r, n, i, a);
}
o(vR, "printDeleteLine");
function wR(e, t, { bColor: r, bIndicator: n, changeLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
  return fb(e, t, r, n, i, a);
}
o(wR, "printInsertLine");
function ER(e, t, { commonColor: r, commonIndicator: n, commonLineTrailingSpaceColor: i, emptyFirstOrLastLinePlaceholder: a }) {
  return fb(e, t, r, n, i, a);
}
o(ER, "printCommonLine");
function iR(e, t, r, n, { patchColor: i }) {
  return i(`@@ -${e + 1},${t - e} +${r + 1},${n - r} @@`);
}
o(iR, "createPatchMark");
function z6(e, t) {
  let r = e.length, n = t.contextLines, i = n + n, a = r, s = !1, l = 0, c = 0;
  for (; c !== r; ) {
    let C = c;
    for (; c !== r && e[c][0] === we; )
      c += 1;
    if (C !== c)
      if (C === 0)
        c > n && (a -= c - n, s = !0);
      else if (c === r) {
        let P = c - C;
        P > n && (a -= P - n, s = !0);
      } else {
        let P = c - C;
        P > i && (a -= P - i, l += 1);
      }
    for (; c !== r && e[c][0] !== we; )
      c += 1;
  }
  let u = l !== 0 || s;
  l !== 0 ? a += l + 1 : s && (a += 1);
  let d = a - 1, f = [], h = 0;
  u && f.push("");
  let m = 0, y = 0, g = 0, x = 0, b = /* @__PURE__ */ o((C) => {
    let P = f.length;
    f.push(ER(C, P === 0 || P === d, t)), g += 1, x += 1;
  }, "pushCommonLine"), E = /* @__PURE__ */ o((C) => {
    let P = f.length;
    f.push(vR(C, P === 0 || P === d, t)), g += 1;
  }, "pushDeleteLine"), q = /* @__PURE__ */ o((C) => {
    let P = f.length;
    f.push(wR(C, P === 0 || P === d, t)), x += 1;
  }, "pushInsertLine");
  for (c = 0; c !== r; ) {
    let C = c;
    for (; c !== r && e[c][0] === we; )
      c += 1;
    if (C !== c)
      if (C === 0) {
        c > n && (C = c - n, m = C, y = C, g = m, x = y);
        for (let P = C; P !== c; P += 1)
          b(e[P][1]);
      } else if (c === r) {
        let P = c - C > n ? C + n : c;
        for (let O = C; O !== P; O += 1)
          b(e[O][1]);
      } else {
        let P = c - C;
        if (P > i) {
          let O = C + n;
          for (let A = C; A !== O; A += 1)
            b(e[A][1]);
          f[h] = iR(m, g, y, x, t), h = f.length, f.push("");
          let R = P - i;
          m = g + R, y = x + R, g = m, x = y;
          for (let A = c - n; A !== c; A += 1)
            b(e[A][1]);
        } else
          for (let O = C; O !== c; O += 1)
            b(e[O][1]);
      }
    for (; c !== r && e[c][0] === ke; )
      E(e[c][1]), c += 1;
    for (; c !== r && e[c][0] === Ne; )
      q(e[c][1]), c += 1;
  }
  return u && (f[h] = iR(m, g, y, x, t)), f.join(`
`);
}
o(z6, "joinAlignedDiffsNoExpand");
function W6(e, t) {
  return e.map((r, n, i) => {
    let a = r[1], s = n === 0 || n === i.length - 1;
    switch (r[0]) {
      case ke:
        return vR(a, s, t);
      case Ne:
        return wR(a, s, t);
      default:
        return ER(a, s, t);
    }
  }).join(`
`);
}
o(W6, "joinAlignedDiffsExpand");
var ab = /* @__PURE__ */ o((e) => e, "noColor"), CR = 5, G6 = 0;
function K6() {
  return {
    aAnnotation: "Expected",
    aColor: de.green,
    aIndicator: "-",
    bAnnotation: "Received",
    bColor: de.red,
    bIndicator: "+",
    changeColor: de.inverse,
    changeLineTrailingSpaceColor: ab,
    commonColor: de.dim,
    commonIndicator: " ",
    commonLineTrailingSpaceColor: ab,
    compareKeys: void 0,
    contextLines: CR,
    emptyFirstOrLastLinePlaceholder: "",
    expand: !1,
    includeChangeCounts: !1,
    omitAnnotationLines: !1,
    patchColor: de.yellow,
    printBasicPrototype: !1,
    truncateThreshold: G6,
    truncateAnnotation: "... Diff result is truncated",
    truncateAnnotationColor: ab
  };
}
o(K6, "getDefaultOptions");
function Y6(e) {
  return e && typeof e == "function" ? e : void 0;
}
o(Y6, "getCompareKeys");
function X6(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0 ? e : CR;
}
o(X6, "getContextLines");
function wr(e = {}) {
  return {
    ...K6(),
    ...e,
    compareKeys: Y6(e.compareKeys),
    contextLines: X6(e.contextLines)
  };
}
o(wr, "normalizeDiffOptions");
function sn(e) {
  return e.length === 1 && e[0].length === 0;
}
o(sn, "isEmptyString");
function J6(e) {
  let t = 0, r = 0;
  return e.forEach((n) => {
    switch (n[0]) {
      case ke:
        t += 1;
        break;
      case Ne:
        r += 1;
        break;
    }
  }), {
    a: t,
    b: r
  };
}
o(J6, "countChanges");
function Q6({ aAnnotation: e, aColor: t, aIndicator: r, bAnnotation: n, bColor: i, bIndicator: a, includeChangeCounts: s, omitAnnotationLines: l }, c) {
  if (l)
    return "";
  let u = "", d = "";
  if (s) {
    let m = String(c.a), y = String(c.b), g = n.length - e.length, x = " ".repeat(Math.max(0, g)), b = " ".repeat(Math.max(0, -g)), E = y.length -
    m.length, q = " ".repeat(Math.max(0, E)), C = " ".repeat(Math.max(0, -E));
    u = `${x}  ${r} ${q}${m}`, d = `${b}  ${a} ${C}${y}`;
  }
  let f = `${r} ${e}${u}`, h = `${a} ${n}${d}`;
  return `${t(f)}
${i(h)}

`;
}
o(Q6, "printAnnotation");
function pb(e, t, r) {
  return Q6(r, J6(e)) + (r.expand ? W6(e, r) : z6(e, r)) + (t ? r.truncateAnnotationColor(`
${r.truncateAnnotation}`) : "");
}
o(pb, "printDiffLines");
function Xl(e, t, r) {
  let n = wr(r), [i, a] = xR(sn(e) ? [] : e, sn(t) ? [] : t, n);
  return pb(i, a, n);
}
o(Xl, "diffLinesUnified");
function Z6(e, t, r, n, i) {
  if (sn(e) && sn(r) && (e = [], r = []), sn(t) && sn(n) && (t = [], n = []), e.length !== r.length || t.length !== n.length)
    return Xl(e, t, i);
  let [a, s] = xR(r, n, i), l = 0, c = 0;
  return a.forEach((u) => {
    switch (u[0]) {
      case ke:
        u[1] = e[l], l += 1;
        break;
      case Ne:
        u[1] = t[c], c += 1;
        break;
      default:
        u[1] = t[c], l += 1, c += 1;
    }
  }), pb(a, s, wr(i));
}
o(Z6, "diffLinesUnified2");
function xR(e, t, r) {
  let n = r?.truncateThreshold ?? !1, i = Math.max(Math.floor(r?.truncateThreshold ?? 0), 0), a = n ? Math.min(e.length, i) : e.length, s = n ?
  Math.min(t.length, i) : t.length, l = a !== e.length || s !== t.length, c = /* @__PURE__ */ o((m, y) => e[m] === t[y], "isCommon"), u = [],
  d = 0, f = 0;
  for (gR(a, s, c, /* @__PURE__ */ o((m, y, g) => {
    for (; d !== y; d += 1)
      u.push(new be(ke, e[d]));
    for (; f !== g; f += 1)
      u.push(new be(Ne, t[f]));
    for (; m !== 0; m -= 1, d += 1, f += 1)
      u.push(new be(we, t[f]));
  }, "foundSubsequence")); d !== a; d += 1)
    u.push(new be(ke, e[d]));
  for (; f !== s; f += 1)
    u.push(new be(Ne, t[f]));
  return [u, l];
}
o(xR, "diffLinesRaw");
function aR(e) {
  if (e === void 0)
    return "undefined";
  if (e === null)
    return "null";
  if (Array.isArray(e))
    return "array";
  if (typeof e == "boolean")
    return "boolean";
  if (typeof e == "function")
    return "function";
  if (typeof e == "number")
    return "number";
  if (typeof e == "string")
    return "string";
  if (typeof e == "bigint")
    return "bigint";
  if (typeof e == "object") {
    if (e != null) {
      if (e.constructor === RegExp)
        return "regexp";
      if (e.constructor === Map)
        return "map";
      if (e.constructor === Set)
        return "set";
      if (e.constructor === Date)
        return "date";
    }
    return "object";
  } else if (typeof e == "symbol")
    return "symbol";
  throw new Error(`value of unknown type: ${e}`);
}
o(aR, "getType");
function sR(e) {
  return e.includes(`\r
`) ? `\r
` : `
`;
}
o(sR, "getNewLineSymbol");
function e9(e, t, r) {
  let n = r?.truncateThreshold ?? !1, i = Math.max(Math.floor(r?.truncateThreshold ?? 0), 0), a = e.length, s = t.length;
  if (n) {
    let m = e.includes(`
`), y = t.includes(`
`), g = sR(e), x = sR(t), b = m ? `${e.split(g, i).join(g)}
` : e, E = y ? `${t.split(x, i).join(x)}
` : t;
    a = b.length, s = E.length;
  }
  let l = a !== e.length || s !== t.length, c = /* @__PURE__ */ o((m, y) => e[m] === t[y], "isCommon"), u = 0, d = 0, f = [];
  return gR(a, s, c, /* @__PURE__ */ o((m, y, g) => {
    u !== y && f.push(new be(ke, e.slice(u, y))), d !== g && f.push(new be(Ne, t.slice(d, g))), u = y + m, d = g + m, f.push(new be(we, t.slice(
    g, d)));
  }, "foundSubsequence")), u !== a && f.push(new be(ke, e.slice(u))), d !== s && f.push(new be(Ne, t.slice(d))), [f, l];
}
o(e9, "diffStrings");
function t9(e, t, r) {
  return t.reduce((n, i) => n + (i[0] === we ? i[1] : i[0] === e && i[1].length !== 0 ? r(i[1]) : ""), "");
}
o(t9, "concatenateRelevantDiffs");
var hb = class hb {
  op;
  line;
  lines;
  changeColor;
  constructor(t, r) {
    this.op = t, this.line = [], this.lines = [], this.changeColor = r;
  }
  pushSubstring(t) {
    this.pushDiff(new be(this.op, t));
  }
  pushLine() {
    this.lines.push(this.line.length !== 1 ? new be(this.op, t9(this.op, this.line, this.changeColor)) : this.line[0][0] === this.op ? this.
    line[0] : new be(this.op, this.line[0][1])), this.line.length = 0;
  }
  isLineEmpty() {
    return this.line.length === 0;
  }
  // Minor input to buffer.
  pushDiff(t) {
    this.line.push(t);
  }
  // Main input to buffer.
  align(t) {
    let r = t[1];
    if (r.includes(`
`)) {
      let n = r.split(`
`), i = n.length - 1;
      n.forEach((a, s) => {
        s < i ? (this.pushSubstring(a), this.pushLine()) : a.length !== 0 && this.pushSubstring(a);
      });
    } else
      this.pushDiff(t);
  }
  // Output from buffer.
  moveLinesTo(t) {
    this.isLineEmpty() || this.pushLine(), t.push(...this.lines), this.lines.length = 0;
  }
};
o(hb, "ChangeBuffer");
var Yl = hb, bb = class bb {
  deleteBuffer;
  insertBuffer;
  lines;
  constructor(t, r) {
    this.deleteBuffer = t, this.insertBuffer = r, this.lines = [];
  }
  pushDiffCommonLine(t) {
    this.lines.push(t);
  }
  pushDiffChangeLines(t) {
    let r = t[1].length === 0;
    (!r || this.deleteBuffer.isLineEmpty()) && this.deleteBuffer.pushDiff(t), (!r || this.insertBuffer.isLineEmpty()) && this.insertBuffer.pushDiff(
    t);
  }
  flushChangeLines() {
    this.deleteBuffer.moveLinesTo(this.lines), this.insertBuffer.moveLinesTo(this.lines);
  }
  // Input to buffer.
  align(t) {
    let r = t[0], n = t[1];
    if (n.includes(`
`)) {
      let i = n.split(`
`), a = i.length - 1;
      i.forEach((s, l) => {
        if (l === 0) {
          let c = new be(r, s);
          this.deleteBuffer.isLineEmpty() && this.insertBuffer.isLineEmpty() ? (this.flushChangeLines(), this.pushDiffCommonLine(c)) : (this.
          pushDiffChangeLines(c), this.flushChangeLines());
        } else l < a ? this.pushDiffCommonLine(new be(r, s)) : s.length !== 0 && this.pushDiffChangeLines(new be(r, s));
      });
    } else
      this.pushDiffChangeLines(t);
  }
  // Output from buffer.
  getLines() {
    return this.flushChangeLines(), this.lines;
  }
};
o(bb, "CommonBuffer");
var lb = bb;
function r9(e, t) {
  let r = new Yl(ke, t), n = new Yl(Ne, t), i = new lb(r, n);
  return e.forEach((a) => {
    switch (a[0]) {
      case ke:
        r.align(a);
        break;
      case Ne:
        n.align(a);
        break;
      default:
        i.align(a);
    }
  }), i.getLines();
}
o(r9, "getAlignedDiffs");
function n9(e, t) {
  if (t) {
    let r = e.length - 1;
    return e.some((n, i) => n[0] === we && (i !== r || n[1] !== `
`));
  }
  return e.some((r) => r[0] === we);
}
o(n9, "hasCommonDiff");
function o9(e, t, r) {
  if (e !== t && e.length !== 0 && t.length !== 0) {
    let n = e.includes(`
`) || t.includes(`
`), [i, a] = _R(n ? `${e}
` : e, n ? `${t}
` : t, !0, r);
    if (n9(i, n)) {
      let s = wr(r), l = r9(i, s.changeColor);
      return pb(l, a, s);
    }
  }
  return Xl(e.split(`
`), t.split(`
`), r);
}
o(o9, "diffStringsUnified");
function _R(e, t, r, n) {
  let [i, a] = e9(e, t, n);
  return r && L6(i), [i, a];
}
o(_R, "diffStringsRaw");
function ub(e, t) {
  let { commonColor: r } = wr(t);
  return r(e);
}
o(ub, "getCommonMessage");
var { AsymmetricMatcher: i9, DOMCollection: a9, DOMElement: s9, Immutable: l9, ReactElement: u9, ReactTestComponent: c9 } = so, PR = [
  c9,
  u9,
  s9,
  a9,
  l9,
  i9,
  so.Error
], cb = {
  maxDepth: 20,
  plugins: PR
}, qR = {
  callToJSON: !1,
  maxDepth: 8,
  plugins: PR
};
function Er(e, t, r) {
  if (Object.is(e, t))
    return "";
  let n = aR(e), i = n, a = !1;
  if (n === "object" && typeof e.asymmetricMatch == "function") {
    if (e.$$typeof !== Symbol.for("jest.asymmetricMatcher") || typeof e.getExpectedType != "function")
      return;
    i = e.getExpectedType(), a = i === "string";
  }
  if (i !== aR(t)) {
    let x = function(q) {
      return q.length <= g ? q : `${q.slice(0, g)}...`;
    };
    o(x, "truncate");
    let { aAnnotation: s, aColor: l, aIndicator: c, bAnnotation: u, bColor: d, bIndicator: f } = wr(r), h = db(qR, r), m = tt(e, h), y = tt(
    t, h), g = 1e5;
    m = x(m), y = x(y);
    let b = `${l(`${c} ${s}:`)} 
${m}`, E = `${d(`${f} ${u}:`)} 
${y}`;
    return `${b}

${E}`;
  }
  if (!a)
    switch (n) {
      case "string":
        return Xl(e.split(`
`), t.split(`
`), r);
      case "boolean":
      case "number":
        return d9(e, t, r);
      case "map":
        return sb(lR(e), lR(t), r);
      case "set":
        return sb(uR(e), uR(t), r);
      default:
        return sb(e, t, r);
    }
}
o(Er, "diff");
function d9(e, t, r) {
  let n = tt(e, cb), i = tt(t, cb);
  return n === i ? "" : Xl(n.split(`
`), i.split(`
`), r);
}
o(d9, "comparePrimitive");
function lR(e) {
  return new Map(Array.from(e.entries()).sort());
}
o(lR, "sortMap");
function uR(e) {
  return new Set(Array.from(e.values()).sort());
}
o(uR, "sortSet");
function sb(e, t, r) {
  let n, i = !1;
  try {
    let s = db(cb, r);
    n = cR(e, t, s, r);
  } catch {
    i = !0;
  }
  let a = ub(yR, r);
  if (n === void 0 || n === a) {
    let s = db(qR, r);
    n = cR(e, t, s, r), n !== a && !i && (n = `${ub(F6, r)}

${n}`);
  }
  return n;
}
o(sb, "compareObjects");
function db(e, t) {
  let { compareKeys: r, printBasicPrototype: n, maxDepth: i } = wr(t);
  return {
    ...e,
    compareKeys: r,
    printBasicPrototype: n,
    maxDepth: i ?? e.maxDepth
  };
}
o(db, "getFormatOptions");
function cR(e, t, r, n) {
  let i = {
    ...r,
    indent: 0
  }, a = tt(e, i), s = tt(t, i);
  if (a === s)
    return ub(yR, n);
  {
    let l = tt(e, r), c = tt(t, r);
    return Z6(l.split(`
`), c.split(`
`), a.split(`
`), s.split(`
`), n);
  }
}
o(cR, "getObjectsDifference");
var dR = 2e4;
function fR(e) {
  return vr(e) === "Object" && typeof e.asymmetricMatch == "function";
}
o(fR, "isAsymmetricMatcher");
function pR(e, t) {
  let r = vr(e), n = vr(t);
  return r === n && (r === "Object" || r === "Array");
}
o(pR, "isReplaceable");
function Jl(e, t, r) {
  let { aAnnotation: n, bAnnotation: i } = wr(r);
  if (typeof t == "string" && typeof e == "string" && t.length > 0 && e.length > 0 && t.length <= dR && e.length <= dR && t !== e) {
    if (t.includes(`
`) || e.includes(`
`))
      return o9(t, e, r);
    let [d] = _R(t, e, !0), f = d.some((g) => g[0] === we), h = f9(n, i), m = h(n) + h9(mR(d, ke, f)), y = h(i) + m9(mR(d, Ne, f));
    return `${m}
${y}`;
  }
  let a = Wl(t, { forceWritable: !0 }), s = Wl(e, { forceWritable: !0 }), { replacedExpected: l, replacedActual: c } = RR(s, a);
  return Er(l, c, r);
}
o(Jl, "printDiffOrStringify");
function RR(e, t, r = /* @__PURE__ */ new WeakSet(), n = /* @__PURE__ */ new WeakSet()) {
  return e instanceof Error && t instanceof Error && typeof e.cause < "u" && typeof t.cause > "u" ? (delete e.cause, {
    replacedActual: e,
    replacedExpected: t
  }) : pR(e, t) ? r.has(e) || n.has(t) ? {
    replacedActual: e,
    replacedExpected: t
  } : (r.add(e), n.add(t), zl(t).forEach((i) => {
    let a = t[i], s = e[i];
    if (fR(a))
      a.asymmetricMatch(s) && (e[i] = a);
    else if (fR(s))
      s.asymmetricMatch(a) && (t[i] = s);
    else if (pR(s, a)) {
      let l = RR(s, a, r, n);
      e[i] = l.replacedActual, t[i] = l.replacedExpected;
    }
  }), {
    replacedActual: e,
    replacedExpected: t
  }) : {
    replacedActual: e,
    replacedExpected: t
  };
}
o(RR, "replaceAsymmetricMatcher");
function f9(...e) {
  let t = e.reduce((r, n) => n.length > r ? n.length : r, 0);
  return (r) => `${r}: ${" ".repeat(t - r.length)}`;
}
o(f9, "getLabelPrinter");
var p9 = "\xB7";
function TR(e) {
  return e.replace(/\s+$/gm, (t) => p9.repeat(t.length));
}
o(TR, "replaceTrailingSpaces");
function m9(e) {
  return de.red(TR(Ae(e)));
}
o(m9, "printReceived");
function h9(e) {
  return de.green(TR(Ae(e)));
}
o(h9, "printExpected");
function mR(e, t, r) {
  return e.reduce((n, i) => n + (i[0] === we ? i[1] : i[0] === t ? r ? de.inverse(i[1]) : i[1] : ""), "");
}
o(mR, "getCommonAndChangedSubstrings");

// ../node_modules/@vitest/spy/node_modules/tinyspy/dist/index.js
function Ql(e, t) {
  if (!e)
    throw new Error(t);
}
o(Ql, "assert");
function ln(e, t) {
  return typeof t === e;
}
o(ln, "isType");
function b9(e) {
  return e instanceof Promise;
}
o(b9, "isPromise");
function lo(e, t, r) {
  Object.defineProperty(e, t, r);
}
o(lo, "define");
function un(e, t, r) {
  lo(e, t, { value: r, configurable: !0, writable: !0 });
}
o(un, "defineValue");
var Ut = Symbol.for("tinyspy:spy"), y9 = /* @__PURE__ */ new Set(), g9 = /* @__PURE__ */ o((e) => {
  e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, "reset"), v9 = /* @__PURE__ */ o((e) => (lo(e, Ut, {
  value: { reset: /* @__PURE__ */ o(() => g9(e[Ut]), "reset") }
}), e[Ut]), "defineState"), Zl = /* @__PURE__ */ o((e) => e[Ut] || v9(e), "getInternalState");
function w9(e) {
  Ql(
    ln("function", e) || ln("undefined", e),
    "cannot spy on a non-function value"
  );
  let t = /* @__PURE__ */ o(function(...n) {
    let i = Zl(t);
    i.called = !0, i.callCount++, i.calls.push(n);
    let a = i.next.shift();
    if (a) {
      i.results.push(a);
      let [d, f] = a;
      if (d === "ok")
        return f;
      throw f;
    }
    let s, l = "ok", c = i.results.length;
    if (i.impl)
      try {
        new.target ? s = Reflect.construct(i.impl, n, new.target) : s = i.impl.apply(this, n), l = "ok";
      } catch (d) {
        throw s = d, l = "error", i.results.push([l, d]), d;
      }
    let u = [l, s];
    return b9(s) && s.then(
      (d) => i.resolves[c] = ["ok", d],
      (d) => i.resolves[c] = ["error", d]
    ), i.results.push(u), s;
  }, "fn");
  un(t, "_isMockFunction", !0), un(t, "length", e ? e.length : 0), un(t, "name", e && e.name || "spy");
  let r = Zl(t);
  return r.reset(), r.impl = e, t;
}
o(w9, "createInternalSpy");
function E9(e) {
  return !!e && e._isMockFunction === !0;
}
o(E9, "isMockFunction");
var SR = /* @__PURE__ */ o((e, t) => {
  let r = Object.getOwnPropertyDescriptor(e, t);
  if (r)
    return [e, r];
  let n = Object.getPrototypeOf(e);
  for (; n !== null; ) {
    let i = Object.getOwnPropertyDescriptor(n, t);
    if (i)
      return [n, i];
    n = Object.getPrototypeOf(n);
  }
}, "getDescriptor"), OR = /* @__PURE__ */ o((e, t) => {
  t != null && typeof t == "function" && t.prototype != null && Object.setPrototypeOf(e.prototype, t.prototype);
}, "setPototype");
function yb(e, t, r) {
  Ql(
    !ln("undefined", e),
    "spyOn could not find an object to spy upon"
  ), Ql(
    ln("object", e) || ln("function", e),
    "cannot spyOn on a primitive value"
  );
  let [n, i] = (() => {
    if (!ln("object", t))
      return [t, "value"];
    if ("getter" in t && "setter" in t)
      throw new Error("cannot spy on both getter and setter");
    if ("getter" in t)
      return [t.getter, "get"];
    if ("setter" in t)
      return [t.setter, "set"];
    throw new Error("specify getter or setter to spy on");
  })(), [a, s] = SR(e, n) || [];
  Ql(
    s || n in e,
    `${String(n)} does not exist`
  );
  let l = !1;
  i === "value" && s && !s.value && s.get && (i = "get", l = !0, r = s.get());
  let c;
  s ? c = s[i] : i !== "value" ? c = /* @__PURE__ */ o(() => e[n], "original") : c = e[n], c && P9(c) && (c = c[Ut].getOriginal());
  let u = /* @__PURE__ */ o((m) => {
    let { value: y, ...g } = s || {
      configurable: !0,
      writable: !0
    };
    i !== "value" && delete g.writable, g[i] = m, lo(e, n, g);
  }, "reassign"), d = /* @__PURE__ */ o(() => {
    a !== e ? Reflect.deleteProperty(e, n) : s && !c ? lo(e, n, s) : u(c);
  }, "restore");
  r || (r = c);
  let f = _9(w9(r), r);
  i === "value" && OR(f, c);
  let h = f[Ut];
  return un(h, "restore", d), un(h, "getOriginal", () => l ? c() : c), un(h, "willCall", (m) => (h.impl = m, f)), u(
    l ? () => (OR(f, r), f) : f
  ), y9.add(f), f;
}
o(yb, "internalSpyOn");
var C9 = /* @__PURE__ */ new Set([
  "length",
  "name",
  "prototype"
]);
function x9(e) {
  let t = /* @__PURE__ */ new Set(), r = {};
  for (; e && e !== Object.prototype && e !== Function.prototype; ) {
    let n = [
      ...Object.getOwnPropertyNames(e),
      ...Object.getOwnPropertySymbols(e)
    ];
    for (let i of n)
      r[i] || C9.has(i) || (t.add(i), r[i] = Object.getOwnPropertyDescriptor(e, i));
    e = Object.getPrototypeOf(e);
  }
  return {
    properties: t,
    descriptors: r
  };
}
o(x9, "getAllProperties");
function _9(e, t) {
  if (!t || // the original is already a spy, so it has all the properties
  Ut in t)
    return e;
  let { properties: r, descriptors: n } = x9(t);
  for (let i of r) {
    let a = n[i];
    SR(e, i) || lo(e, i, a);
  }
  return e;
}
o(_9, "wrap");
function P9(e) {
  return E9(e) && "getOriginal" in e[Ut];
}
o(P9, "isSpyFunction");

// ../node_modules/@vitest/spy/dist/index.js
var uo = /* @__PURE__ */ new Set();
function cn(e) {
  return typeof e == "function" && "_isMockFunction" in e && e._isMockFunction;
}
o(cn, "isMockFunction");
function MR(e, t, r) {
  let i = r ? { [{
    get: "getter",
    set: "setter"
  }[r]]: t } : t, a, s = T9(e, t), l = s && s[r || "value"];
  cn(l) && (a = l.mock._state());
  try {
    let c = yb(e, i), u = AR(c);
    return a && u.mock._state(a), u;
  } catch (c) {
    throw c instanceof TypeError && Symbol.toStringTag && e[Symbol.toStringTag] === "Module" && (c.message.includes("Cannot redefine propert\
y") || c.message.includes("Cannot replace module namespace") || c.message.includes("can't redefine non-configurable property")) ? new TypeError(
    `Cannot spy on export "${String(i)}". Module namespace is not configurable in ESM. See: https://vitest.dev/guide/browser/#limitations`, {
    cause: c }) : c;
  }
}
o(MR, "spyOn");
var R9 = 0;
function AR(e) {
  let t = e, r, n = [], i = !1, a = [], s = [], l = [], c = Zl(e), u = {
    get calls() {
      return c.calls;
    },
    get contexts() {
      return s;
    },
    get instances() {
      return a;
    },
    get invocationCallOrder() {
      return l;
    },
    get results() {
      return c.results.map(([m, y]) => ({
        type: m === "error" ? "throw" : "return",
        value: y
      }));
    },
    get settledResults() {
      return c.resolves.map(([m, y]) => ({
        type: m === "error" ? "rejected" : "fulfilled",
        value: y
      }));
    },
    get lastCall() {
      return c.calls[c.calls.length - 1];
    },
    _state(m) {
      return m && (r = m.implementation, n = m.onceImplementations, i = m.implementationChangedTemporarily), {
        implementation: r,
        onceImplementations: n,
        implementationChangedTemporarily: i
      };
    }
  };
  function d(...m) {
    return a.push(this), s.push(this), l.push(++R9), (i ? r : n.shift() || r || c.getOriginal() || (() => {
    })).apply(this, m);
  }
  o(d, "mockCall");
  let f = t.name;
  t.getMockName = () => f || "vi.fn()", t.mockName = (m) => (f = m, t), t.mockClear = () => (c.reset(), a = [], s = [], l = [], t), t.mockReset =
  () => (t.mockClear(), r = void 0, n = [], t), t.mockRestore = () => (t.mockReset(), c.restore(), t), Symbol.dispose && (t[Symbol.dispose] =
  () => t.mockRestore()), t.getMockImplementation = () => i ? r : n.at(0) || r, t.mockImplementation = (m) => (r = m, c.willCall(d), t), t.mockImplementationOnce =
  (m) => (n.push(m), t);
  function h(m, y) {
    let g = r;
    r = m, c.willCall(d), i = !0;
    let x = /* @__PURE__ */ o(() => {
      r = g, i = !1;
    }, "reset"), b = y();
    return typeof b == "object" && b && typeof b.then == "function" ? b.then(() => (x(), t)) : (x(), t);
  }
  return o(h, "withImplementation"), t.withImplementation = h, t.mockReturnThis = () => t.mockImplementation(function() {
    return this;
  }), t.mockReturnValue = (m) => t.mockImplementation(() => m), t.mockReturnValueOnce = (m) => t.mockImplementationOnce(() => m), t.mockResolvedValue =
  (m) => t.mockImplementation(() => Promise.resolve(m)), t.mockResolvedValueOnce = (m) => t.mockImplementationOnce(() => Promise.resolve(m)),
  t.mockRejectedValue = (m) => t.mockImplementation(() => Promise.reject(m)), t.mockRejectedValueOnce = (m) => t.mockImplementationOnce(() => Promise.
  reject(m)), Object.defineProperty(t, "mock", { get: /* @__PURE__ */ o(() => u, "get") }), c.willCall(d), uo.add(t), t;
}
o(AR, "enhanceSpy");
function gb(e) {
  let t = AR(yb({ spy: e || function() {
  } }, "spy"));
  return e && t.mockImplementation(e), t;
}
o(gb, "fn");
function T9(e, t) {
  let r = Object.getOwnPropertyDescriptor(e, t);
  if (r)
    return r;
  let n = Object.getPrototypeOf(e);
  for (; n !== null; ) {
    let i = Object.getOwnPropertyDescriptor(n, t);
    if (i)
      return i;
    n = Object.getPrototypeOf(n);
  }
}
o(T9, "getDescriptor");

// ../node_modules/@vitest/utils/dist/error.js
var O9 = "@@__IMMUTABLE_RECORD__@@", S9 = "@@__IMMUTABLE_ITERABLE__@@";
function M9(e) {
  return e && (e[S9] || e[O9]);
}
o(M9, "isImmutable");
var A9 = Object.getPrototypeOf({});
function NR(e) {
  return e instanceof Error ? `<unserializable>: ${e.message}` : typeof e == "string" ? `<unserializable>: ${e}` : "<unserializable>";
}
o(NR, "getUnserializableMessage");
function Ht(e, t = /* @__PURE__ */ new WeakMap()) {
  if (!e || typeof e == "string")
    return e;
  if (e instanceof Error && "toJSON" in e && typeof e.toJSON == "function") {
    let r = e.toJSON();
    return r && r !== e && typeof r == "object" && (typeof e.message == "string" && eu(() => r.message ?? (r.message = e.message)), typeof e.
    stack == "string" && eu(() => r.stack ?? (r.stack = e.stack)), typeof e.name == "string" && eu(() => r.name ?? (r.name = e.name)), e.cause !=
    null && eu(() => r.cause ?? (r.cause = Ht(e.cause, t)))), Ht(r, t);
  }
  if (typeof e == "function")
    return `Function<${e.name || "anonymous"}>`;
  if (typeof e == "symbol")
    return e.toString();
  if (typeof e != "object")
    return e;
  if (typeof Buffer < "u" && e instanceof Buffer)
    return `<Buffer(${e.length}) ...>`;
  if (typeof Uint8Array < "u" && e instanceof Uint8Array)
    return `<Uint8Array(${e.length}) ...>`;
  if (M9(e))
    return Ht(e.toJSON(), t);
  if (e instanceof Promise || e.constructor && e.constructor.prototype === "AsyncFunction")
    return "Promise";
  if (typeof Element < "u" && e instanceof Element)
    return e.tagName;
  if (typeof e.asymmetricMatch == "function")
    return `${e.toString()} ${nb(e.sample)}`;
  if (typeof e.toJSON == "function")
    return Ht(e.toJSON(), t);
  if (t.has(e))
    return t.get(e);
  if (Array.isArray(e)) {
    let r = new Array(e.length);
    return t.set(e, r), e.forEach((n, i) => {
      try {
        r[i] = Ht(n, t);
      } catch (a) {
        r[i] = NR(a);
      }
    }), r;
  } else {
    let r = /* @__PURE__ */ Object.create(null);
    t.set(e, r);
    let n = e;
    for (; n && n !== A9; )
      Object.getOwnPropertyNames(n).forEach((i) => {
        if (!(i in r))
          try {
            r[i] = Ht(e[i], t);
          } catch (a) {
            delete r[i], r[i] = NR(a);
          }
      }), n = Object.getPrototypeOf(n);
    return r;
  }
}
o(Ht, "serializeValue");
function eu(e) {
  try {
    return e();
  } catch {
  }
}
o(eu, "safe");
function N9(e) {
  return e.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, "");
}
o(N9, "normalizeErrorMessage");
function vb(e, t, r = /* @__PURE__ */ new WeakSet()) {
  if (!e || typeof e != "object")
    return { message: String(e) };
  let n = e;
  (n.showDiff || n.showDiff === void 0 && n.expected !== void 0 && n.actual !== void 0) && (n.diff = Jl(n.actual, n.expected, {
    ...t,
    ...n.diffOptions
  })), "expected" in n && typeof n.expected != "string" && (n.expected = Ae(n.expected, 10)), "actual" in n && typeof n.actual != "string" &&
  (n.actual = Ae(n.actual, 10));
  try {
    typeof n.message == "string" && (n.message = N9(n.message));
  } catch {
  }
  try {
    !r.has(n) && typeof n.cause == "object" && (r.add(n), n.cause = vb(n.cause, t, r));
  } catch {
  }
  try {
    return Ht(n);
  } catch (i) {
    return Ht(new Error(`Failed to fully serialize error: ${i?.message}
Inner error message: ${n?.message}`));
  }
}
o(vb, "processError");

// ../node_modules/@vitest/expect/dist/index.js
var po = Symbol.for("matchers-object"), mo = Symbol.for("$$jest-matchers-object-storybook"), lu = Symbol.for("expect-global"), Cb = Symbol.for(
"asymmetric-matchers-object"), HR = {
  toSatisfy(e, t, r) {
    let { printReceived: n, printExpected: i, matcherHint: a } = this.utils, s = t(e);
    return {
      pass: s,
      message: /* @__PURE__ */ o(() => s ? `${a(".not.toSatisfy", "received", "")}

Expected value to not satisfy:
${r || i(t)}
Received:
${n(e)}` : `${a(".toSatisfy", "received", "")}

Expected value to satisfy:
${r || i(t)}

Received:
${n(e)}`, "message")
    };
  },
  toBeOneOf(e, t) {
    let { equals: r, customTesters: n } = this, { printReceived: i, printExpected: a, matcherHint: s } = this.utils;
    if (!Array.isArray(t))
      throw new TypeError(`You must provide an array to ${s(".toBeOneOf")}, not '${typeof t}'.`);
    let l = t.length === 0 || t.some((c) => r(c, e, n));
    return {
      pass: l,
      message: /* @__PURE__ */ o(() => l ? `${s(".not.toBeOneOf", "received", "")}

Expected value to not be one of:
${a(t)}
Received:
${i(e)}` : `${s(".toBeOneOf", "received", "")}

Expected value to be one of:
${a(t)}

Received:
${i(e)}`, "message")
    };
  }
}, tu = de.green, qb = de.red, I9 = de.inverse, j9 = de.bold, Vt = de.dim;
function k9(e, t = "received", r = "expected", n = {}) {
  let { comment: i = "", isDirectExpectCall: a = !1, isNot: s = !1, promise: l = "", secondArgument: c = "", expectedColor: u = tu, receivedColor: d = qb,
  secondArgumentColor: f = tu } = n, h = "", m = "expect";
  return !a && t !== "" && (h += Vt(`${m}(`) + d(t), m = ")"), l !== "" && (h += Vt(`${m}.`) + l, m = ""), s && (h += `${Vt(`${m}.`)}not`, m =
  ""), e.includes(".") ? m += e : (h += Vt(`${m}.`) + e, m = ""), r === "" ? m += "()" : (h += Vt(`${m}(`) + u(r), c && (h += Vt(", ") + f(c)),
  m = ")"), i !== "" && (m += ` // ${i}`), m !== "" && (h += Vt(m)), h;
}
o(k9, "matcherHint");
var L9 = "\xB7";
function VR(e) {
  return e.replace(/\s+$/gm, (t) => L9.repeat(t.length));
}
o(VR, "replaceTrailingSpaces");
function $9(e) {
  return qb(VR(Ae(e)));
}
o($9, "printReceived");
function B9(e) {
  return tu(VR(Ae(e)));
}
o(B9, "printExpected");
function zR() {
  return {
    EXPECTED_COLOR: tu,
    RECEIVED_COLOR: qb,
    INVERTED_COLOR: I9,
    BOLD_WEIGHT: j9,
    DIM_COLOR: Vt,
    diff: Er,
    matcherHint: k9,
    printReceived: $9,
    printExpected: B9,
    printDiffOrStringify: Jl,
    printWithType: D9
  };
}
o(zR, "getMatcherUtils");
function D9(e, t, r) {
  let n = vr(t), i = n !== "null" && n !== "undefined" ? `${e} has type:  ${n}
` : "", a = `${e} has value: ${r(t)}`;
  return i + a;
}
o(D9, "printWithType");
function Rb() {
  return globalThis[mo].customEqualityTesters;
}
o(Rb, "getCustomEqualityTesters");
function oe(e, t, r, n) {
  return r = r || [], co(e, t, [], [], r, n ? WR : H9);
}
o(oe, "equals");
var Qhe = Function.prototype.toString;
function IR(e) {
  return !!e && typeof e == "object" && "asymmetricMatch" in e && ct("Function", e.asymmetricMatch);
}
o(IR, "isAsymmetric");
function F9(e, t) {
  let r = IR(e), n = IR(t);
  if (!(r && n)) {
    if (r)
      return e.asymmetricMatch(t);
    if (n)
      return t.asymmetricMatch(e);
  }
}
o(F9, "asymmetricMatch");
function co(e, t, r, n, i, a) {
  let s = !0, l = F9(e, t);
  if (l !== void 0)
    return l;
  let c = { equals: oe };
  for (let y = 0; y < i.length; y++) {
    let g = i[y].call(c, e, t, i);
    if (g !== void 0)
      return g;
  }
  if (typeof URL == "function" && e instanceof URL && t instanceof URL)
    return e.href === t.href;
  if (Object.is(e, t))
    return !0;
  if (e === null || t === null)
    return e === t;
  let u = Object.prototype.toString.call(e);
  if (u !== Object.prototype.toString.call(t))
    return !1;
  switch (u) {
    case "[object Boolean]":
    case "[object String]":
    case "[object Number]":
      return typeof e != typeof t ? !1 : typeof e != "object" && typeof t != "object" ? Object.is(e, t) : Object.is(e.valueOf(), t.valueOf());
    case "[object Date]": {
      let y = +e, g = +t;
      return y === g || Number.isNaN(y) && Number.isNaN(g);
    }
    case "[object RegExp]":
      return e.source === t.source && e.flags === t.flags;
    case "[object Temporal.Instant]":
    case "[object Temporal.ZonedDateTime]":
    case "[object Temporal.PlainDateTime]":
    case "[object Temporal.PlainDate]":
    case "[object Temporal.PlainTime]":
    case "[object Temporal.PlainYearMonth]":
    case "[object Temporal.PlainMonthDay]":
      return e.equals(t);
    case "[object Temporal.Duration]":
      return e.toString() === t.toString();
  }
  if (typeof e != "object" || typeof t != "object")
    return !1;
  if (kR(e) && kR(t))
    return e.isEqualNode(t);
  let d = r.length;
  for (; d--; ) {
    if (r[d] === e)
      return n[d] === t;
    if (n[d] === t)
      return !1;
  }
  if (r.push(e), n.push(t), u === "[object Array]" && e.length !== t.length)
    return !1;
  if (e instanceof Error && t instanceof Error)
    try {
      return U9(e, t, r, n, i, a);
    } finally {
      r.pop(), n.pop();
    }
  let f = jR(e, a), h, m = f.length;
  if (jR(t, a).length !== m)
    return !1;
  for (; m--; )
    if (h = f[m], s = a(t, h) && co(e[h], t[h], r, n, i, a), !s)
      return !1;
  return r.pop(), n.pop(), s;
}
o(co, "eq");
function U9(e, t, r, n, i, a) {
  let s = Object.getPrototypeOf(e) === Object.getPrototypeOf(t) && e.name === t.name && e.message === t.message;
  return typeof t.cause < "u" && s && (s = co(e.cause, t.cause, r, n, i, a)), e instanceof AggregateError && t instanceof AggregateError && s &&
  (s = co(e.errors, t.errors, r, n, i, a)), s && (s = co({ ...e }, { ...t }, r, n, i, a)), s;
}
o(U9, "isErrorEqual");
function jR(e, t) {
  let r = [];
  for (let n in e)
    t(e, n) && r.push(n);
  return r.concat(Object.getOwnPropertySymbols(e).filter((n) => Object.getOwnPropertyDescriptor(e, n).enumerable));
}
o(jR, "keys");
function H9(e, t) {
  return WR(e, t) && e[t] !== void 0;
}
o(H9, "hasDefinedKey");
function WR(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
o(WR, "hasKey");
function ct(e, t) {
  return Object.prototype.toString.apply(t) === `[object ${e}]`;
}
o(ct, "isA");
function kR(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && typeof e.nodeType == "number" && "nodeName" in e && typeof e.nodeName == "\
string" && "isEqualNode" in e && typeof e.isEqualNode == "function";
}
o(kR, "isDomNode");
var GR = "@@__IMMUTABLE_KEYED__@@", KR = "@@__IMMUTABLE_SET__@@", V9 = "@@__IMMUTABLE_LIST__@@", uu = "@@__IMMUTABLE_ORDERED__@@", z9 = "@@_\
_IMMUTABLE_RECORD__@@";
function W9(e) {
  return !!(e && e[GR] && !e[uu]);
}
o(W9, "isImmutableUnorderedKeyed");
function G9(e) {
  return !!(e && e[KR] && !e[uu]);
}
o(G9, "isImmutableUnorderedSet");
function cu(e) {
  return e != null && typeof e == "object" && !Array.isArray(e);
}
o(cu, "isObjectLiteral");
function K9(e) {
  return !!(e && cu(e) && e[V9]);
}
o(K9, "isImmutableList");
function Y9(e) {
  return !!(e && cu(e) && e[GR] && e[uu]);
}
o(Y9, "isImmutableOrderedKeyed");
function X9(e) {
  return !!(e && cu(e) && e[KR] && e[uu]);
}
o(X9, "isImmutableOrderedSet");
function J9(e) {
  return !!(e && cu(e) && e[z9]);
}
o(J9, "isImmutableRecord");
var YR = Symbol.iterator;
function LR(e) {
  return !!(e != null && e[YR]);
}
o(LR, "hasIterator");
function rt(e, t, r = [], n = [], i = []) {
  if (typeof e != "object" || typeof t != "object" || Array.isArray(e) || Array.isArray(t) || !LR(e) || !LR(t))
    return;
  if (e.constructor !== t.constructor)
    return !1;
  let a = n.length;
  for (; a--; )
    if (n[a] === e)
      return i[a] === t;
  n.push(e), i.push(t);
  let s = [...r.filter((u) => u !== rt), l];
  function l(u, d) {
    return rt(u, d, [...r], [...n], [...i]);
  }
  if (o(l, "iterableEqualityWithStack"), e.size !== void 0) {
    if (e.size !== t.size)
      return !1;
    if (ct("Set", e) || G9(e)) {
      let u = !0;
      for (let d of e)
        if (!t.has(d)) {
          let f = !1;
          for (let h of t)
            oe(d, h, s) === !0 && (f = !0);
          if (f === !1) {
            u = !1;
            break;
          }
        }
      return n.pop(), i.pop(), u;
    } else if (ct("Map", e) || W9(e)) {
      let u = !0;
      for (let d of e)
        if (!t.has(d[0]) || !oe(d[1], t.get(d[0]), s)) {
          let f = !1;
          for (let h of t) {
            let m = oe(d[0], h[0], s), y = !1;
            m === !0 && (y = oe(d[1], h[1], s)), y === !0 && (f = !0);
          }
          if (f === !1) {
            u = !1;
            break;
          }
        }
      return n.pop(), i.pop(), u;
    }
  }
  let c = t[YR]();
  for (let u of e) {
    let d = c.next();
    if (d.done || !oe(u, d.value, s))
      return !1;
  }
  if (!c.next().done)
    return !1;
  if (!K9(e) && !Y9(e) && !X9(e) && !J9(e)) {
    let u = Object.entries(e), d = Object.entries(t);
    if (!oe(u, d, s))
      return !1;
  }
  return n.pop(), i.pop(), !0;
}
o(rt, "iterableEquality");
function Tb(e, t) {
  return !e || typeof e != "object" || e === Object.prototype ? !1 : Object.prototype.hasOwnProperty.call(e, t) || Tb(Object.getPrototypeOf(
  e), t);
}
o(Tb, "hasPropertyInObject");
function Q9(e) {
  return an(e) && !(e instanceof Error) && !Array.isArray(e) && !(e instanceof Date);
}
o(Q9, "isObjectWithKeys");
function ho(e, t, r = []) {
  let n = r.filter((a) => a !== ho), i = /* @__PURE__ */ o((a = /* @__PURE__ */ new WeakMap()) => (s, l) => {
    if (Q9(l))
      return Object.keys(l).every((c) => {
        if (l[c] != null && typeof l[c] == "object") {
          if (a.has(l[c]))
            return oe(s[c], l[c], n);
          a.set(l[c], !0);
        }
        let u = s != null && Tb(s, c) && oe(s[c], l[c], [...n, i(a)]);
        return a.delete(l[c]), u;
      });
  }, "subsetEqualityWithContext");
  return i()(e, t);
}
o(ho, "subsetEquality");
function $R(e, t) {
  if (!(e == null || t == null || e.constructor === t.constructor))
    return !1;
}
o($R, "typeEquality");
function BR(e, t) {
  let r = e, n = t;
  if (!(e instanceof DataView && t instanceof DataView)) {
    if (!(e instanceof ArrayBuffer) || !(t instanceof ArrayBuffer))
      return;
    try {
      r = new DataView(e), n = new DataView(t);
    } catch {
      return;
    }
  }
  if (r.byteLength !== n.byteLength)
    return !1;
  for (let i = 0; i < r.byteLength; i++)
    if (r.getUint8(i) !== n.getUint8(i))
      return !1;
  return !0;
}
o(BR, "arrayBufferEquality");
function xb(e, t, r = []) {
  if (!Array.isArray(e) || !Array.isArray(t))
    return;
  let n = Object.keys(e), i = Object.keys(t), a = r.filter((s) => s !== xb);
  return oe(e, t, a, !0) && oe(n, i);
}
o(xb, "sparseArrayEquality");
function Z9(e, t = "#{this}", r = "#{exp}") {
  let n = `expected ${t} to be ${r} // Object.is equality`;
  return ["toStrictEqual", "toEqual"].includes(e) ? `${n}

If it should pass with deep equality, replace "toBe" with "${e}"

Expected: ${t}
Received: serializes to the same string
` : n;
}
o(Z9, "generateToBeMessage");
function e8(e, t) {
  return `${t} ${e}${t === 1 ? "" : "s"}`;
}
o(e8, "pluralize");
function wb(e) {
  return [...Object.keys(e), ...Object.getOwnPropertySymbols(e).filter((t) => {
    var r;
    return (r = Object.getOwnPropertyDescriptor(e, t)) === null || r === void 0 ? void 0 : r.enumerable;
  })];
}
o(wb, "getObjectKeys");
function t8(e, t, r) {
  let n = 0, i = /* @__PURE__ */ o((a = /* @__PURE__ */ new WeakMap()) => (s, l) => {
    if (Array.isArray(s)) {
      if (Array.isArray(l) && l.length === s.length)
        return l.map((c, u) => i(a)(s[u], c));
    } else {
      if (s instanceof Date)
        return s;
      if (an(s) && an(l)) {
        if (oe(s, l, [
          ...r,
          rt,
          ho
        ]))
          return l;
        let c = {};
        a.set(s, c), typeof s.constructor == "function" && typeof s.constructor.name == "string" && Object.defineProperty(c, "constructor", {
          enumerable: !1,
          value: s.constructor
        });
        for (let u of wb(s))
          Tb(l, u) ? c[u] = a.has(s[u]) ? a.get(s[u]) : i(a)(s[u], l[u]) : a.has(s[u]) || (n += 1, an(s[u]) && (n += wb(s[u]).length), i(a)(
          s[u], l[u]));
        if (wb(c).length > 0)
          return c;
      }
    }
    return s;
  }, "getObjectSubsetWithContext");
  return {
    subset: i()(e, t),
    stripped: n
  };
}
o(t8, "getObjectSubset");
if (!Object.prototype.hasOwnProperty.call(globalThis, po)) {
  let e = /* @__PURE__ */ new WeakMap();
  Object.defineProperty(globalThis, po, { get: /* @__PURE__ */ o(() => e, "get") });
}
if (!Object.prototype.hasOwnProperty.call(globalThis, mo)) {
  let e = /* @__PURE__ */ Object.create(null), t = [];
  Object.defineProperty(globalThis, mo, {
    configurable: !0,
    get: /* @__PURE__ */ o(() => ({
      state: globalThis[po].get(globalThis[lu]),
      matchers: e,
      customEqualityTesters: t
    }), "get")
  });
}
if (!Object.prototype.hasOwnProperty.call(globalThis, Cb)) {
  let e = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(globalThis, Cb, { get: /* @__PURE__ */ o(() => e, "get") });
}
function bo(e) {
  return globalThis[po].get(e);
}
o(bo, "getState");
function du(e, t) {
  let r = globalThis[po], n = r.get(t) || {}, i = Object.defineProperties(n, {
    ...Object.getOwnPropertyDescriptors(n),
    ...Object.getOwnPropertyDescriptors(e)
  });
  r.set(t, i);
}
o(du, "setState");
var Ob = class Ob {
  // should have "jest" to be compatible with its ecosystem
  $$typeof = Symbol.for("jest.asymmetricMatcher");
  constructor(t, r = !1) {
    this.sample = t, this.inverse = r;
  }
  getMatcherContext(t) {
    return {
      ...bo(t || globalThis[lu]),
      equals: oe,
      isNot: this.inverse,
      customTesters: Rb(),
      utils: {
        ...zR(),
        diff: Er,
        stringify: Ae,
        iterableEquality: rt,
        subsetEquality: ho
      }
    };
  }
};
o(Ob, "AsymmetricMatcher");
var dt = Ob;
dt.prototype[Symbol.for("chai/inspect")] = function(e) {
  let t = Ae(this, e.depth, { min: !0 });
  return t.length <= e.truncate ? t : `${this.toString()}{\u2026}`;
};
var Sb = class Sb extends dt {
  constructor(t, r = !1) {
    if (!ct("String", t))
      throw new Error("Expected is not a string");
    super(t, r);
  }
  asymmetricMatch(t) {
    let r = ct("String", t) && t.includes(this.sample);
    return this.inverse ? !r : r;
  }
  toString() {
    return `String${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "string";
  }
};
o(Sb, "StringContaining");
var ru = Sb, Mb = class Mb extends dt {
  asymmetricMatch(t) {
    return t != null;
  }
  toString() {
    return "Anything";
  }
  toAsymmetricMatcher() {
    return "Anything";
  }
};
o(Mb, "Anything");
var _b = Mb, Ab = class Ab extends dt {
  constructor(t, r = !1) {
    super(t, r);
  }
  getPrototype(t) {
    return Object.getPrototypeOf ? Object.getPrototypeOf(t) : t.constructor.prototype === t ? null : t.constructor.prototype;
  }
  hasProperty(t, r) {
    return t ? Object.prototype.hasOwnProperty.call(t, r) ? !0 : this.hasProperty(this.getPrototype(t), r) : !1;
  }
  asymmetricMatch(t) {
    if (typeof this.sample != "object")
      throw new TypeError(`You must provide an object to ${this.toString()}, not '${typeof this.sample}'.`);
    let r = !0, n = this.getMatcherContext();
    for (let i in this.sample)
      if (!this.hasProperty(t, i) || !oe(this.sample[i], t[i], n.customTesters)) {
        r = !1;
        break;
      }
    return this.inverse ? !r : r;
  }
  toString() {
    return `Object${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "object";
  }
};
o(Ab, "ObjectContaining");
var nu = Ab, Nb = class Nb extends dt {
  constructor(t, r = !1) {
    super(t, r);
  }
  asymmetricMatch(t) {
    if (!Array.isArray(this.sample))
      throw new TypeError(`You must provide an array to ${this.toString()}, not '${typeof this.sample}'.`);
    let r = this.getMatcherContext(), n = this.sample.length === 0 || Array.isArray(t) && this.sample.every((i) => t.some((a) => oe(i, a, r.
    customTesters)));
    return this.inverse ? !n : n;
  }
  toString() {
    return `Array${this.inverse ? "Not" : ""}Containing`;
  }
  getExpectedType() {
    return "array";
  }
};
o(Nb, "ArrayContaining");
var ou = Nb, Ib = class Ib extends dt {
  constructor(t) {
    if (typeof t > "u")
      throw new TypeError("any() expects to be passed a constructor function. Please pass one or use anything() to match any object.");
    super(t);
  }
  fnNameFor(t) {
    if (t.name)
      return t.name;
    let n = Function.prototype.toString.call(t).match(/^(?:async)?\s*function\s*(?:\*\s*)?([\w$]+)\s*\(/);
    return n ? n[1] : "<anonymous>";
  }
  asymmetricMatch(t) {
    return this.sample === String ? typeof t == "string" || t instanceof String : this.sample === Number ? typeof t == "number" || t instanceof
    Number : this.sample === Function ? typeof t == "function" || typeof t == "function" : this.sample === Boolean ? typeof t == "boolean" ||
    t instanceof Boolean : this.sample === BigInt ? typeof t == "bigint" || t instanceof BigInt : this.sample === Symbol ? typeof t == "symb\
ol" || t instanceof Symbol : this.sample === Object ? typeof t == "object" : t instanceof this.sample;
  }
  toString() {
    return "Any";
  }
  getExpectedType() {
    return this.sample === String ? "string" : this.sample === Number ? "number" : this.sample === Function ? "function" : this.sample === Object ?
    "object" : this.sample === Boolean ? "boolean" : this.fnNameFor(this.sample);
  }
  toAsymmetricMatcher() {
    return `Any<${this.fnNameFor(this.sample)}>`;
  }
};
o(Ib, "Any");
var Pb = Ib, jb = class jb extends dt {
  constructor(t, r = !1) {
    if (!ct("String", t) && !ct("RegExp", t))
      throw new Error("Expected is not a String or a RegExp");
    super(new RegExp(t), r);
  }
  asymmetricMatch(t) {
    let r = ct("String", t) && this.sample.test(t);
    return this.inverse ? !r : r;
  }
  toString() {
    return `String${this.inverse ? "Not" : ""}Matching`;
  }
  getExpectedType() {
    return "string";
  }
};
o(jb, "StringMatching");
var iu = jb, kb = class kb extends dt {
  precision;
  constructor(t, r = 2, n = !1) {
    if (!ct("Number", t))
      throw new Error("Expected is not a Number");
    if (!ct("Number", r))
      throw new Error("Precision is not a Number");
    super(t), this.inverse = n, this.precision = r;
  }
  asymmetricMatch(t) {
    if (!ct("Number", t))
      return !1;
    let r = !1;
    return t === Number.POSITIVE_INFINITY && this.sample === Number.POSITIVE_INFINITY || t === Number.NEGATIVE_INFINITY && this.sample === Number.
    NEGATIVE_INFINITY ? r = !0 : r = Math.abs(this.sample - t) < 10 ** -this.precision / 2, this.inverse ? !r : r;
  }
  toString() {
    return `Number${this.inverse ? "Not" : ""}CloseTo`;
  }
  getExpectedType() {
    return "number";
  }
  toAsymmetricMatcher() {
    return [
      this.toString(),
      this.sample,
      `(${e8("digit", this.precision)})`
    ].join(" ");
  }
};
o(kb, "CloseTo");
var au = kb, XR = /* @__PURE__ */ o((e, t) => {
  t.addMethod(e.expect, "anything", () => new _b()), t.addMethod(e.expect, "any", (r) => new Pb(r)), t.addMethod(e.expect, "stringContaining",
  (r) => new ru(r)), t.addMethod(e.expect, "objectContaining", (r) => new nu(r)), t.addMethod(e.expect, "arrayContaining", (r) => new ou(r)),
  t.addMethod(e.expect, "stringMatching", (r) => new iu(r)), t.addMethod(e.expect, "closeTo", (r, n) => new au(r, n)), e.expect.not = {
    stringContaining: /* @__PURE__ */ o((r) => new ru(r, !0), "stringContaining"),
    objectContaining: /* @__PURE__ */ o((r) => new nu(r, !0), "objectContaining"),
    arrayContaining: /* @__PURE__ */ o((r) => new ou(r, !0), "arrayContaining"),
    stringMatching: /* @__PURE__ */ o((r) => new iu(r, !0), "stringMatching"),
    closeTo: /* @__PURE__ */ o((r, n) => new au(r, n, !0), "closeTo")
  };
}, "JestAsymmetricMatchers");
function DR(e, t, r) {
  let n = e.flag(t, "negate") ? "not." : "", i = `${e.flag(t, "_name")}(${r ? "expected" : ""})`, a = e.flag(t, "promise");
  return `expect(actual)${a ? `.${a}` : ""}.${n}${i}`;
}
o(DR, "createAssertionMessage");
function FR(e, t, r, n) {
  let i = e;
  if (i && t instanceof Promise) {
    t = t.finally(() => {
      if (!i.promises)
        return;
      let s = i.promises.indexOf(t);
      s !== -1 && i.promises.splice(s, 1);
    }), i.promises || (i.promises = []), i.promises.push(t);
    let a = !1;
    return i.onFinished ?? (i.onFinished = []), i.onFinished.push(() => {
      if (!a) {
        var s;
        let c = (((s = globalThis.__vitest_worker__) === null || s === void 0 ? void 0 : s.onFilterStackTrace) || ((u) => u || ""))(n.stack);
        console.warn([
          `Promise returned by \`${r}\` was not awaited. `,
          "Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. ",
          `Please remember to await the assertion.
`,
          c
        ].join(""));
      }
    }), {
      then(s, l) {
        return a = !0, t.then(s, l);
      },
      catch(s) {
        return t.catch(s);
      },
      finally(s) {
        return t.finally(s);
      },
      [Symbol.toStringTag]: "Promise"
    };
  }
  return t;
}
o(FR, "recordAsyncExpect");
function UR(e, t) {
  var r;
  e.result || (e.result = { state: "fail" }), e.result.state = "fail", (r = e.result).errors || (r.errors = []), e.result.errors.push(vb(t));
}
o(UR, "handleTestError");
function JR(e, t, r) {
  return function(...n) {
    if (t !== "withTest" && e.flag(this, "_name", t), !e.flag(this, "soft"))
      return r.apply(this, n);
    let i = e.flag(this, "vitest-test");
    if (!i)
      throw new Error("expect.soft() can only be used inside a test");
    try {
      let a = r.apply(this, n);
      return a && typeof a == "object" && typeof a.then == "function" ? a.then(ob, (s) => {
        UR(i, s);
      }) : a;
    } catch (a) {
      UR(i, a);
    }
  };
}
o(JR, "wrapAssertion");
var QR = /* @__PURE__ */ o((e, t) => {
  let { AssertionError: r } = e, n = Rb();
  function i(u, d) {
    let f = /* @__PURE__ */ o((h) => {
      let m = JR(t, h, d);
      t.addMethod(e.Assertion.prototype, h, m), t.addMethod(globalThis[mo].matchers, h, m);
    }, "addMethod");
    Array.isArray(u) ? u.forEach((h) => f(h)) : f(u);
  }
  o(i, "def"), [
    "throw",
    "throws",
    "Throw"
  ].forEach((u) => {
    t.overwriteMethod(e.Assertion.prototype, u, (d) => function(...f) {
      let h = t.flag(this, "promise"), m = t.flag(this, "object"), y = t.flag(this, "negate");
      if (h === "rejects")
        t.flag(this, "object", () => {
          throw m;
        });
      else if (h === "resolves" && typeof m != "function") {
        if (y)
          return;
        {
          let g = t.flag(this, "message") || "expected promise to throw an error, but it didn't", x = { showDiff: !1 };
          throw new r(g, x, t.flag(this, "ssfi"));
        }
      }
      d.apply(this, f);
    });
  }), i("withTest", function(u) {
    return t.flag(this, "vitest-test", u), this;
  }), i("toEqual", function(u) {
    let d = t.flag(this, "object"), f = oe(d, u, [...n, rt]);
    return this.assert(f, "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", u, d);
  }), i("toStrictEqual", function(u) {
    let d = t.flag(this, "object"), f = oe(d, u, [
      ...n,
      rt,
      $R,
      xb,
      BR
    ], !0);
    return this.assert(f, "expected #{this} to strictly equal #{exp}", "expected #{this} to not strictly equal #{exp}", u, d);
  }), i("toBe", function(u) {
    let d = this._obj, f = Object.is(d, u), h = "";
    return f || (oe(d, u, [
      ...n,
      rt,
      $R,
      xb,
      BR
    ], !0) ? h = "toStrictEqual" : oe(d, u, [...n, rt]) && (h = "toEqual")), this.assert(f, Z9(h), "expected #{this} not to be #{exp} // Obj\
ect.is equality", u, d);
  }), i("toMatchObject", function(u) {
    let d = this._obj, f = oe(d, u, [
      ...n,
      rt,
      ho
    ]), h = t.flag(this, "negate"), { subset: m, stripped: y } = t8(d, u, n);
    if (f && h || !f && !h) {
      let g = t.getMessage(this, [
        f,
        "expected #{this} to match object #{exp}",
        "expected #{this} to not match object #{exp}",
        u,
        m,
        !1
      ]), x = y === 0 ? g : `${g}
(${y} matching ${y === 1 ? "property" : "properties"} omitted from actual)`;
      throw new r(x, {
        showDiff: !0,
        expected: u,
        actual: m
      });
    }
  }), i("toMatch", function(u) {
    let d = this._obj;
    if (typeof d != "string")
      throw new TypeError(`.toMatch() expects to receive a string, but got ${typeof d}`);
    return this.assert(typeof u == "string" ? d.includes(u) : d.match(u), "expected #{this} to match #{exp}", "expected #{this} not to match\
 #{exp}", u, d);
  }), i("toContain", function(u) {
    let d = this._obj;
    if (typeof Node < "u" && d instanceof Node) {
      if (!(u instanceof Node))
        throw new TypeError(`toContain() expected a DOM node as the argument, but got ${typeof u}`);
      return this.assert(d.contains(u), "expected #{this} to contain element #{exp}", "expected #{this} not to contain element #{exp}", u, d);
    }
    if (typeof DOMTokenList < "u" && d instanceof DOMTokenList) {
      ut(u, "class name", ["string"]);
      let h = t.flag(this, "negate") ? d.value.replace(u, "").trim() : `${d.value} ${u}`;
      return this.assert(d.contains(u), `expected "${d.value}" to contain "${u}"`, `expected "${d.value}" not to contain "${u}"`, h, d.value);
    }
    return typeof d == "string" && typeof u == "string" ? this.assert(d.includes(u), "expected #{this} to contain #{exp}", "expected #{this}\
 not to contain #{exp}", u, d) : (d != null && typeof d != "string" && t.flag(this, "object", Array.from(d)), this.contain(u));
  }), i("toContainEqual", function(u) {
    let d = t.flag(this, "object"), f = Array.from(d).findIndex((h) => oe(h, u, n));
    this.assert(f !== -1, "expected #{this} to deep equally contain #{exp}", "expected #{this} to not deep equally contain #{exp}", u);
  }), i("toBeTruthy", function() {
    let u = t.flag(this, "object");
    this.assert(!!u, "expected #{this} to be truthy", "expected #{this} to not be truthy", !0, u);
  }), i("toBeFalsy", function() {
    let u = t.flag(this, "object");
    this.assert(!u, "expected #{this} to be falsy", "expected #{this} to not be falsy", !1, u);
  }), i("toBeGreaterThan", function(u) {
    let d = this._obj;
    return ut(d, "actual", ["number", "bigint"]), ut(u, "expected", ["number", "bigint"]), this.assert(d > u, `expected ${d} to be greater t\
han ${u}`, `expected ${d} to be not greater than ${u}`, u, d, !1);
  }), i("toBeGreaterThanOrEqual", function(u) {
    let d = this._obj;
    return ut(d, "actual", ["number", "bigint"]), ut(u, "expected", ["number", "bigint"]), this.assert(d >= u, `expected ${d} to be greater \
than or equal to ${u}`, `expected ${d} to be not greater than or equal to ${u}`, u, d, !1);
  }), i("toBeLessThan", function(u) {
    let d = this._obj;
    return ut(d, "actual", ["number", "bigint"]), ut(u, "expected", ["number", "bigint"]), this.assert(d < u, `expected ${d} to be less than\
 ${u}`, `expected ${d} to be not less than ${u}`, u, d, !1);
  }), i("toBeLessThanOrEqual", function(u) {
    let d = this._obj;
    return ut(d, "actual", ["number", "bigint"]), ut(u, "expected", ["number", "bigint"]), this.assert(d <= u, `expected ${d} to be less tha\
n or equal to ${u}`, `expected ${d} to be not less than or equal to ${u}`, u, d, !1);
  }), i("toBeNaN", function() {
    let u = t.flag(this, "object");
    this.assert(Number.isNaN(u), "expected #{this} to be NaN", "expected #{this} not to be NaN", Number.NaN, u);
  }), i("toBeUndefined", function() {
    let u = t.flag(this, "object");
    this.assert(u === void 0, "expected #{this} to be undefined", "expected #{this} not to be undefined", void 0, u);
  }), i("toBeNull", function() {
    let u = t.flag(this, "object");
    this.assert(u === null, "expected #{this} to be null", "expected #{this} not to be null", null, u);
  }), i("toBeDefined", function() {
    let u = t.flag(this, "object");
    this.assert(typeof u < "u", "expected #{this} to be defined", "expected #{this} to be undefined", u);
  }), i("toBeTypeOf", function(u) {
    let d = typeof this._obj, f = u === d;
    return this.assert(f, "expected #{this} to be type of #{exp}", "expected #{this} not to be type of #{exp}", u, d);
  }), i("toBeInstanceOf", function(u) {
    return this.instanceOf(u);
  }), i("toHaveLength", function(u) {
    return this.have.length(u);
  }), i("toHaveProperty", function(...u) {
    Array.isArray(u[0]) && (u[0] = u[0].map((E) => String(E).replace(/([.[\]])/g, "\\$1")).join("."));
    let d = this._obj, [f, h] = u, m = /* @__PURE__ */ o(() => Object.prototype.hasOwnProperty.call(d, f) ? {
      value: d[f],
      exists: !0
    } : t.getPathInfo(d, f), "getValue"), { value: y, exists: g } = m(), x = g && (u.length === 1 || oe(h, y, n)), b = u.length === 1 ? "" :
    ` with value ${t.objDisplay(h)}`;
    return this.assert(x, `expected #{this} to have property "${f}"${b}`, `expected #{this} to not have property "${f}"${b}`, h, g ? y : void 0);
  }), i("toBeCloseTo", function(u, d = 2) {
    let f = this._obj, h = !1, m = 0, y = 0;
    return u === Number.POSITIVE_INFINITY && f === Number.POSITIVE_INFINITY || u === Number.NEGATIVE_INFINITY && f === Number.NEGATIVE_INFINITY ?
    h = !0 : (m = 10 ** -d / 2, y = Math.abs(f - u), h = y < m), this.assert(h, `expected #{this} to be close to #{exp}, received difference\
 is ${y}, but expected ${m}`, `expected #{this} to not be close to #{exp}, received difference is ${y}, but expected ${m}`, u, f, !1);
  });
  function a(u) {
    if (!cn(u._obj))
      throw new TypeError(`${t.inspect(u._obj)} is not a spy or a call to a spy!`);
  }
  o(a, "assertIsMock");
  function s(u) {
    return a(u), u._obj;
  }
  o(s, "getSpy"), i(["toHaveBeenCalledTimes", "toBeCalledTimes"], function(u) {
    let d = s(this), f = d.getMockName(), h = d.mock.calls.length;
    return this.assert(h === u, `expected "${f}" to be called #{exp} times, but got ${h} times`, `expected "${f}" to not be called #{exp} ti\
mes`, u, h, !1);
  }), i("toHaveBeenCalledOnce", function() {
    let u = s(this), d = u.getMockName(), f = u.mock.calls.length;
    return this.assert(f === 1, `expected "${d}" to be called once, but got ${f} times`, `expected "${d}" to not be called once`, 1, f, !1);
  }), i(["toHaveBeenCalled", "toBeCalled"], function() {
    let u = s(this), d = u.getMockName(), f = u.mock.calls.length, h = f > 0, m = t.flag(this, "negate"), y = t.getMessage(this, [
      h,
      `expected "${d}" to be called at least once`,
      `expected "${d}" to not be called at all, but actually been called ${f} times`,
      !0,
      h
    ]);
    if (h && m && (y = Eb(u, y)), h && m || !h && !m)
      throw new r(y);
  });
  function l(u, d) {
    return u.length === d.length && u.every((f, h) => oe(f, d[h], [...n, rt]));
  }
  o(l, "equalsArgumentArray"), i(["toHaveBeenCalledWith", "toBeCalledWith"], function(...u) {
    let d = s(this), f = d.getMockName(), h = d.mock.calls.some((g) => l(g, u)), m = t.flag(this, "negate"), y = t.getMessage(this, [
      h,
      `expected "${f}" to be called with arguments: #{exp}`,
      `expected "${f}" to not be called with arguments: #{exp}`,
      u
    ]);
    if (h && m || !h && !m)
      throw new r(Eb(d, y, u));
  }), i("toHaveBeenCalledExactlyOnceWith", function(...u) {
    let d = s(this), f = d.getMockName(), h = d.mock.calls.length, y = d.mock.calls.some((b) => l(b, u)) && h === 1, g = t.flag(this, "negat\
e"), x = t.getMessage(this, [
      y,
      `expected "${f}" to be called once with arguments: #{exp}`,
      `expected "${f}" to not be called once with arguments: #{exp}`,
      u
    ]);
    if (y && g || !y && !g)
      throw new r(Eb(d, x, u));
  }), i(["toHaveBeenNthCalledWith", "nthCalledWith"], function(u, ...d) {
    let f = s(this), h = f.getMockName(), m = f.mock.calls[u - 1], y = f.mock.calls.length, g = u <= y;
    this.assert(m && l(m, d), `expected ${fo(u)} "${h}" call to have been called with #{exp}${g ? "" : `, but called only ${y} times`}`, `ex\
pected ${fo(u)} "${h}" call to not have been called with #{exp}`, d, m, g);
  }), i(["toHaveBeenLastCalledWith", "lastCalledWith"], function(...u) {
    let d = s(this), f = d.getMockName(), h = d.mock.calls[d.mock.calls.length - 1];
    this.assert(h && l(h, u), `expected last "${f}" call to have been called with #{exp}`, `expected last "${f}" call to not have been calle\
d with #{exp}`, u, h);
  });
  function c(u, d, f) {
    let h = u.mock.invocationCallOrder, m = d.mock.invocationCallOrder;
    return h.length === 0 ? !f : m.length === 0 ? !1 : h[0] < m[0];
  }
  o(c, "isSpyCalledBeforeAnotherSpy"), i(["toHaveBeenCalledBefore"], function(u, d = !0) {
    let f = s(this);
    if (!cn(u))
      throw new TypeError(`${t.inspect(u)} is not a spy or a call to a spy`);
    this.assert(c(f, u, d), `expected "${f.getMockName()}" to have been called before "${u.getMockName()}"`, `expected "${f.getMockName()}" \
to not have been called before "${u.getMockName()}"`, u, f);
  }), i(["toHaveBeenCalledAfter"], function(u, d = !0) {
    let f = s(this);
    if (!cn(u))
      throw new TypeError(`${t.inspect(u)} is not a spy or a call to a spy`);
    this.assert(c(u, f, d), `expected "${f.getMockName()}" to have been called after "${u.getMockName()}"`, `expected "${f.getMockName()}" t\
o not have been called after "${u.getMockName()}"`, u, f);
  }), i(["toThrow", "toThrowError"], function(u) {
    if (typeof u == "string" || typeof u > "u" || u instanceof RegExp)
      return this.throws(u === "" ? /^$/ : u);
    let d = this._obj, f = t.flag(this, "promise"), h = t.flag(this, "negate"), m = null;
    if (f === "rejects")
      m = d;
    else if (f === "resolves" && typeof d != "function") {
      if (h)
        return;
      {
        let y = t.flag(this, "message") || "expected promise to throw an error, but it didn't", g = { showDiff: !1 };
        throw new r(y, g, t.flag(this, "ssfi"));
      }
    } else {
      let y = !1;
      try {
        d();
      } catch (g) {
        y = !0, m = g;
      }
      if (!y && !h) {
        let g = t.flag(this, "message") || "expected function to throw an error, but it didn't", x = { showDiff: !1 };
        throw new r(g, x, t.flag(this, "ssfi"));
      }
    }
    if (typeof u == "function") {
      let y = u.name || u.prototype.constructor.name;
      return this.assert(m && m instanceof u, `expected error to be instance of ${y}`, `expected error not to be instance of ${y}`, u, m);
    }
    if (u instanceof Error) {
      let y = oe(m, u, [...n, rt]);
      return this.assert(y, "expected a thrown error to be #{exp}", "expected a thrown error not to be #{exp}", u, m);
    }
    if (typeof u == "object" && "asymmetricMatch" in u && typeof u.asymmetricMatch == "function") {
      let y = u;
      return this.assert(m && y.asymmetricMatch(m), "expected error to match asymmetric matcher", "expected error not to match asymmetric ma\
tcher", y, m);
    }
    throw new Error(`"toThrow" expects string, RegExp, function, Error instance or asymmetric matcher, got "${typeof u}"`);
  }), [{
    name: "toHaveResolved",
    condition: /* @__PURE__ */ o((u) => u.mock.settledResults.length > 0 && u.mock.settledResults.some(({ type: d }) => d === "fulfilled"), "\
condition"),
    action: "resolved"
  }, {
    name: ["toHaveReturned", "toReturn"],
    condition: /* @__PURE__ */ o((u) => u.mock.calls.length > 0 && u.mock.results.some(({ type: d }) => d !== "throw"), "condition"),
    action: "called"
  }].forEach(({ name: u, condition: d, action: f }) => {
    i(u, function() {
      let h = s(this), m = h.getMockName(), y = d(h);
      this.assert(y, `expected "${m}" to be successfully ${f} at least once`, `expected "${m}" to not be successfully ${f}`, y, !y, !1);
    });
  }), [{
    name: "toHaveResolvedTimes",
    condition: /* @__PURE__ */ o((u, d) => u.mock.settledResults.reduce((f, { type: h }) => h === "fulfilled" ? ++f : f, 0) === d, "conditio\
n"),
    action: "resolved"
  }, {
    name: ["toHaveReturnedTimes", "toReturnTimes"],
    condition: /* @__PURE__ */ o((u, d) => u.mock.results.reduce((f, { type: h }) => h === "throw" ? f : ++f, 0) === d, "condition"),
    action: "called"
  }].forEach(({ name: u, condition: d, action: f }) => {
    i(u, function(h) {
      let m = s(this), y = m.getMockName(), g = d(m, h);
      this.assert(g, `expected "${y}" to be successfully ${f} ${h} times`, `expected "${y}" to not be successfully ${f} ${h} times`, `expect\
ed resolved times: ${h}`, `received resolved times: ${g}`, !1);
    });
  }), [{
    name: "toHaveResolvedWith",
    condition: /* @__PURE__ */ o((u, d) => u.mock.settledResults.some(({ type: f, value: h }) => f === "fulfilled" && oe(d, h)), "condition"),
    action: "resolve"
  }, {
    name: ["toHaveReturnedWith", "toReturnWith"],
    condition: /* @__PURE__ */ o((u, d) => u.mock.results.some(({ type: f, value: h }) => f === "return" && oe(d, h)), "condition"),
    action: "return"
  }].forEach(({ name: u, condition: d, action: f }) => {
    i(u, function(h) {
      let m = s(this), y = d(m, h), g = t.flag(this, "negate");
      if (y && g || !y && !g) {
        let x = m.getMockName(), b = t.getMessage(this, [
          y,
          `expected "${x}" to ${f} with: #{exp} at least once`,
          `expected "${x}" to not ${f} with: #{exp}`,
          h
        ]), E = f === "return" ? m.mock.results : m.mock.settledResults;
        throw new r(r8(m, E, b, h));
      }
    });
  }), [{
    name: "toHaveLastResolvedWith",
    condition: /* @__PURE__ */ o((u, d) => {
      let f = u.mock.settledResults[u.mock.settledResults.length - 1];
      return f && f.type === "fulfilled" && oe(f.value, d);
    }, "condition"),
    action: "resolve"
  }, {
    name: ["toHaveLastReturnedWith", "lastReturnedWith"],
    condition: /* @__PURE__ */ o((u, d) => {
      let f = u.mock.results[u.mock.results.length - 1];
      return f && f.type === "return" && oe(f.value, d);
    }, "condition"),
    action: "return"
  }].forEach(({ name: u, condition: d, action: f }) => {
    i(u, function(h) {
      let m = s(this), y = f === "return" ? m.mock.results : m.mock.settledResults, g = y[y.length - 1], x = m.getMockName();
      this.assert(d(m, h), `expected last "${x}" call to ${f} #{exp}`, `expected last "${x}" call to not ${f} #{exp}`, h, g?.value);
    });
  }), [{
    name: "toHaveNthResolvedWith",
    condition: /* @__PURE__ */ o((u, d, f) => {
      let h = u.mock.settledResults[d - 1];
      return h && h.type === "fulfilled" && oe(h.value, f);
    }, "condition"),
    action: "resolve"
  }, {
    name: ["toHaveNthReturnedWith", "nthReturnedWith"],
    condition: /* @__PURE__ */ o((u, d, f) => {
      let h = u.mock.results[d - 1];
      return h && h.type === "return" && oe(h.value, f);
    }, "condition"),
    action: "return"
  }].forEach(({ name: u, condition: d, action: f }) => {
    i(u, function(h, m) {
      let y = s(this), g = y.getMockName(), b = (f === "return" ? y.mock.results : y.mock.settledResults)[h - 1], E = `${fo(h)} call`;
      this.assert(d(y, h, m), `expected ${E} "${g}" call to ${f} #{exp}`, `expected ${E} "${g}" call to not ${f} #{exp}`, m, b?.value);
    });
  }), i("withContext", function(u) {
    for (let d in u)
      t.flag(this, d, u[d]);
    return this;
  }), t.addProperty(e.Assertion.prototype, "resolves", /* @__PURE__ */ o(function() {
    let d = new Error("resolves");
    t.flag(this, "promise", "resolves"), t.flag(this, "error", d);
    let f = t.flag(this, "vitest-test"), h = t.flag(this, "object");
    if (t.flag(this, "poll"))
      throw new SyntaxError("expect.poll() is not supported in combination with .resolves");
    if (typeof h?.then != "function")
      throw new TypeError(`You must provide a Promise to expect() when using .resolves, not '${typeof h}'.`);
    let m = new Proxy(this, { get: /* @__PURE__ */ o((y, g, x) => {
      let b = Reflect.get(y, g, x);
      return typeof b != "function" ? b instanceof e.Assertion ? m : b : (...E) => {
        t.flag(this, "_name", g);
        let q = h.then((C) => (t.flag(this, "object", C), b.call(this, ...E)), (C) => {
          let P = new r(`promise rejected "${t.inspect(C)}" instead of resolving`, { showDiff: !1 });
          throw P.cause = C, P.stack = d.stack.replace(d.message, P.message), P;
        });
        return FR(f, q, DR(t, this, !!E.length), d);
      };
    }, "get") });
    return m;
  }, "__VITEST_RESOLVES__")), t.addProperty(e.Assertion.prototype, "rejects", /* @__PURE__ */ o(function() {
    let d = new Error("rejects");
    t.flag(this, "promise", "rejects"), t.flag(this, "error", d);
    let f = t.flag(this, "vitest-test"), h = t.flag(this, "object"), m = typeof h == "function" ? h() : h;
    if (t.flag(this, "poll"))
      throw new SyntaxError("expect.poll() is not supported in combination with .rejects");
    if (typeof m?.then != "function")
      throw new TypeError(`You must provide a Promise to expect() when using .rejects, not '${typeof m}'.`);
    let y = new Proxy(this, { get: /* @__PURE__ */ o((g, x, b) => {
      let E = Reflect.get(g, x, b);
      return typeof E != "function" ? E instanceof e.Assertion ? y : E : (...q) => {
        t.flag(this, "_name", x);
        let C = m.then((P) => {
          let O = new r(`promise resolved "${t.inspect(P)}" instead of rejecting`, {
            showDiff: !0,
            expected: new Error("rejected promise"),
            actual: P
          });
          throw O.stack = d.stack.replace(d.message, O.message), O;
        }, (P) => (t.flag(this, "object", P), E.call(this, ...q)));
        return FR(f, C, DR(t, this, !!q.length), d);
      };
    }, "get") });
    return y;
  }, "__VITEST_REJECTS__"));
}, "JestChaiExpect");
function fo(e) {
  let t = e % 10, r = e % 100;
  return t === 1 && r !== 11 ? `${e}st` : t === 2 && r !== 12 ? `${e}nd` : t === 3 && r !== 13 ? `${e}rd` : `${e}th`;
}
o(fo, "ordinalOf");
function Eb(e, t, r) {
  return e.mock.calls.length && (t += de.gray(`

Received: 

${e.mock.calls.map((n, i) => {
    let a = de.bold(`  ${fo(i + 1)} ${e.getMockName()} call:

`);
    return r ? a += Er(r, n, { omitAnnotationLines: !0 }) : a += Ae(n).split(`
`).map((s) => `    ${s}`).join(`
`), a += `
`, a;
  }).join(`
`)}`)), t += de.gray(`

Number of calls: ${de.bold(e.mock.calls.length)}
`), t;
}
o(Eb, "formatCalls");
function r8(e, t, r, n) {
  return t.length && (r += de.gray(`

Received: 

${t.map((i, a) => {
    let s = de.bold(`  ${fo(a + 1)} ${e.getMockName()} call return:

`);
    return n ? s += Er(n, i.value, { omitAnnotationLines: !0 }) : s += Ae(i).split(`
`).map((l) => `    ${l}`).join(`
`), s += `
`, s;
  }).join(`
`)}`)), r += de.gray(`

Number of calls: ${de.bold(e.mock.calls.length)}
`), r;
}
o(r8, "formatReturns");
function n8(e, t) {
  let r = e._obj, n = Xe.flag(e, "negate"), i = Xe.flag(e, "promise") || "", a = {
    ...zR(),
    diff: Er,
    stringify: Ae,
    iterableEquality: rt,
    subsetEquality: ho
  };
  return {
    state: {
      ...bo(t),
      customTesters: Rb(),
      isNot: n,
      utils: a,
      promise: i,
      equals: oe,
      suppressedErrors: [],
      soft: Xe.flag(e, "soft"),
      poll: Xe.flag(e, "poll")
    },
    isNot: n,
    obj: r
  };
}
o(n8, "getMatcherState");
var Lb = class Lb extends Error {
  constructor(t, r, n) {
    super(t), this.actual = r, this.expected = n;
  }
};
o(Lb, "JestExtendError");
var su = Lb;
function o8(e, t, r) {
  return (n, i) => {
    Object.entries(r).forEach(([a, s]) => {
      function l(...h) {
        let { state: m, isNot: y, obj: g } = n8(this, t), x = s.call(m, g, ...h);
        if (x && typeof x == "object" && typeof x.then == "function")
          return x.then(({ pass: O, message: R, actual: A, expected: j }) => {
            if (O && y || !O && !y)
              throw new su(R(), A, j);
          });
        let { pass: b, message: E, actual: q, expected: C } = x;
        if (b && y || !b && !y)
          throw new su(E(), q, C);
      }
      o(l, "expectWrapper");
      let c = JR(i, a, l);
      i.addMethod(globalThis[mo].matchers, a, c), i.addMethod(e.Assertion.prototype, a, c);
      let f = class f extends dt {
        constructor(m = !1, ...y) {
          super(y, m);
        }
        asymmetricMatch(m) {
          let { pass: y } = s.call(this.getMatcherContext(t), m, ...this.sample);
          return this.inverse ? !y : y;
        }
        toString() {
          return `${this.inverse ? "not." : ""}${a}`;
        }
        getExpectedType() {
          return "any";
        }
        toAsymmetricMatcher() {
          return `${this.toString()}<${this.sample.map((m) => Ae(m)).join(", ")}>`;
        }
      };
      o(f, "CustomMatcher");
      let u = f, d = /* @__PURE__ */ o((...h) => new u(!1, ...h), "customMatcher");
      Object.defineProperty(t, a, {
        configurable: !0,
        enumerable: !0,
        value: d,
        writable: !0
      }), Object.defineProperty(t.not, a, {
        configurable: !0,
        enumerable: !0,
        value: /* @__PURE__ */ o((...h) => new u(!0, ...h), "value"),
        writable: !0
      }), Object.defineProperty(globalThis[Cb], a, {
        configurable: !0,
        enumerable: !0,
        value: d,
        writable: !0
      });
    });
  };
}
o(o8, "JestExtendPlugin");
var ZR = /* @__PURE__ */ o((e, t) => {
  t.addMethod(e.expect, "extend", (r, n) => {
    Lt(o8(e, r, n));
  });
}, "JestExtend");

// src/test/expect.ts
function i8() {
  Lt(ZR), Lt(QR), Lt(XR);
  let e = /* @__PURE__ */ o((n, i) => {
    let { assertionCalls: a } = bo(e);
    return du({ assertionCalls: a + 1, soft: !1 }, e), kt(n, i);
  }, "expect");
  Object.assign(e, kt), e.getState = () => bo(e), e.setState = (n) => du(n, e), e.extend = (n) => kt.extend(e, n), e.soft = (...n) => {
    let i = e(...n);
    return e.setState({
      soft: !0
    }), i;
  }, e.extend(HR), e.unreachable = (n) => {
    v.fail(`expected${n ? ` "${n}" ` : " "}not to be reached`);
  };
  function t(n) {
    let i = /* @__PURE__ */ o(() => new Error(
      `expected number of assertions to be ${n}, but got ${e.getState().assertionCalls}`
    ), "errorGen");
    "captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(i(), t), e.setState({
      expectedAssertionsNumber: n,
      expectedAssertionsNumberErrorGen: i
    });
  }
  o(t, "assertions");
  function r() {
    let n = new Error("expected any number of assertion, but got none");
    "captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(n, r), e.setState({
      isExpectingAssertions: !0,
      isExpectingAssertionsError: n
    });
  }
  return o(r, "hasAssertions"), du(
    {
      // this should also add "snapshotState" that is added conditionally
      assertionCalls: 0,
      isExpectingAssertions: !1,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null
    },
    e
  ), Xe.addMethod(e, "assertions", t), Xe.addMethod(e, "hasAssertions", r), e.extend(Ah), e;
}
o(i8, "createExpect");
var $b = i8();
Object.defineProperty(globalThis, lu, {
  value: $b,
  writable: !0,
  configurable: !0
});

// ../node_modules/tinyspy/dist/index.js
function a8(e, t, r) {
  Object.defineProperty(e, t, r);
}
o(a8, "f");
var fu = Symbol.for("tinyspy:spy");
var s8 = /* @__PURE__ */ o((e) => {
  e.called = !1, e.callCount = 0, e.calls = [], e.results = [], e.resolves = [], e.next = [];
}, "P"), l8 = /* @__PURE__ */ o((e) => (a8(e, fu, { value: { reset: /* @__PURE__ */ o(() => s8(e[fu]), "reset") } }), e[fu]), "K"), eT = /* @__PURE__ */ o(
(e) => e[fu] || l8(e), "T");

// src/test/spy.ts
var Bb = /* @__PURE__ */ new Set();
function abe(e) {
  return Bb.add(e), () => void Bb.delete(e);
}
o(abe, "onMockCall");
var sbe = /* @__PURE__ */ o((...e) => {
  let t = MR(...e);
  return rT(t);
}, "spyOn");
function lbe(e) {
  let t = e ? gb(e) : gb();
  return rT(t);
}
o(lbe, "fn");
function rT(e) {
  let t = tT(e), r = t.mockImplementation.bind(null);
  return t.mockImplementation = (n) => tT(r(n)), t;
}
o(rT, "reactiveMock");
function tT(e) {
  let t = eT(e), r = t.impl;
  return t.willCall(function(...n) {
    return Bb.forEach((i) => i(e, n)), r?.apply(this, n);
  }), e;
}
o(tT, "listenWhenCalled");
function ube() {
  uo.forEach((e) => e.mockClear());
}
o(ube, "clearAllMocks");
function cbe() {
  uo.forEach((e) => e.mockReset());
}
o(cbe, "resetAllMocks");
function dbe() {
  uo.forEach((e) => e.mockRestore());
}
o(dbe, "restoreAllMocks");
function fbe(e, t = {}) {
  return e;
}
o(fbe, "mocked");

// ../node_modules/@testing-library/dom/dist/@testing-library/dom.esm.js
var ky = {};
Wo(ky, {
  buildQueries: () => Ot,
  configure: () => hte,
  createEvent: () => Ef,
  findAllByAltText: () => DA,
  findAllByDisplayValue: () => IA,
  findAllByLabelText: () => pA,
  findAllByPlaceholderText: () => CA,
  findAllByRole: () => ZA,
  findAllByTestId: () => iN,
  findAllByText: () => TA,
  findAllByTitle: () => WA,
  findByAltText: () => FA,
  findByDisplayValue: () => jA,
  findByLabelText: () => mA,
  findByPlaceholderText: () => xA,
  findByRole: () => eN,
  findByTestId: () => aN,
  findByText: () => OA,
  findByTitle: () => GA,
  fireEvent: () => So,
  getAllByAltText: () => $A,
  getAllByDisplayValue: () => AA,
  getAllByLabelText: () => hA,
  getAllByPlaceholderText: () => wA,
  getAllByRole: () => JA,
  getAllByTestId: () => nN,
  getAllByText: () => qA,
  getAllByTitle: () => VA,
  getByAltText: () => BA,
  getByDisplayValue: () => NA,
  getByLabelText: () => bA,
  getByPlaceholderText: () => EA,
  getByRole: () => QA,
  getByTestId: () => oN,
  getByText: () => RA,
  getByTitle: () => zA,
  getConfig: () => Z,
  getDefaultNormalizer: () => My,
  getElementError: () => Pf,
  getMultipleElementsFoundError: () => qf,
  getNodeText: () => Ao,
  getQueriesForElement: () => sN,
  getRoles: () => aA,
  getSuggestedQuery: () => Cf,
  isInaccessible: () => _f,
  logDOM: () => vy,
  logRoles: () => wte,
  makeFindQuery: () => vn,
  makeGetAllQuery: () => Iy,
  makeSingleQuery: () => gn,
  prettyDOM: () => To,
  prettyFormat: () => Mo,
  queries: () => xf,
  queryAllByAltText: () => kA,
  queryAllByAttribute: () => Rr,
  queryAllByDisplayValue: () => SA,
  queryAllByLabelText: () => yA,
  queryAllByPlaceholderText: () => gA,
  queryAllByRole: () => YA,
  queryAllByTestId: () => tN,
  queryAllByText: () => _A,
  queryAllByTitle: () => UA,
  queryByAltText: () => LA,
  queryByAttribute: () => lA,
  queryByDisplayValue: () => MA,
  queryByLabelText: () => dA,
  queryByPlaceholderText: () => vA,
  queryByRole: () => XA,
  queryByTestId: () => rN,
  queryByText: () => PA,
  queryByTitle: () => HA,
  queryHelpers: () => Ite,
  screen: () => lre,
  waitFor: () => Ny,
  waitForElementToBeRemoved: () => tre,
  within: () => sN,
  wrapAllByQueryWithSuggestion: () => He,
  wrapSingleQueryWithSuggestion: () => or
});
var Mo = ze(uO());

// ../node_modules/dom-accessibility-api/dist/polyfills/array.from.mjs
var IW = Object.prototype.toString;
function cO(e) {
  return typeof e == "function" || IW.call(e) === "[object Function]";
}
o(cO, "isCallable");
function jW(e) {
  var t = Number(e);
  return isNaN(t) ? 0 : t === 0 || !isFinite(t) ? t : (t > 0 ? 1 : -1) * Math.floor(Math.abs(t));
}
o(jW, "toInteger");
var kW = Math.pow(2, 53) - 1;
function LW(e) {
  var t = jW(e);
  return Math.min(Math.max(t, 0), kW);
}
o(LW, "toLength");
function Ke(e, t) {
  var r = Array, n = Object(e);
  if (e == null)
    throw new TypeError("Array.from requires an array-like object - not null or undefined");
  if (typeof t < "u" && !cO(t))
    throw new TypeError("Array.from: when provided, the second argument must be a function");
  for (var i = LW(n.length), a = cO(r) ? Object(new r(i)) : new Array(i), s = 0, l; s < i; )
    l = n[s], t ? a[s] = t(l, s) : a[s] = l, s += 1;
  return a.length = i, a;
}
o(Ke, "arrayFrom");

// ../node_modules/dom-accessibility-api/dist/polyfills/SetLike.mjs
function Eo(e) {
  "@babel/helpers - typeof";
  return Eo = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Eo(e);
}
o(Eo, "_typeof");
function $W(e, t) {
  if (!(e instanceof t))
    throw new TypeError("Cannot call a class as a function");
}
o($W, "_classCallCheck");
function dO(e, t) {
  for (var r = 0; r < t.length; r++) {
    var n = t[r];
    n.enumerable = n.enumerable || !1, n.configurable = !0, "value" in n && (n.writable = !0), Object.defineProperty(e, fO(n.key), n);
  }
}
o(dO, "_defineProperties");
function BW(e, t, r) {
  return t && dO(e.prototype, t), r && dO(e, r), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
o(BW, "_createClass");
function DW(e, t, r) {
  return t = fO(t), t in e ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = r, e;
}
o(DW, "_defineProperty");
function fO(e) {
  var t = FW(e, "string");
  return Eo(t) === "symbol" ? t : String(t);
}
o(fO, "_toPropertyKey");
function FW(e, t) {
  if (Eo(e) !== "object" || e === null) return e;
  var r = e[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(e, t || "default");
    if (Eo(n) !== "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
o(FW, "_toPrimitive");
var UW = /* @__PURE__ */ function() {
  function e() {
    var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
    $W(this, e), DW(this, "items", void 0), this.items = t;
  }
  return o(e, "SetLike"), BW(e, [{
    key: "add",
    value: /* @__PURE__ */ o(function(r) {
      return this.has(r) === !1 && this.items.push(r), this;
    }, "add")
  }, {
    key: "clear",
    value: /* @__PURE__ */ o(function() {
      this.items = [];
    }, "clear")
  }, {
    key: "delete",
    value: /* @__PURE__ */ o(function(r) {
      var n = this.items.length;
      return this.items = this.items.filter(function(i) {
        return i !== r;
      }), n !== this.items.length;
    }, "_delete")
  }, {
    key: "forEach",
    value: /* @__PURE__ */ o(function(r) {
      var n = this;
      this.items.forEach(function(i) {
        r(i, i, n);
      });
    }, "forEach")
  }, {
    key: "has",
    value: /* @__PURE__ */ o(function(r) {
      return this.items.indexOf(r) !== -1;
    }, "has")
  }, {
    key: "size",
    get: /* @__PURE__ */ o(function() {
      return this.items.length;
    }, "get")
  }]), e;
}(), pO = typeof Set > "u" ? Set : UW;

// ../node_modules/dom-accessibility-api/dist/getRole.mjs
function Pe(e) {
  var t;
  return (
    // eslint-disable-next-line no-restricted-properties -- actual guard for environments without localName
    (t = e.localName) !== null && t !== void 0 ? t : (
      // eslint-disable-next-line no-restricted-properties -- required for the fallback
      e.tagName.toLowerCase()
    )
  );
}
o(Pe, "getLocalName");
var HW = {
  article: "article",
  aside: "complementary",
  button: "button",
  datalist: "listbox",
  dd: "definition",
  details: "group",
  dialog: "dialog",
  dt: "term",
  fieldset: "group",
  figure: "figure",
  // WARNING: Only with an accessible name
  form: "form",
  footer: "contentinfo",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  header: "banner",
  hr: "separator",
  html: "document",
  legend: "legend",
  li: "listitem",
  math: "math",
  main: "main",
  menu: "list",
  nav: "navigation",
  ol: "list",
  optgroup: "group",
  // WARNING: Only in certain context
  option: "option",
  output: "status",
  progress: "progressbar",
  // WARNING: Only with an accessible name
  section: "region",
  summary: "button",
  table: "table",
  tbody: "rowgroup",
  textarea: "textbox",
  tfoot: "rowgroup",
  // WARNING: Only in certain context
  td: "cell",
  th: "columnheader",
  thead: "rowgroup",
  tr: "row",
  ul: "list"
}, VW = {
  caption: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  code: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  deletion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  emphasis: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  generic: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby", "aria-roledescription"]),
  insertion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function zW(e, t) {
  return [
    "aria-atomic",
    "aria-busy",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-details",
    // "disabled",
    "aria-dropeffect",
    // "errormessage",
    "aria-flowto",
    "aria-grabbed",
    // "haspopup",
    "aria-hidden",
    // "invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-live",
    "aria-owns",
    "aria-relevant",
    "aria-roledescription"
  ].some(function(r) {
    var n;
    return e.hasAttribute(r) && !((n = VW[t]) !== null && n !== void 0 && n.has(r));
  });
}
o(zW, "hasGlobalAriaAttributes");
function mO(e, t) {
  return zW(e, t);
}
o(mO, "ignorePresentationalRole");
function Eu(e) {
  var t = GW(e);
  if (t === null || t === "presentation") {
    var r = WW(e);
    if (t !== "presentation" || mO(e, r || ""))
      return r;
  }
  return t;
}
o(Eu, "getRole");
function WW(e) {
  var t = HW[Pe(e)];
  if (t !== void 0)
    return t;
  switch (Pe(e)) {
    case "a":
    case "area":
    case "link":
      if (e.hasAttribute("href"))
        return "link";
      break;
    case "img":
      return e.getAttribute("alt") === "" && !mO(e, "img") ? "presentation" : "img";
    case "input": {
      var r = e, n = r.type;
      switch (n) {
        case "button":
        case "image":
        case "reset":
        case "submit":
          return "button";
        case "checkbox":
        case "radio":
          return n;
        case "range":
          return "slider";
        case "email":
        case "tel":
        case "text":
        case "url":
          return e.hasAttribute("list") ? "combobox" : "textbox";
        case "search":
          return e.hasAttribute("list") ? "combobox" : "searchbox";
        case "number":
          return "spinbutton";
        default:
          return null;
      }
    }
    case "select":
      return e.hasAttribute("multiple") || e.size > 1 ? "listbox" : "combobox";
  }
  return null;
}
o(WW, "getImplicitRole");
function GW(e) {
  var t = e.getAttribute("role");
  if (t !== null) {
    var r = t.trim().split(" ")[0];
    if (r.length > 0)
      return r;
  }
  return null;
}
o(GW, "getExplicitRole");

// ../node_modules/dom-accessibility-api/dist/util.mjs
function ye(e) {
  return e !== null && e.nodeType === e.ELEMENT_NODE;
}
o(ye, "isElement");
function Yb(e) {
  return ye(e) && Pe(e) === "caption";
}
o(Yb, "isHTMLTableCaptionElement");
function Co(e) {
  return ye(e) && Pe(e) === "input";
}
o(Co, "isHTMLInputElement");
function hO(e) {
  return ye(e) && Pe(e) === "optgroup";
}
o(hO, "isHTMLOptGroupElement");
function bO(e) {
  return ye(e) && Pe(e) === "select";
}
o(bO, "isHTMLSelectElement");
function yO(e) {
  return ye(e) && Pe(e) === "table";
}
o(yO, "isHTMLTableElement");
function gO(e) {
  return ye(e) && Pe(e) === "textarea";
}
o(gO, "isHTMLTextAreaElement");
function vO(e) {
  var t = e.ownerDocument === null ? e : e.ownerDocument, r = t.defaultView;
  if (r === null)
    throw new TypeError("no window available");
  return r;
}
o(vO, "safeWindow");
function wO(e) {
  return ye(e) && Pe(e) === "fieldset";
}
o(wO, "isHTMLFieldSetElement");
function EO(e) {
  return ye(e) && Pe(e) === "legend";
}
o(EO, "isHTMLLegendElement");
function CO(e) {
  return ye(e) && Pe(e) === "slot";
}
o(CO, "isHTMLSlotElement");
function KW(e) {
  return ye(e) && e.ownerSVGElement !== void 0;
}
o(KW, "isSVGElement");
function xO(e) {
  return ye(e) && Pe(e) === "svg";
}
o(xO, "isSVGSVGElement");
function _O(e) {
  return KW(e) && Pe(e) === "title";
}
o(_O, "isSVGTitleElement");
function mn(e, t) {
  if (ye(e) && e.hasAttribute(t)) {
    var r = e.getAttribute(t).split(" "), n = e.getRootNode ? e.getRootNode() : e.ownerDocument;
    return r.map(function(i) {
      return n.getElementById(i);
    }).filter(
      function(i) {
        return i !== null;
      }
      // TODO: why does this not narrow?
    );
  }
  return [];
}
o(mn, "queryIdRefs");
function pt(e, t) {
  return ye(e) ? t.indexOf(Eu(e)) !== -1 : !1;
}
o(pt, "hasAnyConcreteRoles");

// ../node_modules/dom-accessibility-api/dist/accessible-name-and-description.mjs
function YW(e) {
  return e.trim().replace(/\s\s+/g, " ");
}
o(YW, "asFlatString");
function XW(e, t) {
  if (!ye(e))
    return !1;
  if (e.hasAttribute("hidden") || e.getAttribute("aria-hidden") === "true")
    return !0;
  var r = t(e);
  return r.getPropertyValue("display") === "none" || r.getPropertyValue("visibility") === "hidden";
}
o(XW, "isHidden");
function JW(e) {
  return pt(e, ["button", "combobox", "listbox", "textbox"]) || RO(e, "range");
}
o(JW, "isControl");
function RO(e, t) {
  if (!ye(e))
    return !1;
  switch (t) {
    case "range":
      return pt(e, ["meter", "progressbar", "scrollbar", "slider", "spinbutton"]);
    default:
      throw new TypeError("No knowledge about abstract role '".concat(t, "'. This is likely a bug :("));
  }
}
o(RO, "hasAbstractRole");
function PO(e, t) {
  var r = Ke(e.querySelectorAll(t));
  return mn(e, "aria-owns").forEach(function(n) {
    r.push.apply(r, Ke(n.querySelectorAll(t)));
  }), r;
}
o(PO, "querySelectorAllSubtree");
function QW(e) {
  return bO(e) ? e.selectedOptions || PO(e, "[selected]") : PO(e, '[aria-selected="true"]');
}
o(QW, "querySelectedOptions");
function ZW(e) {
  return pt(e, ["none", "presentation"]);
}
o(ZW, "isMarkedPresentational");
function eG(e) {
  return Yb(e);
}
o(eG, "isNativeHostLanguageTextAlternativeElement");
function tG(e) {
  return pt(e, ["button", "cell", "checkbox", "columnheader", "gridcell", "heading", "label", "legend", "link", "menuitem", "menuitemcheckbo\
x", "menuitemradio", "option", "radio", "row", "rowheader", "switch", "tab", "tooltip", "treeitem"]);
}
o(tG, "allowsNameFromContent");
function rG(e) {
  return !1;
}
o(rG, "isDescendantOfNativeHostLanguageTextAlternativeElement");
function nG(e) {
  return Co(e) || gO(e) ? e.value : e.textContent || "";
}
o(nG, "getValueOfTextbox");
function qO(e) {
  var t = e.getPropertyValue("content");
  return /^["'].*["']$/.test(t) ? t.slice(1, -1) : "";
}
o(qO, "getTextualContent");
function TO(e) {
  var t = Pe(e);
  return t === "button" || t === "input" && e.getAttribute("type") !== "hidden" || t === "meter" || t === "output" || t === "progress" || t ===
  "select" || t === "textarea";
}
o(TO, "isLabelableElement");
function OO(e) {
  if (TO(e))
    return e;
  var t = null;
  return e.childNodes.forEach(function(r) {
    if (t === null && ye(r)) {
      var n = OO(r);
      n !== null && (t = n);
    }
  }), t;
}
o(OO, "findLabelableElement");
function oG(e) {
  if (e.control !== void 0)
    return e.control;
  var t = e.getAttribute("for");
  return t !== null ? e.ownerDocument.getElementById(t) : OO(e);
}
o(oG, "getControlOfLabel");
function iG(e) {
  var t = e.labels;
  if (t === null)
    return t;
  if (t !== void 0)
    return Ke(t);
  if (!TO(e))
    return null;
  var r = e.ownerDocument;
  return Ke(r.querySelectorAll("label")).filter(function(n) {
    return oG(n) === e;
  });
}
o(iG, "getLabels");
function aG(e) {
  var t = e.assignedNodes();
  return t.length === 0 ? Ke(e.childNodes) : t;
}
o(aG, "getSlotContents");
function Cu(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, r = new pO(), n = vO(e), i = t.compute, a = i === void 0 ? "n\
ame" : i, s = t.computedStyleSupportsPseudoElements, l = s === void 0 ? t.getComputedStyle !== void 0 : s, c = t.getComputedStyle, u = c ===
  void 0 ? n.getComputedStyle.bind(n) : c, d = t.hidden, f = d === void 0 ? !1 : d;
  function h(b, E) {
    var q = "";
    if (ye(b) && l) {
      var C = u(b, "::before"), P = qO(C);
      q = "".concat(P, " ").concat(q);
    }
    var O = CO(b) ? aG(b) : Ke(b.childNodes).concat(mn(b, "aria-owns"));
    if (O.forEach(function(j) {
      var J = x(j, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1,
        recursion: !0
      }), S = ye(j) ? u(j).getPropertyValue("display") : "inline", G = S !== "inline" ? " " : "";
      q += "".concat(G).concat(J).concat(G);
    }), ye(b) && l) {
      var R = u(b, "::after"), A = qO(R);
      q = "".concat(q, " ").concat(A);
    }
    return q.trim();
  }
  o(h, "computeMiscTextAlternative");
  function m(b, E) {
    var q = b.getAttributeNode(E);
    return q !== null && !r.has(q) && q.value.trim() !== "" ? (r.add(q), q.value) : null;
  }
  o(m, "useAttribute");
  function y(b) {
    return ye(b) ? m(b, "title") : null;
  }
  o(y, "computeTooltipAttributeValue");
  function g(b) {
    if (!ye(b))
      return null;
    if (wO(b)) {
      r.add(b);
      for (var E = Ke(b.childNodes), q = 0; q < E.length; q += 1) {
        var C = E[q];
        if (EO(C))
          return x(C, {
            isEmbeddedInLabel: !1,
            isReferenced: !1,
            recursion: !1
          });
      }
    } else if (yO(b)) {
      r.add(b);
      for (var P = Ke(b.childNodes), O = 0; O < P.length; O += 1) {
        var R = P[O];
        if (Yb(R))
          return x(R, {
            isEmbeddedInLabel: !1,
            isReferenced: !1,
            recursion: !1
          });
      }
    } else if (xO(b)) {
      r.add(b);
      for (var A = Ke(b.childNodes), j = 0; j < A.length; j += 1) {
        var J = A[j];
        if (_O(J))
          return J.textContent;
      }
      return null;
    } else if (Pe(b) === "img" || Pe(b) === "area") {
      var S = m(b, "alt");
      if (S !== null)
        return S;
    } else if (hO(b)) {
      var G = m(b, "label");
      if (G !== null)
        return G;
    }
    if (Co(b) && (b.type === "button" || b.type === "submit" || b.type === "reset")) {
      var ne = m(b, "value");
      if (ne !== null)
        return ne;
      if (b.type === "submit")
        return "Submit";
      if (b.type === "reset")
        return "Reset";
    }
    var B = iG(b);
    if (B !== null && B.length !== 0)
      return r.add(b), Ke(B).map(function(V) {
        return x(V, {
          isEmbeddedInLabel: !0,
          isReferenced: !1,
          recursion: !0
        });
      }).filter(function(V) {
        return V.length > 0;
      }).join(" ");
    if (Co(b) && b.type === "image") {
      var H = m(b, "alt");
      if (H !== null)
        return H;
      var $ = m(b, "title");
      return $ !== null ? $ : "Submit Query";
    }
    if (pt(b, ["button"])) {
      var W = h(b, {
        isEmbeddedInLabel: !1,
        isReferenced: !1
      });
      if (W !== "")
        return W;
    }
    return null;
  }
  o(g, "computeElementTextAlternative");
  function x(b, E) {
    if (r.has(b))
      return "";
    if (!f && XW(b, u) && !E.isReferenced)
      return r.add(b), "";
    var q = ye(b) ? b.getAttributeNode("aria-labelledby") : null, C = q !== null && !r.has(q) ? mn(b, "aria-labelledby") : [];
    if (a === "name" && !E.isReferenced && C.length > 0)
      return r.add(q), C.map(function(S) {
        return x(S, {
          isEmbeddedInLabel: E.isEmbeddedInLabel,
          isReferenced: !0,
          // this isn't recursion as specified, otherwise we would skip
          // `aria-label` in
          // <input id="myself" aria-label="foo" aria-labelledby="myself"
          recursion: !1
        });
      }).join(" ");
    var P = E.recursion && JW(b) && a === "name";
    if (!P) {
      var O = (ye(b) && b.getAttribute("aria-label") || "").trim();
      if (O !== "" && a === "name")
        return r.add(b), O;
      if (!ZW(b)) {
        var R = g(b);
        if (R !== null)
          return r.add(b), R;
      }
    }
    if (pt(b, ["menu"]))
      return r.add(b), "";
    if (P || E.isEmbeddedInLabel || E.isReferenced) {
      if (pt(b, ["combobox", "listbox"])) {
        r.add(b);
        var A = QW(b);
        return A.length === 0 ? Co(b) ? b.value : "" : Ke(A).map(function(S) {
          return x(S, {
            isEmbeddedInLabel: E.isEmbeddedInLabel,
            isReferenced: !1,
            recursion: !0
          });
        }).join(" ");
      }
      if (RO(b, "range"))
        return r.add(b), b.hasAttribute("aria-valuetext") ? b.getAttribute("aria-valuetext") : b.hasAttribute("aria-valuenow") ? b.getAttribute(
        "aria-valuenow") : b.getAttribute("value") || "";
      if (pt(b, ["textbox"]))
        return r.add(b), nG(b);
    }
    if (tG(b) || ye(b) && E.isReferenced || eG(b) || rG(b)) {
      var j = h(b, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1
      });
      if (j !== "")
        return r.add(b), j;
    }
    if (b.nodeType === b.TEXT_NODE)
      return r.add(b), b.textContent || "";
    if (E.recursion)
      return r.add(b), h(b, {
        isEmbeddedInLabel: E.isEmbeddedInLabel,
        isReferenced: !1
      });
    var J = y(b);
    return J !== null ? (r.add(b), J) : (r.add(b), "");
  }
  return o(x, "computeTextAlternative"), YW(x(e, {
    isEmbeddedInLabel: !1,
    // by spec computeAccessibleDescription starts with the referenced elements as roots
    isReferenced: a === "description",
    recursion: !1
  }));
}
o(Cu, "computeTextAlternative");

// ../node_modules/dom-accessibility-api/dist/accessible-description.mjs
function xo(e) {
  "@babel/helpers - typeof";
  return xo = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, xo(e);
}
o(xo, "_typeof");
function SO(e, t) {
  var r = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    t && (n = n.filter(function(i) {
      return Object.getOwnPropertyDescriptor(e, i).enumerable;
    })), r.push.apply(r, n);
  }
  return r;
}
o(SO, "ownKeys");
function MO(e) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? SO(Object(r), !0).forEach(function(n) {
      sG(e, n, r[n]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : SO(Object(r)).forEach(function(n) {
      Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n));
    });
  }
  return e;
}
o(MO, "_objectSpread");
function sG(e, t, r) {
  return t = lG(t), t in e ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = r, e;
}
o(sG, "_defineProperty");
function lG(e) {
  var t = uG(e, "string");
  return xo(t) === "symbol" ? t : String(t);
}
o(lG, "_toPropertyKey");
function uG(e, t) {
  if (xo(e) !== "object" || e === null) return e;
  var r = e[Symbol.toPrimitive];
  if (r !== void 0) {
    var n = r.call(e, t || "default");
    if (xo(n) !== "object") return n;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
o(uG, "_toPrimitive");
function xu(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, r = mn(e, "aria-describedby").map(function(i) {
    return Cu(i, MO(MO({}, t), {}, {
      compute: "description"
    }));
  }).join(" ");
  if (r === "") {
    var n = e.getAttribute("title");
    r = n === null ? "" : n;
  }
  return r;
}
o(xu, "computeAccessibleDescription");

// ../node_modules/dom-accessibility-api/dist/accessible-name.mjs
function cG(e) {
  return pt(e, ["caption", "code", "deletion", "emphasis", "generic", "insertion", "paragraph", "presentation", "strong", "subscript", "supe\
rscript"]);
}
o(cG, "prohibitsNaming");
function _o(e) {
  var t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  return cG(e) ? "" : Cu(e, t);
}
o(_o, "computeAccessibleName");

// ../node_modules/@testing-library/dom/dist/@testing-library/dom.esm.js
var De = ze(kM()), VM = ze(LM());
function zM(e) {
  return e.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
o(zM, "escapeHTML");
var Yee = /* @__PURE__ */ o((e, t, r, n, i, a, s) => {
  let l = n + r.indent, c = r.colors;
  return e.map((u) => {
    let d = t[u], f = s(d, r, l, i, a);
    return typeof d != "string" && (f.indexOf(`
`) !== -1 && (f = r.spacingOuter + l + f + r.spacingOuter + n), f = "{" + f + "}"), r.spacingInner + n + c.prop.open + u + c.prop.close + "=" +
    c.value.open + f + c.value.close;
  }).join("");
}, "printProps"), Xee = 3, Jee = /* @__PURE__ */ o((e, t, r, n, i, a) => e.map((s) => {
  let l = typeof s == "string" ? WM(s, t) : a(s, t, r, n, i);
  return l === "" && typeof s == "object" && s !== null && s.nodeType !== Xee ? "" : t.spacingOuter + r + l;
}).join(""), "printChildren"), WM = /* @__PURE__ */ o((e, t) => {
  let r = t.colors.content;
  return r.open + zM(e) + r.close;
}, "printText"), Qee = /* @__PURE__ */ o((e, t) => {
  let r = t.colors.comment;
  return r.open + "<!--" + zM(e) + "-->" + r.close;
}, "printComment"), Zee = /* @__PURE__ */ o((e, t, r, n, i) => {
  let a = n.colors.tag;
  return a.open + "<" + e + (t && a.close + t + n.spacingOuter + i + a.open) + (r ? ">" + a.close + r + n.spacingOuter + i + a.open + "</" +
  e : (t && !n.min ? "" : " ") + "/") + ">" + a.close;
}, "printElement"), ete = /* @__PURE__ */ o((e, t) => {
  let r = t.colors.tag;
  return r.open + "<" + e + r.close + " \u2026" + r.open + " />" + r.close;
}, "printElementAsLeaf"), tte = 1, GM = 3, KM = 8, YM = 11, rte = /^((HTML|SVG)\w*)?Element$/, XM = /* @__PURE__ */ o((e) => {
  let {
    tagName: t
  } = e;
  return !!(typeof t == "string" && t.includes("-") || typeof e.hasAttribute == "function" && e.hasAttribute("is"));
}, "isCustomElement"), nte = /* @__PURE__ */ o((e) => {
  let t = e.constructor.name, {
    nodeType: r
  } = e;
  return r === tte && (rte.test(t) || XM(e)) || r === GM && t === "Text" || r === KM && t === "Comment" || r === YM && t === "DocumentFragme\
nt";
}, "testNode");
function ote(e) {
  return e.nodeType === GM;
}
o(ote, "nodeIsText");
function ite(e) {
  return e.nodeType === KM;
}
o(ite, "nodeIsComment");
function yy(e) {
  return e.nodeType === YM;
}
o(yy, "nodeIsFragment");
function ate(e) {
  return {
    test: /* @__PURE__ */ o((t) => {
      var r;
      return ((t == null || (r = t.constructor) == null ? void 0 : r.name) || XM(t)) && nte(t);
    }, "test"),
    serialize: /* @__PURE__ */ o((t, r, n, i, a, s) => {
      if (ote(t))
        return WM(t.data, r);
      if (ite(t))
        return Qee(t.data, r);
      let l = yy(t) ? "DocumentFragment" : t.tagName.toLowerCase();
      return ++i > r.maxDepth ? ete(l, r) : Zee(l, Yee(yy(t) ? [] : Array.from(t.attributes).map((c) => c.name).sort(), yy(t) ? {} : Array.from(
      t.attributes).reduce((c, u) => (c[u.name] = u.value, c), {}), r, n + r.indent, i, a, s), Jee(Array.prototype.slice.call(t.childNodes ||
      t.children).filter(e), r, n + r.indent, i, a, s), r, n);
    }, "serialize")
  };
}
o(ate, "createDOMElementFilter");
var JM = null, Ty = null, Oy = null;
try {
  let e = module && module.require;
  Ty = e.call(module, "fs").readFileSync, Oy = e.call(module, "@babel/code-frame").codeFrameColumns, JM = e.call(module, "chalk");
} catch {
}
function ste(e) {
  let t = e.indexOf("(") + 1, r = e.indexOf(")"), n = e.slice(t, r), i = n.split(":"), [a, s, l] = [i[0], parseInt(i[1], 10), parseInt(i[2],
  10)], c = "";
  try {
    c = Ty(a, "utf-8");
  } catch {
    return "";
  }
  let u = Oy(c, {
    start: {
      line: s,
      column: l
    }
  }, {
    highlightCode: !0,
    linesBelow: 0
  });
  return JM.dim(n) + `
` + u + `
`;
}
o(ste, "getCodeFrame");
function lte() {
  if (!Ty || !Oy)
    return "";
  let t = new Error().stack.split(`
`).slice(1).find((r) => !r.includes("node_modules/"));
  return ste(t);
}
o(lte, "getUserCodeFrame");
var QM = 3;
function gy() {
  return typeof jest < "u" && jest !== null ? (
    // legacy timers
    setTimeout._isMockFunction === !0 || // modern timers
    // eslint-disable-next-line prefer-object-has-own -- not supported by our support matrix
    Object.prototype.hasOwnProperty.call(setTimeout, "clock")
  ) : !1;
}
o(gy, "jestFakeTimersAreEnabled");
function Sy() {
  if (typeof window > "u")
    throw new Error("Could not find default container");
  return window.document;
}
o(Sy, "getDocument");
function ZM(e) {
  if (e.defaultView)
    return e.defaultView;
  if (e.ownerDocument && e.ownerDocument.defaultView)
    return e.ownerDocument.defaultView;
  if (e.window)
    return e.window;
  throw e.ownerDocument && e.ownerDocument.defaultView === null ? new Error("It looks like the window object is not available for the provid\
ed node.") : e.then instanceof Function ? new Error("It looks like you passed a Promise object instead of a DOM node. Did you do something l\
ike `fireEvent.click(screen.findBy...` when you meant to use a `getBy` query `fireEvent.click(screen.getBy...`, or await the findBy query `f\
ireEvent.click(await screen.findBy...`?") : Array.isArray(e) ? new Error("It looks like you passed an Array instead of a DOM node. Did you d\
o something like `fireEvent.click(screen.getAllBy...` when you meant to use a `getBy` query `fireEvent.click(screen.getBy...`?") : typeof e.
  debug == "function" && typeof e.logTestingPlaygroundURL == "function" ? new Error("It looks like you passed a `screen` object. Did you do \
something like `fireEvent.click(screen, ...` when you meant to use a query, e.g. `fireEvent.click(screen.getBy..., `?") : new Error("The giv\
en node is not an Element, the node type is: " + typeof e + ".");
}
o(ZM, "getWindowFromNode");
function Tt(e) {
  if (!e || typeof e.querySelector != "function" || typeof e.querySelectorAll != "function")
    throw new TypeError("Expected container to be an Element, a Document or a DocumentFragment but got " + t(e) + ".");
  function t(r) {
    return typeof r == "object" ? r === null ? "null" : r.constructor.name : typeof r;
  }
  o(t, "getTypeName");
}
o(Tt, "checkContainerType");
var ute = /* @__PURE__ */ o(() => {
  if (typeof process > "u")
    return !1;
  let e;
  try {
    var t;
    let r = (t = process.env) == null ? void 0 : t.COLORS;
    r && (e = JSON.parse(r));
  } catch {
  }
  return typeof e == "boolean" ? e : process.versions !== void 0 && process.versions.node !== void 0;
}, "shouldHighlight"), {
  DOMCollection: cte
} = Mo.plugins, dte = 1, fte = 8;
function pte(e) {
  return e.nodeType !== fte && (e.nodeType !== dte || !e.matches(Z().defaultIgnore));
}
o(pte, "filterCommentsAndDefaultIgnoreTagsTags");
function To(e, t, r) {
  if (r === void 0 && (r = {}), e || (e = Sy().body), typeof t != "number" && (t = typeof process < "u" && typeof process.env < "u" && process.
  env.DEBUG_PRINT_LIMIT || 7e3), t === 0)
    return "";
  e.documentElement && (e = e.documentElement);
  let n = typeof e;
  if (n === "object" ? n = e.constructor.name : e = {}, !("outerHTML" in e))
    throw new TypeError("Expected an element or document but got " + n);
  let {
    filterNode: i = pte,
    ...a
  } = r, s = Mo.format(e, {
    plugins: [ate(i), cte],
    printFunctionName: !1,
    highlight: ute(),
    ...a
  });
  return t !== void 0 && e.outerHTML.length > t ? s.slice(0, t) + "..." : s;
}
o(To, "prettyDOM");
var vy = /* @__PURE__ */ o(function() {
  let e = lte();
  console.log(e ? To(...arguments) + `

` + e : To(...arguments));
}, "logDOM"), _r = {
  testIdAttribute: "data-testid",
  asyncUtilTimeout: 1e3,
  // asyncWrapper and advanceTimersWrapper is to support React's async `act` function.
  // forcing react-testing-library to wrap all async functions would've been
  // a total nightmare (consider wrapping every findBy* query and then also
  // updating `within` so those would be wrapped too. Total nightmare).
  // so we have this config option that's really only intended for
  // react-testing-library to use. For that reason, this feature will remain
  // undocumented.
  asyncWrapper: /* @__PURE__ */ o((e) => e(), "asyncWrapper"),
  unstable_advanceTimersWrapper: /* @__PURE__ */ o((e) => e(), "unstable_advanceTimersWrapper"),
  eventWrapper: /* @__PURE__ */ o((e) => e(), "eventWrapper"),
  // default value for the `hidden` option in `ByRole` queries
  defaultHidden: !1,
  // default value for the `ignore` option in `ByText` queries
  defaultIgnore: "script, style",
  // showOriginalStackTrace flag to show the full error stack traces for async errors
  showOriginalStackTrace: !1,
  // throw errors w/ suggestions for better queries. Opt in so off by default.
  throwSuggestions: !1,
  // called when getBy* queries fail. (message, container) => Error
  getElementError(e, t) {
    let r = To(t), n = new Error([e, "Ignored nodes: comments, " + _r.defaultIgnore + `
` + r].filter(Boolean).join(`

`));
    return n.name = "TestingLibraryElementError", n;
  },
  _disableExpensiveErrorDiagnostics: !1,
  computedStyleSupportsPseudoElements: !1
};
function mte(e) {
  try {
    return _r._disableExpensiveErrorDiagnostics = !0, e();
  } finally {
    _r._disableExpensiveErrorDiagnostics = !1;
  }
}
o(mte, "runWithExpensiveErrorDiagnosticsDisabled");
function hte(e) {
  typeof e == "function" && (e = e(_r)), _r = {
    ..._r,
    ...e
  };
}
o(hte, "configure");
function Z() {
  return _r;
}
o(Z, "getConfig");
var bte = ["button", "meter", "output", "progress", "select", "textarea", "input"];
function eA(e) {
  return bte.includes(e.nodeName.toLowerCase()) ? "" : e.nodeType === QM ? e.textContent : Array.from(e.childNodes).map((t) => eA(t)).join("");
}
o(eA, "getTextContent");
function wy(e) {
  let t;
  return e.tagName.toLowerCase() === "label" ? t = eA(e) : t = e.value || e.textContent, t;
}
o(wy, "getLabelContent");
function tA(e) {
  if (e.labels !== void 0) {
    var t;
    return (t = e.labels) != null ? t : [];
  }
  if (!yte(e)) return [];
  let r = e.ownerDocument.querySelectorAll("label");
  return Array.from(r).filter((n) => n.control === e);
}
o(tA, "getRealLabels");
function yte(e) {
  return /BUTTON|METER|OUTPUT|PROGRESS|SELECT|TEXTAREA/.test(e.tagName) || e.tagName === "INPUT" && e.getAttribute("type") !== "hidden";
}
o(yte, "isLabelable");
function rA(e, t, r) {
  let {
    selector: n = "*"
  } = r === void 0 ? {} : r, i = t.getAttribute("aria-labelledby"), a = i ? i.split(" ") : [];
  return a.length ? a.map((s) => {
    let l = e.querySelector('[id="' + s + '"]');
    return l ? {
      content: wy(l),
      formControl: null
    } : {
      content: "",
      formControl: null
    };
  }) : Array.from(tA(t)).map((s) => {
    let l = wy(s), u = Array.from(s.querySelectorAll("button, input, meter, output, progress, select, textarea")).filter((d) => d.matches(n))[0];
    return {
      content: l,
      formControl: u
    };
  });
}
o(rA, "getLabels");
function nA(e) {
  if (e == null)
    throw new Error(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- implicitly converting `T` to `string`
      "It looks like " + e + " was passed instead of a matcher. Did you do something like getByText(" + e + ")?"
    );
}
o(nA, "assertNotNullOrUndefined");
function wn(e, t, r, n) {
  if (typeof e != "string")
    return !1;
  nA(r);
  let i = n(e);
  return typeof r == "string" || typeof r == "number" ? i.toLowerCase().includes(r.toString().toLowerCase()) : typeof r == "function" ? r(i,
  t) : oA(r, i);
}
o(wn, "fuzzyMatches");
function Rt(e, t, r, n) {
  if (typeof e != "string")
    return !1;
  nA(r);
  let i = n(e);
  return r instanceof Function ? r(i, t) : r instanceof RegExp ? oA(r, i) : i === String(r);
}
o(Rt, "matches");
function My(e) {
  let {
    trim: t = !0,
    collapseWhitespace: r = !0
  } = e === void 0 ? {} : e;
  return (n) => {
    let i = n;
    return i = t ? i.trim() : i, i = r ? i.replace(/\s+/g, " ") : i, i;
  };
}
o(My, "getDefaultNormalizer");
function qr(e) {
  let {
    trim: t,
    collapseWhitespace: r,
    normalizer: n
  } = e;
  if (!n)
    return My({
      trim: t,
      collapseWhitespace: r
    });
  if (typeof t < "u" || typeof r < "u")
    throw new Error('trim and collapseWhitespace are not supported with a normalizer. If you want to use the default trim and collapseWhites\
pace logic in your normalizer, use "getDefaultNormalizer({trim, collapseWhitespace})" and compose that into your normalizer');
  return n;
}
o(qr, "makeNormalizer");
function oA(e, t) {
  let r = e.test(t);
  return e.global && e.lastIndex !== 0 && (console.warn("To match all elements we had to reset the lastIndex of the RegExp because the globa\
l flag is enabled. We encourage to remove the global flag from the RegExp."), e.lastIndex = 0), r;
}
o(oA, "matchRegExp");
function Ao(e) {
  return e.matches("input[type=submit], input[type=button], input[type=reset]") ? e.value : Array.from(e.childNodes).filter((t) => t.nodeType ===
  QM && !!t.textContent).map((t) => t.textContent).join("");
}
o(Ao, "getNodeText");
var gte = vte(De.elementRoles);
function iA(e) {
  return e.hidden === !0 || e.getAttribute("aria-hidden") === "true" || e.ownerDocument.defaultView.getComputedStyle(e).display === "none";
}
o(iA, "isSubtreeInaccessible");
function _f(e, t) {
  t === void 0 && (t = {});
  let {
    isSubtreeInaccessible: r = iA
  } = t;
  if (e.ownerDocument.defaultView.getComputedStyle(e).visibility === "hidden")
    return !0;
  let i = e;
  for (; i; ) {
    if (r(i))
      return !0;
    i = i.parentElement;
  }
  return !1;
}
o(_f, "isInaccessible");
function Ay(e) {
  for (let {
    match: t,
    roles: r
  } of gte)
    if (t(e))
      return [...r];
  return [];
}
o(Ay, "getImplicitAriaRoles");
function vte(e) {
  function t(s) {
    let {
      name: l,
      attributes: c
    } = s;
    return "" + l + c.map((u) => {
      let {
        name: d,
        value: f,
        constraints: h = []
      } = u, m = h.indexOf("undefined") !== -1, y = h.indexOf("set") !== -1;
      return typeof f < "u" ? "[" + d + '="' + f + '"]' : m ? ":not([" + d + "])" : y ? "[" + d + "]:not([" + d + '=""])' : "[" + d + "]";
    }).join("");
  }
  o(t, "makeElementSelector");
  function r(s) {
    let {
      attributes: l = []
    } = s;
    return l.length;
  }
  o(r, "getSelectorSpecificity");
  function n(s, l) {
    let {
      specificity: c
    } = s, {
      specificity: u
    } = l;
    return u - c;
  }
  o(n, "bySelectorSpecificity");
  function i(s) {
    let {
      attributes: l = []
    } = s, c = l.findIndex((d) => d.value && d.name === "type" && d.value === "text");
    c >= 0 && (l = [...l.slice(0, c), ...l.slice(c + 1)]);
    let u = t({
      ...s,
      attributes: l
    });
    return (d) => c >= 0 && d.type !== "text" ? !1 : d.matches(u);
  }
  o(i, "match");
  let a = [];
  for (let [s, l] of e.entries())
    a = [...a, {
      match: i(s),
      roles: Array.from(l),
      specificity: r(s)
    }];
  return a.sort(n);
}
o(vte, "buildElementRoleList");
function aA(e, t) {
  let {
    hidden: r = !1
  } = t === void 0 ? {} : t;
  function n(i) {
    return [i, ...Array.from(i.children).reduce((a, s) => [...a, ...n(s)], [])];
  }
  return o(n, "flattenDOM"), n(e).filter((i) => r === !1 ? _f(i) === !1 : !0).reduce((i, a) => {
    let s = [];
    return a.hasAttribute("role") ? s = a.getAttribute("role").split(" ").slice(0, 1) : s = Ay(a), s.reduce((l, c) => Array.isArray(l[c]) ? {
      ...l,
      [c]: [...l[c], a]
    } : {
      ...l,
      [c]: [a]
    }, i);
  }, {});
}
o(aA, "getRoles");
function sA(e, t) {
  let {
    hidden: r,
    includeDescription: n
  } = t, i = aA(e, {
    hidden: r
  });
  return Object.entries(i).filter((a) => {
    let [s] = a;
    return s !== "generic";
  }).map((a) => {
    let [s, l] = a, c = "-".repeat(50), u = l.map((d) => {
      let f = 'Name "' + _o(d, {
        computedStyleSupportsPseudoElements: Z().computedStyleSupportsPseudoElements
      }) + `":
`, h = To(d.cloneNode(!1));
      if (n) {
        let m = 'Description "' + xu(d, {
          computedStyleSupportsPseudoElements: Z().computedStyleSupportsPseudoElements
        }) + `":
`;
        return "" + f + m + h;
      }
      return "" + f + h;
    }).join(`

`);
    return s + `:

` + u + `

` + c;
  }).join(`
`);
}
o(sA, "prettyRoles");
var wte = /* @__PURE__ */ o(function(e, t) {
  let {
    hidden: r = !1
  } = t === void 0 ? {} : t;
  return console.log(sA(e, {
    hidden: r
  }));
}, "logRoles");
function Ete(e) {
  return e.tagName === "OPTION" ? e.selected : No(e, "aria-selected");
}
o(Ete, "computeAriaSelected");
function Cte(e) {
  return e.getAttribute("aria-busy") === "true";
}
o(Cte, "computeAriaBusy");
function xte(e) {
  if (!("indeterminate" in e && e.indeterminate))
    return "checked" in e ? e.checked : No(e, "aria-checked");
}
o(xte, "computeAriaChecked");
function _te(e) {
  return No(e, "aria-pressed");
}
o(_te, "computeAriaPressed");
function Pte(e) {
  var t, r;
  return (t = (r = No(e, "aria-current")) != null ? r : e.getAttribute("aria-current")) != null ? t : !1;
}
o(Pte, "computeAriaCurrent");
function qte(e) {
  return No(e, "aria-expanded");
}
o(qte, "computeAriaExpanded");
function No(e, t) {
  let r = e.getAttribute(t);
  if (r === "true")
    return !0;
  if (r === "false")
    return !1;
}
o(No, "checkBooleanAttribute");
function Rte(e) {
  let t = {
    H1: 1,
    H2: 2,
    H3: 3,
    H4: 4,
    H5: 5,
    H6: 6
  };
  return e.getAttribute("aria-level") && Number(e.getAttribute("aria-level")) || t[e.tagName];
}
o(Rte, "computeHeadingLevel");
function Tte(e) {
  let t = e.getAttribute("aria-valuenow");
  return t === null ? void 0 : +t;
}
o(Tte, "computeAriaValueNow");
function Ote(e) {
  let t = e.getAttribute("aria-valuemax");
  return t === null ? void 0 : +t;
}
o(Ote, "computeAriaValueMax");
function Ste(e) {
  let t = e.getAttribute("aria-valuemin");
  return t === null ? void 0 : +t;
}
o(Ste, "computeAriaValueMin");
function Mte(e) {
  let t = e.getAttribute("aria-valuetext");
  return t === null ? void 0 : t;
}
o(Mte, "computeAriaValueText");
var $M = My();
function Ate(e) {
  return e.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
}
o(Ate, "escapeRegExp");
function BM(e) {
  return new RegExp(Ate(e.toLowerCase()), "i");
}
o(BM, "getRegExpMatcher");
function rr(e, t, r, n) {
  let {
    variant: i,
    name: a
  } = n, s = "", l = {}, c = [["Role", "TestId"].includes(e) ? r : BM(r)];
  a && (l.name = BM(a)), e === "Role" && _f(t) && (l.hidden = !0, s = `Element is inaccessible. This means that the element and all its chil\
dren are invisible to screen readers.
    If you are using the aria-hidden prop, make sure this is the right choice for your case.
    `), Object.keys(l).length > 0 && c.push(l);
  let u = i + "By" + e;
  return {
    queryName: e,
    queryMethod: u,
    queryArgs: c,
    variant: i,
    warning: s,
    toString() {
      s && console.warn(s);
      let [d, f] = c;
      return d = typeof d == "string" ? "'" + d + "'" : d, f = f ? ", { " + Object.entries(f).map((h) => {
        let [m, y] = h;
        return m + ": " + y;
      }).join(", ") + " }" : "", u + "(" + d + f + ")";
    }
  };
}
o(rr, "makeSuggestion");
function nr(e, t, r) {
  return r && (!t || t.toLowerCase() === e.toLowerCase());
}
o(nr, "canSuggest");
function Cf(e, t, r) {
  var n, i;
  if (t === void 0 && (t = "get"), e.matches(Z().defaultIgnore))
    return;
  let a = (n = e.getAttribute("role")) != null ? n : (i = Ay(e)) == null ? void 0 : i[0];
  if (a !== "generic" && nr("Role", r, a))
    return rr("Role", e, a, {
      variant: t,
      name: _o(e, {
        computedStyleSupportsPseudoElements: Z().computedStyleSupportsPseudoElements
      })
    });
  let s = rA(document, e).map((h) => h.content).join(" ");
  if (nr("LabelText", r, s))
    return rr("LabelText", e, s, {
      variant: t
    });
  let l = e.getAttribute("placeholder");
  if (nr("PlaceholderText", r, l))
    return rr("PlaceholderText", e, l, {
      variant: t
    });
  let c = $M(Ao(e));
  if (nr("Text", r, c))
    return rr("Text", e, c, {
      variant: t
    });
  if (nr("DisplayValue", r, e.value))
    return rr("DisplayValue", e, $M(e.value), {
      variant: t
    });
  let u = e.getAttribute("alt");
  if (nr("AltText", r, u))
    return rr("AltText", e, u, {
      variant: t
    });
  let d = e.getAttribute("title");
  if (nr("Title", r, d))
    return rr("Title", e, d, {
      variant: t
    });
  let f = e.getAttribute(Z().testIdAttribute);
  if (nr("TestId", r, f))
    return rr("TestId", e, f, {
      variant: t
    });
}
o(Cf, "getSuggestedQuery");
function wf(e, t) {
  e.stack = t.stack.replace(t.message, e.message);
}
o(wf, "copyStackTrace");
function Nte(e, t) {
  let {
    container: r = Sy(),
    timeout: n = Z().asyncUtilTimeout,
    showOriginalStackTrace: i = Z().showOriginalStackTrace,
    stackTraceError: a,
    interval: s = 50,
    onTimeout: l = /* @__PURE__ */ o((u) => (Object.defineProperty(u, "message", {
      value: Z().getElementError(u.message, r).message
    }), u), "onTimeout"),
    mutationObserverOptions: c = {
      subtree: !0,
      childList: !0,
      attributes: !0,
      characterData: !0
    }
  } = t;
  if (typeof e != "function")
    throw new TypeError("Received `callback` arg must be a function");
  return new Promise(async (u, d) => {
    let f, h, m, y = !1, g = "idle", x = setTimeout(P, n), b = gy();
    if (b) {
      let {
        unstable_advanceTimersWrapper: O
      } = Z();
      for (C(); !y; ) {
        if (!gy()) {
          let R = new Error("Changed from using fake timers to real timers while using waitFor. This is not allowed and will result in very \
strange behavior. Please ensure you're awaiting all async things your test is doing before changing to real timers. For more info, please go\
 to https://github.com/testing-library/dom-testing-library/issues/830");
          i || wf(R, a), d(R);
          return;
        }
        if (await O(async () => {
          jest.advanceTimersByTime(s);
        }), y)
          break;
        C();
      }
    } else {
      try {
        Tt(r);
      } catch (R) {
        d(R);
        return;
      }
      h = setInterval(q, s);
      let {
        MutationObserver: O
      } = ZM(r);
      m = new O(q), m.observe(r, c), C();
    }
    function E(O, R) {
      y = !0, clearTimeout(x), b || (clearInterval(h), m.disconnect()), O ? d(O) : u(R);
    }
    o(E, "onDone");
    function q() {
      if (gy()) {
        let O = new Error("Changed from using real timers to fake timers while using waitFor. This is not allowed and will result in very st\
range behavior. Please ensure you're awaiting all async things your test is doing before changing to fake timers. For more info, please go t\
o https://github.com/testing-library/dom-testing-library/issues/830");
        return i || wf(O, a), d(O);
      } else
        return C();
    }
    o(q, "checkRealTimersCallback");
    function C() {
      if (g !== "pending")
        try {
          let O = mte(e);
          typeof O?.then == "function" ? (g = "pending", O.then((R) => {
            g = "resolved", E(null, R);
          }, (R) => {
            g = "rejected", f = R;
          })) : E(null, O);
        } catch (O) {
          f = O;
        }
    }
    o(C, "checkCallback");
    function P() {
      let O;
      f ? (O = f, !i && O.name === "TestingLibraryElementError" && wf(O, a)) : (O = new Error("Timed out in waitFor."), i || wf(O, a)), E(l(
      O), null);
    }
    o(P, "handleTimeout");
  });
}
o(Nte, "waitFor");
function Ny(e, t) {
  let r = new Error("STACK_TRACE_MESSAGE");
  return Z().asyncWrapper(() => Nte(e, {
    stackTraceError: r,
    ...t
  }));
}
o(Ny, "waitForWrapper");
function Pf(e, t) {
  return Z().getElementError(e, t);
}
o(Pf, "getElementError");
function qf(e, t) {
  return Pf(e + "\n\n(If this is intentional, then use the `*AllBy*` variant of the query (like `queryAllByText`, `getAllByText`, or `findAllB\
yText`)).", t);
}
o(qf, "getMultipleElementsFoundError");
function Rr(e, t, r, n) {
  let {
    exact: i = !0,
    collapseWhitespace: a,
    trim: s,
    normalizer: l
  } = n === void 0 ? {} : n, c = i ? Rt : wn, u = qr({
    collapseWhitespace: a,
    trim: s,
    normalizer: l
  });
  return Array.from(t.querySelectorAll("[" + e + "]")).filter((d) => c(d.getAttribute(e), d, r, u));
}
o(Rr, "queryAllByAttribute");
function lA(e, t, r, n) {
  let i = Rr(e, t, r, n);
  if (i.length > 1)
    throw qf("Found multiple elements by [" + e + "=" + r + "]", t);
  return i[0] || null;
}
o(lA, "queryByAttribute");
function gn(e, t) {
  return function(r) {
    for (var n = arguments.length, i = new Array(n > 1 ? n - 1 : 0), a = 1; a < n; a++)
      i[a - 1] = arguments[a];
    let s = e(r, ...i);
    if (s.length > 1) {
      let l = s.map((c) => Pf(null, c).message).join(`

`);
      throw qf(t(r, ...i) + `

Here are the matching elements:

` + l, r);
    }
    return s[0] || null;
  };
}
o(gn, "makeSingleQuery");
function uA(e, t) {
  return Z().getElementError(`A better query is available, try this:
` + e.toString() + `
`, t);
}
o(uA, "getSuggestionError");
function Iy(e, t) {
  return function(r) {
    for (var n = arguments.length, i = new Array(n > 1 ? n - 1 : 0), a = 1; a < n; a++)
      i[a - 1] = arguments[a];
    let s = e(r, ...i);
    if (!s.length)
      throw Z().getElementError(t(r, ...i), r);
    return s;
  };
}
o(Iy, "makeGetAllQuery");
function vn(e) {
  return (t, r, n, i) => Ny(() => e(t, r, n), {
    container: t,
    ...i
  });
}
o(vn, "makeFindQuery");
var or = /* @__PURE__ */ o((e, t, r) => function(n) {
  for (var i = arguments.length, a = new Array(i > 1 ? i - 1 : 0), s = 1; s < i; s++)
    a[s - 1] = arguments[s];
  let l = e(n, ...a), [{
    suggest: c = Z().throwSuggestions
  } = {}] = a.slice(-1);
  if (l && c) {
    let u = Cf(l, r);
    if (u && !t.endsWith(u.queryName))
      throw uA(u.toString(), n);
  }
  return l;
}, "wrapSingleQueryWithSuggestion"), He = /* @__PURE__ */ o((e, t, r) => function(n) {
  for (var i = arguments.length, a = new Array(i > 1 ? i - 1 : 0), s = 1; s < i; s++)
    a[s - 1] = arguments[s];
  let l = e(n, ...a), [{
    suggest: c = Z().throwSuggestions
  } = {}] = a.slice(-1);
  if (l.length && c) {
    let u = [...new Set(l.map((d) => {
      var f;
      return (f = Cf(d, r)) == null ? void 0 : f.toString();
    }))];
    if (
      // only want to suggest if all the els have the same suggestion.
      u.length === 1 && !t.endsWith(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- TODO: Can this be null at runtime?
        Cf(l[0], r).queryName
      )
    )
      throw uA(u[0], n);
  }
  return l;
}, "wrapAllByQueryWithSuggestion");
function Ot(e, t, r) {
  let n = or(gn(e, t), e.name, "query"), i = Iy(e, r), a = gn(i, t), s = or(a, e.name, "get"), l = He(i, e.name.replace("query", "get"), "ge\
tAll"), c = vn(He(i, e.name, "findAll")), u = vn(or(a, e.name, "find"));
  return [n, l, s, c, u];
}
o(Ot, "buildQueries");
var Ite = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  getElementError: Pf,
  wrapAllByQueryWithSuggestion: He,
  wrapSingleQueryWithSuggestion: or,
  getMultipleElementsFoundError: qf,
  queryAllByAttribute: Rr,
  queryByAttribute: lA,
  makeSingleQuery: gn,
  makeGetAllQuery: Iy,
  makeFindQuery: vn,
  buildQueries: Ot
});
function jte(e) {
  return Array.from(e.querySelectorAll("label,input")).map((t) => ({
    node: t,
    textToMatch: wy(t)
  })).filter((t) => {
    let {
      textToMatch: r
    } = t;
    return r !== null;
  });
}
o(jte, "queryAllLabels");
var kte = /* @__PURE__ */ o(function(e, t, r) {
  let {
    exact: n = !0,
    trim: i,
    collapseWhitespace: a,
    normalizer: s
  } = r === void 0 ? {} : r, l = n ? Rt : wn, c = qr({
    collapseWhitespace: a,
    trim: i,
    normalizer: s
  });
  return jte(e).filter((d) => {
    let {
      node: f,
      textToMatch: h
    } = d;
    return l(h, f, t, c);
  }).map((d) => {
    let {
      node: f
    } = d;
    return f;
  });
}, "queryAllLabelsByText"), Oo = /* @__PURE__ */ o(function(e, t, r) {
  let {
    selector: n = "*",
    exact: i = !0,
    collapseWhitespace: a,
    trim: s,
    normalizer: l
  } = r === void 0 ? {} : r;
  Tt(e);
  let c = i ? Rt : wn, u = qr({
    collapseWhitespace: a,
    trim: s,
    normalizer: l
  }), d = Array.from(e.querySelectorAll("*")).filter((f) => tA(f).length || f.hasAttribute("aria-labelledby")).reduce((f, h) => {
    let m = rA(e, h, {
      selector: n
    });
    m.filter((g) => !!g.formControl).forEach((g) => {
      c(g.content, g.formControl, t, u) && g.formControl && f.push(g.formControl);
    });
    let y = m.filter((g) => !!g.content).map((g) => g.content);
    return c(y.join(" "), h, t, u) && f.push(h), y.length > 1 && y.forEach((g, x) => {
      c(g, h, t, u) && f.push(h);
      let b = [...y];
      b.splice(x, 1), b.length > 1 && c(b.join(" "), h, t, u) && f.push(h);
    }), f;
  }, []).concat(Rr("aria-label", e, t, {
    exact: i,
    normalizer: u
  }));
  return Array.from(new Set(d)).filter((f) => f.matches(n));
}, "queryAllByLabelText"), Pr = /* @__PURE__ */ o(function(e, t) {
  for (var r = arguments.length, n = new Array(r > 2 ? r - 2 : 0), i = 2; i < r; i++)
    n[i - 2] = arguments[i];
  let a = Oo(e, t, ...n);
  if (!a.length) {
    let s = kte(e, t, ...n);
    if (s.length) {
      let l = s.map((c) => Lte(e, c)).filter((c) => !!c);
      throw l.length ? Z().getElementError(l.map((c) => "Found a label with the text of: " + t + ", however the element associated with this\
 label (<" + c + " />) is non-labellable [https://html.spec.whatwg.org/multipage/forms.html#category-label]. If you really need to label a <" +
      c + " />, you can use aria-label or aria-labelledby instead.").join(`

`), e) : Z().getElementError("Found a label with the text of: " + t + `, however no form control was found associated to that label. Make su\
re you're using the "for" attribute or "aria-labelledby" attribute correctly.`, e);
    } else
      throw Z().getElementError("Unable to find a label with the text of: " + t, e);
  }
  return a;
}, "getAllByLabelText");
function Lte(e, t) {
  let r = t.getAttribute("for");
  if (!r)
    return null;
  let n = e.querySelector('[id="' + r + '"]');
  return n ? n.tagName.toLowerCase() : null;
}
o(Lte, "getTagNameOfElementAssociatedWithLabelViaFor");
var cA = /* @__PURE__ */ o((e, t) => "Found multiple elements with the text of: " + t, "getMultipleError$7"), dA = or(gn(Oo, cA), Oo.name, "\
query"), fA = gn(Pr, cA), pA = vn(He(Pr, Pr.name, "findAll")), mA = vn(or(fA, Pr.name, "find")), hA = He(Pr, Pr.name, "getAll"), bA = or(fA,
Pr.name, "get"), yA = He(Oo, Oo.name, "queryAll"), Ey = /* @__PURE__ */ o(function() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  return Tt(t[0]), Rr("placeholder", ...t);
}, "queryAllByPlaceholderText"), $te = /* @__PURE__ */ o((e, t) => "Found multiple elements with the placeholder text of: " + t, "getMultipl\
eError$6"), Bte = /* @__PURE__ */ o((e, t) => "Unable to find an element with the placeholder text of: " + t, "getMissingError$6"), gA = He(
Ey, Ey.name, "queryAll"), [vA, wA, EA, CA, xA] = Ot(Ey, $te, Bte), Cy = /* @__PURE__ */ o(function(e, t, r) {
  let {
    selector: n = "*",
    exact: i = !0,
    collapseWhitespace: a,
    trim: s,
    ignore: l = Z().defaultIgnore,
    normalizer: c
  } = r === void 0 ? {} : r;
  Tt(e);
  let u = i ? Rt : wn, d = qr({
    collapseWhitespace: a,
    trim: s,
    normalizer: c
  }), f = [];
  return typeof e.matches == "function" && e.matches(n) && (f = [e]), [...f, ...Array.from(e.querySelectorAll(n))].filter((h) => !l || !h.matches(
  l)).filter((h) => u(Ao(h), h, t, d));
}, "queryAllByText"), Dte = /* @__PURE__ */ o((e, t) => "Found multiple elements with the text: " + t, "getMultipleError$5"), Fte = /* @__PURE__ */ o(
function(e, t, r) {
  r === void 0 && (r = {});
  let {
    collapseWhitespace: n,
    trim: i,
    normalizer: a,
    selector: s
  } = r, c = qr({
    collapseWhitespace: n,
    trim: i,
    normalizer: a
  })(t.toString()), u = c !== t.toString(), d = (s ?? "*") !== "*";
  return "Unable to find an element with the text: " + (u ? c + " (normalized from '" + t + "')" : t) + (d ? ", which matches selector '" + s +
  "'" : "") + ". This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text ma\
tcher to make your matcher more flexible.";
}, "getMissingError$5"), _A = He(Cy, Cy.name, "queryAll"), [PA, qA, RA, TA, OA] = Ot(Cy, Dte, Fte), xy = /* @__PURE__ */ o(function(e, t, r) {
  let {
    exact: n = !0,
    collapseWhitespace: i,
    trim: a,
    normalizer: s
  } = r === void 0 ? {} : r;
  Tt(e);
  let l = n ? Rt : wn, c = qr({
    collapseWhitespace: i,
    trim: a,
    normalizer: s
  });
  return Array.from(e.querySelectorAll("input,textarea,select")).filter((u) => u.tagName === "SELECT" ? Array.from(u.options).filter((f) => f.
  selected).some((f) => l(Ao(f), f, t, c)) : l(u.value, u, t, c));
}, "queryAllByDisplayValue"), Ute = /* @__PURE__ */ o((e, t) => "Found multiple elements with the display value: " + t + ".", "getMultipleEr\
ror$4"), Hte = /* @__PURE__ */ o((e, t) => "Unable to find an element with the display value: " + t + ".", "getMissingError$4"), SA = He(xy,
xy.name, "queryAll"), [MA, AA, NA, IA, jA] = Ot(xy, Ute, Hte), Vte = /^(img|input|area|.+-.+)$/i, _y = /* @__PURE__ */ o(function(e, t, r) {
  return r === void 0 && (r = {}), Tt(e), Rr("alt", e, t, r).filter((n) => Vte.test(n.tagName));
}, "queryAllByAltText"), zte = /* @__PURE__ */ o((e, t) => "Found multiple elements with the alt text: " + t, "getMultipleError$3"), Wte = /* @__PURE__ */ o(
(e, t) => "Unable to find an element with the alt text: " + t, "getMissingError$3"), kA = He(_y, _y.name, "queryAll"), [LA, $A, BA, DA, FA] = Ot(
_y, zte, Wte), Gte = /* @__PURE__ */ o((e) => {
  var t;
  return e.tagName.toLowerCase() === "title" && ((t = e.parentElement) == null ? void 0 : t.tagName.toLowerCase()) === "svg";
}, "isSvgTitle"), Py = /* @__PURE__ */ o(function(e, t, r) {
  let {
    exact: n = !0,
    collapseWhitespace: i,
    trim: a,
    normalizer: s
  } = r === void 0 ? {} : r;
  Tt(e);
  let l = n ? Rt : wn, c = qr({
    collapseWhitespace: i,
    trim: a,
    normalizer: s
  });
  return Array.from(e.querySelectorAll("[title], svg > title")).filter((u) => l(u.getAttribute("title"), u, t, c) || Gte(u) && l(Ao(u), u, t,
  c));
}, "queryAllByTitle"), Kte = /* @__PURE__ */ o((e, t) => "Found multiple elements with the title: " + t + ".", "getMultipleError$2"), Yte = /* @__PURE__ */ o(
(e, t) => "Unable to find an element with the title: " + t + ".", "getMissingError$2"), UA = He(Py, Py.name, "queryAll"), [HA, VA, zA, WA, GA] = Ot(
Py, Kte, Yte), qy = /* @__PURE__ */ o(function(e, t, r) {
  let {
    hidden: n = Z().defaultHidden,
    name: i,
    description: a,
    queryFallbacks: s = !1,
    selected: l,
    busy: c,
    checked: u,
    pressed: d,
    current: f,
    level: h,
    expanded: m,
    value: {
      now: y,
      min: g,
      max: x,
      text: b
    } = {}
  } = r === void 0 ? {} : r;
  if (Tt(e), l !== void 0) {
    var E;
    if (((E = De.roles.get(t)) == null ? void 0 : E.props["aria-selected"]) === void 0)
      throw new Error('"aria-selected" is not supported on role "' + t + '".');
  }
  if (c !== void 0) {
    var q;
    if (((q = De.roles.get(t)) == null ? void 0 : q.props["aria-busy"]) === void 0)
      throw new Error('"aria-busy" is not supported on role "' + t + '".');
  }
  if (u !== void 0) {
    var C;
    if (((C = De.roles.get(t)) == null ? void 0 : C.props["aria-checked"]) === void 0)
      throw new Error('"aria-checked" is not supported on role "' + t + '".');
  }
  if (d !== void 0) {
    var P;
    if (((P = De.roles.get(t)) == null ? void 0 : P.props["aria-pressed"]) === void 0)
      throw new Error('"aria-pressed" is not supported on role "' + t + '".');
  }
  if (f !== void 0) {
    var O;
    if (((O = De.roles.get(t)) == null ? void 0 : O.props["aria-current"]) === void 0)
      throw new Error('"aria-current" is not supported on role "' + t + '".');
  }
  if (h !== void 0 && t !== "heading")
    throw new Error('Role "' + t + '" cannot have "level" property.');
  if (y !== void 0) {
    var R;
    if (((R = De.roles.get(t)) == null ? void 0 : R.props["aria-valuenow"]) === void 0)
      throw new Error('"aria-valuenow" is not supported on role "' + t + '".');
  }
  if (x !== void 0) {
    var A;
    if (((A = De.roles.get(t)) == null ? void 0 : A.props["aria-valuemax"]) === void 0)
      throw new Error('"aria-valuemax" is not supported on role "' + t + '".');
  }
  if (g !== void 0) {
    var j;
    if (((j = De.roles.get(t)) == null ? void 0 : j.props["aria-valuemin"]) === void 0)
      throw new Error('"aria-valuemin" is not supported on role "' + t + '".');
  }
  if (b !== void 0) {
    var J;
    if (((J = De.roles.get(t)) == null ? void 0 : J.props["aria-valuetext"]) === void 0)
      throw new Error('"aria-valuetext" is not supported on role "' + t + '".');
  }
  if (m !== void 0) {
    var S;
    if (((S = De.roles.get(t)) == null ? void 0 : S.props["aria-expanded"]) === void 0)
      throw new Error('"aria-expanded" is not supported on role "' + t + '".');
  }
  let G = /* @__PURE__ */ new WeakMap();
  function ne(B) {
    return G.has(B) || G.set(B, iA(B)), G.get(B);
  }
  return o(ne, "cachedIsSubtreeInaccessible"), Array.from(e.querySelectorAll(
    // Only query elements that can be matched by the following filters
    Xte(t)
  )).filter((B) => {
    if (B.hasAttribute("role")) {
      let W = B.getAttribute("role");
      if (s)
        return W.split(" ").filter(Boolean).some((ee) => ee === t);
      let [V] = W.split(" ");
      return V === t;
    }
    return Ay(B).some((W) => W === t);
  }).filter((B) => {
    if (l !== void 0)
      return l === Ete(B);
    if (c !== void 0)
      return c === Cte(B);
    if (u !== void 0)
      return u === xte(B);
    if (d !== void 0)
      return d === _te(B);
    if (f !== void 0)
      return f === Pte(B);
    if (m !== void 0)
      return m === qte(B);
    if (h !== void 0)
      return h === Rte(B);
    if (y !== void 0 || x !== void 0 || g !== void 0 || b !== void 0) {
      let $ = !0;
      if (y !== void 0 && $ && ($ = y === Tte(B)), x !== void 0 && $ && ($ = x === Ote(B)), g !== void 0 && $ && ($ = g === Ste(B)), b !== void 0) {
        var H;
        $ && ($ = Rt((H = Mte(B)) != null ? H : null, B, b, (W) => W));
      }
      return $;
    }
    return !0;
  }).filter((B) => i === void 0 ? !0 : Rt(_o(B, {
    computedStyleSupportsPseudoElements: Z().computedStyleSupportsPseudoElements
  }), B, i, (H) => H)).filter((B) => a === void 0 ? !0 : Rt(xu(B, {
    computedStyleSupportsPseudoElements: Z().computedStyleSupportsPseudoElements
  }), B, a, (H) => H)).filter((B) => n === !1 ? _f(B, {
    isSubtreeInaccessible: ne
  }) === !1 : !0);
}, "queryAllByRole");
function Xte(e) {
  var t;
  let r = '*[role~="' + e + '"]', n = (t = De.roleElements.get(e)) != null ? t : /* @__PURE__ */ new Set(), i = new Set(Array.from(n).map((a) => {
    let {
      name: s
    } = a;
    return s;
  }));
  return [r].concat(Array.from(i)).join(",");
}
o(Xte, "makeRoleSelector");
var KA = /* @__PURE__ */ o((e) => {
  let t = "";
  return e === void 0 ? t = "" : typeof e == "string" ? t = ' and name "' + e + '"' : t = " and name `" + e + "`", t;
}, "getNameHint"), Jte = /* @__PURE__ */ o(function(e, t, r) {
  let {
    name: n
  } = r === void 0 ? {} : r;
  return 'Found multiple elements with the role "' + t + '"' + KA(n);
}, "getMultipleError$1"), Qte = /* @__PURE__ */ o(function(e, t, r) {
  let {
    hidden: n = Z().defaultHidden,
    name: i,
    description: a
  } = r === void 0 ? {} : r;
  if (Z()._disableExpensiveErrorDiagnostics)
    return 'Unable to find role="' + t + '"' + KA(i);
  let s = "";
  Array.from(e.children).forEach((d) => {
    s += sA(d, {
      hidden: n,
      includeDescription: a !== void 0
    });
  });
  let l;
  s.length === 0 ? n === !1 ? l = "There are no accessible roles. But there might be some inaccessible roles. If you wish to access them, th\
en set the `hidden` option to `true`. Learn more about this here: https://testing-library.com/docs/dom-testing-library/api-queries#byrole" :
  l = "There are no available roles." : l = (`
Here are the ` + (n === !1 ? "accessible" : "available") + ` roles:

  ` + s.replace(/\n/g, `
  `).replace(/\n\s\s\n/g, `

`) + `
`).trim();
  let c = "";
  i === void 0 ? c = "" : typeof i == "string" ? c = ' and name "' + i + '"' : c = " and name `" + i + "`";
  let u = "";
  return a === void 0 ? u = "" : typeof a == "string" ? u = ' and description "' + a + '"' : u = " and description `" + a + "`", (`
Unable to find an ` + (n === !1 ? "accessible " : "") + 'element with the role "' + t + '"' + c + u + `

` + l).trim();
}, "getMissingError$1"), YA = He(qy, qy.name, "queryAll"), [XA, JA, QA, ZA, eN] = Ot(qy, Jte, Qte), jy = /* @__PURE__ */ o(() => Z().testIdAttribute,
"getTestIdAttribute"), Ry = /* @__PURE__ */ o(function() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  return Tt(t[0]), Rr(jy(), ...t);
}, "queryAllByTestId"), Zte = /* @__PURE__ */ o((e, t) => "Found multiple elements by: [" + jy() + '="' + t + '"]', "getMultipleError"), ere = /* @__PURE__ */ o(
(e, t) => "Unable to find an element by: [" + jy() + '="' + t + '"]', "getMissingError"), tN = He(Ry, Ry.name, "queryAll"), [rN, nN, oN, iN,
aN] = Ot(Ry, Zte, ere), xf = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  queryAllByLabelText: yA,
  queryByLabelText: dA,
  getAllByLabelText: hA,
  getByLabelText: bA,
  findAllByLabelText: pA,
  findByLabelText: mA,
  queryByPlaceholderText: vA,
  queryAllByPlaceholderText: gA,
  getByPlaceholderText: EA,
  getAllByPlaceholderText: wA,
  findAllByPlaceholderText: CA,
  findByPlaceholderText: xA,
  queryByText: PA,
  queryAllByText: _A,
  getByText: RA,
  getAllByText: qA,
  findAllByText: TA,
  findByText: OA,
  queryByDisplayValue: MA,
  queryAllByDisplayValue: SA,
  getByDisplayValue: NA,
  getAllByDisplayValue: AA,
  findAllByDisplayValue: IA,
  findByDisplayValue: jA,
  queryByAltText: LA,
  queryAllByAltText: kA,
  getByAltText: BA,
  getAllByAltText: $A,
  findAllByAltText: DA,
  findByAltText: FA,
  queryByTitle: HA,
  queryAllByTitle: UA,
  getByTitle: zA,
  getAllByTitle: VA,
  findAllByTitle: WA,
  findByTitle: GA,
  queryByRole: XA,
  queryAllByRole: YA,
  getAllByRole: JA,
  getByRole: QA,
  findAllByRole: ZA,
  findByRole: eN,
  queryByTestId: rN,
  queryAllByTestId: tN,
  getByTestId: oN,
  getAllByTestId: nN,
  findAllByTestId: iN,
  findByTestId: aN
});
function sN(e, t, r) {
  return t === void 0 && (t = xf), r === void 0 && (r = {}), Object.keys(t).reduce((n, i) => {
    let a = t[i];
    return n[i] = a.bind(null, e), n;
  }, r);
}
o(sN, "getQueriesForElement");
var lN = /* @__PURE__ */ o((e) => !e || Array.isArray(e) && !e.length, "isRemoved");
function DM(e) {
  if (lN(e))
    throw new Error("The element(s) given to waitForElementToBeRemoved are already removed. waitForElementToBeRemoved requires that the elem\
ent(s) exist(s) before waiting for removal.");
}
o(DM, "initialCheck");
async function tre(e, t) {
  let r = new Error("Timed out in waitForElementToBeRemoved.");
  if (typeof e != "function") {
    DM(e);
    let i = (Array.isArray(e) ? e : [e]).map((a) => {
      let s = a.parentElement;
      if (s === null) return () => null;
      for (; s.parentElement; ) s = s.parentElement;
      return () => s.contains(a) ? a : null;
    });
    e = /* @__PURE__ */ o(() => i.map((a) => a()).filter(Boolean), "callback");
  }
  return DM(e()), Ny(() => {
    let n;
    try {
      n = e();
    } catch (i) {
      if (i.name === "TestingLibraryElementError")
        return;
      throw i;
    }
    if (!lN(n))
      throw r;
  }, t);
}
o(tre, "waitForElementToBeRemoved");
var FM = {
  // Clipboard Events
  copy: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  cut: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  paste: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  // Composition Events
  compositionEnd: {
    EventType: "CompositionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  compositionStart: {
    EventType: "CompositionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  compositionUpdate: {
    EventType: "CompositionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  // Keyboard Events
  keyDown: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      charCode: 0,
      composed: !0
    }
  },
  keyPress: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      charCode: 0,
      composed: !0
    }
  },
  keyUp: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      charCode: 0,
      composed: !0
    }
  },
  // Focus Events
  focus: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  blur: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  focusIn: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  focusOut: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  // Form Events
  change: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  input: {
    EventType: "InputEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  invalid: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !0
    }
  },
  submit: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  },
  reset: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  },
  // Mouse Events
  click: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      button: 0,
      composed: !0
    }
  },
  contextMenu: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  dblClick: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  drag: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  dragEnd: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  dragEnter: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  dragExit: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  dragLeave: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  dragOver: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  dragStart: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  drop: {
    EventType: "DragEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseDown: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseEnter: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  mouseLeave: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  mouseMove: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseOut: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseOver: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseUp: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  // Selection Events
  select: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  // Touch Events
  touchCancel: {
    EventType: "TouchEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  touchEnd: {
    EventType: "TouchEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  touchMove: {
    EventType: "TouchEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  touchStart: {
    EventType: "TouchEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  // UI Events
  resize: {
    EventType: "UIEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  scroll: {
    EventType: "UIEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  // Wheel Events
  wheel: {
    EventType: "WheelEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  // Media Events
  abort: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  canPlay: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  canPlayThrough: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  durationChange: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  emptied: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  encrypted: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  ended: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  loadedData: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  loadedMetadata: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  loadStart: {
    EventType: "ProgressEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  pause: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  play: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  playing: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  progress: {
    EventType: "ProgressEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  rateChange: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  seeked: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  seeking: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  stalled: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  suspend: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  timeUpdate: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  volumeChange: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  waiting: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  // Events
  load: {
    // TODO: load events can be UIEvent or Event depending on what generated them
    // This is where this abstraction breaks down.
    // But the common targets are <img />, <script /> and window.
    // Neither of these targets receive a UIEvent
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  error: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  // Animation Events
  animationStart: {
    EventType: "AnimationEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  animationEnd: {
    EventType: "AnimationEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  animationIteration: {
    EventType: "AnimationEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  // Transition Events
  transitionCancel: {
    EventType: "TransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  transitionEnd: {
    EventType: "TransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  },
  transitionRun: {
    EventType: "TransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  transitionStart: {
    EventType: "TransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  // pointer events
  pointerOver: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerEnter: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  pointerDown: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerMove: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerUp: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerCancel: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  pointerOut: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerLeave: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  gotPointerCapture: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  lostPointerCapture: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  // history events
  popState: {
    EventType: "PopStateEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  // window events
  offline: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  online: {
    EventType: "Event",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  pageHide: {
    EventType: "PageTransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  },
  pageShow: {
    EventType: "PageTransitionEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  }
}, UM = {
  doubleClick: "dblClick"
};
function So(e, t) {
  return Z().eventWrapper(() => {
    if (!t)
      throw new Error("Unable to fire an event - please provide an event object.");
    if (!e)
      throw new Error('Unable to fire a "' + t.type + '" event - please provide a DOM element.');
    return e.dispatchEvent(t);
  });
}
o(So, "fireEvent");
function Ef(e, t, r, n) {
  let {
    EventType: i = "Event",
    defaultInit: a = {}
  } = n === void 0 ? {} : n;
  if (!t)
    throw new Error('Unable to fire a "' + e + '" event - please provide a DOM element.');
  let s = {
    ...a,
    ...r
  }, {
    target: {
      value: l,
      files: c,
      ...u
    } = {}
  } = s;
  l !== void 0 && rre(t, l), c !== void 0 && Object.defineProperty(t, "files", {
    configurable: !0,
    enumerable: !0,
    writable: !0,
    value: c
  }), Object.assign(t, u);
  let d = ZM(t), f = d[i] || d.Event, h;
  if (typeof f == "function")
    h = new f(e, s);
  else {
    h = d.document.createEvent(i);
    let {
      bubbles: y,
      cancelable: g,
      detail: x,
      ...b
    } = s;
    h.initEvent(e, y, g, x), Object.keys(b).forEach((E) => {
      h[E] = b[E];
    });
  }
  return ["dataTransfer", "clipboardData"].forEach((y) => {
    let g = s[y];
    typeof g == "object" && (typeof d.DataTransfer == "function" ? Object.defineProperty(h, y, {
      value: Object.getOwnPropertyNames(g).reduce((x, b) => (Object.defineProperty(x, b, {
        value: g[b]
      }), x), new d.DataTransfer())
    }) : Object.defineProperty(h, y, {
      value: g
    }));
  }), h;
}
o(Ef, "createEvent");
Object.keys(FM).forEach((e) => {
  let {
    EventType: t,
    defaultInit: r
  } = FM[e], n = e.toLowerCase();
  Ef[e] = (i, a) => Ef(n, i, a, {
    EventType: t,
    defaultInit: r
  }), So[e] = (i, a) => So(i, Ef[e](i, a));
});
function rre(e, t) {
  let {
    set: r
  } = Object.getOwnPropertyDescriptor(e, "value") || {}, n = Object.getPrototypeOf(e), {
    set: i
  } = Object.getOwnPropertyDescriptor(n, "value") || {};
  if (i && r !== i)
    i.call(e, t);
  else if (r)
    r.call(e, t);
  else
    throw new Error("The given element does not have a value setter");
}
o(rre, "setNativeValue");
Object.keys(UM).forEach((e) => {
  let t = UM[e];
  So[e] = function() {
    return So[t](...arguments);
  };
});
function nre(e) {
  return e.replace(/[ \t]*[\n][ \t]*/g, `
`);
}
o(nre, "unindent");
function ore(e) {
  return VM.default.compressToEncodedURIComponent(nre(e));
}
o(ore, "encode");
function ire(e) {
  return "https://testing-playground.com/#markup=" + ore(e);
}
o(ire, "getPlaygroundUrl");
var are = /* @__PURE__ */ o((e, t, r) => Array.isArray(e) ? e.forEach((n) => vy(n, t, r)) : vy(e, t, r), "debug"), sre = /* @__PURE__ */ o(function(e) {
  if (e === void 0 && (e = Sy().body), !e || !("innerHTML" in e)) {
    console.log("The element you're providing isn't a valid DOM element.");
    return;
  }
  if (!e.innerHTML) {
    console.log("The provided element doesn't have any children.");
    return;
  }
  let t = ire(e.innerHTML);
  return console.log(`Open this URL in your browser

` + t), t;
}, "logTestingPlaygroundURL"), HM = {
  debug: are,
  logTestingPlaygroundURL: sre
}, lre = typeof document < "u" && document.body ? sN(document.body, xf, HM) : Object.keys(xf).reduce((e, t) => (e[t] = () => {
  throw new TypeError("For queries bound to document.body a global document has to be available... Learn more: https://testing-library.com/s\
/screen-global-error");
}, e), HM);

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/isElementType.js
function z(e, t, r) {
  return e.namespaceURI && e.namespaceURI !== "http://www.w3.org/1999/xhtml" || (t = Array.isArray(t) ? t : [
    t
  ], !t.includes(e.tagName.toLowerCase())) ? !1 : r ? Object.entries(r).every(([n, i]) => e[n] === i) : !0;
}
o(z, "isElementType");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/getWindow.js
function ve(e) {
  var t;
  if (ure(e) && e.defaultView)
    return e.defaultView;
  if (!((t = e.ownerDocument) === null || t === void 0) && t.defaultView)
    return e.ownerDocument.defaultView;
  throw new Error(`Could not determine window of node. Node was ${cre(e)}`);
}
o(ve, "getWindow");
function ure(e) {
  return e.nodeType === 9;
}
o(ure, "isDocument");
function cre(e) {
  return typeof e == "function" ? `function ${e.name}` : e === null ? "null" : String(e);
}
o(cre, "describe");

// ../node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/Blob.js
function Ly(e, t) {
  return new Promise((r, n) => {
    let i = new t();
    i.onerror = n, i.onabort = n, i.onload = () => {
      r(String(i.result));
    }, i.readAsText(e);
  });
}
o(Ly, "readBlobText");

// ../node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/FileList.js
function Io(e, t) {
  let r = {
    ...t,
    length: t.length,
    item: /* @__PURE__ */ o((n) => r[n], "item"),
    [Symbol.iterator]: /* @__PURE__ */ o(function* () {
      for (let i = 0; i < r.length; i++)
        yield r[i];
    }, "nextFile")
  };
  return r.constructor = e.FileList, e.FileList && Object.setPrototypeOf(r, e.FileList.prototype), Object.freeze(r), r;
}
o(Io, "createFileList");

// ../node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/DataTransfer.js
function ir(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(ir, "_define_property");
var By = class By {
  getAsFile() {
    return this.file;
  }
  getAsString(t) {
    typeof this.data == "string" && t(this.data);
  }
  /* istanbul ignore next */
  webkitGetAsEntry() {
    throw new Error("not implemented");
  }
  constructor(t, r) {
    ir(this, "kind", void 0), ir(this, "type", void 0), ir(this, "file", null), ir(this, "data", void 0), typeof t == "string" ? (this.kind =
    "string", this.type = String(r), this.data = t) : (this.kind = "file", this.type = t.type, this.file = t);
  }
};
o(By, "DataTransferItemStub");
var Tf = By, Dy = class Dy extends Array {
  add(...t) {
    let r = new Tf(t[0], t[1]);
    return this.push(r), r;
  }
  clear() {
    this.splice(0, this.length);
  }
  remove(t) {
    this.splice(t, 1);
  }
};
o(Dy, "DataTransferItemListStub");
var $y = Dy;
function Rf(e, t) {
  let [r, n] = e.split("/"), i = !n || n === "*";
  return (a) => t ? a.type === (i ? r : e) : i ? a.type.startsWith(`${r}/`) : a.type === r;
}
o(Rf, "getTypeMatcher");
function dre(e) {
  var t;
  return new (t = class {
    getData(n) {
      var i;
      let a = (i = this.items.find(Rf(n, !0))) !== null && i !== void 0 ? i : this.items.find(Rf(n, !1)), s = "";
      return a?.getAsString((l) => {
        s = l;
      }), s;
    }
    setData(n, i) {
      let a = this.items.findIndex(Rf(n, !0)), s = new Tf(i, n);
      a >= 0 ? this.items.splice(a, 1, s) : this.items.push(s);
    }
    clearData(n) {
      if (n) {
        let i = this.items.findIndex(Rf(n, !0));
        i >= 0 && this.items.remove(i);
      } else
        this.items.clear();
    }
    get types() {
      let n = [];
      return this.files.length && n.push("Files"), this.items.forEach((i) => n.push(i.type)), Object.freeze(n), n;
    }
    /* istanbul ignore next */
    setDragImage() {
    }
    constructor() {
      ir(this, "dropEffect", "none"), ir(this, "effectAllowed", "uninitialized"), ir(this, "items", new $y()), ir(this, "files", Io(e, []));
    }
  }, o(t, "DataTransferStub"), t)();
}
o(dre, "createDataTransferStub");
function En(e, t = []) {
  let r = typeof e.DataTransfer > "u" ? dre(e) : (
    /* istanbul ignore next */
    new e.DataTransfer()
  );
  return Object.defineProperty(r, "files", {
    get: /* @__PURE__ */ o(() => Io(e, t), "get")
  }), r;
}
o(En, "createDataTransfer");
async function uN(e, t) {
  return t.kind === "file" ? t.getAsFile() : new e.Blob([
    await new Promise((r) => t.getAsString(r))
  ], {
    type: t.type
  });
}
o(uN, "getBlobFromDataTransferItem");

// ../node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/Clipboard.js
function dN(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(dN, "_define_property");
function fN(e, ...t) {
  var n;
  let r = Object.fromEntries(t.map((i) => [
    typeof i == "string" ? "text/plain" : i.type,
    Promise.resolve(i)
  ]));
  return typeof e.ClipboardItem < "u" ? new e.ClipboardItem(r) : new (n = class {
    get types() {
      return Array.from(Object.keys(this.data));
    }
    async getType(a) {
      let s = await this.data[a];
      if (!s)
        throw new Error(`${a} is not one of the available MIME types on this item.`);
      return s instanceof e.Blob ? s : new e.Blob([
        s
      ], {
        type: a
      });
    }
    constructor(a) {
      dN(this, "data", void 0), this.data = a;
    }
  }, o(n, "ClipboardItem"), n)(r);
}
o(fN, "createClipboardItem");
var Cn = Symbol("Manage ClipboardSub");
function cN(e, t) {
  var r;
  return Object.assign(new (r = class extends e.EventTarget {
    async read() {
      return Array.from(this.items);
    }
    async readText() {
      let i = "";
      for (let a of this.items) {
        let s = a.types.includes("text/plain") ? "text/plain" : a.types.find((l) => l.startsWith("text/"));
        s && (i += await a.getType(s).then((l) => Ly(l, e.FileReader)));
      }
      return i;
    }
    async write(i) {
      this.items = i;
    }
    async writeText(i) {
      this.items = [
        fN(e, i)
      ];
    }
    constructor(...i) {
      super(...i), dN(this, "items", []);
    }
  }, o(r, "Clipboard"), r)(), {
    [Cn]: t
  });
}
o(cN, "createClipboardStub");
function Fy(e) {
  return !!e?.[Cn];
}
o(Fy, "isClipboardStub");
function pN(e) {
  if (Fy(e.navigator.clipboard))
    return e.navigator.clipboard[Cn];
  let t = Object.getOwnPropertyDescriptor(e.navigator, "clipboard"), r, n = {
    resetClipboardStub: /* @__PURE__ */ o(() => {
      r = cN(e, n);
    }, "resetClipboardStub"),
    detachClipboardStub: /* @__PURE__ */ o(() => {
      t ? Object.defineProperty(e.navigator, "clipboard", t) : Object.defineProperty(e.navigator, "clipboard", {
        value: void 0,
        configurable: !0
      });
    }, "detachClipboardStub")
  };
  return r = cN(e, n), Object.defineProperty(e.navigator, "clipboard", {
    get: /* @__PURE__ */ o(() => r, "get"),
    configurable: !0
  }), r[Cn];
}
o(pN, "attachClipboardStubToView");
function fre(e) {
  Fy(e.navigator.clipboard) && e.navigator.clipboard[Cn].resetClipboardStub();
}
o(fre, "resetClipboardStubOnView");
function pre(e) {
  Fy(e.navigator.clipboard) && e.navigator.clipboard[Cn].detachClipboardStub();
}
o(pre, "detachClipboardStubFromView");
async function mN(e) {
  let t = e.defaultView, r = t?.navigator.clipboard, n = r && await r.read();
  if (!n)
    throw new Error("The Clipboard API is unavailable.");
  let i = En(t);
  for (let a of n)
    for (let s of a.types)
      i.setData(s, await a.getType(s).then((l) => Ly(l, t.FileReader)));
  return i;
}
o(mN, "readDataTransferFromClipboard");
async function Sf(e, t) {
  let r = ve(e), n = r.navigator.clipboard, i = [];
  for (let s = 0; s < t.items.length; s++) {
    let l = t.items[s], c = await uN(r, l);
    i.push(fN(r, c));
  }
  if (!(n && await n.write(i).then(
    () => !0,
    // Can happen with other implementations that e.g. require permissions
    /* istanbul ignore next */
    () => !1
  )))
    throw new Error("The Clipboard API is unavailable.");
}
o(Sf, "writeDataTransferToClipboard");
var Of = globalThis;
typeof Of.afterEach == "function" && Of.afterEach(() => {
  typeof globalThis.window < "u" && fre(globalThis.window);
});
typeof Of.afterAll == "function" && Of.afterAll(() => {
  typeof globalThis.window < "u" && pre(globalThis.window);
});

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/selector.js
var Mf = [
  "input:not([type=hidden]):not([disabled])",
  "button:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "a[href]",
  "[tabindex]:not([disabled])"
].join(", ");

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/isFocusable.js
function jo(e) {
  return e.matches(Mf);
}
o(jo, "isFocusable");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/cloneEvent.js
function hN(e) {
  return new e.constructor(e.type, e);
}
o(hN, "cloneEvent");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/isDisabled.js
function Le(e) {
  for (let r = e; r; r = r.parentElement)
    if (z(r, [
      "button",
      "input",
      "select",
      "textarea",
      "optgroup",
      "option"
    ])) {
      if (r.hasAttribute("disabled"))
        return !0;
    } else if (z(r, "fieldset")) {
      var t;
      if (r.hasAttribute("disabled") && !(!((t = r.querySelector(":scope > legend")) === null || t === void 0) && t.contains(e)))
        return !0;
    } else if (r.tagName.includes("-") && r.constructor.formAssociated && r.hasAttribute("disabled"))
      return !0;
  return !1;
}
o(Le, "isDisabled");

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/getActiveElement.js
function Tr(e) {
  let t = e.activeElement;
  return t?.shadowRoot ? Tr(t.shadowRoot) : Le(t) ? e.ownerDocument ? (
    /* istanbul ignore next */
    e.ownerDocument.body
  ) : e.body : t;
}
o(Tr, "getActiveElement");
function Af(e) {
  var t;
  return (t = Tr(e)) !== null && t !== void 0 ? t : (
    /* istanbul ignore next */
    e.body
  );
}
o(Af, "getActiveElementOrBody");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/findClosest.js
function bN(e, t) {
  let r = e;
  do {
    if (t(r))
      return r;
    r = r.parentElement;
  } while (r && r !== e.ownerDocument.body);
}
o(bN, "findClosest");

// ../node_modules/@testing-library/user-event/dist/esm/utils/edit/isContentEditable.js
function Ye(e) {
  return e.hasAttribute("contenteditable") && (e.getAttribute("contenteditable") == "true" || e.getAttribute("contenteditable") == "");
}
o(Ye, "isContentEditable");
function ar(e) {
  let t = mre(e);
  return t && (t.closest('[contenteditable=""]') || t.closest('[contenteditable="true"]'));
}
o(ar, "getContentEditable");
function mre(e) {
  return e.nodeType === 1 ? e : e.parentElement;
}
o(mre, "getElement");

// ../node_modules/@testing-library/user-event/dist/esm/utils/click/isClickableInput.js
var yN = /* @__PURE__ */ function(e) {
  return e.button = "button", e.color = "color", e.file = "file", e.image = "image", e.reset = "reset", e.submit = "submit", e.checkbox = "c\
heckbox", e.radio = "radio", e;
}(yN || {});
function Nf(e) {
  return z(e, "button") || z(e, "input") && e.type in yN;
}
o(Nf, "isClickableInput");

// ../node_modules/@testing-library/user-event/dist/esm/utils/edit/isEditable.js
function mt(e) {
  return Uy(e) && !e.readOnly || Ye(e);
}
o(mt, "isEditable");
var gN = /* @__PURE__ */ function(e) {
  return e.text = "text", e.date = "date", e["datetime-local"] = "datetime-local", e.email = "email", e.month = "month", e.number = "number",
  e.password = "password", e.search = "search", e.tel = "tel", e.time = "time", e.url = "url", e.week = "week", e;
}(gN || {});
function Uy(e) {
  return z(e, "textarea") || z(e, "input") && e.type in gN;
}
o(Uy, "isEditableInputOrTextArea");

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/selection.js
function qe(e) {
  return wN(e) && Uy(e);
}
o(qe, "hasOwnSelection");
function vN(e) {
  return wN(e) && Nf(e);
}
o(vN, "hasNoSelection");
function wN(e) {
  return e.nodeType === 1;
}
o(wN, "isElement");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/updateSelectionOnFocus.js
function EN(e) {
  let t = e.ownerDocument.getSelection();
  if (t?.focusNode && qe(e)) {
    let n = ar(t.focusNode);
    if (n) {
      if (!t.isCollapsed) {
        var r;
        let i = ((r = n.firstChild) === null || r === void 0 ? void 0 : r.nodeType) === 3 ? n.firstChild : n;
        t.setBaseAndExtent(i, 0, i, 0);
      }
    } else
      t.setBaseAndExtent(e, 0, e, 0);
  }
}
o(EN, "updateSelectionOnFocus");

// ../node_modules/@testing-library/user-event/dist/esm/event/wrapEvent.js
function sr(e, t) {
  return Z().eventWrapper(e);
}
o(sr, "wrapEvent");

// ../node_modules/@testing-library/user-event/dist/esm/event/focus.js
function Ve(e) {
  let t = bN(e, jo), r = Tr(e.ownerDocument);
  (t ?? e.ownerDocument.body) !== r && (t ? sr(() => t.focus()) : sr(() => r?.blur()), EN(t ?? e.ownerDocument.body));
}
o(Ve, "focusElement");
function CN(e) {
  !jo(e) || !(Tr(e.ownerDocument) === e) || sr(() => e.blur());
}
o(CN, "blurElement");

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/registry.js
var Fe = {};

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/click.js
Fe.click = (e, t, r) => {
  let n = t.closest("button,input,label,select,textarea"), i = n && z(n, "label") && n.control;
  if (i && i !== t)
    return () => {
      jo(i) && (Ve(i), r.dispatchEvent(i, hN(e)));
    };
  if (z(t, "input", {
    type: "file"
  }))
    return () => {
      CN(t), t.dispatchEvent(new (ve(t)).Event("fileDialog")), Ve(t);
    };
};

// ../node_modules/@testing-library/user-event/dist/esm/document/UI.js
var xn = Symbol("Displayed value in UI"), St = Symbol("Displayed selection in UI"), If = Symbol("Initial value to compare on blur");
function xN(e) {
  return typeof e == "object" && xn in e;
}
o(xN, "isUIValue");
function _N(e) {
  return !!e && typeof e == "object" && St in e;
}
o(_N, "isUISelectionStart");
function PN(e, t) {
  e[If] === void 0 && (e[If] = e.value), e[xn] = t, e.value = Object.assign(new String(t), {
    [xn]: !0
  });
}
o(PN, "setUIValue");
function Se(e) {
  return e[xn] === void 0 ? e.value : String(e[xn]);
}
o(Se, "getUIValue");
function ko(e) {
  e[xn] = void 0;
}
o(ko, "setUIValueClean");
function jf(e) {
  e[If] = void 0;
}
o(jf, "clearInitialValue");
function qN(e) {
  return e[If];
}
o(qN, "getInitialValue");
function RN(e, t) {
  e[St] = t;
}
o(RN, "setUISelectionRaw");
function ht(e, { focusOffset: t, anchorOffset: r = t }, n = "replace") {
  let i = Se(e).length, a = /* @__PURE__ */ o((f) => Math.max(0, Math.min(i, f)), "sanitizeOffset"), s = n === "replace" || e[St] === void 0 ?
  a(r) : e[St].anchorOffset, l = a(t), c = Math.min(s, l), u = Math.max(s, l);
  if (e[St] = {
    anchorOffset: s,
    focusOffset: l
  }, e.selectionStart === c && e.selectionEnd === u)
    return;
  let d = Object.assign(new Number(c), {
    [St]: !0
  });
  try {
    e.setSelectionRange(d, u);
  } catch {
  }
}
o(ht, "setUISelection");
function Mt(e) {
  var t, r, n;
  let i = (n = e[St]) !== null && n !== void 0 ? n : {
    anchorOffset: (t = e.selectionStart) !== null && t !== void 0 ? t : 0,
    focusOffset: (r = e.selectionEnd) !== null && r !== void 0 ? r : 0
  };
  return {
    ...i,
    startOffset: Math.min(i.anchorOffset, i.focusOffset),
    endOffset: Math.max(i.anchorOffset, i.focusOffset)
  };
}
o(Mt, "getUISelection");
function TN(e) {
  return !!e[St];
}
o(TN, "hasUISelection");
function Lo(e) {
  e[St] = void 0;
}
o(Lo, "setUISelectionClean");

// ../node_modules/@testing-library/user-event/dist/esm/utils/edit/timeValue.js
var kf = globalThis.parseInt;
function SN(e) {
  let t = e.replace(/\D/g, "");
  if (t.length < 2)
    return e;
  let r = kf(t[0], 10), n = kf(t[1], 10);
  if (r >= 3 || r === 2 && n >= 4) {
    let i;
    return r >= 3 ? i = 1 : i = 2, ON(t, i);
  }
  return e.length === 2 ? e : ON(t, 2);
}
o(SN, "buildTimeValue");
function ON(e, t) {
  let r = e.slice(0, t), n = Math.min(kf(r, 10), 23), i = e.slice(t), a = kf(i, 10), s = Math.min(a, 59);
  return `${n.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
o(ON, "build");
function Hy(e, t) {
  let r = e.cloneNode();
  return r.value = t, r.value === t;
}
o(Hy, "isValidDateOrTimeValue");

// ../node_modules/@testing-library/user-event/dist/esm/utils/edit/maxLength.js
var MN = /* @__PURE__ */ function(e) {
  return e.email = "email", e.password = "password", e.search = "search", e.telephone = "telephone", e.text = "text", e.url = "url", e;
}(MN || {});
function AN(e) {
  var t;
  let r = (t = e.getAttribute("maxlength")) !== null && t !== void 0 ? t : "";
  return /^\d+$/.test(r) && Number(r) >= 0 ? Number(r) : void 0;
}
o(AN, "getMaxLength");
function NN(e) {
  return z(e, "textarea") || z(e, "input") && e.type in MN;
}
o(NN, "supportsMaxLength");

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/cursor.js
function Bf(e, t, r, n) {
  if ($f(e) && t + r >= 0 && t + r <= e.nodeValue.length)
    return {
      node: e,
      offset: t + r
    };
  let i = IN(e, t, r);
  if (i) {
    if ($f(i))
      return {
        node: i,
        offset: r > 0 ? Math.min(1, i.nodeValue.length) : Math.max(i.nodeValue.length - 1, 0)
      };
    if (z(i, "br")) {
      let a = IN(i, void 0, r);
      return a ? $f(a) ? {
        node: a,
        offset: r > 0 ? 0 : a.nodeValue.length
      } : r < 0 && z(a, "br") ? {
        node: i.parentNode,
        offset: Lf(i)
      } : {
        node: a.parentNode,
        offset: Lf(a) + (r > 0 ? 0 : 1)
      } : r < 0 && n === "deleteContentBackward" ? {
        node: i.parentNode,
        offset: Lf(i)
      } : void 0;
    } else
      return {
        node: i.parentNode,
        offset: Lf(i) + (r > 0 ? 1 : 0)
      };
  }
}
o(Bf, "getNextCursorPosition");
function IN(e, t, r) {
  let n = Number(t) + (r < 0 ? -1 : 0);
  return t !== void 0 && Vy(e) && n >= 0 && n < e.children.length && (e = e.children[n]), bre(e, r === 1 ? "next" : "previous", hre);
}
o(IN, "getNextCharacterContentNode");
function hre(e) {
  if ($f(e))
    return !0;
  if (Vy(e)) {
    if (z(e, [
      "input",
      "textarea"
    ]))
      return e.type !== "hidden";
    if (z(e, "br"))
      return !0;
  }
  return !1;
}
o(hre, "isTreatedAsCharacterContent");
function Lf(e) {
  let t = 0;
  for (; e.previousSibling; )
    t++, e = e.previousSibling;
  return t;
}
o(Lf, "getOffset");
function Vy(e) {
  return e.nodeType === 1;
}
o(Vy, "isElement");
function $f(e) {
  return e.nodeType === 3;
}
o($f, "isTextNode");
function bre(e, t, r) {
  for (; ; ) {
    var n;
    let i = e[`${t}Sibling`];
    if (i) {
      if (e = yre(i, t === "next" ? "first" : "last"), r(e))
        return e;
    } else if (e.parentNode && (!Vy(e.parentNode) || !Ye(e.parentNode) && e.parentNode !== ((n = e.ownerDocument) === null || n === void 0 ?
    void 0 : n.body)))
      e = e.parentNode;
    else
      break;
  }
}
o(bre, "walkNodes");
function yre(e, t) {
  for (; e.hasChildNodes(); )
    e = e[`${t}Child`];
  return e;
}
o(yre, "getDescendant");

// ../node_modules/@testing-library/user-event/dist/esm/document/trackValue.js
var $o = Symbol("Track programmatic changes for React workaround");
function gre(e) {
  return Object.getOwnPropertyNames(e).some((t) => t.startsWith("__react")) && ve(e).REACT_VERSION === 17;
}
o(gre, "isReact17Element");
function jN(e) {
  gre(e) && (e[$o] = {
    previousValue: String(e.value),
    tracked: []
  });
}
o(jN, "startTrackValue");
function kN(e, t) {
  var r, n;
  (n = e[$o]) === null || n === void 0 || (r = n.tracked) === null || r === void 0 || r.push(t), e[$o] || (ko(e), ht(e, {
    focusOffset: t.length
  }));
}
o(kN, "trackOrSetValue");
function LN(e, t) {
  var r;
  let n = e[$o];
  if (e[$o] = void 0, !(!(n == null || (r = n.tracked) === null || r === void 0) && r.length))
    return;
  let i = n.tracked.length === 2 && n.tracked[0] === n.previousValue && n.tracked[1] === e.value;
  i || ko(e), TN(e) && ht(e, {
    focusOffset: i ? t : e.value.length
  });
}
o(LN, "commitValueAfterInput");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/getTargetTypeAndSelection.js
function Df(e) {
  let t = vre(e);
  if (t && qe(t))
    return {
      type: "input",
      selection: Mt(t)
    };
  let r = t?.ownerDocument.getSelection();
  return {
    type: ar(e) && r?.anchorNode && ar(r.anchorNode) ? "contenteditable" : "default",
    selection: r
  };
}
o(Df, "getTargetTypeAndSelection");
function vre(e) {
  return e.nodeType === 1 ? e : e.parentElement;
}
o(vre, "getElement");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/getInputRange.js
function $N(e) {
  let t = Df(e);
  if (t.type === "input")
    return t.selection;
  if (t.type === "contenteditable") {
    var r;
    return (r = t.selection) === null || r === void 0 ? void 0 : r.getRangeAt(0);
  }
}
o($N, "getInputRange");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/setSelection.js
function bt({ focusNode: e, focusOffset: t, anchorNode: r = e, anchorOffset: n = t }) {
  var i, a;
  if (Df(e).type === "input")
    return ht(e, {
      anchorOffset: n,
      focusOffset: t
    });
  (a = r.ownerDocument) === null || a === void 0 || (i = a.getSelection()) === null || i === void 0 || i.setBaseAndExtent(r, n, e, t);
}
o(bt, "setSelection");

// ../node_modules/@testing-library/user-event/dist/esm/event/input.js
function DN(e) {
  return z(e, "input") && [
    "date",
    "time"
  ].includes(e.type);
}
o(DN, "isDateOrTime");
function yt(e, t, r, n = "insertText") {
  let i = $N(t);
  i && (!DN(t) && !e.dispatchUIEvent(t, "beforeinput", {
    inputType: n,
    data: r
  }) || ("startContainer" in i ? wre(e, t, i, r, n) : Ere(e, t, i, r, n)));
}
o(yt, "input");
function wre(e, t, r, n, i) {
  let a = !1;
  if (!r.collapsed)
    a = !0, r.deleteContents();
  else if ([
    "deleteContentBackward",
    "deleteContentForward"
  ].includes(i)) {
    let s = Bf(r.startContainer, r.startOffset, i === "deleteContentBackward" ? -1 : 1, i);
    if (s) {
      a = !0;
      let l = r.cloneRange();
      l.comparePoint(s.node, s.offset) < 0 ? l.setStart(s.node, s.offset) : l.setEnd(s.node, s.offset), l.deleteContents();
    }
  }
  if (n)
    if (r.endContainer.nodeType === 3) {
      let s = r.endOffset;
      r.endContainer.insertData(s, n), r.setStart(r.endContainer, s + n.length), r.setEnd(r.endContainer, s + n.length);
    } else {
      let s = t.ownerDocument.createTextNode(n);
      r.insertNode(s), r.setStart(s, n.length), r.setEnd(s, n.length);
    }
  (a || n) && e.dispatchUIEvent(t, "input", {
    inputType: i
  });
}
o(wre, "editContenteditable");
function Ere(e, t, r, n, i) {
  let a = n;
  if (NN(t)) {
    let u = AN(t);
    if (u !== void 0 && n.length > 0) {
      let d = u - t.value.length;
      if (d > 0)
        a = n.substring(0, d);
      else
        return;
    }
  }
  let { newValue: s, newOffset: l, oldValue: c } = Cre(a, t, r, i);
  s === c && l === r.startOffset && l === r.endOffset || z(t, "input", {
    type: "number"
  }) && !xre(s) || (PN(t, s), bt({
    focusNode: t,
    anchorOffset: l,
    focusOffset: l
  }), DN(t) ? Hy(t, s) && (BN(e, t, l, {}), e.dispatchUIEvent(t, "change"), jf(t)) : BN(e, t, l, {
    data: n,
    inputType: i
  }));
}
o(Ere, "editInputElement");
function Cre(e, t, { startOffset: r, endOffset: n }, i) {
  let a = Se(t), s = Math.max(0, r === n && i === "deleteContentBackward" ? r - 1 : r), l = a.substring(0, s), c = Math.min(a.length, r === n &&
  i === "deleteContentForward" ? r + 1 : n), u = a.substring(c, a.length), d = `${l}${e}${u}`, f = s + e.length;
  if (z(t, "input", {
    type: "time"
  })) {
    let h = SN(d);
    h !== "" && Hy(t, h) && (d = h, f = h.length);
  }
  return {
    oldValue: a,
    newValue: d,
    newOffset: f
  };
}
o(Cre, "calculateNewValue");
function BN(e, t, r, n) {
  e.dispatchUIEvent(t, "input", n), LN(t, r);
}
o(BN, "commitInput");
function xre(e) {
  var t, r;
  let n = e.split("e", 2);
  return !(/[^\d.\-e]/.test(e) || Number((t = e.match(/-/g)) === null || t === void 0 ? void 0 : t.length) > 2 || Number((r = e.match(/\./g)) ===
  null || r === void 0 ? void 0 : r.length) > 1 || n[1] && !/^-?\d*$/.test(n[1]));
}
o(xre, "isValidNumberInput");

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/cut.js
Fe.cut = (e, t, r) => () => {
  mt(t) && yt(r, t, "", "deleteByCut");
};

// ../node_modules/@testing-library/user-event/dist/esm/document/getValueOrTextContent.js
function FN(e) {
  return e ? Ye(e) ? e.textContent : Se(e) : null;
}
o(FN, "getValueOrTextContent");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/isVisible.js
function UN(e) {
  let t = ve(e);
  for (let r = e; r?.ownerDocument; r = r.parentElement) {
    let { display: n, visibility: i } = t.getComputedStyle(r);
    if (n === "none" || i === "hidden")
      return !1;
  }
  return !0;
}
o(UN, "isVisible");

// ../node_modules/@testing-library/user-event/dist/esm/utils/focus/getTabDestination.js
function HN(e, t) {
  let r = e.ownerDocument, n = r.querySelectorAll(Mf), i = Array.from(n).filter((c) => c === e || !(Number(c.getAttribute("tabindex")) < 0 ||
  Le(c)));
  Number(e.getAttribute("tabindex")) >= 0 && i.sort((c, u) => {
    let d = Number(c.getAttribute("tabindex")), f = Number(u.getAttribute("tabindex"));
    return d === f ? 0 : d === 0 ? 1 : f === 0 ? -1 : d - f;
  });
  let a = {}, s = [
    r.body
  ], l = z(e, "input", {
    type: "radio"
  }) ? e.name : void 0;
  i.forEach((c) => {
    let u = c;
    if (z(u, "input", {
      type: "radio"
    }) && u.name) {
      if (u === e) {
        s.push(u);
        return;
      } else if (u.name === l)
        return;
      if (u.checked) {
        s = s.filter((d) => !z(d, "input", {
          type: "radio",
          name: u.name
        })), s.push(u), a[u.name] = u;
        return;
      }
      if (typeof a[u.name] < "u")
        return;
    }
    s.push(u);
  });
  for (let c = s.findIndex((u) => u === e); ; )
    if (c += t ? -1 : 1, c === s.length ? c = 0 : c === -1 && (c = s.length - 1), s[c] === e || s[c] === r.body || UN(s[c]))
      return s[c];
}
o(HN, "getTabDestination");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/moveSelection.js
function zy(e, t) {
  if (qe(e)) {
    let r = Mt(e);
    bt({
      focusNode: e,
      focusOffset: r.startOffset === r.endOffset ? r.focusOffset + t : t < 0 ? r.startOffset : r.endOffset
    });
  } else {
    let r = e.ownerDocument.getSelection();
    if (!r?.focusNode)
      return;
    if (r.isCollapsed) {
      let n = Bf(r.focusNode, r.focusOffset, t);
      n && bt({
        focusNode: n.node,
        focusOffset: n.offset
      });
    } else
      r[t < 0 ? "collapseToStart" : "collapseToEnd"]();
  }
}
o(zy, "moveSelection");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/selectAll.js
function Ff(e) {
  if (qe(e))
    return bt({
      focusNode: e,
      anchorOffset: 0,
      focusOffset: Se(e).length
    });
  var t;
  let r = (t = ar(e)) !== null && t !== void 0 ? t : e.ownerDocument.body;
  bt({
    focusNode: r,
    anchorOffset: 0,
    focusOffset: r.childNodes.length
  });
}
o(Ff, "selectAll");
function VN(e) {
  if (qe(e))
    return Mt(e).startOffset === 0 && Mt(e).endOffset === Se(e).length;
  var t;
  let r = (t = ar(e)) !== null && t !== void 0 ? t : e.ownerDocument.body, n = e.ownerDocument.getSelection();
  return n?.anchorNode === r && n.focusNode === r && n.anchorOffset === 0 && n.focusOffset === r.childNodes.length;
}
o(VN, "isAllSelected");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/setSelectionRange.js
function Or(e, t, r) {
  var n;
  if (qe(e))
    return bt({
      focusNode: e,
      anchorOffset: t,
      focusOffset: r
    });
  if (Ye(e) && ((n = e.firstChild) === null || n === void 0 ? void 0 : n.nodeType) === 3)
    return bt({
      focusNode: e.firstChild,
      anchorOffset: t,
      focusOffset: r
    });
  throw new Error("Not implemented. The result of this interaction is unreliable.");
}
o(Or, "setSelectionRange");

// ../node_modules/@testing-library/user-event/dist/esm/event/radio.js
function Bo(e, t, r) {
  let n = ve(t), i = Array.from(t.ownerDocument.querySelectorAll(t.name ? `input[type="radio"][name="${n.CSS.escape(t.name)}"]` : 'input[typ\
e="radio"][name=""], input[type="radio"]:not([name])'));
  for (let a = i.findIndex((s) => s === t) + r; ; a += r) {
    if (i[a] || (a = r > 0 ? 0 : i.length - 1), i[a] === t)
      return;
    if (!Le(i[a])) {
      Ve(i[a]), e.dispatchUIEvent(i[a], "click");
      return;
    }
  }
}
o(Bo, "walkRadio");

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/keydown.js
Fe.keydown = (e, t, r) => {
  var n, i;
  return (i = (n = zN[e.key]) === null || n === void 0 ? void 0 : n.call(zN, e, t, r)) !== null && i !== void 0 ? i : _re(e, t, r);
};
var zN = {
  ArrowDown: /* @__PURE__ */ o((e, t, r) => {
    if (z(t, "input", {
      type: "radio"
    }))
      return () => Bo(r, t, 1);
  }, "ArrowDown"),
  ArrowLeft: /* @__PURE__ */ o((e, t, r) => z(t, "input", {
    type: "radio"
  }) ? () => Bo(r, t, -1) : () => zy(t, -1), "ArrowLeft"),
  ArrowRight: /* @__PURE__ */ o((e, t, r) => z(t, "input", {
    type: "radio"
  }) ? () => Bo(r, t, 1) : () => zy(t, 1), "ArrowRight"),
  ArrowUp: /* @__PURE__ */ o((e, t, r) => {
    if (z(t, "input", {
      type: "radio"
    }))
      return () => Bo(r, t, -1);
  }, "ArrowUp"),
  Backspace: /* @__PURE__ */ o((e, t, r) => {
    if (mt(t))
      return () => {
        yt(r, t, "", "deleteContentBackward");
      };
  }, "Backspace"),
  Delete: /* @__PURE__ */ o((e, t, r) => {
    if (mt(t))
      return () => {
        yt(r, t, "", "deleteContentForward");
      };
  }, "Delete"),
  End: /* @__PURE__ */ o((e, t) => {
    if (z(t, [
      "input",
      "textarea"
    ]) || Ye(t))
      return () => {
        var r, n;
        let i = (n = (r = FN(t)) === null || r === void 0 ? void 0 : r.length) !== null && n !== void 0 ? n : (
          /* istanbul ignore next */
          0
        );
        Or(t, i, i);
      };
  }, "End"),
  Home: /* @__PURE__ */ o((e, t) => {
    if (z(t, [
      "input",
      "textarea"
    ]) || Ye(t))
      return () => {
        Or(t, 0, 0);
      };
  }, "Home"),
  PageDown: /* @__PURE__ */ o((e, t) => {
    if (z(t, [
      "input"
    ]))
      return () => {
        let r = Se(t).length;
        Or(t, r, r);
      };
  }, "PageDown"),
  PageUp: /* @__PURE__ */ o((e, t) => {
    if (z(t, [
      "input"
    ]))
      return () => {
        Or(t, 0, 0);
      };
  }, "PageUp"),
  Tab: /* @__PURE__ */ o((e, t, r) => () => {
    let n = HN(t, r.system.keyboard.modifiers.Shift);
    Ve(n), qe(n) && ht(n, {
      anchorOffset: 0,
      focusOffset: n.value.length
    });
  }, "Tab")
}, _re = /* @__PURE__ */ o((e, t, r) => {
  if (e.code === "KeyA" && r.system.keyboard.modifiers.Control)
    return () => Ff(t);
}, "combinationBehavior");

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/keypress.js
Fe.keypress = (e, t, r) => {
  if (e.key === "Enter") {
    if (z(t, "button") || z(t, "input") && Pre.includes(t.type) || z(t, "a") && t.href)
      return () => {
        r.dispatchUIEvent(t, "click");
      };
    if (z(t, "input")) {
      let n = t.form, i = n?.querySelector('input[type="submit"], button:not([type]), button[type="submit"]');
      return i ? () => r.dispatchUIEvent(i, "click") : n && qre.includes(t.type) && n.querySelectorAll("input").length === 1 ? () => r.dispatchUIEvent(
      n, "submit") : void 0;
    }
  }
  if (mt(t)) {
    let n = e.key === "Enter" ? Ye(t) && !r.system.keyboard.modifiers.Shift ? "insertParagraph" : "insertLineBreak" : "insertText", i = e.key ===
    "Enter" ? `
` : e.key;
    return () => yt(r, t, i, n);
  }
};
var Pre = [
  "button",
  "color",
  "file",
  "image",
  "reset",
  "submit"
], qre = [
  "email",
  "month",
  "password",
  "search",
  "tel",
  "text",
  "url",
  "week"
];

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/keyup.js
Fe.keyup = (e, t, r) => {
  var n;
  return (n = WN[e.key]) === null || n === void 0 ? void 0 : n.call(WN, e, t, r);
};
var WN = {
  " ": /* @__PURE__ */ o((e, t, r) => {
    if (Nf(t))
      return () => r.dispatchUIEvent(t, "click");
  }, " ")
};

// ../node_modules/@testing-library/user-event/dist/esm/event/behavior/paste.js
Fe.paste = (e, t, r) => {
  if (mt(t))
    return () => {
      var n;
      let i = (n = e.clipboardData) === null || n === void 0 ? void 0 : n.getData("text");
      i && yt(r, t, i, "insertFromPaste");
    };
};

// ../node_modules/@testing-library/user-event/dist/esm/event/eventMap.js
var Wy = {
  auxclick: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  beforeinput: {
    EventType: "InputEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  blur: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  click: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  contextmenu: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  copy: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  change: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !1
    }
  },
  cut: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  dblclick: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  focus: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  focusin: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  focusout: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  keydown: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  keypress: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  keyup: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  paste: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  input: {
    EventType: "InputEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  mousedown: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseenter: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  mouseleave: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    }
  },
  mousemove: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseout: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseover: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  mouseup: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerover: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerenter: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  pointerdown: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointermove: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerup: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointercancel: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }
  },
  pointerout: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !0,
      cancelable: !0,
      composed: !0
    }
  },
  pointerleave: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: !1,
      cancelable: !1
    }
  },
  submit: {
    EventType: "Event",
    defaultInit: {
      bubbles: !0,
      cancelable: !0
    }
  }
};
function GN(e) {
  return Wy[e].EventType;
}
o(GN, "getEventClass");
var Rre = [
  "MouseEvent",
  "PointerEvent"
];
function KN(e) {
  return Rre.includes(GN(e));
}
o(KN, "isMouseEvent");
function YN(e) {
  return GN(e) === "KeyboardEvent";
}
o(YN, "isKeyboardEvent");

// ../node_modules/@testing-library/user-event/dist/esm/event/createEvent.js
var Tre = {
  ClipboardEvent: [
    Sre
  ],
  Event: [],
  FocusEvent: [
    Do,
    Mre
  ],
  InputEvent: [
    Do,
    Are
  ],
  MouseEvent: [
    Do,
    Gy,
    XN
  ],
  PointerEvent: [
    Do,
    Gy,
    XN,
    Ire
  ],
  KeyboardEvent: [
    Do,
    Gy,
    Nre
  ]
};
function Ky(e, t, r) {
  let n = ve(t), { EventType: i, defaultInit: a } = Wy[e], s = new (Ore(n))[i](e, a);
  return Tre[i].forEach((l) => l(s, r ?? {})), s;
}
o(Ky, "createEvent");
function Ore(e) {
  var H, $, W, V, ee, pe, Ce, I, M, F, U, K, se, ge, Re;
  var t;
  let r = (t = e.Event) !== null && t !== void 0 ? t : (H = class {
  }, o(H, "Event"), H);
  var n;
  let i = (n = e.AnimationEvent) !== null && n !== void 0 ? n : ($ = class extends r {
  }, o($, "AnimationEvent"), $);
  var a;
  let s = (a = e.ClipboardEvent) !== null && a !== void 0 ? a : (W = class extends r {
  }, o(W, "ClipboardEvent"), W);
  var l;
  let c = (l = e.PopStateEvent) !== null && l !== void 0 ? l : (V = class extends r {
  }, o(V, "PopStateEvent"), V);
  var u;
  let d = (u = e.ProgressEvent) !== null && u !== void 0 ? u : (ee = class extends r {
  }, o(ee, "ProgressEvent"), ee);
  var f;
  let h = (f = e.TransitionEvent) !== null && f !== void 0 ? f : (pe = class extends r {
  }, o(pe, "TransitionEvent"), pe);
  var m;
  let y = (m = e.UIEvent) !== null && m !== void 0 ? m : (Ce = class extends r {
  }, o(Ce, "UIEvent"), Ce);
  var g;
  let x = (g = e.CompositionEvent) !== null && g !== void 0 ? g : (I = class extends y {
  }, o(I, "CompositionEvent"), I);
  var b;
  let E = (b = e.FocusEvent) !== null && b !== void 0 ? b : (M = class extends y {
  }, o(M, "FocusEvent"), M);
  var q;
  let C = (q = e.InputEvent) !== null && q !== void 0 ? q : (F = class extends y {
  }, o(F, "InputEvent"), F);
  var P;
  let O = (P = e.KeyboardEvent) !== null && P !== void 0 ? P : (U = class extends y {
  }, o(U, "KeyboardEvent"), U);
  var R;
  let A = (R = e.MouseEvent) !== null && R !== void 0 ? R : (K = class extends y {
  }, o(K, "MouseEvent"), K);
  var j;
  let J = (j = e.DragEvent) !== null && j !== void 0 ? j : (se = class extends A {
  }, o(se, "DragEvent"), se);
  var S;
  let G = (S = e.PointerEvent) !== null && S !== void 0 ? S : (ge = class extends A {
  }, o(ge, "PointerEvent"), ge);
  var ne;
  let B = (ne = e.TouchEvent) !== null && ne !== void 0 ? ne : (Re = class extends y {
  }, o(Re, "TouchEvent"), Re);
  return {
    Event: r,
    AnimationEvent: i,
    ClipboardEvent: s,
    PopStateEvent: c,
    ProgressEvent: d,
    TransitionEvent: h,
    UIEvent: y,
    CompositionEvent: x,
    FocusEvent: E,
    InputEvent: C,
    KeyboardEvent: O,
    MouseEvent: A,
    DragEvent: J,
    PointerEvent: G,
    TouchEvent: B
  };
}
o(Ore, "getEventConstructors");
function lr(e, t) {
  for (let [r, n] of Object.entries(t))
    Object.defineProperty(e, r, {
      get: /* @__PURE__ */ o(() => n ?? null, "get")
    });
}
o(lr, "assignProps");
function Ee(e) {
  return Number(e ?? 0);
}
o(Ee, "sanitizeNumber");
function Sre(e, { clipboardData: t }) {
  lr(e, {
    clipboardData: t
  });
}
o(Sre, "initClipboardEvent");
function Mre(e, { relatedTarget: t }) {
  lr(e, {
    relatedTarget: t
  });
}
o(Mre, "initFocusEvent");
function Are(e, { data: t, inputType: r, isComposing: n }) {
  lr(e, {
    data: t,
    isComposing: !!n,
    inputType: String(r)
  });
}
o(Are, "initInputEvent");
function Do(e, { view: t, detail: r }) {
  lr(e, {
    view: t,
    detail: Ee(r ?? 0)
  });
}
o(Do, "initUIEvent");
function Gy(e, { altKey: t, ctrlKey: r, metaKey: n, shiftKey: i, modifierAltGraph: a, modifierCapsLock: s, modifierFn: l, modifierFnLock: c,
modifierNumLock: u, modifierScrollLock: d, modifierSymbol: f, modifierSymbolLock: h }) {
  lr(e, {
    altKey: !!t,
    ctrlKey: !!r,
    metaKey: !!n,
    shiftKey: !!i,
    getModifierState(m) {
      return !!{
        Alt: t,
        AltGraph: a,
        CapsLock: s,
        Control: r,
        Fn: l,
        FnLock: c,
        Meta: n,
        NumLock: u,
        ScrollLock: d,
        Shift: i,
        Symbol: f,
        SymbolLock: h
      }[m];
    }
  });
}
o(Gy, "initUIEventModifiers");
function Nre(e, { key: t, code: r, location: n, repeat: i, isComposing: a, charCode: s }) {
  lr(e, {
    key: String(t),
    code: String(r),
    location: Ee(n),
    repeat: !!i,
    isComposing: !!a,
    charCode: s
  });
}
o(Nre, "initKeyboardEvent");
function XN(e, { x: t, y: r, screenX: n, screenY: i, clientX: a = t, clientY: s = r, button: l, buttons: c, relatedTarget: u, offsetX: d, offsetY: f,
pageX: h, pageY: m }) {
  lr(e, {
    screenX: Ee(n),
    screenY: Ee(i),
    clientX: Ee(a),
    x: Ee(a),
    clientY: Ee(s),
    y: Ee(s),
    button: Ee(l),
    buttons: Ee(c),
    relatedTarget: u,
    offsetX: Ee(d),
    offsetY: Ee(f),
    pageX: Ee(h),
    pageY: Ee(m)
  });
}
o(XN, "initMouseEvent");
function Ire(e, { pointerId: t, width: r, height: n, pressure: i, tangentialPressure: a, tiltX: s, tiltY: l, twist: c, pointerType: u, isPrimary: d }) {
  lr(e, {
    pointerId: Ee(t),
    width: Ee(r ?? 1),
    height: Ee(n ?? 1),
    pressure: Ee(i),
    tangentialPressure: Ee(a),
    tiltX: Ee(s),
    tiltY: Ee(l),
    twist: Ee(c),
    pointerType: String(u),
    isPrimary: !!d
  });
}
o(Ire, "initPointerEvent");

// ../node_modules/@testing-library/user-event/dist/esm/event/dispatchEvent.js
function JN(e, t, r, n = !1) {
  (KN(t) || YN(t)) && (r = {
    ...r,
    ...this.system.getUIEventModifiers()
  });
  let i = Ky(t, e, r);
  return Yy.call(this, e, i, n);
}
o(JN, "dispatchUIEvent");
function Yy(e, t, r = !1) {
  var n;
  let i = t.type, a = r ? () => {
  } : (n = Fe[i]) === null || n === void 0 ? void 0 : n.call(Fe, t, e, this);
  if (a) {
    t.preventDefault();
    let s = !1;
    return Object.defineProperty(t, "defaultPrevented", {
      get: /* @__PURE__ */ o(() => s, "get")
    }), Object.defineProperty(t, "preventDefault", {
      value: /* @__PURE__ */ o(() => {
        s = t.cancelable;
      }, "value")
    }), sr(() => e.dispatchEvent(t)), s || a(), !s;
  }
  return sr(() => e.dispatchEvent(t));
}
o(Yy, "dispatchEvent");
function At(e, t, r) {
  let n = Ky(t, e, r);
  sr(() => e.dispatchEvent(n));
}
o(At, "dispatchDOMEvent");

// ../node_modules/@testing-library/user-event/dist/esm/document/patchFocus.js
var QN = Symbol("patched focus/blur methods");
function Xy(e) {
  if (e.prototype[QN])
    return;
  let { focus: t, blur: r } = e.prototype;
  Object.defineProperties(e.prototype, {
    focus: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => i, "get")
    },
    blur: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => a, "get")
    },
    [QN]: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => ({
        focus: t,
        blur: r
      }), "get")
    }
  });
  let n;
  function i(s) {
    if (this.ownerDocument.visibilityState !== "hidden")
      return t.call(this, s);
    let l = ZN(this.ownerDocument);
    if (l === this)
      return;
    let c = Symbol("focus call");
    n = c, l && (r.call(l), At(l, "blur", {
      relatedTarget: this
    }), At(l, "focusout", {
      relatedTarget: n === c ? this : null
    })), n === c && (t.call(this, s), At(this, "focus", {
      relatedTarget: l
    })), n === c && At(this, "focusin", {
      relatedTarget: l
    });
  }
  o(i, "patchedFocus");
  function a() {
    if (this.ownerDocument.visibilityState !== "hidden")
      return r.call(this);
    let s = ZN(this.ownerDocument);
    if (s !== this)
      return;
    n = Symbol("blur call"), r.call(this), At(s, "blur", {
      relatedTarget: null
    }), At(s, "focusout", {
      relatedTarget: null
    });
  }
  o(a, "patchedBlur");
}
o(Xy, "patchFocus");
function ZN(e) {
  let t = Tr(e);
  return t?.tagName === "BODY" ? null : t;
}
o(ZN, "getActiveTarget");

// ../node_modules/@testing-library/user-event/dist/esm/document/interceptor.js
var Jy = Symbol("Interceptor for programmatical calls");
function _n(e, t, r) {
  let n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), i = Object.getOwnPropertyDescriptor(e, t), a = n?.set ? "set" : "valu\
e";
  if (typeof n?.[a] != "function" || n[a][Jy])
    throw new Error(`Element ${e.tagName} does not implement "${String(t)}".`);
  function s(...l) {
    let { applyNative: c = !1, realArgs: u, then: d } = r.call(this, ...l), f = (!c && i || n)[a];
    a === "set" ? f.call(this, u) : f.call(this, ...u), d?.();
  }
  o(s, "intercept"), s[Jy] = Jy, Object.defineProperty(e, t, {
    ...i ?? n,
    [a]: s
  });
}
o(_n, "prepareInterceptor");
function eI(e) {
  _n(e, "value", /* @__PURE__ */ o(function(r) {
    let n = xN(r);
    return n && jN(this), {
      applyNative: !!n,
      realArgs: jre(this, r),
      then: n ? void 0 : () => kN(this, String(r))
    };
  }, "interceptorImpl"));
}
o(eI, "prepareValueInterceptor");
function jre(e, t) {
  return z(e, "input", {
    type: "number"
  }) && String(t) !== "" && !Number.isNaN(Number(t)) ? String(Number(t)) : String(t);
}
o(jre, "sanitizeValue");
function tI(e) {
  _n(e, "setSelectionRange", /* @__PURE__ */ o(function(r, ...n) {
    let i = _N(r);
    return {
      applyNative: !!i,
      realArgs: [
        Number(r),
        ...n
      ],
      then: /* @__PURE__ */ o(() => i ? void 0 : Lo(e), "then")
    };
  }, "interceptorImpl")), _n(e, "selectionStart", /* @__PURE__ */ o(function(r) {
    return {
      realArgs: r,
      then: /* @__PURE__ */ o(() => Lo(e), "then")
    };
  }, "interceptorImpl")), _n(e, "selectionEnd", /* @__PURE__ */ o(function(r) {
    return {
      realArgs: r,
      then: /* @__PURE__ */ o(() => Lo(e), "then")
    };
  }, "interceptorImpl")), _n(e, "select", /* @__PURE__ */ o(function() {
    return {
      realArgs: [],
      then: /* @__PURE__ */ o(() => RN(e, {
        anchorOffset: 0,
        focusOffset: Se(e).length
      }), "then")
    };
  }, "interceptorImpl"));
}
o(tI, "prepareSelectionInterceptor");
function rI(e) {
  _n(e, "setRangeText", /* @__PURE__ */ o(function(...r) {
    return {
      realArgs: r,
      then: /* @__PURE__ */ o(() => {
        ko(e), Lo(e);
      }, "then")
    };
  }, "interceptorImpl"));
}
o(rI, "prepareRangeTextInterceptor");

// ../node_modules/@testing-library/user-event/dist/esm/document/prepareDocument.js
var Pn = Symbol("Node prepared with document state workarounds");
function Qy(e) {
  e[Pn] || (e.addEventListener("focus", (t) => {
    let r = t.target;
    nI(r);
  }, {
    capture: !0,
    passive: !0
  }), e.activeElement && nI(e.activeElement), e.addEventListener("blur", (t) => {
    let r = t.target, n = qN(r);
    n !== void 0 && (r.value !== n && At(r, "change"), jf(r));
  }, {
    capture: !0,
    passive: !0
  }), e[Pn] = Pn);
}
o(Qy, "prepareDocument");
function nI(e) {
  e[Pn] || (z(e, [
    "input",
    "textarea"
  ]) && (eI(e), tI(e), rI(e)), e[Pn] = Pn);
}
o(nI, "prepareElement");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/getDocumentFromNode.js
function oI(e) {
  return kre(e) ? e : e.ownerDocument;
}
o(oI, "getDocumentFromNode");
function kre(e) {
  return e.nodeType === 9;
}
o(kre, "isDocument");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/level.js
var $e = /* @__PURE__ */ function(e) {
  return e[e.Trigger = 2] = "Trigger", e[e.Call = 1] = "Call", e;
}({});
function Sr(e, t) {
  e.levelRefs[t] = {};
}
o(Sr, "setLevelRef");
function Fo(e, t) {
  return e.levelRefs[t];
}
o(Fo, "getLevelRef");

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/wait.js
function Et(e) {
  let t = e.delay;
  if (typeof t == "number")
    return Promise.all([
      new Promise((r) => globalThis.setTimeout(() => r(), t)),
      e.advanceTimers(t)
    ]);
}
o(Et, "wait");

// ../node_modules/@testing-library/user-event/dist/esm/options.js
var Mr = /* @__PURE__ */ function(e) {
  return e[e.EachTrigger = 4] = "EachTrigger", e[e.EachApiCall = 2] = "EachApiCall", e[e.EachTarget = 1] = "EachTarget", e[e.Never = 0] = "N\
ever", e;
}({});

// ../node_modules/@testing-library/user-event/dist/esm/system/keyboard.js
function Ar(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(Ar, "_define_property");
var gt = /* @__PURE__ */ function(e) {
  return e[e.STANDARD = 0] = "STANDARD", e[e.LEFT = 1] = "LEFT", e[e.RIGHT = 2] = "RIGHT", e[e.NUMPAD = 3] = "NUMPAD", e;
}({}), Lre = [
  "Alt",
  "AltGraph",
  "Control",
  "Fn",
  "Meta",
  "Shift",
  "Symbol"
];
function iI(e) {
  return Lre.includes(e);
}
o(iI, "isModifierKey");
var $re = [
  "CapsLock",
  "FnLock",
  "NumLock",
  "ScrollLock",
  "SymbolLock"
];
function aI(e) {
  return $re.includes(e);
}
o(aI, "isModifierLock");
var Zy = class Zy {
  isKeyPressed(t) {
    return this.pressed.has(String(t.code));
  }
  getPressedKeys() {
    return this.pressed.values().map((t) => t.keyDef);
  }
  /** Press a key */
  async keydown(t, r) {
    let n = String(r.key), i = String(r.code), a = Af(t.config.document);
    this.setKeydownTarget(a), this.pressed.add(i, r), iI(n) && (this.modifiers[n] = !0);
    let s = t.dispatchUIEvent(a, "keydown", {
      key: n,
      code: i
    });
    aI(n) && !this.modifiers[n] && (this.modifiers[n] = !0, this.modifierLockStart[n] = !0), s && this.pressed.setUnprevented(i), s && this.
    hasKeyPress(n) && t.dispatchUIEvent(Af(t.config.document), "keypress", {
      key: n,
      code: i,
      charCode: r.key === "Enter" ? 13 : String(r.key).charCodeAt(0)
    });
  }
  /** Release a key */
  async keyup(t, r) {
    let n = String(r.key), i = String(r.code), a = this.pressed.isUnprevented(i);
    this.pressed.delete(i), iI(n) && !this.pressed.values().find((s) => s.keyDef.key === n) && (this.modifiers[n] = !1), t.dispatchUIEvent(Af(
    t.config.document), "keyup", {
      key: n,
      code: i
    }, !a), aI(n) && this.modifiers[n] && (this.modifierLockStart[n] ? this.modifierLockStart[n] = !1 : this.modifiers[n] = !1);
  }
  setKeydownTarget(t) {
    t !== this.lastKeydownTarget && (this.carryChar = ""), this.lastKeydownTarget = t;
  }
  hasKeyPress(t) {
    return (t.length === 1 || t === "Enter") && !this.modifiers.Control && !this.modifiers.Alt;
  }
  constructor(t) {
    Ar(this, "system", void 0), Ar(this, "modifiers", {
      Alt: !1,
      AltGraph: !1,
      CapsLock: !1,
      Control: !1,
      Fn: !1,
      FnLock: !1,
      Meta: !1,
      NumLock: !1,
      ScrollLock: !1,
      Shift: !1,
      Symbol: !1,
      SymbolLock: !1
    }), Ar(this, "pressed", new class {
      add(r, n) {
        var i, a, s;
        (s = (i = this.registry)[a = r]) !== null && s !== void 0 || (i[a] = {
          keyDef: n,
          unpreventedDefault: !1
        });
      }
      has(r) {
        return !!this.registry[r];
      }
      setUnprevented(r) {
        let n = this.registry[r];
        n && (n.unpreventedDefault = !0);
      }
      isUnprevented(r) {
        var n;
        return !!(!((n = this.registry[r]) === null || n === void 0) && n.unpreventedDefault);
      }
      delete(r) {
        delete this.registry[r];
      }
      values() {
        return Object.values(this.registry);
      }
      constructor() {
        Ar(this, "registry", {});
      }
    }()), Ar(this, "carryChar", ""), Ar(this, "lastKeydownTarget", void 0), Ar(this, "modifierLockStart", {}), this.system = t;
  }
};
o(Zy, "KeyboardHost");
var Uf = Zy;

// ../node_modules/@testing-library/user-event/dist/esm/keyboard/keyMap.js
var sI = [
  // alphanumeric block - writing system
  ..."0123456789".split("").map((e) => ({
    code: `Digit${e}`,
    key: e
  })),
  ...")!@#$%^&*(".split("").map((e, t) => ({
    code: `Digit${t}`,
    key: e,
    shiftKey: !0
  })),
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((e) => ({
    code: `Key${e.toUpperCase()}`,
    key: e
  })),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((e) => ({
    code: `Key${e}`,
    key: e,
    shiftKey: !0
  })),
  {
    code: "BracketLeft",
    key: "["
  },
  {
    code: "BracketLeft",
    key: "{",
    shiftKey: !0
  },
  {
    code: "BracketRight",
    key: "]"
  },
  {
    code: "BracketRight",
    key: "}",
    shiftKey: !0
  },
  // alphanumeric block - functional
  {
    code: "Space",
    key: " "
  },
  {
    code: "AltLeft",
    key: "Alt",
    location: gt.LEFT
  },
  {
    code: "AltRight",
    key: "Alt",
    location: gt.RIGHT
  },
  {
    code: "ShiftLeft",
    key: "Shift",
    location: gt.LEFT
  },
  {
    code: "ShiftRight",
    key: "Shift",
    location: gt.RIGHT
  },
  {
    code: "ControlLeft",
    key: "Control",
    location: gt.LEFT
  },
  {
    code: "ControlRight",
    key: "Control",
    location: gt.RIGHT
  },
  {
    code: "MetaLeft",
    key: "Meta",
    location: gt.LEFT
  },
  {
    code: "MetaRight",
    key: "Meta",
    location: gt.RIGHT
  },
  {
    code: "OSLeft",
    key: "OS",
    location: gt.LEFT
  },
  {
    code: "OSRight",
    key: "OS",
    location: gt.RIGHT
  },
  {
    code: "ContextMenu",
    key: "ContextMenu"
  },
  {
    code: "Tab",
    key: "Tab"
  },
  {
    code: "CapsLock",
    key: "CapsLock"
  },
  {
    code: "Backspace",
    key: "Backspace"
  },
  {
    code: "Enter",
    key: "Enter"
  },
  // function
  {
    code: "Escape",
    key: "Escape"
  },
  // arrows
  {
    code: "ArrowUp",
    key: "ArrowUp"
  },
  {
    code: "ArrowDown",
    key: "ArrowDown"
  },
  {
    code: "ArrowLeft",
    key: "ArrowLeft"
  },
  {
    code: "ArrowRight",
    key: "ArrowRight"
  },
  // control pad
  {
    code: "Home",
    key: "Home"
  },
  {
    code: "End",
    key: "End"
  },
  {
    code: "Delete",
    key: "Delete"
  },
  {
    code: "PageUp",
    key: "PageUp"
  },
  {
    code: "PageDown",
    key: "PageDown"
  },
  // Special keys that are not part of a default US-layout but included for specific behavior
  {
    code: "Fn",
    key: "Fn"
  },
  {
    code: "Symbol",
    key: "Symbol"
  },
  {
    code: "AltRight",
    key: "AltGraph"
  }
];

// ../node_modules/@testing-library/user-event/dist/esm/pointer/keyMap.js
var lI = [
  {
    name: "MouseLeft",
    pointerType: "mouse",
    button: "primary"
  },
  {
    name: "MouseRight",
    pointerType: "mouse",
    button: "secondary"
  },
  {
    name: "MouseMiddle",
    pointerType: "mouse",
    button: "auxiliary"
  },
  {
    name: "TouchA",
    pointerType: "touch"
  },
  {
    name: "TouchB",
    pointerType: "touch"
  },
  {
    name: "TouchC",
    pointerType: "touch"
  }
];

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/buttons.js
function Bre(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(Bre, "_define_property");
var tg = class tg {
  getButtons() {
    let t = 0;
    for (let r of Object.keys(this.pressed))
      t |= 2 ** Number(r);
    return t;
  }
  down(t) {
    let r = eg(t.button);
    if (r in this.pressed) {
      this.pressed[r].push(t);
      return;
    }
    return this.pressed[r] = [
      t
    ], r;
  }
  up(t) {
    let r = eg(t.button);
    if (r in this.pressed && (this.pressed[r] = this.pressed[r].filter((n) => n.name !== t.name), this.pressed[r].length === 0))
      return delete this.pressed[r], r;
  }
  constructor() {
    Bre(this, "pressed", {});
  }
};
o(tg, "Buttons");
var qn = tg, uI = {
  primary: 0,
  secondary: 1,
  auxiliary: 2,
  back: 3,
  X1: 3,
  forward: 4,
  X2: 4
};
function eg(e = 0) {
  return e in uI ? uI[e] : Number(e);
}
o(eg, "getMouseButtonId");
var cI = {
  1: 2,
  2: 1
};
function Uo(e) {
  return e = eg(e), e in cI ? cI[e] : e;
}
o(Uo, "getMouseEventButton");

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/device.js
function Dre(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(Dre, "_define_property");
var rg = class rg {
  get countPressed() {
    return this.pressedKeys.size;
  }
  isPressed(t) {
    return this.pressedKeys.has(t.name);
  }
  addPressed(t) {
    return this.pressedKeys.add(t.name);
  }
  removePressed(t) {
    return this.pressedKeys.delete(t.name);
  }
  constructor() {
    Dre(this, "pressedKeys", /* @__PURE__ */ new Set());
  }
};
o(rg, "Device");
var Hf = rg;

// ../node_modules/@testing-library/user-event/dist/esm/utils/misc/getTreeDiff.js
function Nr(e, t) {
  let r = [];
  for (let a = e; a; a = a.parentElement)
    r.push(a);
  let n = [];
  for (let a = t; a; a = a.parentElement)
    n.push(a);
  let i = 0;
  for (; !(i >= r.length || i >= n.length || r[r.length - 1 - i] !== n[n.length - 1 - i]); i++)
    ;
  return [
    r.slice(0, r.length - i),
    n.slice(0, n.length - i),
    n.slice(n.length - i)
  ];
}
o(Nr, "getTreeDiff");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/resolveCaretPosition.js
function Ho({ target: e, node: t, offset: r }) {
  return qe(e) ? {
    node: e,
    offset: r ?? Se(e).length
  } : t ? {
    node: t,
    offset: r ?? (t.nodeType === 3 ? t.nodeValue.length : t.childNodes.length)
  } : dI(e, r);
}
o(Ho, "resolveCaretPosition");
function dI(e, t, r = !0) {
  let n = t === void 0 ? e.childNodes.length - 1 : 0, i = t === void 0 ? -1 : 1;
  for (; t === void 0 ? n >= (r ? Math.max(e.childNodes.length - 1, 0) : 0) : n <= e.childNodes.length; ) {
    if (t && n === e.childNodes.length)
      throw new Error("The given offset is out of bounds.");
    let a = e.childNodes.item(n), s = String(a.textContent);
    if (s.length)
      if (t !== void 0 && s.length < t)
        t -= s.length;
      else {
        if (a.nodeType === 1)
          return dI(a, t, !1);
        if (a.nodeType === 3)
          return {
            node: a,
            offset: t ?? a.nodeValue.length
          };
      }
    n += i;
  }
  return {
    node: e,
    offset: e.childNodes.length
  };
}
o(dI, "findNodeAtTextOffset");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/setSelectionPerMouse.js
function fI({ document: e, target: t, clickCount: r, node: n, offset: i }) {
  if (vN(t))
    return;
  let a = qe(t), s = String(a ? Se(t) : t.textContent), [l, c] = n ? (
    // which elements might be considered in the same line of text.
    // TODO: support expanding initial range on multiple clicks if node is given
    [
      i,
      i
    ]
  ) : Fre(s, i, r);
  if (a)
    return ht(t, {
      anchorOffset: l ?? s.length,
      focusOffset: c ?? s.length
    }), {
      node: t,
      start: l ?? 0,
      end: c ?? s.length
    };
  {
    let { node: u, offset: d } = Ho({
      target: t,
      node: n,
      offset: l
    }), { node: f, offset: h } = Ho({
      target: t,
      node: n,
      offset: c
    }), m = t.ownerDocument.createRange();
    try {
      m.setStart(u, d), m.setEnd(f, h);
    } catch {
      throw new Error("The given offset is out of bounds.");
    }
    let y = e.getSelection();
    return y?.removeAllRanges(), y?.addRange(m.cloneRange()), m;
  }
}
o(fI, "setSelectionPerMouseDown");
function Fre(e, t, r) {
  if (r % 3 === 1 || e.length === 0)
    return [
      t,
      t
    ];
  let n = t ?? e.length;
  return r % 3 === 2 ? [
    n - e.substr(0, t).match(/(\w+|\s+|\W)?$/)[0].length,
    t === void 0 ? t : t + e.substr(t).match(/^(\w+|\s+|\W)?/)[0].length
  ] : [
    n - e.substr(0, t).match(/[^\r\n]*$/)[0].length,
    t === void 0 ? t : t + e.substr(t).match(/^[^\r\n]*/)[0].length
  ];
}
o(Fre, "getTextRange");

// ../node_modules/@testing-library/user-event/dist/esm/event/selection/modifySelectionPerMouse.js
function pI(e, { document: t, target: r, node: n, offset: i }) {
  let a = Ho({
    target: r,
    node: n,
    offset: i
  });
  if ("node" in e) {
    if (a.node === e.node) {
      let s = a.offset < e.start ? e.end : e.start, l = a.offset > e.end || a.offset < e.start ? a.offset : e.end;
      ht(e.node, {
        anchorOffset: s,
        focusOffset: l
      });
    }
  } else {
    let s = e.cloneRange(), l = s.comparePoint(a.node, a.offset);
    l < 0 ? s.setStart(a.node, a.offset) : l > 0 && s.setEnd(a.node, a.offset);
    let c = t.getSelection();
    c?.removeAllRanges(), c?.addRange(s.cloneRange());
  }
}
o(pI, "modifySelectionPerMouseMove");

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/shared.js
function Vf(e, t) {
  var r, n, i, a, s, l, c, u, d, f, h, m, y, g, x, b, E, q, C, P, O, R, A, j;
  return e.target !== t.target || ((r = e.coords) === null || r === void 0 ? void 0 : r.x) !== ((n = t.coords) === null || n === void 0 ? void 0 :
  n.x) || ((i = e.coords) === null || i === void 0 ? void 0 : i.y) !== ((a = t.coords) === null || a === void 0 ? void 0 : a.y) || ((s = e.coords) ===
  null || s === void 0 ? void 0 : s.clientX) !== ((l = t.coords) === null || l === void 0 ? void 0 : l.clientX) || ((c = e.coords) === null ||
  c === void 0 ? void 0 : c.clientY) !== ((u = t.coords) === null || u === void 0 ? void 0 : u.clientY) || ((d = e.coords) === null || d ===
  void 0 ? void 0 : d.offsetX) !== ((f = t.coords) === null || f === void 0 ? void 0 : f.offsetX) || ((h = e.coords) === null || h === void 0 ?
  void 0 : h.offsetY) !== ((m = t.coords) === null || m === void 0 ? void 0 : m.offsetY) || ((y = e.coords) === null || y === void 0 ? void 0 :
  y.pageX) !== ((g = t.coords) === null || g === void 0 ? void 0 : g.pageX) || ((x = e.coords) === null || x === void 0 ? void 0 : x.pageY) !==
  ((b = t.coords) === null || b === void 0 ? void 0 : b.pageY) || ((E = e.coords) === null || E === void 0 ? void 0 : E.screenX) !== ((q = t.
  coords) === null || q === void 0 ? void 0 : q.screenX) || ((C = e.coords) === null || C === void 0 ? void 0 : C.screenY) !== ((P = t.coords) ===
  null || P === void 0 ? void 0 : P.screenY) || ((O = e.caret) === null || O === void 0 ? void 0 : O.node) !== ((R = t.caret) === null || R ===
  void 0 ? void 0 : R.node) || ((A = e.caret) === null || A === void 0 ? void 0 : A.offset) !== ((j = t.caret) === null || j === void 0 ? void 0 :
  j.offset);
}
o(Vf, "isDifferentPointerPosition");

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/mouse.js
function Ir(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(Ir, "_define_property");
var ng = class ng {
  move(t, r, n) {
    let i = this.position, a = this.getTarget(t);
    if (this.position = r, !Vf(i, r))
      return;
    let s = this.getTarget(t), l = this.getEventInit("mousemove"), [c, u] = Nr(a, s);
    return {
      leave: /* @__PURE__ */ o(() => {
        a !== s && (t.dispatchUIEvent(a, "mouseout", l), c.forEach((d) => t.dispatchUIEvent(d, "mouseleave", l)));
      }, "leave"),
      enter: /* @__PURE__ */ o(() => {
        a !== s && (t.dispatchUIEvent(s, "mouseover", l), u.forEach((d) => t.dispatchUIEvent(d, "mouseenter", l)));
      }, "enter"),
      move: /* @__PURE__ */ o(() => {
        n || (t.dispatchUIEvent(s, "mousemove", l), this.modifySelecting(t));
      }, "move")
    };
  }
  down(t, r, n) {
    let i = this.buttons.down(r);
    if (i === void 0)
      return;
    let a = this.getTarget(t);
    this.buttonDownTarget[i] = a;
    let s = this.getEventInit("mousedown", r.button), l = Le(a);
    !n && (l || t.dispatchUIEvent(a, "mousedown", s)) && (this.startSelecting(t, s.detail), Ve(a)), !l && Uo(r.button) === 2 && t.dispatchUIEvent(
    a, "contextmenu", this.getEventInit("contextmenu", r.button));
  }
  up(t, r, n) {
    let i = this.buttons.up(r);
    if (i === void 0)
      return;
    let a = this.getTarget(t);
    if (!Le(a)) {
      if (!n) {
        let l = this.getEventInit("mouseup", r.button);
        t.dispatchUIEvent(a, "mouseup", l), this.endSelecting();
      }
      let s = Nr(this.buttonDownTarget[i], a)[2][0];
      if (s) {
        let l = this.getEventInit("click", r.button);
        l.detail && (t.dispatchUIEvent(s, l.button === 0 ? "click" : "auxclick", l), l.button === 0 && l.detail === 2 && t.dispatchUIEvent(s,
        "dblclick", {
          ...this.getEventInit("dblclick", r.button),
          detail: l.detail
        }));
      }
    }
  }
  resetClickCount() {
    this.clickCount.reset();
  }
  getEventInit(t, r) {
    let n = {
      ...this.position.coords
    };
    return n.button = Uo(r), n.buttons = this.buttons.getButtons(), t === "mousedown" ? n.detail = this.clickCount.getOnDown(n.button) : t ===
    "mouseup" ? n.detail = this.clickCount.getOnUp(n.button) : (t === "click" || t === "auxclick") && (n.detail = this.clickCount.incOnClick(
    n.button)), n;
  }
  getTarget(t) {
    var r;
    return (r = this.position.target) !== null && r !== void 0 ? r : t.config.document.body;
  }
  startSelecting(t, r) {
    var n, i;
    this.selecting = fI({
      document: t.config.document,
      target: this.getTarget(t),
      node: (n = this.position.caret) === null || n === void 0 ? void 0 : n.node,
      offset: (i = this.position.caret) === null || i === void 0 ? void 0 : i.offset,
      clickCount: r
    });
  }
  modifySelecting(t) {
    var r, n;
    this.selecting && pI(this.selecting, {
      document: t.config.document,
      target: this.getTarget(t),
      node: (r = this.position.caret) === null || r === void 0 ? void 0 : r.node,
      offset: (n = this.position.caret) === null || n === void 0 ? void 0 : n.offset
    });
  }
  endSelecting() {
    this.selecting = void 0;
  }
  constructor() {
    Ir(this, "position", {}), Ir(this, "buttons", new qn()), Ir(this, "selecting", void 0), Ir(this, "buttonDownTarget", {}), Ir(this, "clic\
kCount", new class {
      incOnClick(t) {
        let r = this.down[t] === void 0 ? void 0 : Number(this.down[t]) + 1;
        return this.count = this.count[t] === void 0 ? {} : {
          [t]: Number(this.count[t]) + 1
        }, r;
      }
      getOnDown(t) {
        var r;
        this.down = {
          [t]: (r = this.count[t]) !== null && r !== void 0 ? r : 0
        };
        var n;
        return this.count = {
          [t]: (n = this.count[t]) !== null && n !== void 0 ? n : 0
        }, Number(this.count[t]) + 1;
      }
      getOnUp(t) {
        return this.down[t] === void 0 ? void 0 : Number(this.down[t]) + 1;
      }
      reset() {
        this.count = {};
      }
      constructor() {
        Ir(this, "down", {}), Ir(this, "count", {});
      }
    }());
  }
};
o(ng, "Mouse");
var zf = ng;

// ../node_modules/@testing-library/user-event/dist/esm/utils/pointer/cssPointerEvents.js
function Rn(e, t) {
  var r;
  return ((r = bI(e, t)) === null || r === void 0 ? void 0 : r.pointerEvents) !== "none";
}
o(Rn, "hasPointerEvents");
function Ure(e) {
  let t = ve(e);
  for (let r = e, n = []; r?.ownerDocument; r = r.parentElement) {
    n.push(r);
    let i = t.getComputedStyle(r).pointerEvents;
    if (i && ![
      "inherit",
      "unset"
    ].includes(i))
      return {
        pointerEvents: i,
        tree: n
      };
  }
}
o(Ure, "closestPointerEventsDeclaration");
var mI = Symbol("Last check for pointer-events");
function bI(e, t) {
  let r = t[mI];
  if (!(e.config.pointerEventsCheck !== Mr.Never && (!r || hI(e.config.pointerEventsCheck, Mr.EachApiCall) && r[$e.Call] !== Fo(e, $e.Call) ||
  hI(e.config.pointerEventsCheck, Mr.EachTrigger) && r[$e.Trigger] !== Fo(e, $e.Trigger))))
    return r?.result;
  let i = Ure(t);
  return t[mI] = {
    [$e.Call]: Fo(e, $e.Call),
    [$e.Trigger]: Fo(e, $e.Trigger),
    result: i
  }, i;
}
o(bI, "checkPointerEvents");
function jr(e, t) {
  let r = bI(e, t);
  if (r?.pointerEvents === "none")
    throw new Error([
      `Unable to perform pointer interaction as the element ${r.tree.length > 1 ? "inherits" : "has"} \`pointer-events: none\`:`,
      "",
      Hre(r.tree)
    ].join(`
`));
}
o(jr, "assertPointerEvents");
function Hre(e) {
  return e.reverse().map((t, r) => [
    "".padEnd(r),
    t.tagName,
    t.id && `#${t.id}`,
    t.hasAttribute("data-testid") && `(testId=${t.getAttribute("data-testid")})`,
    Vre(t),
    e.length > 1 && r === 0 && "  <-- This element declared `pointer-events: none`",
    e.length > 1 && r === e.length - 1 && "  <-- Asserted pointer events here"
  ].filter(Boolean).join("")).join(`
`);
}
o(Hre, "printTree");
function Vre(e) {
  var t;
  let r;
  if (e.hasAttribute("aria-label"))
    r = e.getAttribute("aria-label");
  else if (e.hasAttribute("aria-labelledby")) {
    var n, i;
    r = (i = e.ownerDocument.getElementById(e.getAttribute("aria-labelledby"))) === null || i === void 0 || (n = i.textContent) === null || n ===
    void 0 ? void 0 : n.trim();
  } else if (z(e, [
    "button",
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea"
  ]) && (!((t = e.labels) === null || t === void 0) && t.length))
    r = Array.from(e.labels).map((s) => {
      var l;
      return (l = s.textContent) === null || l === void 0 ? void 0 : l.trim();
    }).join("|");
  else if (z(e, "button")) {
    var a;
    r = (a = e.textContent) === null || a === void 0 ? void 0 : a.trim();
  }
  return r = r?.replace(/\n/g, "  "), Number(r?.length) > 30 && (r = `${r?.substring(0, 29)}\u2026`), r ? `(label=${r})` : "";
}
o(Vre, "getLabelDescr");
function hI(e, t) {
  return (e & t) > 0;
}
o(hI, "hasBitFlag");

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/pointer.js
function Nt(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(Nt, "_define_property");
var og = class og {
  init(t) {
    let r = this.getTarget(t), [, n] = Nr(null, r), i = this.getEventInit();
    return jr(t, r), t.dispatchUIEvent(r, "pointerover", i), n.forEach((a) => t.dispatchUIEvent(a, "pointerenter", i)), this;
  }
  move(t, r) {
    let n = this.position, i = this.getTarget(t);
    if (this.position = r, !Vf(n, r))
      return;
    let a = this.getTarget(t), s = this.getEventInit(-1), [l, c] = Nr(i, a);
    return {
      leave: /* @__PURE__ */ o(() => {
        Rn(t, i) && i !== a && (t.dispatchUIEvent(i, "pointerout", s), l.forEach((u) => t.dispatchUIEvent(u, "pointerleave", s)));
      }, "leave"),
      enter: /* @__PURE__ */ o(() => {
        jr(t, a), i !== a && (t.dispatchUIEvent(a, "pointerover", s), c.forEach((u) => t.dispatchUIEvent(u, "pointerenter", s)));
      }, "enter"),
      move: /* @__PURE__ */ o(() => {
        t.dispatchUIEvent(a, "pointermove", s);
      }, "move")
    };
  }
  down(t, r = 0) {
    if (this.isDown)
      return;
    let n = this.getTarget(t);
    jr(t, n), this.isDown = !0, this.isPrevented = !t.dispatchUIEvent(n, "pointerdown", this.getEventInit(r));
  }
  up(t, r = 0) {
    if (!this.isDown)
      return;
    let n = this.getTarget(t);
    jr(t, n), this.isPrevented = !1, this.isDown = !1, t.dispatchUIEvent(n, "pointerup", this.getEventInit(r));
  }
  release(t) {
    let r = this.getTarget(t), [n] = Nr(r, null), i = this.getEventInit();
    Rn(t, r) && (t.dispatchUIEvent(r, "pointerout", i), n.forEach((a) => t.dispatchUIEvent(a, "pointerleave", i))), this.isCancelled = !0;
  }
  getTarget(t) {
    var r;
    return (r = this.position.target) !== null && r !== void 0 ? r : t.config.document.body;
  }
  getEventInit(t) {
    return {
      ...this.position.coords,
      pointerId: this.pointerId,
      pointerType: this.pointerType,
      isPrimary: this.isPrimary,
      button: Uo(t),
      buttons: this.buttons.getButtons()
    };
  }
  constructor({ pointerId: t, pointerType: r, isPrimary: n }, i) {
    Nt(this, "pointerId", void 0), Nt(this, "pointerType", void 0), Nt(this, "isPrimary", void 0), Nt(this, "buttons", void 0), Nt(this, "is\
Multitouch", !1), Nt(this, "isCancelled", !1), Nt(this, "isDown", !1), Nt(this, "isPrevented", !1), Nt(this, "position", {}), this.pointerId =
    t, this.pointerType = r, this.isPrimary = n, this.isMultitouch = !n, this.buttons = i;
  }
};
o(og, "Pointer");
var Wf = og;

// ../node_modules/@testing-library/user-event/dist/esm/system/pointer/index.js
function ur(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(ur, "_define_property");
var ig = class ig {
  isKeyPressed(t) {
    return this.devices.get(t.pointerType).isPressed(t);
  }
  async press(t, r, n) {
    this.devices.get(r.pointerType).addPressed(r), this.buttons.down(r);
    let i = this.getPointerName(r), a = r.pointerType === "touch" ? this.pointers.new(i, r.pointerType, this.buttons) : this.pointers.get(i);
    a.position = n, a.pointerType !== "touch" && (this.mouse.position = n), a.pointerType === "touch" && a.init(t), a.down(t, r.button), a.pointerType !==
    "touch" && this.mouse.down(t, r, a.isPrevented);
  }
  async move(t, r, n) {
    let i = this.pointers.get(r), a = i.move(t, n), s = i.pointerType === "touch" ? void 0 : this.mouse.move(t, n, i.isPrevented);
    a?.leave(), s?.leave(), a?.enter(), s?.enter(), a?.move(), s?.move();
  }
  async release(t, r, n) {
    let i = this.devices.get(r.pointerType);
    i.removePressed(r), this.buttons.up(r);
    let a = this.pointers.get(this.getPointerName(r)), s = a.isPrevented;
    if (a.position = n, a.pointerType !== "touch" && (this.mouse.position = n), i.countPressed === 0 && a.up(t, r.button), a.pointerType ===
    "touch" && a.release(t), a.pointerType === "touch" && !a.isMultitouch) {
      let l = this.mouse.move(t, n, s);
      l?.leave(), l?.enter(), l?.move(), this.mouse.down(t, r, s);
    }
    if (!a.isMultitouch) {
      let l = this.mouse.move(t, n, s);
      l?.leave(), l?.enter(), l?.move(), this.mouse.up(t, r, s);
    }
  }
  getPointerName(t) {
    return t.pointerType === "touch" ? t.name : t.pointerType;
  }
  getPreviousPosition(t) {
    return this.pointers.has(t) ? this.pointers.get(t).position : void 0;
  }
  resetClickCount() {
    this.mouse.resetClickCount();
  }
  getMouseTarget(t) {
    var r;
    return (r = this.mouse.position.target) !== null && r !== void 0 ? r : t.config.document.body;
  }
  setMousePosition(t) {
    this.mouse.position = t, this.pointers.get("mouse").position = t;
  }
  constructor(t) {
    ur(this, "system", void 0), ur(this, "mouse", void 0), ur(this, "buttons", void 0), ur(this, "devices", new class {
      get(r) {
        var n, i, a;
        return (a = (n = this.registry)[i = r]) !== null && a !== void 0 ? a : n[i] = new Hf();
      }
      constructor() {
        ur(this, "registry", {});
      }
    }()), ur(this, "pointers", new class {
      new(r, n, i) {
        let a = n !== "touch" || !Object.values(this.registry).some((s) => s.pointerType === "touch" && !s.isCancelled);
        return a || Object.values(this.registry).forEach((s) => {
          s.pointerType === n && !s.isCancelled && (s.isMultitouch = !0);
        }), this.registry[r] = new Wf({
          pointerId: this.nextId++,
          pointerType: n,
          isPrimary: a
        }, i), this.registry[r];
      }
      get(r) {
        if (!this.has(r))
          throw new Error(`Trying to access pointer "${r}" which does not exist.`);
        return this.registry[r];
      }
      has(r) {
        return r in this.registry;
      }
      constructor() {
        ur(this, "registry", {}), ur(this, "nextId", 1);
      }
    }()), this.system = t, this.buttons = new qn(), this.mouse = new zf(), this.pointers.new("mouse", "mouse", this.buttons);
  }
};
o(ig, "PointerHost");
var Gf = ig;

// ../node_modules/@testing-library/user-event/dist/esm/system/index.js
function yI(e, t, r) {
  return t in e ? Object.defineProperty(e, t, {
    value: r,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = r, e;
}
o(yI, "_define_property");
var ag = class ag {
  getUIEventModifiers() {
    return {
      altKey: this.keyboard.modifiers.Alt,
      ctrlKey: this.keyboard.modifiers.Control,
      metaKey: this.keyboard.modifiers.Meta,
      shiftKey: this.keyboard.modifiers.Shift,
      modifierAltGraph: this.keyboard.modifiers.AltGraph,
      modifierCapsLock: this.keyboard.modifiers.CapsLock,
      modifierFn: this.keyboard.modifiers.Fn,
      modifierFnLock: this.keyboard.modifiers.FnLock,
      modifierNumLock: this.keyboard.modifiers.NumLock,
      modifierScrollLock: this.keyboard.modifiers.ScrollLock,
      modifierSymbol: this.keyboard.modifiers.Symbol,
      modifierSymbolLock: this.keyboard.modifiers.SymbolLock
    };
  }
  constructor() {
    yI(this, "keyboard", new Uf(this)), yI(this, "pointer", new Gf(this));
  }
};
o(ag, "System");
var Vo = ag;

// ../node_modules/@testing-library/user-event/dist/esm/convenience/click.js
async function gI(e) {
  let t = [];
  return this.config.skipHover || t.push({
    target: e
  }), t.push({
    keys: "[MouseLeft]",
    target: e
  }), this.pointer(t);
}
o(gI, "click");
async function vI(e) {
  return this.pointer([
    {
      target: e
    },
    "[MouseLeft][MouseLeft]"
  ]);
}
o(vI, "dblClick");
async function wI(e) {
  return this.pointer([
    {
      target: e
    },
    "[MouseLeft][MouseLeft][MouseLeft]"
  ]);
}
o(wI, "tripleClick");

// ../node_modules/@testing-library/user-event/dist/esm/convenience/hover.js
async function EI(e) {
  return this.pointer({
    target: e
  });
}
o(EI, "hover");
async function CI(e) {
  return jr(this, this.system.pointer.getMouseTarget(this)), this.pointer({
    target: e.ownerDocument.body
  });
}
o(CI, "unhover");

// ../node_modules/@testing-library/user-event/dist/esm/convenience/tab.js
async function xI({ shift: e } = {}) {
  return this.keyboard(e === !0 ? "{Shift>}{Tab}{/Shift}" : e === !1 ? "[/ShiftLeft][/ShiftRight]{Tab}" : "{Tab}");
}
o(xI, "tab");

// ../node_modules/@testing-library/user-event/dist/esm/utils/keyDef/readNextDescriptor.js
var sg = /* @__PURE__ */ function(e) {
  return e["{"] = "}", e["["] = "]", e;
}(sg || {});
function Kf(e, t) {
  let r = 0, n = e[r] in sg ? e[r] : "";
  r += n.length;
  let a = new RegExp(`^\\${n}{2}`).test(e) ? "" : n;
  return {
    type: a,
    ...a === "" ? zre(e, r, t) : Wre(e, r, a, t)
  };
}
o(Kf, "readNextDescriptor");
function zre(e, t, r) {
  let n = e[t];
  return _I(n, e, t, r), t += n.length, {
    consumedLength: t,
    descriptor: n,
    releasePrevious: !1,
    releaseSelf: !0,
    repeat: 1
  };
}
o(zre, "readPrintableChar");
function Wre(e, t, r, n) {
  var i, a;
  let s = e[t] === "/" ? "/" : "";
  t += s.length;
  let l = r === "{" && e[t] === "\\";
  t += Number(l);
  let c = l ? e[t] : (i = e.slice(t).match(r === "{" ? /^\w+|^[^}>/]/ : /^\w+/)) === null || i === void 0 ? void 0 : i[0];
  _I(c, e, t, n), t += c.length;
  var u;
  let d = (u = (a = e.slice(t).match(/^>\d+/)) === null || a === void 0 ? void 0 : a[0]) !== null && u !== void 0 ? u : "";
  t += d.length;
  let f = e[t] === "/" || !d && e[t] === ">" ? e[t] : "";
  t += f.length;
  let h = sg[r], m = e[t] === h ? h : "";
  if (!m)
    throw new Error(PI([
      !d && "repeat modifier",
      !f && "release modifier",
      `"${h}"`
    ].filter(Boolean).join(" or "), e[t], e, n));
  return t += m.length, {
    consumedLength: t,
    descriptor: c,
    releasePrevious: !!s,
    repeat: d ? Math.max(Number(d.substr(1)), 1) : 1,
    releaseSelf: Gre(f, d)
  };
}
o(Wre, "readTag");
function _I(e, t, r, n) {
  if (!e)
    throw new Error(PI("key descriptor", t[r], t, n));
}
o(_I, "assertDescriptor");
function Gre(e, t) {
  if (e)
    return e === "/";
  if (t)
    return !1;
}
o(Gre, "hasReleaseSelf");
function PI(e, t, r, n) {
  return `Expected ${e} but found "${t ?? ""}" in "${r}"
    See ${n === "pointer" ? "https://testing-library.com/docs/user-event/pointer#pressing-a-button-or-touching-the-screen" : "https://testin\
g-library.com/docs/user-event/keyboard"}
    for more information about how userEvent parses your input.`;
}
o(PI, "getErrorMessage");

// ../node_modules/@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js
function qI(e, t) {
  let r = [];
  do {
    let { type: i, descriptor: a, consumedLength: s, releasePrevious: l, releaseSelf: c = !0, repeat: u } = Kf(t, "keyboard");
    var n;
    let d = (n = e.find((f) => {
      if (i === "[") {
        var h;
        return ((h = f.code) === null || h === void 0 ? void 0 : h.toLowerCase()) === a.toLowerCase();
      } else if (i === "{") {
        var m;
        return ((m = f.key) === null || m === void 0 ? void 0 : m.toLowerCase()) === a.toLowerCase();
      }
      return f.key === a;
    })) !== null && n !== void 0 ? n : {
      key: "Unknown",
      code: "Unknown",
      [i === "[" ? "code" : "key"]: a
    };
    r.push({
      keyDef: d,
      releasePrevious: l,
      releaseSelf: c,
      repeat: u
    }), t = t.slice(s);
  } while (t);
  return r;
}
o(qI, "parseKeyDef");

// ../node_modules/@testing-library/user-event/dist/esm/keyboard/index.js
async function RI(e) {
  let t = qI(this.config.keyboardMap, e);
  for (let r = 0; r < t.length; r++)
    await Et(this.config), await Kre(this, t[r]);
}
o(RI, "keyboard");
async function Kre(e, { keyDef: t, releasePrevious: r, releaseSelf: n, repeat: i }) {
  let { system: a } = e;
  if (a.keyboard.isKeyPressed(t) && await a.keyboard.keyup(e, t), !r) {
    for (let s = 1; s <= i; s++)
      await a.keyboard.keydown(e, t), s < i && await Et(e.config);
    n && await a.keyboard.keyup(e, t);
  }
}
o(Kre, "keyboardAction");
async function TI(e) {
  for (let t of e.system.keyboard.getPressedKeys())
    await e.system.keyboard.keyup(e, t);
}
o(TI, "releaseAllKeys");

// ../node_modules/@testing-library/user-event/dist/esm/document/copySelection.js
function Yf(e) {
  let t = qe(e) ? {
    "text/plain": Yre(e)
  } : {
    "text/plain": String(e.ownerDocument.getSelection())
  }, r = En(ve(e));
  for (let n in t)
    t[n] && r.setData(n, t[n]);
  return r;
}
o(Yf, "copySelection");
function Yre(e) {
  let t = Mt(e);
  return Se(e).substring(t.startOffset, t.endOffset);
}
o(Yre, "readSelectedValueFromInput");

// ../node_modules/@testing-library/user-event/dist/esm/clipboard/copy.js
async function OI() {
  let e = this.config.document;
  var t;
  let r = (t = e.activeElement) !== null && t !== void 0 ? t : (
    /* istanbul ignore next */
    e.body
  ), n = Yf(r);
  if (n.items.length !== 0)
    return this.dispatchUIEvent(r, "copy", {
      clipboardData: n
    }) && this.config.writeToClipboard && await Sf(e, n), n;
}
o(OI, "copy");

// ../node_modules/@testing-library/user-event/dist/esm/clipboard/cut.js
async function SI() {
  let e = this.config.document;
  var t;
  let r = (t = e.activeElement) !== null && t !== void 0 ? t : (
    /* istanbul ignore next */
    e.body
  ), n = Yf(r);
  if (n.items.length !== 0)
    return this.dispatchUIEvent(r, "cut", {
      clipboardData: n
    }) && this.config.writeToClipboard && await Sf(r.ownerDocument, n), n;
}
o(SI, "cut");

// ../node_modules/@testing-library/user-event/dist/esm/clipboard/paste.js
async function MI(e) {
  let t = this.config.document;
  var r;
  let n = (r = t.activeElement) !== null && r !== void 0 ? r : (
    /* istanbul ignore next */
    t.body
  );
  var i;
  let a = (i = typeof e == "string" ? Xre(t, e) : e) !== null && i !== void 0 ? i : await mN(t).catch(() => {
    throw new Error("`userEvent.paste()` without `clipboardData` requires the `ClipboardAPI` to be available.");
  });
  this.dispatchUIEvent(n, "paste", {
    clipboardData: a
  });
}
o(MI, "paste");
function Xre(e, t) {
  let r = En(ve(e));
  return r.setData("text", t), r;
}
o(Xre, "getClipboardDataFromString");

// ../node_modules/@testing-library/user-event/dist/esm/pointer/parseKeyDef.js
function lg(e, t) {
  let r = [];
  do {
    let { descriptor: n, consumedLength: i, releasePrevious: a, releaseSelf: s = !0 } = Kf(t, "pointer"), l = e.find((c) => c.name === n);
    l && r.push({
      keyDef: l,
      releasePrevious: a,
      releaseSelf: s
    }), t = t.slice(i);
  } while (t);
  return r;
}
o(lg, "parseKeyDef");

// ../node_modules/@testing-library/user-event/dist/esm/pointer/index.js
async function NI(e) {
  let { pointerMap: t } = this.config, r = [];
  (Array.isArray(e) ? e : [
    e
  ]).forEach((n) => {
    typeof n == "string" ? r.push(...lg(t, n)) : "keys" in n ? r.push(...lg(t, n.keys).map((i) => ({
      ...n,
      ...i
    }))) : r.push(n);
  });
  for (let n = 0; n < r.length; n++)
    await Et(this.config), await Jre(this, r[n]);
  this.system.pointer.resetClickCount();
}
o(NI, "pointer");
async function Jre(e, t) {
  var r, n;
  let i = "pointerName" in t && t.pointerName ? t.pointerName : "keyDef" in t ? e.system.pointer.getPointerName(t.keyDef) : "mouse", a = e.system.
  pointer.getPreviousPosition(i);
  var s, l, c, u;
  let d = {
    target: (s = t.target) !== null && s !== void 0 ? s : Qre(e, a),
    coords: (l = t.coords) !== null && l !== void 0 ? l : a?.coords,
    caret: {
      node: (c = t.node) !== null && c !== void 0 ? c : AI(t) || a == null || (r = a.caret) === null || r === void 0 ? void 0 : r.node,
      offset: (u = t.offset) !== null && u !== void 0 ? u : AI(t) || a == null || (n = a.caret) === null || n === void 0 ? void 0 : n.offset
    }
  };
  "keyDef" in t ? (e.system.pointer.isKeyPressed(t.keyDef) && (Sr(e, $e.Trigger), await e.system.pointer.release(e, t.keyDef, d)), t.releasePrevious ||
  (Sr(e, $e.Trigger), await e.system.pointer.press(e, t.keyDef, d), t.releaseSelf && (Sr(e, $e.Trigger), await e.system.pointer.release(e, t.
  keyDef, d)))) : (Sr(e, $e.Trigger), await e.system.pointer.move(e, i, d));
}
o(Jre, "pointerAction");
function AI(e) {
  var t, r;
  return !!((r = (t = e.target) !== null && t !== void 0 ? t : e.node) !== null && r !== void 0 ? r : e.offset !== void 0);
}
o(AI, "hasCaretPosition");
function Qre(e, t) {
  if (!t)
    throw new Error("This pointer has no previous position. Provide a target property!");
  var r;
  return (r = t.target) !== null && r !== void 0 ? r : e.config.document.body;
}
o(Qre, "getPrevTarget");

// ../node_modules/@testing-library/user-event/dist/esm/utility/clear.js
async function II(e) {
  if (!mt(e) || Le(e))
    throw new Error("clear()` is only supported on editable elements.");
  if (Ve(e), e.ownerDocument.activeElement !== e)
    throw new Error("The element to be cleared could not be focused.");
  if (Ff(e), !VN(e))
    throw new Error("The element content to be cleared could not be selected.");
  yt(this, e, "", "deleteContentBackward");
}
o(II, "clear");

// ../node_modules/@testing-library/user-event/dist/esm/utility/selectOptions.js
async function jI(e, t) {
  return LI.call(this, !0, e, t);
}
o(jI, "selectOptions");
async function kI(e, t) {
  return LI.call(this, !1, e, t);
}
o(kI, "deselectOptions");
async function LI(e, t, r) {
  if (!e && !t.multiple)
    throw Z().getElementError("Unable to deselect an option in a non-multiple select. Use selectOptions to change the selection instead.", t);
  let n = Array.isArray(r) ? r : [
    r
  ], i = Array.from(t.querySelectorAll('option, [role="option"]')), a = n.map((l) => {
    if (typeof l != "string" && i.includes(l))
      return l;
    {
      let c = i.find((u) => u.value === l || u.innerHTML === l);
      if (c)
        return c;
      throw Z().getElementError(`Value "${String(l)}" not found in options`, t);
    }
  }).filter((l) => !Le(l));
  if (Le(t) || !a.length) return;
  let s = /* @__PURE__ */ o((l) => {
    l.selected = e, this.dispatchUIEvent(t, "input", {
      bubbles: !0,
      cancelable: !1,
      composed: !0
    }), this.dispatchUIEvent(t, "change");
  }, "selectOption");
  if (z(t, "select"))
    if (t.multiple)
      for (let l of a) {
        let c = this.config.pointerEventsCheck === 0 ? !0 : Rn(this, l);
        c && (this.dispatchUIEvent(l, "pointerover"), this.dispatchUIEvent(t, "pointerenter"), this.dispatchUIEvent(l, "mouseover"), this.dispatchUIEvent(
        t, "mouseenter"), this.dispatchUIEvent(l, "pointermove"), this.dispatchUIEvent(l, "mousemove"), this.dispatchUIEvent(l, "pointerdown"),
        this.dispatchUIEvent(l, "mousedown")), Ve(t), c && (this.dispatchUIEvent(l, "pointerup"), this.dispatchUIEvent(l, "mouseup")), s(l),
        c && this.dispatchUIEvent(l, "click"), await Et(this.config);
      }
    else if (a.length === 1) {
      let l = this.config.pointerEventsCheck === 0 ? !0 : Rn(this, t);
      l ? await this.click(t) : Ve(t), s(a[0]), l && (this.dispatchUIEvent(t, "pointerover"), this.dispatchUIEvent(t, "pointerenter"), this.
      dispatchUIEvent(t, "mouseover"), this.dispatchUIEvent(t, "mouseenter"), this.dispatchUIEvent(t, "pointerup"), this.dispatchUIEvent(t, "\
mouseup"), this.dispatchUIEvent(t, "click")), await Et(this.config);
    } else
      throw Z().getElementError("Cannot select multiple options on a non-multiple select", t);
  else if (t.getAttribute("role") === "listbox")
    for (let l of a)
      await this.click(l), await this.unhover(l);
  else
    throw Z().getElementError("Cannot select options on elements that are neither select nor listbox elements", t);
}
o(LI, "selectOptionsBase");

// ../node_modules/@testing-library/user-event/dist/esm/utility/type.js
async function $I(e, t, { skipClick: r = this.config.skipClick, skipAutoClose: n = this.config.skipAutoClose, initialSelectionStart: i, initialSelectionEnd: a } = {}) {
  e.disabled || (r || await this.click(e), i !== void 0 && Or(e, i, a ?? i), await this.keyboard(t), n || await TI(this));
}
o($I, "type");

// ../node_modules/@testing-library/user-event/dist/esm/utils/edit/setFiles.js
var BI = Symbol("files and value properties are mocked");
function ug(e, t, r) {
  r ? Object.defineProperty(e, t, r) : delete e[t];
}
o(ug, "restoreProperty");
function DI(e, t) {
  var r;
  (r = e[BI]) === null || r === void 0 || r.restore();
  let n = Object.getOwnPropertyDescriptor(e, "type"), i = Object.getOwnPropertyDescriptor(e, "value"), a = Object.getOwnPropertyDescriptor(e,
  "files");
  function s() {
    ug(e, "type", n), ug(e, "value", i), ug(e, "files", a);
  }
  o(s, "restore"), e[BI] = {
    restore: s
  }, Object.defineProperties(e, {
    files: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => t, "get")
    },
    value: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => t.length ? `C:\\fakepath\\${t[0].name}` : "", "get"),
      set(l) {
        if (l === "")
          s();
        else {
          var c;
          i == null || (c = i.set) === null || c === void 0 || c.call(e, l);
        }
      }
    },
    type: {
      configurable: !0,
      get: /* @__PURE__ */ o(() => "file", "get"),
      set(l) {
        l !== "file" && (s(), e.type = l);
      }
    }
  });
}
o(DI, "setFiles");

// ../node_modules/@testing-library/user-event/dist/esm/utility/upload.js
async function FI(e, t) {
  let r = z(e, "label") ? e.control : e;
  if (!r || !z(r, "input", {
    type: "file"
  }))
    throw new TypeError(`The ${r === e ? "given" : "associated"} ${r?.tagName} element does not accept file uploads`);
  if (Le(e)) return;
  let n = (Array.isArray(t) ? t : [
    t
  ]).filter((a) => !this.config.applyAccept || Zre(a, r.accept)).slice(0, r.multiple ? void 0 : 1), i = /* @__PURE__ */ o(() => {
    var a;
    n.length === ((a = r.files) === null || a === void 0 ? void 0 : a.length) && n.every((s, l) => {
      var c;
      return s === ((c = r.files) === null || c === void 0 ? void 0 : c.item(l));
    }) || (DI(r, Io(ve(e), n)), this.dispatchUIEvent(r, "input"), this.dispatchUIEvent(r, "change"));
  }, "fileDialog");
  r.addEventListener("fileDialog", i), await this.click(e), r.removeEventListener("fileDialog", i);
}
o(FI, "upload");
function Xf(e) {
  return e.toLowerCase().replace(/(\.|\/)jpg\b/g, "$1jpeg");
}
o(Xf, "normalize");
function Zre(e, t) {
  if (!t)
    return !0;
  let r = [
    "audio/*",
    "image/*",
    "video/*"
  ];
  return Xf(t).trim().split(/\s*,\s*/).some((n) => n.startsWith(".") ? Xf(e.name).endsWith(n) : r.includes(n) ? Xf(e.type).startsWith(n.replace(
  "*", "")) : Xf(e.type) === n);
}
o(Zre, "isAcceptableFile");

// ../node_modules/@testing-library/user-event/dist/esm/setup/api.js
var cg = {
  click: gI,
  dblClick: vI,
  tripleClick: wI,
  hover: EI,
  unhover: CI,
  tab: xI,
  keyboard: RI,
  copy: OI,
  cut: SI,
  paste: MI,
  pointer: NI,
  clear: II,
  deselectOptions: kI,
  selectOptions: jI,
  type: $I,
  upload: FI
};

// ../node_modules/@testing-library/user-event/dist/esm/setup/wrapAsync.js
function UI(e) {
  return Z().asyncWrapper(e);
}
o(UI, "wrapAsync");

// ../node_modules/@testing-library/user-event/dist/esm/setup/setup.js
var HI = {
  applyAccept: !0,
  autoModify: !0,
  delay: 0,
  document: globalThis.document,
  keyboardMap: sI,
  pointerMap: lI,
  pointerEventsCheck: Mr.EachApiCall,
  skipAutoClose: !1,
  skipClick: !1,
  skipHover: !1,
  writeToClipboard: !1,
  advanceTimers: /* @__PURE__ */ o(() => Promise.resolve(), "advanceTimers")
}, ene = {
  ...HI,
  writeToClipboard: !0
};
function VI(e = {}, t = ene, r) {
  let n = nne(e, r, t);
  return {
    ...t,
    ...e,
    document: n
  };
}
o(VI, "createConfig");
function zI(e = {}) {
  let t = VI(e);
  Qy(t.document), Xy(ve(t.document).HTMLElement);
  var r;
  let n = (r = t.document.defaultView) !== null && r !== void 0 ? r : (
    /* istanbul ignore next */
    globalThis.window
  );
  return pN(n), dg(t).api;
}
o(zI, "setupMain");
function Ie({ keyboardState: e, pointerState: t, ...r } = {}, n) {
  let i = VI(r, HI, n);
  Qy(i.document), Xy(ve(i.document).HTMLElement);
  var a;
  let s = (a = t ?? e) !== null && a !== void 0 ? a : new Vo();
  return {
    api: dg(i, s).api,
    system: s
  };
}
o(Ie, "setupDirect");
function tne(e) {
  return dg({
    ...this.config,
    ...e
  }, this.system).api;
}
o(tne, "setupSub");
function rne(e, t) {
  function r(...n) {
    return Sr(e, $e.Call), UI(() => t.apply(e, n).then(async (i) => (await Et(e.config), i)));
  }
  return o(r, "method"), Object.defineProperty(r, "name", {
    get: /* @__PURE__ */ o(() => t.name, "get")
  }), r;
}
o(rne, "wrapAndBindImpl");
function dg(e, t = new Vo()) {
  let r = {};
  return Object.assign(r, {
    config: e,
    dispatchEvent: Yy.bind(r),
    dispatchUIEvent: JN.bind(r),
    system: t,
    levelRefs: {},
    ...cg
  }), {
    instance: r,
    api: {
      ...Object.fromEntries(Object.entries(cg).map(([n, i]) => [
        n,
        rne(r, i)
      ])),
      setup: tne.bind(r)
    }
  };
}
o(dg, "createInstance");
function nne(e, t, r) {
  var n, i;
  return (i = (n = e.document) !== null && n !== void 0 ? n : t && oI(t)) !== null && i !== void 0 ? i : r.document;
}
o(nne, "getDocument");

// ../node_modules/@testing-library/user-event/dist/esm/setup/directApi.js
var fg = {};
Wo(fg, {
  clear: () => one,
  click: () => ine,
  copy: () => ane,
  cut: () => sne,
  dblClick: () => lne,
  deselectOptions: () => une,
  hover: () => cne,
  keyboard: () => dne,
  paste: () => pne,
  pointer: () => fne,
  selectOptions: () => mne,
  tab: () => vne,
  tripleClick: () => hne,
  type: () => bne,
  unhover: () => yne,
  upload: () => gne
});
function one(e) {
  return Ie().api.clear(e);
}
o(one, "clear");
function ine(e, t = {}) {
  return Ie(t, e).api.click(e);
}
o(ine, "click");
function ane(e = {}) {
  return Ie(e).api.copy();
}
o(ane, "copy");
function sne(e = {}) {
  return Ie(e).api.cut();
}
o(sne, "cut");
function lne(e, t = {}) {
  return Ie(t).api.dblClick(e);
}
o(lne, "dblClick");
function une(e, t, r = {}) {
  return Ie(r).api.deselectOptions(e, t);
}
o(une, "deselectOptions");
function cne(e, t = {}) {
  return Ie(t).api.hover(e);
}
o(cne, "hover");
async function dne(e, t = {}) {
  let { api: r, system: n } = Ie(t);
  return r.keyboard(e).then(() => n);
}
o(dne, "keyboard");
async function fne(e, t = {}) {
  let { api: r, system: n } = Ie(t);
  return r.pointer(e).then(() => n);
}
o(fne, "pointer");
function pne(e, t) {
  return Ie(t).api.paste(e);
}
o(pne, "paste");
function mne(e, t, r = {}) {
  return Ie(r).api.selectOptions(e, t);
}
o(mne, "selectOptions");
function hne(e, t = {}) {
  return Ie(t).api.tripleClick(e);
}
o(hne, "tripleClick");
function bne(e, t, r = {}) {
  return Ie(r, e).api.type(e, t, r);
}
o(bne, "type");
function yne(e, t = {}) {
  let { api: r, system: n } = Ie(t);
  return n.pointer.setMousePosition({
    target: e
  }), r.unhover(e);
}
o(yne, "unhover");
function gne(e, t, r = {}) {
  return Ie(r).api.upload(e, t);
}
o(gne, "upload");
function vne(e = {}) {
  return Ie().api.tab(e);
}
o(vne, "tab");

// ../node_modules/@testing-library/user-event/dist/esm/setup/index.js
var zo = {
  ...fg,
  setup: zI
};

// src/test/testing-library.ts
import { once as Cne } from "storybook/internal/client-logger";
import { instrument as GI } from "storybook/internal/instrumenter";

// ../node_modules/ts-dedent/esm/index.js
function Ene(e) {
  for (var t = [], r = 1; r < arguments.length; r++)
    t[r - 1] = arguments[r];
  var n = Array.from(typeof e == "string" ? [e] : e);
  n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var i = n.reduce(function(l, c) {
    var u = c.match(/\n([\t ]+|(?!\s).)/g);
    return u ? l.concat(u.map(function(d) {
      var f, h;
      return (h = (f = d.match(/[\t ]/g)) === null || f === void 0 ? void 0 : f.length) !== null && h !== void 0 ? h : 0;
    })) : l;
  }, []);
  if (i.length) {
    var a = new RegExp(`
[	 ]{` + Math.min.apply(Math, i) + "}", "g");
    n = n.map(function(l) {
      return l.replace(a, `
`);
    });
  }
  n[0] = n[0].replace(/^\r?\n/, "");
  var s = n[0];
  return t.forEach(function(l, c) {
    var u = s.match(/(?:^|\n)( *)$/), d = u ? u[1] : "", f = l;
    typeof l == "string" && l.includes(`
`) && (f = String(l).split(`
`).map(function(h, m) {
      return m === 0 ? h : "" + d + h;
    }).join(`
`)), s += f + n[c + 1];
  }), s;
}
o(Ene, "dedent");
var WI = Ene;

// src/test/testing-library.ts
var pg = GI(
  { ...ky },
  {
    getKeys: /* @__PURE__ */ o((e) => Object.keys(e).filter((t) => t !== "eventWrapper"), "getKeys"),
    intercept: /* @__PURE__ */ o((e, t) => t[0] === "fireEvent" || e.startsWith("find") || e.startsWith("waitFor"), "intercept")
  }
);
pg.screen = new Proxy(pg.screen, {
  get(e, t, r) {
    return Cne.warn(WI`
          You are using Testing Library's \`screen\` object. Use \`within(canvasElement)\` instead.
          More info: https://storybook.js.org/docs/writing-tests/interaction-testing?ref=error
        `), Reflect.get(e, t, r);
  }
});
var {
  buildQueries: ARe,
  configure: NRe,
  createEvent: IRe,
  fireEvent: jRe,
  findAllByAltText: kRe,
  findAllByDisplayValue: LRe,
  findAllByLabelText: $Re,
  findAllByPlaceholderText: BRe,
  findAllByRole: DRe,
  findAllByTestId: FRe,
  findAllByText: URe,
  findAllByTitle: HRe,
  findByAltText: VRe,
  findByDisplayValue: zRe,
  findByLabelText: WRe,
  findByPlaceholderText: GRe,
  findByRole: KRe,
  findByTestId: YRe,
  findByText: XRe,
  findByTitle: JRe,
  getAllByAltText: QRe,
  getAllByDisplayValue: ZRe,
  getAllByLabelText: eTe,
  getAllByPlaceholderText: tTe,
  getAllByRole: rTe,
  getAllByTestId: nTe,
  getAllByText: oTe,
  getAllByTitle: iTe,
  getByAltText: aTe,
  getByDisplayValue: sTe,
  getByLabelText: lTe,
  getByPlaceholderText: uTe,
  getByRole: cTe,
  getByTestId: dTe,
  getByText: fTe,
  getByTitle: pTe,
  getConfig: mTe,
  getDefaultNormalizer: hTe,
  getElementError: bTe,
  getNodeText: yTe,
  getQueriesForElement: gTe,
  getRoles: vTe,
  getSuggestedQuery: wTe,
  isInaccessible: ETe,
  logDOM: CTe,
  logRoles: xTe,
  prettyDOM: _Te,
  queries: PTe,
  queryAllByAltText: qTe,
  queryAllByAttribute: RTe,
  queryAllByDisplayValue: TTe,
  queryAllByLabelText: OTe,
  queryAllByPlaceholderText: STe,
  queryAllByRole: MTe,
  queryAllByTestId: ATe,
  queryAllByText: NTe,
  queryAllByTitle: ITe,
  queryByAltText: jTe,
  queryByAttribute: kTe,
  queryByDisplayValue: LTe,
  queryByLabelText: $Te,
  queryByPlaceholderText: BTe,
  queryByRole: DTe,
  queryByTestId: FTe,
  queryByText: UTe,
  queryByTitle: HTe,
  queryHelpers: VTe,
  screen: zTe,
  waitFor: WTe,
  waitForElementToBeRemoved: GTe,
  within: KTe,
  prettyFormat: YTe
} = pg, XTe = zo, { userEvent: JTe } = GI(
  { userEvent: zo },
  { intercept: !0, getKeys: /* @__PURE__ */ o((e) => Object.keys(e).filter((t) => t !== "eventWrapper"), "getKeys") }
);

// src/test/index.ts
var { expect: nOe } = xne(
  { expect: $b },
  {
    getKeys: /* @__PURE__ */ o((e, t) => {
      if ("constructor" in e && e.constructor === w) {
        let r = ["assert", "__methods", "__flags", "_obj"], n = Object.keys(Object.getPrototypeOf(e)).filter(
          (i) => !r.includes(i)
        );
        return t > 2 ? n : [...n, "not"];
      }
      return "any" in e ? Object.keys(e).filter((r) => r !== "any") : Object.keys(e);
    }, "getKeys"),
    mutate: !0,
    intercept: /* @__PURE__ */ o((e) => e !== "expect", "intercept")
  }
), oOe = {
  mock: /* @__PURE__ */ o(() => {
  }, "mock")
};
export {
  ARe as buildQueries,
  ube as clearAllMocks,
  NRe as configure,
  IRe as createEvent,
  nOe as expect,
  kRe as findAllByAltText,
  LRe as findAllByDisplayValue,
  $Re as findAllByLabelText,
  BRe as findAllByPlaceholderText,
  DRe as findAllByRole,
  FRe as findAllByTestId,
  URe as findAllByText,
  HRe as findAllByTitle,
  VRe as findByAltText,
  zRe as findByDisplayValue,
  WRe as findByLabelText,
  GRe as findByPlaceholderText,
  KRe as findByRole,
  YRe as findByTestId,
  XRe as findByText,
  JRe as findByTitle,
  jRe as fireEvent,
  lbe as fn,
  QRe as getAllByAltText,
  ZRe as getAllByDisplayValue,
  eTe as getAllByLabelText,
  tTe as getAllByPlaceholderText,
  rTe as getAllByRole,
  nTe as getAllByTestId,
  oTe as getAllByText,
  iTe as getAllByTitle,
  aTe as getByAltText,
  sTe as getByDisplayValue,
  lTe as getByLabelText,
  uTe as getByPlaceholderText,
  cTe as getByRole,
  dTe as getByTestId,
  fTe as getByText,
  pTe as getByTitle,
  mTe as getConfig,
  hTe as getDefaultNormalizer,
  bTe as getElementError,
  yTe as getNodeText,
  gTe as getQueriesForElement,
  vTe as getRoles,
  wTe as getSuggestedQuery,
  ETe as isInaccessible,
  cn as isMockFunction,
  CTe as logDOM,
  xTe as logRoles,
  fbe as mocked,
  uo as mocks,
  abe as onMockCall,
  _Te as prettyDOM,
  YTe as prettyFormat,
  PTe as queries,
  qTe as queryAllByAltText,
  RTe as queryAllByAttribute,
  TTe as queryAllByDisplayValue,
  OTe as queryAllByLabelText,
  STe as queryAllByPlaceholderText,
  MTe as queryAllByRole,
  ATe as queryAllByTestId,
  NTe as queryAllByText,
  ITe as queryAllByTitle,
  jTe as queryByAltText,
  kTe as queryByAttribute,
  LTe as queryByDisplayValue,
  $Te as queryByLabelText,
  BTe as queryByPlaceholderText,
  DTe as queryByRole,
  FTe as queryByTestId,
  UTe as queryByText,
  HTe as queryByTitle,
  VTe as queryHelpers,
  cbe as resetAllMocks,
  dbe as restoreAllMocks,
  oOe as sb,
  zTe as screen,
  sbe as spyOn,
  XTe as uninstrumentedUserEvent,
  JTe as userEvent,
  WTe as waitFor,
  GTe as waitForElementToBeRemoved,
  KTe as within
};
