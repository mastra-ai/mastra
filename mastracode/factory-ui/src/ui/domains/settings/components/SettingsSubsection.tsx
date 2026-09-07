import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { ScopeBadge, ScopeSwitch } from './SettingsScope';
import type { ScopeControl, SettingsScope } from './SettingsScope';

export function SettingsSubsection({
  id,
  title,
  description,
  scope,
  action,
  children,
}: {
  /** Anchor id so other surfaces can deep-link to this subsection. */
  id?: string;
  title: string;
  description?: string;
  scope: SettingsScope | ScopeControl;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();

  return (
    <section id={id} aria-labelledby={titleId} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Txt as="h2" id={titleId} variant="ui-sm" className="text-icon6 leading-ui-md font-semibold">
              {title}
            </Txt>
            <ScopeIndicator scope={scope} />
          </div>
          {description && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {description}
            </Txt>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ScopeIndicator({ scope }: { scope: SettingsScope | ScopeControl }) {
  if (typeof scope === 'string') return <ScopeBadge scope={scope} />;
  if (scope.options.length > 1) return <ScopeSwitch {...scope} />;
  return <ScopeBadge scope={scope.value} />;
}
