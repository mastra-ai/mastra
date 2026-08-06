import { fileURLToPath } from 'node:url';
import { defineConfig } from 'nitro';

/**
 * Force @mastra/workflow-sdk into the server bundle. Nitro externalizes
 * node_modules, but the `"use workflow"` directive transform only runs on
 * bundled files — if the package stays external, `mastraRunner` reaches
 * `start()` untransformed and every run fails with "received an invalid
 * workflow function". The Workflow SDK inlines its own `@workflow/*` packages
 * for the same reason; `order: 'pre'` is what lets this resolution win over
 * Nitro's externals plugin.
 */
const inlineMastraWorkflowSdk = {
  name: 'mastra:force-inline-workflow-sdk',
  resolveId: {
    order: 'pre' as const,
    async handler(
      source: string,
      importer: string | undefined,
      options: Record<string, unknown>,
    ): Promise<{ id: string; external: false } | null> {
      if (source !== '@mastra/workflow-sdk' && !source.startsWith('@mastra/workflow-sdk/')) return null;
      if (!importer) return null;
      // @ts-expect-error `this` is the rollup plugin context
      const resolved: { id: string } | null = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const id: string = resolved.id.startsWith('file://') ? fileURLToPath(resolved.id) : resolved.id;
      return { id, external: false };
    },
  },
};

export default defineConfig({
  serverDir: './server',
  // Pin the workspace root to this example. Nitro otherwise walks up and
  // detects the monorepo root, and the Workflow SDK derives workflow ids from
  // that root — giving the compile pass and the server bundle two different
  // ids for `mastraRunner` (WorkflowNotRegisteredError at runtime).
  workspaceDir: fileURLToPath(new URL('.', import.meta.url)),
  // Enables the `"use workflow"` / `"use step"` directives and scans the
  // `workflows/` directory — that is where `workflows/mastra.ts` registers
  // the @mastra/workflow-sdk runner.
  modules: ['workflow/nitro'],
  hooks: {
    'rollup:before'(_nitro, config) {
      (config.plugins as unknown[]).unshift(inlineMastraWorkflowSdk);
    },
  },
});
