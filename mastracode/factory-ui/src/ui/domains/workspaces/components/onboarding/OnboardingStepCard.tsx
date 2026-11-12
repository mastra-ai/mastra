import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { ONBOARDING_SECTIONS } from '../../services/onboardingSteps';
import type { OnboardingSection } from '../../services/onboardingSteps';
import { ONBOARDING_FRAME_RADIUS, ONBOARDING_PINNED_PRIMARY } from './onboardingLayout';

/**
 * The open section, framed like the chat model picker: the numbered header and the footer (a note or
 * actions, then the primary action) sit on the frame, and the content sits inside it, usually in an inset.
 * Like ChatGPT's composer, the frame is a white card with a soft hairline and a long, faint drop
 * (`.onboarding-card-open`); finished sections take the short drop, and the inset sits below both.
 */
export function OnboardingStepCard({
  section,
  index,
  headerEnd,
  notice,
  children,
  note,
  actions,
  primary,
}: {
  section: OnboardingSection;
  /** Replaces the section's number when a card before it is left out (Accounts in local mode). */
  index?: number;
  headerEnd?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
  note?: string;
  actions?: ReactNode;
  primary?: ReactNode;
}) {
  const id = useId();
  const { label, ...meta } = ONBOARDING_SECTIONS[section];
  const shownIndex = index ?? meta.index;
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
            {shownIndex}
          </Txt>
        </span>
        {/* Focusable from script only: the page moves focus here when the section opens. */}
        <Txt as="h2" id={id} variant="label" tabIndex={-1} className="outline-none">
          {label}
        </Txt>
        {headerEnd && <div className="ms-auto max-[899px]:ms-0 max-[899px]:basis-full">{headerEnd}</div>}
      </div>
      {notice}
      {children}
      {(actions || note || primary) && (
        <div className="flex items-center justify-between gap-3 p-1">
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          {!actions && note && (
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
