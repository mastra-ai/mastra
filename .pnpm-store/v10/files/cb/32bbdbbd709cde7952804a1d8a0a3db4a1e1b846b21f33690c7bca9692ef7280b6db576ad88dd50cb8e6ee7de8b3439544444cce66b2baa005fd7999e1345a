"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  minify: () => minify
});
module.exports = __toCommonJS(index_exports);
var import_fs2 = require("fs");
var import_path2 = require("path");
var import_esbuild4 = require("esbuild");
var import_unplugin_utils = require("unplugin-utils");
var import_debug = __toESM(require("debug"));

// src/minify.ts
var import_esbuild2 = require("esbuild");

// src/warn.ts
var import_esbuild = require("esbuild");
var warn = async (pluginContext, messages) => {
  if (messages.length > 0) {
    const warnings = await (0, import_esbuild.formatMessages)(messages, {
      kind: "warning",
      color: true
    });
    warnings.forEach((warning) => pluginContext.warn(warning));
  }
};

// src/minify.ts
var getEsbuildFormat = (rollupFormat) => {
  if (rollupFormat === "es") {
    return "esm";
  }
  if (rollupFormat === "cjs") {
    return rollupFormat;
  }
};
var getRenderChunk = ({
  sourceMap = true,
  ...options
}) => async function(code, _, rollupOptions) {
  if (options.minify || options.minifyWhitespace || options.minifyIdentifiers || options.minifySyntax) {
    const format = getEsbuildFormat(rollupOptions.format);
    const result = await (0, import_esbuild2.transform)(code, {
      format,
      loader: "js",
      sourcemap: sourceMap,
      ...options
    });
    await warn(this, result.warnings);
    if (result.code) {
      return {
        code: result.code,
        map: result.map || null
      };
    }
  }
  return null;
};
var minify = ({
  sourceMap = true,
  ...options
} = {}) => {
  return {
    name: "esbuild-minify",
    renderChunk: getRenderChunk({
      minify: true,
      ...options,
      sourceMap
    })
  };
};

// src/optimizer/optmize-deps.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_esbuild3 = require("esbuild");
var esModuleLexer = __toESM(require("es-module-lexer"));
var slash = (p) => p.replace(/\\/g, "/");
var optimizeDeps = async (options) => {
  var _a;
  const cacheDir = import_path.default.join(options.cwd, "node_modules/.optimize_deps");
  await import_fs.default.promises.mkdir(cacheDir, { recursive: true });
  await esModuleLexer.init;
  await (0, import_esbuild3.build)({
    entryPoints: options.include,
    absWorkingDir: options.cwd,
    bundle: true,
    format: "esm",
    ignoreAnnotations: true,
    metafile: true,
    splitting: true,
    outdir: cacheDir,
    sourcemap: options.sourceMap,
    ...options.esbuildOptions,
    plugins: [
      {
        name: "optimize-deps",
        async setup(build2) {
          build2.onResolve({ filter: /.*/ }, async (args) => {
            var _a2, _b;
            if ((_a2 = options.exclude) == null ? void 0 : _a2.includes(args.path)) {
              return {
                external: true
              };
            }
            if ((_b = args.pluginData) == null ? void 0 : _b.__resolving_dep_path__) {
              return;
            }
            if (options.include.includes(args.path)) {
              const resolved = await build2.resolve(args.path, {
                resolveDir: args.resolveDir,
                kind: "import-statement",
                pluginData: { __resolving_dep_path__: true }
              });
              if (resolved.errors.length > 0 || resolved.warnings.length > 0) {
                return resolved;
              }
              return {
                path: args.path,
                namespace: "optimize-deps",
                pluginData: {
                  resolveDir: args.resolveDir,
                  absolute: resolved.path
                }
              };
            }
          });
          build2.onLoad(
            { filter: /.*/, namespace: "optimize-deps" },
            async (args) => {
              const { absolute, resolveDir } = args.pluginData;
              const contents = await import_fs.default.promises.readFile(absolute, "utf-8");
              const [, exported] = esModuleLexer.parse(contents);
              return {
                contents: exported.length > 0 ? `export * from '${slash(absolute)}'` : `module.exports = require('${slash(absolute)}')`,
                resolveDir
              };
            }
          );
        }
      },
      ...((_a = options.esbuildOptions) == null ? void 0 : _a.plugins) || []
    ]
  });
  const optimized = /* @__PURE__ */ new Map();
  for (const id of options.include) {
    optimized.set(id, { file: import_path.default.join(cacheDir, `${id}.js`) });
  }
  return {
    optimized,
    cacheDir
  };
};

// src/tsconfig.ts
var import_get_tsconfig = require("get-tsconfig");
var cache = /* @__PURE__ */ new Map();
function getTsconfig(searchPath, configName) {
  var _a;
  return (_a = (0, import_get_tsconfig.getTsconfig)(searchPath, configName, cache)) == null ? void 0 : _a.config;
}

// src/index.ts
var debugOptimizeDeps = (0, import_debug.default)("rpe:optimize-deps");
var defaultLoaders = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx"
};
var index_default = ({
  include,
  exclude,
  sourceMap = true,
  optimizeDeps: optimizeDeps2,
  tsconfig,
  loaders: _loaders,
  ...esbuildOptions
} = {}) => {
  const loaders = {
    ...defaultLoaders
  };
  if (_loaders) {
    for (let [key, value] of Object.entries(_loaders)) {
      key = key[0] === "." ? key : `.${key}`;
      if (typeof value === "string") {
        loaders[key] = value;
      } else if (value === false) {
        delete loaders[key];
      }
    }
  }
  const extensions = Object.keys(loaders);
  const INCLUDE_REGEXP = new RegExp(
    `\\.(${extensions.map((ext) => ext.slice(1)).join("|")})$`
  );
  const EXCLUDE_REGEXP = /node_modules/;
  const filter = (0, import_unplugin_utils.createFilter)(
    include || INCLUDE_REGEXP,
    exclude || EXCLUDE_REGEXP
  );
  const resolveFile = (resolved, index = false) => {
    const fileWithoutExt = resolved.replace(/\.[jt]sx?$/, "");
    for (const ext of extensions) {
      const file = index ? (0, import_path2.join)(resolved, `index${ext}`) : `${fileWithoutExt}${ext}`;
      if ((0, import_fs2.existsSync)(file)) return file;
    }
    return null;
  };
  let optimizeDepsResult;
  let cwd = process.cwd();
  return {
    name: "esbuild",
    options({ context }) {
      if (context) {
        cwd = context;
      }
      return null;
    },
    async buildStart() {
      if (!optimizeDeps2 || optimizeDepsResult) return;
      optimizeDepsResult = await optimizeDeps({
        cwd,
        sourceMap,
        ...optimizeDeps2
      });
      debugOptimizeDeps("optimized %O", optimizeDepsResult.optimized);
    },
    async resolveId(id, importer) {
      if (optimizeDepsResult == null ? void 0 : optimizeDepsResult.optimized.has(id)) {
        const m = optimizeDepsResult.optimized.get(id);
        debugOptimizeDeps("resolved %s to %s", id, m.file);
        return m.file;
      }
      if (importer && id[0] === ".") {
        const resolved = (0, import_path2.resolve)(
          importer ? (0, import_path2.dirname)(importer) : process.cwd(),
          id
        );
        let file = resolveFile(resolved);
        if (file) return file;
        if (!file && (0, import_fs2.existsSync)(resolved) && (0, import_fs2.statSync)(resolved).isDirectory()) {
          file = resolveFile(resolved, true);
          if (file) return file;
        }
      }
    },
    async transform(code, id) {
      if (!filter(id) || (optimizeDepsResult == null ? void 0 : optimizeDepsResult.optimized.has(id))) {
        return null;
      }
      const ext = (0, import_path2.extname)(id);
      const loader = loaders[ext];
      if (!loader) {
        return null;
      }
      const tsconfigRaw = tsconfig === false ? void 0 : getTsconfig(id, tsconfig || "tsconfig.json");
      const result = await (0, import_esbuild4.transform)(code, {
        loader,
        sourcemap: sourceMap,
        sourcefile: id,
        tsconfigRaw,
        target: "es2020",
        format: [
          "base64",
          "binary",
          "dataurl",
          "text",
          "json"
        ].includes(loader) ? "esm" : void 0,
        ...esbuildOptions
      });
      await warn(this, result.warnings);
      return result.code && {
        code: result.code,
        map: result.map || null
      };
    },
    renderChunk: getRenderChunk({
      ...esbuildOptions,
      sourceMap
    })
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  minify
});
