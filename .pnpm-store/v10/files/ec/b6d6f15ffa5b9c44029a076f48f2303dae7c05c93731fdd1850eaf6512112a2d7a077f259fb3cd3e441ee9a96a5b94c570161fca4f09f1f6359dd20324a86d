import DocumentationBuilder from './Documentation.js';
import postProcessDocumentation from './utils/postProcessDocumentation.js';
import babelParse from './babelParser.js';
import FileState from './FileState.js';
import { ERROR_CODES, ReactDocgenError } from './error.js';
import runResolver from './resolver/utils/runResolver.js';
function executeHandlers(handlers, componentDefinitions) {
    return componentDefinitions.map((componentDefinition) => {
        const documentation = new DocumentationBuilder();
        handlers.forEach((handler) => handler(documentation, componentDefinition));
        return postProcessDocumentation(documentation.build());
    });
}
/**
 * Takes JavaScript source code and returns an object with the information
 * extract from it.
 *
 * `resolver` is a strategy to find the AST node(s) of the component
 * definition(s) inside `src`.
 * It is a function that gets passed the program AST node of
 * the source as first argument, and a reference to the parser as second argument.
 *
 * This allows you define your own strategy for finding component definitions.
 *
 * `handlers` is an array of functions which are passed a reference to the
 * component definitions (extracted by `resolver`) so that they can extract
 * information from it. They get also passed a reference to a `Documentation`
 * object to attach the information to. A reference to the parser is parsed as the
 * last argument.
 */
export default function parse(code, config) {
    const { babelOptions, handlers, importer, resolver } = config;
    const ast = babelParse(code, babelOptions);
    const fileState = new FileState(babelOptions, {
        ast,
        code,
        importer,
    });
    const componentDefinitions = runResolver(resolver, fileState);
    if (componentDefinitions.length === 0) {
        throw new ReactDocgenError(ERROR_CODES.MISSING_DEFINITION);
    }
    return executeHandlers(handlers, componentDefinitions);
}
