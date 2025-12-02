// src/index.ts
import path from "node:path";
import { Lang, parse } from "@ast-grep/napi";
import MagicString from "magic-string";
import color from "picocolors";
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
${color.cyan(`[${pluginName}]`)} ${color.yellow(msg)}
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
        const node = parse(Lang.JavaScript, chunk.code).root().children().find((node2) => !excludeTokens.includes(node2.kind()));
        const position = node?.range().start.index ?? 0;
        let code = chunk.code;
        for (const cssFileName of chunk.viteMetadata.importedCss) {
          let cssFilePath = path.relative(path.dirname(chunk.fileName), cssFileName).replaceAll(/[\\/]+/g, "/");
          cssFilePath = cssFilePath.startsWith(".") ? cssFilePath : `./${cssFilePath}`;
          const injection = format === "es" ? `import '${cssFilePath}';` : `require('${cssFilePath}');`;
          code = code.slice(0, position) + injection + code.slice(position);
        }
        chunk.code = code;
        if (resolvedConfig.build.sourcemap) {
          const ms = new MagicString(code);
          chunk.map = ms.generateMap({ hires: "boundary" });
        }
      }
    }
  };
}
export {
  libInjectCss
};
