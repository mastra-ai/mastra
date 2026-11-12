import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import { useWorkSourceConnections, WORK_SOURCE_NAME, WORK_SOURCES } from '../../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../../services/github';
import { ONBOARDING_SECTIONS, SETUP_LABELS } from '../../services/onboardingSteps';
import type { OnboardingSection } from '../../services/onboardingSteps';
import { ONBOARDING_FRAME_RADIUS } from './OnboardingStepCard';

interface ChangeSectionProps {
  onChange: () => void;
  changeDisabled: boolean;
}

/** A section not reached yet: a muted preview of what it asks for. */
function OnboardingNextRow({ section, index, hint }: { section: OnboardingSection; index?: number; hint?: string }) {
  const { label, ...meta } = ONBOARDING_SECTIONS[section];
  return (
    <section aria-label={label} className={cn('flex min-h-14 items-center gap-3 px-4 py-3', ONBOARDING_FRAME_RADIUS)}>
      <span
        className="bg-fill text-muted-foreground grid size-6 shrink-0 place-items-center rounded-full"
        aria-hidden="true"
      >
        <Txt as="span" variant="meta">
          {index ?? meta.index}
        </Txt>
      </span>
      <Txt as="span" tone="muted" className="w-20 shrink-0">
        {label}
      </Txt>
      {hint && (
        <Txt as="span" variant="meta" tone="muted" className="ms-auto truncate max-[899px]:hidden">
          {hint}
        </Txt>
      )}
    </section>
  );
}

/**
 * A finished section: a raised card, one step below the open section, whose whole row reopens it.
 * The button is named for the action; the chosen value describes it.
 */
function OnboardingDoneRow({
  section,
  value,
  subValue,
  onChange,
  changeDisabled,
}: ChangeSectionProps & { section: OnboardingSection; value?: string; subValue?: string }) {
  const { label } = ONBOARDING_SECTIONS[section];
  const valueId = useId();
  return (
    <section aria-label={label} className={cn('onboarding-card bg-card', ONBOARDING_FRAME_RADIUS)}>
      <button
        type="button"
        aria-label={`Change ${label.toLowerCase()}`}
        aria-describedby={valueId}
        disabled={changeDisabled}
        onClick={onChange}
        className={cn(
          'state-layer flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-start before:transition-none disabled:cursor-not-allowed',
          ONBOARDING_FRAME_RADIUS,
          focusRingInset,
        )}
      >
        <span
          className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Check className="size-3.5" />
        </span>
        <Txt as="span" tone="muted" className="w-20 shrink-0">
          {label}
        </Txt>
        <span id={valueId} className="flex min-w-0 flex-1 items-baseline gap-2">
          <Txt as="span" tone="ink" className="min-w-0 truncate">
            {value}
          </Txt>
          {subValue && (
            <Txt as="span" variant="meta" tone="muted" className="shrink-0 truncate max-[899px]:hidden">
              {subValue}
            </Txt>
          )}
        </span>
        <Txt as="span" variant="caption" tone="muted" className="shrink-0">
          Change
        </Txt>
      </button>
    </section>
  );
}

/** Codebase while closed: the picked repository and branch, or a preview until one is picked. */
export function OnboardingCodebaseRow({
  repository,
  ...change
}: ChangeSectionProps & { repository?: SourceControlRepository }) {
  if (!repository) return <OnboardingNextRow section="vcs" />;
  return (
    <OnboardingDoneRow section="vcs" value={repository.fullName} subValue={repository.defaultBranch} {...change} />
  );
}

/** Work while closed: the connected sources once the user moved past Work, or a preview before that. */
export function OnboardingWorkRow({ confirmed, ...change }: ChangeSectionProps & { confirmed: boolean }) {
  if (!confirmed) return <OnboardingNextRow section="project-management" hint="Linear, Jira or incident.io" />;
  return <OnboardingWorkDoneRow {...change} />;
}

function OnboardingWorkDoneRow(change: ChangeSectionProps) {
  const status = useWorkSourceConnections();
  const linear = useLinearStatusQuery();
  const connected = WORK_SOURCES.filter(source => status[source]).map(source => WORK_SOURCE_NAME[source]);
  const linearWorkspace = status.linear ? linear.data?.workspace?.name : undefined;
  return (
    <OnboardingDoneRow
      section="project-management"
      value={connected.join(', ') || 'Set up later'}
      subValue={linearWorkspace ?? undefined}
      {...change}
    />
  );
}

/** The model Create would submit: the personal lane's on Personal accounts, the company lane's otherwise. */
function submittedModelId(setup: OnboardingModelSetup): string | undefined {
  if (setup.scope === 'user') return setup.personal.choice?.modelId;
  return setup.company.choice?.modelId;
}

/** Accounts while closed: who pays once Create is possible, or a preview before that. Opens the Model step. */
export function OnboardingAccountsRow({ setup, ...change }: ChangeSectionProps & { setup: OnboardingModelSetup }) {
  if (!setup.canCreate) return <OnboardingNextRow section="accounts" hint="Company or personal accounts" />;
  return <OnboardingDoneRow section="accounts" value={SETUP_LABELS[setup.scope]} {...change} />;
}

/** Model while closed: the model Create would submit, or a preview before that. Third in local mode. */
export function OnboardingModelRow({
  setup,
  local,
  ...change
}: ChangeSectionProps & { setup: OnboardingModelSetup; local: boolean }) {
  if (!setup.canCreate) {
    const hint = setup.company.connection.gatewayProvider ? 'Mastra Gateway or your own provider' : 'Your own provider';
    return <OnboardingNextRow section="model" index={local ? 3 : undefined} hint={hint} />;
  }
  return <OnboardingDoneRow section="model" value={submittedModelId(setup)} {...change} />;
}
