import { transformSync } from '@babel/core';
import type { Plugin } from 'rollup';
import { postgresStoreInstanceChecker as postgresStoreInstanceCheckerBabel } from '../babel/postgres-store-instance-checker';

export function postgresStoreInstanceChecker(): Plugin {
  return {
    name: 'postgres-store-instance-checker',
    transform(code, id) {
      const result = transformSync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        plugins: [postgresStoreInstanceCheckerBabel],
      });

      if (!result?.code) {
        throw new Error(
          'postgres-store-instance-checker plugin did not return code, there is likely a bug in the plugin.',
        );
      }

      return {
        code: result.code,
        map: result?.map,
      };
    },
  };
}
