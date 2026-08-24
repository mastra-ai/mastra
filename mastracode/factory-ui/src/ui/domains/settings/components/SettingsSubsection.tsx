import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export function SettingsSubsection({
  id,
  title,
  description,
  action,
  children,
}: {
  /** Anchor id so other surfaces can deep-link to this subsection. */
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Txt as="h2" variant="ui-sm" className="text-icon6 leading-ui-md font-semibold">
          {title}
        </Txt>
        {description && (
          <Txt as="p" variant="ui-sm" className="text-icon3">
            {description}
          </Txt>
        )}
        {action && <div className="mt-1 flex">{action}</div>}
      </div>
      {children}
    </section>
  );
}
