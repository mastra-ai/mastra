import type { NodePath, PluginObj } from '@babel/core';
import * as babel from '@babel/core';
import type { NewExpression } from '@babel/types';

/**
 * Babel plugin that enforces singleton PostgresStore instances in Cloudflare Workers.
 *
 * This plugin:
 * 1. Scans for all `new PostgresStore()` instantiations
 * 2. Records their file locations
 * 3. Throws an error if multiple instances are found
 *
 * Cloudflare Workers should only create one PostgresStore instance to avoid connection
 * pool exhaustion and ensure proper resource management.
 *
 * @returns {PluginObj} A Babel plugin object that validates PostgresStore usage
 *
 * @example
 * // Throws error if multiple instances found:
 * const store1 = new PostgresStore();
 * const store2 = new PostgresStore(); // Error thrown here
 */
export function postgresStoreInstanceChecker(): PluginObj {
  const t = babel.types;
  const instances: { path: NodePath<NewExpression>; location: string }[] = [];

  return {
    name: 'postgresstore-instance-checker',
    visitor: {
      NewExpression(path, state) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'PostgresStore') {
          const filename = state.file?.opts?.filename || 'unknown file';
          const location = path.node.loc
            ? `${filename}: line ${path.node.loc.start.line}, column ${path.node.loc.start.column}`
            : 'unknown location';

          instances.push({
            path,
            location,
          });
        }
      },
    },
    post() {
      if (instances.length > 1) {
        const errorMessage = [
          `Found ${instances.length} PostgresStore instantiations:`,
          ...instances.map((instance, i) => `  ${i + 1}. At ${instance.location}`),
          'Only one PostgresStore instance should be created per Cloudflare Worker.',
        ].join('\n');

        const lastInstance = instances[instances.length - 1];
        throw lastInstance?.path.buildCodeFrameError(errorMessage);
      }
    },
  } as PluginObj;
}
