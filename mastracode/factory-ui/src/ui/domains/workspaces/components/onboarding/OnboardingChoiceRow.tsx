import { RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * One row of an onboarding radio group. The radio stays for keyboard and screen readers but is visually
 * hidden: the lifted card and a trailing check mark the choice, and the row shows the radio's focus ring.
 * Icon, title and check share a 20px first line so every column lines up across rows. `meta` explains
 * the selected row under its title; every row keeps it so a new choice opens its line while the old one
 * folds, over the same time and curve, and the group never changes height.
 */
export function OnboardingChoiceRow({
  value,
  selected,
  disabled = false,
  icon,
  title,
  meta,
}: {
  value: string;
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
}) {
  const titleId = useId();
  const metaId = useId();
  return (
    <label
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-lg p-3 has-[[role=radio]:focus-visible]:outline-1 has-[[role=radio]:focus-visible]:-outline-offset-1 has-[[role=radio]:focus-visible]:outline-solid has-[[role=radio]:focus-visible]:outline-border-focus',
        selected && 'onboarding-card bg-card',
        !selected && !disabled && 'hover:bg-fill-subtle',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <RadioGroupItem
        value={value}
        disabled={disabled}
        aria-labelledby={titleId}
        aria-describedby={meta ? metaId : undefined}
        className="sr-only"
      />
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" id={titleId} variant="label" className="flex min-h-5 items-center">
          {title}
        </Txt>
        {meta && (
          <span aria-hidden={!selected} data-open={selected} className="onboarding-fold">
            <span className="min-h-0 overflow-hidden">
              <Txt as="span" id={metaId} variant="meta" tone="muted" className="block pt-0.5">
                {meta}
              </Txt>
            </span>
          </span>
        )}
      </span>
      {selected && (
        <span className="onboarding-enter flex h-5 shrink-0 items-center">
          <Check aria-hidden="true" className="size-4" />
        </span>
      )}
    </label>
  );
}
