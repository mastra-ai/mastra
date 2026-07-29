import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export function SettingsSubsection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Txt as="h2" variant="ui-md" className="text-icon6 font-semibold">
            {title}
          </Txt>
          {description && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {description}
            </Txt>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
