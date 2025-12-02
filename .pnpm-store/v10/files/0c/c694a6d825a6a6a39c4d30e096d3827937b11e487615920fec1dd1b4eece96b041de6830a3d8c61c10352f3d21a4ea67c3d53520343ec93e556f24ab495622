import type { Plugin, PluginHooks } from 'rollup';
type MapToFunction<T> = T extends (...args: any[]) => any ? T : never;
export type ResolverFunction = MapToFunction<PluginHooks['resolveId']>;
export interface ResolverObject {
    buildStart?: PluginHooks['buildStart'];
    resolveId: ResolverFunction;
}
export interface Alias {
    find: string | RegExp;
    replacement: string;
    customResolver?: ResolverFunction | ResolverObject | null;
}
export interface ResolvedAlias {
    find: string | RegExp;
    replacement: string;
    resolverFunction: ResolverFunction | null;
}
export interface RollupAliasOptions {
    /**
     * Instructs the plugin to use an alternative resolving algorithm,
     * rather than the Rollup's resolver.
     * @default null
     */
    customResolver?: ResolverFunction | ResolverObject | null;
    /**
     * Specifies an `Object`, or an `Array` of `Object`,
     * which defines aliases used to replace values in `import` or `require` statements.
     * With either format, the order of the entries is important,
     * in that the first defined rules are applied first.
     */
    entries?: readonly Alias[] | {
        [find: string]: string;
    };
}
export default function alias(options?: RollupAliasOptions): Plugin;
export {};
//# sourceMappingURL=index.d.ts.map