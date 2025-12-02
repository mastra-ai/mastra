"use strict";
var Ge = Object.create;
var V = Object.defineProperty;
var ze = Object.getOwnPropertyDescriptor;
var Xe = Object.getOwnPropertyNames;
var Ke = Object.getPrototypeOf, Je = Object.prototype.hasOwnProperty;
var f = (s, e) => V(s, "name", { value: e, configurable: !0 });
var Qe = (s, e) => () => (e || s((e = { exports: {} }).exports, e), e.exports), He = (s, e) => {
  for (var r in e)
    V(s, r, { get: e[r], enumerable: !0 });
}, fe = (s, e, r, t) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let i of Xe(e))
      !Je.call(s, i) && i !== r && V(s, i, { get: () => e[i], enumerable: !(t = ze(e, i)) || t.enumerable });
  return s;
};
var z = (s, e, r) => (r = s != null ? Ge(Ke(s)) : {}, fe(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !s || !s.__esModule ? V(r, "default", { value: s, enumerable: !0 }) : r,
  s
)), Ye = (s) => fe(V({}, "__esModule", { value: !0 }), s);

// ../node_modules/ts-dedent/dist/index.js
var $ = Qe((A) => {
  "use strict";
  Object.defineProperty(A, "__esModule", { value: !0 });
  A.dedent = void 0;
  function de(s) {
    for (var e = [], r = 1; r < arguments.length; r++)
      e[r - 1] = arguments[r];
    var t = Array.from(typeof s == "string" ? [s] : s);
    t[t.length - 1] = t[t.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var i = t.reduce(function(c, p) {
      var d = p.match(/\n([\t ]+|(?!\s).)/g);
      return d ? c.concat(d.map(function(u) {
        var x, E;
        return (E = (x = u.match(/[\t ]/g)) === null || x === void 0 ? void 0 : x.length) !== null && E !== void 0 ? E : 0;
      })) : c;
    }, []);
    if (i.length) {
      var a = new RegExp(`
[	 ]{` + Math.min.apply(Math, i) + "}", "g");
      t = t.map(function(c) {
        return c.replace(a, `
`);
      });
    }
    t[0] = t[0].replace(/^\r?\n/, "");
    var o = t[0];
    return e.forEach(function(c, p) {
      var d = o.match(/(?:^|\n)( *)$/), u = d ? d[1] : "", x = c;
      typeof c == "string" && c.includes(`
`) && (x = String(c).split(`
`).map(function(E, b) {
        return b === 0 ? E : "" + u + E;
      }).join(`
`)), o += x + t[p + 1];
    }), o;
  }
  f(de, "dedent");
  A.dedent = de;
  A.default = de;
});

// src/csf-tools/index.ts
var dt = {};
He(dt, {
  BadMetaError: () => M,
  ConfigFile: () => ee,
  CsfFile: () => K,
  MixedFactoryError: () => L,
  MultipleMetaError: () => X,
  NoMetaError: () => R,
  babelParse: () => $e.babelParse,
  babelParseFile: () => be,
  enrichCsf: () => pt,
  enrichCsfMeta: () => Ce,
  enrichCsfStory: () => we,
  extractDescription: () => ae,
  extractSource: () => Te,
  formatConfig: () => Oe,
  formatCsf: () => ie,
  getStorySortParameter: () => ct,
  isCsfFactoryPreview: () => lt,
  isModuleMock: () => ye,
  isValidPreviewPath: () => xe,
  loadConfig: () => Se,
  loadCsf: () => Q,
  printConfig: () => Pe,
  printCsf: () => Ee,
  readConfig: () => ot,
  readCsf: () => st,
  vitestTransform: () => Ae,
  writeConfig: () => at,
  writeCsf: () => nt
});
module.exports = Ye(dt);

// src/csf-tools/CsfFile.ts
var J = require("node:fs/promises"), l = require("storybook/internal/babel"), v = require("storybook/internal/csf"), re = require("storybook/internal/node-logger"),
P = z($(), 1);

// src/csf-tools/findVarInitialization.ts
var N = require("storybook/internal/babel");
var O = /* @__PURE__ */ f((s, e) => {
  let r = null, t = null;
  return e.body.find((i) => (N.types.isVariableDeclaration(i) ? t = i.declarations : N.types.isExportNamedDeclaration(i) && N.types.isVariableDeclaration(
  i.declaration) && (t = i.declaration.declarations), t && t.find((a) => N.types.isVariableDeclarator(a) && N.types.isIdentifier(a.id) && a.
  id.name === s ? (r = a.init, !0) : !1))), r;
}, "findVarInitialization");

// src/csf-tools/CsfFile.ts
var Ze = /\/preview(.(js|jsx|mjs|ts|tsx))?$/, xe = /* @__PURE__ */ f((s) => Ze.test(s), "isValidPreviewPath");
function et(s) {
  if (l.types.isArrayExpression(s))
    return s.elements.map((e) => {
      if (l.types.isStringLiteral(e))
        return e.value;
      throw new Error(`Expected string literal: ${e}`);
    });
  if (l.types.isStringLiteral(s))
    return new RegExp(s.value);
  if (l.types.isRegExpLiteral(s))
    return new RegExp(s.pattern, s.flags);
  throw new Error(`Unknown include/exclude: ${s}`);
}
f(et, "parseIncludeExclude");
function me(s) {
  if (!l.types.isArrayExpression(s))
    throw new Error("CSF: Expected tags array");
  return s.elements.map((e) => {
    if (l.types.isStringLiteral(e))
      return e.value;
    throw new Error("CSF: Expected tag to be string literal");
  });
}
f(me, "parseTags");
var D = /* @__PURE__ */ f((s, e) => {
  let r = "";
  if (s.loc) {
    let { line: t, column: i } = s.loc?.start || {};
    r = `(line ${t}, col ${i})`;
  }
  return `${e || ""} ${r}`.trim();
}, "formatLocation"), ye = /* @__PURE__ */ f((s) => it.test(s), "isModuleMock"), ue = /* @__PURE__ */ f((s, e, r) => {
  let t = s;
  if (l.types.isCallExpression(s)) {
    let { callee: i, arguments: a } = s;
    if (l.types.isProgram(e) && l.types.isMemberExpression(i) && l.types.isIdentifier(i.object) && l.types.isIdentifier(i.property) && i.property.
    name === "bind" && (a.length === 0 || a.length === 1 && l.types.isObjectExpression(a[0]) && a[0].properties.length === 0)) {
      let o = i.object.name, c = O(o, e);
      c && (r._templates[o] = c, t = c);
    }
  }
  return l.types.isArrowFunctionExpression(t) || l.types.isFunctionDeclaration(t) ? t.params.length > 0 : !1;
}, "isArgsStory"), tt = /* @__PURE__ */ f((s) => {
  if (l.types.isArrayExpression(s))
    return s.elements.map((e) => {
      if (l.types.isStringLiteral(e))
        return e.value;
      throw new Error(`Expected string literal named export: ${e}`);
    });
  throw new Error(`Expected array of string literals: ${s}`);
}, "parseExportsOrder"), ge = /* @__PURE__ */ f((s, e) => e.reduce(
  (r, t) => {
    let i = s[t];
    return i && (r[t] = i), r;
  },
  {}
), "sortExports"), rt = /* @__PURE__ */ f((s) => {
  if (l.types.isArrowFunctionExpression(s) || l.types.isFunctionDeclaration(s)) {
    let e = s.params;
    if (e.length >= 1) {
      let [r] = e;
      if (l.types.isObjectPattern(r))
        return !!r.properties.find((t) => {
          if (l.types.isObjectProperty(t) && l.types.isIdentifier(t.key))
            return t.key.name === "mount";
        });
    }
  }
  return !1;
}, "hasMount"), it = /^[.\/#].*\.mock($|\.[^.]*$)/i, R = class extends Error {
  static {
    f(this, "NoMetaError");
  }
  constructor(e, r, t) {
    let i = e.trim();
    super(P.dedent`
      CSF: ${i} ${D(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, X = class extends Error {
  static {
    f(this, "MultipleMetaError");
  }
  constructor(e, r, t) {
    let i = `${e} ${D(r, t)}`.trim();
    super(P.dedent`
      CSF: ${e} ${D(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, L = class extends Error {
  static {
    f(this, "MixedFactoryError");
  }
  constructor(e, r, t) {
    let i = `${e} ${D(r, t)}`.trim();
    super(P.dedent`
      CSF: ${e} ${D(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, M = class extends Error {
  static {
    f(this, "BadMetaError");
  }
  constructor(e, r, t) {
    let i = "".trim();
    super(P.dedent`
      CSF: ${e} ${D(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, K = class {
  constructor(e, r, t) {
    this._stories = {};
    this._metaAnnotations = {};
    this._storyExports = {};
    this._storyPaths = {};
    this._storyStatements = {};
    this._storyAnnotations = {};
    this._templates = {};
    this._ast = e, this._file = t, this._options = r, this.imports = [];
  }
  static {
    f(this, "CsfFile");
  }
  _parseTitle(e) {
    let r = l.types.isIdentifier(e) ? O(e.name, this._ast.program) : e;
    if (l.types.isStringLiteral(r))
      return r.value;
    if (l.types.isTSSatisfiesExpression(r) && l.types.isStringLiteral(r.expression))
      return r.expression.value;
    throw new Error(P.dedent`
      CSF: unexpected dynamic title ${D(r, this._options.fileName)}

      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#string-literal-titles
    `);
  }
  _parseMeta(e, r) {
    if (this._metaNode)
      throw new X("multiple meta objects", e, this._options.fileName);
    this._metaNode = e;
    let t = {};
    e.properties.forEach((i) => {
      if (l.types.isIdentifier(i.key)) {
        if (this._metaAnnotations[i.key.name] = i.value, i.key.name === "title")
          t.title = this._parseTitle(i.value);
        else if (["includeStories", "excludeStories"].includes(i.key.name))
          t[i.key.name] = et(i.value);
        else if (i.key.name === "component") {
          let a = i.value;
          if (l.types.isIdentifier(a)) {
            let c = a.name, p = r.body.find(
              (d) => l.types.isImportDeclaration(d) && d.specifiers.find((u) => u.local.name === c)
            );
            if (p) {
              let { source: d } = p;
              l.types.isStringLiteral(d) && (this._rawComponentPath = d.value);
            }
          }
          let { code: o } = l.recast.print(i.value, {});
          t.component = o;
        } else if (i.key.name === "tags") {
          let a = i.value;
          l.types.isIdentifier(a) && (a = O(a.name, this._ast.program)), t.tags = me(a);
        } else if (i.key.name === "id")
          if (l.types.isStringLiteral(i.value))
            t.id = i.value.value;
          else
            throw new Error(`Unexpected component id: ${i.value}`);
      }
    }), this._meta = t;
  }
  getStoryExport(e) {
    let r = this._storyExports[e];
    if (r = l.types.isVariableDeclarator(r) ? r.init : r, l.types.isCallExpression(r)) {
      let { callee: t, arguments: i } = r;
      if (l.types.isMemberExpression(t) && l.types.isIdentifier(t.object) && l.types.isIdentifier(t.property) && t.property.name === "bind" &&
      (i.length === 0 || i.length === 1 && l.types.isObjectExpression(i[0]) && i[0].properties.length === 0)) {
        let { name: a } = t.object;
        r = this._templates[a];
      }
    }
    return r;
  }
  parse() {
    let e = this;
    if ((0, l.traverse)(this._ast, {
      ExportDefaultDeclaration: {
        enter(t) {
          let { node: i, parent: a } = t, o = l.types.isIdentifier(i.declaration) && l.types.isProgram(a);
          if (e._options.transformInlineMeta && !o && l.types.isExpression(i.declaration)) {
            let d = t.scope.generateUidIdentifier("meta");
            e._metaVariableName = d.name;
            let u = [
              l.types.variableDeclaration("const", [l.types.variableDeclarator(d, i.declaration)]),
              l.types.exportDefaultDeclaration(d)
            ];
            u.forEach((x) => x.loc = t.node.loc), t.replaceWithMultiple(u);
            return;
          }
          let c, p;
          if (o) {
            let d = i.declaration.name;
            e._metaVariableName = d;
            let u = /* @__PURE__ */ f((x) => l.types.isIdentifier(x.id) && x.id.name === d, "isVariableDeclarator");
            e._metaStatement = e._ast.program.body.find(
              (x) => l.types.isVariableDeclaration(x) && x.declarations.find(u)
            ), p = (e?._metaStatement?.declarations || []).find(
              u
            )?.init;
          } else
            e._metaStatement = i, p = i.declaration;
          if (l.types.isObjectExpression(p) ? c = p : /* export default { ... } as Meta<...> */ /* export default { ... } satisfies Meta<...> */ (l.types.
          isTSAsExpression(p) || l.types.isTSSatisfiesExpression(p)) && l.types.isObjectExpression(p.expression) ? c = p.expression : (
            // export default { ... } satisfies Meta as Meta<...>
            l.types.isTSAsExpression(p) && l.types.isTSSatisfiesExpression(p.expression) && l.types.isObjectExpression(p.expression.expression) &&
            (c = p.expression.expression)
          ), c && l.types.isProgram(a) && e._parseMeta(c, a), e._metaStatement && !e._metaNode)
            throw new R(
              "default export must be an object",
              e._metaStatement,
              e._options.fileName
            );
          e._metaPath = t;
        }
      },
      ExportNamedDeclaration: {
        enter(t) {
          let { node: i, parent: a } = t, o;
          l.types.isVariableDeclaration(i.declaration) ? o = i.declaration.declarations.filter((c) => l.types.isVariableDeclarator(c)) : l.types.
          isFunctionDeclaration(i.declaration) && (o = [i.declaration]), o ? o.forEach((c) => {
            if (l.types.isIdentifier(c.id)) {
              let p = !1, { name: d } = c.id;
              if (d === "__namedExportsOrder" && l.types.isVariableDeclarator(c)) {
                e._namedExportsOrder = tt(c.init);
                return;
              }
              e._storyExports[d] = c, e._storyPaths[d] = t, e._storyStatements[d] = i;
              let u = (0, v.storyNameFromExport)(d);
              e._storyAnnotations[d] ? re.logger.warn(
                `Unexpected annotations for "${d}" before story declaration`
              ) : e._storyAnnotations[d] = {};
              let x;
              if (l.types.isVariableDeclarator(c) ? l.types.isTSAsExpression(c.init) && l.types.isTSSatisfiesExpression(c.init.expression) ?
              x = c.init.expression.expression : l.types.isTSAsExpression(c.init) || l.types.isTSSatisfiesExpression(c.init) ? x = c.init.expression :
              x = c.init : x = c, l.types.isCallExpression(x) && l.types.isMemberExpression(x.callee) && l.types.isIdentifier(x.callee.property) &&
              (x.callee.property.name === "story" || x.callee.property.name === "extend") && (p = !0, x = x.arguments[0]), e._metaIsFactory &&
              !p)
                throw new L(
                  "expected factory story",
                  x,
                  e._options.fileName
                );
              if (!e._metaIsFactory && p)
                throw e._metaNode ? new L(
                  "expected non-factory story",
                  x,
                  e._options.fileName
                ) : new M(
                  "meta() factory must be imported from .storybook/preview configuration",
                  x,
                  e._options.fileName
                );
              let E = {};
              l.types.isObjectExpression(x) ? (E.__isArgsStory = !0, x.properties.forEach((b) => {
                if (l.types.isIdentifier(b.key)) {
                  if (b.key.name === "render")
                    E.__isArgsStory = ue(
                      b.value,
                      a,
                      e
                    );
                  else if (b.key.name === "name" && l.types.isStringLiteral(b.value))
                    u = b.value.value;
                  else if (b.key.name === "storyName" && l.types.isStringLiteral(b.value))
                    re.logger.warn(
                      `Unexpected usage of "storyName" in "${d}". Please use "name" instead.`
                    );
                  else if (b.key.name === "parameters" && l.types.isObjectExpression(b.value)) {
                    let _ = b.value.properties.find(
                      (W) => l.types.isObjectProperty(W) && l.types.isIdentifier(W.key) && W.key.name === "__id"
                    );
                    _ && (E.__id = _.value.value);
                  }
                  e._storyAnnotations[d][b.key.name] = b.value;
                }
              })) : E.__isArgsStory = ue(x, a, e), e._stories[d] = {
                id: "FIXME",
                name: u,
                parameters: E,
                __stats: {
                  factory: p
                }
              };
            }
          }) : i.specifiers.length > 0 && i.specifiers.forEach((c) => {
            if (l.types.isExportSpecifier(c) && l.types.isIdentifier(c.exported)) {
              let { name: p } = c.exported, { name: d } = c.local, u = l.types.isProgram(a) ? O(d, a) : c.local;
              if (p === "default") {
                let x;
                l.types.isObjectExpression(u) ? x = u : /* export default { ... } as Meta<...> */ /* export default { ... } satisfies Meta<...> */ (l.types.
                isTSAsExpression(u) || l.types.isTSSatisfiesExpression(u)) && l.types.isObjectExpression(u.expression) ? x = u.expression : (
                  // export default { ... } satisfies Meta as Meta<...>
                  l.types.isTSAsExpression(u) && l.types.isTSSatisfiesExpression(u.expression) && l.types.isObjectExpression(u.expression.expression) &&
                  (x = u.expression.expression)
                ), x && l.types.isProgram(a) && e._parseMeta(x, a);
              } else {
                let x = {}, E = u;
                l.types.isObjectExpression(E) && E.properties.forEach((b) => {
                  l.types.isIdentifier(b.key) && (x[b.key.name] = b.value);
                }), e._storyAnnotations[p] = x, e._storyStatements[p] = u, e._storyPaths[p] = t, e._stories[p] = {
                  id: "FIXME",
                  name: p,
                  localName: d,
                  parameters: {},
                  __stats: {}
                };
              }
            }
          });
        }
      },
      ExpressionStatement: {
        enter({ node: t, parent: i }) {
          let { expression: a } = t;
          if (l.types.isProgram(i) && l.types.isAssignmentExpression(a) && l.types.isMemberExpression(a.left) && l.types.isIdentifier(a.left.
          object) && l.types.isIdentifier(a.left.property)) {
            let o = a.left.object.name, c = a.left.property.name, p = a.right;
            if (e._storyAnnotations[o] && (c === "story" && l.types.isObjectExpression(p) ? p.properties.forEach((d) => {
              l.types.isIdentifier(d.key) && (e._storyAnnotations[o][d.key.name] = d.value);
            }) : e._storyAnnotations[o][c] = p), c === "storyName" && l.types.isStringLiteral(p)) {
              let d = p.value, u = e._stories[o];
              if (!u)
                return;
              u.name = d;
            }
          }
        }
      },
      CallExpression: {
        enter(t) {
          let { node: i } = t, { callee: a } = i;
          if (l.types.isIdentifier(a) && a.name === "storiesOf")
            throw new Error(P.dedent`
              Unexpected \`storiesOf\` usage: ${D(i, e._options.fileName)}.

              SB8 does not support \`storiesOf\`.
            `);
          if (l.types.isMemberExpression(a) && l.types.isIdentifier(a.property) && a.property.name === "meta" && l.types.isIdentifier(a.object) &&
          i.arguments.length > 0) {
            let c = t.scope.getBinding(a.object.name)?.path?.parentPath?.node;
            if (l.types.isImportDeclaration(c))
              if (xe(c.source.value)) {
                let p = i.arguments[0];
                e._metaVariableName = a.property.name, e._metaIsFactory = !0, e._parseMeta(p, e._ast.program);
              } else
                throw new M(
                  "meta() factory must be imported from .storybook/preview configuration",
                  c,
                  e._options.fileName
                );
          }
        }
      },
      ImportDeclaration: {
        enter({ node: t }) {
          let { source: i } = t;
          if (l.types.isStringLiteral(i))
            e.imports.push(i.value);
          else
            throw new Error("CSF: unexpected import source");
        }
      }
    }), !e._meta)
      throw new R("missing default export", e._ast, e._options.fileName);
    let r = Object.entries(e._stories);
    if (e._meta.title = this._options.makeTitle(e._meta?.title), e._metaAnnotations.play && (e._meta.tags = [...e._meta.tags || [], "play-fn"]),
    e._stories = r.reduce(
      (t, [i, a]) => {
        if (!(0, v.isExportStory)(i, e._meta))
          return t;
        let o = a.parameters?.__id ?? (0, v.toId)(e._meta?.id || e._meta?.title, (0, v.storyNameFromExport)(i)), c = { ...a.parameters, __id: o },
        { includeStories: p } = e._meta || {};
        i === "__page" && (r.length === 1 || Array.isArray(p) && p.length === 1) && (c.docsOnly = !0), t[i] = { ...a, id: o, parameters: c };
        let d = e._storyAnnotations[i], { tags: u, play: x } = d;
        if (u) {
          let _ = l.types.isIdentifier(u) ? O(u.name, this._ast.program) : u;
          t[i].tags = me(_);
        }
        x && (t[i].tags = [...t[i].tags || [], "play-fn"]);
        let E = t[i].__stats;
        ["play", "render", "loaders", "beforeEach", "globals", "tags"].forEach((_) => {
          E[_] = !!d[_] || !!e._metaAnnotations[_];
        });
        let b = e.getStoryExport(i);
        return E.storyFn = !!(l.types.isArrowFunctionExpression(b) || l.types.isFunctionDeclaration(b)), E.mount = rt(d.play ?? e._metaAnnotations.
        play), E.moduleMock = !!e.imports.find((_) => ye(_)), t;
      },
      {}
    ), Object.keys(e._storyExports).forEach((t) => {
      (0, v.isExportStory)(t, e._meta) || (delete e._storyExports[t], delete e._storyAnnotations[t], delete e._storyStatements[t]);
    }), e._namedExportsOrder) {
      let t = Object.keys(e._storyExports);
      e._storyExports = ge(e._storyExports, e._namedExportsOrder), e._stories = ge(e._stories, e._namedExportsOrder);
      let i = Object.keys(e._storyExports);
      if (t.length !== i.length)
        throw new Error(
          `Missing exports after sort: ${t.filter(
            (a) => !i.includes(a)
          )}`
        );
    }
    return e;
  }
  get meta() {
    return this._meta;
  }
  get stories() {
    return Object.values(this._stories);
  }
  get indexInputs() {
    let { fileName: e } = this._options;
    if (!e)
      throw new Error(
        P.dedent`Cannot automatically create index inputs with CsfFile.indexInputs because the CsfFile instance was created without a the fileName option.
        Either add the fileName option when creating the CsfFile instance, or create the index inputs manually.`
      );
    return Object.entries(this._stories).map(([r, t]) => {
      let i = [...this._meta?.tags ?? [], ...t.tags ?? []];
      return {
        type: "story",
        importPath: e,
        rawComponentPath: this._rawComponentPath,
        exportName: r,
        name: t.name,
        title: this.meta?.title,
        metaId: this.meta?.id,
        tags: i,
        __id: t.id,
        __stats: t.__stats
      };
    });
  }
}, be = /* @__PURE__ */ f(({
  code: s,
  filename: e = "",
  ast: r
}) => new l.BabelFileClass({ filename: e }, { code: s, ast: r ?? (0, l.babelParse)(s) }), "babelParseFile"), Q = /* @__PURE__ */ f((s, e) => {
  let r = (0, l.babelParse)(s), t = be({ code: s, filename: e.fileName, ast: r });
  return new K(r, e, t);
}, "loadCsf"), ie = /* @__PURE__ */ f((s, e = { sourceMaps: !1 }, r) => {
  let t = (0, l.generate)(s._ast, e, r);
  return e.sourceMaps ? t : t.code;
}, "formatCsf"), Ee = /* @__PURE__ */ f((s, e = {}) => l.recast.print(s._ast, e), "printCsf"), st = /* @__PURE__ */ f(async (s, e) => {
  let r = (await (0, J.readFile)(s, "utf-8")).toString();
  return Q(r, { ...e, fileName: s });
}, "readCsf"), nt = /* @__PURE__ */ f(async (s, e) => {
  if (!(e || s._options.fileName))
    throw new Error("Please specify a fileName for writeCsf");
  await (0, J.writeFile)(e, Ee(s).code);
}, "writeCsf");

// src/csf-tools/ConfigFile.ts
var te = require("node:fs/promises"), n = require("storybook/internal/babel"), H = require("storybook/internal/node-logger"), he = z($(), 1);
var se = /* @__PURE__ */ f(({
  expectedType: s,
  foundType: e,
  node: r
}) => he.dedent`
      CSF Parsing error: Expected '${s}' but found '${e}' instead in '${r?.type}'.
    `, "getCsfParsingErrorMessage"), F = /* @__PURE__ */ f((s) => n.types.isIdentifier(s.key) ? s.key.name : n.types.isStringLiteral(s.key) ?
s.key.value : null, "propKey"), Y = /* @__PURE__ */ f((s) => n.types.isTSAsExpression(s) || n.types.isTSSatisfiesExpression(s) ? Y(s.expression) :
s, "unwrap"), _e = /* @__PURE__ */ f((s, e) => {
  if (s.length === 0)
    return e;
  if (n.types.isObjectExpression(e)) {
    let [r, ...t] = s, i = e.properties.find((a) => F(a) === r);
    if (i)
      return _e(t, i.value);
  }
}, "_getPath"), je = /* @__PURE__ */ f((s, e) => {
  if (s.length === 0) {
    if (n.types.isObjectExpression(e))
      return e.properties;
    throw new Error("Expected object expression");
  }
  if (n.types.isObjectExpression(e)) {
    let [r, ...t] = s, i = e.properties.find((a) => F(a) === r);
    if (i)
      return t.length === 0 ? e.properties : je(t, i.value);
  }
}, "_getPathProperties"), Z = /* @__PURE__ */ f((s, e) => {
  let r = null, t = null;
  return e.body.find((i) => (n.types.isVariableDeclaration(i) ? t = i.declarations : n.types.isExportNamedDeclaration(i) && n.types.isVariableDeclaration(
  i.declaration) && (t = i.declaration.declarations), t && t.find((a) => n.types.isVariableDeclarator(a) && n.types.isIdentifier(a.id) && a.
  id.name === s ? (r = a, !0) : !1))), r;
}, "_findVarDeclarator"), w = /* @__PURE__ */ f((s, e) => Z(s, e)?.init, "_findVarInitialization"), q = /* @__PURE__ */ f((s, e) => {
  if (s.length === 0)
    return e;
  let [r, ...t] = s, i = q(t, e);
  return n.types.objectExpression([n.types.objectProperty(n.types.identifier(r), i)]);
}, "_makeObjectExpression"), U = /* @__PURE__ */ f((s, e, r) => {
  let [t, ...i] = s, a = r.properties.find(
    (o) => F(o) === t
  );
  a ? n.types.isObjectExpression(a.value) && i.length > 0 ? U(i, e, a.value) : a.value = q(i, e) : r.properties.push(
    n.types.objectProperty(n.types.identifier(t), q(i, e))
  );
}, "_updateExportNode"), ee = class {
  constructor(e, r, t) {
    this._exports = {};
    // FIXME: this is a hack. this is only used in the case where the user is
    // modifying a named export that's a scalar. The _exports map is not suitable
    // for that. But rather than refactor the whole thing, we just use this as a stopgap.
    this._exportDecls = {};
    this.hasDefaultExport = !1;
    this._ast = e, this._code = r, this.fileName = t;
  }
  static {
    f(this, "ConfigFile");
  }
  _parseExportsObject(e) {
    this._exportsObject = e, e.properties.forEach((r) => {
      let t = F(r);
      if (t) {
        let i = r.value;
        n.types.isIdentifier(i) && (i = w(i.name, this._ast.program)), this._exports[t] = i;
      }
    });
  }
  parse() {
    let e = this;
    return (0, n.traverse)(this._ast, {
      ExportDefaultDeclaration: {
        enter({ node: r, parent: t }) {
          e.hasDefaultExport = !0;
          let i = n.types.isIdentifier(r.declaration) && n.types.isProgram(t) ? w(r.declaration.name, t) : r.declaration;
          i = Y(i), n.types.isCallExpression(i) && n.types.isObjectExpression(i.arguments[0]) && (i = i.arguments[0]), n.types.isObjectExpression(
          i) ? e._parseExportsObject(i) : H.logger.warn(
            se({
              expectedType: "ObjectExpression",
              foundType: i?.type,
              node: i || r.declaration
            })
          );
        }
      },
      ExportNamedDeclaration: {
        enter({ node: r, parent: t }) {
          if (n.types.isVariableDeclaration(r.declaration))
            r.declaration.declarations.forEach((i) => {
              if (n.types.isVariableDeclarator(i) && n.types.isIdentifier(i.id)) {
                let { name: a } = i.id, o = i.init;
                n.types.isIdentifier(o) && (o = w(o.name, t)), e._exports[a] = o, e._exportDecls[a] = i;
              }
            });
          else if (n.types.isFunctionDeclaration(r.declaration)) {
            let i = r.declaration;
            if (n.types.isIdentifier(i.id)) {
              let { name: a } = i.id;
              e._exportDecls[a] = i;
            }
          } else r.specifiers ? r.specifiers.forEach((i) => {
            if (n.types.isExportSpecifier(i) && n.types.isIdentifier(i.local) && n.types.isIdentifier(i.exported)) {
              let { name: a } = i.local, { name: o } = i.exported, c = Z(a, t);
              c && (e._exports[o] = c.init, e._exportDecls[o] = c);
            }
          }) : H.logger.warn(
            se({
              expectedType: "VariableDeclaration",
              foundType: r.declaration?.type,
              node: r.declaration
            })
          );
        }
      },
      ExpressionStatement: {
        enter({ node: r, parent: t }) {
          if (n.types.isAssignmentExpression(r.expression) && r.expression.operator === "=") {
            let { left: i, right: a } = r.expression;
            if (n.types.isMemberExpression(i) && n.types.isIdentifier(i.object) && i.object.name === "module" && n.types.isIdentifier(i.property) &&
            i.property.name === "exports") {
              let o = a;
              n.types.isIdentifier(a) && (o = w(a.name, t)), o = Y(o), n.types.isObjectExpression(o) ? (e._exportsObject = o, o.properties.forEach(
              (c) => {
                let p = F(c);
                if (p) {
                  let d = c.value;
                  n.types.isIdentifier(d) && (d = w(
                    d.name,
                    t
                  )), e._exports[p] = d;
                }
              })) : H.logger.warn(
                se({
                  expectedType: "ObjectExpression",
                  foundType: o?.type,
                  node: o
                })
              );
            }
          }
        }
      },
      CallExpression: {
        enter: /* @__PURE__ */ f(({ node: r }) => {
          n.types.isIdentifier(r.callee) && r.callee.name === "definePreview" && r.arguments.length === 1 && n.types.isObjectExpression(r.arguments[0]) &&
          e._parseExportsObject(r.arguments[0]);
        }, "enter")
      }
    }), e;
  }
  getFieldNode(e) {
    let [r, ...t] = e, i = this._exports[r];
    if (i)
      return _e(t, i);
  }
  getFieldProperties(e) {
    let [r, ...t] = e, i = this._exports[r];
    if (i)
      return je(t, i);
  }
  getFieldValue(e) {
    let r = this.getFieldNode(e);
    if (r) {
      let { code: t } = (0, n.generate)(r, {});
      return (0, eval)(`(() => (${t}))()`);
    }
  }
  getSafeFieldValue(e) {
    try {
      return this.getFieldValue(e);
    } catch {
    }
  }
  setFieldNode(e, r) {
    let [t, ...i] = e, a = this._exports[t];
    if (this._exportsObject) {
      let p = this._exportsObject.properties.find((d) => F(d) === t);
      if (p && n.types.isIdentifier(p.value)) {
        let d = Z(p.value.name, this._ast.program);
        if (d && n.types.isObjectExpression(d.init)) {
          U(i, r, d.init);
          return;
        }
      }
      U(e, r, this._exportsObject), this._exports[e[0]] = r;
      return;
    }
    if (a && n.types.isObjectExpression(a) && i.length > 0) {
      U(i, r, a);
      return;
    }
    let o = Z(t, this._ast.program);
    if (o && n.types.isObjectExpression(o.init)) {
      U(i, r, o.init);
      return;
    }
    if (a && i.length === 0 && this._exportDecls[e[0]]) {
      let c = this._exportDecls[e[0]];
      n.types.isVariableDeclarator(c) && (c.init = q([], r));
    } else {
      if (this.hasDefaultExport)
        throw new Error(
          `Could not set the "${e.join(
            "."
          )}" field as the default export is not an object in this file.`
        );
      {
        let c = q(i, r), p = n.types.exportNamedDeclaration(
          n.types.variableDeclaration("const", [n.types.variableDeclarator(n.types.identifier(t), c)])
        );
        this._exports[t] = c, this._ast.program.body.push(p);
      }
    }
  }
  /**
   * @example
   *
   * ```ts
   * // 1. { framework: 'framework-name' }
   * // 2. { framework: { name: 'framework-name', options: {} }
   * getNameFromPath(['framework']); // => 'framework-name'
   * ```
   *
   * @returns The name of a node in a given path, supporting the following formats:
   */
  getNameFromPath(e) {
    let r = this.getFieldNode(e);
    if (r)
      return this._getPresetValue(r, "name");
  }
  /**
   * Returns an array of names of a node in a given path, supporting the following formats:
   *
   * @example
   *
   * ```ts
   * const config = {
   *   addons: ['first-addon', { name: 'second-addon', options: {} }],
   * };
   * // => ['first-addon', 'second-addon']
   * getNamesFromPath(['addons']);
   * ```
   */
  getNamesFromPath(e) {
    let r = this.getFieldNode(e);
    if (!r)
      return;
    let t = [];
    return n.types.isArrayExpression(r) && r.elements.forEach((i) => {
      t.push(this._getPresetValue(i, "name"));
    }), t;
  }
  _getPnpWrappedValue(e) {
    if (n.types.isCallExpression(e)) {
      let r = e.arguments[0];
      if (n.types.isStringLiteral(r))
        return r.value;
    }
  }
  /**
   * Given a node and a fallback property, returns a **non-evaluated** string value of the node.
   *
   * 1. `{ node: 'value' }`
   * 2. `{ node: { fallbackProperty: 'value' } }`
   */
  _getPresetValue(e, r) {
    let t;
    if (n.types.isStringLiteral(e) ? t = e.value : n.types.isObjectExpression(e) ? e.properties.forEach((i) => {
      n.types.isObjectProperty(i) && n.types.isIdentifier(i.key) && i.key.name === r && (n.types.isStringLiteral(i.value) ? t = i.value.value :
      t = this._getPnpWrappedValue(i.value)), n.types.isObjectProperty(i) && n.types.isStringLiteral(i.key) && i.key.value === "name" && n.types.
      isStringLiteral(i.value) && (t = i.value.value);
    }) : n.types.isCallExpression(e) && (t = this._getPnpWrappedValue(e)), !t)
      throw new Error(
        `The given node must be a string literal or an object expression with a "${r}" property that is a string literal.`
      );
    return t;
  }
  removeField(e) {
    let r = /* @__PURE__ */ f((i, a) => {
      let o = i.findIndex(
        (c) => n.types.isIdentifier(c.key) && c.key.name === a || n.types.isStringLiteral(c.key) && c.key.value === a
      );
      o >= 0 && i.splice(o, 1);
    }, "removeProperty");
    if (e.length === 1) {
      let i = !1;
      if (this._ast.program.body.forEach((a) => {
        if (n.types.isExportNamedDeclaration(a) && n.types.isVariableDeclaration(a.declaration)) {
          let o = a.declaration.declarations[0];
          n.types.isIdentifier(o.id) && o.id.name === e[0] && (this._ast.program.body.splice(this._ast.program.body.indexOf(a), 1), i = !0);
        }
        if (n.types.isExportDefaultDeclaration(a)) {
          let o = a.declaration;
          if (n.types.isIdentifier(o) && (o = w(o.name, this._ast.program)), o = Y(o), n.types.isObjectExpression(o)) {
            let c = o.properties;
            r(c, e[0]), i = !0;
          }
        }
        if (n.types.isExpressionStatement(a) && n.types.isAssignmentExpression(a.expression) && n.types.isMemberExpression(a.expression.left) &&
        n.types.isIdentifier(a.expression.left.object) && a.expression.left.object.name === "module" && n.types.isIdentifier(a.expression.left.
        property) && a.expression.left.property.name === "exports" && n.types.isObjectExpression(a.expression.right)) {
          let o = a.expression.right.properties;
          r(o, e[0]), i = !0;
        }
      }), i)
        return;
    }
    let t = this.getFieldProperties(e);
    if (t) {
      let i = e.at(-1);
      r(t, i);
    }
  }
  appendValueToArray(e, r) {
    let t = this.valueToNode(r);
    t && this.appendNodeToArray(e, t);
  }
  appendNodeToArray(e, r) {
    let t = this.getFieldNode(e);
    if (!t)
      this.setFieldNode(e, n.types.arrayExpression([r]));
    else if (n.types.isArrayExpression(t))
      t.elements.push(r);
    else
      throw new Error(`Expected array at '${e.join(".")}', got '${t.type}'`);
  }
  /**
   * Specialized helper to remove addons or other array entries that can either be strings or
   * objects with a name property.
   */
  removeEntryFromArray(e, r) {
    let t = this.getFieldNode(e);
    if (t)
      if (n.types.isArrayExpression(t)) {
        let i = t.elements.findIndex((a) => n.types.isStringLiteral(a) ? a.value === r : n.types.isObjectExpression(a) ? this._getPresetValue(
        a, "name") === r : this._getPnpWrappedValue(a) === r);
        if (i >= 0)
          t.elements.splice(i, 1);
        else
          throw new Error(`Could not find '${r}' in array at '${e.join(".")}'`);
      } else
        throw new Error(`Expected array at '${e.join(".")}', got '${t.type}'`);
  }
  _inferQuotes() {
    if (!this._quotes) {
      let e = (this._ast.tokens || []).slice(0, 500).reduce(
        (r, t) => (t.type.label === "string" && (r[this._code[t.start]] += 1), r),
        { "'": 0, '"': 0 }
      );
      this._quotes = e["'"] > e['"'] ? "single" : "double";
    }
    return this._quotes;
  }
  valueToNode(e) {
    let r = this._inferQuotes(), t;
    if (r === "single") {
      let { code: i } = (0, n.generate)(n.types.valueToNode(e), { jsescOption: { quotes: r } }), a = (0, n.babelParse)(`const __x = ${i}`);
      (0, n.traverse)(a, {
        VariableDeclaration: {
          enter({ node: o }) {
            o.declarations.length === 1 && n.types.isVariableDeclarator(o.declarations[0]) && n.types.isIdentifier(o.declarations[0].id) && o.
            declarations[0].id.name === "__x" && (t = o.declarations[0].init);
          }
        }
      });
    } else
      t = n.types.valueToNode(e);
    return t;
  }
  setFieldValue(e, r) {
    let t = this.valueToNode(r);
    if (!t)
      throw new Error(`Unexpected value ${JSON.stringify(r)}`);
    this.setFieldNode(e, t);
  }
  getBodyDeclarations() {
    return this._ast.program.body;
  }
  setBodyDeclaration(e) {
    this._ast.program.body.push(e);
  }
  /**
   * Import specifiers for a specific require import
   *
   * @example
   *
   * ```ts
   * // const { foo } = require('bar');
   * setRequireImport(['foo'], 'bar');
   *
   * // const foo = require('bar');
   * setRequireImport('foo', 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to set. If a string is passed in, a default
   *   import will be set. Otherwise, an array of named imports will be set
   * @param fromImport - The module to import from
   */
  setRequireImport(e, r) {
    let t = this._ast.program.body.find((o) => {
      let c = n.types.isVariableDeclaration(o) && o.declarations.length === 1 && n.types.isVariableDeclarator(o.declarations[0]) && n.types.
      isCallExpression(o.declarations[0].init) && n.types.isIdentifier(o.declarations[0].init.callee) && o.declarations[0].init.callee.name ===
      "require" && n.types.isStringLiteral(o.declarations[0].init.arguments[0]) && (o.declarations[0].init.arguments[0].value === r || o.declarations[0].
      init.arguments[0].value === r.split("node:")[1]);
      return c && (r = o.declarations[0].init.arguments[0].value), c;
    }), i = /* @__PURE__ */ f((o) => n.types.isObjectPattern(t?.declarations[0].id) && t?.declarations[0].id.properties.find(
      (c) => n.types.isObjectProperty(c) && n.types.isIdentifier(c.key) && c.key.name === o
    ), "hasRequireSpecifier"), a = /* @__PURE__ */ f((o, c) => o.declarations.length === 1 && n.types.isVariableDeclarator(o.declarations[0]) &&
    n.types.isIdentifier(o.declarations[0].id) && o.declarations[0].id.name === c, "hasDefaultRequireSpecifier");
    if (typeof e == "string") {
      let o = /* @__PURE__ */ f(() => {
        this._ast.program.body.unshift(
          n.types.variableDeclaration("const", [
            n.types.variableDeclarator(
              n.types.identifier(e),
              n.types.callExpression(n.types.identifier("require"), [n.types.stringLiteral(r)])
            )
          ])
        );
      }, "addDefaultRequireSpecifier");
      t && a(t, e) || o();
    } else t ? e.forEach((o) => {
      i(o) || t.declarations[0].id.properties.push(
        n.types.objectProperty(n.types.identifier(o), n.types.identifier(o), void 0, !0)
      );
    }) : this._ast.program.body.unshift(
      n.types.variableDeclaration("const", [
        n.types.variableDeclarator(
          n.types.objectPattern(
            e.map(
              (o) => n.types.objectProperty(n.types.identifier(o), n.types.identifier(o), void 0, !0)
            )
          ),
          n.types.callExpression(n.types.identifier("require"), [n.types.stringLiteral(r)])
        )
      ])
    );
  }
  /**
   * Set import specifiers for a given import statement.
   *
   * Does not support setting type imports (yet)
   *
   * @example
   *
   * ```ts
   * // import { foo } from 'bar';
   * setImport(['foo'], 'bar');
   *
   * // import foo from 'bar';
   * setImport('foo', 'bar');
   *
   * // import * as foo from 'bar';
   * setImport({ namespace: 'foo' }, 'bar');
   *
   * // import 'bar';
   * setImport(null, 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to set. If a string is passed in, a default
   *   import will be set. Otherwise, an array of named imports will be set
   * @param fromImport - The module to import from
   */
  setImport(e, r) {
    let t = this._ast.program.body.find((p) => {
      let d = n.types.isImportDeclaration(p) && (p.source.value === r || p.source.value === r.split("node:")[1]);
      return d && (r = p.source.value), d;
    }), i = /* @__PURE__ */ f((p) => n.types.importSpecifier(n.types.identifier(p), n.types.identifier(p)), "getNewImportSpecifier"), a = /* @__PURE__ */ f(
    (p, d) => p.specifiers.find(
      (u) => n.types.isImportSpecifier(u) && n.types.isIdentifier(u.imported) && u.imported.name === d
    ), "hasImportSpecifier"), o = /* @__PURE__ */ f((p, d) => p.specifiers.find(
      (u) => n.types.isImportNamespaceSpecifier(u) && n.types.isIdentifier(u.local) && u.local.name === d
    ), "hasNamespaceImportSpecifier");
    e === null ? t || this._ast.program.body.unshift(n.types.importDeclaration([], n.types.stringLiteral(r))) : typeof e == "string" ? t ? (/* @__PURE__ */ f(
    (p, d) => p.specifiers.find(
      (u) => n.types.isImportDefaultSpecifier(u) && n.types.isIdentifier(u.local) && u.local.name === d
    ), "hasDefaultImportSpecifier"))(t, e) || t.specifiers.push(
      n.types.importDefaultSpecifier(n.types.identifier(e))
    ) : this._ast.program.body.unshift(
      n.types.importDeclaration(
        [n.types.importDefaultSpecifier(n.types.identifier(e))],
        n.types.stringLiteral(r)
      )
    ) : Array.isArray(e) ? t ? e.forEach((p) => {
      a(t, p) || t.specifiers.push(i(p));
    }) : this._ast.program.body.unshift(
      n.types.importDeclaration(
        e.map(i),
        n.types.stringLiteral(r)
      )
    ) : e.namespace && (t ? o(t, e.namespace) || t.specifiers.push(
      n.types.importNamespaceSpecifier(n.types.identifier(e.namespace))
    ) : this._ast.program.body.unshift(
      n.types.importDeclaration(
        [n.types.importNamespaceSpecifier(n.types.identifier(e.namespace))],
        n.types.stringLiteral(r)
      )
    ));
  }
}, Se = /* @__PURE__ */ f((s, e) => {
  let r = (0, n.babelParse)(s);
  return new ee(r, s, e);
}, "loadConfig"), Oe = /* @__PURE__ */ f((s) => Pe(s).code, "formatConfig"), Pe = /* @__PURE__ */ f((s, e = {}) => n.recast.print(s._ast, e),
"printConfig"), ot = /* @__PURE__ */ f(async (s) => {
  let e = (await (0, te.readFile)(s, "utf-8")).toString();
  return Se(e, s).parse();
}, "readConfig"), at = /* @__PURE__ */ f(async (s, e) => {
  let r = e || s.fileName;
  if (!r)
    throw new Error("Please specify a fileName for writeConfig");
  await (0, te.writeFile)(r, Oe(s));
}, "writeConfig"), lt = /* @__PURE__ */ f((s) => !!s._ast.program.body.find((r) => n.types.isImportDeclaration(r) && r.source.value.includes(
"@storybook") && r.specifiers.some((t) => n.types.isImportSpecifier(t) && n.types.isIdentifier(t.imported) && t.imported.name === "definePre\
view")), "isCsfFactoryPreview");

// src/csf-tools/getStorySortParameter.ts
var y = require("storybook/internal/babel"), De = require("storybook/internal/node-logger"), Ie = z($(), 1);
var ne = /* @__PURE__ */ f((s, e) => {
  let r;
  return s.properties.forEach((t) => {
    y.types.isIdentifier(t.key) && t.key.name === e && (r = t.value);
  }), r;
}, "getValue"), oe = /* @__PURE__ */ f((s) => {
  let e = B(s);
  if (y.types.isArrayExpression(e))
    return e.elements.map((r) => oe(r));
  if (y.types.isObjectExpression(e))
    return e.properties.reduce((r, t) => (y.types.isIdentifier(t.key) && (r[t.key.name] = oe(t.value)), r), {});
  if (y.types.isLiteral(e))
    return e.value;
  if (y.types.isIdentifier(e))
    return C(e.name, !0);
  throw new Error(`Unknown node type ${e.type}`);
}, "parseValue"), C = /* @__PURE__ */ f((s, e) => {
  let r = Ie.dedent`
    Unexpected '${s}'. Parameter 'options.storySort' should be defined inline e.g.:

    export default {
      parameters: {
        options: {
          storySort: <array | object | function>
        },
      },
    };
  `;
  if (e)
    throw new Error(r);
  De.logger.log(r);
}, "unsupported"), B = /* @__PURE__ */ f((s) => y.types.isTSAsExpression(s) || y.types.isTSSatisfiesExpression(s) ? s.expression : s, "strip\
TSModifiers"), Ne = /* @__PURE__ */ f((s) => {
  let e = B(s);
  if (y.types.isObjectExpression(e)) {
    let r = ne(e, "options");
    if (r) {
      if (y.types.isObjectExpression(r))
        return ne(r, "storySort");
      C("options", !0);
    }
  }
}, "parseParameters"), ve = /* @__PURE__ */ f((s, e) => {
  let r = B(s);
  if (y.types.isObjectExpression(r)) {
    let t = ne(r, "parameters");
    if (y.types.isIdentifier(t) && (t = O(t.name, e)), t)
      return Ne(t);
  } else
    C("default", !0);
}, "parseDefault"), ct = /* @__PURE__ */ f((s) => {
  if (!s.includes("storySort"))
    return;
  let e, r = (0, y.babelParse)(s);
  if ((0, y.traverse)(r, {
    ExportNamedDeclaration: {
      enter({ node: t }) {
        y.types.isVariableDeclaration(t.declaration) ? t.declaration.declarations.forEach((i) => {
          if (y.types.isVariableDeclarator(i) && y.types.isIdentifier(i.id)) {
            let { name: a } = i.id;
            if (a === "parameters" && i.init) {
              let o = B(i.init);
              e = Ne(o);
            }
          }
        }) : t.specifiers.forEach((i) => {
          y.types.isIdentifier(i.exported) && i.exported.name === "parameters" && C("parameters", !1);
        });
      }
    },
    ExportDefaultDeclaration: {
      enter({ node: t }) {
        let i = t.declaration;
        y.types.isIdentifier(i) && (i = O(i.name, r.program)), i = B(i), y.types.isCallExpression(i) && y.types.isObjectExpression(i.arguments?.[0]) ?
        e = ve(i.arguments[0], r.program) : y.types.isObjectExpression(i) ? e = ve(i, r.program) : C("default", !1);
      }
    }
  }), !!e) {
    if (y.types.isArrowFunctionExpression(e)) {
      let { code: t } = (0, y.generate)(e, {});
      return (0, eval)(t);
    }
    if (y.types.isFunctionExpression(e)) {
      let { code: t } = (0, y.generate)(e, {}), i = e.id?.name, a = `(a, b) => {
      ${t};
      return ${i}(a, b)
    }`;
      return (0, eval)(a);
    }
    return y.types.isLiteral(e) || y.types.isArrayExpression(e) || y.types.isObjectExpression(e) ? oe(e) : C("storySort", !0);
  }
}, "getStorySortParameter");

// src/csf-tools/enrichCsf.ts
var g = require("storybook/internal/babel");
var we = /* @__PURE__ */ f((s, e, r, t) => {
  let i = e.getStoryExport(r), a = g.types.isCallExpression(i) && g.types.isMemberExpression(i.callee) && g.types.isIdentifier(i.callee.object) &&
  i.callee.object.name === "meta", o = !t?.disableSource && Te(i), c = !t?.disableDescription && ae(e._storyStatements[r]), p = [], d = a ? g.types.
  memberExpression(g.types.identifier(r), g.types.identifier("input")) : g.types.identifier(r), u = g.types.memberExpression(d, g.types.identifier(
  "parameters"));
  p.push(g.types.spreadElement(u));
  let x = g.types.optionalMemberExpression(
    u,
    g.types.identifier("docs"),
    !1,
    !0
  ), E = [];
  if (o) {
    let b = g.types.optionalMemberExpression(
      x,
      g.types.identifier("source"),
      !1,
      !0
    );
    E.push(
      g.types.objectProperty(
        g.types.identifier("source"),
        g.types.objectExpression([
          g.types.objectProperty(g.types.identifier("originalSource"), g.types.stringLiteral(o)),
          g.types.spreadElement(b)
        ])
      )
    );
  }
  if (c) {
    let b = g.types.optionalMemberExpression(
      x,
      g.types.identifier("description"),
      !1,
      !0
    );
    E.push(
      g.types.objectProperty(
        g.types.identifier("description"),
        g.types.objectExpression([
          g.types.objectProperty(g.types.identifier("story"), g.types.stringLiteral(c)),
          g.types.spreadElement(b)
        ])
      )
    );
  }
  if (E.length > 0) {
    p.push(
      g.types.objectProperty(
        g.types.identifier("docs"),
        g.types.objectExpression([g.types.spreadElement(x), ...E])
      )
    );
    let b = g.types.expressionStatement(
      g.types.assignmentExpression("=", u, g.types.objectExpression(p))
    );
    s._ast.program.body.push(b);
  }
}, "enrichCsfStory"), Fe = /* @__PURE__ */ f((s, e, r) => {
  if (!e.length) {
    s.properties.find(
      (p) => g.types.isObjectProperty(p) && g.types.isIdentifier(p.key) && p.key.name === "component"
    ) || s.properties.unshift(r);
    return;
  }
  let [t, ...i] = e, a = s.properties.find(
    (c) => g.types.isObjectProperty(c) && g.types.isIdentifier(c.key) && c.key.name === t && g.types.isObjectExpression(c.value)
  ), o;
  a ? o = a.value : (o = g.types.objectExpression([]), s.properties.push(g.types.objectProperty(g.types.identifier(t), o))), Fe(o, i, r);
}, "addComponentDescription"), Ce = /* @__PURE__ */ f((s, e, r) => {
  let t = !r?.disableDescription && ae(e._metaStatement);
  if (t) {
    let i = s._metaNode;
    i && g.types.isObjectExpression(i) && Fe(
      i,
      ["parameters", "docs", "description"],
      g.types.objectProperty(g.types.identifier("component"), g.types.stringLiteral(t))
    );
  }
}, "enrichCsfMeta"), pt = /* @__PURE__ */ f((s, e, r) => {
  Ce(s, e, r), Object.keys(s._storyExports).forEach((t) => {
    we(s, e, t, r);
  });
}, "enrichCsf"), Te = /* @__PURE__ */ f((s) => {
  let e = g.types.isVariableDeclarator(s) ? s.init : s, { code: r } = (0, g.generate)(e, {});
  return r;
}, "extractSource"), ae = /* @__PURE__ */ f((s) => s?.leadingComments ? s.leadingComments.map((r) => r.type === "CommentLine" || !r.value.startsWith(
"*") ? null : r.value.split(`
`).map((t) => t.replace(/^(\s+)?(\*+)?(\s)?/, "")).join(`
`).trim()).filter(Boolean).join(`
`) : "", "extractDescription");

// src/csf-tools/index.ts
var $e = require("storybook/internal/babel");

// src/csf-tools/vitest-plugin/transformer.ts
var m = require("storybook/internal/babel"), ke = require("storybook/internal/common"), Ve = require("storybook/internal/csf"), le = require("storybook/internal/node-logger"),
ce = z($(), 1);
var ft = /* @__PURE__ */ f((s, e) => !(e.include.length && !e.include.some((r) => s?.includes(r)) || e.exclude.some((r) => s?.includes(r))),
"isValidTest");
async function Ae({
  code: s,
  fileName: e,
  configDir: r,
  stories: t,
  tagsFilter: i,
  previewLevelTags: a = []
}) {
  let o = Q(s, {
    fileName: e,
    transformInlineMeta: !0,
    makeTitle: /* @__PURE__ */ f((h) => {
      let S = (0, ke.getStoryTitle)({
        storyFilePath: e,
        configDir: r,
        stories: t,
        userTitle: h
      }) || "unknown";
      return S === "unknown" && le.logger.warn(
        ce.dedent`
            [Storybook]: Could not calculate story title for "${e}".
            Please make sure that this file matches the globs included in the "stories" field in your Storybook configuration at "${r}".
          `
      ), S;
    }, "makeTitle")
  }).parse(), c = o._ast, p = o._metaVariableName, d = o._metaNode, u = d.properties.find(
    (h) => m.types.isObjectProperty(h) && m.types.isIdentifier(h.key) && h.key.name === "title"
  ), x = m.types.stringLiteral(o._meta?.title || "unknown");
  if (u ? m.types.isObjectProperty(u) && (u.value = x) : d.properties.push(m.types.objectProperty(m.types.identifier("title"), x)), !d || !o.
  _meta)
    throw new Error(
      `The Storybook vitest plugin could not detect the meta (default export) object in the story file. 

Please make sure you have a default export with the meta object. If you are using a different export format that is not supported, please fi\
le an issue with details about your use case.`
    );
  let E = {};
  Object.keys(o._stories).map((h) => {
    let S = (0, Ve.combineTags)(
      "test",
      "dev",
      ...a,
      ...o.meta?.tags || [],
      ...o._stories[h].tags || []
    );
    ft(S, i) && (E[h] = o._storyStatements[h]);
  });
  let b = o._file.path.scope.generateUidIdentifier("test"), _ = o._file.path.scope.generateUidIdentifier("describe");
  if (Object.keys(E).length === 0) {
    let h = m.types.expressionStatement(
      m.types.callExpression(m.types.memberExpression(_, m.types.identifier("skip")), [
        m.types.stringLiteral("No valid tests found")
      ])
    );
    c.program.body.push(h);
    let S = [
      m.types.importDeclaration(
        [
          m.types.importSpecifier(b, m.types.identifier("test")),
          m.types.importSpecifier(_, m.types.identifier("describe"))
        ],
        m.types.stringLiteral("vitest")
      )
    ];
    c.program.body.unshift(...S);
  } else {
    let pe = function() {
      let j = o._file.path.scope.generateUidIdentifier("isRunningFromThisFile"), I = m.types.memberExpression(
        m.types.callExpression(m.types.memberExpression(h, m.types.identifier("getState")), []),
        m.types.identifier("testPath")
      ), T = m.types.memberExpression(
        m.types.memberExpression(m.types.identifier("globalThis"), m.types.identifier("__vitest_worker__")),
        m.types.identifier("filepath")
      ), k = m.types.logicalExpression(
        "??",
        // TODO: switch order of testPathProperty and filePathProperty when the bug is fixed
        // https://github.com/vitest-dev/vitest/issues/6367 (or probably just use testPathProperty)
        T,
        I
      ), G = m.types.callExpression(
        m.types.memberExpression(
          m.types.callExpression(m.types.identifier("convertToFilePath"), [
            m.types.memberExpression(
              m.types.memberExpression(m.types.identifier("import"), m.types.identifier("meta")),
              m.types.identifier("url")
            )
          ]),
          m.types.identifier("includes")
        ),
        [k]
      );
      return { isRunningFromThisFileDeclaration: m.types.variableDeclaration("const", [
        m.types.variableDeclarator(j, G)
      ]), isRunningFromThisFileId: j };
    };
    var W = pe;
    f(pe, "getTestGuardDeclaration");
    let h = o._file.path.scope.generateUidIdentifier("expect"), S = o._file.path.scope.generateUidIdentifier("testStory"), Re = m.types.identifier(
    JSON.stringify(i.skip)), { isRunningFromThisFileDeclaration: Le, isRunningFromThisFileId: Me } = pe();
    c.program.body.push(Le);
    let Ue = /* @__PURE__ */ f(({
      localName: j,
      exportName: I,
      testTitle: T,
      node: k
    }) => {
      let G = m.types.expressionStatement(
        m.types.callExpression(b, [
          m.types.stringLiteral(T),
          m.types.callExpression(S, [
            m.types.stringLiteral(I),
            m.types.identifier(j),
            m.types.identifier(p),
            Re
          ])
        ])
      );
      return G.loc = k.loc, G;
    }, "getTestStatementForStory"), qe = Object.entries(E).map(([j, I]) => {
      if (I === null) {
        le.logger.warn(
          ce.dedent`
            [Storybook]: Could not transform "${j}" story into test at "${e}".
            Please make sure to define stories in the same file and not re-export stories coming from other files".
          `
        );
        return;
      }
      let T = o._stories[j].localName ?? j, k = o._stories[j].name ?? j;
      return Ue({ testTitle: k, localName: T, exportName: j, node: I });
    }).filter((j) => !!j), Be = m.types.ifStatement(Me, m.types.blockStatement(qe));
    c.program.body.push(Be);
    let We = [
      m.types.importDeclaration(
        [
          m.types.importSpecifier(b, m.types.identifier("test")),
          m.types.importSpecifier(h, m.types.identifier("expect"))
        ],
        m.types.stringLiteral("vitest")
      ),
      m.types.importDeclaration(
        [
          m.types.importSpecifier(S, m.types.identifier("testStory")),
          m.types.importSpecifier(m.types.identifier("convertToFilePath"), m.types.identifier("convertToFilePath"))
        ],
        m.types.stringLiteral("@storybook/addon-vitest/internal/test-utils")
      )
    ];
    c.program.body.unshift(...We);
  }
  return ie(o, { sourceMaps: !0, sourceFileName: e }, s);
}
f(Ae, "vitestTransform");
