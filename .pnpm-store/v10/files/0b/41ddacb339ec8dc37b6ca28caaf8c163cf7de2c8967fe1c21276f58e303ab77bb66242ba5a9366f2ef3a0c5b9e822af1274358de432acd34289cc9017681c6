import type { TransformOptions } from '@babel/core';
import type { Handler } from './handlers/index.js';
import type { Importer } from './importer/index.js';
import type { Resolver } from './resolver/index.js';
export interface Config {
    handlers?: Handler[];
    importer?: Importer;
    resolver?: Resolver;
    /**
     * shortcut for `babelOptions.filename`
     * Set to an absolute path (recommended) to the file currently being parsed or
     * to an relative path that is relative to the `babelOptions.cwd`.
     */
    filename?: string;
    babelOptions?: TransformOptions;
}
export type InternalConfig = Omit<Required<Config>, 'filename'>;
export declare const defaultHandlers: Handler[];
export declare function createConfig(inputConfig: Config): InternalConfig;
