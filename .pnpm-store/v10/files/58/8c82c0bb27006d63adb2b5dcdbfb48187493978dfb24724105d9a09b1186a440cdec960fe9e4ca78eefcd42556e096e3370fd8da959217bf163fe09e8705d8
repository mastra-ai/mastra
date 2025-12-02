import type { PluginImpl } from "rollup";
import { FilterPattern } from "@rollup/pluginutils";
export type OptimizeLodashOptions = {
    /**
     * A minimatch pattern, or array of patterns, of files that should be
     * processed by this plugin (if omitted, all files are included by default)
     */
    include?: FilterPattern;
    /**
     * Files that should be excluded, if `include` is otherwise too permissive.
     */
    exclude?: FilterPattern;
    /**
     * Changes *all* lodash imports (but not lodash/fp imports!) to 'lodash-es' imports.
     * Don't use this for CommonJS outputs, the plugin will error should you do so.
     */
    useLodashEs?: true;
    /**
     * Default: true. Appends '.js' to the end of optimized Lodash CJS imports. Required
     * by some bundling tools.
     */
    appendDotJs?: boolean;
};
/**
 * Converts lodash imports to be specific, enabling better tree-shaking:
 *
 * `import { isNil } from "lodash";` -> `import { isNil } from "lodash/isNil";`
 *
 * Note that only specific named imports are supported, unlike babel-plugin-lodash. For example,
 * this plugin will print a warning for this import and make no changes to the import:
 *
 * `import _ from "lodash";`
 *
 * Optionally, set `useLodashEs` to true and `lodash` imports will be converted to `lodash-es`
 * imports. Note that it's up to user to include the `lodash-es` module and ensure the output
 * is set to some form of `es`/`esm`/`module` (other output formats will error). An example:
 *
 * `import { isNil } from "lodash";` -> `import { isNil } from "lodash-es";`
 *
 * @param include files/globs to include with this plugin (optional)
 * @param exclude files/globs to exclude from this plugin (optional)
 * @param useLodashEs set `true` to convert imports to use "lodash-es" (optional; default false)
 * @param appendDotJs default `true`; set `false` if you don't want `.js` appended to CJS lodash imports
 */
export declare const optimizeLodashImports: PluginImpl<OptimizeLodashOptions>;
//# sourceMappingURL=index.d.ts.map