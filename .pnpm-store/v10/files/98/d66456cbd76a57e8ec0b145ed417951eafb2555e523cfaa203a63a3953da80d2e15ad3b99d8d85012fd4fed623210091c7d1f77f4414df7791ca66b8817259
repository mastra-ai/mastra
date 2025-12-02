// src/index.ts
import { existsSync, statSync } from "fs";
import { extname, resolve, dirname, join } from "path";
import { transform as transform2 } from "esbuild";
import { createFilter } from "unplugin-utils";
import createDebug from "debug";

// src/minify.ts
import { transform } from "esbuild";

// src/warn.ts
import { formatMessages } from "esbuild";
var warn = async (pluginContext, messages) => {
  if (messages.length > 0) {
    const warnings = await formatMessages(messages, {
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
    const result = await transform(code, {
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
import fs from "fs";
import path from "path";
import { build } from "esbuild";
import * as esModuleLexer from "es-module-lexer";
var slash = (p) => p.replace(/\\/g, "/");
var optimizeDeps = async (options) => {
  var _a;
  const cacheDir = path.join(options.cwd, "node_modules/.optimize_deps");
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await esModuleLexer.init;
  await build({
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
              const contents = await fs.promises.readFile(absolute, "utf-8");
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
    optimized.set(id, { file: path.join(cacheDir, `${id}.js`) });
  }
  return {
    optimized,
    cacheDir
  };
};

// src/tsconfig.ts
import {
  getTsconfig as findTsconfig
} from "get-tsconfig";
var cache = /* @__PURE__ */ new Map();
function getTsconfig(searchPath, configName) {
  var _a;
  return (_a = findTsconfig(searchPath, configName, cache)) == null ? void 0 : _a.config;
}

// src/index.ts
var debugOptimizeDeps = createDebug("rpe:optimize-deps");
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
  const filter = createFilter(
    include || INCLUDE_REGEXP,
    exclude || EXCLUDE_REGEXP
  );
  const resolveFile = (resolved, index = false) => {
    const fileWithoutExt = resolved.replace(/\.[jt]sx?$/, "");
    for (const ext of extensions) {
      const file = index ? join(resolved, `index${ext}`) : `${fileWithoutExt}${ext}`;
      if (existsSync(file)) return file;
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
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          id
        );
        let file = resolveFile(resolved);
        if (file) return file;
        if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
          file = resolveFile(resolved, true);
          if (file) return file;
        }
      }
    },
    async transform(code, id) {
      if (!filter(id) || (optimizeDepsResult == null ? void 0 : optimizeDepsResult.optimized.has(id))) {
        return null;
      }
      const ext = extname(id);
      const loader = loaders[ext];
      if (!loader) {
        return null;
      }
      const tsconfigRaw = tsconfig === false ? void 0 : getTsconfig(id, tsconfig || "tsconfig.json");
      const result = await transform2(code, {
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
export {
  index_default as default,
  minify
};
