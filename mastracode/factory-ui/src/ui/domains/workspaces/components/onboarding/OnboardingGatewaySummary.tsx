import { Metadata } from '@mastra/playground-ui/components/Metadata';
import type { ReactNode } from 'react';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ProviderInfo } from '../../../../../api/types';
import { MastraGatewayBilling } from '../MastraGatewayBilling';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
import { OnboardingProviderSummary, RecommendedBadge } from './OnboardingProviderSummary';

/** The gateway as the lane's provider: nothing to pick, one button connects it. */
export function OnboardingGatewaySummary({
  gateway,
  connected,
  children,
}: {
  gateway: ProviderInfo;
  connected: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="onboarding-enter flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <OnboardingProviderSummary
          icon={<ProviderBrandIcon provider={gateway.provider} />}
          title={providerDisplayName(gateway.provider)}
          badge={<RecommendedBadge />}
          meta={
            <Metadata>
              {connected && <Metadata.Item>Connected</Metadata.Item>}
              <Metadata.Item>
                <MastraGatewayBilling />
              </Metadata.Item>
            </Metadata>
          }
        />
      </div>
      {/* Lined up with the title, past the icon column. */}
      {children && <div className="ps-8">{children}</div>}
    </div>
  );
}
