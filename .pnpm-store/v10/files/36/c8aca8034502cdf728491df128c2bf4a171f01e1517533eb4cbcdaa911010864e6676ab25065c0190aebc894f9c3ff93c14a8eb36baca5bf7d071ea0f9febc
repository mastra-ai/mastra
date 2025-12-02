import type DocumentationBuilder from './Documentation.js';
import type { BaseType, Documentation, ElementsType, FunctionArgumentType, FunctionSignatureType, LiteralType, MethodParameter, MethodReturn, ObjectSignatureType, PropDescriptor, PropTypeDescriptor, SimpleType, TSFunctionSignatureType, TypeDescriptor } from './Documentation.js';
import type FileState from './FileState.js';
import type { Config } from './config.js';
import { defaultHandlers } from './config.js';
import { ERROR_CODES } from './error.js';
import type { Handler } from './handlers/index.js';
import * as builtinHandlers from './handlers/index.js';
import type { Importer } from './importer/index.js';
import { makeFsImporter } from './importer/index.js';
import type { Resolver, ResolverClass, ResolverFunction } from './resolver/index.js';
import * as builtinResolvers from './resolver/index.js';
import * as utils from './utils/index.js';
declare const builtinImporters: {
    fsImporter: Importer;
    ignoreImporter: Importer;
};
declare module '@babel/traverse' {
    interface HubInterface {
        file: FileState;
        parse: typeof FileState.prototype.parse;
        import: typeof FileState.prototype.import;
    }
    interface Hub {
        file: FileState;
        parse: typeof FileState.prototype.parse;
        import: typeof FileState.prototype.import;
    }
}
/**
 * Parse the *src* and scan for react components based on the config
 * that gets supplied.
 *
 * The default resolvers look for *exported* react components.
 *
 * By default all handlers are applied, so that all possible
 * different use cases are covered.
 *
 * The default importer is the fs-importer that tries to resolve
 * files based on the nodejs resolve algorithm.
 */
declare function defaultParse(src: Buffer | string, config?: Config): Documentation[];
export type { NodePath } from '@babel/traverse';
export type * as babelTypes from '@babel/types';
export { builtinHandlers, builtinImporters, builtinResolvers, defaultHandlers, ERROR_CODES, makeFsImporter, defaultParse as parse, utils, };
export type { BaseType, Config, Documentation, DocumentationBuilder, ElementsType, FileState, FunctionArgumentType, FunctionSignatureType, Handler, Importer, LiteralType, MethodParameter, MethodReturn, ObjectSignatureType, PropDescriptor, PropTypeDescriptor, Resolver, ResolverClass, ResolverFunction, SimpleType, TSFunctionSignatureType, TypeDescriptor, };
