import { builderToModelPolicy } from '@mastra/core/agent-builder/ee';
import type { BuilderModelPolicy } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';

/**
 * Server-side wrapper around `builderToModelPolicy`.
 *
 * Handles the optional `IMastraEditor` builder API surface (older / OSS editors
 * may not implement `hasEnabledBuilderConfig` / `resolveBuilder`) and returns
 * a uniform `BuilderModelPolicy` to every call site.
 *
 * Returns `{ active: false }` whenever:
 * - no editor is configured,
 * - the editor doesn't expose builder methods,
 * - the builder config is disabled, or
 * - resolving the builder fails / yields nothing.
 */
export async function resolveBuilderModelPolicy(editor: IMastraEditor | undefined): Promise<BuilderModelPolicy> {
  if (!editor) return { active: false };
  if (typeof editor.resolveBuilder !== 'function') return { active: false };
  if (typeof editor.hasEnabledBuilderConfig === 'function' && !editor.hasEnabledBuilderConfig()) {
    return { active: false };
  }

  // Degrade to inactive on builder-resolution failure rather than letting the
  // rejection escape: agent execution routes seed this on every request, so a
  // transient failure must not 500 the entire route.
  try {
    const builder = await editor.resolveBuilder();
    return builderToModelPolicy(builder);
  } catch {
    return { active: false };
  }
}
