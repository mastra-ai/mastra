import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { LoadHookContext, ResolveHookContext } from 'node:module';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { isDependencyPartOfPackage } from '../build/utils';

const STUB_PREFIX = 'mastra-stub:';

let _stubbedExternals: string[] | null = null;
let _stubbedExternalExports: Record<string, string[]> | null = null;

function getStubbedExternals(): string[] {
  if (_stubbedExternals === null) {
    try {
      _stubbedExternals = JSON.parse(process.env.STUBBED_EXTERNALS || '[]') as string[];
    } catch {
      _stubbedExternals = [];
    }
  }
  return _stubbedExternals;
}

function getStubbedExternalExports(): Record<string, string[]> {
  if (_stubbedExternalExports === null) {
    try {
      _stubbedExternalExports = JSON.parse(process.env.STUBBED_EXTERNAL_EXPORTS || '{}') as Record<string, string[]>;
    } catch {
      _stubbedExternalExports = {};
    }
  }
  return _stubbedExternalExports;
}

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
    let moduleResolveMapLocation = process.env.MODULE_MAP;
    if (!moduleResolveMapLocation) {
      moduleResolveMapLocation = join(process.cwd(), 'module-resolve-map.json');
    }

    let moduleResolveMap: Record<string, Record<string, string>> = {};
    if (existsSync(moduleResolveMapLocation)) {
      moduleResolveMap = JSON.parse(await readFile(moduleResolveMapLocation, 'utf-8')) as Record<
        string,
        Record<string, string>
      >;
    }

    for (const [id, rest] of Object.entries(moduleResolveMap)) {
      cache.set(id, rest);
    }
  }

  const importers = cache.get(url);
  if (!importers) {
    return null;
  }

  const matchedPackage = Object.keys(importers).find(external => isDependencyPartOfPackage(specifier, external));
  if (!matchedPackage) {
    return null;
  }
  const specifierParent = importers[matchedPackage]!;
  return specifierParent;
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

  // Stub GLOBAL_EXTERNALS packages during validation
  const stubbedExternals = getStubbedExternals();
  if (stubbedExternals.length > 0) {
    const isStubbed = stubbedExternals.some(ext => isDependencyPartOfPackage(specifier, ext));
    const externalExports = getStubbedExternalExports()[specifier] ?? [];
    if (isStubbed && !externalExports.includes('*')) {
      return { url: `${STUB_PREFIX}${specifier}`, shortCircuit: true };
    }
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

export async function load(
  url: string,
  context: LoadHookContext,
  nextLoad: (url: string, context: LoadHookContext) => Promise<{ format: string; source: string }>,
) {
  if (url.startsWith(STUB_PREFIX)) {
    const specifier = url.slice(STUB_PREFIX.length);
    const externalExports = getStubbedExternalExports()[specifier] ?? [];
    const namedExports = [...new Set(externalExports)].filter(name => name && name !== 'default' && name !== '*');
    const namedExportSource = namedExports.length
      ? `export { __mastraStub as ${namedExports.map(name => JSON.stringify(name)).join(', __mastraStub as ')} };`
      : '';

    return {
      format: 'module',
      source: `
const __mastraStub = new Proxy(function () {
  return __mastraStub;
}, {
  get: (_target, property) => property === 'then' ? undefined : __mastraStub,
  apply: () => __mastraStub,
  construct: () => __mastraStub,
});
export default __mastraStub;
${namedExportSource}
`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
