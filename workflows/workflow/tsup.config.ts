import { readFile } from 'node:fs/promises';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

/**
 * Fails the build if host-only code reached the workflow bundle.
 *
 * `dist/workflows/index.js` is evaluated inside the Workflow SDK's sandbox,
 * which has no `require` and no Node builtins. Anything `@mastra/core` pulls in
 * therefore has to stay behind the dynamic `import()` in `workflows/steps.ts`,
 * and whether it does is a property of how the bundler happened to lay the
 * output out rather than of the source — the source looked correct while the
 * build inlined the executor and broke every run with
 * `ReferenceError: require is not defined`.
 *
 * The integration suite cannot catch this: it builds the fixture from `src/`
 * through the SDK's own compiler, so this config never runs. Asserting on the
 * artifact is the only check that sees what a consumer installs.
 */
async function assertWorkflowBundleIsSandboxSafe() {
  const bundlePath = new URL('./dist/workflows/index.js', import.meta.url);
  const bundle = await readFile(bundlePath, 'utf8');
  const leaked = ['@mastra/core', 'node:'].filter(specifier => bundle.includes(`"${specifier}`));
  if (leaked.length > 0) {
    throw new Error(
      `dist/workflows/index.js imports ${leaked.join(', ')}, which the workflow sandbox cannot load. ` +
        `Host-only modules must stay behind the dynamic import() in src/workflows/steps.ts, and that ` +
        `module must stay external in this config — see the keep-executor-lazy plugin.`,
    );
  }
}

export default defineConfig({
  // `src/executor.ts` is an entry so that it stays a module of its own in the
  // output, reachable through the `./executor` subpath. Consumers have no
  // reason to import it; it is exported because the dynamic `import()` in
  // `workflows/steps.ts` only keeps `@mastra/core` out of the workflow sandbox
  // if there is a separate file on the other side of it, and a subpath is what
  // lets the emitted specifier resolve from any depth. See the
  // `keep-executor-lazy` plugin below.
  entry: ['src/index.ts', 'src/workflows/index.ts', 'src/executor.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  // Each entry must be a single self-contained file. `src/workflows/index.ts`
  // is what the consumer's Workflow SDK compiler processes, and it derives
  // workflow/step IDs from the module specifier of the file it sees. Splitting
  // would move the directive-bearing functions into shared chunks that no
  // `exports` subpath points at, so the IDs would fall back to raw file paths
  // and stop being stable across installs.
  splitting: false,
  // Treeshaking rewrites function bodies, which can drop the `"use workflow"` /
  // `"use step"` directive prologues the Workflow SDK compiler looks for.
  treeshake: false,
  sourcemap: true,
  // Resolved from the consumer's project so the sandbox and host runtimes agree.
  external: ['workflow', 'workflow/api', '@mastra/core'],
  esbuildPlugins: [
    {
      // Keeps `../executor` a real lazy load in the built output.
      //
      // `workflows/steps.ts` reaches the executor through a dynamic `import()`
      // inside a `"use step"` body, so the Workflow SDK compiler erases the
      // import along with the body and `@mastra/core` never reaches the
      // sandbox. That argument only holds while the executor is a separate
      // module: `splitting: false` is required for stable step ids (see
      // above), and with splitting off tsup cannot emit a shared chunk, so it
      // inlines the executor into `dist/workflows/index.js` and hoists its
      // static `@mastra/core` imports to the top of the file. The `import()`
      // then degrades into a lazy *initializer* over an already-imported
      // module rather than a lazy *load*, directive erasure has nothing left
      // to remove, and the sandbox evaluates `@mastra/core` and fails with
      // `ReferenceError: require is not defined`.
      //
      // Marking the specifier external is what reconciles the two
      // constraints, and it is rewritten to the package's own `./executor`
      // subpath on the way out. Two reasons it is done here rather than in the
      // source. A relative specifier would have to carry a `.js` extension to
      // resolve as ESM, and a `.js`-suffixed relative import in a
      // directive-reachable file is invisible to the SDK's discovery pass
      // (vercel/workflow#3151). It would also be depth-dependent: this step
      // lands in both `dist/index.js` and `dist/workflows/index.js`, which sit
      // at different depths, so one relative path cannot be right for both.
      // The bare specifier resolves through `exports` from either.
      name: 'keep-executor-lazy',
      setup(build) {
        build.onResolve({ filter: /^\.\.\/executor$/ }, () => ({
          path: '@mastra/workflow/executor',
          external: true,
        }));
      },
    },
  ],
  onSuccess: async () => {
    await generateTypes(process.cwd());
    await assertWorkflowBundleIsSandboxSafe();
  },
});
