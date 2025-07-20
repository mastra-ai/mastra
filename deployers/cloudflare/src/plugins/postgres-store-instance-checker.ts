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

      return {
        code: result?.code || code,
        map: result?.map,
      };
    },
  };
}
