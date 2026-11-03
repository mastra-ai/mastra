import { transformSync } from '@babel/core';
import type { Plugin } from 'rolldown';
import { postgresStoreInstanceChecker as postgresStoreInstanceCheckerBabel } from '../babel/postgres-store-instance-checker';
import type { PostgresStoreInstance } from '../babel/postgres-store-instance-checker';
import { getBabelParserPlugins } from './babel-parser-plugins';

export function postgresStoreInstanceChecker(): Plugin {
  // Instances are counted across the app's modules of one build. Dependencies are skipped: `@mastra/pg` itself
  // contains `new PostgresStore(`.
  const instances: PostgresStoreInstance[] = [];
  const babelPlugin = () => postgresStoreInstanceCheckerBabel(instances);

  return {
    name: 'postgres-store-instance-checker',
    buildStart() {
      // Reset so watch rebuilds and reused plugin instances don't count previous builds.
      instances.length = 0;
    },
    transform: {
      filter: {
        id: { exclude: /[\\/]node_modules[\\/]/ },
        code: /\bPostgresStore\b/,
        moduleType: ['js', 'jsx', 'ts', 'tsx'],
      },
      handler(code, id, meta) {
        // Only validates, so the generated code is skipped and the module is left untouched.
        transformSync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          code: false,
          parserOpts: { plugins: getBabelParserPlugins(meta.moduleType) },
          plugins: [babelPlugin],
        });

        return null;
      },
    },
  };
}
