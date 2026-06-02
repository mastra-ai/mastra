import { useMemo } from 'react';
import { useToolProviders } from '../../../../tool-providers/hooks/use-tool-providers';
import type { AgentTool } from '../../../types/agent-tool';

// Sentinel id for the synthetic "Built-in" toolkit group that covers all
// native tools/agents/workflows in the left filter pane. Chosen so it can
// never collide with a real provider toolkit slug.
export const BUILT_IN_TOOLKIT_ID = '__built-in__';

export interface ToolkitOption {
  id: string;
  label: string;
}

/**
 * A provider that has at least one prefetched tool. `presentSlugs` are the
 * toolkit slugs that actually have loaded tools in `availableAgentTools`; each
 * section fetches its own toolkit display names lazily from these.
 */
export interface ProviderSection {
  providerId: string;
  providerName: string;
  presentSlugs: string[];
}

export interface ProviderToolkitGroups {
  /** Synthetic Built-in group; present only when native items exist. */
  builtIn: ToolkitOption[];
  /** One section per provider that has at least one toolkit with loaded tools. */
  providers: ProviderSection[];
  /** Flat list of every toolkit id rendered across all groups. */
  allToolkitIds: string[];
  /** Providers list still loading. */
  isProvidersLoading: boolean;
}

/**
 * Sources the left-pane toolkit options grouped by provider — synchronously.
 *
 * Provider toolkit ids/grouping come entirely from the already-prefetched
 * `availableAgentTools`, so the parent always knows the full toolkit id set
 * up-front (needed for default-all-checked + Select all / Clear all) without
 * waiting on any `listToolkits` call. Display *names* are fetched lazily by
 * each provider section, so this hook does no async fan-out. Toolkit ids stay
 * the bare provider slug to preserve the caller's `Set<toolkit>` contract.
 */
export const useProviderToolkitGroups = (availableAgentTools: AgentTool[]): ProviderToolkitGroups => {
  const providersQuery = useToolProviders();
  const providers = providersQuery.data?.providers;

  return useMemo(() => {
    // Which toolkit slugs each provider has loaded tools for, plus whether any
    // native (built-in) item exists.
    const slugsByProvider = new Map<string, Set<string>>();
    let hasBuiltIn = false;
    for (const item of availableAgentTools) {
      if (item.type === 'integration' && item.providerId && item.toolkit) {
        const set = slugsByProvider.get(item.providerId) ?? new Set<string>();
        set.add(item.toolkit);
        slugsByProvider.set(item.providerId, set);
      } else {
        hasBuiltIn = true;
      }
    }

    const builtIn: ToolkitOption[] = hasBuiltIn ? [{ id: BUILT_IN_TOOLKIT_ID, label: 'Built-in' }] : [];

    const providerSections: ProviderSection[] = (providers ?? [])
      .filter(p => slugsByProvider.has(p.id))
      .map(p => ({
        providerId: p.id,
        providerName: p.name,
        presentSlugs: Array.from(slugsByProvider.get(p.id) ?? new Set<string>()),
      }));

    const allToolkitIds = [...builtIn.map(t => t.id), ...providerSections.flatMap(s => s.presentSlugs)];

    return {
      builtIn,
      providers: providerSections,
      allToolkitIds,
      isProvidersLoading: providersQuery.isLoading,
    };
  }, [availableAgentTools, providers, providersQuery.isLoading]);
};
