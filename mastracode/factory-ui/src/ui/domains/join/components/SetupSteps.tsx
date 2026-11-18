import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId } from 'react';
import type { ReactNode } from 'react';

import {
  ONBOARDING_FRAME_RADIUS,
  ONBOARDING_PINNED_PRIMARY,
} from '../../workspaces/components/onboarding/onboardingLayout';

/**
 * The member setup page's cards. Same frame, numbering and rows as the create-factory onboarding
 * (`OnboardingStepCard`, `OnboardingDoneRow`, `OnboardingNextRow`), keyed by a label instead of an
 * `OnboardingSection` so the steps can be whatever this member still needs.
 */
export function SetupStepCard({
  index,
  label,
  headerEnd,
  notice,
  children,
  note,
  primary,
}: {
  index: number;
  label: string;
  headerEnd?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
  note?: string;
  primary?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn('onboarding-reveal onboarding-card-open bg-card flex flex-col gap-1 p-1', ONBOARDING_FRAME_RADIUS)}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-3 px-3 py-2">
        <span
          className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Txt as="span" variant="meta">
            {index}
          </Txt>
        </span>
        <Txt as="h2" id={id} variant="label" tabIndex={-1} className="outline-none">
          {label}
        </Txt>
        {headerEnd && <div className="ms-auto">{headerEnd}</div>}
      </div>
      {notice}
      {children}
      {(note || primary) && (
        <div className="flex items-center justify-between gap-3 p-1">
          {note && (
            <Txt variant="meta" tone="muted" className="ps-2 max-[899px]:hidden">
              {note}
            </Txt>
          )}
          {primary && <div className={cn('ms-auto', ONBOARDING_PINNED_PRIMARY)}>{primary}</div>}
        </div>
      )}
    </section>
  );
}

export function SetupDoneRow({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <section aria-label={label} className={cn('onboarding-card bg-card', ONBOARDING_FRAME_RADIUS)}>
      <div className={cn('flex min-h-14 w-full items-center gap-3 px-4 py-3', ONBOARDING_FRAME_RADIUS)}>
        <span
          className="bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <IconCheckmark2Medium className="size-icon-sm" />
        </span>
        <Txt as="span" tone="muted" className="w-20 shrink-0">
          {label}
        </Txt>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <Txt as="span" tone="ink" className="min-w-0 truncate">
            {value}
          </Txt>
          {subValue && (
            <Txt as="span" variant="meta" tone="muted" className="shrink-0 truncate max-[899px]:hidden">
              {subValue}
            </Txt>
          )}
        </span>
      </div>
    </section>
  );
}

export function SetupNextRow({
  index,
  label,
  hint,
  optional,
}: {
  index: number;
  label: string;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <section aria-label={label} className={cn('flex min-h-14 items-center gap-3 px-4 py-3', ONBOARDING_FRAME_RADIUS)}>
      <span
        className="bg-fill text-muted-foreground grid size-6 shrink-0 place-items-center rounded-full"
        aria-hidden="true"
      >
        <Txt as="span" variant="meta">
          {index}
        </Txt>
      </span>
      <Txt as="span" tone="muted" className="w-20 shrink-0">
        {label}
      </Txt>
      {optional && (
        <Txt as="span" variant="meta" tone="muted" className="bg-fill rounded-full px-2 py-0.5">
          Optional
        </Txt>
      )}
      {hint && (
        <Txt as="span" variant="meta" tone="muted" className="ms-auto truncate max-[899px]:hidden">
          {hint}
        </Txt>
      )}
    </section>
  );
}
