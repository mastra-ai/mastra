import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { IconCheckmark1 } from '@mastra/playground-ui/icons/central/IconCheckmark1';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { ProviderBrandIcon } from '../ProviderBrandIcon';

/**
 * One provider in the list: instant subtle hover like the repositories, a check on the lane's provider.
 * A plain button rather than the DS `Button`: that one is a fixed-height, single-line pill, and this row
 * holds an icon, a title and a meta line at full width.
 */
export function OnboardingProviderOption({
  provider,
  icon,
  title,
  meta,
  reasonId,
  selected = false,
  onPreview,
  ...props
}: Omit<ComponentProps<'button'>, 'title' | 'aria-describedby'> & {
  provider?: string;
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  /** Why the option is disabled, read out with its meta. */
  reasonId?: string;
  selected?: boolean;
  onPreview?: () => void;
}) {
  const metaId = useId();
  const describedBy = [meta ? metaId : undefined, reasonId].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      aria-label={title}
      aria-describedby={describedBy || undefined}
      aria-current={selected || undefined}
      className={cn(
        'flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-start',
        'not-disabled:hover:bg-fill-subtle disabled:cursor-not-allowed disabled:opacity-50',
        focusRingInset,
      )}
      onMouseEnter={onPreview}
      onFocus={onPreview}
      {...props}
    >
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">
        {provider ? <ProviderBrandIcon provider={provider} /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="label" className="truncate">
          {title}
        </Txt>
        {meta && (
          <Txt as="span" id={metaId} variant="meta" tone="muted" className="truncate">
            {meta}
          </Txt>
        )}
      </span>
      {selected && <IconCheckmark1 aria-hidden="true" className="size-4 shrink-0" />}
    </button>
  );
}
