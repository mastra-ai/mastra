import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

function isDependencyPartOfPackage(dep, packageName) {
  return dep === packageName || dep.startsWith(`${packageName}/`);
}

const STUB_PREFIX = 'mastra-stub:';

let _stubbedExternals = null;
function getStubbedExternals() {
  if (_stubbedExternals === null) {
    try {
      _stubbedExternals = JSON.parse(process.env.STUBBED_EXTERNALS || '[]');
    } catch {
      _stubbedExternals = [];
    }
  }
  return _stubbedExternals;
}

const cache = new Map();

/**
 * Check if a module is a Node.js builtin module
 * @param specifier - Module specifier
 * @returns True if it's a builtin module
 */
function isBuiltinModule(specifier) {
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
function isRelativePath(specifier) {
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
async function getParentPath(specifier, url) {
  if (!cache.size) {
    let moduleResolveMapLocation = process.env.MODULE_MAP;
    if (!moduleResolveMapLocation) {
      moduleResolveMapLocation = join(process.cwd(), 'module-resolve-map.json');
    }

    let moduleResolveMap = {};
    if (existsSync(moduleResolveMapLocation)) {
      moduleResolveMap = JSON.parse(await readFile(moduleResolveMapLocation, 'utf-8'));
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
  const specifierParent = importers[matchedPackage];
  return specifierParent;
}

export async function resolve(specifier, context, nextResolve) {
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
    if (isStubbed) {
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

export async function load(url, context, nextLoad) {
  if (url.startsWith(STUB_PREFIX)) {
    return { format: 'module', source: 'export default {}', shortCircuit: true };
  }
  return nextLoad(url, context);
}
