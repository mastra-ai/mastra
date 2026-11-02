import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

type HintButtonProps = Omit<ComponentProps<typeof Button>, 'tooltip'> & {
  /** Always shown on hover and focus, disabled or not. */
  hint: ReactNode;
};

/**
 * A button whose tooltip still shows while it's disabled: a disabled button gets no pointer or
 * focus events, so the tooltip hangs on a focusable wrapper instead.
 */
export function HintButton({ hint, disabled, ...props }: HintButtonProps) {
  if (!disabled) return <Button tooltip={hint} {...props} />;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-full" />}>
        <Button disabled aria-label={typeof hint === 'string' ? hint : undefined} {...props} />
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
