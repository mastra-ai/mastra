import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ResolveHookContext } from 'node:module';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { isDependencyPartOfPackage } from '../build/utils';

const cache = new Map<string, Record<string, string>>();

// Transpile configuration for runtime TypeScript compilation
let transpileConfig: { packages: Array<{ name: string; path: string }> } | null = null;
const transpileCache = new Map<string, string>();

function shouldTranspile(filePath: string): boolean {
  if (!transpileConfig?.packages.length) return false;
  const normalizedFilePath = filePath.replaceAll('\\', '/');
  return transpileConfig.packages.some(pkg => {
    const pkgPath = pkg.path.replace(/\/+$/, '');
    return normalizedFilePath === pkgPath || normalizedFilePath.startsWith(`${pkgPath}/`);
  });
}

function isTypeScriptFile(url: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(url);
}

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
  context: { format?: string },
  nextLoad: (url: string, context: { format?: string }) => Promise<{ format: string; source: string }>,
) {
  if (!url.startsWith('file://')) {
    return nextLoad(url, context);
  }

  const filePath = fileURLToPath(url);

  // Load transpile config on first call
  if (transpileConfig === null) {
    const configPath = process.env.MASTRA_TRANSPILE_CONFIG;
    if (configPath && existsSync(configPath)) {
      try {
        transpileConfig = JSON.parse(await readFile(configPath, 'utf-8'));
      } catch (err) {
        console.warn(`[mastra] Failed to parse transpile config at ${configPath}:`, err);
        transpileConfig = { packages: [] };
      }
    } else {
      transpileConfig = { packages: [] };
    }
  }

  if (!shouldTranspile(filePath) || !isTypeScriptFile(url)) {
    return nextLoad(url, context);
  }

  if (url.endsWith('.cts')) {
    return nextLoad(url, context);
  }

  const cached = transpileCache.get(url);
  if (cached) {
    return { format: 'module', source: cached, shortCircuit: true };
  }

  try {
    const source = await readFile(filePath, 'utf-8');
    const result = await transform(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'node20',
      sourcemap: 'inline',
      sourcefile: filePath,
    });

    transpileCache.set(url, result.code);

    return { format: 'module', source: result.code, shortCircuit: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[mastra] Failed to transpile TypeScript file.\n  File: ${filePath}\n  URL: ${url}\n  Error: ${message}`);
  }
}
