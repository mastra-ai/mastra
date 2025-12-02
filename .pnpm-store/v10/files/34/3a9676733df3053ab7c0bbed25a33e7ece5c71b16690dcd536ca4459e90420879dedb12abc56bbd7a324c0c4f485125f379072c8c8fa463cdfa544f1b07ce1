"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } var _class;

var _chunkU46XF7P4js = require('./chunk-U46XF7P4.js');









var _chunkVGC3FXLUjs = require('./chunk-VGC3FXLU.js');



var _chunkJZ25TPTYjs = require('./chunk-JZ25TPTY.js');
















var _chunkTWFEYLU4js = require('./chunk-TWFEYLU4.js');

// src/index.ts
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _worker_threads = require('worker_threads');
var _bundlerequire = require('bundle-require');
var _tinyexec = require('tinyexec');
var _tinyglobby = require('tinyglobby');
var _treekill = require('tree-kill'); var _treekill2 = _interopRequireDefault(_treekill);

// src/esbuild/index.ts





var _esbuild = require('esbuild');
var _consola = require('consola'); var _consola2 = _interopRequireDefault(_consola);

// src/esbuild/node-protocol.ts
var nodeProtocolPlugin = () => {
  const nodeProtocol = "node:";
  return {
    name: "node-protocol-plugin",
    setup({ onResolve }) {
      onResolve(
        {
          filter: /^node:/
        },
        ({ path: path12 }) => ({
          path: path12.slice(nodeProtocol.length),
          external: true
        })
      );
    }
  };
};

// src/esbuild/external.ts

var NON_NODE_MODULE_RE = /^[A-Z]:[/\\]|^\.{0,2}\/|^\.{1,2}$/;
var externalPlugin = ({
  external,
  noExternal,
  skipNodeModulesBundle,
  tsconfigResolvePaths
}) => {
  return {
    name: `external`,
    setup(build2) {
      if (skipNodeModulesBundle) {
        const resolvePatterns = _bundlerequire.tsconfigPathsToRegExp.call(void 0, 
          tsconfigResolvePaths || {}
        );
        build2.onResolve({ filter: /.*/ }, (args) => {
          if (_bundlerequire.match.call(void 0, args.path, resolvePatterns)) {
            return;
          }
          if (_bundlerequire.match.call(void 0, args.path, noExternal)) {
            return;
          }
          if (_bundlerequire.match.call(void 0, args.path, external)) {
            return { external: true };
          }
          if (!NON_NODE_MODULE_RE.test(args.path)) {
            return {
              path: args.path,
              external: true
            };
          }
        });
      } else {
        build2.onResolve({ filter: /.*/ }, (args) => {
          if (_bundlerequire.match.call(void 0, args.path, noExternal)) {
            return;
          }
          if (_bundlerequire.match.call(void 0, args.path, external)) {
            return { external: true };
          }
        });
      }
    }
  };
};

// src/esbuild/postcss.ts


var postcssPlugin = ({
  css,
  inject,
  cssLoader
}) => {
  return {
    name: "postcss",
    setup(build2) {
      let configCache;
      const getPostcssConfig = async () => {
        const loadConfig = _chunkTWFEYLU4js.__require.call(void 0, "postcss-load-config");
        if (configCache) {
          return configCache;
        }
        try {
          const result = await loadConfig({}, process.cwd());
          configCache = result;
          return result;
        } catch (error) {
          if (error.message.includes("No PostCSS Config found in")) {
            const result = { plugins: [], options: {} };
            return result;
          }
          throw error;
        }
      };
      build2.onResolve({ filter: /^#style-inject$/ }, () => {
        return { path: "#style-inject", namespace: "#style-inject" };
      });
      build2.onLoad(
        { filter: /^#style-inject$/, namespace: "#style-inject" },
        () => {
          return {
            // Taken from https://github.com/egoist/style-inject/blob/master/src/index.js (MIT)
            contents: `
          export default function styleInject(css, { insertAt } = {}) {
            if (!css || typeof document === 'undefined') return
          
            const head = document.head || document.getElementsByTagName('head')[0]
            const style = document.createElement('style')
            style.type = 'text/css'
          
            if (insertAt === 'top') {
              if (head.firstChild) {
                head.insertBefore(style, head.firstChild)
              } else {
                head.appendChild(style)
              }
            } else {
              head.appendChild(style)
            }
          
            if (style.styleSheet) {
              style.styleSheet.cssText = css
            } else {
              style.appendChild(document.createTextNode(css))
            }
          }
          `,
            loader: "js"
          };
        }
      );
      build2.onLoad({ filter: /\.css$/ }, async (args) => {
        let contents;
        if (css && args.path.endsWith(".svelte.css")) {
          contents = css.get(args.path);
        } else {
          contents = await _fs2.default.promises.readFile(args.path, "utf8");
        }
        const { plugins, options } = await getPostcssConfig();
        if (plugins && plugins.length > 0) {
          const postcss = _chunkTWFEYLU4js.getPostcss.call(void 0, );
          if (!postcss) {
            return {
              errors: [
                {
                  text: `postcss is not installed`
                }
              ]
            };
          }
          const result = await _optionalChain([postcss, 'optionalAccess', _2 => _2.default, 'call', _3 => _3(plugins), 'access', _4 => _4.process, 'call', _5 => _5(contents, { ...options, from: args.path })]);
          contents = result.css;
        }
        if (inject) {
          contents = (await _esbuild.transform.call(void 0, contents, {
            minify: build2.initialOptions.minify,
            minifyIdentifiers: build2.initialOptions.minifyIdentifiers,
            minifySyntax: build2.initialOptions.minifySyntax,
            minifyWhitespace: build2.initialOptions.minifyWhitespace,
            logLevel: build2.initialOptions.logLevel,
            loader: "css"
          })).code;
          contents = typeof inject === "function" ? await inject(JSON.stringify(contents), args.path) : `import styleInject from '#style-inject';styleInject(${JSON.stringify(
            contents
          )})`;
          return {
            contents,
            loader: "js"
          };
        }
        return {
          contents,
          loader: _nullishCoalesce(cssLoader, () => ( "css"))
        };
      });
    }
  };
};

// src/esbuild/svelte.ts



var useSvelteCssExtension = (p) => p.replace(/\.svelte$/, ".svelte.css");
var sveltePlugin = ({
  css
}) => {
  return {
    name: "svelte",
    setup(build2) {
      let svelte;
      let sveltePreprocessor;
      build2.onResolve({ filter: /\.svelte\.css$/ }, (args) => {
        return {
          path: _path2.default.relative(
            process.cwd(),
            _path2.default.join(args.resolveDir, args.path)
          ),
          namespace: "svelte-css"
        };
      });
      build2.onLoad({ filter: /\.svelte$/ }, async (args) => {
        svelte = svelte || _chunkTWFEYLU4js.localRequire.call(void 0, "svelte/compiler");
        sveltePreprocessor = sveltePreprocessor || _chunkTWFEYLU4js.localRequire.call(void 0, "svelte-preprocess");
        if (!svelte) {
          return {
            errors: [{ text: `You need to install "svelte" in your project` }]
          };
        }
        const convertMessage = ({ message, start, end }) => {
          let location;
          if (start && end) {
            const lineText = source.split(/\r\n|\r|\n/g)[start.line - 1];
            const lineEnd = start.line === end.line ? end.column : lineText.length;
            location = {
              file: filename,
              line: start.line,
              column: start.column,
              length: lineEnd - start.column,
              lineText
            };
          }
          return { text: message, location };
        };
        const source = await _fs2.default.promises.readFile(args.path, "utf8");
        const filename = _path2.default.relative(process.cwd(), args.path);
        try {
          const preprocess = await svelte.preprocess(
            source,
            sveltePreprocessor ? sveltePreprocessor({
              sourceMap: true,
              typescript: {
                compilerOptions: {
                  verbatimModuleSyntax: true
                }
              }
            }) : {
              async script({ content, attributes }) {
                if (attributes.lang !== "ts") return { code: content };
                const { code, map } = await _esbuild.transform.call(void 0, content, {
                  sourcefile: args.path,
                  loader: "ts",
                  sourcemap: true,
                  tsconfigRaw: {
                    compilerOptions: {
                      verbatimModuleSyntax: true
                    }
                  },
                  logLevel: build2.initialOptions.logLevel
                });
                return {
                  code,
                  map
                };
              }
            },
            {
              filename: args.path
            }
          );
          const result = svelte.compile(preprocess.code, {
            filename,
            css: "external"
          });
          let contents = result.js.code;
          if (css && result.css && result.css.code) {
            const cssPath = useSvelteCssExtension(filename);
            css.set(cssPath, result.css.code);
            contents = `import '${useSvelteCssExtension(_path2.default.basename(args.path))}';${contents}`;
          }
          return { contents, warnings: result.warnings.map(convertMessage) };
        } catch (error) {
          return { errors: [convertMessage(error)] };
        }
      });
    }
  };
};

// src/esbuild/swc.ts

var swcPlugin = ({ logger: logger3, ...swcOptions }) => {
  return {
    name: "swc",
    setup(build2) {
      const swc = _chunkTWFEYLU4js.localRequire.call(void 0, "@swc/core");
      if (!swc) {
        logger3.warn(
          build2.initialOptions.format,
          `You have emitDecoratorMetadata enabled but @swc/core was not installed, skipping swc plugin`
        );
        return;
      }
      build2.initialOptions.keepNames = true;
      build2.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        const isTs = /\.tsx?$/.test(args.path);
        const jsc = {
          ...swcOptions.jsc,
          parser: {
            ..._optionalChain([swcOptions, 'access', _6 => _6.jsc, 'optionalAccess', _7 => _7.parser]),
            syntax: isTs ? "typescript" : "ecmascript",
            decorators: true
          },
          transform: {
            ..._optionalChain([swcOptions, 'access', _8 => _8.jsc, 'optionalAccess', _9 => _9.transform]),
            legacyDecorator: true,
            decoratorMetadata: true
          },
          keepClassNames: true,
          target: "es2022"
        };
        const result = await swc.transformFile(args.path, {
          ...swcOptions,
          jsc,
          sourceMaps: true,
          configFile: false,
          swcrc: _nullishCoalesce(swcOptions.swcrc, () => ( false))
        });
        let code = result.code;
        if (result.map) {
          const map = JSON.parse(result.map);
          map.sources = map.sources.map((source) => {
            return _path2.default.isAbsolute(source) ? _path2.default.relative(_path2.default.dirname(args.path), source) : source;
          });
          code += `//# sourceMappingURL=data:application/json;base64,${Buffer.from(
            JSON.stringify(map)
          ).toString("base64")}`;
        }
        return {
          contents: code
        };
      });
    }
  };
};

// src/esbuild/native-node-module.ts

var nativeNodeModulesPlugin = () => {
  return {
    name: "native-node-modules",
    setup(build2) {
      build2.onResolve({ filter: /\.node$/, namespace: "file" }, (args) => {
        const resolvedId = _chunkTWFEYLU4js.__require.resolve(args.path, {
          paths: [args.resolveDir]
        });
        if (resolvedId.endsWith(".node")) {
          return {
            path: resolvedId,
            namespace: "node-file"
          };
        }
        return {
          path: resolvedId
        };
      });
      build2.onLoad({ filter: /.*/, namespace: "node-file" }, (args) => {
        return {
          contents: `
            import path from ${JSON.stringify(args.path)}
            try { module.exports = require(path) }
            catch {}
          `,
          resolveDir: _path2.default.dirname(args.path)
        };
      });
      build2.onResolve(
        { filter: /\.node$/, namespace: "node-file" },
        (args) => ({
          path: args.path,
          namespace: "file"
        })
      );
      const opts = build2.initialOptions;
      opts.loader = opts.loader || {};
      opts.loader[".node"] = "file";
    }
  };
};

// src/esbuild/index.ts
var getOutputExtensionMap = (options, format, pkgType) => {
  const outExtension = options.outExtension || _chunkTWFEYLU4js.defaultOutExtension;
  const defaultExtension = _chunkTWFEYLU4js.defaultOutExtension.call(void 0, { format, pkgType });
  const extension = outExtension({ options, format, pkgType });
  return {
    ".js": extension.js || defaultExtension.js
  };
};
var generateExternal = async (external) => {
  const result = [];
  for (const item of external) {
    if (typeof item !== "string" || !item.endsWith("package.json")) {
      result.push(item);
      continue;
    }
    const pkgPath = _path2.default.isAbsolute(item) ? _path2.default.dirname(item) : _path2.default.dirname(_path2.default.resolve(process.cwd(), item));
    const deps = await _chunkVGC3FXLUjs.getProductionDeps.call(void 0, pkgPath);
    result.push(...deps);
  }
  return result;
};
async function runEsbuild(options, {
  format,
  css,
  logger: logger3,
  buildDependencies,
  pluginContainer
}) {
  const pkg = await _chunkVGC3FXLUjs.loadPkg.call(void 0, process.cwd());
  const deps = await _chunkVGC3FXLUjs.getProductionDeps.call(void 0, process.cwd());
  const external = [
    // Exclude dependencies, e.g. `lodash`, `lodash/get`
    ...deps.map((dep) => new RegExp(`^${dep}($|\\/|\\\\)`)),
    ...await generateExternal(options.external || [])
  ];
  const outDir = options.outDir;
  const outExtension = getOutputExtensionMap(options, format, pkg.type);
  const env = {
    ...options.env
  };
  if (options.replaceNodeEnv) {
    env.NODE_ENV = options.minify || options.minifyWhitespace ? "production" : "development";
  }
  logger3.info(format, "Build start");
  const startTime = Date.now();
  let result;
  const splitting = format === "iife" ? false : typeof options.splitting === "boolean" ? options.splitting : format === "esm";
  const platform = options.platform || "node";
  const loader = options.loader || {};
  const injectShims = options.shims;
  pluginContainer.setContext({
    format,
    splitting,
    options,
    logger: logger3
  });
  await pluginContainer.buildStarted();
  const esbuildPlugins = [
    options.removeNodeProtocol && nodeProtocolPlugin(),
    {
      name: "modify-options",
      setup(build2) {
        pluginContainer.modifyEsbuildOptions(build2.initialOptions);
        if (options.esbuildOptions) {
          options.esbuildOptions(build2.initialOptions, { format });
        }
      }
    },
    // esbuild's `external` option doesn't support RegExp
    // So here we use a custom plugin to implement it
    format !== "iife" && externalPlugin({
      external,
      noExternal: options.noExternal,
      skipNodeModulesBundle: options.skipNodeModulesBundle,
      tsconfigResolvePaths: options.tsconfigResolvePaths
    }),
    options.tsconfigDecoratorMetadata && swcPlugin({ ...options.swc, logger: logger3 }),
    nativeNodeModulesPlugin(),
    postcssPlugin({
      css,
      inject: options.injectStyle,
      cssLoader: loader[".css"]
    }),
    sveltePlugin({ css }),
    ...options.esbuildPlugins || []
  ];
  const banner = typeof options.banner === "function" ? options.banner({ format }) : options.banner;
  const footer = typeof options.footer === "function" ? options.footer({ format }) : options.footer;
  try {
    result = await _esbuild.build.call(void 0, {
      entryPoints: options.entry,
      format: format === "cjs" && splitting || options.treeshake ? "esm" : format,
      bundle: typeof options.bundle === "undefined" ? true : options.bundle,
      platform,
      globalName: options.globalName,
      jsxFactory: options.jsxFactory,
      jsxFragment: options.jsxFragment,
      sourcemap: options.sourcemap ? "external" : false,
      target: options.target,
      banner,
      footer,
      tsconfig: options.tsconfig,
      loader: {
        ".aac": "file",
        ".css": "file",
        ".eot": "file",
        ".flac": "file",
        ".gif": "file",
        ".jpeg": "file",
        ".jpg": "file",
        ".mp3": "file",
        ".mp4": "file",
        ".ogg": "file",
        ".otf": "file",
        ".png": "file",
        ".svg": "file",
        ".ttf": "file",
        ".wav": "file",
        ".webm": "file",
        ".webp": "file",
        ".woff": "file",
        ".woff2": "file",
        ...loader
      },
      mainFields: platform === "node" ? ["module", "main"] : ["browser", "module", "main"],
      plugins: esbuildPlugins.filter(_chunkTWFEYLU4js.truthy),
      define: {
        TSUP_FORMAT: JSON.stringify(format),
        ...format === "cjs" && injectShims ? {
          "import.meta.url": "importMetaUrl"
        } : {},
        ...options.define,
        ...Object.keys(env).reduce((res, key) => {
          const value = JSON.stringify(env[key]);
          return {
            ...res,
            [`process.env.${key}`]: value,
            [`import.meta.env.${key}`]: value
          };
        }, {})
      },
      inject: [
        format === "cjs" && injectShims ? _path2.default.join(__dirname, "../assets/cjs_shims.js") : "",
        format === "esm" && injectShims && platform === "node" ? _path2.default.join(__dirname, "../assets/esm_shims.js") : "",
        ...options.inject || []
      ].filter(Boolean),
      outdir: options.legacyOutput && format !== "cjs" ? _path2.default.join(outDir, format) : outDir,
      outExtension: options.legacyOutput ? void 0 : outExtension,
      write: false,
      splitting,
      logLevel: "error",
      minify: options.minify === "terser" ? false : options.minify,
      minifyWhitespace: options.minifyWhitespace,
      minifyIdentifiers: options.minifyIdentifiers,
      minifySyntax: options.minifySyntax,
      keepNames: options.keepNames,
      pure: typeof options.pure === "string" ? [options.pure] : options.pure,
      metafile: true
    });
  } catch (error) {
    logger3.error(format, "Build failed");
    throw error;
  }
  if (result && result.warnings && !_chunkVGC3FXLUjs.getSilent.call(void 0, )) {
    const messages = result.warnings.filter((warning) => {
      if (warning.text.includes(
        `This call to "require" will not be bundled because`
      ) || warning.text.includes(`Indirect calls to "require" will not be bundled`))
        return false;
      return true;
    });
    const formatted = await _esbuild.formatMessages.call(void 0, messages, {
      kind: "warning",
      color: true
    });
    formatted.forEach((message) => {
      _consola2.default.warn(message);
    });
  }
  if (result && result.outputFiles) {
    await pluginContainer.buildFinished({
      outputFiles: result.outputFiles,
      metafile: result.metafile
    });
    const timeInMs = Date.now() - startTime;
    logger3.success(format, `\u26A1\uFE0F Build success in ${Math.floor(timeInMs)}ms`);
  }
  if (result.metafile) {
    for (const file of Object.keys(result.metafile.inputs)) {
      buildDependencies.add(file);
    }
    if (options.metafile) {
      const outPath = _path2.default.resolve(outDir, `metafile-${format}.json`);
      await _fs2.default.promises.mkdir(_path2.default.dirname(outPath), { recursive: true });
      await _fs2.default.promises.writeFile(
        outPath,
        JSON.stringify(result.metafile),
        "utf8"
      );
    }
  }
}

// src/plugins/shebang.ts
var shebang = () => {
  return {
    name: "shebang",
    renderChunk(_, info) {
      if (info.type === "chunk" && /\.(cjs|js|mjs)$/.test(info.path) && info.code.startsWith("#!")) {
        info.mode = 493;
      }
    }
  };
};

// src/plugins/cjs-splitting.ts
var cjsSplitting = () => {
  return {
    name: "cjs-splitting",
    async renderChunk(code, info) {
      if (!this.splitting || this.options.treeshake || // <-- handled by rollup
      this.format !== "cjs" || info.type !== "chunk" || !/\.(js|cjs)$/.test(info.path)) {
        return;
      }
      const { transform: transform3 } = await Promise.resolve().then(() => _interopRequireWildcard(require("sucrase")));
      const result = transform3(code, {
        filePath: info.path,
        transforms: ["imports"],
        sourceMapOptions: this.options.sourcemap ? {
          compiledFilename: info.path
        } : void 0
      });
      return {
        code: result.code,
        map: result.sourceMap
      };
    }
  };
};

// src/plugin.ts




var _sourcemap = require('source-map');

// src/fs.ts


var outputFile = async (filepath, data, options) => {
  await _fs2.default.promises.mkdir(_path2.default.dirname(filepath), { recursive: true });
  await _fs2.default.promises.writeFile(filepath, data, options);
};
function copyDirSync(srcDir, destDir) {
  if (!_fs2.default.existsSync(srcDir)) return;
  _fs2.default.mkdirSync(destDir, { recursive: true });
  for (const file of _fs2.default.readdirSync(srcDir)) {
    const srcFile = _path2.default.resolve(srcDir, file);
    if (srcFile === destDir) {
      continue;
    }
    const destFile = _path2.default.resolve(destDir, file);
    const stat = _fs2.default.statSync(srcFile);
    if (stat.isDirectory()) {
      copyDirSync(srcFile, destFile);
    } else {
      _fs2.default.copyFileSync(srcFile, destFile);
    }
  }
}

// src/plugin.ts
var parseSourceMap = (map) => {
  return typeof map === "string" ? JSON.parse(map) : map;
};
var isJS = (path12) => /\.(js|mjs|cjs)$/.test(path12);
var isCSS = (path12) => /\.css$/.test(path12);
var PluginContainer = class {
  
  
  constructor(plugins) {
    this.plugins = plugins;
  }
  setContext(context) {
    this.context = context;
  }
  getContext() {
    if (!this.context) throw new Error(`Plugin context is not set`);
    return this.context;
  }
  modifyEsbuildOptions(options) {
    for (const plugin of this.plugins) {
      if (plugin.esbuildOptions) {
        plugin.esbuildOptions.call(this.getContext(), options);
      }
    }
  }
  async buildStarted() {
    for (const plugin of this.plugins) {
      if (plugin.buildStart) {
        await plugin.buildStart.call(this.getContext());
      }
    }
  }
  async buildFinished({
    outputFiles,
    metafile
  }) {
    const files = outputFiles.filter((file) => !file.path.endsWith(".map")).map((file) => {
      if (isJS(file.path) || isCSS(file.path)) {
        const relativePath = _chunkTWFEYLU4js.slash.call(void 0, _path2.default.relative(process.cwd(), file.path));
        const meta = _optionalChain([metafile, 'optionalAccess', _10 => _10.outputs, 'access', _11 => _11[relativePath]]);
        return {
          type: "chunk",
          path: file.path,
          code: file.text,
          map: _optionalChain([outputFiles, 'access', _12 => _12.find, 'call', _13 => _13((f) => f.path === `${file.path}.map`), 'optionalAccess', _14 => _14.text]),
          entryPoint: _optionalChain([meta, 'optionalAccess', _15 => _15.entryPoint]),
          exports: _optionalChain([meta, 'optionalAccess', _16 => _16.exports]),
          imports: _optionalChain([meta, 'optionalAccess', _17 => _17.imports])
        };
      } else {
        return { type: "asset", path: file.path, contents: file.contents };
      }
    });
    const writtenFiles = [];
    await Promise.all(
      files.map(async (info) => {
        for (const plugin of this.plugins) {
          if (info.type === "chunk" && plugin.renderChunk) {
            const result = await plugin.renderChunk.call(
              this.getContext(),
              info.code,
              info
            );
            if (result) {
              info.code = result.code;
              if (result.map) {
                const originalConsumer = await new (0, _sourcemap.SourceMapConsumer)(
                  parseSourceMap(info.map)
                );
                const newConsumer = await new (0, _sourcemap.SourceMapConsumer)(
                  parseSourceMap(result.map)
                );
                const generator = _sourcemap.SourceMapGenerator.fromSourceMap(newConsumer);
                generator.applySourceMap(originalConsumer, info.path);
                info.map = generator.toJSON();
                originalConsumer.destroy();
                newConsumer.destroy();
              }
            }
          }
        }
        const inlineSourceMap = this.context.options.sourcemap === "inline";
        const contents = info.type === "chunk" ? info.code + getSourcemapComment(
          inlineSourceMap,
          info.map,
          info.path,
          isCSS(info.path)
        ) : info.contents;
        await outputFile(info.path, contents, {
          mode: info.type === "chunk" ? info.mode : void 0
        });
        writtenFiles.push({
          get name() {
            return _path2.default.relative(process.cwd(), info.path);
          },
          get size() {
            return contents.length;
          }
        });
        if (info.type === "chunk" && info.map && !inlineSourceMap) {
          const map = typeof info.map === "string" ? JSON.parse(info.map) : info.map;
          const outPath = `${info.path}.map`;
          const contents2 = JSON.stringify(map);
          await outputFile(outPath, contents2);
          writtenFiles.push({
            get name() {
              return _path2.default.relative(process.cwd(), outPath);
            },
            get size() {
              return contents2.length;
            }
          });
        }
      })
    );
    for (const plugin of this.plugins) {
      if (plugin.buildEnd) {
        await plugin.buildEnd.call(this.getContext(), { writtenFiles });
      }
    }
  }
};
var getSourcemapComment = (inline, map, filepath, isCssFile) => {
  if (!map) return "";
  const prefix = isCssFile ? "/*" : "//";
  const suffix = isCssFile ? " */" : "";
  const url = inline ? `data:application/json;base64,${Buffer.from(
    typeof map === "string" ? map : JSON.stringify(map)
  ).toString("base64")}` : `${_path2.default.basename(filepath)}.map`;
  return `${prefix}# sourceMappingURL=${url}${suffix}`;
};

// src/plugins/swc-target.ts
var TARGETS = ["es5", "es3"];
var swcTarget = () => {
  let enabled = false;
  let target;
  return {
    name: "swc-target",
    esbuildOptions(options) {
      if (typeof options.target === "string" && TARGETS.includes(options.target)) {
        target = options.target;
        options.target = "es2020";
        enabled = true;
      }
    },
    async renderChunk(code, info) {
      if (!enabled || !/\.(cjs|mjs|js)$/.test(info.path)) {
        return;
      }
      const swc = _chunkTWFEYLU4js.localRequire.call(void 0, "@swc/core");
      if (!swc) {
        throw new (0, _chunkJZ25TPTYjs.PrettyError)(
          `@swc/core is required for ${target} target. Please install it with \`npm install @swc/core -D\``
        );
      }
      const result = await swc.transform(code, {
        filename: info.path,
        sourceMaps: this.options.sourcemap,
        minify: Boolean(this.options.minify),
        jsc: {
          target,
          parser: {
            syntax: "ecmascript"
          },
          minify: this.options.minify === true ? {
            compress: false,
            mangle: {
              reserved: this.options.globalName ? [this.options.globalName] : []
            }
          } : void 0
        },
        module: {
          type: this.format === "cjs" ? "commonjs" : "es6"
        }
      });
      return {
        code: result.code,
        map: result.map
      };
    }
  };
};

// src/plugins/size-reporter.ts
var sizeReporter = () => {
  return {
    name: "size-reporter",
    buildEnd({ writtenFiles }) {
      _chunkVGC3FXLUjs.reportSize.call(void 0, 
        this.logger,
        this.format,
        writtenFiles.reduce((res, file) => {
          return {
            ...res,
            [file.name]: file.size
          };
        }, {})
      );
    }
  };
};

// src/plugins/tree-shaking.ts

var _rollup = require('rollup');
var treeShakingPlugin = ({
  treeshake,
  name,
  silent
}) => {
  return {
    name: "tree-shaking",
    async renderChunk(code, info) {
      if (!treeshake || !/\.(cjs|js|mjs)$/.test(info.path)) return;
      const bundle = await _rollup.rollup.call(void 0, {
        input: [info.path],
        plugins: [
          {
            name: "tsup",
            resolveId(source) {
              if (source === info.path) return source;
              return false;
            },
            load(id) {
              if (id === info.path) return { code, map: info.map };
            }
          }
        ],
        treeshake,
        makeAbsoluteExternalsRelative: false,
        preserveEntrySignatures: "exports-only",
        onwarn: silent ? () => {
        } : void 0
      });
      const result = await bundle.generate({
        interop: "auto",
        format: this.format,
        file: info.path,
        sourcemap: !!this.options.sourcemap,
        compact: !!this.options.minify,
        name
      });
      for (const file of result.output) {
        if (file.type === "chunk" && file.fileName === _path2.default.basename(info.path)) {
          return {
            code: file.code,
            map: file.map
          };
        }
      }
    }
  };
};

// src/lib/public-dir.ts

var copyPublicDir = (publicDir, outDir) => {
  if (!publicDir) return;
  copyDirSync(_path2.default.resolve(publicDir === true ? "public" : publicDir), outDir);
};
var isInPublicDir = (publicDir, filePath) => {
  if (!publicDir) return false;
  const publicPath = _chunkTWFEYLU4js.slash.call(void 0, 
    _path2.default.resolve(publicDir === true ? "public" : publicDir)
  );
  return _chunkTWFEYLU4js.slash.call(void 0, _path2.default.resolve(filePath)).startsWith(`${publicPath}/`);
};

// src/plugins/terser.ts
var terserPlugin = ({
  minifyOptions,
  format,
  terserOptions = {},
  globalName,
  logger: logger3
}) => {
  return {
    name: "terser",
    async renderChunk(code, info) {
      if (minifyOptions !== "terser" || !/\.(cjs|js|mjs)$/.test(info.path))
        return;
      const terser = _chunkTWFEYLU4js.localRequire.call(void 0, "terser");
      if (!terser) {
        throw new (0, _chunkJZ25TPTYjs.PrettyError)(
          "terser is required for terser minification. Please install it with `npm install terser -D`"
        );
      }
      const { minify } = terser;
      const defaultOptions = {};
      if (format === "esm") {
        defaultOptions.module = true;
      } else if (!(format === "iife" && globalName !== void 0)) {
        defaultOptions.toplevel = true;
      }
      try {
        const minifiedOutput = await minify(
          { [info.path]: code },
          { ...defaultOptions, ...terserOptions }
        );
        logger3.info("TERSER", "Minifying with Terser");
        if (!minifiedOutput.code) {
          logger3.error("TERSER", "Failed to minify with terser");
        }
        logger3.success("TERSER", "Terser Minification success");
        return { code: minifiedOutput.code, map: minifiedOutput.map };
      } catch (error) {
        logger3.error("TERSER", "Failed to minify with terser");
        logger3.error("TERSER", error);
      }
      return { code, map: info.map };
    }
  };
};

// src/tsc.ts


var _typescript = require('typescript'); var _typescript2 = _interopRequireDefault(_typescript);
var logger = _chunkVGC3FXLUjs.createLogger.call(void 0, );
var AliasPool = (_class = class {constructor() { _class.prototype.__init.call(this); }
  __init() {this.seen = /* @__PURE__ */ new Set()}
  assign(name) {
    let suffix = 0;
    let alias = name === "default" ? "default_alias" : name;
    while (this.seen.has(alias)) {
      alias = `${name}_alias_${++suffix}`;
      if (suffix >= 1e3) {
        throw new Error(
          "Alias generation exceeded limit. Possible infinite loop detected."
        );
      }
    }
    this.seen.add(alias);
    return alias;
  }
}, _class);
function getExports(program, fileMapping) {
  const checker = program.getTypeChecker();
  const aliasPool = new AliasPool();
  const assignAlias = aliasPool.assign.bind(aliasPool);
  function extractExports(sourceFileName) {
    const cwd = program.getCurrentDirectory();
    sourceFileName = _chunkTWFEYLU4js.toAbsolutePath.call(void 0, sourceFileName, cwd);
    const sourceFile = program.getSourceFile(sourceFileName);
    if (!sourceFile) {
      return [];
    }
    const destFileName = fileMapping.get(sourceFileName);
    if (!destFileName) {
      return [];
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      return [];
    }
    const exports = [];
    const exportSymbols = checker.getExportsOfModule(moduleSymbol);
    exportSymbols.forEach((symbol) => {
      const name = symbol.getName();
      exports.push({
        kind: "named",
        sourceFileName,
        destFileName,
        name,
        alias: assignAlias(name),
        isTypeOnly: false
      });
    });
    return exports;
  }
  return program.getRootFileNames().flatMap(extractExports);
}
function emitDtsFiles(program, host) {
  const fileMapping = /* @__PURE__ */ new Map();
  const writeFile = (fileName, text, writeByteOrderMark, onError, sourceFiles, data) => {
    const sourceFile = _optionalChain([sourceFiles, 'optionalAccess', _18 => _18[0]]);
    const sourceFileName = _optionalChain([sourceFile, 'optionalAccess', _19 => _19.fileName]);
    if (sourceFileName && !fileName.endsWith(".map")) {
      const cwd = program.getCurrentDirectory();
      fileMapping.set(
        _chunkTWFEYLU4js.toAbsolutePath.call(void 0, sourceFileName, cwd),
        _chunkTWFEYLU4js.toAbsolutePath.call(void 0, fileName, cwd)
      );
    }
    return host.writeFile(
      fileName,
      text,
      writeByteOrderMark,
      onError,
      sourceFiles,
      data
    );
  };
  const emitResult = program.emit(void 0, writeFile, void 0, true);
  const diagnostics = _typescript2.default.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  const diagnosticMessages = [];
  diagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = _typescript2.default.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );
      const message = _typescript2.default.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      diagnosticMessages.push(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      const message = _typescript2.default.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      diagnosticMessages.push(message);
    }
  });
  const diagnosticMessage = diagnosticMessages.join("\n");
  if (diagnosticMessage) {
    logger.error(
      "TSC",
      `Failed to emit declaration files.

${diagnosticMessage}`
    );
    throw new Error("TypeScript compilation failed");
  }
  return fileMapping;
}
function emit(compilerOptions, tsconfig) {
  const cwd = process.cwd();
  const rawTsconfig = _bundlerequire.loadTsConfig.call(void 0, cwd, tsconfig);
  if (!rawTsconfig) {
    throw new Error(`Unable to find ${tsconfig || "tsconfig.json"} in ${cwd}`);
  }
  const declarationDir = _chunkTWFEYLU4js.ensureTempDeclarationDir.call(void 0, );
  const parsedTsconfig = _typescript2.default.parseJsonConfigFileContent(
    {
      ...rawTsconfig.data,
      compilerOptions: {
        ..._optionalChain([rawTsconfig, 'access', _20 => _20.data, 'optionalAccess', _21 => _21.compilerOptions]),
        ...compilerOptions,
        // Enable declaration emit and disable javascript emit
        noEmit: false,
        declaration: true,
        declarationMap: true,
        declarationDir,
        emitDeclarationOnly: true
      }
    },
    _typescript2.default.sys,
    tsconfig ? _path.dirname.call(void 0, tsconfig) : "./"
  );
  const options = parsedTsconfig.options;
  const host = _typescript2.default.createCompilerHost(options);
  const program = _typescript2.default.createProgram(
    parsedTsconfig.fileNames,
    options,
    host
  );
  const fileMapping = emitDtsFiles(program, host);
  return getExports(program, fileMapping);
}
function runTypeScriptCompiler(options) {
  try {
    const start = Date.now();
    const getDuration = () => {
      return `${Math.floor(Date.now() - start)}ms`;
    };
    logger.info("tsc", "Build start");
    const dtsOptions = options.experimentalDts;
    const exports = emit(dtsOptions.compilerOptions, options.tsconfig);
    logger.success("tsc", `\u26A1\uFE0F Build success in ${getDuration()}`);
    return exports;
  } catch (error) {
    _chunkJZ25TPTYjs.handleError.call(void 0, error);
    logger.error("tsc", "Build error");
  }
}

// src/api-extractor.ts


// src/exports.ts

function formatAggregationExports(exports, declarationDirPath) {
  const lines = exports.map(
    (declaration) => formatAggregationExport(declaration, declarationDirPath)
  ).filter(_chunkTWFEYLU4js.truthy);
  if (lines.length === 0) {
    lines.push("export {};");
  }
  return `${lines.join("\n")}
`;
}
function formatAggregationExport(declaration, declarationDirPath) {
  const dest = _chunkTWFEYLU4js.replaceDtsWithJsExtensions.call(void 0, 
    `./${_path2.default.posix.normalize(
      _chunkTWFEYLU4js.slash.call(void 0, _path2.default.relative(declarationDirPath, declaration.destFileName))
    )}`
  );
  if (declaration.kind === "module") {
    return "";
  } else if (declaration.kind === "named") {
    return [
      "export",
      declaration.isTypeOnly ? "type" : "",
      "{",
      declaration.name,
      declaration.name === declaration.alias ? "" : `as ${declaration.alias}`,
      "} from",
      `'${dest}';`
    ].filter(_chunkTWFEYLU4js.truthy).join(" ");
  } else {
    throw new Error("Unknown declaration");
  }
}
function formatDistributionExports(exports, fromFilePath, toFilePath) {
  let importPath = _chunkTWFEYLU4js.replaceDtsWithJsExtensions.call(void 0, 
    _path2.default.posix.relative(
      _path2.default.posix.dirname(_path2.default.posix.normalize(_chunkTWFEYLU4js.slash.call(void 0, fromFilePath))),
      _path2.default.posix.normalize(_chunkTWFEYLU4js.slash.call(void 0, toFilePath))
    )
  );
  if (!/^\.+\//.test(importPath)) {
    importPath = `./${importPath}`;
  }
  const seen = {
    named: /* @__PURE__ */ new Set(),
    module: /* @__PURE__ */ new Set()
  };
  const lines = exports.filter((declaration) => {
    if (declaration.kind === "module") {
      if (seen.module.has(declaration.moduleName)) {
        return false;
      }
      seen.module.add(declaration.moduleName);
      return true;
    } else if (declaration.kind === "named") {
      if (seen.named.has(declaration.name)) {
        return false;
      }
      seen.named.add(declaration.name);
      return true;
    } else {
      return false;
    }
  }).map((declaration) => formatDistributionExport(declaration, importPath)).filter(_chunkTWFEYLU4js.truthy);
  if (lines.length === 0) {
    lines.push("export {};");
  }
  return `${lines.join("\n")}
`;
}
function formatDistributionExport(declaration, dest) {
  if (declaration.kind === "named") {
    return [
      "export",
      declaration.isTypeOnly ? "type" : "",
      "{",
      declaration.alias,
      declaration.name === declaration.alias ? "" : `as ${declaration.name}`,
      "} from",
      `'${dest}';`
    ].filter(_chunkTWFEYLU4js.truthy).join(" ");
  } else if (declaration.kind === "module") {
    return `export * from '${declaration.moduleName}';`;
  }
  return "";
}

// src/api-extractor.ts
var logger2 = _chunkVGC3FXLUjs.createLogger.call(void 0, );
function rollupDtsFile(inputFilePath, outputFilePath, tsconfigFilePath) {
  const cwd = process.cwd();
  const packageJsonFullPath = _path2.default.join(cwd, "package.json");
  const configObject = {
    mainEntryPointFilePath: inputFilePath,
    apiReport: {
      enabled: false,
      // `reportFileName` is not been used. It's just to fit the requirement of API Extractor.
      reportFileName: "tsup-report.api.md"
    },
    docModel: { enabled: false },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: outputFilePath
    },
    tsdocMetadata: { enabled: false },
    compiler: {
      tsconfigFilePath
    },
    projectFolder: cwd,
    newlineKind: "lf"
  };
  const prepareOptions = {
    configObject,
    configObjectFullPath: void 0,
    packageJsonFullPath
  };
  const imported = _chunkTWFEYLU4js.getApiExtractor.call(void 0, );
  if (!imported) {
    throw new Error(
      `@microsoft/api-extractor is not installed. Please install it first.`
    );
  }
  const { ExtractorConfig, Extractor } = imported;
  const extractorConfig = ExtractorConfig.prepare(prepareOptions);
  const extractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,
    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true
  });
  if (!extractorResult.succeeded) {
    throw new Error(
      `API Extractor completed with ${extractorResult.errorCount} errors and ${extractorResult.warningCount} warnings when processing ${inputFilePath}`
    );
  }
}
async function rollupDtsFiles(options, exports, format) {
  if (!options.experimentalDts || !_optionalChain([options, 'access', _22 => _22.experimentalDts, 'optionalAccess', _23 => _23.entry])) {
    return;
  }
  const declarationDir = _chunkTWFEYLU4js.ensureTempDeclarationDir.call(void 0, );
  const outDir = options.outDir || "dist";
  const pkg = await _chunkVGC3FXLUjs.loadPkg.call(void 0, process.cwd());
  const dtsExtension = _chunkTWFEYLU4js.defaultOutExtension.call(void 0, { format, pkgType: pkg.type }).dts;
  const tsconfig = options.tsconfig || "tsconfig.json";
  let dtsInputFilePath = _path2.default.join(
    declarationDir,
    `_tsup-dts-aggregation${dtsExtension}`
  );
  dtsInputFilePath = dtsInputFilePath.replace(/\.d\.mts$/, ".dmts.d.ts").replace(/\.d\.cts$/, ".dcts.d.ts");
  const dtsOutputFilePath = _path2.default.join(outDir, `_tsup-dts-rollup${dtsExtension}`);
  _chunkTWFEYLU4js.writeFileSync.call(void 0, 
    dtsInputFilePath,
    formatAggregationExports(exports, declarationDir)
  );
  rollupDtsFile(dtsInputFilePath, dtsOutputFilePath, tsconfig);
  for (let [out, sourceFileName] of Object.entries(
    options.experimentalDts.entry
  )) {
    sourceFileName = _chunkTWFEYLU4js.toAbsolutePath.call(void 0, sourceFileName);
    const outFileName = _path2.default.join(outDir, out + dtsExtension);
    const currentExports = exports.filter(
      (declaration) => declaration.sourceFileName === sourceFileName
    );
    _chunkTWFEYLU4js.writeFileSync.call(void 0, 
      outFileName,
      formatDistributionExports(currentExports, outFileName, dtsOutputFilePath)
    );
  }
}
async function cleanDtsFiles(options) {
  if (options.clean) {
    await _chunkTWFEYLU4js.removeFiles.call(void 0, ["**/*.d.{ts,mts,cts}"], options.outDir);
  }
}
async function runDtsRollup(options, exports) {
  try {
    const start = Date.now();
    const getDuration = () => {
      return `${Math.floor(Date.now() - start)}ms`;
    };
    logger2.info("dts", "Build start");
    if (!exports) {
      throw new Error("Unexpected internal error: dts exports is not define");
    }
    await cleanDtsFiles(options);
    for (const format of options.format) {
      await rollupDtsFiles(options, exports, format);
    }
    logger2.success("dts", `\u26A1\uFE0F Build success in ${getDuration()}`);
  } catch (error) {
    _chunkJZ25TPTYjs.handleError.call(void 0, error);
    logger2.error("dts", "Build error");
  }
}

// src/plugins/cjs-interop.ts
var cjsInterop = () => {
  return {
    name: "cjs-interop",
    renderChunk(code, info) {
      if (!this.options.cjsInterop || this.format !== "cjs" || info.type !== "chunk" || !/\.(js|cjs)$/.test(info.path) || !info.entryPoint || _optionalChain([info, 'access', _24 => _24.exports, 'optionalAccess', _25 => _25.length]) !== 1 || info.exports[0] !== "default") {
        return;
      }
      return {
        code: `${code}
module.exports = exports.default;
`,
        map: info.map
      };
    }
  };
};

// src/index.ts
var defineConfig = (options) => options;
var isTaskkillCmdProcessNotFoundError = (err) => {
  return process.platform === "win32" && "cmd" in err && "code" in err && typeof err.cmd === "string" && err.cmd.startsWith("taskkill") && err.code === 128;
};
var killProcess = ({ pid, signal }) => new Promise((resolve, reject) => {
  _treekill2.default.call(void 0, pid, signal, (err) => {
    if (err && !isTaskkillCmdProcessNotFoundError(err)) return reject(err);
    resolve();
  });
});
var normalizeOptions = async (logger3, optionsFromConfigFile, optionsOverride) => {
  const _options = {
    ...optionsFromConfigFile,
    ...optionsOverride
  };
  const options = {
    outDir: "dist",
    removeNodeProtocol: true,
    ..._options,
    format: typeof _options.format === "string" ? [_options.format] : _options.format || ["cjs"],
    dts: typeof _options.dts === "boolean" ? _options.dts ? {} : void 0 : typeof _options.dts === "string" ? { entry: _options.dts } : _options.dts,
    experimentalDts: await _chunkTWFEYLU4js.resolveInitialExperimentalDtsConfig.call(void 0, 
      _options.experimentalDts
    )
  };
  _chunkVGC3FXLUjs.setSilent.call(void 0, options.silent);
  const entry = options.entry || options.entryPoints;
  if (!entry || Object.keys(entry).length === 0) {
    throw new (0, _chunkJZ25TPTYjs.PrettyError)(`No input files, try "tsup <your-file>" instead`);
  }
  if (Array.isArray(entry)) {
    options.entry = await _tinyglobby.glob.call(void 0, entry);
    if (!options.entry || options.entry.length === 0) {
      throw new (0, _chunkJZ25TPTYjs.PrettyError)(`Cannot find ${entry}`);
    } else {
      logger3.info("CLI", `Building entry: ${options.entry.join(", ")}`);
    }
  } else {
    Object.keys(entry).forEach((alias) => {
      const filename = entry[alias];
      if (!_fs2.default.existsSync(filename)) {
        throw new (0, _chunkJZ25TPTYjs.PrettyError)(`Cannot find ${alias}: ${filename}`);
      }
    });
    options.entry = entry;
    logger3.info("CLI", `Building entry: ${JSON.stringify(entry)}`);
  }
  const tsconfig = _bundlerequire.loadTsConfig.call(void 0, process.cwd(), options.tsconfig);
  if (tsconfig) {
    logger3.info(
      "CLI",
      `Using tsconfig: ${_path2.default.relative(process.cwd(), tsconfig.path)}`
    );
    options.tsconfig = tsconfig.path;
    options.tsconfigResolvePaths = _optionalChain([tsconfig, 'access', _26 => _26.data, 'optionalAccess', _27 => _27.compilerOptions, 'optionalAccess', _28 => _28.paths]) || {};
    options.tsconfigDecoratorMetadata = _optionalChain([tsconfig, 'access', _29 => _29.data, 'optionalAccess', _30 => _30.compilerOptions, 'optionalAccess', _31 => _31.emitDecoratorMetadata]);
    if (options.dts) {
      options.dts.compilerOptions = {
        ...tsconfig.data.compilerOptions || {},
        ...options.dts.compilerOptions || {}
      };
    }
    if (options.experimentalDts) {
      options.experimentalDts = await _chunkTWFEYLU4js.resolveExperimentalDtsConfig.call(void 0, 
        options,
        tsconfig
      );
    }
    if (!options.target) {
      options.target = _optionalChain([tsconfig, 'access', _32 => _32.data, 'optionalAccess', _33 => _33.compilerOptions, 'optionalAccess', _34 => _34.target, 'optionalAccess', _35 => _35.toLowerCase, 'call', _36 => _36()]);
    }
  } else if (options.tsconfig) {
    throw new (0, _chunkJZ25TPTYjs.PrettyError)(`Cannot find tsconfig: ${options.tsconfig}`);
  }
  if (!options.target) {
    options.target = "node16";
  }
  return options;
};
async function build(_options) {
  const config = _options.config === false ? {} : await _chunkVGC3FXLUjs.loadTsupConfig.call(void 0, 
    process.cwd(),
    _options.config === true ? void 0 : _options.config
  );
  const configData = typeof config.data === "function" ? await config.data(_options) : config.data;
  await Promise.all(
    [...Array.isArray(configData) ? configData : [configData]].map(
      async (item) => {
        const logger3 = _chunkVGC3FXLUjs.createLogger.call(void 0, _optionalChain([item, 'optionalAccess', _37 => _37.name]));
        const options = await normalizeOptions(logger3, item, _options);
        logger3.info("CLI", `tsup v${_chunkU46XF7P4js.version}`);
        if (config.path) {
          logger3.info("CLI", `Using tsup config: ${config.path}`);
        }
        if (options.watch) {
          logger3.info("CLI", "Running in watch mode");
        }
        const experimentalDtsTask = async () => {
          if (!options.dts && options.experimentalDts) {
            const exports = runTypeScriptCompiler(options);
            await runDtsRollup(options, exports);
          }
        };
        const dtsTask = async () => {
          if (options.dts && options.experimentalDts) {
            throw new Error(
              "You can't use both `dts` and `experimentalDts` at the same time"
            );
          }
          await experimentalDtsTask();
          if (options.dts) {
            await new Promise((resolve, reject) => {
              const worker = new (0, _worker_threads.Worker)(_path2.default.join(__dirname, "./rollup.js"));
              const terminateWorker = () => {
                if (options.watch) return;
                worker.terminate();
              };
              worker.postMessage({
                configName: _optionalChain([item, 'optionalAccess', _38 => _38.name]),
                options: {
                  ...options,
                  // functions cannot be cloned
                  injectStyle: typeof options.injectStyle === "function" ? void 0 : options.injectStyle,
                  banner: void 0,
                  footer: void 0,
                  esbuildPlugins: void 0,
                  esbuildOptions: void 0,
                  plugins: void 0,
                  treeshake: void 0,
                  onSuccess: void 0,
                  outExtension: void 0
                }
              });
              worker.on("message", (data) => {
                if (data === "error") {
                  terminateWorker();
                  reject(new Error("error occurred in dts build"));
                } else if (data === "success") {
                  terminateWorker();
                  resolve();
                } else {
                  const { type, text } = data;
                  if (type === "log") {
                    console.log(text);
                  } else if (type === "error") {
                    console.error(text);
                  }
                }
              });
            });
          }
        };
        const mainTasks = async () => {
          if (!_optionalChain([options, 'access', _39 => _39.dts, 'optionalAccess', _40 => _40.only])) {
            let onSuccessProcess;
            let onSuccessCleanup;
            const buildDependencies = /* @__PURE__ */ new Set();
            let depsHash = await _chunkVGC3FXLUjs.getAllDepsHash.call(void 0, process.cwd());
            const doOnSuccessCleanup = async () => {
              if (onSuccessProcess) {
                await killProcess({
                  pid: onSuccessProcess.pid,
                  signal: options.killSignal || "SIGTERM"
                });
              } else if (onSuccessCleanup) {
                await onSuccessCleanup();
              }
              onSuccessProcess = void 0;
              onSuccessCleanup = void 0;
            };
            const debouncedBuildAll = _chunkTWFEYLU4js.debouncePromise.call(void 0, 
              () => {
                return buildAll();
              },
              100,
              _chunkJZ25TPTYjs.handleError
            );
            const buildAll = async () => {
              await doOnSuccessCleanup();
              const previousBuildDependencies = new Set(buildDependencies);
              buildDependencies.clear();
              if (options.clean) {
                const extraPatterns = Array.isArray(options.clean) ? options.clean : [];
                if (options.dts || options.experimentalDts) {
                  extraPatterns.unshift("!**/*.d.{ts,cts,mts}");
                }
                await _chunkTWFEYLU4js.removeFiles.call(void 0, ["**/*", ...extraPatterns], options.outDir);
                logger3.info("CLI", "Cleaning output folder");
              }
              const css = /* @__PURE__ */ new Map();
              await Promise.all([
                ...options.format.map(async (format, index) => {
                  const pluginContainer = new PluginContainer([
                    shebang(),
                    ...options.plugins || [],
                    treeShakingPlugin({
                      treeshake: options.treeshake,
                      name: options.globalName,
                      silent: options.silent
                    }),
                    cjsSplitting(),
                    cjsInterop(),
                    swcTarget(),
                    sizeReporter(),
                    terserPlugin({
                      minifyOptions: options.minify,
                      format,
                      terserOptions: options.terserOptions,
                      globalName: options.globalName,
                      logger: logger3
                    })
                  ]);
                  await runEsbuild(options, {
                    pluginContainer,
                    format,
                    css: index === 0 || options.injectStyle ? css : void 0,
                    logger: logger3,
                    buildDependencies
                  }).catch((error) => {
                    previousBuildDependencies.forEach(
                      (v) => buildDependencies.add(v)
                    );
                    throw error;
                  });
                })
              ]);
              copyPublicDir(options.publicDir, options.outDir);
              if (options.onSuccess) {
                if (typeof options.onSuccess === "function") {
                  onSuccessCleanup = await options.onSuccess();
                } else {
                  onSuccessProcess = _tinyexec.exec.call(void 0, options.onSuccess, [], {
                    nodeOptions: { shell: true, stdio: "inherit" }
                  });
                  _optionalChain([onSuccessProcess, 'access', _41 => _41.process, 'optionalAccess', _42 => _42.on, 'call', _43 => _43("exit", (code) => {
                    if (code && code !== 0) {
                      process.exitCode = code;
                    }
                  })]);
                }
              }
            };
            const startWatcher = async () => {
              if (!options.watch) return;
              const { watch } = await Promise.resolve().then(() => _interopRequireWildcard(require("chokidar")));
              const customIgnores = options.ignoreWatch ? Array.isArray(options.ignoreWatch) ? options.ignoreWatch : [options.ignoreWatch] : [];
              const ignored = [
                "**/{.git,node_modules}/**",
                options.outDir,
                ...customIgnores
              ];
              const watchPaths = typeof options.watch === "boolean" ? "." : Array.isArray(options.watch) ? options.watch.filter((path12) => typeof path12 === "string") : options.watch;
              logger3.info(
                "CLI",
                `Watching for changes in ${Array.isArray(watchPaths) ? watchPaths.map((v) => `"${v}"`).join(" | ") : `"${watchPaths}"`}`
              );
              logger3.info(
                "CLI",
                `Ignoring changes in ${ignored.map((v) => `"${v}"`).join(" | ")}`
              );
              const watcher = watch(await _tinyglobby.glob.call(void 0, watchPaths), {
                ignoreInitial: true,
                ignorePermissionErrors: true,
                ignored: (p) => _tinyglobby.globSync.call(void 0, p, { ignore: ignored }).length === 0
              });
              watcher.on("all", async (type, file) => {
                file = _chunkTWFEYLU4js.slash.call(void 0, file);
                if (options.publicDir && isInPublicDir(options.publicDir, file)) {
                  logger3.info("CLI", `Change in public dir: ${file}`);
                  copyPublicDir(options.publicDir, options.outDir);
                  return;
                }
                let shouldSkipChange = false;
                if (options.watch === true) {
                  if (file === "package.json" && !buildDependencies.has(file)) {
                    const currentHash = await _chunkVGC3FXLUjs.getAllDepsHash.call(void 0, process.cwd());
                    shouldSkipChange = currentHash === depsHash;
                    depsHash = currentHash;
                  } else if (!buildDependencies.has(file)) {
                    shouldSkipChange = true;
                  }
                }
                if (shouldSkipChange) {
                  return;
                }
                logger3.info("CLI", `Change detected: ${type} ${file}`);
                debouncedBuildAll();
              });
            };
            logger3.info("CLI", `Target: ${options.target}`);
            await buildAll();
            startWatcher();
          }
        };
        await Promise.all([dtsTask(), mainTasks()]);
      }
    )
  );
}



exports.build = build; exports.defineConfig = defineConfig;
