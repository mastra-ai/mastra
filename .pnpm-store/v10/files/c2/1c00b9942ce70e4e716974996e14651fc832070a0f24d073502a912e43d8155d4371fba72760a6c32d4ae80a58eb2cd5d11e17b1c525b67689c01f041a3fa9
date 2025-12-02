import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var ke = Object.create;
var X = Object.defineProperty;
var Ve = Object.getOwnPropertyDescriptor;
var Ae = Object.getOwnPropertyNames;
var $e = Object.getPrototypeOf, Re = Object.prototype.hasOwnProperty;
var f = (s, e) => X(s, "name", { value: e, configurable: !0 });
var Le = (s, e) => () => (e || s((e = { exports: {} }).exports, e), e.exports);
var Me = (s, e, r, t) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let i of Ae(e))
      !Re.call(s, i) && i !== r && X(s, i, { get: () => e[i], enumerable: !(t = Ve(e, i)) || t.enumerable });
  return s;
};
var U = (s, e, r) => (r = s != null ? ke($e(s)) : {}, Me(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !s || !s.__esModule ? X(r, "default", { value: s, enumerable: !0 }) : r,
  s
));

// ../node_modules/ts-dedent/dist/index.js
var k = Le((T) => {
  "use strict";
  Object.defineProperty(T, "__esModule", { value: !0 });
  T.dedent = void 0;
  function se(s) {
    for (var e = [], r = 1; r < arguments.length; r++)
      e[r - 1] = arguments[r];
    var t = Array.from(typeof s == "string" ? [s] : s);
    t[t.length - 1] = t[t.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var i = t.reduce(function(c, p) {
      var d = p.match(/\n([\t ]+|(?!\s).)/g);
      return d ? c.concat(d.map(function(u) {
        var g, b;
        return (b = (g = u.match(/[\t ]/g)) === null || g === void 0 ? void 0 : g.length) !== null && b !== void 0 ? b : 0;
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
      var d = o.match(/(?:^|\n)( *)$/), u = d ? d[1] : "", g = c;
      typeof c == "string" && c.includes(`
`) && (g = String(c).split(`
`).map(function(b, y) {
        return y === 0 ? b : "" + u + b;
      }).join(`
`)), o += g + t[p + 1];
    }), o;
  }
  f(se, "dedent");
  T.dedent = se;
  T.default = se;
});

// src/csf-tools/CsfFile.ts
var P = U(k(), 1);
import { readFile as Ue, writeFile as qe } from "node:fs/promises";
import {
  BabelFileClass as Be,
  babelParse as fe,
  generate as We,
  recast as de,
  types as l,
  traverse as Ge
} from "storybook/internal/babel";
import { isExportStory as ne, storyNameFromExport as oe, toId as ze } from "storybook/internal/csf";
import { logger as ae } from "storybook/internal/node-logger";

// src/csf-tools/findVarInitialization.ts
import { types as V } from "storybook/internal/babel";
var O = /* @__PURE__ */ f((s, e) => {
  let r = null, t = null;
  return e.body.find((i) => (V.isVariableDeclaration(i) ? t = i.declarations : V.isExportNamedDeclaration(i) && V.isVariableDeclaration(i.declaration) &&
  (t = i.declaration.declarations), t && t.find((a) => V.isVariableDeclarator(a) && V.isIdentifier(a.id) && a.id.name === s ? (r = a.init, !0) :
  !1))), r;
}, "findVarInitialization");

// src/csf-tools/CsfFile.ts
var Xe = /\/preview(.(js|jsx|mjs|ts|tsx))?$/, Ke = /* @__PURE__ */ f((s) => Xe.test(s), "isValidPreviewPath");
function Je(s) {
  if (l.isArrayExpression(s))
    return s.elements.map((e) => {
      if (l.isStringLiteral(e))
        return e.value;
      throw new Error(`Expected string literal: ${e}`);
    });
  if (l.isStringLiteral(s))
    return new RegExp(s.value);
  if (l.isRegExpLiteral(s))
    return new RegExp(s.pattern, s.flags);
  throw new Error(`Unknown include/exclude: ${s}`);
}
f(Je, "parseIncludeExclude");
function le(s) {
  if (!l.isArrayExpression(s))
    throw new Error("CSF: Expected tags array");
  return s.elements.map((e) => {
    if (l.isStringLiteral(e))
      return e.value;
    throw new Error("CSF: Expected tag to be string literal");
  });
}
f(le, "parseTags");
var v = /* @__PURE__ */ f((s, e) => {
  let r = "";
  if (s.loc) {
    let { line: t, column: i } = s.loc?.start || {};
    r = `(line ${t}, col ${i})`;
  }
  return `${e || ""} ${r}`.trim();
}, "formatLocation"), Qe = /* @__PURE__ */ f((s) => Ze.test(s), "isModuleMock"), ce = /* @__PURE__ */ f((s, e, r) => {
  let t = s;
  if (l.isCallExpression(s)) {
    let { callee: i, arguments: a } = s;
    if (l.isProgram(e) && l.isMemberExpression(i) && l.isIdentifier(i.object) && l.isIdentifier(i.property) && i.property.name === "bind" &&
    (a.length === 0 || a.length === 1 && l.isObjectExpression(a[0]) && a[0].properties.length === 0)) {
      let o = i.object.name, c = O(o, e);
      c && (r._templates[o] = c, t = c);
    }
  }
  return l.isArrowFunctionExpression(t) || l.isFunctionDeclaration(t) ? t.params.length > 0 : !1;
}, "isArgsStory"), He = /* @__PURE__ */ f((s) => {
  if (l.isArrayExpression(s))
    return s.elements.map((e) => {
      if (l.isStringLiteral(e))
        return e.value;
      throw new Error(`Expected string literal named export: ${e}`);
    });
  throw new Error(`Expected array of string literals: ${s}`);
}, "parseExportsOrder"), pe = /* @__PURE__ */ f((s, e) => e.reduce(
  (r, t) => {
    let i = s[t];
    return i && (r[t] = i), r;
  },
  {}
), "sortExports"), Ye = /* @__PURE__ */ f((s) => {
  if (l.isArrowFunctionExpression(s) || l.isFunctionDeclaration(s)) {
    let e = s.params;
    if (e.length >= 1) {
      let [r] = e;
      if (l.isObjectPattern(r))
        return !!r.properties.find((t) => {
          if (l.isObjectProperty(t) && l.isIdentifier(t.key))
            return t.key.name === "mount";
        });
    }
  }
  return !1;
}, "hasMount"), Ze = /^[.\/#].*\.mock($|\.[^.]*$)/i, q = class extends Error {
  static {
    f(this, "NoMetaError");
  }
  constructor(e, r, t) {
    let i = e.trim();
    super(P.dedent`
      CSF: ${i} ${v(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, K = class extends Error {
  static {
    f(this, "MultipleMetaError");
  }
  constructor(e, r, t) {
    let i = `${e} ${v(r, t)}`.trim();
    super(P.dedent`
      CSF: ${e} ${v(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, B = class extends Error {
  static {
    f(this, "MixedFactoryError");
  }
  constructor(e, r, t) {
    let i = `${e} ${v(r, t)}`.trim();
    super(P.dedent`
      CSF: ${e} ${v(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, W = class extends Error {
  static {
    f(this, "BadMetaError");
  }
  constructor(e, r, t) {
    let i = "".trim();
    super(P.dedent`
      CSF: ${e} ${v(r, t)}
      
      More info: https://storybook.js.org/docs/writing-stories?ref=error#default-export
    `), this.name = this.constructor.name;
  }
}, J = class {
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
    let r = l.isIdentifier(e) ? O(e.name, this._ast.program) : e;
    if (l.isStringLiteral(r))
      return r.value;
    if (l.isTSSatisfiesExpression(r) && l.isStringLiteral(r.expression))
      return r.expression.value;
    throw new Error(P.dedent`
      CSF: unexpected dynamic title ${v(r, this._options.fileName)}

      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#string-literal-titles
    `);
  }
  _parseMeta(e, r) {
    if (this._metaNode)
      throw new K("multiple meta objects", e, this._options.fileName);
    this._metaNode = e;
    let t = {};
    e.properties.forEach((i) => {
      if (l.isIdentifier(i.key)) {
        if (this._metaAnnotations[i.key.name] = i.value, i.key.name === "title")
          t.title = this._parseTitle(i.value);
        else if (["includeStories", "excludeStories"].includes(i.key.name))
          t[i.key.name] = Je(i.value);
        else if (i.key.name === "component") {
          let a = i.value;
          if (l.isIdentifier(a)) {
            let c = a.name, p = r.body.find(
              (d) => l.isImportDeclaration(d) && d.specifiers.find((u) => u.local.name === c)
            );
            if (p) {
              let { source: d } = p;
              l.isStringLiteral(d) && (this._rawComponentPath = d.value);
            }
          }
          let { code: o } = de.print(i.value, {});
          t.component = o;
        } else if (i.key.name === "tags") {
          let a = i.value;
          l.isIdentifier(a) && (a = O(a.name, this._ast.program)), t.tags = le(a);
        } else if (i.key.name === "id")
          if (l.isStringLiteral(i.value))
            t.id = i.value.value;
          else
            throw new Error(`Unexpected component id: ${i.value}`);
      }
    }), this._meta = t;
  }
  getStoryExport(e) {
    let r = this._storyExports[e];
    if (r = l.isVariableDeclarator(r) ? r.init : r, l.isCallExpression(r)) {
      let { callee: t, arguments: i } = r;
      if (l.isMemberExpression(t) && l.isIdentifier(t.object) && l.isIdentifier(t.property) && t.property.name === "bind" && (i.length === 0 ||
      i.length === 1 && l.isObjectExpression(i[0]) && i[0].properties.length === 0)) {
        let { name: a } = t.object;
        r = this._templates[a];
      }
    }
    return r;
  }
  parse() {
    let e = this;
    if (Ge(this._ast, {
      ExportDefaultDeclaration: {
        enter(t) {
          let { node: i, parent: a } = t, o = l.isIdentifier(i.declaration) && l.isProgram(a);
          if (e._options.transformInlineMeta && !o && l.isExpression(i.declaration)) {
            let d = t.scope.generateUidIdentifier("meta");
            e._metaVariableName = d.name;
            let u = [
              l.variableDeclaration("const", [l.variableDeclarator(d, i.declaration)]),
              l.exportDefaultDeclaration(d)
            ];
            u.forEach((g) => g.loc = t.node.loc), t.replaceWithMultiple(u);
            return;
          }
          let c, p;
          if (o) {
            let d = i.declaration.name;
            e._metaVariableName = d;
            let u = /* @__PURE__ */ f((g) => l.isIdentifier(g.id) && g.id.name === d, "isVariableDeclarator");
            e._metaStatement = e._ast.program.body.find(
              (g) => l.isVariableDeclaration(g) && g.declarations.find(u)
            ), p = (e?._metaStatement?.declarations || []).find(
              u
            )?.init;
          } else
            e._metaStatement = i, p = i.declaration;
          if (l.isObjectExpression(p) ? c = p : /* export default { ... } as Meta<...> */ /* export default { ... } satisfies Meta<...> */ (l.
          isTSAsExpression(p) || l.isTSSatisfiesExpression(p)) && l.isObjectExpression(p.expression) ? c = p.expression : (
            // export default { ... } satisfies Meta as Meta<...>
            l.isTSAsExpression(p) && l.isTSSatisfiesExpression(p.expression) && l.isObjectExpression(p.expression.expression) && (c = p.expression.
            expression)
          ), c && l.isProgram(a) && e._parseMeta(c, a), e._metaStatement && !e._metaNode)
            throw new q(
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
          l.isVariableDeclaration(i.declaration) ? o = i.declaration.declarations.filter((c) => l.isVariableDeclarator(c)) : l.isFunctionDeclaration(
          i.declaration) && (o = [i.declaration]), o ? o.forEach((c) => {
            if (l.isIdentifier(c.id)) {
              let p = !1, { name: d } = c.id;
              if (d === "__namedExportsOrder" && l.isVariableDeclarator(c)) {
                e._namedExportsOrder = He(c.init);
                return;
              }
              e._storyExports[d] = c, e._storyPaths[d] = t, e._storyStatements[d] = i;
              let u = oe(d);
              e._storyAnnotations[d] ? ae.warn(
                `Unexpected annotations for "${d}" before story declaration`
              ) : e._storyAnnotations[d] = {};
              let g;
              if (l.isVariableDeclarator(c) ? l.isTSAsExpression(c.init) && l.isTSSatisfiesExpression(c.init.expression) ? g = c.init.expression.
              expression : l.isTSAsExpression(c.init) || l.isTSSatisfiesExpression(c.init) ? g = c.init.expression : g = c.init : g = c, l.isCallExpression(
              g) && l.isMemberExpression(g.callee) && l.isIdentifier(g.callee.property) && (g.callee.property.name === "story" || g.callee.property.
              name === "extend") && (p = !0, g = g.arguments[0]), e._metaIsFactory && !p)
                throw new B(
                  "expected factory story",
                  g,
                  e._options.fileName
                );
              if (!e._metaIsFactory && p)
                throw e._metaNode ? new B(
                  "expected non-factory story",
                  g,
                  e._options.fileName
                ) : new W(
                  "meta() factory must be imported from .storybook/preview configuration",
                  g,
                  e._options.fileName
                );
              let b = {};
              l.isObjectExpression(g) ? (b.__isArgsStory = !0, g.properties.forEach((y) => {
                if (l.isIdentifier(y.key)) {
                  if (y.key.name === "render")
                    b.__isArgsStory = ce(
                      y.value,
                      a,
                      e
                    );
                  else if (y.key.name === "name" && l.isStringLiteral(y.value))
                    u = y.value.value;
                  else if (y.key.name === "storyName" && l.isStringLiteral(y.value))
                    ae.warn(
                      `Unexpected usage of "storyName" in "${d}". Please use "name" instead.`
                    );
                  else if (y.key.name === "parameters" && l.isObjectExpression(y.value)) {
                    let _ = y.value.properties.find(
                      (L) => l.isObjectProperty(L) && l.isIdentifier(L.key) && L.key.name === "__id"
                    );
                    _ && (b.__id = _.value.value);
                  }
                  e._storyAnnotations[d][y.key.name] = y.value;
                }
              })) : b.__isArgsStory = ce(g, a, e), e._stories[d] = {
                id: "FIXME",
                name: u,
                parameters: b,
                __stats: {
                  factory: p
                }
              };
            }
          }) : i.specifiers.length > 0 && i.specifiers.forEach((c) => {
            if (l.isExportSpecifier(c) && l.isIdentifier(c.exported)) {
              let { name: p } = c.exported, { name: d } = c.local, u = l.isProgram(a) ? O(d, a) : c.local;
              if (p === "default") {
                let g;
                l.isObjectExpression(u) ? g = u : /* export default { ... } as Meta<...> */ /* export default { ... } satisfies Meta<...> */ (l.
                isTSAsExpression(u) || l.isTSSatisfiesExpression(u)) && l.isObjectExpression(u.expression) ? g = u.expression : (
                  // export default { ... } satisfies Meta as Meta<...>
                  l.isTSAsExpression(u) && l.isTSSatisfiesExpression(u.expression) && l.isObjectExpression(u.expression.expression) && (g = u.
                  expression.expression)
                ), g && l.isProgram(a) && e._parseMeta(g, a);
              } else {
                let g = {}, b = u;
                l.isObjectExpression(b) && b.properties.forEach((y) => {
                  l.isIdentifier(y.key) && (g[y.key.name] = y.value);
                }), e._storyAnnotations[p] = g, e._storyStatements[p] = u, e._storyPaths[p] = t, e._stories[p] = {
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
          if (l.isProgram(i) && l.isAssignmentExpression(a) && l.isMemberExpression(a.left) && l.isIdentifier(a.left.object) && l.isIdentifier(
          a.left.property)) {
            let o = a.left.object.name, c = a.left.property.name, p = a.right;
            if (e._storyAnnotations[o] && (c === "story" && l.isObjectExpression(p) ? p.properties.forEach((d) => {
              l.isIdentifier(d.key) && (e._storyAnnotations[o][d.key.name] = d.value);
            }) : e._storyAnnotations[o][c] = p), c === "storyName" && l.isStringLiteral(p)) {
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
          if (l.isIdentifier(a) && a.name === "storiesOf")
            throw new Error(P.dedent`
              Unexpected \`storiesOf\` usage: ${v(i, e._options.fileName)}.

              SB8 does not support \`storiesOf\`.
            `);
          if (l.isMemberExpression(a) && l.isIdentifier(a.property) && a.property.name === "meta" && l.isIdentifier(a.object) && i.arguments.
          length > 0) {
            let c = t.scope.getBinding(a.object.name)?.path?.parentPath?.node;
            if (l.isImportDeclaration(c))
              if (Ke(c.source.value)) {
                let p = i.arguments[0];
                e._metaVariableName = a.property.name, e._metaIsFactory = !0, e._parseMeta(p, e._ast.program);
              } else
                throw new W(
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
          if (l.isStringLiteral(i))
            e.imports.push(i.value);
          else
            throw new Error("CSF: unexpected import source");
        }
      }
    }), !e._meta)
      throw new q("missing default export", e._ast, e._options.fileName);
    let r = Object.entries(e._stories);
    if (e._meta.title = this._options.makeTitle(e._meta?.title), e._metaAnnotations.play && (e._meta.tags = [...e._meta.tags || [], "play-fn"]),
    e._stories = r.reduce(
      (t, [i, a]) => {
        if (!ne(i, e._meta))
          return t;
        let o = a.parameters?.__id ?? ze(e._meta?.id || e._meta?.title, oe(i)), c = { ...a.parameters, __id: o }, { includeStories: p } = e.
        _meta || {};
        i === "__page" && (r.length === 1 || Array.isArray(p) && p.length === 1) && (c.docsOnly = !0), t[i] = { ...a, id: o, parameters: c };
        let d = e._storyAnnotations[i], { tags: u, play: g } = d;
        if (u) {
          let _ = l.isIdentifier(u) ? O(u.name, this._ast.program) : u;
          t[i].tags = le(_);
        }
        g && (t[i].tags = [...t[i].tags || [], "play-fn"]);
        let b = t[i].__stats;
        ["play", "render", "loaders", "beforeEach", "globals", "tags"].forEach((_) => {
          b[_] = !!d[_] || !!e._metaAnnotations[_];
        });
        let y = e.getStoryExport(i);
        return b.storyFn = !!(l.isArrowFunctionExpression(y) || l.isFunctionDeclaration(y)), b.mount = Ye(d.play ?? e._metaAnnotations.play),
        b.moduleMock = !!e.imports.find((_) => Qe(_)), t;
      },
      {}
    ), Object.keys(e._storyExports).forEach((t) => {
      ne(t, e._meta) || (delete e._storyExports[t], delete e._storyAnnotations[t], delete e._storyStatements[t]);
    }), e._namedExportsOrder) {
      let t = Object.keys(e._storyExports);
      e._storyExports = pe(e._storyExports, e._namedExportsOrder), e._stories = pe(e._stories, e._namedExportsOrder);
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
}, et = /* @__PURE__ */ f(({
  code: s,
  filename: e = "",
  ast: r
}) => new Be({ filename: e }, { code: s, ast: r ?? fe(s) }), "babelParseFile"), Q = /* @__PURE__ */ f((s, e) => {
  let r = fe(s), t = et({ code: s, filename: e.fileName, ast: r });
  return new J(r, e, t);
}, "loadCsf"), me = /* @__PURE__ */ f((s, e = { sourceMaps: !1 }, r) => {
  let t = We(s._ast, e, r);
  return e.sourceMaps ? t : t.code;
}, "formatCsf"), tt = /* @__PURE__ */ f((s, e = {}) => de.print(s._ast, e), "printCsf"), Ft = /* @__PURE__ */ f(async (s, e) => {
  let r = (await Ue(s, "utf-8")).toString();
  return Q(r, { ...e, fileName: s });
}, "readCsf"), Ct = /* @__PURE__ */ f(async (s, e) => {
  if (!(e || s._options.fileName))
    throw new Error("Please specify a fileName for writeCsf");
  await qe(e, tt(s).code);
}, "writeCsf");

// src/csf-tools/ConfigFile.ts
var ye = U(k(), 1);
import { readFile as rt, writeFile as it } from "node:fs/promises";
import {
  babelParse as xe,
  generate as ue,
  recast as st,
  types as n,
  traverse as ge
} from "storybook/internal/babel";
import { logger as H } from "storybook/internal/node-logger";
var Y = /* @__PURE__ */ f(({
  expectedType: s,
  foundType: e,
  node: r
}) => ye.dedent`
      CSF Parsing error: Expected '${s}' but found '${e}' instead in '${r?.type}'.
    `, "getCsfParsingErrorMessage"), N = /* @__PURE__ */ f((s) => n.isIdentifier(s.key) ? s.key.name : n.isStringLiteral(s.key) ? s.key.value :
null, "propKey"), G = /* @__PURE__ */ f((s) => n.isTSAsExpression(s) || n.isTSSatisfiesExpression(s) ? G(s.expression) : s, "unwrap"), be = /* @__PURE__ */ f(
(s, e) => {
  if (s.length === 0)
    return e;
  if (n.isObjectExpression(e)) {
    let [r, ...t] = s, i = e.properties.find((a) => N(a) === r);
    if (i)
      return be(t, i.value);
  }
}, "_getPath"), Ee = /* @__PURE__ */ f((s, e) => {
  if (s.length === 0) {
    if (n.isObjectExpression(e))
      return e.properties;
    throw new Error("Expected object expression");
  }
  if (n.isObjectExpression(e)) {
    let [r, ...t] = s, i = e.properties.find((a) => N(a) === r);
    if (i)
      return t.length === 0 ? e.properties : Ee(t, i.value);
  }
}, "_getPathProperties"), z = /* @__PURE__ */ f((s, e) => {
  let r = null, t = null;
  return e.body.find((i) => (n.isVariableDeclaration(i) ? t = i.declarations : n.isExportNamedDeclaration(i) && n.isVariableDeclaration(i.declaration) &&
  (t = i.declaration.declarations), t && t.find((a) => n.isVariableDeclarator(a) && n.isIdentifier(a.id) && a.id.name === s ? (r = a, !0) : !1))),
  r;
}, "_findVarDeclarator"), I = /* @__PURE__ */ f((s, e) => z(s, e)?.init, "_findVarInitialization"), $ = /* @__PURE__ */ f((s, e) => {
  if (s.length === 0)
    return e;
  let [r, ...t] = s, i = $(t, e);
  return n.objectExpression([n.objectProperty(n.identifier(r), i)]);
}, "_makeObjectExpression"), A = /* @__PURE__ */ f((s, e, r) => {
  let [t, ...i] = s, a = r.properties.find(
    (o) => N(o) === t
  );
  a ? n.isObjectExpression(a.value) && i.length > 0 ? A(i, e, a.value) : a.value = $(i, e) : r.properties.push(
    n.objectProperty(n.identifier(t), $(i, e))
  );
}, "_updateExportNode"), Z = class {
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
      let t = N(r);
      if (t) {
        let i = r.value;
        n.isIdentifier(i) && (i = I(i.name, this._ast.program)), this._exports[t] = i;
      }
    });
  }
  parse() {
    let e = this;
    return ge(this._ast, {
      ExportDefaultDeclaration: {
        enter({ node: r, parent: t }) {
          e.hasDefaultExport = !0;
          let i = n.isIdentifier(r.declaration) && n.isProgram(t) ? I(r.declaration.name, t) : r.declaration;
          i = G(i), n.isCallExpression(i) && n.isObjectExpression(i.arguments[0]) && (i = i.arguments[0]), n.isObjectExpression(i) ? e._parseExportsObject(
          i) : H.warn(
            Y({
              expectedType: "ObjectExpression",
              foundType: i?.type,
              node: i || r.declaration
            })
          );
        }
      },
      ExportNamedDeclaration: {
        enter({ node: r, parent: t }) {
          if (n.isVariableDeclaration(r.declaration))
            r.declaration.declarations.forEach((i) => {
              if (n.isVariableDeclarator(i) && n.isIdentifier(i.id)) {
                let { name: a } = i.id, o = i.init;
                n.isIdentifier(o) && (o = I(o.name, t)), e._exports[a] = o, e._exportDecls[a] = i;
              }
            });
          else if (n.isFunctionDeclaration(r.declaration)) {
            let i = r.declaration;
            if (n.isIdentifier(i.id)) {
              let { name: a } = i.id;
              e._exportDecls[a] = i;
            }
          } else r.specifiers ? r.specifiers.forEach((i) => {
            if (n.isExportSpecifier(i) && n.isIdentifier(i.local) && n.isIdentifier(i.exported)) {
              let { name: a } = i.local, { name: o } = i.exported, c = z(a, t);
              c && (e._exports[o] = c.init, e._exportDecls[o] = c);
            }
          }) : H.warn(
            Y({
              expectedType: "VariableDeclaration",
              foundType: r.declaration?.type,
              node: r.declaration
            })
          );
        }
      },
      ExpressionStatement: {
        enter({ node: r, parent: t }) {
          if (n.isAssignmentExpression(r.expression) && r.expression.operator === "=") {
            let { left: i, right: a } = r.expression;
            if (n.isMemberExpression(i) && n.isIdentifier(i.object) && i.object.name === "module" && n.isIdentifier(i.property) && i.property.
            name === "exports") {
              let o = a;
              n.isIdentifier(a) && (o = I(a.name, t)), o = G(o), n.isObjectExpression(o) ? (e._exportsObject = o, o.properties.forEach((c) => {
                let p = N(c);
                if (p) {
                  let d = c.value;
                  n.isIdentifier(d) && (d = I(
                    d.name,
                    t
                  )), e._exports[p] = d;
                }
              })) : H.warn(
                Y({
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
          n.isIdentifier(r.callee) && r.callee.name === "definePreview" && r.arguments.length === 1 && n.isObjectExpression(r.arguments[0]) &&
          e._parseExportsObject(r.arguments[0]);
        }, "enter")
      }
    }), e;
  }
  getFieldNode(e) {
    let [r, ...t] = e, i = this._exports[r];
    if (i)
      return be(t, i);
  }
  getFieldProperties(e) {
    let [r, ...t] = e, i = this._exports[r];
    if (i)
      return Ee(t, i);
  }
  getFieldValue(e) {
    let r = this.getFieldNode(e);
    if (r) {
      let { code: t } = ue(r, {});
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
      let p = this._exportsObject.properties.find((d) => N(d) === t);
      if (p && n.isIdentifier(p.value)) {
        let d = z(p.value.name, this._ast.program);
        if (d && n.isObjectExpression(d.init)) {
          A(i, r, d.init);
          return;
        }
      }
      A(e, r, this._exportsObject), this._exports[e[0]] = r;
      return;
    }
    if (a && n.isObjectExpression(a) && i.length > 0) {
      A(i, r, a);
      return;
    }
    let o = z(t, this._ast.program);
    if (o && n.isObjectExpression(o.init)) {
      A(i, r, o.init);
      return;
    }
    if (a && i.length === 0 && this._exportDecls[e[0]]) {
      let c = this._exportDecls[e[0]];
      n.isVariableDeclarator(c) && (c.init = $([], r));
    } else {
      if (this.hasDefaultExport)
        throw new Error(
          `Could not set the "${e.join(
            "."
          )}" field as the default export is not an object in this file.`
        );
      {
        let c = $(i, r), p = n.exportNamedDeclaration(
          n.variableDeclaration("const", [n.variableDeclarator(n.identifier(t), c)])
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
    return n.isArrayExpression(r) && r.elements.forEach((i) => {
      t.push(this._getPresetValue(i, "name"));
    }), t;
  }
  _getPnpWrappedValue(e) {
    if (n.isCallExpression(e)) {
      let r = e.arguments[0];
      if (n.isStringLiteral(r))
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
    if (n.isStringLiteral(e) ? t = e.value : n.isObjectExpression(e) ? e.properties.forEach((i) => {
      n.isObjectProperty(i) && n.isIdentifier(i.key) && i.key.name === r && (n.isStringLiteral(i.value) ? t = i.value.value : t = this._getPnpWrappedValue(
      i.value)), n.isObjectProperty(i) && n.isStringLiteral(i.key) && i.key.value === "name" && n.isStringLiteral(i.value) && (t = i.value.value);
    }) : n.isCallExpression(e) && (t = this._getPnpWrappedValue(e)), !t)
      throw new Error(
        `The given node must be a string literal or an object expression with a "${r}" property that is a string literal.`
      );
    return t;
  }
  removeField(e) {
    let r = /* @__PURE__ */ f((i, a) => {
      let o = i.findIndex(
        (c) => n.isIdentifier(c.key) && c.key.name === a || n.isStringLiteral(c.key) && c.key.value === a
      );
      o >= 0 && i.splice(o, 1);
    }, "removeProperty");
    if (e.length === 1) {
      let i = !1;
      if (this._ast.program.body.forEach((a) => {
        if (n.isExportNamedDeclaration(a) && n.isVariableDeclaration(a.declaration)) {
          let o = a.declaration.declarations[0];
          n.isIdentifier(o.id) && o.id.name === e[0] && (this._ast.program.body.splice(this._ast.program.body.indexOf(a), 1), i = !0);
        }
        if (n.isExportDefaultDeclaration(a)) {
          let o = a.declaration;
          if (n.isIdentifier(o) && (o = I(o.name, this._ast.program)), o = G(o), n.isObjectExpression(o)) {
            let c = o.properties;
            r(c, e[0]), i = !0;
          }
        }
        if (n.isExpressionStatement(a) && n.isAssignmentExpression(a.expression) && n.isMemberExpression(a.expression.left) && n.isIdentifier(
        a.expression.left.object) && a.expression.left.object.name === "module" && n.isIdentifier(a.expression.left.property) && a.expression.
        left.property.name === "exports" && n.isObjectExpression(a.expression.right)) {
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
      this.setFieldNode(e, n.arrayExpression([r]));
    else if (n.isArrayExpression(t))
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
      if (n.isArrayExpression(t)) {
        let i = t.elements.findIndex((a) => n.isStringLiteral(a) ? a.value === r : n.isObjectExpression(a) ? this._getPresetValue(a, "name") ===
        r : this._getPnpWrappedValue(a) === r);
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
      let { code: i } = ue(n.valueToNode(e), { jsescOption: { quotes: r } }), a = xe(`const __x = ${i}`);
      ge(a, {
        VariableDeclaration: {
          enter({ node: o }) {
            o.declarations.length === 1 && n.isVariableDeclarator(o.declarations[0]) && n.isIdentifier(o.declarations[0].id) && o.declarations[0].
            id.name === "__x" && (t = o.declarations[0].init);
          }
        }
      });
    } else
      t = n.valueToNode(e);
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
      let c = n.isVariableDeclaration(o) && o.declarations.length === 1 && n.isVariableDeclarator(o.declarations[0]) && n.isCallExpression(o.
      declarations[0].init) && n.isIdentifier(o.declarations[0].init.callee) && o.declarations[0].init.callee.name === "require" && n.isStringLiteral(
      o.declarations[0].init.arguments[0]) && (o.declarations[0].init.arguments[0].value === r || o.declarations[0].init.arguments[0].value ===
      r.split("node:")[1]);
      return c && (r = o.declarations[0].init.arguments[0].value), c;
    }), i = /* @__PURE__ */ f((o) => n.isObjectPattern(t?.declarations[0].id) && t?.declarations[0].id.properties.find(
      (c) => n.isObjectProperty(c) && n.isIdentifier(c.key) && c.key.name === o
    ), "hasRequireSpecifier"), a = /* @__PURE__ */ f((o, c) => o.declarations.length === 1 && n.isVariableDeclarator(o.declarations[0]) && n.
    isIdentifier(o.declarations[0].id) && o.declarations[0].id.name === c, "hasDefaultRequireSpecifier");
    if (typeof e == "string") {
      let o = /* @__PURE__ */ f(() => {
        this._ast.program.body.unshift(
          n.variableDeclaration("const", [
            n.variableDeclarator(
              n.identifier(e),
              n.callExpression(n.identifier("require"), [n.stringLiteral(r)])
            )
          ])
        );
      }, "addDefaultRequireSpecifier");
      t && a(t, e) || o();
    } else t ? e.forEach((o) => {
      i(o) || t.declarations[0].id.properties.push(
        n.objectProperty(n.identifier(o), n.identifier(o), void 0, !0)
      );
    }) : this._ast.program.body.unshift(
      n.variableDeclaration("const", [
        n.variableDeclarator(
          n.objectPattern(
            e.map(
              (o) => n.objectProperty(n.identifier(o), n.identifier(o), void 0, !0)
            )
          ),
          n.callExpression(n.identifier("require"), [n.stringLiteral(r)])
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
      let d = n.isImportDeclaration(p) && (p.source.value === r || p.source.value === r.split("node:")[1]);
      return d && (r = p.source.value), d;
    }), i = /* @__PURE__ */ f((p) => n.importSpecifier(n.identifier(p), n.identifier(p)), "getNewImportSpecifier"), a = /* @__PURE__ */ f((p, d) => p.
    specifiers.find(
      (u) => n.isImportSpecifier(u) && n.isIdentifier(u.imported) && u.imported.name === d
    ), "hasImportSpecifier"), o = /* @__PURE__ */ f((p, d) => p.specifiers.find(
      (u) => n.isImportNamespaceSpecifier(u) && n.isIdentifier(u.local) && u.local.name === d
    ), "hasNamespaceImportSpecifier");
    e === null ? t || this._ast.program.body.unshift(n.importDeclaration([], n.stringLiteral(r))) : typeof e == "string" ? t ? (/* @__PURE__ */ f(
    (p, d) => p.specifiers.find(
      (u) => n.isImportDefaultSpecifier(u) && n.isIdentifier(u.local) && u.local.name === d
    ), "hasDefaultImportSpecifier"))(t, e) || t.specifiers.push(
      n.importDefaultSpecifier(n.identifier(e))
    ) : this._ast.program.body.unshift(
      n.importDeclaration(
        [n.importDefaultSpecifier(n.identifier(e))],
        n.stringLiteral(r)
      )
    ) : Array.isArray(e) ? t ? e.forEach((p) => {
      a(t, p) || t.specifiers.push(i(p));
    }) : this._ast.program.body.unshift(
      n.importDeclaration(
        e.map(i),
        n.stringLiteral(r)
      )
    ) : e.namespace && (t ? o(t, e.namespace) || t.specifiers.push(
      n.importNamespaceSpecifier(n.identifier(e.namespace))
    ) : this._ast.program.body.unshift(
      n.importDeclaration(
        [n.importNamespaceSpecifier(n.identifier(e.namespace))],
        n.stringLiteral(r)
      )
    ));
  }
}, nt = /* @__PURE__ */ f((s, e) => {
  let r = xe(s);
  return new Z(r, s, e);
}, "loadConfig"), ot = /* @__PURE__ */ f((s) => at(s).code, "formatConfig"), at = /* @__PURE__ */ f((s, e = {}) => st.print(s._ast, e), "pri\
ntConfig"), Rt = /* @__PURE__ */ f(async (s) => {
  let e = (await rt(s, "utf-8")).toString();
  return nt(e, s).parse();
}, "readConfig"), Lt = /* @__PURE__ */ f(async (s, e) => {
  let r = e || s.fileName;
  if (!r)
    throw new Error("Please specify a fileName for writeConfig");
  await it(r, ot(s));
}, "writeConfig"), Mt = /* @__PURE__ */ f((s) => !!s._ast.program.body.find((r) => n.isImportDeclaration(r) && r.source.value.includes("@sto\
rybook") && r.specifiers.some((t) => n.isImportSpecifier(t) && n.isIdentifier(t.imported) && t.imported.name === "definePreview")), "isCsfFa\
ctoryPreview");

// src/csf-tools/getStorySortParameter.ts
var je = U(k(), 1);
import { babelParse as lt, generate as he, types as E, traverse as ct } from "storybook/internal/babel";
import { logger as pt } from "storybook/internal/node-logger";
var ee = /* @__PURE__ */ f((s, e) => {
  let r;
  return s.properties.forEach((t) => {
    E.isIdentifier(t.key) && t.key.name === e && (r = t.value);
  }), r;
}, "getValue"), te = /* @__PURE__ */ f((s) => {
  let e = R(s);
  if (E.isArrayExpression(e))
    return e.elements.map((r) => te(r));
  if (E.isObjectExpression(e))
    return e.properties.reduce((r, t) => (E.isIdentifier(t.key) && (r[t.key.name] = te(t.value)), r), {});
  if (E.isLiteral(e))
    return e.value;
  if (E.isIdentifier(e))
    return w(e.name, !0);
  throw new Error(`Unknown node type ${e.type}`);
}, "parseValue"), w = /* @__PURE__ */ f((s, e) => {
  let r = je.dedent`
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
  pt.log(r);
}, "unsupported"), R = /* @__PURE__ */ f((s) => E.isTSAsExpression(s) || E.isTSSatisfiesExpression(s) ? s.expression : s, "stripTSModifiers"),
Se = /* @__PURE__ */ f((s) => {
  let e = R(s);
  if (E.isObjectExpression(e)) {
    let r = ee(e, "options");
    if (r) {
      if (E.isObjectExpression(r))
        return ee(r, "storySort");
      w("options", !0);
    }
  }
}, "parseParameters"), _e = /* @__PURE__ */ f((s, e) => {
  let r = R(s);
  if (E.isObjectExpression(r)) {
    let t = ee(r, "parameters");
    if (E.isIdentifier(t) && (t = O(t.name, e)), t)
      return Se(t);
  } else
    w("default", !0);
}, "parseDefault"), zt = /* @__PURE__ */ f((s) => {
  if (!s.includes("storySort"))
    return;
  let e, r = lt(s);
  if (ct(r, {
    ExportNamedDeclaration: {
      enter({ node: t }) {
        E.isVariableDeclaration(t.declaration) ? t.declaration.declarations.forEach((i) => {
          if (E.isVariableDeclarator(i) && E.isIdentifier(i.id)) {
            let { name: a } = i.id;
            if (a === "parameters" && i.init) {
              let o = R(i.init);
              e = Se(o);
            }
          }
        }) : t.specifiers.forEach((i) => {
          E.isIdentifier(i.exported) && i.exported.name === "parameters" && w("parameters", !1);
        });
      }
    },
    ExportDefaultDeclaration: {
      enter({ node: t }) {
        let i = t.declaration;
        E.isIdentifier(i) && (i = O(i.name, r.program)), i = R(i), E.isCallExpression(i) && E.isObjectExpression(i.arguments?.[0]) ? e = _e(
        i.arguments[0], r.program) : E.isObjectExpression(i) ? e = _e(i, r.program) : w("default", !1);
      }
    }
  }), !!e) {
    if (E.isArrowFunctionExpression(e)) {
      let { code: t } = he(e, {});
      return (0, eval)(t);
    }
    if (E.isFunctionExpression(e)) {
      let { code: t } = he(e, {}), i = e.id?.name, a = `(a, b) => {
      ${t};
      return ${i}(a, b)
    }`;
      return (0, eval)(a);
    }
    return E.isLiteral(e) || E.isArrayExpression(e) || E.isObjectExpression(e) ? te(e) : w("storySort", !0);
  }
}, "getStorySortParameter");

// src/csf-tools/enrichCsf.ts
import { generate as ft, types as x } from "storybook/internal/babel";
var dt = /* @__PURE__ */ f((s, e, r, t) => {
  let i = e.getStoryExport(r), a = x.isCallExpression(i) && x.isMemberExpression(i.callee) && x.isIdentifier(i.callee.object) && i.callee.object.
  name === "meta", o = !t?.disableSource && ut(i), c = !t?.disableDescription && Pe(e._storyStatements[r]), p = [], d = a ? x.memberExpression(
  x.identifier(r), x.identifier("input")) : x.identifier(r), u = x.memberExpression(d, x.identifier("parameters"));
  p.push(x.spreadElement(u));
  let g = x.optionalMemberExpression(
    u,
    x.identifier("docs"),
    !1,
    !0
  ), b = [];
  if (o) {
    let y = x.optionalMemberExpression(
      g,
      x.identifier("source"),
      !1,
      !0
    );
    b.push(
      x.objectProperty(
        x.identifier("source"),
        x.objectExpression([
          x.objectProperty(x.identifier("originalSource"), x.stringLiteral(o)),
          x.spreadElement(y)
        ])
      )
    );
  }
  if (c) {
    let y = x.optionalMemberExpression(
      g,
      x.identifier("description"),
      !1,
      !0
    );
    b.push(
      x.objectProperty(
        x.identifier("description"),
        x.objectExpression([
          x.objectProperty(x.identifier("story"), x.stringLiteral(c)),
          x.spreadElement(y)
        ])
      )
    );
  }
  if (b.length > 0) {
    p.push(
      x.objectProperty(
        x.identifier("docs"),
        x.objectExpression([x.spreadElement(g), ...b])
      )
    );
    let y = x.expressionStatement(
      x.assignmentExpression("=", u, x.objectExpression(p))
    );
    s._ast.program.body.push(y);
  }
}, "enrichCsfStory"), Oe = /* @__PURE__ */ f((s, e, r) => {
  if (!e.length) {
    s.properties.find(
      (p) => x.isObjectProperty(p) && x.isIdentifier(p.key) && p.key.name === "component"
    ) || s.properties.unshift(r);
    return;
  }
  let [t, ...i] = e, a = s.properties.find(
    (c) => x.isObjectProperty(c) && x.isIdentifier(c.key) && c.key.name === t && x.isObjectExpression(c.value)
  ), o;
  a ? o = a.value : (o = x.objectExpression([]), s.properties.push(x.objectProperty(x.identifier(t), o))), Oe(o, i, r);
}, "addComponentDescription"), mt = /* @__PURE__ */ f((s, e, r) => {
  let t = !r?.disableDescription && Pe(e._metaStatement);
  if (t) {
    let i = s._metaNode;
    i && x.isObjectExpression(i) && Oe(
      i,
      ["parameters", "docs", "description"],
      x.objectProperty(x.identifier("component"), x.stringLiteral(t))
    );
  }
}, "enrichCsfMeta"), Qt = /* @__PURE__ */ f((s, e, r) => {
  mt(s, e, r), Object.keys(s._storyExports).forEach((t) => {
    dt(s, e, t, r);
  });
}, "enrichCsf"), ut = /* @__PURE__ */ f((s) => {
  let e = x.isVariableDeclarator(s) ? s.init : s, { code: r } = ft(e, {});
  return r;
}, "extractSource"), Pe = /* @__PURE__ */ f((s) => s?.leadingComments ? s.leadingComments.map((r) => r.type === "CommentLine" || !r.value.startsWith(
"*") ? null : r.value.split(`
`).map((t) => t.replace(/^(\s+)?(\*+)?(\s)?/, "")).join(`
`).trim()).filter(Boolean).join(`
`) : "", "extractDescription");

// src/csf-tools/index.ts
import { babelParse as dr } from "storybook/internal/babel";

// src/csf-tools/vitest-plugin/transformer.ts
var re = U(k(), 1);
import { types as m } from "storybook/internal/babel";
import { getStoryTitle as gt } from "storybook/internal/common";
import { combineTags as xt } from "storybook/internal/csf";
import { logger as ve } from "storybook/internal/node-logger";
var yt = /* @__PURE__ */ f((s, e) => !(e.include.length && !e.include.some((r) => s?.includes(r)) || e.exclude.some((r) => s?.includes(r))),
"isValidTest");
async function bt({
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
      let S = gt({
        storyFilePath: e,
        configDir: r,
        stories: t,
        userTitle: h
      }) || "unknown";
      return S === "unknown" && ve.warn(
        re.dedent`
            [Storybook]: Could not calculate story title for "${e}".
            Please make sure that this file matches the globs included in the "stories" field in your Storybook configuration at "${r}".
          `
      ), S;
    }, "makeTitle")
  }).parse(), c = o._ast, p = o._metaVariableName, d = o._metaNode, u = d.properties.find(
    (h) => m.isObjectProperty(h) && m.isIdentifier(h.key) && h.key.name === "title"
  ), g = m.stringLiteral(o._meta?.title || "unknown");
  if (u ? m.isObjectProperty(u) && (u.value = g) : d.properties.push(m.objectProperty(m.identifier("title"), g)), !d || !o._meta)
    throw new Error(
      `The Storybook vitest plugin could not detect the meta (default export) object in the story file. 

Please make sure you have a default export with the meta object. If you are using a different export format that is not supported, please fi\
le an issue with details about your use case.`
    );
  let b = {};
  Object.keys(o._stories).map((h) => {
    let S = xt(
      "test",
      "dev",
      ...a,
      ...o.meta?.tags || [],
      ...o._stories[h].tags || []
    );
    yt(S, i) && (b[h] = o._storyStatements[h]);
  });
  let y = o._file.path.scope.generateUidIdentifier("test"), _ = o._file.path.scope.generateUidIdentifier("describe");
  if (Object.keys(b).length === 0) {
    let h = m.expressionStatement(
      m.callExpression(m.memberExpression(_, m.identifier("skip")), [
        m.stringLiteral("No valid tests found")
      ])
    );
    c.program.body.push(h);
    let S = [
      m.importDeclaration(
        [
          m.importSpecifier(y, m.identifier("test")),
          m.importSpecifier(_, m.identifier("describe"))
        ],
        m.stringLiteral("vitest")
      )
    ];
    c.program.body.unshift(...S);
  } else {
    let ie = function() {
      let j = o._file.path.scope.generateUidIdentifier("isRunningFromThisFile"), D = m.memberExpression(
        m.callExpression(m.memberExpression(h, m.identifier("getState")), []),
        m.identifier("testPath")
      ), F = m.memberExpression(
        m.memberExpression(m.identifier("globalThis"), m.identifier("__vitest_worker__")),
        m.identifier("filepath")
      ), C = m.logicalExpression(
        "??",
        // TODO: switch order of testPathProperty and filePathProperty when the bug is fixed
        // https://github.com/vitest-dev/vitest/issues/6367 (or probably just use testPathProperty)
        F,
        D
      ), M = m.callExpression(
        m.memberExpression(
          m.callExpression(m.identifier("convertToFilePath"), [
            m.memberExpression(
              m.memberExpression(m.identifier("import"), m.identifier("meta")),
              m.identifier("url")
            )
          ]),
          m.identifier("includes")
        ),
        [C]
      );
      return { isRunningFromThisFileDeclaration: m.variableDeclaration("const", [
        m.variableDeclarator(j, M)
      ]), isRunningFromThisFileId: j };
    };
    var L = ie;
    f(ie, "getTestGuardDeclaration");
    let h = o._file.path.scope.generateUidIdentifier("expect"), S = o._file.path.scope.generateUidIdentifier("testStory"), De = m.identifier(
    JSON.stringify(i.skip)), { isRunningFromThisFileDeclaration: Ie, isRunningFromThisFileId: Ne } = ie();
    c.program.body.push(Ie);
    let we = /* @__PURE__ */ f(({
      localName: j,
      exportName: D,
      testTitle: F,
      node: C
    }) => {
      let M = m.expressionStatement(
        m.callExpression(y, [
          m.stringLiteral(F),
          m.callExpression(S, [
            m.stringLiteral(D),
            m.identifier(j),
            m.identifier(p),
            De
          ])
        ])
      );
      return M.loc = C.loc, M;
    }, "getTestStatementForStory"), Fe = Object.entries(b).map(([j, D]) => {
      if (D === null) {
        ve.warn(
          re.dedent`
            [Storybook]: Could not transform "${j}" story into test at "${e}".
            Please make sure to define stories in the same file and not re-export stories coming from other files".
          `
        );
        return;
      }
      let F = o._stories[j].localName ?? j, C = o._stories[j].name ?? j;
      return we({ testTitle: C, localName: F, exportName: j, node: D });
    }).filter((j) => !!j), Ce = m.ifStatement(Ne, m.blockStatement(Fe));
    c.program.body.push(Ce);
    let Te = [
      m.importDeclaration(
        [
          m.importSpecifier(y, m.identifier("test")),
          m.importSpecifier(h, m.identifier("expect"))
        ],
        m.stringLiteral("vitest")
      ),
      m.importDeclaration(
        [
          m.importSpecifier(S, m.identifier("testStory")),
          m.importSpecifier(m.identifier("convertToFilePath"), m.identifier("convertToFilePath"))
        ],
        m.stringLiteral("@storybook/addon-vitest/internal/test-utils")
      )
    ];
    c.program.body.unshift(...Te);
  }
  return me(o, { sourceMaps: !0, sourceFileName: e }, s);
}
f(bt, "vitestTransform");
export {
  W as BadMetaError,
  Z as ConfigFile,
  J as CsfFile,
  B as MixedFactoryError,
  K as MultipleMetaError,
  q as NoMetaError,
  dr as babelParse,
  et as babelParseFile,
  Qt as enrichCsf,
  mt as enrichCsfMeta,
  dt as enrichCsfStory,
  Pe as extractDescription,
  ut as extractSource,
  ot as formatConfig,
  me as formatCsf,
  zt as getStorySortParameter,
  Mt as isCsfFactoryPreview,
  Qe as isModuleMock,
  Ke as isValidPreviewPath,
  nt as loadConfig,
  Q as loadCsf,
  at as printConfig,
  tt as printCsf,
  Rt as readConfig,
  Ft as readCsf,
  bt as vitestTransform,
  Lt as writeConfig,
  Ct as writeCsf
};
