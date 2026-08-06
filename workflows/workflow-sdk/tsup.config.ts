import { readFile } from 'node:fs/promises';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

const DIRECTIVE_STATEMENT = /^\s*['"]use (?:step|workflow)['"];?\s*$/m;

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

/**
 * Fails the build if the host entry carries workflow directives.
 *
 * `splitting: false` copies shared modules into every entry that reaches them,
 * so a single host-side import of `workflows/runner` puts `"use workflow"` and
 * `"use step"` into `dist/index.js` as well. The Workflow SDK then discovers
 * the host entry as a second workflow module and compiles everything it imports
 * — `@mastra/core`, `node:crypto`, the whole host graph — into the sandbox.
 *
 * That is how the same `ReferenceError: require is not defined` survived
 * cleaning up `dist/workflows/index.js`: the leak had two sources and only one
 * was visible from the workflows entry. Nothing warns about this one. The SDK's
 * "bundle contains Node.js built-in imports" notice does not fire for it, and
 * the compile succeeds — it just reports two workflows where there is one.
 */
async function assertHostBundleHasNoDirectives() {
  const bundlePath = new URL('./dist/index.js', import.meta.url);
  const bundle = await readFile(bundlePath, 'utf8');
  if (DIRECTIVE_STATEMENT.test(bundle)) {
    throw new Error(
      `dist/index.js contains a "use step" or "use workflow" directive, so the Workflow SDK will ` +
        `discover the host entry as a workflow module and compile @mastra/core into the sandbox. ` +
        `Something under src/ outside src/workflows/ imports a directive-bearing module: the runner ` +
        `reaches runs through init({ runner }) instead — see WorkflowSdkRunOptions.runner.`,
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
      // subpath on the way out. The rewrite happens here rather than in the
      // source because the two forms cannot both be spelled the same way: a
      // relative specifier needs a `.js` extension to resolve as ESM at run
      // time, and a `.js`-suffixed relative import in a directive-reachable
      // file is invisible to the SDK's discovery pass — no build error, a
      // `WorkflowNotRegisteredError` at run time (vercel/workflow#3151). So the
      // source keeps the extensionless form the rest of the repo uses and the
      // build emits a bare specifier, which resolves through `exports`.
      name: 'keep-executor-lazy',
      setup(build) {
        build.onResolve({ filter: /^\.\.\/executor$/ }, () => ({
          path: '@mastra/workflow-sdk/executor',
          external: true,
        }));
      },
    },
  ],
  onSuccess: async () => {
    await generateTypes(process.cwd());
    await assertWorkflowBundleIsSandboxSafe();
    await assertHostBundleHasNoDirectives();
  },
});
