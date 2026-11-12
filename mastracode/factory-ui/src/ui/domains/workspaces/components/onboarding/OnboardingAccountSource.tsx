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

/**
 * Whether a lane that offers the Mastra Gateway is on it: the user's pick, else the restored provider's
 * kind, else the recommended gateway. The submitted provider always matches the pick: choosing the
 * gateway selects it, leaving it clears it.
 */
export function useAccountSource(connection: ProviderConnection): AccountSourceChoice {
  const [picked, setPicked] = useState<AccountSource>();
  const gateway = connection.gatewayProvider;
  const restored = connection.provider;
  const ownRestored = Boolean(restored && gateway && restored.provider !== gateway.provider);
  return {
    source: picked ?? (ownRestored ? 'own' : 'gateway'),
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
