import esbuildCompileZod from '@internal/types-builder/compile-zod';
import { defineLibConfig } from '@internal/types-builder/tsdown';

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

export default defineLibConfig({
  entry: ['src/index.ts'],
  inputOptions: {
    plugins: [adaptEsbuildOnLoadPlugin(esbuildCompileZod())],
  },
});
