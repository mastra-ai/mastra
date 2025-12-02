import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var ue = Object.create;
var R = Object.defineProperty;
var le = Object.getOwnPropertyDescriptor;
var me = Object.getOwnPropertyNames;
var ge = Object.getPrototypeOf, be = Object.prototype.hasOwnProperty;
var r = (t, e) => R(t, "name", { value: e, configurable: !0 });
var O = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
var de = (t, e, o, n) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let c of me(e))
      !be.call(t, c) && c !== o && R(t, c, { get: () => e[c], enumerable: !(n = le(e, c)) || n.enumerable });
  return t;
};
var A = (t, e, o) => (o = t != null ? ue(ge(t)) : {}, de(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? R(o, "default", { value: t, enumerable: !0 }) : o,
  t
));

// ../node_modules/picocolors/picocolors.js
var C = O((xe, k) => {
  var f = process || {}, _ = f.argv || [], h = f.env || {}, pe = !(h.NO_COLOR || _.includes("--no-color")) && (!!h.FORCE_COLOR || _.includes(
  "--color") || f.platform === "win32" || (f.stdout || {}).isTTY && h.TERM !== "dumb" || !!h.CI), ye = /* @__PURE__ */ r((t, e, o = t) => (n) => {
    let c = "" + n, u = c.indexOf(e, t.length);
    return ~u ? t + he(c, e, o, u) + e : t + c + e;
  }, "formatter"), he = /* @__PURE__ */ r((t, e, o, n) => {
    let c = "", u = 0;
    do
      c += t.substring(u, n) + o, u = n + e.length, n = t.indexOf(e, u);
    while (~n);
    return c + t.substring(u);
  }, "replaceClose"), w = /* @__PURE__ */ r((t = pe) => {
    let e = t ? ye : () => String;
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
  k.exports = w();
  k.exports.createColors = w;
});

// ../node_modules/ts-dedent/dist/index.js
var I = O((y) => {
  "use strict";
  Object.defineProperty(y, "__esModule", { value: !0 });
  y.dedent = void 0;
  function S(t) {
    for (var e = [], o = 1; o < arguments.length; o++)
      e[o - 1] = arguments[o];
    var n = Array.from(typeof t == "string" ? [t] : t);
    n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var c = n.reduce(function(m, E) {
      var p = E.match(/\n([\t ]+|(?!\s).)/g);
      return p ? m.concat(p.map(function(x) {
        var b, d;
        return (d = (b = x.match(/[\t ]/g)) === null || b === void 0 ? void 0 : b.length) !== null && d !== void 0 ? d : 0;
      })) : m;
    }, []);
    if (c.length) {
      var u = new RegExp(`
[	 ]{` + Math.min.apply(Math, c) + "}", "g");
      n = n.map(function(m) {
        return m.replace(u, `
`);
      });
    }
    n[0] = n[0].replace(/^\r?\n/, "");
    var g = n[0];
    return e.forEach(function(m, E) {
      var p = g.match(/(?:^|\n)( *)$/), x = p ? p[1] : "", b = m;
      typeof m == "string" && m.includes(`
`) && (b = String(m).split(`
`).map(function(d, ce) {
        return ce === 0 ? d : "" + x + d;
      }).join(`
`)), g += b + n[E + 1];
    }), g;
  }
  r(S, "dedent");
  y.dedent = S;
  y.default = S;
});

// src/server-errors.ts
var l = A(C(), 1), i = A(I(), 1);

// src/storybook-error.ts
function M({
  code: t,
  category: e
}) {
  let o = String(t).padStart(4, "0");
  return `SB_${e}_${o}`;
}
r(M, "parseErrorCode");
function T(t) {
  if (/^(?!.*storybook\.js\.org)|[?&]ref=error\b/.test(t))
    return t;
  try {
    let e = new URL(t);
    return e.searchParams.set("ref", "error"), e.toString();
  } catch {
    return t;
  }
}
r(T, "appendErrorRef");
var a = class t extends Error {
  constructor(o) {
    super(t.getFullMessage(o));
    /**
     * Data associated with the error. Used to provide additional information in the error message or
     * to be passed to telemetry.
     */
    this.data = {};
    /** Flag used to easily determine if the error originates from Storybook. */
    this.fromStorybook = !0;
    this.category = o.category, this.documentation = o.documentation ?? !1, this.code = o.code;
  }
  static {
    r(this, "StorybookError");
  }
  get fullErrorCode() {
    return M({ code: this.code, category: this.category });
  }
  /** Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>. */
  get name() {
    let o = this.constructor.name;
    return `${this.fullErrorCode} (${o})`;
  }
  /** Generates the error message along with additional documentation link (if applicable). */
  static getFullMessage({
    documentation: o,
    code: n,
    category: c,
    message: u
  }) {
    let g;
    return o === !0 ? g = `https://storybook.js.org/error/${M({ code: n, category: c })}?ref=error` : typeof o == "string" ? g = T(o) : Array.
    isArray(o) && (g = `
${o.map((m) => `	- ${T(m)}`).join(`
`)}`), `${u}${g != null ? `

More info: ${g}
` : ""}`;
  }
};

// src/server-errors.ts
var fe = /* @__PURE__ */ ((s) => (s.CLI = "CLI", s.CLI_INIT = "CLI_INIT", s.CLI_AUTOMIGRATE = "CLI_AUTOMIGRATE", s.CLI_UPGRADE = "CLI_UPGRAD\
E", s.CLI_ADD = "CLI_ADD", s.CODEMOD = "CODEMOD", s.CORE_SERVER = "CORE-SERVER", s.CSF_PLUGIN = "CSF-PLUGIN", s.CSF_TOOLS = "CSF-TOOLS", s.CORE_COMMON =
"CORE-COMMON", s.NODE_LOGGER = "NODE-LOGGER", s.TELEMETRY = "TELEMETRY", s.BUILDER_MANAGER = "BUILDER-MANAGER", s.BUILDER_VITE = "BUILDER-VI\
TE", s.BUILDER_WEBPACK5 = "BUILDER-WEBPACK5", s.SOURCE_LOADER = "SOURCE-LOADER", s.POSTINSTALL = "POSTINSTALL", s.DOCS_TOOLS = "DOCS-TOOLS",
s.CORE_WEBPACK = "CORE-WEBPACK", s.FRAMEWORK_ANGULAR = "FRAMEWORK_ANGULAR", s.FRAMEWORK_EMBER = "FRAMEWORK_EMBER", s.FRAMEWORK_HTML_VITE = "\
FRAMEWORK_HTML-VITE", s.FRAMEWORK_HTML_WEBPACK5 = "FRAMEWORK_HTML-WEBPACK5", s.FRAMEWORK_NEXTJS = "FRAMEWORK_NEXTJS", s.FRAMEWORK_PREACT_VITE =
"FRAMEWORK_PREACT-VITE", s.FRAMEWORK_PREACT_WEBPACK5 = "FRAMEWORK_PREACT-WEBPACK5", s.FRAMEWORK_REACT_VITE = "FRAMEWORK_REACT-VITE", s.FRAMEWORK_REACT_WEBPACK5 =
"FRAMEWORK_REACT-WEBPACK5", s.FRAMEWORK_SERVER_WEBPACK5 = "FRAMEWORK_SERVER-WEBPACK5", s.FRAMEWORK_SVELTE_VITE = "FRAMEWORK_SVELTE-VITE", s.
FRAMEWORK_SVELTEKIT = "FRAMEWORK_SVELTEKIT", s.FRAMEWORK_VUE_VITE = "FRAMEWORK_VUE-VITE", s.FRAMEWORK_VUE_WEBPACK5 = "FRAMEWORK_VUE-WEBPACK5",
s.FRAMEWORK_VUE3_VITE = "FRAMEWORK_VUE3-VITE", s.FRAMEWORK_VUE3_WEBPACK5 = "FRAMEWORK_VUE3-WEBPACK5", s.FRAMEWORK_WEB_COMPONENTS_VITE = "FRA\
MEWORK_WEB-COMPONENTS-VITE", s.FRAMEWORK_WEB_COMPONENTS_WEBPACK5 = "FRAMEWORK_WEB-COMPONENTS-WEBPACK5", s))(fe || {}), W = class extends a {
  static {
    r(this, "NxProjectDetectedError");
  }
  constructor() {
    super({
      category: "CLI_INIT",
      code: 1,
      documentation: "https://nx.dev/nx-api/storybook#generating-storybook-configuration",
      message: i.dedent`
        We have detected Nx in your project. Nx has its own Storybook initializer, so please use it instead.
        Run "nx g @nx/storybook:configuration <your-project-name>" to add Storybook to a given Nx app or lib.`
    });
  }
}, v = class extends a {
  static {
    r(this, "MissingFrameworkFieldError");
  }
  constructor() {
    super({
      category: "CORE-COMMON",
      code: 1,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api",
      message: i.dedent`
        Could not find a 'framework' field in Storybook config.
        
        Please run 'npx storybook automigrate' to automatically fix your config.`
    });
  }
}, K = class extends a {
  constructor(o) {
    super({
      category: "CORE-COMMON",
      code: 2,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api",
      message: i.dedent`
        Invalid value of '${o.frameworkName}' in the 'framework' field of Storybook config.
        
        Please run 'npx storybook automigrate' to automatically fix your config.
      `
    });
    this.data = o;
  }
  static {
    r(this, "InvalidFrameworkNameError");
  }
}, L = class extends a {
  constructor(o) {
    super({
      category: "CORE-COMMON",
      code: 3,
      documentation: "",
      message: i.dedent`
        Could not evaluate the '${o.frameworkName}' package from the 'framework' field of Storybook config.
        
        Are you sure it's a valid package and is installed?`
    });
    this.data = o;
  }
  static {
    r(this, "CouldNotEvaluateFrameworkError");
  }
}, B = class extends a {
  static {
    r(this, "ConflictingStaticDirConfigError");
  }
  constructor() {
    super({
      category: "CORE-SERVER",
      code: 1,
      documentation: "https://storybook.js.org/docs/configure/integration/images-and-assets#serving-static-files-via-storybook-configuration",
      message: i.dedent`
        Storybook encountered a conflict when trying to serve statics. You have configured both:
        * Storybook's option in the config file: 'staticDirs'
        * Storybook's (deprecated) CLI flag: '--staticDir' or '-s'
        
        Please remove the CLI flag from your storybook script and use only the 'staticDirs' option instead.`
    });
  }
}, P = class extends a {
  static {
    r(this, "InvalidStoriesEntryError");
  }
  constructor() {
    super({
      category: "CORE-COMMON",
      code: 4,
      documentation: "https://storybook.js.org/docs/faq#can-i-have-a-storybook-with-no-local-stories",
      message: i.dedent`
        Storybook could not index your stories.
        Your main configuration somehow does not contain a 'stories' field, or it resolved to an empty array.
        
        Please check your main configuration file and make sure it exports a 'stories' field that is not an empty array.`
    });
  }
}, j = class extends a {
  static {
    r(this, "WebpackMissingStatsError");
  }
  constructor() {
    super({
      category: "BUILDER-WEBPACK5",
      code: 1,
      documentation: [
        "https://webpack.js.org/configuration/stats/",
        "https://storybook.js.org/docs/builders/webpack#configure"
      ],
      message: i.dedent`
        No Webpack stats found. Did you turn off stats reporting in your Webpack config?
        Storybook needs Webpack stats (including errors) in order to build correctly.`
    });
  }
}, N = class extends a {
  constructor(o) {
    super({
      category: "BUILDER-WEBPACK5",
      code: 2,
      message: o.error.message.trim()
    });
    this.data = o;
  }
  static {
    r(this, "WebpackInvocationError");
  }
};
function V(t = "") {
  return t.replace(/\u001B\[[0-9;]*m/g, "");
}
r(V, "removeAnsiEscapeCodes");
var $ = class extends a {
  constructor(o) {
    o.errors = o.errors.map((n) => ({
      ...n,
      message: V(n.message),
      stack: V(n.stack),
      name: n.name
    }));
    super({
      category: "BUILDER-WEBPACK5",
      code: 3,
      // This error message is a followup of errors logged by Webpack to the user
      message: i.dedent`
        There were problems when compiling your code with Webpack.
        Run Storybook with --debug-webpack for more information.
      `
    });
    this.data = o;
  }
  static {
    r(this, "WebpackCompilationError");
  }
}, F = class extends a {
  constructor(o) {
    super({
      category: "CLI_INIT",
      code: 2,
      documentation: "https://storybook.js.org/docs/faq#error-no-angularjson-file-found?ref=error",
      message: i.dedent`
        An angular.json file was not found in the current working directory: ${o.path}
        Storybook needs it to work properly, so please rerun the command at the root of your project, where the angular.json file is located.`
    });
    this.data = o;
  }
  static {
    r(this, "MissingAngularJsonError");
  }
}, U = class extends a {
  static {
    r(this, "AngularLegacyBuildOptionsError");
  }
  constructor() {
    super({
      category: "FRAMEWORK_ANGULAR",
      code: 1,
      documentation: [
        "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-drop-support-for-calling-storybook-directly",
        "https://github.com/storybookjs/storybook/tree/next/code/frameworks/angular#how-do-i-migrate-to-an-angular-storybook-builder"
      ],
      message: i.dedent`
        Your Storybook startup script uses a solution that is not supported anymore.
        You must use Angular builder to have an explicit configuration on the project used in angular.json.
        
        Please run 'npx storybook automigrate' to automatically fix your config.`
    });
  }
}, D = class extends a {
  constructor(o) {
    super({
      category: "CORE-SERVER",
      code: 2,
      documentation: "",
      message: i.dedent`
        Storybook failed to load the following preset: ${o.presetName}.
        
        Please check whether your setup is correct, the Storybook dependencies (and their peer dependencies) are installed correctly and there are no package version clashes.
        
        If you believe this is a bug, please open an issue on Github.
        
        ${o.error.stack || o.error.message}`
    });
    this.data = o;
  }
  static {
    r(this, "CriticalPresetLoadError");
  }
}, G = class extends a {
  static {
    r(this, "MissingBuilderError");
  }
  constructor() {
    super({
      category: "CORE-SERVER",
      code: 3,
      documentation: "https://github.com/storybookjs/storybook/issues/24071",
      message: i.dedent`
        Storybook could not find a builder configuration for your project. 
        Builders normally come from a framework package e.g. '@storybook/react-vite', or from builder packages e.g. '@storybook/builder-vite'.
        
        - Does your main config file contain a 'framework' field configured correctly?
        - Is the Storybook framework package installed correctly?
        - If you don't use a framework, does your main config contain a 'core.builder' configured correctly?
        - Are you in a monorepo and perhaps the framework package is hoisted incorrectly?
        
        If you believe this is a bug, please describe your issue in detail on Github.`
    });
  }
}, Y = class extends a {
  constructor(o) {
    super({
      category: "FRAMEWORK_NEXTJS",
      code: 1,
      documentation: "https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization",
      message: i.dedent`
        Failed to fetch \`${o.fontFamily}\` from Google Fonts with URL: \`${o.url}\``
    });
    this.data = o;
  }
  static {
    r(this, "GoogleFontsDownloadError");
  }
}, J = class extends a {
  constructor(o) {
    super({
      category: "FRAMEWORK_NEXTJS",
      code: 2,
      documentation: "https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization",
      message: i.dedent`
        An error occurred when trying to load Google Fonts with URL \`${o.url}\`.
        
        ${o.error instanceof Error ? o.error.message : ""}`
    });
    this.data = o;
  }
  static {
    r(this, "GoogleFontsLoadingError");
  }
}, X = class extends a {
  static {
    r(this, "SvelteViteWithSvelteKitError");
  }
  constructor() {
    super({
      category: "FRAMEWORK_SVELTE-VITE",
      code: 1,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-needs-the-storybooksveltekit-framework",
      message: i.dedent`
        We've detected a SvelteKit project using the @storybook/svelte-vite framework, which is not supported.
        Please use the @storybook/sveltekit framework instead.`
    });
  }
}, H = class extends a {
  constructor(o) {
    super({
      category: "CORE-SERVER",
      code: 4,
      documentation: "",
      message: i.dedent`
        There was an exports mismatch error when trying to build Storybook.
        Please check whether the versions of your Storybook packages match whenever possible, as this might be the cause.
        
        Problematic example:
        { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.4.5", "storybook": "7.3.0" }
        
        Correct example:
        { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.5.3", "storybook": "7.5.3" }
        
        Please run \`npx storybook doctor\` for guidance on how to fix this issue.`
    });
    this.data = o;
  }
  static {
    r(this, "NoMatchingExportError");
  }
}, z = class extends a {
  constructor(o) {
    let n = [
      `Storybook failed to load ${o.location}`,
      "",
      "It looks like the file tried to load/import an ESM only module.",
      `Support for this is currently limited in ${o.location}`,
      "You can import ESM modules in your main file, but only as dynamic import.",
      ""
    ];
    o.line && n.push(
      l.default.white(
        `In your ${l.default.yellow(o.location)} file, line ${l.default.bold(
          l.default.cyan(o.num)
        )} threw an error:`
      ),
      l.default.gray(o.line)
    ), n.push(
      "",
      l.default.white(
        `Convert the static import to a dynamic import ${l.default.underline("where they are used")}.`
      ),
      l.default.white("Example:") + " " + l.default.gray("await import(<your ESM only module>);"),
      ""
    );
    super({
      category: "CORE-SERVER",
      code: 5,
      documentation: "https://github.com/storybookjs/storybook/issues/23972#issuecomment-1948534058",
      message: n.join(`
`)
    });
    this.data = o;
  }
  static {
    r(this, "MainFileESMOnlyImportError");
  }
}, q = class extends a {
  constructor(o) {
    let n = {
      storybook: {
        helperMessage: "You can pass a --config-dir flag to tell Storybook, where your main.js file is located at.",
        documentation: "https://storybook.js.org/docs/configure?ref=error"
      },
      vitest: {
        helperMessage: "You can pass a configDir plugin option to tell where your main.js file is located at.",
        // TODO: add proper docs once available
        documentation: "https://storybook.js.org/docs/configure?ref=error"
      }
    }, { documentation: c, helperMessage: u } = n[o.source || "storybook"];
    super({
      category: "CORE-SERVER",
      code: 6,
      documentation: c,
      message: i.dedent`
        No configuration files have been found in your configDir: ${l.default.yellow(o.location)}.
        Storybook needs a "main.js" file, please add it.
        
        ${u}`
    });
    this.data = o;
  }
  static {
    r(this, "MainFileMissingError");
  }
}, Q = class extends a {
  constructor(o) {
    let n = l.default.white(
      (o.error.stack || o.error.message).replaceAll(process.cwd(), "")
    );
    super({
      category: "CORE-SERVER",
      code: 7,
      message: i.dedent`
        Storybook couldn't evaluate your ${l.default.yellow(o.location)} file.
        
        Original error:
        ${n}`
    });
    this.data = o;
  }
  static {
    r(this, "MainFileEvaluationError");
  }
}, Z = class extends a {
  constructor(o) {
    super({
      category: "CORE-SERVER",
      code: 16,
      message: `Status has typeId "${o.status.typeId}" but was added to store with typeId "${o.typeId}". Full status: ${JSON.stringify(
        o.status,
        null,
        2
      )}`
    });
    this.data = o;
  }
  static {
    r(this, "StatusTypeIdMismatchError");
  }
}, ee = class extends a {
  constructor(o) {
    super({
      category: "CLI_INIT",
      code: 3,
      documentation: "",
      message: i.dedent`
        There was an error while using ${o.packageManager} to create a new ${o.projectType} project.
        
        ${o.error instanceof Error ? o.error.message : ""}`
    });
    this.data = o;
  }
  static {
    r(this, "GenerateNewProjectOnInitError");
  }
}, oe = class extends a {
  constructor(o) {
    super({
      category: "CLI_UPGRADE",
      code: 3,
      message: i.dedent`
        You are trying to upgrade Storybook to a lower version than the version currently installed. This is not supported.
        
        Storybook version ${o.beforeVersion} was detected in your project, but you are trying to "upgrade" to version ${o.currentVersion}.
        
        This usually happens when running the upgrade command without a version specifier, e.g. "npx storybook upgrade".
        This will cause npm to run the globally cached storybook binary, which might be an older version.
        
        Instead you should always run the Storybook CLI with a version specifier to force npm to download the latest version:
        
        "npx storybook@latest upgrade"`
    });
    this.data = o;
  }
  static {
    r(this, "UpgradeStorybookToLowerVersionError");
  }
}, te = class extends a {
  static {
    r(this, "UpgradeStorybookUnknownCurrentVersionError");
  }
  constructor() {
    super({
      category: "CLI_UPGRADE",
      code: 5,
      message: i.dedent`
        We couldn't determine the current version of Storybook in your project.
        
        Are you running the Storybook CLI in a project without Storybook?
        It might help if you specify your Storybook config directory with the --config-dir flag.`
    });
  }
}, re = class extends a {
  static {
    r(this, "NoStatsForViteDevError");
  }
  constructor() {
    super({
      category: "BUILDER-VITE",
      code: 1,
      message: i.dedent`
        Unable to write preview stats as the Vite builder does not support stats in dev mode.
        
        Please remove the \`--stats-json\` flag when running in dev mode.`
    });
  }
}, se = class extends a {
  constructor(o) {
    super({
      category: "CLI",
      code: 1,
      message: i.dedent`
        Unable to find versions of "${o.packageName}" using ${o.packageManager}
        ${o.error && `Reason: ${o.error}`}`
    });
    this.data = o;
  }
  static {
    r(this, "FindPackageVersionsError");
  }
}, ne = class extends a {
  constructor(o) {
    super({
      category: "FRAMEWORK_NEXTJS",
      code: 3,
      message: i.dedent`
        Incompatible PostCSS configuration format detected.

        Next.js uses an array-based format for plugins which is not compatible with Vite:
        
        // ❌ Incompatible format (used by Next.js)
        const config = {
          plugins: ["@tailwindcss/postcss"],
        };
        
        Please transform your PostCSS config to use the object-based format, which is compatible with Next.js and Vite:
        
        // ✅ Compatible format (works with Next.js and Vite)
        const config = {
          plugins: {
            "@tailwindcss/postcss": {},
          },
        };
        
        Original error: ${o.error.message}
      `
    });
    this.data = o;
  }
  static {
    r(this, "IncompatiblePostCssConfigError");
  }
}, ae = class extends a {
  constructor(o) {
    super({
      category: "CORE-SERVER",
      code: 1,
      message: i.dedent`
        Unable to save global settings file to ${o.filePath}
        ${o.error && `Reason: ${o.error}`}`
    });
    this.data = o;
  }
  static {
    r(this, "SavingGlobalSettingsFileError");
  }
}, ie = class extends a {
  static {
    r(this, "CommonJsConfigNotSupportedError");
  }
  constructor() {
    super({
      category: "CLI_AUTOMIGRATE",
      code: 1,
      documentation: "https://storybook.js.org/docs/configure/overview?ref=error#es-modules",
      message: i.dedent`
        Support for CommonJS Storybook config files has been removed in Storybook 10.0.0.
        Please migrate your config to a valid ESM file.
        
        CommonJS files (ending in .cjs, .cts, .cjsx, .ctsx) or files containing 'module.exports' are no longer supported.
        Please convert your config to use ES modules (import/export syntax).`
    });
  }
};
export {
  U as AngularLegacyBuildOptionsError,
  fe as Category,
  ie as CommonJsConfigNotSupportedError,
  B as ConflictingStaticDirConfigError,
  L as CouldNotEvaluateFrameworkError,
  D as CriticalPresetLoadError,
  se as FindPackageVersionsError,
  ee as GenerateNewProjectOnInitError,
  Y as GoogleFontsDownloadError,
  J as GoogleFontsLoadingError,
  ne as IncompatiblePostCssConfigError,
  K as InvalidFrameworkNameError,
  P as InvalidStoriesEntryError,
  z as MainFileESMOnlyImportError,
  Q as MainFileEvaluationError,
  q as MainFileMissingError,
  F as MissingAngularJsonError,
  G as MissingBuilderError,
  v as MissingFrameworkFieldError,
  H as NoMatchingExportError,
  re as NoStatsForViteDevError,
  W as NxProjectDetectedError,
  ae as SavingGlobalSettingsFileError,
  Z as StatusTypeIdMismatchError,
  X as SvelteViteWithSvelteKitError,
  oe as UpgradeStorybookToLowerVersionError,
  te as UpgradeStorybookUnknownCurrentVersionError,
  $ as WebpackCompilationError,
  N as WebpackInvocationError,
  j as WebpackMissingStatsError
};
