import type { BuilderModelPolicy } from '@mastra/client-js';
import { useContext } from 'react';
import { ModelPolicyContext } from '../context/model-policy-context';

/**
 * Returns the server-resolved {@link BuilderModelPolicy} for the enclosing
 * {@link ModelPolicyProvider}'s surface.
 *
 * Defaults to `{ active: false }` when no provider is mounted, when the
 * server-side fetch is still in flight, or when the surface has no
 * admin-configured policy source yet (currently always the `'editor'` surface).
 * Consumers can therefore rely on `policy.active === false` as the "no
 * restrictions" guard regardless of mount context.
 *
 * Components that participate in multiple surfaces (e.g. the composer rendered
 * inside both the builder preview and the editor) intentionally do not pick a
 * surface themselves — they read whatever surface their enclosing route shell
 * mounted.
 */
export const useModelPolicy = (): BuilderModelPolicy => {
  return useContext(ModelPolicyContext).policy;
};
