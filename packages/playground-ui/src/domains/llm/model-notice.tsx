import type { ComponentProps, ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { cn } from '@/utils/cn';

/** A warning line about the picked model, e.g. under a chat composer: "Set OPENAI_API_KEY to use this provider". */
export function ModelNotice({ children, className, ...props }: ComponentProps<'div'> & { children: ReactNode }) {
  return (
    <div className={cn('flex max-w-full min-w-0 items-start gap-1 text-warning-foreground', className)} {...props}>
      <IconExclamationTriangle aria-hidden className="mt-0.5 size-icon-xs shrink-0" />
      <Txt as="span" variant="caption" className="min-w-0 break-words">
        {children}
      </Txt>
    </div>
  );
}

/** Code inside a `ModelNotice`, like an environment variable or a model id. */
export function ModelNoticeCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-warning-subtle px-1 py-0.5 break-all text-warning-subtle-foreground">{children}</code>
  );
}

/** The provider's key isn't set: `envVar` may list several, as the provider registry does. */
export function MissingProviderKeyNotice({ envVar }: { envVar: string | string[] }) {
  return (
    <ModelNotice>
      Set <ModelNoticeCode>{Array.isArray(envVar) ? envVar.join(', ') : envVar}</ModelNoticeCode> to use this provider
    </ModelNotice>
  );
}
