import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsContainer,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { formatCost, formatFullNumber } from '@mastra/playground-ui/utils/cost';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactElement } from 'react';

export type UsageMeter = { id: string; label: string; used: number; unit: string };

export type BillingOverviewProps = {
  planName: string;
  billingInterval: string;
  creditBalance?: number;
  meters: UsageMeter[];
  upgradeLabel?: string;
  canManageBilling: boolean;
  onOpenPlans: () => void;
  onAddCredits: () => void;
  usageLink: ReactElement;
};

export function BillingOverview({
  planName,
  billingInterval,
  creditBalance,
  meters,
  upgradeLabel,
  canManageBilling,
  onOpenPlans,
  onAddCredits,
  usageLink,
}: BillingOverviewProps) {
  const hasCredits = creditBalance !== undefined;
  return (
    <PageLayout
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>Billing</PageHeader.Title>
          <PageHeader.Action>
            <div className="flex items-center gap-2">
              <Button variant={upgradeLabel ? 'primary' : 'default'} onClick={onOpenPlans}>
                {upgradeLabel ?? 'Browse plans'}
              </Button>
              {hasCredits && (
                <Button variant={upgradeLabel ? 'default' : 'primary'} onClick={onAddCredits}>
                  Add credits
                </Button>
              )}
            </div>
          </PageHeader.Action>
        </PageHeader>
      }
    >
      <div className="mt-6 flex flex-col gap-10 pb-16">
        {!canManageBilling && (
          <Notice variant="info" title="Billing is read-only">
            <Notice.Message>Organization admins can change plans and payment details.</Notice.Message>
          </Notice>
        )}
        <div className="flex flex-wrap gap-4">
          <MetricsKpiCard>
            <MetricsKpiCard.Label>Plan</MetricsKpiCard.Label>
            <MetricsKpiCard.ValueRow>
              <MetricsKpiCard.Value>{planName}</MetricsKpiCard.Value>
              <Badge variant="neutral" size="sm">
                {billingInterval}
              </Badge>
            </MetricsKpiCard.ValueRow>
          </MetricsKpiCard>
          {hasCredits && (
            <MetricsKpiCard>
              <MetricsKpiCard.Label>Credits</MetricsKpiCard.Label>
              <MetricsKpiCard.ValueRow>
                <MetricsKpiCard.Value>{formatCost(creditBalance)}</MetricsKpiCard.Value>
              </MetricsKpiCard.ValueRow>
            </MetricsKpiCard>
          )}
        </div>
        <SettingsGroup>
          <SettingsHeader
            action={
              <Button size="sm" variant="link" render={usageLink} iconEnd={<ChevronRightIcon />}>
                View usage
              </Button>
            }
          >
            <SettingsTitle>Usage this period</SettingsTitle>
          </SettingsHeader>
          <SettingsContainer>
            {meters.map(meter => (
              <SettingsRow key={meter.id} label={meter.label}>
                <Txt as="span" variant="body-sm" className="tabular-nums">
                  {formatFullNumber(meter.used)} {meter.unit}
                </Txt>
              </SettingsRow>
            ))}
          </SettingsContainer>
        </SettingsGroup>
      </div>
    </PageLayout>
  );
}
