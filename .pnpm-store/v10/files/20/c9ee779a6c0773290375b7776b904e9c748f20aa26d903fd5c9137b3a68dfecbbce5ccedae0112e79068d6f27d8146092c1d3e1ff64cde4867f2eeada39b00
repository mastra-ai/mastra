import type FileState from '../FileState.js';
import type { ComponentNodePath, ResolverClass } from './index.js';
interface FindExportedDefinitionsResolverOptions {
    limit?: number;
}
/**
 * Given an AST, this function tries to find the exported component definitions.
 *
 * The component definitions are either the ObjectExpression passed to
 * `React.createClass` or a `class` definition extending `React.Component` or
 * having a `render()` method.
 *
 * If a definition is part of the following statements, it is considered to be
 * exported:
 *
 * modules.exports = Definition;
 * exports.foo = Definition;
 * export default Definition;
 * export var Definition = ...;
 *
 * limit can be used to limit the components to be found. When the limit is reached an error will be thrown
 */
export default class FindExportedDefinitionsResolver implements ResolverClass {
    limit: number;
    constructor({ limit }?: FindExportedDefinitionsResolverOptions);
    resolve(file: FileState): ComponentNodePath[];
}
export {};
