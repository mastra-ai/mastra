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
import * as path from "path";

// Interface for the tracer object returned by the plugin
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

// Interface for the combined plugin and tracer
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
function createImportTracerPlugin(): ImportTracerPlugin {
  // Dependency graph: Map<importer, Set<imported>>
  const dependencyGraph = new Map<string, Set<string>>();
  // Set of entry points
  const entryPoints = new Set<string>();
  // Set of imports currently being processed to avoid infinite recursion
  const processingImports = new Set<string>();

  const plugin: esbuild.Plugin = {
    name: "import-tracer",
    setup(build) {
      // Reset state on new build
      build.onStart(() => {
        dependencyGraph.clear();
        entryPoints.clear();
        processingImports.clear();
      });

      // Capture entry points
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") {
          entryPoints.add(args.path);
        }
        return null; // Continue with normal resolution
      });

      // Track resolved imports
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (
          args.importer &&
          (args.kind === "import-statement" ||
            args.kind === "require-call" ||
            args.kind === "dynamic-import" ||
            args.kind === "require-resolve")
        ) {
          const importKey = `${args.importer}:${args.path}`;

          // Avoid infinite recursion
          if (processingImports.has(importKey)) {
            return null;
          }

          try {
            processingImports.add(importKey);

            //console.log("-------------> ", args.path);
            // Use esbuild's resolution logic - this lets us avoid
            // reimplementing module resolution ourselves
            const result = await build.resolve(args.path, {
              // Does it work to pretendit's always an import???
              kind: "import-statement",
              resolveDir: args.resolveDir,
            });

            if (result.errors.length === 0) {
              // Record the dependency relationship
              if (!dependencyGraph.has(args.importer)) {
                dependencyGraph.set(args.importer, new Set());
              }
              dependencyGraph.get(args.importer)!.add(result.path);
            }
          } finally {
            processingImports.delete(importKey);
          }
        }

        return null; // Let esbuild continue with normal resolution
      });
    },
  };

  const tracer: ImportTracer = {
    traceImportChains(entryPoint: string, filename: string): string[][] {
      const resolvedEntryPoint = path.resolve(entryPoint);

      // Find shortest path using BFS
      const findShortestPath = (
        start: string,
        target: string,
      ): string[] | null => {
        const queue: { node: string; path: string[] }[] = [
          { node: start, path: [start] },
        ];
        const visited = new Set<string>([start]);

        while (queue.length > 0) {
          const { node, path } = queue.shift()!;

          if (node === target) {
            return path;
          }

          const imports = dependencyGraph.get(node) || new Set();
          for (const imp of imports) {
            if (!visited.has(imp)) {
              visited.add(imp);
              queue.push({ node: imp, path: [...path, imp] });
            }
          }
        }

        return null;
      };

      const result = findShortestPath(resolvedEntryPoint, filename);
      return result ? [result] : [];
    },

    getDependencyGraph(): Map<string, Set<string>> {
      // Return a deep copy of the dependency graph
      const copy = new Map<string, Set<string>>();
      for (const [key, value] of dependencyGraph.entries()) {
        copy.set(key, new Set(value));
      }
      return copy;
    },
  };

  return { plugin, tracer };
}

export default createImportTracerPlugin;
