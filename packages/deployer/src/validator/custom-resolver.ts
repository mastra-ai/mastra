// loader.ts
import type { ResolveHookContext } from 'node:module';
import { builtinModules } from 'node:module';
import { pathToFileURL } from 'node:url';
import { silent as resolveFrom } from 'resolve-from';
// Configuration can be provided through environment variables or a config file

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

  // TODO make dynamic
  if (specifier === 'pino' || specifier === 'pino-pretty') {
    const pkgPackagePath = resolveFrom(process.cwd(), '@mastra/core/package.json');
    if (pkgPackagePath) {
      return nextResolve(specifier, {
        ...context,
        parentURL: pathToFileURL(pkgPackagePath).toString(),
      });
    }
  }
  // Continue resolution with the modified path
  return nextResolve(specifier, context);
}
