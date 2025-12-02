import path, { dirname, resolve, extname, normalize, sep } from 'path';
import { builtinModules } from 'module';
import deepMerge from 'deepmerge';
import isModule from 'is-module';
import fs, { realpathSync } from 'fs';
import { promisify } from 'util';
import { pathToFileURL, fileURLToPath } from 'url';
import resolve$1 from 'resolve';
import { createFilter } from '@rollup/pluginutils';

var version = "16.0.3";
var peerDependencies = {
	rollup: "^2.78.0||^3.0.0||^4.0.0"
};

promisify(fs.access);
const readFile$1 = promisify(fs.readFile);
const realpath = promisify(fs.realpath);
const stat = promisify(fs.stat);
async function fileExists(filePath) {
    try {
        const res = await stat(filePath);
        return res.isFile();
    }
    catch {
        return false;
    }
}
async function resolveSymlink(path) {
    return (await fileExists(path)) ? realpath(path) : path;
}

const onError = (error) => {
  if (error.code === 'ENOENT') {
    return false;
  }
  throw error;
};

const makeCache = (fn) => {
  const cache = new Map();
  const wrapped = async (param, done) => {
    if (cache.has(param) === false) {
      cache.set(
        param,
        fn(param).catch((err) => {
          cache.delete(param);
          throw err;
        })
      );
    }

    try {
      const result = cache.get(param);
      const value = await result;
      return done(null, value);
    } catch (error) {
      return done(error);
    }
  };

  wrapped.clear = () => cache.clear();

  return wrapped;
};

const isDirCached = makeCache(async (file) => {
  try {
    const stats = await stat(file);
    return stats.isDirectory();
  } catch (error) {
    return onError(error);
  }
});

const isFileCached = makeCache(async (file) => {
  try {
    const stats = await stat(file);
    return stats.isFile();
  } catch (error) {
    return onError(error);
  }
});

const readCachedFile = makeCache(readFile$1);

function handleDeprecatedOptions(opts) {
  const warnings = [];

  if (opts.customResolveOptions) {
    const { customResolveOptions } = opts;
    if (customResolveOptions.moduleDirectory) {
      // eslint-disable-next-line no-param-reassign
      opts.moduleDirectories = Array.isArray(customResolveOptions.moduleDirectory)
        ? customResolveOptions.moduleDirectory
        : [customResolveOptions.moduleDirectory];

      warnings.push(
        'node-resolve: The `customResolveOptions.moduleDirectory` option has been deprecated. Use `moduleDirectories`, which must be an array.'
      );
    }

    if (customResolveOptions.preserveSymlinks) {
      throw new Error(
        'node-resolve: `customResolveOptions.preserveSymlinks` is no longer an option. We now always use the rollup `preserveSymlinks` option.'
      );
    }

    [
      'basedir',
      'package',
      'extensions',
      'includeCoreModules',
      'readFile',
      'isFile',
      'isDirectory',
      'realpath',
      'packageFilter',
      'pathFilter',
      'paths',
      'packageIterator'
    ].forEach((resolveOption) => {
      if (customResolveOptions[resolveOption]) {
        throw new Error(
          `node-resolve: \`customResolveOptions.${resolveOption}\` is no longer an option. If you need this, please open an issue.`
        );
      }
    });
  }

  return { warnings };
}

// returns the imported package name for bare module imports
function getPackageName(id) {
  if (id.startsWith('.') || id.startsWith('/')) {
    return null;
  }

  const split = id.split('/');

  // @my-scope/my-package/foo.js -> @my-scope/my-package
  // @my-scope/my-package -> @my-scope/my-package
  if (split[0][0] === '@') {
    return `${split[0]}/${split[1]}`;
  }

  // my-package/foo.js -> my-package
  // my-package -> my-package
  return split[0];
}

function getMainFields(options) {
  let mainFields;
  if (options.mainFields) {
    ({ mainFields } = options);
  } else {
    mainFields = ['module', 'main'];
  }
  if (options.browser && mainFields.indexOf('browser') === -1) {
    return ['browser'].concat(mainFields);
  }
  if (!mainFields.length) {
    throw new Error('Please ensure at least one `mainFields` value is specified');
  }
  return mainFields;
}

function getPackageInfo(options) {
  const {
    cache,
    extensions,
    pkg,
    mainFields,
    preserveSymlinks,
    useBrowserOverrides,
    rootDir,
    ignoreSideEffectsForRoot
  } = options;
  let { pkgPath } = options;

  if (cache.has(pkgPath)) {
    return cache.get(pkgPath);
  }

  // browserify/resolve doesn't realpath paths returned in its packageFilter callback
  if (!preserveSymlinks) {
    pkgPath = realpathSync(pkgPath);
  }

  const pkgRoot = dirname(pkgPath);

  const packageInfo = {
    // copy as we are about to munge the `main` field of `pkg`.
    packageJson: { ...pkg },

    // path to package.json file
    packageJsonPath: pkgPath,

    // directory containing the package.json
    root: pkgRoot,

    // which main field was used during resolution of this module (main, module, or browser)
    resolvedMainField: 'main',

    // whether the browser map was used to resolve the entry point to this module
    browserMappedMain: false,

    // the entry point of the module with respect to the selected main field and any
    // relevant browser mappings.
    resolvedEntryPoint: ''
  };

  let overriddenMain = false;
  for (let i = 0; i < mainFields.length; i++) {
    const field = mainFields[i];
    if (typeof pkg[field] === 'string') {
      pkg.main = pkg[field];
      packageInfo.resolvedMainField = field;
      overriddenMain = true;
      break;
    }
  }

  const internalPackageInfo = {
    cachedPkg: pkg,
    hasModuleSideEffects: () => null,
    hasPackageEntry: overriddenMain !== false || mainFields.indexOf('main') !== -1,
    packageBrowserField:
      useBrowserOverrides &&
      typeof pkg.browser === 'object' &&
      Object.keys(pkg.browser).reduce((browser, key) => {
        let resolved = pkg.browser[key];
        if (resolved && resolved[0] === '.') {
          resolved = resolve(pkgRoot, resolved);
        }
        /* eslint-disable no-param-reassign */
        browser[key] = resolved;
        if (key[0] === '.') {
          const absoluteKey = resolve(pkgRoot, key);
          browser[absoluteKey] = resolved;
          if (!extname(key)) {
            extensions.reduce((subBrowser, ext) => {
              subBrowser[absoluteKey + ext] = subBrowser[key];
              return subBrowser;
            }, browser);
          }
        }
        return browser;
      }, {}),
    packageInfo
  };

  const browserMap = internalPackageInfo.packageBrowserField;
  if (
    useBrowserOverrides &&
    typeof pkg.browser === 'object' &&
    // eslint-disable-next-line no-prototype-builtins
    browserMap.hasOwnProperty(pkg.main)
  ) {
    packageInfo.resolvedEntryPoint = browserMap[pkg.main];
    packageInfo.browserMappedMain = true;
  } else {
    // index.node is technically a valid default entrypoint as well...
    packageInfo.resolvedEntryPoint = resolve(pkgRoot, pkg.main || 'index.js');
    packageInfo.browserMappedMain = false;
  }

  if (!ignoreSideEffectsForRoot || rootDir !== pkgRoot) {
    const packageSideEffects = pkg.sideEffects;
    if (typeof packageSideEffects === 'boolean') {
      internalPackageInfo.hasModuleSideEffects = () => packageSideEffects;
    } else if (Array.isArray(packageSideEffects)) {
      const finalPackageSideEffects = packageSideEffects.map((sideEffect) => {
        /*
         * The array accepts simple glob patterns to the relevant files... Patterns like .css, which do not include a /, will be treated like **\/.css.
         * https://webpack.js.org/guides/tree-shaking/
         */
        if (sideEffect.includes('/')) {
          return sideEffect;
        }
        return `**/${sideEffect}`;
      });
      internalPackageInfo.hasModuleSideEffects = createFilter(finalPackageSideEffects, null, {
        resolve: pkgRoot
      });
    }
  }

  cache.set(pkgPath, internalPackageInfo);
  return internalPackageInfo;
}

function normalizeInput(input) {
  if (Array.isArray(input)) {
    return input;
  } else if (typeof input === 'object') {
    return Object.values(input);
  }

  // otherwise it's a string
  return [input];
}

/* eslint-disable no-await-in-loop */
function isModuleDir(current, moduleDirs) {
    return moduleDirs.some((dir) => current.endsWith(dir));
}
async function findPackageJson(base, moduleDirs) {
    const { root } = path.parse(base);
    let current = base;
    while (current !== root && !isModuleDir(current, moduleDirs)) {
        const pkgJsonPath = path.join(current, 'package.json');
        if (await fileExists(pkgJsonPath)) {
            const pkgJsonString = fs.readFileSync(pkgJsonPath, 'utf-8');
            return { pkgJson: JSON.parse(pkgJsonString), pkgPath: current, pkgJsonPath };
        }
        current = path.resolve(current, '..');
    }
    return null;
}
function isUrl(str) {
    try {
        return !!new URL(str);
    }
    catch (_) {
        return false;
    }
}
/**
 * Conditions is an export object where all keys are conditions like 'node' (aka do not with '.')
 */
function isConditions(exports) {
    return typeof exports === 'object' && Object.keys(exports).every((k) => !k.startsWith('.'));
}
/**
 * Mappings is an export object where all keys start with '.
 */
function isMappings(exports) {
    return typeof exports === 'object' && !isConditions(exports);
}
/**
 * Check for mixed exports, which are exports where some keys start with '.' and some do not
 */
function isMixedExports(exports) {
    const keys = Object.keys(exports);
    return keys.some((k) => k.startsWith('.')) && keys.some((k) => !k.startsWith('.'));
}
function createBaseErrorMsg(importSpecifier, importer) {
    return `Could not resolve import "${importSpecifier}" in ${importer}`;
}
function createErrorMsg(context, reason, isImports) {
    const { importSpecifier, importer, pkgJsonPath } = context;
    const base = createBaseErrorMsg(importSpecifier, importer);
    const field = isImports ? 'imports' : 'exports';
    return `${base} using ${field} defined in ${pkgJsonPath}.${reason ? ` ${reason}` : ''}`;
}
class ResolveError extends Error {
}
class InvalidConfigurationError extends ResolveError {
    constructor(context, reason) {
        super(createErrorMsg(context, `Invalid "exports" field. ${reason}`));
    }
}
class InvalidModuleSpecifierError extends ResolveError {
    constructor(context, isImports, reason) {
        super(createErrorMsg(context, reason, isImports));
    }
}
class InvalidPackageTargetError extends ResolveError {
    constructor(context, reason) {
        super(createErrorMsg(context, reason));
    }
}

/* eslint-disable no-await-in-loop, no-undefined */
/**
 * Check for invalid path segments
 */
function includesInvalidSegments(pathSegments, moduleDirs) {
    const invalidSegments = ['', '.', '..', ...moduleDirs];
    // contains any "", ".", "..", or "node_modules" segments, including percent encoded variants
    return pathSegments.some((v) => invalidSegments.includes(v) || invalidSegments.includes(decodeURI(v)));
}
async function resolvePackageTarget(context, { target, patternMatch, isImports }) {
    // If target is a String, then
    if (typeof target === 'string') {
        // If target does not start with "./", then
        if (!target.startsWith('./')) {
            // If isImports is false, or if target starts with "../" or "/", or if target is a valid URL, then
            if (!isImports || ['/', '../'].some((p) => target.startsWith(p)) || isUrl(target)) {
                // Throw an Invalid Package Target error.
                throw new InvalidPackageTargetError(context, `Invalid mapping: "${target}".`);
            }
            // If patternMatch is a String, then
            if (typeof patternMatch === 'string') {
                // Return PACKAGE_RESOLVE(target with every instance of "*" replaced by patternMatch, packageURL + "/")
                const result = await context.resolveId(target.replace(/\*/g, patternMatch), context.pkgURL.href);
                return result ? pathToFileURL(result.location).href : null;
            }
            // Return PACKAGE_RESOLVE(target, packageURL + "/").
            const result = await context.resolveId(target, context.pkgURL.href);
            return result ? pathToFileURL(result.location).href : null;
        }
        // TODO: Drop if we do not support Node <= 16 anymore
        // This behavior was removed in Node 17 (deprecated in Node 14), see DEP0148
        if (context.allowExportsFolderMapping) {
            target = target.replace(/\/$/, '/*');
        }
        // If target split on "/" or "\"
        {
            const pathSegments = target.split(/\/|\\/);
            // after the first "." segment
            const firstDot = pathSegments.indexOf('.');
            firstDot !== -1 && pathSegments.slice(firstDot);
            if (firstDot !== -1 &&
                firstDot < pathSegments.length - 1 &&
                includesInvalidSegments(pathSegments.slice(firstDot + 1), context.moduleDirs)) {
                throw new InvalidPackageTargetError(context, `Invalid mapping: "${target}".`);
            }
        }
        // Let resolvedTarget be the URL resolution of the concatenation of packageURL and target.
        const resolvedTarget = new URL(target, context.pkgURL);
        // Assert: resolvedTarget is contained in packageURL.
        if (!resolvedTarget.href.startsWith(context.pkgURL.href)) {
            throw new InvalidPackageTargetError(context, `Resolved to ${resolvedTarget.href} which is outside package ${context.pkgURL.href}`);
        }
        // If patternMatch is null, then
        if (!patternMatch) {
            // Return resolvedTarget.
            return resolvedTarget;
        }
        // If patternMatch split on "/" or "\" contains invalid segments
        if (includesInvalidSegments(patternMatch.split(/\/|\\/), context.moduleDirs)) {
            // throw an Invalid Module Specifier error.
            throw new InvalidModuleSpecifierError(context);
        }
        // Return the URL resolution of resolvedTarget with every instance of "*" replaced with patternMatch.
        return resolvedTarget.href.replace(/\*/g, patternMatch);
    }
    // Otherwise, if target is an Array, then
    if (Array.isArray(target)) {
        // If _target.length is zero, return null.
        if (target.length === 0) {
            return null;
        }
        let lastError = null;
        // For each item in target, do
        for (const item of target) {
            // Let resolved be the result of PACKAGE_TARGET_RESOLVE of the item
            // continuing the loop on any Invalid Package Target error.
            try {
                const resolved = await resolvePackageTarget(context, {
                    target: item,
                    patternMatch,
                    isImports
                });
                // If resolved is undefined, continue the loop.
                // Else Return resolved.
                if (resolved !== undefined) {
                    return resolved;
                }
            }
            catch (error) {
                if (!(error instanceof InvalidPackageTargetError)) {
                    throw error;
                }
                else {
                    lastError = error;
                }
            }
        }
        // Return or throw the last fallback resolution null return or error
        if (lastError) {
            throw lastError;
        }
        return null;
    }
    // Otherwise, if target is a non-null Object, then
    if (target && typeof target === 'object') {
        // For each property of target
        for (const [key, value] of Object.entries(target)) {
            // If exports contains any index property keys, as defined in ECMA-262 6.1.7 Array Index, throw an Invalid Package Configuration error.
            // TODO: We do not check if the key is a number here...
            // If key equals "default" or conditions contains an entry for the key, then
            if (key === 'default' || context.conditions.includes(key)) {
                // Let targetValue be the value of the property in target.
                // Let resolved be the result of PACKAGE_TARGET_RESOLVE of the targetValue
                const resolved = await resolvePackageTarget(context, {
                    target: value,
                    patternMatch,
                    isImports
                });
                // If resolved is equal to undefined, continue the loop.
                // Return resolved.
                if (resolved !== undefined) {
                    return resolved;
                }
            }
        }
        // Return undefined.
        return undefined;
    }
    // Otherwise, if target is null, return null.
    if (target === null) {
        return null;
    }
    // Otherwise throw an Invalid Package Target error.
    throw new InvalidPackageTargetError(context, `Invalid exports field.`);
}

/* eslint-disable no-await-in-loop */
/**
 * Implementation of Node's `PATTERN_KEY_COMPARE` function
 */
function nodePatternKeyCompare(keyA, keyB) {
    // Let baseLengthA be the index of "*" in keyA plus one, if keyA contains "*", or the length of keyA otherwise.
    const baseLengthA = keyA.includes('*') ? keyA.indexOf('*') + 1 : keyA.length;
    // Let baseLengthB be the index of "*" in keyB plus one, if keyB contains "*", or the length of keyB otherwise.
    const baseLengthB = keyB.includes('*') ? keyB.indexOf('*') + 1 : keyB.length;
    // if baseLengthA is greater, return -1, if lower 1
    const rval = baseLengthB - baseLengthA;
    if (rval !== 0)
        return rval;
    // If keyA does not contain "*", return 1.
    if (!keyA.includes('*'))
        return 1;
    // If keyB does not contain "*", return -1.
    if (!keyB.includes('*'))
        return -1;
    // If the length of keyA is greater than the length of keyB, return -1.
    // If the length of keyB is greater than the length of keyA, return 1.
    // Else Return 0.
    return keyB.length - keyA.length;
}
async function resolvePackageImportsExports(context, { matchKey, matchObj, isImports }) {
    // If matchKey is a key of matchObj and does not contain "*", then
    if (!matchKey.includes('*') && matchKey in matchObj) {
        // Let target be the value of matchObj[matchKey].
        const target = matchObj[matchKey];
        // Return the result of PACKAGE_TARGET_RESOLVE(packageURL, target, null, isImports, conditions).
        const resolved = await resolvePackageTarget(context, { target, patternMatch: '', isImports });
        return resolved;
    }
    // Let expansionKeys be the list of keys of matchObj containing only a single "*"
    const expansionKeys = Object.keys(matchObj)
        // Assert: ends with "/" or contains only a single "*".
        .filter((k) => k.endsWith('/') || k.includes('*'))
        // sorted by the sorting function PATTERN_KEY_COMPARE which orders in descending order of specificity.
        .sort(nodePatternKeyCompare);
    // For each key expansionKey in expansionKeys, do
    for (const expansionKey of expansionKeys) {
        const indexOfAsterisk = expansionKey.indexOf('*');
        // Let patternBase be the substring of expansionKey up to but excluding the first "*" character.
        const patternBase = indexOfAsterisk === -1 ? expansionKey : expansionKey.substring(0, indexOfAsterisk);
        // If matchKey starts with but is not equal to patternBase, then
        if (matchKey.startsWith(patternBase) && matchKey !== patternBase) {
            // Let patternTrailer be the substring of expansionKey from the index after the first "*" character.
            const patternTrailer = indexOfAsterisk !== -1 ? expansionKey.substring(indexOfAsterisk + 1) : '';
            // If patternTrailer has zero length,
            if (patternTrailer.length === 0 ||
                // or if matchKey ends with patternTrailer and the length of matchKey is greater than or equal to the length of expansionKey, then
                (matchKey.endsWith(patternTrailer) && matchKey.length >= expansionKey.length)) {
                // Let target be the value of matchObj[expansionKey].
                const target = matchObj[expansionKey];
                // Let patternMatch be the substring of matchKey starting at the index of the length of patternBase up to the length
                // of matchKey minus the length of patternTrailer.
                const patternMatch = matchKey.substring(patternBase.length, matchKey.length - patternTrailer.length);
                // Return the result of PACKAGE_TARGET_RESOLVE
                const resolved = await resolvePackageTarget(context, {
                    target,
                    patternMatch,
                    isImports
                });
                return resolved;
            }
        }
    }
    throw new InvalidModuleSpecifierError(context, isImports);
}

/**
 * Implementation of PACKAGE_EXPORTS_RESOLVE
 */
async function resolvePackageExports(context, subpath, exports) {
    // If exports is an Object with both a key starting with "." and a key not starting with "."
    if (isMixedExports(exports)) {
        // throw an Invalid Package Configuration error.
        throw new InvalidConfigurationError(context, 'All keys must either start with ./, or without one.');
    }
    // If subpath is equal to ".", then
    if (subpath === '.') {
        // Let mainExport be undefined.
        let mainExport;
        // If exports is a String or Array, or an Object containing no keys starting with ".", then
        if (typeof exports === 'string' || Array.isArray(exports) || isConditions(exports)) {
            // Set mainExport to exports
            mainExport = exports;
            // Otherwise if exports is an Object containing a "." property, then
        }
        else if (isMappings(exports)) {
            // Set mainExport to exports["."]
            mainExport = exports['.'];
        }
        // If mainExport is not undefined, then
        if (mainExport) {
            // Let resolved be the result of PACKAGE_TARGET_RESOLVE with target = mainExport
            const resolved = await resolvePackageTarget(context, {
                target: mainExport,
                patternMatch: '',
                isImports: false
            });
            // If resolved is not null or undefined, return resolved.
            if (resolved) {
                return resolved;
            }
        }
        // Otherwise, if exports is an Object and all keys of exports start with ".", then
    }
    else if (isMappings(exports)) {
        // Let resolved be the result of PACKAGE_IMPORTS_EXPORTS_RESOLVE
        const resolvedMatch = await resolvePackageImportsExports(context, {
            matchKey: subpath,
            matchObj: exports,
            isImports: false
        });
        // If resolved is not null or undefined, return resolved.
        if (resolvedMatch) {
            return resolvedMatch;
        }
    }
    // Throw a Package Path Not Exported error.
    throw new InvalidModuleSpecifierError(context);
}

async function resolvePackageImports({ importSpecifier, importer, moduleDirs, conditions, resolveId }) {
    const result = await findPackageJson(importer, moduleDirs);
    if (!result) {
        throw new Error(`${createBaseErrorMsg(importSpecifier, importer)}. Could not find a parent package.json.`);
    }
    const { pkgPath, pkgJsonPath, pkgJson } = result;
    const pkgURL = pathToFileURL(`${pkgPath}/`);
    const context = {
        importer,
        importSpecifier,
        moduleDirs,
        pkgURL,
        pkgJsonPath,
        conditions,
        resolveId
    };
    // Assert: specifier begins with "#".
    if (!importSpecifier.startsWith('#')) {
        throw new InvalidModuleSpecifierError(context, true, 'Invalid import specifier.');
    }
    // If specifier is exactly equal to "#" or starts with "#/", then
    if (importSpecifier === '#' || importSpecifier.startsWith('#/')) {
        // Throw an Invalid Module Specifier error.
        throw new InvalidModuleSpecifierError(context, true, 'Invalid import specifier.');
    }
    const { imports } = pkgJson;
    if (!imports) {
        throw new InvalidModuleSpecifierError(context, true);
    }
    // Let packageURL be the result of LOOKUP_PACKAGE_SCOPE(parentURL).
    // If packageURL is not null, then
    return resolvePackageImportsExports(context, {
        matchKey: importSpecifier,
        matchObj: imports,
        isImports: true
    });
}

const resolveImportPath = promisify(resolve$1);
const readFile = promisify(fs.readFile);

async function getPackageJson(importer, pkgName, resolveOptions, moduleDirectories) {
  if (importer) {
    const selfPackageJsonResult = await findPackageJson(importer, moduleDirectories);
    if (selfPackageJsonResult && selfPackageJsonResult.pkgJson.name === pkgName) {
      // the referenced package name is the current package
      return selfPackageJsonResult;
    }
  }

  try {
    const pkgJsonPath = await resolveImportPath(`${pkgName}/package.json`, resolveOptions);
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
    return { pkgJsonPath, pkgJson, pkgPath: dirname(pkgJsonPath) };
  } catch (_) {
    return null;
  }
}

async function resolveIdClassic({
  importSpecifier,
  packageInfoCache,
  extensions,
  mainFields,
  preserveSymlinks,
  useBrowserOverrides,
  baseDir,
  moduleDirectories,
  modulePaths,
  rootDir,
  ignoreSideEffectsForRoot
}) {
  let hasModuleSideEffects = () => null;
  let hasPackageEntry = true;
  let packageBrowserField = false;
  let packageInfo;

  const filter = (pkg, pkgPath) => {
    const info = getPackageInfo({
      cache: packageInfoCache,
      extensions,
      pkg,
      pkgPath,
      mainFields,
      preserveSymlinks,
      useBrowserOverrides,
      rootDir,
      ignoreSideEffectsForRoot
    });

    ({ packageInfo, hasModuleSideEffects, hasPackageEntry, packageBrowserField } = info);

    return info.cachedPkg;
  };

  const resolveOptions = {
    basedir: baseDir,
    readFile: readCachedFile,
    isFile: isFileCached,
    isDirectory: isDirCached,
    extensions,
    includeCoreModules: false,
    moduleDirectory: moduleDirectories,
    paths: modulePaths,
    preserveSymlinks,
    packageFilter: filter
  };

  let location;
  try {
    location = await resolveImportPath(importSpecifier, resolveOptions);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    return null;
  }

  return {
    location: preserveSymlinks ? location : await resolveSymlink(location),
    hasModuleSideEffects,
    hasPackageEntry,
    packageBrowserField,
    packageInfo
  };
}

async function resolveWithExportMap({
  importer,
  importSpecifier,
  exportConditions,
  packageInfoCache,
  extensions,
  mainFields,
  preserveSymlinks,
  useBrowserOverrides,
  baseDir,
  moduleDirectories,
  modulePaths,
  rootDir,
  ignoreSideEffectsForRoot,
  allowExportsFolderMapping
}) {
  if (importSpecifier.startsWith('#')) {
    // this is a package internal import, resolve using package imports field
    const resolveResult = await resolvePackageImports({
      importSpecifier,
      importer,
      moduleDirs: moduleDirectories,
      conditions: exportConditions,
      // Resolve targets of "imports" mappings using the same algorithm
      // we use for normal specifiers: try export maps first and then
      // fall back to classic resolution. This is important for cases
      // like "#foo/*": "@scope/pkg/*" where the target package relies
      // on "exports" to expose subpaths. Using the classic resolver
      // alone would fail to find those subpaths.
      resolveId(id /* , parent*/) {
        return resolveImportSpecifiers({
          importer,
          importSpecifierList: [id],
          exportConditions,
          // pass-through of the rest of the context
          packageInfoCache,
          extensions,
          mainFields,
          preserveSymlinks,
          useBrowserOverrides,
          baseDir,
          moduleDirectories,
          modulePaths,
          rootDir,
          ignoreSideEffectsForRoot,
          allowExportsFolderMapping
        });
      }
    });

    if (resolveResult == null) {
      // When the target of an "imports" mapping cannot be resolved,
      // surface a proper resolve error instead of throwing from
      // fileURLToPath(null).
      throw new ResolveError(
        `Could not resolve import "${importSpecifier}" in ${importer} using imports.`
      );
    }
    const location = fileURLToPath(resolveResult);
    return {
      location: preserveSymlinks ? location : await resolveSymlink(location),
      hasModuleSideEffects: () => null,
      hasPackageEntry: true,
      packageBrowserField: false,
      // eslint-disable-next-line no-undefined
      packageInfo: undefined
    };
  }

  const pkgName = getPackageName(importSpecifier);
  if (pkgName) {
    // it's a bare import, find the package.json and resolve using package exports if available
    let hasModuleSideEffects = () => null;
    let hasPackageEntry = true;
    let packageBrowserField = false;
    let packageInfo;

    const filter = (pkg, pkgPath) => {
      const info = getPackageInfo({
        cache: packageInfoCache,
        extensions,
        pkg,
        pkgPath,
        mainFields,
        preserveSymlinks,
        useBrowserOverrides,
        rootDir,
        ignoreSideEffectsForRoot
      });

      ({ packageInfo, hasModuleSideEffects, hasPackageEntry, packageBrowserField } = info);

      return info.cachedPkg;
    };

    const resolveOptions = {
      basedir: baseDir,
      readFile: readCachedFile,
      isFile: isFileCached,
      isDirectory: isDirCached,
      extensions,
      includeCoreModules: false,
      moduleDirectory: moduleDirectories,
      paths: modulePaths,
      preserveSymlinks,
      packageFilter: filter
    };

    const result = await getPackageJson(importer, pkgName, resolveOptions, moduleDirectories);

    if (result && result.pkgJson.exports) {
      const { pkgJson, pkgJsonPath } = result;
      const subpath =
        pkgName === importSpecifier ? '.' : `.${importSpecifier.substring(pkgName.length)}`;
      const pkgDr = pkgJsonPath.replace('package.json', '');
      const pkgURL = pathToFileURL(pkgDr);

      const context = {
        importer,
        importSpecifier,
        moduleDirs: moduleDirectories,
        pkgURL,
        pkgJsonPath,
        allowExportsFolderMapping,
        conditions: exportConditions
      };
      const resolvedPackageExport = await resolvePackageExports(context, subpath, pkgJson.exports);
      const location = fileURLToPath(resolvedPackageExport);
      if (location) {
        return {
          location: preserveSymlinks ? location : await resolveSymlink(location),
          hasModuleSideEffects,
          hasPackageEntry,
          packageBrowserField,
          packageInfo
        };
      }
    }
  }

  return null;
}

async function resolveWithClassic({
  importer,
  importSpecifierList,
  exportConditions,
  warn,
  packageInfoCache,
  extensions,
  mainFields,
  preserveSymlinks,
  useBrowserOverrides,
  baseDir,
  moduleDirectories,
  modulePaths,
  rootDir,
  ignoreSideEffectsForRoot
}) {
  for (let i = 0; i < importSpecifierList.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const result = await resolveIdClassic({
      importer,
      importSpecifier: importSpecifierList[i],
      exportConditions,
      warn,
      packageInfoCache,
      extensions,
      mainFields,
      preserveSymlinks,
      useBrowserOverrides,
      baseDir,
      moduleDirectories,
      modulePaths,
      rootDir,
      ignoreSideEffectsForRoot
    });

    if (result) {
      return result;
    }
  }

  return null;
}

// Resolves to the module if found or `null`.
// The first import specifier will first be attempted with the exports algorithm.
// If this is unsuccessful because export maps are not being used, then all of `importSpecifierList`
// will be tried with the classic resolution algorithm
async function resolveImportSpecifiers({
  importer,
  importSpecifierList,
  exportConditions,
  warn,
  packageInfoCache,
  extensions,
  mainFields,
  preserveSymlinks,
  useBrowserOverrides,
  baseDir,
  moduleDirectories,
  modulePaths,
  rootDir,
  ignoreSideEffectsForRoot,
  allowExportsFolderMapping
}) {
  try {
    const exportMapRes = await resolveWithExportMap({
      importer,
      importSpecifier: importSpecifierList[0],
      exportConditions,
      packageInfoCache,
      extensions,
      mainFields,
      preserveSymlinks,
      useBrowserOverrides,
      baseDir,
      moduleDirectories,
      modulePaths,
      rootDir,
      ignoreSideEffectsForRoot,
      allowExportsFolderMapping
    });
    if (exportMapRes) return exportMapRes;
  } catch (error) {
    if (error instanceof ResolveError) {
      warn(error);
      return null;
    }
    throw error;
  }

  // package has no imports or exports, use classic node resolve
  return resolveWithClassic({
    importer,
    importSpecifierList,
    exportConditions,
    warn,
    packageInfoCache,
    extensions,
    mainFields,
    preserveSymlinks,
    useBrowserOverrides,
    baseDir,
    moduleDirectories,
    modulePaths,
    rootDir,
    ignoreSideEffectsForRoot
  });
}

const versionRegexp = /\^(\d+\.\d+\.\d+)/g;

function validateVersion(actualVersion, peerDependencyVersion) {
  let minMajor = Infinity;
  let minMinor = Infinity;
  let minPatch = Infinity;
  let foundVersion;
  // eslint-disable-next-line no-cond-assign
  while ((foundVersion = versionRegexp.exec(peerDependencyVersion))) {
    const [foundMajor, foundMinor, foundPatch] = foundVersion[1].split('.').map(Number);
    if (foundMajor < minMajor) {
      minMajor = foundMajor;
      minMinor = foundMinor;
      minPatch = foundPatch;
    }
  }
  if (!actualVersion) {
    throw new Error(
      `Insufficient Rollup version: "@rollup/plugin-node-resolve" requires at least rollup@${minMajor}.${minMinor}.${minPatch}.`
    );
  }
  const [major, minor, patch] = actualVersion.split('.').map(Number);
  if (
    major < minMajor ||
    (major === minMajor && (minor < minMinor || (minor === minMinor && patch < minPatch)))
  ) {
    throw new Error(
      `Insufficient rollup version: "@rollup/plugin-node-resolve" requires at least rollup@${minMajor}.${minMinor}.${minPatch} but found rollup@${actualVersion}.`
    );
  }
}

/* eslint-disable no-param-reassign, no-shadow, no-undefined */

const ES6_BROWSER_EMPTY = '\0node-resolve:empty.js';
const deepFreeze = (object) => {
  Object.freeze(object);

  for (const value of Object.values(object)) {
    if (typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }

  return object;
};

const baseConditions = ['default', 'module'];
const baseConditionsEsm = [...baseConditions, 'import'];
const baseConditionsCjs = [...baseConditions, 'require'];
const defaults = {
  dedupe: [],
  // It's important that .mjs is listed before .js so that Rollup will interpret npm modules
  // which deploy both ESM .mjs and CommonJS .js files as ESM.
  extensions: ['.mjs', '.js', '.json', '.node'],
  resolveOnly: [],
  moduleDirectories: ['node_modules'],
  modulePaths: [],
  ignoreSideEffectsForRoot: false,
  // TODO: set to false in next major release or remove
  allowExportsFolderMapping: true
};
const nodeImportPrefix = /^node:/;

const DEFAULTS = deepFreeze(deepMerge({}, defaults));

function nodeResolve(opts = {}) {
  const { warnings } = handleDeprecatedOptions(opts);

  const options = { ...defaults, ...opts };
  const { extensions, jail, moduleDirectories, modulePaths, ignoreSideEffectsForRoot } = options;
  const exportConditions = options.exportConditions || [];
  const devProdCondition =
    exportConditions.includes('development') || exportConditions.includes('production')
      ? []
      : [
          process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
            ? 'development'
            : 'production'
        ];
  const conditionsEsm = [...baseConditionsEsm, ...exportConditions, ...devProdCondition];
  const conditionsCjs = [...baseConditionsCjs, ...exportConditions, ...devProdCondition];
  const packageInfoCache = new Map();
  const idToPackageInfo = new Map();
  const mainFields = getMainFields(options);
  const useBrowserOverrides = mainFields.indexOf('browser') !== -1;
  const isPreferBuiltinsSet = Object.prototype.hasOwnProperty.call(options, 'preferBuiltins');
  const preferBuiltins = isPreferBuiltinsSet ? options.preferBuiltins : true;
  const rootDir = resolve(options.rootDir || process.cwd());
  let { dedupe } = options;
  let rollupOptions;

  if (moduleDirectories.some((name) => name.includes('/'))) {
    throw new Error(
      '`moduleDirectories` option must only contain directory names. If you want to load modules from somewhere not supported by the default module resolution algorithm, see `modulePaths`.'
    );
  }

  if (typeof dedupe !== 'function') {
    dedupe = (importee) =>
      options.dedupe.includes(importee) || options.dedupe.includes(getPackageName(importee));
  }

  // creates a function from the patterns to test if a particular module should be bundled.
  const allowPatterns = (patterns) => {
    const regexPatterns = patterns.map((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern;
      }
      const normalized = pattern.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
      return new RegExp(`^${normalized}$`);
    });
    return (id) => !regexPatterns.length || regexPatterns.some((pattern) => pattern.test(id));
  };

  const resolveOnly =
    typeof options.resolveOnly === 'function'
      ? options.resolveOnly
      : allowPatterns(options.resolveOnly);

  const browserMapCache = new Map();
  let preserveSymlinks;

  const resolveLikeNode = async (context, importee, importer, custom) => {
    // strip query params from import
    const [importPath, params] = importee.split('?');
    const importSuffix = `${params ? `?${params}` : ''}`;
    importee = importPath;

    const baseDir = !importer || dedupe(importee) ? rootDir : dirname(importer);

    // https://github.com/defunctzombie/package-browser-field-spec
    const browser = browserMapCache.get(importer);
    if (useBrowserOverrides && browser) {
      const resolvedImportee = resolve(baseDir, importee);
      if (browser[importee] === false || browser[resolvedImportee] === false) {
        return { id: ES6_BROWSER_EMPTY };
      }
      const browserImportee =
        (importee[0] !== '.' && browser[importee]) ||
        browser[resolvedImportee] ||
        browser[`${resolvedImportee}.js`] ||
        browser[`${resolvedImportee}.json`];
      if (browserImportee) {
        importee = browserImportee;
      }
    }

    const parts = importee.split(/[/\\]/);
    let id = parts.shift();
    let isRelativeImport = false;

    if (id[0] === '@' && parts.length > 0) {
      // scoped packages
      id += `/${parts.shift()}`;
    } else if (id[0] === '.') {
      // an import relative to the parent dir of the importer
      id = resolve(baseDir, importee);
      isRelativeImport = true;
    }

    // if it's not a relative import, and it's not requested, reject it.
    if (!isRelativeImport && !resolveOnly(id)) {
      if (normalizeInput(rollupOptions.input).includes(importee)) {
        return null;
      }
      return false;
    }

    const importSpecifierList = [importee];

    if (importer === undefined && importee[0] && !importee[0].match(/^\.?\.?\//)) {
      // For module graph roots (i.e. when importer is undefined), we
      // need to handle 'path fragments` like `foo/bar` that are commonly
      // found in rollup config files. If importee doesn't look like a
      // relative or absolute path, we make it relative and attempt to
      // resolve it.
      importSpecifierList.push(`./${importee}`);
    }

    // TypeScript files may import '.mjs' or '.cjs' to refer to either '.mts' or '.cts'.
    // They may also import .js to refer to either .ts or .tsx, and .jsx to refer to .tsx.
    if (importer && /\.(ts|mts|cts|tsx)$/.test(importer)) {
      for (const [importeeExt, resolvedExt] of [
        ['.js', '.ts'],
        ['.js', '.tsx'],
        ['.jsx', '.tsx'],
        ['.mjs', '.mts'],
        ['.cjs', '.cts']
      ]) {
        if (importee.endsWith(importeeExt) && extensions.includes(resolvedExt)) {
          importSpecifierList.push(importee.slice(0, -importeeExt.length) + resolvedExt);
        }
      }
    }

    const warn = (...args) => context.warn(...args);
    const isRequire = custom && custom['node-resolve'] && custom['node-resolve'].isRequire;
    const exportConditions = isRequire ? conditionsCjs : conditionsEsm;
    if (useBrowserOverrides && !exportConditions.includes('browser'))
      exportConditions.push('browser');

    const resolvedWithoutBuiltins = await resolveImportSpecifiers({
      importer,
      importSpecifierList,
      exportConditions,
      warn,
      packageInfoCache,
      extensions,
      mainFields,
      preserveSymlinks,
      useBrowserOverrides,
      baseDir,
      moduleDirectories,
      modulePaths,
      rootDir,
      ignoreSideEffectsForRoot,
      allowExportsFolderMapping: options.allowExportsFolderMapping
    });

    const importeeIsBuiltin = builtinModules.includes(importee.replace(nodeImportPrefix, ''));
    const preferImporteeIsBuiltin =
      typeof preferBuiltins === 'function' ? preferBuiltins(importee) : preferBuiltins;
    const resolved =
      importeeIsBuiltin && preferImporteeIsBuiltin
        ? {
            packageInfo: undefined,
            hasModuleSideEffects: () => null,
            hasPackageEntry: true,
            packageBrowserField: false
          }
        : resolvedWithoutBuiltins;
    if (!resolved) {
      return null;
    }

    const { packageInfo, hasModuleSideEffects, hasPackageEntry, packageBrowserField } = resolved;
    let { location } = resolved;
    if (packageBrowserField) {
      if (Object.prototype.hasOwnProperty.call(packageBrowserField, location)) {
        if (!packageBrowserField[location]) {
          browserMapCache.set(location, packageBrowserField);
          return { id: ES6_BROWSER_EMPTY };
        }
        location = packageBrowserField[location];
      }
      browserMapCache.set(location, packageBrowserField);
    }

    if (hasPackageEntry && !preserveSymlinks) {
      const exists = await fileExists(location);
      if (exists) {
        location = await realpath(location);
      }
    }

    idToPackageInfo.set(location, packageInfo);

    if (hasPackageEntry) {
      if (importeeIsBuiltin && preferImporteeIsBuiltin) {
        if (!isPreferBuiltinsSet && resolvedWithoutBuiltins && resolved !== importee) {
          context.warn({
            message:
              `preferring built-in module '${importee}' over local alternative at '${resolvedWithoutBuiltins.location}', pass 'preferBuiltins: false' to disable this behavior or 'preferBuiltins: true' to disable this warning.` +
              `or passing a function to 'preferBuiltins' to provide more fine-grained control over which built-in modules to prefer.`,
            pluginCode: 'PREFER_BUILTINS'
          });
        }
        return false;
      } else if (jail && location.indexOf(normalize(jail.trim(sep))) !== 0) {
        return null;
      }
    }

    if (options.modulesOnly && (await fileExists(location))) {
      const code = await readFile$1(location, 'utf-8');
      if (isModule(code)) {
        return {
          id: `${location}${importSuffix}`,
          moduleSideEffects: hasModuleSideEffects(location)
        };
      }
      return null;
    }
    return {
      id: `${location}${importSuffix}`,
      moduleSideEffects: hasModuleSideEffects(location)
    };
  };

  return {
    name: 'node-resolve',

    version,

    buildStart(buildOptions) {
      validateVersion(this.meta.rollupVersion, peerDependencies.rollup);
      rollupOptions = buildOptions;

      for (const warning of warnings) {
        this.warn(warning);
      }

      ({ preserveSymlinks } = buildOptions);
    },

    generateBundle() {
      readCachedFile.clear();
      isFileCached.clear();
      isDirCached.clear();
    },

    resolveId: {
      order: 'post',
      async handler(importee, importer, resolveOptions) {
        if (importee === ES6_BROWSER_EMPTY) {
          return importee;
        }
        // ignore IDs with null character, these belong to other plugins
        if (importee && importee.includes('\0')) return null;

        const { custom = {} } = resolveOptions;
        const { 'node-resolve': { resolved: alreadyResolved } = {} } = custom;
        if (alreadyResolved) {
          return alreadyResolved;
        }

        if (importer && importer.includes('\0')) {
          importer = undefined;
        }

        const resolved = await resolveLikeNode(this, importee, importer, custom);
        if (resolved) {
          // This way, plugins may attach additional meta information to the
          // resolved id or make it external. We do not skip node-resolve here
          // because another plugin might again use `this.resolve` in its
          // `resolveId` hook, in which case we want to add the correct
          // `moduleSideEffects` information.
          const resolvedResolved = await this.resolve(resolved.id, importer, {
            ...resolveOptions,
            skipSelf: false,
            custom: { ...custom, 'node-resolve': { ...custom['node-resolve'], resolved, importee } }
          });
          if (resolvedResolved) {
            // Handle plugins that manually make the result external
            if (resolvedResolved.external) {
              return false;
            }
            // Allow other plugins to take over resolution. Rollup core will not
            // change the id if it corresponds to an existing file
            if (resolvedResolved.id !== resolved.id) {
              return resolvedResolved;
            }
            // Pass on meta information added by other plugins
            return { ...resolved, meta: resolvedResolved.meta };
          }
        }
        return resolved;
      }
    },

    load(importee) {
      if (importee === ES6_BROWSER_EMPTY) {
        return 'export default {};';
      }
      return null;
    },

    getPackageInfoForId(id) {
      return idToPackageInfo.get(id);
    }
  };
}

export { DEFAULTS, nodeResolve as default, nodeResolve };
//# sourceMappingURL=index.js.map
