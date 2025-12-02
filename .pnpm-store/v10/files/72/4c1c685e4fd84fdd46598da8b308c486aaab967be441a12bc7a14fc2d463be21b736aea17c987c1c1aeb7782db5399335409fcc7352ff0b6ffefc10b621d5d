import type FileState from '../FileState.js';
import type { ComponentNodePath, Resolver, ResolverClass } from './index.js';
declare enum ChainingLogic {
    ALL = 0,
    FIRST_FOUND = 1
}
interface ChainResolverOptions {
    chainingLogic?: ChainingLogic;
}
export default class ChainResolver implements ResolverClass {
    resolvers: Resolver[];
    options: ChainResolverOptions;
    static Logic: typeof ChainingLogic;
    constructor(resolvers: Resolver[], options: ChainResolverOptions);
    private resolveFirstOnly;
    private resolveAll;
    resolve(file: FileState): ComponentNodePath[];
}
export {};
