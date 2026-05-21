import type { BuilderModelPolicy } from '@mastra/client-js';
import { createContext } from 'react';

/**
 * Surface a {@link ModelPolicyProvider} is scoped to. Each UI surface declares
 * which policy slot it reads so admin model restrictions stay scoped to the
 * surface they were configured for.
 *
 * - `'builder'` — Agent Builder (admin-configured model allowlist).
 * - `'editor'` — CMS agent editor + standalone composer (no admin policy yet;
 *   resolves to `{ active: false }` server-side until `editor.editorAgents.modelPolicy`
 *   lands in a follow-up release).
 */
export type ModelPolicySurface = 'builder' | 'editor';

/**
 * Inactive policy returned when no provider is mounted, when the server hasn't
 * reported a policy for the surface yet (loading), or when the surface has no
 * admin-configured source. Consumers rely on `policy.active === false` as the
 * "no restrictions" guard.
 */
export const INACTIVE_MODEL_POLICY: BuilderModelPolicy = { active: false };

export interface ModelPolicyContextValue {
  policy: BuilderModelPolicy;
  surface: ModelPolicySurface | null;
  isLoading: boolean;
}

export const ModelPolicyContext = createContext<ModelPolicyContextValue>({
  policy: INACTIVE_MODEL_POLICY,
  surface: null,
  isLoading: false,
});
