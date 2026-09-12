import type { ReactNode } from 'react';
import { useId } from 'react';
import { Txt } from '../Txt';

export function SettingsSubsection({
  id,
  title,
  description,
  titleAccessory,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  titleAccessory?: ReactNode;
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
            {titleAccessory}
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
