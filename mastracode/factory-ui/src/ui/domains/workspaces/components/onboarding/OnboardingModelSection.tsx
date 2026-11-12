import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RadioGroup } from '@mastra/playground-ui/components/RadioGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, Split, UserRound } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import type { PreviewProvider, ProviderConnectionMethod } from '../../hooks/useProviderConnection';
import type { OnboardingModelScope } from '../../services/onboardingFlow';
import { SETUP_LABELS } from '../../services/onboardingSteps';
import { useAccountSource } from './OnboardingAccountSource';
import type { AccountSourceChoice } from './OnboardingAccountSource';
import { OnboardingAccountLane } from './OnboardingAccountLane';
import { OnboardingChoiceRow } from './OnboardingChoiceRow';
import { OnboardingInset } from './OnboardingInset';
import { OnboardingPageAction, OnboardingStepCard } from './OnboardingStepCard';

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
  const blockedReason = setup.canCreate || loading || creating ? undefined : createBlockedReason(setup, local);

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
            <ScopeChoice
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
        index={local ? 3 : undefined}
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
            <AccountLanes
              setup={setup}
              local={local}
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
          (error || blockedReason) && <CreateNotice error={error} blockedReason={blockedReason} id={blockedReasonId} />
        }
      >
        <Button
          variant="primary"
          disabled={!setup.canCreate || creating}
          aria-describedby={blockedReason ? blockedReasonId : undefined}
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

/** A create failure wins; otherwise, while Create is off, the one thing still missing. */
function CreateNotice({ error, blockedReason, id }: { error?: string; blockedReason?: string; id: string }) {
  if (error)
    return (
      <Notice variant="destructive" role="alert">
        {error}
      </Notice>
    );
  if (!blockedReason) return null;
  return (
    <Txt id={id} as="p" variant="meta" tone="muted" className="m-0 text-end max-[899px]:text-center">
      {blockedReason}
    </Txt>
  );
}

/** Why Create is off, in the words of the lanes above, so a disabled button never leaves the user guessing. */
function createBlockedReason(setup: OnboardingModelSetup, local: boolean): string {
  if (!setup.draft.repository) return 'Choose a repository in Codebase to create your factory.';
  if (local) return 'Connect a provider and pick a model to create your factory.';
  const companyMissing = !setup.company.choice;
  const personalMissing = !setup.personal.choice;
  if (setup.scope === 'user') return 'Connect your account and pick a model to create your factory.';
  if (setup.scope === 'factory') return 'Connect the company account and pick a model to create your factory.';
  if (companyMissing && personalMissing)
    return 'Pick a model for Factory work and for your sessions to create your factory.';
  if (companyMissing) return 'Pick a model for Factory work to create your factory.';
  return 'Pick a model for your sessions to create your factory.';
}

function LoadingInset({ label, rows }: { label: string; rows: number }) {
  return (
    <OnboardingInset>
      <SkeletonRows label={label} rows={rows} rowClassName="h-14 w-full" />
    </OnboardingInset>
  );
}

/** Short enough for one line each; the account blocks below and the preview carry the detail. */
const SCOPES: { value: OnboardingModelScope; icon: ReactNode; meta: string }[] = [
  { value: 'factory', icon: <Building2 aria-hidden="true" />, meta: 'Pays for all Factory work and sessions.' },
  {
    value: 'hybrid',
    icon: <Split aria-hidden="true" />,
    meta: 'Company pays for work, each person for their sessions.',
  },
  { value: 'user', icon: <UserRound aria-hidden="true" />, meta: 'Each person pays for their own work and sessions.' },
];

/** The choice everything below depends on, asked first and in terms of who pays. */
function ScopeChoice({
  scope,
  companyLocked,
  disabled,
  onScopeChange,
}: {
  scope: OnboardingModelScope;
  companyLocked: boolean;
  disabled: boolean;
  onScopeChange: (scope: OnboardingModelScope) => void;
}) {
  return (
    <OnboardingInset>
      <RadioGroup
        aria-label="Who pays for model usage?"
        value={scope}
        disabled={disabled}
        onValueChange={value => {
          const next = SCOPES.find(item => item.value === value);
          if (next) onScopeChange(next.value);
        }}
        className="gap-0.5"
      >
        {SCOPES.map(({ value, icon, meta }) => (
          <OnboardingChoiceRow
            key={value}
            value={value}
            selected={scope === value}
            disabled={companyLocked && value !== 'user'}
            icon={icon}
            title={SETUP_LABELS[value]}
            meta={meta}
          />
        ))}
      </RadioGroup>
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

/** The accounts the answer needs, each with its provider and default model. */
function AccountLanes({
  setup,
  local,
  companyChoice,
  personalChoice,
  onPreviewCompany,
  onPreviewPersonal,
}: {
  setup: OnboardingModelSetup;
  local: boolean;
  companyChoice: AccountSourceChoice;
  personalChoice: AccountSourceChoice;
  onPreviewCompany: PreviewProvider;
  onPreviewPersonal: PreviewProvider;
}) {
  const { scope, company, personal } = setup;
  if (local)
    return (
      <OnboardingAccountLane
        scope="org"
        name="Factory default"
        lane={company}
        choice={companyChoice}
        onPreviewProvider={onPreviewCompany}
      />
    );

  // Both accounts stay rendered so switching the answer folds one away and opens the other in place.
  const hybrid = scope === 'hybrid';
  return (
    <>
      <Collapsible open={scope !== 'user'} className="onboarding-collapse">
        <CollapsibleContent>
          <OnboardingAccountLane
            scope="org"
            name="Company account"
            heading={{ label: 'Factory work', detail: 'Company account', shown: hybrid }}
            lane={company}
            choice={companyChoice}
            onPreviewProvider={onPreviewCompany}
          />
        </CollapsibleContent>
      </Collapsible>
      <Collapsible open={scope !== 'factory'} className="onboarding-collapse">
        <CollapsibleContent>
          <OnboardingAccountLane
            scope="user"
            name="Your account"
            heading={{ label: 'Your sessions', detail: 'Your own account', shown: hybrid }}
            lane={personal}
            choice={personalChoice}
            offersGateway={!hybrid}
            onPreviewProvider={onPreviewPersonal}
          />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
