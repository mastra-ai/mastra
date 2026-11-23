const JS_SOURCEMAP = /\.[cm]?js\.map$/;
const DECLARATION = /\.d\.[cm]?ts$/;
const SOURCEMAP_COMMENT = /\n\/\/# sourceMappingURL=\S+\s*$/;

/**
 * With `dts: true` and `declarationMap` on, rolldown-plugin-dts forces `sourcemap` on for the
 * whole ESM build, so the JS chunks get maps too. This drops the JS maps and their
 * `sourceMappingURL` comments while keeping the declaration maps.
 */
export function stripJsSourcemaps() {
  return {
    name: 'mastra:strip-js-sourcemaps',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && JS_SOURCEMAP.test(fileName)) {
          delete bundle[fileName];
        } else if (output.type === 'chunk' && !DECLARATION.test(fileName)) {
          output.code = output.code.replace(SOURCEMAP_COMMENT, '\n');
        }
      }
    },
  };
}
