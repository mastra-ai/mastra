import { builderToModelPolicy } from '@mastra/core/agent-builder/ee';
import type { ModelPolicy, ModelPolicySurface } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';

export interface ResolveModelPolicyParams {
  editor: IMastraEditor | undefined;
  surface: ModelPolicySurface;
}

/**
 * Server-side resolver of the {@link ModelPolicy} for a given UI surface.
 *
 * Today only the `'builder'` surface has a real admin-configurable source;
 * the `'editor'` surface always resolves to `{ active: false }` until a
 * dedicated `editor.editorAgents.modelPolicy` slot is added in a future
 * release.
 *
 * Handles the optional `IMastraEditor` builder API surface (older / OSS
 * editors may not implement `hasEnabledBuilderConfig` / `resolveBuilder`)
 * and returns a uniform {@link ModelPolicy} to every call site.
 *
 * Returns `{ active: false }` whenever:
 * - no editor is configured,
 * - the editor doesn't expose builder methods,
 * - the builder config is disabled,
 * - resolving the builder fails / yields nothing, or
 * - the requested surface has no source yet (e.g. `'editor'`).
 */
export async function resolveModelPolicy({ editor, surface }: ResolveModelPolicyParams): Promise<ModelPolicy> {
  if (surface === 'editor') return { active: false };

  if (!editor) return { active: false };
  if (typeof editor.resolveBuilder !== 'function') return { active: false };
  if (typeof editor.hasEnabledBuilderConfig === 'function' && !editor.hasEnabledBuilderConfig()) {
    return { active: false };
  }

  try {
    const builder = await editor.resolveBuilder();
    return builderToModelPolicy(builder);
  } catch {
    return { active: false };
  }
}

/**
 * @deprecated Use {@link resolveModelPolicy} with `{ surface: 'builder' }`.
 * Preserved for backward compatibility; will be removed in a future major release.
 */
export async function resolveBuilderModelPolicy(editor: IMastraEditor | undefined): Promise<ModelPolicy> {
  return resolveModelPolicy({ editor, surface: 'builder' });
}
