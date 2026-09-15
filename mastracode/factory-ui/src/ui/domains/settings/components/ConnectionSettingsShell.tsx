import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function ConnectionSettingsShell({
  backLabel,
  backTo,
  children,
  description,
  title,
}: {
  backLabel: string;
  backTo: string;
  children: ReactNode;
  description: string;
  title: ReactNode;
}) {
  return (
    <section aria-label="Connection settings" className="flex flex-1 flex-col px-5 pb-5">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-3">
        <Button as={Link} to={backTo} variant="ghost" size="sm" className="self-start">
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Button>
        <header className="flex flex-col gap-2">
          <Txt as="h1" variant="header-sm" className="text-icon6">
            {title}
          </Txt>
          <Txt as="p" variant="ui-md" className="text-icon3">
            {description}
          </Txt>
        </header>
        {children}
      </div>
    </section>
  );
}
