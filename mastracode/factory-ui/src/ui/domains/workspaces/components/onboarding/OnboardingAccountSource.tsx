import { useState } from 'react';

import type { ProviderInfo } from '../../../../../api/types';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { ProviderConnection } from '../../hooks/useProviderConnection';

export type AccountSource = 'gateway' | 'own';

export interface AccountSourceChoice {
  source: AccountSource;
  /** Gateway connects (or waits for its primary action); own drops the gateway and leaves the pick to the list. */
  choose: (next: AccountSource) => void;
}

/** The source the lane's selected provider belongs to; undefined while nothing is selected. */
function sourceOf(provider?: ProviderInfo, gateway?: ProviderInfo): AccountSource | undefined {
  if (!provider || !gateway) return undefined;
  return provider.provider === gateway.provider ? 'gateway' : 'own';
}

/**
 * Whether a lane that offers the Mastra Gateway is on it. The selected provider decides, so the tab never
 * disagrees with what Create submits; with nothing selected, the user's pick, else the recommended gateway
 * unless this user can't connect it (a member on the company account), which opens on their own provider.
 */
export function useAccountSource(connection: ProviderConnection): AccountSourceChoice {
  const [picked, setPicked] = useState<AccountSource>();
  const gateway = connection.gatewayProvider;
  const gatewayAllowed = !gateway || connection.canConfigure(gateway, 'api_key');
  return {
    source: sourceOf(connection.provider, gateway) ?? picked ?? (gatewayAllowed ? 'gateway' : 'own'),
    choose: next => {
      setPicked(next);
      if (next === 'own') {
        if (gateway && connection.provider === gateway) connection.clear();
        return;
      }
      if (gateway && connection.isConfigured(gateway, 'api_key')) connection.chooseGateway();
      else connection.clear();
    },
  };
}

/** The gateway a lane still has to connect: it is the lane's pick but the lane isn't on it yet. */
export function pendingGateway(lane: OnboardingModelLane, source: AccountSource): ProviderInfo | undefined {
  const gateway = lane.connection.gatewayProvider;
  if (!gateway || source !== 'gateway') return undefined;
  if (lane.connectedProvider?.provider === gateway.provider) return undefined;
  return gateway;
}
