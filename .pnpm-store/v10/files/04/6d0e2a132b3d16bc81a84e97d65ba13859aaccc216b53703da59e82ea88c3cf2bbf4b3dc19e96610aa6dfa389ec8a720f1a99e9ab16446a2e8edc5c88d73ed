import { MessagePort } from 'node:worker_threads';
import { UrlAndMap } from 'source-map-support';
import { TransformOptions } from 'esbuild';

type Transformed = {
    code: string;
    map: RawSourceMap;
    warnings?: unknown[];
};

type RawSourceMap = UrlAndMap['map'];
declare function installSourceMapSupport(
/**
 * To support Node v20 where loaders are executed in its own thread
 * https://nodejs.org/docs/latest-v20.x/api/esm.html#globalpreload
 */
loaderPort?: MessagePort): ({ code, map }: Transformed, filePath: string, mainThreadPort?: MessagePort) => string;

declare function transformDynamicImport(filePath: string, code: string): {
    code: string;
    map: any;
} | undefined;

declare function transformSync(code: string, filePath: string, extendOptions?: TransformOptions): Transformed;
declare function transform(code: string, filePath: string, extendOptions?: TransformOptions): Promise<Transformed>;

declare const resolveTsPath: (filePath: string) => string | undefined;

type Version = [number, number, number];
declare const compareNodeVersion: (version: Version) => number;

export { RawSourceMap, compareNodeVersion, installSourceMapSupport, resolveTsPath, transform, transformDynamicImport, transformSync };
