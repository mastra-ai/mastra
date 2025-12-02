/**
 * Normally esbuild can output a metafile containing the dependency
 * graph. However if bundling fails (say no dependency can be found)
 * then no metafile is produced.
 *
 * This plugin produces a similar dependency graph even in incomplete
 * bundling runs that are aborted early due to an error.
 *
 * It is WAY SLOWER!
 *
 * This enables a bundler error to be annotated with an import trace
 * describing why that file was imported.
 */
import * as esbuild from "esbuild";
interface ImportTracer {
    /**
     * Traces all import chains from a specific entry point to the specified file.
     * @param entryPoint The entry point to start the trace from.
     * @param filename The file to trace import chains to.
     * @returns An array of import chains, each chain being an array of file paths.
     */
    traceImportChains(entryPoint: string, filename: string): string[][];
    /**
     * Returns a copy of the entire dependency graph.
     * @returns A map where keys are importers and values are sets of imported files.
     */
    getDependencyGraph(): Map<string, Set<string>>;
}
interface ImportTracerPlugin {
    plugin: esbuild.Plugin;
    tracer: ImportTracer;
}
/**
 * Creates an esbuild plugin that tracks import dependencies.
 * The plugin builds a dependency graph during bundling without
 * reimplementing module resolution logic.
 *
 * @returns An object containing the plugin and a tracer for analyzing import chains.
 */
declare function createImportTracerPlugin(): ImportTracerPlugin;
export default createImportTracerPlugin;
//# sourceMappingURL=depgraph.d.ts.map