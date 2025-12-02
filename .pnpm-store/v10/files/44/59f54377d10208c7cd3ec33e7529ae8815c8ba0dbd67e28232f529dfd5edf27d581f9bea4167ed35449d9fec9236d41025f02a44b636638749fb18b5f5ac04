interface Options {
    warn?: (message: string) => void;
}

/**
 * Fix default exports.
 *
 * **WARNING**: this function doesn't handle local imports/exports transformations.
 *
 * @param code The code to transform.
 * @param fileName The file name.
 * @param options The options to be used.
 * @return The transformed code or `undefined` if no transformation was needed.
 */
declare function transformDtsDefaultCJSExports(code: string, fileName: string, options?: Options): string | undefined;
/**
 * Fix default exports in the file and writes the changes to the file when needed, otherwise the files remains untouched.
 *
 * @param dtsPath The path to the file to fix.
 * @param options The path
 */
declare function fixDtsFileDefaultCJSExports(dtsPath: string, options?: Options): Promise<boolean>;
interface TransformOptions {
    warn?: (message: string) => void;
    transformLocalImports?: (code: string, dtsPath: string, dtsDestPath: string) => string;
}
/**
 * Given an `ESM` dts file, transform it to a `d.ts` or `d.cts` file fixing CJS default exports changing the import/exports when needed.
 *
 * @param dtsPath The source `ESM` (`d.ts` or `.d.mts`) file path.
 * @param dtsDestPath The destination `.d.ts` or `.d.cts` file path.
 * @param options The options to use.
 * @see {@link defaultLocalImportsTransformer}
 */
declare function transformESMDtsToCJSDts(dtsPath: string, dtsDestPath: string, options?: TransformOptions): Promise<void>;
/**
 * Given an `ESM` dts file, transform it to a `d.ts` or `d.cts` file fixing CJS default exports.
 *
 * **NOTE**: local imports/exports will be replaced with the corresponding extension using source and destination files:
 * - when `dtsPath` is a `.d.ts` and `dtsDestPath` is a `d.cts`: `import { foo } from './foo.js'` -> `import { foo } from './foo.cjs'`
 * - when `dtsPath` is a `.d.mts` and `dtsDestPath` is a `d.ts`: `import { foo } from './foo.mjs'` -> `import { foo } from './foo.js'`
 * - when `dtsPath` is a `.d.mts` and `dtsDestPath` is a `d.cts`: `import { foo } from './foo.mjs'` -> `import { foo } from './foo.cjs'`
 *
 * @param code The code to transform.
 * @param dtsPath The source `ESM` (`d.ts` or `.d.mts`) file path.
 * @param dtsDestPath The destination `.d.ts` or `.d.cts` file path.
 * @return The transformed code.
 */
declare function defaultLocalImportsTransformer(code: string, dtsPath: string, dtsDestPath: string): string;

export { type Options, type TransformOptions, defaultLocalImportsTransformer, fixDtsFileDefaultCJSExports, transformDtsDefaultCJSExports, transformESMDtsToCJSDts };
