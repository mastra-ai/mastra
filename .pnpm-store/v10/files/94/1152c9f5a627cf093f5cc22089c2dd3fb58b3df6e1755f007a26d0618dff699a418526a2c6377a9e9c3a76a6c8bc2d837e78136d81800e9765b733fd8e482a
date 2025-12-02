import type FileState from '../FileState.js';
import type { ComponentNodePath, ResolverClass } from './index.js';
interface FindAnnotatedDefinitionsResolverOptions {
    annotation?: string;
}
/**
 * Given an AST, this function tries to find all react components which
 * are annotated with an annotation
 */
export default class FindAnnotatedDefinitionsResolver implements ResolverClass {
    annotation: string;
    constructor({ annotation, }?: FindAnnotatedDefinitionsResolverOptions);
    resolve(file: FileState): ComponentNodePath[];
}
export {};
