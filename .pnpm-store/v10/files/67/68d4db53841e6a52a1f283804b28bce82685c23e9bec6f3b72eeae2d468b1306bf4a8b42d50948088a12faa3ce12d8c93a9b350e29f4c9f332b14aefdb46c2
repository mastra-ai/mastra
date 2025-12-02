import { childContextTypeHandler, codeTypeHandler, componentDocblockHandler, componentMethodsHandler, componentMethodsJsDocHandler, contextTypeHandler, defaultPropsHandler, displayNameHandler, propDocblockHandler, propTypeCompositionHandler, propTypeHandler, } from './handlers/index.js';
import { fsImporter } from './importer/index.js';
import { ChainResolver, FindAnnotatedDefinitionsResolver, FindExportedDefinitionsResolver, } from './resolver/index.js';
const defaultResolvers = [
    new FindExportedDefinitionsResolver({
        limit: 1,
    }),
    new FindAnnotatedDefinitionsResolver(),
];
const defaultResolver = new ChainResolver(defaultResolvers, {
    chainingLogic: ChainResolver.Logic.ALL,
});
const defaultImporter = fsImporter;
export const defaultHandlers = [
    propTypeHandler,
    contextTypeHandler,
    childContextTypeHandler,
    propTypeCompositionHandler,
    propDocblockHandler,
    codeTypeHandler,
    defaultPropsHandler,
    componentDocblockHandler,
    displayNameHandler,
    componentMethodsHandler,
    componentMethodsJsDocHandler,
];
export function createConfig(inputConfig) {
    const { babelOptions, filename, handlers, importer, resolver } = inputConfig;
    const config = {
        babelOptions: { ...babelOptions },
        handlers: handlers ?? defaultHandlers,
        importer: importer ?? defaultImporter,
        resolver: resolver ?? defaultResolver,
    };
    if (filename) {
        config.babelOptions.filename = filename;
    }
    return config;
}
