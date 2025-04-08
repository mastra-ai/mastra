import { readFile } from 'node:fs/promises';
import type { ResolveHookContext } from 'node:module';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const cache = new Map<string, Record<string, string>>();

/**
 * Check if a module is a Node.js builtin module
 * @param specifier - Module specifier
 * @returns True if it's a builtin module
 */
function isBuiltinModule(specifier: string): boolean {
  return (
    builtinModules.includes(specifier) ||
    specifier.startsWith('node:') ||
    builtinModules.includes(specifier.replace(/^node:/, ''))
  );
}

/**
 * Check if a module specifier is a relative or absolute path
 * @param specifier - Module specifier
 * @returns True if it's a relative or absolute path
 */
function isRelativePath(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    /^[a-zA-Z]:\\/.test(specifier)
  ); // Windows absolute path
}

/**
 * Get the path to resolve any external packages from
 *
 * @param url
 * @returns
 */
async function getParentPath(specifier: string, url: string): Promise<string | null> {
  if (!cache.size) {
    const moduleResolveMap = JSON.parse(
      // cwd refers to the output/build directory
      await readFile(join(process.cwd(), 'module-resolve-map.json'), 'utf-8'),
    ) as Record<string, Record<string, string>>;

    for (const [id, rest] of Object.entries(moduleResolveMap)) {
      cache.set(pathToFileURL(id).toString(), rest);
    }
  }

  const importers = cache.get(url);
  if (!importers || !importers[specifier]) {
    return null;
  }

  const specifierParent = importers[specifier];

  return pathToFileURL(specifierParent).toString();
}

export async function resolve(
  specifier: string,
  context: ResolveHookContext,
  nextResolve: (specifier: string, context: ResolveHookContext) => Promise<{ url: string }>,
) {
  // Don't modify builtin modules
  if (isBuiltinModule(specifier)) {
    return nextResolve(specifier, context);
  }

  if (isRelativePath(specifier)) {
    return nextResolve(specifier, context);
  }

  if (context.parentURL) {
    const parentPath = await getParentPath(specifier, context.parentURL);

    if (parentPath) {
      return nextResolve(specifier, {
        ...context,
        parentURL: parentPath,
      });
    }
  }

  // Continue resolution with the modified path
  return nextResolve(specifier, context);
}
