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
  libInjectCss: () => libInjectCss
});
module.exports = __toCommonJS(index_exports);
var import_node_path = __toESM(require("path"), 1);
var import_napi = require("@ast-grep/napi");
var import_magic_string = __toESM(require("magic-string"), 1);
var import_picocolors = __toESM(require("picocolors"), 1);
var excludeTokens = [
  "import_statement",
  "expression_statement"
];
var pluginName = "vite:lib-inject-css";
function libInjectCss() {
  let skipInject = false;
  let resolvedConfig;
  return {
    name: pluginName,
    apply: "build",
    enforce: "post",
    config({ build }) {
      for (const item of [build?.rollupOptions?.output].flat()) {
        if (item && typeof item.hoistTransitiveImports !== "boolean") {
          item.hoistTransitiveImports = false;
        }
      }
      return {
        build: {
          /**
           * Must enable css code split, otherwise there's only one `style.css` and `chunk.viteMetadata.importedCss` will be empty.
           * @see https://vite.dev/config/build-options.html#build-csscodesplit
           */
          cssCodeSplit: true,
          /**
           * Must emit assets on SSR, otherwise there won't be any CSS files generated and the import statements
           * injected by this plugin will refer to an undefined module.
           * @see https://vite.dev/config/build-options.html#build-ssremitassets
           */
          ssrEmitAssets: true
        }
      };
    },
    configResolved(config) {
      resolvedConfig = config;
    },
    options() {
      const { build, command } = resolvedConfig;
      const messages = [];
      if (!build.lib || command !== "build") {
        skipInject = true;
        messages.push(
          "Current is not in library mode or building process, skip code injection."
        );
      }
      if (build.ssr && build.ssrEmitAssets === false) {
        messages.push(
          "`config.build.ssrEmitAssets` is set to `true` by the plugin internally in library mode, but it seems to be `false` now. This may cause style code injection to fail on SSR, please check the configuration to prevent this option from being modified."
        );
      }
      messages.forEach(
        (msg) => console.log(
          `
${import_picocolors.default.cyan(`[${pluginName}]`)} ${import_picocolors.default.yellow(msg)}
`
        )
      );
    },
    generateBundle({ format }, bundle) {
      if (skipInject)
        return;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.viteMetadata?.importedCss.size) {
          continue;
        }
        const node = (0, import_napi.parse)(import_napi.Lang.JavaScript, chunk.code).root().children().find((node2) => !excludeTokens.includes(node2.kind()));
        const position = node?.range().start.index ?? 0;
        let code = chunk.code;
        for (const cssFileName of chunk.viteMetadata.importedCss) {
          let cssFilePath = import_node_path.default.relative(import_node_path.default.dirname(chunk.fileName), cssFileName).replaceAll(/[\\/]+/g, "/");
          cssFilePath = cssFilePath.startsWith(".") ? cssFilePath : `./${cssFilePath}`;
          const injection = format === "es" ? `import '${cssFilePath}';` : `require('${cssFilePath}');`;
          code = code.slice(0, position) + injection + code.slice(position);
        }
        chunk.code = code;
        if (resolvedConfig.build.sourcemap) {
          const ms = new import_magic_string.default(code);
          chunk.map = ms.generateMap({ hires: "boundary" });
        }
      }
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  libInjectCss
});
