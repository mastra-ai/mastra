import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { IconCheckmark1 } from '@mastra/playground-ui/icons/central/IconCheckmark1';
import { useId } from 'react';
import { ONBOARDING_SECTIONS } from '../../services/onboardingSteps';
import type { OnboardingSection } from '../../services/onboardingSteps';
import { ONBOARDING_FRAME_RADIUS } from './onboardingLayout';

export interface ChangeSectionProps {
  onChange: () => void;
  changeDisabled: boolean;
}

/** A section not reached yet: a muted preview of what it asks for. */
export function OnboardingNextRow({
  section,
  index,
  hint,
}: {
  section: OnboardingSection;
  index?: number;
  hint?: string;
}) {
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
export function OnboardingDoneRow({
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
          'state-layer flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-start disabled:cursor-not-allowed',
          ONBOARDING_FRAME_RADIUS,
          focusRingInset,
        )}
      >
        <span
          className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <IconCheckmark1 className="size-3.5" />
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
