import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentProps } from 'react';

/**
 * The inset that holds a section's choices, like the chat model picker's: the card frames it, and the
 * controls that act on the whole section (host choice, Manage access, settings, Continue) stay on the
 * card outside it. Lists keep the 4px rim; panels of fields pass their own padding.
 */
export function OnboardingInset({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('bg-background flex min-w-0 flex-col gap-0.5 rounded-xl p-1', className)} {...props} />;
}
