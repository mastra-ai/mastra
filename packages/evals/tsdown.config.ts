import { generateTypes } from '@internal/types-builder';
import { assertLatin1Dist } from '@internal/types-builder/check-ascii-output';
import esbuildCompileZod from '@internal/types-builder/compile-zod';
import { defineConfig } from 'tsdown';

type EsbuildOnLoadPlugin = {
  name: string;
  setup(build: {
    onLoad(
      options: { filter: RegExp },
      callback: (args: { path: string }) => Promise<{ contents?: string } | null> | { contents?: string } | null,
    ): void;
  }): void;
};

function adaptEsbuildOnLoadPlugin(plugin: EsbuildOnLoadPlugin) {
  const onLoadCallbacks: {
    filter: RegExp;
    callback: (args: { path: string }) => Promise<{ contents?: string } | null> | { contents?: string } | null;
  }[] = [];

  plugin.setup({
    onLoad(options, callback) {
      onLoadCallbacks.push({ filter: options.filter, callback });
    },
  });

  return {
    name: plugin.name,
    async transform(code: string, id: string) {
      for (const { filter, callback } of onLoadCallbacks) {
        if (!filter.test(id)) {
          continue;
        }

        const result = await callback({ path: id });
        if (result?.contents) {
          return { code: result.contents, map: null };
        }
      }

      return null;
    },
  };
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'scorers/prebuilt/index': 'src/scorers/prebuilt/index.ts',
    'scorers/utils': 'src/scorers/utils.ts',
    checks: 'src/checks.ts',
    'vitest/index': 'src/vitest/index.ts',
    'vitest/setup': 'src/vitest/setup.ts',
  },
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  inputOptions: {
    plugins: [adaptEsbuildOnLoadPlugin(esbuildCompileZod())],
  },
  // Escape non-ASCII in strings, templates, regex literals and identifiers. V8 stores a script at
  // one byte per character only when every character is Latin-1, so one wider character doubles the
  // memory a Cloudflare Worker spends holding its own source. `assertLatin1Dist` enforces it in `onSuccess`.
  outputOptions: {
    charset: 'ascii',
  },
  onSuccess: async () => {
    assertLatin1Dist(`${process.cwd()}/dist`);
    await generateTypes(process.cwd());
  },
});
