import type { ComponentProps, ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { cn } from '@/utils/cn';

/** A warning line about the picked model, e.g. under a chat composer. Wrap ids and variables in `<code>`. */
export function ModelNotice({ children, className, ...props }: ComponentProps<'div'> & { children: ReactNode }) {
  return (
    <div className={cn('flex max-w-full min-w-0 items-start gap-1 text-warning-foreground', className)} {...props}>
      <IconExclamationTriangle aria-hidden className="mt-0.5 size-icon-xs shrink-0" />
      <Txt
        as="span"
        variant="caption"
        className="min-w-0 break-words [&_code]:rounded [&_code]:bg-warning-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:break-all [&_code]:text-warning-subtle-foreground"
      >
        {children}
      </Txt>
    </div>
  );
}

/** The provider's key isn't set: `envVar` may list several, as the provider registry does. */
export function MissingProviderKeyNotice({ envVar }: { envVar: string | string[] }) {
  return (
    <ModelNotice>
      Set <code>{Array.isArray(envVar) ? envVar.join(', ') : envVar}</code> to use this provider
    </ModelNotice>
  );
}
