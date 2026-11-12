import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { useAccountSource } from '../../hooks/useAccountSource';
import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import type { PreviewProvider, ProviderConnectionMethod } from '../../hooks/useProviderConnection';
import type { OnboardingModelScope } from '../../services/onboardingFlow';
import { createBlockedReason } from '../../services/createBlockedReason';
import { modelSectionIndex } from '../../services/onboardingSteps';
import { OnboardingAccountLanes } from './OnboardingAccountLanes';
import { OnboardingCreateNotice } from './OnboardingCreateNotice';
import { OnboardingInset } from './OnboardingInset';
import { OnboardingPageAction } from './OnboardingPageAction';
import { OnboardingScopeChoice } from './OnboardingScopeChoice';
import { OnboardingStepCard } from './OnboardingStepCard';

export interface OnboardingModelPreview {
  providerId?: string;
  method?: ProviderConnectionMethod;
  personalProviderId?: string;
  personalMethod?: ProviderConnectionMethod;
}

export interface OnboardingModelSectionProps {
  setup: OnboardingModelSetup;
  local: boolean;
  creating: boolean;
  error?: string;
  onScopeChange: (scope: OnboardingModelScope) => void;
  onCreate: () => void;
  onPreview: (patch: OnboardingModelPreview) => void;
}

/**
 * The Model step as two cards: Accounts asks who pays, Model holds the provider behind each account that
 * answer needs and the default models. Both stay open together, so changing who pays shows its accounts
 * right away. Local mode has a single connection, so only Model shows.
 */
export function OnboardingModelSection({
  setup,
  local,
  creating,
  error,
  onScopeChange,
  onCreate,
  onPreview,
}: OnboardingModelSectionProps) {
  const previewCompany: PreviewProvider = (providerId, method) => onPreview({ providerId, method });
  const previewPersonal: PreviewProvider = (personalProviderId, personalMethod) =>
    onPreview({ personalProviderId, personalMethod });
  const companyChoice = useAccountSource(setup.company.connection);
  const personalChoice = useAccountSource(setup.personal.connection);
  const loading = setup.company.connection.isPending;
  const blockedReasonId = useId();
  const blockedReason = loading || creating ? undefined : createBlockedReason(setup, local);

  return (
    <>
      {!local && (
        <OnboardingStepCard
          section="accounts"
          headerEnd={<SectionDetail>Who pays for model usage?</SectionDetail>}
          notice={
            setup.companyLocked && (
              <Notice variant="info">
                An admin needs to connect the company account first. Until then, everyone uses their own account.
              </Notice>
            )
          }
        >
          {loading ? (
            <LoadingInset label="Loading account options" rows={3} />
          ) : (
            <OnboardingScopeChoice
              scope={setup.scope}
              companyLocked={setup.companyLocked}
              disabled={creating}
              onScopeChange={next => {
                // Hybrid sessions can't run on the gateway, so a personal lane left on it starts over.
                const { connection } = setup.personal;
                if (
                  next === 'hybrid' &&
                  connection.gatewayProvider &&
                  connection.provider === connection.gatewayProvider
                )
                  connection.clear();
                onScopeChange(next);
              }}
            />
          )}
        </OnboardingStepCard>
      )}
      <OnboardingStepCard
        section="model"
        index={modelSectionIndex(local)}
        headerEnd={
          <SectionDetail key={local ? 'local' : setup.scope}>
            {local ? 'Local connection' : ACCOUNT_DETAILS[setup.scope]}
          </SectionDetail>
        }
      >
        {loading ? (
          <LoadingInset label="Loading model providers" rows={1} />
        ) : (
          <fieldset disabled={creating} className="m-0 min-w-0 border-0 p-0">
            {/* Each account is its own inset; in hybrid its heading sits on the card above it. */}
            <OnboardingAccountLanes
              setup={setup}
              local={local}
              creating={creating}
              companyChoice={companyChoice}
              personalChoice={personalChoice}
              onPreviewCompany={previewCompany}
              onPreviewPersonal={previewPersonal}
            />
          </fieldset>
        )}
      </OnboardingStepCard>
      <OnboardingPageAction
        notice={
          (error || blockedReason) && (
            <OnboardingCreateNotice error={error} blockedReason={blockedReason} id={blockedReasonId} />
          )
        }
      >
        <Button
          variant="primary"
          disabled={!setup.canCreate || creating}
          aria-describedby={!error && blockedReason ? blockedReasonId : undefined}
          onClick={onCreate}
        >
          <CreateFactoryLabel creating={creating} />
        </Button>
      </OnboardingPageAction>
    </>
  );
}

/** Re-keyed when its text changes, so the new detail fades in rather than swapping in place. */
function SectionDetail({ children }: { children: ReactNode }) {
  return (
    <Txt variant="meta" tone="muted" className="onboarding-enter">
      {children}
    </Txt>
  );
}

function LoadingInset({ label, rows }: { label: string; rows: number }) {
  return (
    <OnboardingInset>
      <SkeletonRows label={label} rows={rows} rowClassName="h-14 w-full" />
    </OnboardingInset>
  );
}

/** What the Model card covers under each answer: whose account it is, or how the two split. */
const ACCOUNT_DETAILS: Record<OnboardingModelScope, string> = {
  factory: 'Shared with your organization',
  hybrid: 'One for Factory work, one for your sessions',
  user: 'Only you',
};

function CreateFactoryLabel({ creating }: { creating: boolean }) {
  if (!creating) return 'Create factory';
  return (
    <>
      <Spinner size="sm" aria-hidden="true" />
      Creating your factory…
    </>
  );
}
