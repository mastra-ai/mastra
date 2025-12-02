import { shallowIgnoreVisitors } from '../utils/traverse.js';
import resolve from 'resolve';
import { dirname, extname } from 'path';
import fs from 'fs';
import { visitors } from '@babel/traverse';
import { resolveObjectPatternPropertyToValue } from '../utils/index.js';
// These extensions are sorted by priority
// resolve() will check for files in the order these extensions are sorted
const RESOLVE_EXTENSIONS = [
    '.js',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
    '.jsx',
];
function defaultLookupModule(filename, basedir) {
    const resolveOptions = {
        basedir,
        extensions: RESOLVE_EXTENSIONS,
        // we do not need to check core modules as we cannot import them anyway
        includeCoreModules: false,
    };
    try {
        return resolve.sync(filename, resolveOptions);
    }
    catch (error) {
        const ext = extname(filename);
        let newFilename;
        // if we try to import a JavaScript file it might be that we are actually pointing to
        // a TypeScript file. This can happen in ES modules as TypeScript requires to import other
        // TypeScript files with .js extensions
        // https://www.typescriptlang.org/docs/handbook/esm-node.html#type-in-packagejson-and-new-extensions
        switch (ext) {
            case '.js':
            case '.mjs':
            case '.cjs':
                newFilename = `${filename.slice(0, -2)}ts`;
                break;
            case '.jsx':
                newFilename = `${filename.slice(0, -3)}tsx`;
                break;
            default:
                throw error;
        }
        return resolve.sync(newFilename, {
            ...resolveOptions,
            // we already know that there is an extension at this point, so no need to check other extensions
            extensions: [],
        });
    }
}
// Factory for the resolveImports importer
// If this resolver is used in an environment where the source files change (e.g. watch)
// then the cache needs to be cleared on file changes.
export default function makeFsImporter(lookupModule = defaultLookupModule, { parseCache, resolveCache } = {
    parseCache: new Map(),
    resolveCache: new Map(),
}) {
    function resolveImportedValue(path, name, file, seen = new Set()) {
        // Bail if no filename was provided for the current source file.
        // Also never traverse into react itself.
        const source = path.node.source?.value;
        const { filename } = file.opts;
        if (!source || !filename || source === 'react') {
            return null;
        }
        // Resolve the imported module using the Node resolver
        const basedir = dirname(filename);
        const resolveCacheKey = `${basedir}|${source}`;
        let resolvedSource = resolveCache.get(resolveCacheKey);
        // We haven't found it before, so no need to look again
        if (resolvedSource === null) {
            return null;
        }
        // First time we try to resolve this file
        if (resolvedSource === undefined) {
            try {
                resolvedSource = lookupModule(source, basedir);
            }
            catch (error) {
                const { code } = error;
                if (code === 'MODULE_NOT_FOUND' || code === 'INVALID_PACKAGE_MAIN') {
                    resolveCache.set(resolveCacheKey, null);
                    return null;
                }
                throw error;
            }
            resolveCache.set(resolveCacheKey, resolvedSource);
        }
        // Prevent recursive imports
        if (seen.has(resolvedSource)) {
            return null;
        }
        seen.add(resolvedSource);
        let nextFile = parseCache.get(resolvedSource);
        if (!nextFile) {
            // Read and parse the code
            const src = fs.readFileSync(resolvedSource, 'utf8');
            nextFile = file.parse(src, resolvedSource);
            parseCache.set(resolvedSource, nextFile);
        }
        return findExportedValue(nextFile, name, seen);
    }
    const explodedVisitors = visitors.explode({
        ...shallowIgnoreVisitors,
        ExportNamedDeclaration: {
            enter: function (path, state) {
                const { file, name, seen } = state;
                const declaration = path.get('declaration');
                // export const/var ...
                if (declaration.hasNode() && declaration.isVariableDeclaration()) {
                    for (const declPath of declaration.get('declarations')) {
                        const id = declPath.get('id');
                        const init = declPath.get('init');
                        if (id.isIdentifier({ name }) && init.hasNode()) {
                            // export const/var a = <init>
                            state.resultPath = init;
                            break;
                        }
                        else if (id.isObjectPattern()) {
                            // export const/var { a } = <init>
                            state.resultPath = id.get('properties').find((prop) => {
                                if (prop.isObjectProperty()) {
                                    const value = prop.get('value');
                                    return value.isIdentifier({ name });
                                }
                                // We don't handle RestElement here yet as complicated
                                return false;
                            });
                            if (state.resultPath) {
                                state.resultPath = resolveObjectPatternPropertyToValue(state.resultPath);
                                break;
                            }
                        }
                        // ArrayPattern not handled yet
                    }
                }
                else if (declaration.hasNode() &&
                    declaration.has('id') &&
                    declaration.get('id').isIdentifier({ name })) {
                    // export function/class/type/interface/enum ...
                    state.resultPath = declaration;
                }
                else if (path.has('specifiers')) {
                    // export { ... } or export x from ... or export * as x from ...
                    for (const specifierPath of path.get('specifiers')) {
                        if (specifierPath.isExportNamespaceSpecifier()) {
                            continue;
                        }
                        const exported = specifierPath.get('exported');
                        if (exported.isIdentifier({ name })) {
                            // export ... from ''
                            if (path.has('source')) {
                                const local = specifierPath.isExportSpecifier()
                                    ? specifierPath.node.local.name
                                    : 'default';
                                state.resultPath = resolveImportedValue(path, local, file, seen);
                                if (state.resultPath) {
                                    break;
                                }
                            }
                            else {
                                state.resultPath = specifierPath.get('local');
                                break;
                            }
                        }
                    }
                }
                return state.resultPath ? path.stop() : path.skip();
            },
        },
        ExportDefaultDeclaration: {
            enter: function (path, state) {
                const { name } = state;
                if (name === 'default') {
                    state.resultPath = path.get('declaration');
                    return path.stop();
                }
                path.skip();
            },
        },
        ExportAllDeclaration: {
            enter: function (path, state) {
                const { name, file, seen } = state;
                const resolvedPath = resolveImportedValue(path, name, file, seen);
                if (resolvedPath) {
                    state.resultPath = resolvedPath;
                    return path.stop();
                }
                path.skip();
            },
        },
    });
    // Traverses the program looking for an export that matches the requested name
    function findExportedValue(file, name, seen) {
        const state = {
            file,
            name,
            seen,
        };
        file.traverse(explodedVisitors, state);
        return state.resultPath || null;
    }
    return resolveImportedValue;
}
