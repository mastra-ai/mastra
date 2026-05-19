import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { INACTIVE_MODEL_POLICY, ModelPolicyContext } from './model-policy-context';
import type { ModelPolicyContextValue, ModelPolicySurface } from './model-policy-context';

export interface ModelPolicyProviderProps {
  surface: ModelPolicySurface;
  children: ReactNode;
}

/**
 * Fetches the server-resolved model policy for the given surface via
 * `GET /editor/settings/model-policy?surface=...` and exposes it through
 * {@link ModelPolicyContext} to all descendants (including any composer or
 * model switcher rendered inside the surface).
 *
 * One provider per route shell is the expected mount pattern: builder route
 * wraps with `surface="builder"`, CMS agent-edit wraps with `surface="editor"`.
 * Composers inherit from their enclosing surface — they intentionally do not
 * mount their own provider.
 *
 * While the request is in flight, descendants see {@link INACTIVE_MODEL_POLICY}
 * so they render unrestricted rather than briefly hiding allowed providers.
 */
export const ModelPolicyProvider = ({ surface, children }: ModelPolicyProviderProps) => {
  const client = useMastraClient();

  const { data, isLoading } = useQuery({
    queryKey: ['model-policy', surface],
    queryFn: () => client.getModelPolicy({ surface }),
  });

  const value = useMemo<ModelPolicyContextValue>(
    () => ({
      policy: data ?? INACTIVE_MODEL_POLICY,
      surface,
      isLoading,
    }),
    [data, surface, isLoading],
  );

  return <ModelPolicyContext.Provider value={value}>{children}</ModelPolicyContext.Provider>;
};
