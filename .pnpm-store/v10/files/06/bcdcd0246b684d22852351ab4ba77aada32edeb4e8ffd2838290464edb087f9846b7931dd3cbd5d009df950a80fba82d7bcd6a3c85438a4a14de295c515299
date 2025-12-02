import { Plugin } from 'rollup';
import { TransformOptions, BuildOptions, Loader } from 'esbuild';
import { FilterPattern } from 'unplugin-utils';

type Prettify<Type> = Type extends Function ? Type : Extract<{
    [Key in keyof Type]: Type[Key];
}, Type>;

type OptionalKeys<Type> = Type extends object ? keyof {
    [Key in keyof Type as Type extends Required<Pick<Type, Key>> ? never : Key]: never;
} : never;

type MarkOptional<Type, Keys extends keyof Type> = Type extends Type ? Prettify<Partial<Type> & Required<Omit<Type, Keys | OptionalKeys<Type>>>> : never;

type Options$1 = Omit<TransformOptions, 'sourcemap'> & {
    sourceMap?: boolean;
};
declare const minify: ({ sourceMap, ...options }?: Options$1) => Plugin;

type OptimizeDepsOptions = {
    include: string[];
    exclude?: string[];
    cwd: string;
    esbuildOptions?: BuildOptions;
    sourceMap: boolean;
};

type Options = Omit<TransformOptions, 'sourcemap' | 'loader'> & {
    include?: FilterPattern;
    exclude?: FilterPattern;
    sourceMap?: boolean;
    optimizeDeps?: MarkOptional<OptimizeDepsOptions, 'cwd' | 'sourceMap'>;
    /**
     * Use this tsconfig file instead
     * Disable it by setting to `false`
     */
    tsconfig?: string | false;
    /**
     * Map extension to esbuild loader
     * Note that each entry (the extension) needs to start with a dot
     */
    loaders?: {
        [ext: string]: Loader | false;
    };
};
declare const _default: ({ include, exclude, sourceMap, optimizeDeps, tsconfig, loaders: _loaders, ...esbuildOptions }?: Options) => Plugin;

export { type Options, _default as default, minify };
